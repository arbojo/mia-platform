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

export interface BridgeConfig {
  supabaseUrl: string
  supabaseServiceRoleKey: string
  miaAppUrl: string
  bridgeSecret: string
  port: number
  health: HealthConfig
  followUp: FollowUpConfig
  defensive: DefensiveConfig
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
  }
}
