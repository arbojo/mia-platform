import type { CapabilityId } from '@/lib/system/capabilities'

export type { CapabilityId }

export type OnboardingStep =
  | 'identity'
  | 'industry'
  | 'sales_ambition'
  | 'followup'
  | 'product_complexity'
  | 'modules'
  | 'channels'
  | 'assistant_name'
  | 'confirmation'
  | 'complete'

export type OnboardingStatus =
  | 'created'
  | 'identity_completed'
  | 'industry_completed'
  | 'sales_completed'
  | 'products_completed'
  | 'modules_completed'
  | 'channels_completed'
  | 'ready'

export type SalesMode = 'active' | 'informative'
export type FollowupMode = 'yes' | 'no'
export type ProductComplexity = 'simple' | 'variants' | 'bulk' | 'both'
export type ModuleSelection = 'inventory' | 'delivery' | 'both' | 'none'
export type ChannelSelection = 'whatsapp' | 'webchat' | 'landing' | 'telegram'

export interface BusinessProfile {
  name: string
  description: string
  industry: string | null
  salesMode: SalesMode
  followupMode: FollowupMode
  productComplexity: ProductComplexity
  modules: ModuleSelection[]
  channels: ChannelSelection[]
  assistantName: string
}

export interface QuizAnswer {
  step: OnboardingStep
  questionId: string
  value: string | string[] | boolean | null
  timestamp: string
  inferredCapabilities?: CapabilityId[]
}

export interface CapabilityIntent {
  explicit: CapabilityId[]
  inferred: CapabilityId[]
  unknown: CapabilityId[]
  sources: Partial<Record<CapabilityId, 'onboarding' | 'inferred' | 'industry_default'>>
}

export interface OnboardingState {
  businessId: string | null
  currentStep: OnboardingStep
  answers: QuizAnswer[]
  profile: Partial<BusinessProfile>
  capabilityIntent: CapabilityIntent | null
  status: OnboardingStatus
  confirmationData: ConfirmationData | null
}

export interface ConfirmationData {
  businessType: string
  whatYouSell: string
  howYouSell: string
  channels: string
  capabilities: { id: CapabilityId; label: string; source: string }[]
  modules: string
}

export interface QuizQuestion {
  id: string
  step: OnboardingStep
  label: string
  placeholder?: string
  type: 'text' | 'select' | 'multiselect' | 'radio' | 'confirmation'
  required: boolean
  options?: QuizOption[]
  condition?: (profile: Partial<BusinessProfile>) => boolean
  deriveCapabilities?: (value: unknown, profile: Partial<BusinessProfile>) => CapabilityId[]
  confirmMessage?: (value: unknown, profile: Partial<BusinessProfile>) => string
}

export interface QuizOption {
  value: string
  label: string
  capabilities?: CapabilityId[]
}

export interface IndustrySuggestion {
  slug: string
  label: string
  defaultCapabilities: CapabilityId[]
}