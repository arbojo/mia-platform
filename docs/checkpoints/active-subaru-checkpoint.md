---
task_id: TASK-20260825-CLOUD-R1R3
title: Cloud Remediation R-1 R-2 R-3
state: completed
current_step: 4
total_steps: 4
branch: main
last_machine: archlinux
governance_id: TASK-20260825-CLOUD-R1R3
created: 2026-08-23T10:28:37.146Z
updated: 2026-08-25T22:54:29.645Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Cloud Remediation R-1 R-2 R-3

Aprobación: TASK-20260825-CLOUD-R1R3.

## Scope

- (archivos/módulos/dominios involucrados — completar)

## Non-goals

- (qué NO tocar — completar)

## Approved plan

Pasos atómicos aprobados por el Council:

- [x] **Paso 1:** (objetivo del paso 1 — completar antes de implementar)
  - Objetivo: (qué logra el paso 1)
  - Archivos: (archivos afectados)
  - Acción: (acción esperada)
  - Dependencia: (paso previo que debe estar terminado, o "ninguna")
  - Criterio de terminación: (qué debe cumplirse para marcar el paso)
  - Gate/verificación: (gate que valida el paso)

- [x] **Paso 2:** (objetivo del paso 2 — completar antes de implementar)
  - Objetivo: (qué logra el paso 2)
  - Archivos: (archivos afectados)
  - Acción: (acción esperada)
  - Dependencia: (paso previo que debe estar terminado, o "ninguna")
  - Criterio de terminación: (qué debe cumplirse para marcar el paso)
  - Gate/verificación: (gate que valida el paso)

- [x] **Paso 3:** (objetivo del paso 3 — completar antes de implementar)
  - Objetivo: (qué logra el paso 3)
  - Archivos: (archivos afectados)
  - Acción: (acción esperada)
  - Dependencia: (paso previo que debe estar terminado, o "ninguna")
  - Criterio de terminación: (qué debe cumplirse para marcar el paso)
  - Gate/verificación: (gate que valida el paso)

- [x] **Paso 4:** (objetivo del paso 4 — completar antes de implementar)
  - Objetivo: (qué logra el paso 4)
  - Archivos: (archivos afectados)
  - Acción: (acción esperada)
  - Dependencia: (paso previo que debe estar terminado, o "ninguna")
  - Criterio de terminación: (qué debe cumplirse para marcar el paso)
  - Gate/verificación: (gate que valida el paso)


## Current state

- Misión TASK-20260825-CLOUD-R1R3 completada (4/4 pasos).
- Gates confirmados: ESLint (0 errors, 0 warnings), Production build (no errors), Unit tests pass.
- Finalizado: 2026-08-25T22:54:29.645Z.

## Next action

Todos los pasos marcados. Ejecutar `subaru complete TASK-20260825-CLOUD-R1R3` cuando pasen los gates de verificación.

## Constraints

- (decisiones arquitectónicas, ADRs, reglas de governance, restricciones de seguridad — completar)

## Verification

- (gates obligatorios y estado de ejecución — completar)

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción.
5. Continuar el paso indicado y ejecutar `subaru mark TASK-20260825-CLOUD-R1R3 <n>`.
6. Al final: `subaru complete TASK-20260825-CLOUD-R1R3`.
