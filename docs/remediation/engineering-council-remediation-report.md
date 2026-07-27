# Engineering Council — Remediation Report

**Date**: 2026-07-27
**Status**: Complete
**Agent**: Full 16-agent workflow

---

## Summary

| Phase | Changes | Files | Status |
|-------|---------|-------|--------|
| Phase 1 — Security | 1 | `api/chat/route.ts` | ✅ |
| Phase 2 — Robustness | 3 | `ChatWindow.tsx`, `LaboratorioClient.tsx` | ✅ |
| Phase 3 — Quality | 2 | `ChatWindow.tsx`, `dashboard/page.tsx` | ✅ |
| **Total** | **6** | **4** | **All verified** |

---

## Phase 1 — Security Critical

### Finding #1: Chat API ownership verification

**Original finding**: `error-hunting-report.md` #6 — High priority
**Agent**: Security Engineer

**Problem**: Chat API fetched assistant without verifying ownership. Any authenticated user could chat with any assistant.

**Solution**: Added two verification checks after assistant fetch:
1. Verify `assistant.businesses.owner_id === user.id`
2. If `conversationId` provided, verify it belongs to the assistant

**Files modified**: `src/app/api/chat/route.ts:45-67`

**Verification**:
- Auth check: ✅ (pre-existing)
- Business ownership: ✅ (new)
- Conversation ownership: ✅ (new)

---

## Phase 2 — Robustness

### Finding #2: ChatWindow state mutation

**Original finding**: `error-hunting-report.md` #1 — Medium priority
**Agent**: Frontend Engineer

**Problem**: Direct state mutation: `lastMsg.content = assistantContent` violated React immutability.

**Solution**: Replaced with `prev.map()` creating new array with updated message.

**Files modified**: `src/components/chat/ChatWindow.tsx:108-113`

### Finding #3: ChatWindow uses prompt()

**Original finding**: `error-hunting-report.md` #2 — Medium priority
**Agent**: Frontend Engineer

**Problem**: `prompt('¿Cuál es la respuesta correcta?')` blocked UI with browser-native dialog.

**Solution**: Replaced with inline correction input component:
- Clicking "Corregir" shows an amber input box
- User types correction text
- Submit with Enter or button
- Cancel with Escape or Cancel button

**Files modified**: `src/components/chat/ChatWindow.tsx:120-130, 190-220`

### Finding #4: LaboratorioClient cost never updates

**Original finding**: `error-hunting-report.md` #5 — Medium priority
**Agent**: Performance Engineer

**Problem**: `cost: prev.cost` never recalculated from token usage.

**Solution**: Calculate cost from token counts using MODEL cost rates: `(tokens.input * 0.00015 + tokens.output * 0.0006) / 1000`

**Files modified**: `src/components/laboratorio/LaboratorioClient.tsx:189`

---

## Phase 3 — Quality

### Finding #5: ChatWindow requestType doesn't handle training

**Original finding**: `error-hunting-report.md` #3 — Low priority
**Agent**: AI Engineer

**Problem**: `requestType: mode ? 'simulation' : 'live_customer'` sent wrong type for training.

**Solution**: Created `getRequestType()` helper that maps:
- `mode === 'training'` → `'training'`
- `mode` present → `'simulation'`
- no mode → `'live_customer'`

**Files modified**: `src/components/chat/ChatWindow.tsx:31-35`

### Finding #6: Empty assistantIds array guard

**Original finding**: `error-hunting-report.md` #12 — Medium priority
**Agent**: Backend Engineer

**Problem**: Dashboard queries with empty `assistantIds` array could cause Supabase errors.

**Solution**: Added `if (assistantIds.length > 0)` guard before executing queries.

**Files modified**: `src/app/dashboard/page.tsx:49-72`

---

## Files Modified

| File | Changes | Phase |
|------|---------|-------|
| `src/app/api/chat/route.ts` | Added ownership verification for assistant and conversation | Phase 1 |
| `src/components/chat/ChatWindow.tsx` | Fixed state mutation, replaced prompt(), added requestType helper, added inline correction UI | Phase 2+3 |
| `src/components/laboratorio/LaboratorioClient.tsx` | Fixed cost calculation from token usage | Phase 2 |
| `src/app/dashboard/page.tsx` | Added empty assistantIds guard | Phase 3 |

---

## Quality Gates

| Gate | Result |
|------|--------|
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm run build` | ✅ Successful (Next.js 16.2.12) |
| `npm test` | ✅ 4/4 Playwright tests passed |

---

## Pending Items (Not Addressed)

| # | Finding | Priority | Reason Deferred |
|---|---------|----------|-----------------|
| 1 | No DELETE policy for assistants | Medium | Database Engineer approval needed |
| 2 | No DELETE policy for conversations | Low | Database Engineer approval needed |
| 3 | customers.last_interaction never written | Medium | Requires trigger (migration) |
| 4 | No conversation history in AI prompt | Medium | AI Engineer approval needed |
| 5 | No rate limiting on chat API | Medium | Requires new middleware |
| 6 | Training corrections not persisted | Medium | Requires new API endpoint |
| 7 | Prompt hardcoded in Spanish | Low | AI Engineer approval needed |
| 8 | OnboardingWizard stores full personality object | Low | Backend cleanup |
| 9 | Training conversation uses admin client | Low | RLS policy fix needed |
| 10 | Token cost type casting fragile | Low | AI SDK update needed |
| 11 | No assistant creation after onboarding | Medium | New feature (CRUD) |
| 12 | No assistant edit capability | Medium | New feature (CRUD) |

---

## Agent Evaluation

| Agent | Action Taken |
|-------|-------------|
| **Security** | Approved ownership verification |
| **Frontend** | Implemented all UI fixes |
| **Backend** | Added empty array guard |
| **Performance** | Fixed cost calculation |
| **AI Engineer** | Approved requestType fix |
| **QA** | All quality gates passed |
| **Release** | Ready for commit (pending approval) |
