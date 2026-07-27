# MIA — AI Sales Assistant Platform

## What is MIA?

MIA is an AI sales assistant platform where businesses train a digital assistant to sell, answer customers, and support the sales team. First client is Vitanova (their own business), architecture prepared for future SaaS multi-tenant.

**Philosophy**: MIA should feel like hiring/training a new employee, not configuring software.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **UI**: Tailwind CSS v4 + shadcn/ui
- **Database**: Supabase (PostgreSQL + RLS)
- **Auth**: Email/password + Google OAuth via `@supabase/ssr`
- **AI**: OpenAI `gpt-4o-mini` via Vercel AI SDK
- **Testing**: Playwright (e2e)
- **MCP**: Chrome DevTools MCP (via `opencode.json`)

## Supabase

- **Project**: `hhitqgsaglddjkmaovbs` (Mia Lab, West US Oregon)
- **Credentials**: in `.env.local` (never commit)

## Database Schema (15 tables)

Core hierarchy: **Business → Assistants → Conversations → Messages**

| Table | Purpose |
|-------|---------|
| `businesses` | Tenant root |
| `brand_identity` | Tone, personality, communication style |
| `knowledge_base` | Free-form contextual info (FAQs, tips, objections) |
| `knowledge_versions` | Audit trail for knowledge changes |
| `ai_instructions` | Behavioral rules (separate from knowledge) |
| `assistants` | Multiple channels share one "brain" per business |
| `customers` | Commercial memory (phone, city, tags, status) |
| `assistant_memory` | Conversation memory per customer |
| `conversations` | Chat sessions |
| `messages` | Individual messages |
| `learning_events` | Corrections: pending → approved/rejected/modified |
| `ai_usage` | Token tracking with request_type |
| `products` | Structured data (name, price, description) |
| `sales_rules` | Sales-specific rules |
| `lab_sessions` | Laboratorio MIA simulation sessions |

Key design decisions:
- **Products** = structured data; **Knowledge** = free-form contextual info
- **AI Instructions** = behavioral rules separate from knowledge
- **Personality** = JSONB with `warmth`, `formality`, `humor`, `sales_aggressiveness` (0-100)
- **Customer entity** = commercial memory, not just a contact
- **Learning Events** = correction flow with 4 states
- **Knowledge Versions** = audit trail for all changes
- **AI Usage** tracking with `request_type` (training/simulation/live_customer)

## Project Structure

```
mia/
├── AGENTS.md                    # This file — project memory
├── opencode.json                # OpenCode config (Chrome DevTools MCP)
├── playwright.config.ts         # Playwright e2e config
├── tests/
│   └── public.spec.ts           # E2E tests (4 passing)
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql   # Core schema (15 tables + RLS)
│       └── 002_lab_sessions.sql     # Lab sessions + request_type
├── src/
│   ├── middleware.ts             # (unused, see proxy.ts)
│   ├── proxy.ts                  # Next.js 16 middleware — refreshes auth tokens
│   ├── app/
│   │   ├── (auth)/              # Auth pages (login, signup, callback)
│   │   ├── dashboard/           # Main app (was (dashboard) route group)
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
│   │   ├── laboratorio/         # 7 components (LabChatWindow, SimulationModes, ContextPanel, etc.)
│   │   └── onboarding/          # OnboardingWizard
│   └── lib/
│       ├── ai/
│       │   ├── client.ts        # OpenAI singleton, MODEL='gpt-4o-mini', TOKEN_COSTS
│       │   ├── prompts.ts       # Master prompt builder (personality, products, rules, knowledge)
│       │   └── knowledge.ts     # getBusinessContext(), recordAiUsage()
│       └── supabase/
│           ├── client.ts        # Browser client (createBrowserClient)
│           ├── server.ts        # Server client (setAll silently swallows errors — by design)
│           ├── admin.ts         # Admin client (bypasses RLS — use for server-side writes)
│           └── route-handler.ts # Route Handler client (sets cookies on Response object)
```

## Critical Architecture Decisions

### Auth Flow (RLS 42501 fix)

**Problem**: Server-side Supabase client (`@/lib/supabase/server`) does inserts that fail with RLS `42501` because `auth.uid()` returns NULL. Browser client also gets 403 on queries.

**Root cause**: Auth callback created `NextResponse.redirect()` but cookies set via `cookieStore.set()` were NOT propagated to the redirect response.

**Solution**:
1. `src/lib/supabase/route-handler.ts` — Supabase client factory for Route Handlers that sets cookies on Response object
2. `src/app/(auth)/auth/callback/route.ts` — Uses route-handler client, propagates cookies in Response before redirect
3. All server-side writes use `admin.ts` (bypasses RLS)

**Rule**: Any Route Handler that does writes must use the admin client. Read-only routes can use the server client.

### Route Group Rename

`(dashboard)` was renamed to `dashboard` folder so URLs resolve to `/dashboard/...` instead of `/`. The Sidebar link points to `/dashboard/laboratorio`.

## Commands

```bash
npm run dev          # Next.js dev server (port 3000)
npm run build        # Production build (TypeScript passes, static gen passes)
npm run lint         # ESLint (0 errors, 0 warnings)
npm test             # Playwright e2e tests
npm run test:ui      # Playwright UI mode
npm run test:report  # Playwright HTML report
```

## Git Conventions

- Commits in English, concise
- Never delete existing features
- Never modify applied migrations
- Atomic commits
- Remote: `https://github.com/arbojo/mia-platform.git`

## Current State (as of 2026-07-25)

### Working
- Auth (email + Google OAuth) — **needs re-login after cookie fix**
- Dashboard with sidebar navigation
- Onboarding wizard (4 steps with human copy)
- Products and Rules CRUD
- Training chat interface
- Laboratorio MIA (simulation lab with modes, analysis, evaluation, teach flow)
- Playwright tests (4 passing)
- Chrome DevTools MCP configured

### Known Issue
- User must **log out and re-login** to get fresh auth session after the callback fix. Old session cookies may still be broken.

### Pending
- Re-login and test full onboarding flow end-to-end
- Verify Laboratorio works end-to-end after auth fix
- Create more comprehensive e2e tests
- Laboratorio is a premium feature (billing integration pending)

## Simulation Modes (Laboratorio)

| Mode | Emoji | Behavior |
|------|-------|----------|
| Normal | 🟢 | Standard customer |
| Indeciso | 🟡 | Hesitant, needs persuasion |
| Complicado | 🔴 | Difficult, asks many questions |
| Cliente Exigente | 💀 | Demanding, high expectations |

## Response Analysis Criteria

Each response is evaluated on (1-10 scale):
- `product_knowledge` — Accuracy and depth of product info
- `empathy` — Emotional intelligence and rapport
- `objection_handling` — How well objections are addressed
- `closing` — Ability to guide toward sale
- `rule_following` — Adherence to business rules/instructions

## MIA Philosophy

> "MIA should feel like hiring/training a new employee, not configuring software."

- First client is Vitanova (their own business)
- Architecture prepared for future SaaS multi-tenant
- Corrections flow: MIA detects correction → proposes learning → user confirms → saves with versioning
- Learning Events: pending → approved/rejected/modified
- Knowledge Versions: audit trail for all changes
