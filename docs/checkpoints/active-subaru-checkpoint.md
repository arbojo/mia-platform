---
task_id: whatsapp-edition-sync
title: WhatsApp en produccion: edition por tenant + reconciliacion read-path del estado
state: completed
current_step: 6
total_steps: 6
branch: main
last_machine: Deivis-Desktop
governance_id: TASK-20260812-035924427
created: 2026-08-11T22:22:34.578Z
updated: 2026-08-12T05:40:21.114Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

WhatsApp en produccion: edition por tenant + reconciliacion read-path del estado

Aprobación: TASK-20260812-035924427.

## Scope

- `supabase/migrations/037_business_edition.sql` — columna `edition` en `businesses` + backfill Vitanova -> enterprise (aplicar en Supabase prod).
- `src/lib/system/edition.ts` — `getEffectiveEdition()` DB-first con fallback a `MIA_EDITION`, `canBusinessUseWhatsApp()` (guard 403).
- `src/app/dashboard/connections/page.tsx` — resolver `whatsAppEnabled` desde la edition del negocio del usuario (no solo env).
- `src/app/api/channels/baileys/session/route.ts` — guard de edicion en POST + reconciliacion read-path en GET.
- `src/components/connections/ConnectionsManager.tsx` — `refreshConnections()` tras `refreshWaStatus()` con estado resuelto.
- `workshop/governance/classify-whatsapp-edition-sync.script.ts` + manifests `.governance/tasks/TASK-20260812-035924427.json`.
- Deploy: migracion 037 en Supabase prod + `vercel --prod`.

## Non-goals

- NO redeploy del bridge (services/whatsapp-bridge) ni cambio de sus rutas.
- NO tocar el paywall delivery/inventory (`DeliveryPaywall.tsx`, `delivery/page.tsx`, `inventory/page.tsx`) — queda fuera de esta mision y sin commitear.
- NO cambios de AI, prompts, ni nuevos endpoints.
- NO alterar RLS ni el esquema multi-tenant mas alla de la columna edition.

## Approved plan

Pasos atómicos aprobados por el Council:

- [x] **Paso 1:** Reconciliacion read-path del estado en GET session
  - Objetivo: `channel_connections.status` deja de quedar atrapado en "connecting" y refleja el estado real del bridge.
  - Archivos: `src/app/api/channels/baileys/session/route.ts`.
  - Acción: en `GET`, tras `getBridgeSessionStatus`, reconciliar `channel_connections.status` con `createAdminClient()` (patron de DELETE) cuando el estado difiera; idempotente y best-effort (no rompe el GET si el write falla).
  - Dependencia: ninguna.
  - Criterio de terminación: GET devuelve el estado del bridge y, si difiere, persiste el nuevo estado en channel_connections.
  - Gate/verificación: `lint`, `build`, `unit_tests`.

- [x] **Paso 2:** Frontend refresca la fila tras el sync de estado
  - Objetivo: la fila de la lista de conexiones muestra el mismo estado que la tarjeta WhatsApp.
  - Archivos: `src/components/connections/ConnectionsManager.tsx`.
  - Acción: tras `refreshWaStatus()` con estado resuelto (connected/disconnected/idle), llamar `refreshConnections()` para que la fila relea el estado reconciliado.
  - Dependencia: Paso 1.
  - Criterio de terminación: la fila de whatsapp ya no queda en "Conectando..." cuando el bridge reporta otro estado; tests de componente siguen verdes.
  - Gate/verificación: `lint`, `build`, `unit_tests`, `e2e_tests`.

- [x] **Paso 3:** Migracion 037 aplicada en Supabase prod
  - Objetivo: la columna `edition` existe en prod y Vitanova es `enterprise`.
  - Archivos: `supabase/migrations/037_business_edition.sql` (aplicar en la DB remota).
  - Acción: ejecutar el SQL de la migracion 037 contra la instancia Supabase de produccion (columna edition + backfill Vitanova).
  - Dependencia: —
  - Criterio de terminación: `SELECT edition FROM businesses WHERE id='4fb7418d-...'` retorna `enterprise`; columnas sin edition quedan NULL (fallback env).
  - Gate/verificación: `security_review`.

- [x] **Paso 4:** Gates de calidad
  - Objetivo: lint/build/unit/component/e2e verdes.
  - Archivos: repo (sin cambios de producto).
  - Acción: `npm run lint`, `npm run build`, `npm run test:unit`, `npm run test:component`, `npm test`.
  - Dependencia: Pasos 1-3.
  - Criterio de terminación: lint 0/0, build sin errores, tests verdes.
  - Gate/verificación: `lint`, `build`, `unit_tests`, `e2e_tests`, `chrome_devtools`, `typecheck`.

- [x] **Paso 5:** Commits atomicos + push
  - Objetivo: entregar el fix con commits separados del paywall delivery.
  - Archivos: edition (edition.ts, page.tsx, migration, session route) + reconciliation (session route, ConnectionsManager) + governance artifacts.
  - Acción: commits convencionales separados (`feat`, `fix`, `chore(governance)`), SIN incluir DeliveryPaywall ni delivery/inventory pages; push a origin/main.
  - Dependencia: Paso 4.
  - Criterio de terminación: remoto sincronizado, working tree limpio (excepto paywall excluido a proposito).
  - Gate/verificación: `security_review`.

- [x] **Paso 6:** Deploy Vercel prod + verificacion final
  - Objetivo: la tarjeta WhatsApp visible para Vitanova y el estado sincronizado en produccion.
  - Archivos: deploy (sin codigo).
  - Acción: `vercel --prod`, verificar HTTP 200, tarjeta WhatsApp renderizada para Vitanova, fila de conexion con estado real, sin errores de consola.
  - Dependencia: Paso 5.
  - Criterio de terminación: URL de produccion responde 200, tarjeta visible, estado sincronizado.
  - Gate/verificación: `chrome_devtools`, `e2e_tests`.

## Current state

- Misión whatsapp-edition-sync completada (6/6 pasos).
- Gates confirmados: ESLint (0 errors, 0 warnings), Production build (no errors), Unit tests pass, Playwright e2e tests pass, Chrome DevTools console and network check, Security Engineer review, TypeScript strict check.
- Finalizado: 2026-08-12T05:40:21.114Z.

## Next action

Todos los pasos marcados. Ejecutar `subaru complete whatsapp-edition-sync` cuando pasen los gates de verificación.

## Constraints

- Governance aprobado: TASK-20260812-035924427 (COMPLEX, 8 agentes: architect, database, backend, frontend, security, qa, release, memory_engineer).
- Writes de API server-side con admin client (patron DELETE); GET valida ownership antes de reconciliar.
- Capability por tenant (businesses.edition), nunca por identidad; leads demo con edition NULL caen a MIA_EDITION (gated).
- El CLI es la única autoridad del frontmatter del checkpoint; el body se autoriza antes del freeze.
- No escribir secretos en el checkpoint; secret scan bloquea freeze/mark/complete.
- No mezclar el paywall delivery en commits de esta mision.

## Verification

- Gates: lint, build, unit_tests, e2e_tests, chrome_devtools, security_review, typecheck.
- Unit: `npm run test:unit` y `npm run test:component` deben pasar 100%.
- Funcional: tarjeta WhatsApp visible para Vitanova; fila de conexion sincronizada con el bridge; leads demo gateados.
- Deploy: `vercel --prod` responde HTTP 200 sin errores de consola.

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción.
5. Continuar el paso indicado y ejecutar `subaru mark whatsapp-edition-sync <n>`.
6. Al final: `subaru complete whatsapp-edition-sync`.
