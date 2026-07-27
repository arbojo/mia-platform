# Error Hunting Report

**Date**: 2026-07-27
**Agent**: Security Engineer + Performance Engineer + QA Engineer
**Status**: Multiple issues found

---

## Frontend Issues

### 1. ChatWindow state mutation (Medium)
**File**: `src/components/chat/ChatWindow.tsx:113`
**Problem**: Direct state mutation: `lastMsg.content = assistantContent`
**Impact**: React may not re-render correctly. Violates immutability principle.
**Fix**: Create new message array with updated content.

### 2. ChatWindow uses prompt() (Medium)
**File**: `src/components/chat/ChatWindow.tsx:192`
**Problem**: `prompt('¿Cuál es la respuesta correcta?')` blocks UI
**Impact**: Poor UX, browser-dependent, no validation
**Fix**: Replace with modal or inline input

### 3. ChatWindow requestType logic (Low)
**File**: `src/components/chat/ChatWindow.tsx:85`
**Problem**: `requestType: mode ? 'simulation' : 'live_customer'` — doesn't handle 'training'
**Impact**: Training mode sends wrong request type
**Fix**: Map mode to correct requestType

### 4. OnboardingWizard stores full personality object (Low)
**File**: `src/components/onboarding/OnboardingWizard.tsx:122`
**Problem**: `personality: selectedPersonality` stores entire preset object
**Impact**: Stores id, name, description — only warmth/formality/humor/sales_aggressiveness needed
**Fix**: Extract only numeric fields

### 5. LaboratorioClient cost never updates (Medium)
**File**: `src/components/laboratorio/LaboratorioClient.tsx:189`
**Problem**: `cost: prev.cost` — cost is never recalculated
**Impact**: Usage bar shows $0.0000 always
**Fix**: Calculate cost from token usage

## Backend Issues

### 6. Chat route doesn't validate assistant ownership (High)
**File**: `src/app/api/chat/route.ts:45-53`
**Problem**: Fetches assistant but doesn't verify `business_id` matches user
**Impact**: Any authenticated user can chat with any assistant
**Fix**: Verify assistant belongs to user's business

### 7. No rate limiting on chat API (Medium)
**File**: `src/app/api/chat/route.ts`
**Problem**: No rate limiting on POST /api/chat
**Impact**: Cost runaway, abuse potential
**Fix**: Add rate limiting per user/business

### 8. Training conversation created with admin client (Low)
**File**: `src/app/dashboard/assistants/[id]/training/page.tsx:44`
**Problem**: Uses admin client to bypass RLS for insert
**Impact**: Works but bypasses security model
**Fix**: Use server client with proper RLS policy

## Supabase Issues

### 9. No DELETE policy for assistants (Medium)
**File**: `supabase/migrations/001_initial_schema.sql`
**Problem**: Assistants have INSERT and UPDATE policies but no DELETE
**Impact**: Can't delete assistants via RLS
**Fix**: Add DELETE policy

### 10. No DELETE policy for conversations (Low)
**File**: `supabase/migrations/001_initial_schema.sql`
**Problem**: Conversations have no DELETE policy
**Impact**: Can't clean up old conversations
**Fix**: Add DELETE policy

### 11. customers.last_interaction never written (Medium)
**File**: `supabase/migrations/001_initial_schema.sql:154`
**Problem**: Column exists but no trigger or code updates it
**Impact**: Dashboard must join through messages table
**Fix**: Add trigger or update in chat route

## AI Issues

### 12. Prompt uses hardcoded Spanish (Low)
**File**: `src/lib/ai/prompts.ts:82-127`
**Problem**: System prompt is entirely in Spanish
**Impact**: Works for Vitanova but not for future SaaS multi-language
**Fix**: Parameterize language in prompt builder

### 13. No conversation history in prompt (Medium)
**File**: `src/app/api/chat/route.ts:64-72`
**Problem**: Only sends current messages, not full conversation history
**Impact**: Assistant has no memory of previous messages
**Fix**: Fetch conversation history from messages table

### 14. Token cost calculation has type casting (Low)
**File**: `src/app/api/chat/route.ts:80-81`
**Problem**: Complex type casting for usage tokens
**Impact**: Fragile, may break with AI SDK updates
**Fix**: Use typed usage response

## Summary

| Category | High | Medium | Low |
|----------|------|--------|-----|
| Frontend | 0 | 3 | 2 |
| Backend | 1 | 1 | 1 |
| Supabase | 0 | 2 | 1 |
| AI | 0 | 1 | 2 |
| **Total** | **1** | **7** | **6** |
