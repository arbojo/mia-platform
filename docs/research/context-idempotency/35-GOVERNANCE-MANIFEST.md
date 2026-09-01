# Governance Manifest — Context + Idempotency Phase 1

**Decision ID:** DEC-20260830-CONTEXT-IDEMPOTENCY-PHASE1
**Manifest file:** `.governance/tasks/DEC-20260830-CONTEXT-IDEMPOTENCY-PHASE1.json`
**Date:** 2026-08-30
**Repo HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Council gate:** D1 ✅ D2 ✅ D5 ✅ C-1 ✅ (doc 34) → **manifest created**
**Contract source:** docs 22–33 (evidence), doc 31 (phase boundary), doc 30 (GT-01..GT-35)

---

## Authorized Scope (Phase 1 ONLY)

| Step | Title (doc 31) | Authorized surface |
|---|---|---|
| P1-1 | Conversation-scoped context (`active_product_ids[]`) | 1 migración aditiva sobre `conversations`; sin backfill |
| P1-2 | Explicit-scope determinístico | matching literal + SKU sin LLM en core (D5) |
| P1-3 | Trigger evaluation dentro del scope | `resolveConditionalMedia()` recibe scope como parámetro; reorder pipeline contexto → trigger → media → LLM |
| P1-4 | Atomic conversation × asset claims | columna `state` (claimed/dispatched/failed) sobre `chat_media_dispatched`; patrón ON CONFLICT existente |
| P1-5 | Deprecación de `media_sent_products[]` | lectura mantenida durante transición, escritura migrada al claim atómico |
| P1-6 | LLM media feedback | bloque de feedback mínimo (doc 28 §3), formato contractual |
| P1-7 | Decision logging | logging estructurado de dispatch/no-dispatch (eventos doc 30 §H) |
| P1-8 | Golden tests | GT-01..GT-35 (doc 30) — red de seguridad de P1-1..P1-7 |

**Execution order (doc 31):** P1-8 → P1-1 → P1-2 → P1-3 → P1-4 → P1-5 → P1-6 → P1-7.

**Invariants in force:** INV-1..INV-5 (doc 22), decisions D1/D2/D5/C-1 (doc 34),
no-invention rule (doc 27), channel-independent parity (doc 29).

## Explicitly Forbidden

- **Phase 2 decisions:** D3 (`delivered_at`, provider receipts, Baileys spike), D4
  (identity hardening), D6 (customer × asset dedup read path).
- Customer-level dedup semantics (write of `customer_id` stays as-is; read path NOT implemented).
- Delivered/attempted state semantics beyond `claimed/dispatched/failed` (P1-4 contract).
- Nuevos estados no demostrados por la evidencia.
- Cambios de prompts fuera del contrato (solo el bloque de feedback P1-6, doc 28 §3).
- Cambios en canales específicos que alteren decisiones de negocio (parity invariante doc 29).
- Migraciones fuera del alcance contractual (solo: `active_product_ids uuid[]` aditiva +
  columna `state` en `chat_media_dispatched`).
- Refactor arquitectónico no necesario para P1-1..P1-8.
- Commit / deploy dentro de Loop 6 (implementación es Loop 7).
- Inventar alternativas UX para C-1 (decisión adoptada verbatim en doc 34).

## Required Validation (Loop 7 acceptance gates)

1. Golden Tests GT-01..GT-35 (doc 30) — suite verde antes de activar cualquier flag
2. E2E shared-core validation
3. WhatsApp parity (Baileys)
4. WebChat parity
5. Lab parity
6. Race/idempotency tests (atomic claim bajo concurrencia; GT-22, GT-23)
7. lint
8. build
9. unit tests
10. deployment smoke test

**Implementation conditions (manifest JSON):** todos los gates verdes, Council
deviations = 0, Subaru checkpoint completado.

---

## Manifest linkage

- Council decision: `34-COUNCIL-DECISION.md` (DEC-20260830-CONTEXT-IDEMPOTENCY-PHASE1)
- Governance manifest JSON: `.governance/tasks/DEC-20260830-CONTEXT-IDEMPOTENCY-PHASE1.json`
- Authorized steps: P1-1..P1-8 (docs 23–31)
- Validation matrix: GT-01..GT-35 (doc 30)
- Subaru checkpoint: `.governance/logs/subaru-CHECKPOINT-CONTEXT-IDEMPOTENCY-PHASE1.md`
- Project invariant honored: **NO APPROVED GOVERNANCE → NO WORKER** (TASK-20260823-114235663)
