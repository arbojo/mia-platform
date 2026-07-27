# Authentication Experience Audit & Smart Entry Routing

**Date:** 2026-07-27
**Status:** Proposed
**Requested by:** Engineering Council
**Complexity:** Medium
**Impact:** 5 files modified, 2 new utilities

---

## 1. Current State

### 1.1 Architecture

| Layer | File | Responsibility |
|-------|------|----------------|
| Middleware | `src/proxy.ts` | Runs on every request. Checks auth. Redirects unauthenticated users to `/login`. Redirects authenticated users from `/` to `/dashboard`. |
| Auth Utility | `src/lib/auth.ts` | `requireAuth()` — used in Server Components. Gets user or redirects to `/login`. |
| Dashboard Layout | `src/app/dashboard/layout.tsx` | Calls `requireAuth()`, queries business, passes `onboarding_status` to `OnboardingBanner`. |
| Login Page | `src/app/(auth)/login/page.tsx` | Client Component. After login → `router.push('/dashboard')`. |
| Auth Callback | `src/app/(auth)/auth/callback/route.ts` | OAuth code exchange. After success → redirect to `/dashboard`. |
| Landing Page | `src/app/page.tsx` | Public. Shows login/signup links. |

### 1.2 Current User Flows

```
Visitor opens /
  → Landing page (public)
  → Clicks "Iniciar sesión"
  → /login (public)
  → Logs in
  → router.push('/dashboard')
  → Dashboard layout calls requireAuth()
  → Dashboard page queries business
  → If no business: shows CTA "Presentar mi asistente"
  → If business exists: shows dashboard
```

### 1.3 Current Problems

| # | Problem | Severity | Impact |
|---|---------|----------|--------|
| 1 | Authenticated user visiting `/login` sees the login form again | Medium | Confusing UX |
| 2 | Authenticated user visiting `/signup` sees the signup form | Medium | Confusing UX |
| 3 | Auth callback always redirects to `/dashboard`, ignores onboarding state | Medium | New users land on empty dashboard |
| 4 | No return URL after login — users always go to `/dashboard` | Low | Lost navigation context |
| 5 | `requireAuth()` is called in every dashboard page independently | Low | Redundant auth checks |
| 6 | `OnboardingBanner` is a soft nudge, not a hard redirect | Low | Users can skip onboarding |
| 7 | No loading state during auth redirects | Low | Flash of wrong page |

---

## 2. Engineering Council Analysis

### 2.1 CTO — Architecture Review

**Assessment:** Current architecture is sound for a single-tenant MVP but needs hardening for SaaS.

**Recommendations:**
- Centralize routing logic in `proxy.ts` (middleware) — it already runs on every request
- Keep `requireAuth()` for Server Components — it provides the `supabase` client, not just auth check
- Do NOT move auth logic to layouts — layouts can't conditionally redirect based on business state without extra DB queries on every page
- Consider: proxy.ts already makes one DB call (`getUser()`). Adding a business lookup is one more query per request. Acceptable for now, optimize later with caching.

**Decision:** Proceed with centralized middleware approach.

### 2.2 Security Engineer — Security Review

**Assessment:** Current implementation is secure. Changes must maintain security.

**Checks:**
- [x] No protected routes exposed without auth
- [x] RLS enforced on all tables
- [x] No tenant leakage possible
- [x] No user information exposed before authentication

**Recommendations:**
- Auth redirect must happen in middleware (server-side), not client-side
- Never expose business data in redirect URLs
- Return URLs must be validated (same-origin only)
- Onboarding redirect must not bypass auth check

**Decision:** All redirects must be server-side. No client-side auth logic for routing.

### 2.3 Frontend Engineer — UX Review

**Assessment:** Current UX has friction points.

**Problems:**
1. Authenticated user sees login form → confusing
2. New user lands on empty dashboard → feels broken
3. No loading state during redirects → flash of wrong page
4. Onboarding banner is easy to ignore

**Recommendations:**
- Redirect authenticated users away from `/login` and `/signup`
- Redirect new users (no business) directly to `/dashboard/onboarding`
- Show loading spinner during auth check
- Make onboarding a hard redirect, not a banner

**Decision:** Implement server-side redirects for all auth states.

### 2.4 Product Manager — Journey Review

**Assessment:** The ideal journey should feel like "hiring a new employee."

**Ideal Journey:**
```
Visitor → Landing page → Signup → Business creation → Assistant creation → Dashboard
```

**Current Journey:**
```
Visitor → Landing page → Signup → Dashboard (empty) → CTA to onboarding → Onboarding → Dashboard
```

**Gap:** New users land on an empty dashboard instead of being guided to onboarding.

**Decision:** New users must be redirected to `/dashboard/onboarding` automatically.

### 2.5 Domain Expert — Domain Review

**Assessment:** Business entity determines user state.

**States:**
1. No session → visitor
2. Session exists, no business → new user (needs onboarding)
3. Session exists, business with `onboarding_status !== 'ready'` → onboarding in progress
4. Session exists, business with `onboarding_status === 'ready'` → active user

**Decision:** Use business existence and `onboarding_status` as routing criteria.

### 2.6 Database Engineer — Schema Review

**Assessment:** No schema changes needed.

**Note:** Business lookup in middleware requires a DB query. This is acceptable:
- One query per request (already doing `getUser()`)
- Can be optimized later with caching or JWT claims

**Decision:** No migration needed.

### 2.7 Backend Engineer — Implementation Review

**Assessment:** Changes are straightforward.

**Implementation plan:**
1. Update `proxy.ts` with smart routing
2. Update auth callback to check business state
3. Add `getAuthState()` utility for reuse
4. Update login page to redirect authenticated users

**Decision:** Proceed with implementation.

### 2.8 AI Engineer — AI Review

**Assessment:** No AI features involved.

**Decision:** No action needed.

### 2.9 Performance Engineer — Performance Review

**Assessment:** Adding business lookup to middleware adds one DB query per request.

**Mitigation:**
- The query is simple (select one row by `owner_id`)
- Supabase connection pooling handles this efficiently
- Can be optimized later with edge caching or JWT claims

**Decision:** Acceptable for now. Monitor query performance.

### 2.10 Analytics Engineer — Analytics Review

**Assessment:** Track auth funnel conversion.

**Recommendations:**
- Track: login success, signup completion, onboarding completion
- Track: redirect paths (which destination users reach)
- Track: time from signup to first assistant creation

**Decision:** Add analytics events in future sprint.

### 2.11 QA Engineer — Test Plan

**Test Scenarios:**

| # | Scenario | Expected | Priority |
|---|----------|----------|----------|
| 1 | Anonymous user opens `/dashboard` | Redirected to `/login` | P0 |
| 2 | Anonymous user opens `/` | Landing page (no redirect) | P0 |
| 3 | Authenticated user opens `/login` | Redirected to `/dashboard` | P0 |
| 4 | Authenticated user opens `/signup` | Redirected to `/dashboard` | P0 |
| 5 | Authenticated user opens `/` | Redirected to `/dashboard` | P0 |
| 6 | New user (no business) opens `/dashboard` | Redirected to `/dashboard/onboarding` | P0 |
| 7 | User in onboarding opens `/dashboard` | Stays on dashboard (banner shown) | P1 |
| 8 | User with completed onboarding opens `/dashboard` | Stays on dashboard | P0 |
| 9 | Auth callback (OAuth) → new user | Redirected to `/dashboard/onboarding` | P0 |
| 10 | Auth callback (OAuth) → existing user | Redirected to `/dashboard` | P0 |
| 11 | Expired session opens `/dashboard` | Redirected to `/login` | P0 |

**Decision:** All P0 scenarios must pass before release.

### 2.12 Release Manager — Release Review

**Assessment:** Changes affect core auth flow. Requires careful testing.

**Requirements:**
- All 11 test scenarios must pass
- Lint must be clean (0 errors, 0 warnings)
- Build must succeed
- No breaking changes to existing auth flow

**Decision:** Release after all quality gates pass.

---

## 3. Recommended Architecture

### 3.1 Smart Routing in proxy.ts

```typescript
// proxy.ts — Smart routing logic

const publicPaths = ['/login', '/signup', '/auth', '/']
const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

// 1. Unauthenticated user on protected route → /login
if (!user && !isPublicPath) {
  return redirect('/login')
}

// 2. Authenticated user on auth pages → /dashboard (or /onboarding)
if (user && (pathname === '/login' || pathname === '/signup')) {
  const business = await getBusiness(user.id)
  if (!business) return redirect('/dashboard/onboarding')
  return redirect('/dashboard')
}

// 3. Authenticated user on / → /dashboard (or /onboarding)
if (user && pathname === '/') {
  const business = await getBusiness(user.id)
  if (!business) return redirect('/dashboard/onboarding')
  return redirect('/dashboard')
}

// 4. Authenticated user on /dashboard without business → /dashboard/onboarding
if (user && pathname === '/dashboard' && !pathname.startsWith('/dashboard/onboarding')) {
  const business = await getBusiness(user.id)
  if (!business) return redirect('/dashboard/onboarding')
}
```

### 3.2 Auth Callback with State Detection

```typescript
// auth/callback/route.ts — Smart redirect after OAuth

const business = await getBusiness(user.id)
if (!business) {
  return redirect('/dashboard/onboarding')
}
return redirect('/dashboard')
```

### 3.3 Login Page Client-Side Guard

```typescript
// login/page.tsx — Redirect if already authenticated

useEffect(() => {
  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      router.push('/dashboard')
    }
  }
  checkAuth()
}, [])
```

### 3.4 Return URL Support (Optional — Future)

Store intended destination in URL query parameter:
```
/login?returnTo=/dashboard/assistants/123
```

After login, redirect to `returnTo` instead of always `/dashboard`.

**Decision:** Defer to future sprint. Current implementation always redirects to `/dashboard`.

---

## 4. User Flows (After Implementation)

### 4.1 Visitor
```
Open mia.com
  → / (landing page, public)
  → Click "Iniciar sesión"
  → /login (public)
  → Logs in
  → proxy.ts detects: user + no business
  → Redirect to /dashboard/onboarding
  → Onboarding wizard
```

### 4.2 Authenticated User on Login Page
```
Open /login (while logged in)
  → proxy.ts detects: user + pathname is /login
  → Query business
  → If no business: redirect to /dashboard/onboarding
  → If business exists: redirect to /dashboard
```

### 4.3 New User After OAuth
```
Google OAuth callback
  → /auth/callback?code=...
  → Exchange code for session
  → Query business
  → If no business: redirect to /dashboard/onboarding
  → If business exists: redirect to /dashboard
```

### 4.4 Returning User
```
Open /dashboard
  → proxy.ts detects: user + pathname is /dashboard
  → Query business
  → If business exists: allow access
  → Dashboard layout queries business again (for sidebar, banner)
```

### 4.5 Anonymous User on Protected Route
```
Open /dashboard/assistants
  → proxy.ts detects: no user + not public path
  → Redirect to /login
```

---

## 5. Files to Modify

| File | Change |
|------|--------|
| `src/proxy.ts` | Add smart routing: redirect authenticated users from auth pages, detect onboarding state |
| `src/lib/auth.ts` | Add `getBusinessForUser()` utility for business lookup |
| `src/app/(auth)/auth/callback/route.ts` | Check business state before redirect |
| `src/app/(auth)/login/page.tsx` | Add client-side auth check (redirect if logged in) |
| `src/app/(auth)/signup/page.tsx` | Add client-side auth check (redirect if logged in) |

---

## 6. Risks

| Risk | Mitigation |
|------|-----------|
| Extra DB query per request | Acceptable for MVP. Optimize with caching later. |
| Redirect loops | Careful logic: only redirect from specific paths |
| Auth callback race condition | Use server-side check, not client-side |
| Business lookup failure | Default to `/dashboard` (safe fallback) |

---

## 7. Success Criteria

- [ ] Authenticated user visiting `/login` is redirected to `/dashboard`
- [ ] Authenticated user visiting `/signup` is redirected to `/dashboard`
- [ ] New user (no business) is redirected to `/dashboard/onboarding`
- [ ] Returning user (business exists) sees dashboard directly
- [ ] Anonymous user on protected route is redirected to `/login`
- [ ] OAuth callback routes to correct destination
- [ ] All 11 QA test scenarios pass
- [ ] Lint: 0 errors, 0 warnings
- [ ] Build: succeeds
- [ ] Playwright tests: all pass

---

## 8. Final Question

> Does the current authentication flow feel like a professional SaaS product for a first-time business owner?

**After implementation:** Yes. The flow will be:
1. Visitor sees landing page
2. Signs up (email or Google)
3. Immediately guided to onboarding (not dumped on empty dashboard)
4. Returns later and lands directly on dashboard
5. Never sees login form when already authenticated

This matches the experience of products like Shopify, Notion, and Linear.
