# MIA Platform — Agent Guide

This file is the permanent reference for any AI agent (OpenCode or others) working on this repository. It defines the project's purpose, architecture, rules, and quality standards. Every new feature, fix, or refactor must respect these guidelines.

---

## 1. What is MIA?

MIA is **not** a chatbot. It is an **AI sales assistant platform** that enables businesses to:

- **Learn** a business through structured knowledge, products, and rules
- **Conversate** with customers in natural language
- **Remember** interactions, preferences, and context over time
- **Train** through simulation and correction workflows
- **Operate** across multiple channels from one intelligent core

The platform is designed as a future SaaS multi-tenant product. The first client is Vitanova (the team's own business), which serves as the live test environment.

**Core philosophy**: MIA should feel like **hiring and training a new employee**, not configuring software.

### Domain Boundary

MIA is a **Conversational Sales Intelligence** platform. Its responsibility begins when a conversation with a customer starts. Its responsibility ends when:

1. The sale is closed or discarded,
2. Customer data is structured,
3. Sales Intelligence events are emitted.

MIA does **not** perform operational, logistical, or administrative tasks. No inventory, no billing, no routing, no collections, no ERP. See [ADR-010](docs/adr/010-sales-domain-boundary.md) for the complete domain boundary definition.

---

## 2. Agent System

MIA uses a **specialized engineering agent system** with 17 distinct roles. The Orchestrator is the entry point for all development requests, analyzing and coordinating which agents participate.

### 2.1 Agent Roster

| Agent | File | Responsibility |
|-------|------|----------------|
| **Orchestrator** | `.agents/orchestrator.md` | **Entry point**: analyzes requests, classifies complexity, selects required agents, coordinates workflow |
| CTO | `.agents/cto.md` | Highest technical authority, strategic decisions |
| Infrastructure Bootstrap | `.agents/infrastructure-bootstrap.md` | Environment preparation, tool installation, machine setup |
| Infrastructure Guardian | `.agents/infrastructure-guardian.md` | Environment validation, toolchain integrity, infrastructure memory, auto diagnosis |
| Architect | `.agents/architect.md` | Tactical design, architecture decisions |
| Domain Expert | `.agents/domain-expert.md` | Business domain model guardian |
| Product Manager | `.agents/product-manager.md` | User experience protector |
| Database Engineer | `.agents/database.md` | Schema authority, migrations |
| Backend Engineer | `.agents/backend.md` | API routes, business logic |
| Frontend Engineer | `.agents/frontend.md` | UI components, pages |
| AI Engineer | `.agents/ai-engineer.md` | Prompts, context, AI systems |
| Performance Engineer | `.agents/performance-engineer.md` | Performance, scalability, cost optimization |
| Security Engineer | `.agents/security-engineer.md` | Data protection, platform integrity |
| Analytics Engineer | `.agents/analytics-engineer.md` | Feature measurability, metrics |
| QA Engineer | `.agents/qa.md` | Quality verification, testing |
| Release Manager | `.agents/release.md` | Git operations, repository integrity |
| **Memory Engineer** | `.agents/memory-engineer.md` | Engineering memory: decisions, incidents, patterns, lessons |

### 2.2 Mandatory Workflow

Every task must follow this workflow:

```
G. Governance Gate (MANDATORY — see Section 23)
   ↓
0. Orchestrator (analyzes request, classifies complexity, selects agents)
   ↓
1. Infrastructure Bootstrap (environment preparation, tool installation)
   ↓
2. Infrastructure Guardian (environment validation, toolchain integrity)
   ↓
3. CTO (strategic approval for major features)
   ↓
4. Architect (analyze, design, propose)
   ↓
5. Domain Expert (validate domain consistency)
   ↓
6. Product Manager (validate user value)
   ↓
7. Database Engineer (if schema changes needed)
   ↓
8. Backend Engineer (APIs, logic, integrations)
   ↓
9. Frontend Engineer (UI components, pages)
   ↓
10. AI Engineer (if AI features involved)
   ↓
11. Performance Engineer (performance and cost review)
   ↓
12. Security Engineer (security review)
   ↓
13. Analytics Engineer (measurement strategy)
   ↓
14. QA Engineer (lint, build, Playwright, DevTools)
   ↓
15. Release Manager (git verification, commit, push, final report)
```

**No agent may skip this workflow.** The Governance Gate (G) MUST be the first action before ANY code modification. See Section 23 for complete governance enforcement rules.

### 2.3 Evidence First Pre-Audit

Every agent **must** execute the Evidence First protocol (see Section 22) **before** their domain-specific analysis. This protocol ensures every conclusion is based on the current repository state, not conversation memory or previous audits.

```
Before EACH agent's analysis:
  ┌──────────────────────────────────────┐
  │  Evidence First Pre-Audit:           │
  │  · Read HEAD                         │
  │  · Read git diff from last audit     │
  │  · Load previous findings            │
  │  · Re-validate against current code  │
  │  · Mark resolved/superseded findings │
  │  · Document evidence for each claim  │
  └──────────────────────────────────────┘
                    ↓
  ┌──────────────────────────────────────┐
  │  Agent-specific analysis             │
  │  (domain logic, unchanged)           │
  └──────────────────────────────────────┘
```

The Orchestrator verifies evidence compliance before accepting any agent's output. Findings without evidence (file:line, snippet, commit hash) are rejected.

### 2.4 Guardian Agents

Certain agents hold **guardian authority** — the power to block progress when their domain is at risk:

| Guardian | Authority | Can Block |
|----------|-----------|-----------|
| **CTO** | May reject implementations that introduce unnecessary complexity or violate platform architecture | Large features, architectural changes |
| **Infrastructure Guardian** | May block development when environment inconsistencies, toolchain issues, or misconfigurations are detected. Maintains environment baseline and auto-diagnoses errors. | Development sessions with broken environments |
| **Security Engineer** | May block releases if security risks are detected | Any release with security vulnerabilities |
| **Performance Engineer** | May request optimization before release when measurable performance or cost improvements exist | Releases with known performance issues |
| **QA Engineer** | May block releases if quality gates fail | Releases that fail lint, build, or tests |
| **Release Manager** | May refuse deployment if any guardian has unresolved blocking issues | Any deployment |

### 2.5 Agent Rules

#### CTO Rules
- Never writes implementation code
- Evaluates major features before implementation
- Challenges assumptions before coding
- Can stop implementation and request redesign
- Approves large features (6+ files) before implementation

#### Infrastructure Bootstrap Rules
- Prepares machine before any development session begins
- Reads baseline and developer profile before installing anything
- Requests confirmation before any system modification
- Auto-installs only npm dependencies and Playwright browsers
- Recommends (never auto-installs) OpenCode and elevated-permission tools
- Never modifies secrets or environment variable values
- Never upgrades major versions without explicit approval
- Never executes destructive commands
- Generates setup report for every full setup
- Runs in `--check` mode when only validation is needed

#### Infrastructure Guardian Rules
- Validates environment before any development session
- Blocks development when environment is broken
- Never allows code changes on inconsistent environments
- Detects drift between local and expected state
- Recommends `npm run doctor` for full health check
- Recommends `npm run environment-check` for quick validation
- Maintains `.infrastructure/baseline.json` as the Golden Baseline (ideal environment reference)
- Maintains environment fingerprint (package hashes, versions, OS)
- Auto-diagnoses errors and delegates to the responsible agent
- Uses 4-level drift classification: None, Minor, Moderate, Major

#### Architect Rules
- Must analyze before coding
- May reject implementations if simpler alternatives exist
- Must explain plans for large changes
- Never assumes initial proposal is best
- Documents decisions in `docs/adr/`
- Must consult CTO for large features

#### Domain Expert Rules
- Knows all 15 domain entities
- Validates domain consistency
- Prevents concept duplication
- Protects model integrity
- Never merges distinct concepts (Products ≠ Knowledge, AI Instructions ≠ Knowledge)

#### Product Manager Rules
- Asks: "Does this add value?"
- Asks: "Is there a simpler way?"
- Asks: "Are we adding unnecessary complexity?"
- Prioritizes simplicity over power
- Rejects features that require technical knowledge to use

#### Database Engineer Rules
- Only one authorized to modify schema
- Incremental migrations only
- Never modify applied migrations
- Enforces RLS and multi-tenant
- Documents all schema changes

#### Backend Engineer Rules
- Reuses existing functions
- Handles errors properly
- Uses correct Supabase client (admin for writes, server for reads)
- Tracks AI usage
- Validates all inputs

#### Frontend Engineer Rules
- Server Components by default
- No business logic in UI
- Components <150 lines
- Uses shadcn/ui
- Accessible and responsive

#### AI Engineer Rules
- Never hardcodes knowledge
- All configurable behavior from DB
- Minimizes token consumption
- Justifies every OpenAI call
- Per-customer memory isolation

#### Performance Engineer Rules
- Always justifies optimization suggestions
- Prefers measurable improvements
- Never optimizes prematurely unless cost or scalability justify it
- Reviews token consumption, query count, render count, API latency, bundle size

#### Security Engineer Rules
- Security issues block release
- Never exposes sensitive information
- Never allows cross-tenant access
- Always verifies least-privilege access
- Reviews RLS, auth, authorization, injection, XSS, CSRF, secrets

#### Analytics Engineer Rules
- Avoids collecting unnecessary information
- Prefers actionable metrics
- Every major feature defines success metrics
- Designs events, KPIs, funnels, dashboards

#### QA Engineer Rules
- No task closes without: lint, build, Playwright, DevTools
- Checks console, errors, warnings, failed requests
- No exceptions to quality gates
- Delegates performance to Performance Engineer, security to Security Engineer

#### Release Manager Rules
- Only one who commits/pushes
- Checks git diff, secrets, env vars, repo consistency
- Never allows broken code
- Follows commit format conventions
- Maintains atomic commits
- **Mandatory repository synchronization** — a sprint is NOT complete until code is committed AND pushed to remote

##### Release Manager Mandatory Checklist

Before reporting "Sprint Complete", the Release Manager MUST execute:

**1. Repository Status Verification**
```bash
git status
```
Confirm:
- No unexpected untracked files
- No pending modifications
- Working tree clean

**2. Commit Verification**
Confirm:
- All intended changes are staged and committed
- A descriptive commit exists following commit format conventions
- Commit hash is available

**3. Remote Synchronization**
```bash
git push origin main
```
Confirm:
- Local branch matches remote
- No pending commits behind remote
- Remote contains latest implementation

**4. Final Sprint Report**

The final report MUST include repository state:
```
Commit: <hash>
Branch: main
Remote: origin/main synchronized
Working tree: clean
```

**Rule: A feature that exists only locally is not delivered. Passing lint, build, and tests is NOT sufficient — the code must be committed and pushed.**

---

## 3. Guiding Principles

| Principle | Description |
|-----------|-------------|
| Simplicity first | Prefer simple, proven solutions over complex ones |
| Reuse before create | Always search for existing components and utilities before writing new code |
| Visual consistency | Maintain a unified design language across all interfaces |
| No technical debt | Do not accumulate shortcuts that will need to be resolved later |
| Clean, maintainable code | Write code that is easy to read, understand, and modify |
| Scalable architecture | Every decision should support growth from one tenant to many |
| Strict typing | Use TypeScript properly. No `any`. No implicit types. |
| Never break existing features | Every change must preserve what already works |

---

## 4. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Email/password + Google OAuth via `@supabase/ssr` |
| AI Engine | OpenAI `gpt-4o-mini` via Vercel AI SDK |
| Testing | Playwright (e2e) |
| DevTools | Chrome DevTools MCP |
| Version Control | GitHub |
| Remote | `https://github.com/arbojo/mia-platform.git` |

---

## 5. Architecture

### 5.1 Multi-Tenant Design

The platform is built multi-tenant from day one. All data is scoped to a business through Row Level Security (RLS). The core hierarchy is:

```
Business → Assistants → Customers → Conversations → Messages
```

### 5.2 Domain Model

| Entity | Purpose |
|--------|---------|
| **Business** | Tenant root. Owns everything. |
| **Brand Identity** | Tone, personality, communication style |
| **Knowledge Base** | Free-form contextual info (FAQs, tips, objections) |
| **Knowledge Versions** | Audit trail for all knowledge changes |
| **AI Instructions** | Behavioral rules (separate from knowledge) |
| **Assistants** | Multiple channels share one "brain" per business |
| **Products** | Structured data (name, price, description) |
| **Sales Rules** | Sales-specific rules |
| **Customers** | Commercial memory (phone, city, tags, status) |
| **Assistant Memory** | Conversation memory per customer |
| **Conversations** | Chat sessions |
| **Messages** | Individual messages |
| **Learning Events** | Corrections: pending → approved/rejected/modified |
| **AI Usage** | Token tracking with request_type |
| **Lab Sessions** | Laboratorio MIA simulation sessions |

### 5.3 Key Design Decisions

- **Products** = structured data; **Knowledge** = free-form contextual info
- **AI Instructions** = behavioral rules separate from knowledge
- **Personality** = JSONB with `warmth`, `formality`, `humor`, `sales_aggressiveness` (0-100)
- **Customer entity** = commercial memory, not just a contact
- **Learning Events** = correction flow with 4 states
- **Knowledge Versions** = audit trail for all changes
- **AI Usage** tracking with `request_type` (training/simulation/live_customer)

### 5.4 Critical Rules

> **All new functionality must respect this architecture.** Do not create parallel hierarchies, duplicate data models, or bypass the tenant scoping system.

### 5.5 Auth Flow (RLS 42501 Fix)

**Problem**: Server-side Supabase client does inserts that fail with RLS `42501` because `auth.uid()` returns NULL.

**Root cause**: Auth callback created `NextResponse.redirect()` but cookies set via `cookieStore.set()` were NOT propagated to the redirect response.

**Solution**:
1. `src/lib/supabase/route-handler.ts` — Supabase client factory for Route Handlers that sets cookies on Response object
2. `src/app/(auth)/auth/callback/route.ts` — Uses route-handler client, propagates cookies in Response before redirect
3. All server-side writes use `admin.ts` (bypasses RLS)

**Rule**: Any Route Handler that does writes must use the admin client. Read-only routes can use the server client.

---

## 6. Sales Domain Boundary

MIA's domain is strictly limited to **Conversational Sales Intelligence**. This boundary is formalized in [ADR-010](docs/adr/010-sales-domain-boundary.md).

### 6.1 What MIA Does (In Domain)

| Area | Description |
|------|-------------|
| Conversation | Natural dialogue across channels |
| Rapport | Emotional connection and trust building |
| Need Discovery | Uncover customer pain points and desires |
| Product Presentation | Show products aligned to discovered needs |
| Objection Handling | Address and resolve customer objections |
| Closing | Guide toward commitment |
| Customer Recovery | Re-engage inactive or lost customers |
| Intelligent Follow-up | Timely, context-aware re-contact |
| Consultative Selling | Act as advisor, not order-taker |
| Upselling / Cross-selling | Offer premium or complementary products |
| Data Capture | Structure customer-provided information |
| Sales Events | Generate Sales Intelligence events |

### 6.2 What MIA Does NOT Do (Out of Domain)

MIA **must never** perform:
- ERP operations (purchase orders, supplier management)
- Inventory control (stock tracking, warehouse management)
- Route calculation or delivery logistics
- Driver or personnel management
- Payment collection or processing
- Invoice generation or billing
- Financial reconciliation
- Operational dashboards for logistics, inventory, or finance

### 6.3 Integration Model

MIA communicates with external systems exclusively through **Sales Intelligence events**:

```
SALE_STARTED, PRODUCT_SELECTED, OBJECTION_DETECTED, OBJECTION_RESOLVED,
UPSELL_ACCEPTED, CROSSSELL_ACCEPTED, FOLLOWUP_REQUIRED,
SALE_WON, SALE_LOST, CUSTOMER_HESITATION,
PRICE_ACCEPTED, PRICE_REJECTED
```

MIA emits events. External systems (ERP, CRM, billing, logistics) consume them. MIA never calls external operational APIs directly.

### 6.4 Boundary Test

Every feature must pass this test:

> **"Does this help MIA sell better?"**

If the answer is no, the feature belongs to another domain.

---

## 7. Project Structure

```
mia/
├── AGENTS.md                    # This file — agent guide
├── .agents/                     # Specialized agent documentation
│   ├── cto.md
│   ├── architect.md
│   ├── domain-expert.md
│   ├── product-manager.md
│   ├── database.md
│   ├── backend.md
│   ├── frontend.md
│   ├── ai-engineer.md
│   ├── performance-engineer.md
│   ├── security-engineer.md
│   ├── analytics-engineer.md
│   ├── qa.md
│   └── release.md
├── docs/
│   └── adr/                     # Architecture Decision Records
├── opencode.json                # OpenCode config (Chrome DevTools MCP)
├── playwright.config.ts         # Playwright e2e config
├── tests/
│   └── public.spec.ts           # E2E tests
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql   # Core schema (15 tables + RLS)
│       └── 002_lab_sessions.sql     # Lab sessions + request_type
├── src/
│   ├── middleware.ts             # (unused, see proxy.ts)
│   ├── proxy.ts                  # Next.js 16 middleware — refreshes auth tokens
│   ├── app/
│   │   ├── (auth)/              # Auth pages (login, signup, callback)
│   │   ├── dashboard/           # Main app
│   │   │   ├── page.tsx         # Dashboard home
│   │   │   ├── layout.tsx       # Auth guard + sidebar + onboarding banner
│   │   │   ├── onboarding/      # 4-step wizard
│   │   │   ├── assistants/      # List + [id] detail
│   │   │   │   └── [id]/
│   │   │   │       ├── products/    # ProductsManager CRUD
│   │   │   │       ├── rules/       # RulesManager CRUD
│   │   │   │       └── training/    # Chat training interface
│   │   │   └── laboratorio/     # Simulation lab
│   │   └── api/
│   │       ├── chat/route.ts    # Streaming chat with OpenAI
│   │       └── laboratorio/     # 5 API routes (context, sessions, analyze, evaluate, teach)
│   ├── components/
│   │   ├── chat/ChatWindow.tsx  # WhatsApp-style chat with mode/simulation props
│   │   ├── dashboard/           # Sidebar, OnboardingBanner
│   │   ├── laboratorio/         # 7 components
│   │   └── onboarding/          # OnboardingWizard
│   └── lib/
│       ├── ai/
│       │   ├── client.ts        # OpenAI singleton, MODEL='gpt-4o-mini', TOKEN_COSTS
│       │   ├── prompts.ts       # Master prompt builder
│       │   └── knowledge.ts     # getBusinessContext(), recordAiUsage()
│       └── supabase/
│           ├── client.ts        # Browser client (createBrowserClient)
│           ├── server.ts        # Server client
│           ├── admin.ts         # Admin client (bypasses RLS)
│           └── route-handler.ts # Route Handler client
```

---

## 8. Development Rules

The agent **must always**:

1. **Search for existing components** before creating new ones
2. **Search for reusable utilities** before duplicating logic
3. **Respect the folder structure** defined in this document
4. **Write modular code** — one responsibility per component/function
5. **Write strict TypeScript** — no `any`, no implicit types, no escape hatches
6. **Keep components small** — if a component exceeds ~150 lines, split it
7. **Separate logic from UI** — business logic in `lib/`, UI in `components/`
8. **Use Server Components by default** — only use Client Components when interactivity is required
9. **Avoid unnecessary global state** — prefer local state and server data
10. **Never introduce regressions** — every change must preserve existing behavior

---

## 9. Database Rules

1. **Never modify applied migrations.** Once a migration is run, it is immutable.
2. **Schema changes go through new migrations only.** Create a new file in `supabase/migrations/`.
3. **Never delete existing columns** without explicit authorization.
4. **Always respect Row Level Security (RLS).** Every table must have appropriate policies.
5. **Always maintain multi-tenant compatibility.** All data must be scoped to a business.
6. **Use the admin client** for server-side writes that bypass RLS (per auth flow rules).

---

## 10. API Rules

All API routes (`src/app/api/`) must:

1. **Validate inputs** — reject invalid data with clear error messages
2. **Handle errors** — catch exceptions, return appropriate HTTP status codes
3. **Return consistent responses** — use a standard shape for success and error
4. **Avoid duplicate logic** — use shared functions from `src/lib/`
5. **Use the correct Supabase client** — admin for writes, server for reads
6. **Track AI usage** when applicable — call `recordAiUsage()` for token tracking

---

## 11. Components

1. **Server Components by default** — only mark as Client (`'use client'`) when needed for interactivity
2. **Client Components only when necessary** — for state, effects, event handlers, or browser APIs
3. **Avoid unnecessary global state** — prefer React context, server state, or local state
4. **Keep components reusable** — extract shared patterns into shared components
5. **Follow existing patterns** — look at how similar components are built before creating new ones
6. **Use shadcn/ui** — do not create custom UI primitives when shadcn provides them

---

## 12. Artificial Intelligence

### 12.1 Prompt Management

1. **Never hardcode prompts.** All prompts must be built through reusable functions.
2. **Separate concerns** into distinct layers:

| Layer | Responsibility | Location |
|-------|---------------|----------|
| Prompt Builder | Assembles the final system prompt | `src/lib/ai/prompts.ts` |
| Context Builder | Fetches and structures data from DB | `src/lib/ai/knowledge.ts` |
| Knowledge Assembly | Combines knowledge base, products, rules | Within context builder |
| Evaluation | Scores assistant responses | `src/app/api/laboratorio/` |
| Simulation | Generates customer behavior | `src/app/api/laboratorio/` |

3. **Context must be built exclusively from database data.** Never invent information.
4. **Never fabricate products, rules, or knowledge** that does not exist in the database.

### 12.2 AI Usage

- Model: `gpt-4o-mini` (via OpenAI)
- All AI calls must be tracked via `recordAiUsage()` with `request_type` (training/simulation/live_customer)
- Token costs are defined in `src/lib/ai/client.ts`

---

## 13. Laboratorio MIA

The Laboratorio is an **internal simulation tool**. It must:

- **Never affect real customer conversations**
- **Simulate customers** with different difficulty modes
- **Analyze responses** against defined criteria
- **Evaluate performance** with scores (1-10 scale)
- **Enable training** through correction and teaching flows
- **Track token consumption** per session

### Simulation Modes

| Mode | Emoji | Behavior |
|------|-------|----------|
| Normal | 🟢 | Standard customer |
| Indeciso | 🟡 | Hesitant, needs persuasion |
| Complicado | 🔴 | Difficult, asks many questions |
| Cliente Exigente | 💀 | Demanding, high expectations |

### Response Analysis Criteria

Each response is evaluated on a 1-10 scale:

- **Product Knowledge** — Accuracy and depth of product info
- **Empathy** — Emotional intelligence and rapport
- **Objection Handling** — How well objections are addressed
- **Closing** — Ability to guide toward sale
- **Rule Following** — Adherence to business rules/instructions

---

## 14. Quality Checklist

Before completing any task, the agent **must**:

1. **Run lint** — `npm run lint` (0 errors, 0 warnings)
2. **Run build** — `npm run build` (no errors)
3. **Run Playwright tests** — `npm test`
4. **Run Chrome DevTools MCP** — check console and network
5. **Fix all errors found** — do not leave known errors unresolved
6. **Verify git status** — `git status` confirms clean working tree after commit
7. **Verify remote sync** — `git push origin main` succeeds
8. **Do not deliver code with known issues**

### Available Commands

```bash
npm run dev          # Next.js dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint (must be 0 errors, 0 warnings)
npm test             # Playwright e2e tests
npm run test:ui      # Playwright UI mode
npm run test:report  # Playwright HTML report
```

---

## 15. Git Conventions

1. **Work in branches** for significant new features
2. **Write small, descriptive commits**
3. **Never mix multiple large features** in a single commit
4. **Never commit secrets** or credentials

### Commit Format

```
feat: add customer export functionality
fix: resolve auth redirect cookie propagation
refactor: extract prompt builder into separate module
docs: update AGENTS.md with new architecture rules
chore: update dependencies
```

### Branch Naming

```
feat/customer-export
fix/auth-redirect
refactor/prompt-builder
```

---

## 16. Before Implementing a New Feature

The agent must follow this process:

1. **Analyze existing architecture** — understand the current design
2. **Identify reusable components** — search for what already exists
3. **Propose the simplest solution** — minimize complexity
4. **Minimize changes** — touch only what is necessary
5. **Maintain compatibility** — do not break existing functionality
6. **Implement** — write clean, typed, modular code
7. **Verify** — test the feature manually if possible
8. **Run quality checks** — lint, build, Playwright tests, DevTools
9. **Commit and push** — git status clean, commit, push to remote
10. **Report changes** — summarize what was done and why

---

## 17. Code Style

1. **Prioritize readability** over clever code
2. **Avoid large functions** — split when logic grows complex
3. **Use descriptive names** — variables, functions, components should be self-documenting
4. **Document only when it adds value** — do not over-comment obvious code
5. **Remove dead code** — do not leave unused imports, variables, or functions
6. **No temporary comments** — do not leave TODOs, FIXMEs, or placeholder comments unless tracking a known issue
7. **Follow existing conventions** — mimic the style of surrounding code

---

## 18. Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server (port 3000) |
| `npm run build` | Production build (TypeScript + static generation) |
| `npm run lint` | ESLint (must pass with 0 errors, 0 warnings) |
| `npm test` | Run Playwright e2e tests |
| `npm run test:ui` | Playwright interactive UI mode |
| `npm run test:report` | Generate Playwright HTML report |

---

## 19. Final Objective

Every decision made on this project must answer this question:

> **"Does this make MIA Platform easier to maintain, more scalable, and more useful for its users?"**

If the answer is no, find a better solution.

---

## 20. Current State

### Working
- Auth (email + Google OAuth)
- Dashboard with sidebar navigation
- Onboarding wizard (4 steps)
- Products and Rules CRUD
- Training chat interface
- Laboratorio MIA (simulation lab with modes, analysis, evaluation, teach flow)
- Playwright tests
- Chrome DevTools MCP configured
- Domain boundary documented (see ADR-010)
- Evidence First protocol documented (see ADR-011)

### Known Issues
- User must log out and re-login after certain auth changes (session refresh)

### Pending
- More comprehensive e2e tests
- Laboratorio billing integration (premium feature) — deferred per ADR-010 (billing is out of domain)
- Full end-to-end verification of onboarding flow
- Sales Intelligence event system (required by ADR-010 for all external integrations)

---

## 21. Architecture Decision Records

Important architectural decisions are documented in `docs/adr/`. Each ADR follows this format:

- **Status**: Proposed, Accepted, Deprecated, Superseded
- **Date**: When the decision was made
- **Context**: Why the decision was needed
- **Decision**: What was decided
- **Consequences**: What are the trade-offs

### Current ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [001](docs/adr/001-agent-system.md) | Specialized Engineering Agent System | Accepted |
| [010](docs/adr/010-sales-domain-boundary.md) | MIA Sales Domain Boundary | Accepted |
| [011](docs/adr/011-evidence-first-protocol.md) | Evidence First Protocol | Accepted |
| [013](docs/adr/013-whatsapp-baileys-bridge.md) | WhatsApp Baileys Bridge | Accepted |
| [014](docs/adr/014-conditional-knowledge-media.md) | Conditional Knowledge Media | Accepted |

---

## 22. Evidence First Protocol

The Evidence First protocol is a mandatory pre-audit procedure enforced before any Council agent's analysis. It prevents agents from emitting findings based on conversation context, memory, or stale snapshots. See [ADR-011](docs/adr/011-evidence-first-protocol.md) for the complete specification.

### 22.1 Core Principle

**No conclusion without evidence. No finding without re-validation.**

### 22.2 Finding States

Every finding must have one of these states:

| State | Meaning | Auto-resolution trigger |
|-------|---------|------------------------|
| **OPEN** | Issue confirmed, awaiting work | — |
| **IN_PROGRESS** | Engineer is actively resolving it | — |
| **RESOLVED** | Fixed by a commit | Commit modifies the exact file:line reported |
| **SUPERSEDED** | No longer applicable (file deleted/renamed/refactored) | File removed or renamed in HEAD |
| **INVALIDATED** | Evidence was incorrect or disproven | Agent disproves their own finding |

### 22.3 Evidence Log

Every audit must produce an evidence log. Each finding in the log requires:

| Field | Required | Example |
|-------|----------|---------|
| File path | Yes | `src/lib/runtime/runtime.ts:42` |
| Code snippet | Yes | Minimum 5 lines of context |
| HEAD commit | Yes | `a1b2c3d` |
| Verification method | Yes | `read src/lib/runtime/runtime.ts:38-48` |
| Finding state | Yes | OPEN, RESOLVED, SUPERSEDED |

### 22.4 Pre-Audit Checklist

Before forming any conclusion, each agent must execute:

```
[ ] Read HEAD (git log --oneline -10)
[ ] Read git diff from last audit (git diff HEAD~1 --stat)
[ ] Load previous findings from last audit
[ ] For each previous finding: re-validate against current HEAD
[ ] Mark RESOLVED if commit fixed the issue
[ ] Mark SUPERSEDED if file was removed or renamed
[ ] Mark INVALIDATED if evidence is incorrect
[ ] For each modified file: re-read the current version
[ ] Document evidence for each new finding
[ ] Emit only findings that currently exist
```

### 22.5 Orchestrator Enforcement

The Orchestrator **must reject** any agent output that:

- Contains a finding without file:line evidence
- References a file that doesn't exist at HEAD
- Reports a finding already marked RESOLVED in a previous audit
- Fails to cite the HEAD commit hash

### 22.6 Release Manager Gate

Before committing, the Release Manager verifies:

- No OPEN findings exist for modified files
- The evidence log is complete
- Previous findings have been re-validated
- All findings are in a known state

---

## 23. Governance Enforcement System

The Governance Enforcement System is the **mandatory gate** before ANY code modification. It ensures every engineering task is properly classified, reviewed by the appropriate agents, and authorized before implementation begins.

### 23.1 Core Principle

**No code modification without governance approval.**

The Orchestrator (via the governance CLI) MUST be the first action for every engineering task. Implementation agents may NOT modify code until governance classification and approval are complete.

### 23.2 Governance CLI

The governance system is implemented in `workshop/governance/` and accessed via:

```bash
npx tsx workshop/governance/cli.ts <command> [options]
```

#### Available Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `classify` | Classify a new task (simple or complex) | **Start of every task** |
| `validate` | Check if a task is approved for implementation | Before writing any code |
| `approve` | Record an agent's approval decision | During council review |
| `reject` | Record an agent's rejection decision | During council review |
| `start` | Mark task as in_progress | When implementation begins |
| `complete` | Mark task as completed | When task is finished |
| `status` | Show task manifest details | To inspect a task |
| `list` | List all task manifests | To see all tasks |

### 23.3 Task Classification

The Orchestrator classifies every task as **Simple** or **Complex**:

#### Simple Task — Direct Delegation
- 1-3 files affected, single domain
- No schema changes, no AI behaviour changes, no security implications
- Bug fix, minor UI change, simple refactor
- → Implementation authorized immediately. Single lead agent executes.

#### Complex Task — Council Required
- 4+ files affected or cross-cutting (multi-domain)
- Schema changes, AI behaviour changes, or security implications
- New feature, new endpoint, infrastructure change
- → Council review required. All required agents must approve before implementation.

### 23.4 Mandatory Workflow

```
                                      ┌──────────────────────┐
                                      │  Engineering Task     │
                                      └──────────┬───────────┘
                                                 │
                                      ┌──────────▼───────────┐
                                      │  GOVERNANCE GATE     │
                                      │  npx tsx workshop/   │
                                      │  governance/cli.ts   │
                                      │  classify            │
                                      └──────────┬───────────┘
                                                 │
                                      ┌──────────▼───────────┐
                                      │  Orchestrator         │
                                      │  Classification       │
                                      └──────┬───────────────┘
                                             │
                            ┌────────────────┼────────────────┐
                            │                                 │
                 ┌──────────▼──────────┐         ┌────────────▼────────────┐
                 │  SIMPLE              │         │  COMPLEX               │
                 │  Direct Delegation   │         │  Council Required      │
                 └──────────┬──────────┘         └────────────┬────────────┘
                            │                                 │
                 ┌──────────▼──────────┐         ┌────────────▼────────────┐
                 │  Execute Task       │         │  Council Review         │
                 │  (single agent)     │         │  (sequential approvals) │
                 └──────────┬──────────┘         └────────────┬────────────┘
                            │                                 │
                 ┌──────────▼──────────┐         ┌────────────▼────────────┐
                 │  Quality Gates      │         │  Approved?              │
                 │  (lint, build)      │         │  ┌─────┴─────┐          │
                 └──────────┬──────────┘         │  YES        NO          │
                            │                    └────┬─────┘  └──────┐   │
                            │              ┌──────────▼──┐   ┌────────▼──┐│
                            │              │ Execute Task│   │ Rejected  ││
                            │              └──────────┬──┘   └───────────┘│
                            │                         │                   │
                 ┌──────────▼──────────┐  ┌───────────▼────────────┐
                 │  Complete + Log     │  │  Quality Gates          │
                 │                     │  │  (lint, build, tests,   │
                 │                     │  │   DevTools, security)   │
                 └─────────────────────┘  └───────────┬────────────┘
                                                      │
                                            ┌─────────▼──────────┐
                                            │  Complete + Commit  │
                                            │  (Release Manager)  │
                                            └────────────────────┘
```

### 23.5 Enforcement Rules

1. **MANUAL ENFORCEMENT**: Before writing any code, the agent MUST run:
   ```bash
   npx tsx workshop/governance/cli.ts validate
   ```
   If no approved task manifest exists, this command BLOCKS and instructs the agent to classify first.

2. **TASK MANIFEST**: Every approved task produces a manifest in `.governance/tasks/<id>.json`. This file serves as the "permit to work." It contains the task classification, required agents, quality gates, and council decisions.

3. **QUALITY GATES**: Before marking a task as `completed`, all required quality gates must pass:
   - Simple tasks must pass: `lint`, `build`
   - Complex tasks must pass: `lint`, `build`, `unit_tests`, `e2e_tests`, `chrome_devtools`, `security_review`

4. **COUNCIL SEQUENCE**: For complex tasks, agents must approve in order:
   ```
   CTO (if large feature) → Architect → Domain Expert → Product Manager →
   Database (if schema) → Backend → Frontend → AI Engineer (if AI) →
   Performance → Security → Analytics → QA → Release Manager
   ```
   Each agent records their decision via:
   ```bash
   npx tsx workshop/governance/cli.ts approve <task-id> <agent-role> "rationale"
   ```

5. **REJECTION**: If any required agent rejects the task, the manifest status becomes `rejected`. The task must be revised and re-classified.

### 23.6 Agent Responsibilities Under Governance

| Agent | Governance Responsibility |
|-------|-------------------------|
| **Orchestrator** | FIRST to classify the task. Determines complexity and required agents. |
| **All Implementation Agents** | MUST check governance before coding. Run `validate` command first. |
| **Council Agents** | Must approve/reject complex tasks before implementation starts. |
| **Release Manager** | Verifies governance is complete before commit. Rejects commits without governance artifacts. |

### 23.7 Quality Gate Enforcement

Before a task can transition to `completed`, run each required quality gate:

| Gate | Command |
|------|---------|
| lint | `npm run lint` |
| build | `npm run build` |
| unit_tests | `npm run test:unit` |
| e2e_tests | `npm test` |
| chrome_devtools | Run Chrome DevTools MCP checks |
| security_review | Security Engineer approves |
| performance_review | Performance Engineer approves |

### 23.8 Governance Artifacts

The governance system produces the following artifacts:

| Artifact | Location | Purpose |
|----------|----------|---------|
| Task Manifest | `.governance/tasks/<id>.json` | Task classification, decisions, status |
| Governance Log | `.governance/logs/governance-<date>.log` | Audit trail of all governance actions |
| Decision Records | Embedded in manifest | Per-agent approval/rejection with rationale |

### 23.9 .gitignore

Ensure `.governance/` is tracked in git (it is the permanent record of engineering workflow):

```
# Do NOT add .governance/ to .gitignore — it must be committed
```

### 23.10 Violation Consequences

Any agent that modifies code without governance approval is in violation of the engineering workflow. Consequences:

1. The Release Manager will reject the commit.
2. The Memory Engineer will record the violation in engineering memory.
3. The CTO will review the violation and determine remediation.
