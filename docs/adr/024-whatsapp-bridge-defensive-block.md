# ADR-024: WhatsApp Bridge — Bloque Defensivo (Llamadas y Notas de Voz)

## Status

Accepted

## Date

2026-08-13

## Council

Aprobado por el Engineering Council (TASK-20260813-074636033, 9/9 agentes + Product Manager) en la deliberación del bloque defensivo del bridge. Decisiones ratificadas: Llamadas Opción A (rechazo de protocolo + texto con cooldown) y Audio Opción A (payload estructurado a MIA + fallback local acotado).

---

## 1. Context

El bridge Baileys tenía dos vacíos de defensa frente a entrada externa:

1. **Llamadas**: no existía ningún listener del evento `call` de Baileys. Una llamada entrante sonaba sin que el bot reaccionara: el cliente escuchaba el tono hasta que la plataforma lo cortaba por timeout, sin explicación ni alternativa.
2. **Notas de voz**: el `audioMessage` se reenviaba a MIA como el literal crudo `'[Audio recibido]'`, y la respuesta dependía de lo que la IA dijera ante ese texto (UX impredecible). Además, si MIA estaba caída, el bridge quedaba mudo.

Restricciones del diseño: cero latencia en la respuesta defensiva, sin procesamiento de binarios (no transcripción), y respeto a ADR-013 (el bridge es transporte, MIA es el cerebro: los textos de cara al cliente deben ser la excepción acotada, no la regla).

Análisis de impacto previo (Modo 2) identificó tres rendijas que el plan endurece:

- **Fuga de memoria**: un `Map<jid, timestamp>` sin cota crece con spammers que llaman una sola vez.
- **Amnesia tras reconexión**: el objeto `ActiveSession` se elimina en cualquier `connection === 'close'` (incluso microcortes) en `session-manager.ts:400`; el estado de cooldown colgado de la sesión moriría en cada reconexión.
- **Fallback en bucle**: 3 audios seguidos con MIA caída dispararían 3 textos idénticos.

## 2. Decision

### Llamadas — rechazo de protocolo + texto defensivo con cooldown

- Handler `socket.ev.on('call', ...)` que filtra `status === 'offer' && !isGroup` (el evento llega como array con múltiples statuses: `offer`, `ringing`, `accept`, `terminate`...; Baileys emite `ev.emit('call', [call])`).
- **Cada** oferta se rechaza a nivel de protocolo (`rejectCall(call.id, call.from)`), cortando el tono de inmediato.
- El **texto defensivo** se envía como máximo **1x por ventana (60s) por llamante**, vía cooldown en memoria.
- El texto se programa con un timer (~1s) que captura el `businessId` y **re-resuelve la sesión viva al dispararse** (`this.sessions.get(businessId)` + `status === 'connected'` + `socket.user?.id`), de modo que un microcorte recuperado dentro de la ventana no pierde la respuesta.
- Llamadas de grupo se ignoran. Las ofertas `offline` (llamada perdida mientras el bridge estaba caído) se responden igual: el rechazo es no-op y el texto invita a escribir.

### Audio — el cerebro redacta, el bridge nunca queda mudo

- El bridge mapea `audioMessage` → `payload: { type: 'audio' }` (extendiendo `MessagePayload` como unión discriminada en ambos lados del contrato).
- El webhook MIA (`BaileysAdapter.receiveMessage`) normaliza la nota de voz a un contenido descriptivo ("El cliente envió una nota de voz.") con `contentType: 'audio'`, de modo que la IA redacta la respuesta con su estilo y su voz.
- Si MIA no responde (`miaReply === null`) y el mensaje es audio, el bridge responde localmente con `audioFallbackText`, acotado a **1x por ventana (30s) por jid**.
- Los audios usan un **timeout de webhook reducido** (10s configurable) para que el fallback siga siendo casi instantáneo y no encola el loop de mensajes 30s.

### Estado anti-spam a nivel SessionManager (no en la sesión)

- `cooldownCalls` y `cooldownAudio` son `Map<businessId, CooldownStore>` **a nivel de instancia del manager**, no en `ActiveSession`: sobreviven a las recreaciones de sesión por microcortes y mueren solo con el proceso (aceptado: antispam ≠ garantía de rate-limit).
- `CooldownStore` (`guards.ts`) es una estructura síncrona con **TTL por entrada + cap duro (1024) + poda en inserción** (expirados primero, luego los más viejos por orden de inserción del Map). Sin timers internos → nada que limpiar ni que fugue. Memoria garantizada O(cap).
- Los timers de reply pendientes se registran en `pendingReplyTimers` y se limpian en logout/disconnect; **no** se limpian en un `close` transitorio.

### Contrato

- `sendToMia(config, message, timeoutMs?)` acepta timeout opcional (default 30s; audio 10s).
- `MessagePayload` pasa a unión discriminada: `{ type: 'quick_reply' | 'list'; id; title } | { type: 'audio' }` en el bridge y en `src/lib/channels/types.ts`.
- Textos de cara al cliente viven en `config.ts` (`defensive`), redactados y aprobados por Product Manager, sobrecargables por env:
  - Llamada: *"Hola! Por el volumen de mensajes que tengo no puedo contestar llamadas, escríbeme y con gusto te atenderé."*
  - Audio: *"No puedo escuchar notas de voz por aquí, escríbemelo por favor."*

## 3. Evidence

**Contrato de rechazo** — `services/whatsapp-bridge/node_modules/@whiskeysockets/baileys/lib/Socket/messages-recv.js:366`:
`const rejectCall = async (callId, callFrom) => ...`; expuesto en `WASocket.rejectCall(callId, callFrom)`.

**Evento call como array con statuses múltiples** — `messages-recv.js:1485`: `ev.emit('call', [call])`; `WACallEvent.status` incluye `offer | ringing | ... | reject | accept | terminate`; `isGroup`/`groupJid` solo poblados en `offer`.

**La sesión muere en cada close** — `services/whatsapp-bridge/src/session-manager.ts:398-400`: en `connection === 'close'` se hace `session.listeners.clear()` y `this.sessions.delete(businessId)`; `connect()` recrea un `ActiveSession` nuevo. Estado clave en el manager, no en la sesión.

**El fallback solo dispara con MIA caída** — `src/mia-client.ts:46-53,55-59`: `sendToMia` retorna `null` ante webhook inalcanzable/error/timeout; `handleMessages` usa ese retorno, por lo que el fallback nunca compite con una respuesta exitosa de MIA.

**Audio previo sin payload** — `session-manager.ts` (extractMessage): `if (audio) return { content: '[Audio recibido]', payload: { type: 'audio' } }` (tras este ADR).

## 4. Scope

- `services/whatsapp-bridge/src/config.ts` — sección `defensive`.
- `services/whatsapp-bridge/src/guards.ts` — NUEVO `CooldownStore` (TTL + cap + poda).
- `services/whatsapp-bridge/src/session-manager.ts` — estado a nivel manager, handler `call`, fallback de audio, timers re-resolviendo sesión viva.
- `services/whatsapp-bridge/src/mia-client.ts` — timeout configurable.
- `src/lib/channels/types.ts` + `src/lib/channels/adapters/baileys.ts` — unión de payload y normalización de audio en MIA.

## 5. Consequences

- Las llamadas se cortan de inmediato a nivel protocolo y el cliente recibe una alternativa clara por texto, con antispam acotado en memoria.
- Las notas de voz se responden con la voz del asistente; si MIA cae, hay un texto de respaldo acotado — el bot nunca queda mudo.
- **Tradeoff aceptado**: los textos defensivos no se insertan en la memoria/conversación de MIA (se envían directo desde el bridge por latencia). Si se requiere trazabilidad completa, un reenvío post-hoc fire-and-forget es scope futuro.
- **Tradeoff aceptado**: el estado anti-spam es en memoria y se pierde si el proceso muere (p. ej. redeploy). Para ventanas de 30-60s no justifica persistencia.
- El evento `call` offline/`@lid`: el texto a un LID requiere verificación runtime (QA).

## 6. Non-goals

- NO transcripción de audio (whisper/OpenAI): dependencias binarias en Windows y latencia.
- NO persistencia de cooldowns a Supabase/disco.
- NO manejo de llamadas de grupo.
- NO fallback de texto para mensajes NO-audio cuando MIA está caída.
- NO cambio del loop secuencial de `handleMessages` (deuda pre-existente anotada).
- NO cambios de schema.
