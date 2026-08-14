---
task_id: TASK-20260814-031446183
title: Envío único de imagen por producto/sesión + blindaje multimedia WhatsApp
state: in_progress
current_step: 4
total_steps: 8
branch: main
last_machine: archlinux
governance_id: TASK-20260814-031446183
created: 2026-08-13T23:56:05.761Z
updated: 2026-08-14T03:30:17.229Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Envío único de imagen por producto/sesión + blindaje multimedia WhatsApp

Aprobación: TASK-20260814-031446183.

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

- [ ] **Paso 5:** (objetivo del paso 5 — completar antes de implementar)
  - Objetivo: (qué logra el paso 5)
  - Archivos: (archivos afectados)
  - Acción: (acción esperada)
  - Dependencia: (paso previo que debe estar terminado, o "ninguna")
  - Criterio de terminación: (qué debe cumplirse para marcar el paso)
  - Gate/verificación: (gate que valida el paso)

- [ ] **Paso 6:** (objetivo del paso 6 — completar antes de implementar)
  - Objetivo: (qué logra el paso 6)
  - Archivos: (archivos afectados)
  - Acción: (acción esperada)
  - Dependencia: (paso previo que debe estar terminado, o "ninguna")
  - Criterio de terminación: (qué debe cumplirse para marcar el paso)
  - Gate/verificación: (gate que valida el paso)

- [ ] **Paso 7:** (objetivo del paso 7 — completar antes de implementar)
  - Objetivo: (qué logra el paso 7)
  - Archivos: (archivos afectados)
  - Acción: (acción esperada)
  - Dependencia: (paso previo que debe estar terminado, o "ninguna")
  - Criterio de terminación: (qué debe cumplirse para marcar el paso)
  - Gate/verificación: (gate que valida el paso)

- [ ] **Paso 8:** (objetivo del paso 8 — completar antes de implementar)
  - Objetivo: (qué logra el paso 8)
  - Archivos: (archivos afectados)
  - Acción: (acción esperada)
  - Dependencia: (paso previo que debe estar terminado, o "ninguna")
  - Criterio de terminación: (qué debe cumplirse para marcar el paso)
  - Gate/verificación: (gate que valida el paso)


## Current state

- Misión congelada (state: frozen). Pasos pendientes: 1..8.

## Next action

Implementar el Paso 5 (ver sección "Approved plan") y luego ejecutar `subaru mark TASK-20260814-031446183 5`.

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
5. Continuar el paso indicado y ejecutar `subaru mark TASK-20260814-031446183 <n>`.
6. Al final: `subaru complete TASK-20260814-031446183`.
