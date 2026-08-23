# Engineering Loop v0.1 — Post-Proof Audit

| Field | Value |
|---|---|
| Type | READ-ONLY forensic audit (no production code touched) |
| HEAD at audit | `f54d590` (`feat: engineering loop v0.1 - automatic worker handoff across opencode models`) |
| Branch / Remote | `main`, synchronized |
| Audited surface | `workshop/loop/` (7 files), `tests/engineering-loop.test.ts`, `docs/architecture/engineering-loop-v0.1-evidence-handoff.jsonl`, `docs/architecture/engineering-loop-v0.1.md` |
| Governance reference | TASK-20260823-102540725 (`approved`) |
| Method | Evidence First (ADR-011): every claim traced to code or executed artifact; documentation trusted only where executable behavior confirms it |

---

## 1. Executive Summary

The loop **has survived its first death**: the handoff chain Nemotron → deterministic repeated failure → RepeatedErrorRule STUCK → escalation → Big Pickle on the **same OpenCode session** → green gates → COMPLETE is proven against the real binary (`docs/architecture/engineering-loop-v0.1-evidence-handoff.jsonl`; all six records share `session_id = ses_fd1ba0e0cffejh58yizYUVF0QA`).

However, the audit found that v0.1 is a **bounded single-shot supervised executor**, not an autonomous system. Three discrepancies between documented intent and executable behavior were confirmed:

- **D1 — Subaru escalation is soft-wired** (`run-loop.ts:144`: `subaru?.checkpointEscalation(...)`). If `deps.subaru` is omitted, escalation proceeds with **no real checkpoint**, while the evidence record still claims `checkpoint: subaru:block ...`. The live drill (Mission B) ran **without** a real gateway; loop→Subaru integration exists only as a unit-test fake plus a separately-proven CLI.
- **D2 — Gate failure is terminal.** The original contract promised feeding gate failures back to the worker ("retry or escalation"); implementation goes straight to BLOCK (`run-loop.ts:123-140`). No repair round exists.
- **D3 — Success = process exit 0.** Nothing validates worker output; a worker that exits 0 without doing the task passes the signal stage. Gates are the only behavioral backstop.

None of these invalidate the proof. All three define exactly what v0.2 must close using primitives that already exist.

---

## 2. Evidence Matrix

Claim | Implementation | Evidence | Confidence
---|---|---|---
Mission starts via one function call | `run-loop.ts:101 runMission(request, deps)` | Unit TEST 1–8; drill driver invoked it directly | High
Safety deny-list runs BEFORE any execution | `run-loop.ts:35-42` (6 regex patterns), `run-loop.ts:49-54 safetyVerdict()` checked first in `runMission` | TEST 8a asserts deny before any runner call | High
Model routing is a fixed map | `router.ts:1-11`: `WORKER_MODELS = { nemotron: 'opencode/nemotron-3-ultra-free', 'big-pickle': 'opencode/big-pickle' }`, PRIMARY/FALLBACK consts | Audit of provider list (single provider `opencode`); TEST 2 asserts mapping | High
OpenCode invoked via CLI | `runner.ts:29-47`: `spawnSync('opencode', ['run', prompt, '--model', m, '--format', 'json', ('-s', sid)?])`, timeout→ETIMEDOUT | Real runs 53s (nemotron) / 17s (big-pickle) recorded in evidence | High
Session ID captured from stream | `runner.ts:24-27 extractSessionId` regex `"sessionID":"(ses_[A-Za-z0-9]+)"` over stdout | Live capture of both sessions in evidence JSONL | High
Session resumed across models | `run-loop.ts:120` seeds from `lastSessionId(evidenceDir, missionId)`; `-s` flag appended `runner.ts:32` | Handoff evidence: 6/6 records same `session_id`; TEST 6b covers resume seeding | High
Failure classified deterministically | `signals.ts:16-19`: `timedOut→TIMEOUT; exitCode===0→SUCCESS; else FAILURE` | TEST 4 matrix | High
STUCK detected by reused Council rule | `signals.ts:21-41`: attempts mapped to WorkshopEvents (`module:'engineering-loop'`, `action:'attempt:<worker>:<signal>'`) into `RepeatedErrorRule` | TEST 5 (2× same signal ⇒ stuck); live STUCK at attempt 2 | High
Escalation switches model once | `run-loop.ts:142-186 escalate()`: continuation prompt + FALLBACK_WORKER, single attempt | TEST 6/6b; live big-pickle SUCCESS after STUCK | High
Checkpoint persisted on escalation | ⚠️ **PARTIAL** — `run-loop.ts:144` `subaru?.` optional; `subaru-gateway.ts:9-20` real CLI spawn exists but was never fired end-to-end | FakeSubaru asserted in tests; real `subaru block` proven only standalone (iteration-1); Mission B passed no gateway (**D1**) | Medium (claim holds only with injected gateway)
Gates execute real npm scripts | `gates.ts:16-31 NpmGateRunner` (node+npm-cli.js for Windows EINVAL CVE-2024-27980) | Live `{"lint":true}` 23s; Mission A/B gates green | High
COMPLETE/BLOCK decided by gates | `run-loop.ts:123-140 finishWithGates`: all true→COMPLETE else BLOCK | Live COMPLETE ×2; TEST 8b forbids COMPLETE without gates | High
Evidence is append-only JSONL, resumable | `evidence.ts:19-33` | Committed handoff JSONL; `lastSessionId` used in live rerun | High
Termination is structurally bounded | `run-loop.ts:188` bounded `for` ≤ `maxPrimaryAttempts` (default 2) + exactly one `escalate()`; no recursion/while | Code inspection; all tests terminate | High

Discrepancies vs documentation: **D1, D2, D3** above (§1). Per protocol, executable behavior was treated as truth and recorded here.

---

## 3. Current Autonomy Boundary

Capability | Autonomous? | Mechanism | Human required? | Evidence
---|---|---|---|---
Mission creation | **No** | Human authors blueprint + governance manifest | Yes (classify + council) | AGENTS §23; freeze guard `workshop/subaru/cli.ts`
Worker selection | Yes | Fixed constants `PRIMARY_WORKER`/`FALLBACK_WORKER` (`router.ts:8-9`) | No (but also not configurable at runtime) | Code
Worker execution | Yes | `CliOpenCodeRunner.run` | No | `runner.ts:29`
Failure detection | Yes | `classifyRun` exit-code/timeout mapping | No | `signals.ts:16`
Stuck detection | Yes | `RepeatedErrorRule` threshold (>1 repeat) | No | `signals.ts:36`
Checkpointing | Partial | Optional gateway (**D1**); Subaru CLI itself fully autonomous once invoked | No *if wired* | `run-loop.ts:144`
Model switching | Yes | Single hardcoded escalation to fallback | No | `run-loop.ts:142`
Retry | Yes (bounded) | ≤2 primary attempts, context-free re-run; fallback gets continuation context | No | `run-loop.ts:188`
Gate execution | Yes | npm lint/build(/test:unit) | No | `gates.ts:16`
Completion decision | Yes | Gates all green → COMPLETE (outer Subaru `complete --confirm-gates` remains human-gated) | Outer mission closure: yes | `run-loop.ts:123`; subaru cli
Blocking | Yes | Terminal BLOCK + evidence record | Review afterwards | `run-loop.ts:168-181`
Escalation to human | Yes (as REQUIRE_HUMAN_APPROVAL) | Only trigger today: safety deny-list | Resolution: yes | `run-loop.ts:49`
Scope expansion control | **No** | Prompt text only; no diff boundary enforcement | Yes (post-hoc review) | Absence — see §6
Architectural decisions | No | Council/governance process | Always | AGENTS §23.5
Schema changes | No | Database Engineer authority; deny-regex only blocks `supabase db reset/push`, `DROP` **in prompt text** | Always | `run-loop.ts:37-39`
Destructive changes | Partial | Regex deny-list on prompt (force push, DROP, .env writes) | Yes for anything phrased differently | `run-loop.ts:35-42`
Production deployment | No | Deny pattern `vercel (--prod|deploy)` in prompt; Release Manager owns deploys | Always | `run-loop.ts:36`; AGENTS §2.5
Rollback | **No** | No mechanism; failed missions leave dirty working tree | Yes (manual `git restore`) | Absence

**Verdict**: deterministic automation of *execution, detection, switching, gating, termination*; humans own *creation, approval, scope, architecture, promotion, rollback*. This matches "supervised autonomy," not autonomy.

---

## 4. Worker Routing Audit

- Provider/model IDs: sole provider `opencode`; `opencode/nemotron-3-ultra-free` (primary), `opencode/big-pickle` (fallback) — `router.ts:1-11`. Deterministic pure function `modelFor`.
- Invocation: one-shot `opencode run <prompt> --model <id> --format json [-s <sid>]` (`runner.ts:31-33`). No daemon, no SDK dependency.
- Router is deterministic: yes (constants, no environment reads).
- Can selection change without human intervention? **No** — and that is currently a safety feature, not a limitation.
- Fails selected worker → classified FAILURE/TIMEOUT → retried once → STUCK → escalate to fixed fallback (proven).
- OpenCode itself fails (binary missing/crash): `result.status` is `null` → `exitCode === 0` false → **classified plain FAILURE**. Taxonomy gap: infrastructure crash is indistinguishable from task failure; the fallback will then hit the same wall and the mission BLOCKs with a misleading reason.
- Session ID unavailable/stale: `-s <dead-id>` makes OpenCode fail → FAILURE cascade → BLOCK. No pre-flight validation of session liveness.
- Worker hangs: `timeoutMs` (default 600_000, `runner.ts:22`) → ETIMEDOUT → TIMEOUT signal → counted like any failure; STUCK reachable. Verified by TEST 4.
- Smallest deterministic policy that could safely exist (design only): keep fixed ordered list `[nemotron, big-pickle]`, add explicit `INFRA_FAILURE` signal for `status === null || error.code in {ENOENT,EACCES}`, cap total attempts at 3 across workers, and treat a stale-session error (non-zero exit whose stderr matches session-not-found) as `SESSION_LOST` → continue WITHOUT `-s`. All four rules are pure functions over data already returned by `spawnSync`.

---

## 5. Failure Taxonomy

State | Detection today | Recovery today | Subaru records? | Loop continues? | Human needed?
---|---|---|---|---|---
A. Successful task | exit 0 (`signals.ts:18`) | — | n/a | → gates | No
B. Ordinary implementation failure | exit ≠ 0 → FAILURE | 1 blind retry (same prompt, same session seeded) | No | Yes, until stuck/steps exhausted | Only at BLOCK
C. Repeated failure / stuck | RepeatedErrorRule >1 repeat (`signals.ts:36`) | Escalation to fallback w/ context | Only if gateway injected (**D1**) | Yes (one fallback) | At BLOCK
D. Worker timeout | ETIMEDOUT → TIMEOUT (`runner.ts:39`, `signals.ts:17`) | Same as B | Same caveat | Yes | At BLOCK
E. Worker crash (signal kill) | status null → misread as FAILURE | Same as B | No | Yes | Misleading reason at BLOCK
F. OpenCode failure (ENOENT etc.) | **Not distinguished** (same as E) | None specific | No | Falls through to BLOCK | Yes — and diagnosis info lost
G. Malformed worker output | **Not detected** if exit 0 (**D3**) | None | No | False-positive path to gates | Post-hoc only
H. Gate failure | `finishWithGates` boolean map (`gates.ts`) | **Terminal BLOCK, no repair round** (**D2**) | No | No | Yes
I. Governance block | Not consulted by loop pre-run | n/a | n/a | n/a | Yes (outside loop)
J. Security failure | Prompt regex deny → REQUIRE_HUMAN_APPROVAL pre-run only | Halt before execution | No | No (safe halt) | Yes
K. Infrastructure failure (npm broken) | Gate returns false → BLOCK | None | No | No | Yes
L. Ambiguous state | Undefined | Undefined | No | n/a | n/a

Missing deterministic states to add in v0.2: `INFRA_FAILURE` (E/F), `GATE_FAILURE` as distinct evidence result with repair budget (H), `SESSION_LOST` (stale `-s`), and an explicit `AMBIGUOUS` bucket (worker exit 0 but zero file changes detected — cheap proxy: `git status --porcelain` empty after a code mission).

---

## 6. Safety Boundary Audit

Threat | Existing safeguard (mapped to MIA mechanisms) | Gap
---|---|---|
Modify unrelated files | Prompt discipline; post-hoc human `git diff` review; QA/Godzilla gates on the outer mission | No per-mission path allowlist; no automated `git status/diff` snapshot in evidence; OpenCode built-in agents run with broad tool permissions (observed `'*'` allow patterns via `opencode agent list`)
Change architecture without approval | Governance manifests + CTO/Architect council (AGENTS §23.5); Subaru blueprint freeze | Loop itself never checks a manifest before running; a bare `runMission()` needs no governance artifact
Change DB schema | Deny-regex `supabase db reset/push`, `DROP TABLE/DATABASE` (`run-loop.ts:37-38`); RLS + admin-client conventions | Regex inspects **prompt text**, not worker actions; paraphrases bypass it
Modify governance / checkpoints | Deny-regex on `.governance/` and `docs/checkpoints/` edits in prompt (`run-loop.ts:39-40`); Subaru drift detection blocks manual checkpoint edits | Same prompt-only weakness
Weaken tests / disable security checks | Gates re-run AFTER worker (TEST 8b forbids COMPLETE without them); Godzilla adversarial gate on outer mission | Nothing prevents the worker from editing test files to match broken code within the same run — only outer-mission review catches this
Touch secrets (.env) | Deny-regex `.env` write/edit (`run-loop.ts:41`); secret-scan in Subaru CLI commands | Prompt-level only
Deploy production | Deny-regex `vercel (--prod|deploy)` (`run-loop.ts:36`); deploy exclusively owned by Release Manager checklist | Adequate for v0.1 scope
Delete data | `DROP` regex; Supabase RLS | Prompt-level only
Unlimited scope expansion | Bounded attempt count; single-task prompts | No diff-size or time budget
Retry forever | Structurally impossible inside `runMission` (bounded loops only) | External caller could invoke repeatedly; no cross-invocation budget

Honest summary: v0.1's safety posture = **pre-execution prompt filtering + post-execution gates + human-owned outer workflow**. There is no behavioral sandbox between those two points beyond what OpenCode itself enforces.

---

## 7. Termination Audit

Guard | Present? | Detail
---|---|---|
Maximum attempts | ✅ | `maxPrimaryAttempts` default 2 (`run-loop.ts:107`), bounded `for` (`:188`)
Repeated-error threshold | ✅ | RepeatedErrorRule fires on >1 identical signal (`signals.ts:36-41`)
Model-switch limit | ✅ (hardcoded) | Exactly one escalation path; fallback failure → immediate BLOCK (`run-loop.ts:168`)
Mission timeout | ⚠️ Partial | Per-attempt 600s only; no whole-mission wall clock (worst case ≈ 3×10min + gates — finite but unbounded by parameter)
Checkpoint expiration | ❌ | Subaru has no TTL; a blocked checkpoint can sit indefinitely (acceptable: human owns revival)
Retry budget | ⚠️ | Attempt count yes; token/cost budget **no** (`opencode` stats unused)
Token/resource budget | ❌ | Nothing captures cost from `--format json` stream
Escalation condition | ✅ | Deterministic: STUCK or steps exhausted
Terminal BLOCK condition | ✅ | Fallback non-SUCCESS, gate failure, or fallback-stuck — all terminate
`while(true)` possibility | ❌ none | No unbounded constructs in `workshop/loop/*` (inspected at f54d590)

Missing for v0.2: whole-mission deadline parameter, cross-invocation retry counter (persisted in evidence dir), and token-cost capture from the JSON stream already being read.

---

## 8. Self-Improvement Maturity Model (Inventory example)

Level | Definition | Status | Evidence
---|---|---|---|
0 — Observation | Detect inconsistency in subsystem data | **Partial** | Inventory `predictions` module produces analytics, but no invariant checker feeds anomalies anywhere; loop observes only its own attempts
1 — Diagnosis | Root-cause the anomaly | Missing | Council heuristics diagnose audits; nothing diagnoses inventory data
2 — Proposed fix | Generate candidate correction | Primitive exists | LLM workers generate fixes by construction (`opencode run`); no structured proposal artifact
3 — Isolated implementation | Work in sandbox separate from main tree | Missing | Loop executes in shared cwd; no branch/worktree management
4 — Validated candidate | Gates + invariants on the candidate | Partial | Gates validate whatever is in the tree, not an isolated candidate; Playwright not wired into loop gates
5 — Governed promotion | Promote through governance with rollback | Exists for code (human-driven: manifests, council, Release Manager); missing for data mutations (inventory corrections would be DB writes with no pipeline)
6 — Autonomous continuous improvement | Closed loop 0→5 without humans | **Not claimed, not present**

What v0.1 actually contributed: Level 2–4 primitives for *code* missions (generation, execution, validation) plus the escalation skeleton. The distance to Level 6 is not incremental — Levels 0, 1, 3 and governed data-promotion do not exist at all.

---

## 9. Minimal v0.2 Proposal — "Accountable Handoff"

Smallest safe next milestone: make every escalation **governance-visible, forensically honest, and crash-aware**. Estimated delta ≈ 80–120 LOC + tests, reusing Subaru, governance WorkflowEngine, Council RepeatedErrorRule, and the existing runner untouched.

1. **Hard-required accountability (fixes D1)**: `deps.subaru` becomes mandatory when escalating; remove `?.`. If `subaruTaskId` has no live checkpoint, `checkpointEscalation` surfaces the CLI failure and the mission BLOCKs with `ESCALATION_UNRECORDED`. No silent evidence fiction.
2. **Governance precondition**: `runMission` accepts `governanceTaskId` and refuses to start unless `.governance/tasks/<id>.json` is `approved` (reuse WorkflowEngine read path already used by Subaru freeze). Closes "loop runs outside governance."
3. **Crash awareness (fixes taxonomy E/F)**: `classifyRun` gains `INFRA_FAILURE` when `status === null` or spawn error code ∈ {ENOENT, EACCES}; INFRA_FAILURE skips retry-by-worker and BLOCKs immediately with actionable reason.
4. **Gate repair round (fixes D2, minimal)**: exactly ONE repair cycle on gate failure — failing-gate names + summary appended via `buildContinuationPrompt` to the SAME session's last worker; second gate failure stays terminal BLOCK.
5. **Forensic diff snapshot**: after each worker run, `git status --porcelain` captured into the evidence entry (telemetry only, no enforcement yet). Cheap foundation for future scope boundaries.
6. **Mission wall-clock**: `deadlineMs` parameter enforced around the entire `runMission`.

Explicitly NOT in v0.2: dynamic model pools, token budgets, rollback automation, diff allowlists, self-improvement levels 0/1/3, any Sales-domain change, any deployment capability.

## 10. v0.2 Test Matrix (design only)

# | Given | When | Then | Evidence
---|---|---|---|---
T1 | Approved manifest + healthy fake runner SUCCESS | runMission | COMPLETE, gates recorded | evidence result=COMPLETE, gate_results all true
T2 | Nemotron FAILURE×2 (fake) + gateway fake | loop escalates | real-shaped `subaru:block` called once (hard dep now), fallback SUCCESS → gates | gateway spy assertion (was optional in v0.1)
T3 | Same as T2 | inspect continuation | same session id threaded; prompt contains CONTINUATION CONTEXT | evidence session_id equality
T4 | Runner throws timeout | classify | TIMEOUT then STUCK after 2 | signals unit
T5 | status=null (crash stub) | classify | INFRA_FAILURE, zero retries, immediate BLOCK | new unit
T6 | ENOENT stub | runMission | BLOCK reason mentions OpenCode unavailable, no fallback attempt | new unit
T7 | Exit 0, empty porcelain | runMission (code mission) | AMBIGUOUS flagged in evidence (telemetry), gates still decide | new unit
T8 | Gates fail once, repair succeeds | runMission | exactly 1 extra same-worker run with gate context, then COMPLETE | repair-budget assertion
T9 | Gates fail twice | runMission | terminal BLOCK listing both rounds | repair-budget assertion
T10 | No manifest / manifest=rejected | runMission | refuses BEFORE any runner call | precondition unit
T11 | Deadline exceeded mid-attempt | runMission | BLOCK `DEADLINE_EXCEEDED` | timer fake
T12 | Stale `-s` (stderr session-not-found stub) | runMission | SESSION_LOST → continue without `-s` | new unit
T13 | Property: random signal sequences | runMission | always terminates in {COMPLETE,BLOCK,REQUIRE_HUMAN_APPROVAL} with ≤3 runner calls | fuzz-style unit (kills while(true) class)
Real-integration drills (manual, like v0.1): R1 success path; R2 forced outage handoff WITH real `subaru block` on a scratch checkpoint created by the drill (fixes the D1 blind spot in live evidence).

## 11. Scorecard

Dimension | Score | Justification (evidence-weighted)
---|---|---|
Worker Integration | 75 | Both models real-proven incl. same-session switch; crash/infra conflation and prompt-only selection cap it
State Durability | 70 | Subaru freeze/mark/complete/block battle-tested across machines; but loop→Subaru link never fired live (**D1**)
Failure Detection | 55 | SUCCESS/FAILURE/TIMEOUT/STUCK solid; E,F,G,L undetected or conflated
Recovery | 50 | Context-carrying handoff works; no repair round (**D2**), no rollback, dirty-tree risk
Governance | 45 | Outer workflow excellent; loop itself bypassable (no manifest precondition)
Safety | 40 | Pre-filter + gates + human ownership exist; zero behavioral verification between them
Termination | 65 | Structurally impossible to spin forever; missing wall-clock/budget parameters
Observability | 60 | 11-field JSONL with committed specimens; no costs/tokens/diff telemetry
Testing | 70 | 13 deterministic tests incl. safety-ordering and session-resume; real-drill coverage manual and one-shot
Autonomy | 30 | Correctly low: supervised single-shot executor; humans own creation/approval/scope/promotion
**Overall** | **56/100** | Honest midpoint between "proven handoff" and "autonomous system"

## 12. Final Decision

# READY_FOR_V0_2

- **Already proven**: deterministic routing, real two-model same-session handoff, STUCK via reused Council rule, bounded termination, gate-decided completion, resumable evidence — all at f54d590 with live artifacts.
- **Still missing**: mandatory escalation recording (D1), governance precondition, crash/session/malformed taxonomy, gate repair round, mission-level budgets, any post-run behavioral telemetry.
- **Single smallest next step**: implement §9 items 1–3 only ("hard-required Subaru gateway + governance precondition + INFRA_FAILURE") as TASK v0.2a under a fresh governance classification; items 4–6 follow as v0.2b. Each is small, deterministic, and testable with existing fakes.
- **MUST NOT be built yet**: dynamic model pools, autonomous schema/data mutation, rollback automation, production deployment triggers, diff-enforcement sandboxes, any Level-6 self-improvement claim, and any second orchestration framework. Everything needed fits inside `workshop/loop/` + Subaru + governance as they exist today.
