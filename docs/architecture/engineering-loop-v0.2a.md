# Engineering Loop v0.2a — Accountable Handoff

| Field | Value |
|---|---|
| Status | Implemented (TASK-20260823-114235663, council-approved 10/10) |
| Base | Engineering Loop v0.1 (`f54d590`) + post-proof audit findings D1/governance/INFRA |
| Scope | ONLY audit items 1–3. D2 (gate repair) and D3 (output validation) explicitly deferred to v0.2b |
| Evidence | `docs/architecture/engineering-loop-v0.2a-evidence.jsonl` |

## 1. Purpose

v0.1 proved the handoff could happen. v0.2a proves that when it happens, it is
**governed, checkpointed, observable, deterministic, and safely terminated**.
No new autonomy was added — only accountability.

## 2. The Three Invariants

| Invariant | Enforcement | Code |
|---|---|---|
`NO APPROVED GOVERNANCE → NO WORKER` | `runMission` resolves `governanceTaskId` through a `GovernanceChecker` before any runner call, worker selection, or escalation | `workshop/loop/run-loop.ts` (precondition block), `workshop/loop/governance.ts`
| `NO CHECKPOINT → NO HANDOFF` | Escalation requires an injected `SubaruGateway`; missing gateway or a failing `checkpointEscalation()` records `ESCALATION_UNRECORDED` and BLOCKs — the fallback worker is never invoked | `run-loop.ts escalate()`
| `INFRA_FAILURE → NO WORKER SWITCH` | `status === null` or spawn error `ENOENT`/`EACCES` classify as `INFRA_FAILURE`, which terminates the mission immediately without retry or model switch | `runner.ts`, `signals.ts classifyRun()`

## 3. Contract Deltas vs v0.1

### INPUT
`MissionRequest` now **requires** `governanceTaskId: string`.

### GOVERNANCE PRECONDITION
- New module `workshop/loop/governance.ts`: `FileGovernanceChecker` reads
  `<repoRoot>/.governance/tasks/<id>.json` and throws `GovernanceViolationError`
  for: missing file · invalid JSON · missing string `status` · `rejected` · any
  status ≠ `approved`.
- Refusals record evidence result `GOVERNANCE_REFUSED` with the precise reason
  and return `BLOCK` with **zero** runner invocations.

### FAILURE SIGNALS
`LoopSignal = 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'INFRA_FAILURE'`

| Condition | Signal |
|---|---|
| `timedOut` (ETIMEDOUT) | `TIMEOUT` |
| process `status === null` (crash/signal/spawn failure) | `INFRA_FAILURE` |
| spawn error code ∈ {`ENOENT`, `EACCES`} | `INFRA_FAILURE` |
| exit 0 | `SUCCESS` |
| any other non-zero exit | `FAILURE` |

Unknown stderr text is deliberately NOT treated as infrastructure failure —
classification uses deterministic process state only.

### ESCALATION / HANDOFF
Evidence results added: `ESCALATION_CHECKPOINTED` (gateway succeeded; fallback
may proceed) and `ESCALATION_UNRECORDED` (no gateway configured, or gateway
threw — mission BLOCKs, fallback never called).

### TERMINAL STATES
Unchanged: `COMPLETE` (all gates green) · `BLOCK` (gate failure, stuck fallback,
INFRA_FAILURE, escalation refusal, governance refusal) · `REQUIRE_HUMAN_APPROVAL`
(safety deny-list). D2 remains: gate failure is still terminal in v0.2a.

## 4. Real Integration Drill (D1 closure)

Harness: `workshop/loop/drill-v02a.mts` (parameterized via env, committed for reproducibility).

Isolation design:
1. Temp clone of this repo at `f54d590` with `origin` removed, then re-pointed at a **local bare repo** so every Subaru CLI push is a real git push that cannot touch GitHub.
2. The clone receives a copy of the **genuine approved manifest** `TASK-20260823-114235663`.
3. REAL `subaru freeze DRILL-V02A --governance TASK-20260823-114235663` executed inside the clone (commit + push OK).
4. Loop run from the real repo with default `FileGovernanceChecker` (reads the real manifest) and `CliSubaruGateway({ cwd: <clone> })` — the gateway spawns the REAL `workshop/subaru/cli.ts block` against the clone.
5. Nemotron seed session created by the real binary; failures #1–#2 are INDUCED deterministic outages (disclosed in evidence); big-pickle continuation, gates (lint+build) are real executions.

Result (see evidence JSONL, 8 records):
- All records share session `ses_fd183ed96ffeKqEQo09s5CHiPu`.
- Sequence: SEED → FAILURE ×2 → STUCK → **ESCALATION_CHECKPOINTED** → big-pickle SUCCESS (41.9s) → COMPLETE `{lint:true, build:true}` → VERIFICATION.
- Clone checkpoint forensics: `state: blocked`, `task_id: DRILL-V02A`, `governance_id: TASK-20260823-114235663`, block commit `acac5ea` pushed to the bare origin.

Notable: the first drill attempt ran WITHOUT a reachable origin. The real CLI
blocked the checkpoint locally but exited non-zero due to the failed push; the
gateway threw; the loop recorded `ESCALATION_UNRECORDED` and BLOCKed **without
calling the fallback**. This accidental negative test is itself proof of
invariant #2 under adverse conditions.

## 5. Tests

20 deterministic tests in `tests/engineering-loop.test.ts` mapping 1:1 to the
mission matrix T1–T12 (plus preserved v0.1 paths): governance missing/rejected/
unapproved/malformed with zero worker calls; escalation refused without gateway;
checkpoint failure blocks before fallback; crash/ENOENT/EACCES → INFRA_FAILURE
with no retry and no switch; mandatory-gateway handoff green (T12).

## 6. Remaining for v0.2b (NOT built here)

D2 gate-repair round (one feedback cycle on gate failure) · D3 output/malformed
validation · mission wall-clock deadline · token-cost capture · diff telemetry.
