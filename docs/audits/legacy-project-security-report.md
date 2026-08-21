# Security Report — Legacy Supabase Project

**Date**: 2026-08-01
**Status**: RESOLVED (2026-08-21)
**Agent**: Security Engineer (via governance workflow)
**Severity**: Critical

---

## Summary

During the Supabase CLI migration push for the Knowledge Media module (migration 016), it was discovered that the Supabase MCP server was pointed at a **legacy project** (`aveusacpaexwrfoyinas`), not the active production project (`hhitqgsaglddjkmaovbs`). While diagnosing the mismatch, the legacy project was found to have **10 tables without Row Level Security (RLS) enabled**, including a `_secrets` table.

---

## Evidence

| Item | Detail |
|------|--------|
| MCP project URL | `https://aveusacpaexwrfoyinas.supabase.co` |
| Active project URL | `https://hhitqgsaglddjkmaovbs.supabase.co` (per `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`) |
| Tables without RLS | 10 |
| Sensitive table exposed | `_secrets` |
| Full table list | `whatsapp_leads`, `lead_menu_sessions`, `delivery_sessions`, `bot_conversation_contexts`, `whatsapp_message_history`, `analytics_sessions`, `analytics_events`, `landing_versions`, `_secrets`, `event_log` |
| Detection method | `supabase_migrations` mismatch analysis + MCP `list_tables`/advisors on legacy project |

---

## Risk

- If the legacy project is still active or reachable with anon/publishable keys, any of the 10 tables without RLS can be read/written by unauthenticated clients.
- The `_secrets` table is a **critical data exposure**: secrets (API keys, credentials) stored in plaintext without RLS are accessible to anyone with the anon key.
- Cross-tenant / cross-project contamination risk if a client was ever pointed at the wrong URL.

---

## Recommendation

**Option A (preferred)** — If the legacy project is no longer in use:
- Delete the project entirely from the Supabase Dashboard.

**Option B** — If the legacy project must be retained:
- Enable RLS immediately on all 10 tables (at minimum deny-all until each table gets proper policies).
- Restrict the project to private, isolated environments using only the `service_role` key.
- Never expose the anon/publishable key for the legacy project.
- Migrate any still-needed data to the active project and decommission the legacy one.

---

## Remediation Tracking

| State | Owner | Target date | Resolution |
|-------|-------|-------------|------------|
| RESOLVED | Security Engineer | 2026-08-21 | Project deleted via `supabase projects delete aveusacpaexwrfoyinas` |
