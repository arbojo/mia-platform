---
task_id: TASK-20260813-074636033
title: Bridge WhatsApp: defensa de llamadas (reject + cooldown) y notas de voz (payload audio a MIA + fallback acotado)
state: in_progress
current_step: 7
total_steps: 8
branch: main
last_machine: archlinux
governance_id: TASK-20260813-074636033
created: 2026-08-13T08:03:39.659Z
updated: 2026-08-13T08:42:34.286Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Bridge WhatsApp: defensa de llamadas (reject + texto con cooldown) y notas de voz (payload audio → cerebro MIA, fallback local acotado)

Aprobación: TASK-20260813-074636033.

## Scope

- `services/whatsapp-bridge/src/config.ts` — nueva sección `defensive`
- `services/whatsapp-bridge/src/guards.ts` — NUEVO módulo: cooldown store (TTL + cap + poda en inserción)
- `services/whatsapp-bridge/src/session-manager.ts` — estado a nivel manager, handler `call`, fallback de audio
- Webhook MIA: manejo de `payload.type === 'audio'` (`src/app/api/channels/baileys/webhook`)
- `docs/adr/024-whatsapp-bridge-defensive-block.md` — ADR de la decisión (memory_engineer)

## Non-goals

- NO transcripción de audio (whisper/OpenAI) — dependencias binarias en Windows y latencia
- NO persistencia de cooldowns a Supabase/disco — antispam ≠ rate-limit de seguridad
- NO manejo de llamadas de grupo (`isGroup: true` → ignorar)
- NO fallback de texto para mensajes NO-audio cuando MIA está caída
- NO cambio del loop secuencial de `handleMessages` (deuda pre-existente anotada, no se toca)
- NO cambios de schema

## Approved plan

Pasos atómicos aprobados por el Council:

- [x] **Paso 1:** Configuración del bloque de defensa en config.ts
  - Objetivo: exponer textos y ventanas de cooldown configurables
  - Archivos: services/whatsapp-bridge/src/config.ts
  - Acción: agregar sección `defensive` a `BridgeConfig` y a `loadConfig()`: callRejectText, callRejectCooldownMs (default 60000), audioFallbackText, audioFallbackCooldownMs (default 30000), audioWebhookTimeoutMs (default 10000); sobrecarga por env con defaults
  - Dependencia: ninguna
  - Criterio de terminación: `config.loadConfig()` expone los 5 campos con defaults/env
  - Gate/verificación: npm run typecheck (bridge)

- [x] **Paso 2:** Módulo guards.ts — cooldown store con TTL + cap + poda
  - Objetivo: antirrebote síncrono sin fuga de memoria
  - Archivos: services/whatsapp-bridge/src/guards.ts (NUEVO)
  - Acción: `createCooldownStore({ maxEntries, windowMs })` → `{ check(jid): boolean }` síncrono; entrada `{ expiresAt }`; poda en inserción (size > cap → borrar expirados, luego los más viejos por orden de inserción del Map); sin timers
  - Dependencia: ninguna (lógica pura, sin I/O)
  - Criterio de terminación: burst del mismo jid → solo 1 `true` por ventana; cap respetado; entradas expiradas no bloquean
  - Gate/verificación: npm run typecheck (bridge)

- [x] **Paso 3:** Estado a nivel SessionManager (cooldowns + timers pendientes)
  - Objetivo: que el cooldown sobreviva a 'close' transitorios (microcortes)
  - Archivos: services/whatsapp-bridge/src/session-manager.ts
  - Acción: `cooldownCalls` y `cooldownAudio` = Map<businessId, CooldownStore> a nivel de instancia (NO en ActiveSession); `pendingReplyTimers` = Map<businessId, Set<NodeJS.Timeout>>; limpiar timers en disconnect() y en 'close' con logout; NO borrar cooldowns en 'close' transitorio (session-manager.ts:400 borra el objeto sesión → el estado del manager sobrevive)
  - Dependencia: Paso 2
  - Criterio de terminación: desconexión transitoria no resetea cooldowns; logout/disconnect limpia timers
  - Gate/verificación: npm run typecheck (bridge)

- [x] **Paso 4:** Handler del evento 'call' (reject + texto defensivo)
  - Objetivo: cortar la llamada de protocolo y avisar 1x/ventana/llamante
  - Archivos: services/whatsapp-bridge/src/session-manager.ts
  - Acción: `socket.ev.on('call', calls => void handleCallEvent(...).catch(log))`; filtrar `status === 'offer' && !isGroup`; `cooldownCalls.get(businessId).check(from)` síncrono; `rejectCall(call.id, call.from).catch()`; timer ~1s que captura businessId y re-resuelve `this.sessions.get(businessId)` (status connected + socket.user?.id) antes de enviar `callRejectText` a `call.from`
  - Dependencia: Pasos 2 y 3
  - Criterio de terminación: llamada entrante → rechazo inmediato + 1 texto/ventana; spam no duplica texto; microcorte no resetea
  - Gate/verificación: npm run typecheck + build (bridge)

- [x] **Paso 5:** Audio → payload { type: 'audio' } + fallback local acotado
  - Objetivo: que el cerebro MIA redacte, y el bridge nunca quede mudo
  - Archivos: services/whatsapp-bridge/src/session-manager.ts
  - Acción: extractMessage: audio → `{ content, payload: { type: 'audio' } }`; extender tipo `MessagePayload` con `{ type: 'audio' }`; en handleMessages, si `miaReply === null && payload.type === 'audio' && cooldownAudio.get(businessId).check(waId)` → enviar `audioFallbackText`; usar timeout de webhook reducido (`audioWebhookTimeoutMs`) para el forward de audio
  - Dependencia: Pasos 1, 2
  - Criterio de terminación: 3 audios con MIA caída → 1 fallback/30s; con MIA arriba → responde MIA, sin fallback
  - Gate/verificación: npm run typecheck + build (bridge)

- [x] **Paso 6:** Webhook MIA — distinguir payload.type === 'audio'
  - Objetivo: que la IA redacte la respuesta a notas de voz con su estilo
  - Archivos: src/app/api/channels/baileys/webhook (y donde processIncomingMessage consume payload)
  - Acción: detectar `payload.type === 'audio'` y redactar respuesta natural (sin el literal crudo '[Audio recibido]'); `deliver` sigue controlado por MIA
  - Dependencia: Paso 5 (contrato)
  - Criterio de terminación: un audio produce una respuesta on-brand de MIA; sin cambios de schema
  - Gate/verificación: npm run lint + build (raíz)

- [x] **Paso 7:** Gates de calidad
  - Objetivo: verificar que no se rompió nada
  - Archivos: ninguno (verificación) + ADR-024 si falta
  - Acción: bridge: `npm run typecheck && npm run build`; raíz: `npm run lint && npm run build`; documentar ADR-024 (decisión del bloque de defensa)
  - Dependencia: Pasos 1-6
  - Criterio de terminación: typecheck, build y lint en 0 errores/0 warnings; ADR-024 presente
  - Gate/verificación: lint, build, typecheck

- [ ] **Paso 8:** Cierre — commit + push + governance complete + subaru complete
  - Objetivo: entregar la misión (regla: solo local = no entregado)
  - Archivos: todos los del scope
  - Acción: Release Manager: git add + commit atómico (convenciones Sección 15) + push origin main; governance complete; subaru complete --confirm-gates
  - Dependencia: Paso 7
  - Criterio de terminación: working tree clean, remoto sincronizado, manifest governance completed
  - Gate/verificación: gates del manifest governance (lint, build, unit_tests, e2e_tests, chrome_devtools, security_review, performance_review)

## Current state

- Misión congelada (state: frozen). Pasos pendientes: 1..8.

## Next action

Implementar el Paso 8 (ver sección "Approved plan") y luego ejecutar `subaru mark TASK-20260813-074636033 8`.

## Constraints

- ADR-013: el bridge es transporte, MIA es el cerebro. Textos defensivos SOLO si MIA no responde (miaReply === null).
- Rechazar cada oferta de llamada; el TEXTO solo 1x/ventana/llamante (ventanas: 60s llamada, 30s audio).
- Estado de cooldown a nivel SessionManager keyed por businessId: sobrevive 'close' transitorio; muere solo con el proceso (aceptado por el Council).
- Timers de reply capturan businessId y re-resuelven la sesión viva al disparar; se limpian en logout/disconnect, NO en 'close' transitorio.
- Llamadas de grupo: ignorar. Ofertas offline: responder igual (reject es no-op, texto invita a escribir).
- Sin `any` ni tipos implícitos (TS strict). Sin cambios de schema. Sin secretos en el checkpoint.
- Textos de cara al cliente en config.ts (aprobados por PM): llamada → 'Hola! Por el volumen de mensajes que tengo no puedo contestar llamadas, escríbeme y con gusto te atenderé.'; audio → 'No puedo escuchar notas de voz por aquí, escríbemelo por favor.'
- El evento 'call' llega como ARRAY con múltiples status: filtrar `status === 'offer'` (Baileys messages-recv.js:1485 emite `[call]`).
- Contrato `rejectCall(callId, callFrom)` — firmado así en Baileys (messages-recv.js:366).

## Verification

- Gates obligatorios (manifest governance TASK-20260813-074636033): lint, build, unit_tests, e2e_tests, chrome_devtools, security_review, performance_review.
- Pruebas runtime QA: (1) llamada entrante → rechazo + texto 1x/60s; (2) 3 audios seguidos con MIA caída → 1 fallback/30s; (3) microcorte de red → cooldown sobrevive (sin doble texto); (4) texto a LID jid en llamada (verificación runtime).

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción.
5. Continuar el paso indicado y ejecutar `subaru mark TASK-20260813-074636033 <n>`.
6. Al final: `subaru complete TASK-20260813-074636033`.
