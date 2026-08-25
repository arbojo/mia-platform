# Loop Termination Report — Council Review

**Status**: MISSION_COMPLETE
**Date**: 2026-08-25
**Decision ID**: DEC-20260825-EVIDENCE-REASONING
**Parent**: MIA_EVIDENCE_REASONING_RESEARCH.md

---

## 1. Termination State

**DECISION_ACCEPTED**

The Engineering Council has formally reviewed the MIA Evidence Accumulation / Customer State research and produced an authoritative architectural decision.

---

## 2. Decision Summary

| Item | Decision |
|------|----------|
| **Architecture** | Option B — Simplified Prompt-Enrichment Layer |
| **Effort** | ~450-550 lines, 2-3 days (corrected from research claim) |
| **Infrastructure reuse** | ~35-40% (corrected from research claim of 70%) |
| **Evidence model** | Three-layer (not four) — LLM handles hypothesis reasoning natively |
| **State dimensions** | 5: interest, trust, readiness, clarity, engagement |
| **Action types** | 13 (including ACKNOWLEDGE), CLOSE is conditional |
| **LLM authority** | Defined boundaries — MAY extract/propose, MAY NOT create facts |
| **Provenance** | Mandatory for every evidence item |
| **Uncertainty** | Valid state — triggers exploration, not closing |
| **Scope** | Strict boundaries defined, non-goals listed |

---

## 3. Verification of Research Claims

| Claim | Research Says | Council Found | Impact |
|-------|-------------|---------------|--------|
| Infrastructure reuse | 70% | **35-40%** | Effort estimate corrected |
| Wilson Score in experience_memory | Implemented | **Not implemented** (column exists, formula doesn't) | No impact on recommendation |
| Time decay in hot path | Active | **Dormant** (exists but not wired) | Needs wiring in implementation |
| Evidence extraction exists | No | **Confirmed no** | Core new work |
| State computation exists | No | **Confirmed no** | Core new work |
| Action selection exists | Prompt-only | **Confirmed prompt-only** | Prompt changes are sufficient |

---

## 4. Council Deliberation Results

| Decision Point | Result | Key Modification |
|---------------|--------|-----------------|
| D1 — Evidence Accumulation | ACCEPT WITH MODIFICATION | Three-layer, not four |
| D2 — Customer State | ACCEPT | 5 dimensions as proposed |
| D3 — Purchase Intent | ACCEPT | Not dominant, one of five signals |
| D4 — Accompany vs Push | ACCEPT WITH MODIFICATION | +13th action type (ACKNOWLEDGE) |
| D5 — Global Learning | ACCEPT | Priors only, existing scope system |
| D6 — Architecture Option | OPTION B | Corrected effort estimate |
| D7 — LLM Authority | ACCEPT WITH MODIFICATION | Explicit boundaries defined |
| D8 — Evidence Provenance | ACCEPT | Mandatory for all evidence items |
| D9 — Uncertainty | ACCEPT | Valid state, triggers exploration |
| D10 — Implementation Scope | ACCEPT | Strict boundaries, non-goals listed |

---

## 5. Adversarial Validation

All 15 scenarios PASS:

| # | Scenario | Result |
|---|----------|--------|
| 1 | Interested but can't afford | PASS |
| 2 | Many questions, no intent | PASS |
| 3 | Ready to buy, wants time | PASS |
| 4 | High interest, low trust | PASS |
| 5 | Customer changes mind | PASS |
| 6 | Contradictory signals | PASS |
| 7 | Graph predicts, evidence contradicts | PASS |
| 8 | Aggressive historical behavior | PASS |
| 9 | Global pattern leaks | PASS |
| 10 | Cross-tenant contamination | PASS |
| 11 | LLM invents evidence | PASS |
| 12 | LLM converts hypothesis to fact | PASS |
| 13 | Unnecessary questions to advance | PASS |
| 14 | Close despite uncertainty | PASS |
| 15 | Customer says "not yet" | PASS |

---

## 6. Invariants Established

| ID | Invariant | Severity |
|----|-----------|----------|
| INV-ER-001 | Evidence provenance mandatory | P0 |
| INV-ER-002 | State computed from evidence | P0 |
| INV-ER-003 | Global patterns ≠ individual facts | P0 |
| INV-ER-004 | Uncertainty triggers exploration | P0 |
| INV-ER-005 | CLOSE requires state thresholds | P0 |
| INV-ER-006 | LLM extractions are suggestions | P1 |
| INV-ER-007 | Backward compatibility maintained | P1 |
| INV-ER-008 | Time decay applied | P1 |
| INV-ER-009 | Evidence cap (50 per conversation) | P1 |
| INV-ER-010 | State momentum prevents swings | P1 |

---

## 7. Non-Goals (Explicitly NOT Authorized)

- CRM redesign
- Knowledge redesign
- Catalog redesign
- Memory redesign (extending, not replacing)
- Graph database
- Autonomous learning system
- Cross-tenant analytics redesign
- Sales engine changes
- Schema migration
- New database tables
- Code-level action selection
- Formal hypothesis objects
- Bayesian inference
- Reinforcement learning

---

## 8. Rollback Authorization

Rollback is authorized if:
- Conversion rate drops > 10%
- Latency increases > 200ms
- Customer satisfaction drops > 0.5 points
- State accuracy < 50%

Rollback effort: ~50 lines (remove state injection from prompt)

---

## 9. Next Steps

1. **Implementation mission**: Create separate governance task for implementation
2. **Subaru checkpoint**: Freeze checkpoint with implementation plan
3. **Implement**: 3 phases (evidence extraction, state computation, prompt enrichment)
4. **Test**: 10 required tests
5. **A/B test**: Compare with/without state injection
6. **Review**: Verify acceptance criteria

---

## 10. Loop Termination Contract Compliance

| Requirement | Status |
|-------------|--------|
| Research reviewed | YES |
| Claims verified | YES (70% → 35-40% corrected) |
| All decision points deliberated | YES (D1-D10) |
| Adversarial review completed | YES (15 scenarios) |
| Decision contract produced | YES |
| Invariants defined | YES (10 invariants) |
| Acceptance criteria defined | YES (7 criteria) |
| Required tests defined | YES (10 tests) |
| Scope boundaries defined | YES |
| Non-goals listed | YES |
| Implementation authorized | YES (with conditions) |
| LOOP_TERMINATION_REPORT.md produced | YES |

---

**MISSION_COMPLETE**

**Decision**: DEC-20260825-EVIDENCE-REASONING — Option B ACCEPTED
**Status**: Implementation Authorized (with conditions)
**Next**: Separate implementation mission required
