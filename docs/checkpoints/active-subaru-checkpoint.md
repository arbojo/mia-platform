---
task_id: subaru-audit-v2
title: Auditoria y endurecimiento Subaru v2
state: in_progress
current_step: 4
total_steps: 7
branch: main
last_machine: archlinux
governance_id: TASK-20260811-222129849
created: 2026-08-11T22:22:34.578Z
updated: 2026-08-11T22:30:34.284Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Endurecimiento del agente Subaru (auditoría v2): el guardián de continuidad del protocolo Return-by-Death debe sobrevivir a la muerte de una sesión en cualquier máquina. Fix del test multi-máquina, bootstrap con validación completa, estado frozen retrocompatible, scaffold enriquecido, gates en complete, drift detallado y secret scan.

## Scope

- `workshop/subaru/cli.ts` — bootstrap, estado frozen, complete con gates, drift detallado, secret scan, resultado final.
- `workshop/subaru/lib.ts` — estado frozen, scaffold enriquecido, helpers de secretos y resultado final.
- `workshop/subaru/cli.test.ts` — fix identidad git en cloneRepo + tests de bootstrap, gates, drift, secretos.
- `workshop/subaru/lib.test.ts` — tests de scaffold enriquecido, estado frozen, secretos.
- `AGENTS.md` §24 — documentación del protocolo (estados, gates, bootstrap, autoría del blueprint).
- `.agents/subaru.md` — espejo del agente Subaru actualizado.
- `docs/adr/021-subaru-checkpoint.md` — ADR del protocolo (nuevo).
- `workshop/governance/classify-subaru-audit-v2.script.ts` — manifest governance (creado).

## Non-goals

- NO reescribir el CLI ni la librería: endurecimiento incremental.
- NO tocar la misión `tenant-edition-premier` (su blueprint queda archivado en git history, commit 9ae58b5; se restaura si se retoma).
- NO cambiar los comandos de la CLI (freeze/mark/complete/revive/status/bootstrap) sin razón arquitectónica.
- NO modificar el sistema governance (`workshop/governance/workflow.ts`, `orchestrator.ts`) ni sus estados.
- NO escribir secretos en el checkpoint: solo referencias a variables de entorno por nombre.
- NO usar `git add -A`: el CLI solo agrega el checkpoint; los archivos de implementación se committean con conventional commits.

## Approved plan

Pasos atómicos aprobados por el Council:

- [x] **Paso 1:** Fix harness de tests multi-máquina
  - Objetivo: el test "survives death across machines" pasa en cualquier máquina, incluso sin identidad git global.
  - Archivos: `workshop/subaru/cli.test.ts`.
  - Acción: en `cloneRepo()`, tras `git clone`, configurar `user.email` y `user.name` en el clon.
  - Dependencia: ninguna.
  - Criterio de terminación: `npx vitest run workshop/subaru` → 48/48 tests verdes (incluye revive-death).
  - Gate/verificación: `unit_tests`.

- [x] **Paso 2:** Bootstrap con validación de entorno completa
  - Objetivo: `bootstrap` comprueba Node, git, remote, repo, agente espejo, existencia del checkpoint y configuración git (user.email/user.name), sin modificar config.
  - Archivos: `workshop/subaru/cli.ts` (cmdBootstrap), `workshop/subaru/cli.test.ts`.
  - Acción: detectar identidad git vía `git config user.email`/`user.name`; verificar presencia de git y del checkpoint; reportar faltantes con mensaje claro y sugerencia; restaurar el agente global desde `.agents/subaru.md`.
  - Dependencia: Paso 1 (convención de tests del harness).
  - Criterio de terminación: bootstrap reporta cada check; identidad ausente produce advertencia accionable.
  - Gate/verificación: `unit_tests`.

- [x] **Paso 3:** Estado `frozen` retrocompatible
  - Objetivo: `freeze` escribe `state: frozen`; checkpoints legacy con `blueprint_ready` se siguen aceptando sin drift.
  - Archivos: `workshop/subaru/lib.ts` (SubaruState, normalización), `workshop/subaru/cli.ts` (escrituras), tests.
  - Acción: añadir `frozen` a `SubaruState`; `freeze` escribe `frozen`; helper de lectura que trata `blueprint_ready` como `frozen`; el commit sigue siendo `- listo`.
  - Dependencia: —
  - Criterio de terminación: freeze escribe `frozen`; revive sobre checkpoint legacy `blueprint_ready` no dispara drift.
  - Gate/verificación: `unit_tests`.

- [x] **Paso 4:** Scaffold enriquecido (pasos con 7 atributos)
  - Objetivo: cada paso del blueprint lleva número, objetivo, archivos afectados, acción esperada, dependencia previa, criterio de terminación y gate/verificación.
  - Archivos: `workshop/subaru/lib.ts` (scaffoldBlueprint), `workshop/subaru/lib.test.ts`.
  - Acción: ampliar el scaffold a bloques estructurados por paso manteniendo intacta la regex `- [ ] **Paso N:**` (los checkboxes deben seguir parseándose).
  - Dependencia: —
  - Criterio de terminación: los tests parsean los 7 atributos por paso; `countCheckboxSteps` y `mark` siguen funcionando.
  - Gate/verificación: `unit_tests`.

- [ ] **Paso 5:** `complete` con confirmación de gates + resultado final
  - Objetivo: `complete` lista los gates obligatorios del manifest governance y exige `--confirm-gates` para cerrar; además escribe el resultado final en "Current state".
  - Archivos: `workshop/subaru/cli.ts`, `workshop/subaru/cli.test.ts`, `workshop/subaru/lib.ts` (helper de sección).
  - Acción: `complete <id> --confirm-gates`; sin el flag bloquea y lista los gates; antes del commit escribe resumen final en la sección "Current state".
  - Dependencia: —
  - Criterio de terminación: complete sin flag → bloqueo con lista de gates; con flag y pasos completos → `completed` + commit `- completado`.
  - Gate/verificación: `unit_tests`.

- [ ] **Paso 6:** Drift detallado + secret scan
  - Objetivo: revive reporta qué commits/archivos avanzó el remoto; el CLI rechaza checkpoints con secretos antes de commitear.
  - Archivos: `workshop/subaru/cli.ts`, `workshop/subaru/lib.ts`, tests.
  - Acción: en `detectDrift`, si el remoto avanzó, incluir `git log HEAD..origin/<branch> --oneline`; nuevo `secretScan(body)` con patrones (sk-, AKIA, BEGIN RSA PRIVATE KEY, password=, token=, client_secret) que bloquea freeze/mark/complete.
  - Dependencia: —
  - Criterio de terminación: tests de drift con commits remotos (reporta el commit) y de secret scan (bloquea `sk-...`).
  - Gate/verificación: `unit_tests`.

- [ ] **Paso 7:** Gates de calidad + documentación
  - Objetivo: lint/build/unit verdes; documentar el protocolo completo.
  - Archivos: `AGENTS.md` §24, `.agents/subaru.md`, `docs/adr/021-subaru-checkpoint.md`.
  - Acción: actualizar AGENTS.md §24 y el espejo del agente; crear ADR-021; resolver la contradicción "no editar a mano" (el blueprint se autoriza ANTES del freeze; el CLI solo estampa frontmatter + commit).
  - Dependencia: Pasos 1-6.
  - Criterio de terminación: `npm run lint` 0/0, `npm run build` sin errores, `npm run test:unit` verde, docs consistentes.
  - Gate/verificación: `lint`, `build`, `unit_tests`, `chrome_devtools`.

## Current state

- Misión congelada. Pasos pendientes: 1..7.

## Next action

Implementar el Paso 5 (ver sección "Approved plan") y luego ejecutar `subaru mark subaru-audit-v2 5`.

## Constraints

- Migraciones y dominios del producto: intocados.
- Governance aprobado: TASK-20260811-222129849 (COMPLEX, 8 agentes).
- El CLI es la única autoridad que modifica el frontmatter y committea el checkpoint (formato `subaru: checkpoint <id> - listo|en-progreso|completado`).
- El body del blueprint se autoriza ANTES del freeze (autoría del Council); después del freeze no se edita a mano.
- No escribir secretos en el checkpoint; el CLI ejecutará secret scan antes de commitear.
- Identidad git: esta máquina no tiene user.email/user.name configurados; los commits del protocolo usan variables de entorno por invocación (David Admin <arbojo@gmail.com>).
- La misión `tenant-edition-premier` queda suspendida: su blueprint se preserva en git history (commit 9ae58b5), no en el checkpoint activo.

## Verification

- Gates: lint, build, unit_tests, e2e_tests, chrome_devtools, security_review.
- Unit: `npx vitest run workshop/subaru` debe pasar 100%.
- Funcional: `freeze` escribe `frozen`; `complete` exige `--confirm-gates`; `revive` detecta secretos y drift detallado.

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción.
5. Continuar el paso indicado y ejecutar `subaru mark subaru-audit-v2 <n>`.
6. Al final: `subaru complete subaru-audit-v2 --confirm-gates`.
