# ADR-027: MIA Cloud Architecture

## Status

Proposed

## Date

2026-08-20

## Council

CTO, Architect, Domain Expert, Database Engineer, Backend Engineer, Security Engineer, Performance Engineer, QA Engineer, Release Manager

---

## 1. Context

MIA is a multi-tenant AI platform with a single codebase deployed as Vercel + Supabase + Fly.io (WhatsApp bridge). Today, the only production tenant is Vitanova (the team's own business). The platform is ready to accept additional clients — the schema, RLS, edition system, and auto-provisioning triggers already work — but there is no formal architecture for how a new client would onboard and operate **without touching infrastructure themselves**.

The core question: **How do we convert MIA from a self-hosted product (where Vitanova's team manages everything) into a managed SaaS platform where a new client registers, connects their channels, and starts using their own MIA without knowing or administering the underlying infrastructure — while preserving the Enterprise/self-hosted deployment model as a parallel option?**

### 1.1 Current Architecture Audit

#### 1.1.1 Database

| Aspect | Current State | Evidence |
|--------|--------------|----------|
| Supabase project | 1 shared project ("Mia Lab") | `.env.local` → `NEXT_PUBLIC_SUPABASE_URL` |
| Schemas | 4: `public`, `inventory`, `delivery`, `analytics` | Migrations 001, 020, 025, 047 |
| RLS policies | Present on all tenant tables, `FORCE ROW LEVEL SECURITY` on all schemas | `001_initial_schema.sql:12-14` |
| Tenant isolation | `get_user_business_ids()` SECURITY DEFINER function bridges JWT → tenant | `001_initial_schema.sql:74-100` |
| Admin client | `createAdminClient()` in `src/lib/supabase/admin.ts` bypasses RLS | 79 files import it |
| Auto-provisioning | Trigger `handle_new_user()` on `auth.users` → creates default business row | `018_auto_provision.sql:43-47` |

#### 1.1.2 WhatsApp Bridge

| Aspect | Current State | Evidence |
|--------|--------------|----------|
| Deployment | Single Node.js process on Fly.io (`mia-whatsapp-bridge`) | `bridge-fly.ps1:5` |
| Multi-tenancy | Single process, N sessions in memory keyed by `businessId` | `session-manager.ts:27` → `sessions = new Map()` |
| Persistence | Credentials stored in `whatsapp_sessions` Supabase table | `015_whatsapp_sessions.sql` → `creds jsonb` column |
| Session restoration | **Missing** — on boot, all sessions set to `DISCONNECTED` | `session-manager.ts:113` |
| Auth | **Shared secret** (`WHATSAPP_BRIDGE_SECRET`) — single key controls ALL sessions | `server.ts:58-61` |
| Graceful shutdown | **Deletes all credentials** for every session | `index.ts:30` → `manager.disconnect()` |
| Horizontal scaling | Impossible (in-memory state not shared) | Architecture constraint |

#### 1.1.3 Bridge Auth — Critical Finding

The bridge uses a **single shared secret** for 3 distinct auth surfaces:

```typescript
// HTTP API — server.ts:58-61
const authHeader = req.headers['x-mia-bridge-secret']
if (authHeader !== config.bridgeSecret) {
  json(res, 401, { error: 'Unauthorized' })
  return
}

// WebSocket — server.ts:157
if (!businessId || !token || !verifyToken(config.bridgeSecret, businessId, token)) {
  ws.close(4401, 'Unauthorized')
  return
}

// Webhook (bridge → MIA) — mia-client.ts:42
headers: {
  'x-mia-webhook-secret': config.bridgeSecret,
}
```

The current token mechanism is HMAC-based, not JWT:

```typescript
// server.ts:29-31
export function signSessionToken(secret: string, businessId: string): string {
  return createHmac('sha256', secret).update(businessId).digest('base64url')
}
```

This token has **no expiration**, **no audience separation**, **no revocation mechanism**, and **no replay protection**. A leaked secret gives full control over ALL tenants' WhatsApp sessions.

#### 1.1.4 Edition System

| Aspect | Current State | Evidence |
|--------|--------------|----------|
| Tiers | 4: `evaluation`, `professional`, `enterprise`, `cloud` | `edition.ts:40-45` |
| Resolution | `getEffectiveEdition(businessId)` — DB-first, env fallback | `edition.ts:365-382` |
| `cloudDeployment` flag | Defined in `EditionCapabilities`, only `true` for `cloud` | `edition.ts:23,194` |
| `cloudDeployment` usage | **Unused** — 0 components reference it | grep verified |

#### 1.1.5 Deployment

| Aspect | Current State | Evidence |
|--------|--------------|----------|
| Platform | Vercel CLI (`vercel --prod`) | Manual, no CI/CD |
| Bridge deploy | Fly.io (`flyctl deploy --ha=false`) | `bridge-fly.ps1:30` |
| Secrets | Same values replicated across app/bridge/Fly/scripts | No rotation mechanism |

#### 1.1.6 Legacy Infrastructure Risk

| Risk | Severity | Status | Evidence |
|------|----------|--------|----------|
| Legacy Supabase project `aveusacpaexwrfoyinas` | **CRITICAL** | OPEN | 10 tables WITHOUT RLS, `_secrets` table with plaintext credentials |

This is an independent pre-existing risk that must be resolved before opening the platform commercially.

### 1.2 What Exists Already (Cloud-Ready)

| Capability | Status | Source |
|------------|--------|--------|
| Tenant isolation via RLS | ✅ Production-proven | Migrations 001-047 |
| Auto-provisioning trigger | ✅ Works | `018_auto_provision.sql` |
| Multi-tier edition system | ✅ 4 tiers | `edition.ts` |
| WhatsApp bridge multi-tenant | ✅ Routes by businessId | `session-manager.ts` |
| Bridge credential persistence | ✅ whatsapp_sessions table | `015_whatsapp_sessions.sql` |
| Platform Admin dashboard | ✅ ADR-026 | `src/app/dashboard/platform-admin/` |
| Bridge health monitoring | ✅ ADR-026 | `BridgeMonitor.tsx` |
| Bridge reconnect action | ✅ ADR-026 v3 | `POST /api/admin/platform/actions/reconnect` |
| Live edition management | ✅ ADR-026 v3 | `POST /api/admin/platform/actions/update-edition` |

### 1.3 What Doesn't Exist Yet (Gaps)

| Gap | Severity | Description |
|-----|----------|-------------|
| Per-tenant auth for bridge | **CRITICAL** | Shared secret = Tenant A controls Tenant B's sessions |
| Session restoration on boot | **CRITICAL** | Bridge restart = all tenants must re-pair QR codes |
| Tenant lifecycle management | HIGH | No suspend, recover, or delete from Platform Admin |
| Hybrid provisioning | HIGH | No self-service or admin-assisted provisioning flow |
| `deploymentModel` flag | MEDIUM | `cloudDeployment` exists but unused |
| Secrets rotation | MEDIUM | No mechanism to rotate bridge secrets without downtime |
| Legacy Supabase cleanup | **CRITICAL** | Pre-existing risk, must resolve before Cloud launch |

---

## 2. Decision

**MIA Cloud is not a new product. It is MIA Core with architectural extensions that enable managed tenant operations.**

### 2.1 Core Statement

> MIA Cloud = MIA Core + Per-tenant JWT authentication for the WhatsApp Bridge + Session restoration on boot + Platform Admin lifecycle management + Hybrid provisioning model.
>
> The same codebase, the same database schema, the same RLS policies. The deployment model and bridge authentication change. The infrastructure topology is evaluated by the Council against the product promise.

### 2.2 The Extensions

| # | Extension | What it solves | Scope |
|---|-----------|---------------|-------|
| 1 | **Per-tenant JWT auth for bridge** | Cross-tenant WhatsApp access risk | HTTP API + WebSocket + Webhook |
| 2 | **Session restoration on boot** | Bridge restart destroys all connections | Bridge process |
| 3 | **Platform Admin lifecycle ops** | No suspend/recover/delete tenant | API + Frontend |
| 4 | **Hybrid provisioning model** | Self-service + admin override | API + Frontend + Payment |
| 5 | **Infrastructure topology** | Shared vs dedicated evaluation | Council decision |

### 2.3 Architecture Diagram

```
                        ┌─────────────────────────────────┐
                        │      MIA Platform (Vercel)       │
                        │                                  │
                        │  ┌────────────┐ ┌────────────┐  │
                        │  │ Tenant UI  │ │Platform UI │  │
                        │  │ (per-biz)  │ │(owner only)│  │
                        │  └─────┬──────┘ └─────┬──────┘  │
                        │        │              │          │
                        │  ┌─────▼──────────────▼──────┐  │
                        │  │    API Routes (Next.js)    │  │
                        │  │  /api/* (tenant-scoped)    │  │
                        │  │  /api/admin/* (platform)   │  │
                        │  └──────────┬─────────────────┘  │
                        └─────────────┼────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                   │
            ┌───────▼───────┐ ┌──────▼──────┐ ┌─────────▼─────────┐
            │  Supabase DB  │ │  Supabase   │ │ WhatsApp Bridge   │
            │  (per Council │ │  Auth       │ │ (Fly.io)          │
            │   decision)   │ │             │ │                   │
            │  RLS isolates │ │ JWT tokens  │ │ Per-tenant JWT    │
            │  tenants      │ │ per user    │ │ auth + businessId │
            └───────────────┘ └─────────────┘ │ routing           │
                                              └───────────────────┘
```

---

## 3. Tenant Model

### 3.1 Current Representation

```
auth.users (id, email, ...)
    ↓ owner_id (1:1)
businesses (id, name, edition, onboarding_status, created_at)
    ↓ business_id (1:N)
[15+ core tables] + [inventory.*] + [delivery.*] + [analytics.*]
```

### 3.2 Extended Representation for Cloud

```
auth.users (id, email, ...)
    ↓ owner_id (1:1)
businesses (id, name, edition, deployment_model, status, created_at)
    ↓ business_id (1:N)
whatsapp_sessions (business_id, status, phone, creds jsonb)
    ↓ business_id (1:N)
[15+ core tables] + [inventory.*] + [delivery.*] + [analytics.*]
```

### 3.3 New Fields in `businesses`

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `deployment_model` | `TEXT` | `'self-hosted'` | `'self-hosted'` / `'managed'` / `'dedicated'` |
| `status` | `TEXT` | `'active'` | `'active'` / `'suspended'` / `'deleted'` |

### 3.4 Tenant Lifecycle States

```
CREATE (auth.users + businesses row via trigger)
    ↓
PROVISION (edition assigned, deployment_model set)
    ↓
READY (tenant can use MIA)
    ↓
RUNNING (normal operation)
    ↓
UPDATE (edition change, config change)
    ↓
SUSPEND (status = 'suspended' → disconnect WhatsApp → RLS blocks access)
    ↓
RECOVER (status = 'active' → reconnect WhatsApp → access restored)
    ↓
DELETE (ON DELETE CASCADE removes all data)
```

---

## 4. Infrastructure Model

### 4.1 Council Evaluation Required

The Council must evaluate these 3 infrastructure models against the product promise:

> "El cliente consume MIA sin administrar infraestructura. MIA administra automáticamente sus recursos."

| Model | Infrastructure | Isolation | Cost/Tenant | Blast Radius | Client Experience |
|-------|---------------|-----------|-------------|--------------|-------------------|
| **A: Shared Everything** | 1 Supabase, 1 Vercel, 1 Fly | Logical (RLS) | ~$0 fixed | 1 shared process = all affected | "I don't know what's underneath" |
| **B: Dedicated DB, Shared Runtime** | N Supabase, 1 Vercel, 1 Fly | Physical (DB) | ~$25×N | DB isolated, runtime shared | "I have my own database" |
| **C: Dedicated Everything** | N Supabase, N Vercel, N Fly | Physical (all) | ~$100×N | 1 tenant = 1 bubble | "Everything is mine" |

### 4.2 Evaluation Criteria

The Council must assess each model against:

| Criterion | Weight | Question |
|-----------|--------|----------|
| **Security** | HIGH | Does the model prevent cross-tenant access? |
| **Blast Radius** | HIGH | If one component fails, how many tenants are affected? |
| **Scalability** | MEDIUM | Can the model scale to 100+ tenants? |
| **Cost** | MEDIUM | What is the cost per tenant at 10, 50, 100 tenants? |
| **Operational Complexity** | MEDIUM | How many distinct infrastructure components must be managed? |
| **Client Experience** | HIGH | Does the client perceive dedicated resources? |
| **Enterprise Readiness** | HIGH | Can an enterprise tenant demand isolation? |
| **Evolution Path** | LOW | Can we start with A and evolve to B/C without rewriting? |

### 4.3 Evolution Path (After Council Decision)

```
Phase 1: Council decides initial model (A, B, or C)
Phase 2: Implement with chosen model
Phase 3: If starting with A, define trigger points for evolution to B
Phase 4: Enterprise tenants may require C from day one
```

---

## 5. WhatsApp Bridge — JWT Authentication Architecture

### 5.1 Problem

The current shared secret (`WHATSAPP_BRIDGE_SECRET`) is a single key that controls ALL WhatsApp sessions across ALL tenants. The current token mechanism is HMAC-based with no expiration, no audience, and no revocation. A leaked secret gives full control over every tenant's WhatsApp connections.

### 5.2 Solution: Platform-signed JWT Tokens

**Library choice:** `jose` (lightweight, edge-compatible, no native dependencies).

#### 5.2.1 Token Structure

```typescript
interface BridgeJWT {
  sub: string        // businessId — the tenant this token is scoped to
  aud: string        // "bridge-api" | "bridge-ws" | "bridge-webhook"
  iss: string        // "mia-platform"
  exp: number        // 24h expiry
  iat: number        // issued at
  jti: string        // unique token ID for revocation
}
```

#### 5.2.2 Three Audiences

| Audience | Use Case | Current Equivalent |
|----------|----------|-------------------|
| `bridge-api` | HTTP API calls (start, status, reconnect, send) | `x-mia-bridge-secret` header |
| `bridge-ws` | WebSocket connections for real-time events | `?token=` query param |
| `bridge-webhook` | Bridge → MIA webhook calls | `x-mia-webhook-secret` header |

#### 5.2.3 Token Lifecycle

```
1. Platform signs JWT with businessId + audience + 24h expiry
2. Token delivered to client (for WS) or stored in bridge config (for API/webhook)
3. Bridge verifies: signature → expiry → audience → businessId
4. After 24h: token expires, platform generates new one
5. Revocation: maintain a short-lived revocation set (jti list) in memory
```

#### 5.2.4 Security Properties

| Property | Before (HMAC) | After (JWT) |
|----------|---------------|-------------|
| Cross-tenant access | Shared secret = any tenant can access any session | JWT scoped to businessId = impossible |
| Expiration | Never expires | 24h auto-expiry |
| Audience | Same key for all 3 uses | Separate audience per use case |
| Revocation | Impossible without bridge restart | Revoke by jti |
| Replay protection | None | jti + short-lived expiry |

### 5.3 Bridge Changes Required

| Change | Current | Proposed |
|--------|---------|----------|
| HTTP auth | `x-mia-bridge-secret` header (shared secret) | JWT in `Authorization: Bearer <token>` header |
| WebSocket auth | `?token=` (HMAC) | `?token=` (JWT with `aud: bridge-ws`) |
| Webhook auth | `x-mia-webhook-secret` (shared secret) | JWT in `X-MIA-Token` header |
| Token verification | `verifyToken(secret, businessId, token)` HMAC | `jwtVerify(token, publicKey, { audience, issuer })` |
| Key management | Single `WHATSAPP_BRIDGE_SECRET` env var | `PLATFORM_JWT_PRIVATE_KEY` (sign) + `PLATFORM_JWT_PUBLIC_KEY` (verify) |

### 5.4 Migration Strategy

1. Bridge supports BOTH old (HMAC) and new (JWT) auth during transition
2. Platform starts issuing JWTs
3. After all clients migrated, HMAC support is deprecated
4. HMAC is removed in a future release

---

## 6. Session Restoration on Boot

### 6.1 Problem

When the bridge process restarts (deploy, crash, Fly.io scaling), it iterates all `whatsapp_sessions` and sets them to `DISCONNECTED`. Every tenant must manually re-pair their QR code.

### 6.2 Solution: Auto-Reconnect on Boot

```typescript
// session-manager.ts — proposed change
async restoreAllSessions(): Promise<void> {
  const sessions = await getAllSessions(); // from whatsapp_sessions table
  for (const sess of sessions) {
    if (sess.status === 'connected' && sess.creds) {
      const reconnectResult = await this.reconnectSession(sess.businessId);
      if (reconnectResult.success) {
        await updateSessionStatus(sess.businessId, 'connected');
      } else {
        await updateSessionStatus(sess.businessId, 'disconnected');
      }
    }
  }
}
```

### 6.3 Behavior Matrix

| Scenario | Before (Current) | After (Proposed) |
|----------|-------------------|------------------|
| Bridge deploy | All sessions DISCONNECTED, user re-pairs | Auto-reconnect from stored creds |
| Bridge crash | All sessions DISCONNECTED | Auto-reconnect from stored creds |
| Creds valid | User must scan QR again | Automatic reconnection |
| Creds invalid | User must scan QR again | Status → DISCONNECTED, user re-pairs |
| First boot (no creds) | No sessions | No sessions |

### 6.4 Graceful Shutdown Change

**Current behavior** (`index.ts:30` → `session-manager.ts:691-706`):
```typescript
async disconnect(businessId: string): Promise<void> {
  // Deletes ALL credentials
  await this.store.delete(businessId)
}
```

**Proposed behavior:**
```typescript
async gracefulShutdown(): Promise<void> {
  // Only close sockets, preserve credentials
  for (const sess of sessions) {
    await closeSocket(sess.businessId)
    await updateSessionStatus(sess.businessId, 'disconnected')
  }
}
```

---

## 7. Tenant Lifecycle Management

### 7.1 Core Principle: Suspension = Disconnection

When a tenant is suspended (by abuse, non-payment, or admin action):

```
SUSPEND:
1. UPDATE businesses SET status = 'suspended' WHERE id = X
2. UPDATE whatsapp_sessions SET status = 'suspended' WHERE business_id = X
3. manager.disconnect(businessId) — destroy active socket
4. Preserve credentials in whatsapp_sessions.creds for re-activation
5. RLS blocks all reads/writes for this tenant
6. API routes return 403 for suspended tenants
```

**Rationale:** A suspended tenant must not consume resources (sockets, connections, messages) or maintain active communication channels. Credentials are preserved so re-activation does not require re-pairing.

### 7.2 API Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/admin/platform/tenants` | GET | List all tenants with status | `requirePlatformOwner()` |
| `/api/admin/platform/tenants/provision` | POST | Provision tenant (hybrid) | `requirePlatformOwner()` |
| `/api/admin/platform/tenants/suspend` | POST | Suspend tenant + disconnect WhatsApp | `requirePlatformOwner()` |
| `/api/admin/platform/tenants/recover` | POST | Recover suspended tenant | `requirePlatformOwner()` |
| `/api/admin/platform/tenants/delete` | POST | Soft-delete tenant | `requirePlatformOwner()` |

### 7.3 Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `TenantLifecyclePanel` | `src/components/platform-admin/` | Suspend/Recover/Delete buttons per tenant |
| `ProvisioningWizard` | `src/components/platform-admin/` | Create + provision new tenant |
| Extended `TenantTable` | `src/components/platform-admin/TenantTable.tsx` | Status column + action buttons |

---

## 8. Provisioning Model

### 8.1 Hybrid Approach

The provisioning system must support two coexisting paths:

| Path | Trigger | Audience | Use Case |
|------|---------|----------|----------|
| **Self-Service** | Payment gateway webhook | Mass users | Individual businesses signing up online |
| **Admin Override** | Platform Admin action | B2B sales, PoCs, pilots | Consultative sales, pilot programs |

### 8.2 Self-Service Flow (Automated)

```
1. Customer visits MIA website
2. Customer selects plan (evaluation / professional / enterprise / cloud)
3. Customer pays via payment gateway
4. Payment webhook triggers:
   a. Create auth.users (or use existing)
   b. Trigger creates businesses row (auto)
   c. SET edition = plan chosen
   d. SET deployment_model = 'managed'
   e. SET status = 'active'
   f. Create default assistant
   g. Generate bridge JWT
5. Customer receives email with login link
6. Customer goes through onboarding wizard
7. Customer connects WhatsApp (QR pairing with JWT)
8. MIA ready
```

### 8.3 Admin Override Flow (Manual)

```
1. Customer contacts MIA sales team
2. Platform Admin creates account (or customer signs up)
3. Platform Admin sees new tenant in dashboard
4. Platform Admin assigns edition via dropdown (ADR-026 v3)
5. Platform Admin clicks "Provision"
6. System:
   a. Sets deployment_model = 'managed'
   b. Sets status = 'active'
   c. Creates default assistant
   d. Generates bridge JWT
   e. Returns provisioning status
7. Customer goes through onboarding wizard
8. Customer connects WhatsApp
9. MIA ready
```

### 8.4 Coexistence

Both paths produce the same result: a provisioned tenant ready for onboarding. The difference is who triggers step 4. Self-service is fully automated; admin override requires human action.

### 8.5 Provisioning API

```typescript
// POST /api/admin/platform/tenants/provision
{
  "businessId": "abc-123",
  "edition": "professional",
  "deploymentModel": "managed"
}

// Response
{
  "success": true,
  "tenant": {
    "id": "abc-123",
    "edition": "professional",
    "deploymentModel": "managed",
    "status": "active",
    "bridgeToken": "eyJ...",        // JWT for bridge (24h)
    "bridgeUrl": "wss://mia-whatsapp-bridge.fly.dev"
  }
}
```

---

## 9. Secrets Management

### 9.1 Current Secret Inventory

| Secret | Where Used | Blast Radius |
|--------|-----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | App, Bridge, Fly | Full DB access |
| `SUPABASE_URL` | App, Bridge | Infra reference |
| `SUPABASE_ANON_KEY` | App | Public API |
| `SUPABASE_JWT_SECRET` | App (auth) | Token verification |
| `OPENAI_API_KEY` | App (LLM) | All AI calls |
| `WHATSAPP_BRIDGE_SECRET` | App, Bridge, Fly | All WhatsApp sessions |
| `DRIVER_SESSION_SECRET` | App (delivery) | Delivery auth |

### 9.2 Proposed Secret Architecture

```
Platform-managed (MIA controls):
├── SUPABASE_SERVICE_ROLE_KEY → App + Bridge
├── SUPABASE_URL → App + Bridge
├── SUPABASE_ANON_KEY → App
├── SUPABASE_JWT_SECRET → App (auth)
├── OPENAI_API_KEY → App (shared for all tenants)
├── PLATFORM_JWT_PRIVATE_KEY → Platform (signs bridge JWTs)
├── PLATFORM_JWT_PUBLIC_KEY → Bridge (verifies JWTs)
├── DRIVER_SESSION_SECRET → App (delivery)
└── MIA_EDITION → App (default)

Tenant-managed (client controls):
├── WhatsApp Business number → Client pairs via QR
└── (Future) Meta Business API credentials
```

### 9.3 OpenAI Key Strategy

| Model | Description | Pros | Cons |
|-------|-------------|------|------|
| **Shared** (MVP) | 1 key, all tenants | Simple, bulk pricing | One tenant's abuse affects all |
| Per-tenant | Each tenant gets own key | Full isolation | Complex management |
| Hybrid | Shared default, per-tenant override | Flexibility | Implementation complexity |

**MVP choice:** Shared OpenAI key with per-tenant usage tracking via `ai_usage` table.

---

## 10. Deployment Model

### 10.1 `deploymentModel` Flag

Replace the unused `cloudDeployment: boolean` with a proper enum:

```typescript
type DeploymentModel = 'self-hosted' | 'managed' | 'dedicated';

// In businesses table:
ALTER TABLE businesses ADD COLUMN deployment_model TEXT
  DEFAULT 'self-hosted'
  CHECK (deployment_model IN ('self-hosted', 'managed', 'dedicated'));
```

### 10.2 Resolution Logic

```typescript
function getEffectiveDeploymentModel(businessId: string): DeploymentModel {
  // 1. Business override (DB)
  const business = getBusiness(businessId);
  if (business?.deployment_model) return business.deployment_model;

  // 2. Edition default
  const edition = getEffectiveEdition(businessId);
  if (edition === 'cloud') return 'managed';
  if (edition === 'enterprise') return 'self-hosted';

  // 3. Default
  return 'self-hosted';
}
```

### 10.3 Enterprise vs Cloud

| Aspect | Enterprise | Cloud |
|--------|-----------|-------|
| Deployment | Customer-managed | MIA-managed |
| Secrets | Customer-managed | MIA-managed (except WhatsApp) |
| Bridge | Customer-deployed | Shared platform bridge |
| DB | Customer Supabase project | Shared Supabase project |
| Edition | `enterprise` | `cloud` |
| `deploymentModel` | `self-hosted` | `managed` |
| MIA Core | **Same codebase** | **Same codebase** |

---

## 11. Security Threat Model

| Threat | Blast Radius | Current Mitigation | Proposed Mitigation |
|--------|-------------|-------------------|-------------------|
| Cross-tenant data leak (DB) | 1 tenant | RLS + FORCE RLS ✅ | No change needed |
| Cross-tenant WhatsApp access | **ALL tenants** | Shared secret ❌ | Per-tenant JWT ✅ |
| Compromised runtime | **ALL tenants** | RLS limits data access | + Rate limiting |
| Secrets leak | **ALL tenants** | git-crypt ✅ | + Secrets rotation |
| Admin access abuse | **ALL tenants** | PLATFORM_OWNER_ID check ✅ | + Audit log |
| Compromised OpenAI key | **ALL tenants** (cost) | Usage tracking ✅ | + Per-tenant token caps |
| Bridge restart = all sessions down | **ALL tenants** | Manual re-pair ❌ | Session restoration ✅ |
| Tenant abuse (spam, abuse) | 1 tenant | None | Suspend/recover ✅ |

### 11.1 Legacy Supabase Project (Prerequisite)

The legacy Supabase project `aveusacpaexwrfoyinas` contains:
- 10 tables **without RLS**
- `_secrets` table with **plaintext credentials**
- Status: **OPEN** — documented in `docs/audits/legacy-project-security-report.md`

**This must be resolved BEFORE opening the platform commercially.** Options:
1. Delete the legacy project entirely
2. Enable RLS on all tables and rotate all exposed credentials
3. Migrate any needed data to the active project and decommission

---

## 12. Billing / Resource Economics

### 12.1 Cost Drivers Per Tenant

| Resource | Metric | Estimated Cost |
|----------|--------|---------------|
| LLM (OpenAI) | `ai_usage.tokens_input + tokens_output` | ~$0.15/1M input tokens |
| WhatsApp | Active connections × time | Fly.io machine time |
| Runtime | Vercel function invocations | ~$0.000018/invocation |
| Database | Supabase plan (shared) | ~$25/mes fijo |
| Storage | Supabase storage (knowledge media) | ~$0.021/GB |
| Bandwidth | Vercel + Fly.io | ~$0.15/GB |

### 12.2 Metrics That Must Exist

| Metric | Status | Source |
|--------|--------|--------|
| AI usage per tenant | ✅ Exists | `ai_usage` table |
| WhatsApp status per tenant | ✅ Exists | `whatsapp_sessions` table |
| Edition per tenant | ✅ Exists | `businesses.edition` |
| Deployment model | ⏳ New | `businesses.deployment_model` |
| Runtime compute hours | ❌ Missing | Future: Vercel analytics |
| Storage usage | ❌ Missing | Future: Supabase storage API |
| Bandwidth | ❌ Missing | Future: Vercel analytics |

### 12.3 Future Pricing Tiers

```
Starter ($0):      evaluation edition, 1000 conversations, webchat only
Professional ($49): professional edition, WhatsApp, 3 assistants
Enterprise ($199):  enterprise edition, delivery + inventory
Cloud (custom):     managed infrastructure, SLA, dedicated resources
```

---

## 13. Scalability Analysis

### 13.1 Growth Phases

| Phase | Tenants | Strategy |
|-------|---------|----------|
| **MVP** | 1-10 | Shared everything. 1 Vercel, 1 Supabase, 1 Bridge |
| **Growth** | 10-100 | Monitoring. Possible bridge sharding |
| **Scale** | 100-1000 | Bridge horizontal with session-affinity. DB read replicas |
| **Enterprise** | 1000+ | Dedicated resources per high tier. Schema-per-tenant option |

### 13.2 Bottlenecks

| Bottleneck | Limit | Mitigation |
|------------|-------|-----------|
| Bridge memory | ~500 sessions per Fly.io machine | Horizontal scaling with session-affinity |
| RLS overhead | `get_user_business_ids()` per row | Indexed function; materialized for large tenants |
| Admin client contention | 79 call sites | Review for unnecessary cross-tenant reads |
| Vercel function limits | Cold starts on shared runtime | Keep functions warm; edge functions |

---

## 14. Minimal Cloud MVP — Implementation Plan

### 14.1 Phase 0: Prerequisites

| # | Task | Description | Effort |
|---|------|-------------|--------|
| 0a | Clean legacy Supabase project | Resolve `aveusacpaexwrfoyinas` (delete, enable RLS, or decommission) | Medium |
| 0b | Audit admin-client call sites | Review 79 `createAdminClient()` usages for unnecessary cross-tenant reads | Medium |

### 14.2 Phase 1: Core

| # | Task | Files | Effort |
|---|------|-------|--------|
| 1 | Add `deployment_model` + `status` columns | Migration, `edition.ts` | Small |
| 2 | JWT auth for bridge (HTTP + WS + webhook) | `src/lib/platform/jwt.ts`, `session-manager.ts`, `server.ts`, `mia-client.ts` | Large |
| 3 | Session restoration on boot | `session-manager.ts` | Medium |
| 4 | Graceful shutdown (don't delete creds) | `session-manager.ts`, `index.ts` | Small |

### 14.3 Phase 2: Admin

| # | Task | Files | Effort |
|---|------|-------|--------|
| 5 | Tenant lifecycle API (suspend/recover/delete) | `src/app/api/admin/platform/tenants/suspend/route.ts`, `recover/route.ts`, `delete/route.ts` | Medium |
| 6 | Tenant list API | `src/app/api/admin/platform/tenants/route.ts` | Small |
| 7 | Provisioning API (hybrid) | `src/app/api/admin/platform/tenants/provision/route.ts` | Medium |
| 8 | Frontend: TenantLifecyclePanel | `src/components/platform-admin/TenantLifecyclePanel.tsx` | Medium |
| 9 | Frontend: ProvisioningWizard | `src/components/platform-admin/ProvisioningWizard.tsx` | Medium |
| 10 | Extend TenantTable with status + actions | `src/components/platform-admin/TenantTable.tsx` | Small |

### 14.4 Phase 3: Tests

| # | Task | Files | Effort |
|---|------|-------|--------|
| 11 | Security tests for all new endpoints | `tests/platform-admin.test.ts` | Medium |

### 14.5 Dependency Graph

```
Phase 0: Task 0a, 0b (prerequisites, no code dependency)
    ↓
Phase 1: Task 1 → Task 2 → Tasks 3, 4
    ↓
Phase 2: Tasks 5, 6, 7 → Tasks 8, 9, 10
    ↓
Phase 3: Task 11 (after all above)
```

---

## 15. What NOT to Build Yet

| Item | Why Not |
|------|---------|
| Separate Supabase per tenant | Shared DB + RLS works for <100 tenants; separate DB = 10x cost |
| Schema-per-tenant | Complexity not justified until >100 tenants |
| Dedicated bridge per tenant | Shared bridge with JWT auth is sufficient for MVP |
| CI/CD automation | Manual deploy is fine for <10 tenants |
| Rate limiting | Not critical until abuse is observed |
| Multi-region deployment | Not needed until international tenants |
| Self-service provisioning (payment integration) | Admin override is sufficient for MVP; payment gateway is a separate project |

---

## 16. Consequences

### Positive

- New clients can onboard without touching infrastructure
- Same codebase serves both Enterprise and Cloud customers
- Platform Admin gains full tenant lifecycle control
- WhatsApp bridge is secured with per-tenant JWT tokens
- Bridge survives restarts without destroying all sessions
- RLS-based isolation is proven and requires no changes
- Cost is predictable (shared infrastructure, per-tenant tracking)
- Hybrid provisioning serves both mass-market and B2B sales

### Negative

- Shared bridge = blast radius if bridge is compromised (mitigated by JWT)
- Shared DB = all tenants share Supabase limits
- Platform Admin is single-point-of-failure (1 owner)
- JWT token management adds complexity to bridge
- Session restoration may fail for some tenants (credential expiry)
- Hybrid provisioning requires payment gateway integration (future work)

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Bridge compromise affects all tenants | Low | High | Per-tenant JWT + monitoring |
| RLS bypass via admin client | Low | Critical | Audit 79 call sites |
| Session restoration fails silently | Medium | Medium | Health check + alerting |
| OpenAI key abuse by tenant | Low | Medium | Per-tenant usage caps |
| Vercel deployment breaks all tenants | Low | High | Staged rollout capability |
| Legacy Supabase project exploited | Medium | Critical | Resolve before Cloud launch |

---

## 17. References

- ADR-025: Multi-Domain Architecture (`docs/adr/025-multi-domain-architecture.md`)
- ADR-026: Super Admin Platform Dashboard (`docs/adr/026-super-admin-platform-dashboard.md`)
- ADR-019: Delivery Hub (`docs/adr/019-delivery-hub.md`)
- ADR-020: Inventory Hub (`docs/adr/020-inventory-hub.md`)
- ADR-013: WhatsApp Baileys Bridge (`docs/adr/013-whatsapp-baileys-bridge.md`)
- Migration 001: Core schema (`supabase/migrations/001_initial_schema.sql`)
- Migration 015: WhatsApp sessions (`supabase/migrations/015_whatsapp_sessions.sql`)
- Migration 018: Auto-provisioning (`supabase/migrations/018_auto_provision.sql`)
- Migration 037: Business edition (`supabase/migrations/037_business_edition.sql`)
- `src/lib/system/edition.ts` — Edition system
- `src/lib/supabase/admin.ts` — Admin client
- `services/whatsapp-bridge/src/session-manager.ts` — Bridge session management
- `services/whatsapp-bridge/src/server.ts` — Bridge HTTP/WS server
- `services/whatsapp-bridge/src/mia-client.ts` — Bridge → MIA webhook
- `docs/audits/legacy-project-security-report.md` — Legacy Supabase risk
- `src/components/platform-admin/` — Platform Admin UI

---

## 18. File Impact Matrix

| File | Change Type | Description |
|------|------------|-------------|
| `supabase/migrations/0XX_cloud_architecture.sql` | **New** | Add `deployment_model`, `status` columns to `businesses` |
| `src/lib/system/edition.ts` | Modify | Add `DeploymentModel` type, `getEffectiveDeploymentModel()` |
| `src/lib/platform/jwt.ts` | **New** | JWT signing/verification for bridge (`jose` library) |
| `services/whatsapp-bridge/src/session-manager.ts` | Modify | JWT auth, session restoration, graceful shutdown |
| `services/whatsapp-bridge/src/server.ts` | Modify | JWT verification for HTTP + WS |
| `services/whatsapp-bridge/src/mia-client.ts` | Modify | JWT for webhook auth |
| `services/whatsapp-bridge/src/config.ts` | Modify | Add JWT key config |
| `src/app/api/admin/platform/tenants/route.ts` | **New** | List tenants endpoint |
| `src/app/api/admin/platform/tenants/provision/route.ts` | **New** | Provision tenant endpoint |
| `src/app/api/admin/platform/tenants/suspend/route.ts` | **New** | Suspend tenant endpoint |
| `src/app/api/admin/platform/tenants/recover/route.ts` | **New** | Recover tenant endpoint |
| `src/app/api/admin/platform/tenants/delete/route.ts` | **New** | Delete tenant endpoint |
| `src/components/platform-admin/TenantLifecyclePanel.tsx` | **New** | Suspend/Recover/Delete UI |
| `src/components/platform-admin/ProvisioningWizard.tsx` | **New** | Provisioning form |
| `src/components/platform-admin/TenantTable.tsx` | Modify | Add status column + action buttons |
| `tests/platform-admin.test.ts` | Modify | Add security tests for new endpoints |
| `package.json` | Modify | Add `jose` dependency |

---

*Document generated by the MIA Platform Engineering Council — ADR-027*
