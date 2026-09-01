# 11 — Evidence Matrix

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** EVIDENCE_LOCKED

---

## Evidence Matrix

| # | Finding | File:Line | Classification | Severity | Verified by |
|---|---------|-----------|----------------|----------|-------------|
| 1 | Media triggers evaluated globally against every user message, not against a resolved commercial context | `src/lib/runtime/conditional-media.ts:14-82`; entry `src/lib/runtime/core.ts:100-119` | FACT / ARCHITECTURAL_GAP | 🔴 CRITICAL | Read code |
| 2 | No persisted representation of "active product" or conversation phase exists | `src/lib/conversation/context.ts` (context = business knowledge + messages history only); `supabase/schemas/public/tables/conversations.sql` (no context columns) | FACT / ARCHITECTURAL_GAP | 🔴 CRITICAL | Read code + schema |
| 3 | Intent detection is lexical keyword matching | `src/lib/runtime/intents.ts` (detectIntent, substring match) | FACT | 🟠 HIGH | Read code |
| 4 | Trigger matching is whole-word lexical with plural tolerance; no semantics | `src/lib/runtime/media.ts:11-26` | FACT | 🟠 HIGH | Read code + tests `tests/runtime/media.test.ts` |
| 5 | MEDIA_INVARIANT: when a product is known, media candidates are filtered to that product's product_id | `src/lib/runtime/conditional-media.ts` (product filter branch) | FACT | — | Read code |
| 6 | When product is NOT known, generic media (product_id NULL) matches any message containing trigger words | `src/lib/runtime/conditional-media.ts`; schema `knowledge_items.sql:15` | FACT / ARCHITECTURAL_GAP | 🟠 HIGH | Read code + schema |
| 7 | Product resolution is a stateless per-message cascade (landing context → pre-resolved → trigger/intent match) | `src/lib/runtime/product-recommendation.ts:16-170`; `src/lib/runtime/core.ts:86-98` | FACT / ARCHITECTURAL_GAP | 🔴 CRITICAL | Read code |
| 8 | No product identity survives across turns except implicitly in message text history | `src/lib/conversation/context.ts` (history = messages text); `messages.sql` (metadata jsonb exists, product_id persisted only for web product cards per TASK-20260813-235511359) | FACT / INFERENCE | 🔴 CRITICAL | Read code + governance task |
| 9 | Dedup: `chat_media_dispatched UNIQUE(knowledge_item_id, conversation_id)` | `supabase/migrations/016_knowledge_items_media.sql` | FACT | — | Read migration |
| 10 | Dedup: `conversations.media_sent_products UUID[]`, read/append non-atomic | `media-guard.ts:74-95` (write via `ARRAY(SELECT DISTINCT unnest(...))` — single UPDATE but read-modify-write across calls) | FACT | 🟡 MEDIUM | Read code (also image-core finding #16) |
| 11 | `isResendRequest` requires explicit media word + verb; lexical only | `src/lib/runtime/media.ts:38-53` | FACT | 🟡 MEDIUM | Read code |
| 12 | Media ordering uses `created_at ASC`, ignoring curated `position` | `conditional-media.ts:35` vs `product-recommendation.ts:108` | FACT | 🟡 MEDIUM | Read code (image-core #10/#11) |
| 13 | LLM is told `[IMAGEN_DISPONIBLE]` per knowledge item but never told whether media was actually resolved/sent | `src/lib/ai/prompts.ts:141-144`; `core.ts:100-119` (media resolved after prompt build, no feedback) | FACT / ARCHITECTURAL_GAP | 🔴 CRITICAL (image-core #8/#9) | Read code |
| 14 | Generic media dedup is per knowledge item, not per product → two generic items can each send once | `conditional-media.ts` + migration 016 constraint shape | INFERENCE (from constraint) | 🟠 HIGH | Schema analysis |
| 15 | New conversation resets all media state | Schema of 016 + 038 (conversation-scoped keys) | FACT | 🟠 HIGH | Schema analysis |
| 16 | Products A→B→A re-mention: return to A is suppressed by product dedup unless lexically a resend | `media-guard.ts` + `media.ts:38-53` | FACT | 🟠 HIGH | Code analysis |
| 17 | Channel parity: web renders media at `ChatWindow.tsx:365`; Lab at `LabChatWindow.tsx:292` (no product card); WhatsApp via bridge `{ image: { url }, caption }` | `ChatWindow.tsx`, `LabChatWindow.tsx`, `services/whatsapp-bridge/session-manager.ts:598-646` (per TASK-20260814-031446183 evidence) | FACT / PARITY_GAP | 🟡 MEDIUM | Governance task evidence + image-core/07 |
| 18 | Context cache TTL 5 min may delay knowledge/media changes; invalidation added for CRUD (TASK-20260814-024029576) | `src/lib/conversation/context.ts:29-37` | FACT | 🟡 MEDIUM | Governance task |
| 19 | `products.image_url` deprecated fallback still consulted in product-recommendation | `product-recommendation.ts:124` (image-core #17) | FACT | 🟡 MEDIUM | Read code |
| 20 | Web product card (`ProductMessageCard`) exists; WhatsApp sends raw image; Lab renders neither product card nor full media parity | `ProductMessageCard.tsx`, `LabChatWindow.tsx:292` | FACT / PARITY_GAP | 🟡 MEDIUM | image-core/07 |

## Classification summary

| Classification | Count |
|----------------|-------|
| FACT | 20 |
| INFERENCE | 2 (of which also FACT-tagged) |
| ARCHITECTURAL_GAP | 6 (#1, #2, #6, #7, #8, #13) |
| PARITY_GAP | 2 (#17, #20) |
| BUG (strict) | 0 new (race in media-guard already logged as image-core #16) |

## Verification methods

- Direct file read at HEAD `d12ce650`
- Migration files `016_knowledge_items_media.sql`, `038_media_type_simple.sql` (media types), schema dumps under `supabase/schemas/public/tables/`
- Governance task records under `.governance/tasks/` (TASK-20260814-031446183, TASK-20260813-235511359, TASK-20260814-024029576, TASK-20260830-005512058)
- Companion research: `docs/research/image-core/` (01–14) — media flow, triggers, contamination, dispatch, channel parity, evidence matrix
