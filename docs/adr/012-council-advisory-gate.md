# ADR-012: Council Advisory Gate — Automated Post-Development Audit

## Status

Accepted

## Date

2026-07-29

## Council

CTO, Architect, Domain Expert, Product Manager, Backend Engineer, Frontend Engineer, QA Engineer, Security Engineer, Release Manager

---

## 1. Context

ADR-001 defined the specialized engineering agent system with 15 roles and a mandatory workflow. ADR-011 added the Evidence First protocol for pre-audit validation. However, both ADRs describe a **manual** process driven by AI agents responding to prompts — there is no automated mechanism to:

1. Execute the Council agent workflow against real repository state.
2. Generate audit reports that persist across development sessions.
3. Connect audit findings with the Evidence First protocol's finding lifecycle.
4. Provide a reusable entry point (npm script) that developers and CI systems can invoke.

The Council framework (`workshop/council/`) already provides:
- CouncilEngine — parallel execution of 5 roles (Architect, QA, Security, Performance, Product)
- Evidence First protocol (ADR-011) — finding lifecycle and re-validation
- Persistence layer for ADR decisions

What is missing is the **integration layer** that connects these components into a single, repeatable process.

---

## 2. Problem

The development workflow has three specific gaps:

### 2.1 No Automated Repository Context

Council agents currently receive manually constructed context. There is no adapter that:
- Reads `git log` and `git diff` to determine what changed.
- Runs lint, build, and test validation automatically.
- Structures the real repository state into a `CouncilContext`.

### 2.2 No Persistent Audit Trail

Audit reports exist only in memory during a session. There is no mechanism to:
- Save reports to disk for later review.
- Load previous findings for re-validation per Evidence First.
- Generate human-readable summaries (Markdown) for non-technical stakeholders.

### 2.3 No Post-Development Automation

After implementing changes, developers must manually remember to:
- Verify lint, build, and tests.
- Run a Council audit.
- Index decisions into engineering memory.

There is no script that orchestrates these steps.

---

## 3. Decision

**Adopt a Council Advisory Gate as an automated post-development audit process.**

The gate has three components:

### 3.1 Adapters Layer

Located in `workshop/council/adapters/`:

| Adapter | Purpose |
|---------|---------|
| `GitContextAdapter` | Reads real git state (HEAD, diff, branch) and builds a `CouncilContext` |
| `EvidenceFirstAdapter` | Implements ADR-011 pre-audit: loads previous findings, re-validates against current HEAD |
| `AdrValidator` | Reads all ADRs from `docs/adr/`, extracts decisions, makes them available to Council agents |

### 3.2 Report Persistence

Located in `workshop/council/reports/report-persister.ts`:

- Saves each audit as JSON and Markdown to `workshop/council/reports/`.
- Supports loading the latest report for Evidence First re-validation.
- Generates structured Markdown with findings, severity counts, and evidence log.

### 3.3 Scripts

Located in `workshop/scripts/`:

| Script | NPM command | Purpose |
|--------|-------------|---------|
| `run-council-audit.ts` | `npm run council-audit` | Full pipeline: git context → Evidence First → CouncilEngine → persist |
| `post-development-audit.ts` | `npm run post-audit` | Post-session: check git, validate gates, Council audit, update memory |

### 3.4 Advisory — Not Blocking

The gate produces reports and recommendations. It does **not** block commits. This is intentional:
- The Council's findings are advisory during the current sprint.
- Blocking behavior may be introduced in a future ADR after the advisory model is proven.

---

## 4. Consequences

### Positive

1. **Repeatable audits** — Any developer can run `npm run council-audit` and get a structured report.
2. **Evidence First compliance** — Previous findings are automatically re-validated per ADR-011.
3. **ADR awareness** — Council agents receive ADR context during audits.
4. **Persistent history** — Reports accumulate in `workshop/council/reports/` for trend analysis.
5. **CI-ready** — The same scripts can be invoked by GitHub Actions (future).
6. **No modifications to `src/`** — All new code lives in `workshop/`.

### Negative

1. **Process overhead** — Running the audit adds time to the development cycle.
2. **No enforcement** — Developers can skip the audit without consequences.
3. **Build validation may fail** — The `GitContextAdapter` runs `next build` which may fail for unrelated reasons (e.g., missing env vars).

### Mitigations

1. **Speed** — The Council engine runs roles in parallel (Phase 2), minimizing wall-clock time.
2. **Advisory model** — Skipping is acceptable during early adoption; enforcement is a future concern.
3. **Graceful degradation** — Failed validation gates do not prevent the audit; they are recorded as findings.

---

## 5. Changes Required

### 5.1 New Files

| File | Lines |
|------|-------|
| `workshop/council/adapters/git-context-adapter.ts` | ~130 |
| `workshop/council/adapters/evidence-first-adapter.ts` | ~150 |
| `workshop/council/adapters/adr-validator.ts` | ~120 |
| `workshop/council/reports/report-persister.ts` | ~160 |
| `workshop/scripts/run-council-audit.ts` | ~70 |
| `workshop/scripts/post-development-audit.ts` | ~80 |

### 5.2 Modified Files

| File | Change |
|------|--------|
| `workshop/council/schemas/index.ts` | Add `findingStateSchema`, optional `state`/`filePath`/`headCommit` to finding schema |
| `workshop/council/types/index.ts` | Export `CouncilFindingState` type |
| `package.json` | Add `council-audit`, `post-audit` scripts |

---

## 6. References

- ADR-001 — Specialized Engineering Agent System (agent workflow)
- ADR-011 — Evidence First Protocol (pre-audit procedure, finding states)
- `workshop/council/core/council-engine.ts` — Parallel execution engine
- `workshop/council/dispatcher/parallel-dispatcher.ts` — Async dispatch with timeouts
