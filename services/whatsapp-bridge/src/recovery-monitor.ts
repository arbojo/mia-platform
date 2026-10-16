import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { BridgeConfig } from './config.js'
import type { SessionManager } from './session-manager.js'
import { isBridgeJwtConfigured, signBridgeToken, signLegacySessionToken } from './jwt.js'

export interface RecoveryConfig {
  /** How often the monitor asks MIA which recovery messages are due. */
  checkIntervalMs: number
}

const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  checkIntervalMs: 60_000,
}

export function loadRecoveryConfig(env: NodeJS.ProcessEnv = process.env): RecoveryConfig {
  const raw = env.RECOVERY_CHECK_INTERVAL_MS
  const parsed = raw ? Number(raw) : NaN
  const checkIntervalMs =
    Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RECOVERY_CONFIG.checkIntervalMs
  return { checkIntervalMs }
}

export type RecoveryAttempt = 1 | 2 | 3 | 4

export interface RecoveryMarkerMetadata {
  recovery: true
  recovery_attempt: RecoveryAttempt
  recovery_inbound_version: string
  connection_id: string
}

/**
 * Metadata written on the outgoing `channel_messages` row of every recovery
 * attempt. Written BEFORE the send so it doubles as an at-most-once lock: a
 * crash or a concurrent scan can never produce a duplicate.
 */
export function recoveryMarkerMetadata(
  attempt: RecoveryAttempt,
  inboundVersion: string,
  connectionId: string
): RecoveryMarkerMetadata {
  return {
    recovery: true,
    recovery_attempt: attempt,
    recovery_inbound_version: inboundVersion,
    connection_id: connectionId,
  }
}

interface RecoveryConnection {
  id: string
  assistant_id: string
  configuration: { recovery_enabled?: boolean } | null
}

interface RecoveryDue {
  customerId: string
  conversationId: string
  phone: string
  attempt: RecoveryAttempt
  content: string
  inboundVersion: string
}

/**
 * Commercial conversation recovery worker.
 *
 * Periodically asks MIA which recovery messages are due for each connected
 * WhatsApp business, then sends them through the Baileys session. All decision
 * logic (eligibility, attempt timing, dedup) lives on the MIA side; this worker
 * only: (1) loads the connection, (2) fetches the due list, (3) persists the
 * attempt marker before sending, (4) sends and records the real outcome.
 */
export class RecoveryMonitor {
  private timer: ReturnType<typeof setInterval> | null = null
  private inFlight = false
  private readonly db: SupabaseClient

  constructor(
    private readonly manager: SessionManager,
    private readonly config: BridgeConfig,
    private readonly recovery: RecoveryConfig,
    db?: SupabaseClient
  ) {
    this.db =
      db ??
      createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      this.scanAll().catch((err) => {
        console.error('[recovery-monitor] scan failed:', err)
      })
    }, this.recovery.checkIntervalMs)
    console.log(`[recovery-monitor] started (every ${this.recovery.checkIntervalMs}ms)`)
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
    // A scan that outlives its interval must not overlap the next one: two
    // concurrent scans could both read "no marker yet" and double-send.
    if (this.inFlight) return
    this.inFlight = true
    try {
      for (const health of this.manager.listHealth()) {
        if (health.status !== 'connected') continue
        try {
          await this.scanConnection(health.businessId)
        } catch (err) {
          console.error(
            `[recovery-monitor] scan failed for ${health.businessId}:`,
            err instanceof Error ? err.message : err
          )
        }
      }
    } finally {
      this.inFlight = false
    }
  }

  private async scanConnection(businessId: string): Promise<void> {
    const connection = await this.loadConnection(businessId)
    if (!connection) return
    if ((connection.configuration ?? {}).recovery_enabled !== true) return

    const due = await this.fetchDue(businessId, connection.id)
    for (const item of due) {
      await this.processDue(businessId, connection.id, item)
    }
  }

  private async loadConnection(businessId: string): Promise<RecoveryConnection | null> {
    const { data } = await this.db
      .from('channel_connections')
      .select('id, assistant_id, configuration')
      .eq('business_id', businessId)
      .eq('channel', 'whatsapp')
      .eq('status', 'connected')
      .eq('mode', 'active')
      .maybeSingle()

    return (data as RecoveryConnection | null) ?? null
  }

  private async fetchDue(
    businessId: string,
    connectionId: string
  ): Promise<RecoveryDue[]> {
    const url = new URL('/api/channels/baileys/recovery', this.config.miaAppUrl).toString()

    // Authenticate to MIA exactly like the follow-up monitor: JWT when the
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
        body: JSON.stringify({ businessId, connectionId }),
        signal: AbortSignal.timeout(30_000),
      })
    } catch (error) {
      console.error(
        '[recovery-monitor] MIA unreachable for recovery scan:',
        error instanceof Error ? error.message : error
      )
      return []
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[recovery-monitor] MIA recovery error ${res.status}: ${text}`)
      return []
    }

    const data = (await res.json().catch(() => null)) as {
      success: boolean
      due?: RecoveryDue[]
    } | null
    if (!data || !data.success || !Array.isArray(data.due)) return []
    return data.due
  }

  private async processDue(
    businessId: string,
    connectionId: string,
    item: RecoveryDue
  ): Promise<void> {
    // Persist the marker BEFORE sending: even if the process dies mid-send, the
    // attempt is claimed and a later scan will not send it again.
    const { data: inserted } = await this.db
      .from('channel_messages')
      .insert({
        business_id: businessId,
        customer_id: item.customerId,
        channel: 'whatsapp',
        direction: 'outgoing',
        content: item.content,
        status: 'processing',
        metadata: recoveryMarkerMetadata(item.attempt, item.inboundVersion, connectionId),
      })
      .select('id')
      .single()

    const sent = await this.manager.sendMessage(businessId, item.phone, item.content)
    const rowId = (inserted as { id?: string } | null)?.id

    if (rowId) {
      await this.db
        .from('channel_messages')
        .update(
          sent.success
            ? { status: 'sent', sent_at: new Date().toISOString() }
            : { status: 'failed', error_message: sent.error ?? 'send failed' }
        )
        .eq('id', rowId)
    }

    if (!sent.success) {
      console.error(
        `[recovery-monitor] failed to send recovery #${item.attempt} to ${item.phone}:`,
        sent.error
      )
      return
    }

    await this.db.from('mia_signals').insert({
      business_id: businessId,
      type: 'SALES',
      priority: 'info',
      title: 'Recuperación de conversación enviada',
      message: `Intento ${item.attempt} de recuperación enviado a ${item.phone}`,
      source: 'recovery-monitor',
      status: 'active',
      action_available: null,
      action_payload: {
        customer_id: item.customerId,
        connection_id: connectionId,
        attempt: item.attempt,
      },
    })

    console.log(`[recovery-monitor] recovery #${item.attempt} sent to ${item.phone}`)
  }
}
