---
task_id: ER-V1
title: Evidence Reasoning Architecture (Option B)
state: in_progress
current_step: 10
total_steps: 12
branch: main
last_machine: archlinux
governance_id: TASK-20260825-EVIDENCE-REASONING
created: 2026-08-23T10:28:37.146Z
updated: 2026-08-25T18:46:27.735Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Implementar la arquitectura Evidence Reasoning (Option B) para MIA: extracción de evidencia, cómputo de estado multidimensional del cliente, e inyección de estado en el prompt del LLM.

Aprobación: TASK-20260825-EVIDENCE-REASONING.

## Scope

src/lib/reasoning/evidence.ts, src/lib/reasoning/state.ts, src/lib/reasoning/prompt-enricher.ts, src/lib/ai/customer-memory.ts (extensión), src/lib/runtime/runtime.ts (integración), src/lib/ai/prompts.ts (integración), src/lib/conversation/context.ts (integración), tests/

## Non-goals

NO: CRM redesign, Knowledge redesign, Catalog redesign, Memory redesign, Graph database, Autonomous learning, Cross-tenant analytics, Sales engine changes, Schema migration, New DB tables, Code-level action selection, Formal hypothesis objects, Bayesian inference, Reinforcement learning

## Approved plan

Pasos atómicos aprobados por el Council:

- [x] **Paso 1:** (objetivo del paso 1 — completar antes de implementar)
  - Objetivo: Crear src/lib/reasoning/evidence.ts con tipos y función de extracción de evidencia LLM
  - Archivos: src/lib/reasoning/evidence.ts (nuevo)
  - Acción: Definir tipos Evidence, EvidenceType, EvidenceProvenance. Implementar extractEvidence() que llama a gpt-4o-mini para extraer evidencia del mensaje del cliente. Provenance: message_id, conversation_id, customer_id, timestamp, extraction_method.
  - Dependencia: ninguna
  - Criterio de terminación: extractEvidence() retorna Evidence[] válidos con provenance completa
  - Gate/verificación: unit_tests

- [x] **Paso 2:** (objetivo del paso 2 — completar antes de implementar)
  - Objetivo: Crear src/lib/reasoning/state.ts con cómputo de estado multidimensional
  - Archivos: src/lib/reasoning/state.ts (nuevo)
  - Acción: Definir tipos CustomerState (interest, trust, readiness, clarity, engagement: 0.0–1.0). Implementar computeState() con momentum 0.7/0.3, time decay configurable por tipo, y累积 de evidencia.
  - Dependencia: Paso 1 (necesita tipo Evidence)
  - Criterio de terminación: computeState() retorna CustomerState con todos los rangos 0.0–1.0
  - Gate/verificación: unit_tests

- [x] **Paso 3:** (objetivo del paso 3 — completar antes de implementar)
  - Objetivo: Crear src/lib/reasoning/prompt-enricher.ts con inyección de estado en prompt
  - Archivos: src/lib/reasoning/prompt-enricher.ts (nuevo)
  - Acción: Implementar buildStateSection() que serializa CustomerState a texto legible para el LLM. Implementar buildActionGuidance() que genera recomendaciones de acción basadas en el estado (CLOSE condicional, push prevention, uncertainty zone).
  - Dependencia: Paso 2 (necesita tipo CustomerState)
  - Criterio de terminación: buildStateSection() produce texto válido y buildActionGuidance() incluye lógica CLOSE gate
  - Gate/verificación: unit_tests

- [x] **Paso 4:** (objetivo del paso 4 — completar antes de implementar)
  - Objetivo: Extender interfaz CustomerMemory con campo evidence en customer-memory.ts
  - Archivos: src/lib/ai/customer-memory.ts (modificación mínima)
  - Acción: Agregar campo evidence?: Evidence[] a la interfaz CustomerMemory. Extender formatCustomerMemoryForPrompt() para incluir estado si existe.
  - Dependencia: Paso 1 (necesita tipo Evidence)
  - Criterio de terminación: CustomerMemory tiene campo evidence, format incluye estado
  - Gate/verificación: unit_tests

- [x] **Paso 5:** (objetivo del paso 5 — completar antes de implementar)
  - Objetivo: Integrar extracción de evidencia en el pipeline de runtime.ts
  - Archivos: src/lib/runtime/runtime.ts (integración)
  - Acción: En el pipeline de mensajes, después de recibir la respuesta del LLM, llamar extractEvidence() con el mensaje del cliente. Acumular evidencia en customer memory.
  - Dependencia: Paso 1 y Paso 4
  - Criterio de terminación: Evidence se extrae de cada mensaje del cliente en el pipeline
  - Gate/verificación: unit_tests

- [x] **Paso 6:** (objetivo del paso 6 — completar antes de implementar)
  - Objetivo: Integrar inyección de estado en el prompt builder
  - Archivos: src/lib/ai/prompts.ts (integración)
  - Acción: En buildMasterPrompt(), si hay customerState disponible, inyectar sección de estado y guidance de acción antes de la sección de instrucciones.
  - Dependencia: Paso 3
  - Criterio de terminación: El prompt del LLM contiene sección de estado cuando hay evidencia acumulada
  - Gate/verificación: unit_tests

- [x] **Paso 7:** (objetivo del paso 7 — completar antes de implementar)
  - Objetivo: Conectar state computation en context.ts con customer memory
  - Archivos: src/lib/conversation/context.ts (integración)
  - Acción: En loadConversationContext(), después de obtener customerMemory, llamar computeState() con la evidencia acumulada. Pasar resultado a buildMasterPrompt().
  - Dependencia: Paso 2, Paso 4, Paso 5
  - Criterio de terminación: El contexto de conversación incluye customerState computado
  - Gate/verificación: unit_tests

- [x] **Paso 8:** (objetivo del paso 8 — completar antes de implementar)
  - Objetivo: Escribir tests de extracción de evidencia
  - Archivos: tests/unit/reasoning/evidence.test.ts (nuevo)
  - Acción: Testear extractEvidence() con mocks de OpenAI. Verificar tipos, provenance, confidence, weight. Testear edge cases: mensaje vacío, multilenguaje, mensajes mixtos.
  - Dependencia: Paso 1
  - Criterio de terminación: Todos los tests de evidence pasan
  - Gate/verificación: unit_tests

- [x] **Paso 9:** (objetivo del paso 9 — completar antes de implementar)
  - Objetivo: Escribir tests de cómputo de estado
  - Archivos: tests/unit/reasoning/state.test.ts (nuevo)
  - Acción: Testear computeState() con diferentes secuencias de evidencia. Verificar momentum 0.7/0.3, time decay, uncertainty zone, gate logic (CLOSE/NO-CLOSE). Testear invariantes INV-ER-001 a INV-ER-010.
  - Dependencia: Paso 2
  - Criterio de terminación: Todos los tests de state pasan, invariantes verificados
  - Gate/verificación: unit_tests

- [x] **Paso 10:** (objetivo del paso 10 — completar antes de implementar)
  - Objetivo: Escribir test de integración del pipeline completo
  - Archivos: tests/integration/evidence-reasoning.test.ts (nuevo)
  - Acción: Testear flujo completo: mensaje → evidence extraction → state computation → prompt injection. Verificar que el prompt contiene la sección de estado. Testear push prevention y CLOSE gate end-to-end.
  - Dependencia: Paso 5, Paso 6, Paso 7
  - Criterio de terminación: Test de integración del pipeline completo pasa
  - Gate/verificación: unit_tests

- [ ] **Paso 11:** (objetivo del paso 11 — completar antes de implementar)
  - Objetivo: Quality gates: lint + build
  - Archivos: todos los archivos modificados
  - Acción: Ejecutar npm run lint (0 errores, 0 warnings) y npm run build (sin errores). Corregir cualquier issue encontrado.
  - Dependencia: Paso 10
  - Criterio de terminación: lint 0 errores, build exitoso
  - Gate/verificación: lint, build

- [ ] **Paso 12:** (objetivo del paso 12 — completar antes de implementar)
  - Objetivo: Verificación adversarial + reporte de terminación
  - Archivos: LOOP_TERMINATION_REPORT.md
  - Acción: Ejecutar tests adversariales Z1-Z10. Producir LOOP_TERMINATION_REPORT.md con: STATUS, GOVERNANCE, FILES MODIFIED, COMMAND ADDED, TESTS, ADVERSARIAL RESULTS, ER-V1 BEFORE/AFTER, CURRENT_STEP, STATE, GIT COMMIT, PUSH RESULT, NEXT AUTHORIZED ACTION.
  - Dependencia: Paso 11
  - Criterio de terminación: Todos los adversarial tests pasan, reporte producido
  - Gate/verificación: stress_test


## Current state

Misión frozen (state: frozen). Pasos pendientes: 1..12.
Blueprint enriquecido con Option B aprobada por el Council.

## Next action

Implementar el Paso 11 (ver sección "Approved plan") y luego ejecutar `subaru mark ER-V1 11`.

## Constraints

10 invariantes INV-ER-001 a INV-ER-010.
CLOSE gate: readiness > 0.7 AND trust > 0.6 AND interest > 0.6.
Push prevention: readiness < 0.5 → no close, no personal data requests; trust < 0.4 → no commitment asks.
Uncertainty zone: all dimensions 0.3–0.7 → trigger exploration.
State momentum: 0.7 new + 0.3 previous.
Evidence time decay: configurable half-life per type.
Provenance mandatory on every evidence item.
Evidence storage: extend customers.memory JSONB — no schema migration.

## Verification

10 tests required: evidence extraction, state computation, time decay, momentum, gate logic, push prevention, prompt injection, integration pipeline, adversarial Z1-Z10, stress test.
Quality gates: lint, build, unit_tests, e2e_tests, chrome_devtools, security_review, stress_test.

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción.
5. Continuar el paso indicado y ejecutar `subaru mark ER-V1 <n>`.
6. Al final: `subaru complete ER-V1`.
