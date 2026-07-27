# Assistant Flow Report

**Date**: 2026-07-27
**Agent**: Domain Expert + Backend Engineer
**Status**: Functional with gaps

---

## Assistant Creation Flow

### Does creation from dashboard exist?

**No direct creation from dashboard.** Assistants are only created via the 4-step onboarding wizard:
1. Step 0: Create assistant (name, personality, communication style)
2. Step 1: Business info (brand identity)
3. Step 2: Products (optional)
4. Step 3: Rules (optional)

After onboarding completes, there is **no UI to create additional assistants**.

### What works?

| Feature | Status | Location |
|---------|--------|----------|
| Create assistant (onboarding) | ✅ | `OnboardingWizard.tsx` |
| Edit assistant name | ❌ No UI | — |
| Edit personality | ❌ No UI | — |
| Edit communication style | ❌ No UI | — |
| Training chat | ✅ | `training/page.tsx` |
| Products CRUD | ✅ | `products/page.tsx` |
| Rules CRUD | ✅ | `rules/page.tsx` |
| Delete assistant | ❌ No UI | — |

### Database save verification

Onboarding creates:
1. `businesses` row (if new)
2. `assistants` row with personality JSONB
3. `assistant_channels` row (web channel)
4. Updates `businesses.onboarding_status`

All writes use Supabase client (client-side) — relies on RLS policies.

### Training flow

1. `training/page.tsx` fetches assistant
2. Finds or creates a `conversations` row (type=training)
3. Creates training conversation with admin client (bypasses RLS)
4. Renders `ChatWindow` with `onCorrection` callback
5. Correction callback only logs to console — **not persisted**

### Issues found

| # | Problem | Cause | Impact | Proposed Solution |
|---|---------|-------|--------|-------------------|
| 1 | No assistant creation after onboarding | No UI component exists | Users can't add second assistant | Create AssistantManager component |
| 2 | No assistant edit capability | No edit UI | Can't fix mistakes | Add edit modal to assistant cards |
| 3 | Correction not persisted | `onCorrection` only logs | Training corrections lost | Persist to `learning_events` table |
| 4 | No assistant deletion | No delete UI | Can't remove unwanted assistants | Add delete with confirmation |
| 5 | Empty assistantIds array | Dashboard query with empty IN | Potential Supabase error | Guard against empty array |
