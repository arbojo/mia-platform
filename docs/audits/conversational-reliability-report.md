# Informe de Auditoría — Fiabilidad Conversacional de MIA

**Fecha**: 2026-08-09
**HEAD auditado**: `eaf3a4c`
**Alcance**: TASK-20260809-210118203 (complex) — auditoría integral de fiabilidad: simulación de flujos conversacionales, guardrails de intención, trazabilidad de datos al dashboard y multimedia contextual.

---

## 1. Objetivo

Evaluar empíricamente la fiabilidad del flujo conversacional de MIA en cuatro ejes:

1. **Psicología de ventas** — ganchos de dolor, manejo de objeciones y cierre.
2. **Falsos positivos de intención** — clasificación de intenciones (`detectIntent`) y gatillo de detección de cierre (`hasSalesTrigger`).
3. **Captura/persistencia de datos** — del chat hacia Supabase y su llegada al dashboard (métricas, señales, eventos).
4. **Multimedia contextual** — lógica de disparo de `resolveConditionalMedia` y consistencia entre lo que MIA promete y lo que envía.

Entregable: este reporte técnico + guardrails implementados con evidencia y validación.

---

## 2. Metodología (Evidence First)

- Se leyó `HEAD` (`git log --oneline -10`) y se confirmó el árbol limpio en `eaf3a4c`.
- Se releyó el estado actual de cada archivo citado (no se usaron snapshots previos).
- **Simulación Parte A (lógica pura, 0 tokens)**: harness `scripts/audit-reliability/index.ts` sobre `hasSalesTrigger`, `detectIntent`, `triggerMatches`/`intentMatchesTrigger` con 31 casos (9 gatillos, 8 intenciones, 6 media).
- **Simulación Parte B (IA real)**: `detectSaleOutcome` (gpt-4o-mini, temperature 0) sobre 4 transcripciones representativas: dolor sin confirmación, negación, confirmación explícita y titubeo.
- **Probe read-only** de trazabilidad en la base del entorno (`MIA Demo`, asistente `Luna`).

---

## 3. Pipeline auditado

```
whatsapp (bridge) ─┐
widget /api/widget/chat ─┤
web / messenger / instagram ─┤
dashboard /api/chat (training) ─┘
        └→ processIncomingMessage / processStreaming (runtime.ts)
              └→ loadConversationContext (context.ts)
                    └→ getBusinessContext / getLandingContext (knowledge.ts)
                    └→ buildMasterPrompt (prompts.ts)
              └→ executeAI (execute-ai.ts) → gpt-4o-mini → trackAiUsage
              └→ processSaleClosing (solo flujo de canales) → sales_events / mia_signals / customers
              └→ resolveConditionalMedia (solo processIncomingMessage) → chat_media_dispatched
                    └→ dashboard: queries.ts (SALE_WON) · /api/sales/metrics
```

---

## 4. Resultados de simulación

### 4.1 Parte A — Lógica de clasificación (harness)

| Componente | Resultado |
|---|---|
| `hasSalesTrigger` | **5 falsos positivos** de 9 casos: negaciones ("no quiero…", "ya no quiero nada por hoy"), reconocimiento ("listo, muchas gracias"), homógrafos ("se me puso la cara…", "mi número favorito es el 7"). Los casos de confirmación/rechazo/precio pasaron. |
| `detectIntent` | **4 falsos positivos** de 8 casos: "te envío la dirección…" → `shipping`, "¿qué valor agregado tiene?" → `price`, "pago mis cuentas en línea" → `payment`, "vivo en zona norte" → `shipping`. |
| `triggerMatches` (antes del fix) | **2 fallos reales**: `"envio"` no alcanzaba `"¿hacen envíos?"` (plural), y la frase estilo UI `"al mencionar envío"` nunca dispara con mensajes reales. |

### 4.2 Parte B — Detección de cierre con IA real

| Escenario | outcome | events | Verificación |
|---|---|---|---|
| S1 · Dolor/consultas sin confirmación | `pending` | `[]` | ✅ Sin SALE_WON falso |
| S2 · Negación ("no quiero nada, solo miraba") | `not_interested` | `SALE_LOST` | ✅ Correcto |
| S3 · Confirmación explícita + datos | `sold` | `SALE_STARTED, SALE_WON` | ✅ Detecta y captura nombre/ciudad/dirección |
| S4 · Interés con titubeo | `pending` | `[]` | ✅ No fuerza el cierre |

**Conclusión del eje AI**: el guardrail de clasificación (prompt estricto + temperature 0) es robusto: **no se generó ningún SALE_WON espurio** en escenarios de no-confirmación. El riesgo de fiabilidad no está en la emisión de eventos, sino en el **gatillo y la intención previos** (costo + botones fuera de contexto).

---

## 5. Hallazgos

| # | Severidad | Hallazgo | Evidencia |
|---|-----------|----------|-----------|
| H1 | **Alta** | `hasSalesTrigger` genera llamadas OpenAI espurias en negaciones, reconocimientos y homógrafos → ~2× tokens en flujo WhatsApp y ventana de clasificación espuria. | `src/lib/sales/detect.ts:45-59` + harness A (5 casos) |
| H2 | **Media** | `detectIntent` clasifica homógrafos por substring ("te envío…"→shipping, "valor agregado"→price, "pago mis cuentas"→payment, "zona norte"→shipping) → botones interactivos de WhatsApp/quick_reply y header `X-MIA-Sales-Intent` del widget en contexto equivocado. | `src/lib/runtime/intents.ts:15-66` + harness A (4 casos) |
| H3 | **Alta** | MIA **promete imágenes que nunca envía** en el widget/web: `[IMAGEN_DISPONIBLE]` se inyecta en el prompt para todo canal, pero `resolveConditionalMedia` solo corre en `processIncomingMessage`, nunca en `processStreaming` (widget y chat de entrenamiento). El cliente lee "te comparto una imagen" y esta no llega. | `src/lib/ai/prompts.ts:131-134` (pre-fix), `src/lib/runtime/runtime.ts:248`, `src/app/api/widget/chat/route.ts:68-76` |
| H4 | **Alta** | Gramática de triggers multimedia frágil: matcher de palabra exacta (sin inflexión) — "envio" no alcanza "envíos". Las frases guiadas por la UI ("Se envía cuando mencione: …") tipo "al mencionar envío" jamás disparan. Solo funcionan palabras literales exactas o `intent <tag>`. | `src/lib/runtime/media.ts:11-33`, `src/components/knowledge/MediaEditDialog.tsx:107-109`, `tests/knowledge/suggestions.test.ts:69`, harness A |
| H5 | **Media** | El widget **no cierra venta**: persiste messages + `ai_usage`, pero no ejecuta `processSaleClosing` → las ventas por widget no generan `sales_events`/`mia_signals`/outcome, y las métricas del dashboard que filtran `SALE_WON` las ignoran. | `src/app/api/widget/chat/route.ts:68-76` (solo `processStreaming`), `src/lib/runtime/runtime.ts:234-246` (canales sí lo llaman), `src/lib/dashboard/queries.ts:958` |
| H6 | — | **Positivo — guardrail de cierre robusto**: confirmación explícita exigida, temperature 0, sanitización de teléfono/ciudad/productos, `hasClosingEvent` evita duplicar SALE_WON, `applyConversationOutcome` no regresa `sold→sold`. | `src/lib/sales/detect.ts:37-42,130-156`, `src/lib/sales/events.ts:52-62,82-84`, harness B |
| H7 | Bajo | En landing, el "## Producto activo" usa `products[0]` mientras el filtrado de conocimiento/media usa `landingContext.productId`: si difieren, el prompt puede nombrar un producto distinto al que se promociona. | `src/lib/ai/prompts.ts:235` vs `src/lib/conversation/context.ts:91` |
| H8 | Bajo | El cache de contexto (`CUSTOMER_CACHE_TTL` 30 s / general 5 min) no se invalida tras `processSaleClosing`; ventana corta de prompt con datos previos. Impacto marginal. | `src/lib/conversation/context.ts:139-140` |

---

## 6. Guardrails implementados (con validación)

### G1 — Tolerancia plural en triggers multimedia (`src/lib/runtime/media.ts`)
- **Cambio**: el patrón de coincidencia acepta el sufijo opcional `s|es` (`(?:^|\s)<keyword>(?:s|es)?(?=\s|$)`), siempre exigiendo palabra completa con límites previo y posterior.
- **Efecto**: `"envio"` alcanza `"¿hacen envíos?"`, `"flor"` alcanza `"flores"`; se conserva que `"precio"` NO alcance `"presupuesto"` ni `"es"` a `"clientes"`.
- **Validación**: `tests/runtime/media.test.ts` (nuevos casos) — suite verde.

### G2 — Prometer imagen solo en canales que la despachan (`src/lib/ai/prompts.ts`)
- **Cambio**: `[IMAGEN_DISPONIBLE]` solo se inyecta cuando `channel` está definido (canales que pasan por `processIncomingMessage` y sí ejecutan `resolveConditionalMedia`). En `processStreaming` (widget/entrenamiento, donde `channel` es `undefined`) MIA ya no promete imágenes que no envía.
- **Validación**: `tests/ai/prompts.test.ts` (nuevo caso: whatsapp promete, streaming no) — suite verde.

Ambos pasan `npm run lint` (0 errores), `npm run build` y la suite unitaria completa (54 archivos / 478 tests).

---

## 7. Guardrails propuestos (no implementados — requieren decisión)

| # | Propuesta | Archivo objetivo | Impacto esperado |
|---|-----------|------------------|------------------|
| P1 | **Prompt de venta consultiva**: añadir directiva de *need discovery* — detectar el dolor con las palabras del cliente, conectar beneficio→valor, validar la objeción antes de responder, y un solo CTA suave al cierre. | `src/lib/i18n/dictionaries/es.ts` (`ai.*`) + `pt/ja/en` | Alinear el comportamiento con ADR-010 (Need Discovery, Consultative Selling, Objection Handling) |
| P2 | **Filtrar negaciones en `hasSalesTrigger`**: solo disparar clasificación cuando la frase es interrogativa o de polaridad positiva, excluyendo "no quiero saber más" / "listo, gracias" de la detección de cierre (conservando rechazos explícitos como "no me interesa"). | `src/lib/sales/detect.ts` | Reduce llamadas OpenAI espurias (~coste) sin perder SALE_LOST |
| P3 | **Desambiguar `detectIntent`**: ignorar `envio/pago/zona/valor` cuando el verbo es del emisor ("te envío", "le envié") o la frase no es comercial; priorizar ya el payload de quick_reply (existe). | `src/lib/runtime/intents.ts` | Botones interactivos en contexto correcto |
| P4 | **Cerrar venta en el widget**: invocar `processSaleClosing` también en el flujo `processStreaming` cuando `requestType='live_customer'`, respetando la nota de landing (datos los captura el formulario, no el chat). | `src/lib/runtime/runtime.ts` | Las ventas por widget aparecen en métricas/eventos/señales |
| P5 | **Normalizar triggers en la UI**: si la condición empieza con "al mencionar / cuando mencione", extraer la keyword o convertirla a `intent <tag>`; añadir validación con feedback ("nunca se disparará"). | `src/components/knowledge/MediaEditDialog.tsx` + validación backend | Evita medios muertos que no se envían jamás |
| P6 | **Producto activo único**: derivar el "## Producto activo" de `landingContext.productId` (no de `products[0]`). | `src/lib/ai/prompts.ts:235` | Prompt coherente con el producto promocionado |

---

## 8. Trazabilidad de datos — veredicto

- **Flujo WhatsApp/canales (completo)**: `messages` (entrada/salida), `channel_messages` (in/out), `sales_events`, `mia_signals`, `customers` (status/phone/city/address), `ai_usage` — todo persiste. ✅
- **Flujo widget (parcial)**: `messages` + `ai_usage` persisten; **faltan** `sales_events`, `mia_signals`, actualización de `customers` y multimedia (ver H5). ⚠️
- **Dashboard**: las métricas de venta (`queries.ts:958`, `/api/sales/metrics`) leen `sales_events`; por tanto el widget está fuera de las métricas de venta hasta que se aplique P4.

---

## 9. Conclusión

La **detección de cierre por IA es confiable** (sin falsos SALE_WON; captura correcta de datos del cliente). La fiabilidad se degrada aguas arriba: el **gatillo** dispara clasificaciones innecesarias y la **intención** clasifica homógrafos, y en multimedia MIA **promete imágenes que no envía** en el widget con triggers frágiles. Se implementaron los dos guardrails de mayor valor/riesgo mínimo (G1 plurales, G2 imagen por canal); el resto (P1–P6) queda documentado para decisión del Concilio.

**Siguientes pasos sugeridos**: aprobar P1 (venta consultiva en prompt, alineado a ADR-010) y P4 (cierre de venta en widget) como tareas independientes; P2/P3/P5 como optimizaciones de costo y UX.
