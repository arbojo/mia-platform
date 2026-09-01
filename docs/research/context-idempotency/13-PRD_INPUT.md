# 13 — PRD Input

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** INPUT_DRAFT (for PRD authoring; not a PRD)

This document converts the investigation's evidence into PRD-ready material. It commits to no implementation; it defines what a PRD must specify.

---

## Problem statement (evidence-backed)

1. MIA evaluates media triggers **globally against every message** (`conditional-media.ts` invoked from `core.ts:100-119` without a resolved commercial context), so media selection is driven by lexical coincidence, not by what the customer is actually discussing (doc 04).
2. Product identity is **re-derived per message** and never persisted (`product-recommendation.ts:16-170`), so the system cannot answer "which product is this conversation about?" (docs 03, 07).
3. Media idempotency is **conversation-scoped** only (`chat_media_dispatched` 016; `media_sent_products` 038), so new conversations re-send identical media and cross-conversation customer experience is unmanaged (doc 05, cases E/F).
4. The LLM is **not informed** of the media decision (`core.ts:100-119`; `prompts.ts:141-144` one-way note), so it can claim images that were never sent and cannot narrate re-sends (image-core findings #8/#9).

## Goals

- G1: Media decisions derive from a resolved commercial context (active intent + active product), not from global keyword scan.
- G2: A stable, persisted notion of "product under discussion" exists across turns, channels and conversations.
- G3: Media idempotency keys include the product and the customer, with a defined temporal policy; re-presentation on genuine context return is supported; spam is not.
- G4: The runtime informs the LLM of the media outcome of each turn.
- G5: The model is channel-invariant (Laboratorio, WebChat, WhatsApp produce identical media decisions for identical context + state).

## Non-goals

- No changes to sales flow (`processSaleClosing`, cancellation, retention — TASK-20260830-005512058 stays orthogonal).
- No new media types beyond current `image | testimonial` (039).
- No semantic embedding infrastructure in this PRD's scope (lexical triggers remain the matching primitive; context supplies the *scoping*, not better NLP).

## Requirements (must be answerable by the PRD)

- R1: Define the Commercial Context record (fields, owner table, writer, reader, RLS).
- R2: Define the context resolution algorithm and its ambiguity rule (ambiguous → no media).
- R3: Define the explicit-scope escape (named product in message, generic media request, testimonial request).
- R4: Define the new idempotency key(s) and their migration from `chat_media_dispatched` / `media_sent_products`.
- R5: Define the MEDIA_STATE prompt projection (format, token budget, truncation).
- R6: Define the staged rollout with shadow mode (log-only) and per-business flag.
- R7: Define parity acceptance tests for the three channels.

## Acceptance criteria (draft)

- AC1: Message mentioning Product B's name while A is active → B scoped for that turn; A's media not sent; context updated to B (or B noted as secondary).
- AC2: A→B→A: return to A allows at most one re-presentation of A's media; further repeats suppressed without explicit resend.
- AC3: New conversation for the same customer within suppression window → product media not re-sent automatically; explicit "mándame la foto" works (any channel).
- AC4: Same context + same media state produces identical media decision in WhatsApp, WebChat and Lab.
- AC5: LLM output never references an image that the runtime did not send in that turn (verifiable by log correlation).
- AC6: No regression in existing trigger unit tests (`tests/runtime/media.test.ts`).

## Risks / open questions for PRD

- Where does context resolution run — deterministic (reuse `intents.ts` + `triggerMatches`) vs LLM-assisted? (Investigation favors deterministic first; doc 12 Option C.)
- Suppression window default (hours/days) — business decision.
- Backfill strategy for existing conversations.
- Write amplification on `conversations` row (media_sent_products) vs new table.

## Constraints

- Discovery-only boundary respected: nothing in this document has been implemented; HEAD unchanged.
- Follow governance pipeline: INVESTIGATION → CONTRADICTION LOOP → COUNCIL → PRD → GOVERNANCE → SUBARU → IMPLEMENTATION.
