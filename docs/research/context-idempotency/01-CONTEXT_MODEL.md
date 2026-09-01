# 01 — Context Model

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Phase:** Discovery — Context-First Media & Product Idempotency
**Status:** EVIDENCE_LOCKED — DISCOVERY ONLY

---

## 1. What "context" exists today (inventory)

| Context dimension | Exists? | Where | Classification | Evidence |
|---|---|---|---|---|
| Current customer need | ❌ No explicit representation | — | ARCHITECTURAL_GAP | Nothing persists "need"; only per-message intent tag |
| Current intent | ⚠️ Per-message only, not persisted | `src/lib/runtime/intents.ts` (`detectIntent`) | FACT | Substring keyword matching, recomputed every message |
| Active product | ⚠️ Re-derived per message, never stored | `src/lib/runtime/core.ts:86-98` → `resolveRecommendedProduct()` | ARCHITECTURAL_GAP | No DB column holds "product under discussion" |
| Previously discussed products | ⚠️ Only as dedup side-effect | `conversations.media_sent_products UUID[]` (migration 038) | FACT | Array records products whose media was sent — not a discussion model |
| Explicitly rejected products | ❌ | — | ARCHITECTURAL_GAP | No structure anywhere |
| Products selected / purchased | ⚠️ Via sales events | `sales_events` table; `src/lib/sales/process.ts:513-554` | FACT | `SALE_WON` persisted with product name |
| Products already presented | ⚠️ Media-only | `chat_media_dispatched` (migration 016), `media_sent_products` | FACT | Tracks media dispatch, not "product presented" |
| Customer questions | ❌ | — | UNKNOWN | No structured capture |
| Customer objections | ⚠️ Implicit | `knowledge_items` category `objection` is business-side, not customer-side | FACT | Schema: `knowledge_items_category_check` |
| Customer preferences | ⚠️ | `src/lib/ai/customer-memory.ts` | FACT | Memory exists but is NOT consulted by media pipeline |
| Conversation phase | ⚠️ | `src/lib/reasoning/state-loader.ts` (UBSE states) | FACT | Loaded for reasoning; media resolver never reads it |
| Transitions between products | ❌ | — | ARCHITECTURAL_GAP | No event, no state, no log |
| Transitions between intents | ❌ | — | ARCHITECTURAL_GAP | intentTag recomputed, never compared with previous |

## 2. How the runtime obtains context per message

`src/lib/runtime/core.ts:86-98` (FACT):

```typescript
let product = null
if (input.userMessage) {
  product = await resolveRecommendedProduct({
    businessId, userMessage: input.userMessage,
    intentTag: input.intentTag ?? null,
    productId: landingContext?.productId ?? input.preResolvedProductId ?? null,
  })
}
```

**Key behavior**: product context is a **pure function of the current message** (+ landing context). Nothing from turn N−1 participates except the conversation-level dedup arrays. There is no read of "what was the active product last turn".

`src/lib/conversation/context.ts` (FACT): `loadConversationContext()` loads brand, products, knowledge_items (is_active), rules, instructions, memory — with an in-memory cache TTL 5 min (`context.ts:29-37`). This is **business context**, not conversational state. It answers "what does the business sell", never "what is this customer discussing".

## 3. Conclusion

**Current model = STATELESS per-message resolution with conversation-scoped media dedup.**

- Conversational context (active product, need, phase) is **not represented anywhere persistent**.
- The only cross-turn state is idempotency bookkeeping (`chat_media_dispatched`, `media_sent_products`, `sales_cancelled_at`), which records **what was sent**, not **what is being discussed**.
- The central hypothesis's premise ("identify products currently under consideration") has **no substrate to execute on** today.

Classification of the overall finding: **ARCHITECTURAL_GAP** (not a BUG — the system behaves as designed; the design lacks the state).

---
Next: `02-CONTEXT_FLOW.md` traces the full message → media flow with lines.