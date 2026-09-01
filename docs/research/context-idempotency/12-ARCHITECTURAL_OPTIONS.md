# 12 — Architectural Options

**Mission:** Context-First Media & Product Idempotency
**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** EVIDENCE_LOCKED (discovery only — recommendation subject to Council)

---

## 0. Evidence Constraints Every Option Must Respect

From docs 01–11 (all FACT unless noted):

- C1. Dedup state is conversation-scoped only (`chat_media_dispatched`, `conversations.media_sent_products`).
- C2. Trigger matching is keyword-only (`media.ts:11-36`); no semantic layer exists.
- C3. There is no explicit "active product / commercial context" state object anywhere in the runtime (docs 01, 07).
- C4. `customers.id` is the only cross-channel identity key (`conversations.customer_id`).
- C5. The LLM receives `[IMAGEN_DISPONIBLE]` hints (prompts.ts:135) but never learns the dispatch outcome (`core.ts:100-119`).
- C6. Products exist as a flat candidate set; no PRIMARY/SECONDARY/REJECTED roles (doc 07).
- C7. Governance requires: no schema change without Council; prompts and migrations are governed artifacts.

---

## Option A — Status Quo + Local Repairs (Baseline)

**Description:** Keep global keyword-trigger evaluation. Fix only mechanical defects: make `media_sent_products` atomic (or migrate to a UNIQUE-constrained table), unify ordering on `position`, remove dual write (image-core #18), add LLM dispatch feedback.

| Dimension | Assessment |
|---|---|
| Context representation | None (unchanged) |
| Product identity | product_id on knowledge_items (unchanged) |
| Media idempotency | Per-conversation only (C1 persists) |
| Context transitions | Not supported — each message re-scans globally |
| Customer experience | Unchanged: keyword-hostage (doc 08) |
| Implementation complexity | Low (days) |
| Token impact | None |
| Runtime impact | None |
| Database impact | One migration (dedup table unification) |
| Channel parity | Improves slightly (race fix applies to all channels) |
| Migration risk | Minimal |
| Failure modes | All semantic/contextual failure modes of docs 04/10 persist: cross-product contamination, wording dependence, channel re-sends |

**Verdict:** Necessary hygiene in ANY future option, but does not answer the central hypothesis.

---

## Option B — Context-First Resolution (Central Hypothesis, Strict)

**Description:** The runtime maintains an explicit **Commercial Context** object per conversation: `{active_intent, active_product_id, discussed_product_ids[], rejected_product_ids[], presented_media_scopes[]}`. Media resolution runs ONLY inside that context: the global trigger scan is replaced by (active_product ∪ explicitly-named-products) scoping, with semantic (LLM-judged) product identification replacing keyword triggers for product binding.

| Dimension | Assessment |
|---|---|
| Context representation | New explicit state object persisted on conversation (JSONB) or derived per-turn from history |
| Product identity | product_id remains canonical; context holds references |
| Media idempotency | Extend dedup to (product_id, customer_id) via `customers.id` (C4) — satisfies D/E/F |
| Context transitions | State machine transitions A→B→A supported by design (doc 06) |
| Customer experience | Natural language: no trigger words needed for product binding |
| Implementation complexity | High (weeks): new state module, prompt changes, resolver rewrite |
| Token impact | +200–500 tokens/turn if persisted; higher if re-derived each turn |
| Runtime impact | One extra read/write per turn; media scan becomes scoped (cheaper) |
| Database impact | 1 migration: context column + customer-scoped dedup table |
| Channel parity | Strong: context lives in CORE, channels inherit invariant (doc 09) |
| Migration risk | Medium-high: prompt changes are governed (C7); keyword retirement changes visible dispatcher behavior |
| Failure modes | Strict scoping breaks legitimate multi-product intents (comparison, bundles, cross-sell) — doc 10 refutation |

**Refutation status (doc 10):** strict context-first fails: (a) customer explicitly requests media of a non-active product, (b) comparison messages naming two products, (c) generic media requests ("mandá fotos de la página"). Therefore Option B alone is INSUFFICIENT — requires the hybrid below.

---

## Option C — Hybrid: Context-Scoped Default + Explicit-Request Override (Recommended)

**Description:** Two-resolution-path model:

1. **Context path (default):** if the turn's commercial context identifies exactly one active product and the message contains no explicit multi-product markers, resolve media scoped to that product (semantic product binding, no keywords).
2. **Explicit path (override):** an LLM-judged classification of the message as `explicit_media_request {product?, asset_type?}` bypasses context scoping — the customer naming the product IS the context. Generic requests ("fotos de la página") fall here with product=NULL and resolve against generic media (product_id IS NULL), preserving today's generic-trigger semantics.
3. **Idempotency:** single atomic dedup table keyed by (customer_id, media_scope) where media_scope = product_id | NULL-generic, plus storage-asset identity as a secondary guard (doc 05 §3).
4. **Feedback loop:** the dispatch outcome (sent / suppressed-duplicate / none) is injected into the next prompt turn, closing gap C5.

| Dimension | Assessment |
|---|---|
| Context representation | Same Commercial Context object as Option B |
| Product identity | product_id canonical; explicit requests may re-bind context (A→B→A works) |
| Media idempotency | (customer_id, product_scope) atomic table + asset-identity guard; conversation-level state retained for compat |
| Context transitions | Explicit transitions; rejected products tracked to prevent resurrection (mirrors the RC5 lesson from sales detect) |
| Customer experience | Natural: keyword dependence eliminated for product-bound media; generic media stays keyword/intent-driven (acceptably natural) |
| Implementation complexity | Medium-high, incremental: 3 phases (feedback loop → context object → dedup migration) |
| Token impact | ~+50 tokens: classification inside the existing AI call, no extra LLM call |
| Runtime impact | Scoped scans cheaper than global; one extra dedup insert |
| Database impact | 1–2 migrations (context column; customer-scoped dedup) |
| Channel parity | Invariant: both paths live in CORE; adapters untouched (doc 09) |
| Migration risk | Medium, mitigated by phased rollout + per-business feature flag |
| Failure modes | Residual: mis-classification of explicit vs contextual requests (fallback = current behavior); duplicate asset rows possible until asset-identity guard ships |

**Why recommended:** the only option that simultaneously satisfies the central hypothesis AND survives the doc-10 refutation loop, while keeping every governed artifact (prompts, schema) inside Council scope.

---

## Option D — Full Event-Sourced Commercial State Machine

**Description:** A dedicated state machine service (UBSE-style, cf. `docs/research/kb/estados.md`) where every message is an event transitioning a persisted conversation FSM with phases (discovering → comparing → deciding → closing) and per-product substates. Media dispatch becomes a *consequence* of state, not of message content.

| Dimension | Assessment |
|---|---|
| Context representation | Full FSM with phases + product substates, event-sourced |
| Product identity | Strongest: roles (PRIMARY/SECONDARY/REJECTED) are first-class |
| Media idempotency | Natural: dispatch is a state-transition side effect, exactly-once by construction |
| Context transitions | The intended core feature |
| Customer experience | Best-in-class potential |
| Implementation complexity | Very high (months); overlaps with the separate UBSE initiative |
| Token impact | Potentially net-negative long-term (state summary replaces long history), high short-term |
| Runtime impact | New subsystem |
| Database impact | Significant (event log + state projections) |
| Channel parity | Strong if CORE-resident |
| Migration risk | High; collides with UBSE roadmap |
| Failure modes | FSM rigidity: real conversations violate transitions; large design surface before value |

**Verdict:** Strategic direction, not this mission. Option C is a compatible stepping stone toward D.

---

## Recommendation

**Adopt Option C** (hybrid context-scoped + explicit override), with Option A's mechanical repairs as Phase 0 and an explicit non-goal of Option D's FSM (deferred to the UBSE track). Option C is the minimal architecture that answers the mission's final question from evidence (doc 15):

> The smallest piece of state is **{active_product_id, active_intent, presented_media_scope[]} scoped to the customer** — small enough to live in one JSONB column and one dedup table, sufficient to select media without mixing products or repeating assets, and requiring zero trigger vocabulary from the customer.

---

**Next:** `13-PRD_INPUT.md`.

