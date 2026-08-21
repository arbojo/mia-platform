# ADR-026: Super Admin Platform Dashboard

## Status

Proposed

## Date

2026-08-20

## Context

MIA is a multi-tenant platform designed for strict data isolation via Row Level Security (RLS) in PostgreSQL. Development has focused on individual tenant dashboards (`/dashboard/*`). However, as MIA transitions from a single-client product (Vitanova) to a multi-client SaaS ecosystem, a critical operational blind spot emerges: the absence of a Control Tower for the infrastructure operator (Super Admin).

When multiple businesses operate concurrently, the platform owner needs to answer global operational questions:

- **Bridge Control**: Which clients have active, disconnected, or QR-pending WhatsApp integrations?
- **Financial/Infrastructure Control**: How many tokens are client bots consuming in OpenAI and what is the real cost margin per tenant?
- **Onboarding Control**: Which clients are advancing through cognitive maturity stages and which are stuck?
- **Network Success Metrics**: What is the average global conversion rate across the ecosystem?

## Decision

Implement the **Super Admin Platform Dashboard** under the Platform/Core domain (ADR-025 §3.1), governed by four contractual principles:

1. **Physical Isolation vs. Ethical Aggregation**: The dashboard shows only technical, infrastructure, and aggregated transactional metrics. It is strictly prohibited from exposing raw messages, transcriptions, trade secrets, or tenant customer data.

2. **Restricted Access at Edge (Middleware & Guard)**: The view lives under `/dashboard/platform-admin`. The layout validates the session server-side. Data only renders if the authenticated user ID exactly matches the canonical platform owner ID (defined in environment variables).

3. **Centralized Administration API**: All REST queries travel under `/api/admin/platform/*`. Endpoints exclusively use the Supabase admin client (`createAdminClient()`) which safely bypasses RLS for cross-tenant SQL aggregations.

4. **"Quiet Chrome" Design Voice**: The panel uses the established platform aesthetic: uniform dark Slate backgrounds, glassmorphism cards with backdrop blur, and indigo accents.

### Schema Utilization (No New Tables)

All five required tables already exist in migrations:

| Table | Migration | Key Columns |
|-------|-----------|-------------|
| `businesses` | `001_initial_schema.sql` + `037_business_edition.sql` | `id, name, owner_id, edition, created_at` |
| `whatsapp_sessions` | `015_whatsapp_sessions.sql` | `business_id, status, phone, error_message, updated_at` |
| `ai_usage` | `001_initial_schema.sql` + `002` + `010` | `business_id, tokens_input, tokens_output, created_at` |
| `readiness_snapshots` | `006_readiness_index.sql` + `009` | `business_id, maturity_stage` (nullable) |
| `sales_events` | `025_sales_events.sql` | `business_id, event_type` (12 types) |

### Corrected Column Names (vs. Original PRD)

| PRD Spec | Actual DB Column | Source |
|----------|-----------------|--------|
| `prompt_tokens` / `completion_tokens` | `tokens_input` / `tokens_output` | `001_initial_schema.sql:248-257` |
| `total_tokens` (column) | Computed: `SUM(tokens_input + tokens_output)` | `047_analytics_schema.sql:119` |
| `businesses.industry` | Does not exist; use `businesses.edition` | `037_business_edition.sql` |
| `maturity_stage` always has value | Nullable; default to `'observation'` | `009_stage_based_learning.sql:15` |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/platform/overview` | GET | Business list + maturity stage + sales counts |
| `/api/admin/platform/channels` | GET | WhatsApp bridge session statuses |
| `/api/admin/platform/billing-telemetry` | GET | AI usage aggregation + cost estimation |

### Security Model

- `requirePlatformOwner()` guard: mirrors `requireDeliveryAdmin()` pattern (`src/lib/delivery/admin-api.ts:4-29`)
- Fail-closed: if `PLATFORM_OWNER_ID` env var is undefined, all requests denied
- `whatsapp_sessions` contains Baileys encryption keys (`creds` column) — never selected in queries
- All endpoints use `createAdminClient()` (service-role) for cross-tenant reads
- New `ApiForbiddenError` added to `src/lib/api-error.ts` for clean 403 responses

### Frontend Architecture

- **Server Component** (`page.tsx`): resolves auth via `requirePlatformOwner()`, renders Client Component
- **Client Component** (`PlatformAdminDashboard.tsx`): fetches from 3 endpoints via `Promise.all`
- **Sub-components**: `TenantTable` (onboarding + conversion monitoring), `BridgeMonitor` (WhatsApp status)
- **Aesthetic**: Quiet Chrome — `bg-slate-950`, `border-slate-800`, `backdrop-blur-xl`, indigo accents

## Consequences

### Positive
- Platform owner gains real-time visibility into tenant health, bridge status, and cost
- No new database tables required — fully leverages existing schema
- Security-first design with fail-closed auth and no sensitive data exposure
- Establishes the Platform/Core admin surface for future platform-level features

### Negative
- `PLATFORM_OWNER_ID` is a single-point-of-failure env var — must be set correctly in all environments
- Cross-tenant queries via admin client bypass RLS by design — the guard is the only authorization layer
- No real-time push for bridge status (polling only) — acceptable for v1

### Risks
- If `SUPABASE_SERVICE_ROLE_KEY` is compromised, the admin client can read all tenant data (existing risk, not introduced by this ADR)
- Cost calculation uses hardcoded gpt-4o-mini pricing — must be updated if model changes

## References

- ADR-025: Multi-Domain Architecture (`docs/adr/025-multi-domain-architecture.md`)
- ADR-010: Sales Domain Boundary (`docs/adr/010-sales-domain-boundary.md`)
- Migration 001: Core schema (`supabase/migrations/001_initial_schema.sql`)
- Migration 015: WhatsApp sessions (`supabase/migrations/015_whatsapp_sessions.sql`)
- Migration 025: Sales events (`supabase/migrations/025_sales_events.sql`)
- Migration 037: Business edition (`supabase/migrations/037_business_edition.sql`)
