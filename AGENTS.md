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

---

## 2. Agent System

MIA uses a **specialized engineering agent system** with 14 distinct roles. Every task must follow the mandatory workflow through these agents.

### 2.1 Agent Roster

| Agent | File | Responsibility |
|-------|------|----------------|
| CTO | `.agents/cto.md` | Highest technical authority, strategic decisions |
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

### 2.2 Mandatory Workflow

Every task must follow this workflow:

```
1. CTO (strategic approval for major features)
   ↓
2. Infrastructure Guardian (environment validation, toolchain integrity)
   ↓
3. Architect (analyze, design, propose)
   ↓
4. Domain Expert (validate domain consistency)
   ↓
5. Product Manager (validate user value)
   ↓
6. Database Engineer (if schema changes needed)
   ↓
7. Backend Engineer (APIs, logic, integrations)
   ↓
8. Frontend Engineer (UI components, pages)
   ↓
9. AI Engineer (if AI features involved)
   ↓
10. Performance Engineer (performance and cost review)
   ↓
11. Security Engineer (security review)
   ↓
12. Analytics Engineer (measurement strategy)
   ↓
13. QA Engineer (lint, build, Playwright, DevTools)
   ↓
14. Release Manager (commit, push, changelog)
```

**No agent may skip this workflow.** Each agent must complete their responsibilities before handing off to the next.

### 2.3 Guardian Agents

Certain agents hold **guardian authority** — the power to block progress when their domain is at risk:

| Guardian | Authority | Can Block |
|----------|-----------|-----------|
| **CTO** | May reject implementations that introduce unnecessary complexity or violate platform architecture | Large features, architectural changes |
| **Infrastructure Guardian** | May block development when environment inconsistencies, toolchain issues, or misconfigurations are detected. Maintains environment baseline and auto-diagnoses errors. | Development sessions with broken environments |
| **Security Engineer** | May block releases if security risks are detected | Any release with security vulnerabilities |
| **Performance Engineer** | May request optimization before release when measurable performance or cost improvements exist | Releases with known performance issues |
| **QA Engineer** | May block releases if quality gates fail | Releases that fail lint, build, or tests |
| **Release Manager** | May refuse deployment if any guardian has unresolved blocking issues | Any deployment |

### 2.4 Agent Rules

#### CTO Rules
- Never writes implementation code
- Evaluates major features before implementation
- Challenges assumptions before coding
- Can stop implementation and request redesign
- Approves large features (6+ files) before implementation

#### Infrastructure Guardian Rules
- Validates environment before any development session
- Blocks development when environment is broken
- Never allows code changes on inconsistent environments
- Detects drift between local and expected state
- Recommends `npm run doctor` for full health check
- Recommends `npm run environment-check` for quick validation
- Maintains `.infrastructure/baseline.json` as the healthy environment reference
- Auto-diagnoses errors and delegates to the responsible agent

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

## 6. Project Structure

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
│       └── 001-agent-system.md
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

## 7. Development Rules

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

## 8. Database Rules

1. **Never modify applied migrations.** Once a migration is run, it is immutable.
2. **Schema changes go through new migrations only.** Create a new file in `supabase/migrations/`.
3. **Never delete existing columns** without explicit authorization.
4. **Always respect Row Level Security (RLS).** Every table must have appropriate policies.
5. **Always maintain multi-tenant compatibility.** All data must be scoped to a business.
6. **Use the admin client** for server-side writes that bypass RLS (per auth flow rules).

---

## 9. API Rules

All API routes (`src/app/api/`) must:

1. **Validate inputs** — reject invalid data with clear error messages
2. **Handle errors** — catch exceptions, return appropriate HTTP status codes
3. **Return consistent responses** — use a standard shape for success and error
4. **Avoid duplicate logic** — use shared functions from `src/lib/`
5. **Use the correct Supabase client** — admin for writes, server for reads
6. **Track AI usage** when applicable — call `recordAiUsage()` for token tracking

---

## 10. Components

1. **Server Components by default** — only mark as Client (`'use client'`) when needed for interactivity
2. **Client Components only when necessary** — for state, effects, event handlers, or browser APIs
3. **Avoid unnecessary global state** — prefer React context, server state, or local state
4. **Keep components reusable** — extract shared patterns into shared components
5. **Follow existing patterns** — look at how similar components are built before creating new ones
6. **Use shadcn/ui** — do not create custom UI primitives when shadcn provides them

---

## 11. Artificial Intelligence

### 11.1 Prompt Management

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

### 11.2 AI Usage

- Model: `gpt-4o-mini` (via OpenAI)
- All AI calls must be tracked via `recordAiUsage()` with `request_type` (training/simulation/live_customer)
- Token costs are defined in `src/lib/ai/client.ts`

---

## 12. Laboratorio MIA

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

## 13. Quality Checklist

Before completing any task, the agent **must**:

1. **Run lint** — `npm run lint` (0 errors, 0 warnings)
2. **Run build** — `npm run build` (no errors)
3. **Run Playwright tests** — `npm test`
4. **Run Chrome DevTools MCP** — check console and network
5. **Fix all errors found** — do not leave known errors unresolved
6. **Do not deliver code with known issues**

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

## 14. Git Conventions

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

## 15. Before Implementing a New Feature

The agent must follow this process:

1. **Analyze existing architecture** — understand the current design
2. **Identify reusable components** — search for what already exists
3. **Propose the simplest solution** — minimize complexity
4. **Minimize changes** — touch only what is necessary
5. **Maintain compatibility** — do not break existing functionality
6. **Implement** — write clean, typed, modular code
7. **Verify** — test the feature manually if possible
8. **Run quality checks** — lint, build, Playwright tests, DevTools
9. **Report changes** — summarize what was done and why

---

## 16. Code Style

1. **Prioritize readability** over clever code
2. **Avoid large functions** — split when logic grows complex
3. **Use descriptive names** — variables, functions, components should be self-documenting
4. **Document only when it adds value** — do not over-comment obvious code
5. **Remove dead code** — do not leave unused imports, variables, or functions
6. **No temporary comments** — do not leave TODOs, FIXMEs, or placeholder comments unless tracking a known issue
7. **Follow existing conventions** — mimic the style of surrounding code

---

## 17. Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server (port 3000) |
| `npm run build` | Production build (TypeScript + static generation) |
| `npm run lint` | ESLint (must pass with 0 errors, 0 warnings) |
| `npm test` | Run Playwright e2e tests |
| `npm run test:ui` | Playwright interactive UI mode |
| `npm run test:report` | Generate Playwright HTML report |

---

## 18. Final Objective

Every decision made on this project must answer this question:

> **"Does this make MIA Platform easier to maintain, more scalable, and more useful for its users?"**

If the answer is no, find a better solution.

---

## 19. Current State

### Working
- Auth (email + Google OAuth)
- Dashboard with sidebar navigation
- Onboarding wizard (4 steps)
- Products and Rules CRUD
- Training chat interface
- Laboratorio MIA (simulation lab with modes, analysis, evaluation, teach flow)
- Playwright tests
- Chrome DevTools MCP configured

### Known Issues
- User must log out and re-login after certain auth changes (session refresh)

### Pending
- More comprehensive e2e tests
- Laboratorio billing integration (premium feature)
- Full end-to-end verification of onboarding flow

---

## 20. Architecture Decision Records

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
