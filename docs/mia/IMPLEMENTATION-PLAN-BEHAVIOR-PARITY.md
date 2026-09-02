# PLAN DE IMPLEMENTACIÓN — BEHAVIOR PARITY

- **Versión**: 1.0
- **Fecha**: 2026-09-01
- **Base**: PRD `docs/mia/PRD-BEHAVIOR-PARITY.md` (v1.1) · ADR `docs/adr/ADR-028.md` · Auditoría ETAPA 1 · HEAD `d03ff40` (`HEAD == origin/main`)
- **Estado**: ETAPA 3 (PLAN) — NADA implementado. Implementación requiere autorización explícita (ETAPA 4).

---

## 1. SCOPE

Convertir las decisiones aprobadas por el Concilio (ADR-028) en tareas pequeñas, verificables y reversibles. Orden de prioridad fijado por el usuario:

1. **Cancelación/descuento** unificado en Core con Behavior/Policy configurable (Decisión Especial + D1).
2. **Channel Contract**: propagar `channel` real; eliminar paridad accidental `widget → simulation` (D4).
3. **Product ID / Provenance**: validación/resolución explícita; error manejado en `context-scope.ts`; nunca degradación silenciosa (D6).
4. **Media / Intent**: activar `intent <tag>` como dimensión real (D3). **NO** decidir el orden definitivo `intent vs product vs keyword` (ADR-028 lo dejó `REQUIERE MÁS EVIDENCIA`).
5. **Canonical Decision / Interactive**: NO implementar; solo documentar dependencia y preparar tarea futura (D2 pospuesta).

Regla de diseño: **ETAPA 3 diseña el camino. ETAPA 4 lo ejecuta.** Si al planificar una tarea apareciera una decisión arquitectónica nueva → STOP → `REQUIERE DECISIÓN DEL CONCILIO`.

---

## 2. DEPENDENCIAS

```
T1-1 (policy data) ──→ T1-2 (motor retención) ──→ T1-3 (wire en Core) ──→ T1-4 (remover interceptor WhatsApp) ──→ T1-5 (reactivación) 
                                                        │                                                          │
                                                        └──→ T1-6 (texto configurable) ──→ T1-7 (consolidación sale-closing) ──→ T1-8 (gate shadow) [REQ DECISIÓN]
T2-1 (widget channel) ──→ T2-2 (normalizar channel por ruta) ──→ T2-3 (registry capacidades, preparatorio D2)
T3-1 (validate edge) ──→ T3-2 (error handling context-scope)
      └──→ T3-3 (bug knowledge.ts:243) [REQ DECISIÓN]
T4-1 (autoría intent) ──→ T4-2 (datos intent price) ──→ T4-3 (tests/guía) ── → T4-4 (consistencia product-recommendation) [VERIFICAR]
T5-1 (doc dependencia interactive) [DOC SOLO]
T-G-1 (harness paridad / comparación CoreOutput) ─── permite validar todas las anteriores
T-G-2 (suite e2e casos A–F PRD §7)
```

- `T1-4` depende de `T1-2`+`T1-3` (no eliminar el interceptor antes de que el Core lo cubra).
- `T2-3` consume la decisión de capacidades pero NO define el diseño de `interactive` (D2 pospuesta).
- `T3-3`, `T1-8`, `T4-4` son bugs/cláusulas **pendientes de decisión adicional** — se ejecutan solo si el Concilio las autoriza.

---

## 3. ORDEN DE EJECUCIÓN (propuesto para ETAPA 4)

```
Fase A (paridad crítica)
  T1-1 → T1-2 → T1-3 → T1-4 → T1-5 → T1-6 → T1-7 → validación casos C/D/E (§7)
Fase B (channel)
  T2-1 → T2-2 → T2-3 → validación caso F
Fase C (provenance)
  T3-1 → T3-2 → validación caso A
Fase D (media/intent)
  T4-1 → T4-2 → T4-3 → T4-4 → validación casos A/B
Fase E (canonical/interactive)
  T5-1 (doc) 
Fase F (gates)
  T-G-1 → T-G-2 → lint / build / Playwright / DevTools → Godzilla → Release
```

Cada Fase finaliza en STOP y requiere autorización para la siguiente.

---

## 4. MAPEO DEL FLUJO DE CANCELACIÓN (obligatorio — antes de T1)

### 4.1 Flujo ACTUAL

**Simulator / WebChat (stream):**
```
widget o api/chat → processStreaming → processCore
  → resolveCancellationGuards (solo contexto para el prompt)
  → AI responde la cancelación genéricamente
  → onFinish/complete → processSaleClosing (core.ts:279-293 / 225-239)
        safety-net: hasCancellationTrigger? (process.ts:349)
          → processCancellation directo (cancel.ts:24)
            → SALE_CANCELLED → conv completed + sales_cancelled_at
            → customer lost + last_cancelled_order → purge memory
  → NO descuento · NO sentinel · sin retención (1 solo paso)
```
Evidencia: `core.ts:225-239` (complete) y `:279-293` (stream); `process.ts:349-372`; `cancel.ts:24-211`.

**WhatsApp (interceptor exclusivo):**
```
webhook baileys → handleCancellationWebhook (process.ts:66) ANTES del Core
  paso 0: hasDiscountAcceptanceTrigger → limpia sentinel + borra SALE_CANCELLED → reactiva → vuelve a flujo normal (process.ts:74-112)
  paso 1 (sin SALE_WON activo RC6, o sin trigger de cancelación) → null → flujo normal (process.ts:114-136)
  paso 2 (¡primer intento!): canjea sentinel + SALE_CANCELLED(reason=discount_offered) + "10% de descuento" (string hardcoded process.ts:196) (process.ts:179-257, compensación id-scoped :241-255)
  paso 3 (segundo intento): processCancellation (process.ts:258-298) → misma persistencia
  → WhatsApp NO pasa por el LLM para la oferta de descuento
```
Evidencia: `src/app/api/channels/baileys/webhook/route.ts:40-52`; `process.ts:66-331`.

**DIVERGENCIA**: misma entrada de cancelación con la misma configuración produce decisión distinta:
| Aspecto | Simulator/Web | WhatsApp |
|---|---|---|
| Oferta de retención | nunca | sí, "10%" una vez |
| Número de pasos | 1 (directo) | 2 (oferta → cancelar) |
| Origen del texto | hardcoded (no config) | hardcoded (no config) |
| Persistencia estado/customer | idéntica | idéntica |
| Reactivación por aceptación | inexistente | existe (borra sentinel+SALE_CANCELLED) |

### 4.2 Flujo OBJETIVO (unificado en Core, gobernado por config)

```
cualquier canal → ruta(real channel) → processCore
  → resolveCancellationGuards (contexto para el prompt) [sin cambios]
  → NEW resolveRetentionDecision (determinístico, config) ANTES de AI:
       entradas: sales_cancelled_at (none|sentinel|fecha) · SALE_WON activo ·
                 trigger de cancelación del mensaje · salesConfig
                 (allow_cancellation, window, discount_pct, discount_message)
       ├─ none        + cancelación + SALE_WON → DISCOUNT_OFFER (una vez):
       │     SALE_CANCELLED(discount_offered) → sentinel → outcome_history
       │     (compensación id-scoped) → respuesta = discount_message (sin LLM)
       ├─ sentinel    + cancelación           → CONFIRM_CANCEL → processCancellation (reuso)
       ├─ cancelled   + cancelación           → ACK (mensaje canónico)
       └─ sin acción  → null → sigue flujo AI + processSaleClosing (post-close, sin cambios)
  → si acción ≠ none: respuesta canonica sin llamada a LLM; se persiste; se devuelve
  → reactivación (aceptación del descuento): paso determinístico POST-AI
       si sentinel y venta recuperada (outcome won/interested o afirmativa) →
       limpiar sentinel + borrar SALE_CANCELLED id-scoped (T1-5)
```

**Invariantes que se preservan** (requisito del usuario):
- Cancelación (paso 2) → `processCancellation` intacto.
- Descuento (paso 1) → pasa a config (pct + mensaje), continúa disparándose UNA sola vez (sentinel).
- Límite de una oferta → sentinel `isDiscountOfferSentinel` + estado `sales_cancelled_at` (sin cambios de esquema en flujo).
- Rechazo del descuento → segundo `hasCancellationTrigger` con sentinel → `CONFIRM_CANCEL`.
- Nueva oportunidad → guards P1 (`runtime.ts:57-171`) + `purgeCancelledOrderFromMemory` intactos.
- Anti-loop → `hasClosingEvent` (process.ts:375) y `hasCancellationLock` (process.ts:379) intactos.
- Estado persistido → `conversations.sales_cancelled_at/outcome_history`, `customers.status/last_cancelled_order`, `sales_events` — mismos contratos (Decisión 5).

**Se elimina**: rama `handleCancellationWebhook` exclusiva de WhatsApp (el Core la cubre); string "10% de descuento" hardcoded; diferencia de pasos por canal.

---

## 5. TASKS

### FASE A — CANCELACIÓN / DESCUENTO (Decisión Especial + D1)

#### TASK T1-1 — Policy de retención configurable en `business_sales_config`
- **Título**: Agregar `retention_discount_pct` y `retention_discount_message` a la config de venta.
- **Objetivo**: el descuento de retención deja de ser código; pasa a configuración del Dashboard (fuente de verdad).
- **Decisión ADR relacionada**: ADR-028 D1 (`when → then`, policy tipada) + Decisión Especial (cancelación/descuento gobernados por config).
- **Archivos potencialmente afectados**: `supabase/migrations/` (nueva migración incremental), `src/lib/ai/knowledge.ts` (SalesConfig type + defaults, :294-319, :338-370), form del Dashboard `SalesConfigForm`, componentes de configuración.
- **Dependencias**: ninguna.
- **Precondiciones**: governance `classify` (compleja — schema); aprobación del rol Database Engineer (solo él autoriza schema); no tocar migraciones aplicadas.
- **Cambios esperados**: dos columnas nuevas con defaults (`5-20%`, mensaje con placeholders `{customer_name}`); endpoints/form que las lean y escriban; `getSalesConfig` las devuelve.
- **Tests requeridos**: lectura de config con/sin fila (defaults); guard CLAMP del porcentaje (rango válido); round-trip del form.
- **Acceptance criteria**: `DiscountPolicy` disponible como tipado en runtime; sin strings de descuento hardcoded nuevos; migración idempotente.
- **Riesgo**: ALTO medio (schema). Nada depende de tablas nuevas para ejecutar hasta T1-2.
- **Rollback**: migración reversa (nueva migración que dropea columnas; nunca editar la aplicada).
- **Evidencia requerida**: hash de migración + `business_sales_config` con valores; commit.
- **Autorización**: ✅ ADR-028 cubre el diseño; ejecución requiere governance approbe (Database) en ETAPA 4.

---

#### TASK T1-2 — Motor determinístico `retentionDecision` (módulo nuevo)
- **Título**: Crear `src/lib/sales/retention.ts` con la máquina de estados de retención.
- **Objetivo**: portar la semántica de `handleCancellationWebhook` (process.ts:66-331) a un módulo canal-agnóstico keyed por config.
- **Decisión ADR**: Decisión Especial (Opción A) + D5 (estados normativos none→sentinel→cancelled) + D1.
- **Archivos potencialmente afectados**: `src/lib/sales/retention.ts` (NUEVO), reuso de `cancel.ts:24-211`, `process.ts:34-55,125-136,208-256` (primitivas de sentinel/compensación), `events.ts` (emitSalesEvent).
- **Dependencias**: T1-1 (config).
- **Precondiciones**: T1-1 aplicada; tests previos 48/48 en verde.
- **Cambios esperados**: función pura de decisión + funciones de persistencia: `resolveRetentionDecision({...}) → { action: 'none'|'discount_offer'|'confirm_cancel'|'ack', response? }`. Reutiliza: RC6 (SALE_WON activo), atomicidad event-first con compensación id-scoped, anti-loop, cancellation lock. NO toca el LLM.
- **Tests requeridos**: unit por estado (none/sentinel/cancelled) y por config; sin SALE_WON → none; mensaje sin trigger → none; oferta repetida → nunca dos veces (idempotencia).
- **Acceptance criteria**: la máquina produce la MISMA secuencia que el interceptor actual en los casos testeados de WhatsApp.
- **Riesgo**: MEDIO (lógica de estados). Mitigado por tests unit.
- **Rollback**: módulo aislado; sin wiring hasta T1-3 → eliminable sin tocar canales.
- **Evidencia requerida**: tests unit verdes + diff acotado.
- **Autorización**: ✅ ADR-028 Decisión Especial.

---

#### TASK T1-3 — Integrar retención en `processCore` (antes de la IA)
- **Título**: Ejecutar `resolveRetentionDecision` en Core para TODOS los canales.
- **Objetivo**: la decisión de retención es Canonical Decision del Core; ningún canal decide ofrecer/negar descuento.
- **Decisión ADR**: Decisión Especial + D2 (Core decide, canal transporta) + D4 (canal no cambia decisión).
- **Archivos potencialmente afectados**: `src/lib/runtime/core.ts` (primer check antes de `executeAI`, :254/:186), `src/lib/channels/types.ts` (CoreOutput de retención), persistencia de mensajes (:199-210).
- **Dependencias**: T1-1, T1-2.
- **Precondiciones**: T1-2 con tests verdes.
- **Cambios esperados**: en modo stream y complete, antes de ejecutar AI: si `retention.action !== 'none'`, producir respuesta canónica (discount_message / confirmación / ack) vía LLM `response` **sin llamar** `executeAI`; persistir `messages` (role assistant); marcar en metadata `retention: true`; saltar `processSaleClosing` de ese turno; devolver `CoreOutput` igual para todos los canales.
- **Tests requeridos**: `CoreOutput.response` idéntico para whatsapp/web/widget/simulation con misma entrada+config+estado; cero llamadas a `executeAI` en rama de oferta (métrica de token ≪).
- **Acceptance criteria**: eliminar el LLM de la oferta de retención (hoy el interceptor ya lo evita); paridad verificada por harness T-G-1.
- **Riesgo**: ALTO (punto de inyección central). Fácil de revertir por eliminación del check temprano.
- **Rollback**: quitar el check en core (return al comportamiento previo); los estados escritos por retención se reconcilian con `block`/compensación.
- **Evidencia requerida**: test de paridad T-G-1 verde en retención; métricas de token del caso de retención.
- **Autorización**: ✅ ADR-028 Decisión Especial + D2 + D4.

---

#### TASK T1-4 — Eliminar la exclusividad WhatsApp (deprecación del interceptor)
- **Título**: Retirar `handleCancellationWebhook` y dejar que el Core gobierne la retención de WhatsApp.
- **Objetivo**: eliminar la rama de negocio exclusiva de canal (violación de D4).
- **Decisión ADR**: D4 (WhatsApp no posee reglas exclusivas) + Decisión Especial.
- **Archivos potencialmente afectados**: `src/app/api/channels/baileys/webhook/route.ts:40-52` (remover llamada), `src/lib/sales/process.ts:66-331` (eliminar función), imports.
- **Dependencias**: T1-3 (el Core ya cubre).
- **Precondiciones**: T1-3 verificado con casos C/D/E en WhatsApp (canal real o fixture).
- **Cambios esperados**: webhook baileys llama solo a `processIncomingMessage`; al borrar el interceptor, `process.ts` pierde `handleCancellationWebhook`; el flujo de retención vive UNA vez en Core.
- **Tests requeridos**: casos C/D/E cruzados WhatsApp vs Simulator vs widget (misma secuencia); regresión RC1/RC4/RC6.
- **Acceptance criteria**: cero ramas de cancelación por canal; eliminar divergencia 1-paso vs 2-pasos.
- **Riesgo**: ALTO si T1-3 no está probado. Mitigado por orden (T1-4 después de T1-3 verde).
- **Rollback**: re-insertar el interceptor (git revert del commit T1-4); estados ya sentinel no se duplican por idempotencia del sentinel.
- **Evidencia requerida**: diff `--stat` mínimo; e2e casos C/D/E.
- **Autorización**: ✅ ADR-028 Decisión Especial + D4.

---

#### TASK T1-5 — Reactivación por aceptación de descuento (comportamiento Core)
- **Título**: Portar `handleDiscountAcceptanceTrigger` (process.ts:74-112) a paso determinístico post-AI.
- **Objetivo**: la aceptación del descuento ("sí") reactiva la venta con la misma semántica en todos los canales.
- **Decisión ADR**: Decisión Especial (flujo 2 pasos completo en Core) + D5 (estados).
- **Archivos potencialmente afectados**: `src/lib/sales/retention.ts` (nuevo paso `clearSentinelAndReactivate`), `src/lib/runtime/core.ts` (post-AI cuando `sales_cancelled_at` es sentinel y `outcome` = won/interested o afirmativa confirmada), `cancel.ts`/`events.ts` reuso.
- **Dependencias**: T1-2, T1-3.
- **Precondiciones**: T1-4 (interceptor removido).
- **Cambios esperados**: tras generar la respuesta AI, si el cliente aceptó (afirmativa con venta pending o outcome ahora won/interested transportado por `processSaleClosing`) → limpiar sentinel, eliminar SOLO el SALE_CANCELLED id-scoped (`reason=discount_offered`) creado en T1-2, registrar reactivación en outcome_history. Conserva la compensación de proces.ts:241-255.
- **Tests requeridos**: secuencia oferta→aceptación→confirmación → sin sentinel residual y sin SALE_CANCELLED huérfano; nuevo ciclo de cancelación debe ofrecer de nuevo (fresh).
- **Acceptance criteria**: la reactivación opera idéntica en WhatsApp y Simulator; no romper `purgeCancelledOrderFromMemory`.
- **Riesgo**: MEDIO (borrado id-scoped). El borrado por id evita tocar SALE_CANCELLED históricos.
- **Rollback**: revert eliminando el paso; el sentinel permanece → el cliente puede re-intentar cancelación (ACK).
- **Evidencia requerida**: test de transición sentinel→null y ausencia de SALE_CANCELLED residual.
- **Autorización**: ✅ ADR-028 Decisión Especial.

---

#### TASK T1-6 — Texto de retención configurable (fin del string hardcoded)
- **Título**: Reemplazar `'10% de descuento'` (process.ts:196) y el ack por mensajes de `business_sales_config`.
- **Objetivo**: ningún número/string de negocio en código.
- **Decisión ADR**: D1 (behavior configurable) + Decisión Especial.
- **Archivos potencialmente afectados**: `src/lib/sales/retention.ts` (usa `retention_discount_message`), form config, `src/lib/i18n/dictionaries/es.ts` (solo si queda texto residual).
- **Dependencias**: T1-2.
- **Precondiciones**: T1-1 (config tipada).
- **Cambios esperados**: `discount_message` interpolado con `{customer_name}` y `{discount_pct}`; identifica el mensaje de ack "ya fue cancelado" como canónico.
- **Tests requeridos**: interpolación; ausencia de `10%` literal en `src/` (grep).
- **Acceptance criteria**: grep por `descuento` en `process.ts` sin literales de %. Prompt ya no porta la cifra (la porta la policy resuelta).
- **Riesgo**: BAJO.
- **Rollback**: revert simple.
- **Evidencia requerida**: grep negativo + test de mensaje.
- **Autorización**: ✅ ADR-028.

---

#### TASK T1-7 — Consolidar la invocación de `processSaleClosing`
- **Título**: Unificar el cierre de venta a UNA invocación por turno.
- **Objetivo**: eliminar la doble ejecución (`runtime.ts:309-316` + `core.ts:226-239`) protegida pero redundante del modo complete de WhatsApp.
- **Decisión ADR**: D2/D5 (quién posee el pipeline). No cambia contract.
- **Archivos potencialmente afectados**: `src/lib/runtime/runtime.ts:295-320` (remover bloque redundante), `src/lib/runtime/core.ts:225-239`.
- **Dependencias**: T1-2, T1-3.
- **Precondiciones**: pruebas C/D/E en verde con la doble invocación.
- **Cambios esperados**: en modo complete, `processSaleClosing` corre únicamente dentro de `processCore` (una vez); en stream, en `onFinish`. Anti-loop inalterado.
- **Tests requeridos**: sin gaps de cierre (SALE_WON único) en activos completos; shadow aún NO (ver T1-8).
- **Acceptance criteria**: una sola llamada efectiva por turno; behavior observable idéntico.
- **Riesgo**: MEDIO (ventana entre runtime y core). Beneficio: determinismo y menor superficie.
- **Rollback**: restaurar runtime.ts desde git.
- **Evidencia requerida**: conteo de llamadas en logs/test máquina.
- **Autorización**: ✅ ADR-028 (refactor de consolidación aprobado en D2/D5; sin nueva decisión — es eliminación de redundancia canalizada por el Core).

---

#### TASK T1-8 — (BUG) Gate de `processSaleClosing` en modo shadow — ⚠️ NO AUTORIZADA
- **Título**: Evitar que el modo shadow persista cierres de venta.
- **Objetivo**: corregir que `processCore` (complete) ejecute `processSaleClosing` en modo shadow (hoy `runtime.ts:265` entra a core y `core.ts:226` persiste SALE_WON aunque `mode==='shadow'`).
- **Decisión ADR**: ninguna cubre esto.
- **Archivos potencialmente afectados**: `src/lib/runtime/core.ts`, `src/lib/runtime/runtime.ts`, tipado `CoreInput`.
- **Dependencias**: T1-7 (para aislar el call-site).
- **Precondiciones**: T1-7 concluido.
- **Cambios esperados**: señal explícita de delivery/shadow en `CoreInput`; el core omite `processSaleClosing` (y reactivación) en shadow; shadow sigue siendo observable sin persistencia.
- **Tests requeridos**: shadow no emite SALE_WON/SALE_CANCELLED.
- **Acceptance criteria**: cero efectos laterales de shadow.
- **Riesgo**: BAJO pero corrige comportamiento activo (no testear en prod sin QA).
- **Rollback**: revert.
- **Evidencia requerida**: test shadow.
- **Autorización**: ❌ **NO autorizada por ADR-028 → CHECKPOINT `REQUIERE DECISIÓN DEL CONCILIO` antes de implementar.**

---

### FASE B — CHANNEL CONTRACT (D4)

#### TASK T2-1 — El widget propaga su canal real
- **Título**: `channel: 'widget'` llega al Core desde `widget/chat/route.ts`.
- **Objetivo**: eliminar la paridad accidental `widget → simulation` (el widget hoy ejecuta `simulation` y `core.ts:59` lo anula a `undefined`).
- **Decisión ADR**: D4 (canal entra al Core; identidad de canal obligatoria).
- **Archivos potencialmente afectados**: `src/app/api/widget/chat/route.ts:79-87` (pasar `channel: 'widget'`), `src/components/chat/ChatWindow.tsx:179` (verify), tests.
- **Dependencias**: ninguna.
- **Precondiciones**: ninguna.
- **Cambios esperados**: `processStreaming({..., channel: 'widget'})`; el prompt/cache (`conversation/context.ts:68-76`) reciben widget real.
- **Tests requeridos**: contexto cargado contiene channel widget (no simulation); cabecera/intent sin cambios.
- **Acceptance criteria**: chat widget nunca más ejecuta bajo semántica de simulación/training.
- **Riesgo**: BAJO; aislado.
- **Rollback**: revert.
- **Evidencia requerida**: test/harness T-G-1 con channel widget.
- **Autorización**: ✅ ADR-028 D4.

---

#### TASK T2-2 — Normalizar `channel` por ruta de entrada
- **Título**: Cada ruta declara explícitamente su canal (web/whatsapp/widget/simulation).
- **Objetivo**: el canal nunca queda implícito (default `simulation`) cuando hay un canal real.
- **Decisión ADR**: D4 (identidad de canal obligatoria; modo simulation es explícito).
- **Archivos potencialmente afectados**: `src/app/api/chat/route.ts:17-18` (live_customer → web al ser del dashboard), `src/app/api/widget/chat/route.ts`, `src/app/api/channels/baileys/webhook/route.ts` (ok), futuras rutas messenger/instagram, `src/lib/runtime/runtime.ts:191` (default).
- **Dependencias**: T2-1.
- **Precondiciones**: definir tabla de mapeo ruta→canal (documentada en este plan, §8).
- **Cambios esperados**: `processStreaming` rellena channel por ruta cuando el request no lo provee; `simulation` solo cuando controller de training/lab lo pide.
- **Tests requeridos**: cada ruta produce channel esperado; default solo en training/simulation.
- **Acceptance criteria**: ninguna carga live desconocida.
- **Riesgo**: BAJO.
- **Rollback**: revert.
- **Evidencia requerida**: test por ruta.
- **Autorización**: ✅ ADR-028 D4.

---

#### TASK T2-3 — Registro de capacidades por canal (preparatorio D2)
- **Título**: Registro estático legible `channel → capabilities`.
- **Objetivo**: declarar qué puede un canal (interactive/media/longitud) SIN implementar el diseño pospuesto de `interactive`.
- **Decisión ADR**: D4 (capacidades declarables) + D2 (pendiente). NO decide render.
- **Archivos potencialmente afectados**: `src/lib/channels/capabilities.ts` (NUEVO, solo datos), `src/lib/channels/types.ts`.
- **Dependencias**: T2-2.
- **Precondiciones**: ninguna.
- **Cambios esperados**: mapa estático (whatsapp: interactive+media; widget/web: media+stream; simulation: sin transport); nada lo consume en runtime todavía.
- **Tests requeridos**: lectura de capacidades; contrato de tipos.
- **Acceptance criteria**: registro existente y testeable; cero cambios de comportamiento.
- **Riesgo**: BAJO.
- **Rollback**: file nuevo eliminable.
- **Evidencia requerida**: types tests.
- **Autorización**: ✅ ADR-028 D4 (estructura declarativa; consumo interactivo queda para D2).

---

### FASE C — PRODUCT ID / PROVENANCE (D6)

#### TASK T3-1 — Validación de `productId` en el borde (widget/landing)
- **Título**: `parseLandingContext` valida/resuelve/expansiona o rechaza explícitamente.
- **Objetivo**: un id externo nunca provoca pérdida silenciosa de contexto.
- **Decisión ADR**: D6 (validación + resolución + rechazo explícito + provenance).
- **Archivos potencialmente afectados**: `src/app/api/widget/chat/route.ts:12-23` (`parseLandingContext`), `src/lib/ai/knowledge.ts:118-127` (códigos), helper de resolución (nuevo).
- **Dependencias**: ninguna.
- **Precondiciones**: definir política: UUID completo → ok; short-id → intentar expansión por prefijo único en `products`; ambiguo/inexistente → `LandingContextError` `INVALID_PRODUCT_ID` (explicito, 400).
- **Cambios esperados**: el `22P02` jamás llega a `context-scope`; salidas explicitas y con code.
- **Tests requeridos**: id completo ok; short-id único ok (expansión); short-id ambiguo → 400; inexistente → 400.
- **Acceptance criteria**: ningún camino silencioso.
- **Riesgo**: MEDIO (edge de validación). Aislado a parsing.
- **Rollback**: revert.
- **Evidencia requerida**: tests de los 4 casos.
- **Autorización**: ✅ ADR-028 D6.

---

#### TASK T3-2 — Manejo de error en `context-scope.ts`
- **Título**: la query de landing falla → nunca `if (product)` ciego.
- **Objetivo**: elimininar el trago silencioso de `product.error` (`context-scope.ts:164-171`).
- **Decisión ADR**: D6.
- **Archivos potencialmente afectados**: `src/lib/runtime/context-scope.ts:162-172` (comprobar `error` y loguear; señal de fallo en `ScopeResolution`), `src/lib/runtime/core.ts:117-138`.
- **Dependencias**: T3-1 (reduce apariciones).
- **Precondiciones**: T3-1.
- **Cambios esperados**: `resolveScopeContext` distingue "landing id no resuelto" (log + fallback explícito a keyword/detectExplicitScopes) de "error real" (propaga/aborta con registro); el Core loguea y continúa con decisión explícita de scope no-landing (nunca: scope perdido en silencio).
- **Tests requeridos**: short-id por vía interna → log + fallback; DB error → no silencio.
- **Acceptance criteria**: caso A del PRD §7 sin pérdida de media por id inválido (con UUID completo el caso resuelve).
- **Riesgo**: BAJO.
- **Rollback**: revert.
- **Evidencia requerida**: test caso A.
- **Autorización**: ✅ ADR-028 D6.

---

#### TASK T3-3 — (BUG) `knowledge.ts:243` selecciona columna `content` inexistente — ⚠️ NO AUTORIZADA
- **Título**: Corregir `getBusinessExtractionContext` (select de columna inexistente en `knowledge_items`).
- **Objetivo**: `knowledge_items` no tiene columna `content` (schema: `question`, `answer`, `category`); el select retorna `[]` en silencio (extracción de contexto vacía).
- **Decisión ADR**: ninguna — no es productoId ni provenance.
- **Archivos potencialmente afectados**: `src/lib/ai/knowledge.ts:242-245`.
- **Dependencias**: ninguna.
- **Precondiciones**: confirmar columnas reales del schema aplicado.
- **Cambios esperados**: select correcto (`category, question, answer`).
- **Tests requeridos**: contexto de extracción con datos no vacío.
- **Acceptance criteria**: la extracción devuelve knowledge no vacío (o vacío por datos, no por error).
- **Riesgo**: BAJO (bug latente; hoy silencioso).
- **Rollback**: revert.
- **Evidencia requerida**: test/consulta.
- **Autorización**: ❌ **NO cubierta por ADR-028 (PRD §9 marcador `⭕ PENDIENTE`) → requiere aprobación adicional del Concilio.**

---

### FASE D — MEDIA / INTENT (D3)

#### TASK T4-1 — Autoria de triggers `intent <tag>` en el Dashboard
- **Título**: Habilitar autoría de la dimensión intent en la UI de media/conocimiento.
- **Objetivo**: que un asset pueda declarar `intent price` sin depender de keywords (`precio`, `fotos`).
- **Decisión ADR**: D3 (activar contrato `intent`; complementaria a keyword; scope respetado C-1).
- **Archivos potencialmente afectados**: formularios/UI de `knowledge_items` (editor media), validadores de trigger, i18n `es.ts`.
- **Dependencias**: ninguna (el contrato mecánico ya existe: `context-media.ts:428-432`, `product-recommendation.ts:48`, `conditional-media.ts:40`).
- **Precondiciones**: guía de autoría (definida en T4-3).
- **Cambios esperados**: editor acepta y valida `intent <tag>` (price/shipping/payment/catalog/contact/greeting) y muestra hint; sin cambios de runtime.
- **Tests requeridos**: validación UI; guard de tag desconocido → rechazo con mensaje.
- **Acceptance criteria**: un asset configurado `intent price` se guarda y se consulta.
- **Riesgo**: BAJO.
- **Rollback**: revert UI; assets existentes no escritos hasta T4-2.
- **Evidencia requerida**: test UI/intento.
- **Autorización**: ✅ ADR-028 D3 (activación; la prioridad/fallback queda ⚠️ fuera).

---

#### TASK T4-2 — (DATOS) Asignación `intent price` a assets
- **Título**: Etiquetar assets de precio con `intent price` (Una tarea de datos, no de código).
- **Objetivo**: dar vida al contrato en datos (hoy 0 filas con `intent`).
- **Decisión ADR**: D3 (activación) — es la asignación de datos aprobada conceptualmente.
- **Archivos/objetos afectados**: `knowledge_items` (update de `trigger_condition`, p. ej. asset genérico 76726901-como referencia), scripts/seed read-only controlado.
- **Dependencias**: T4-1.
- **Precondiciones**: evidencia de cuál asset de precio (asset genérico `76726901…`) es el correcto; revisión por Domain Expert.
- **Cambios esperados**: `trigger_condition` con `intent price` (+ coexisten keywords); scope NULL genérico o scoped Clean Nails con autoría consciente.
- **Tests requeridos**: caso A (§7) entrega el asset por intent en los 3 canales.
- **Acceptance criteria**: media por intención funciona end-to-end.
- **Riesgo**: MEDIO (datos en producción). Solo Editor de Conocimiento autoriza; sin backfill masivo.
- **Rollback**: update reverso (revert del cambio de `trigger_condition`).
- **Evidencia requerida**: diff de filas + test caso A.
- **Autorización**: ✅ ADR-028 D3; requiere governance + Database/Domain approbe en ETAPA 4 (escribe DB).

---

#### TASK T4-3 — Tests y guía de autoría (sin decidir orden)
- **Título**: Casos de prueba intent + documentación para autores de media.
- **Objetivo**: fijar comportamiento observable del `intent` sin tocar el ranking (⚠️ queda abierto).
- **Decisión ADR**: D3 (activación) — el orden definitivo `intent vs product vs keyword` NO se decide.
- **Archivos potencialmente afectados**: tests e2e/unit `context-media`, `docs/mia/` (guía breve).
- **Dependencias**: T4-1, T4-2.
- **Precondiciones**: T4-2 aplicado.
- **Cambios esperados**: guía "cuándo usar `intent` vs keyword"; tests que fijan el estado actual del OR (`triggerMatches || intentMatchesTrigger`) y lo declarer como pendiente de ranking.
- **Tests requeridos**: intent gana cuando keyword no existe; scope único respetado; sin cambios de prioridad actuales.
- **Acceptance criteria**: comportamiento fijado por test hasta nueva decisión Concilio.
- **Riesgo**: ninguno (solo tests+docs).
- **Rollback**: revert.
- **Evidencia requerida**: tests verdes.
- **Autorización**: ✅ ADR-028 D3.

---

#### TASK T4-4 — (VERIFICAR) Consistencia de `product-recommendation` — ⚠️ solo verificación
- **Título**: Verificar que los activos intent no alteren la asociación producto→mensaje.
- **Objetivo**: `product-recommendation.ts:48` ya responde `intentMatchesTrigger` para asociar producto; con datos intent nuevos debe seguir consistente con `context-media` y el orden de producto recomendado.
- **Decisión ADR**: D3 (sin cambio de ranking).
- **Archivos potencialmente afectados**: ninguno (verificación); si requiere cambio de precedencia → STOP.
- **Dependencias**: T4-2.
- **Precondiciones**: T4-2.
- **Cambios esperados**: test/doc que registra el comportamiento actual; **si T4-4 detecta divergencia de ranking → detener y marcar `REQUIERE MÁS EVIDENCIA` (no implementar).**
- **Tests requeridos**: recomendación de producto con intent; coherencia con media dispatch.
- **Acceptance criteria**: sin cambios de comportamiento; o hallazgo documentado para Concilio.
- **Riesgo**: ninguno (verificación).
- **Rollback**: N/A.
- **Evidencia requerida**: reporte de verificación.
- **Autorización**: ✅ solo autoriza verificar; cambio de código requeriría nueva decisión.

---

### FASE E — CANONICAL DECISION / INTERACTIVE (D2 pospuesta)

#### TASK T5-1 — Documentación de dependencia (DOC SOLO)
- **Título**: Nota de diseño para `interactive` derivado de la decisión canónica.
- **Objetivo**: preparar tarea futura sin implementar.
- **Decisión ADR**: D2 aprobada (principio) + ⏸️ diseño pospuesto; D4 registry (T2-3).
- **Archivos potencialmente afectados**: `docs/mia/` (nota de diseño; puede integrarse al PRD), ninguna fuente.
- **Dependencias**: T2-3 (registry) — solo referenciada.
- **Precondiciones**: ninguna.
- **Cambios esperados**: documento que describe cómo `interactive` partirá `/derivará/` de `CoreOutput` canónico + capacidades; criterios de paridad semántica; lista canales objetivo.
- **Tests requeridos**: N/A (no implementa).
- **Acceptance criteria**: siguiente implementación de interactive tendrá blueprint aprobado.
- **Riesgo**: ninguno.
- **Rollback**: N/A.
- **Evidencia requerida**: doc revisado.
- **Autorización**: ✅ solo redacción; implementación queda ⏸️.

---

### FASE F — GATES TRANSVERSALES

#### TASK T-G-1 — Harness de paridad (comparación de `CoreOutput`)
- **Título**: Utilidad que ejecuta el mismo input+config+estado por canal y compara decisión semántica.
- **Objetivo**: prueba negativa y positiva de paridad (PRD §7 Caso F).
- **Decisión ADR**: D2/D4 (paridad invariant); Especial.
- **Archivos potencialmente afectados**: `tests/` (harness), tooling de tests.
- **Dependencias**: Fases A y B básicas (channel real).
- **Precondiciones**: T2-1/T2-2.
- **Cambios esperados**: comparador de `CoreOutput.response/product/media/metadata.decisions` ignorando presentación de canal; informe de divergencias.
- **Tests requeridos**: casos A–F en 3 canales.
- **Acceptance criteria**: cero divergencias de decisión; presentación puede diferir.
- **Riesgo**: ninguno (test tooling).
- **Rollback**: N/A.
- **Evidencia requerida**: reporte verde.
- **Autorización**: ✅ ADR-028.

#### TASK T-G-2 — Suite e2e casos A–F (PRD §7)
- **Título**: Playwright + fixtures multi-canal.
- **Objetivo**: validación final multicanal (Fase 6 del PRD).
- **Decisión ADR**: todas las implementadas.
- **Archivos potencialmente afectados**: `tests/public.spec.ts`, `playwright.config.ts`, fixtures.
- **Dependencias**: fases A–D + T-G-1.
- **Precondiciones**: build+lint verdes.
- **Cambios esperados**: pruebas A–F.
- **Tests requeridos**: matriz §7.
- **Acceptance criteria**: matriz verde.
- **Riesgo**: medio (flakiness); mitigado por fixtures deterministas.
- **Rollback**: N/A.
- **Evidencia requerida**: suite verde + reporte.
- **Autorización**: ✅ ADR-028/PRD.

---

## 6. TESTS (GLOBAL)

| Caso (PRD §7) | Qué verifica | Canales | Gate |
|---|---|---|---|
| A — precio | media/intent resuelve precio sin keyword | Sim/Web/WA | T3-1/2, T4-2, T-G-1/2 |
| B — testimonial | trigger testimonial estándar | Sim/Web/WA | T4-3 |
| C — descuento una sola vez | retención ofrecida 1 vez (sentinel) | Sim/Web/WA | T1-2/3/4 |
| D — rechazo → no insistir | tras rechazo no re-ofertar; cancelar 2º | Sim/Web/WA | T1-2..6 |
| E — nueva oportunidad | guards P1 + purge tras cancelación | Sim/Web/WA | T1-5 |
| F — paridad | mismo CoreOutput semántico | Sim/Web/WA | T-G-1/2 |

También: `npm run lint`, `npm run build`, `npm test`, DevTools MCP, Godzilla stress (Godzilla no bloquea plan; gate ETAPA 5).

---

## 7. RIESGOS

1. **ALTO — Inyección central de retención (T1-3)**: si falla, todos los canales pierden retención a la vez. Mitigación: feature-flag por env `RETENTION_CORE_ENABLED` + orden T1-2→T1-3→T1-4.
2. **ALTO — Borrado de rama WhatsApp (T1-4)**: acotado por ejecución secuencial y reversal simple.
3. **MEDIO — datos en producción (T4-2)**: solo assets elegidos, update reversible, sin masivo.
4. **MEDIO — consolidación sale-closing (T1-7)**: riesgos de doble/triple cierre; anti-loop ya lo bloquea.
5. **BAJO — schema (T1-1)**: columnas nuevas con default; migración idempotente.
6. **Conducta**: T1-8 y T3-3 NO implementar sin decisión; T4-4 solo verificar.

---

## 8. ROLLBACK (TOTAL)

1. Revert secuencial por commit (cada task con commit atómico). 2. Feature-flag de retención apaga T1-3 sin tocar canales. 3. Los estados escritos (sentinel) son idempotentes y compatibles con el interceptor previo si se restauran. 4. Sin migración destructiva en T1-1 (solo ADD COLUMN defaults). 5. T4-2 reversible por update puntual. 6. Todas las decisiones de datos quedan registradas en `sales_events`/outcome_history (audit trail).

---

## 9. QUÉ NO SE IMPLEMENTARÁ EN ESTA FASE

- ❌ Diseño fino y consumo de `interactive` (D2 ⏸️) — solo doc (T5-1).
- ❌ Orden definitivo `intent vs product vs keyword` (D3 ⚠️) — solo fijar comportamiento actual con test.
- ❌ Taxonomía completa de capacidades y consumo runtime (D4 pospuesto; T2-3 solo registro estático).
- ❌ Messenger/Instagram con transporte real (fuera del alcance actual; existen adapters stub).
- ❌ Scoring/reasoning redesign (Decisión 5 — permanece derivado).
- ❌ Migración de datos (fuera de decisiones; T1-1 y T4-2 son los únicos cambios de DB planificados, ambos autorizados por el Concilio en principio y con governance/approbe obligatorio al implementar).
- ❌ Cualquier tarea marcada ⚠️.

---

## 10. QUÉ REQUIERE NUEVA DECISIÓN DEL CONCILIO

| Ítem | Origen | Acción |
|---|---|---|
| T1-8 shadow gate (`processSaleClosing` en shadow) | Bug detectado en auditoría | `/decidir/` si se corrige (Concilio nuevo) |
| T3-3 columna `content` en `getBusinessExtractionContext` | PRD §9 marcador `⭕ PENDIENTE` | Concilio aprueba o POSTPONER |
| Ranking `intent vs product vs keyword` | ADR-028 D3 ⚠️ | Evaluación con evidencia (test de ranking Fase 1 ampliada) antes de cambio |
| T4-4 si detecta divergencia | Verificación | STOP → evidencia → decisión |
| Mapeo ruta→canal exacto (T2-2) | Diseño | Documentado aquí; requiere confirmación del Concilio si algún canal queda ambiguo |

---

## STACK-ANCHOR / NOTAS DE CONTROL

- **ETAPA 4 NO iniciada.** Este documento es el permiso de diseño; cada Fase del plan requiere autorización explícita y (para schema/DB) governance `classify` + approbe del Database Engineer.
- **Git**: HEAD `d03ff40` == origin/main. Este documento requiere commit/push → **detenerse y solicitar autorización de commit** (STOP Condition del usuario: commit NO autorizado automáticamente).