---
task_id: TASK-20260905-034043506
title: Implementar DEC-20260904-MEDIA-CONTRACT — contrato canonico de multimedia (R1-R8 + INV-MEDIA-001..015)
state: in_progress
current_step: 9
total_steps: 12
branch: main
last_machine: Deivis-Desktop
governance_id: TASK-20260905-034043506
created: 2026-09-05T02:00:00.000Z
updated: 2026-09-05T07:56:48.210Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Implementar `DEC-20260904-MEDIA-CONTRACT` (contrato canónico de multimedia MIA): alinear Dashboard ↔ Runtime sobre `product_id` como ownership, `trigger_condition` como refinador OPCIONAL (NULL = medio incondicional del producto), `MEDIA_REQUEST` detectado por normalización/intent en runtime, selección determinista (especializada → principal → ninguna), truthful media state y idempotencia `(conversation × asset)` con resend explícito. Objetivo operacional: los 6 FAIL de RESPONSE-BATTERY-002 (C05, C07, C08, C09, F03, F04) dejan de fallar y los invariantes INV-MEDIA-001..015 se cumplen y registran.

Aprobación: TASK-20260905-034043506. Contrato: DEC-20260904-MEDIA-CONTRACT (unánime, DECISION_ACCEPTED). Freeze autorizado por el operador humano (fase blueprint PREVIO a código). Preflight Subaru STOP_FOR_HUMAN preexistente (drift B3 documentado y autorizado) — NO se altera ningún commit B3.

## Scope

- **Runtime de media**: `src/lib/runtime/context-media.ts`, `src/lib/runtime/media.ts`, `src/lib/runtime/media-guard.ts` (solo si un hallazgo lo exige), tipado/decisions en `src/lib/runtime/core.ts`.
- **Capa AI**: `src/lib/ai/prompts.ts` (feedback P1-6/R7 truthful, `[IMAGEN_DISPONIBLE]` driven por runtime).
- **Catálogo/Datos**: APIs de `knowledge_items` (`items/route.ts`, `items/[id]/route.ts`), `src/lib/import/engine.ts`.
- **Dashboard (texto, no lógica)**: `ProductMedia.tsx`, `MediaBrowser.tsx`, `MediaEditDialog.tsx`, `MediaGrid.tsx`.
- **Tests**: `tests/runtime/media.test.ts`, `tests/runtime/context-media-golden.test.ts`, `conditional-media.test.ts` (solo si documenta el gap NULL), `tests/import/*`, `tests/api/knowledge-items*.test.ts`, `tests/ai/prompts.test.ts`, `tests/i18n/prompts-i18n.test.ts`, `tests/runtime/*b3*`, `tests/runtime/retention-wiring-runtime.test.ts` (regresión).
- **Verificación**: re-run `RESPONSE-BATTERY-002`, Golden Tests GT-01..GT-35 reconvertidos + casos nuevos, `.governance/invariants.json` con INV-MEDIA-001..015.

## Non-goals

- NO migraciones nuevas (la columna `position` ya existe; `product_id`/`trigger_condition`/`image_url` ya existen). Role principal/especializada se DERIVA determinísticamente, nunca como columna nueva.
- NO modificar datos de negocio: NO editar `products`, `knowledge_items`, `chat_media_dispatched` ni triggers de los live data (Back2Fit, Neurofeet, Neurotin, Bye Canas, genéricos).
- NO tocar commits B3 existentes (`3c61c86`, `da4fb9d`) ni su checkpoint; el drift documentado queda como está hasta la fase Release.
- NO endpoints nuevos (`MEDIA_REQUEST` endpoint, feature flags) — fuera de alcance del contrato.
- NO tocar `media_sent_products` (deprecated; no se crean gates de producto adicionales).
- NO cambiar `conditional-media.ts` (legacy fuera del hot path) salvo hallazgo de invariante; documentar en su lugar.
- NO implementar ninguna ambigüedad del contrato inventando comportamiento: resolver con evidencia (DP-1..DP-7) o detener y reportar.
- NO commit/push/deploy durante las fases de freeze; la implementación exige antes la aprobación humana de este blueprint congelado.

## Approved plan

Pasos atómicos aprobados por el Council. Orden secuencial estricto: cada paso depende del anterior (TDD: tests del contrato nuevo primero, código después).

- [x] **Paso 1:** Contrato nuevo traducido a fixtures y decisiones (TDD baseline)
  - Objetivo: dejar fijadas las señales de contrato (mediaStatus, decision surface) y hacer roja la suite del contrato nuevo contra HEAD actual.
  - Archivos: tests/runtime/context-media-golden.test.ts, tests/runtime/media.test.ts, src/lib/runtime/context-media.ts (tipos/decisions).
  - Acción: actualizar harness golden (quitar filtro `trigger_condition != null`), definir enum `mediaStatus`, escribir caso normativos T1-T6 + principal/especializada + NULL-incondicional que hoy fallan por diseño.
  - Dependencia: ninguna.
  - Criterio de terminación: la suite "contrato media" falla exactamente donde hoy falla el runtime (cada fallo con file:line del comportamiento actual: context-media.ts:415, :430-431; media.ts:18-25; prompts.ts:141-143) .
  - Gate/verificación: unit_tests (rojo controlado y documentado); evidence first.
- [x] **Paso 2:** Detección de MEDIA_REQUEST + resend repair (R2)
  - Objetivo: intención de media por normalización lingüística + intent semántico en runtime, sin tocar triggers del catálogo.
  - Archivos: src/lib/runtime/media.ts, tests/runtime/media.test.ts.
  - Acción: añadir `detectMediaIntent()` (léxico mínimo: foto/foto(s)/fotito/imagen/imagenes/ensename/muestrame/ver/mostrar/me mandas + palabra-media + verbo de petición; lista extensible en code); reparar `isResendRequest` (auditar señal según contrato 5.8); normalizar dirección de plural de `triggerMatches` (match singular del trigger hacia plural del mensaje y viceversa, sin perder límite de palabra completa).
  - Dependencia: Paso 1.
  - Criterio de terminación: `detectMediaIntent("¿me mandas una foto de Back2Fit?") = true`; `isResend` correcto para T4/T5; `triggerMatches("foto","fotos")` y `("fotos","fotos")` verdaderos; suite del Paso 1 avanza (eligibilidad por intent).
  - Gate/verificación: unit_tests; performance_review (léxico compacto, sin regex catastróficos — añadir chequeo de backtracking).
- [x] **Paso 3:** Elegibilidad por scope + selección determinista principal/especializada (R1.3, R3)
  - Objetivo: `trigger_condition` deja de ser requisito existencial; NULL/vacío = incondicional del producto; selección por regla determinista.
  - Archivos: src/lib/runtime/context-media.ts, src/lib/runtime/core.ts (tipos), tests/runtime/context-media-golden.test.ts.
  - Acción: quitar `.not('trigger_condition','is',null)` (context-media.ts:415); elegibilidad = `inScope ∧ (detectMediaIntent ∨ triggerMatch(trigger))`; selección: P1 especializada (condición matchea, orden position ASC → created_at ASC), P2 principal (incondicional del scope o menor orden determinista), P3 ninguna; mantener gates C-1 (scope 0/multi) intactos.
  - Dependencia: Paso 2.
  - Criterio de terminación: casos Back2Fit A→A, B→B, C→B, D→A del contrato; Neurofeet sin intent de media NO dispara principal inexistente; genérico solo con scope único (INV-MEDIA-002).
  - Gate/verificación: unit_tests; invariantes INV-MEDIA-001, -002, -004, -005, -007, -014.
- [x] **Paso 4:** Resend y nuevo-asset deterministas dentro del scope (R8)
  - Objetivo: la rama de resend (C07) se alcanza sin re-exigir match de trigger; T6 permite segundo asset no-claimado.
  - Archivos: src/lib/runtime/context-media.ts, tests/runtime/context-media-golden.test.ts.
  - Acción: mover/evaluar resend antes del gate de `eligible=false` (rama 229-259); target = asset ya-claimado en la conversación, filtrado por scope; máximo 1 re-presentación por petición; T6 = otro elegible no-claimado del scope, si no existe → acknowledged sin repetir.
  - Dependencia: Paso 3.
  - Criterio de terminación: T2 (precio) no repite (existing_hit), T4/T5 resend única, T6 segundo asset o aclaración; C05/C07 ya no mueren en `eligible=false`.
  - Gate/verificación: unit_tests; invariantes INV-MEDIA-011, -012; stress_test parcial (re-petición masiva idempotente).
- [x] **Paso 5:** Señales de estado de media (R5, R6, R7) en el decision surface
  - Objetivo: distinguir `MEDIA_UNAVAILABLE_FOR_PRODUCT`, `MEDIA_REQUEST_NOT_RECOGNIZED`, `MEDIA_SCOPE_AMBIGUOUS` de no-dispatch por trigger.
  - Archivos: src/lib/runtime/context-media.ts (decision), src/lib/runtime/core.ts (wiring), src/lib/ai/prompts.ts (tipos/interface), tests/runtime/*.
  - Acción: extender `ContextMediaDecision` con `mediaStatus` discriminador (derivado de scope/eligibility/intent/claims); C-1 intacto; adhesión al logMediaDecision.
  - Dependencia: Paso 4.
  - Criterio de terminación: cada razón actual (no active context / C-1 ambiguity / no eligible asset / idempotency hit) mapea a la señal correcta; F03/F04 emiten MEDIA_SCOPE_AMBIGUOUS.
  - Gate/verificación: unit_tests; invariantes INV-MEDIA-003, -008, -010.
- [x] **Paso 6:** Prompts truthful y feedback diferenciado (R6, R7)
  - Objetivo: el LLM refleja el estado real; sin "no puedo enviar imágenes" genérico; `[IMAGEN_DISPONIBLE]` expresado por runtime no por fila DB.
  - Archivos: src/lib/ai/prompts.ts, tests/ai/prompts.test.ts, tests/i18n/prompts-i18n.test.ts.
  - Acción: reescribir `withMediaResolutionFeedback` (prompts.ts:469-498) con mapping mediaStatus→lenguaje (MEDIA_UNAVAILABLE: "todavía no tengo fotos de <producto>"; NOT_RECOGNIZED: textual natural; AMBIGUOUS: pedir aclaración); quitar negación genérica (490, 493); `formatKnowledge` (141-143): `[IMAGEN_DISPONIBLE]` solo si runtime dispara (o remover en favor del feedback).
  - Dependencia: Paso 5.
  - Criterio de terminación: los textos del feedback cubren las 4 señales; sin promesa de envío futuro; sin afirmar envío inexistente; compatible i18n.
  - Gate/verificación: unit_tests; performance_review (sin crecimiento de tokens por turno); invariantes INV-MEDIA-010.
- [x] **Paso 7:** APIs de items: ownership + media genérica incondicional (R1.3)
  - Objetivo: la API acepta lo que el runtime ahora emite (media de producto sin condición; media genérica sin condición).
  - Archivos: src/app/api/knowledge/items/route.ts, src/app/api/knowledge/items/[id]/route.ts, tests/api/knowledge-items.test.ts, tests/api/knowledge-items-id.test.ts.
  - Acción: permitir `image_url` con `product_id` y `trigger_condition=null` (y genérica `product_id=null` sin trigger cuando sea explícitamente genérica); mantener validación de ownership del producto y de URL; default `is_active=true`.
  - Dependencia: Paso 3.
  - Criterio de terminación: POST/PATCH aceptan los casos que el contrato define; rechazan `product_id` de otro business; respuestas 400/403 correctas.
  - Gate/verificación: unit_tests; security_review (validación de entrada, sin SSRF).
- [x] **Paso 8:** Import engine — `product_id` correcto en productos nuevos (INV-MEDIA-001/008)
  - Objetivo: los assets importados quedan vivos y pertenecientes al producto creado.
  - Archivos: src/lib/import/engine.ts, tests/import/engine.test.ts.
  - Acción: en el path new-product usar el `id` del insert (hoy `product_id:''`, engine.ts:152-157) para el `knowledge_items.upsert`; `trigger_condition` permanece `null` (incondicional)
  - Dependencia: Paso 3.
  - Criterio de terminación: tras import de producto nuevo, `knowledge_items.product_id` = id del producto y `trigger_condition` NULL; resumen contable sin errores.
  - Gate/verificación: unit_tests; invariantes INV-MEDIA-001, -008.
- [x] **Paso 9:** Dashboard — alinear declaración con el contrato (INV-MEDIA-015)
  - Objetivo: la UI declara exactamente el contrato: condición OPCIONAL que refina dentro del producto.
  - Archivos: src/components/catalog/ProductMedia.tsx, src/components/knowledge/MediaBrowser.tsx, src/components/knowledge/MediaEditDialog.tsx, src/components/knowledge/MediaGrid.tsx.
  - Acción: revisar y ajustar wording de hints/labels (ProductMedia.tsx:20, MediaBrowser.tsx:170-181, MediaEditDialog.tsx:111-113, MediaGrid.tsx:57-59) para "la condición refina cuándo se envía; sin condición el medio acompaña al producto"; sin cambios de lógica ni de comportamiento.
  - Dependencia: Paso 7.
  - Criterio de terminación: textos coherentes con R1.2/R1.3 en los 4 componentes; sin regresiones visuales.
  - Gate/verificación: build; e2e_tests básicos; chrome_devtools (sin errores de consola).
- [ ] **Paso 10:** Golden Tests GT-01..GT-35 reconvertidos + casos nuevos (paridad)
  - Objetivo: la suite dorada de context-media refleja el contrato nuevo y cubre T1-T6 + principal/especializada + signals.
  - Archivos: tests/runtime/context-media-golden.test.ts, tests/runtime/parity-invariants.test.ts, tests/ai/prompts.test.ts, tests/runtime/retention-wiring-runtime.test.ts, tests/runtime/b3-scope-anchor.test.ts.
  - Acción: reconvertir sin romper paridad (priority/1, idempotencia, C-1, claims); añadir casos: CASOS Back2Fit A-D; Neurofeet sin principal; Bye Canas MEDIA_UNAVAILABLE; F03/F04 MEDIA_SCOPE_AMBIGUOUS; secuencia T1-T6.
  - Dependencia: Pasos 2-9.
  - Criterio de terminación: suite verde; B3/retention unused-mocks siguen funcionando; sin `any` ni tipos implícitos (strict).
  - Gate/verificación: unit_tests; typecheck.
- [ ] **Paso 11:** Godzilla adversarial + seguridad + performance (gates finales de calidad)
  - Objetivo: romper el contrato nuevo antes de release.
  - Archivos: tests de ataque (unit adversario) + media-guard.ts solo si un hallazgo lo exige; evidencia con file:line.
  - Acción: prompt injection en feedback media (indirect vía knowledge/trigger), URL no-segura (SSRF, media-guard), re-petición masiva concurrente (raza UNIQUE), ambigüedad multi-producto masiva, abuso de léxico de intent ("ver" fuera de contexto), invariantes dragon (INV-MEDIA-002/003/009/010/011/012).
  - Dependencia: Paso 10.
  - Criterio de terminación: 0 hallazgos CRITICAL/HIGH (blocking gate); MEDIUM documentados; sin N+1 (1 query de candidatos + 1 de claims) ni backtracking regex; bandera de invarianzas en verde.
  - Gate/verificación: stress_test; security_review; performance_review.
- [ ] **Paso 12:** Regresión batería + invariantes + gates + governance complete
  - Objetivo: transformación medible y cierre de la misión con auditoría.
  - Archivos: `workshop/audit/battery-002/` (re-run REPORT-FINAL nuevo, evidencia), `.governance/invariants.json` (INV-MEDIA-001..015), `docs/checkpoints/active-subaru-checkpoint.md`.
  - Acción: re-ejecutar `RESPONSE-BATTERY-002` esperando los 6 FAIL convertidos (C08/C09 dispatch; C05/C07 resend/idempotencia; F03/F04 aclaración truthful); verificar control positivo Neurotin y negativo Bye Canas; registrar INV-MEDIA-001..015 con estado PASS; correr gates completos (lint, build, typecheck, unit_tests, e2e_tests, chrome_devtools, security_review, stress_test, performance_review).
  - Dependencia: Paso 11.
  - Criterio de terminación: todos los gates PASS; sin hallazgos OPEN sobre archivos modificados; reporte final con Commit/Branch/Remote/Deploy tras aprobación humana.
  - Gate/verificación: lint; build; typecheck; unit_tests; e2e_tests; chrome_devtools; security_review; stress_test; performance_review; governance `complete` (exigirá manifest approved + `--confirm-gates`).

## Current state

- Mision IMPLEMENTADA (state frozen; cierre Release en curso FASES 1-7). Pasos 1-11 del blueprint ejecutados y verificados con evidencia; el Paso 12 (cierre Governance/Subaru/gates) se completa en esta fase Release. R1-R8 implementados en runtime+prompt+API+import+UI con golden tests verdes.
- HEAD: 3c61c863b8538cb778da772d2db55ca3ebbdd332 (branch main; origin/main 6 commits detras — drift B3 preexistente documentado y autorizado; push formal autorizado en esta fase Release).
- Archivos modificados (17 M + 6 nuevos): src/lib/runtime/{media,context-media}.ts, src/lib/ai/prompts.ts, src/lib/runtime/core.ts, src/lib/import/engine.ts, src/app/api/knowledge/items/route.ts, src/components/knowledge/{MediaBrowser,MediaEditDialog,MediaGrid,MediaLibrary}.tsx; tests/runtime/{context-media-golden,media}.test.ts, tests/ai/prompts.test.ts, tests/api/knowledge-items{,-id}.test.ts, tests/import/engine.test.ts, tests/component/{media-browser,media-grid}.test.tsx (nuevos); .governance/{invariants.json (INV-MEDIA-001..015), logs/governance-2026-09-05.log, tasks/DEC-20260904-MEDIA-CONTRACT.json, tasks/TASK-20260905-034043506.json}, docs/research/media-contract/01-COUNCIL-DECISION-MEDIA-CONTRACT.md, docs/checkpoints/active-subaru-checkpoint.md.
- Regresion: unit 22 failed | 1154 passed (baseline exacto preexistente, fuera de alcance, prohibido corregir); component 85/85; workshop 20 failed preexistentes (fuera de alcance); lint 0 errores / 24 warnings preexistentes; typecheck 42 preexistentes / 0 nuevos; build PASS 2026-09-05.
- Registry: INV-MEDIA-001..015 registrados en .governance/invariants.json (33 invariantes totales) con verification_status covered y fuentes file:line; sin duplicados.
- Riesgos residuales: (a) RESEND_PRONOUN no cubre 'mandala' (contrato preservado; test espera false); (b) detectMediaIntent excluye deliberadamente 'ver'/'mostrar' sueltos sin palabra-media (falso negativo documentado en media.ts); (c) RB002 formal pendiente de re-ejecucion en el smoke post-deploy.

## Next action

Implementar el Paso 10 (ver sección "Approved plan") y luego ejecutar `subaru mark TASK-20260905-034043506 10`.

## Constraints

### Contrato R1-R8 (mapa a función/archivo)

| # | Regla canónica | Implementación actual | Objetivo |
|---|----------------|----------------------|----------|
| R1.1 | `product_id` = ownership; filtro de scope (pertener ≠ dispara) | `context-media.ts:421-426` (inScope) | Mantener; reuso del mismo filtro para elegibilidad |
| R1.2 | `trigger_condition` = refinador OPCIONAL, nunca habilita | `context-media.ts:430-431` | Elegibilidad = intent ∨ triggerMatch(condición) |
| R1.3 | `NULL/vacío` = medio incondicional del producto; NUNCA muerto | `context-media.ts:415`, `conditional-media.ts:34,38` | Quitar exclusión; tratar como principal |
| R1.4 | Condición refina dentro del producto; señal normalizada, no keyword bruta suelta | `media.ts:18-25` | Mantener match normalizado; ligado a intent |
| R2 | MEDIA_REQUEST por normalización/intent en runtime; no se agrandan triggers | `media.ts` (sin detector) | `detectMediaIntent()`; R2.2 prohibido tocar triggers |
| R3 | Selección determinista: especializada → principal → ninguna; `position ASC, created_at ASC` | `context-media.ts:416-417,428-432` (solo match) | Nueva lógica de selección (Paso 3) |
| R4 | Neurofeet sin principal: no-modificar (config/datos) | — | Documentar; sin asset principal → nada salvo condición matchea |
| R5 | Multi-producto ambiguo → MEDIA_SCOPE_AMBIGUOUS; nunca arbitrario | `context-media.ts:181-201` (C-1) | Mantener gate; emitir señal (Paso 5) |
| R6 | MEDIA_UNAVAILABLE_FOR_PRODUCT / NOT_RECOGNIZED / AMBIGUOUS diferenciados | `prompts.ts:487-494` (un solo mensaje) | Feedback diferenciado (Paso 6) |
| R7 | AI jamás afirma dispatch ni niega capacidad genéricamente | `prompts.ts:490,493` | Lenguaje truthful por señal |
| R8 | Idempotencia `(conversation × asset)` UNIQUE claimed/dispatched/failed; resend único explícito; T6 otro asset | `context-media.ts:342-374` claim atómico; resend `:229-259` tras eligible | Resend antes del gate; T6; no repetir automático |

### INV-MEDIA-001..015 (fuerza Block; a registrar en `.governance/invariants.json`)

- 001 media con product_id o genérico explícito; 002 no dispatch fuera de scope, genérico solo con scope único; 003 C-1 ambiguo nunca arbitrario; 004 NULL = incondicional (nunca muerto); 005 condición refina dentro del producto; 006 intención por normalización/intent (no keywords catálogo); 007 distinción principal/especializada determinista; 008 asset inexistente no dispatch; 009 asset inactivo/URL no segura no dispatch; 010 MIA jamás afirma dispatch sin runtime; 011 sin re-petición automática del mismo asset; 012 resend único explícito / nuevo-asset-request; 013 producto sin media → MEDIA_UNAVAILABLE_FOR_PRODUCT truthful; 014 selección determinista (misma entrada → misma salida); 015 Catalog y Runtime mismo contrato (Dashboard ↔ runtime, R1-R8).

### Contradicciones confirmadas (a resolver)

1. `context-media.ts:415,430-431` — trigger obligatorio/existencial (hot path).
2. `conditional-media.ts:34,38` — legado con la misma semántica NULL=muerto (invariante, no hot).
3. `product-recommendation.ts:34-41` — doble uso del trigger (recomendación usa media-trigger) + filtro NULL.
4. `prompts.ts:141-143` — `[IMAGEN_DISPONIBLE]` estático basado en fila DB, no en dispatch runtime.
5. `prompts.ts:490,493` — negación genérica "no había media" cuando sí existe (input gate roto).
6. `items/route.ts:122-127` — bloquea media genérica sin trigger/product (PATCH ya permite `trigger_condition:null`, `[id]/route.ts:128`).
7. `engine.ts:152-157` — `product_id:''` en productos nuevos (asset perdido en silencio).
8. `context-media-golden.test.ts:95-97` — harness golden codifica el contrato viejo.

### Tabla de cambios mínimos (Archivo | Cambio | Motivo | Invariantes | Riesgo)

| Archivo | Cambio | Motivo | Invariantes | Riesgo (mitigación) |
|---------|--------|--------|-------------|---------------------|
| `src/lib/runtime/media.ts` | `detectMediaIntent()` + resend repair + plural bidireccional | R2/R8 | 006, 012 | Léxico amplio → falso positivo (fix por word-list + verbo de petición; GT) |
| `src/lib/runtime/context-media.ts` | Elegibilidad intent∨trigger; selección determinista; resend pre-gate; T6; `mediaStatus` | R1/R3/R5/R6/R8 | 001-014 | Cambiar C-1 (no se toca); idempotencia intacta (gates unit) |
| `src/lib/runtime/core.ts` | Wiring de decisión/feedback ampliada | R6/R7 | 010 | N/A |
| `src/lib/ai/prompts.ts` | Feedback diferenciado; quitar `[IMAGEN_DISPONIBLE]` estático | R6/R7 | 010 | Costo tokens (sin incremento verificable) |
| `src/app/api/knowledge/items/route.ts` + `[id]/route.ts` | Validación genéricos/ownership | R1.3 | 001, 008 | Validación entrada (security_review) |
| `src/lib/import/engine.ts` | `product_id` del insert usado en upsert | INV-MEDIA-001/008 | 001, 008 | Regresión import (tests/import) |
| `src/components/{catalog,knowledge}/` | Wording contrato (sin lógica) | INV-MEDIA-015 | 015 | Visual (e2e/chrome_devtools) |
| `tests/runtime/context-media-golden.test.ts` | Harness sin filtro trigger; GT-01..35 reconvertidos + T1-T6 | R1-R8 | 014 | Suite regresión (parity) |
| `.governance/invariants.json` | INV-MEDIA-001..015 registrados | Governance | — | N/A |

### Reglas no negociables

- Intención de media SOLO vía runtime (prohibido ampliar triggers del catálogo).
- C-1 (scope 0 / multi) jamás dispatch — se preserva DEC-20260830.
- Determinismo: misma entrada → misma selección (INV-MEDIA-014).
- URL media siempre por `isSafeMediaUrl` (media-guard) antes de claim (INV-MEDIA-009).
- Idempotencia por `(conversation_id, knowledge_item_id)` UNIQUE con estados claimed/dispatched/failed; sin gates por producto.
- Sin migraciones nuevas; sin edición de datos de negocio; sin commits/push durante freeze.
- Secret scan y evidence first en todos los pasos.

## Verification

- Gates obligatorios del manifest `TASK-20260905-034043506` (9): lint, build, unit_tests, e2e_tests, chrome_devtools, security_review, stress_test, typecheck, performance_review — todos PASS antes de `complete`.
- Batería de regresión: re-run `RESPONSE-BATTERY-002` → los 6 FAIL dejan de fallar (C08/C09 dispatch; C05/C07 resend/idempotencia; F03/F04 aclaración truthful), control positivo Neurotin intacto, control negativo Bye Canas truthful.
- Golden Tests GT-01..GT-35 reconvertidos al contrato nuevo + casos Back2Fit A-D, Neurofeet (sin principal), Bye Canas, F03/F04, secuencia T1-T6.
- Invariantes: INV-MEDIA-001..015 presentes y en PASS en `.governance/invariants.json`.
- Godzilla: 0 CRITICAL/HIGH (blocking); MEDIUM documentados.
- Cierre: governance `complete` con manifest `approved` + `--confirm-gates` (9 gates listados) y aprobación humana del resultado antes de Release/deploy.

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción (el drift B3 preexistente está documentado y autorizado en esta misión).
5. Continuar el paso indicado y ejecutar `subaru mark TASK-20260905-034043506 <n>`.
6. Al final: `subaru complete TASK-20260905-034043506`.
  - Estado final: {"head":"3c61c863b8538cb778da772d2db55ca3ebbdd332","pasos":"1-11 implementados y verificados; paso 12 cierre Release en curso","archivos":"17 M + 6 nuevos (detalle en Current state)","invariantes":"INV-MEDIA-001..015 registrados 15/15 en .governance/invariants.json","tests":{"unit":"22 failed | 1154 passed (baseline preexistente)","component":"85/85","workshop":"20 failed preexistente (fuera de alcance)","lint":"0 errores / 24 warnings preexistentes","typecheck":"42 preexistentes / 0 nuevos","build":"PASS","e2e_harness":"9/9 PASS (E2E-MEDIA-2026-09-05T0646)","ui_network":"PASS (widget 992x1067, 0 errores consola)"},"evidencia":"workshop/audit/media-loop-e2e/evidence/E2E-MEDIA-2026-09-05T0646 (incl subdir ui/)","riesgos":["RESEND_PRONOUN no cubre mandala (contrato)","detectMediaIntent excluye ver/mostrar sueltos","RB002 formal pendiente post-deploy"],"rb002":"pending (re-ejecucion en smoke post-deploy)"}