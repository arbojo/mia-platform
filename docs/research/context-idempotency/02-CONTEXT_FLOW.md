# 02 — Context Flow

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** EVIDENCE_LOCKED — DISCOVERY ONLY

---

## 1. WhatsApp (primary channel) — exact flow

```
Bridge (services/whatsapp-bridge) POST
  → src/app/api/channels/baileys/webhook/route.ts:29-65 (POST)
     :31  verifyWebhookAuth (JWT or shared secret)
     :38  adapter.receiveMessage(body) → WireMessage   [BaileysAdapter, baileys.ts:22-63]
          - audio normalized to 'El cliente envió una nota de voz.' (:55)
     :40  handleCancellationWebhook(wireMessage)        [sales/process.ts:66+]
          - early-exits BEFORE runtime if cancellation/discount flow
     :54  processIncomingMessage('whatsapp', wireMessage, adapter)
```

Inside the runtime (`src/lib/runtime/runtime.ts`, `core.ts`):

```
processCore (core.ts)
  1. loadConversationContext(businessId)        context.ts    — business data, 5-min cache
  2. detectIntent(userMessage)                  intents.ts    — substring keywords → intentTag
  3. resolveRecommendedProduct({...})           core.ts:86-98
       product-recommendation.ts:16 cascade:
         a. landingContext.productId (landing/web only)
         b. preResolvedProductId
         c. intent/trigger match on knowledge_items WHERE product_id NOT NULL
         d. keyword fallback (intents keywords)
       → returns ONE product or null (ambiguous → null)
  4. resolveConditionalMedia({...})             core.ts:100-115
       conditional-media.ts:14:
         - isResendRequest(userMessage)? → resend last dispatched media (bypasses dedup)
         - productId known → query knowledge_items image_url IS NOT NULL
             AND product_id = productId (MEDIA_INVARIANT)
         - productId null  → generic media: product_id IS NULL
             AND trigger_condition NOT NULL, triggerMatches(message, trigger)
         - ordering: created_at ASC (conditional-media.ts:35)
         - dedup: chat_media_dispatched UNIQUE(knowledge_item_id, conversation_id)
                  + conversations.media_sent_products (product-level)
         - isSafeMediaUrl() gate (media-guard.ts:58)
  5. AI generation (execute-ai.ts)
       prompt includes [IMAGEN_DISPONIBLE] tags (prompts.ts:141-144)
       prompt does NOT include media resolution result (core.ts:100-119, no feedback)
  6. Persist response; adapter.sendMessage (baileys.ts:65-109)
       sends { to, content, imageUrl? } → bridge → sock.sendMessage(jid, {image:{url}, caption})
```

## 2. WebChat / Laboratorio

- `/api/chat` → `processStreaming(...)` → same core (`runtime.ts`), returns `toStructuredStreamResponse()`.
- `ChatWindow.tsx:365` renders `message.media.imageUrl` (no fallback if null — image-core finding #12).
- `LabChatWindow.tsx:292` same media rendering; no product cards (parity finding #13).

## 3. Where each decision is made

| Question | Decided by | File:Line | Classification |
|---|---|---|---|
| What the customer means | LLM (free text answer) | execute-ai.ts | FACT |
| What product is relevant | Runtime heuristic (NOT the LLM) | product-recommendation.ts:16 | ARCHITECTURAL_GAP |
| Whether media is appropriate | Deterministic trigger match | conditional-media.ts:14 | FACT |
| Which media is selected | DB query + created_at ordering | conditional-media.ts:35 | FACT |
| Whether already sent | DB dedup constraints | media-guard.ts:74,87 | FACT |
| What LLM says about media | LLM, blind to resolution outcome | prompts.ts:141 + core.ts:116-119 | BUG-class (image-core finding #8/#9) |

## 4. Critical observation

The LLM and the runtime resolve **two different, non-communicating models of the same conversation**:

- The LLM builds a rich internal (prompt-only, volatile) understanding: need, product, phase.
- The runtime builds a deterministic one: intentTag + one product guess + trigger match.

Neither reads the other's output. The LLM never learns "media X was sent/not sent"; the runtime never learns "the LLM understood the customer is comparing A vs B". This is the deepest structural finding of the investigation. Classification: **ARCHITECTURAL_GAP** with **BUG** symptoms (false claims, image-core findings #8, #9).