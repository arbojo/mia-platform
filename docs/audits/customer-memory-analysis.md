# Customer Memory Analysis

**Date**: 2026-07-29
**Sprint**: Sprint 2 — Product Trust

---

## Objective

Analyze existing data model, codebase, and prompt pipeline to determine what exists, what is missing, and what should be created for structured customer memory.

---

## 1. What Exists

### 1.1 Database Schema

| Table | Relevant Columns | Purpose |
|-------|-----------------|---------|
| `customers` | `id`, `business_id`, `name`, `phone`, `email`, `city`, `tags(text[])`, `status`, `notes`, `last_interaction` | Commercial memory — who they are, contact info, status |
| `assistant_memories` | `id`, `assistant_id`, `customer_id`, `memory_type` (preference\|previous_question\|purchase_history\|important_note), `content` | Per-customer memory — what MIA remembers about them |
| `conversations` | `id`, `assistant_id`, `customer_id`, `type`, `status`, `created_at` | Conversation sessions |
| `messages` | `id`, `conversation_id`, `role`, `content`, `metadata(jsonb)`, `created_at` | Individual messages |
| `learning_events` | `id`, `assistant_id`, `original_response`, `corrected_response`, `knowledge_item_id`, `status`, `correction_type`, `business_id`, `severity`, `category` | Corrections → knowledge |
| `business_memory` | `id`, `business_id`, `memory_type` (pattern\|experience\|insight\|trend\|decision), `category`, `content`, `confidence` | Business-level AI-inferred patterns |

### 1.2 RLS Policies

All tables have RLS policies scoping access to the user's businesses via `get_user_business_ids()`.

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `customers` | ✅ | ✅ | ✅ | ❌ |
| `assistant_memories` | ✅ | ✅ | ❌ | ❌ |
| `conversations` | ✅ | ✅ | ❌ | ❌ |
| `messages` | ✅ | ✅ | ❌ | ❌ |
| `learning_events` | ✅ | ✅ | ✅ | ❌ |

### 1.3 Code Structure

| Component | Status | Details |
|-----------|--------|---------|
| `buildMasterPrompt()` `customerMemory` param | Exists in signature | Line 138 — `customerMemory?: string` — but NEVER populated by any caller |
| Prompt template for customer memory | Exists in template | Lines 207 — renders `## Memoria del Cliente` section when `customerMemory` is provided |
| `getBusinessContext()` | Active | Returns business-level data only (brand, products, rules, instructions, knowledge, business_memory) — no per-customer data |
| `loadConversationContext()` | Active | Calls `getBusinessContext()` and `getRecentLessons()` — does NOT fetch `assistant_memories` |
| TypeScript types for `assistant_memories` | Defined | `src/lib/types/index.ts:330-358` |

---

## 2. What Is Missing

### 2.1 Critical Gaps

| Gap | Impact | Location |
|-----|--------|----------|
| `assistant_memories` table is NEVER read | Customer memory exists in DB but never reaches the AI model | No query in `knowledge.ts`, `context.ts`, or `chat/route.ts` |
| `assistant_memories` table is NEVER written | No memory is extracted from conversations — the table remains empty | No write operation anywhere in `src/` |
| `customerMemory` param in `buildMasterPrompt` never passed | The prompt template has a dead parameter — purpose-built for this but unused | `context.ts:64-74` — omitted from the call |
| No API endpoint for customer memory | No way to view, edit, or extract customer memory | No route in `src/app/api/` |
| No memory extraction AI logic | No code analyzes messages to extract structured memory | No function in `src/lib/ai/` |
| No UI for customer memory | The conversations page shows customer name/phone/email but no memory context | `conversations/page.tsx` |

### 2.2 Schema Gap

The `customers` table has `tags TEXT[]` and `notes TEXT` but no structured `memory JSONB` column for quick-lookup summarized memory. The `assistant_memories` table stores individual items, but there's no aggregated view.

### 2.3 Missing: Auto-Extraction During Chat

When a conversation happens, no code analyzes messages to extract:
- Customer interests (what products did they ask about?)
- Objections (what concerns did they raise?)
- Questions (what did they want to know?)
- Preferences (how do they prefer to interact?)

---

## 3. What Should Be Created

### 3.1 Recommendation

**Do not create new tables.** Use existing infrastructure:

| Action | Target | Rationale |
|--------|--------|-----------|
| Add `memory` JSONB column to `customers` | Schema change | Provides structured quick-lookup: `{interests, objections, questions, preferences, lastInteraction}`. Avoids querying `assistant_memories` every time. |
| Create `getCustomerMemory()` | New function in `src/lib/ai/` | Reads `customers.memory` JSONB for a given customer, formats as text for prompt injection |
| Create `extractCustomerMemory()` | New function in `src/lib/ai/` | AI-powered: analyzes recent conversation messages, produces structured memory, stores in both `customers.memory` and individual `assistant_memories` rows |
| Inject into `loadConversationContext()` | Modify `context.ts` | Call `getCustomerMemory(customerId)` and pass result as `customerMemory` to `buildMasterPrompt` |
| Create `/api/customers/memory` | New API route | POST to extract memory from conversations, GET to retrieve it |
| Add memory panel UI | New component | Shows structured customer memory on the conversations detail page |

### 3.2 Design: `customers.memory` JSONB Structure

```json
{
  "interests": ["Neurotin", "Back2Fit"],
  "objections": ["price", "delivery time"],
  "questions": ["How does the guarantee work?"],
  "preferences": ["prefers WhatsApp"],
  "lastInteraction": "2026-07-29T15:30:00Z",
  "summary": "Interested in foot care products. Concerned about price. Prefers WhatsApp communication."
}
```

### 3.3 Pipeline

```
Conversation messages
  → AI extracts structured memory
  → stored in customers.memory (JSONB) + assistant_memories (rows)
  → read during next conversation
  → injected into system prompt as ## Memoria del Cliente
```

---

## 4. Implementation Plan

| Step | File(s) | Effort |
|------|---------|--------|
| 1. Migration: add `memory` JSONB to `customers` | `supabase/migrations/012_customer_memory.sql` | Small |
| 2. `getCustomerMemory()` read function | `src/lib/ai/customer-memory.ts` | Small |
| 3. `extractCustomerMemory()` AI function | `src/lib/ai/customer-memory.ts` | Medium |
| 4. `/api/customers/memory` route | `src/app/api/customers/memory/route.ts` | Medium |
| 5. Inject into chat pipeline | `src/lib/conversation/context.ts` | Small |
| 6. UI memory panel | `src/components/customers/MemoryPanel.tsx` | Medium |
| 7. Wire into conversations detail page | `src/app/dashboard/conversations/` | Small |

---

## 5. Security

- `customers.memory` column inherits existing RLS policies on `customers` table
- Memory is scoped to `business_id` — no cross-business leakage
- API routes must validate ownership (same pattern as other routes)
- AI memory extraction uses the admin client for writes, server client for reads
