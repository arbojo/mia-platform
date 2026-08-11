---
task_id: tenant-edition-premier
title: Edicion por negocio (tenant) - capabilities premier Vitanova + fix estado canal
state: blueprint_ready
current_step: 0
total_steps: 7
branch: main
last_machine: Deivis-Desktop
governance_id: TASK-20260811-072155412
created: 2026-08-11T03:20:00.000Z
updated: 2026-08-11T07:23:33.984Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Edicion por negocio (tenant) - capabilities premier Vitanova + fix estado canal

Aprobación: TASK-20260811-072155412.

## Scope

- Migración `supabase/migrations/037_business_edition.sql`: columna `edition` en `businesses` (nullable, CHECK en las 4 ediciones, NULL = env global).
- `src/lib/system/edition.ts`: resolución de edición efectiva por negocio (`getEffectiveEdition(businessId)`, server-only, DB primero, fallback a `getEdition()`).
- `src/app/dashboard/connections/page.tsx`: `whatsAppEnabled` por negocio (no global).
- Consistencia de interfaz completa del tenant premier: `delivery/page.tsx` e `inventory/page.tsx` resuelven por negocio.
- Rutas baileys server-side (`session`, `reconnect`, `ws-token`): enforcement de capacidad whatsapp por `businessId`.
- Backfill Vitanova `4fb7418d-6c98-4a09-9094-4e4e4b2006a6` → `edition='professional'`.
- Fix anti-zombie: sincronizar `channel_connections.status` cuando la sesión del bridge conecta/desconecta.

## Non-goals

- NO tocar el bridge Fly.io ni sus credenciales.
- NO implementar Meta Cloud API.
- NO cambiar el modelo de `profiles` (role demo/user/admin se mantiene).
- NO cambiar el default global `MIA_EDITION=evaluation` en Vercel (queda como fallback).
- NO introducir licensing/facturación.
- NO tocar el dominio de ventas (ADR-010), RLS ni la resolución síncrona existente.

## Approved plan

Pasos atómicos aprobados por el Council:

- [ ] **Paso 1:** Migración 037: `ALTER TABLE public.businesses ADD COLUMN edition text` CHECK (evaluation, professional, enterprise, cloud), NULL por defecto; backfill Vitanova → 'professional'.
- [ ] **Paso 2:** `edition.ts`: añadir `getEffectiveEdition(businessId)` async (admin client, DB-first, fallback a `getEdition()`); mantener helpers síncronos intactos.
- [ ] **Paso 3:** UI por negocio: `connections/page.tsx` (whatsAppEnabled), `delivery/page.tsx` e `inventory/page.tsx` resuelven la edición efectiva del negocio.
- [ ] **Paso 4:** Enforcement server-side: rutas baileys (`session`, `reconnect`, `ws-token`) validan capacidad whatsapp por `businessId` (403 si no).
- [ ] **Paso 5:** Fix desfase: sincronizar `channel_connections.status` (connected/disconnected) según el estado real del bridge.
- [ ] **Paso 6:** QA: lint, build, typecheck, unit tests, Playwright, verificación Chrome DevTools en dev.
- [ ] **Paso 7:** Commit + push origin main + deploy Vercel + verificación en producción (tarjeta WhatsApp visible para Vitanova; perfil nuevo gateado).

## Current state

- Misión congelada (state: blueprint_ready). Pasos pendientes: 1..7.

## Next action

Implementar el Paso 1 (el CLI actualiza esta sección con cada mark).

## Constraints

- Migraciones inmutables: solo migración nueva (037), nunca tocar las aplicadas.
- Edición por negocio leída SOLO con admin client server-side; nunca exponer capacidad al bundle del cliente ni a la Data API pública.
- El gate de demo (`isDemoLead`) se mantiene: leads demo/trial no ven WhatsApp aunque el negocio sea premier.
- WhatsApp session credentials (whatsapp_sessions) jamás por la Data API (RLS forced, service role only — ADR-013).
- Vercel sigue en `MIA_EDITION=evaluation` como fallback global para negocios sin `edition`.
- TASK-20260811-072155412 aprobado por el Council.

## Verification

- Gates: lint, build, unit_tests, e2e_tests, chrome_devtools, security_review, typecheck.
- Funcional: en producción, arbojo/Vitanova ven la tarjeta WhatsApp (y QR si reconecta); un business sin `edition` queda con capacidades de evaluation.
- Estado de canal: `channel_connections.status` refleja `connected` cuando el bridge lo reporta.

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción.
5. Continuar el paso indicado y ejecutar `subaru mark tenant-edition-premier <n>`.
6. Al final: `subaru complete tenant-edition-premier`.
