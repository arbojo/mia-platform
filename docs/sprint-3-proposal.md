# Sprint 3 Proposal — Business Intelligence & Learning Evolution

**Status**: Approved (Engineering Council — 2026-07-29)
**Task**: TASK-20260729-173000
**HEAD**: bff027b

---

## Executive Summary

Sprint 2 left MIA with deployable assistants but significant gaps in business intelligence, learning visibility, and data authenticity. The Engineering Council audited all 5 focus areas and identified that the highest-priority work is **fixing fake dashboard data** and **activating dead schema**, not building new features.

**Core problem**: The codebase has architecture drift — migrations 001 and 009 added schema (`assistant_memories`, `maturity_stage`) whose runtime code was never built. Meanwhile, the dashboard shows hardcoded values that erode user trust.

**Sprint 3 priority**: Authenticate first. Then measure. Then evolve.

---

## Council Approvals

| Agent | Decision | Key Condition |
|-------|----------|---------------|
| CTO | ✅ Approve | Fix fake data first, then sales metrics, then learning evolution |
| Architect | ✅ Approve | 5 implementation phases, 2 new ADRs |
| Domain Expert | ✅ Approve | No domain boundary violations. Decision memory is new concept. |
| Product Manager | ✅ Approve | Priority 0: fake data. HIGH: conversation detail, sales metrics |
| Database Engineer | ✅ Approve | 1 new table (`event_log`), rest reuses existing schema |
| Backend Engineer | ✅ Approve | 4 new API routes, 2 modified modules |
| Frontend Engineer | ✅ Approve | Server Components, re-use ChatWindow, no business logic in UI |
| AI Engineer | ✅ Approve | Activate assistant_memories, maturity detection, outcome analysis |
| Performance Engineer | ✅ Approve | Materialized views for metrics, paginated messages, batched AI |
| Security Engineer | ✅ Approve | RLS on event_log, ownership validation on all new routes |
| Analytics Engineer | ✅ Approve | Success metrics: 0 hardcoded values, >80% outcome coverage |
| Memory Engineer | ✅ Approve | 4 memory layers confirmed, no concept mixing |
| QA Engineer | ✅ Approve | lint/build/Playwright/DevTools passing throughout |
| Release Manager | ✅ Approve | No blocking issues, governance artifacts will be committed |

---

## Phase 1: Dashboard Authenticity (Priority 0)

**Problem**: ModuleCard shows hardcoded `"3 nuevos hoy"`, `"5 hipótesis"`, `"Score 7.8"`. Trend arrows are hardcoded. Conversation outcomes `"sold"`/`"interested"` can never be set.

### Scope

| Item | Files | Impact |
|------|-------|--------|
| Replace hardcoded ModuleCard with real queries | `src/app/dashboard/page.tsx` | UI fix |
| Wire trend arrows to real deltas | `src/app/dashboard/page.tsx`, `src/lib/dashboard/queries.ts` | Fix fake trends |
| Add outcome selector UI to conversation list | `src/components/conversations/ConversationList.tsx` | New action |
| New API: `PATCH /api/conversations/[id]/outcome` | `src/app/api/conversations/[id]/outcome/route.ts` | New endpoint |
| Wire queries.ts to return real outcome data | `src/lib/dashboard/queries.ts` | Backend fix |
| Remove fake data patterns from all components | `src/components/dashboard/`, `src/app/dashboard/` | Code cleanup |

### Schema Impact
- None — `conversations.outcome` field already exists in schema

### Security
- Standard ownership validation (same pattern as status/notes routes)

### Migration
- None

---

## Phase 2: Conversation Detail (Priority HIGH)

**Problem**: No page exists to read a conversation transcript. Users cannot review what MIA actually said.

### Scope

| Item | Files |
|------|-------|
| New page: `/dashboard/conversations/[id]` | `src/app/dashboard/conversations/[id]/page.tsx` |
| Read-only chat transcript component | Re-use `ChatWindow` with `readOnly` prop |
| API: `GET /api/conversations/[id]` (with messages) | `src/app/api/conversations/[id]/route.ts` |
| Message pagination (50 per page) | `src/lib/runtime/runtime.ts` (query modification) |

### Schema Impact
- None

### Performance
- Paginate messages: load 50, lazy load older
- Cache conversation metadata (5 min TTL)
- Lazy load full message bodies

---

## Phase 3: Sales Metrics (Priority HIGH)

**Problem**: MIA is a "sales assistant" with zero sales metrics. No conversion rate, no pipeline, no revenue.

### Scope

| Item | Files |
|------|-------|
| New API: `GET /api/sales/metrics` | `src/app/api/sales/metrics/route.ts` |
| New Sales Intelligence Events table + API | `src/app/api/sales/events/route.ts` |
| Sales metrics section on dashboard | New `MetricsCard` component |
| Daily rollup/materialized view for performance | `supabase/migrations/015_sales_metrics.sql` |

### Schema Impact
- **New table**: `sales_events` — event_type (using ADR-010 enum), conversation_id, product_id, metadata JSONB, created_at
- **New materialized view**: `daily_sales_metrics` — rolled up per-day aggregates
- RLS scoped to business_id

### AI Impact
- Background webhook/trigger on conversation completion to classify outcome (gpt-4o-mini)
- Batch analysis, not per-message

### Security
- RLS on sales_events table
- Metrics API filters by user's businesses

---

## Phase 4: Learning Evolution (Priority MEDIUM)

**Problem**: `maturity_stage` exists in schema but is dead code. Mentor mode has no UI. No learning progression visibility.

### Scope

| Item | Files |
|------|-------|
| Activate maturity_stage detection | `src/lib/ai/readiness.ts` |
| Maturity stage badge on dashboard | `src/app/dashboard/page.tsx` |
| Learning velocity visualization | New `LearningVelocityCard` component |
| Mentor mode in Laboratorio | UI toggle (already exists in DB schema) |

### Schema Impact
- None — `readiness_snapshots.maturity_stage` column exists
- `lab_sessions.mode` already has `mentor` option

### AI Impact
- maturity_stage calculated from: readiness score + learning velocity + conversation volume + skill levels
- Stages: observation → understanding → mentor → advisor → autonomous

---

## Phase 5: Memory Architecture & Product Intelligence (Priority MEDIUM → LOW)

**Problem**: `assistant_memories` table is dead. Customer memory extraction is purely heuristic (4 keyword patterns). No business memory browser.

### Scope

| Item | Files |
|------|-------|
| Activate assistant_memories in context.ts | `src/lib/conversation/context.ts` |
| Write assistant_memories in runtime.ts | `src/lib/runtime/runtime.ts` |
| AI-assisted customer memory extraction | `src/lib/ai/customer-memory.ts` |
| Business memory CRUD UI | New `MemoryBrowser` component |
| Product objection tracking | `src/lib/ai/product-intelligence.ts` |

### Schema Impact
- `assistant_memories` — already exists, just needs code
- `business_memory` — already exists, just needs CRUD UI

### AI Impact
- Move from 4 keyword patterns to AI-assisted extraction (batch, not per-message)
- Product-objection correlation from conversation analysis

---

## Priority Ranking (Final)

| Rank | Phase | Effort | Business Value | Risk |
|------|-------|--------|----------------|------|
| 0 | **Dashboard Authenticity** | 2-3 days | HIGH — fixes trust issue immediately | Low |
| 1 | **Conversation Detail** | 2-3 days | HIGH — users can review AI work | Low |
| 2 | **Sales Metrics** | 3-5 days | HIGH — proves business value | Medium |
| 3 | **Learning Evolution** | 3-5 days | MEDIUM — power user feature | Medium |
| 4 | **Memory Architecture** | 5-7 days | MEDIUM — foundation for future | Low |
| 5 | **Product Intelligence** | 3-5 days | LOW — advanced feature | Medium |

**Total estimated effort**: 18-28 days

---

## New Architecture Decision Records Required

| ADR | Title | Status |
|-----|-------|--------|
| ADR-013 | Maturity Stage Activation — Implementation of `maturity_stage` column in readiness_snapshots | Proposed |
| ADR-014 | Sales Intelligence Event System — Formal event table and API for ADR-010 events | Proposed |

---

## Required Migrations

| Migration | Purpose | Phase |
|-----------|---------|-------|
| `015_sales_metrics.sql` | `sales_events` table + RLS + daily rollup view | Phase 3 |

---

## Quality Gates (per Phase)

| Gate | Tool | Target |
|------|------|--------|
| Lint | `npm run lint` | 0 errors, 0 warnings |
| Build | `npm run build` | 0 TypeScript errors |
| E2E Tests | `npm test` | All existing + new passing |
| DevTools | Chrome DevTools MCP | 0 console errors on new pages |
| Security | Manual review | RLS on new tables, ownership on new routes |

---

## Security Review Summary

| Finding | Severity | Status |
|---------|----------|--------|
| Hardcoded dashboard values mislead users | CRITICAL | Will be fixed in Phase 1 |
| Conversation outcomes never settable | CRITICAL | Will be fixed in Phase 1 |
| `assistant_memories` table is dead schema | HIGH | Will be activated in Phase 5 |
| `maturity_stage` column unused | HIGH | Will be activated in Phase 4 |
| No conversation detail page | HIGH | Will be built in Phase 2 |
| No sales metrics on dashboard | MEDIUM | Will be added in Phase 3 |
| In-memory cache breaks on serverless | MEDIUM | Deferred to Sprint 4 |
| Customer memory extraction too basic | LOW | Will be improved in Phase 5 |
| No customer 360 view | LOW | Deferred to Sprint 4 |

---

## Success Criteria

1. **Zero hardcoded dashboard values** after Phase 1 implementation
2. **>80% of conversations** have outcome set within 1 week of Phase 3
3. **Conversion rate** visible on dashboard as primary metric
4. **Learning velocity trend** visible to business owner
5. **Maturity stage** advances at least one level within 30 days
6. **All existing Playwright tests** continue to pass
7. **0 lint errors, 0 build errors** throughout all phases

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI outcome detection costs exceed budget | Medium | High | Batch analysis, cap tokens per conversation |
| Dashboard metrics query too slow | Medium | Medium | Materialized views, daily rollups |
| Maturity stage doesn't advance | Low | Medium | Lower thresholds, add manual override |
| assistant_memories prompt bloat | Low | Medium | Truncate to 500 tokens |
| Migration 009 dead code causes confusion | High | Low | Activate or document as deprecated |

---

## Appendix: Evidence Log

### CTO Pre-Audit Findings

| Finding | File:Line | State |
|---------|-----------|-------|
| Dashboard hardcoded statuses | `src/app/dashboard/page.tsx:154-177` | OPEN — Phase 1 |
| Conversation outcomes never set to sold/interested | `src/lib/dashboard/queries.ts:452-463` | OPEN — Phase 1 |
| `assistant_memories` table never read in code | `src/lib/ai/prompts.ts` | OPEN — Phase 5 |
| `maturity_stage` column in schema, zero TS references | `supabase/migrations/009_stage_based_learning.sql:9-15` | OPEN — Phase 4 |
| Customer memory only 4 keyword patterns | `src/lib/ai/customer-memory.ts:102-118` | OPEN — Phase 5 |
| No sales conversion tracking | `src/lib/dashboard/queries.ts:200-266` | OPEN — Phase 2 |
| No correction quality scoring | `src/lib/ai/skills.ts` | OPEN — Phase 4 |
| Hardcoded trend arrows | `src/app/dashboard/page.tsx:103-104` | OPEN — Phase 1 |
| ModuleCard "3 nuevos hoy" fake | `src/app/dashboard/page.tsx:154-177` | OPEN — Phase 1 |
| No conversation detail page | Missing route | OPEN — Phase 2 |
| In-memory cache breaks serverless | `src/lib/conversation/context.ts:34-48` | OPEN — Deferred |
| `assistant_memories` has no write code | Zero references in runtime | OPEN — Phase 5 |

---

## Approval Record

```
TASK-20260729-173000
Status: approved → in_progress
Council: 14/14 approvals (including CTO, Domain Expert, Product Manager, Analytics Engineer)
```

**Next step**: Begin Phase 1 implementation (Dashboard Authenticity) after this document is committed.
