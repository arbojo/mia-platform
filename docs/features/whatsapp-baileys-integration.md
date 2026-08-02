# WhatsApp Bridge (Baileys) — Integration Report

**Date:** 2026-08-02
**Status:** Implemented
**Governance:** TASK-20260802-021850 (Complex, 10/10 approved)
**Complexity:** High
**Impact:** New service (`services/whatsapp-bridge`), new migration, new API routes, new adapter

---

## 1. Executive Summary

MIA's WhatsApp channel is now backed by **Baileys** (`@whiskeysockets/baileys`), the community library that connects using the WhatsApp Web protocol. A business links its existing WhatsApp number by scanning a QR code from the dashboard — no Meta Business account, no app review, no per-message billing.

The implementation follows ADR-013 and reuses the existing `ChannelAdapter` seam (ADR-005) so the rest of the platform (tenant scoping, message persistence, AI usage tracking) works unchanged.

## 2. Architecture Overview

```
┌─────────────────────────────┐      HTTP + WS (x-mia-bridge-secret / HMAC token)
│      Next.js (MIA app)      │◄──────────────────────────────────────────┐
│                             │                                            │
│  ConnectionsManager (QR UI) │                                           ▼
│  /api/channels/baileys/     │   ┌──────────────────────────────────────────┐
│    webhook/route.ts         │   │      services/whatsapp-bridge/           │
│    session/route.ts         │   │                                          │
│    ws-token/route.ts        │   │  server.ts (HTTP API + WS /v1/ws)        │
│  BaileysAdapter             │   │  session-manager.ts (Baileys sockets)     │
│  lib/baileys/{config,bridge}│   │  mia-client.ts (→ MIA webhook)            │
└──────────┬──────────────────┘   │  supabase-store.ts (auth state)           │
           │                      └──────────────┬───────────────────────────┘
           │ admin (writes)                      │ service role (writes)
           ▼                                     ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                       Supabase                                 │
   │  channel_connections  ·  whatsapp_sessions (RLS, service-only) │
   │  customers · conversations · messages · ai_usage               │
   └────────────────────────────────────────────────────────────────┘
```

### 2.1 Message Flow (inbound)

```
WhatsApp customer sends message
  → Baileys socket (bridge, messages.upsert)
  → bridge extracts text → POST /api/channels/baileys/webhook
      header: x-mia-webhook-secret
      body:   { message: { businessId, externalId, customerExternalId, content, ... } }
  → Next.js: BaileysAdapter.receiveMessage → processIncomingMessage('whatsapp', ...)
  → MIA resolves connection (businessId → assistant), customer, conversation
  → AI reply generated (request_type: live_customer, token tracked)
  → reply persisted (messages, channel_messages)
  → webhook returns { response, customerId, conversationId }
  → bridge sends reply back to WhatsApp via socket.sendMessage
```

### 2.2 Connection Flow (onboarding)

```
Dashboard "Conectar WhatsApp"
  → POST /api/channels/baileys/session  (validates ownership via admin client)
  → creates/updates channel_connections (whatsapp, credentials.transport=baileys)
  → bridge POST /v1/sessions/:businessId/start
  → bridge makesWASocket → emits { type:'qr', dataUrl }
  → GET /api/channels/baileys/ws-token?businessId= (HMAC token)
  → dashboard opens WS /v1/ws?businessId=&token=
  → QR rendered → user scans with WhatsApp → connection.update (open)
  → status: connected, phone captured → ConnectionsManager shows green state
```

## 3. Components Delivered

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Bridge service | `services/whatsapp-bridge/` | Baileys sockets, session lifecycle, HTTP API, WS events |
| Session store | `services/whatsapp-bridge/src/supabase-store.ts` | Persist/restore `AuthenticationState` per business (creds + keys) |
| Session manager | `services/whatsapp-bridge/src/session-manager.ts` | Connect/reconnect, QR emit, message handling, send |
| MIA client | `services/whatsapp-bridge/src/mia-client.ts` | Forward inbound messages to MIA webhook |
| Bridge server | `services/whatsapp-bridge/src/server.ts` | HTTP routes + authenticated WebSocket |
| Migration | `supabase/migrations/015_whatsapp_sessions.sql` | `whatsapp_sessions` table (service-role only) |
| Adapter | `src/lib/channels/adapters/baileys.ts` | `ChannelAdapter` for channel `whatsapp` |
| Bridge client | `src/lib/baileys/config.ts`, `src/lib/baileys/bridge.ts` | Next.js → bridge HTTP calls |
| Webhook route | `src/app/api/channels/baileys/webhook/route.ts` | Inbound message entry into the runtime |
| Session route | `src/app/api/channels/baileys/session/route.ts` | POST/GET/DELETE session control with ownership |
| WS token route | `src/app/api/channels/baileys/ws-token/route.ts` | Issued HMAC token for dashboard WS |
| Dashboard UI | `src/components/connections/ConnectionsManager.tsx` | WhatsApp card: QR display + live status |
| ADR | `docs/adr/013-whatsapp-baileys-bridge.md` | Architectural decision record |

## 4. Configuration

### 4.1 Bridge environment (`services/whatsapp-bridge/.env`)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Service-role key (bypasses RLS) |
| `WHATSAPP_BRIDGE_SECRET` | Yes | — | Shared secret with Next.js |
| `MIA_APP_URL` | No | `http://localhost:3000` | Where the bridge posts webhooks |
| `BRIDGE_PORT` | No | `8787` | HTTP/WS listen port |

### 4.2 Next.js environment (root `.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `WHATSAPP_BRIDGE_URL` | Yes (to enable) | `http://localhost:8787` |
| `WHATSAPP_BRIDGE_SECRET` | Yes (to enable) | Shared secret (same as bridge) |

Both vars must be set for WhatsApp to appear; otherwise the session routes return `503`.

## 5. Security

| Control | Implementation |
|---------|----------------|
| WhatsApp credentials at rest | `whatsapp_sessions` RLS forced, `REVOKE ALL` from `anon`/`authenticated`/`PUBLIC`, no user policies; only service-role from the bridge can touch it |
| Bridge ↔ MIA auth | Shared secret `x-mia-bridge-secret` (HTTP) and per-business HMAC token on WS, compared with `timingSafeEqual` |
| Tenant isolation | Every session route verifies business ownership (`businesses.owner_id = user.id`) via the admin client before any bridge call |
| No API key exposure | Credentials never reach the browser; the dashboard only gets the QR image and status events |
| Outbound safety | Bridge skips own messages (`fromMe`), status broadcasts, and group messages |
| Dependency security | Baileys pinned to `6.7.22` (avoids GHSA-qvv5-jq5g-4cgg zero-day); `npm audit` clean |

## 6. Known Limitations

1. **Non-official protocol** — Baileys can break if WhatsApp changes the Web protocol. Accepted for the first client; Meta Cloud API remains as a future second transport behind the same `ChannelAdapter`.
2. **Plaintext creds at rest** — JSONB without encryption. Future: pgcrypto envelope encryption with the bridge holding the key.
3. **Dedicated process** — the bridge must run in production separately from Next.js.
4. **One socket per business** — memory scales with connected businesses.
5. **Media support** — current inbound normalization maps image/audio/video to text placeholders (`[Imagen recibida]`, etc.). Full media send/receive is future work.

## 7. Quality Gates

| Gate | Result |
|------|--------|
| Lint | 0 errors (1 pre-existing warning in `workshop/governance/workflow.ts`) |
| Build | Passed |
| Typecheck (bridge) | Passed |
| Bridge deps | `npm install` clean, 0 vulnerabilities |
| Migration | Applied and registered on MIA Lab (`015 \| whatsapp_sessions`) |

## 8. Deployment Checklist

1. Apply `supabase/migrations/015_whatsapp_sessions.sql` (done on MIA Lab).
2. Set bridge env vars and run `npm install && npm run dev` (or build) in `services/whatsapp-bridge`.
3. Set `WHATSAPP_BRIDGE_URL` and `WHATSAPP_BRIDGE_SECRET` in the Next.js environment.
4. Deploy both processes; keep `MIA_APP_URL` pointing to the public Next.js URL.
5. From the dashboard → Connections → WhatsApp → scan QR.

## 9. Next Steps

- Full media message support (download WhatsApp media → send to MIA).
- Meta Cloud API as an official second transport (same adapter contract).
- Envelope encryption for `whatsapp_sessions`.
- E2E test for the QR connection flow.
