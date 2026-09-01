# 14 — Council Package

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** SUBMISSION_DRAFT

---

## Motion

> Replace global per-message trigger resolution for conversational media with
> **Context-First Resolution with Explicit-Scope Escape (Option C)**:
> a persisted Commercial Context (active intent + active product + discussed/rejected products),
> media scoped to that context, idempotency keyed on product × customer × conversation with a
> temporal policy, and a MEDIA_STATE projection that keeps the LLM consistent with the runtime.

## Evidence base (locked)

- 20 findings, all FACT-tagged, in `11-EVIDENCE_MATRIX.md` (HEAD `d12ce650`).
- 6 architectural gaps: global trigger scan (#1), no persisted context (#2), generic-media wildcard (#6), stateless product identity (#7), no cross-turn product memory (#8), no LLM/runtime media feedback (#13).
- Companion investigation: `docs/research/image-core/` (media flow, trigger taxonomy, contamination, parity) — consistent conclusions, independently derived.

## Answers to the Council's standing questions

**Q1. Does the customer need to know trigger words today?**
Yes. `triggerMatches()` is whole-word lexical (`media.ts:11-26`); any synonym phrasing silently yields no media (doc 08, scenarios 1–4).

**Q2. Can one message activate media of multiple products?**
Partially. A single media item is returned per turn, but when no product is resolved, generic items (`product_id NULL`) match regardless of the product being discussed — cross-product contamination (doc 04, §3; image-core/05).

**Q3. Can old context activate a new trigger, or a new product inherit an old trigger?**
There is no context to inherit from — product identity is recomputed per message from the message text alone (`product-recommendation.ts` cascade; doc 03). Both failure shapes are therefore possible via lexical coincidence.

**Q4. What is the smallest reliable unit that should own media idempotency?**
Evidence answer (doc 05): the current unit `(knowledge_item | product) × conversation` explains every duplication/suppression defect observed. The minimum *sufficient* unit requires three added dimensions: **product_id** (to unify per-product semantics), **customer_id** (cross-conversation policy), and a **temporal/context marker** (re-presentation on genuine context return). There is no evidence that media_id alone or intent alone suffices (case I/J analysis).

**Q5. Does the proposed model remain channel-invariant?**
Yes if, and only if, context and idempotency live in CORE/DB. Today they already live in the runtime layer (`conditional-media.ts`, `media-guard.ts`), not in adapters — the invariant is achievable without relocating logic; the gaps are rendering parity only (#17, #20).

## Refutation loop performed (summary)

Cases where strict context-first would be worse than global triggers (doc 10 §B): explicit multi-product requests, product comparison, cross-sell, generic media requests, out-of-context testimonials. Each is addressed by the Explicit-Scope Escape; residual ambiguity → no media (same as current product-card ambiguity rule). Full analysis in `10-FAILURE_MODES.md`.

## Recommendation

Adopt Option C (doc 12). Staged: shadow-resolve → gated media scoping → per-business enable → MEDIA_STATE projection. Requires: 1 new table + RLS, changes in `core.ts`, `conditional-media.ts`, `product-recommendation.ts`, `context.ts`, `prompts.ts`, parity tests for 3 channels.

## Risk register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Context resolver mis-scopes and hides valid media | Medium | Escape hatch + shadow mode + fallback to global matching |
| Token growth from context + media state | Low–Med | Budgeted projection (~150–350 tok), remove stale `[IMAGEN_DISPONIBLE]` notes |
| Migration of dedup state | Medium | Keep 016/038 tables during transition; new keys additive |
| Regression in existing trigger tests | Low | AC6 requires green `tests/runtime/media.test.ts` |

## Decision requested

- Approve Option C as architectural direction.
- Authorize PRD authoring using `13-PRD_INPUT.md`.
- Confirm governance pipeline: no implementation before PRD → GOVERNANCE → SUBARU.

---

**STOP_FOR_HUMAN** — per mission constraints, this investigation ends here. Next stages (CONTRADICTION LOOP → COUNCIL → PRD → GOVERNANCE → SUBARU → IMPLEMENTATION) require human initiation.
