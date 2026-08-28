import type { Edition, EditionCapabilities } from './edition'

// ============================================================================
// CAPABILITY CATALOG
// ============================================================================
// Source of truth: docs/architecture/capability-contract-v2.md
// 28 named capabilities in 5 tiers

export type CapabilityId =
  // Tier 1: Core (always active)
  | 'CORE_CONVERSATION'
  | 'CORE_PRODUCT_PRESENTATION'
  | 'CORE_OBJECTION_HANDLING'
  | 'CORE_CLOSING'
  | 'CORE_KNOWLEDGE'
  | 'CORE_MEMORY'
  | 'CORE_CUSTOMER_MEMORY'
  | 'CORE_LEARNING'
  // Tier 2: Channels
  | 'CHANNEL_WHATSAPP'
  | 'CHANNEL_WEBCHAT'
  | 'CHANNEL_TELEGRAM'
  | 'CHANNEL_MULTI'
  | 'CHANNEL_LANDING'
  // Tier 3: Sales Intelligence
  | 'SALES_EXPERIENCE'
  | 'SALES_COMMERCIAL_INTELLIGENCE'
  | 'SALES_EXPECTATION_INTELLIGENCE'
  | 'SALES_RESPONSIBLE_SELLING'
  | 'SALES_MULTI_PRODUCT'
  | 'SALES_SKU_VARIANTS'
  | 'SALES_BULK_PRICING'
  | 'SALES_QUOTE_REQUEST'
  | 'SALES_FOLLOWUP'
  | 'SALES_RECOVERY'
  // Tier 4: Operational Modules
  | 'MOD_INVENTORY'
  | 'MOD_DELIVERY'
  | 'MOD_ANALYTICS'
  // Tier 5: Meta
  | 'MULTIPLE_BUSINESSES'
  | 'MULTIPLE_ASSISTANTS'

/** Core capabilities — always active, cannot be disabled */
export const CORE_CAPABILITIES: ReadonlySet<CapabilityId> = new Set([
  'CORE_CONVERSATION',
  'CORE_PRODUCT_PRESENTATION',
  'CORE_OBJECTION_HANDLING',
  'CORE_CLOSING',
  'CORE_KNOWLEDGE',
  'CORE_MEMORY',
  'CORE_CUSTOMER_MEMORY',
  'CORE_LEARNING',
])

/** Capability categories for grouping */
export const CAPABILITY_CATEGORIES = {
  core: [
    'CORE_CONVERSATION', 'CORE_PRODUCT_PRESENTATION', 'CORE_OBJECTION_HANDLING',
    'CORE_CLOSING', 'CORE_KNOWLEDGE', 'CORE_MEMORY', 'CORE_CUSTOMER_MEMORY',
    'CORE_LEARNING',
  ] as readonly CapabilityId[],
  channel: [
    'CHANNEL_WHATSAPP', 'CHANNEL_WEBCHAT', 'CHANNEL_TELEGRAM',
    'CHANNEL_MULTI', 'CHANNEL_LANDING',
  ] as readonly CapabilityId[],
  sales: [
    'SALES_EXPERIENCE', 'SALES_COMMERCIAL_INTELLIGENCE',
    'SALES_EXPECTATION_INTELLIGENCE', 'SALES_RESPONSIBLE_SELLING',
    'SALES_MULTI_PRODUCT', 'SALES_SKU_VARIANTS', 'SALES_BULK_PRICING',
    'SALES_QUOTE_REQUEST', 'SALES_FOLLOWUP', 'SALES_RECOVERY',
  ] as readonly CapabilityId[],
  module: [
    'MOD_INVENTORY', 'MOD_DELIVERY', 'MOD_ANALYTICS',
  ] as readonly CapabilityId[],
  meta: [
    'MULTIPLE_BUSINESSES', 'MULTIPLE_ASSISTANTS',
  ] as readonly CapabilityId[],
} as const

// ============================================================================
// EDITION → CAPABILITY MAPPING
// ============================================================================
// Maps EditionCapabilities camelCase keys to CapabilityId SCREAMING_SNAKE.
// null = edition capability does not map to a CapabilityId (platform feature).

const EDITION_KEY_MAP: Partial<Record<keyof EditionCapabilities, CapabilityId>> = {
  whatsapp: 'CHANNEL_WHATSAPP',
  webchat: 'CHANNEL_WEBCHAT',
  telegram: 'CHANNEL_TELEGRAM',
  multiChannel: 'CHANNEL_MULTI',
  multipleBusinesses: 'MULTIPLE_BUSINESSES',
  multipleAssistants: 'MULTIPLE_ASSISTANTS',
  commercialIntelligence: 'SALES_COMMERCIAL_INTELLIGENCE',
  expectationIntelligence: 'SALES_EXPECTATION_INTELLIGENCE',
  responsibleSelling: 'SALES_RESPONSIBLE_SELLING',
  deliveryHub: 'MOD_DELIVERY',
  inventoryHub: 'MOD_INVENTORY',
  analyticsDashboard: 'MOD_ANALYTICS',
}

/** Maps an EditionCapabilities key to its CapabilityId, or null if unmapped */
export function editionKeyToCapabilityId(key: string): CapabilityId | null {
  return EDITION_KEY_MAP[key as keyof EditionCapabilities] ?? null
}

/** Check if a capability is allowed by the edition ceiling */
export function editionHasCapability(edition: Edition, capId: CapabilityId): boolean {
  for (const [key, mapped] of Object.entries(EDITION_KEY_MAP)) {
    if (mapped === capId) {
      return edition.capabilities[key as keyof EditionCapabilities] === true
    }
  }
  return false
}

// ============================================================================
// DEPENDENCY DECLARATIONS
// ============================================================================

export type DependencyType = 'HARD' | 'SOFT'

export interface CapabilityDependency {
  /** Capability that depends on another */
  capability: CapabilityId
  /** Capabilities that must be active (all required) */
  requires: CapabilityId[]
  /** HARD = blocks activation, SOFT = warns but allows */
  type: DependencyType
  /** Human-readable reason */
  reason: string
}

/**
 * Dependency declarations from capability-contract-v2 Phase 9.
 * CHANNEL_MULTI requires ≥2 channels — handled as a special case in resolution.
 * SALES_EXPERIENCE depends on industry being set — handled via industry check.
 */
export const CAPABILITY_DEPENDENCIES: readonly CapabilityDependency[] = [
  {
    capability: 'SALES_FOLLOWUP',
    requires: ['CORE_CUSTOMER_MEMORY'],
    type: 'SOFT',
    reason: 'Follow-up benefits from customer memory but can work without it',
  },
  {
    capability: 'SALES_RECOVERY',
    requires: ['CORE_CUSTOMER_MEMORY', 'SALES_FOLLOWUP'],
    type: 'SOFT',
    reason: 'Recovery benefits from both but does not strictly require them',
  },
  {
    capability: 'MOD_ANALYTICS',
    requires: ['MOD_INVENTORY'],
    type: 'SOFT',
    reason: 'Analytics is more useful with data from at least one operational module',
  },
  {
    capability: 'SALES_BULK_PRICING',
    requires: ['SALES_MULTI_PRODUCT'],
    type: 'SOFT',
    reason: 'Bulk pricing is more useful with multi-product',
  },
  {
    capability: 'SALES_QUOTE_REQUEST',
    requires: ['SALES_FOLLOWUP'],
    type: 'SOFT',
    reason: 'Quotes benefit from follow-up',
  },
]

/**
 * Conflict rules from capability-contract-v2 Phase 9.2.
 * Returns true if the conflict is detected.
 */
function detectConflict(active: Set<CapabilityId>): CapabilityId | null {
  const channelCount = [
    'CHANNEL_WHATSAPP', 'CHANNEL_WEBCHAT', 'CHANNEL_TELEGRAM',
  ].filter(c => active.has(c as CapabilityId)).length

  if (active.has('CHANNEL_MULTI') && channelCount < 2) {
    return 'CHANNEL_MULTI'
  }
  if (active.has('SALES_BULK_PRICING') && !active.has('SALES_MULTI_PRODUCT')) {
    return 'SALES_BULK_PRICING'
  }
  if (active.has('SALES_QUOTE_REQUEST') && !active.has('SALES_FOLLOWUP')) {
    return 'SALES_QUOTE_REQUEST'
  }
  return null
}

// ============================================================================
// INDUSTRY TAXONOMY
// ============================================================================
// Source of truth: docs/architecture/industry-taxonomy-decision.md
// Controlled slug taxonomy — suggested values with free-form allowed

export interface IndustryDefinition {
  slug: string
  label: string
  defaultCapabilities: readonly CapabilityId[]
}

export const INDUSTRY_DEFINITIONS: readonly IndustryDefinition[] = [
  {
    slug: 'wellness_beauty',
    label: 'Bienestar y Belleza',
    defaultCapabilities: ['SALES_EXPERIENCE', 'CHANNEL_WHATSAPP'],
  },
  {
    slug: 'inmobiliaria',
    label: 'Inmobiliaria',
    defaultCapabilities: ['SALES_EXPERIENCE', 'SALES_QUOTE_REQUEST', 'SALES_FOLLOWUP'],
  },
  {
    slug: 'calzado',
    label: 'Calzado',
    defaultCapabilities: ['SALES_SKU_VARIANTS', 'SALES_BULK_PRICING', 'MOD_INVENTORY'],
  },
  {
    slug: 'ropa',
    label: 'Ropa y Moda',
    defaultCapabilities: ['SALES_SKU_VARIANTS', 'MOD_INVENTORY'],
  },
  {
    slug: 'general',
    label: 'General / Otro',
    defaultCapabilities: [],
  },
]

/** Lookup industry defaults by slug. Returns empty array for unknown/custom industries. */
export function getIndustryDefaults(industry: string | null): readonly CapabilityId[] {
  if (!industry) return []
  const def = INDUSTRY_DEFINITIONS.find(d => d.slug === industry)
  return def?.defaultCapabilities ?? []
}

// ============================================================================
// RESOLVED STATE
// ============================================================================

export type CapabilitySource = 'default' | 'onboarding' | 'config' | 'dependency'

export interface ResolvedCapabilities {
  /** All active capability IDs */
  active: Set<CapabilityId>
  /** Business ID these capabilities were resolved for */
  businessId: string
  /** Edition that contributed to the resolved set */
  edition: string
  /** How each capability was activated (for debugging) */
  sources: Record<CapabilityId, CapabilitySource>
}

// ============================================================================
// RESOLUTION ENGINE
// ============================================================================
// Deterministic, idempotent, auditable.
// Configuration state (businesses.capabilities) → Resolved state (ResolvedCapabilities)

/**
 * Resolve the active capability set for a business.
 *
 * Resolution order:
 * 1. Core capabilities (always active)
 * 2. Industry-derived defaults (adds defaults for known industries)
 * 3. Explicit business configuration (overrides industry defaults)
 * 4. Dependency resolution (adds missing deps)
 * 5. CHANNEL_MULTI special case (requires ≥2 channels)
 * 6. Conflict resolution (removes invalid combos)
 * 7. Edition ceiling enforcement (removes capabilities not in edition)
 *
 * @param businessId - The business to resolve for
 * @param edition - The edition (ceiling)
 * @param industry - Optional industry slug (nullable)
 * @param explicitCapabilities - Business's configured capabilities from businesses.capabilities (nullable)
 * @returns ResolvedCapabilities — the set of capabilities MIA may use
 */
export function resolveCapabilities(
  businessId: string,
  edition: Edition,
  industry: string | null,
  explicitCapabilities: string[] | null,
): ResolvedCapabilities {
  const active = new Set<CapabilityId>()
  const sources: Record<string, CapabilitySource> = {}

  // 1. Core capabilities (always active, cannot be disabled)
  for (const id of CORE_CAPABILITIES) {
    active.add(id)
    sources[id] = 'default'
  }

  // 2. Industry-derived defaults (adds only, does not override core)
  //    Edition is a CEILING — businesses opt-in via step 3 (explicit config)
  const industryCaps = getIndustryDefaults(industry)
  for (const capId of industryCaps) {
    active.add(capId)
    sources[capId] = 'onboarding'
  }

  // 3. Explicit business configuration (highest priority after core)
  //    Config wins over industry defaults for source attribution
  if (explicitCapabilities) {
    for (const capId of explicitCapabilities) {
      if (isValidCapabilityId(capId)) {
        active.add(capId as CapabilityId)
        sources[capId] = 'config'
      }
    }
  }

  // 5. Dependency resolution
  for (const dep of CAPABILITY_DEPENDENCIES) {
    if (active.has(dep.capability)) {
      const missingDeps = dep.requires.filter(r => !active.has(r))
      if (missingDeps.length > 0 && dep.type === 'HARD') {
        // HARD dependency not met — remove the capability
        active.delete(dep.capability)
        delete sources[dep.capability]
      } else {
        // SOFT dependency — add missing deps
        for (const req of missingDeps) {
          if (!active.has(req)) {
            active.add(req)
            sources[req] = 'dependency'
          }
        }
      }
    }
  }

  // 5b. CHANNEL_MULTI special case: requires ≥2 channels
  if (active.has('CHANNEL_MULTI')) {
    const channelCount = [
      'CHANNEL_WHATSAPP', 'CHANNEL_WEBCHAT', 'CHANNEL_TELEGRAM',
    ].filter(c => active.has(c as CapabilityId)).length
    if (channelCount < 2) {
      active.delete('CHANNEL_MULTI')
      delete sources['CHANNEL_MULTI']
    }
  }

  // 6. Conflict resolution (remove invalid combos)
  let conflict = detectConflict(active)
  while (conflict) {
    active.delete(conflict)
    delete sources[conflict]
    conflict = detectConflict(active)
  }

  // 7. Edition ceiling enforcement (remove capabilities not allowed by edition)
  //    Only applies to capabilities that have an edition mapping.
  //    Unmapped capabilities (e.g. SALES_*, CORE_*) bypass the ceiling.
  for (const capId of [...active]) {
    if (sources[capId] === 'default') continue // core capabilities bypass ceiling
    const hasEditionMapping = Object.values(EDITION_KEY_MAP).includes(capId)
    if (hasEditionMapping && !editionHasCapability(edition, capId)) {
      active.delete(capId)
      delete sources[capId]
    }
  }

  return {
    active,
    businessId,
    edition: edition.name,
    sources: sources as Record<CapabilityId, CapabilitySource>,
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Runtime check for valid capability IDs */
const VALID_CAPABILITY_IDS = new Set<string>([
  ...CAPABILITY_CATEGORIES.core,
  ...CAPABILITY_CATEGORIES.channel,
  ...CAPABILITY_CATEGORIES.sales,
  ...CAPABILITY_CATEGORIES.module,
  ...CAPABILITY_CATEGORIES.meta,
])

export function isValidCapabilityId(id: string): id is CapabilityId {
  return VALID_CAPABILITY_IDS.has(id)
}

/** Check if a capability is active in a resolved set */
export function hasCapability(resolved: ResolvedCapabilities, capId: CapabilityId): boolean {
  return resolved.active.has(capId)
}
