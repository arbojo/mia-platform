# MIA Brain — Edition System

**Status**: Accepted
**Date**: 2026-07-27
**Author**: Engineering Council

---

## Purpose

The Edition System is an **architecture layer** that allows the same codebase to run under different editions. It is NOT a licensing system. It is NOT copy protection.

The system only **enables or disables capabilities**. It never changes business logic.

---

## Philosophy

- **One codebase, multiple editions.** Never fork. Never duplicate features.
- **Capability flags, not edition checks.** The application never checks `if edition == evaluation`.
- **Centralized configuration.** All edition definitions live in `src/lib/system/edition.ts`.
- **Future-proof.** Adding a new edition requires only a configuration change.

---

## Current Editions

| Edition | Status | Description |
|---------|--------|-------------|
| `evaluation` | **Active** | Single-business lab environment |
| `professional` | Defined | Production-ready, multi-channel |
| `enterprise` | Defined | Multi-tenant, advanced |
| `cloud` | Defined | Fully managed, unlimited |

Only `evaluation` is currently active. The others are defined for architectural readiness.

---

## Architecture

### Edition Configuration

**File**: `src/lib/system/edition.ts`

Single source of truth. Contains:
- `Edition` type definition
- `EditionLimits` (businesses, assistants, users, channels, conversations, products, knowledge)
- `EditionCapabilities` (27 boolean flags)
- `getEdition()` — returns current edition
- `getEditionName()` — returns current edition name
- `getEditionLimits()` — returns current limits
- `getEditionCapabilities()` — returns current capabilities

### Capability Helpers

Each capability has a dedicated helper function:

```ts
canDemoChat()
canUseWhatsApp()
canUseWebchat()
canUseTelegram()
canUseMultiChannel()
canCreateBusiness()
canCreateMultipleBusinesses()
canCreateMultipleAssistants()
canUseCloudDeployment()
canUseSkills()
canUseBusinessMemory()
canUseLearning()
canUseWeeklyReports()
canUseDashboard()
canUsePromptBuilder()
canUseKnowledgeCenter()
canUseCommercialIntelligence()
canUseExpectationIntelligence()
canUseResponsibleSelling()
canUseKnowledgeStudio()
canUseSalesSimulator()
canUseConnections()
```

### Utility Functions

```ts
isWithinLimit(current, limit)    // Check if under limit
getRemainingQuota(current, limit) // Get remaining capacity
```

---

## Edition Selection

The active edition is determined by the `MIA_EDITION` environment variable:

```bash
MIA_EDITION=evaluation   # Default
MIA_EDITION=professional
MIA_EDITION=enterprise
MIA_EDITION=cloud
```

If the variable is missing or invalid, `evaluation` is used as default.

---

## Integration Points

### Demo Chat API (`src/app/api/demo/chat/route.ts`)

```ts
import { canDemoChat } from '@/lib/system/edition'

if (!canDemoChat()) {
  return NextResponse.json({ error: 'Demo not available in this edition' }, { status: 403 })
}
```

### Sidebar (`src/components/dashboard/Sidebar.tsx`)

Displays the current edition badge below the MIA logo.

### Dashboard (`src/app/dashboard/page.tsx`)

Shows edition name and current limits in an info bar at the top.

---

## Adding a New Edition

1. Open `src/lib/system/edition.ts`
2. Define the new `Edition` object with limits and capabilities
3. Add it to the `EDITIONS` record
4. No other code changes needed — all capability helpers automatically use the new edition

---

## Adding a New Capability

1. Add the capability to `EditionCapabilities` interface
2. Add it to all edition definitions in `EDITIONS`
3. Create a capability helper function
4. Use the helper in the relevant component/route

---

## Evaluation Edition — Limits

| Resource | Limit |
|----------|-------|
| Businesses | 1 |
| Assistants | 1 |
| Users | 1 |
| Channels | 1 |
| Conversations | 1,000 |
| Products | Unlimited |
| Knowledge | Unlimited |

### Enabled Capabilities

- Demo Chat
- Webchat
- Skills
- Business Memory
- Learning
- Weekly Reports
- Dashboard
- Prompt Builder
- Knowledge Center
- Commercial Intelligence
- Expectation Intelligence
- Responsible Selling
- Knowledge Studio
- Sales Simulator
- Connections

### Disabled Capabilities

- WhatsApp
- Telegram
- Multi-Channel
- Multiple Businesses
- Multiple Assistants
- Cloud Deployment

---

## Future Considerations

- **Edition metadata in database**: For SaaS multi-tenant, store edition per business in `businesses` table
- **Upgrade paths**: Allow transitioning between editions without data loss
- **Usage metering**: Track actual usage against limits for billing
- **Feature preview**: Allow evaluation users to preview premium features temporarily
