import { createAdminClient } from '@/lib/supabase/admin'

export type EditionName = 'evaluation' | 'professional' | 'enterprise' | 'cloud'

export interface EditionLimits {
  businesses: number
  assistants: number
  users: number
  channels: number
  conversations: number | null
  products: number | null
  knowledge: number | null
}

export interface EditionCapabilities {
  demoChat: boolean
  whatsapp: boolean
  webchat: boolean
  telegram: boolean
  multiChannel: boolean
  multipleBusinesses: boolean
  multipleAssistants: boolean
  cloudDeployment: boolean
  skills: boolean
  businessMemory: boolean
  learning: boolean
  weeklyReports: boolean
  dashboard: boolean
  promptBuilder: boolean
  knowledgeCenter: boolean
  commercialIntelligence: boolean
  expectationIntelligence: boolean
  responsibleSelling: boolean
  knowledgeStudio: boolean
  salesSimulator: boolean
  connections: boolean
  deliveryHub: boolean
  inventoryHub: boolean
}

export interface Edition {
  name: EditionName
  label: string
  description: string
  limits: EditionLimits
  capabilities: EditionCapabilities
}

const EVALUATION: Edition = {
  name: 'evaluation',
  label: 'MIA Brain — Evaluation Edition',
  description: 'A fully functional single-business laboratory environment. Experience the real MIA.',
  limits: {
    businesses: 1,
    assistants: 1,
    users: 1,
    channels: 1,
    conversations: 1000,
    products: null,
    knowledge: null,
  },
  capabilities: {
    demoChat: true,
    whatsapp: false,
    webchat: true,
    telegram: false,
    multiChannel: false,
    multipleBusinesses: false,
    multipleAssistants: false,
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
    deliveryHub: false,
    inventoryHub: false,
  },
}

const EDITIONS: Record<EditionName, Edition> = {
  evaluation: EVALUATION,
  professional: {
    name: 'professional',
    label: 'MIA Brain — Professional Edition',
    description: 'Production-ready for growing businesses with multiple channels.',
    limits: {
      businesses: 1,
      assistants: 3,
      users: 5,
      channels: 3,
      conversations: null,
      products: null,
      knowledge: null,
    },
    capabilities: {
      demoChat: true,
      whatsapp: true,
      webchat: true,
      telegram: true,
      multiChannel: true,
      multipleBusinesses: false,
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
      deliveryHub: false,
      inventoryHub: false,
    },
  },
  enterprise: {
    name: 'enterprise',
    label: 'MIA Brain — Enterprise Edition',
    description: 'Multi-tenant platform for organizations with advanced needs.',
    limits: {
      businesses: 10,
      assistants: 20,
      users: 50,
      channels: 10,
      conversations: null,
      products: null,
      knowledge: null,
    },
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
    },
  },
  cloud: {
    name: 'cloud',
    label: 'MIA Brain — Cloud Edition',
    description: 'Fully managed cloud deployment with unlimited scale.',
    limits: {
      businesses: 100,
      assistants: 500,
      users: 1000,
      channels: 50,
      conversations: null,
      products: null,
      knowledge: null,
    },
    capabilities: {
      demoChat: true,
      whatsapp: true,
      webchat: true,
      telegram: true,
      multiChannel: true,
      multipleBusinesses: true,
      multipleAssistants: true,
      cloudDeployment: true,
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
    },
  },
}

function getCurrentEditionName(): EditionName {
  const raw = process.env.MIA_EDITION ?? 'evaluation'
  if (raw in EDITIONS) return raw as EditionName
  return 'evaluation'
}

let cachedEdition: Edition | null = null

export function getEdition(): Edition {
  if (!cachedEdition) {
    cachedEdition = EDITIONS[getCurrentEditionName()]
  }
  return cachedEdition
}

export function getEditionName(): EditionName {
  return getEdition().name
}

export function getEditionLimits(): EditionLimits {
  return getEdition().limits
}

export function getEditionCapabilities(): EditionCapabilities {
  return getEdition().capabilities
}

export function canDemoChat(): boolean {
  return getEdition().capabilities.demoChat
}

export function canUseWhatsApp(): boolean {
  return getEdition().capabilities.whatsapp
}

export function canUseWebchat(): boolean {
  return getEdition().capabilities.webchat
}

export function canUseTelegram(): boolean {
  return getEdition().capabilities.telegram
}

export function canUseMultiChannel(): boolean {
  return getEdition().capabilities.multiChannel
}

export function canCreateBusiness(): boolean {
  const limits = getEditionLimits()
  return limits.businesses > 0
}

export function canCreateMultipleBusinesses(): boolean {
  return getEdition().capabilities.multipleBusinesses
}

export function canCreateMultipleAssistants(): boolean {
  return getEdition().capabilities.multipleAssistants
}

export function canUseCloudDeployment(): boolean {
  return getEdition().capabilities.cloudDeployment
}

export function canUseSkills(): boolean {
  return getEdition().capabilities.skills
}

export function canUseBusinessMemory(): boolean {
  return getEdition().capabilities.businessMemory
}

export function canUseLearning(): boolean {
  return getEdition().capabilities.learning
}

export function canUseWeeklyReports(): boolean {
  return getEdition().capabilities.weeklyReports
}

export function canUseDashboard(): boolean {
  return getEdition().capabilities.dashboard
}

export function canUsePromptBuilder(): boolean {
  return getEdition().capabilities.promptBuilder
}

export function canUseKnowledgeCenter(): boolean {
  return getEdition().capabilities.knowledgeCenter
}

export function canUseCommercialIntelligence(): boolean {
  return getEdition().capabilities.commercialIntelligence
}

export function canUseExpectationIntelligence(): boolean {
  return getEdition().capabilities.expectationIntelligence
}

export function canUseResponsibleSelling(): boolean {
  return getEdition().capabilities.responsibleSelling
}

export function canUseKnowledgeStudio(): boolean {
  return getEdition().capabilities.knowledgeStudio
}

export function canUseSalesSimulator(): boolean {
  return getEdition().capabilities.salesSimulator
}

export function canUseConnections(): boolean {
  return getEdition().capabilities.connections
}

export function canUseDeliveryHub(): boolean {
  return getEdition().capabilities.deliveryHub
}

export function canUseInventoryHub(): boolean {
  return getEdition().capabilities.inventoryHub
}

export function isWithinLimit(
  current: number,
  limit: number | null
): boolean {
  if (limit === null) return true
  return current < limit
}

export function getRemainingQuota(
  current: number,
  limit: number | null
): number | null {
  if (limit === null) return null
  return Math.max(0, limit - current)
}

/**
 * Resolves the effective edition for a business (tenant), DB-first with a
 * fallback to the global MIA_EDITION environment variable.
 *
 * Capabilities belong to the BUSINESS, never to the person: a new email gets
 * its own auto-provisioned business (migration 018) with a NULL edition, so it
 * falls back to the global env and stays gated. Only the service-role admin
 * client reads the column (server-side); it is never exposed to the client
 * bundle or the public Data API.
 */
export async function getEffectiveEdition(businessId: string): Promise<Edition> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('businesses')
      .select('edition')
      .eq('id', businessId)
      .maybeSingle()

    const editionName = data?.edition as EditionName | null | undefined
    if (editionName && editionName in EDITIONS) {
      return EDITIONS[editionName]
    }
  } catch {
    // DB unavailable should never break capability resolution; fall back.
  }
  return getEdition()
}

export async function canBusinessUseWhatsApp(businessId: string): Promise<boolean> {
  return (await getEffectiveEdition(businessId)).capabilities.whatsapp
}

export async function canBusinessUseDeliveryHub(businessId: string): Promise<boolean> {
  return (await getEffectiveEdition(businessId)).capabilities.deliveryHub
}

export async function canBusinessUseInventoryHub(businessId: string): Promise<boolean> {
  return (await getEffectiveEdition(businessId)).capabilities.inventoryHub
}
