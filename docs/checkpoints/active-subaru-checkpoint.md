---
task_id: subaru-return-by-death-hardening
title: Endurecer protocolo Return-by-Death (Subaru)
state: in_progress
current_step: 3
total_steps: 11
branch: main
last_machine: Deivis-Desktop
governance_id: TASK-20260811-031812147
created: 2026-08-11T03:20:00.000Z
updated: 2026-08-11T03:55:08.085Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Endurecer el protocolo Return-by-Death del agente Subaru para garantizar que una
nueva instancia de OpenCode pueda recuperar una misión desde GitHub (git pull →
revive) y continuarla de forma segura, sin depender de la conversación anterior y
sin continuar silenciosamente ante drift, corrupción o contradicción.

NO es una reescritura: se preservan los comandos CLI (freeze/mark/complete/revive/
status/bootstrap), el frontmatter YAML y el formato de commits (`subaru: checkpoint
<id> - listo|en-progreso|completado|bloqueado`). Es una misión de endurecimiento
aprobada por el Engineering Council (TASK-20260811-031812147).

## Scope

- `workshop/subaru/lib.ts` — helpers de body (scaffold del blueprint, conteo de
  checkboxes, next_action) y reutilización de `WorkflowEngine` para governance.
- `workshop/subaru/cli.ts` — freeze (governance + scaffold), mark (secuencial),
  complete (verificado), revive (drift + informe), refactor testable.
- `workshop/subaru/lib.test.ts` — actualización/ampliación de unit tests.
- `workshop/subaru/cli.test.ts` (NUEVO) — suite de integración sobre repo git temporal.
- `.agents/subaru.md` — documentación del comportamiento endurecido.
- `AGENTS.md` (sección 24) — reflejar validación de governance, mark secuencial,
  complete verificado y revive con drift.
- `docs/MASTER.md` — regenerado vía `npm run docs:generate` (sin edición manual).

## Non-goals

- NO renombrar el estado `blueprint_ready` (cambio A de la auditoría: excluido por
  el Council — conveniente, no necesario).
- NO ampliar `bootstrap` con checks de git/checkpoint (cambio G: excluido).
- NO archivar checkpoints completados en `docs/checkpoints/archive/` (cambio I: excluido).
- NO tocar el sistema de governance (`workshop/governance/*`) salvo reutilizarlo vía
  import. NO tocar la plataforma MIA (src/), NI el código del bridge.
- NO almacenar secretos en el checkpoint (solo referencias a env vars por nombre).
- NO cambiar los comandos CLI ni el formato del frontmatter.

## Approved plan

Pasos atómicos aprobados por el Council (orden estricto):

- [x] **Paso 1:** Governance: clasificar (COMPLEX) + concilio aprobar 8/8
  (TASK-20260811-031812147) + `governance validate` PASSED. Criterio: manifest con
  status `approved`. Gate: governance validate.
- [x] **Paso 2 (SUBARU):** Escribir blueprint + `freeze` + commit `subaru: checkpoint
  subaru-return-by-death-hardening - listo` + push. Criterio: checkpoint en remoto
  (GitHub) con frontmatter y plan atómico. Gate: `git log` + remoto sincronizado.
- [x] **Paso 3 (H):** Refactor testable de la CLI. Exportar handlers con config
  inyectable (`cwd`, `remote`, `checkpointPath`) desde `cli.ts`; agregar en `lib.ts`
  helpers de body: `scaffoldBlueprint` (secciones Mission/Scope/Non-goals/Approved
  plan/Current state/Next action/Constraints/Verification/Recovery instructions con
  pasos `- [ ] **Paso N:**`), `countCheckboxSteps`/`countCheckedSteps`,
  `allStepsChecked`, `readNextAction`. Los comandos CLI y el frontmatter quedan
  idénticos. Criterio: handlers llamables en proceso (tests) sin spawnear tsx.
  Dependencia: Paso 1, 2. Gate: unit_tests.
- [ ] **Paso 4 (B):** `freeze` valida governance: exige `--governance <id>` y llama
  `WorkflowEngine.assertGovernance(id)`; falla con mensaje claro si el id falta o el
  manifest no está aprobado. Criterio: freeze rechazado sin governance aprobado.
  Dependencia: Paso 3. Gate: unit_tests (invalid).
- [ ] **Paso 5 (C+J):** `freeze` scaffold el blueprint si el body está vacío
  (secciones estructurales + pasos `- [ ] **Paso N:**`) y reconcilia `total_steps`
  con los checkboxes reales del body (aviso si `--steps` no coincide; se toma el
  conteo del body y se actualiza el frontmatter). Criterio: freeze genera un
  checkpoint con body ejecutable y total_steps consistente. Dependencia: Paso 3, 4.
  Gate: unit_tests (round-trip).
- [ ] **Paso 6 (D):** `mark` secuencial: solo permite marcar `currentStep + 1`;
  idempotente si ya está marcado; fail duro si el checkbox `Paso N:` no existe en el
  body; actualiza la sección `Next action` del body. Criterio: `mark 4` sin haber
  marcado 3 → rechazado; `mark` con checkbox ausente → rechazado con mensaje.
  Dependencia: Paso 5. Gate: unit_tests (invalid transitions).
- [ ] **Paso 7 (E):** `complete` verificado: exige todos los checkboxes `[x]`,
  `currentStep === totalSteps` y manifest governance aprobado (via
  `assertGovernance`); falla con mensaje explícito si falta algo. Criterio: `complete`
  prematuro (paso sin tickear) → rechazado. Dependencia: Paso 6. Gate: unit_tests.
- [ ] **Paso 8 (F+K):** `revive` completo: (a) validar legibilidad del checkpoint
  (fail seguro si el frontmatter está corrupto/ilegible, explicando qué falta);
  (b) inspeccionar el repo (`git status`, `git log`, commits sin pushear);
  (c) drift detection: working tree sucio, cambios posteriores al último commit
  `subaru:`, commit checkpoint sin sincronizar → `DRIFT DETECTED` + explicación
  (qué esperaba / qué encontró / qué commit / qué archivo / qué decisión requiere
  validación) + `BLOCKED — HUMAN/COUNCIL INPUT REQUIRED`; (d) informe operativo
  `SUBARU REVIVE` con Mission, Task ID, Governance, Branch, State, Completed,
  Next, Next action, Files expected, Constraints, Required verification, DO NOT,
  Recovery status (SAFE TO CONTINUE). Criterio: revive produce el informe completo
  y detecta drift real. Dependencia: Paso 7. Gate: unit_tests (integración).
- [ ] **Paso 9 (tests):** Extender `lib.test.ts` (helpers) y crear `cli.test.ts`
  (integración en repo git temporal con git init + remote local): happy path
  (freeze→mark→mark→complete), death simulation (freeze→mark→"muerte"→revive→
  continuar), multi-máquina (repo A push → repo B pull revive → continuar), invalid
  transitions (mark antes de freeze, saltar pasos, complete incompleto, freeze sobre
  misión activa sin --force, freeze sin governance/no aprobado), push failure
  (remoto inalcanzable: distingue LOCAL CHECKPOINT vs REMOTE CHECKPOINT, exit≠0),
  drift (cambio no commiteado tras el checkpoint → DRIFT DETECTED), corrupto/missing
  (fail seguro explicando qué falta). Criterio: `npx vitest run --project workshop`
  verde (suite subaru completa). Dependencia: Paso 8. Gate: unit_tests.
- [ ] **Paso 10 (gates):** `npm run lint`, `npm run build`, security_review
  (grep secretos/API keys en el checkpoint y el CLI: solo referencias por nombre),
  `unit_tests`. e2e_tests y chrome_devtools declarados N/A (CLI sin UI) — justificado
  en el manifest. Criterio: 0 errores lint, build OK, sin secretos en archivos
  committeados. Dependencia: Paso 9. Gate: lint, build, security_review.
- [ ] **Paso 11 (docs+complete):** Actualizar `.agents/subaru.md` y AGENTS.md §24;
  regenerar MASTER.md (`npm run docs:generate`); commit+push de implementación y
  docs; `subaru complete` → commit `subaru: checkpoint subaru-return-by-death-hardening
  - completado` + push + reporte. Criterio: working tree limpio, remoto sincronizado,
  checkpoint completed, gates pasados. Dependencia: Paso 10. Gate: git status limpio
  + push + status subaru.

## Current state

- Governance: aprobado (TASK-20260811-031812147, 8/8). El checkpoint de la misión
  anterior (dashboard-quiet-chrome, completed) queda en el historial de git.
- Paso 1 (governance) completado. Pasos 2-11 pendientes.
- Working tree (ajeno a esta misión): cambios sin commitear de
  TASK-20260811-024549288 (ConnectionsManager + test + manifest + script de
  clasificación). NO tocarlos en esta misión; el freeze solo committea el checkpoint.

## Next action

Implementar el Paso 4 (ver sección "Approved plan") y luego ejecutar `subaru mark subaru-return-by-death-hardening 4`.

## Constraints

- Comandos CLI sin cambios (`freeze/mark/complete/revive/status/bootstrap`).
- Frontmatter YAML sin cambios (mismos campos).
- Formato de commits: `subaru: checkpoint <id> - listo|en-progreso|completado|bloqueado`.
- `git add` solo del archivo del checkpoint (nunca `git add -A`).
- No secretos en el checkpoint (referencias por nombre de env var).
- Reusar `WorkflowEngine` de `workshop/governance/workflow.ts` (no duplicar lógica).
- ADRs aplicables: AGENTS.md §24 (protocolo Subaru), §23 (governance), §22 (Evidence
  First). No introducir ADR nuevo (cambio interno de tooling).
- Estado `blueprint_ready` se mantiene (cambio A excluido por el Council).

## Verification

- `npx vitest run --project workshop` — suite subaru (unit + integración) verde.
- `npm run lint` — 0 errores.
- `npm run build` — sin errores.
- security_review — sin secretos en archivos committeados.
- e2e_tests / chrome_devtools: N/A (CLI sin UI), justificado en el manifest.
- `git status` limpio + remoto sincronizado al cierre.

## Recovery instructions

Tras un `revive` en cualquier máquina:

1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar. Resolver la contradicción
   (revisar qué commit/archivo cambió) antes de cualquier `mark`.
5. Continuar implementando el paso indicado y ejecutar
   `npx tsx workshop/subaru/cli.ts mark subaru-return-by-death-hardening <n>`.
6. Al final: `npx tsx workshop/subaru/cli.ts complete subaru-return-by-death-hardening`.
