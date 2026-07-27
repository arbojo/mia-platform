# MIA Communication Layer Foundation

**Date:** 2026-07-27
**Status:** Proposed
**Sprint:** 4 — Communication Layer Foundation
**Complexity:** High
**Impact:** 15+ files, new database tables, new architecture layer

---

## 1. Current State

### 1.1 Existing Architecture

| Table | Purpose |
|-------|---------|
| `assistant_channels` | Stores connected channels per assistant (web, whatsapp, messenger, instagram) |
| `conversations` | Chat sessions (training, live, simulation) |
| `messages` | Individual messages with roles |
| `customers` | Commercial memory (phone, email, city, tags) |

### 1.2 Current Chat Flow

```
User sends message via Web Chat
  → /api/chat/route.ts
  → Authenticates user
  → Loads assistant + business context
  → Streams AI response
  → Saves messages to database
```

### 1.3 Problems

| # | Problem | Severity |
|---|---------|----------|
| 1 | No external channel support (WhatsApp, Messenger, Instagram) | High |
| 2 | No message normalization across channels | High |
| 3 | No customer identity resolution across channels | High |
| 4 | No webhook infrastructure for external channels | High |
| 5 | No rate limiting per channel | Medium |
| 6 | No message queuing for reliability | Medium |
| 7 | No audit trail for channel messages | Low |

---

## 2. Engineering Council Analysis

### 2.1 CTO — Architecture

**Decision:** Implement adapter pattern with centralized gateway.

**Rationale:**
- Adapter pattern allows adding new channels without changing core logic
- Central gateway handles routing, normalization, and identity resolution
- Existing `conversations` and `messages` tables are sufficient
- New tables needed: `channel_connections`, `channel_messages`

### 2.2 Architect — Design

**Architecture:**

```
External Channel (WhatsApp/Messenger/Instagram/Web)
  ↓
Channel Adapter (normalizes message)
  ↓
Communication Gateway (routes message)
  ↓
AI Engine (generates response)
  ↓
Channel Adapter (sends response)
  ↓
External Channel
```

**Key Design Decisions:**
1. **Adapter Pattern:** Each channel implements `ChannelAdapter` interface
2. **Message Normalization:** All messages converted to `NormalizedMessage` format
3. **Customer Resolution:** Match customers by phone/email/external_id per channel
4. **Multi-Tenant Isolation:** All queries scoped by `business_id`
5. **Existing Tables:** Reuse `conversations` and `messages` (no duplication)

### 2.3 Domain Expert — Domain

**Customer Identity:**
- Same customer may contact via WhatsApp AND Instagram
- Need to resolve identity across channels
- Strategy: Match by phone (WhatsApp), email (Messenger), external_id (Instagram)

**Conversation Lifecycle:**
```
New Message → Find/Create Customer → Find/Create Conversation → Process Message → Send Response
```

### 2.4 Product Manager — Journey

**Ideal Journey:**
```
Business owner: "Quiero conectar WhatsApp"
  → MIA: "Perfecto, voy a guiarte"
  → Business owner follows steps
  → WhatsApp connected
  → Customer sends WhatsApp message
  → MIA responds automatically
  → Business owner sees conversation in dashboard
```

### 2.5 Database Engineer — Schema

**New Tables:**

| Table | Purpose |
|-------|---------|
| `channel_connections` | Stores authentication/credentials per channel |

**Modified Tables:**
- `assistant_channels` — Add `connection_id` reference
- `messages` — Add `channel` and `external_id` fields

### 2.6 Security Engineer — Security

**Requirements:**
- Credentials encrypted at rest
- Webhook signatures validated
- Rate limiting per channel
- Audit trail for all channel messages
- No credential exposure in API responses

---

## 3. Recommended Architecture

### 3.1 Channel Adapter Interface

```typescript
interface ChannelAdapter {
  channel: string
  
  // Receive message from external channel
  receiveMessage(webhookBody: unknown): Promise<NormalizedMessage>
  
  // Send message to external channel
  sendMessage(connection: ChannelConnection, message: OutgoingMessage): Promise<SendResult>
  
  // Validate webhook signature
  validateWebhook(signature: string, body: unknown): boolean
  
  // Get channel status
  getStatus(connection: ChannelConnection): Promise<ChannelStatus>
}
```

### 3.2 Normalized Message Format

```typescript
interface NormalizedMessage {
  channel: string
  externalId: string
  customerExternalId: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  content: string
  contentType: 'text' | 'image' | 'audio' | 'document'
  metadata: Record<string, unknown>
  receivedAt: Date
}
```

### 3.3 Communication Gateway

```typescript
class CommunicationGateway {
  private adapters: Map<string, ChannelAdapter>
  
  // Process incoming message
  async processIncoming(message: NormalizedMessage): Promise<void>
  
  // Send outgoing message
  async sendOutgoing(channel: string, connectionId: string, content: string): Promise<void>
  
  // Get adapter for channel
  getAdapter(channel: string): ChannelAdapter
}
```

### 3.4 Customer Identity Resolution

```typescript
async function resolveCustomer(
  businessId: string,
  message: NormalizedMessage
): Promise<Customer> {
  // 1. Try to find by channel + external_id
  // 2. Try to find by phone (WhatsApp)
  // 3. Try to find by email (Messenger)
  // 4. Create new customer if not found
}
```

---

## 4. User Flows

### 4.1 Business Owner Connects WhatsApp
```
/dashboard/connections
  → Click "Conectar WhatsApp"
  → MIA shows QR code / phone number
  → Business owner scans/enters
  → Connection established
  → Status: 🟢 Conectado
```

### 4.2 Customer Sends WhatsApp Message
```
Customer sends WhatsApp to business number
  → WhatsApp webhook hits /api/channels/whatsapp
  → WhatsAppAdapter.receiveMessage() normalizes
  → Gateway resolves customer
  → Gateway finds/creates conversation
  → AI generates response
  → WhatsAppAdapter.sendMessage() sends
  → Customer receives response
```

### 4.3 Business Owner Views Conversation
```
/dashboard/conversations
  → Sees all conversations across channels
  → Clicks conversation
  → Sees messages from WhatsApp, Instagram, Web
  → Can respond manually or let AI handle
```

---

## 5. Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `src/lib/channels/types.ts` | Channel adapter interfaces |
| `src/lib/channels/gateway.ts` | Communication gateway |
| `src/lib/channels/adapters/web.ts` | Web chat adapter |
| `src/lib/channels/adapters/whatsapp.ts` | WhatsApp adapter (stub) |
| `src/lib/channels/identity.ts` | Customer identity resolution |
| `src/app/api/channels/webhook/[channel]/route.ts` | Webhook endpoint |
| `src/app/api/channels/connections/route.ts` | Connections API |
| `src/components/connections/ConnectionsManager.tsx` | Admin UI |
| `src/app/dashboard/connections/page.tsx` | Connections page |
| `supabase/migrations/005_channel_connections.sql` | Database schema |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/types/index.ts` | Add new table types |

---

## 6. Cost

- Channel adapters: No cost (local logic)
- Webhook processing: No cost (serverless)
- Customer resolution: ~1 query per message
- Message storage: Included in Supabase

---

## 7. Success Criteria

- [ ] Channel adapter interface defined
- [ ] Web chat adapter working end-to-end
- [ ] WhatsApp adapter stub ready for implementation
- [ ] Customer identity resolution working
- [ ] Webhook endpoint receiving messages
- [ ] Admin dashboard showing channel status
- [ ] All messages scoped by business_id
- [ ] Credentials never exposed in API
- [ ] Rate limiting working

---

## 8. Final Question

> Can MIA receive and respond to a real customer message through a channel without changing the AI employee logic?

**Yes.** The gateway normalizes all incoming messages to a standard format. The AI engine processes them identically regardless of channel. The response is sent back through the same adapter. The AI employee logic (prompts, knowledge, rules) remains unchanged.
