---
task_id: subaru-cli
title: CLI Subaru: resurrección multi-máquina de tareas
state: in_progress
current_step: 4
total_steps: 7
branch: main
last_machine: Deivis-Desktop
governance_id: TASK-20260809-233611402
created: 2026-08-09T23:41:46.720Z
updated: 2026-08-09T23:42:24.320Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## 0. PROTOCOLO SUBARU — Secuencia Correcta

Subaru NO documenta lo ya hecho: **congela el blueprint de lo que se va a
implementar** en el instante en que el concilio aprueba la tarea, y lo
sincroniza a remoto ANTES de escribir código. Así, si la máquina muere por
tokens a mitad de la implementación, la próxima máquina lee el plan desde
GitHub y continúa sin perder contexto.

```
1. Governance: classify → concilio aprueba (análisis + plan)
2. SUBARU: escribe checkpoint con Plan de Ataque ATOMICO   ← AQUÍ
   (archivos exactos, pasos, comandos de validación)
3. SUBARU: git add + commit + push  → el blueprint sobrevive (Return-by-Death)
4. Implementación (agentes) + Gates de calidad
5. SUBARU: actualiza checkpoint a "Completado" + commit + push (cierre)
```

Regla de oro: **nunca un commit de implementación sin su blueprint previo en
remoto.** El checkpoint es un plan de misión, no una bitácora.

---

## 1. Contexto y Objetivo

Implementar el **Protocolo de Resurrección Subaru como herramienta
determinista** (CLI): que cualquier instancia de opencode en cualquier máquina
pueda hacer `git pull`, leer el checkpoint y **retomar la misma tarea con el
mismo plan en el paso exacto donde murió la anterior**. El checkpoint pasa a
tener frontmatter YAML con estado máquina-legible, y el CLI gestiona el ciclo
de vida completo. El propio CLI se usa como **self-demo**: gestiona su propia
implementación (freeze → mark → complete).

## 2. Blueprint de Ejecución (plan congelado pre-implementación)

### 2.1 Archivos exactos a tocar
| Archivo | Acción | Detalle |
|---------|--------|---------|
| `workshop/subaru/lib.ts` | Crear | Helpers puros, cero I/O: `parseFrontmatter(content)` → `{data, body}`, `serializeCheckpoint(data, body)` → string con frontmatter YAML, `buildCommitMessage(taskId, state)`, `validateStep(n, total)`, `flipStepCheckbox(body, step)`. Frontmatter con claves EN: `task_id, title, state, current_step, total_steps, branch, last_machine, governance_id, created, updated`. |
| `workshop/subaru/cli.ts` | Crear | CLI sobre `docs/checkpoints/active-subaru-checkpoint.md`. Comandos: `freeze <id> --title <t> --steps <n> [--governance <id>]` (blueprint: escribe frontmatter, `git add <checkpoint>`, commit `subaru: checkpoint <id> - listo`, push; guard: no sobrescribir misión no-completada distinta sin `--force`), `mark <id> <step>` (state `in_progress`, tick checkbox, commit+push `- en-progreso`), `complete <id>` (state `completed`, commit+push `- completado`), `revive` (git pull --rebase + resumen + siguiente comando; flag `--no-pull`), `status` (leer y resumir), `bootstrap` (valida node/git remote y restaura el agente global desde `.agents/subaru.md`). Node builtins: `node:fs`, `node:path`, `node:os`, `node:child_process`. |
| `workshop/subaru/lib.test.ts` | Crear | Unit tests de `parseFrontmatter` (con y sin frontmatter), `serializeCheckpoint` (round-trip), `buildCommitMessage` (4 estados), `validateStep`, `flipStepCheckbox`. |
| `.agents/subaru.md` | Crear | Espejo en repo de la definición del agente (restaurable vía `bootstrap` en cualquier máquina). |
| `~/.config/opencode/agent/subaru.md` | Modificar | Agente global: delegar en el CLI (comandos exactos) + ciclo de vida del checkpoint. |
| `AGENTS.md` | Modificar | Nueva sección "24. Protocolo de Resurrección Subaru (Multi-máquina)". |
| `package.json` | Modificar | Script npm `"subaru": "tsx workshop/subaru/cli.ts"`. |
| `docs/checkpoints/active-subaru-checkpoint.md` | Modificar | Este archivo: frontmatter (vía freeze) + cuerpo del plan. |

### 2.2 Pasos atómicos
- [x] **Paso 1:** Gobernanza: clasificar tarea y aprobación del concilio (TASK-20260809-233611402).
- [x] **Paso 2 (SUBARU):** Escribir este blueprint ANTES de codificar (plan atómico + comandos de validación).
- [x] **Paso 3:** Crear `workshop/subaru/lib.ts` + `cli.ts` + `lib.test.ts` (mínimo viable).
- [ ] **Paso 4 (SUBARU self-demo):** `freeze` → frontmatter + commit `subaru: checkpoint subaru-cli - listo` + push (el primer commit del sprint es el blueprint).
- [ ] **Paso 5:** Integración: `.agents/subaru.md`, agente global, sección AGENTS.md, script npm `subaru`.
- [ ] **Paso 6:** Gates de calidad (comandos abajo) + smoke del CLI (`status`, `revive --no-pull`, `bootstrap`).
- [ ] **Paso 7 (SUBARU self-demo):** `mark` pasos + `complete` → commit `subaru: checkpoint subaru-cli - completado` + push + reporte con comando de resurrección.

### 2.3 Comandos de validación obligatorios
```
npm run lint
npm run build
npm run test:unit
npm test
npx tsx workshop/subaru/cli.ts status
npx tsx workshop/subaru/cli.ts revive --no-pull
npx tsx workshop/subaru/cli.ts bootstrap
```

## 3. Evidencia de Ejecución (se llena al cierre)
- Gates, commits, manifest y smoke results.

## 4. Comando de Resurrección (una línea)
```
git -C C:\Users\david\mia pull origin main
```
En Linux/macOS: `git -C ~/mia pull origin main`. Luego: `npx tsx workshop/subaru/cli.ts revive`.
