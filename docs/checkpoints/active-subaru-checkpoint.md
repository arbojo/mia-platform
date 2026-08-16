---
task_id: 5
title: Glass Overlay Blur - transicion al cambiar de vista
state: in_progress
current_step: 3
total_steps: 5
branch: main
last_machine: Deivis-Desktop
governance_id: TASK-20260816-224949925
created: 2026-08-13T23:56:05.761Z
updated: 2026-08-16T23:01:39.226Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Glass Overlay Blur - transicion al cambiar de vista

Aprobación: TASK-20260816-224949925.

## Scope

- Transición de carga del dashboard MIA (frontend, dominio sales): reemplazar el swap a pantalla de "Cargando…" (`src/app/dashboard/loading.tsx`) por un Glass Overlay Blur que mantiene el contenido previo visible y desenfocado al navegar entre vistas.
- Archivos: `src/app/globals.css` (CSS del overlay + glow spinner), `src/components/ui/mia-glow-spinner.tsx` (NUEVO), `src/components/ui/glass-loader.tsx` (NUEVO), `src/app/dashboard/layout.tsx` (montaje), `src/app/dashboard/loading.tsx` (ELIMINAR), `tests/component/glass-loader.test.tsx` (NUEVO).
- Gobernanza: TASK-20260816-224949925 (COMPLEX, 6 agentes aprobados).

## Non-goals

- NO cubrir cargas de datos dentro de una misma vista (los spinners locales se conservan).
- NO activar el overlay en cambios solo de searchParams (filtros).
- NO cambiar componentes, hooks ni lógica del resto de la app (sin regresiones).
- NO tocar schema, backend, ni AI behavior.

## Approved plan

Pasos atómicos aprobados por el Council:

- [x] **Paso 1:** CSS del Glass Overlay + componente glow spinner
  - Objetivo: base visual del overlay (blur + fade) y spinner reutilizable.
  - Archivos: `src/app/globals.css`, `src/components/ui/mia-glow-spinner.tsx`
  - Acción: añadir `.glass-loader-overlay` (fixed inset 0, rgba(15,23,42,0.4), backdrop-filter blur(12px), flex centrado, z-index 9999, opacity 0, pointer-events none, transición opacity 0.3s cubic-bezier(0.4,0,0.2,1)), `.glass-loader-overlay.active` (opacity 1, pointer-events auto), `.mia-glow-spinner` (48px, border 3px rgba(255,255,255,0.1), border-top #8b5cf6, border-right #06b6d4, miaSpin 0.8s linear infinite), `@keyframes miaSpin` y respeto a `prefers-reduced-motion`. Componente `MiaGlowSpinner` con role=status/aria-live y label sr-only.
  - Dependencia: ninguna
  - Criterio de terminación: CSS presente en globals.css y componente compila.
  - Gate/verificación: lint + build

- [x] **Paso 2:** Componente GlassLoader con detección global de navegación
  - Objetivo: overlay client que se activa SOLO en navegación entre vistas.
  - Archivos: `src/components/ui/glass-loader.tsx`
  - Acción: activación por click capture en anchors internos (excluye modificadores, _blank, defaultPrevented), `popstate` (back/forward) y cambio de `usePathname` (catch-all de router.push). Desactivación tras duración mínima (~450ms) con fade-out. Ignora cambios solo de searchParams. A11y: aria-hidden cuando inactivo.
  - Dependencia: Paso 1
  - Criterio de terminación: componente implementado según lógica aprobada.
  - Gate/verificación: lint + build

- [x] **Paso 3:** Integración en layout + eliminación de loading.tsx + tests unitarios
  - Objetivo: montar el overlay en el dashboard y eliminar el swap de contenido.
  - Archivos: `src/app/dashboard/layout.tsx`, `src/app/dashboard/loading.tsx` (eliminar), `tests/component/glass-loader.test.tsx`
  - Acción: montar `<GlassLoader />` dentro de AppLayout (junto a MIAIndicator); eliminar `dashboard/loading.tsx` para que la vista previa permanezca montada bajo el blur; tests (activación por pathname, searchParams ignorado, click anchor, popstate, fade-out tras duración mínima, modificadores).
  - Dependencia: Paso 2
  - Criterio de terminación: 8 tests de glass-loader pasan.
  - Gate/verificación: unit_tests (project component)

- [ ] **Paso 4:** Gates de calidad — lint, build, unit, e2e
  - Objetivo: verificar que no hay regresiones en todo el proyecto.
  - Archivos: (ninguno — validación)
  - Acción: `npm run lint` (0/0), `npm run build`, `npx vitest run` (suite completa), `npm test` (e2e).
  - Dependencia: Paso 3
  - Criterio de terminación: lint 0 errores/0 warnings; build OK; unit 718/718; e2e 66 passed / 2 skipped.
  - Gate/verificación: lint, build, unit_tests, e2e_tests

- [ ] **Paso 5:** Verificación DevTools + security + cierre
  - Objetivo: confirmar overlay servido en el bundle, consola limpia y sin implicaciones de seguridad.
  - Archivos: (ninguno — validación)
  - Acción: servidor de producción + navegación con Playwright: `/login` 200, bundle CSS contiene `.glass-loader-overlay`, `.glass-loader-overlay.active`, `.mia-glow-spinner`, `miaSpin`; `/dashboard` sin sesión redirige a login; 0 errores/warnings de consola. Security review: sin cambios de datos/acceso (UI client-only, no security implications).
  - Dependencia: Paso 4
  - Criterio de terminación: checks de CSS y consola OK; security_review sin hallazgos.
  - Gate/verificación: chrome_devtools, security_review


## Current state

- Misión congelada (state: frozen). Pasos pendientes: 1..5.

## Next action

Implementar el Paso 4 (ver sección "Approved plan") y luego ejecutar `subaru mark 5 4`.

## Constraints

- Respetar la spec CSS del usuario (exacta): colores #8b5cf6 / #06b6d4, blur 12px, z-index 9999, transición cubic-bezier(0.4,0,0.2,1).
- Gobernanza: no implementar sin manifest aprobado (TASK-20260816-224949925).
- Evidence First (ADR-011): hallazgos con evidencia file:line.
- Convención: CSS en globals.css (precedente elastic-pop), componente bajo `src/components/ui/`.
- No romper existente: sin regresiones en lint/build/unit/e2e.

## Verification

- Gates obligatorios (manifest governance): lint, build, unit_tests, e2e_tests, chrome_devtools, security_review.
- Estado de ejecución: pasos 1-5 completados durante la misión; `subaru complete 5 --confirm-gates` al cierre.

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción.
5. Continuar el paso indicado y ejecutar `subaru mark 5 <n>`.
6. Al final: `subaru complete 5`.
