---
task_id: TASK-20260823-102540725
title: Engineering Loop v0.1 - Minimal Worker Handoff
state: in_progress
current_step: 1
total_steps: 5
branch: main
last_machine: DESKTOP-VN2R21O
governance_id: TASK-20260823-102540725
created: 2026-08-23T10:28:37.146Z
updated: 2026-08-23T10:38:48.679Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Engineering Loop v0.1 — Minimal Worker Handoff. Demostrar que una misión puede sobrevivir al fallo de un modelo de código y continuar automáticamente con otro modelo a través del estado de misión Subaru existente y la sesión de OpenCode.

Aprobación: TASK-20260823-102540725 (Concilio unánime, 2026-08-23).

## Scope

- `workshop/loop/router.ts` — mapeo determinista worker→modelo (nemotron→opencode/nemotron-3-ultra-free, big-pickle→opencode/big-pickle)
- `workshop/loop/runner.ts` — invocación de `opencode run` (spawnSync, --model/-s/--format json)
- `workshop/loop/signals.ts` — SUCCESS/FAILURE/TIMEOUT/STUCK + adaptador mínimo a RepeatedErrorRule
- `workshop/loop/evidence.ts` — evidencia JSONL machine-readable
- `workshop/loop/run-loop.ts` — orquestador de misión (reintentos, handoff, gates lint/build/unit)
- `tests/engineering-loop.test.ts` — TEST 1-8 con fakes
- `docs/architecture/engineering-loop-v0.1.md`

## Non-goals

- NO nuevo runtime de workers ni framework de agentes
- NO modificar OpenCode, Subaru, Council ni Governance
- NO segundo sistema de checkpoints ni de memoria
- NO selección de modelo por LLM (solo mapeo determinista)
- NO deploy a producción ni operación sobre datos reales de clientes

## Approved plan

Pasos atómicos aprobados por el Council:

- [x] **Paso 1:** Implementar núcleo del Loop en workshop/loop/
  - Objetivo: router determinista + runner opencode + señales + evidencia JSONL + orquestador con reintentos/handoff/gates.
  - Archivos: workshop/loop/router.ts, runner.ts, signals.ts, evidence.ts, run-loop.ts
  - Acción: escribir los 5 módulos (~200 LOC total) reutilizando spawnSync, RepeatedErrorRule y convenciones de workshop/.
  - Dependencia: ninguna
  - Criterio de terminación: los módulos compilan bajo tsx y exponen API inyectable (fakes) para tests.
  - Gate/verificación: npx tsx -e import smoke de cada módulo sin errores.

- [ ] **Paso 2:** Tests deterministas TEST 1-8 en verde
  - Objetivo: probar éxito, reintento, stuck→checkpoint→handoff misma sesión, éxito fallback, bloqueo final, supervivencia de estado, sesión estable, gates innecesarios.
  - Archivos: tests/engineering-loop.test.ts
  - Acción: vitest con fakeRunner/fakeGates/fakeSubaru inyectados; cero llamadas reales a opencode.
  - Dependencia: Paso 1
  - Criterio de terminación: npm run test:unit pasa 8/8 casos nuevos sin regresiones.
  - Gate/verificación: npx vitest run tests/engineering-loop.test.ts

- [ ] **Paso 3:** Gates del repositorio en verde
  - Objetivo: lint, build y unit suite completa sin errores sobre el árbol modificado.
  - Archivos: (ninguno nuevo; verificación global)
  - Acción: ejecutar npm run lint && npm run build && npm run test:unit.
  - Dependencia: Paso 2
  - Criterio de terminación: 0 errores/warnings en lint; build OK; unit suite verde.
  - Gate/verificación: salida machine-readable registrada en evidence del paso.

- [ ] **Paso 4:** Integración real con OpenCode
  - Objetivo: demostrar misión real inofensiva con Nemotron y handoff controlado a Big Pickle en la MISMA sesión.
  - Archivos: .loop-evidence/ (solo evidencia local, gitignored si aplica)
  - Acción: misión de juguete (crear/borrar archivo temporal); forzar condición stuck controlada; verificar checkpoint Subaru + continuación con -s <misma-sesion> --model big-pickle.
  - Dependencia: Paso 3
  - Criterio de terminación: evidencia JSONL muestra intentos nemotron→big-pickle con session_id idéntico y resultado SUCCESS/BLOCK correcto.
  - Gate/verificación: inspección del JSONL + salida del runner.

- [ ] **Paso 5:** Documentación y cierre
  - Objetivo: doc architecture + informe final con clasificación YES/PARTIAL/NO.
  - Archivos: docs/architecture/engineering-loop-v0.1.md
  - Acción: documentar arquitectura, routing, invocación, handoff, integración Subaru, reintentos, detección stuck, escalación, límites de seguridad, tests y limitaciones.
  - Dependencia: Paso 4
  - Criterio de terminación: doc completa + subaru complete --confirm-gates exitoso.
  - Gate/verificación: npx tsx workshop/subaru/cli.ts status

## Current state

- Misión congelada (state: frozen). Pasos pendientes: 1..5.

## Next action

Implementar el Paso 2 (ver sección "Approved plan") y luego ejecutar `subaru mark TASK-20260823-102540725 2`.

## Constraints

- Reuso obligatorio: Subaru CLI (única autoridad de estado), WorkflowEngine (governance), RepeatedErrorRule (stuck), gates npm existentes.
- Límites de seguridad: el Loop NUNCA deploya producción, modifica secretos, bypassa governance/aprobaciones ni ejecuta DDL destructivo; esas condiciones producen BLOCK o REQUIRE_HUMAN_APPROVAL.
- PRIMARY=opencode/nemotron-3-ultra-free, FALLBACK=opencode/big-pickle; sin descubrimiento dinámico de modelos.
- Presupuesto: ~200 LOC de producción nueva; si se necesita más, DETENERSE y justificar.
- Sin secretos en código/evidencia; sin commits de implementación sin este blueprint en remoto.

## Verification

- (gates obligatorios y estado de ejecución — completar)

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción.
5. Continuar el paso indicado y ejecutar `subaru mark TASK-20260823-102540725 <n>`.
6. Al final: `subaru complete TASK-20260823-102540725`.
