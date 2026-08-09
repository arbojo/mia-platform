# ⛩️ PROTOCOL SUBARU: Checkpoint Activo
- **ID de Tarea / Sprint:** mia-vestido-azul
- **Estado:** ✅ Implementado y sincronizado
- **Fecha / Hora de Resurrección:** 2026-08-09T17:30:00-06:00
- **Gobernanza:** TASK-20260809-231109825 (approved → completed)
- **Commit de resurrección:** `ebb65ab` (implementación)

## 0. PROTOCOLO SUBARU — Secuencia Correcta (lección aplicada)

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
Implementar el sistema de diseño modular de MIA: soporte de **Tema Claro /
Tema Oscuro**, **Selector de Contexto por Módulo** (Ventas en Azul por
defecto, Inventario esmeralda, Logística ámbar), manteniendo el terreno
compartido y el toque maestro con **glow de urgencia**. Capa de presentación
pura: no toca RLS, dominio, APIs ni AI.

## 2. Blueprint de Ejecución (plan congelado pre-implementación)

### 2.1 Archivos exactos a tocar
| Archivo | Acción | Detalle |
|---------|--------|---------|
| `src/styles/design-system.css` | Crear | Terreno compartido `:root` + `[data-theme='dark']`, acento por módulo `[data-module='sales|inventory|logistics']`, utilidades (`text-module-accent`, `bg-module-soft`, `ring-module`, `glow-module`), `glow-urgency` animado con `prefers-reduced-motion`. |
| `src/components/layout/AppLayout.tsx` | Crear | Root container cliente: `ModuleContext` + `useModule()`, inyecta `data-theme` y `data-module` en `[data-layout-root]`, auto-detecta módulo por pathname, persiste en `localStorage['mia-module']`. Exporta `ModuleSelector`. |
| `src/app/dashboard/layout.tsx` | Modificar | Envolver Sidebar+TopBar+main+MIAIndicator en `<AppLayout>` (reemplaza el div `data-layout-root` inline). |
| `src/app/layout.tsx` | Modificar | Import `@/styles/design-system.css` tras `./globals.css`. |
| `src/components/dashboard/TopBar.tsx` | Modificar | Montar `<ModuleSelector />` antes de SignalIndicator. |
| `docs/checkpoints/active-subaru-checkpoint.md` | Modificar | Este checkpoint (blueprint → completado). |

### 2.2 Pasos atómicos
- [x] **Paso 1:** Gobernanza: clasificar tarea y aprobación del concilio.
- [ ] **Paso 2 (SUBARU):** Escribir este blueprint ANTES de codificar (plan atómico + comandos de validación).
- [x] **Paso 3:** Crear `src/styles/design-system.css` (terreno + módulos + glow).
- [x] **Paso 4:** Crear `src/components/layout/AppLayout.tsx` (contexto + selector).
- [x] **Paso 5:** Cablear `dashboard/layout.tsx`, `app/layout.tsx` y `TopBar.tsx`.
- [x] **Paso 6:** Gates de calidad (comandos abajo).
- [x] **Paso 7 (SUBARU):** Marcar checkpoint como Completado y sincronizar.

> ⚠ **Paso 2 quedó pendiente en la ejecución real** (se corrige con este
> commit). El blueprint se documentó después de implementar; en adelante se
> congela y se pushea en el paso 2.

### 2.3 Comandos de validación obligatorios
```
npm run lint
npm run build
npm run test:unit
npm test
# Chrome DevTools MCP: data-theme, data-module, accentos por módulo, consola limpia
```

## 3. Evidencia de Ejecución
- **Gates:** lint 0/0 · build OK (78 páginas) · unit 492 ✓ · e2e 66 ✓ (2 skipped) · DevTools: acentos `#1e5a99`(ventas)/`#2d8a5e`(inventario)/`#d4743a`(logística), dark `#6ca8e0`/`#6ec29c`/`#f0a35e`, sin errores de consola.
- **Commits:** `ebb65ab` implementación + `af80ab7` `docs: regenerate MASTER.md at f01e936` (previo, otro autor).
- **Manifest:** `.governance/tasks/TASK-20260809-231109825.json` (aprobado por 6 agentes, completado).

## 4. Comando de Resurrección (una línea)
```
git -C C:\Users\david\mia pull origin main
```
En Linux/macOS: `git -C ~/mia pull origin main`
