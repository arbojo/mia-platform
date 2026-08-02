# Assistant Lifecycle Audit Report

**Date**: 2026-07-29
**Sprint**: Sprint 2 — Product Trust

---

## Objective

Audit the complete assistant lifecycle: Create → Configure → Train → Test → Deploy/Use. Identify gaps, missing states, dead code, and broken flows.

---

## Lifecycle Map

```
CREATE ──→ CONFIGURE ──→ TRAIN ──→ TEST ──→ DEPLOY ──→ USE
  ✅         ❌           ✅        ✅        ❌         ⚠️
```

---

## Findings

### CRITICAL

| # | Finding | Location |
|---|---------|----------|
| **C1** | **No deploy/publish button** — assistant cannot be marked as "live". No toggle for `is_active`. UI doesn't distinguish between training and production assistants. | `assistants/page.tsx:92-106` |

### HIGH

| # | Finding | Location |
|---|---------|----------|
| H1 | **No assistant configuration page** — name, personality, and communication_style are locked after onboarding. No edit page exists at `assistants/[id]/`. | `assistants/[id]/` (missing) |
| H2 | **Personality hardcoded in onboarding** — AI-extracted personality (`warmth`, `formality`, `humor`, `sales_aggressiveness`) is ignored; hardcoded values used instead. | `ConversationalOnboarding.tsx:170-179` |
| H3 | **No assistant status indicator** — owner can't see if an assistant is "training", "live", or "inactive" from the list. | `assistants/page.tsx:60-110` |

### MEDIUM

| # | Finding | Location |
|---|---------|----------|
| M1 | **Dead code**: `OnboardingWizard.tsx` (530 lines) is fully built but never imported. | `onboarding/OnboardingWizard.tsx` |
| M2 | **Fragile redirect**: 4-second `setTimeout` for post-onboarding redirect — user can navigate away mid-flight. | `ConversationalOnboarding.tsx:208-210` |
| M3 | **Placeholder UUIDs**: AI usage tracking uses `00000000-0000...` for business/assistant IDs during onboarding. | `api/onboarding/chat/route.ts:129-138` |
| M4 | **Dual channel systems**: `assistant_channels` (onboarding) vs `channel_connections` (connections page) — duplicate purpose. | `ConversationalOnboarding.tsx:182` vs `ConnectionsManager.tsx` |
| M5 | **No embed UI**: Widget chat API exists but no "embed" button, snippet, or instructions. | `api/widget/chat/route.ts` |
| M6 | **Conversations read-only**: No reply, handover, status change, or assignment from conversations page. | `conversations/page.tsx` |
| M7 | **No delete assistant button**. | `assistants/page.tsx:60-110` |

### LOW

| # | Finding | Location |
|---|---------|----------|
| L1 | `brand_identities` `tagline` and `tone_of_voice` not extracted from AI data. | `ConversationalOnboarding.tsx:136-144` |
| L2 | MemoryTimeline hardcoded to 10 lessons, no pagination. | `MemoryTimeline.tsx:52` |
| L3 | Products: no pagination/search; `faq`, `restrictions`, `image_url`, `documents` not exposed. | `ProductsManager.tsx` |
| L4 | Rules: `priority` field not exposed in UI. | `RulesManager.tsx` |
| L5 | Conversations: `<details>` element used for expand — poor cross-browser styling. | `conversations/page.tsx:188` |
| L6 | Assistant card body not clickable — only buttons are links. | `assistants/page.tsx:67-110` |

---

## Working: Create → Train → Test

| Step | Status | Details |
|------|--------|---------|
| Create | ✅ | Conversational onboarding creates business, brand, products, rules, assistant, channel |
| Configure (products) | ✅ | Products CRUD with categories, filtering, delete confirmation |
| Configure (rules) | ✅ | Rules CRUD with category filter |
| Configure (knowledge) | ✅ | Knowledge center with file learning |
| Train | ✅ | Chat with streaming, corrections → `learning_events`, MemoryTimeline |
| Test | ✅ | Laboratorio with 4 modes, 7 scenarios, coaching, evaluation, teach flow |

---

## Broken: Configure (assistant) → Deploy → Use

| Step | Status | Details |
|------|--------|---------|
| Configure (personality) | ❌ | No edit page for assistant name, personality, or communication_style |
| Deploy | ❌ | No way to toggle `is_active`, no publish button |
| Use (channels) | ⚠️ | Channel connections exist but no way to see which assistant uses which channel |
| Use (widget) | ⚠️ | Widget API exists but no UI to get embed code |

---

## Summary

**27 findings**: 1 critical, 3 high, 7 medium, 6 low, plus 10 working steps documented.

The lifecycle gap is clear: assistants can be created, trained, and tested, but **cannot be deployed**. The deploy step must connect: training status → `is_active` toggle → channel assignment → live conversations.
