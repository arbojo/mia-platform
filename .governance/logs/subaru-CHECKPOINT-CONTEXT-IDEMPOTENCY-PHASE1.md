# Subaru Checkpoint — Context + Idempotency Phase 1

**Checkpoint:** PRE-IMPLEMENTATION (Loop 6 → Loop 7)
**Date:** 2026-08-30
**Decision ID:** DEC-20260830-CONTEXT-IDEMPOTENCY-PHASE1

---

## 1. Repo HEAD

```
d12ce6503ddc8a7b11a71c6037b87c33939702c0
```

Verificado con `git rev-parse HEAD` en `mia-platform/` durante Loop 6.
Coincide con el HEAD evidenciado en doc 01 (`d12ce65`) — el árbol de evidencia 01–33
fue levantado sobre este mismo HEAD.

## 2. Working tree state

- Sin modificaciones de código: Loop 6 NO tocó `src/`, `supabase/migrations/`, ni prompts.
- Archivos creados en Loop 6 (exclusivamente gobernanza y docs):
  - `docs/research/context-idempotency/34-COUNCIL-DECISION.md` (completado)
  - `docs/research/context-idempotency/35-GOVERNANCE-MANIFEST.md` (creado)
  - `.governance/tasks/DEC-20260830-CONTEXT-IDEMPOTENCY-PHASE1.json` (creado)
  - `.governance/logs/subaru-CHECKPOINT-CONTEXT-IDEMPOTENCY-PHASE1.md` (este archivo)
- No commits realizados.

## 3. Governance decision

| Decision | Status | Provenance |
|---|---|---|
| D1 — Context TTL = vida de conversación | APPROVED | Directiva humana Loop 6 (verbatim) |
| D2 — NUNCA re-presentar mismo asset al mismo scope; 2 bypasses explícitos | APPROVED | Directiva humana Loop 6 (verbatim) |
| D5 — Scope explícito = nombre literal + SKU; LLM excluido | APPROVED | Directiva humana Loop 6 (verbatim) |
| C-1 — Safe-default: no dispatch en ambigüedad | APPROVED | Recomendación contractual documentada adoptada verbatim (docs 22/32/33) |
| D3 / D4 / D6 | PHASE 2 | NO aprobados |

Gate: **D1 ✅ D2 ✅ D5 ✅ C-1 ✅ → manifest creado y válido.**

## 4. Authorized scope

P1-1..P1-8 (doc 31), en orden P1-8 → P1-1 → P1-2 → P1-3 → P1-4 → P1-5 → P1-6 → P1-7:

- P1-1 Conversation-scoped context (`active_product_ids[]`)
- P1-2 Explicit-scope determinístico
- P1-3 Trigger evaluation dentro del scope
- P1-4 Atomic conversation × asset claims
- P1-5 Deprecación de `media_sent_products[]`
- P1-6 LLM media feedback
- P1-7 Decision logging
- P1-8 Golden tests GT-01..GT-35

Detalle completo: `35-GOVERNANCE-MANIFEST.md` §Authorized Scope.

## 5. Forbidden scope

- D3 (delivered_at / provider receipts) — Phase 2
- D4 (identity hardening) — Phase 2
- D6 (customer × asset dedup read path) — Phase 2
- customer-level dedup semantics
- delivered/attempted states fuera del contrato claimed/dispatched/failed
- nuevos estados no demostrados
- cambios de prompts fuera del bloque P1-6 (doc 28 §3)
- cambios de canales específicos que alteren decisiones de negocio
- migraciones fuera de `active_product_ids` + `state` en `chat_media_dispatched`
- refactor arquitectónico no necesario
- commit / deploy dentro de Loop 6

Detalle completo: `35-GOVERNANCE-MANIFEST.md` §Explicitly Forbidden.

## 6. Current phase

```
IMPLEMENTATION AUTHORIZED — PHASE 1 ONLY
```

- Loop 6 termina aquí. NO se implementa en este loop.
- Loop 7 (implementación) arranca con P1-8 (golden tests) según doc 31.
- Validación requerida: 10 gates (doc 35 §Required Validation).
- Invariante de proyecto honrado: NO APPROVED GOVERNANCE → NO WORKER
  (TASK-20260823-114235663).

## 7. Verification chain

```
Evidence 01–33 (HEAD d12ce65, frozen)
  → Gate-check Loop 5 (implementación bloqueada solo por decisiones)
  → Doc 34: D1/D2/D5 verbatim + C-1 contractual → APPROVED
  → Doc 35: manifest summary → creado
  → .governance/tasks/DEC-20260830-CONTEXT-IDEMPOTENCY-PHASE1.json → creado
  → Subaru checkpoint (este documento) → IMPLEMENTATION AUTHORIZED — PHASE 1 ONLY
  → Loop 7: implementation (next)
```
