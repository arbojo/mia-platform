---
task_id: delivery-paywall
title: Delivery Hub paywall por tenant (ADR-019): gate con edition del negocio
state: in_progress
current_step: 3
total_steps: 4
branch: main
last_machine: Deivis-Desktop
governance_id: TASK-20260812-064235021
created: 2026-08-11T22:22:34.578Z
updated: 2026-08-12T06:47:50.705Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Delivery Hub paywall por tenant (ADR-019): gate con edition del negocio

Aprobación: TASK-20260812-064235021.

## Scope

- `src/components/delivery/DeliveryPaywall.tsx` — pantalla de upgrade de Delivery Hub (nuevo componente, ADR-019).
- `src/app/dashboard/delivery/page.tsx` — gate del módulo logístico con `canBusinessUseDeliveryHub(business.id)`; renderiza `<DeliveryPaywall/>` si el negocio no tiene la capacidad.
- `src/app/dashboard/inventory/page.tsx` — migrar el gate de `canUseInventoryHub()` (env global) a `canBusinessUseInventoryHub(business.id)`, coherente con la edition por tenant ya desplegada.
- Governance: `workshop/governance/classify-delivery-paywall.script.ts` + `.governance/tasks/TASK-20260812-064235021.json`.

## Non-goals

- NO tocar la lógica del Delivery Hub (`src/features/delivery-hub/`, `src/lib/delivery/`, schema `delivery`, portal `/driver`).
- NO cambios de schema, de AI, ni nuevos endpoints.
- NO alterar la edición global `MIA_EDITION` ni su fallback.
- NO modificar el paywall de Inventory (`InventoryPaywall.tsx`), solo su gate de página.
- NO reabrir la misión whatsapp-edition-sync (completada).

## Approved plan

Pasos atómicos aprobados por el Council:

- [x] **Paso 1:** Verificar DeliveryPaywall.tsx como componente aislado
  - Objetivo: el componente de upgrade de Delivery Hub existe y es autónomo (solo botones + copy, sin lógica de negocio).
  - Archivos: `src/components/delivery/DeliveryPaywall.tsx`.
  - Acción: revisar que el componente ya materializado use solo primitivas shadcn/ui (`Button`, `Card`) y navegue a `/dashboard/billing/upgrade`; sin dependencias de estado global ni lógica de negocio.
  - Dependencia: ninguna.
  - Criterio de terminación: componente <150 líneas, sin imports de datos/API, accesible (botones con texto descriptivo).
  - Gate/verificación: `lint`, `build`.

- [x] **Paso 2:** Gate tenant-scoped en delivery/page.tsx
  - Objetivo: el módulo logístico se activa por negocio (`canBusinessUseDeliveryHub`), no por env global.
  - Archivos: `src/app/dashboard/delivery/page.tsx`.
  - Acción: usar `await canBusinessUseDeliveryHub(business.id)` como gate de página; renderizar `<DeliveryPaywall/>` cuando la capacidad sea falsa; conservar `redirect` a onboarding y auth previos.
  - Dependencia: Paso 1.
  - Criterio de terminación: `DeliveryAdmin` solo se renderiza si el negocio tiene deliveryHub; si no, se muestra el paywall.
  - Gate/verificación: `lint`, `build`.

- [x] **Paso 3:** Gate tenant-scoped en inventory/page.tsx
  - Objetivo: el gate de inventario pasa del env global a la edition del negocio.
  - Archivos: `src/app/dashboard/inventory/page.tsx`.
  - Acción: reemplazar `canUseInventoryHub()` por `await canBusinessUseInventoryHub(business.id)`; el paywall de Inventory ya existe y no se toca.
  - Dependencia: Paso 2.
  - Criterio de terminación: `InventoryAdmin` solo se renderiza si el negocio tiene inventoryHub; `InventoryPaywall` mantiene su comportamiento.
  - Gate/verificación: `lint`, `build`.

- [ ] **Paso 4:** Gates de calidad + commit atómico + push + deploy
  - Objetivo: entregar el paywall sin dejar deuda de proceso en el working tree.
  - Archivos: repo (delivery/page.tsx, inventory/page.tsx, DeliveryPaywall.tsx, classify script, governance log).
  - Acción: `npm run lint`, `npm run build`, `npm run test:component`; commits separados (feat + chore(governance)); push a origin/main; `vercel --prod`; verificar HTTP 200 y paywall renderizado en un negocio sin enterprise.
  - Dependencia: Pasos 1-3.
  - Criterio de terminación: working tree limpio, remoto sincronizado, deploy vivo, sin errores de consola.
  - Gate/verificación: `lint`, `build`, `chrome_devtools`.

## Current state

- Misión congelada (state: frozen). Pasos pendientes: 1..4.
- Previo: misión whatsapp-edition-sync completada (edition por tenant + reconciliación read-path desplegados).
- Los 3 archivos del paywall ya existen en el working tree como cambios sin commitear; esta misión los formaliza.
- Dependencia de base: `getEffectiveEdition`/`canBusinessUseDeliveryHub`/`canBusinessUseInventoryHub` commiteados (b8c4756).

## Next action

Implementar el Paso 4 (ver sección "Approved plan") y luego ejecutar `subaru mark delivery-paywall 4`.

## Constraints

- Governance aprobado: TASK-20260812-064235021 (SIMPLE, 3 agentes: frontend, qa, memory_engineer; gates: lint, build).
- Capability por tenant (businesses.edition), nunca por identidad; negocios con edition NULL caen a MIA_EDITION (gated).
- El CLI es la única autoridad del frontmatter del checkpoint; el body se autoriza antes del freeze.
- No escribir secretos en el checkpoint; secret scan bloquea freeze/mark/complete.
- ADR-019: el Delivery Hub es un módulo aislado; el paywall es solo la puerta de entrada al dashboard admin.

## Verification

- Gates: lint, build (obligatorios); chrome_devtools (deploy).
- Component: `npm run test:component` debe seguir verde (30/30).
- Funcional: negocio sin enterprise ve `<DeliveryPaywall/>` en /dashboard/delivery; Vitanova (enterprise) sigue viendo `DeliveryAdmin`.
- Deploy: `vercel --prod` responde HTTP 200 sin errores de consola.

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción.
5. Continuar el paso indicado y ejecutar `subaru mark delivery-paywall <n>`.
6. Al final: `subaru complete delivery-paywall`.
