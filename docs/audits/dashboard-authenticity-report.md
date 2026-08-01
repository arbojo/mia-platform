# Dashboard Authenticity Report

**Date**: 2026-07-29
**Audited by**: Engineering Council — Phase 0/1 Sprint 3
**HEAD**: bff027b
**Objective**: Classify every dashboard element as REAL, PARTIAL, or FAKE. No metric without traceable origin.

---

## Methodology

Every element on every dashboard screen was inspected at the code level. Classification criteria:

| Status | Definition |
|--------|------------|
| **REAL** | Connected to database, calculated from real events, updated automatically |
| **PARTIAL** | Has data source but incomplete logic, or data flows but value is partially fabricated |
| **FAKE** | Hardcoded value, placeholder, static text presented as dynamic |

---

## Element Inventory

### 1. `/dashboard` — Main Dashboard

#### 1.1 VitalPresence — "Conversaciones activas"

| Field | Current Source | Status |
|-------|---------------|--------|
| `value` | `data.todaysActivity.conversations` → `COUNT(conversations) WHERE type='live' AND created_at >= today` | **REAL** |
| `trend.value` | HARDCODED `8` | **FAKE** |
| `trend.positive` | HARDCODED `true` | **FAKE** |
| `meaning` | Static string | N/A (descriptive) |
| `context` | Static string `"En las últimas 24 horas"` | N/A (descriptive) |
| `action` | Static string `"Conversaciones activas"` | N/A (descriptive) |

**Business question**: "How many active conversations is MIA having today? Is that more or less than yesterday?"

**Fix**: Replace hardcoded `{ value: 8, positive: true }` with real comparison to yesterday's count. Query yesterday's conversation count, compute delta.

#### 1.2 VitalPresence — "Nuevos clientes"

| Field | Current Source | Status |
|-------|---------------|--------|
| `value` | `data.todaysActivity.newCustomers` → `COUNT(customers) WHERE business_id = X AND created_at >= today` | **REAL** |
| `trend` | Not provided | N/A |
| `meaning` | Static string | N/A |
| `context` | Static string | N/A |

**Status**: REAL

#### 1.3 VitalPresence — "Mensajes gestionados"

| Field | Current Source | Status |
|-------|---------------|--------|
| `value` | `data.todaysActivity.messagesHandled` → `COUNT(messages) WHERE created_at >= today` | **REAL** |
| `trend` | Not provided | N/A |

**Status**: REAL

#### 1.4 VitalPresence — "Preparación"

| Field | Current Source | Status |
|-------|---------------|--------|
| `value` | `Math.round(data.miaReadiness.overall)` → `calculateReadiness()` weighted composite | **REAL** |
| `trend.value` | HARDCODED `5` | **FAKE** |
| `trend.positive` | HARDCODED `true` | **FAKE** |

**Business question**: "Is MIA getting more prepared over time?"

**Fix**: Compare current readiness overall to last snapshot's overall, compute real delta.

#### 1.5 ModuleCard — "Memoria"

| Field | Current Source | Status |
|-------|---------------|--------|
| `title` | Static | N/A |
| `description` | Static | N/A |
| `status` | HARDCODED `"3 nuevos hoy"` | **FAKE** |

**Business question**: "What happened today in knowledge? New items learned? Corrections approved?"

**Data source**: `COUNT(learning_events WHERE status = 'approved' AND created_at >= today)` + `COUNT(knowledge_items WHERE created_at >= today)`

**Fix**: Replace with `"{count} nuevos hoy"` where count = approved learning events + new knowledge items today. If 0, show `"Sin novedades"`.

#### 1.6 ModuleCard — "Pensamiento"

| Field | Current Source | Status |
|-------|---------------|--------|
| `title` | Static | N/A |
| `description` | Static | N/A |
| `status` | HARDCODED `"5 hipótesis"` | **FAKE** |

**Business question**: "How many active analyses/suggestions does MIA have?"

**Data source**: `COUNT(business_memory WHERE memory_type = 'pattern' AND created_at >= last_7_days)` or `COUNT(knowledge_suggestions WHERE status = 'pending')`

**Fix**: Replace with count of pending knowledge suggestions + active business memory patterns. If 0, show `"En análisis"`.

#### 1.7 ModuleCard — "Laboratorio"

| Field | Current Source | Status |
|-------|---------------|--------|
| `title` | Static | N/A |
| `description` | Static | N/A |
| `status` | HARDCODED `"Score 7.8"` | **FAKE** |

**Business question**: "How well is MIA performing in simulations?"

**Data source**: `AVG(lab_sessions.score) WHERE status = 'completed' AND created_at >= last_7_days`

**Fix**: Replace with average lab score from last 7 days. Format as `"Score X.X"`. If no sessions, show `"Sin simulaciones"`.

#### 1.8 ConversationTimeline — Conversation Entries

| Field | Current Source | Status |
|-------|---------------|--------|
| `customerName` | `conv.customers[0].name ?? 'Cliente'` | **REAL** |
| `time` | `lastUserMsg.created_at` formatted | **REAL** |
| `lastMessage` | `lastUserMsg.content.slice(0, 80)` | **REAL** |
| `channel` | HARDCODED `'web'` | **PARTIAL** |
| `outcome` | `lastAssistantMsg ? 'answered' : 'pending'` | **PARTIAL** |

**Channel analysis**: The channel field is always hardcoded to `'web'`. The conversations table has a `channel` column (from `conversations.channel`).

**Outcome analysis**: Only `'answered'` and `'pending'` are ever set. `'interested'` and `'sold'` are defined in `OutcomeBadge` but NEVER produced. The OutcomeBadge component displays 4 labels but only 2 can appear.

**Business question (channel)**: "Which channels are being used?"

**Fix**: Read `conv.channel` from the conversations table instead of hardcoding.

**Business question (outcome)**: "Which conversations are converting?"

**Fix**: Phase 3 (Sales Metrics) will add proper outcome tracking. For Phase 1, either: (a) Keep `answered`/`pending` but remove `interested`/`sold` from the badge, or (b) Keep the badge options ready for Phase 3.

#### 1.9 DailyReport — "Esto es lo que hice ayer"

| Field | Current Source | Status |
|-------|---------------|--------|
| `greeting` | Static `"Esto es lo que hice ayer:"` | **REAL** |
| `items[].icon` | Hardcoded per condition | **REAL** |
| `items[].text` | Dynamic per condition | **REAL** |

**Status**: REAL — all items come from real DB queries.

**But**: The report only shows yesterday's data. A better approach would be to show "today so far" with a fallback to yesterday if no activity today.

#### 1.10 Unused Fetched Data

The following data is fetched by `getDashboardData()` but **NEVER DISPLAYED** on the page:

| Field | Lines Fetched | Status | Recommendation |
|-------|---------------|--------|----------------|
| `employeeStatus` | `queries.ts:809` | **PARTIAL** — exists, not shown | Either display or remove |
| `todaysActivity.returningCustomers` | `queries.ts:211` | **PARTIAL** — bug: always 0 because DB query filters by `created_at >= today` | Fix query or remove |
| `todaysActivity.tokensConsumed` | `queries.ts:212` | **REAL** | Consider adding to dashboard in Phase 3 |
| `todaysActivity.costToday` | `queries.ts:213` | **REAL** | Consider adding to dashboard in Phase 3 |
| `todaysActivity.avgResponseTime` | `queries.ts:214` | **PARTIAL** — always null | Implement response time calculation or remove |
| `needsFromYou` | `queries.ts:813` | **REAL** | Wire into dashboard |
| `businessHealth` | `queries.ts:815` | **REAL** | Wire into dashboard |
| `proactiveSuggestions` | `queries.ts:816` | **REAL** | Wire into dashboard |
| `milestones` | `queries.ts:817` | **REAL** | Wire into dashboard |
| `skillsSnapshot` | `queries.ts:822` | **REAL** | Wire into dashboard |
| `productIntelligence` | `queries.ts:823` | **REAL** | Wire into dashboard |
| `weeklyReport` | `queries.ts:824` | **REAL** | Wire into dashboard |
| `businessMemory` | `queries.ts:825` | **REAL** | Wire into dashboard |
| `velocityHistory` | `queries.ts:826` | **REAL** | Wire into dashboard |

**Total fetched but unused fields**: 14. This represents significant wasted query overhead.

---

### 2. `/dashboard/conversations` — Conversations Page

#### 2.1 Stats Bar

| Status | Status |
|--------|--------|
| Total | **REAL** (from DB) |
| Active | **REAL** |
| Waiting | **REAL** |
| Completed | **REAL** |
| Abandoned | **REAL** |
| Archived | **REAL** |

All status counts are from real DB queries.

#### 2.2 Conversation Cards

| Field | Status |
|-------|--------|
| Customer name | **REAL** |
| Last message | **REAL** |
| Status badge | **REAL** (5 extended statuses) |
| Time | **REAL** |
| Notes indicator | **REAL** |
| Outcome tag | **PARTIAL** (same problem as timeline — outcomes never set) |

---

### 3. `/dashboard/assistants` — Assistants List

#### 3.1 Status Badges

| Field | Status |
|-------|--------|
| Status | **REAL** (draft/training/ready/active/inactive from DB) |
| Correction count | **REAL** (from learning_events) |

---

### 4. `/dashboard/knowledge` — Knowledge Page

| Element | Status |
|---------|--------|
| Knowledge items list | **REAL** |
| AI Instructions list | **REAL** |

---

### 5. `/dashboard/knowledge-studio` — Knowledge Studio

| Element | Status |
|---------|--------|
| Analysis reports | **REAL** |
| Suggestions | **REAL** |

---

### 6. `/dashboard/laboratorio` — Laboratorio

| Element | Status |
|---------|--------|
| Simulation modes | **REAL** |
| Scoring | **REAL** |

---

### 7. Sidebar

| Element | Status |
|---------|--------|
| Navigation links | **REAL** (static, correct) |
| Active state | **REAL** (from pathname) |

---

## Consolidated FAKE Elements

| # | Location | Element | Fake Value | Priority |
|---|----------|---------|------------|----------|
| 1 | `page.tsx:102` | VitalPresence conversations trend | `{ value: 8, positive: true }` | **P0** |
| 2 | `page.tsx:129` | VitalPresence preparation trend | `{ value: 5, positive: true }` | **P0** |
| 3 | `page.tsx:154` | ModuleCard "Memoria" status | `"3 nuevos hoy"` | **P0** |
| 4 | `page.tsx:163` | ModuleCard "Pensamiento" status | `"5 hipótesis"` | **P0** |
| 5 | `page.tsx:172` | ModuleCard "Laboratorio" status | `"Score 7.8"` | **P0** |

## Consolidated PARTIAL Elements

| # | Location | Element | Issue | Priority |
|---|----------|---------|-------|----------|
| 6 | `queries.ts:461` | Channel hardcoded to `'web'` | `conversations.channel` exists in DB | **P1** |
| 7 | `queries.ts:462` | Outcome always `answered`/`pending` | `interested`/`sold` never set | **P1** |
| 8 | `queries.ts:251-253` | `returningCustomers` always 0 | DB query filters by `>= today` | **P2** |
| 9 | `queries.ts:214` | `avgResponseTime` always null | No calculation implemented | **P2** |
| 10 | `page.tsx` | 14 unused fetched fields | Fetched but never rendered | **P2** |

---

## Impact Analysis

### Why FAKE elements are a trust issue

1. **ModuleCard "3 nuevos hoy"**: A business owner sees this and thinks MIA has learned 3 new things. If they investigate and find nothing new, trust erodes immediately.
2. **ModuleCard "Score 7.8"**: Suggests meaningful performance measurement. A fabricated score is worse than no score.
3. **Trend arrows**: "↑ 8 respecto a ayer" implies a real comparison. If the user sees the same "↑ 8" every day, it's clearly fake.

### PARTIAL element impact

4. **Channel always `'web'`**: If MIA integrates WhatsApp, conversations from WhatsApp will still show `'web'` — misleading.
5. **Outcome never `'interested'`/`'sold'`**: OutcomeBadge shows these as options but they never appear. Works for now but becomes misleading when users expect filtering by outcome.
6. **Unused fetched data**: 14 fields fetched but not displayed = wasted query time. For businesses with large datasets, this adds unnecessary load.

---

## Implementation Plan

### Phase 1A — Fix FAKE elements (P0)

Estimated effort: 1 day

| Item | Action | Code Changes |
|------|--------|-------------|
| VitalPresence trends | Compute real deltas from yesterday's data | `queries.ts` — add `getYesterdayActivity()` or compute from `readiness_snapshots` deltas; `page.tsx` — remove hardcoded trend |
| ModuleCard "Memoria" | Query learning events + knowledge items today count | `queries.ts` — add `getTodayKnowledgeActivity()`; `page.tsx` — pass real value |
| ModuleCard "Pensamiento" | Query pending suggestions + active patterns | `queries.ts` — add `getPendingAnalyses()`; `page.tsx` — pass real value |
| ModuleCard "Laboratorio" | Query avg lab score last 7 days | `queries.ts` — add `getLabScore()`; `page.tsx` — pass real value |

### Phase 1B — Fix PARTIAL elements (P1-P2)

Estimated effort: 1-2 days

| Item | Action | Code Changes |
|------|--------|-------------|
| Channel in timeline | Read `conversations.channel` instead of hardcoding | `queries.ts:461` |
| Outcome timeline | Keep `answered`/`pending` for now; prepare for Phase 3 | `queries.ts:462`, `ConversationTimeline.tsx` |
| Unused fields | Wire into dashboard or remove fetches | `queries.ts`, `page.tsx` |
| `returningCustomers` | Fix query or remove | `queries.ts:251-253` |

---

## Approval Record

This report is the audit deliverable for Phase 0/1 of Sprint 3 (TASK-20260729-173000).

After review, implementation of approved changes will begin.

### Voting

| Agent | Phase 1A (P0 fixes) | Phase 1B (P1-P2 fixes) |
|-------|---------------------|------------------------|
| CTO | ✅ Approve | ✅ Approve |
| Architect | ✅ Approve | ✅ Approve — but keep conversation detail for Sprint 3 Phase 2 |
| Product Manager | ✅ Approve — critical trust fix | ✅ Approve — channel is important after WhatsApp integration |
| QA Engineer | ✅ Approve | ✅ Approve — verify all 6 fake elements removed |

**Status**: Pending implementation per council approval. Start with Phase 1A.
