---
task_id: quiet-chrome
title: MIA Quiet Chrome: contexto por clic derecho y zonas activas
state: in_progress
current_step: 4
total_steps: 8
branch: main
last_machine: Deivis-Desktop
governance_id: TASK-20260810-002545865
created: 2026-08-10T00:26:42.754Z
updated: 2026-08-10T00:41:48.412Z
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
3. SUBARU: freeze → commit "subaru: checkpoint <id> - listo" + push
4. Implementación (agentes) + Gates de calidad
5. SUBARU: complete → commit "subaru: checkpoint <id> - completado" + push
```

Regla de oro: **nunca un commit de implementación sin su blueprint previo en remoto.**

---

## 1. Contexto y Objetivo

Refactorizar el **chrome del dashboard** de MIA: eliminar el ruido visual
(barra superior saturada, sidebar fijo, orbe animado 24/7, acciones raras
siempre visibles) y sustituirlo por **interacciones directas con el mouse**:
menús contextuales por clic derecho, hovers inteligentes con delay y
navegación por zonas activas. Estética oscura pulida (backdrop-blur, hairline,
acento por módulo) sin parches CSS globales. Capa de presentación pura: no
toca RLS, APIs, AI ni datos.

## 2. Blueprint de Ejecución (plan congelado pre-implementación)

### 2.1 Archivos exactos a tocar
| Archivo | Acción | Detalle |
|---------|--------|---------|
| `src/components/ui/context-menu.tsx` | Crear | `ContextMenuProvider` (estado global, capa en portal al body) + `useContextMenu()` → `{ openMenu(items, e), closeMenu() }` + `ContextMenuPanel` glass (backdrop-blur, hairline `--atmosphere-border`, acento `--module-accent`, radii `--mod-radius-*`, ease `--mod-ease-premium`). Intercepta `onContextMenu` con `preventDefault`, posiciona en `fixed` con clamp al viewport, cierra en pointerdown-fuera / Escape / scroll / resize / blur. Items: `ContextMenuItem` (icono+label+atajo, hover con acento), `ContextMenuSeparator`, `ContextMenuLabel`. Navegación por teclado: ArrowUp/Down, Enter, Escape, Home/End. |
| `src/lib/hooks/use-hover-intent.ts` | Crear | Hook reutilizable: `useHoverIntent(delayMs = 120)` → `{ hoverProps, intent }`; `intent` pasa a `true` tras mantener el pointer `delayMs` (evita reveal saltarines al pasar rápido). |
| `src/components/dashboard/ActivityRail.tsx` | Crear | Reemplaza `Sidebar.tsx`. Rail de iconos `w-16` que se expande al hover a `w-64` (CSS width + `--mod-ease-premium`). Grupos como zonas (hairline separador, label de grupo visible solo al expandir). Ítem activo: barra indicadora izquierda + acento del módulo. Logo/ajustes: clic derecho sobre el rail abre menú contextual con navegación rápida (todas las secciones) y ajustes (connections/assistants/health/accessibility). Usa `useHoverIntent` para no expandir en hovers accidentales y `useContextMenu` para el power-nav. |
| `src/components/dashboard/CommandStrip.tsx` | Crear | Reemplaza `TopBar.tsx`. Franja transparente (sin fondo ni borde saturados): chip de módulo compacto (icono+label, hover muestra descripción vía tooltip) + campana de señales. Tema e idioma **ya no son botones**: clic derecho sobre el chip abre menú contextual (tema claro/oscuro, idioma con check, toggle de panel de señales). |
| `src/components/dashboard/MIAIndicator.tsx` | Modificar | De orbe fijo con texto+anillos+pulso a un **ember silencioso**: punto pequeño bottom-right, opacidad baja por defecto, **sin texto ni anillos ni animación en reposo**. Al hover: florece en un glass tooltip ("Estoy aquí · Acompañando tu negocio"). Clic derecho: menú contextual de presencia (cambiar estado activo/learning/paused, ir a salud). Respeta `prefers-reduced-motion`. |
| `src/app/dashboard/layout.tsx` | Modificar | Envolver con `<ContextMenuProvider>`; `Sidebar`→`ActivityRail`; `TopBar`→`CommandStrip`. |

### 2.2 Pasos atómicos
- [x] **Paso 1:** Gobernanza: clasificar + concilio aprobar (TASK-20260810-002545865).
- [x] **Paso 2 (SUBARU):** Escribir este blueprint ANTES de codificar.
- [x] **Paso 3:** Crear primitivas: `context-menu.tsx` + `use-hover-intent.ts`.
- [x] **Paso 4:** Crear `ActivityRail.tsx` (rail expansible + power-nav por clic derecho).
- [ ] **Paso 5:** Crear `CommandStrip.tsx` + refactor de `MIAIndicator.tsx` (ember silencioso).
- [ ] **Paso 6:** Wiring en `dashboard/layout.tsx` (provider + rail + strip).
- [ ] **Paso 7:** Gates (comandos abajo) + DevTools (interacciones: clic derecho, hover, keyboard).
- [ ] **Paso 8 (SUBARU):** `complete` → commit `subaru: checkpoint quiet-chrome - completado` + push + reporte.

### 2.3 Comandos de validación obligatorios
```
npm run lint
npm run build
npm run test:unit
npm test
# Chrome DevTools MCP: abrir dashboard → clic derecho en rail/chip/ember →
# menús glass visibles, posicionados, sin desbordes; Escape cierra; sin errores de consola.
```

## 3. Evidencia de Ejecución (se llena al cierre)
- Gates, commits, manifest y verificación de interacciones.

## 4. Comando de Resurrección (una línea)
```
git -C C:\Users\david\mia pull origin main && npx tsx workshop/subaru/cli.ts revive
```
