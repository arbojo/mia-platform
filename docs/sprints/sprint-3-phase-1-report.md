# Sprint 3 Phase 1 Report — Dashboard Authenticity

**Date**: 2026-07-29
**Task**: TASK-20260729-173000 (Phase 0/1)
**HEAD**: bff027b

---

## Summary

Replaced 5 hardcoded FAKE dashboard values with real database queries. Fixed 2 PARTIAL data sources (channel, returning customers). Every displayed value now has a traceable origin.

---

## What Was Fake

| Element | Old Value | Source | Status |
|---------|-----------|--------|--------|
| VitalPresence conversations trend | `{ value: 8, positive: true }` | Hardcoded in `page.tsx:102` | ✅ Replaced with `getConversationTrend()` |
| VitalPresence preparation trend | `{ value: 5, positive: true }` | Hardcoded in `page.tsx:129` | ✅ Replaced with `miaReadiness.deltas.overall` |
| ModuleCard "Memoria" status | `"3 nuevos hoy"` | Hardcoded in `page.tsx:154` | ✅ Replaced with `getModuleCardData().memoriaStatus` |
| ModuleCard "Pensamiento" status | `"5 hipótesis"` | Hardcoded in `page.tsx:163` | ✅ Replaced with `getModuleCardData().pensamientoStatus` |
| ModuleCard "Laboratorio" status | `"Score 7.8"` | Hardcoded in `page.tsx:172` | ✅ Replaced with `getModuleCardData().laboratorioStatus` |

## What Was Partial

| Element | Issue | Fix |
|---------|-------|-----|
| `conversations.channel` | Always hardcoded to `'web'` | ✅ Now reads `conv.channel` from DB |
| `returningCustomers` | Always 0 (wrong query filter) | ✅ Now queries customers created before today |
| `newCustomers` | Counted incorrectly | ✅ Now excludes returning customers from count |

---

## New Query Functions

| Function | File | Purpose |
|----------|------|---------|
| `getModuleCardData()` | `queries.ts` | Computes real statuses for all 3 ModuleCards |
| `getConversationTrend()` | `queries.ts` | Compares today's active conversations to yesterday's |

---

## Data Sources per Dashboard Element (After Fix)

| Element | Source | Table | Refresh |
|---------|--------|-------|---------|
| Conversations count | `COUNT(conversations) WHERE type='live' AND created_at >= today` | conversations | Page load |
| Conversations trend | Yesterday's count vs today's count | conversations | Page load |
| New customers count | `COUNT(customers) WHERE created_at >= today AND NOT returning` | customers | Page load |
| Returning customers | Customers with messages today AND created before today | customers | Page load |
| Messages handled | `COUNT(messages) WHERE created_at >= today` | messages | Page load |
| Readiness score | `calculateReadiness()` weighted composite | readiness_snapshots | Page load |
| Readiness trend | `deltas.overall` from readiness calculation | readiness_snapshots | Page load |
| Memoria status | `COUNT(learning_events approved today) + COUNT(knowledge_items new today)` | learning_events, knowledge_items | Page load |
| Pensamiento status | `COUNT(knowledge_suggestions pending) + COUNT(business_memory patterns)` | knowledge_suggestions, business_memory | Page load |
| Laboratorio status | `AVG(lab_sessions.score) WHERE last 7 days` | lab_sessions | Page load |
| Conversation timeline | Recent conversations with messages | conversations, messages, customers | Page load |
| Daily report | Yesterday's activity summary | messages, learning_events, customers | Page load |

---

## Quality Gates

| Gate | Result |
|------|--------|
| `npm run build` | ✅ 0 TypeScript errors |
| `npm run lint` | ✅ 0 errors, 1 pre-existing warning |
| `npm test` | ✅ 4/4 Playwright tests passed |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/dashboard/queries.ts` | Added `getModuleCardData()`, `getConversationTrend()`. Updated `getTodaysActivity()` with correct returning customers. Added `conversations.channel` to timeline query. Added `moduleCards`, `conversationTrend`, `readinessTrend` to `DashboardData`. |
| `src/app/dashboard/page.tsx` | Replaced 5 hardcoded values with real data references. |

---

## What Remains

The following PARTIAL elements from the audit are NOT yet fixed (deferred to Phase 2 or Phase 3):

| Element | Issue | Target Phase |
|---------|-------|-------------|
| `outcome` never `'interested'`/`'sold'` | Needs AI-based outcome detection | Phase 3 |
| `avgResponseTime` always null | Needs response time calculation | Phase 3 |
| 14 unused fetched fields | Needs dashboard redesign to display | Phase 3 |
| No conversation detail page | Needs `/dashboard/conversations/[id]` | Phase 2 |

---

## Git State

```
Commit: pending
Branch: main
Changes: 2 files modified
```

The dashboard now displays only verified, traceable metrics. No fabricated numbers.
