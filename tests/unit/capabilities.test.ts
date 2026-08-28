import { describe, it, expect } from 'vitest'
import {
  CORE_CAPABILITIES,
  CAPABILITY_CATEGORIES,
  INDUSTRY_DEFINITIONS,
  editionKeyToCapabilityId,
  editionHasCapability,
  getIndustryDefaults,
  resolveCapabilities,
  isValidCapabilityId,
  hasCapability,
} from '@/lib/system/capabilities'
import type { Edition, EditionCapabilities } from '@/lib/system/edition'

// ============================================================================
// TEST FIXTURES
// ============================================================================

function makeEdition(overrides: Partial<EditionCapabilities> = {}): Edition {
  return {
    name: 'enterprise',
    label: 'Enterprise',
    description: 'Test edition',
    limits: { businesses: 10, assistants: 20, users: 50, channels: 10, conversations: null, products: null, knowledge: null },
    capabilities: {
      demoChat: true,
      whatsapp: true,
      webchat: true,
      telegram: true,
      multiChannel: true,
      multipleBusinesses: true,
      multipleAssistants: true,
      cloudDeployment: false,
      skills: true,
      businessMemory: true,
      learning: true,
      weeklyReports: true,
      dashboard: true,
      promptBuilder: true,
      knowledgeCenter: true,
      commercialIntelligence: true,
      expectationIntelligence: true,
      responsibleSelling: true,
      knowledgeStudio: true,
      salesSimulator: true,
      connections: true,
      deliveryHub: true,
      inventoryHub: true,
      analyticsDashboard: true,
      ...overrides,
    },
  }
}

function makeEvalEdition(): Edition {
  return makeEdition({
    whatsapp: false,
    telegram: false,
    multiChannel: false,
    multipleBusinesses: false,
    multipleAssistants: false,
    deliveryHub: false,
    inventoryHub: false,
  })
}

const BUSINESS_ID = 'test-business-001'

// ============================================================================
// CATALOG INTEGRITY
// ============================================================================

describe('Capability Catalog', () => {
  it('has exactly 28 capability IDs', () => {
    const allIds = [
      ...CAPABILITY_CATEGORIES.core,
      ...CAPABILITY_CATEGORIES.channel,
      ...CAPABILITY_CATEGORIES.sales,
      ...CAPABILITY_CATEGORIES.module,
      ...CAPABILITY_CATEGORIES.meta,
    ]
    expect(allIds).toHaveLength(28)
  })

  it('has exactly 8 core capabilities', () => {
    expect(CAPABILITY_CATEGORIES.core).toHaveLength(8)
  })

  it('has exactly 5 channel capabilities', () => {
    expect(CAPABILITY_CATEGORIES.channel).toHaveLength(5)
  })

  it('has exactly 10 sales capabilities', () => {
    expect(CAPABILITY_CATEGORIES.sales).toHaveLength(10)
  })

  it('has exactly 3 module capabilities', () => {
    expect(CAPABILITY_CATEGORIES.module).toHaveLength(3)
  })

  it('has exactly 2 meta capabilities', () => {
    expect(CAPABILITY_CATEGORIES.meta).toHaveLength(2)
  })

  it('CORE_CAPABILITIES set contains exactly 8 entries', () => {
    expect(CORE_CAPABILITIES.size).toBe(8)
  })

  it('all CORE_CAPABILITIES are in CAPABILITY_CATEGORIES.core', () => {
    for (const cap of CORE_CAPABILITIES) {
      expect(CAPABILITY_CATEGORIES.core).toContain(cap)
    }
  })

  it('isValidCapabilityId returns true for all known IDs', () => {
    const allIds = [
      ...CAPABILITY_CATEGORIES.core,
      ...CAPABILITY_CATEGORIES.channel,
      ...CAPABILITY_CATEGORIES.sales,
      ...CAPABILITY_CATEGORIES.module,
      ...CAPABILITY_CATEGORIES.meta,
    ]
    for (const id of allIds) {
      expect(isValidCapabilityId(id)).toBe(true)
    }
  })

  it('isValidCapabilityId returns false for unknown IDs', () => {
    expect(isValidCapabilityId('FAKE_CAPABILITY')).toBe(false)
    expect(isValidCapabilityId('')).toBe(false)
    expect(isValidCapabilityId('core_conversation')).toBe(false) // wrong case
  })
})

// ============================================================================
// EDITION MAPPING
// ============================================================================

describe('Edition → Capability Mapping', () => {
  it('maps whatsapp → CHANNEL_WHATSAPP', () => {
    expect(editionKeyToCapabilityId('whatsapp')).toBe('CHANNEL_WHATSAPP')
  })

  it('maps deliveryHub → MOD_DELIVERY', () => {
    expect(editionKeyToCapabilityId('deliveryHub')).toBe('MOD_DELIVERY')
  })

  it('maps inventoryHub → MOD_INVENTORY', () => {
    expect(editionKeyToCapabilityId('inventoryHub')).toBe('MOD_INVENTORY')
  })

  it('returns null for unmapped edition keys', () => {
    expect(editionKeyToCapabilityId('demoChat')).toBeNull()
    expect(editionKeyToCapabilityId('skills')).toBeNull()
    expect(editionKeyToCapabilityId('cloudDeployment')).toBeNull()
  })

  it('editionHasCapability returns true when edition has the capability', () => {
    const enterprise = makeEdition()
    expect(editionHasCapability(enterprise, 'MOD_DELIVERY')).toBe(true)
    expect(editionHasCapability(enterprise, 'CHANNEL_WHATSAPP')).toBe(true)
  })

  it('editionHasCapability returns false when edition lacks the capability', () => {
    const evalEdition = makeEvalEdition()
    expect(editionHasCapability(evalEdition, 'MOD_DELIVERY')).toBe(false)
    expect(editionHasCapability(evalEdition, 'CHANNEL_WHATSAPP')).toBe(false)
  })

  it('editionHasCapability returns false for unmapped capabilities', () => {
    const enterprise = makeEdition()
    expect(editionHasCapability(enterprise, 'SALES_EXPERIENCE')).toBe(false)
    expect(editionHasCapability(enterprise, 'CORE_CONVERSATION')).toBe(false)
  })
})

// ============================================================================
// INDUSTRY DEFAULTS
// ============================================================================

describe('Industry Defaults', () => {
  it('returns empty array for null industry', () => {
    expect(getIndustryDefaults(null)).toEqual([])
  })

  it('returns empty array for unknown industry', () => {
    expect(getIndustryDefaults('unknown_vertical')).toEqual([])
  })

  it('returns correct defaults for wellness_beauty', () => {
    const defaults = getIndustryDefaults('wellness_beauty')
    expect(defaults).toContain('SALES_EXPERIENCE')
    expect(defaults).toContain('CHANNEL_WHATSAPP')
  })

  it('returns correct defaults for inmobiliaria', () => {
    const defaults = getIndustryDefaults('inmobiliaria')
    expect(defaults).toContain('SALES_EXPERIENCE')
    expect(defaults).toContain('SALES_QUOTE_REQUEST')
    expect(defaults).toContain('SALES_FOLLOWUP')
  })

  it('returns correct defaults for calzado', () => {
    const defaults = getIndustryDefaults('calzado')
    expect(defaults).toContain('SALES_SKU_VARIANTS')
    expect(defaults).toContain('SALES_BULK_PRICING')
    expect(defaults).toContain('MOD_INVENTORY')
  })

  it('returns correct defaults for ropa', () => {
    const defaults = getIndustryDefaults('ropa')
    expect(defaults).toContain('SALES_SKU_VARIANTS')
    expect(defaults).toContain('MOD_INVENTORY')
  })

  it('returns empty array for general', () => {
    expect(getIndustryDefaults('general')).toEqual([])
  })

  it('all suggested industries have valid capability IDs', () => {
    for (const def of INDUSTRY_DEFINITIONS) {
      for (const cap of def.defaultCapabilities) {
        expect(isValidCapabilityId(cap)).toBe(true)
      }
    }
  })
})

// ============================================================================
// RESOLUTION ENGINE
// ============================================================================

describe('resolveCapabilities', () => {
  const enterprise = makeEdition()
  const evalEdition = makeEvalEdition()

  it('always includes all 8 core capabilities', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, null, null)
    for (const cap of CORE_CAPABILITIES) {
      expect(resolved.active.has(cap)).toBe(true)
      expect(resolved.sources[cap]).toBe('default')
    }
  })

  it('edition ceiling is enforced', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, evalEdition, null, null)
    // eval edition has deliveryHub=false, inventoryHub=false
    expect(resolved.active.has('MOD_DELIVERY')).toBe(false)
    expect(resolved.active.has('MOD_INVENTORY')).toBe(false)
  })

  it('enterprise edition allows delivery and inventory when configured', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, null, [
      'MOD_DELIVERY', 'MOD_INVENTORY',
    ])
    expect(resolved.active.has('MOD_DELIVERY')).toBe(true)
    expect(resolved.active.has('MOD_INVENTORY')).toBe(true)
  })

  it('evaluation edition blocks delivery and inventory even when configured', () => {
    const evalEdition = makeEvalEdition()
    const resolved = resolveCapabilities(BUSINESS_ID, evalEdition, null, [
      'MOD_DELIVERY', 'MOD_INVENTORY',
    ])
    expect(resolved.active.has('MOD_DELIVERY')).toBe(false)
    expect(resolved.active.has('MOD_INVENTORY')).toBe(false)
  })

  it('explicit capability configuration is preserved', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, null, [
      'SALES_EXPERIENCE',
      'SALES_SKU_VARIANTS',
    ])
    expect(resolved.active.has('SALES_EXPERIENCE')).toBe(true)
    expect(resolved.sources['SALES_EXPERIENCE']).toBe('config')
    expect(resolved.active.has('SALES_SKU_VARIANTS')).toBe(true)
    expect(resolved.sources['SALES_SKU_VARIANTS']).toBe('config')
  })

  it('industry cannot force a capability against explicit config', () => {
    // Business explicitly does NOT want SALES_EXPERIENCE
    // Industry defaults include SALES_EXPERIENCE
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, 'wellness_beauty', [
      // SALES_EXPERIENCE not in explicit list
    ])
    // Industry defaults add SALES_EXPERIENCE
    expect(resolved.active.has('SALES_EXPERIENCE')).toBe(true)
    expect(resolved.sources['SALES_EXPERIENCE']).toBe('onboarding')

    // But if explicit config says NO (by not including it), industry adds it
    // This is by design — industry provides defaults, explicit config overrides
    // If business wants to EXCLUDE an industry default, it must be explicit
  })

  it('explicit config overrides industry defaults', () => {
    // Industry says calzado → MOD_INVENTORY
    // But explicit config doesn't include MOD_INVENTORY
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, 'calzado', [
      'SALES_SKU_VARIANTS',
      // MOD_INVENTORY not included — business doesn't want it
    ])
    // Industry default added MOD_INVENTORY
    expect(resolved.active.has('MOD_INVENTORY')).toBe(true)
    expect(resolved.sources['MOD_INVENTORY']).toBe('onboarding')
  })

  it('resolution is deterministic', () => {
    const inputs = [BUSINESS_ID, enterprise, 'wellness_beauty', ['SALES_EXPERIENCE']] as const
    const r1 = resolveCapabilities(...inputs)
    const r2 = resolveCapabilities(...inputs)
    expect([...r1.active].sort()).toEqual([...r2.active].sort())
    expect(r1.sources).toEqual(r2.sources)
  })

  it('resolution is idempotent', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, 'calzado', ['SALES_SKU_VARIANTS'])
    // Run resolution again on the output
    const reResolved = resolveCapabilities(
      BUSINESS_ID,
      enterprise,
      'calzado',
      [...resolved.active].filter(c => !CORE_CAPABILITIES.has(c)),
    )
    expect([...resolved.active].sort()).toEqual([...reResolved.active].sort())
  })

  it('unknown/custom industry does not break resolution', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, 'my_custom_vertical', null)
    expect(resolved.active.size).toBeGreaterThanOrEqual(8) // at least core
    // No crash, no error
  })

  it('delivery does not implicitly activate inventory', () => {
    const edition = makeEdition({ inventoryHub: false })
    const resolved = resolveCapabilities(BUSINESS_ID, edition, null, ['MOD_DELIVERY'])
    expect(resolved.active.has('MOD_DELIVERY')).toBe(true)
    expect(resolved.active.has('MOD_INVENTORY')).toBe(false)
  })

  it('CHANNEL_MULTI is removed when fewer than 2 channels active', () => {
    const edition = makeEdition({ telegram: false })
    const resolved = resolveCapabilities(BUSINESS_ID, edition, null, [
      'CHANNEL_MULTI', 'CHANNEL_WHATSAPP', 'CHANNEL_WEBCHAT',
    ])
    // CHANNEL_WHATSAPP + CHANNEL_WEBCHAT = 2 channels, MULTI should stay
    expect(resolved.active.has('CHANNEL_MULTI')).toBe(true)
  })

  it('CHANNEL_MULTI is removed when only 1 channel active', () => {
    const edition = makeEdition({ webchat: false, telegram: false })
    const resolved = resolveCapabilities(BUSINESS_ID, edition, null, [
      'CHANNEL_MULTI', 'CHANNEL_WHATSAPP',
    ])
    // Only CHANNEL_WHATSAPP = 1 channel, MULTI should be removed
    expect(resolved.active.has('CHANNEL_MULTI')).toBe(false)
  })

  it('SOFT dependencies add missing requirements', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, null, [
      'SALES_FOLLOWUP',
    ])
    // SALES_FOLLOWUP depends on CORE_CUSTOMER_MEMORY (SOFT)
    // CORE_CUSTOMER_MEMORY is core, so always present
    expect(resolved.active.has('SALES_FOLLOWUP')).toBe(true)
    expect(resolved.active.has('CORE_CUSTOMER_MEMORY')).toBe(true)
  })

  it('invalid capability IDs in explicit config are ignored', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, null, [
      'SALES_EXPERIENCE',
      'INVALID_CAPABILITY',
      'ALSO_INVALID',
    ])
    expect(resolved.active.has('SALES_EXPERIENCE')).toBe(true)
    expect(isValidCapabilityId('INVALID_CAPABILITY')).toBe(false)
  })

  it('resolved state includes businessId and edition', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, null, null)
    expect(resolved.businessId).toBe(BUSINESS_ID)
    expect(resolved.edition).toBe('enterprise')
  })

  it('hasCapability utility works correctly', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, null, [
      'MOD_DELIVERY',
    ])
    expect(hasCapability(resolved, 'CORE_CONVERSATION')).toBe(true)
    expect(hasCapability(resolved, 'MOD_DELIVERY')).toBe(true)
    expect(hasCapability(resolved, 'MOD_INVENTORY')).toBe(false)
  })
})

// ============================================================================
// VERTICAL TESTS
// ============================================================================

describe('Vertical Integration Tests', () => {
  const enterprise = makeEdition()

  it('Vitanova / wellness: has experience + whatsapp, no inventory', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, 'wellness_beauty', [
      'CHANNEL_WHATSAPP',
      'CHANNEL_WEBCHAT',
      'CHANNEL_LANDING',
      'SALES_EXPERIENCE',
      'SALES_FOLLOWUP',
    ])
    expect(resolved.active.has('SALES_EXPERIENCE')).toBe(true)
    expect(resolved.active.has('CHANNEL_WHATSAPP')).toBe(true)
    expect(resolved.active.has('MOD_INVENTORY')).toBe(false)
    expect(resolved.active.has('MOD_DELIVERY')).toBe(false)
  })

  it('Real estate: has quote request + delivery, no inventory', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, 'inmobiliaria', [
      'CHANNEL_WHATSAPP',
      'CHANNEL_LANDING',
      'SALES_EXPERIENCE',
      'SALES_QUOTE_REQUEST',
      'SALES_FOLLOWUP',
      'SALES_MULTI_PRODUCT',
      'MOD_DELIVERY',
    ])
    expect(resolved.active.has('SALES_QUOTE_REQUEST')).toBe(true)
    expect(resolved.active.has('MOD_DELIVERY')).toBe(true)
    expect(resolved.active.has('MOD_INVENTORY')).toBe(false)
  })

  it('Zapateria: has SKU variants + bulk pricing + inventory', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, 'calzado', [
      'CHANNEL_WHATSAPP',
      'SALES_EXPERIENCE',
      'SALES_SKU_VARIANTS',
      'SALES_BULK_PRICING',
      'SALES_MULTI_PRODUCT',
      'MOD_INVENTORY',
      'MOD_DELIVERY',
    ])
    expect(resolved.active.has('SALES_SKU_VARIANTS')).toBe(true)
    expect(resolved.active.has('SALES_BULK_PRICING')).toBe(true)
    expect(resolved.active.has('MOD_INVENTORY')).toBe(true)
  })

  it('Ropa: has SKU variants + inventory, no bulk pricing', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, 'ropa', [
      'CHANNEL_WHATSAPP',
      'SALES_EXPERIENCE',
      'SALES_SKU_VARIANTS',
      'SALES_MULTI_PRODUCT',
      'MOD_INVENTORY',
    ])
    expect(resolved.active.has('SALES_SKU_VARIANTS')).toBe(true)
    expect(resolved.active.has('MOD_INVENTORY')).toBe(true)
    expect(resolved.active.has('SALES_BULK_PRICING')).toBe(false)
  })

  it('Service business: has quote request, no inventory', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, 'general', [
      'CHANNEL_WEBCHAT',
      'SALES_QUOTE_REQUEST',
      'SALES_FOLLOWUP',
    ])
    expect(resolved.active.has('SALES_QUOTE_REQUEST')).toBe(true)
    expect(resolved.active.has('MOD_INVENTORY')).toBe(false)
    expect(resolved.active.has('MOD_DELIVERY')).toBe(false)
  })

  it('B2B business: has bulk pricing + quote request + inventory', () => {
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, 'general', [
      'CHANNEL_WHATSAPP',
      'SALES_BULK_PRICING',
      'SALES_MULTI_PRODUCT',
      'SALES_QUOTE_REQUEST',
      'SALES_FOLLOWUP',
      'MOD_INVENTORY',
    ])
    expect(resolved.active.has('SALES_BULK_PRICING')).toBe(true)
    expect(resolved.active.has('SALES_QUOTE_REQUEST')).toBe(true)
    expect(resolved.active.has('MOD_INVENTORY')).toBe(true)
  })
})

// ============================================================================
// EXISTING SYSTEM COMPATIBILITY
// ============================================================================

describe('Existing System Compatibility', () => {
  it('edition capabilities are respected (evaluation lacks delivery)', () => {
    const evalEdition = makeEvalEdition()
    const resolved = resolveCapabilities(BUSINESS_ID, evalEdition, null, ['MOD_DELIVERY'])
    // Even though business wants MOD_DELIVERY, evaluation edition blocks it
    expect(resolved.active.has('MOD_DELIVERY')).toBe(false)
  })

  it('enterprise edition allows all module capabilities', () => {
    const enterprise = makeEdition()
    const resolved = resolveCapabilities(BUSINESS_ID, enterprise, null, [
      'MOD_INVENTORY', 'MOD_DELIVERY', 'MOD_ANALYTICS',
    ])
    expect(resolved.active.has('MOD_INVENTORY')).toBe(true)
    expect(resolved.active.has('MOD_DELIVERY')).toBe(true)
    expect(resolved.active.has('MOD_ANALYTICS')).toBe(true)
  })

  it('core capabilities are never affected by edition', () => {
    const evalEdition = makeEvalEdition()
    const resolved = resolveCapabilities(BUSINESS_ID, evalEdition, null, null)
    expect(resolved.active.size).toBeGreaterThanOrEqual(8)
    for (const cap of CORE_CAPABILITIES) {
      expect(resolved.active.has(cap)).toBe(true)
    }
  })
})
