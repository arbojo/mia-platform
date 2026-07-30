# Sprint 1 Validation Report

**Date**: 2026-07-29
**Task**: TASK-20260730-022854
**Head**: `Sprint 1 — Product Survival`

---

## Quality Gates

| Gate | Status | Details |
|------|--------|---------|
| `npm run lint` | ✅ PASS | 0 errors, 1 pre-existing warning (`AgentRole` unused in governance workflow) |
| `npm run build` | ✅ PASS | Compiled successfully in ~9s, all 39 routes generated |
| `npm test` | ✅ PASS | 4/4 Playwright tests pass |
| Chrome DevTools | ✅ PASS | No console errors on `/dashboard`, `/dashboard/conversations`, `/dashboard/laboratorio`. 1 minor a11y issue (`<select>` missing `id`) — pre-existing. |

---

## Phase 1 — Auth Validation

**Deliverable**: `docs/audits/auth-validation-report.md`

| Finding | Status |
|---------|--------|
| proxy.ts naming is CORRECT for Next.js 16 | ✅ Verified. Next.js 16 docs confirm migration from `middleware.ts`. |
| Open redirect in `auth/callback/route.ts:15-16` | **RETRACTED** — re-analysis shows `${origin}${next}` always stays on same origin. Not exploitable. |
| Missing forgot-password and logout flows | ✅ Documented as future work |

---

## Phase 2 — Empty-State Fixes

**Deliverable**: `docs/audits/empty-state-audit.md`

| Finding | Status |
|---------|--------|
| 15 `.single()` calls on empty tables | ✅ All converted to `.maybeSingle()` |
| First-time user flow verified | ✅ No PGRST116 crashes for new users |

**Files changed**: 10 files across knowledge-studio, onboarding, dashboard layout, training, API routes, and lib utilities.

---

## Phase 3 — Conversations

**Deliverable**: Live conversations page at `/dashboard/conversations`

| Requirement | Status |
|-------------|--------|
| List conversations with customer info | ✅ Joins `customers` table, shows name/phone/email |
| Show assistant name | ✅ Joins `assistants` table |
| Show last message | ✅ Batch query on `messages` table, one per conversation |
| Show relative timestamp | ✅ "Hace Xm/h/d" or "Ahora" |
| Show status badge | ✅ "Activa" / "Archivada" |
| Empty state for no assistants | ✅ "No hay conversaciones todavía" with link to assistants |
| Empty state for no conversations | ✅ "Sin mensajes" per conversation |
| Ownership scoping | ✅ Scoped to user's business via `requireAuth()` + `owner_id` check |

---

## Phase 4 — Laboratory Repair

| Issue | Fix | File |
|-------|-----|------|
| `currentConversationId` never set (missing setter) | Added `setCurrentConversationId` to useState; API now creates conversation and returns ID; captured in `handleStartSession` | `LaboratorioClient.tsx:53`, `sessions/route.ts:48-56` |
| `messageCount` stays 0 | Added increment in `onTokensUsed` handler | `LaboratorioClient.tsx:196` |
| Token tracking never fires | Destructured `onTokensUsed` in `LabChatWindow`, called after each assistant response with estimated tokens | `LabChatWindow.tsx:34,132-137` |

---

## Phase 5 — Security Review

| Finding | Severity | Status |
|---------|----------|--------|
| RLS enabled on all tables with `get_user_business_ids()` | ✅ Good | Verified |
| Conversations page scopes to `owner_id` | ✅ Good | Verified |
| Auth callback uses route-handler with cookie propagation | ✅ Good | Verified |
| Sessions POST uses admin client without ownership check | 🔶 Low | **Fixed** — added `supabase.from('businesses').select('id').eq('id', business_id).maybeSingle()` check before admin insert |
| Auth callback `next` parameter | ✅ Not exploitable | URL stays on origin; no open redirect |
| All API routes validate auth | ✅ Good | All check `auth.getUser()` before processing |

---

## Files Changed (Sprint 1)

```
Modified:
  src/app/dashboard/conversations/page.tsx          (Phase 3)
  src/components/laboratorio/LaboratorioClient.tsx   (Phase 4)
  src/components/laboratorio/LabChatWindow.tsx       (Phase 4)
  src/app/api/laboratorio/sessions/route.ts          (Phase 4 + security)

Created:
  docs/audits/auth-validation-report.md              (Phase 1)
  docs/audits/empty-state-audit.md                   (Phase 2)
  docs/audits/sprint-1-validation-report.md          (Phase 5)

Phase 2 bulk fixes (10 files):
  knowledge-studio/page.tsx, onboarding/page.tsx, dashboard/layout.tsx,
  training/page.tsx, api/knowledge/analyze/route.ts, api/channels/connections/route.ts,
  api/laboratorio/analyze/route.ts, api/training/lessons/route.ts,
  lib/ai/knowledge.ts, lib/ai/weekly-report.ts, lib/ai/skills.ts,
  lib/channels/identity.ts
```

---

## Remaining Known Issues

- Auth: missing forgot-password and logout flows (deferred)
- A11y: `<select>` elements missing `id` attributes (pre-existing)
- Governance: `AgentRole` unused import warning in `workshop/governance/workflow.ts` (pre-existing)
