import type {
  BusinessProfile,
  CapabilityIntent,
  QuizAnswer,
  OnboardingStep,
} from './types'
import { deriveCapabilitiesFromProfile, buildConfirmationData } from './quiz'
import { resolveCapabilities, isValidCapabilityId, CapabilityId, CORE_CAPABILITIES } from '@/lib/system/capabilities'
import { Edition } from '@/lib/system/edition'
import { createClient } from '@/lib/supabase/server'

export interface DerivedConfig {
  industry: string | null
  capabilities: CapabilityId[]
  onboardingAnswers: Record<string, unknown>
  capabilitySources: Record<CapabilityId, 'onboarding' | 'inferred' | 'industry_default' | 'config'>
  operationalConfig: OperationalConfigSeeds
}

export interface OperationalConfigSeeds {
  inventory?: {
    enabled: boolean
    vertical: string | null
  }
  delivery?: {
    enabled: boolean
  }
  salesConfig?: {
    ask_address: boolean
    ask_phone: boolean
    allow_cancellation: boolean
    cancellation_window_hours: number
    follow_up_hours: number
    timezone: string
    confirmation_message: string
    cancellation_message: string
  }
  assistantChannels: { channel: string; is_active: boolean }[]
}

export function normalizeAnswers(
  answers: QuizAnswer[],
  profile: BusinessProfile
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}
  for (const answer of answers) {
    normalized[answer.questionId] = answer.value
  }
  normalized.profile = {
    name: profile.name,
    description: profile.description,
    industry: profile.industry,
    salesMode: profile.salesMode,
    followupMode: profile.followupMode,
    productComplexity: profile.productComplexity,
    modules: profile.modules,
    channels: profile.channels,
    assistantName: profile.assistantName,
  }
  return normalized
}

export function deriveCapabilities(
  profile: BusinessProfile,
  edition: Edition
): CapabilityIntent {
  const allDerived = deriveCapabilitiesFromProfile(profile)
  const industryDef = profile.industry
    ? INDUSTRY_DEFINITIONS.find((d) => d.slug === profile.industry)
    : null

  const industryDefaults = industryDef?.defaultCapabilities ?? []
  const explicit = allDerived.filter((c) => !industryDefaults.includes(c))
  const inferred = allDerived.filter((c) => industryDefaults.includes(c))

  const sources: Record<string, 'onboarding' | 'inferred' | 'industry_default'> = {}
  for (const cap of explicit) sources[cap] = 'onboarding'
  for (const cap of inferred) sources[cap] = 'industry_default'

  const allKnownCapabilities = new Set<CapabilityId>([
    ...CORE_CAPABILITIES,
    'CHANNEL_WHATSAPP',
    'CHANNEL_WEBCHAT',
    'CHANNEL_TELEGRAM',
    'CHANNEL_MULTI',
    'CHANNEL_LANDING',
    'SALES_EXPERIENCE',
    'SALES_COMMERCIAL_INTELLIGENCE',
    'SALES_EXPECTATION_INTELLIGENCE',
    'SALES_RESPONSIBLE_SELLING',
    'SALES_MULTI_PRODUCT',
    'SALES_SKU_VARIANTS',
    'SALES_BULK_PRICING',
    'SALES_QUOTE_REQUEST',
    'SALES_FOLLOWUP',
    'SALES_RECOVERY',
    'MOD_INVENTORY',
    'MOD_DELIVERY',
    'MOD_ANALYTICS',
    'MULTIPLE_BUSINESSES',
    'MULTIPLE_ASSISTANTS',
  ])

  const unknown = [...allKnownCapabilities].filter(
    (c) => !allDerived.includes(c) && !CORE_CAPABILITIES.has(c)
  ) as CapabilityId[]

  return { explicit, inferred, unknown, sources }
}

export function seedOperationalConfig(
  profile: BusinessProfile,
  capabilityIntent: CapabilityIntent
): OperationalConfigSeeds {
  const seeds: OperationalConfigSeeds = {
    assistantChannels: [],
  }

  const hasInventory = capabilityIntent.explicit.includes('MOD_INVENTORY') ||
    capabilityIntent.inferred.includes('MOD_INVENTORY')
  const hasDelivery = capabilityIntent.explicit.includes('MOD_DELIVERY') ||
    capabilityIntent.inferred.includes('MOD_DELIVERY')

  if (hasInventory) {
    seeds.inventory = {
      enabled: true,
      vertical: profile.industry,
    }
  }

  if (hasDelivery) {
    seeds.delivery = {
      enabled: true,
    }
  }

  if (profile.salesMode === 'active') {
    seeds.salesConfig = {
      ask_address: true,
      ask_phone: true,
      allow_cancellation: true,
      cancellation_window_hours: 24,
      follow_up_hours: profile.followupMode === 'yes' ? 24 : 0,
      timezone: 'America/Argentina/Buenos_Aires',
      confirmation_message: '¡Perfecto! Tu pedido está confirmado.',
      cancellation_message: 'Tu pedido ha sido cancelado. ¡Esperamos verte pronto!',
    }
  }

  const channelMap: Record<string, string> = {
    whatsapp: 'whatsapp',
    webchat: 'web',
    landing: 'web',
    telegram: 'telegram',
  }
  for (const ch of profile.channels) {
    const channel = channelMap[ch]
    if (channel) {
      seeds.assistantChannels.push({ channel, is_active: true })
    }
  }

  if (!seeds.assistantChannels.some((c) => c.channel === 'web')) {
    seeds.assistantChannels.push({ channel: 'web', is_active: true })
  }

  return seeds
}

export async function persistOnboardingCompletion(
  businessId: string,
  userId: string,
  profile: BusinessProfile,
  capabilityIntent: CapabilityIntent,
  operationalConfig: OperationalConfigSeeds,
  onboardingAnswers: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient()

  const allCapabilities = [
    ...capabilityIntent.explicit,
    ...capabilityIntent.inferred,
  ] as CapabilityId[]

  const capabilitySources: Record<string, string> = {}
  for (const cap of capabilityIntent.explicit) capabilitySources[cap] = 'onboarding'
  for (const cap of capabilityIntent.inferred) capabilitySources[cap] = 'industry_default'

  const { error: businessError } = await supabase
    .from('businesses')
    .update({
      industry: profile.industry,
      capabilities: allCapabilities,
      onboarding_answers: onboardingAnswers,
      capability_sources: capabilitySources,
      onboarding_status: 'ready',
      updated_at: new Date().toISOString(),
    })
    .eq('id', businessId)

  if (businessError) {
    console.error('Error updating business:', businessError)
    throw businessError
  }

  if (operationalConfig.inventory) {
    const { error } = await supabase
      .from('inventory.business_settings')
      .upsert({
        business_id: businessId,
        enabled: true,
        vertical: profile.industry ?? 'general',
        low_stock_threshold: 5,
        critical_stock_threshold: 2,
        auto_reorder: false,
        prediction_enabled: true,
        customer_promise_enabled: true,
        updated_at: new Date().toISOString(),
      })
    if (error) console.error('Error seeding inventory settings:', error)
  }

  if (operationalConfig.delivery) {
    const { error } = await supabase
      .from('delivery.business_settings')
      .upsert({
        business_id: businessId,
        enabled: true,
        default_zone: 'local',
        auto_assign: true,
        notify_customer: true,
        driver_app_required: true,
        gps_required: true,
        updated_at: new Date().toISOString(),
      })
    if (error) console.error('Error seeding delivery settings:', error)
  }

  if (operationalConfig.salesConfig) {
    const { error } = await supabase
      .from('business_sales_config')
      .upsert({
        business_id: businessId,
        ...operationalConfig.salesConfig,
        updated_at: new Date().toISOString(),
      })
    if (error) console.error('Error seeding sales config:', error)
  }

  const { data: assistant } = await supabase
    .from('assistants')
    .select('id')
    .eq('business_id', businessId)
    .maybeSingle()

  if (assistant) {
    for (const ch of operationalConfig.assistantChannels) {
      const { error } = await supabase
        .from('assistant_channels')
        .upsert({
          assistant_id: assistant.id,
          channel: ch.channel as 'web' | 'whatsapp' | 'messenger' | 'instagram',
          is_active: ch.is_active,
        })
      if (error) console.error('Error seeding assistant channel:', error)
    }
  }
}

import { INDUSTRY_DEFINITIONS } from '@/lib/system/capabilities'

export function getEditionForBusiness(businessId: string): Promise<Edition | null> {
  return Promise.resolve(null)
}