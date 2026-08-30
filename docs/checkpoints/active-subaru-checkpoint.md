---
task_id: TASK-20260830-PARITY-E2
title: MIA Parity Etapa 2 UNIFICAR: fixes quirurjicos C1/B1/B1b/P1 + parity tests
state: blocked
current_step: 8
total_steps: 8
branch: main
last_machine: Deivis-Desktop
governance_id: TASK-20260830-025948794
created: 2026-08-23T10:28:37.146Z
updated: 2026-08-30T04:03:57.439Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

MIA Parity Etapa 2 UNIFICAR: fixes quirurjicos C1/B1/B1b/P1 + parity tests

Aprobación: TASK-20260830-025948794.

## Scope

Archivos: src/lib/runtime/runtime.ts, src/lib/runtime/conditional-media.ts, src/lib/sales/events.ts, src/lib/sales/process.ts, tests/runtime/conditional-media.test.ts, tests/sales/events.test.ts, tests nuevos de parity. Dominio: sales + runtime + AI context.

## Non-goals

- (qué NO tocar — completar)

## Approved plan

Pasos atómicos aprobados por el Council:

- [x] **Paso 1:** (objetivo del paso 1 — completar antes de implementar)
  - Objetivo: Fix C1 transcript: cambiar .order(created_at asc).limit(N) -> desc.limit(N)+reverse en 3 call-sites para que detectores reciban tail RECIENTE
  - Archivos: src/lib/runtime/runtime.ts (~70-86, ~371-378), src/lib/sales/process.ts (~260-267)
  - Acción: processStreaming (runtime.ts:70-86): .order('created_at',{ascending:false}).limit(30).then(reverse) antes de [...past, ...messages]. processIncomingMessage (runtime.ts:371-378): .order(desc).limit(20).then(reverse). process.ts second cancel attempt (260-267): .order(desc).limit(20).then(reverse)
  - Dependencia: ninguna
  - Criterio de terminación: 3 call-sites leen N mas recientes. Test con 25+ mensajes verifica tail verdadero (incluida ultima intervencion).
  - Gate/verificación: unit transcript tail reciente + lint + build

- [x] **Paso 2:** (objetivo del paso 2 — completar antes de implementar)
  - Objetivo: Fix B1 media invariant: eliminar fallback arbitrario pending[0] que selecciona media de OTRO producto
  - Archivos: src/lib/runtime/conditional-media.ts (~28-34, ~66-70)
  - Acción: Anadir .order('created_at',{ascending:true}) a query candidatos. Seleccion: const selected = productId ? (pending.find(i=>i.product_id===productId) ?? null) : (pending.find(i=>i.product_id===null) ?? null); nunca pending[0] de otro producto si productId null y no generico.
  - Dependencia: paso 1
  - Criterio de terminación: productId null y SOLO items de otros productos en pending => null. Test 'uses generic media when no product context' sigue verde.
  - Gate/verificación: unit nuevo: producto ambiguo NUNCA despacha media de otro producto + lint + build

- [x] **Paso 3:** (objetivo del paso 3 — completar antes de implementar)
  - Objetivo: Fix B1b eventos: emitSalesEvent usa selected_product.id canonico en lugar de re-resolver por texto libre when caller tiene producto
  - Archivos: src/lib/sales/events.ts (emitSalesEvent ~37-43)
  - Acción: Anadir parametro opcional productId a emitSalesEvent. Si se provee, usarlo sin query ilike('name'). Mantener fallback por nombre.
  - Dependencia: paso 1
  - Criterio de terminación: caller con productId canonico genera evento con ese id exacto sin query por texto. Test resolucion por nombre sigue verde.
  - Gate/verificación: unit nuevo: evento con productId canonico no re-resuelve por texto + lint + build

- [x] **Paso 4:** (objetivo del paso 4 — completar antes de implementar)
  - Objetivo: Pasar selected_product.id canonico en callers de emitSalesEvent (processSaleClosing) y runtime para que eventos y media usen mismo producto
  - Archivos: src/lib/sales/process.ts (emitSalesEvent en processSaleClosing), src/lib/runtime/runtime.ts
  - Acción: En processSaleClosing, cuando detectSaleOutcome devuelve eventos, resolver selected_product.id canonico y pasarlo a emitSalesEvent (nuevo param). Producto del evento coincide con producto usado para media.
  - Dependencia: paso 3
  - Criterio de terminación: Eventos SALE_*/PRODUCT_SELECTED de processSaleClosing llevan product_id canonico cuando disponible.
  - Gate/verificación: unit: evento SALE_WON con producto canonico + lint + build

- [x] **Paso 5:** (objetivo del paso 5 — completar antes de implementar)
  - Objetivo: Fix P1 guards cancelacion en todos canales: processStreaming (Simulator+Web) carga y pasa cancellationContext/lastCancelledOrder/userIntent
  - Archivos: src/lib/runtime/runtime.ts (processStreaming)
  - Acción: Cargar cancellationContext/lastCancelledOrder/userIntent en processStreaming (patron de processIncomingMessage ~197-303) cuando hay customerId y pasarlos a loadConversationContext (args 8-10).
  - Dependencia: paso 4
  - Criterio de terminación: processStreaming pasa 10 args. Guards cancelacion/RETENTION_PENDING en systemPrompt de Simulator y Web. Simulator no degradado.
  - Gate/verificación: test: guards en streaming con ctx cancelacion + lint + build

- [x] **Paso 6:** (objetivo del paso 6 — completar antes de implementar)
  - Objetivo: Parity tests: invariantes core (media y transcript) y escenarios cruzados
  - Archivos: tests/runtime/conditional-media.test.ts, tests/runtime/process-streaming.test.ts, tests/runtime/process-incoming-message.test.ts, tests/sales/events.test.ts, tests/integration/cancellation-state-machine.test.ts, tests nuevos parity
  - Acción: Tests: (1) media.product_id===selected_product.id; (2) producto ambiguo/parcial nunca cruza a media de otro producto; (3) transcript 25+ mensajes tail reciente; (4) eventos producto canonico; (5) cancelacion 2do intento >20 msg detecta tail; (6) post-SALE_WON no reconfirma; (7) RETENTION_PENDING guard en streaming; (8) prompt injection baseline.
  - Dependencia: pasos 1-5
  - Criterio de terminación: Todos tests unitarios nuevos verdes. Invariantes MEDIA y TRANSCRIPT cubiertos por >=1 test.
  - Gate/verificación: unit tests green + lint + build

- [x] **Paso 7:** (objetivo del paso 7 — completar antes de implementar)
  - Objetivo: Godzilla adversarial review de archivos modificados (re-ejecutar vectores fallidos)
  - Archivos: Todos los archivos modificados pasos 1-6
  - Acción: Reproducir: producto ambiguo con media de otro producto, cancelacion >20 msg, post-SALE_WON, RETENTION_PENDING, media_url insegura, producto parcial, evento producto canonico/null.
  - Dependencia: paso 6
  - Criterio de terminación: Ningun CRITICAL/HIGH en archivos modificados. MEDIUM documentados. Reporte adjunto.
  - Gate/verificación: godzilla review sin bloqueo

- [x] **Paso 8:** (objetivo del paso 8 — completar antes de implementar)
  - Objetivo: Gates finales Etapa 2: lint + build + unit verdes y reporte de terminacion
  - Archivos: Repositorio (verificacion), reporte terminacion Etapa 2
  - Acción: npm run lint (0/0), npm run build (sin errores), unit tests invariantes. Registrar evidencia y redactar reporte terminacion Etapa 2.
  - Dependencia: pasos 1-7
  - Criterio de terminación: lint/build/unit verdes con evidencia. Reporte Etapa 2 listo.
  - Gate/verificación: lint + build + unit green


## Current state

- Misión TASK-20260830-PARITY-E2 BLOQUEADA (state: blocked).
- Motivo: Etapa 2 certificada; cierre a BLOCKED por deuda documentada: (1) D-DECISION-1 processStreaming no ejecuta processSaleClosing (Q1-C: parity sin 2da llamada AI, se resuelve en nueva mision Shared Core), (2) D-MEDIA-1 WhatsApp sin isResend (Fase 3 planeada), (3) scratch classic-build roto fuera de scope (Q2-C). Next: mision MIA Shared Core Fase 0/1..
- Bloqueado: 2026-08-30T04:03:57.439Z.

## Next action

Todos los pasos marcados. Ejecutar `subaru complete TASK-20260830-PARITY-E2` cuando pasen los gates de verificación.

## Constraints

Fixes quirurjicos primero, refactor core despues (gob. aparte). MEDIA_INVARIANT media.product_id===selected_product.id: NUNCA fallback arbitrario pending[0] de otro producto. TRANSCRIPT_INVARIANT: tail reciente obligatorio (.order desc + reverse). Eventos usan producto canonico, no texto libre si ya hay selected_product.id. Guards 2392b4f/8bd9667/f755edf/ab52681 no rompen. Multi-tenant/RLS (admin para writes). TypeScript estricto sin any.

## Verification

Gates obligatorios (TASK-20260830-025948794): lint, build, unit_tests, e2e_tests, chrome_devtools, security_review, stress_test. Etapa 2: lint+build+unit garantizados; E2E produccion/dervivados = Etapa 3 (STOP_FOR_HUMAN antes). Evidencia por paso: npm run lint (0/0), npm run build (sin errores), unit tests invariantes verdes.

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción.
5. Continuar el paso indicado y ejecutar `subaru mark TASK-20260830-PARITY-E2 <n>`.
6. Al final: `subaru complete TASK-20260830-PARITY-E2`.
