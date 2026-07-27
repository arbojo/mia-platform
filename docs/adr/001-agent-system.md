# ADR-001: Specialized Engineering Agent System

## Status

Accepted

## Date

2026-07-26

## Context

MIA is growing from a single-developer project into a platform that requires disciplined engineering practices. As the codebase expands and more features are added, the risk of:

- Architectural drift
- Domain model inconsistency
- Technical debt accumulation
- Quality regressions
- Security vulnerabilities

increases significantly. The project needs a systematic approach to ensure every change is properly analyzed, designed, implemented, and verified before reaching the repository.

## Decision

Implement a specialized engineering agent system with 9 distinct roles:

1. **Architect** — Technical strategy and architecture decisions
2. **Domain Expert** — Business domain model guardian
3. **Product Manager** — User experience protector
4. **Database Engineer** — Schema authority and migration management
5. **Backend Engineer** — API routes and business logic
6. **Frontend Engineer** — UI components and pages
7. **AI Engineer** — Prompts, context, and AI systems
8. **QA Engineer** — Quality verification and testing
9. **Release Manager** — Git operations and repository integrity

### Workflow

Every task must follow this mandatory workflow:

```
Architect → Domain Expert → Product Manager → Database → Backend → Frontend → AI Engineer → QA → Release
```

### File Structure

```
.agents/
├── architect.md
├── domain-expert.md
├── product-manager.md
├── database.md
├── backend.md
├── frontend.md
├── ai-engineer.md
├── qa.md
└── release.md
```

## Consequences

### Positive

1. **Clear Responsibilities** — Each agent has defined scope and authority
2. **Quality Gates** — No code reaches production without passing all gates
3. **Domain Protection** — Domain Expert prevents concept drift
4. **Architecture Integrity** — Architect prevents complexity accumulation
5. **Security** — Release Manager prevents secrets from being committed
6. **Living Documentation** — Agent files evolve with the project

### Negative

1. **Process Overhead** — Each task requires more steps
2. **Learning Curve** — Agents must understand their roles
3. **Coordination** — Agents must collaborate effectively

### Mitigations

1. **Automation** — QA checks can be automated
2. **Documentation** — Agent files serve as reference
3. **Clear Handoffs** — Workflow defines delegation rules

## Alternatives Considered

### Alternative 1: No Agent System
- **Pros**: No process overhead
- **Cons**: High risk of quality issues, architectural drift, technical debt
- **Decision**: Rejected — risk too high for a growing platform

### Alternative 2: Single QA Agent
- **Pros**: Simple process
- **Cons**: No domain protection, no architecture oversight, limited expertise
- **Decision**: Rejected — insufficient for platform complexity

### Alternative 3: External Code Review
- **Pros**: Independent review
- **Cons**: Slow feedback loop, expensive, not continuous
- **Decision**: Rejected — not practical for rapid development

## References

- `AGENTS.md` — Main agent guide
- `.agents/` — Agent documentation
- `docs/adr/` — Architecture Decision Records
