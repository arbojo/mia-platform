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

## 2. Guiding Principles

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

## 3. Tech Stack

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

## 4. Architecture

### 4.1 Multi-Tenant Design

The platform is built multi-tenant from day one. All data is scoped to a business through Row Level Security (RLS). The core hierarchy is:

```
Business → Assistants → Customers → Conversations → Messages
```

### 4.2 Domain Model

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

### 4.3 Key Design Decisions

- **Products** = structured data; **Knowledge** = free-form contextual info
- **AI Instructions** = behavioral rules separate from knowledge
- **Personality** = JSONB with `warmth`, `formality`, `humor`, `sales_aggressiveness` (0-100)
- **Customer entity** = commercial memory, not just a contact
- **Learning Events** = correction flow with 4 states
- **Knowledge Versions** = audit trail for all changes
- **AI Usage** tracking with `request_type` (training/simulation/live_customer)

### 4.4 Critical Rules

> **All new functionality must respect this architecture.** Do not create parallel hierarchies, duplicate data models, or bypass the tenant scoping system.

### 4.5 Auth Flow (RLS 42501 Fix)

**Problem**: Server-side Supabase client does inserts that fail with RLS `42501` because `auth.uid()` returns NULL.

**Root cause**: Auth callback created `NextResponse.redirect()` but cookies set via `cookieStore.set()` were NOT propagated to the redirect response.

**Solution**:
1. `src/lib/supabase/route-handler.ts` — Supabase client factory for Route Handlers that sets cookies on Response object
2. `src/app/(auth)/auth/callback/route.ts` — Uses route-handler client, propagates cookies in Response before redirect
3. All server-side writes use `admin.ts` (bypasses RLS)

**Rule**: Any Route Handler that does writes must use the admin client. Read-only routes can use the server client.

---

## 5. Project Structure

```
mia/
├── AGENTS.md                    # This file — agent guide
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

## 6. Development Rules

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

## 7. Database Rules

1. **Never modify applied migrations.** Once a migration is run, it is immutable.
2. **Schema changes go through new migrations only.** Create a new file in `supabase/migrations/`.
3. **Never delete existing columns** without explicit authorization.
4. **Always respect Row Level Security (RLS).** Every table must have appropriate policies.
5. **Always maintain multi-tenant compatibility.** All data must be scoped to a business.
6. **Use the admin client** for server-side writes that bypass RLS (per auth flow rules).

---

## 8. API Rules

All API routes (`src/app/api/`) must:

1. **Validate inputs** — reject invalid data with clear error messages
2. **Handle errors** — catch exceptions, return appropriate HTTP status codes
3. **Return consistent responses** — use a standard shape for success and error
4. **Avoid duplicate logic** — use shared functions from `src/lib/`
5. **Use the correct Supabase client** — admin for writes, server for reads
6. **Track AI usage** when applicable — call `recordAiUsage()` for token tracking

---

## 9. Components

1. **Server Components by default** — only mark as Client (`'use client'`) when needed for interactivity
2. **Client Components only when necessary** — for state, effects, event handlers, or browser APIs
3. **Avoid unnecessary global state** — prefer React context, server state, or local state
4. **Keep components reusable** — extract shared patterns into shared components
5. **Follow existing patterns** — look at how similar components are built before creating new ones
6. **Use shadcn/ui** — do not create custom UI primitives when shadcn provides them

---

## 10. Artificial Intelligence

### 10.1 Prompt Management

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

### 10.2 AI Usage

- Model: `gpt-4o-mini` (via OpenAI)
- All AI calls must be tracked via `recordAiUsage()` with `request_type` (training/simulation/live_customer)
- Token costs are defined in `src/lib/ai/client.ts`

---

## 11. Laboratorio MIA

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

## 12. Quality Checklist

Before completing any task, the agent **must**:

1. **Run lint** — `npm run lint` (0 errors, 0 warnings)
2. **Run build** — `npm run build` (no errors)
3. **Run Playwright tests** — `npm test`
4. **Fix all errors found** — do not leave known errors unresolved
5. **Do not deliver code with known issues**

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

## 13. Git Conventions

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

## 14. Before Implementing a New Feature

The agent must follow this process:

1. **Analyze existing architecture** — understand the current design
2. **Identify reusable components** — search for what already exists
3. **Propose the simplest solution** — minimize complexity
4. **Minimize changes** — touch only what is necessary
5. **Maintain compatibility** — do not break existing functionality
6. **Implement** — write clean, typed, modular code
7. **Verify** — test the feature manually if possible
8. **Run quality checks** — lint, build, Playwright tests
9. **Report changes** — summarize what was done and why

---

## 15. Code Style

1. **Prioritize readability** over clever code
2. **Avoid large functions** — split when logic grows complex
3. **Use descriptive names** — variables, functions, components should be self-documenting
4. **Document only when it adds value** — do not over-comment obvious code
5. **Remove dead code** — do not leave unused imports, variables, or functions
6. **No temporary comments** — do not leave TODOs, FIXMEs, or placeholder comments unless tracking a known issue
7. **Follow existing conventions** — mimic the style of surrounding code

---

## 16. Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server (port 3000) |
| `npm run build` | Production build (TypeScript + static generation) |
| `npm run lint` | ESLint (must pass with 0 errors, 0 warnings) |
| `npm test` | Run Playwright e2e tests |
| `npm run test:ui` | Playwright interactive UI mode |
| `npm run test:report` | Generate Playwright HTML report |

---

## 17. Final Objective

Every decision made on this project must answer this question:

> **"Does this make MIA Platform easier to maintain, more scalable, and more useful for its users?"**

If the answer is no, find a better solution.

---

## 18. Current State

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
