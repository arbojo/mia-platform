# ADR-011: Evidence First Protocol — Council Audit Reliability

## Status

Accepted

## Date

2026-07-29

## Council

CTO, Architect, Domain Expert, Product Manager, Backend Engineer, Frontend Engineer, Database Engineer, AI Engineer, QA Engineer, Security Engineer, Release Manager

---

## 1. Context

The Council identified a recurring quality problem: agents emit diagnoses that reference issues already resolved in previous commits. Findings appear in audits that should have been closed, wasting review cycles and eroding trust in the Council's output.

Root cause analysis revealed four failure patterns:

| Pattern | Description | Consequence |
|---------|-------------|-------------|
| **Context Blindness** | Agent analyzes using only conversation history, not the current repository state | Finding references code that no longer exists |
| **Diagnosis Reuse** | Agent reuses a finding from a previous audit without re-validating | Fixed issue reported as still broken |
| **Commit Neglect** | Agent does not inspect `git log` or `git diff` before analysis | Misses relevant changes that affect the analysis |
| **Stale Snapshot** | Agent reads a file once and never re-reads it after modifications | Analysis based on outdated file contents |

These patterns violate the core premise of the Council: that every agent's conclusion reflects the **actual** state of the codebase.

### Why This Happens

The current workflow (ADR-001) defines which agents participate and in what order, but it does **not** define:

1. What evidence an agent must gather before forming a conclusion.
2. How an agent proves a finding still exists.
3. How findings are tracked across audits.
4. When a finding becomes invalid and must be suppressed.

Without these rules, agents default to the path of least resistance: analyzing from conversation context rather than repository state.

---

## 2. Problem

The Council needs a **mandatory pre-audit protocol** that:

1. Forces every agent to establish the current state of the repository **before** forming any conclusion.
2. Tracks findings through a lifecycle so resolved issues never reappear.
3. Requires every conclusion to cite the specific evidence (file path, line number, commit hash) that supports it.
4. Integrates into the existing agent workflow without doubling review time.

---

## 3. Decision

**Adopt the "Evidence First" protocol as mandatory pre-audit procedure for all Council agents.**

---

## 4. The Evidence First Protocol

### 4.1 Core Principle

> **No conclusion without evidence. No finding without re-validation.**

Every statement the Council makes about the codebase must be traceable to a specific state of the repository. No analysis may rely on conversation memory, past audits, or assumed knowledge.

### 4.2 The Pre-Audit Workflow

Every audit begins with this mandatory sequence, executed **before** any agent-specific analysis:

```
┌─────────────────────────────────────────────┐
│              1. BASELINE                     │
│  git log --oneline -10                       │
│  → Record HEAD commit hash                   │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│              2. CHANGES                      │
│  git diff HEAD~1 --stat                      │
│  git diff HEAD~1 --name-only                 │
│  → Record modified files                     │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│              3. FINDINGS LOAD                │
│  Load previous findings      ┌──────────────┤
│  from last audit             │ If first     │
│                              │ audit → skip │
│                              └──────────────┤
│  → Load OPEN/IN_PROGRESS entries            │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│              4. RE-VALIDATE                  │
│  For each previous finding:                 │
│  · Read target file at HEAD                 │
│  · Does the evidence still exist?           │
│  → RESOLVED if commit fixed it              │
│  → SUPERSEDED if file was removed/renamed   │
│  → INVALIDATED if evidence disproven        │
│  → Keep OPEN if still present               │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│              5. INSPECT                      │
│  For each modified file:                    │
│  · Read the file                            │
│  · Compare with git diff                    │
│  → Understand what changed                  │
│  → Identify any new issues                  │
│  → Document findings with evidence          │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│              6. EMIT                         │
│  Collate:                                   │
│  · Re-validated OPEN findings               │
│  · New findings from inspection             │
│  → Attach evidence to each                  │
│  → Emit only what currently exists          │
│  → Exclude RESOLVED/SUPERSEDED/INVALIDATED  │
└─────────────────────────────────────────────┘
```

### 4.3 Minimum Evidence Requirements

Every finding **must** include:

| Field | Required | Example |
|-------|----------|---------|
| File path | Yes | `src/lib/runtime/runtime.ts:42` |
| Evidence snippet | Yes | The exact code or behavior observed (minimum 5 lines of context) |
| HEAD commit | Yes | The commit hash at time of analysis |
| Verification command | Yes | The exact command or tool call used to confirm (`read file`, `grep pattern`) |
| Finding state | Yes | OPEN, RESOLVED, SUPERSEDED, INVALIDATED |

**A finding without these fields is invalid and must be rejected by the Orchestrator.**

### 4.4 Agent-Specific Evidence Rules

| Agent | Minimum evidence before concluding |
|-------|-----------------------------------|
| **CTO** | Read the relevant ADR, read HEAD, verify the concern still applies |
| **Architect** | Read the affected module files, read `git diff` for the change, compare with existing patterns |
| **Domain Expert** | Read the domain entities involved (from schema or types), verify naming and relationships |
| **Product Manager** | Read the UI file or API response; do not rely on description alone |
| **Backend Engineer** | Read the route file, read the function, run `grep` for usages |
| **Frontend Engineer** | Read the component file, verify imports, check for client/server boundary |
| **Database Engineer** | Read the migration file, read the table definition |
| **AI Engineer** | Read the prompt file, read the context builder, verify token tracking |
| **Performance Engineer** | Read the relevant function, verify query patterns |
| **Security Engineer** | Read RLS policies, verify Supabase client selection, check for injection vectors |
| **QA Engineer** | Read the test file, run the test, verify the output |
| **Release Manager** | Run `git status`, verify working tree, verify remote sync |

### 4.5 Finding Lifecycle

Each finding progresses through these states:

```
                    ┌───────┐
                    │ OPEN  │ ◄── New finding identified
                    └───┬───┘
                        │
                   Assigned to
                   engineer
                        │
                        ↓
                 ┌────────────┐
                 │ IN_PROGRESS│ ◄── Engineer working on fix
                 └─────┬──────┘
                       │
              ┌────────┼────────┐
              │        │        │
              ↓        ↓        ↓
         ┌────────┐ ┌────────┐ ┌───────────┐
         │RESOLVED│ │SUPERSED│ │INVALIDATED│
         └────────┘ └────────┘ └───────────┘

```

| State | Meaning | How it enters this state |
|-------|---------|--------------------------|
| **OPEN** | Issue confirmed, awaiting work | New finding during audit |
| **IN_PROGRESS** | Being actively resolved | Engineer starts working on it |
| **RESOLVED** | Fixed by a commit | Next audit detects evidence is gone |
| **SUPERSEDED** | No longer applicable (code changed structurally) | File deleted, renamed, or architecture changed |
| **INVALIDATED** | Evidence was incorrect or misinterpreted | Agent disproves their own finding |

### 4.6 Auto-Resolution Rules

A finding transitions automatically when:

| Trigger | Transition | Method |
|---------|-----------|--------|
| Commit modifies the exact file:line | RESOLVED | `git diff HEAD~1` shows changes to the reported line |
| File containing the finding is deleted | SUPERSEDED | `git diff HEAD~1 --name-only` includes the file |
| File containing the finding is renamed | SUPERSEDED | `git diff HEAD~1 --name-status` shows rename |
| Finding was about removed functionality | SUPERSEDED | Migration or refactor eliminated the code |
| New audit opens finding from unrelated change | OPEN | Previous RESOLVED finding re-occurs (new instance) |

### 4.7 Evidence Log Format

Every audit must produce an evidence log in this format:

```
## Audit Evidence

HEAD: a1b2c3d4
Date: 2026-07-29
Previous audit HEAD: e5f6g7h8

### Changed Files
- src/lib/runtime/runtime.ts (modified)
- src/lib/runtime/execute-ai.ts (new)

### Previous Findings Re-validated
- FINDING-001: OPEN → RESOLVED (file:line no longer contains the issue)
- FINDING-002: OPEN → SUPERSEDED (file was deleted)

### New Findings
- FINDING-003: OPEN
  File: src/lib/runtime/runtime.ts:42
  Evidence:
  ```ts
  const x = someFunction() // the issue is here
  ```
  HEAD: a1b2c3d4
  Verification: `read src/lib/runtime/runtime.ts:40-50`
```

### 4.8 Integration With Council Workflow

The protocol adds exactly **one step** before each agent's analysis: the Evidence First pre-audit. It does not change the agent ordering, handoffs, or responsibilities.

```
Before ANY agent analysis:
┌──────────────────────────────────────┐
│  Evidence First Pre-Audit            │
│  · Read HEAD                         │
│  · Read git diff                     │
│  · Load previous findings            │
│  · Re-validate against current code  │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│  Agent-specific analysis             │
│  (existing workflow continues)       │
└──────────────────────────────────────┘
```

The Orchestrator is responsible for verifying that the pre-audit was completed before accepting the agent's output.

---

## 5. Council Perspectives

### CTO

The Evidence First protocol is the quality infrastructure the Council has been missing. Without it, the Council's output is only as reliable as each agent's memory — which is inherently unreliable. This protocol makes the repository the source of truth, not the conversation history. I approve this protocol as mandatory for all agents.

### Architect

The protocol is designed for minimal overhead. The pre-audit consists of approximately 5 commands (`git log`, `git diff`, loading previous findings, re-reading changed files). For a typical audit, this adds 3-5 minutes of analysis time. The time saved by not chasing phantom findings more than compensates.

The key architectural insight is that findings are **state machines tied to files**. When a file changes, its associated findings must be re-evaluated. This is analogous to cache invalidation — the file timestamp is the cache key.

### Domain Expert

The protocol protects domain consistency across audits. A domain concern raised in one sprint cannot silently carry over to the next if the code has been modified. Every domain finding must be re-validated against the current schema and entity definitions.

One concern: the protocol must handle the case where a finding is about a **missing** feature (e.g., "entity X lacks field Y"). If the field is added in a commit, the finding should transition to RESOLVED automatically. This is covered by the auto-resolution rules — the commit that adds the field touches the relevant file:line.

### Product Manager

From a user perspective, this protocol means the Council produces **reliable** output. Users (engineers working on sprints) don't waste time responding to findings about already-fixed issues. The trust gain is significant.

### Backend Engineer

The pre-audit rules for backend are straightforward. Before analyzing any runtime, adapter, or API change:

1. `git log --oneline -10` — establish baseline
2. `git diff HEAD~1 --name-only` — identify modified files
3. `git diff HEAD~1 -- src/lib/runtime/` — if runtime changed, re-read the entire module
4. Read the specific files that changed
5. Re-validate any OPEN finding that references a modified file

This adds approximately 2 minutes to a backend audit.

### Frontend Engineer

UI findings are particularly prone to staleness because UI code changes frequently (styling, layout, component refactoring). The protocol handles this cleanly:

- If a component file was modified, any finding about that component is automatically suspect and must be re-validated.
- If a component file was not modified, findings about it remain valid (assuming the audit scope is the same).
- If a component was deleted, its findings become SUPERSEDED.

This prevents the common pattern where a UI finding (e.g., "button missing") persists across commits that redesigned the entire page.

### Database Engineer

Migration files are append-only by rule (ADR-001, Rule 4). This means findings about schema issues can be handled deterministically:

- If a migration file was added after the finding, the finding must be re-validated against the new schema.
- If a migration file was added that explicitly addresses the finding (e.g., adding a missing index), the finding transitions to RESOLVED.
- If no new migration exists, the finding remains OPEN.

The protocol's auto-resolution rules handle this naturally: `git diff HEAD~1 --name-only` detects new migration files, and the agent re-validates the schema.

### AI Engineer

The finding lifecycle is essential for AI prompt audits. Prompt behavior changes over time, and a finding about prompt quality (e.g., "assistant uses incorrect tone") may be:

1. RESOLVED if the prompt was updated,
2. SUPERSEDED if the personality model changed,
3. INVALIDATED if the original test was flawed.

The state machine prevents a fixed prompt issue from being reported again in the next audit.

One additional consideration: findings about AI behavior should include the **exact input** that triggered the behavior, not just the code path. This is covered by the evidence requirement.

### QA Engineer

The Evidence First protocol is the QA Engineer's ideal quality gate. It ensures that every testing observation is grounded in the actual build, not a mental model of what the code does.

The mandatory verification checklist for QA becomes:

```
[ ] HEAD commit recorded
[ ] Previous findings loaded and re-validated
[ ] Modified files re-inspected
[ ] Each new finding includes evidence (file:line, snippet, commit)
[ ] No OPEN finding references already-resolved issues
[ ] Evidence log produced
```

This checklist prevents the most common QA failure: reporting a bug that was already fixed in a commit the QA agent didn't read.

### Security Engineer

False positives are a security audit killer. When security findings are ignored because "that was already fixed," real issues get overlooked. The Evidence First protocol eliminates this by:

1. Auto-resolving findings that reference fixed code — the security agent never sees them.
2. Requiring evidence for every finding — prevents vague "this looks unsafe" conclusions.
3. Tying findings to specific file:line references — makes verification precise.

From a security perspective, this protocol **reduces** the risk of missed vulnerabilities by eliminating noise from the audit output.

### Release Manager

The Release Manager is the final gate. Before any commit, the Release Manager must verify:

1. That no OPEN findings exist for the modified files.
2. That the evidence log is complete.
3. That all findings are in a known state (OPEN, RESOLVED, etc.).

This integrates naturally with the existing Release Manager checklist. I will add the evidence verification step to the pre-commit process.

---

## 6. Changes Required

### 6.1 AGENTS.md

The following changes are required to make the Evidence First protocol permanent:

1. Add the Evidence First protocol as a mandatory pre-audit step in the Council workflow (Section 2.2).
2. Add a new section (Section 22) documenting finding states and the evidence log format.
3. Add the evidence requirement to each agent's rules section.
4. Update the QA checklist (Section 14) to include evidence verification.
5. Add the Release Manager evidence check to the release process (Section 15).

### 6.2 Agent Documentation

Each agent file (`.agents/*.md`) should have an "Evidence Rules" section added, specifying what minimum evidence that agent must gather before forming a conclusion.

### 6.3 No Code Changes

This protocol is purely procedural. No implementation code, database schema, or configuration files are affected.

---

## 7. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Protocol adds 3-5 min per audit | The time saved by eliminating phantom findings exceeds this cost |
| Agents skip the pre-audit (compliance failure) | Orchestrator enforces the step; findings without evidence are rejected |
| Finding lifecycle is ignored | Finding states are part of the audit output; Release Manager verifies |
| False sense of completeness | Evidence requirements make gaps visible — missing evidence is itself a finding |
| Overhead for trivial tasks | Orchestrator can waive the protocol for changes classified as "trivial" |

---

## 8. References

- `AGENTS.md` — Main agent guide (requires update)
- `docs/adr/001-agent-system.md` — Original agent system (defines current workflow)
- `docs/adr/010-sales-domain-boundary.md` — Domain boundary (established the Council model)
- `.agents/orchestrator.md` — Orchestrator workflow (enforcement point)
