# ADR-008: Conversation Center — Unified Inbox & Agent Workspace

## Status

Proposed

## Date

2026-07-29

## Council

CTO, Architect, Product Manager, Backend Engineer, Frontend Engineer, Security Engineer, Performance Engineer

---

## 1. Context

### 1.1 The Problem

MIA has conversations — but no single place to see them.

| Capability | Today | Needed |
|-----------|-------|--------|
| Browse all conversations | ❌ Dashboard shows 10 recent live conversations only | One list: live + training + simulation, filtered by type, status, date, assistant |
| View conversation history | ❌ Chat UI loads empty on mount; existing messages in DB never fetched | Load full message history from DB when opening a conversation |
| Search conversations | ❌ No search | Search by customer name, content, date range, status |
| Agent assignment | ⚠️ `assigned_to` column exists in schema — no UI to set or view it | Assign, unassign, see who's handling what |
| Handover management | ⚠️ `handover_reason` column exists — no UI | Review handover reasons, take ownership |
| Conversation details | ❌ No page for a single conversation | Full conversation view: messages, customer info, context used, heuristic signals |
| Archive management | ❌ No way to archive or view archived conversations | Archive active, browse archived, restore |

The platform has **three conversation types** (`training`, `live`, `simulation`) that currently live in isolated silos:

```
Training Chat        → /dashboard/assistants/[id]/training  (one-at-a-time)
Live Conversations   → Dashboard widget only (last 10)
Simulation Sessions  → /dashboard/laboratorio               (self-contained)
```

There is no **unified view** — a business owner cannot see all customer interactions in one place.

### 1.2 What This Enables

- **Business visibility**: See every conversation happening across all assistants and channels
- **Agent collaboration**: Know who is handling which conversation; enable handovers
- **Quality assurance**: Review past conversations for training and compliance
- **Customer 360**: Full conversation history linked to customer profile
- **Heuristic feedback**: See heuristic signals and hypotheses alongside messages (per ADR-007)
- **CCP integration**: Restored conversations from checkpoints are visible here (per ADR-006)

### 1.3 Existing Infrastructure

The groundwork is already in place:

| Asset | Status | Details |
|-------|--------|---------|
| `conversations` table | ✅ Exists | `id`, `assistant_id`, `customer_id`, `type`, `status`, `assigned_to`, `handover_reason`, `created_at` |
| `messages` table | ✅ Exists | `id`, `conversation_id`, `role`, `content`, `metadata`, `created_at` |
| `customers` table | ✅ Exists | Full customer profile with tags, signals |
| RLS policies | ✅ Exists | Business-scoped via `assistant_id → business_id` |
| Chat API | ✅ Exists | `POST /api/chat` with streaming, message persistence |
| Runtime | ✅ Exists | `processStreaming()`, `processIncomingMessage()`, `resolveConversation()` |
| `assigned_to` column | ⚠️ Existing, unused | FK to `auth.users` — no UI |
| `handover_reason` column | ⚠️ Existing, unused | Free text — no UI |

---

## 2. Decision

### 2.1 What We Are Building

The **Conversation Center** is a dedicated section of the dashboard that provides:

1. **Unified Inbox** — browse, filter, and search all conversations
2. **Conversation Detail** — full message history with context and metadata
3. **Agent Workspace** — assignment, handover, status management
4. **Message History Loading** — existing messages loaded from DB when viewing a conversation

### 2.2 What We Are NOT Building (v1)

| Not in v1 | Rationale |
|-----------|-----------|
| Real-time updates (WebSocket) | Deferred to ADR-005 (Channel Abstraction) implementation |
| Bulk actions (archive all, assign batch) | UI complexity not justified yet |
| Conversation tags/labels | Can be added later as JSONB on conversations table |
| Analytics dashboard | Separate concern — belongs in Analytics feature |
| Customer reply via Conversation Center | v1 is read-only for messages; replies happen through native channels |

### 2.3 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONVERSATION CENTER                           │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────────────────────┐   │
│  │  Unified Inbox   │    │     Conversation Detail          │   │
│  │                  │    │                                  │   │
│  │  □ Filters bar   │    │  ┌──────────────────────────┐    │   │
│  │  □ Conversation  │───►│  │ Message Timeline         │    │   │
│  │    list          │    │  │  (loaded from DB)        │    │   │
│  │  □ Search        │    │  └──────────────────────────┘    │   │
│  │  □ Pagination    │    │  ┌──────────────────────────┐    │   │
│  └──────────────────┘    │  │ Customer Sidebar         │    │   │
│                          │  │  (profile, signals,      │    │   │
│  ┌──────────────────┐    │  │   conversation count)    │    │   │
│  │  Agent Workspace │    │  └──────────────────────────┘    │   │
│  │                  │    │  ┌──────────────────────────┐    │   │
│  │  □ Assignment    │    │  │ Context Used Panel       │    │   │
│  │  □ Handover log  │    │  │  (products, rules,       │    │   │
│  │  □ Status mgmt   │    │  │   knowledge, heuristic)  │    │   │
│  └──────────────────┘    │  └──────────────────────────┘    │   │
│                          └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Navigation

The Conversation Center lives at `/dashboard/conversations`:

```
/dashboard/conversations          → Unified Inbox (list view)
/dashboard/conversations/[id]      → Conversation Detail
```

A new nav item is added to the sidebar:

| # | Route | Label | Icon |
|---|-------|-------|------|
| ... | ... | ... | ... |
| 3 | `/dashboard/conversations` | Conversaciones | 💬 |

### 2.5 Data Flow

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Inbox Page  │     │  API Route      │     │  Database        │
│              │     │                 │     │                  │
│  Load list   │────►│  GET /api/      │────►│  SELECT from     │
│  with filters│     │  conversations  │     │  conversations   │
│              │     │                 │     │  + JOIN customers│
│              │◄────│  JSON response  │◄────│  + JOIN messages │
│              │     │  + pagination   │     │  (count only)    │
└──────────────┘     └─────────────────┘     └──────────────────┘
                                                      │
┌──────────────┐     ┌─────────────────┐              │
│  Detail Page │     │  API Route      │              │
│              │     │                 │              │
│  Load conv   │────►│  GET /api/      │──────────────►
│  + messages  │     │  conversations  │              │
│              │     │  /[id]          │  SELECT from │
│              │◄────│  JSON response  │  messages    │
│              │     │  + messages[]   │  JOIN context│
└──────────────┘     └─────────────────┘              │
                                                      │
┌──────────────┐     ┌─────────────────┐              │
│  Agent Panel │     │  PATCH /api/    │              │
│              │     │  conversations  │──────────────►
│  Assign      │────►│  /[id]          │  UPDATE      │
│  Archive     │     │                 │  conversations│
│  Handover    │     │  → 200 OK       │              │
└──────────────┘     └─────────────────┘              │
```

**Key principle**: All conversation data is fetched from the database on page load. The chat components that previously started empty will be updated to accept and display existing messages.

---

## 3. Data Model

### 3.1 Changes to `conversations` Table

Minimal changes — the existing table already supports most needs:

```sql
-- Add updated_at for sorting by last activity
ALTER TABLE conversations ADD COLUMN updated_at TIMESTAMPTZ;
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);

-- Add title for display (auto-generated from first message content)
ALTER TABLE conversations ADD COLUMN title TEXT;

-- Populate updated_at for existing rows
UPDATE conversations SET updated_at = created_at WHERE updated_at IS NULL;

-- Make updated_at default to now() for new rows
ALTER TABLE conversations ALTER COLUMN updated_at SET DEFAULT now();
```

**Why not a new table?** The existing `conversations` table already has all the columns needed (`assigned_to`, `handover_reason`, `status`, `type`). Adding `updated_at` is sufficient for sorting by recent activity.

### 3.2 Message Loading

The existing `messages` table is sufficient. The key change is in the application layer:

- **Before**: Chat components start with `messages = []` and never load from DB
- **After**: Conversation Detail page fetches all messages via API and displays them

---

## 4. API Design

### 4.1 `GET /api/conversations`

List conversations with filtering, search, and pagination.

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | `'live' \| 'training' \| 'simulation' \| 'all'` | `'live'` | Filter by conversation type |
| `status` | `'active' \| 'archived' \| 'all'` | `'active'` | Filter by status |
| `assistant_id` | `UUID` | — | Filter by specific assistant |
| `assigned_to` | `UUID` | — | Filter by assigned agent |
| `unassigned` | `boolean` | `false` | Show only unassigned conversations |
| `q` | `string` | — | Search query (matches customer name, title, message content) |
| `from` | `ISO date` | — | Start date |
| `to` | `ISO date` | — | End date |
| `page` | `integer` | `1` | Page number |
| `per_page` | `integer` | `20` | Items per page (max 50) |
| `sort` | `'updated_at' \| 'created_at'` | `'updated_at'` | Sort field |

**Response**:

```json
{
  "conversations": [
    {
      "id": "uuid",
      "title": "Consulta sobre productos para uñas",
      "type": "live",
      "status": "active",
      "assistant_name": "MIA Vitanova",
      "assistant_id": "uuid",
      "customer": {
        "id": "uuid",
        "name": "María García",
        "phone": "+56912345678",
        "tags": ["vip", "returning"]
      },
      "assigned_to": {
        "id": "uuid",
        "name": "Carlos Muñoz"
      },
      "handover_reason": null,
      "message_count": 12,
      "last_message": "Gracias, lo voy a pensar",
      "last_message_at": "2026-07-29T15:30:00Z",
      "created_at": "2026-07-29T14:00:00Z",
      "updated_at": "2026-07-29T15:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 156,
    "total_pages": 8
  }
}
```

### 4.2 `GET /api/conversations/[id]`

Full conversation detail with messages.

**Response**:

```json
{
  "conversation": {
    "id": "uuid",
    "title": "Consulta sobre productos para uñas",
    "type": "live",
    "status": "active",
    "assistant": {
      "id": "uuid",
      "name": "MIA Vitanova"
    },
    "customer": {
      "id": "uuid",
      "name": "María García",
      "phone": "+56912345678",
      "email": "maria@email.com",
      "tags": ["vip", "returning"],
      "signals": {
        "observed": { "age": { "value": "60+", "firstSeen": "..." } },
        "inferred": { "duration": { "value": ">1year", "probability": 0.85 } }
      },
      "conversation_count": 3,
      "last_interaction": "2026-07-29T15:30:00Z"
    },
    "assigned_to": {
      "id": "uuid",
      "name": "Carlos Muñoz"
    },
    "handover_reason": null,
    "messages": [
      {
        "id": "uuid",
        "role": "user",
        "content": "Hola, tengo 62 años y mis uñas cambiaron de color",
        "created_at": "2026-07-29T14:00:00Z"
      },
      {
        "id": "uuid",
        "role": "assistant",
        "content": "Entiendo. Con la edad...",
        "metadata": {
          "used_context": [
            { "type": "product", "id": "uuid" },
            { "type": "rule", "id": "uuid" }
          ],
          "heuristic_context": {
            "stage": "exploring",
            "signals": [...],
            "hypotheses": [...]
          }
        },
        "created_at": "2026-07-29T14:00:05Z"
      }
    ],
    "created_at": "2026-07-29T14:00:00Z",
    "updated_at": "2026-07-29T15:30:00Z"
  }
}
```

### 4.3 `PATCH /api/conversations/[id]`

Update conversation metadata (assignment, status, handover).

**Request body**:

```json
{
  "assigned_to": "uuid | null",
  "status": "active | archived",
  "handover_reason": "string (required when assigned_to changes)"
}
```

**Validation**:
- `handover_reason` is required when `assigned_to` changes (to track why the handover happened)
- `status` transitions: `active → archived`, `archived → active`
- Only the business owner or assigned agent can update

**Response**: `200 OK` with updated conversation object.

---

## 5. UI Design

### 5.1 Unified Inbox (`/dashboard/conversations`)

```
┌─────────────────────────────────────────────────────────────────┐
│  💬 Conversaciones                                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ [🔍 Buscar...         ] [Tipo: ▼] [Estado: ▼] [Asistente: ▼]││
│  │ [Asignado a: ▼] [Desde: ■] [Hasta: ■]   [5 resultados]      ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ 🟢 María García              hace 2 min      MIA Vitanova   ││
│  │  "Gracias, lo voy a pensar"                   12 msgs • 👤 C ││
│  ├──────────────────────────────────────────────────────────────┤│
│  │ 🟢 Juan Pérez                hace 15 min     MIA Zapatos    ││
│  │  "¿Tienen en color negro?"                    8 msgs • ─     ││
│  ├──────────────────────────────────────────────────────────────┤│
│  │ 🟡 Entrenamiento - MIA Vitanova  hace 1h      ▶ En curso    ││
│  │  "Cliente: necesito zapatos cómodos"        24 msgs • 🧪    ││
│  ├──────────────────────────────────────────────────────────────┤│
│  │ 🔴 Laboratorio - Modo Difícil     hace 3h      ▶ Completada ││
│  │  "Evaluación: 7.5/10"                          34 msgs • 🔬  ││
│  ├──────────────────────────────────────────────────────────────┤│
│  │ ⚪ Carlos Soto                hace 1d          MIA Vitanova  ││
│  │  "Sí, me interesa"                               👤 C       ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [← Anterior]  1 2 3 ... 8  [Siguiente →]                      │
└─────────────────────────────────────────────────────────────────┘
```

**Conversation row indicators**:

| Indicator | Meaning |
|-----------|---------|
| 🟢 Green dot | Active conversation, recent activity |
| 🟡 Yellow dot | Training conversation in progress |
| 🔴 Red badge | Archived/completed conversation |
| 👤 C | Assigned to agent (shows initials) |
| ─ | Unassigned |
| 🧪 | Type: training |
| 🔬 | Type: simulation (lab session) |
| No badge | Type: live |

**Filter bar behavior**:
- Default: active, live conversations, sorted by `updated_at DESC`
- Filters are persisted in URL search params (shareable/bookmarkable)
- "Unassigned" is a fast-filter button (not a dropdown option)
- Search queries are debounced (300ms)

### 5.2 Conversation Detail (`/dashboard/conversations/[id]`)

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Volver a Conversaciones         💬 Conversación              │
│                                                      [Archivar] │
│  ┌──────────────────────────────┐  ┌────────────────────────────┐│
│  │ 💬 MARÍA GARCÍA              │  │ 👤 ASIGNADA A              ││
│  │  Consulta sobre productos    │  │  Carlos Muñoz              ││
│  │  para uñas                   │  │  [Reasignar] [Tomar]       ││
│  │                              │  │                            ││
│  │  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │  │ 🗒 MOTIVO DE TRANSFERENCIA ││
│  │  │ 14:00 │ María           │  │  │  Cliente preguntó por     ││
│  │  │ "Hola, tengo 62 años y │  │  │  precio exacto, requería  ││
│  │  │  mis uñas cambiaron..." │  │  │  autorización            ││
│  │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │  └────────────────────────────┘
│  │  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │  ┌────────────────────────────┐│
│  │  │ 14:00 │ MIA             │  │  │ 👤 CLIENTE                ││
│  │  │ "Entiendo. Con la edad │  │  │  María García             ││
│  │  │  el crecimiento..."    │  │  │  +56912345678              ││
│  │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │  │  maria@email.com           ││
│  │    [🔍 ¿Por qué respondió     │  │  🏷 vip, returning         ││
│  │     esto?]                    │  │  💬 3 conversaciones       ││
│  │  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │  └────────────────────────────┘│
│  │  │ 14:05 │ María           │  │  ┌────────────────────────────┐│
│  │  │ "Como 4 meses..."       │  │  │ 📋 CONTEXTO UTILIZADO     ││
│  │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │  │                          ││
│  │  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │  │ 📦 Productos             ││
│  │  │ 14:05 │ MIA             │  │  │  · Kit Tratamiento Uñas  ││
│  │  │ "Bien. En 4 meses..."   │  │  │                          ││
│  │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │  │ 📋 Reglas                ││
│  │    [🔍 ¿Por qué respondió     │  │  · No prometer plazos    ││
│  │     esto?]                    │  │                          ││
│  │  ...                          │  │ 🧠 Huerística            ││
│  │                               │  │  · Edad: 60+            ││
│  │                               │  │  · Duración: >1a (85%)  ││
│  │                               │  │  · Estrategia: paciente ││
│  │                               │  └────────────────────────────┘│
│  └──────────────────────────────┘  └────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Left panel — Message Timeline**:
- Load ALL messages from DB on mount
- Each message shows: role icon, timestamp, content
- Assistant messages have a "🔍 ¿Por qué respondió esto?" button (reuses Laboratorio's `ResponseAnalysis` pattern)
- Messages are NOT editable from this view (v1 is read-only)
- Scroll to bottom on load
- Auto-refresh periodically (30s polling) for active conversations

**Right panel — Context Sidebar**:
- **Assignment section**: Current assignee, reassign/take buttons, handover reason
- **Customer section**: Name, contact info, tags, conversation count, link to customer profile
- **Context Used section**: Products, rules, knowledge, instructions referenced in the conversation
- **Heuristic section**: Current conversation stage, detected signals, active hypotheses (per ADR-007)

### 5.3 Agent Workspace (Inbox integrated)

The agent workspace is integrated into the Inbox and Detail views — no separate page:

| Action | Where | How |
|--------|-------|-----|
| Assign to me | Inbox (row context menu) | Click "Asignarme" |
| Assign to other | Detail (sidebar) | Select agent from dropdown |
| Unassign | Detail (sidebar) | Click "Liberar" |
| Archive | Detail (header) | Click "Archivar" button |
| Restore | Inbox (with "archived" filter) | Click "Restaurar" |
| View handover history | Detail (sidebar) | See handover_reason field |
| Transfer with reason | Detail (sidebar) | Change assigned_to + enter reason |

---

## 6. Frontend Components

### 6.1 New Components

| Component | Location | Description |
|-----------|----------|-------------|
| `ConversationsPage` | `src/app/dashboard/conversations/page.tsx` | Server component — renders InboxClient |
| `InboxClient` | `src/components/conversations/InboxClient.tsx` | Client component — filters, list, pagination |
| `ConversationRow` | `src/components/conversations/ConversationRow.tsx` | Single row in the inbox list |
| `FilterBar` | `src/components/conversations/FilterBar.tsx` | Search + filter controls |
| `ConversationDetailPage` | `src/app/dashboard/conversations/[id]/page.tsx` | Server component — fetches conversation |
| `DetailClient` | `src/components/conversations/DetailClient.tsx` | Client component — message timeline + sidebar |
| `MessageTimeline` | `src/components/conversations/MessageTimeline.tsx` | Renders the full message history |
| `MessageBubble` | `src/components/conversations/MessageBubble.tsx` | Single message display |
| `ContextSidebar` | `src/components/conversations/ContextSidebar.tsx` | Right panel with assignment, customer, context |
| `AssignmentPanel` | `src/components/conversations/AssignmentPanel.tsx` | Assign/reassign/unassign UI |
| `CustomerPanel` | `src/components/conversations/CustomerPanel.tsx` | Customer info summary |
| `UsedContextPanel` | `src/components/conversations/UsedContextPanel.tsx` | Products, rules, knowledge used |
| `HeuristicPanel` | `src/components/conversations/HeuristicPanel.tsx` | Signals, hypotheses, strategy (ADR-007) |

### 6.2 Component Tree

```
/dashboard/conversations
  └── page.tsx (Server)
       └── InboxClient (Client)
            ├── FilterBar
            │    ├── SearchInput
            │    ├── TypeFilter (dropdown)
            │    ├── StatusFilter (dropdown)
            │    ├── AssistantFilter (dropdown)
            │    ├── AssignmentFilter (dropdown + "Unassigned" button)
            │    └── DateRangeFilter
            ├── ConversationList
            │    └── ConversationRow × N
            └── Pagination

/dashboard/conversations/[id]
  └── page.tsx (Server — loads conversation + messages)
       └── DetailClient (Client)
            ├── Header (back button, title, archive button)
            ├── MessageTimeline
            │    └── MessageBubble × N
            │         └── ResponseAnalysis (existing)
            └── ContextSidebar
                 ├── AssignmentPanel
                 ├── CustomerPanel
                 └── UsedContextPanel
                      ├── ProductsList
                      ├── RulesList
                      └── HeuristicPanel
```

---

## 7. API Implementation

### 7.1 Route Structure

```
src/app/api/conversations/
├── route.ts            # GET /api/conversations — list with filters
└── [id]/
    ├── route.ts        # GET  /api/conversations/[id] — detail + messages
                        # PATCH /api/conversations/[id] — update assignment/status
```

### 7.2 Key Query Patterns

**List conversations** — uses the server client (read-only):

```sql
SELECT
  c.id, c.title, c.type, c.status, c.assigned_to, c.handover_reason,
  c.created_at, c.updated_at,
  cust.name AS customer_name, cust.phone AS customer_phone,
  cust.tags AS customer_tags,
  a.name AS assistant_name,
  u.name AS assigned_name,
  (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
  (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
  (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
FROM conversations c
JOIN assistants a ON a.id = c.assistant_id
LEFT JOIN customers cust ON cust.id = c.customer_id
LEFT JOIN auth.users u ON u.id = c.assigned_to
WHERE a.business_id = $businessId
  AND (c.type = $type OR $type = 'all')
  AND (c.status = $status OR $status = 'all')
  AND (c.assistant_id = $assistantId OR $assistantId IS NULL)
  AND (c.assigned_to = $assignedTo OR $assignedTo IS NULL)
  AND ($unassigned = false OR c.assigned_to IS NULL)
  AND (c.title ILIKE $search OR cust.name ILIKE $search OR $search = '')
ORDER BY c.updated_at DESC
LIMIT $perPage OFFSET ($page - 1) * $perPage
```

### 7.3 Auth & Authorization

- All routes require authentication (user session)
- Business scope enforced via RLS on all queries
- Admin client used for PATCH operations (to bypass RLS for writes, per AGENTS.md auth flow rules)
- Assignment validation: user must belong to the same business as the conversation

---

## 8. Implementation Plan

### Phase 1: Backend API (Days 1-2)

1. Add `updated_at` and `title` columns to `conversations` (migration 010)
2. Backfill `updated_at` and `title` for existing conversations
3. Implement `GET /api/conversations` with filters, search, pagination
4. Implement `GET /api/conversations/[id]` with messages and context
5. Implement `PATCH /api/conversations/[id]` for assignment and status
6. Write tests for all endpoints

### Phase 2: Unified Inbox UI (Days 3-4)

1. Add "Conversaciones" nav item to sidebar
2. Create `InboxClient` with `FilterBar` and `ConversationRow`
3. Implement search, filter (persisted in URL params), pagination
4. Implement row indicators (type, status, assignment badges)
5. Polish: loading states, empty states, error states

### Phase 3: Conversation Detail UI (Days 5-6)

1. Create `DetailClient` with `MessageTimeline` and `ContextSidebar`
2. Implement message loading from DB (first time chat components load existing messages)
3. Create `AssignmentPanel` (assign, unassign, handover)
4. Create `CustomerPanel` (customer info summary)
5. Create `UsedContextPanel` (context used in conversation)
6. Integrate "¿Por qué respondió esto?" analysis (reuse from Laboratorio)

### Phase 4: Polish & Integration (Days 7-8)

1. Add auto-refresh for active conversations (30s polling)
2. Add heuristic panel integration (ADR-007)
3. Add conversation title auto-generation (first meaningful user message)
4. Edge cases: conversations with deleted customers, very long conversations, empty conversations
5. Accessibility review

---

## 9. Impact Analysis

### 9.1 Positive Impacts

| Area | Impact |
|------|--------|
| **Business visibility** | Business owners see ALL customer conversations in one place |
| **Agent productivity** | Know what's assigned, manage handovers, reduce dropped conversations |
| **Quality assurance** | Review past conversations for training, compliance, and improvement |
| **Customer 360** | Full conversation history alongside customer profile |
| **Heuristic feedback** | Heuristic signals visible alongside messages (ADR-007 integration) |
| **CCP synergy** | Restored conversations visible in the inbox (ADR-006) |

### 9.2 Negative Impacts

| Area | Impact |
|------|--------|
| **API load** | New queries for conversation listing and detail — mitigated by pagination (20 per page) and selective loading (no messages loaded until detail view) |
| **UI complexity** | New page with multiple panels and interaction patterns |
| **Message loading** | First time chat components load existing messages — may expose performance issues for very long conversations |

### 9.3 Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Large conversation sets load slowly | Medium | Pagination (20 per page), message loading only in detail view, content truncated to 200 chars in list |
| Concurrent assignment conflicts | Low | Last-write-wins for assignment; handover_reason logged for audit |
| Conversations with 1000+ messages | Low | Capped at 100 loaded initially, "load more" button for history |
| Archived conversations clutter results | Low | Default filter shows only active; archived requires explicit filter |

### 9.4 Technical Impact

| Component | Change | Effort |
|-----------|--------|--------|
| `supabase/migrations/010_conversation_center.sql` | **New** — add `updated_at`, `title` to `conversations` | Small |
| `src/app/api/conversations/route.ts` | **New** — GET list with filters | Medium |
| `src/app/api/conversations/[id]/route.ts` | **New** — GET detail + messages, PATCH update | Medium |
| `src/components/dashboard/Sidebar.tsx` | Add "Conversaciones" nav item | Small |
| `src/app/dashboard/conversations/page.tsx` | **New** — Inbox page | Small |
| `src/app/dashboard/conversations/[id]/page.tsx` | **New** — Detail page | Small |
| `src/components/conversations/InboxClient.tsx` | **New** — Inbox client | Medium |
| `src/components/conversations/FilterBar.tsx` | **New** — Filters | Medium |
| `src/components/conversations/ConversationRow.tsx` | **New** — Row | Small |
| `src/components/conversations/DetailClient.tsx` | **New** — Detail client | Medium |
| `src/components/conversations/MessageTimeline.tsx` | **New** — Timeline | Medium |
| `src/components/conversations/MessageBubble.tsx` | **New** — Bubble | Small |
| `src/components/conversations/ContextSidebar.tsx` | **New** — Sidebar | Medium |
| `src/components/conversations/AssignmentPanel.tsx` | **New** — Assignment | Small |
| `src/components/conversations/CustomerPanel.tsx` | **New** — Customer info | Small |
| `src/components/conversations/UsedContextPanel.tsx` | **New** — Context view | Small |
| `src/components/conversations/HeuristicPanel.tsx` | **New** — Heuristic view | Small |

---

## 10. Relationship to Other ADRs

| ADR | Relationship |
|-----|-------------|
| **ADR-003** (Conflict Resolution) | Independent — Conversation Center is a UI layer, does not affect conflict resolution logic |
| **ADR-004** (Health Policy) | **Synergistic** — health policy flags on conversations can be surfaced in the inbox (future) |
| **ADR-005** (Channel Abstraction) | **Prerequisite** — incoming channel messages flow into conversations that the Center displays |
| **ADR-006** (CCP) | **Synergistic** — restored conversations from checkpoints appear in the inbox; conversation timeline shows checkpoint restores |
| **ADR-007** (Heuristic Engine) | **Synergistic** — heuristic signals, hypotheses, and strategy are displayed in the ContextSidebar. Heuristic context appears in `metadata.heuristic_context` on messages. |

### Implementation Order

Per ADR-007 council review (section 9, Q4):

```
1. ADR-005 (Channel Abstraction)     ← Conversations need channels
2. ADR-006 (CCP)                     ← Conversations need continuity
3. ADR-007 (Heuristic Engine)        ← Conversations need intelligence
4. ADR-008 (Conversation Center)     ← UI layer on top of all the above
```

ADR-008 can begin design and API work independently but the full heuristic panel integration depends on ADR-007 Phase 1 completion.

---

## 11. Open Questions

1. Should the conversation list auto-update via polling or should this wait for WebSocket (ADR-005)?
2. Should message search be implemented at database level (ILIKE) or use a search index (PostgreSQL tsvector)?
3. Should conversation titles be auto-generated from the first meaningful user message, or should we allow manual renaming?
4. Should training conversations (type='training') appear in the unified inbox, or remain isolated in the assistant training page?
5. Should the Conversation Center expose an internal API for CCP checkpoints to reference conversations?

---

## 12. Comparison: Without vs With Conversation Center

| Dimension | Without | With |
|-----------|---------|------|
| **Conversation visibility** | Dashboard shows 10 recent live conversations | Full list with filters, search, pagination |
| **Message history** | Chat starts empty on every mount | Full history loaded from DB |
| **Agent assignment** | Column exists, no UI | Assign, reassign, handover with reason |
| **Customer context** | Only visible during active chat | Customer profile + signals + conversation count |
| **Context used** | Invisible to humans | Products, rules, knowledge used per message (via "¿Por qué respondió esto?") |
| **Heuristic signals** | Not exposed | Stage, signals, hypotheses visible alongside messages |
| **Search** | None | By customer name, message content, date range |
| **Archive** | No way to archive | Archive/review/restore workflow |
