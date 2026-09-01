# 19 — Architecture Verdict (Adversarial Loop 2)

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** EVIDENCE_LOCKED — DISCOVERY ONLY
**Input:** docs 16–18 + 21 (contradictions, state validation, decision rules, golden conversations)

---

## Verdict per Component

Classification: KEEP / REPAIR / ISOLATE / DEPRECATE / REPLACE / MISSING / UNKNOWN

| Component | Current behavior | Evidence | Decision | Reason |
|-----------|-----------------|----------|----------|--------|
| `triggerMatches()` (`media.ts:11-26`) | Whole-word keyword scan against full message | FACT (doc 04:1.1) | **KEEP (as scoped primitive)** | Matching itself is correct and tested; failure is its *invocation scope* (global), not its mechanics |
| `intentMatchesTrigger()` (`media.ts:28-36`) | `"intent {tag}"` exact match | FACT (doc 04:1.2) | **KEEP** | Harmless; complements keyword path |
| `isResendRequest()` (`media.ts:38-53`) | Resend verb + media word | FACT (doc 04:1.3) | **REPAIR** | Missing anaphora ("muéstramela" without "imagen"); is the natural explicit-re-request detector (GC-07) |
| `resolveConditionalMedia()` (`conditional-media.ts:14`) | Global scan over all knowledge items, per-message | FACT (doc 04/06) | **REPAIR (core of the model)** | Keep as the single media resolution point but scope its input: candidate set = f(explicit scope, active product, generic pool) per doc 18 R1–R3 |
| Atomic claim (`conditional-media.ts:98-114`) | Upsert `(knowledge_item_id, conversation_id)` ignoreDuplicates | FACT | **KEEP** | Only race-safe dedup today; GC-11 validates it |
| `chat_media_dispatched.customer_id` | Written, never read | FACT (`conditional-media.ts:104`) | **REPAIR (upgrade to read path)** | Customer-level dedup hook already persisted — the storage exists, the semantics don't |
| Dispatch status | Absent — claim ≡ received | BUG (C-006, GC-12) | **MISSING → ADD** | Needs selected/queued/dispatched/delivered/failed; PRD requirement |
| `media_sent_products[]` (`media-guard.ts:87-98`) | Non-atomic read-then-write array append | BUG (race, finding #16) | **DEPRECATE** | Superseded by atomic claim table; carries the only remaining race |
| Active product state | Does not exist; per-message re-resolution | FACT (doc 06: A→B→A fails) | **MISSING → ADD** | `active_product_ids[]` + `context_source` (doc 17); plural per C-002 |
| `active_intent` | Not proposed as persistent state; derivable per message | FACT/INFERENCE (C-004) | **MISSING → DO NOT PERSIST** | Derivable from message; persisting adds state without behavioral gain (doc 17) |
| `presented_media_scope[]` | Ambiguous concept | ATTACK #13 | **REPLACE** with per-asset claims (asset-level dedup) | Product-level "presented" flag would wrongly block sibling assets (GC-08) |
| Product resolution (`product-recommendation.ts:54-65`) | Returns null on ≥2 matches | FACT | **KEEP + EXTEND** | Null is safe; extend to return candidate set for comparison contexts (GC-03) |
| Customer identity (`identity.ts:68-116`) | external_id+channel → phone → email → new | FACT (C-007) | **REPAIR** | WebChat session path can fragment identity; customer-level dedup is unsafe until identity merges are reliable |
| LLM media feedback (`core.ts:100-119`) | None — LLM blind to resolution outcome | FACT (finding #9, C-006) | **MISSING → ADD** | Claim/execution invariant; at minimum resolved/blocked/deduplicated/failed to prompt |
| `getBusinessContext()` media fields | Pass-through of media columns | FACT (doc 01) | **KEEP** | No change needed at context-builder layer |
| Channel adapters (Baileys/WebChat/Lab) | Render-only after core decision | FACT (doc 09) | **ISOLATE** | Rendering concerns stay in channel; decision parity enforced by shared core |
| Time semantics ("recently") | No TTL anywhere | UNKNOWN (ATTACK #10) | **UNKNOWN → Council** | No evidence basis to invent a window; must be a Council decision with product input |
| Dual write knowledge import (`engine.ts:83-87`) | Writes both tables | FACT (finding #18) | **REPAIR** | Out of loop scope but contaminates asset identity model |

---

## Summary Counts

| Decision | Count |
|----------|-------|
| KEEP | 6 |
| REPAIR | 6 |
| DEPRECATE | 1 |
| ISOLATE | 1 |
| REPLACE | 1 |
| MISSING → ADD | 3 (active product state, dispatch status, LLM feedback) |
| UNKNOWN | 1 (time window) |

## Headline

The existing media pipeline is **reparable, not replaceable**. Its atomic claim mechanism is sound and must be kept; its failure is *scope* (global trigger scan, conversation-only dedup) and *absence* (no active product state, no dispatch status, no LLM feedback). No component requires a full rewrite except the conceptual `presented_media_scope[]`, which dissolves into per-asset claims.

**Verdict for the central hypothesis: B — CONFIRMED WITH AMENDMENTS** (full reasoning in doc 20).
