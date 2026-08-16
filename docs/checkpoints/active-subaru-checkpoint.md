---
task_id: 4
title: Efecto Scale & Elastic Pop en modales y ventanas flotantes de edicion
state: completed
current_step: 5
total_steps: 5
branch: main
last_machine: Deivis-Desktop
governance_id: TASK-20260816-220813618
created: 2026-08-13T23:56:05.761Z
updated: 2026-08-16T22:27:28.089Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Efecto Scale & Elastic Pop en modales y ventanas flotantes de edicion

Aprobación: TASK-20260816-220813618.

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

- [x] **Paso 5:** (objetivo del paso 5 — completar antes de implementar)
  - Objetivo: (qué logra el paso 5)
  - Archivos: (archivos afectados)
  - Acción: (acción esperada)
  - Dependencia: (paso previo que debe estar terminado, o "ninguna")
  - Criterio de terminación: (qué debe cumplirse para marcar el paso)
  - Gate/verificación: (gate que valida el paso)


## Current state

- Misión 4 completada (5/5 pasos).
- Gates confirmados: ESLint (0 errors, 0 warnings), Production build (no errors), Unit tests pass, Playwright e2e tests pass, Chrome DevTools console and network check, Security Engineer review.
- Finalizado: 2026-08-16T22:27:28.089Z.

## Next action

Todos los pasos marcados. Ejecutar `subaru complete 4` cuando pasen los gates de verificación.

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
5. Continuar el paso indicado y ejecutar `subaru mark 4 <n>`.
6. Al final: `subaru complete 4`.
