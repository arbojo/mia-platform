---
task_id: TASK-20260830-0363673
title: Shared MIA Core Fase 0: Contract + Wrapper + Adapter Delegation
state: in_progress
current_step: 1
total_steps: 4
branch: main
last_machine: archlinux
governance_id: TASK-20260830-0363673
created: 2026-08-31T00:06:33.347Z
updated: 2026-08-31T00:08:50.871Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Shared MIA Core Fase 0: Contract + Wrapper + Adapter Delegation

Aprobación: TASK-20260830-0363673.

## Scope

Archivos: src/lib/runtime/core.ts (CREAR), src/lib/runtime/core.test.ts (CREAR), src/lib/channels/types.ts (MODIFICAR), src/lib/runtime/runtime.ts (MODIFICAR). Dominio: platform (runtime + channels). Sin cambios de DB, sin deploy.

## Non-goals

- NO implementar Fase 1 (sale closing en streaming, MEDIUM-1 atribución por-evento)
- NO modificar processSaleClosing
- NO agregar processSaleClosing al Core
- NO cambiar comportamiento visible
- NO tocar DB ni migraciones
- NO deploy a Vercel

## Approved plan

Pasos atómicos aprobados por el Council:

- [x] **Paso 1:** Crear contrato CoreInput/CoreOutput en types.ts
  - Objetivo: Definir las interfaces CoreInput y CoreOutput en channels/types.ts
  - Archivos: src/lib/channels/types.ts
  - Acción: Agregar interfaces CoreInput y CoreOutput al final del archivo. CoreInput contiene businessId, assistantId, customerId, conversationId, userMessage, userPayload, channel, intentTag, landingContext, mode, requestType, preResolvedProductId. CoreOutput contiene response, textStream, product, media, interactive, metadata.
  - Dependencia: ninguna
  - Criterio de terminación: Interfaces CoreInput y CoreOutput exportadas correctamente. TypeScript compila sin errores.
  - Gate/verificación: typecheck pass

- [ ] **Paso 2:** Crear processCore wrapper en core.ts
  - Objetivo: Crear src/lib/runtime/core.ts con la función processCore que delega a la lógica existente
  - Archivos: src/lib/runtime/core.ts (CREAR)
  - Acción: Crear core.ts con processCore(input: CoreInput): Promise<CoreOutput>. La función debe: (1) resolver cancellationGuards, (2) loadConversationContext, (3) loadTranscript con toChronologicalTranscript, (4) resolveRecommendedProduct, (5) resolveConditionalMedia, (6) executeAI, (7) persistMessages, (8) extractEvidence. Cada paso delega a las funciones existentes de runtime.ts. NO agregar processSaleClosing (eso es Fase 1).
  - Dependencia: paso 1
  - Criterio de terminación: core.ts creado con processCore que compila. Todas las llamadas delegan a funciones existentes. Sin lógica nueva.
  - Gate/verificación: typecheck pass + build pass

- [ ] **Paso 3:** Delegar processStreaming e processIncomingMessage a processCore
  - Objetivo: Modificar runtime.ts para que processStreaming e processIncomingMessage creen CoreInput y llamen a processCore
  - Archivos: src/lib/runtime/runtime.ts
  - Acción: En processStreaming: construir CoreInput desde los params, llamar processCore(input), transformar CoreOutput a ProcessStreamingResult. En processIncomingMessage: construir CoreInput desde wireMessage/adapter, llamar processCore(input), transformar CoreOutput a el objeto de retorno actual. Mantener la misma lógica de delivery/shadow/interactive en los adapters.
  - Dependencia: paso 2
  - Criterio de terminación: processStreaming e processIncomingMessage delegan a processCore. Todos los tests existentes pasan (62 PARITY-E2 + unit). Sin cambio de comportamiento.
  - Gate/verificación: lint + build + unit tests

- [ ] **Paso 4:** Tests del contrato + gates finales
  - Objetivo: Crear tests del contrato CoreInput/CoreOutput y ejecutar gates de calidad
  - Archivos: src/lib/runtime/core.test.ts (CREAR), repositorio (verificación)
  - Acción: Crear core.test.ts con tests: (1) processCore produce CoreOutput válido, (2) processCore con mode=stream produce textStream, (3) processCore con mode=complete produce response string, (4) processCore maneja zero-state gracefully. Ejecutar lint (0/0), build (sin errores), unit tests (62+ nuevos verdes).
  - Dependencia: paso 3
  - Criterio de terminación: Tests del contrato verdes. Lint/build/unit todos verdes. Evidencia documentada.
  - Gate/verificación: lint + build + unit tests

## Current state

- Misión congelada (state: frozen). Pasos pendientes: 1..4.

## Next action

Implementar el Paso 2 (ver sección "Approved plan") y luego ejecutar `subaru mark TASK-20260830-0363673 2`.

## Constraints

- Fase 0 es un wrapper puro: NO cambia comportamiento
- NO agregar processSaleClosing al Core (eso es Fase 1)
- NO modificar processSaleClosing
- Atomic commit separado de Fase 1 (condición CTO)
- TypeScript estricto sin any
- Seguir convenciones existentes del codebase
- Reutilizar funciones existentes, no duplicar lógica
- Multi-tenant/RLS (admin para writes)

## Verification

Gates Fase 0 (TASK-20260830-0363673):
- lint: npm run lint (0 errors, 0 warnings)
- build: npm run build (sin errores)
- unit_tests: npm run test (62 tests PARITY-E2 + nuevos tests)
- EVIDENCIA: cada gate con output capturado

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción.
5. Continuar el paso indicado y ejecutar `subaru mark TASK-20260830-0363673 <n>`.
6. Al final: `subaru complete TASK-20260830-0363673`.
