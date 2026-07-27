# Auth Testing — Technical Debt Report

**Date**: 2026-07-26
**Author**: QA Engineer (MIA Agent System)
**Status**: Open

---

## Summary

3 of 4 Playwright tests in `tests/public.spec.ts` are failing. All failures are pre-existing and unrelated to recent feature work. The root causes span routing, middleware, and test infrastructure issues.

---

## Failure 1: Login Page Returns 404

| Field | Detail |
|-------|--------|
| **Route affected** | `/login` |
| **Test** | `Public pages > login page loads` |
| **Expected** | HTTP 200 |
| **Received** | HTTP 404 |
| **Priority** | **P1 — High** |

### Files Involved

- `tests/public.spec.ts:9-13` — Test definition
- `src/app/(auth)/login/page.tsx` — Login page component
- `src/app/(auth)/` — Route group (no layout.tsx)
- `src/proxy.ts` — Middleware logic (not wired as middleware)

### Probable Cause

The `(auth)` route group has **no `layout.tsx`**. While Next.js route groups don't strictly require a layout, the absence may cause the dev server to not correctly resolve `/login` as a route during development mode. The build output (`next build`) correctly lists `/login` as a static route, suggesting this is a **dev-mode resolution issue**, not a build issue.

Additionally, `src/proxy.ts` contains middleware logic but is **not named `middleware.ts`**. Next.js only recognizes `middleware.ts` (or `.js`) at the project root or `src/` root. The file `src/middleware.ts` does not exist, meaning the proxy logic is completely inactive.

### Recommendation

1. Create `src/app/(auth)/layout.tsx` (even if minimal) to explicitly define the auth route group layout.
2. Rename `src/proxy.ts` to `src/middleware.ts` to activate middleware.

---

## Failure 2: Signup Page Returns 404

| Field | Detail |
|-------|--------|
| **Route affected** | `/signup` |
| **Test** | `Public pages > signup page loads` |
| **Expected** | HTTP 200 |
| **Received** | HTTP 404 |
| **Priority** | **P1 — High** |

### Files Involved

- `tests/public.spec.ts:15-19` — Test definition
- `src/app/(auth)/signup/page.tsx` — Signup page component
- `src/app/(auth)/` — Route group (no layout.tsx)

### Probable Cause

Same root cause as Failure 1. The `(auth)` route group without a layout may cause dev-mode route resolution to fail.

### Recommendation

Same as Failure 1 — creating the auth layout should resolve both.

---

## Failure 3: Dashboard Redirect to Login Times Out

| Field | Detail |
|-------|--------|
| **Route affected** | `/dashboard` (unauthenticated) |
| **Test** | `Dashboard (unauthenticated) > redirects to login` |
| **Expected** | Redirect to `/login` within 10s |
| **Received** | Timeout — no redirect occurred |
| **Priority** | **P1 — High** |

### Files Involved

- `tests/public.spec.ts:22-27` — Test definition
- `src/proxy.ts:32-41` — Redirect logic for unauthenticated users
- `src/middleware.ts` — **Does not exist**

### Probable Cause

The redirect logic in `src/proxy.ts` checks if the user is unauthenticated and redirects to `/login`. However, since the file is named `proxy.ts` instead of `middleware.ts`, **Next.js never loads it**. The middleware is completely inactive.

Without middleware, unauthenticated requests to `/dashboard` are handled by the dashboard page itself (`src/app/dashboard/page.tsx`), which calls `supabase.auth.getUser()`. If the user is null, it calls `redirect('/login')` from `next/navigation`. However, this server-side redirect may not be triggering correctly in the test environment — possibly because the Supabase client cannot establish a connection during tests, or the redirect is happening after the page renders.

### Recommendation

1. Rename `src/proxy.ts` to `src/middleware.ts` to activate the middleware redirect.
2. Verify that the dashboard page's fallback `redirect('/login')` works as a safety net.

---

## Additional Finding: No Auth Layout

| Field | Detail |
|-------|--------|
| **Route affected** | All `(auth)` routes |
| **Priority** | **P2 — Medium** |

### Detail

The `(auth)` route group contains 3 pages (`login`, `signup`, `auth/callback`) but no `layout.tsx`. This means:

- Auth pages use the root layout (`src/app/layout.tsx`), which has no auth-specific styling or providers.
- The root layout renders `<html lang="es">` and a basic `<body>` — functional but not ideal for auth flows.
- Future auth pages (password reset, email confirmation) will lack a consistent auth layout.

### Recommendation

Create `src/app/(auth)/layout.tsx` with a centered layout wrapper (consistent with the existing auth page designs that use `min-h-screen flex items-center justify-center`).

---

## Test Infrastructure Notes

| Item | Detail |
|------|--------|
| **Playwright config** | `playwright.config.ts` — starts dev server via `npm run dev` |
| **Dev server** | `next dev` (Turbopack) |
| **Base URL** | `http://localhost:3000` |
| **Web server timeout** | 120s |

The Playwright config starts the dev server automatically. If the dev server has route resolution issues (as suggested by the 404s), all tests hitting those routes will fail regardless of test correctness.

---

## Priority Summary

| # | Issue | Priority | Impact |
|---|-------|----------|--------|
| 1 | Missing `src/middleware.ts` | P1 | Auth redirect completely inactive |
| 2 | Missing `(auth)/layout.tsx` | P1 | Dev-mode route resolution failure |
| 3 | Dashboard redirect not triggering | P1 | Unauthenticated users can access dashboard |
| 4 | No auth layout for future pages | P2 | Inconsistent auth UX |

---

## Recommended Fix Order

1. Rename `src/proxy.ts` → `src/middleware.ts` (activates auth middleware)
2. Create `src/app/(auth)/layout.tsx` (resolves route group issues)
3. Re-run Playwright tests to verify all 4 pass
4. Consider adding auth-specific tests (login flow, signup flow, protected routes)
