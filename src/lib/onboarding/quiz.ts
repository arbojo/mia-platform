import type {
  QuizQuestion,
  QuizOption,
  BusinessProfile,
  OnboardingStep,
  SalesMode,
  FollowupMode,
  ProductComplexity,
  ModuleSelection,
  ChannelSelection,
  IndustrySuggestion,
  CapabilityId,
} from './types'
import { INDUSTRY_DEFINITIONS } from '@/lib/system/capabilities'

export const INDUSTRY_SUGGESTIONS: IndustrySuggestion[] = INDUSTRY_DEFINITIONS.map((d) => ({
  slug: d.slug,
  label: d.label,
  defaultCapabilities: [...d.defaultCapabilities],
}))

const SALES_MODE_OPTIONS: QuizOption[] = [
  {
    value: 'active',
    label: 'Vender activamente — MIA convence, maneja objeciones y cierra ventas',
    capabilities: [
      'SALES_EXPERIENCE',
      'SALES_COMMERCIAL_INTELLIGENCE',
      'SALES_EXPECTATION_INTELLIGENCE',
      'SALES_RESPONSIBLE_SELLING',
    ],
  },
  {
    value: 'informative',
    label: 'Solo informar — MIA responde preguntas y muestra productos, no presiona',
    capabilities: [],
  },
]

const FOLLOWUP_OPTIONS: QuizOption[] = [
  {
    value: 'yes',
    label: 'Sí, quiero seguimiento automático y recuperación de clientes',
    capabilities: ['SALES_FOLLOWUP', 'SALES_RECOVERY'],
  },
  {
    value: 'no',
    label: 'No, solo atiendo cuando el cliente escribe',
    capabilities: [],
  },
]

const PRODUCT_COMPLEXITY_OPTIONS: QuizOption[] = [
  {
    value: 'simple',
    label: 'Productos/servicios simples — sin tallas, colores ni variantes',
    capabilities: [],
  },
  {
    value: 'variants',
    label: 'Con variantes — tallas, colores, modelos, medidas',
    capabilities: ['SALES_SKU_VARIANTS', 'SALES_MULTI_PRODUCT'],
  },
  {
    value: 'bulk',
    label: 'Venta por mayor/volumen — precios escalonados por cantidad',
    capabilities: ['SALES_BULK_PRICING', 'SALES_MULTI_PRODUCT'],
  },
  {
    value: 'both',
    label: 'Ambos — variantes Y precios por volumen',
    capabilities: [
      'SALES_SKU_VARIANTS',
      'SALES_BULK_PRICING',
      'SALES_MULTI_PRODUCT',
    ],
  },
]

const MODULE_OPTIONS: QuizOption[] = [
  {
    value: 'inventory',
    label: 'Gestión de inventario — stock, alertas, sugerencias de compra',
    capabilities: ['MOD_INVENTORY'],
  },
  {
    value: 'delivery',
    label: 'Gestión de entregas — repartidores, rutas, tracking',
    capabilities: ['MOD_DELIVERY'],
  },
  {
    value: 'both',
    label: 'Ambos — inventario y entregas',
    capabilities: ['MOD_INVENTORY', 'MOD_DELIVERY', 'MOD_ANALYTICS'],
  },
  {
    value: 'none',
    label: 'Ninguno — solo ventas conversacionales',
    capabilities: [],
  },
]

const CHANNEL_OPTIONS: QuizOption[] = [
  {
    value: 'whatsapp',
    label: 'WhatsApp Business',
    capabilities: ['CHANNEL_WHATSAPP'],
  },
  {
    value: 'webchat',
    label: 'Chat web (widget en tu sitio)',
    capabilities: ['CHANNEL_WEBCHAT'],
  },
  {
    value: 'landing',
    label: 'Landing page / página de ventas',
    capabilities: ['CHANNEL_LANDING'],
  },
  {
    value: 'telegram',
    label: 'Telegram Bot',
    capabilities: ['CHANNEL_TELEGRAM'],
  },
]

function deriveIndustryCapabilities(value: string): CapabilityId[] {
  const def = INDUSTRY_DEFINITIONS.find((d) => d.slug === value)
  return def ? [...def.defaultCapabilities] : []
}

function deriveSalesModeCapabilities(value: SalesMode): CapabilityId[] {
  const opt = SALES_MODE_OPTIONS.find((o) => o.value === value)
  return opt?.capabilities ?? []
}

function deriveFollowupCapabilities(value: FollowupMode): CapabilityId[] {
  const opt = FOLLOWUP_OPTIONS.find((o) => o.value === value)
  return opt?.capabilities ?? []
}

function deriveProductComplexityCapabilities(
  value: ProductComplexity
): CapabilityId[] {
  const opt = PRODUCT_COMPLEXITY_OPTIONS.find((o) => o.value === value)
  return opt?.capabilities ?? []
}

function deriveModuleCapabilities(value: ModuleSelection): CapabilityId[] {
  const opt = MODULE_OPTIONS.find((o) => o.value === value)
  return opt?.capabilities ?? []
}

function deriveChannelCapabilities(value: ChannelSelection): CapabilityId[] {
  const opt = CHANNEL_OPTIONS.find((o) => o.value === value)
  return opt?.capabilities ?? []
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1_business_name',
    step: 'identity',
    label: '¿Cómo se llama tu negocio y qué venden?',
    placeholder: 'Ej: "Zapatería El Paso — vendemos calzado para toda la familia"',
    type: 'text',
    required: true,
  },
  {
    id: 'q2_industry',
    step: 'industry',
    label: '¿En qué rubro está tu negocio?',
    type: 'select',
    required: true,
    options: INDUSTRY_SUGGESTIONS.map((s) => ({
      value: s.slug,
      label: s.label,
      capabilities: s.defaultCapabilities,
    })),
    deriveCapabilities: (value) => deriveIndustryCapabilities(value as string),
    confirmMessage: (value, profile) => {
      const caps = deriveIndustryCapabilities(value as string)
      if (caps.length === 0) return ''
      const labels = caps
        .map((c) => CAPABILITY_LABELS[c] ?? c)
        .join(', ')
      return `Basado en "${value}", MIA activaría: ${labels}. ¿Correcto?`
    },
  },
  {
    id: 'q3_sales_mode',
    step: 'sales_ambition',
    label: '¿Qué esperas de MIA en ventas?',
    type: 'radio',
    required: true,
    options: SALES_MODE_OPTIONS,
    deriveCapabilities: (value) => deriveSalesModeCapabilities(value as SalesMode),
    confirmMessage: (value) =>
      value === 'active'
        ? 'MIA venderá activamente: convencerá, manejará objeciones y cerrará. ¿Confirmas?'
        : 'MIA solo informará y mostrará productos, sin presionar. ¿Confirmas?',
  },
  {
    id: 'q4_followup',
    step: 'followup',
    label: '¿Quieres seguimiento automático y recuperación de clientes?',
    type: 'radio',
    required: true,
    options: FOLLOWUP_OPTIONS,
    condition: (profile) => profile.salesMode === 'active',
    deriveCapabilities: (value) => deriveFollowupCapabilities(value as FollowupMode),
    confirmMessage: (value) =>
      value === 'yes'
        ? 'MIA hará seguimiento automático y recuperará clientes inactivos. ¿Confirmas?'
        : 'Sin seguimiento automático — MIA solo atiende cuando el cliente escribe. ¿Confirmas?',
  },
  {
    id: 'q5_product_complexity',
    step: 'product_complexity',
    label: '¿Tus productos tienen variantes (tallas/colores) o vendes por mayor?',
    type: 'radio',
    required: true,
    options: PRODUCT_COMPLEXITY_OPTIONS,
    deriveCapabilities: (value) =>
      deriveProductComplexityCapabilities(value as ProductComplexity),
    confirmMessage: (value, profile) => {
      const caps = deriveProductComplexityCapabilities(value as ProductComplexity)
      if (caps.length === 0) return ''
      const labels = caps
        .map((c) => CAPABILITY_LABELS[c] ?? c)
        .join(', ')
      return `Detecté que necesitas: ${labels}. ¿Correcto?`
    },
  },
  {
    id: 'q6_modules',
    step: 'modules',
    label: '¿Necesitas gestión de inventario y/o entregas?',
    type: 'radio',
    required: true,
    options: MODULE_OPTIONS,
    deriveCapabilities: (value) => deriveModuleCapabilities(value as ModuleSelection),
    confirmMessage: (value) => {
      const labels: Record<ModuleSelection, string> = {
        inventory: 'Inventario',
        delivery: 'Entregas',
        both: 'Inventario y Entregas',
        none: 'Ningún módulo operativo',
      }
      return `MIA gestionará: ${labels[value as ModuleSelection]}. ¿Confirmas?`
    },
  },
  {
    id: 'q7_channels',
    step: 'channels',
    label: '¿Por qué canales atiendes a tus clientes?',
    type: 'multiselect',
    required: true,
    options: CHANNEL_OPTIONS,
    deriveCapabilities: (value) => {
      const channels = (value as ChannelSelection[]) ?? []
      const caps: CapabilityId[] = []
      for (const ch of channels) {
        caps.push(...deriveChannelCapabilities(ch))
      }
      if (channels.length >= 2) caps.push('CHANNEL_MULTI')
      return caps
    },
    confirmMessage: (value) => {
      const channels = (value as ChannelSelection[]) ?? []
      const labels = channels
        .map((c) => CHANNEL_OPTIONS.find((o) => o.value === c)?.label ?? c)
        .join(', ')
      return `MIA conectará con: ${labels}. ¿Correcto?`
    },
  },
  {
    id: 'q8_assistant_name',
    step: 'assistant_name',
    label: '¿Cómo quieres que se llame tu asistente?',
    placeholder: 'Ej: "Sofía", "Carlos", "MIA"',
    type: 'text',
    required: true,
  },
  {
    id: 'q9_confirmation',
    step: 'confirmation',
    label: 'Confirmación final',
    type: 'confirmation',
    required: true,
  },
]

export function getNextStep(
  currentStep: OnboardingStep,
  profile: Partial<BusinessProfile>
): OnboardingStep | null {
  const stepOrder: OnboardingStep[] = [
    'identity',
    'industry',
    'sales_ambition',
    'followup',
    'product_complexity',
    'modules',
    'channels',
    'assistant_name',
    'confirmation',
    'complete',
  ]
  const currentIndex = stepOrder.indexOf(currentStep)
  if (currentIndex === -1 || currentIndex >= stepOrder.length - 1) return null

  let nextIndex = currentIndex + 1
  while (nextIndex < stepOrder.length) {
    const nextStep = stepOrder[nextIndex]
    const question = QUIZ_QUESTIONS.find((q) => q.step === nextStep)
    if (!question) {
      nextIndex++
      continue
    }
    if (question.condition && !question.condition(profile)) {
      nextIndex++
      continue
    }
    return nextStep
  }
  return null
}

export function getQuestionsForStep(
  step: OnboardingStep
): QuizQuestion | QuizQuestion[] {
  const questions = QUIZ_QUESTIONS.filter((q) => q.step === step)
  return questions.length === 1 ? questions[0] : questions
}

export function isStepSkipped(
  step: OnboardingStep,
  profile: Partial<BusinessProfile>
): boolean {
  const question = QUIZ_QUESTIONS.find((q) => q.step === step)
  return question?.condition ? !question.condition(profile) : false
}

export function deriveCapabilitiesFromProfile(
  profile: BusinessProfile
): CapabilityId[] {
  const caps: CapabilityId[] = []

  if (profile.industry) {
    caps.push(...deriveIndustryCapabilities(profile.industry))
  }
  caps.push(...deriveSalesModeCapabilities(profile.salesMode))
  if (profile.followupMode) {
    caps.push(...deriveFollowupCapabilities(profile.followupMode))
  }
  caps.push(...deriveProductComplexityCapabilities(profile.productComplexity))
  for (const mod of profile.modules) {
    caps.push(...deriveModuleCapabilities(mod))
  }
  for (const ch of profile.channels) {
    caps.push(...deriveChannelCapabilities(ch))
  }
  if (profile.channels.length >= 2) {
    caps.push('CHANNEL_MULTI')
  }

  return [...new Set(caps)]
}

const CAPABILITY_LABELS: Record<CapabilityId, string> = {
  CORE_CONVERSATION: 'Conversación natural',
  CORE_PRODUCT_PRESENTATION: 'Presentación de productos',
  CORE_OBJECTION_HANDLING: 'Manejo de objeciones',
  CORE_CLOSING: 'Cierre de ventas',
  CORE_KNOWLEDGE: 'Base de conocimiento',
  CORE_MEMORY: 'Memoria del negocio',
  CORE_CUSTOMER_MEMORY: 'Memoria por cliente',
  CORE_LEARNING: 'Aprendizaje continuo',
  CHANNEL_WHATSAPP: 'WhatsApp',
  CHANNEL_WEBCHAT: 'Chat web',
  CHANNEL_TELEGRAM: 'Telegram',
  CHANNEL_MULTI: 'Multi-canal',
  CHANNEL_LANDING: 'Landing page',
  SALES_EXPERIENCE: 'Experiencia de ventas',
  SALES_COMMERCIAL_INTELLIGENCE: 'Inteligencia comercial',
  SALES_EXPECTATION_INTELLIGENCE: 'Gestión de expectativas',
  SALES_RESPONSIBLE_SELLING: 'Venta responsable',
  SALES_MULTI_PRODUCT: 'Multi-producto',
  SALES_SKU_VARIANTS: 'Variantes SKU',
  SALES_BULK_PRICING: 'Precios por volumen',
  SALES_QUOTE_REQUEST: 'Solicitud de cotización',
  SALES_FOLLOWUP: 'Seguimiento automático',
  SALES_RECOVERY: 'Recuperación de clientes',
  MOD_INVENTORY: 'Inventario',
  MOD_DELIVERY: 'Entregas',
  MOD_ANALYTICS: 'Analíticas',
  MULTIPLE_BUSINESSES: 'Múltiples negocios',
  MULTIPLE_ASSISTANTS: 'Múltiples asistentes',
}

export function buildConfirmationData(
  profile: BusinessProfile
): {
  businessType: string
  whatYouSell: string
  howYouSell: string
  channels: string
  capabilities: { id: CapabilityId; label: string; source: string }[]
  modules: string
} {
  const allCaps = deriveCapabilitiesFromProfile(profile)
  const industryDef = INDUSTRY_DEFINITIONS.find((d) => d.slug === profile.industry)

  return {
    businessType: industryDef?.label ?? 'Negocio general',
    whatYouSell: profile.description,
    howYouSell:
      profile.salesMode === 'active'
        ? 'Venta activa con cierre'
        : 'Solo información y consulta',
    channels: profile.channels
      .map((c) => CHANNEL_OPTIONS.find((o) => o.value === c)?.label ?? c)
      .join(', '),
    capabilities: allCaps.map((cap) => ({
      id: cap,
      label: CAPABILITY_LABELS[cap] ?? cap,
      source:
        industryDef?.defaultCapabilities.includes(cap)
          ? 'industry_default'
          : 'explicit',
    })),
    modules:
      profile.modules.length === 0
        ? 'Ninguno'
        : profile.modules
            .map((m) =>
              MODULE_OPTIONS.find((o) => o.value === m)?.label ?? m
            )
            .join(', '),
  }
}