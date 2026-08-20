import {
  openai, google, groq,
  OPENAI_MODEL, GOOGLE_MODEL, GROQ_MODEL,
  isOpenAIAvailable, isGoogleAvailable, isGroqAvailable,
} from './providers'

export type AITaskType = 'chat' | 'detection' | 'extraction' | 'analysis' | 'generation' | 'ocr'

interface ProviderEntry {
  provider: typeof openai | typeof google | typeof groq
  model: string
  available: () => boolean
}

interface RoutingConfig {
  primary: ProviderEntry
  fallback: ProviderEntry | null
}

const OPENAI_ENTRY: ProviderEntry = { provider: openai, model: OPENAI_MODEL, available: isOpenAIAvailable }
const GOOGLE_ENTRY: ProviderEntry = { provider: google, model: GOOGLE_MODEL, available: isGoogleAvailable }
const GROQ_ENTRY: ProviderEntry = { provider: groq, model: GROQ_MODEL, available: isGroqAvailable }

const ROUTING_TABLE: Record<AITaskType, RoutingConfig> = {
  chat:       { primary: OPENAI_ENTRY,  fallback: GOOGLE_ENTRY },
  detection:  { primary: GROQ_ENTRY,    fallback: OPENAI_ENTRY },
  extraction: { primary: GROQ_ENTRY,    fallback: OPENAI_ENTRY },
  analysis:   { primary: GOOGLE_ENTRY,  fallback: OPENAI_ENTRY },
  generation: { primary: GOOGLE_ENTRY,  fallback: OPENAI_ENTRY },
  ocr:        { primary: OPENAI_ENTRY,  fallback: null },
}

function resolveEntry(entry: ProviderEntry): ProviderEntry | null {
  return entry.available() ? entry : null
}

export function getRouting(taskType: AITaskType): RoutingConfig {
  const config = ROUTING_TABLE[taskType]
  const primary = resolveEntry(config.primary)
  const fallback = config.fallback ? resolveEntry(config.fallback) : null

  if (!primary) {
    if (fallback) return { primary: fallback, fallback: null }
    return { primary: OPENAI_ENTRY, fallback: null }
  }

  return { primary, fallback: primary === fallback ? null : fallback }
}

export function getProviderModel(taskType: AITaskType): { model: ReturnType<typeof openai>; modelName: string } {
  const { primary } = getRouting(taskType)
  return { model: primary.provider(primary.model), modelName: primary.model }
}

export function getProviderModelWithFallback(taskType: AITaskType): {
  primary: { model: ReturnType<typeof openai>; modelName: string }
  fallback: { model: ReturnType<typeof openai>; modelName: string } | null
} {
  const { primary, fallback } = getRouting(taskType)
  return {
    primary: { model: primary.provider(primary.model), modelName: primary.model },
    fallback: fallback ? { model: fallback.provider(fallback.model), modelName: fallback.model } : null,
  }
}
