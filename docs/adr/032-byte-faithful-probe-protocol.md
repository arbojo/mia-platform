# ADR-032: Byte-Faithful Probe Protocol (ITSM Gap Refutation)

## Status

Accepted

## Date

2026-09-21

## Council

CTO, Architect, Domain Expert, Backend Engineer, Frontend Engineer, QA Engineer

---

## 1. Context

The self-service readiness audit (ITSM-style) reported four items with partial/warning scores and a recurring pattern of "not found" findings:

| Item | ITSM Score | ITSM Warning |
|------|-----------|--------------|
| AI/LLM | 60% | "no se encontró motor de búsqueda semántica", "no pasan los tests" |
| Knowledge Base | 70% | "no se vio UI/endpoint de ingestión", "no se sabe cuántos items seedeados" |
| Sales Rules | 40% | "no se vio UI", "no se encontró validación en tiempo de respuesta", "no se ven reglas consultadas en la conversación" |
| Conversational Runtime | 70% | "no se encontró integración en el flujo de mensajes", "KB vacía no probada" |

A byte-faithful probe of the real source tree refuted every warning:

| ITSM Claim | Probe Result (byte-faithful) |
|------------|------------------------------|
| "No semantic search engine" | Correct-by-design: retrieval is structural (`knowledge.ts:246-250`, `eq(category)`, `order(priority)`), matching ADR-010 Sales domain boundary. Not a gap. |
| "No KB ingest UI/endpoint" | False — 9 endpoints + 4 UI components exist (`api/knowledge/items|[id]|learn|analyze|suggestions|instructions|media`, `KnowledgeCenter`, `LearningReport`). |
| "Unknown seeded KB count" | Correct-but-false-alarm: no seed SQL exists by design (FK `business_id`, multi-tenant). Empty-KB is the correct first-run contract, covered by `process-streaming.test.ts:97` (`usedContext: []`). |
| "No sales rules UI" | False — `RulesManager.tsx` (CRUD on `sales_rules`), `SalesConfigForm.tsx`, `api/sales/config`. |
| "No sales rules validation at response time" | False — `knowledge.ts:33,46` loads rules → `:214` filters active → `:109/232` into `context.rules` → `prompts.ts:381` injects into system prompt. |
| "No rules consulted during conversation" | False — rules are part of `getBusinessContext`, same contract as Item 1, loaded under `request_type` in `runtime.ts`. |
| "KB empty not tested" | False — `process-streaming.test.ts:97` covers `usedContext: []`; runtime calls `resolveRecommendedProduct` with nulls (degradation, not skip). |

Root cause of the false negatives: the ITSM scanned only `src/app/dashboard/*` pages and visible endpoints, treating `src/lib/*` as if absent. The commercial tier lives in `src/lib/*` with generated prompts (`prompts.ts`, 394 lines) — invisible to a page-only scan.

## 2. Decision

1. **Byte-faithful probe before verdict.** Any diagnostic that reports "not found" / "missing" / "not wired" for a feature must first run a byte-faithful probe against the actual tree (read real files, run the real contract) before writing the verdict. A "not seen" without a probe is recorded as `no-verificado`, never as `faltante`.

2. **Evidence with file:line.** Every verdict cites `file_path:line` as evidence. No bare claims.

3. **Rules live in `src/lib/*`.** The council treats `src/lib/ai/*`, `src/lib/runtime/*`, `src/lib/sales/*` as the canonical commercial layer. A page-only scan is insufficient to judge feature completeness.

4. **Proposed code requires STOP/approval.** No `src/` changes are written from a diagnostic finding alone; they require an explicit `aprobado` and a stop before writing (§22 LOOP Fase 3).

5. **No commits beyond user-authorized scope.** ADRs and tests are documented without auto-committing.

## 3. Consequences

- Fewer false negatives: warnings are only emitted after a byte-faithful probe fails.
- The ITSM scoreboard for the four items is corrected to **Ready (verified)** where refuted.
- `src/lib/*` is now the first place the council checks for commercial capability.
- Risk: the probe layer must stay byte-faithful (read real files, real contracts); a probe that invents contracts produces false *positives*. Guard: probes dump raw file lines, not paraphrases.
- Future domain audits (inventory, delivery, analytics) must follow this protocol before reporting scores.
