---
task_id: bridge-stability
title: Estabilizar conectividad bridge WhatsApp: host unico Fly.io, MIA_APP_URL prod, puertos 3001, anti-crash
state: in_progress
current_step: 3
total_steps: 4
branch: main
last_machine: DESKTOP-VN2R21O
governance_id: TASK-20260812-073916531
created: 2026-08-11T22:22:34.578Z
updated: 2026-08-12T22:56:38.029Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Estabilizar conectividad bridge WhatsApp: host unico Fly.io, MIA_APP_URL prod, puertos 3001, anti-crash

Aprobación: TASK-20260812-073916531.

## Scope

- `services/whatsapp-bridge/Dockerfile` — EXPOSE 8787 → 3001
- `services/whatsapp-bridge/src/config.ts` — default `BRIDGE_PORT` 8787 → 3001
- `services/whatsapp-bridge/fly.toml` — verificar `internal_port` = 3001
- `services/whatsapp-bridge/src/session-manager.ts` — try/catch en `creds.update` (saveCreds) y handlers Baileys
- `services/whatsapp-bridge/src/mia-client.ts` — `sendToMia` sin throw no capturado (fetch)
- Infra Fly.io — `fly secrets set MIA_APP_URL=https://mia-platform-psi.vercel.app` (requiere flyctl)
- Instancia local del bridge en la Dell (PID 10332) — detener para eliminar `conflict type: replaced`
- `docs/adr/013-whatsapp-baileys-bridge.md` — actualizar a Baileys ^7.0.0-rc14 + regla de host único

## Non-goals

- NO cambiar la lógica de negocios del bridge ni los formatos de mensajes
- NO tocar el webhook de Vercel ni los secrets de Vercel (ya verificados: URL + secret coinciden)
- NO migrar el bridge a otra plataforma distinta de Fly.io
- NO modificar migrations de Supabase ni esquema
- NO reescribir el protocolo de autenticación Baileys

## Approved plan

Pasos atómicos aprobados por el Council:

- [x] **Paso 1:** Estandarizar puertos del bridge en 3001
  - Objetivo: eliminar la divergencia de puertos que impide al contenedor en Fly escuchar donde el ingress espera
  - Archivos: `services/whatsapp-bridge/Dockerfile`, `services/whatsapp-bridge/src/config.ts`, `services/whatsapp-bridge/fly.toml`
  - Acción: cambiar `EXPOSE 8787` → `3001`, default de `config.ts` → `3001`, verificar `internal_port` en `fly.toml`
  - Dependencia: ninguna
  - Criterio de terminación: `BRIDGE_PORT` default 3001, Dockerfile EXPOSE 3001, fly.toml internal_port 3001
  - Gate/verificación: revisión de archivos + `tsc --noEmit` del bridge

- [x] **Paso 2:** Endurecer handlers del bridge (anti unhandled rejection)
  - Objetivo: ningún evento Baileys ni `fetch()` puede lanzar una promesa no manejada que derribe el proceso Node 22
  - Archivos: `services/whatsapp-bridge/src/session-manager.ts`, `services/whatsapp-bridge/src/mia-client.ts`
  - Acción: envolver `socket.ev.on('creds.update', saveCreds)` y todos los `ev.on` en try/catch; `sendToMia` con `try/catch` sobre `fetch` y log de error sin rethrow
  - Dependencia: ninguna
  - Criterio de terminación: todos los handlers protegidos; `sendToMia` no propaga errores de fetch al socket
  - Gate/verificación: `tsc --noEmit` del bridge + revisión de código

- [x] **Paso 3:** Corregir MIA_APP_URL en Fly.io y verificar estabilidad de producción
  - Objetivo: los webhooks del bridge llegan a Vercel (prod) y la máquina no entra en crash-loop
  - Archivos: infra Fly.io (secrets/env), `.infrastructure` (fingerprint), instancia local
  - Acción: instalar `flyctl` (con confirmación del usuario); `fly secrets set MIA_APP_URL=https://mia-platform-psi.vercel.app`; redeploy con puerto/handlers corregidos; detener bridge local (PID 10332) para eliminar conflicto de sesión
  - Dependencia: pasos 1 y 2 (redeploy incluye sus cambios)
  - Criterio de terminación: `MIA_APP_URL` fijado en prod; `/healthz` responde <2s; sin `stream:error conflict/replaced` en logs; instancia local detenida
  - Gate/verificación: `curl /healthz` de Fly, revisión de logs Fly, `git status` sin bridge local corriendo

- [ ] **Paso 4:** Actualizar ADR-013 y verificación final + gates
  - Objetivo: la documentación refleja el estado real y la regla de host único
  - Archivos: `docs/adr/013-whatsapp-baileys-bridge.md`
  - Acción: actualizar versión de Baileys a `^7.0.0-rc14`, documentar host único Fly.io como canónico, puerto 3001 y la regla anti-duplicidad de instancias
  - Dependencia: pasos 1-3
  - Criterio de terminación: ADR actualizado y coherente; gates `lint` + `build` pasando; reporte final con evidencia
  - Gate/verificación: `subaru complete bridge-stability --confirm-gates`

## Current state

- Misión congelada (state: frozen). Pasos pendientes: 1..4.

## Next action

Implementar el Paso 4 (ver sección "Approved plan") y luego ejecutar `subaru mark bridge-stability 4`.

## Constraints

- ADR-013: host único canónico para el bridge; nunca dos instancias compitiendo por el mismo socket Baileys (causa `conflict type: replaced`)
- Governance TASK-20260812-073916531 aprobada por 9 agentes; `in_progress` (start previo al freeze aceptado por WorkflowEngine)
- No exponer secretos: `WHATSAPP_BRIDGE_SECRET`, credenciales de sesión y service role solo por variable de entorno
- Vercel prod = `mia-platform-psi.vercel.app`; `WHATSAPP_BRIDGE_URL` y secret ya alineados (SHA-256 coincidente)
- No tocar migrations de Supabase; no tocar lógica de negocio del bridge
- Detener la instancia local SOLO como parte del paso 3, tras confirmar que Fly queda sano
- Instalación de `flyctl` requiere confirmación explícita del usuario (Infrastructure Bootstrap: recomendar, no auto-instalar tools externas)

## Verification

- `npm run lint` — 0 errores (2 warnings pre-existentes en `coverage/` gitignored)
- `npm run build` — Next.js build OK (tras `npm install` de `read-excel-file`)
- `tsc --noEmit` en `services/whatsapp-bridge`
- `/healthz` de Fly.io < 2s y sin crash-loop
- Logs Fly sin `stream:error conflict/replaced`
- Webhook Vercel responde 200 con secreto correcto

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción.
5. Continuar el paso indicado y ejecutar `subaru mark bridge-stability <n>`.
6. Al final: `subaru complete bridge-stability`.
