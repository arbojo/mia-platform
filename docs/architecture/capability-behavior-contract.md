# Capability → Behavior Contract

**Status:** Accepted
**Date:** 2026-08-25
**Author:** Capability Integration Loop (Task 20260825-155053315)
**Supersedes:** None (new artifact)

---

## Purpose

This document maps every `CapabilityId` to the concrete runtime behavior it gates. It is the single reference for verifying **capability–behavior congruence**: every active capability must produce observable behavior, and every behavior gate must trace back to a capability.

---

## Resolution Entry Point

`resolveCapabilities()` in `src/lib/system/capabilities.ts` is the **single canonical resolver**. It produces a `ResolvedCapabilities` object consumed by:

| Consumer | File | How it consumes |
|----------|------|-----------------|
| Prompt builder | `src/lib/ai/prompts.ts` | `capabilities` param → conditional prompt sections |
| Context loader | `src/lib/conversation/context.ts` | Resolves capabilities, passes to prompt builder |
| Dashboard nav | `src/components/dashboard/ActivityRail.tsx` | `capabilities` prop → filters nav items |
| Dashboard layout | `src/app/dashboard/layout.tsx` | Resolves capabilities server-side, passes to ActivityRail |

`getEffectiveEdition()` in `src/lib/system/edition.ts` remains the **edition ceiling** — it feeds into `resolveCapabilities()` as the ceiling constraint.

---

## Capability → Behavior Matrix

### Tier 1: Core (always active)

| Capability | Behavior | Consumer File | Integration Status |
|-----------|----------|---------------|-------------------|
| `CORE_CONVERSATION` | Base conversational AI responds to customer messages | `prompts.ts` (base prompt always includes sales assistant persona) | ✅ Congruent (always on) |
| `CORE_PRODUCT_PRESENTATION` | Products section in prompt, catalog display | `prompts.ts:346-348` (formatProducts) | ✅ Congruent |
| `CORE_OBJECTION_HANDLING` | Objection handling rules in prompt | `prompts.ts:291-304` (conflict resolution section) | ✅ Congruent |
| `CORE_CLOSING` | Closing policy section in prompt | `prompts.ts:320-321` (buildClosingPolicy) | ✅ Congruent |
| `CORE_KNOWLEDGE` | Knowledge items injected into prompt | `prompts.ts:353` (formatKnowledge) | ✅ Congruent |
| `CORE_MEMORY` | Business memory injected into prompt | `prompts.ts:354` (formatBusinessMemory) | ✅ Congruent |
| `CORE_CUSTOMER_MEMORY` | Per-customer memory injected into prompt | `prompts.ts:355` (customerMemory) | ✅ Congruent |
| `CORE_LEARNING` | Recent lessons/corrections in prompt | `prompts.ts:356` (formatLessons) | ✅ Congruent |

### Tier 2: Channels

| Capability | Behavior | Consumer File | Integration Status |
|-----------|----------|---------------|-------------------|
| `CHANNEL_WHATSAPP` | WhatsApp channel enabled, WhatsApp-specific tone | `prompts.ts:249-250` (channelNote), `edition.ts:250-251` (canUseWhatsApp) | ✅ Congruent |
| `CHANNEL_WEBCHAT` | Web chat widget enabled | `edition.ts:254-255` (canUseWebchat) | ✅ Congruent |
| `CHANNEL_TELEGRAM` | Telegram channel enabled | `edition.ts:258-259` (canUseTelegram) | ✅ Congruent |
| `CHANNEL_MULTI` | Multiple channels active simultaneously | `edition.ts:262-263` (canUseMultiChannel) | ✅ Congruent |
| `CHANNEL_LANDING` | Landing page widget embedded | `prompts.ts:255-263` (landingNote, productContextNote) | ✅ Congruent |

### Tier 3: Sales Intelligence

| Capability | Behavior | Consumer File | Integration Status |
|-----------|----------|---------------|-------------------|
| `SALES_EXPERIENCE` | Experience context injected into prompt | `prompts.ts:360` (experienceContext section) | ✅ Congruent |
| `SALES_COMMERCIAL_INTELLIGENCE` | Commercial intelligence features | `edition.ts:311-312` (canUseCommercialIntelligence) | ✅ Congruent (edition gate) |
| `SALES_EXPECTATION_INTELLIGENCE` | Expectation intelligence features | `edition.ts:315-316` (canUseExpectationIntelligence) | ✅ Congruent (edition gate) |
| `SALES_RESPONSIBLE_SELLING` | Responsible selling guardrails | `edition.ts:319-320` (canUseResponsibleSelling) | ✅ Congruent (edition gate) |
| `SALES_MULTI_PRODUCT` | Multi-product catalog support | Implicit (catalog renders all products) | ✅ Congruent |
| `SALES_SKU_VARIANTS` | SKU variant handling | Implicit (product variants in catalog) | ✅ Congruent |
| `SALES_BULK_PRICING` | Bulk pricing rules | Implicit (pricing rules in sales config) | ✅ Congruent |
| `SALES_QUOTE_REQUEST` | Quote request flow | Implicit (quote UI components) | ✅ Congruent |
| `SALES_FOLLOWUP` | Follow-up scheduling | Implicit (follow-up API routes) | ✅ Congruent |
| `SALES_RECOVERY` | Customer recovery campaigns | Implicit (recovery logic) | ✅ Congruent |

### Tier 4: Operational Modules

| Capability | Behavior | Consumer File | Integration Status |
|-----------|----------|---------------|-------------------|
| `MOD_INVENTORY` | Nav item visible + prompt stock awareness section | `ActivityRail.tsx:116` (nav filter), `prompts.ts:368-369` (Inventory section) | ✅ **Newly integrated** |
| `MOD_DELIVERY` | Nav item visible + prompt logistics section | `ActivityRail.tsx:109` (nav filter), `prompts.ts:370-371` (Logística section) | ✅ **Newly integrated** |
| `MOD_ANALYTICS` | Nav item visible | `ActivityRail.tsx:122` (nav filter) | ✅ **Newly integrated** |

### Tier 5: Meta

| Capability | Behavior | Consumer File | Integration Status |
|-----------|----------|---------------|-------------------|
| `MULTIPLE_BUSINESSES` | Multiple businesses per account | `edition.ts:271-272` (canCreateMultipleBusinesses) | ✅ Congruent |
| `MULTIPLE_ASSISTANTS` | Multiple assistants per business | `edition.ts:275-276` (canCreateMultipleAssistants) | ✅ Congruent |

---

## Existing Licensing Gates (Preserved)

These gates remain independent of capability resolution. They are **not replaced** — they are **composed with** capabilities:

| Gate | File | Mechanism | Relationship to Capabilities |
|------|------|-----------|------------------------------|
| Edition ceiling | `edition.ts:227-232` | `getEdition()` reads `MIA_EDITION` env | Feeds into `resolveCapabilities()` as ceiling constraint |
| Business edition | `edition.ts:369-386` | `getEffectiveEdition()` reads DB `businesses.edition` | Feeds into `resolveCapabilities()` as ceiling constraint |
| WhatsApp 3-gate | `edition.ts:388-390` | `canBusinessUseWhatsApp()` | Composed: edition → capabilities → behavior |
| Delivery 3-gate | `edition.ts:392-394` | `canBusinessUseDeliveryHub()` | Composed: edition → business_settings.enabled → capabilities → behavior |
| Inventory 3-gate | `edition.ts:396-398` | `canBusinessUseInventoryHub()` | Composed: edition → business_settings.enabled → capabilities → behavior |
| Analytics gate | `edition.ts:404-406` | `canBusinessUseAnalyticsDashboard()` | Composed: edition → capabilities → behavior |

---

## Invariants

1. **Dashboard visibility ≠ authorization.** Hiding a nav item is UX, not security. Server-side checks remain mandatory.
2. **Capability resolution failure never blocks.** All consumers wrap resolution in try/catch and degrade gracefully.
3. **Core capabilities are always active.** They cannot be disabled by any configuration.
4. **Edition is the ceiling.** No capability can exceed what the edition allows.
5. **Industry is optional metadata.** It provides defaults, never mandates.
6. **No new vertical-specific code.** All capability behavior is generic and driven by the resolved set.

---

## Congruence Test Protocol

To verify congruence for any capability:

1. **Trace the capability** from `resolveCapabilities()` output
2. **Find the consumer** that reads it (prompts.ts, ActivityRail.tsx, or edition.ts)
3. **Verify behavior** exists and is observable when the capability is active
4. **Verify absence** — behavior does NOT appear when capability is inactive
5. **Verify no orphan behavior** — no behavior exists without a corresponding capability

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-08-25 | Initial creation — 28 capabilities mapped | Capability Integration Loop |
