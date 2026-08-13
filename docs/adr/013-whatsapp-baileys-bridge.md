# ADR-013: WhatsApp Bridge with Baileys

## Status

Accepted

## Date

2026-08-02 (updated 2026-08-13)

## Council

CTO, Architect, Domain Expert, Product Manager, Backend Engineer, Frontend Engineer, Database Engineer, Security Engineer, Performance Engineer, QA Engineer, Release Manager

---

## 1. Context

MIA's conversational core must operate across multiple channels from one intelligent core. Today the only messaging channel live is the Chat Web (and the widget). WhatsApp — the most requested channel for small-business sales — is stubbed with a Meta Cloud API adapter (`src/lib/channels/adapters/whatsapp.ts`) that is not operational (no phone numbers, no webhook wiring).

Two viable routes exist to deliver WhatsApp:

1. **Meta Cloud API** — official, requires a Meta Business account, app review, a hosted phone number, and per-message billing.
2. **Baileys** (`@whiskeysockets/baileys`) — the de-facto community library that emulates WhatsApp Web's browser protocol. Connects via QR scan from the WhatsApp app, no Meta account required, works with a regular phone number.

MIA's first client is Vitanova, a small business. The pragmatic path to value is Baileys: a phone number already used for WhatsApp becomes the channel. The platform can later add Meta Cloud API as a second, official transport.

Key constraints discovered during exploration:

- The existing `ChannelAdapter` abstraction (`src/lib/channels/types.ts`) is the correct seam — Baileys plugs in as a WhatsApp adapter.
- The runtime (`processIncomingMessage`) already resolves tenant scoping via `metadata.businessId` (`src/lib/conversation/resolver.ts`), which matches Baileys' non-tenant-aware message model.
- Session state (Baileys `AuthenticationState`: creds + signal keys) must persist across restarts or the business must re-scan the QR on every bridge restart.
- A zero-day spoofing vulnerability affected Baileys `6.17.16` (GHSA-qvv5-jq5g-4cgg). The safe version at the time was `6.7.22`; the bridge now pins `^7.0.0-rc14` (see `services/whatsapp-bridge/package.json`).
- **Host único**: Baileys no permite dos instancias compitiendo por el mismo socket con las mismas credenciales. La segunda instancia provoca `stream:error conflict type: replaced` en la primera. Hay una sola instancia del bridge, desplegada en Fly.io (`mia-whatsapp-bridge`), y ninguna instancia local puede correr en paralelo.

## 2. Problem

To enable WhatsApp via Baileys we must solve four problems:

1. **Session lifecycle** — start/stop a WhatsApp Web session per business, persist the encrypted auth state so a restart does not lose the link.
2. **QR onboarding** — transmit the QR code (and reconnect state) to the dashboard in near real time.
3. **Messaging bridge** — connect Baileys inbound events to MIA's main conversational engine, tenant/business scoped, and route MIA's reply back to WhatsApp.
4. **Security** — WhatsApp session credentials must never be exposed through the public Data API, and only the owning business may control its session.

## 3. Decision

### 3.1 Dedicated Node.js service

Build a **standalone process** `services/whatsapp-bridge/` (Node.js ESM, `ws`, `pino`, `qrcode`, `@supabase/supabase-js`):

- **Owns the Baileys sockets.** One `makeWASocket` per business, managed by a `SessionManager`.
- **Exposes a small HTTP API + WebSocket** for the Next.js app:
  - `POST /v1/sessions/:businessId/start` — begin connection (emits QR).
  - `GET /v1/sessions/:businessId/status` — current status.
  - `DELETE /v1/sessions/:businessId/logout` — kill session and clear creds.
  - `POST /v1/sessions/:businessId/send` — send an outbound WhatsApp message.
  - `WS /v1/ws?businessId=&token=` — live QR/status/error events.
- **Isolates Baileys dependencies** (heavy, Node-specific) from the Next.js server.

Rationale: Baileys is a long-lived, socket-heavy runtime. Running it inside Next.js route handlers would couple a render server to persistent connections, complicate scaling, and risk hot-reload reconnecting WhatsApp every code change. A dedicated service keeps concerns separated and can be deployed independently (Docker, systemd, etc.).

### 3.2 Persistence in Supabase (service role only)

New table `public.whatsapp_sessions` (`supabase/migrations/015_whatsapp_sessions.sql`):

- `business_id` PK → FK `businesses(id)` ON DELETE CASCADE.
- `creds`, `keys` JSONB — the Baileys `AuthenticationState`.
- `status`, `phone`, `pairing_code`, `error_message`, `last_qr`, timestamps.

**Security posture:**

- `ENABLE RLS` + `FORCE RLS`.
- `REVOKE ALL` from `anon`, `authenticated`, `PUBLIC`.
- **No user policies.** Only the service-role key (which bypasses RLS) can read/write this table, exclusively from the bridge process.

This guarantees WhatsApp session credentials never leak through the Supabase Data API.

### 3.3 Bridge ↔ Next.js integration

- **Auth**: shared secret `WHATSAPP_BRIDGE_SECRET` sent as `x-mia-bridge-secret` header on all bridge HTTP calls. The WebSocket uses a per-business token: `HMAC-SHA256(secret, businessId)` encoded base64url, verified with `timingSafeEqual`.
- **Inbound messages**: the bridge `POST`s to Next.js internal route `POST /api/channels/baileys/webhook` (header `x-mia-webhook-secret`). Next.js runs the standard runtime: `BaileysAdapter.receiveMessage` → `processIncomingMessage('whatsapp', wireMessage, adapter)` → the reply payload `{ response, customerId, conversationId }` is returned so the bridge sends it back to WhatsApp.
- **Outbound (dashboard-driven)**: `BaileysAdapter.sendMessage` → bridge `POST /v1/sessions/:businessId/send`.
- **Onboarding**: `POST /api/channels/baileys/session` validates ownership (admin client) and calls bridge `start`. `GET /api/channels/baileys/ws-token` issues the WS token. The dashboard's `ConnectionsManager` opens the WS, renders the QR image (bridge emits a data URL), and reflects status live.
- **Adapter selection**: `BaileysAdapter` implements `ChannelAdapter` for `channel: 'whatsapp'`. The legacy Meta Cloud API adapter remains in place; the Baileys flow is self-contained through its own routes, so `gateway.ts` does not need to change.

### 3.4 Version pinning

Pin `@whiskeysockets/baileys@^7.0.0-rc14` (see `services/whatsapp-bridge/package.json`). Do not auto-upgrade major versions without re-reviewing the advisory and validating the bridge in the Laboratorio/test session.

### 3.5 Single-host rule and port 3001

- The bridge listens on port **3001** consistently: `BRIDGE_PORT=3001` (default in `src/config.ts`), `EXPOSE 3001` (`Dockerfile`), and `internal_port = 3001` (`fly.toml`).
- **Regla de host único**: exactamente una instancia del bridge por juego de credenciales Baileys. La instancia canónica es la máquina en Fly.io (`mia-whatsapp-bridge`, región `dfw`). Prohibido arrancar el bridge localmente mientras la máquina de Fly esté activa (causa `stream:error conflict type: replaced` y deslogueo de la instancia en producción).
- `MIA_APP_URL` en Fly.io debe apuntar a la URL de producción de Vercel (`https://mia-platform-psi.vercel.app`), nunca a `localhost`, para que los webhooks del bridge lleguen al core de Next.js.

## 4. Consequences

### Positive

- A business links its existing WhatsApp number by scanning a QR — no Meta account, no app review, no per-message cost.
- Session survives bridge restarts (auth state persisted to Supabase).
- Tenant scoping, message persistence, AI usage tracking all reuse the existing runtime — no parallel data model.
- Credentials are invisible to the public Data API (no policies, RLS forced, service role only).

### Negative / Trade-offs

- **Non-official protocol.** Baileys emulates WhatsApp Web and can break if WhatsApp changes the protocol. This is a known, accepted risk for the first client; a Meta Cloud API transport can be added later behind the same `ChannelAdapter`.
- **Plaintext at rest.** Session creds are stored as JSONB without encryption. A future migration can add pgcrypto envelope encryption (bridge holds the key).
- **Dedicated process to operate.** Requires running `services/whatsapp-bridge` in production alongside Next.js (env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_BRIDGE_SECRET`, `MIA_APP_URL`). Runs as a single Fly.io machine with `auto_stop_machines = "off"` so the TCP session stays alive 24/7.
- **Single point of failure / anti-crash hardening.** Event handlers (`creds.update`, `connection.update`, `messages.upsert`) and `sendToMia()` are wrapped so an unhandled rejection never kills the Node process; `healthz` responds under 2s; reconnect uses exponential backoff and a preventive restart on protocol-timeout ("zombie") signals.
- **One active socket per business.** Memory scales with connected businesses; acceptable for current volume.

## 5. References

- ADR-005 (Channel Abstraction) — the `ChannelAdapter` seam reused here.
- ADR-010 (Sales Domain Boundary) — WhatsApp is in-domain (conversation, data capture).
- `supabase/migrations/015_whatsapp_sessions.sql`
- `services/whatsapp-bridge/README.md`
