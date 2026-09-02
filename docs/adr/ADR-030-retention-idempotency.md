# ADR-030 — Idempotencia / Concurrencia del Retention Engine (H1)

- **Status**: Accepted (decisión del Concilio — GODZILLA T1-3, hallazgo HIGH H1; habilita la autorización de T1-4 tras aterrizar el fix)
- **Date**: 2026-09-02
- **Context**: GODZILLA T1-3 terminó con **FAIL** por un hallazgo HIGH real (H1): la secuencia `check sentinel → emit event → persist sentinel` no es atómica. Dos ejecuciones concurrentes del mismo mensaje (doble webhook, retry de cliente, doble-tap) pueden emitir **2× `SALE_CANCELLED`** de oferta + 2 ofertas; la misma ventana existe en `confirm_cancel` (doble cancelación real + doble `mia_signals`). La causa ya existía en el interceptor WhatsApp (`handleCancellationWebhook`), pero T1-3 amplía la superficie a todos los canales. Este ADR fija la decisión mínima de idempotencia ANTES de T1-4. **NO autoriza implementación, migración ni commit** de la solución: deja la decisión y el criterio de aceptación para una tarea de hardening dedicada.

Autoridades de contexto: `docs/adr/ADR-029-retention-core-wiring.md` (§4 estado, §8 riesgos, §10 criterio), `docs/adr/ADR-028.md` (D4 canal ≠ decisión, D5 autoridad de cancelación en el Core), `docs/mia/PRD-BEHAVIOR-PARITY.md` (§3 invariante), hallazgo H1 del reporte GODZILLA T1-3.

Evidencia de HEAD en el momento del análisis: `85c2f9e0305a4e4ed2638beab69aff0b94845c9c` (T1-3), origin/main sincronizado.

---

## 1. INVARIANTE (formal)

Para una misma conversación (un journey de venta = una conversación), debe ser **imposible**:

1. **1.1 Oferta única**: no más de **UN** `SALE_CANCELLED` con `metadata.reason='discount_offered'` (la oferta de retención) por conversación.
2. **1.2 Cancelación única**: no más de **UN** `SALE_CANCELLED` real (con `original_sale_event_id`, distinto del de oferta) por conversación.
3. **1.3 Sin señales duplicadas**: cada transición oferta/cancelación genera exactamente una `mia_signals`/update de cliente/update de conversación para ese resultado.
4. **1.4 Efectos parciales ante retry**: ante cualquier fallo o request duplicado, el estado converge al mismo resultado que la ejecución única (idempotencia de estado), y ningún request concurrente "perdedor" persiste efectos propios.

El invariante se define a nivel de **conversación**, porque:
- el sentinel ya vive en `conversations.sales_cancelled_at` (migración 045);
- el modelo de estados es per-conversación (`none → discount_offered → cancelled`, ADR-029 §4);
- un viaje de venta = una conversación.

## 2. GRANULARIDAD DE LA CLAVE

**Clave = `conversation_id` + variante de evento** (oferta vs cancelación real). No se inventa ninguna entidad nueva.

| Candidata | ¿Sirve? | Por qué no / por qué sí |
|---|---|---|
| `conversation_id` (oferta / cancel) | ✅ **Elegida** | Es la identidad del state machine existente (sentinel en `conversations`); cubre BOTH el doble-request del mismo mensaje Y el doble-tap de dos mensajes; funciona idéntico en Core e interceptor (sin depender del canal). |
| `customer_id` | ❌ | Demasiado grueso: un cliente puede tener varias conversaciones en el tiempo (distintos journeys). |
| `original_sale_event_id` (order id) | ❌ | La oferta no lo conoce aún suficientemente simple; no unifica oferta+confirm en una sola clave; añade acoplamiento sin ganancia. |
| `messages.id` / turno | ❌ | Preciso para el MISMO mensaje, pero (a) el interceptor WhatsApp no persiste el mensaje antes de decidir (no aplica en la ventana T1-3→T1-4), (b) no cubre doble-tap de dos mensajes distintos. |
| tabla `idempotency_keys` nueva | ❌ | Entidad nueva innecesaria: `sales_events` + `conversation_id` ya proveen la identidad. |

## 3. DECISIÓN

**Opción B: dos índices `UNIQUE` parciales sobre `public.sales_events`** — el commit point de la escritura del evento ES la garantía atómica (first-write-wins a nivel de fila). La decisión de negocio sigue viviendo en el motor TS (`retention.ts`/`cancel.ts`, D5); la base de datos únicamente **hace imposible** la violación del invariante.

```sql
-- (migración futura 060 — NO ejecutada por este ADR)
-- Pre-flight (datos históricos; ver §8):
-- SELECT conversation_id, count(*) FROM public.sales_events
--  WHERE event_type='SALE_CANCELLED'
--  GROUP BY conversation_id HAVING count(*) > 1;

-- Garantía 1.1 — una única oferta de retención por conversación:
CREATE UNIQUE INDEX uq_sales_events_retention_offer_once
  ON public.sales_events (conversation_id)
  WHERE event_type='SALE_CANCELLED'
    AND metadata @> '{"reason":"discount_offered"}'

-- Garantía 1.2 — una única cancelación real por conversación:
CREATE UNIQUE INDEX uq_sales_events_cancellation_once
  ON public.sales_events (conversation_id)
  WHERE event_type='SALE_CANCELLED'
    AND NOT (metadata @> '{"reason":"discount_offered"}');
```

**Predicados**: los dos índices **particionan** el dominio `SALE_CANCELLED` de forma complementaria (`@>` vs `NOT @>`), y ambos escritores actuales las cumplen sin cambio:
- la **oferta** (Core `retention.ts:124-126` e interceptor `process.ts:217-219`) escribe `metadata: { reason: 'discount_offered' }` → cae en el índice de oferta;
- la **cancelación real** (`cancel.ts:99-111`, compartida por Core e interceptor) escribe `metadata.reason = detection.reason` + `original_sale_event_id` → cae en el índice de cancelación.

**Invariante de motor consecuencia**: los eventos de cancelación real **deben** incluir `original_sale_event_id` y **nunca** usar `reason='discount_offered'` (ya es así; se vuelve contrato).

### 3.1 Flujo concurrente — ANTES (roto)
```
Req A ──► check sentinel (vacío) ──► INSERT SALE_CANCELLED ✓ ──► update sentinel ✓ ──► oferta A
Req B ──► check sentinel (vacío) ──► INSERT SALE_CANCELLED ✓ ──► update sentinel ✓ ──► oferta B
            (2 eventos, 2 ofertas, 1 conversación)
```

### 3.2 Flujo concurrente — DESPUÉS (correcto)
```
Req A ──► check sentinel (vacío) ──► INSERT SALE_CANCELLED ✓ (gana el slot único)
                                   ──► update sentinel      ✓ ──► oferta A
Req B ──► check sentinel (vacío) ──► INSERT SALE_CANCELLED ✗ (23505 unique_violation)
                                   ──► 23505 → respuesta determinista `ack` (sin LLM,
                                       sin evento, sin sentinel propio, sin señal)
            (1 evento, 1 oferta, 1 conversación)
```

## 4. OFERTA (cómo garantizar check→emit→persist atómico)

La atomicidad la da el **índice único**, no un lock ni una transacción:
1. El motor mantiene su guarda actual (`discountAlreadyOffered` por sentinel) como fast-path (evita el INSERT en el 99% de los casos).
2. El `INSERT` de `SALE_CANCELLED` (offer) es el **commit point**: si gana, persigue sentinel + `outcome_history`; si pierde (`23505`), ninguna otra escritura ocurre.
3. El manejo de `23505` en el motor debe devolver `action:'ack'` con un mensaje fijo determinista (constante nueva, p. ej. `'Ya procesé tu solicitud. Revisa mi mensaje anterior.'`), **idéntico para cualquier perdedor**, sin re-ofertar ni llamar al LLM.

Trade-off explícito: un `23505` requiere que el motor detecte `unique_violation` en `emitSalesEvent` (propagarlo como error tipado o código) y lo traduzca a la rama `ack`. Es un cambio TS acotado y determinista.

## 5. CONFIRM_CANCEL (cómo garantizar una sola cancelación real)

La misma garantía 1.2 corta la doble cancelación:
1. Primer confirm: pasa detección LLM, `INSERT` real gana, update conversación + `mia_signals` + cliente se ejecutan una vez.
2. Confirm duplicado (retry/mismo mensaje/doble-tap del mismo "sí"): su `INSERT` real falla con `23505` ANTES del update/signal → no hay doble `mia_signals` ni doble `customers.last_cancelled_order`.
3. Manejo de `23505` en `processCancellation`: devolver un resultado determinista tipo `ack` ("El pedido ya está cancelado") en lugar de propagar el error al turno. El detector LLM podría ejecutarse de más (detalle de coste, no de corrección); el fix puede añadir una re-lectura de `sales_cancelled_at` tras `23505` para responder coherentemente.

## 6. EVENT-FIRST (se preserva)

- La secuencia `emit event → persist sentinel` se mantiene intacta: el evento sigue siendo la primera escritura y el commit point.
- La **compensación id-scoped** existente se conserva literal: si la escritura de conversación falla tras el evento, se borra SOLO el `id` del evento creado (`retention.ts:154-166`, `process.ts:237-256`). Tras el índice, ese borrado además libera el slot único → un retry posterior puede ofertar limpio (el usuario nunca vio la oferta porque el turno falló antes de persistir la respuesta).
- Garantía añadida: **ya no pueden existir eventos huérfanos dobles** (hoy, si dos `INSERT` triunfan y ambos updates fallan, la compensación id-scoped deja 1 evento vivo).

## 7. FALLO / RETRY (matriz)

| Fallo | Qué pasa | Comportamiento de retry |
|---|---|---|
| `INSERT` evento falla por `23505` (duplicado concurrente) | Ramas `offer` → `ack`; `confirm` → `ack` "ya cancelado". Sin cambios de estado del perdedor. | El request duplicado recibe la misma respuesta determinista. |
| `INSERT` evento falla por otro error (red/DB) | Se propaga (throw), nada persistido. | Request idéntico se reintenta limpio (sin efectos parciales). |
| Write de conversación falla tras evento | Compensación id-scoped borra el evento propio; error propagado. | Slot liberado → retry puede ofertar/cancelar limpio. |
| Respuesta al cliente falla (transporte) tras éxito | Estado ya comprometido (evento + sentinel). El usuario NO ve la oferta. | No hay doble evento jamás. El siguiente turno verá el sentinel → `ack`, sin re-oferta. |
| Request duplicado después de éxito completo | Sentinel presente → `ack` normal (fast-path). | El índice es la red de seguridad de la ventana de carrera. |

## 8. MIGRACIÓN

La solución requiere una migración: los dos `CREATE UNIQUE INDEX` de §3.

- **Garantía que aporta**: imposibilidad a nivel DB de 1.1 y 1.2 (atómico, sin locks, sin transacciones en el app).
- **Compatibilidad con datos existentes**: `SALE_CANCELLED` solo lo escriben los 3 puntos ya mapeados (Core `retention.ts`, `cancel.ts`, interceptor `process.ts`); no hay otros productores en producción (grep `src/**`: solo estos). Como ofertas/cancelaciones existen desde T1-2 (2026-08-31), el volumen histórico es mínimo.
- **Pre-flight obligatorio antes de crear los índices** (query de §3): detectar duplicados por `conversation_id`. En caso de hallazgos (posible vía la carrera H1), resolver **antes** de crear el constraint (conservar el evento con `min(id)`, borrar los posteriores; es decisión de una tarea de limpieza, no de este ADR).
- **Rollback**: `DROP INDEX uq_sales_events_retention_offer_once; DROP INDEX uq_sales_events_cancellation_once;` (reversible, sin pérdida de datos).

Alternativa descartada: índice `UNIQUE` parcial con `NOT VALID` + `VALIDATE` (la creación ya es no bloqueante a nivel fila y el volumen es mínimo; innecesaria).

## 9. COMPATIBILIDAD (Core / WhatsApp legacy / WebChat / Simulator / stream / complete)

| Superficie | Efecto |
|---|---|
| **Core** (`processCore` → ramas de retención) | ✅ El motor TS sigue siendo el dueño de la decisión (D5); solo gana el manejo tipado de `23505` y la rama `ack` determinista. |
| **WhatsApp legacy (interceptor `handleCancellationWebhook`)** durante la ventana T1-3→T1-4 | ✅ El interceptor ya etiqueta `reason:'discount_offered'` (`process.ts:218`) y usa `processCancellation` para el confirm → queda cubierto por los mismos índices. Sin cambios en el interceptor. |
| **WebChat (widget) y Web/Messenger/Instagram** (`processStreaming` / `processIncomingMessage`) | ✅ La garantía vive en la DB: independiente del transporte. Ramas stream/complete reciben el mismo resultado. |
| **Simulator / Training** | ✅ Rutas de laboratorio no tocan retención (grep 0 matches); no afectado. |
| **Streaming vs complete** | ✅ El índice actúa en el commit de fila, ortonal a la vía de transporte. |

## 10. ALCANCE (quién lo implementa, qué NO es esto)

Esto es **solamente la decisión arquitectónica**. La implementación será una **tarea de hardening dedicada y separada (fuera de T1-4..T1-8)** que incluya: migración 060 + manejo tipado de `23505` (constante `ack` de duplicado) + tests de concurrencia real.

**Fuera de alcance (pese a T1-3 FAIL, NO toca nada de esto)**: T1-4 (retiro del interceptor), T1-5 (reactivación por aceptación), T1-6 (textos ACK a config), T1-7 (consolidación del doble `processSaleClosing`), T1-8 (refactor de sentinel/prompts), Media/Intent, Product ID/Provenance, Canonical Interactive. No se toca `messages`, `channel_messages`, `mia_signals`, ni el schema de `conversations`.

## 11. ANÁLISIS COMPARATIVO A/B/C/D

| Criterio | A — `SELECT ... FOR UPDATE` | B — UNIQUE parcial (ELEGIDA) | C — `idempotency_key` por turno | D — combinación B+C |
|---|---|---|---|---|
| Atomicidad | ✅ (pero exige RPC/transacción) | ✅ (commit point del INSERT) | 🟡 (requiere guarda + tabla/columna) | ✅ |
| Idempotencia | ✅ | ✅ exact-once por conversación+variante | 🟡 solo MISMO mensaje (no doble-tap) | ✅ |
| Event-first | ✅ | ✅ preservado | ✅ | ✅ |
| Semántica existente | ❌ fuerza a mover la decisión a SQL/función (viola D5) | ✅ decide en TS, DB solo hace imposible la violación | 🟡 nueva infraestructura de keys | 🟡 |
| Compatibilidad Supabase/Postgres | 🟡 `supabase-js` NO expone transacciones ni `FOR UPDATE`; exige RPC o driver `pg` | ✅ DDL nativo, sin locks, sin transacciones | 🟡 nueva columna/tabla; upsert-gate | 🟡 |
| Complejidad mínima | ❌ | ✅ menor | 🟡 | ❌ |
| Rollback | 🟡 remover función + revert | ✅ `DROP INDEX` | 🟡 migración de datos/columna | 🟡 |
| Cubre interceptor T1-3→T1-4 | 🟡 solo si el RPC se usa también ahí | ✅ idéntico (mismo tag `reason`) | ❌ (no hay messages.id antes de decidir) | 🟡 |

**Conclusión**: B es la única opción que satisface todos los criterios a la vez (atomicidad real, idempotencia en el nivel correcto de granularidad, event-first intacto, cero intrusión en la arquitectura motor/canal, DDL nativo, rollback trivial). **C es estrictamente más débil** (no cubre interceptor ni doble-tap) y **A es redundante y más invasivo** (replantea la decisión a SQL, contra D5). **D** se reduce a B: el fast-path por sentinel ya existe, y el índice convierte al intento fallido en un `ack` determinista, haciendo innecesario el lock (A) y el key por mensaje (C). **No se requiere nueva decisión de dominio** (el modelo `sales_events` + `conversation_id` ya provee la identidad) → **NO es `CONCILIO REQUIRED`**; esta decisión queda resuelta por este ADR.

## 12. RELACIÓN CON ADR-029

- ADR-029 §4 definió el sentinel como "guardia anti-reoferta" y §10.2 exigía **"Rojo si: doble `SALE_CANCELLED`"** en tests. ADR-030 **endurece ese invariante a nivel de base de datos**: lo que antes era solo un test de regresión pasa a ser imposible por constraint.
- ADR-029 §8 registró el riesgo ALTO del "punto de inyección central"; ADR-030 no lo agrava: el fix refuerza el motor, no lo bifurca por canal.
- ADR-029 §9 ("alterar `processCancellation` paso 2" requiere Concilio) NO aplica aquí: `processCancellation` no cambia su lógica interna; solo añade el manejo de `23505` en su `emit` (idempotencia, no semántica).
- El orden T1-3→T1-4 del ADR-029 se mantiene; el fix H1 se ejecuta como tarea previa a autorizar T1-4.

## 13. CRITERIO DE ACEPTACIÓN (para la tarea de hardening)

1. Migración 060 aplicada: ambos `CREATE UNIQUE INDEX` presentes (pre-flight de duplicados ejecutado y limpio).
2. `emitSalesEvent` distingue `unique_violation` (23505) del resto de errores y lo expone tipado al motor.
3. Perdedor de oferta → `ack` determinista (constante nueva, sin LLM, sin evento, sin señal); perdedor de confirm → `ack` "ya cancelado". Tests con respuestas IDÉNTICAS en ejecución secuencial y concurrente.
4. Test de concurrencia real: N≥2 requests simultáneos del mismo mensaje de cancelación sobre la misma conversación → **exactamente 1** `SALE_CANCELLED(discount_offered)`, **1** oferta al cliente, **0** duplicados; confirm doble → **1** `SALE_CANCELLED` real, **1** `mia_signals`.
5. Compensación id-scoped existente sigue funcionando (test de fallo de write de conversación + retry limpio).
6. Interceptor WhatsApp legacy, stream y complete siguen verdes (caracterización de regresión sobre los 16 tests T1-2/T1-3).
7. Sin cambios de prompt, de estados, de `messages`/`channel_messages`/`mia_signals`/`conversations` schema; diff acotado a la migración + motor + tests.

## Consecuencias

- **Positivas**: el invariante "una oferta / una cancelación por conversación" queda garantizado por la DB, no por disciplina; lo que GODZILLA probó como posible doble-disparo pasa a ser imposible; el fix es chico, reversible y no toca la arquitectura de canales.
- **Neutras**: el motor gana una rama de error tipado (`23505`) y una constante de ack; en confirm duplicado puede desperdiciarse una llamada de detección LLM (coste marginal, corregible dentro del mismo fix).
- **Negativas**: requiere una migración y una verificación de datos históricos; introduce dependencia del contenido de `metadata` en los predicados de índices parciales (se documenta el contrato de tags).

## Continuidad (si esta conversación desaparece)

- HEAD esperado al retomar: `85c2f9e` + este ADR-030 (sin commit: crearlo, NO pushear). Worktree: solo driver `workshop/subaru/gate-status-enrich.json` ajeno (no tocar).
- Documentos de autoridad: este ADR-030, ADR-029, ADR-028, PRD §3/§7.
- Estado: GODZILLA T1-3 = FAIL (H1); T1-4 **NO autorizada** hasta aterrizar el fix (migración 060 + `23505` handling + tests de concurrencia) como tarea dedicada fuera de T1-4..T1-8.
- Próximo paso: el Concilio crea y aprueba la tarea de hardening H1; tras su verde, nueva autorización para T1-4. NO implementar el fix ni T1-4 sin autorización.