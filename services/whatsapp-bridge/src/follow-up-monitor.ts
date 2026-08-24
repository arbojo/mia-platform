import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { BridgeConfig } from './config.js'
import type { SessionManager } from './session-manager.js'
import { isBridgeJwtConfigured, signBridgeToken, signLegacySessionToken } from './jwt.js'

export interface FollowUpConfig {
  /** How often the monitor scans connections for inactive customers. */
  checkIntervalMs: number
  /** Max customers contacted per connection per scan (spam guard). */
  maxPerConnection: number
  /** Default inactivity delay when the connection omits it (minutes). */
  defaultDelayMinutes: number
}

const DEFAULT_FOLLOW_UP_CONFIG: FollowUpConfig = {
  checkIntervalMs: 10 * 60_000,
  maxPerConnection: 20,
  defaultDelayMinutes: 1440,
}

export function loadFollowUpConfig(env: NodeJS.ProcessEnv = process.env): FollowUpConfig {
  const num = (name: string, fallback: number): number => {
    const raw = env[name]
    if (!raw) return fallback
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }
  return {
    checkIntervalMs: num('FOLLOW_UP_CHECK_INTERVAL_MS', DEFAULT_FOLLOW_UP_CONFIG.checkIntervalMs),
    maxPerConnection: num('FOLLOW_UP_MAX_PER_CONNECTION', DEFAULT_FOLLOW_UP_CONFIG.maxPerConnection),
    defaultDelayMinutes: num('FOLLOW_UP_DEFAULT_DELAY_MINUTES', DEFAULT_FOLLOW_UP_CONFIG.defaultDelayMinutes),
  }
}

interface FollowUpConnection {
  id: string
  assistant_id: string
  configuration: {
    follow_up_enabled?: boolean
    follow_up_delay_minutes?: number
    follow_up_template?: string | null
  }
}

interface FollowUpCandidate {
  id: string
  name: string | null
  phone: string | null
}

/**
 * Inactivity follow-up worker.
 *
 * Periodically scans WhatsApp connections that have follow_up_enabled and
 * re-engages customers whose last interaction is older than the configured
 * delay. Anti-spam: a customer is only contacted when the last follow-up (if
 * any) is older than the last interaction, so we never re-contact someone the
 * business already reached after their last message.
 */
export class FollowUpMonitor {
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly db: SupabaseClient

  constructor(
    private readonly manager: SessionManager,
    private readonly config: BridgeConfig,
    private readonly followUp: FollowUpConfig
  ) {
    this.db = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      this.scanAll().catch((err) => {
        console.error('[follow-up-monitor] scan failed:', err)
      })
    }, this.followUp.checkIntervalMs)
    console.log(`[follow-up-monitor] started (every ${this.followUp.checkIntervalMs}ms)`)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async scanOnce(): Promise<void> {
    await this.scanAll()
  }

  private async scanAll(): Promise<void> {
    for (const health of this.manager.listHealth()) {
      if (health.status !== 'connected') continue
      try {
        await this.scanConnection(health.businessId)
      } catch (err) {
        console.error(
          `[follow-up-monitor] scan failed for ${health.businessId}:`,
          err instanceof Error ? err.message : err
        )
      }
    }
  }

  private async scanConnection(businessId: string): Promise<void> {
    const connection = await this.loadConnection(businessId)
    if (!connection) return

    const cfg = connection.configuration ?? {}
    if (cfg.follow_up_enabled !== true) return

    const delayMinutes = cfg.follow_up_delay_minutes ?? this.followUp.defaultDelayMinutes
    const threshold = new Date(Date.now() - delayMinutes * 60_000).toISOString()

    const { data: candidates, error } = await this.db
      .from('customers')
      .select('id, name, phone, last_interaction, last_follow_up_at')
      .eq('business_id', businessId)
      .not('phone', 'is', null)
      .lt('last_interaction', threshold)
      .limit(this.followUp.maxPerConnection * 4)

    if (error) {
      console.error(`[follow-up-monitor] failed to load candidates for ${businessId}:`, error.message)
      return
    }

    let contacted = 0
    for (const candidate of (candidates ?? []) as Array<{
      id: string
      name: string | null
      phone: string | null
      last_interaction: string | null
      last_follow_up_at: string | null
    }>) {
      if (contacted >= this.followUp.maxPerConnection) break
      if (!this.shouldFollowUp(candidate.last_interaction, candidate.last_follow_up_at)) continue

      const ok = await this.contact(businessId, connection, candidate)
      if (ok) contacted += 1
    }
  }

  private shouldFollowUp(
    lastInteraction: string | null,
    lastFollowUp: string | null
  ): boolean {
    if (!lastInteraction) return false
    // Anti-spam: only contact if no follow-up was sent after the last
    // interaction (i.e. we never double-message someone already reached).
    if (!lastFollowUp) return true
    return lastFollowUp < lastInteraction
  }

  private async loadConnection(businessId: string): Promise<FollowUpConnection | null> {
    const { data } = await this.db
      .from('channel_connections')
      .select('id, assistant_id, configuration')
      .eq('business_id', businessId)
      .eq('channel', 'whatsapp')
      .eq('status', 'connected')
      .eq('mode', 'active')
      .maybeSingle()

    return (data as FollowUpConnection | null) ?? null
  }

  private async contact(
    businessId: string,
    connection: FollowUpConnection,
    customer: FollowUpCandidate
  ): Promise<boolean> {
    const content = await this.generateContent(businessId, connection, customer)
    if (!content) return false

    const sent = await this.manager.sendMessage(businessId, customer.phone ?? '', content)
    if (!sent.success) {
      console.error(
        `[follow-up-monitor] failed to send follow-up to ${customer.phone}:`,
        sent.error
      )
      return false
    }

    const now = new Date().toISOString()
    await this.db.from('channel_messages').insert({
      business_id: businessId,
      customer_id: customer.id,
      channel: 'whatsapp',
      direction: 'outgoing',
      content,
      status: 'sent',
      sent_at: now,
      metadata: { follow_up: true, connection_id: connection.id },
    })

    await this.db
      .from('customers')
      .update({ last_follow_up_at: now })
      .eq('id', customer.id)

    await this.db.from('mia_signals').insert({
      business_id: businessId,
      type: 'SALES',
      priority: 'info',
      title: 'Seguimiento por inactividad enviado',
      message: `Se envió un seguimiento a ${customer.name ?? customer.phone}`,
      source: 'follow-up-monitor',
      status: 'active',
      action_available: null,
      action_payload: { customer_id: customer.id, connection_id: connection.id },
    })

    console.log(`[follow-up-monitor] follow-up sent to ${customer.phone}`)
    return true
  }

  private async generateContent(
    businessId: string,
    connection: FollowUpConnection,
    customer: FollowUpCandidate
  ): Promise<string | null> {
    const url = new URL('/api/channels/baileys/followup', this.config.miaAppUrl).toString()

    // Authenticate to MIA exactly like mia-client.sendToMia: JWT when the
    // platform keys are configured, legacy HMAC otherwise.
    let webhookSecret: string
    if (isBridgeJwtConfigured()) {
      webhookSecret = await signBridgeToken(businessId, 'bridge-webhook')
    } else {
      webhookSecret = signLegacySessionToken(this.config.bridgeSecret, businessId)
    }

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mia-webhook-secret': webhookSecret,
        },
        body: JSON.stringify({
          businessId,
          customerId: customer.id,
          connectionId: connection.id,
        }),
        signal: AbortSignal.timeout(30_000),
      })
    } catch (error) {
      console.error(
        `[follow-up-monitor] MIA unreachable for follow-up:`,
        error instanceof Error ? error.message : error
      )
      return null
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[follow-up-monitor] MIA followup error ${res.status}: ${text}`)
      return null
    }

    const data = (await res.json()) as { success: boolean; content?: string }
    if (!data.success || !data.content) return null
    return data.content.trim()
  }
}
