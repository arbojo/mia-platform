# Communication Layer — Verification Audit

**Date:** 2026-07-27
**Sprint:** 4
**Auditor:** Engineering Council (Orchestrator)

---

## Executive Summary

The Communication Layer has solid architecture and correct patterns, but has **3 critical issues** and **6 integration gaps** that prevent the end-to-end flow from working. The components are individually well-built, but they are not connected to each other or to the existing chat system.

**Verdict:** NOT production-ready. Requires targeted fixes before the chain can work.

---

## 1. Frontend Flow

### Status: Partially Working

| Check | Status | Detail |
|-------|--------|--------|
| `/dashboard/connections` loads | PASS | Page renders correctly with sidebar |
| ConnectionsManager fetches data | PASS | Client-side Supabase query works |
| Loading state resolves | PASS | Shows "Cargando conexiones..." then content |
| Empty state handled | PASS | Shows "No hay canales conectados" |
| Errors displayed to user | **FAIL** | Silent failures on create/delete |
| No silent failures | **FAIL** | `handleCreate` and `handleDelete` swallow errors |

### Issues Found

**F-1: No error feedback on create/delete (MEDIUM)**
- `ConnectionsManager.tsx:119` — `handleCreate` doesn't check `res.ok` for errors, doesn't show user feedback
- `ConnectionsManager.tsx:139` — `handleDelete` silently ignores failed requests
- No toast/notification system exists in the project

**F-2: Frontend bypasses API for reads (LOW)**
- `ConnectionsManager.tsx:83-94` — Queries `channel_connections` and `assistants` directly via client-side Supabase
- The GET `/api/channels/connections` endpoint exists but is never called
- This works via RLS, but creates two data paths (API vs direct)

---

## 2. API Flow

### Status: Working (with gaps)

| Endpoint | Auth | Ownership | Validation | Status |
|----------|------|-----------|------------|--------|
| GET `/api/channels/connections` | requireAuth via server client | RLS via `get_user_business_ids()` | N/A | PASS |
| POST `/api/channels/connections` | requireAuth via server client | Verifies `owner_id` before insert | Channel type + required fields | PASS |
| DELETE `/api/channels/connections` | requireAuth via server client | Verifies ownership before delete | connectionId required | PASS |
| POST `/api/channels/webhook/[channel]` | None (public) | N/A | Channel validation | PASS |
| GET `/api/channels/webhook/[channel]` | None (public) | N/A | WhatsApp verify token | PASS |

### Issues Found

**A-1: Unused GET endpoint (LOW)**
- `GET /api/channels/connections` is implemented but ConnectionsManager never calls it
- Frontend queries Supabase directly instead

**A-2: Webhook POST lacks businessId resolution (CRITICAL)**
- The webhook endpoint requires `businessId` in the request body metadata
- No external system knows the businessId — this creates a chicken-and-egg problem
- The webhook needs a connection-based resolution path (look up connection by channel + external credentials)

**A-3: No rate limiting on webhook (MEDIUM)**
- External providers (WhatsApp, Messenger) can flood the endpoint
- No throttling, no IP filtering, no request counting

---

## 3. Database Verification

### Status: Migration Exists But Not Applied

| Table | Migration | Applied Locally | Applied Remotely | RLS |
|-------|-----------|-----------------|------------------|-----|
| `channel_connections` | 005 | YES (local) | NO (remote) | PASS |
| `channel_messages` | 005 | YES (local) | NO (remote) | PASS |
| `conversations` | 001 | YES | YES | PASS |
| `customers` | 001 | YES | YES | PASS |
| `assistant_channels` | 001 | YES | YES | UNUSED |

### Issues Found

**D-1: Duplicate channel tables (MEDIUM)**
- Migration 001 creates `assistant_channels` (lines 130-137)
- Migration 005 creates `channel_connections` (lines 10-22)
- Both exist in the schema. Code uses `channel_connections` only.
- `assistant_channels` is dead schema — should be cleaned up eventually

**D-2: Migration 005 not applied remotely (BLOCKING)**
- Remote Supabase database does not have `channel_connections` or `channel_messages` tables
- `supabase_apply_migration` fails because remote DB lacks `businesses` table
- **All gateway DB operations will fail at runtime on the remote database**

**D-3: TypeScript types match migration (PASS)**
- `src/lib/types/index.ts` lines 631-724 — `channel_connections` and `channel_messages` types match migration 005 exactly
- All required columns present, correct types

---

## 4. Authentication Flow

### Status: Working

| Scenario | Expected | Actual | Status |
|----------|----------|--------|--------|
| Anonymous → `/dashboard/connections` | Redirect to `/login` | `requireAuth()` in layout redirects | PASS |
| Authenticated → page loads | See own connections only | RLS + client-side query | PASS |
| Authenticated → create connection | Verify business ownership | Server-side ownership check | PASS |
| Authenticated → delete connection | Verify ownership, then delete | Server-side ownership check | PASS |

### Issues Found

**None** — Auth flow is correctly implemented.

---

## 5. Environment Variables

### Status: Mostly Complete

| Variable | Required By | Present | Status |
|----------|-------------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | All Supabase ops | YES | PASS |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase | YES | PASS |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client (gateway) | YES | PASS |
| `OPENAI_API_KEY` | AI response generation | YES | PASS |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp webhook verification | NO | **MISSING** |

### Issues Found

**E-1: Missing WHATSAPP_VERIFY_TOKEN (LOW for now)**
- Referenced in `webhook/route.ts:61` — `process.env.WHATSAPP_VERIFY_TOKEN`
- Will cause 403 on WhatsApp webhook verification until configured
- Not blocking for web channel

**E-2: No channel credentials documented (LOW)**
- WhatsApp Cloud API requires: App ID, App Secret, Phone Number ID, Access Token
- No `.env` entries or documentation for these
- Adapter stubs return hardcoded values

---

## 6. End-to-End Simulation

### Test Flow: User creates Web Chat → Customer sends message → MIA responds

#### Step 1: User logs in
- **Status:** PASS
- Auth flow works correctly

#### Step 2: Opens MIA Connections
- **Status:** PASS
- Page loads, shows empty state

#### Step 3: Creates a Web Chat connection
- **Status:** PASS (if migration 005 applied)
- POST creates record in `channel_connections`
- Status set to `connected` for web channel

#### Step 4: Customer sends message via webhook
- **Status:** **BREAKS HERE**

The webhook POST calls `processIncomingMessage('web', body)`. The WebChatAdapter expects:
```json
{
  "message": "Hola, ¿tienen zapatos?",
  "customerId": "user-123",
  "businessId": "business-uuid"
}
```

**Problem:** Who sends this request? There is no web chat widget that calls the webhook endpoint. The existing `ChatWindow.tsx` calls `/api/chat/route.ts`, not `/api/channels/webhook/web`.

#### Step 5: Gateway processes message
- **Status:** Would work IF Step 4 worked
- Gateway correctly: normalizes message → resolves customer → finds assistant → builds context → calls OpenAI → saves to DB

#### Step 6: MIA generates response
- **Status:** Would work
- Uses same `buildMasterPrompt` and `getBusinessContext` as existing chat API
- Consistent prompt construction

#### Step 7: Message stored
- **Status:** Would work
- Stored in both `messages` (conversation history) and `channel_messages` (communication tracking)
- `last_interaction` updated on customer record

### Chain Break Summary

```
Step 1: Login ✓
Step 2: Open Connections ✓
Step 3: Create Connection ✓
Step 4: Webhook ← BROKEN — no frontend calls this endpoint
Step 5: Gateway ← BROKEN — depends on Step 4
Step 6: OpenAI ← BROKEN — depends on Step 4
Step 7: Storage ← BROKEN — depends on Step 4
```

**Root cause:** The Communication Gateway is a standalone backend with no integration point. The existing chat system (`/api/chat/route.ts` + `ChatWindow.tsx`) bypasses the gateway entirely.

---

## 7. Critical Bugs

### BUG-1: WhatsApp metadata missing businessId (CRITICAL)

**File:** `src/lib/channels/adapters/whatsapp.ts:51-53`

```typescript
metadata: {
  waId: message.from,
},
```

**Problem:** Gateway expects `metadata.businessId` (gateway.ts:36), but WhatsApp adapter doesn't include it. Every WhatsApp message will throw "businessId required in metadata".

**Impact:** WhatsApp channel is non-functional even if webhook is configured.

**Fix:** WhatsApp adapter needs to look up the connection record to resolve businessId from the incoming webhook's phone number or other identifier.

### BUG-2: No connection between gateway and existing chat (CRITICAL)

**Problem:** `ChatWindow.tsx` calls `/api/chat/route.ts` which uses Vercel AI SDK's `streamText()`. The gateway uses raw OpenAI client. They are completely separate systems.

**Impact:** Web channel messages never reach the gateway. The communication layer is unreachable from the UI.

**Options:**
- Option A: Update `ChatWindow.tsx` to call the webhook endpoint instead
- Option B: Update `/api/chat/route.ts` to use the gateway
- Option C: Build a new web chat widget that uses the gateway

### BUG-3: Gateway doesn't use streaming (CRITICAL)

**File:** `src/lib/channels/gateway.ts:137-141`

```typescript
const completion = await getOpenAIClient().chat.completions.create({
  model: MODEL,
  messages,
  max_tokens: 500,
})
```

**Problem:** Non-streaming response. The existing chat API uses `streamText()` for real-time response delivery. Gateway responses will have noticeable delay.

**Impact:** Poor UX for web channel. Acceptable for WhatsApp (async).

### BUG-4: Token cost hardcoded (LOW)

**File:** `src/lib/channels/gateway.ts:149`

```typescript
const cost = (tokensInput * 0.00015 + tokensOutput * 0.0006) / 1000
```

**Problem:** Existing chat API uses `TOKEN_COSTS` from `client.ts`. Gateway has hardcoded values.

**Impact:** Cost tracking inconsistency. Minor if values match.

---

## 8. Dead Code

| Function/Method | Location | Status |
|-----------------|----------|--------|
| `sendOutgoingMessage()` | gateway.ts:206-237 | Never called |
| `getStatus()` on adapters | web.ts:52, whatsapp.ts:76 | Never called |
| `GET /api/channels/connections` | connections/route.ts:6-37 | Never called by frontend |

---

## 9. Recommended Fixes (Priority Order)

### Priority 1 — Critical (must fix before Sprint 4 closes)

1. **Integrate gateway with existing chat system**
   - Update `ChatWindow.tsx` or `/api/chat/route.ts` to route through the gateway
   - This is the core integration gap

2. **Fix WhatsApp businessId resolution**
   - Add connection lookup by phone number or external identifier
   - Or require businessId in webhook URL path (`/api/channels/webhook/whatsapp?businessId=xxx`)

3. **Add streaming support to gateway**
   - Use Vercel AI SDK's `streamText()` instead of raw OpenAI client
   - Or accept non-streaming for non-web channels

### Priority 2 — Important (should fix)

4. **Add error feedback to ConnectionsManager**
   - Show toast/notification on create/delete success/failure
   - Add loading spinner instead of text

5. **Add rate limiting to webhook endpoint**
   - Basic IP-based throttling or request counting
   - Prevent abuse from external providers

6. **Clean up duplicate `assistant_channels` table**
   - Migration to drop unused table
   - Remove from TypeScript types

### Priority 3 — Nice to have

7. **Wire ConnectionsManager to use GET API endpoint**
   - Currently bypasses the API with direct Supabase queries
   - Consistent data path

8. **Add WHATSAPP_VERIFY_TOKEN to .env.example**
   - Document required environment variables for each channel

9. **Remove dead code**
   - `sendOutgoingMessage()`, `getStatus()` — or implement them

---

## 10. What Works Correctly

Despite the issues, the following are well-implemented:

- **Type system:** `ChannelAdapter` interface, `NormalizedMessage`, all types match DB schema
- **Adapter pattern:** Clean abstraction, easy to add new channels
- **Identity resolution:** Multi-strategy customer lookup (external ID → phone → email → create)
- **Auth flow:** Dashboard auth guard, API ownership verification, RLS policies
- **Prompt consistency:** Gateway uses same `buildMasterPrompt` as existing chat
- **DB schema:** Migration 005 is well-structured with proper indexes and RLS
- **Admin client usage:** Gateway correctly uses admin client for webhook operations (no auth context)

---

## 11. Files Analyzed

| File | Lines | Verdict |
|------|-------|---------|
| `src/lib/channels/types.ts` | 58 | PASS |
| `src/lib/channels/adapters/web.ts` | 55 | PASS |
| `src/lib/channels/adapters/whatsapp.ts` | 80 | BUG (no businessId) |
| `src/lib/channels/gateway.ts` | 237 | ISSUES (no streaming, hardcoded costs) |
| `src/lib/channels/identity.ts` | 114 | PASS |
| `src/app/api/channels/webhook/[channel]/route.ts` | 73 | PASS |
| `src/app/api/channels/connections/route.ts` | 159 | PASS |
| `src/components/connections/ConnectionsManager.tsx` | 256 | MINOR (no error feedback) |
| `src/app/dashboard/connections/page.tsx` | 15 | PASS |
| `src/lib/types/index.ts` | 735 | PASS |
| `supabase/migrations/005_channel_connections.sql` | 94 | PASS (not applied remotely) |
| `src/lib/auth.ts` | 23 | PASS |
| `src/lib/ai/knowledge.ts` | 80 | PASS |
| `src/lib/ai/prompts.ts` | 128 | PASS |
| `src/app/api/chat/route.ts` | 142 | REFERENCE (existing pattern) |
| `src/app/dashboard/layout.tsx` | 27 | PASS |
