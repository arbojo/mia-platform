# ⛩️ PROTOCOL SUBARU: Checkpoint Activo
- **ID de Tarea / Sprint:** subaru-agent-concilio
- **Estado:** ✅ Completado (verificado el 2026-08-09)
- **Fecha / Hora de Resurrección:** 2026-08-09T16:56:29-06:00

## 1. Contexto y Objetivo
Crear el agente **subaru** (El Guardián del Checkpoint) en el concilio de
OpenCode (Mia Landings). Es un agente de continuidad multi-máquina: congela
planes en `docs/checkpoints/active-subaru-checkpoint.md`, ejecuta la
sincronización git (Return-by-Death) y diagnostica la resurrección al retomar
en HP/Dell/Linux. La tarea incluye su definición, su integración en el
Director, y este mismo checkpoint como respaldo anti-tokens.

## 2. Archivos Involucrados (Crear / Modificar)
- `~/.config/opencode/agent/subaru.md` -> [Crear] Definición del agente subaru: frontmatter válido (`mode: subagent`, `permission.read/edit/bash: allow`) + cuerpo verbatim (Rol, Responsabilidades, Reglas).
- `~/.config/opencode/agent/director.md` -> [Modificar] Agregar subaru como punto 8 del roster y como Fase Transversal del flujo operativo (cierre de fases + arranque multi-máquina).
- `docs/checkpoints/active-subaru-checkpoint.md` -> [Crear] Este checkpoint de respaldo (ID subaru-agent-concilio).

## 3. Plan de Ataque (Sprints de Código)
- [x] **Paso 1:** Crear `~/.config/opencode/agent/subaru.md` con frontmatter válido y el cuerpo del agente verbatim (Rol, Responsabilidades Principales, Reglas de Comportamiento). Mantener `edit: allow`, `bash: allow`, `read: allow` para poder escribir el checkpoint y ejecutar git.
- [x] **Paso 2:** Modificar `~/.config/opencode/agent/director.md`: añadir subaru al roster (punto 8) y al flujo operativo como Fase Transversal.
- [x] **Paso 3:** Verificar que ambos archivos de la config global siguen el formato del concilio (comparar con scout.md / sanity.md: frontmatter `mode` + `permission`, cuerpo por secciones).
- [x] **Paso 4:** Reiniciar opencode para que el agente `subaru` cargue (la config NO se recarga en caliente).

## 4. Validación y Pruebas
- [x] Confirmar existencia y formato de `~/.config/opencode/agent/subaru.md`.
- [x] Confirmar que `~/.config/opencode/agent/director.md` lista a subaru (roster + Fase Transversal).
- [x] Ejecutar `git add docs/checkpoints/ && git commit -m "subaru: checkpoint subaru-agent-concilio - listo para ejecucion" && git push origin main`.
- [x] Verificar `git status` limpio y remote sincronizado.
- [x] Tras reiniciar opencode: `subaru` visible como subagente en la herramienta `task`.
