---
task_id: H1-RETENTION-REMEDIATION
title: Retention Idempotency H1 Remediation — throw-safe + reads (R1/R2) — ACCEPTED/FROZEN
state: completed
current_step: 4
total_steps: 4
branch: main
last_machine: Deivis-Desktop
governance_id: TASK-20260902-210942761
created: 2026-08-31T00:06:33.347Z
updated: 2026-09-02T22:24:45.048Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Retention Idempotency H1 Remediation — throw-safe + reads (R1/R2) — ACCEPTED/FROZEN

Aprobación: TASK-20260902-210942761.

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

- Misión H1-RETENTION-REMEDIATION completada (4/4 pasos).
- Gates confirmados: ESLint (0 errors, 0 warnings), Production build (no errors), Unit tests pass, Playwright e2e tests pass, Chrome DevTools console and network check, Security Engineer review, Godzilla Stress Test (adversarial).
- Finalizado: 2026-09-02T22:24:45.048Z.

## Next action

Todos los pasos marcados. Ejecutar `subaru complete H1-RETENTION-REMEDIATION` cuando pasen los gates de verificación.

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
5. Continuar el paso indicado y ejecutar `subaru mark H1-RETENTION-REMEDIATION <n>`.
6. Al final: `subaru complete H1-RETENTION-REMEDIATION`.
