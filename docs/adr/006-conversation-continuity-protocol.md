# ADR-006: Conversation Continuity Protocol (CCP)

## Status

Proposed

## Date

2026-07-29

## Council

CTO, Architect, AI Engineer, Backend Engineer, Security Engineer, Product Manager

---

## 1. Context

### 1.1 The Problem

MIA currently rebuilds conversation context **from scratch on every interaction**. When a message arrives, the runtime (`processIncomingMessage()` in `src/lib/runtime/runtime.ts:105-122`) does:

```
1. loadConversationContext()       → ~800 tokens (system prompt)
2. fetch last 20 messages          → ~2000 tokens (history)
3. concatenate system + history    → ~2800 tokens per request
```

This has four fundamental limitations:

| Limitation | Impact |
|------------|--------|
| **Token waste** | Every turn reprocesses the full history. A 100-message conversation costs ~10,000 tokens in context alone — mostly from messages the LLM already processed. |
| **No cross-channel continuity** | If a customer starts on Web Chat and moves to WhatsApp, the new conversation has zero context. MIA cannot retake without the customer repeating themselves. |
| **No agent transfer** | A human agent taking over has no summary of what happened. They must read the full log. |
| **No reconnection recovery** | If a WebSocket disconnects or a customer returns hours later, MIA starts fresh. No memory of where they left off. |

### 1.2 Current Architecture

```
                            ┌──────────────────────────────┐
                            │   processIncomingMessage()   │
                            │                              │
                            │  1. loadConversationContext  │
                            │     (buildMasterPrompt)      │
                            │                              │
                            │  2. fetch messages (last 20) │
                            │                              │
                            │  3. system prompt + history  │
                            │     → OpenAI                  │
                            │                              │
                            │  ✗ No checkpoints            │
                            │  ✗ No cross-channel state    │
                            │  ✗ No reconnection memory    │
                            │  ✗ $0.0037 per turn (avg)    │
                            └──────────────────────────────┘
```

### 1.3 Token Cost Projection

| Scenario | Current (no CCP) | With CCP | Savings |
|----------|-----------------|----------|---------|
| New conversation (1-5 msgs) | ~2,800 tokens | ~2,800 tokens | 0% |
| Established (20 msgs) | ~3,200 tokens | ~1,400 tokens | 56% |
| Long conversation (50 msgs) | ~5,600 tokens | ~1,600 tokens | 71% |
| Handoff (Web→WhatsApp) | Starts over (~2,800) | ~800 tokens (checkpoint) | 71% |
| Reconnection (after 1h) | Starts over (~2,800) | ~1,200 tokens (checkpoint + delta) | 57% |

At scale (1,000 conversations/day, avg 15 turns each): ~42,000 tokens/day saved → ~$0.50/day direct savings. More importantly: **faster responses** (less prompt processing) and **seamless continuity**.

---

## 2. Terminology Decision

### 2.1 "Context Handoff" vs "Conversation Continuity Protocol"

| Aspect | "Context Handoff" | "Conversation Continuity Protocol" |
|--------|-------------------|-------------------------------------|
| Scope | Channel-to-channel transfer | Any state transfer (channel, device, agent, time) |
| Direction | Unidirectional (A→B) | Bidirectional + multi-directional (any point can resume) |
| Duration | Single event | Ongoing lifecycle (every N messages) |
| Token optimization | Incidental | Core design goal |
| Future channels | Limited | Inherent (any channel can checkpoint/resume) |
| Agent transfer | Not covered | First-class |
| Reconnection | Not covered | First-class |

**Decision**: The name is **Conversation Continuity Protocol (CCP)** because:

1. It is **not** just about handing off between channels — that is one use case among many
2. It is a **protocol** — a structured, auditable, lifecycle-managed system for preserving conversation state across any discontinuity
3. It enables **continuity** — the customer's experience is seamless regardless of channel, device, agent, or time gap
4. The token is **just an identifier** — the real state lives in the checkpoint

The term "Context Handoff" describes a **single action** within CCP (a `handoff`-type checkpoint). CCP is the overarching system.

### 2.2 Core Principle

> **The message history is the source of truth. The checkpoint is a performance-optimized snapshot.**
>
> Checkpoints never replace message history — they supplement it. Messages are always preserved for audit, debugging, and training. Checkpoints provide fast access to the current state without reprocessing the full history.

---

## 3. Decision

### 3.1 The Conversation Checkpoint

A **checkpoint** is a snapshot of conversation state stored in the database at key moments:

```
                        Checkpoint Chain
     ┌──────────────────────────────────────────────────┐
     │                                                  │
     │  [START] → [CP@5] → [CP@12] → [CP@20] → ...    │
     │                      │                           │
     │                      ├── handoff_token: JWT      │
     │                      ├── summary: "Customer      │
     │                      │     interested in X200,   │
     │                      │     price objection,      │
     │                      │     asked about delivery" │
     │                      ├── intent: ready_to_buy    │
     │                      └── products: [X200]        │
     │                                                  │
     └──────────────────────────────────────────────────┘
```

Each checkpoint stores:

| Field | Purpose |
|-------|---------|
| `context_snapshot` | AI-generated summary + structured state (products, objections, intent) |
| `system_prompt_hash` | Hash of the system prompt at checkpoint time (for caching) |
| `messages_since_last` | Count of messages since the previous checkpoint |
| `estimated_tokens_saved` | Running total of tokens this checkpoint saved |
| `from_channel` / `to_channel` | Channel transition (null if same channel) |
| `handoff_token` | Signed JWT for external handoff (null if not a handoff) |
| `expires_at` | When this checkpoint expires (handoff checkpoints: short TTL) |

### 3.2 Checkpoint Creation Triggers

| Trigger | Checkpoint Type | When |
|---------|----------------|------|
| **Periodic** | `periodic` | Every N messages (configurable, default 5) |
| **Handoff** | `handoff` | When inviting customer to switch to another channel |
| **Agent transfer** | `agent_transfer` | When a human agent takes over |
| **Channel switch** | `channel_switch` | When the system detects a channel change for same customer |
| **Reconnection** | `reconnection` | When a customer returns after a timeout/duration threshold |
| **Idle** | `periodic` | After a configurable idle period (preserve state before sleep) |

### 3.3 Checkpoint Lifecycle

```
                    CREATED
                       │
                       ▼
              ┌─────────────────┐
              │   Valid          │
              │   (not expired)  │◄──────── Used for continuity
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Superseded     │◄──────── Newer checkpoint exists
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Expired        │◄──────── TTL passed (handoff: 30min, periodic: 24h)
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Archived       │◄──────── Soft-deleted (retained for audit)
              └─────────────────┘
```

### 3.4 Context Resolution Priority

When a conversation needs context, CCP resolves in this order:

```
1. Latest valid checkpoint for this conversation
   └── Use checkpoint summary + delta messages (since checkpoint)
       └── If delta messages exist, merge with checkpoint summary

2. No valid checkpoint → Use last N messages (current behavior)

3. No messages → Fresh conversation (system prompt only)
```

### 3.5 System Prompt Caching

The `context_snapshot` includes `system_prompt_hash`. If the hash matches the current `buildMasterPrompt()` output, the system prompt is reused from cache — no need to rebuild. This saves both DB queries and token costs.

The hash changes only when business data changes (products updated, rules modified, etc.), not on every turn.

---

## 4. Data Model

### 4.1 New Tables

#### `conversation_checkpoints`

```sql
CREATE TABLE conversation_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  parent_checkpoint_id UUID REFERENCES conversation_checkpoints(id),

  -- Type
  checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN (
    'periodic', 'handoff', 'agent_transfer', 'channel_switch', 'reconnection'
  )),

  -- Context snapshot — the core payload
  context_snapshot JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(context_snapshot) = 'object'),
  /*
  {
    "summary": "Cliente interesado en X200. Objeción de precio. Se le explicó
                la diferencia con el modelo anterior. Preguntó por envío a
                CDMX. Intención de compra detectada.",

    "customer": {
      "name": "Juan Pérez",
      "city": "CDMX",
      "phone": "5512345678",
      "tags": ["lead", "vitanova"]
    },

    "intent": {
      "level": "interested",            -- exploring | interested | ready_to_buy
      "products_of_interest": ["X200"],
      "objections": ["price too high", "delivery time"],
      "recommendations": ["X200 bundle with installation"],
      "questions_answered": ["price", "delivery", "warranty"],
      "pending_questions": ["payment methods"]
    },

    "key_decisions": [
      "Cliente aceptó cotización de X200 a $14,999",
      "Solicitó factura"
    ],

    "last_products_discussed": [
      { "id": "prod-1", "name": "X200", "price": 14999 }
    ],

    "last_rules_applied": [
      { "id": "rule-3", "content": "Envío gratis >$1,500" }
    ],

    "tone": "formal",
    "emotional_state": "interested_but_hesitant"
  }
  */

  -- Channel info
  previous_channel TEXT,
  current_channel TEXT NOT NULL,

  -- Token tracking
  messages_since_checkpoint INT NOT NULL DEFAULT 0,
  estimated_tokens_saved INT NOT NULL DEFAULT 0,

  -- Continuity
  handoff_token TEXT,
  expires_at TIMESTAMPTZ,

  -- Audit
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_ckpt_conversation_latest
  ON conversation_checkpoints(conversation_id, created_at DESC);

CREATE INDEX idx_ckpt_handoff_token
  ON conversation_checkpoints(handoff_token)
  WHERE handoff_token IS NOT NULL;

CREATE INDEX idx_ckpt_expires_at
  ON conversation_checkpoints(expires_at)
  WHERE expires_at IS NOT NULL;
```

#### `conversation_checkpoint_log` (audit trail)

```sql
CREATE TABLE conversation_checkpoint_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id UUID NOT NULL REFERENCES conversation_checkpoints(id),
  action TEXT NOT NULL CHECK (action IN (
    'created', 'loaded', 'superseded', 'expired', 'archived', 'handoff_sent', 'handoff_redeemed'
  )),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ckpt_log_checkpoint ON conversation_checkpoint_log(checkpoint_id);
```

### 4.2 Modified Tables

#### Add `current_checkpoint_id` to `conversations`

```sql
ALTER TABLE conversations ADD COLUMN current_checkpoint_id UUID
  REFERENCES conversation_checkpoints(id);
```

This allows fast lookup of the active checkpoint without querying the checkpoints table by `conversation_id` + ordering.

#### Add `handoff_data` to `customers` (optional, for tracking customer-level handoffs)

```sql
ALTER TABLE customers ADD COLUMN handoff_metadata JSONB DEFAULT '{}';
```

---

## 5. Protocol Architecture

### 5.1 Components

```
┌──────────────────────────────────────────────────────────────┐
│                    CCP Subsystem                              │
│                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │ CheckpointEngine │  │ ContinuityLoader│  │ CCPRecovery  │  │
│  │ • create()       │  │ • load()        │  │ • reconnect() │  │
│  │ • supersede()    │  │ • resolve()     │  │ • retry()    │  │
│  │ • expire()       │  │ • hash()        │  └──────────────┘  │
│  └────────┬────────┘  └────────┬────────┘                     │
│           │                    │                               │
│  ┌────────┴────────────────────┴────────┐                     │
│  │        HandoffTokenManager           │                     │
│  │  • generate() → signed JWT           │                     │
│  │  • validate() → checkpoint_id        │                     │
│  │  • redeem() → mark used              │                     │
│  └──────────────────────────────────────┘                     │
│                                                               │
│  ┌──────────────────────────────────────┐                     │
│  │        SummaryGenerator              │                     │
│  │  • generateSummary(messages) → text  │                     │
│  │  • extractIntent(messages) → struct  │                     │
│  └──────────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 CheckpointEngine

```typescript
interface CheckpointEngine {
  /** Create a checkpoint after N messages or on trigger */
  create(params: {
    conversationId: string
    checkpointType: CheckpointType
    previousChannel: string | null
    currentChannel: string
    messagesSinceLastCheckpoint: number
    systemPromptHash: string
    recentMessages: Array<{ role: string; content: string }>
  }): Promise<Checkpoint>

  /** Mark a checkpoint as superseded by a newer one */
  supersede(checkpointId: string): Promise<void>

  /** Expire stale checkpoints (batch job) */
  expireStale(): Promise<number>
}
```

### 5.3 ContinuityLoader

```typescript
interface ContinuityLoader {
  /** Load the best available context for a conversation */
  load(params: {
    conversationId: string
    channel: string
    messageCount?: number // messages to fetch if no checkpoint
  }): Promise<{
    checkpoint: Checkpoint | null
    contextSummary: string | null
    deltaMessages: Array<{ role: string; content: string }>
    systemPromptHash: string
    estimatedTokens: number
  }>

  /** Resolve context after a handoff */
  resolveHandoff(handoffToken: string): Promise<{
    checkpoint: Checkpoint
    conversation: Conversation
    deltaMessages: Array<{ role: string; content: string }>
  }>
}
```

### 5.4 HandoffTokenManager

```typescript
interface HandoffTokenManager {
  /** Generate a signed handoff token referencing a checkpoint */
  generate(checkpointId: string, expiresInMinutes?: number): string

  /** Validate a handoff token and return the checkpoint ID */
  validate(token: string): Promise<{ checkpointId: string; valid: boolean }>

  /** Redeem a token (one-time use) */
  redeem(token: string): Promise<Checkpoint>
}
```

Token payload:

```json
{
  "sub": "checkpoint_id",
  "exp": 1690000000,
  "iat": 1689996400,
  "jti": "unique-nonce",
  "type": "conversation_handoff"
}
```

Signed with `SUPABASE_SERVICE_ROLE_KEY` (or a dedicated CCP signing key).

### 5.5 SummaryGenerator

```typescript
interface SummaryGenerator {
  /** Generate a structured summary from recent messages */
  generateSummary(messages: Array<{ role: string; content: string }>): Promise<{
    summary: string        // 3-5 line natural language summary
    intent: Intent
    keyDecisions: string[]
    emotionalState: string
  }>

  /** Extract structured intent data from messages */
  extractIntent(messages: Array<{ role: string; content: string }>): Promise<Intent>
}
```

The SummaryGenerator uses **GPT-4o-mini** with a dedicated prompt:

```
Resume la conversación en 3-5 líneas. Incluye:
- Producto de interés principal
- Objeciones detectadas
- Intención de compra (explorando/interesado/listo)
- Próximos pasos acordados

Formato JSON.
```

Cost: ~100-200 tokens per summary generation, triggered every 5 messages. Net positive (saves ~1,400 tokens per turn thereafter).

---

## 6. Flows

### 6.1 Normal Conversation with Periodic Checkpoints

```
Time  Customer                 MIA Runtime                  Database
 │       │                        │                            │
 │   msg │─── "¿Cuánto cuesta?───►│                            │
 │       │                        │── processIncomingMessage   │
 │       │                        │   loadContext()            │
 │       │                        │   (no checkpoint → history)│
 │       │◄─── "$14,999" ─────────│                            │
 │       │                        │                            │
 │   msg │─── "¿Hay envío? ──────►│                            │
 │       │                        │── processIncomingMessage   │
 │       │◄─── "Sí, gratis >$X"── │                            │
 │       │                        │                            │
 │   msg │─── "Ok, lo quiero" ───►│                            │
 │       │                        │── msg count = 3 since start│
 │       │                        │── createCheckpoint()       │
 │       │                        │   summaryGenerator()       │
 │       │                        │   → CP#1 (periodic)        │
 │       │◄─── "Excelente ────────│───INSERT checkpoint ───────►│
 │       │     continuemos..."    │                            │
 │       │                        │                            │
 │   msg │─── "Soy de CDMX" ─────►│                            │
 │       │                        │── loadContext()            │
 │       │                        │   (checkpoint CP#1 found)  │
 │       │                        │   → summary + delta msgs   │
 │       │                        │   → ~1,400 tokens saved    │
 │       │◄─── "Envío en 3 días" ─│                            │
 │       │                        │                            │
```

### 6.2 Handoff Web Chat → WhatsApp

```
                      CCP Protocol Flow

  Browser Widget                     MIA Platform                  WhatsApp
      │                                    │                         │
      │── ¿cómo pago? ────────────────────►│                         │
      │                                    │                         │
      │                                    │── detect: intent =     │
      │                                    │   ready_to_buy          │
      │                                    │                         │
      │                                    │── createCheckpoint()    │
      │                                    │   type: handoff         │
      │                                    │   → CP#2                │
      │                                    │                         │
      │                                    │── handoffTokenManager   │
      │                                    │   .generate(CP#2.id)    │
      │                                    │   → "ccp_abc123..."    │
      │                                    │                         │
      │◄── "Para asegurar tu ──────────────│                         │
      │     pedido, continuemos            │                         │
      │     por WhatsApp.                  │                         │
      │     [Continuar por WhatsApp] ──────┼── wa.me link ──────────►│
      │     → wa.me/...?ref=ccp_abc123"   │  with handoff token     │
      │                                    │                         │
      │                                    │                         │
      │ (user clicks link)                                          │
      │                                                             │
      │                                    │◄── webhook: ───────────│
      │                                    │    incoming message     │
      │                                    │    + ref=ccp_abc123    │
      │                                    │                         │
      │                                    │── handoffTokenManager   │
      │                                    │   .redeem("ccp_abc123")│
      │                                    │   → CP#2                │
      │                                    │                         │
      │                                    │── ContinuityLoader     │
      │                                    │   .resolveHandoff()    │
      │                                    │   → summary + context  │
      │                                    │                         │
      │                                    │── buildMasterPrompt()  │
      │                                    │   + extra:             │
      │                                    │   "CONTEXTO ANTERIOR:  │
      │                                    │    Cliente interesado  │
      │                                    │    en X200. Objeción   │
      │                                    │    de precio resuelta. │
      │                                    │    Preguntó por envío  │
      │                                    │    a CDMX. Intención   │
      │                                    │    de compra alta."    │
      │                                    │                         │
      │                                    │── MIA response:        │
      │◄── "¡Gracias por ──────────────────│─── "¡Gracias por       │
      │     continuar!                     │      continuar por      │
      │     (widget shows:                 │      aquí! Retomando:   │
      │     "Continuamos por               │      te interesaba el  │
      │     WhatsApp")"                    │      X200... ¿Comenzamos│
      │                                    │      con tu pedido?"   │
```

### 6.3 Agent Transfer

```
  Customer                   MIA Runtime                    Human Agent
     │                          │                              │
     │── "Necesito ayuda ──────►│                              │
     │   con la instalación"    │                              │
     │                          │── detect: needs human        │
     │                          │                              │
     │                          │── createCheckpoint()         │
     │                          │   type: agent_transfer       │
     │                          │                              │
     │                          │── ContinuityLoader          │
     │                          │   .load(conversationId)      │
     │                          │                              │
     │                          │          load CP#3 ─────────►│
     │                          │          "Resumen: Cliente   │
     │                          │           compró X200,       │
     │                          │           necesita ayuda     │
     │                          │           con instalación    │
     │                          │           en CDMX.           │
     │                          │           Objeciones:        │
     │                          │           precio, envío.     │
     │                          │           Productos: [X200]" │
     │                          │                              │
     │◄── "Te conecto con ──────│◄── "Ok, lo atiendo yo" ─────│
     │     un asesor..."        │                              │
     │                          │                              │
     │                          │── conversation.assigned_to   │
     │                          │   = agent_id                 │
     │                          │                              │
     │◄── (agent takes over) ───│                              │
```

### 6.4 Reconnection After Timeout

```
  Customer                   MIA Runtime                    Database
     │                          │                              │
     │ (closes browser)         │                              │
     │     ... 2 hours later ...│                              │
     │                          │                              │
     │── (opens widget) ───────►│                              │
     │   "Hola, volví"          │                              │
     │                          │── resolveCustomer()          │
     │                          │── resolveConversation()      │
     │                          │   → existing conv + CP#4     │
     │                          │                              │
     │                          │── check CP#4.expires_at      │
     │                          │   → still valid (24h TTL)    │
     │                          │                              │
     │                          │── load from CP#4             │
     │                          │   summary + delta (0 new)    │
     │                          │                              │
     │                          │── "CONTEXTO ANTERIOR:        │
     │                          │    Estaba viendo el X200..." │
     │                          │                              │
     │◄── "¡Bienvenido de ──────│                              │
     │     vuelta! Estábamos    │                              │
     │     viendo el X200..."   │                              │
```

---

## 7. Token Optimization: Detailed Analysis

### 7.1 Current Cost per Turn

| Component | Tokens | Notes |
|-----------|--------|-------|
| System prompt `buildMasterPrompt()` | ~800 | Fixed per business/assistant |
| Last 20 chat messages (avg 100 tokens each) | ~2,000 | Grows with conversation length |
| User message | ~50 | Current turn |
| **Total per turn** | **~2,850** | |

### 7.2 CCP Cost per Turn

| Component | Tokens | Notes |
|-----------|--------|-------|
| System prompt `buildMasterPrompt()` | ~800 | Same, but cached; only rebuilt on data change |
| Checkpoint summary | ~200 | AI-generated, frozen at checkpoint time |
| Delta messages since checkpoint | ~500 | 5 msgs × 100 tokens |
| **Total per turn (with checkpoint)** | **~1,500** | |
| **Total per turn (cached system prompt)** | **~700** | System prompt not rebuilt |

### 7.3 Savings Over Conversation Lifecycle

```
Tokens
  ^
  |   Without CCP
6K │         ╱╲
  |        ╱  ╲
5K │       ╱    ╲
  |      ╱      ╲
4K │     ╱        ╲
  |    ╱          ╲
3K │   ╱            ╲
  |  ╱              ╲
2K │ ╱                ╲
  |╱                  ╲
1K │                    ╲      With CCP (checkpoints at █)
  |                      ╲    ───
  └──────────────────────────▶ Turn number
   1  2  3  4  5  6  7  8  9 10

  █ = checkpoint created (every 5 turns)
  After █: drops from ~3K to ~1K per turn
```

### 7.4 Additional Savings: Summary Only Mode

When a customer returns after a long gap or on a different channel, CCP can use **summary-only mode** — instead of sending the checkpoint summary + delta messages, it sends only the summary (saving the delta). This is appropriate when:

- The delta messages are stale (>1 hour old)
- The channel changed (the new channel doesn't need the raw verbatim history)
- Token cost reduction is prioritized over verbatim memory

---

## 8. Implementation Plan

### Phase 1: Core CCP

1. Create `conversation_checkpoints` table + audit log (new migration)
2. Add `current_checkpoint_id` to `conversations` (new migration)
3. Build `CheckpointEngine` (`src/lib/ccp/engine.ts`)
4. Build `ContinuityLoader` (`src/lib/ccp/loader.ts`)
5. Build `SummaryGenerator` (`src/lib/ccp/summary.ts`)
6. Integrate into `processIncomingMessage()` for periodic checkpointing

### Phase 2: Handoff Protocol

1. Build `HandoffTokenManager` (`src/lib/ccp/handoff.ts`)
2. Integrate handoff flow into ChannelBus (ADR-005)
3. Add handoff endpoint: `POST /api/ccp/handoff`
4. Add redeem endpoint: `POST /api/ccp/redeem`

### Phase 3: Agent Transfer

1. Add agent transfer trigger in runtime
2. Build agent dashboard panel showing checkpoint summary
3. Integrate with conversation assignment

### Phase 4: Optimization

1. Implement system prompt caching (hash-based)
2. Implement summary-only mode for stale checkpoints
3. Add CCP metrics dashboard (tokens saved, checkpoints created)
4. Expire stale checkpoints via cron job

---

## 9. Security Considerations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Handoff token forgery | **Critical** | JWT signed with `SUPABASE_SERVICE_ROLE_KEY` (HS256). Token includes `jti` (nonce), `exp`, and `type: conversation_handoff`. |
| Token replay attack | High | Single-use tokens: `redeem()` marks used. Second attempt returns 410 Gone. |
| Checkpoint tampering | High | `context_snapshot` is stored in the database with RLS. Only the admin client writes. |
| Token interception | Medium | Short TTL (30 min for handoff, 5 min for reconnection). WSS-only for Web Chat. |
| Data leakage via summary | Medium | Summary is generated by AI and stored in DB. Same RLS as conversations. No PII should be included (AI instruction to exclude sensitive data). |
| Checkpoint exhaustion (spam) | Low | Rate limit checkpoint creation: max 1 per 30 seconds per conversation. |

### Token Specification

```typescript
interface HandoffTokenPayload {
  sub: string           // checkpoint_id
  exp: number           // expiration (epoch)
  iat: number           // issued at (epoch)
  jti: string           // unique nonce (uuid)
  type: 'conversation_handoff'
  cid: string           // conversation_id (for quick lookup without DB)
}
```

Encoding: base64url-encoded JWT, prefixed with `ccp_` for recognizability.

Example: `ccp_eyJhbGciOiJIUzI1NiIs...`

---

## 10. Checkpoint Expiration Policy

| Checkpoint Type | Default TTL | Rationale |
|----------------|------------|-----------|
| `periodic` | 24 hours | Customer may return within a day |
| `handoff` | 30 minutes | Customer should click link soon |
| `agent_transfer` | 2 hours | Agent should pick up within SLA |
| `channel_switch` | 1 hour | Switch should be rapid |
| `reconnection` | 5 minutes | Reconnection is immediate |

Batch cleanup runs every hour via cron job (`supabase/ functions/ccp-expire`).

---

## 11. Impact Analysis

### 11.1 Positive Impacts

| Area | Impact |
|------|--------|
| **Cross-channel continuity** | Customer moves between Web, WhatsApp, Messenger without losing context |
| **Token cost reduction** | ~60-75% reduction in prompt tokens per turn after checkpoint is established |
| **Faster responses** | Less prompt processing = lower latency |
| **Agent productivity** | Human agents get structured summaries, not raw logs |
| **Reconnection** | Returning customers pick up where they left off |
| **Auditability** | Complete checkpoint chain preserves conversation state at every key moment |

### 11.2 Negative Impacts

| Area | Impact |
|------|--------|
| **Storage** | ~1-5 KB per checkpoint in JSONB. At 1,000 convs/day × 5 checkpoints = ~5 MB/day. Negligible. |
| **AI cost for summaries** | ~200 tokens per summary generation. Every 5 messages = ~40 tokens/message overhead. Net positive after 2 turns. |
| **Complexity** | New subsystem (CCP) with 4 components + 2 new tables + migration |
| **Latency on checkpoint** | +300-500ms when generating summary (first checkpoint at message 5). Background/async possible. |

### 11.3 Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Summary drifts from actual conversation | Low | Checkpoint is always supplemented by delta messages from the same DB. Summary is a hint, not the source of truth. |
| Handoff token expires before use | Medium | Widget UI shows "Link expirado — genera uno nuevo". Background renewal. |
| Checkpoint created on every message (too many) | Medium | Minimum interval enforced: 30s between checkpoints. Configurable message threshold (default 5). |
| Summary generation fails | Low | Fallback: no checkpoint, use existing history-based behavior. |

### 11.4 Technical Impact

| Component | Change | Effort |
|-----------|--------|--------|
| `src/lib/ccp/engine.ts` | **New** — CheckpointEngine | Medium |
| `src/lib/ccp/loader.ts` | **New** — ContinuityLoader | Medium |
| `src/lib/ccp/summary.ts` | **New** — SummaryGenerator | Small |
| `src/lib/ccp/handoff.ts` | **New** — HandoffTokenManager | Small |
| `src/lib/runtime/runtime.ts` | Integrate CCP into `processIncomingMessage` | Medium |
| `src/lib/runtime/runtime.ts` | Modify `processStreaming` for CCP | Small |
| `src/lib/conversation/context.ts` | Add checkpoint-aware loading | Medium |
| `supabase/migrations/` | 2 new tables + 1 ALTER TABLE | Small |
| `src/app/api/ccp/` | **New** — handoff + redeem endpoints | Small |
| Dashboard | Agent transfer panel with checkpoint display | Medium |

---

## 12. Relationship to Other ADRs

| ADR | Relationship |
|-----|-------------|
| **ADR-005** (Channel Abstraction) | **Required** — CCP runs on top of ChannelBus. Checkpoints reference `channel` from ADR-005. |
| **ADR-004** (Health Policy) | Independent — CCP transports the checkpoint regardless of content |
| **ADR-007** (Web Widget SDK) | CCP enables the widget to display "Continuamos por WhatsApp" state |
| **ADR-008** (Conversation Center) | Conversation Center uses CCP checkpoints for agent transfer summaries |

---

## 13. Open Questions

1. Should checkpoint summaries be generated synchronously (on the message turn) or asynchronously (background job)? Async avoids latency but risks the checkpoint not being ready for an immediate handoff.
2. Should the `context_snapshot` include the full system prompt text or just a hash? Full text enables complete reconstruction without running `buildMasterPrompt()` but duplicates data. Hash requires recomputation on load.
3. Should CCP be optional (businesses opt in) or default behavior? Opt-in reduces risk but means the benefits are not universal.
4. Should the periodic checkpoint threshold be dynamic (based on conversation complexity/turns) or fixed (every N messages)?

---

## 14. Council Notes

- **CTO**: CCP transforms MIA from a single-channel stateless chatbot into a true multi-channel platform. The token economics are compelling, but the strategic value is continuity — it's the difference between "start over" and "continue where you left off." Approve with Phase 1 first.
- **Architect**: The checkpoint chain design mirrors event sourcing patterns. The source of truth remains the message log; checkpoints are purely a performance optimization and continuity enabler. This is the right decoupling.
- **AI Engineer**: The summary generation cost is easily justified: ~200 tokens to save ~1,400 per subsequent turn. The summary prompt should be optimized for structure/function extraction, not creative writing. Consider using a smaller model (e.g., `gpt-4o-mini` with `max_tokens=400`) specifically for summary generation.
- **Security Engineer**: Handoff token security is the critical path. The single-use requirement is non-negotiable. Also: the `context_snapshot` must be scrubbed of any PII that the original messages might contain — the AI generating the summary should receive an instruction to exclude sensitive data.
- **Product Manager**: The reconnection flow (6.4) is the most impactful to customer experience. "Bienvenido de vuelta" with context is the difference between a frustrating experience and a delightful one. Prioritize Phase 1 for reconnection, Phase 2 for handoff.
