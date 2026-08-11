---
task_id: tenant-edition-premier
title: Edicion por negocio (tenant) - capabilities premier Vitanova + fix estado canal
state: blueprint_ready
current_step: 0
total_steps: 7
branch: main
last_machine: Deivis-Desktop
governance_id: TASK-20260811-072155412
created: 2026-08-11T03:20:00.000Z
updated: 2026-08-11T07:23:33.984Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Edicion por negocio (tenant) - capabilities premier Vitanova + fix estado canal

Aprobación: TASK-20260811-072155412.

## Scope

- (archivos/módulos/dominios involucrados — completar)

## Non-goals

- (qué NO tocar — completar)

## Approved plan

Pasos atómicos aprobados por el Council:

- [ ] **Paso 1:** (objetivo del paso 1 — completar antes de implementar)
- [ ] **Paso 2:** (objetivo del paso 2 — completar antes de implementar)
- [ ] **Paso 3:** (objetivo del paso 3 — completar antes de implementar)
- [ ] **Paso 4:** (objetivo del paso 4 — completar antes de implementar)
- [ ] **Paso 5:** (objetivo del paso 5 — completar antes de implementar)
- [ ] **Paso 6:** (objetivo del paso 6 — completar antes de implementar)
- [ ] **Paso 7:** (objetivo del paso 7 — completar antes de implementar)

## Current state

- Misión congelada (state: blueprint_ready). Pasos pendientes: 1..7.

## Next action

Implementar el Paso 1 (el CLI actualiza esta sección con cada mark).

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
5. Continuar el paso indicado y ejecutar `subaru mark tenant-edition-premier <n>`.
6. Al final: `subaru complete tenant-edition-premier`.
