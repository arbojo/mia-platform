import type { HealthConfig } from './health-monitor.js'
import { loadHealthConfig } from './health-monitor.js'
import type { FollowUpConfig } from './follow-up-monitor.js'
import { loadFollowUpConfig } from './follow-up-monitor.js'

export interface DefensiveConfig {
  callRejectText: string
  callRejectCooldownMs: number
  audioFallbackText: string
  audioFallbackCooldownMs: number
  audioWebhookTimeoutMs: number
}

export interface HumanTakeoverConfig {
  /** When false, the bridge ignores the resume token and every human message is forwarded as before. */
  enabled: boolean
  /**
   * Short token a business-side human sends from the business phone to make MIA
   * take the conversation back (resume). It counts as the whole message or as
   * the last token (`bla bla #e`). Deliberately terse so it reads as a typo to
   * the customer; the bridge strips it before forwarding and never deletes the
   * message.
   */
  resumeToken: string
}

export interface BridgeConfig {
  supabaseUrl: string
  supabaseServiceRoleKey: string
  miaAppUrl: string
  bridgeSecret: string
  port: number
  health: HealthConfig
  followUp: FollowUpConfig
  defensive: DefensiveConfig
  humanTakeover: HumanTakeoverConfig
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function loadDefensiveConfig(): DefensiveConfig {
  return {
    callRejectText:
      process.env.BRIDGE_CALL_REJECT_TEXT ??
      'Hola! Por el volumen de mensajes que tengo no puedo contestar llamadas, escríbeme y con gusto te atenderé.',
    callRejectCooldownMs: Number(process.env.BRIDGE_CALL_REJECT_COOLDOWN_MS ?? 60_000),
    audioFallbackText:
      process.env.BRIDGE_AUDIO_FALLBACK_TEXT ??
      'No puedo escuchar notas de voz por aquí, escríbemelo por favor.',
    audioFallbackCooldownMs: Number(process.env.BRIDGE_AUDIO_FALLBACK_COOLDOWN_MS ?? 30_000),
    audioWebhookTimeoutMs: Number(process.env.BRIDGE_AUDIO_WEBHOOK_TIMEOUT_MS ?? 10_000),
  }
}

export function loadHumanTakeoverConfig(): HumanTakeoverConfig {
  return {
    enabled: process.env.HUMAN_TAKEOVER_ENABLED !== '0',
    resumeToken: process.env.HUMAN_RESUME_TOKEN ?? '#e',
  }
}

export function loadConfig(): BridgeConfig {
  return {
    supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    miaAppUrl: process.env.MIA_APP_URL ?? 'http://localhost:3000',
    bridgeSecret: requireEnv('WHATSAPP_BRIDGE_SECRET'),
    port: Number(process.env.BRIDGE_PORT ?? 3001),
    health: loadHealthConfig(),
    followUp: loadFollowUpConfig(),
    defensive: loadDefensiveConfig(),
    humanTakeover: loadHumanTakeoverConfig(),
  }
}
