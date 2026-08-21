---
task_id: TASK-20260820-ADR027
title: ADR-027: MIA Cloud Architecture
state: in_progress
current_step: 4
total_steps: 5
branch: main
last_machine: Deivis-Desktop
governance_id: TASK-20260820-ADR027
created: 2026-08-13T23:56:05.761Z
updated: 2026-08-21T08:15:00.000Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

ADR-027: MIA Cloud Architecture — convertir MIA en plataforma Cloud gestionada con extensiones arquitectónicas (JWT bridge, session restoration, lifecycle Platform Admin, provisioning híbrido).

Aprobación: TASK-20260820-ADR027 (Concilio unánime, 2026-08-21).

## Scope

- `docs/adr/027-mia-cloud-architecture.md`
- `.governance/tasks/TASK-20260820-ADR027.json`
- `supabase/migrations/` (deployment_model, status)
- `src/lib/platform/jwt.ts`, `src/lib/system/edition.ts`
- `services/whatsapp-bridge/src/` (JWT, restoration, graceful shutdown)
- `src/app/api/admin/platform/tenants/`
- `src/components/platform-admin/`
- `tests/platform-admin.test.ts`

## Non-goals

- Modelo B/C (Supabase/Vercel/Fly dedicados por tenant) — diferido per §4.1.1
- CI/CD automation, rate limiting, multi-region
- Self-service payment integration (provisioning admin-only en MVP)
- Schema-per-tenant

## Approved plan

Pasos atómicos aprobados por el Council:

- [x] **Paso 1:** Auditoría arquitectónica y redacción ADR-027
  - Objetivo: Documentar estado actual, gaps, y extensiones Cloud
  - Archivos: `docs/adr/027-mia-cloud-architecture.md`
  - Acción: ADR completo con contexto, tenant model, bridge JWT, lifecycle
  - Dependencia: ninguna
  - Criterio de terminación: ADR-027 committed (11bc7ff)
  - Gate/verificación: ADR presente en docs/adr/

- [x] **Paso 2:** Prerrequisito Phase 0a — Legacy Supabase cleanup
  - Objetivo: Eliminar riesgo CRITICAL del proyecto legacy `aveusacpaexwrfoyinas`
  - Archivos: `docs/audits/legacy-project-security-report.md`
  - Acción: `supabase projects delete` + actualizar ADR §1.1.6
  - Dependencia: Paso 1
  - Criterio de terminación: Proyecto legacy eliminado (472b1c6)
  - Gate/verificación: ADR §1.1.6 status RESOLVED

- [x] **Paso 3:** Congelar checkpoint Subaru + governance classify
  - Objetivo: Blueprint congelado en remoto antes de decisiones de implementación
  - Archivos: `docs/checkpoints/active-subaru-checkpoint.md`
  - Acción: `subaru freeze TASK-20260820-ADR027` (90a765e)
  - Dependencia: Pasos 1-2
  - Criterio de terminación: Checkpoint en remoto, state frozen→in_progress
  - Gate/verificación: `subaru status` confirma TASK-20260820-ADR027

- [x] **Paso 4:** Concilio §4.1 — Evaluación modelos A/B/C + governance manifest
  - Objetivo: Decisión formal de topología de infraestructura Cloud MVP
  - Archivos: `docs/adr/027-mia-cloud-architecture.md` §4.1.1, `.governance/tasks/TASK-20260820-ADR027.json`
  - Acción: Convocar Concilio, evaluar A/B/C per §4.2, registrar decisión Model A, aprobar manifest
  - Dependencia: Paso 3
  - Criterio de terminación: §4.1.1 Council Decision Record en ADR + manifest approved + `governance validate` PASSED
  - Gate/verificación: `npx tsx workshop/governance/cli.ts validate TASK-20260820-ADR027`

- [ ] **Paso 5:** Implementación Cloud MVP Phase 1 (Core)
  - Objetivo: JWT bridge auth + session restoration + deployment_model/status columns
  - Archivos: §18 File Impact Matrix — Phase 1 tasks 1-4 (ADR §14.2)
  - Acción: Migration → jwt.ts → bridge changes → graceful shutdown
  - Dependencia: Paso 4 (Model A approved, governance authorized)
  - Criterio de terminación: Phase 1 tasks 1-4 completos, lint + build pass
  - Gate/verificación: lint, build, security_review (JWT cross-tenant tests)

## Current state

- Paso 4 completado: Concilio §4.1 — **Model A (Shared Everything)** aprobado unánimemente.
- Governance manifest `TASK-20260820-ADR027` status: **approved** (14/14 agentes).
- ADR-027 §4.1.1 Council Decision Record escrito.
- Listo para Paso 5 (implementación Phase 1).

## Next action

Implementar Paso 5 — Phase 1 Core (§14.2 tasks 1-4). Al completar: `subaru mark TASK-20260820-ADR027 5`.

## Constraints

- Model A obligatorio para MVP — no provisionar Supabase/Vercel/Fly por tenant
- Per-tenant JWT (jose) reemplaza shared secret — no deploy sin esto
- Admin client para writes; server client para reads
- Governance gate: validate antes de cada commit de implementación
- RLS sin cambios — isolation lógica via get_user_business_ids()

## Verification

| Gate | Estado |
|------|--------|
| governance validate | ✅ PASSED |
| Concilio §4.1 | ✅ Model A approved |
| lint | ⏳ Pendiente (Paso 5) |
| build | ⏳ Pendiente (Paso 5) |
| unit_tests | ⏳ Pendiente (Paso 5) |
| e2e_tests | ⏳ Pendiente (Paso 5) |
| security_review | ⏳ Pendiente (Paso 5) |
| stress_test | ⏳ Pendiente (Paso 5) |

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción.
5. Verificar governance: `npx tsx workshop/governance/cli.ts validate TASK-20260820-ADR027`
6. Continuar Paso 5 e implementar Phase 1 Core.
7. Al final: `subaru complete TASK-20260820-ADR027 --confirm-gates --governance TASK-20260820-ADR027`.
