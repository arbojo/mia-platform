# Supabase Security Advisors — Technical Debt Report

**Date**: 2026-08-04
**Author**: Security Engineer (MIA Agent System)
**Status**: Open

---

## Summary

After remediating the critical RLS exposure (see commit `9f6e3c6`, migration `026_legacy_tables_cleanup.sql`), the remaining findings from the Supabase Security Advisor are tracked here as technical debt. None of them are exploitable data-exposure errors; they are WARN/INFO hardening items that require product decisions before applying.

Reference: `supabase get_advisors` on project `hhitqgsaglddjkmaovbs` (Mia Lab), 2026-08-04.

---

## 1. Public bucket `knowledge-media` allows listing

| Field | Detail |
|-------|--------|
| **Advisor lint** | `public_bucket_allows_listing` (WARN) |
| **Affected** | Storage bucket `knowledge-media` — policy `knowledge_media_public_read` |
| **Priority** | **P2 — Medium** |

### Detail

The `knowledge-media` bucket is public so conditional media (ADR-014) can be served to customers without auth. The current policy is a broad `SELECT` on `storage.objects`, which lets any client **list all files** in the bucket, not just read the ones they have a URL for.

### Recommendation

Replace the broad `SELECT` policy with an anonymous read that does not expose `storage.objects` listing (e.g., serve via a public read policy scoped to `(bucket_id = 'knowledge-media')` and rely on unguessable object paths), or move to a signed-URL delivery model.

### Decision needed

Public-by-URL vs signed URLs. Impacts the WhatsApp bridge media dispatch and dashboard media management.

---

## 2. `SECURITY DEFINER` functions callable by `anon`/`authenticated`

| Advisor lint | `anon_security_definer_function_executable` / `authenticated_security_definer_function_executable` (WARN) |
| **Priority** | **P2 — Medium** |

### 2a. `public.get_user_business_ids()` — by design, low risk

- `supabase/migrations/001_initial_schema.sql:267`
- `SECURITY DEFINER`, `SET search_path = ''`, body: `SELECT id FROM public.businesses WHERE owner_id = auth.uid()`.
- Used by every RLS policy on the platform (`USING (business_id IN (SELECT get_user_business_ids()))`).
- For `anon` (no `auth.uid()`) the function returns an empty set, so it is not a leak.
- **Debt**: exposure of a `SECURITY DEFINER` function to `anon` is broader than necessary. Action: `REVOKE EXECUTE ON FUNCTION public.get_user_business_ids() FROM anon;` (keep `authenticated`), since `anon` never holds a business. Low risk, no behavior change.

### 2b. `public.handle_new_user()` — by design, harmless

- `supabase/migrations/017_profiles_demo.sql:19` / `018_auto_provision.sql`
- Trigger on `auth.users` (`on_auth_user_created`). As an RPC it takes no arguments and inserts a row for `new.id` which is null outside the trigger context → no-op.
- **Debt**: low. Optionally `REVOKE EXECUTE ... FROM anon, authenticated` to remove the public RPC surface.

### 2c. `public.increment_demo_interactions(uuid)` — minor abuse vector

- `supabase/migrations/017_profiles_demo.sql:41`
- `SECURITY DEFINER` SQL that increments `profiles.demo_interactions_used` for **any target_user**.
- Risk: any `anon`/`authenticated` client can burn another user's demo quota (rate-limit / quota DoS). Demo counter only affects `/demo`.
- **Debt**: tighten by (1) adding `WHERE id = auth.uid()` when the caller must only affect themselves, or (2) restricting EXECUTE and routing through an authenticated API route.

---

## 3. `whatsapp_sessions` — RLS enabled without policies

| Field | Detail |
|-------|--------|
| **Advisor lint** | `rls_enabled_no_policy` (INFO) |
| **Priority** | **P3 — Low** |

### Detail

`public.whatsapp_sessions` has RLS enabled but zero policies. All access goes through the `service_role` client in `services/whatsapp-bridge` (`supabase-store.ts`), which bypasses RLS, so the app works today.

### Recommendation

Add defensive policies scoped to the business (e.g., `business_owner_all`) so that `authenticated` dashboard users can view session state, and so accidental `anon`/`authenticated` grants stay locked down. Not required for current functionality.

---

## 4. Auth: leaked password protection disabled

| Field | Detail |
|-------|--------|
| **Advisor lint** | `auth_leaked_password_protection` (WARN) |
| **Priority** | **P2 — Medium** |

### Detail

Supabase Auth's HaveIBeenPwned check for compromised passwords is disabled in the project settings. Enabling it rejects signups/logins using known-breached passwords.

### Recommendation

Enable in Supabase Dashboard → Authentication → Security (one-click, no code). Requires an Auth admin decision; cannot be applied from the repository.

---

## 5. Actionable debt backlog

| # | Item | Priority | Action |
|---|------|----------|--------|
| 1 | `get_user_business_ids` EXECUTE to `anon` | P2 | `REVOKE EXECUTE ... FROM anon` (safe, no behavior change) |
| 2 | `handle_new_user` public RPC surface | P2 | `REVOKE EXECUTE ... FROM anon, authenticated` (safe) |
| 3 | `increment_demo_interactions` unbounded target | P2 | Restrict to `auth.uid()` or route via API |
| 4 | `knowledge-media` bucket listing | P2 | Narrow SELECT policy or signed URLs |
| 5 | Leaked password protection | P2 | Enable in Auth dashboard |
| 6 | `whatsapp_sessions` RLS policies | P3 | Add business-scoped defensive policies |

Items 1–3 can be applied as a single follow-up migration (`027_security_hardening.sql`); items 4–6 require product/ops decisions.
