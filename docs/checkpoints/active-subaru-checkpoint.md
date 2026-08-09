# ⛩️ PROTOCOL SUBARU: Checkpoint Activo
- **ID de Tarea / Sprint:** mia-vestido-azul
- **Estado:** ✅ Completado y sincronizado (verificado el 2026-08-09)
- **Fecha / Hora de Resurrección:** 2026-08-09T17:22:00-06:00
- **Gobernanza:** TASK-20260809-231109825 (approved, completed)
- **Commit de resurrección:** ver `git log --oneline -3` (esperado: `subaru: checkpoint mia-vestido-azul - listo`)

## 1. Contexto y Objetivo
Implementar el sistema de diseño modular de MIA: soporte de **Tema Claro /
Tema Oscuro**, **Selector de Contexto por Módulo** (Ventas en Azul por
defecto, Inventario esmeralda, Logística ámbar), manteniendo el terreno
compartido y el toque maestro con **glow de urgencia**. Capa de presentación
pura: no toca RLS, dominio, APIs ni AI.

## 2. Archivos Involucrados (Crear / Modificar)
- `src/styles/design-system.css` -> [Crear] Tokens CSS: terreno compartido (`:root` y `[data-theme='dark']`), acento por módulo (`[data-module='sales|inventory|logistics']`), utilidades (`text-module-accent`, `bg-module-soft`, `ring-module`, `glow-module`) y `glow-urgency` animado.
- `src/components/layout/AppLayout.tsx` -> [Crear] Root container cliente: `ModuleContext` + `useModule()`, inyecta `data-theme` y `data-module` en `[data-layout-root]`, auto-detecta módulo por pathname, persiste elección en `localStorage['mia-module']`. Exporta `ModuleSelector` (píldora Ventas/Inventario/Logística).
- `src/app/dashboard/layout.tsx` -> [Modificar] Envuelve Sidebar+TopBar+main+MIAIndicator en `<AppLayout>` (reemplaza el div `data-layout-root` inline).
- `src/app/layout.tsx` -> [Modificar] Import de `@/styles/design-system.css` tras `./globals.css`.
- `src/components/dashboard/TopBar.tsx` -> [Modificar] Monta `<ModuleSelector />` antes de SignalIndicator.
- `docs/checkpoints/active-subaru-checkpoint.md` -> [Modificar] Este checkpoint.
- `.governance/tasks/TASK-20260809-231109825.json` -> [Crear] Manifest aprobado por concilio (6 agentes).

## 3. Plan de Ataque (Sprints de Código)
- [x] **Paso 1:** Gobernanza: clasificar tarea, aprobar concilio, validar.
- [x] **Paso 2:** Crear `design-system.css` (terreno compartido + módulos + glow).
- [x] **Paso 3:** Crear `AppLayout.tsx` con contexto de módulo y selector.
- [x] **Paso 4:** Cablear dashboard layout, root layout y TopBar.
- [x] **Paso 5:** Gates: lint 0 errores, build OK (78 páginas), unit 492, e2e 66, DevTools (atributos/accentos/no errores de consola).

## 4. Validación y Pruebas
- [x] `npm run lint` — 0 errores / 0 warnings.
- [x] `npm run build` — OK (`.next` corrupto previo: borrar `Remove-Item -Recurse -Force .next` y rebuild).
- [x] `npm run test:unit` — 492 passed.
- [x] `npm test` — 66 passed (2 skipped).
- [x] Chrome DevTools: `data-theme` en html+root, `data-module` cambia sales/inventory/logistics con accentos `#1e5a99`/`#2d8a5e`/`#d4743a` (dark: `#6ca8e0`/`#6ec29c`/`#f0a35e`), CSS cargado, sin errores de consola.

## 5. Comando de Resurrección (una línea)
```
git -C C:\Users\david\mia pull origin main
```
En Linux/macOS: `git -C ~/mia pull origin main`
