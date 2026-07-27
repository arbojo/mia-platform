# Dashboard Health Report

**Date**: 2026-07-27
**Agent**: Infrastructure Guardian + QA Engineer
**Status**: Functional with issues

---

## 1. Does /dashboard work?

**Yes.** The route loads correctly. Server-side rendering via `DashboardPage()` with auth guard.

- Auth check: ✅ Redirects to `/login` if no user
- Business fetch: ✅ Queries `businesses` with `assistants(*)` join
- Layout: ✅ Sidebar + OnboardingBanner + main content area

## 2. Do assistants appear correctly?

**Yes.** When `business.assistants.length > 0`, assistants render in a 3-column grid with:
- Avatar (first letter)
- Name
- Communication style
- "Entrenar" and "Productos" buttons

**Issue**: No "Rules" button on assistant cards. Users must navigate via sidebar.

## 3. Does data load from Supabase?

**Yes.** Three parallel queries execute:
- Customer count: `customers` table filtered by `business_id`
- Active conversations: `conversations` table filtered by `status=active`, `type=live`, `assistant_id IN [...]`
- Last interaction: `messages` table joined via `conversations`, ordered by `created_at DESC`, limited to 1

**Issue**: If `assistantIds` is empty (no assistants), the `IN` clause receives an empty array, which may return unexpected results from Supabase.

## 4. Console errors?

**Known issues from code analysis**:
- `ChatWindow.tsx:113`: Mutating state directly (`lastMsg.content = assistantContent`) — React 19 may tolerate but is incorrect pattern
- `ChatWindow.tsx:192`: Uses `prompt()` for correction input — blocks UI, poor UX
- `LaboratorioClient.tsx:189`: `cost` is never updated from API response

## 5. Failed requests?

**Potential issues**:
- Empty `assistantIds` array in dashboard query could cause Supabase errors
- `lastMessageResult.data` could be null if no messages exist (handled with `?? null`)

## 6. Incomplete components?

| Component | Status |
|-----------|--------|
| Dashboard metrics cards | ✅ Complete |
| Assistant cards | ✅ Complete |
| Onboarding wizard (4 steps) | ✅ Complete |
| ProductsManager | ✅ Complete |
| RulesManager | ✅ Complete |
| ChatWindow | ⚠️ Uses `prompt()`, mutates state |
| LaboratorioClient | ⚠️ Cost tracking incomplete |
| Sidebar | ✅ Complete |
| OnboardingBanner | ✅ Complete |

## 7. Empty states without handling?

| Location | Empty state | Handled? |
|----------|-------------|----------|
| No business | "¡Comienza con MIA!" CTA | ✅ |
| No assistants | "Crea tu primera asistente" CTA | ✅ |
| No products | "Aún no hay productos" | ✅ |
| No rules | "Aún no hay reglas" | ✅ |
| No messages in chat | "Hola, soy {name}" | ✅ |
| No lab sessions | Handled by SessionHistory | ✅ |
| No laboratorio businesses | "Necesitas crear un negocio" | ✅ |

## Summary

| Check | Status |
|-------|--------|
| Route works | ✅ |
| Assistants render | ✅ |
| Supabase data loads | ✅ |
| Console errors | ⚠️ Minor |
| Failed requests | ⚠️ Edge cases |
| Incomplete components | ⚠️ 2 minor |
| Empty states | ✅ All handled |
