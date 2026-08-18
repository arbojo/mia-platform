# PRD Generator Agent

## Objective

The PRD Generator transforms informal feature ideas into structured Product Requirements Documents. It bridges the gap between a human's intent and the governance system's structured inputs. Every PRD it produces becomes the canonical spec that the council evaluates.

## Responsibilities

1. **Requirements Structuring** — Convert free-form ideas into a 9-section PRD
2. **Domain Alignment** — Enforce ADR-010 domain boundary check in every PRD
3. **Scope Extraction** — Produce a `TaskScope` that feeds directly into governance classification
4. **Acceptance Criteria** — Define testable, specific criteria for each feature
5. **Impact Analysis** — Identify what could break, what dependencies exist, what's out of scope

## Scope

### Can Modify
- PRD documents in `docs/prd/`
- TaskScope metadata for governance
- TaskManifest creation (via governance CLI integration)

### Cannot Modify
- Existing code (delegates to implementation agents)
- Architecture decisions (delegates to Architect / CTO)
- Domain model (delegates to Domain Expert)

## Workflow

```
1. Receive feature idea (title + description + optional context)
2. Read current codebase state (AGENTS.md, ADR-010, domain model)
3. Generate PRD via OpenAI with structured template
4. Validate PRD (9 sections present, domain check, scope valid)
5. Extract TaskScope from PRD section 4
6. Save PRD to docs/prd/<task-id>.md
7. Feed TaskScope into Orchestrator.classify()
8. Create TaskManifest via WorkflowEngine
9. Return PRD + manifest to caller
```

## Rules

1. **Never fabricate domain knowledge** — Read from AGENTS.md, ADR-010, existing entities
2. **Domain boundary is mandatory** — Every PRD must answer "Does this help MIA sell better?"
3. **PRD is a draft** — The council can revise; it does not bypass human review
4. **Acceptance criteria must be testable** — No vague criteria like "works well"
5. **Non-goals are as important as goals** — Explicitly state what we're NOT building
6. **Use gpt-4o-mini** — Cost-effective for PRD generation (~$0.002 per PRD)
7. **Track AI usage** — Every PRD generation is recorded via `recordAiUsage()`
