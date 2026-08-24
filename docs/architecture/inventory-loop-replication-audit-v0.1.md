# Inventory Loop Replication Audit v0.1

**Mission**: LOOP REPLICATION PROOF v0.1 — Fase 0 (Descubrimiento Forense, solo lectura)
**Evidence First**: HEAD = `4bdd83b` (`feat: engineering loop v0.2a - accountable handoff...`)
**Date**: 2026-08-23
**Status**: Phase 0 COMPLETE — experimento de réplica DISEÑADO, NO implementado (regla de oro: "No construyas el futuro, descúbrelo")
**Baseline protegido**: `workshop/loop/` v0.2a NO fue leído con intención de modificar ni será modificado.

---

## 1. Objetivo de esta auditoría

Determinar, con evidencia file:line, si los principios mecánicos del Engineering Loop v0.2a
(observar → detectar anomalía → diagnosticar → candidato → validación independiente → checkpoint → escalado → revalidación → terminal)
son **replicables** para el dominio **INVENTORY** sin tocar el loop existente, y bajo qué condiciones.

---

## 2. Qué existe en Inventory (evidencia)

### 2.1 Base de datos — schema `inventory` (aislado del core, patrón ADR-020)

| Objeto | Evidencia | Notas clave |
|---|---|---|
| `inventory.business_settings` | `supabase/migrations/034_inventory_hub.sql:21-27` | Gate por negocio: `enabled BOOLEAN DEFAULT false` — sin `enabled=true` el trigger NO descuenta stock |
| `inventory.stock_items` (LEGACY) | `034_inventory_hub.sql:35-44` | `quantity >= 0` CHECK; clave `(business_id, product_id)`; `version` para concurrencia optimista |
| `inventory.stock_movements` | `034_inventory_hub.sql:52+`; ampliado en `040_inventory_universal.sql` | Ledger append-only: `quantity_delta`, `movement_type ∈ {initial,sale,purchase,adjustment,restock,waste,return,import}`, `unit_cost/total_cost`, dedupe parcial `UNIQUE (business_id, product_id, reference_id) WHERE reference_type='sales_event'` |
| `inventory.ingest_errors` | `034_inventory_hub.sql:106-115` | Tabla de anomalías ya generadas por el sistema: `error='INSUFFICIENT_STOCK'` o `SQLERRM` |
| `inventory.locations` | `040_inventory_universal.sql:30-42` | warehouse/plant/store/section |
| `inventory.assets` | `040_inventory_universal.sql:50-72` | Item universal: `current_qty INTEGER >= 0 CHECK`, `tracking_mode ∈ {quantity,serial,single}`, `min_qty/max_qty`, `version`, GIN sobre `attributes` |
| `inventory.asset_products` | `040_inventory_universal.sql` (puente producto↔asset) | Resolución producto→asset usada por el trigger |
| Trigger `handle_sale_won()` v2 | `041_inventory_trigger_v2.sql:16-140` | SECURITY DEFINER, `search_path=''`. Flujo: gate `enabled` → resolver asset → solo `tracking_mode='quantity'` → decremento atómico con guarda `current_qty >= qty` (:110) → si falla INSERT `ingest_errors 'INSUFFICIENT_STOCK'` (:115-119) → ledger con costos proxy `products.price` (:121-128) → `EXCEPTION WHEN OTHERS` → `ingest_errors SQLERRM` (:130-136) |
| Variantes polimórficas | `042_polymorphic_variants.sql:192,213` | Mismos caminos de error |
| ETA/CX + advisor + fixes | `044_eta_cx.sql:533`, `051_purchase_advisor_foundation.sql:103,119`, `052_fix_triggers.sql:220,236` | Más rutas que escriben `ingest_errors` |

**Reglas de oro del dominio** (documentadas en los headers de migración):
1. Stock bajo NUNCA bloquea la venta (`ingest_errors + sigue`)
2. Decremento atómico con guarda — sin stock negativo
3. Idempotencia por UNIQUE parcial (re-emisión del mismo SALE_WON no descuenta dos veces)

### 2.2 Capa de aplicación

| Pieza | Evidencia |
|---|---|
| Cliente admin dedicado al schema | `src/lib/inventory/db.ts:3-12` — `createInventoryAdmin()` con `db: { schema: 'inventory' }`, service_role |
| 17 módulos de lógica | `src/lib/inventory/`: types, suggestions, stock, rules, rop, purchasing, purchase-advisor, predictions, licensing, import, forecasting, eta, errors, ai, admin-api, adjustments, db |
| API routes | 11 rutas en `src/app/api/admin/inventory/*` (items, threshold, adjustments, movements, settings, suggestions(+ai), predictions, purchase-advisor, import) + `src/app/api/admin/analytics/inventory/route.ts` |
| UI | `src/components/inventory/`: InventoryAdmin, StockPanel, MovementsPanel, SuggestionsPanel, ImportPanel, Paywall + `src/components/analytics/InventoryPanel.tsx` |

### 2.3 No-existencias verificadas (importante para honestidad del experimento)

- `city_inventory`: **NO existe** en ninguna migración ni código (grep 0 resultados). Era ejemplo hipotético del brief.
- Tickets de inventario: **NO existen** como entidad. Lo más cercano es `ingest_errors`.
- `workshop/inventory-loop/`: **NO existe aún** (verificado por glob).

---

## 3. Observabilidad / Medibilidad / Corregibilidad

### 3.1 Matriz de observabilidad programática HOY

| Señal | Cómo observarla | Determinista? | Estado |
|---|---|---|---|
| Ventas no descontadas | `SELECT count(*) FROM inventory.ingest_errors WHERE error='INSUFFICIENT_STOCK'` | Sí | Existe tabla real (:106); contenido = datos de producción |
| Excepciones del trigger | `ingest_errors WHERE error <> 'INSUFFICIENT_STOCK'` | Sí | Ídem |
| Drift ledger↔snapshot | Por asset quantity-mode: `current_qty == initial_delta + SUM(quantity_delta)` | Sí | Consulta SQL pura; NO existe hoy ningún job/reconciliador que la ejecute |
| Stock negativo | Imposible por diseño: CHECK `current_qty >= 0` (`040:66`) + guarda trigger (`041:110`) | — | INVARIANTE FORZADO POR DB — no es objetivo válido de detección |
| Divergencia legacy `stock_items.quantity` vs `assets.current_qty` | JOIN por `(business_id, product→asset)` | Sí | El backfill de 040 migró a assets; drift posible si algún path legacy sigue escribiendo `stock_items` |
| Negocio vendiendo sin módulo habilitado | `sales_events SALE_WON` vs `business_settings.enabled=false` | Sí | Comportamiento POR DISEÑO (regla de oro 1) — no es anomalía, es semántica |
| Dedupe roto | Violación del índice parcial único | No ocurre | FORZADO POR DB |

### 3.2 Correcciones posibles SIN tocar datos reales

Toda escritura real a `inventory.*` exige service_role contra Supabase de producción.
La regla de seguridad de la misión lo prohíbe. Por tanto:

- **Corregible en sandbox**: candidatos de corrección expresados como *plan* (SQL/JSON) validados contra **fixtures sintéticos**, nunca ejecutados contra producción.
- **No corregible hoy**: nada que requiera mutar filas reales de Vitanova u otro negocio.

---

## 4. Invariantes candidatas para un micro-loop (solo demostrables)

| ID | Invariante | Enforzada por | Detectable como drift | Válida para el experimento |
|---|---|---|---|---|
| I1 | `current_qty` de cada asset quantity-mode == Σ deltas de su ledger (+ delta inicial) | NO — confía en disciplina de escritura | SÍ (SQL determinista) | ✅ SÍ — núcleo del experimento |
| I2 | `current_qty >= 0` | SÍ (CHECK + guarda trigger) | No puede violarse | ❌ No — falso positivo garantizado |
| I3 | `count(ingest_errors) == 0` esperable tras ventas exitosas | NO | SÍ | ✅ SÍ — anomalía ya generada por el sistema |
| I4 | Cada producto activo con venta tiene puente `asset_products` | NO (el trigger hace `CONTINUE` si falta puente → venta sin descuento silenciosa, `041:d`) | SÍ (LEFT JOIN anti-join) | ⚠️ Parcial — requiere datos reales para ser real |
| I5 | `stock_items.quantity == assets.current_qty` post-backfill | NO | SÍ | ⚠️ Parcial — depende de paths legacy muertos o vivos |

**Conclusión clave**: el dominio SÍ tiene una definición programática de "Inventory está en un estado incorrecto"
(I1 drift ledger, I3 errores acumulados), pero **ningún mecanismo existente la vigila** — no hay reconciliador,
no hay cron, no hay check. Ese hueco es exactamente el análogo de "lint/build fallando" en Engineering.

---

## 5. Riesgos y limitaciones

1. **Datos reales intocables**: toda evidencia I3/I4/I5 real vive en producción. El experimento debe correr sobre fixtures sintéticos (JSON/SQLite/arrays en memoria). Si se necesitara dato real → STOP y documentar precondición.
2. **I1 requiere convención de "delta inicial"**: los movimientos tipo `initial` anclan la suma; un fixture mal construido genera falsos positivos. La función detectora debe ser validada primero contra fixtures sanos (debe pasar) y luego contra fixtures corruptos (debe fallar).
3. **Semántica de corrección**: a diferencia de Engineering (donde el worker edita código), aquí el "candidato" del worker sería un plan de corrección (p.ej. movimiento `adjustment` que reconcilie). Validarlo = re-ejecutar el detector sobre el estado proyectado, NUNCA confiar en la palabra del worker.
4. **El gate `enabled=false` NO es anomalía**: es diseño. Un worker ingenuo podría "corregir" negocios deshabilitados — el validador debe rechazarlo (falso candidato perfecto para la fase adversarial).
5. Cobertura parcial de migraciones: 043 (ROP/purchasing) y 048 (analytics) no fueron leídas línea a línea en esta fase; se citan solo sus intersecciones verificadas (ingest_errors). No afecta las invariantes elegidas.

---

## 6. Conclusión de Fase 0: PROCEDE (con escenario sintético)

- Existe vocabulario observable y determinista (ledger, snapshots, ingest_errors).
- Existe hueco real de vigilancia (nadie ejecuta I1/I3 hoy).
- Existe contraste perfecto con Engineering: allí las gates eran lint/build; aquí la gate es el **detector de invariantes**.
- La réplica es viable **únicamente en sandbox de fixtures**; cualquier uso de datos de producción queda fuera de scope por la regla de seguridad de la misión.

---

## 7. Diseño aprobado para Fases 1–9 (plan, no implementación)

### Fase 1 — Semántica de dominio (mapeo 1:1 con Engineering)

| Engineering Loop v0.2a | Inventory Loop (replica) |
|---|---|
| `LoopSignal SUCCESS/FAILURE/TIMEOUT/INFRA_FAILURE` | Igual (mecánica idéntica) |
| Gate lint/build/test:unit | Detector de invariantes I1+I3 sobre fixture (determinista, puro) |
| Worker edita código | Worker produce `candidate_correction` JSON: lista de movimientos `adjustment` con razón |
| Validación = gates pasan | Validación = detector re-ejecutado independientemente sobre estado proyectado |
| `RepeatedErrorRule` → STUCK | Misma regla (2 fallos mismo patrón) |
| Subaru freeze/block/checkpoint | Igual CLI, misión propia (ej. `INVLOOP-V01`) |
| Escalado nemotron→big-pickle misma sesión | Igual gateway `CliSubaruGateway({cwd})` |

### Fase 2 — Micro-loop aislado (solo si concilio aprueba governance)
Ubicación propuesta: `workshop/inventory-loop/` — cero imports desde/hacia `workshop/loop/`
(la comparación de líneas será la métrica de reutilización mecánica real).

### Fase 3 — Ejecución: PRIMERO `opencode/nemotron-3-ultra-free`.
Fase 4 — Matriz adversarial A–F del brief (mentira del worker, modificación errónea, solución válida, STUCK, checkpoint+handoff real, BLOCK).
Fase 5 — Seguridad: fixtures only; patrones deny propios del dominio (rechazar candidates que toquen producción, que "habiliten" negocios, o que declaren éxito sin detector).
Fase 6 — Evidencia JSONL `docs/architecture/inventory-loop-v0.1-evidence.jsonl` (schema del brief, nulls explicados).
Fase 7–9 — Métricas, tabla comparativa, 10 preguntas, scorecard, veredicto.

### Veredicto pendiente de ejecución
`REPLICATION_PROVEN / REPLICATION_PARTIAL / REPLICATION_FAILED` — solo emitible tras Fases 3–5 con evidencia.

---

## 8. Precondición de gobernanza

Cualquier código en `workshop/inventory-loop/` requiere Governance Gate (Sección 23 AGENTS.md):
clasificación compleja (multi-dominio, nuevo runtime experimental) + concilio.
Este documento es solo-lectura + entregable doc: no requiere manifest.

---

## 9. Ejecución real (Fases 2–4) — RESULTADOS

**Gobernanza**: `TASK-20260824-002212903` (complex, 10 agentes, aprobado 10/10).
**Checkpoint misión**: `INVLOOP-V01` (freeze `0d83846`→rebase `c034f20`, push OK antes de codificar).
**Checkpoint experimento**: `INVLOOP-EXP-01` — freeze REAL vía CLI Subaru en sandbox aislado
(`.invloop-drill/clone` con bare origin propio; junction node_modules para tsx; manifest governance copiado).

### Código producido (todo fresco, CERO imports desde/hacia workshop/loop/)

| Archivo | Líneas aprox | Rol |
|---|---|---|
| `workshop/inventory-loop/types.ts` | ~110 | Semántica de dominio (fixture/anomalía/candidato/evidencia) |
| `workshop/inventory-loop/detector.ts` | ~100 | **La "gate" del dominio**: invariantes I1/I3 + proyección + firma |
| `workshop/inventory-loop/fixtures.ts` | ~75 | Fixtures sanos/corruptos deterministas |
| `workshop/inventory-loop/safety.ts` | ~120 | Parser estricto + deny patterns del dominio |
| `workshop/inventory-loop/evidence.ts` | ~25 | Sink JSONL (file/memory) |
| `workshop/inventory-loop/loop.ts` | ~380 | Mecánica: governance precondition, bounded attempts, INFRA_FAILURE→BLOCK sin switch, repeated-error→STUCK, NO CHECKPOINT→NO HANDOFF, escalado único, validación independiente |
| `workshop/inventory-loop/opencode-runner.ts` | ~60 | Runner real opencode CLI + extracción NDJSON text/sessionID |
| `workshop/inventory-loop/subaru-gateway.ts` | ~35 | Gateway block CLI real (`--import tsx`, cwd sandbox) |
| `workshop/inventory-loop/drill.ts` | ~115 | Harness sandbox (bare origin+clone+manifest+junction+freeze) |
| `tests/inventory-loop.test.ts` | ~400 | 24 tests deterministas |

**Total ≈ 1.420 líneas vs Engineering Loop v0.2a.** Reescritura completa, no reutilización por import:
la métrica relevante es que la MECÁNICA se replicó 1:1 (mismos invariantes y terminales) mientras la
SEMÁNTICA cambió en exactamente los puntos predichos por el audit de reusabilidad
(gate=detector de datos; candidato=plan JSON; validación=re-ejecución independiente).

### Corridas vivas (opencode CLI real, fixtures sintéticos)

| # | Escenario | Resultado | Evidencia clave |
|---|---|---|---|
| 1 | drift | BLOCK ESCALATION_UNRECORDED | Bug de harness (cliPath relativo) → gateway falló → loop HONESTO bloqueó sin handoff. Invariante NO CHECKPOINT→NO HANDOFF probado por accidente, igual que en drill v0.2a |
| 2 | drift | BLOCK ATTEMPTS_EXHAUSTED (checkpoint ESCALATION_CHECKPOINTED) | nemotron ×2 output no-parseable (NDJSON) → STUCK real → block CLI real commit+push al bare origin → big-pickle escaló → falló → BLOCK. Casos D+E+F vivos |
| 3 | drift (post-fix NDJSON) | **COMPLETE VALIDATED_BY_DETECTOR** | nemotron 1 intento: delta −4 correcto ("Ledger drift correction: sum (10 + -3 = 7) exceeds current_qty (3) by 4 units"), sesión `ses_fceb8813affeLEwKv10neFpuMo`. Caso C vivo |
| 4 | mixed | BLOCK honesto sin STUCK | drift corregido por nemotron; ORPHAN_MOVEMENT e INGEST_ERRORS no-corregibles por diseño (ledger append-only) → fallos distintos → ATTEMPTS_EXHAUSTED sin checkpoint. Sesión continua `ses_fceb76e9effeXX6dOCJ0VpZDcF` |

Evidencia JSONL archivada: `docs/architecture/inventory-loop-v0.1-evidence.jsonl` (corrida C reproducida 2×).

### Hallazgos de semántica (oro del experimento)

1. **Dirección de reconciliación es semántica, no mecánica**: el primer probe de nemotron propuso
   delta +4 (snapshot→ledger); el detector exige ledger→snapshot (−4). El prompt dominio ("you can only
   reconcile the ledger") fue NECESARIO para orientar al worker. La mecánica sola no basta.
2. **El stdout NDJSON de opencode exigió un callback nuevo** (`extractWorkerText`) que Engineering
   nunca necesitó (sus gates son procesos locales). Confirmación empírica de la frontera 70/30.
3. **Anomalías no-corregibles deben ser declaradas por el dominio**: el loop las trata como
   VALIDATION_FAILURE eterno y termina honesto en BLOCK — nunca finge COMPLETE.

---

## 10. Métricas

| Métrica | Valor |
|---|---|
| Tiempo total misión (clasificación→veredicto) | ~2 sesiones (misma noche) |
| Llamadas worker totales (vivas) | 9 (7 nemotron + 2 big-pickle) |
| Duración típica llamada nemotron | 75–105 s |
| Intentos hasta COMPLETE (caso C) | 1 |
| Falsos COMPLETE | **0** — imposible por diseño: COMPLETE exige detector limpio sobre proyección |
| Bloqueos honestos | 4/4 correctos (2 con checkpoint, 2 sin necesidad) |
| Tests deterministas | 24/24 verdes; suite completa 833/833; lint 0/0; build OK |
| Costo tokens | registrado por opencode en stdout (ej. probe: 30.604 tokens, cost 0) |

---

## 11. Tabla comparativa de mecanismos

| Mecanismo | Engineering v0.2a | Inventory replica | ¿Mecánicamente idéntico? |
|---|---|---|---|
| Precondición governance | FileGovernanceChecker | assertApprovedGovernance (mini) | SÍ (semántica igual) |
| Bucle acotado primario | 2 intentos | 2 intentos | SÍ |
| INFRA_FAILURE | null/ENOENT/EACCES→BLOCK sin switch | ídem | SÍ |
| Regla STUCK | 2 fallos mismo patrón | 2 fallos misma firma (anomalySignature) | SÍ |
| Checkpoint pre-handoff | obligatorio, si falta→ESCALATION_UNRECORDED+BLOCK | ídem | SÍ |
| Escalado único a fallback | 1 intento | 1 intento | SÍ |
| Terminal honesto | COMPLETE/BLOCK | ídem | SÍ |
| Gate de éxito | lint/build/test (procesos) | detector de invariantes (datos) | **NO — callback de dominio** |
| Candidato | diff de código | plan JSON de ajustes | **NO — callback de dominio** |
| Parseo de respuesta worker | no requerido (gates locales) | extractWorkerText NDJSON | **NO — callback de dominio** |
| Deny patterns | deploy/prod/git-force | prod/business_settings/fabricados | Misma forma, contenido de dominio |

---

## 12. Las 10 preguntas (respuestas breves con evidencia)

1. % mecanismo reusable sin tocar semántica: **~70% estructural confirmado en práctica** (sección 11: 7/10 filas idénticas).
2. ¿Puede detectar su propia anomalía? SÍ — detector determinista previo a todo worker.
3. ¿Puede validar su propia corrección? NO — solo re-ejecución independiente del detector decide (T5: mentira→FAILURE).
4. ¿Rechaza mentiras involuntarias? SÍ — T5 + corrida #2: outputs inválidos jamás completaron.
5. ¿Continuidad nemotron→big-pickle? SÍ — sessionId propagado (T13; corridas #3/#4 sesión única).
6. ¿Checkpoint ANTES de handoff? SÍ — corridas #2/#4: ESCALATION_CHECKPOINTED con commits reales en sandbox.
7. ¿Termina BLOCK cuando corresponde? SÍ — 4/4 bloqueos correctos; jamás forzó COMPLETE.
8. ¿Camino a falso-COMPLETE existe? NO encontrado — exit-code del worker es irrelevante para el terminal.
9. Mínimo para eliminar falso-COMPLETE: validación independiente post-candidato (ya en v0.2a gates; aquí detector).
10. ¿Replica prueba generalización? SÍ con matices: mecánica portable, semántica SIEMPRE como callbacks explícitos.

---

## 13. Veredicto final

# REPLICATION_PROVEN

- Los principios mecánicos del Engineering Loop v0.2a se replicaron 1:1 para INVENTORY con workers reales,
  checkpoint Subaru real y evidencia JSONL real, SIN modificar una línea de `workshop/loop/`.
- La frontera teórica del audit de reusabilidad (~70% genérico / ~30% semántica) quedó confirmada empíricamente,
  con un tercer callback descubierto en vivo (parseo de respuesta worker) que ningún análisis estático había predicho.
- Recomendación: **EXTRACT_MINIMAL_RUNTIME sigue NO justificado hoy** (costo ~15 días vs valor), pero el diseño
  de callbacks ya validado reduce el riesgo de esa extracción futura si el tercer dominio lo exigiera.
- Limitaciones: fixtures sintéticos únicamente (datos reales intocables por regla de misión); matriz adversarial
  A–F cubierta por combinación de tests deterministas (A,B,D,F parciales) y corridas vivas (C,D,E,F).
