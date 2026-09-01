# 06 — Context Transitions

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Status:** EVIDENCE_LOCKED (discovery only)

---

## 1. The Litmus Scenario (from mission)

```
Customer:  "Quiero algo para las uñas."
MIA:       "Claro 😊 tenemos Clean Nails..."
Customer:  "¿Y para las manchas?"
MIA:       "También tenemos Bye Canas..."
Customer:  "¿Me enseñas cómo funciona Clean Nails?"
```

Question: can the system explicitly recognize CONTEXT A → CONTEXT B → CONTEXT A?

## 2. What the Evidence Says

### 2.1 Product context is re-derived per message, from the message text alone

- **FACT:** `processCore` (`core.ts:86-98`) calls `resolveRecommendedProduct({ businessId, userMessage, intentTag, productId })` on **every turn**, where `productId` comes only from `landingContext.productId` (landing pages) or `preResolvedProductId`. There is no read of "which product were we talking about".
- **FACT:** `resolveRecommendedProduct` (`product-recommendation.ts:16`) resolves from the *current message* via intent/keyword matching against catalog names. The message history is not a primary input to product resolution.
- **INFERENCE:** in the scenario above, message 3 ("¿Me enseñas cómo funciona Clean Nails?") works **only because the customer re-typed the product name**. The system did not remember A; the customer re-supplied it. This is the keyword-dependence problem shifted one level up: product names are themselves the keywords.

### 2.2 There is no persisted "active product" state

- **FACT:** `conversations` schema (`supabase/schemas/public/tables/conversations.sql`) contains status/outcome/deal fields — no `active_product_id`, no product history, no phase field.
- **FACT:** `messages.metadata` (JSONB) stores `product_id` of the *recommended product at send time* (web product cards, TASK-20260813-235511359) — a historical trace, never read back by the media resolver.
- **INFERENCE:** a reconstruction of active product from message history is *possible* (metadata exists) but is **not implemented** anywhere in `conditional-media.ts`.

### 2.3 The reasoning layer knows phases but does not feed media

- **FACT:** `state-loader.ts` loads UBSE cognitive state (states such as `comparando`, `evaluando_riesgo`; see `docs/research/kb/estados.md`) for reasoning prompts.
- **FACT:** `resolveConditionalMedia` (`conditional-media.ts:13-82`) receives `businessId, customerId, conversationId, userMessage, intentTag, productId, isResend` — **no phase, no state, no history**.
- **ARCHITECTURAL_GAP:** two parallel context representations exist (UBSE state for reasoning; flat keywords for media) and they do not exchange information.

### 2.4 The LLM is not told what was resolved or sent

- **FACT:** `core.ts:100-119` resolves media *after* the product decision but the result is only attached to the outbound message; the LLM prompt gets `[IMAGEN_DISPONIBLE]` hints (`prompts.ts:141-144`) but never "image X was already sent in turn N" nor "customer is back on product A".
- **INFERENCE:** the LLM cannot naturally handle transitions ("te la había mandado arriba 😊") because it lacks the ledger.

### 2.5 Transition A→B→A today, step by step (derived, INFERENCE)

| Turn | Resolver sees | Media decision |
|---|---|---|
| 1 "algo para las uñas" | keywords → A (if A's trigger/name matches) | A media, marks A + item |
| 2 "¿y para las manchas?" | keywords → B | B media, marks B |
| 3 "¿cómo funciona Clean Nails?" | "clean nails" must be a trigger/name keyword | A media **blocked** by media_sent_products (case G, doc 05) unless phrased as resend |

**Result:** the third turn either re-sends nothing (blocked, silent) or requires the customer to use resend phrasing. The system never "recognizes" the return to A — it merely matches strings again.

## 3. Is a State Machine Required?

**Do NOT assume yes.** Evidence:

- What is missing is not a full FSM: it is (a) a **persistent pointer to the active product(s)** of the conversation, and (b) the **ledger of what was sent**, both *read by the resolver and by the prompt*.
- `messages.metadata.product_id` already records the product per assistant turn (FACT) — a lightweight reconstruction of "recent products" is feasible **without new inference**.
- UBSE states already exist for phase; media needs at most `active_product` + `recent_products`, not 15 cognitive states.

**Minimum concept supported by evidence:** a per-conversation *product context slot* (active + recent list) maintained deterministically at each turn, consumed by media resolution and exposed to the LLM. A full FSM is not evidenced as necessary.

## 4. Contradiction Register

| # | Claim | Contradicting evidence |
|---|---|---|
| 1 | "MIA knows which product is active" | `conditional-media.ts` receives productId only from per-message resolution or landingContext |
| 2 | "Message history provides context" | resolver takes only `userMessage` + `intentTag` |
| 3 | "UBSE state covers transitions" | state-loader output is not an input to media resolution |