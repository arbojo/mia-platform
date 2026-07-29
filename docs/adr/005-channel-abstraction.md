# ADR-005: Channel Abstraction

## Status

Proposed

## Date

2026-07-29

## Council

CTO, Architect, Backend Engineer, Frontend Engineer, Security Engineer, DevOps

---

## 1. Context

### 1.1 The Problem

MIA was designed as a multi-channel platform from day one, but the channel abstraction is **partially implemented and inconsistently applied**. Two separate message paths currently exist:

| Path | Entry Point | Message Persistence | Channel Tracking |
|------|-------------|--------------------|-----------------|
| **Web chat** (`/api/chat`) | `processStreaming()` | `messages` table only | No — no channel recorded |
| **Channel webhooks** (`/api/channels/webhook/:channel`) | `processIncomingMessage()` | `messages` + `channel_messages` | Yes — channel metadata persisted |

This means:
- The `/api/chat` route (used by the dashboard training UI) has **no channel association** — conversations created through it lack channel context
- The `conversations` table has **no `channel` column** — a conversation cannot indicate whether it originated from web, WhatsApp, or another channel
- Two adapters exist (`WebChatAdapter`, `WhatsAppAdapter`) but they are stubs without production behavior
- The `ChannelAdapter` interface exists (`channels/types.ts`) but the runtime has **no ChannelBus** — each entry point manually handles its own routing

### 1.2 Current Architecture

```
                    ┌─────────────────────────────────┐
                    │    TWO PARALLEL ENTRY POINTS     │
                    └─────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
            ▼                                   ▼
  ┌───────────────────┐             ┌──────────────────────┐
  │  /api/chat         │             │  /api/channels/      │
  │  (streaming,       │             │  webhook/:channel    │
  │   training UI)     │             │  (external channels) │
  └────────┬──────────┘             └──────────┬───────────┘
           │                                   │
           ▼                                   ▼
  ┌───────────────────┐             ┌──────────────────────┐
  │ processStreaming()│             │processIncomingMsg()  │
  │ - loads context   │             │ - resolves connection│
  │ - streamText()    │             │ - resolves customer  │
  │ - persists msgs   │             │ - resolves conv      │
  │ NO channel        │             │ - loads context      │
  │ NO customer       │             │ - OpenAI completion  │
  │ NO channel_msgs   │             │ - persists both      │
  └───────────────────┘             └──────────────────────┘
```

### 1.3 Current Assets (Already Implemented)

The codebase already contains foundational elements:

| Asset | Location | Status |
|-------|----------|--------|
| `ChannelType` type | `src/lib/channels/types.ts` | ✅ Defined: `'web' | 'whatsapp' | 'messenger' | 'instagram'` |
| `ChannelAdapter` interface | `src/lib/channels/types.ts` | ✅ Defined: `receiveMessage`, `sendMessage`, `validateWebhook`, `getStatus` |
| `NormalizedMessage` type | `src/lib/channels/types.ts` | ✅ Defined with channel, customer data, content |
| `ChannelConnection` type | `src/lib/channels/types.ts` | ✅ Defined with status, credentials, configuration |
| `Gateway` (adapter registry) | `src/lib/channels/gateway.ts` | ✅ Maps `ChannelType` → adapter instance |
| `WebChatAdapter` | `src/lib/channels/adapters/web.ts` | ⚠️ Stub — receives JSON directly |
| `WhatsAppAdapter` | `src/lib/channels/adapters/whatsapp.ts` | ⚠️ Partial — parses webhook, send/validate are stubs |
| `channel_connections` table | Migration 005 | ✅ Schema exists |
| `channel_messages` table | Migration 005 | ✅ Schema exists |
| `assistant_channels` table | Migration 005 | ✅ Schema exists |
| Webhook route | `src/app/api/channels/webhook/[channel]/route.ts` | ⚠️ Partial — GET path exists, POST needs refinement |
| `processIncomingMessage()` | `src/lib/runtime/runtime.ts` | ✅ Working for external channels |
| `resolveCustomer()` | `src/lib/runtime/runtime.ts` | ✅ Exists |
| `resolveConversation()` | `src/lib/runtime/runtime.ts` | ✅ Exists |
| `WireMessage` type | `src/lib/runtime/types.ts` | ✅ Runtime internal message format |

### 1.4 Gaps

| Gap | Impact |
|-----|--------|
| No `channel` column on `conversations` | Cannot filter/route conversations by origin channel |
| `/api/chat` has no channel tracking | Training conversations invisible in channel reporting |
| No ChannelBus | Each entry point duplicates routing logic |
| Adapters are stubs | No production channel behavior |
| No unified Conversation Center | Business cannot see all conversations in one place |
| No Web Chat widget SDK | Cannot embed MIA on landing pages |
| No context handoff protocol | Web→WhatsApp transfer loses conversation state |

---

## 2. Decision

### 2.1 The Runtime is Channel-Agnostic

**The MIA runtime (`src/lib/runtime/`) must never distinguish behavior by channel.** The same `processIncomingMessage()` or `processStreaming()` function handles all channels identically. The channel is a transport concern, not a business logic concern.

```
                    ┌─────────────────────────────────────┐
                    │         Channel Bus                 │
                    │  ┌───────────────────────────────┐  │
                    │  │  normalize() → route() →      │  │
                    │  │  send()                        │  │
                    │  └───────────────────────────────┘  │
                    │         │                           │
                    └─────────┼───────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
          ┌─────────────────┐ ┌───────────────────┐
          │   Runtime        │ │   Runtime          │
          │ processStreaming │ │ processIncomingMsg │
          │ channel-agnostic │ │ channel-agnostic   │
          └─────────────────┘ └───────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │     Channel Bus      │
                    │  routes response     │
                    │  back via adapter    │
                    └─────────────────────┘
```

### 2.2 Converge to a Single Unified Flow

Replace the two parallel entry points with a single `ChannelBus` that:

```
Inbound:  WebSocket / Webhook / API → [ChannelBus] → [Runtime] → [ChannelBus] → Outbound
                                                                      │
                                                                      ▼
                                                              [messages + channel_messages]
```

### 2.3 Add `channel` to Conversations

Add a `channel` column to the `conversations` table so every conversation knows its origin:

```typescript
// New column on conversations table
channel: 'web' | 'whatsapp' | 'messenger' | 'instagram'
```

Existing conversations default to `'web'` (backwards compatible).

### 2.4 Formalize ChannelAdapter Contract

The existing `ChannelAdapter` interface is correct but incomplete. Refine to:

```typescript
interface ChannelAdapter {
  readonly channel: ChannelType

  /** Normalize an incoming webhook payload into a platform-agnostic message */
  normalize(payload: unknown, headers?: Record<string, string>): NormalizedMessage

  /** Send a message through this channel */
  send(connection: ChannelConnection, message: OutgoingMessage): Promise<SendResult>

  /** Verify webhook authenticity (HMAC, token, etc.) */
  verify(payload: unknown, signature: string): boolean

  /** Return current connection health */
  health(connection: ChannelConnection): Promise<ChannelStatus>
}
```

Each adapter owns:
- **Parsing** its protocol's webhook format → `NormalizedMessage`
- **Serializing** platform messages → the channel's wire format
- **Auth verification** (HMAC, tokens, signatures)
- **Delivery guarantees** (retry, timeout, failure reporting)

### 2.5 Introduce ChannelBus

```typescript
class ChannelBus {
  private runtime: Runtime
  private adapters: Map<ChannelType, ChannelAdapter>

  constructor(runtime: Runtime, adapters: ChannelAdapter[]) {
    this.runtime = runtime
    this.adapters = new Map(adapters.map(a => [a.channel, a]))
  }

  /** Entry point for any incoming message from any channel */
  async handleIncoming(connection: ChannelConnection, payload: unknown): Promise<void> {
    const adapter = this.adapters.get(connection.channel)
    if (!adapter) throw new Error(`No adapter for channel: ${connection.channel}`)

    // 1. Normalize the incoming message
    const normalized = adapter.normalize(payload)

    // 2. Route through runtime (channel-agnostic)
    const response = await this.runtime.processIncomingMessage({
      businessId: connection.business_id,
      assistantId: connection.assistant_id,
      channel: connection.channel,
      customerExternalId: normalized.customerExternalId,
      customerName: normalized.customerName,
      content: normalized.content,
    })

    // 3. Send response back through the channel
    await adapter.send(connection, {
      content: response.content,
      contentType: 'text',
    })
  }

  /** Generate a streaming response handler for WebSocket-based channels */
  async handleStreaming(connection: ChannelConnection, payload: unknown): Promise<ReadableStream> {
    const adapter = this.adapters.get(connection.channel)
    const normalized = adapter.normalize(payload)

    const stream = await this.runtime.processStreaming({
      businessId: connection.business_id,
      assistantId: connection.assistant_id,
      channel: connection.channel,
      customerExternalId: normalized.customerExternalId,
      content: normalized.content,
    })

    return stream
  }
}
```

### 2.6 Web Chat Uses WebSocket, Not Webhook

Unlike WhatsApp/Messenger/Instagram (which push events via webhooks), the Web Chat channel uses a **WebSocket connection** from the browser widget. This means:

| Aspect | Web Chat | WhatsApp etc. |
|--------|----------|---------------|
| Transport | WebSocket (WSS) | HTTP Webhook |
| Connection | Persistent, stateful | Stateless |
| Auth | Session token | Platform webhook secret |
| Streaming | Native (WebSocket frames) | Not supported |
| Reconnection | Automatic with exponential backoff | N/A (stateless) |

The `WebChatAdapter` will have a `handleConnection(socket)` method instead of `normalize(payload)`:

```typescript
class WebChatAdapter implements ChannelAdapter {
  channel: ChannelType = 'web'

  /** Handle a new WebSocket connection from the widget */
  async handleConnection(socket: WebSocket, session: WidgetSession): Promise<void> {
    // 1. Authenticate session
    // 2. Assign customer + conversation
    // 3. Stream messages bidirectionally
  }

  /** Override: WebSocket adapter sends via socket, not HTTP */
  async send(connection: ChannelConnection, message: OutgoingMessage): Promise<SendResult> {
    // Send via the active WebSocket connection
  }
}
```

---

## 3. Schema Changes

### 3.1 Add `channel` to `conversations`

```sql
ALTER TABLE conversations ADD COLUMN channel text NOT NULL DEFAULT 'web'
  CHECK (channel IN ('web', 'whatsapp', 'messenger', 'instagram'));
```

### 3.2 Add `handoff_token` to `conversations` (optional, for handoff tracking)

```sql
ALTER TABLE conversations ADD COLUMN handoff_token uuid DEFAULT NULL;
```

### 3.3 New Indexes

```sql
CREATE INDEX idx_conversations_channel ON conversations(channel);
CREATE INDEX idx_conversations_business_channel ON conversations(assistant_id, channel);
```

---

## 4. Example Flows

### 4.1 Web Chat Flow (New)

```
Browser Widget                    MIA Platform
     │                                  │
     │── WebSocket connect ────────────►│
     │                                  │── WebChatAdapter.handleConnection()
     │                                  │   ├── authenticate session
     │                                  │   ├── resolveCustomer() → create/get
     │                                  │   ├── resolveConversation(channel:'web')
     │                                  │   ├── loadConversationContext()
     │                                  │   └── stream chat history (last N msgs)
     │◄── history + welcome message ────│
     │                                  │
     │── send: "¿Cuánto cuesta X200?"──►│
     │                                  │── processIncomingMessage(channel:'web')
     │                                  │   ├── runtime processes (channel-agnostic)
     │                                  │   ├── persist messages + channel_messages
     │                                  │   └── return response
     │◄── response stream ──────────────│
```

### 4.2 WhatsApp Flow (Existing, Converged)

```
WhatsApp Cloud API                  MIA Platform
     │                                  │
     │── POST webhook (message) ───────►│
     │                                  │── WhatsAppAdapter.normalize(payload)
     │                                  │── ChannelBus.handleIncoming()
     │                                  │   ├── resolveCustomer()
     │                                  │   ├── resolveConversation(channel:'whatsapp')
     │                                  │   ├── loadConversationContext()
     │                                  │   ├── processIncomingMessage()
     │                                  │   └── WhatsAppAdapter.send(response)
     │◄── WhatsApp message ─────────────│
```

### 4.3 Conversation Center Query

A single query returns conversations from all channels:

```sql
SELECT
  c.id, c.channel, c.status, c.created_at,
  cu.name AS customer_name, cu.phone, cu.city,
  (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
  (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_activity
FROM conversations c
JOIN customers cu ON cu.id = c.customer_id
WHERE c.assistant_id = $1
  AND (c.channel = $2 OR $2 IS NULL)  -- optional filter
ORDER BY last_activity DESC
LIMIT 100;
```

---

## 5. Impact Analysis

### 5.1 Positive Impacts

| Area | Impact |
|------|--------|
| **Unified architecture** | Single code path for all channels; reduced duplication |
| **New channels** | Adding Instagram = implementing one adapter class |
| **Data consistency** | Every conversation has channel metadata; reporting is reliable |
| **Web Chat positioning** | Web Chat becomes a first-class channel, not a separate system |
| **Maintainability** | Runtime never checks `if channel === 'whatsapp'` — it just processes |

### 5.2 Negative Impacts

| Area | Impact |
|------|--------|
| **Refactoring effort** | `/api/chat` route needs to be migrated to use ChannelBus |
| **Schema migration** | `conversations` table needs new column (downtime consideration) |
| **WebSocket complexity** | Stateful connections require sticky sessions or Redis pub/sub |
| **Backwards compatibility** | Existing conversations default to `channel='web'`, which is correct |

### 5.3 Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| WebSocket scaling under load | Medium | Horizontal scaling with Redis pub/sub; `uWebSockets.js` for performance |
| WebSocket reconnection storms | Medium | Exponential backoff + jitter; rate-limit reconnection per IP |
| Adapter divergence | Low | Strict `ChannelAdapter` interface + unit tests for every adapter |
| Existing `/api/chat` breakage | Low | Wrap in ChannelBus incrementally; keep old path as fallback during migration |

### 5.4 Technical Impact

| Component | Change | Effort |
|-----------|--------|--------|
| `src/lib/channels/types.ts` | Minor refinement to `ChannelAdapter` interface | Small |
| `src/lib/channels/bus.ts` | **New** — ChannelBus class | Medium |
| `src/lib/channels/adapters/web.ts` | Rewrite — WebSocket support | Large |
| `src/lib/channels/adapters/whatsapp.ts` | Production send/verify | Medium |
| `src/lib/channels/gateway.ts` | Update to new ChannelBus | Small |
| `src/lib/runtime/runtime.ts` | Refactor `processStreaming` and `processIncomingMessage` to accept channel param | Medium |
| `src/app/api/chat/route.ts` | Route through ChannelBus | Medium |
| `src/app/api/channels/webhook/[channel]/route.ts` | Route through ChannelBus | Medium |
| `supabase/migrations/` | New migration for `channel` column | Small |
| Dashboard — Conversation Center | **New** — unified conversation list | Large |
| Dashboard — Widget Config | **New** — Web Chat settings panel | Medium |

---

## 6. Relationship to Other ADRs

| ADR | Relationship |
|-----|-------------|
| **ADR-003** (Conflict Resolution) | Independent — the runtime is channel-agnostic, conflict resolution is part of the prompt |
| **ADR-004** (Health Policy) | Independent — applied at prompt level, not channel level |
| **ADR-006** (Context Handoff) | **Depends on ADR-005** — handoff requires ChannelBus and channel-aware conversations |
| **ADR-007** (Web Widget SDK) | **Depends on ADR-005** — widget connects to WebChatAdapter via WebSocket |
| **ADR-008** (Conversation Center) | **Depends on ADR-005** — unified view requires `channel` column on conversations |
| **ADR-009** (Configurable Pipeline) | **Depends on ADR-005** — pipeline stages require channel abstraction |

---

## 7. Implementation Plan

### Phase 1: Foundation
1. Add `channel` column to `conversations` (new migration)
2. Refine `ChannelAdapter` interface (`src/lib/channels/types.ts`)
3. Build `ChannelBus` (`src/lib/channels/bus.ts`)
4. Add `channel` parameter to runtime functions

### Phase 2: Web Chat as First-Class Channel
1. Rewrite `WebChatAdapter` with WebSocket support
2. Build WebSocket server endpoint (`/api/channels/ws`)
3. Session management (token generation, expiration, reconnection)
4. Conversation resolution for Web Chat

### Phase 3: Production Adapters
1. Production `WhatsAppAdapter` (send, verify, health)
2. `MessengerAdapter` stub (ready for future)
3. `InstagramAdapter` stub (ready for future)

### Phase 4: Dashboard
1. Conversation Center (unified list by channel)
2. Widget Configuration panel

---

## 8. Open Questions

1. Should `/api/chat` (the streaming endpoint used by the training UI) be migrated to use ChannelBus immediately, or kept as a fast path that creates conversations with `channel='web'`?
2. Should WebSocket connections be handled by the Next.js server (via `route.ts`) or a separate dedicated WebSocket service?
3. Should the `conversations.channel` column be denormalized (stored on every conversation) or resolved through `channel_messages` at query time?
4. Should old conversations (pre-migration) have `channel='web'` or `channel='unknown'`?

---

## 9. Council Notes

- **CTO**: The two parallel paths are already technical debt. Converging them now is cheaper than maintaining both. Approve.
- **Architect**: The ChannelBus pattern isolates transport from runtime. Adding a channel should never require changing runtime logic. This is the right abstraction.
- **Backend Engineer**: WebSocket scaling is the hardest part. Redis pub/sub solves it, but adds operational complexity. Consider starting with SSE as a simpler alternative for Phase 1.
- **Security Engineer**: WebSocket sessions need the same auth as the REST API. No anonymous sessions. Handoff tokens must be JWT-signed with short expiration.
- **DevOps**: If WebSocket traffic exceeds projections, consider a dedicated service with `uWebSockets.js` or Socket.io deployed separately. The ChannelBus abstraction makes this swap transparent.
