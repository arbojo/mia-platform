# Sprint 2 Validation Report — Product Trust

**Date**: 2026-07-29
**Branch**: main

---

## Executive Summary

Sprint 2 evolved MIA from an MVP into a deployable AI sales assistant with customer memory, assistant lifecycle management, conversation intelligence, and audited AI context quality.

---

## Implemented Features

### Phase 3 — Assistant Lifecycle Completion

| Feature | Status | Details |
|---------|--------|---------|
| Assistant Configuration Page | ✅ | `src/app/dashboard/assistants/[id]/` — edit name, personality sliders (warmth, formality, humor, aggressiveness), communication style |
| Status Lifecycle | ✅ | Draft → Training → Ready → Active → Inactive. Status badges on assistant cards. Status controls on config page. |
| Deploy/Publish Flow | ✅ | "Publicar asistente" button with pre-activation validation (products, rules, knowledge, training checks). Warning shown if requirements missing. |
| PATCH /api/assistants/[id] | ✅ | Updates name, personality, communication_style, status. Ownership validated via requireAuth + business owner check. |

### Phase 4 — Conversation Intelligence

| Feature | Status | Details |
|---------|--------|---------|
| Extended conversation statuses | ✅ | active, waiting, completed, abandoned, archived — each with distinct badge styling |
| Status actions | ✅ | Mark completed, put on hold, mark abandoned, archive, reactivate |
| Conversation notes | ✅ | Notes field per conversation via `PATCH /api/conversations/[id]/notes` |
| Search by customer name | ✅ | Client-side filter by name, phone, email |
| Filters | ✅ | By status, by assistant |
| Stats display | ✅ | Total, active, waiting, completed, abandoned, archived counts |

### Phase 5 — AI Context Quality

| Fix | Severity | Status |
|-----|----------|--------|
| `processStreaming` loads past conversation history (was CRITICAL) | CRITICAL | ✅ — loads up to 30 past messages from DB, prepends to AI context |
| Product FAQ included in prompt | HIGH | ✅ — `formatProducts` now renders `faq` JSONB (up to 3 items) |
| Product restrictions included in prompt | HIGH | ✅ — `formatProducts` now renders `restrictions` TEXT |
| Brand tone_of_voice in prompt | HIGH | ✅ — included with conflict resolution note vs assistant style |
| `getRecentLessons` fetches severity & category | HIGH | ✅ — `formatLessons` sorts by severity, displays tags |
| Consistent admin client in customer-memory.ts | HIGH | ✅ — uses `createAdminClient()` everywhere |
| Context caching with customerId | HIGH | ✅ — 30s TTL cache for customer-specific context (was uncached) |

| Additional Fix | Severity | Status |
|----------------|----------|--------|
| `usedContext` stores `k.id` not the whole object | MEDIUM | ✅ — `context.knowledge.forEach((k) => ... k.id)` |
| `getCustomerMemory` returns tags, status, city | MEDIUM | ✅ — included in `formatCustomerMemoryForPrompt` |
| `getCustomerMemory` wrapped in try/catch | LOW | ✅ — graceful degradation without customer memory |
| Corrected response null fallback | MEDIUM | ✅ — `l.corrected_response ?? '(eliminado/desestimado)'` |

---

## Architecture Decisions

1. **Assistant status as TEXT column** (not replacing `is_active BOOLEAN`). The existing `is_active` field is used extensively across the codebase (74 references). The new `status` column tracks the lifecycle independently. Migration `013_assistant_lifecycle.sql`.

2. **Conversation notes as TEXT column** on `conversations` table (not a separate notes table). Keeps the schema simple. Migration `014_conversation_notes.sql`.

3. **Extended conversation statuses** via CHECK constraint change. All existing `active` and `archived` rows remain valid. New statuses `waiting`, `completed`, `abandoned` added.

4. **30-second cache for customer contexts** vs 5-minute cache for business contexts. Balances freshness with performance.

---

## Security Validations

| Check | Status | Details |
|-------|--------|---------|
| New API route ownership validation | ✅ | `PATCH /api/assistants/[id]` — requires auth + business owner check |
| Conversation status route | ✅ | Uses RLS-guarded `requireAuth()` supabase client for ownership verification |
| Conversation notes route | ✅ | Same RLS-based ownership check |
| Customer memory route | ✅ | Both GET and POST verify user has access to the customer record via RLS |
| All routes use admin client for writes | ✅ | After ownership verified via RLS-guarded client |
| No cross-tenant access | ✅ | RLS policies scope all queries to user's businesses |

---

## Migrations

| Migration | Purpose |
|-----------|---------|
| `012_customer_memory.sql` | Adds `memory JSONB` column to `customers` |
| `013_assistant_lifecycle.sql` | Adds `status` TEXT to `assistants`, extends conversation status CHECK |
| `014_conversation_notes.sql` | Adds `notes` TEXT to `conversations` |

---

## Quality Gates

| Gate | Result |
|------|--------|
| `npm run build` | ✅ — 0 TypeScript errors, 40 routes |
| `npm run lint` | ✅ — 0 errors, 1 pre-existing warning |
| `npm test` | ✅ — 4/4 Playwright tests passed |

---

## Files Created

```
supabase/migrations/012_customer_memory.sql
supabase/migrations/013_assistant_lifecycle.sql
supabase/migrations/014_conversation_notes.sql
src/app/api/assistants/[id]/route.ts
src/app/api/conversations/[id]/status/route.ts
src/app/api/conversations/[id]/notes/route.ts
src/app/api/customers/memory/route.ts
src/app/dashboard/assistants/[id]/page.tsx
src/app/dashboard/assistants/[id]/AssistantConfig.tsx
src/components/customers/MemoryPanel.tsx
src/components/conversations/ConversationFilters.tsx
src/components/conversations/ConversationList.tsx
src/lib/ai/customer-memory.ts
docs/audits/assistant-lifecycle-report.md
docs/audits/ai-context-quality.md
docs/sprint-2-validation-report.md
```

---

## Files Modified

```
src/app/dashboard/assistants/page.tsx — status badges, card clickable to config, Configurar button
src/app/dashboard/conversations/page.tsx — searchParams, filters, extended stats
src/lib/conversation/context.ts — customer caching, try/catch, usedContext fix
src/lib/runtime/runtime.ts — past conversation history loading, user message before AI
src/lib/ai/prompts.ts — product faq/restrictions, brand tone_of_voice, lesson severity/category
src/lib/ai/knowledge.ts — getRecentLessons selects severity + category
src/lib/ai/customer-memory.ts — consistent admin client, tags/status/city in memory
src/components/conversations/ConversationFilters.tsx — extended status filter options
```

---

## Remaining Technical Debt

1. **No deploy/publish button on assistant cards** — the config page has publish, but the list could benefit from a quick-action deploy toggle.
2. **No widget embed code in UI** — widget API exists but owner can't get embed snippet from dashboard.
3. **`processIncomingMessage` loads only 20 messages** — consistent with the 30 limit in `processStreaming` now.
4. **No pagination for products/rules** — fine for current scale but will need addressing.
5. **Hardcoded rules in prompts** (`prompts.ts:158-163`) — should be configurable via DB.

---

## Recommendations

1. **Sprint 3** should focus on the widget embed flow and channel connectivity UI so assistants can actually go live.
2. **Add `is_active` sync** — when `status` changes to `active`, set `is_active = true`. When `inactive`, set `is_active = false`.
3. **Token budget management** — implement prompt truncation for businesses with large product/knowledge catalogs.
4. **Conversation handover** — the `assigned_to` field exists but has no UI. Adding a basic assignee feature would complete the sales workflow.
