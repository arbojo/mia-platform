# AI Context Quality Audit Report

**Date**: 2026-07-29
**Sprint**: Sprint 2 — Product Trust

---

## Objective

Audit what information is fed to the AI model (`gpt-4o-mini`) when generating responses. Identify missing context, quality issues, and token inefficiency.

---

## Pipeline

```
chat/route.ts
  → runtime.ts (processStreaming)
    → context.ts (loadConversationContext)
      → knowledge.ts (getBusinessContext + getRecentLessons)
      → customer-memory.ts (getCustomerMemory)
      → prompts.ts (buildMasterPrompt)
    → execute-ai.ts (executeAI) → OpenAI
```

---

## Data Inclusion Status

| Data Source | Included? | Details |
|-------------|-----------|---------|
| Knowledge items (Q&A) | ✅ | question + answer |
| Products | ⚠️ | name, price, description, benefits — **missing faq, restrictions** |
| Sales rules | ✅ | priority, category, content |
| AI instructions | ✅ | source + instruction |
| Brand identity | ⚠️ | name, tagline, pitch — **missing tone_of_voice** |
| Personality | ✅ | warmth, formality, humor, aggressiveness |
| Customer memory | ✅ | summary, interests, objections, preferences (Phase 1) |
| Recent lessons | ⚠️ | **missing severity, category** fields |
| Conversation history | ❌ | **CRITICAL: not loaded in processStreaming** |
| Product FAQ | ❌ | JSONB field completely omitted |
| Product restrictions | ❌ | TEXT field completely omitted |

---

## Critical Findings

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| C1 | **processStreaming does NOT load past conversation history** — AI context depends entirely on what client sends. Channel flow (`processIncomingMessage`) handles this correctly but chat API doesn't. | `runtime.ts:34-40` | AI has zero conversation context if client sends only latest message |

## High Findings

| # | Finding | Location |
|---|---------|----------|
| H1 | Product `faq` JSONB field omitted from prompt (contains product-specific FAQs) | `prompts.ts:65-74` |
| H2 | Product `restrictions` TEXT field omitted from prompt | `prompts.ts:65-74` |
| H3 | Brand `tone_of_voice` not included; only `assistant.communication_style` used — potential conflict | `prompts.ts:146-156` |
| H4 | `getRecentLessons` doesn't fetch `severity` or `category` — critical mistakes can't be prioritized | `knowledge.ts:144` |
| H5 | Mixed client usage: `createClient()` for reads, `createAdminClient()` for writes in extractCustomerMemory | `customer-memory.ts:40,68` |
| H6 | Context never cached when `customerId` is present — every message triggers 6+ DB queries | `context.ts:104-106` |

## Medium Findings

| # | Finding | Location |
|---|---------|----------|
| M1 | 5 hardcoded fundamental rules not configurable from DB | `prompts.ts:158-163` |
| M2 | `corrected_response: null` produces literal "null" string in output | `prompts.ts:123` |
| M3 | No `mistake_prevention` priority sorting in `getRecentLessons` | `knowledge.ts:139-148` |
| M4 | Keyword-based objection detection misses variations, not extensible | `customer-memory.ts:96-108` |
| M5 | Customer `tags`, `status`, `city` not included in memory | `customer-memory.ts:16-18` |
| M6 | 5-minute cache TTL — business data changes slow to propagate | `context.ts:26` |
| M7 | `usedContext` pushes full knowledge object instead of `k.id` | `context.ts:92` |
| M8 | No server-side message count limit in `processStreaming` | `runtime.ts:34-40` |
| M9 | Messages saved only after AI finishes — streaming failure loses messages | `runtime.ts:41-63` |
| M10 | No token counting or truncation strategy for large business contexts | `client.ts` |
| M11 | Streaming mode has no `maxTokens` set | `execute-ai.ts:49` |
| M12 | `as never` type cast bypasses type checking | `execute-ai.ts:83` |
| M13 | `analyzeConversationPatterns` not tracked via `trackAiUsage` | `memory.ts:142-194` |

## Low Findings

| # | Finding | Location |
|---|---------|----------|
| L1 | Knowledge item `category` not displayed in prompt | `prompts.ts:95-104` |
| L2 | Business memory `observation_count`, `last_observed_at` not displayed | `prompts.ts:106-115` |
| L3 | Customer name not available separately in formatted prompt | `customer-memory.ts:127-139` |
| L4 | No try/catch around `getCustomerMemory` in context loader | `context.ts:67-73` |
| L5 | `usedContext` stored but never used by AI | `runtime.ts:56` |
| L6 | `requestType` defaults to `live_customer` silently | `chat/route.ts:17` |
| L7 | Singleton client can't be reset if API key rotates | `client.ts:3-11` |

---

## Summary

**20 findings**: 1 critical, 6 high, 13 medium (overlap with other audits counted once).

The AI context pipeline is well-structured and includes most data sources. The critical gap is conversation history in `processStreaming`. Product FAQ and restrictions, brand tone_of_voice, and lesson severity/category are the high-priority context gaps.
