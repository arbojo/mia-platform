# ADR-015: MIA Landings — Modular Monorepo, Concilium Agents and Mia Pixel

## Status

Accepted

## Date

2026-08-06

## Council

CTO, Architect, Domain Expert, Product Manager, Database Engineer, Backend Engineer, Frontend Engineer, Security Engineer, Performance Engineer, QA Engineer, Release Manager

---

## 1. Context

MIA is a Conversational Sales Intelligence platform (ADR-010). Businesses connect through the dashboard, the web widget, WhatsApp (ADR-013), and — increasingly — through **marketing landing pages** that drive leads and sales into the conversational core.

Today, landing pages are built independently (Clean Nails is a standalone Vite SPA deployed to Vercel) and talk to a non-existent MIA API surface (`/api/orders`, `/api/analytics/*`), meaning **orders and analytics events are silently lost**. Each landing also risks spinning up its own Supabase project, creating scattered data silos.

MIA needs a repeatable way to:
- Ship landing pages per tenant (business) without cross-contamination between them.
- Capture visitor behavior (pageviews, scroll, time-to-click, WhatsApp clicks) into MIA's Supabase.
- Let the dashboard read all metrics in one place and approve data-driven improvements.

A dedicated product line — **MIA Landings** — is a natural evolution of the platform: the landing page becomes the first touchpoint of the conversation, and its analytics feed the same Business → Assistant → Customer hierarchy.

## 2. Problem

Five problems must be solved:

1. **Structure**: the MIA repo is a single Next.js app. There is no place for shared code consumed by multiple apps, nor a factory app for landing pages.
2. **Data pipeline**: Clean Nails points its `api.ts` to `http://localhost:3000` and its own orphan Supabase project. No event reaches MIA.
3. **Measurement**: there is no unified visitor-tracking contract. Each landing would otherwise invent its own.
4. **Separation of tenants**: landings for different businesses must never leak data or prompts across tenants.
5. **Agent workflow**: the Concilium agents (Scout, Artemis, Glitch, Sanity, Vercel-Forge, Hook-Master, Sentinel) already exist as opencode subagents but have no formal commander and no documented per-tenant workflow.

## 3. Decision

### 3.1 Evolutionary modular monorepo (npm workspaces)

Convert the MIA repo to **npm workspaces** without moving the existing production app:

- `package.json` (root) gains `"workspaces": ["packages/*", "apps/*"]`.
- The current Next.js app **stays at the root** (`src/`, `app/`, `public/`) — it is production-deployed to `mia-platform-psi.vercel.app` and must not be disturbed.
- **`packages/core/`**: new shared TypeScript package for logic reused across apps (Supabase client factory, shared types, utilities).
- **`apps/mia-landings/`**: new Next.js app — the landing page factory for future tenants.

Rationale: a full restructure (moving `src/` into `apps/mia-platform/`) is high risk for zero short-term value. The evolutionary layer keeps production untouched while establishing the monorepo seams. Existing landings (Clean Nails, Vite) remain Vite SPAs; `apps/mia-landings` builds *new* landings.

### 3.2 Single Supabase home — Mia Pixel

All landing telemetry lives in **MIA Platform's Supabase**, not per-landing projects.

New migration `027_mia_pixel.sql` creates:

- `landing_visits` — one row per visit: `business_id`, `landing_id`, `landing_version`, `session_token`, device/UTM/referrer context, timestamps (`first_seen`, `last_seen`, `left_at`), bounce flag.
- `landing_events` — granular events: `business_id`, `visit_id`, `event_name` (`pageview`, `scroll_depth`, `time_to_click`, `whatsapp_click`, `cta_click`), `value` JSONB, `seconds_from_start`.

RLS scoped to business owner (same pattern as `sales_events`, migration 025). Public ingestion happens through a dedicated API route with the **admin client** (bypasses RLS server-side, consistent with the auth flow rules).

**`public/pixel.js`** — an ultra-light snippet (~2 KB) that:
- Tracks pageview, scroll depth (25/50/75/100%), time-to-click, and clicks on WhatsApp/CTA anchors.
- Self-ignores on `localhost` and when `localStorage.mia_mode === 'developer'`.
- Batches events and posts to `POST /api/pixel/track` (fire-and-forget, no cookies required, no fingerprinting).

**`/api/pixel/track`** — validates input with zod, resolves/creates the visit, inserts events via the admin client. Anonymous (no auth) by design; no PII is collected.

### 3.3 Clean Nails as the first real tenant

The Clean Nails landing (Vite SPA, `C:\clean nails landing`) is retrofitted in this sprint:
- Its `src/lib/insights/` and the orphaned `api.ts` MIA calls are replaced by the Mia Pixel snippet.
- `VITE_MIA_API_URL` is no longer needed.
- The widget stays as-is (it already works via `mia-platform-psi.vercel.app/widget.js`).

This is the fire-test for the pipeline: real visitors, real events, dashboard-read metrics.

### 3.4 Commander + Concilium agent workflow

- **Commander** (`.agents/commander.md`): the orchestrator for MIA Landings work. Never writes code. Delegates to the Concilium and isolates work per tenant via a **ProjectContext** (Vitanova vs Clean Nails never mix).
- **Concilium** (already exist): Scout (research), Artemis (UX/copy), Glitch (dynamics), Sanity (UX reality-check), Vercel-Forge (build), Hook-Master (data/leads integration), Sentinel (QA/deploy).
- Workflow per landing: `Commander (ProjectContext) → Scout/Artemis/Glitch (conceptualization) → Sanity (validation) → Vercel-Forge + Hook-Master (build/integration) → Sentinel (QA/deploy)`.

### 3.5 `apps/mia-landings` factory scope

The factory app (Fase 3, next sprint) will provide: block-based builder (hero, benefit, proof, CTA, FAQ, order), reusable templates, asset pipeline to WebP, custom HTML blocks, and per-tenant Vercel deploys. It consumes `packages/core` and the Mia Pixel by default. Clean Nails stays Vite; the factory serves future landings.

## 4. Consequences

### Positive

- Orders/analytics stop being silently lost — real data pipeline for Clean Nails today.
- One Supabase home for all landing metrics; dashboard reads them from a single source.
- Monorepo seams exist without touching the production app.
- Per-tenant isolation enforced by the Commander workflow and RLS by `business_id`.
- The Concilium's existing agents get a formal commander and documented workflow.

### Negative / Trade-offs

- The root Next.js app is a "virtual" workspace package for now — the layout is not fully aligned with the ideal `apps/mia-platform/` path yet (future sprint).
- Pixel ingestion is anonymous; cross-device attribution is limited to `session_token` (no fingerprinting, by design).
- Clean Nails retains its orphaned Supabase project (orders/analytics tables unused); decommissioning it is optional cleanup, not required for the pipeline to work.

## 5. References

- ADR-010 (Sales Domain Boundary) — landing analytics serve sales intelligence.
- ADR-011 (Evidence First Protocol).
- ADR-013 (WhatsApp Baileys Bridge) — precedent for a dedicated service with secret-based auth.
- `supabase/migrations/025_sales_events.sql` — RLS pattern reused by `027_mia_pixel.sql`.
- `src/app/api/widget/chat/route.ts` — existing anonymous admin-client API route pattern.
- `public/widget.js` — sibling static snippet served by MIA.
