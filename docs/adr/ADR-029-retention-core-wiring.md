# ADR-029 — Wiring del Retention Engine en el Core (T1-3)

- **Status**: Accepted (decisión de integración del Concilio para ETAPA 3, TASK T1-3)
- **Date**: 2026-09-01
- **Context**: T1-1 (`ec3756b` predecesor `34a5c15`, config de retención) y T1-2 (`ec3756b`, motor `resolveRetentionDecision`) están implementados, probados y en remoto. Falta decidir **dónde y cómo** invocar `resolveRetentionDecision` dentro del Core para que la decisión de retención sea única, determinista y channel-agnostic, sin duplicación ni doble ejecución. Este ADR fija esa decisión de wiring. NO autoriza implementación ni commit; deja el criterio de aceptación para autorizar T1-3.

Autoridades de contexto: `docs/adr/ADR-028.md` (Decisión Especial, D1, D2, D4, D5), `docs/mia/PRD-BEHAVIOR-PARITY.md` (§3 invariante, §7 casos C/D/E/F), `docs/mia/IMPLEMENTATION-PLAN-BEHAVIOR-PARITY.md` (TASK T1-3, §4.2).

Evidencia de HEAD en el momento del análisis: `ec3756b` (`feat: add deterministic retention engine`), origin/main sincronizado.

---

## 1. PUNTO DE ENTRADA (dónde y por qué)

**Decisión**: `resolveRetentionDecision` se invoca **una sola vez por turno**, dentro de `processCore`, **inmediatamente después de la persistencia del mensaje de usuario y antes de cualquier trabajo downstream** (`resolveRecommendedProduct`, resolución de media, build del prompt, `executeAI`).

Punto exacto propuesto: `src/lib/runtime/core.ts`, justo después del bloque de persistencia del mensaje del usuario (`core.ts:82-92`), antes de `resolveRecommendedProduct` (`core.ts:94-106`).

**Racionalidad**:
1. `processCore` es el único punto por el que pasan TODOS los canales (Desde `processIncomingMessage` complete → `runtime.ts:265` y desde `processStreaming` stream → `runtime.ts:186`; los chat/widget/laboratorio no bifurcan por canal).
2. En ese punto ya están resueltos `businessId`, `assistantId`, `conversationId` (o undefined) y `customerId` (garantizado por el bloque de resolución `core.ts:25-45`), es decir todos los inputs de `RetentionContext`.
3. El prompt, la media y el producto **no deben construirse para una rama de retención**: son trabajo y tokens desperdiciados en un turno que no llama al LLM. Insertar en el punto 1 (>= after `:92`) es estrictamente "antes de la IA" y, además, evita queries/claims de media y recomendación de producto innecesarios. La referencia "primer check antes de `executeAI` (:254/:186)" del plan queda satisfecha por este punto, que es un superset más temprano.
4. El fast-fail del motor (trigger de cancelación puro) hace que el overhead por turno NORMAL sea ~0 DB: `hasCancellationTrigger` es una función síncrona y `resolveRetentionDecision` retorna `none` sin tocar la base cuando no hay trigger (`src/lib/sales/retention.ts:57-61`). El coste se paga solo cuando el mensaje es candidato a retención.

**Contrato preservado**: la entrada al Core permanece `CoreInput` (sin campos nuevos obligatorios); ningún canal debe cambiar su llamada. La decisión sale igual canal-agnostic por `CoreOutput`.

## 2. AUTORIDAD

1. **La decisión de retención pertenece al Core.** ADR-028 Decisión Especial (Opción A): "el flujo de retención/cancelación es comportamiento de negocio del Core, configurable, ejecutado idénticamente en todos los canales." El `when → then` (D1) define que la ejecución es responsabilidad del Core, no del canal ni del prompt. D5: la autoridad de cancelación es el pipeline de Core (determinista + detector LLM), nunca un adapter.
2. **WhatsApp deja de ser propietaria de la regla una vez conectado T1-3.** Hoy `handleCancellationWebhook` (`process.ts:66-331`) es lógica exclusiva de canal (violación de D4, documentada en ADR-028 como divergencia). Al activar T1-3, el Core cubre esa secuencia; T1-4 (tarea posterior) retira el interceptor del webhook baileys (`src/app/api/channels/baileys/webhook/route.ts:40-52`) e `input.timestamp`. La regla vive UNA vez: `resolveRetentionDecision`.
3. **Simulator/Web/WhatsApp reciben la misma decisión semántica.** El invariante de paridad (PRD §3, D4) es innegociable: misma config + estado + mensaje ⇒ misma decisión. El canal solo adapta presentación/transporte (Decisión 2 y 4).

## 3. TRANSICIONES (contrato del Core al canal)

El Core traduce el resultado del motor a `CoreOutput` sin re-decidir nada:

| `action` | Respuesta canónica | `executeAI` | `processSaleClosing` | Persistencia de mensaje assistant | metadata |
|---|---|---|---|---|---|
| `none` | — (flujo normal) | ✅ sí | ✅ sí (invariante actual) | sí (ya existe) | sin `retention` |
| `discount_offer` | `response` del motor (config, incl. % y nombre) | ❌ NO | ❌ NO | sí, con `metadata.retention=true` | `retention: true` |
| `confirm_cancel` | `response` del motor (resultado de `processCancellation` o ack sin cancelación) | ❌ NO | ❌ NO | sí, con `metadata.retention=true` | `retention: true` |
| `ack` | `response` canónico del motor | ❌ NO | ❌ NO | sí, con `metadata.retention=true` | `retention: true` |

- La persistencia del **mensaje de usuario** ya la hace el Core (`core.ts:82-92`); la del **assistant** la hace el wiring de T1-3 (mismo shape `core.ts:199-210`, agregando flag de retención).
- `product`/`media` en `CoreOutput` se devuelven `null` en ramas de retención (no hay recomendación ni media para un turno sin IA).
- vía stream: cuando `action !== 'none'`, `processCore` retorna `response` completo y `textStream` ausente; `processStreaming` debe detectar `metadata.retention` y emitir **un único evento SSE** con la respuesta (ver §6), en lugar de asumir un stream del LLM.
- El motor NO persiste mensajes ni `channel_messages` (doc de `retention.ts`); lo hace el wiring (responsabilidad del Core), igual para todos los canales.

## 4. ESTADO (interacción)

Contrato de estados ya fijado por D5 + T1-2 y NO se modifica en T1-3:

- **`SALE_WON` activo** (RC6): sin venta activa en la conversación ⇒ `none`; frases de rechazo no se tragan (paridad con `handleCancellationWebhook:126-136`).
- **`SALE_CANCELLED(discount_offered)`**: evento **único**, emitido event-first en la rama `discount_offer`, con compensación **id-scoped** si falla la escritura de conversación (`retention.ts:145-181`); nunca borra `SALE_CANCELLED` históricos.
- **`DISCOUNT_OFFERED_SENTINEL`** (`process.ts:34`): guardia anti-reoferta. Una vez ofrecido, nunca se re-oferta (`isDiscountOfferSentinel`, comparación por epoch). El paso 2 (sentinel + trigger) ⇒ `confirm_cancel`.
- **Cancelación real** (`sales_cancelled_at` = fecha): ⇒ `ack` canónico; `processCancellation` (paso 2) persiste `sales_cancelled_at` real + `customers.last_cancelled_order` + purga de memoria (invariante, sin cambios).
- **`outcome_history`**: appenda `{outcome:'cancelled', event_type:'SALE_CANCELLED', reason:'discount_offered', ...}`; NOTA: `'cancelled'` es válido SOLO en el JSONB de historia (no en `conversations.outcome`, CHECK migración 025).
- **Anti-loop / idempotencia**: el sentinel hace la oferta idempotente; `hasClosingEvent` / `hasCancellationLock` (`process.ts:375-380`) siguen protegiendo `processSaleClosing` en las ramas `none`.

## 5. DOBLE EJECUCIÓN

**Hallazgo preexistente**: en el camino activo de WhatsApp, `processSaleClosing` se invoca **dos veces** por mensaje: una en `core.ts:228` (modo complete) y otra en `runtime.ts:309` (tras `processCore`). La segunda llamada queda neutralizada en su mayoría por el anti-loop interno (`hasClosingEvent`/`hasCancellationLock`), pero re-ejecuta `detectSaleOutcome` (costo LLM) si la primera no produjo evento de cierre. T1-3 **NO introduce ninguna llamada nueva**; la consolidación es T1-7 (fuera de T1-3).

**Nuevo riesgo de doble ejecución que T1-3 DEBE cancelar** (descubierto en este análisis):
1. En ramas de retención, `core.ts:228` (complete) debe saltar `processSaleClosing`.
2. `runtime.ts:295-320` llama `processSaleClosing` **después** de `processCore` en modos activos. Sin gate, la rama `discount_offer` (mensaje de cancelación que acaba de escribir el sentinel) caería en el safety-net de `processSaleClosing` (`process.ts:346-372`), que por `hasCancellationTrigger` llamaría `processCancellation` sobre el MISMO turno ⇒ cancelación real junto a la oferta ⇒ rompe el flujo de 2 pasos (D5). **Requisito**: `runtime.ts` debe saltar `processSaleClosing` cuando `coreOutput.metadata.retention === true`.
3. En modo stream, la rama de retención no ejecuta `executeAI`, luego el `onFinish` (`core.ts:262-295`) jamás corre; no hay `processSaleClosing` por esa vía. Sin acción.
4. No existe doble decisión de retención por mensaje: en el período transitorio entre T1-3 y T1-4, si `handleCancellationWebhook` intercepta, el mensaje no llega al Core; si no intercepta, el Core resuelve la misma rama con los mismos triggers y estado (RC6 igual). Nunca corren ambos sobre el mismo mensaje.
5. Protección adicional (plan §T1-3/§Riesgos): feature-flag `RETENTION_CORE_ENABLED` (env) que apague el check temprano para rollback instantáneo sin tocar canales; y el orden T1-2→T1-3→T1-4 evita doble vía.

## 6. CANALES (responsabilidades tras la decisión)

Regla general (D2/D4): el canal **transporta y renderiza** la respuesta canónica; NUNCA re-deriva oferta/descuento/cancelación.

| Canal | Punto de entrada | Después de T1-3 | Cambios de wiring necesarios |
|---|---|---|---|
| **Simulator / Training** | `api/chat/route.ts:59` → `processStreaming` (stream) | Recibe la respuesta canónica de retención como un único evento SSE | `processStreaming` detecta `metadata.retention` y emite un único evento instead of `textStream` |
| **WebChat (widget)** | `api/widget/chat/route.ts:79` → `processStreaming` | Ídem, conservando headers `X-MIA-*` | Ídem + mantener headers |
| **Web / Messenger / Instagram** | `api/channels/webhook/[channel]/route.ts` → `processIncomingMessage` (complete) | Respuesta canónica fluye tal cual | Saltar `processSaleClosing` en `runtime.ts` cuando `retention`; el resto sin cambio |
| **WhatsApp** | `baileys/webhook/route.ts:40` → hoy `handleCancellationWebhook`; tras T1-4 solo `processIncomingMessage` | Ídem; presentación (quick replies, tono) sigue siendo legítima | Durante T1-3 el webhook conserva su interceptor (transitorio); T1-4 lo retira. Tras T1-4, solo render |

- La presentación interactiva (p. ej. `buildInteractiveForIntent`, `runtime.ts:324-335`) no debe acoplarse a ramas de retención: el turno de retención es una respuesta completa, se omite construcción de interactive (no hay intent de producto que presentar).

## 7. ALCANCE EXACTO DE T1-3

**Incluye**:
- `src/lib/runtime/core.ts`: check temprano de `resolveRetentionDecision` tras `:92`; rama canónica (persistir assistant message con `metadata.retention`, saltar AI/product/media/`processSaleClosing`, devolver `CoreOutput`); gate del flag `RETENTION_CORE_ENABLED`.
- `src/lib/runtime/runtime.ts`: saltar `processSaleClosing` (`:297-320`) y omisión de interactive cuando `metadata.retention`; `processStreaming` emite evento único para rama de retención.
- `src/lib/channels/types.ts`: `CoreOutput.metadata` acepta `retention?: boolean` (campo opcional; no rompe el shape).
- Tests de wiring T1-3 (paridad T-G-1 casos C/D/F + cero `executeAI` + `processSaleClosing` no invocado + métricas tokens).

**Excluye (explícitamente fuera)**:
- T1-4 (retirar `handleCancellationWebhook` / webhook baileys) — requiere T1-3 verificado.
- T1-5 (reactivación por aceptación, paso post-AI) — nueva autorización.
- T1-6 (textos ACK hardcodeados → config) — nueva autorización.
- T1-7 (consolidación del doble `processSaleClosing`).
- T1-8 (refactoring de sentinel/prompts).
- Media/Intent (D3), Product ID/Provenance (D6), Canonical Interactive/capacidades (D2 pospuesto), cambios de schema, cambios de prompt, cambio del flujo de `resolveCancellationGuards`.

## 8. RIESGOS

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Punto de inyección central: un bug de retención pica a TODOS los canales a la vez | ALTO | Flag `RETENTION_CORE_ENABLED` + repos de tests T1-2 + rollback por remoción del check (estados ya sentinel son idempotentes con el interceptor previo) |
| Doble despacho de `processSaleClosing` en ramas de retención (nuevo hallazgo §5.2) | ALTO | Gate obligatorio `metadata.retention` en `core.ts` y `runtime.ts`; test explícito |
| `processStreaming` asume `textStream` en todos los turnos → rama de retención debe emitir evento único | MEDIO | Detección de `metadata.retention`; test de formato SSE |
| Asimetría transitoria WhatsApp (interceptor) vs resto (Core) entre T1-3 y T1-4 | MEDIO | Orden T1-3→T1-4 en la misma tanda; casos C/D cruzan canales en T1-4 |
| Coste por turno normal: `getSalesConfig`/queries en mensajes de cancelación | BAJO | Fast-fail por trigger puro antes de cualquier DB (`retention.ts:57-61`) |
| `processCancellation` re-usa detector LLM en `confirm_cancel` | MEDIO | Es la primitiva existente aprobada (D5); sin LLM nuevo en el motor |

## 9. DECISIONES EXPLÍCITAMENTE FUERA DE ALCANCE / REQUIERE NUEVO CONCILIO

- **No requiere Concilio adicional** para el wiring en sí: ADR-028 (Especial, D1, D2, D4, D5) + PRD + Plan son suficientes.
- **Requiere nuevo Concilio** si se quisiera: cambiar el contrato de estados (`sales_cancelled_at`), eliminar el interceptor antes de T1-3 verde, alterar `processCancellation` (paso 2), o mover la decisión fuera del Core (rechazado por Decisión Especial).

## 10. CRITERIO DE ACEPTACIÓN PARA AUTORIZAR T1-3

1. T1-2 en verde y en remoto (✅ ya cumplido).
2. Tests de wiring nuevos, en verde:
   - `CoreOutput.response` idéntico para `whatsapp` / `web` / `widget` / `simulation` con misma entrada+config+estado (harness T-G-1, casos C y F).
   - **Cero** llamadas a `executeAI` en ramas `discount_offer`/`confirm_cancel`/`ack` (métrica tokens = 0 en turno de retención).
   - `processSaleClosing` NO invocado en ramas de retención (espías en `core.ts` complete/stream y en `runtime.ts`).
   - Turnos `none` sin regresión (AI, producto, media y `processSaleClosing` corren como hoy).
   - `processStreaming` emite evento único SSE para retención.
   - Rojo si: doble `SALE_CANCELLED`, doble oferta (sentinel), o cancelación real en el mismo turno que la oferta.
3. Lint 0 errores, build OK, sin tests preexistentes nuevos en rojo.
4. Sin cambios de schema, de prompt ni de canales; diff acotado a los 4 archivos listados en §7 (+tests).

## Consecuencias

- **Positivas**: la retención queda gobernada por config en todos los canales (paridad verificable casos C/D); WhatsApp pierde su rama exclusiva tras T1-4; costo de tokens del caso retención = 0 (sin LLM en oferta/ack/confirm).
- **Neutras**: añade un flag env y un campo opcional `metadata.retention` en `CoreOutput`; `processStreaming` gana una bifurcación de transporte.
- **Negativas**: el wiring es el punto central de retención (ALTO si falla); se requiere disciplina de orden T1-3→T1-4 para no dejar una asimetría transitoria abierta.

## Continuidad (si esta conversación desaparece)

- HEAD esperado al retomar: `ec3756b`. Worktree: solo driver `workshop/subaru/gate-status-enrich.json` ajeno (no tocar).
- Documentos de autoridad: ADR-028, PRD §3/§7, Plan T1-3/§4.2.
- Próximo paso: nueva autorización del usuario para implementar T1-3 contra el criterio de §10. NO implementar sin autorización.