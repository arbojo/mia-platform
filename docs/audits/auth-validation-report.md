# Auth Validation Report — Sprint 1

**Date**: 2026-07-30
**HEAD**: `74e411d`
**Next.js**: 16.2.12
**Method**: Code review, Playwright test verification, Next.js 16 API documentation

---

## 1. Middleware/Proxy Convention — EVIDENCE-BASED VERIFICATION

### Audit Report Claim

The prior audit (AUDIT_REPORT.md#63) claimed:
> `src/proxy.ts` named `proxy.ts` instead of `middleware.ts` — Next.js does NOT execute it.

This claim is **INCORRECT** for Next.js 16.

### Evidence

**Next.js 16.2.12 Documentation** (fetched from nextjs.org):
> **The `middleware` file convention is deprecated and has been renamed to `proxy`.**

Version history confirms this change in v16.0.0.

### Current Implementation

| Property | Current | Required | Status |
|----------|---------|----------|--------|
| File name | `src/proxy.ts` | `proxy.ts` (or `.js`) at root or `src/` | ✅ Correct |
| Export | `export default async function proxy` | default export or named `proxy` export | ✅ Correct |
| Config matcher | Excludes `_next/static`, images, favicon | Optional, recommended | ✅ Correct |
| Location | `src/proxy.ts` | Same level as `app/` | ✅ Correct |

### Playwright Test Verification

`tests/public.spec.ts:23-27` tests that unauthenticated `/dashboard` redirects to `/login`. This test passes, confirming route protection is active.

### Conclusion

**Decision A — Keep proxy.ts.** The file is correctly named for Next.js 16. No rename needed. The proxy IS executing and providing auth protection.

---

## 2. Auth Flow Analysis

### 2.1 Proxy-level Auth (src/proxy.ts)

The proxy handles:
- Public paths: `/login`, `/signup`, `/auth`, `/`
- Unauthenticated access to protected paths → redirect to `/login`
- Authenticated access to `/login`/`/signup` → redirect to dashboard or onboarding
- Onboarding check on `/dashboard`
- Session token refresh via `@supabase/ssr` cookie propagation (setAll on response)

**Assessment**: ✅ Correct pattern for Next.js 16 + Supabase SSR.

### 2.2 Page-level Auth (src/lib/auth.ts)

Dashboard layout calls `requireAuth()` which calls `supabase.auth.getUser()` and redirects to `/login` if no user. This is a defense-in-depth layer behind the proxy.

**Assessment**: ✅ Correct, redundant with proxy (acceptable for defense-in-depth).

### 2.3 Auth Callback (src/app/(auth)/auth/callback/route.ts)

The PKCE auth callback exchanges the code for a session and redirects.

**Issues found**:
1. **Open redirect vulnerability** (line 15-16): `next` parameter used in redirect without validation.
   ```ts
   if (next) {
     return NextResponse.redirect(`${origin}${next}`)
   }
   ```
   An attacker could pass `?next=@evil.com` resulting in `https://origin@evil.com` — a browser-interpreted open redirect.

2. **No allowed-path whitelist**: `next` should be validated against an allowlist of internal paths.

### 2.4 Login Page (src/app/(auth)/login/page.tsx)

**Missing features**:
1. No "Forgot password?" link — users cannot recover accounts
2. No password reset flow exists anywhere in the app

### 2.5 Dashboard Protection

| Route | Protection Mechanism | Status |
|-------|---------------------|--------|
| `/dashboard/*` | Proxy + `requireAuth()` in layout | ✅ Double protection |
| API routes | Per-route `getUser()` check | ✅ Individual protection |
| `/login` | Proxy redirects authenticated users | ✅ Working |

### 2.6 Session Refresh

The proxy uses `@supabase/ssr` cookie handling where `setAll()` writes to the response. When `getUser()` detects an expired access token, the SDK uses the refresh token to obtain new tokens and writes new cookies via `setAll()`.

**Assessment**: ✅ Session refresh is correctly configured via the proxy.

---

## 3. Auth-related Missing Features

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | **Open redirect vulnerability** | HIGH | `auth/callback/route.ts:15-16` |
| 2 | **No forgot password** | MEDIUM | Login page |
| 3 | **No logout button** | MEDIUM | Sidebar missing entirely |
| 4 | **No password reset API** | MEDIUM | No `/api/auth/reset` or Supabase reset flow wired up |

---

## 4. Decision

**Decision A — Keep proxy.ts and fix implementation.**

Rationale:
- `proxy.ts` is the correct file name for Next.js 16
- The Supabase SSR cookie pattern is correct
- Route protection is working (verified by Playwright tests)

Required fixes:
1. Harden auth callback against open redirect (validate `next` parameter)
2. Add forgot password link and reset flow
3. Add logout button to sidebar

These fixes will be implemented in subsequent phases.

---

## 5. Verification

- [x] Next.js 16 convention verified via official docs
- [x] proxy.ts export signature matches required pattern
- [x] Supabase SSR cookie propagation pattern confirmed correct
- [x] Matcher config properly excludes static assets
- [x] Playwright auth redirect test passes
- [x] Open redirect vulnerability confirmed via code review
- [ ] Forgot password: not implemented
- [ ] Logout: not implemented
