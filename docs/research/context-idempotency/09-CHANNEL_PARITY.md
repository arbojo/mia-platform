# 09 — Channel Parity

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** EVIDENCE_LOCKED — DISCOVERY ONLY

---

## 1. The Desired Invariant

> Same customer context + same product context + same media state must
> produce the same media decision regardless of channel.

## 2. Where Context and Idempotency Actually Live

| Concern | Layer where it lives | Evidence | Class |
|---|---|---|---|
| Product resolution | CORE (`resolveRecommendedProduct`, called from `core.ts:86-98`) | product-recommendation.ts:16 | FACT |
| Media resolution | CORE (`resolveConditionalMedia`, called from `core.ts:100-115`) | conditional-media.ts:14 | FACT |
| Per-item dedup | DATABASE (`chat_media_dispatched`, UNIQUE(knowledge_item_id, conversation_id)) | migration 016 | FACT |
| Per-product dedup | DATABASE (`conversations.media_sent_products UUID[]`) | migration 038 | FACT |
| URL safety | CORE (`isSafeMediaUrl` in media-guard.ts:58) | media-guard.ts | FACT |
| Prompt media tag | PROMPT (`[IMAGEN_DISPONIBLE]`, gated on `channel` param) | prompts.ts:135-144 | FACT |
| Media rendering | CHANNEL/UI (ChatWindow img, Baileys image payload) | ChatWindow.tsx:365; adapters/baileys.ts:80-98 | FACT |
| Resend detection | CORE (`isResendRequest` passed as `isResend` into resolveConditionalMedia) | core.ts:110; media.ts:38-53 | FACT |

**Conclusion (FACT)**: the *decision* is centralized in CORE and backed by
DB state — this is the architecture's strongest parity property. The
*differences* are at the edges.

---

## 2.1 The `channel` Gate in the Prompt — FACT

**File**: `src/lib/ai/prompts.ts:135-144`

```typescript
const imageNote =
  k.image_url && k.trigger_condition && belongsToActive && channel
    ? `\n[IMAGEN_DISPONIBLE] ${ai.imageAvailable} ("${k.trigger_condition}").`
    : ''
```

If `channel` is undefined (e.g. some API paths), the LLM is never told media
exists. Two channels CAN therefore produce different *textual promises* about
media even though the deterministic resolver would decide identically.

- **Classification**: FACT (parity gap in the PROMPT layer, not the CORE)

## 2.2 Rendering Asymmetries — FACT

| Capability | WebChat (ChatWindow.tsx:365) | Lab (LabChatWindow.tsx:292) | WhatsApp (Baileys) |
|---|---|---|---|
| Renders media image | Yes `<img src={media.imageUrl}>` | Yes, identical | Yes via bridge `{ image: { url }, caption }` |
| Fallback when media null | None — renders nothing | None | Text-only message still delivered |
| img error handling | None (broken-image icon possible) | None | Bridge download failure can lose the whole send (image-core matrix + TASK-20260814) |
| Product card | ProductMessageCard (ChatWindow) | **Missing** (text only) | N/A (caption text) |
| Stream protocol | toStructuredStreamResponse (data parts) | Same, data parts ignored | Non-streaming webhook JSON |

- **Classification**: FACT / PARITY_GAP (matches image-core matrix #12–#15)

## 2.3 Dispatch Path Divergence — FACT

**WhatsApp**: `/api/channels/baileys/webhook` → `processIncomingMessage`
(non-streaming) → response JSON includes `imageUrl` + `mediaType` → bridge
sends image with caption.

**Web/Lab**: `/api/chat` → `processStreaming` →
`toStructuredStreamResponse()` — media travels as structured stream parts.

Both consume the SAME core resolution, so the **decision** is shared; the
**transport** differs. Verified: both routes exist and both call into
`src/lib/runtime/runtime.ts` (`processIncomingMessage` / `processStreaming`),
which share `processCore` (core.ts:14).

## 2.4 Idempotency Scope Across Channels — FACT

Dedup keys are `conversation_id`-scoped:

- `chat_media_dispatched` UNIQUE(knowledge_item_id, conversation_id)
- `conversations.media_sent_products` (per conversation row)

WhatsApp and Web conversations are distinct conversation rows for the same
customer (different `channel`/session origin). Therefore the SAME customer
asking the SAME thing on two channels receives the media **twice**. Whether
that is desired (channel = context) or a bug (customer = context) is an
open product decision — documented in 05-IDEMPOTENCY_ANALYSIS.md cases D/E.

- **Classification**: FACT; behavior is consistent per-conversation but NOT
  per-customer across channels.

---

## 3. Invariant Evaluation

| Test | Result | Evidence |
|---|---|---|
| Same message, same conversation, Web vs WhatsApp → same media decision? | **TRUE** (core-owned decision + DB dedup) | core.ts:86-119 shared by both routes |
| Same message, same customer, different conversations → same decision? | **FALSE by design** (dedup is per-conversation; second conversation re-sends) | migration 016, 038 |
| LLM text promises consistent across channels? | **FALSE** when `channel` param missing | prompts.ts:135 |
| Rendering graceful when media absent? | **FALSE** (no fallback web/lab; bridge fragile) | image-core #12, #15 |

## 4. Consequence for the Hypothesis

A context-first, idempotency-aware model is **architecturally compatible**
with channel parity because context and idempotency already live in CORE +
DB. The required additions (context object, media decision event) must be
placed in CORE to preserve the invariant; any per-channel trigger tweaking
would break it.

---

**Next**: `10-FAILURE_MODES.md`
