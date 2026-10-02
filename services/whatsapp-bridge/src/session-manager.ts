import makeWASocket, {
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  isJidStatusBroadcast,
  isJidGroup,
  generateWAMessageFromContent,
  proto,
} from '@whiskeysockets/baileys'
import type {
  WASocket,
  ConnectionState,
  WAMessage,
  WACallEvent,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import QRCode from 'qrcode'
import P from 'pino'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SupabaseAuthStore } from './supabase-store.js'
import { sendToMia } from './mia-client.js'
import { sendReply, sanitizeForWhatsApp, extractSentMessageId } from './media-url.js'
import { withTypingPresence } from './presence.js'
import { createCooldownStore, type CooldownStore } from './guards.js'
import { SentMessageRegistry } from './sent-registry.js'
import { ChannelModeCache, allowsOutbound, type ChannelMode } from './channel-mode.js'
import { ReconnectBackoff } from './reconnect-backoff.js'
import type { BridgeConfig } from './config.js'

export type SessionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
export type SessionEvent =
  | { type: 'qr'; qr: string; dataUrl?: string }
  | { type: 'pairing_code'; pairingCode: string }
  | { type: 'status'; status: SessionStatus; phone?: string }
  | { type: 'error'; message: string }

export type InteractiveType = 'quick_reply' | 'list'

export type MessagePayload =
  | { type: InteractiveType; id: string; title: string }
  | { type: 'audio' }

export interface InteractiveButton {
  id: string
  title: string
}

export interface ListRow {
  id: string
  title: string
  description?: string
}

export interface ListSection {
  title: string
  rows: ListRow[]
}

export type InteractiveComponent =
  | { type: 'quick_reply'; text: string; buttons: InteractiveButton[] }
  | { type: 'list'; text: string; buttonText: string; sections: ListSection[] }

type SessionListener = (event: SessionEvent) => void

export interface SessionHealth {
  businessId: string
  status: SessionStatus
  phone: string | null
  connectedAt: number | null
  lastActivityAt: number | null
  zombieSignalCount: number
  hasIdentity: boolean
  reconnectAttempt: number
  consecutiveSendFailures: number
}

interface ActiveSession {
  businessId: string
  socket: WASocket
  status: SessionStatus
  listeners: Set<SessionListener>
  connectedPhone: string | null
  qrTimeout: ReturnType<typeof setTimeout> | null
  connectedAt: number | null
  lastActivityAt: number | null
  zombieSignalCount: number
  hasIdentity: boolean
  reconnectTimer: ReturnType<typeof setTimeout> | null
  consecutiveSendFailures: number
}

const PROTOCOL_TIMEOUT_PATTERNS = [
  /init queries/i,
  /timed out waiting for message/i,
  /AwaitingInitialSync/i,
  /Timed Out/i,
  /fetchProps/i,
]

const logger = P({ level: 'warn' })

export class SessionManager {
  private readonly sessions = new Map<string, ActiveSession>()
  private readonly store: SupabaseAuthStore
  private readonly config: BridgeConfig
  private readonly connecting = new Map<string, Promise<void>>()

/**
 * Consecutive-failure tracking for reconnects.
   *
   * It cannot live on `ActiveSession`: the connection-update handler removes the
   * session from `sessions` before recording the failure, and `doConnect` then
   * builds a fresh session with `reconnectAttempt: 0`. Counting on that
   * orphaned object meant the counter restarted at 1 on every cycle, so the
   * backoff never escalated past `baseReconnectDelayMs` and the bridge
   * hot-looped every few seconds against a stream WhatsApp kept closing.
   */
  private readonly backoff: ReconnectBackoff

  /** True when a socket stayed up long enough to count as recovered. */
  private heldLongEnough(session: ActiveSession): boolean {
    return (
      session.connectedAt !== null &&
      Date.now() - session.connectedAt >= this.config.health.stableConnectionMs
    )
  }

  // Manager-level defensive state. Lives across socket reconnects (a transient
  // 'close' deletes the ActiveSession object, see handleConnectionUpdate) so
  // anti-spam windows survive microcortes. Cleared only on logout/disconnect.
  private readonly cooldownCalls = new Map<string, CooldownStore>()
  private readonly cooldownAudio = new Map<string, CooldownStore>()
  private readonly pendingReplyTimers = new Map<string, Set<NodeJS.Timeout>>()

  // In-memory message deduplication (Capa 1: survives process lifetime,
  // cleared on bridge restart; TTL prevents unbounded growth).
  // Key: businessId -> Set of processed message IDs (msg.key.id from Baileys).
  private readonly processedMessageIds = new Map<string, Set<string>>()
  private readonly processedMessageTimestamps = new Map<string, Map<string, number>>()
  private readonly MESSAGE_DEDUP_TTL_MS = 60 * 60 * 1000
  private readonly sentRegistry = new SentMessageRegistry()
  private readonly modeCache = new ChannelModeCache()
  private readonly modeDb: SupabaseClient

  constructor(config: BridgeConfig) {
    this.config = config
    this.store = new SupabaseAuthStore(config)
    this.modeDb = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    this.backoff = new ReconnectBackoff(
      config.health.baseReconnectDelayMs,
      config.health.maxReconnectDelayMs,
      config.health.maxReconnectAttempts
    )
  }

  getStore(): SupabaseAuthStore {
    return this.store
  }

  /**
   * On boot, reconnect sessions that were connected before the bridge restarted.
   * Credentials are preserved in whatsapp_sessions; invalid creds fall back to QR flow.
   */
  async restoreAllSessions(): Promise<void> {
    const sessions = await this.store.listRestorableSessions()
    if (sessions.length === 0) return

    console.log(`[session-manager] restoring ${sessions.length} session(s) on boot`)
    for (const sess of sessions) {
      try {
        await this.connect(sess.businessId)
      } catch (error) {
        console.error(
          `[session-manager] restore failed for ${sess.businessId}:`,
          error instanceof Error ? error.message : error
        )
        await this.store.updateStatus(sess.businessId, {
          status: 'disconnected',
          error_message: 'Auto-restore failed on boot',
        })
      }
    }
  }

  /**
   * Graceful shutdown: close sockets and flush writes without deleting credentials.
   */
  async gracefulShutdown(): Promise<void> {
    const businessIds = Array.from(this.sessions.keys())
    await Promise.allSettled(businessIds.map((id) => this.closeSocket(id)))
  }

  private async closeSocket(businessId: string): Promise<void> {
    const session = this.sessions.get(businessId)
    if (!session) return

    session.listeners.clear()
    this.clearReconnectTimer(session)
    try {
      session.socket.end(undefined)
    } catch {
      // ignore
    }
    this.sessions.delete(businessId)
    await this.store.flushWrites(businessId)
  }

  getStatus(businessId: string): { status: SessionStatus; phone: string | null } {
    const session = this.sessions.get(businessId)
    return {
      status: session?.status ?? 'disconnected',
      phone: session?.connectedPhone ?? null,
    }
  }

  private readonly pendingListeners = new Map<string, Set<SessionListener>>()

  subscribe(businessId: string, listener: SessionListener): () => void {
    const session = this.sessions.get(businessId)
    if (!session) {
      // Queue the listener so the first QR/status event is not lost while
      // connect() is still awaiting its initial I/O (load store, fetch version).
      const pending = this.pendingListeners.get(businessId) ?? new Set<SessionListener>()
      pending.add(listener)
      this.pendingListeners.set(businessId, pending)
      void this.connect(businessId).catch((err) => {
        logger.error(err, 'connect failed')
      })
      return () => {
        pending.delete(listener)
        if (pending.size === 0) {
          this.pendingListeners.delete(businessId)
        }
      }
    }
    session.listeners.add(listener)
    return () => session?.listeners.delete(listener)
  }

  async connect(businessId: string): Promise<void> {
    if (this.sessions.has(businessId)) {
      return
    }
    // Deduplicate concurrent connect() calls (WS subscribe + HTTP /start can
    // race). Two Baileys sockets for the same account cause a
    // "conflict type: replaced" disconnect when the second one takes over.
    const inFlight = this.connecting.get(businessId)
    if (inFlight) {
      return inFlight
    }
    const promise = this.doConnect(businessId).finally(() => {
      this.connecting.delete(businessId)
    })
    this.connecting.set(businessId, promise)
    return promise
  }

  /**
   * Forces a fresh connection attempt without destroying persisted
   * credentials: tears down the current socket (if any) and reconnects.
   * If no valid credentials exist, the QR flow fires again.
   */
  async reconnect(businessId: string): Promise<void> {
    const session = this.sessions.get(businessId)
    if (session) {
      session.listeners.clear()
      this.clearReconnectTimer(session)
      try {
        session.socket.end(undefined)
      } catch {
        // ignore
      }
      this.sessions.delete(businessId)
    }
    this.connecting.delete(businessId)
    await this.connect(businessId)
  }

  private async doConnect(businessId: string): Promise<void> {
    const { state, saveCreds } = await this.store.load(businessId)
    const { version } = await fetchLatestBaileysVersion()

    logger.info(`Connecting Baileys for business ${businessId} (version ${version.join('.')})`)

    const sessionLogger = this.createSessionLogger(businessId)
    const socket = makeWASocket({
      version,
      auth: state,
      browser: Browsers.windows('MIA Sales Assistant'),
      logger: sessionLogger,
      printQRInTerminal: false,
      syncFullHistory: false,
      // MIA does not read chat history from the bridge: historical
      // conversations are imported from an explicit WhatsApp export, not from
      // the live socket. App-state sync therefore contributes nothing while
      // being a real failure source — WhatsApp pushes patches referencing
      // prekeys the client never received (`failed to find key ... to decode
      // mutation`), which parks the sync collection and floods the logs.
      shouldSyncHistoryMessage: () => false,
      markOnlineOnConnect: false,
      qrTimeout: 60_000,
    })

    const session: ActiveSession = {
      businessId,
      socket,
      status: 'connecting',
      listeners: new Set(),
      connectedPhone: null,
      qrTimeout: null,
      connectedAt: null,
      lastActivityAt: null,
      zombieSignalCount: 0,
      hasIdentity: false,
      reconnectTimer: null,
      consecutiveSendFailures: 0,
    }
    this.sessions.set(businessId, session)

    // Re-attach any listeners that subscribed while connect() was in flight
    const pending = this.pendingListeners.get(businessId)
    if (pending) {
      for (const listener of pending) {
        session.listeners.add(listener)
      }
      this.pendingListeners.delete(businessId)
    }

    this.emit(session, { type: 'status', status: 'connecting' })
    await this.store.updateStatus(businessId, { status: 'connecting' })

    socket.ev.on('creds.update', () => {
      if (this.sessions.get(businessId) !== session) return
      saveCreds().catch((err) => {
        logger.error(err, 'saveCreds failed')
      })
    })

    socket.ev.on('connection.update', (update: Partial<ConnectionState>) => {
      void this.handleConnectionUpdate(session, update, saveCreds).catch((err) => {
        logger.error(err, 'connection.update handler failed')
      })
    })

    socket.ev.on('messages.upsert', ({ messages, type }) => {
      void this.handleMessages(session, messages, type).catch((err) => {
        logger.error(err, 'messages.upsert handler failed')
      })
    })

    socket.ev.on('call', (calls: WACallEvent[]) => {
      void this.handleCallEvent(session.businessId, calls).catch((err) => {
        logger.error(err, 'call handler failed')
      })
    })
  }

  /**
   * Per-session pino logger. Protocol-timeout signals emitted by Baileys
   * (init queries / AwaitingInitialSync / fetchProps timeouts) are counted as
   * zombie signals so the HealthMonitor can order a preventive restart.
   */
  private createSessionLogger(businessId: string): P.Logger {
    const stream = {
      write: (line: string): void => {
        process.stdout.write(line)
        try {
          const parsed = JSON.parse(line) as { msg?: string }
          const msg = parsed.msg ?? ''
          if (PROTOCOL_TIMEOUT_PATTERNS.some((pattern) => pattern.test(msg))) {
            const session = this.sessions.get(businessId)
            if (session && session.status === 'connected') {
              session.zombieSignalCount += 1
              session.lastActivityAt = Date.now()
            }
          }
        } catch {
          // Non-JSON log lines are ignored.
        }
      },
    }
    return P({ level: 'warn' }, stream)
  }

  getHealth(businessId: string): SessionHealth | null {
    const session = this.sessions.get(businessId)
    if (!session) return null
    return this.toHealth(session)
  }

  listHealth(): SessionHealth[] {
    return Array.from(this.sessions.values()).map((session) => this.toHealth(session))
  }

  private toHealth(session: ActiveSession): SessionHealth {
    return {
      businessId: session.businessId,
      status: session.status,
      phone: session.connectedPhone,
      connectedAt: session.connectedAt,
      lastActivityAt: session.lastActivityAt,
      zombieSignalCount: session.zombieSignalCount,
      hasIdentity: session.hasIdentity,
      reconnectAttempt: this.backoff.current(session.businessId),
      consecutiveSendFailures: session.consecutiveSendFailures,
    }
  }

  /**
   * Preventive restart: tears down the socket without deleting credentials and
   * reconnects. Called by the HealthMonitor when a zombie session is detected.
   */
  async restart(businessId: string): Promise<void> {
    const session = this.sessions.get(businessId)
    if (!session) {
      await this.connect(businessId)
      return
    }

    console.warn(`[session-manager] restarting session ${businessId}`)
    this.clearReconnectTimer(session)
    try {
      session.socket.end(undefined)
    } catch {
      // ignore
    }
    this.sessions.delete(businessId)
    this.emit(session, { type: 'status', status: 'disconnected' })
    await this.store.updateStatus(businessId, {
      status: 'disconnected',
      phone: null,
      error_message: 'Session restarted by HealthMonitor',
    })

    // A HealthMonitor restart is deliberate, not a failure: the monitor only
    // fires once the socket has been up past its grace period, so the backoff
    // history from earlier failures no longer applies.
    this.backoff.recover(businessId)
    this.scheduleReconnect(businessId, this.backoff.fail(businessId))
  }

  private clearReconnectTimer(session: ActiveSession): void {
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer)
      session.reconnectTimer = null
    }
  }

  /**
   * Resolves the channel's operation mode, caching briefly.
   *
   * Needed because the bridge's defensive paths (call-rejection text, audio
   * fallback) can reach a customer *without* asking MIA, so they cannot rely on
   * `deliver:false`. A read failure returns null, which `allowsOutbound` treats
   * as "do not send": failing closed is the whole point of a shadow rehearsal.
   */
  private async getChannelMode(businessId: string): Promise<ChannelMode | null> {
    const cached = this.modeCache.get(businessId)
    if (cached !== undefined) return cached

    try {
      const { data } = await this.modeDb
        .from('channel_connections')
        .select('mode')
        .eq('business_id', businessId)
        .eq('channel', 'whatsapp')
        .maybeSingle()

      const mode = ((data as { mode?: ChannelMode } | null)?.mode ?? null) as ChannelMode | null
      this.modeCache.set(businessId, mode)
      return mode
    } catch (error) {
      logger.warn({ err: error, businessId }, 'could not read channel mode')
      this.modeCache.set(businessId, null)
      return null
    }
  }

  private getCallCooldown(businessId: string): CooldownStore {
    let store = this.cooldownCalls.get(businessId)
    if (!store) {
      store = createCooldownStore({
        maxEntries: 1024,
        windowMs: this.config.defensive.callRejectCooldownMs,
      })
      this.cooldownCalls.set(businessId, store)
    }
    return store
  }

  private getAudioCooldown(businessId: string): CooldownStore {
    let store = this.cooldownAudio.get(businessId)
    if (!store) {
      store = createCooldownStore({
        maxEntries: 1024,
        windowMs: this.config.defensive.audioFallbackCooldownMs,
      })
      this.cooldownAudio.set(businessId, store)
    }
    return store
  }

  private trackReplyTimer(businessId: string, timer: NodeJS.Timeout): void {
    let timers = this.pendingReplyTimers.get(businessId)
    if (!timers) {
      timers = new Set()
      this.pendingReplyTimers.set(businessId, timers)
    }
    timers.add(timer)
  }

  private clearReplyTimers(businessId: string): void {
    const timers = this.pendingReplyTimers.get(businessId)
    if (!timers) return
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
    this.pendingReplyTimers.delete(businessId)
  }

  private clearSessionState(businessId: string): void {
    this.clearReplyTimers(businessId)
    this.cooldownCalls.delete(businessId)
    this.cooldownAudio.delete(businessId)
    // A mode change must be picked up on the next reconnect, and a stale
    // sent-ID set would let an old reply be misread as a human message.
    this.modeCache.invalidate(businessId)
    this.sentRegistry.clear(businessId)
    this.processedMessageIds.delete(businessId)
    this.processedMessageTimestamps.delete(businessId)
  }

  private scheduleReconnect(businessId: string, attempt: number): void {
    const giveUpReason = this.backoff.giveUpReason(attempt)

    if (giveUpReason) {
      // Stop retrying. Without a ceiling the backoff saturates at
      // maxReconnectDelayMs and the bridge retries forever, burning reconnects
      // and hiding the failure. Reporting `error` makes the outage visible.
      console.error(`[session-manager] ${businessId} ${giveUpReason}`)
      this.backoff.recover(businessId)
      void this.store
        .updateStatus(businessId, { status: 'error', error_message: giveUpReason })
        .catch((err) => {
          logger.error(err, 'failed to persist give-up status')
        })
      return
    }

    const delay = this.backoff.delayFor(attempt)
    console.warn(
      `[session-manager] reconnecting ${businessId} (attempt ${attempt}) in ${delay}ms`
    )
    setTimeout(() => {
      void this.connect(businessId).catch((err) => {
        logger.error(err, 'Reconnect failed')
      })
    }, delay)
  }

  private emit(session: ActiveSession, event: SessionEvent): void {
    for (const listener of session.listeners) {
      listener(event)
    }
  }

  private async handleConnectionUpdate(
    session: ActiveSession,
    update: Partial<ConnectionState>,
    saveCreds: () => Promise<void>
  ): Promise<void> {
    // Guard: ignore events from stale sockets. When a reconnect destroys the
    // old socket, its 'close' event fires asynchronously. By that time a NEW
    // session already exists in the map. Processing the stale event would
    // delete the new session and schedule a conflicting third connection.
    if (this.sessions.get(session.businessId) !== session) {
      return
    }

    const { connection, lastDisconnect, qr } = update

    if (qr) {
      session.status = 'connecting'
      const dataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 }).catch(() => undefined)
      this.emit(session, { type: 'qr', qr, dataUrl })
      await this.store.updateStatus(session.businessId, { status: 'connecting', last_qr: qr })
      return
    }

    if (connection === 'open') {
      session.status = 'connected'
      session.connectedPhone = session.socket.user?.id
        ? jidNormalizedUser(session.socket.user.id)
        : null
      session.connectedAt = Date.now()
      session.lastActivityAt = Date.now()
      session.hasIdentity = Boolean(session.socket.user?.id)
      session.zombieSignalCount = 0
      // The failure counter is not cleared here: a socket that reaches `open`
      // and dies seconds later is not a recovery. It is reset on close, and
      // only when the connection actually held (see `heldLongEnough`).
      this.emit(session, {
        type: 'status',
        status: 'connected',
        phone: session.connectedPhone ?? undefined,
      })
      await this.store.updateStatus(session.businessId, {
        status: 'connected',
        phone: session.connectedPhone,
        last_qr: null,
      })
      await saveCreds()
      return
    }

    if (connection === 'close') {
      session.lastActivityAt = Date.now()
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode
      const isLoggedOut =
        statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession

      session.status = isLoggedOut ? 'disconnected' : 'error'
      session.listeners.clear()
      session.hasIdentity = false
      this.sessions.delete(session.businessId)

      if (isLoggedOut) {
        // Meta revoked the device or the session is bad. Clear persisted
        // credentials so the platform never believes it is still registered.
        console.warn(
          `[session-manager] ${session.businessId} logged out (code ${statusCode}). ` +
            `Clearing credentials.`
        )
        this.emit(session, { type: 'status', status: 'disconnected' })
        this.clearSessionState(session.businessId)
        await this.store.delete(session.businessId)
        return
      }

      this.emit(session, {
        type: 'error',
        message: lastDisconnect?.error?.message ?? 'Connection closed unexpectedly',
      })
      await this.store.updateStatus(session.businessId, {
        status: 'error',
        error_message: lastDisconnect?.error?.message ?? 'Connection closed unexpectedly',
      })

      // A socket that held long enough counts as recovered, so the backoff starts
      // over. One that dies immediately does not, and that is what keeps a
      // flapping connection escalating instead of resetting to the base delay.
      if (this.heldLongEnough(session)) {
        this.backoff.recover(session.businessId)
      }
      this.scheduleReconnect(session.businessId, this.backoff.fail(session.businessId))
    }
  }

  /**
   * Defensive handling of incoming calls. Rejects every new incoming offer
   * at the protocol level; the customer-facing text is sent at most once per
   * caller per cooldown window. Group calls and non-offer statuses (ringing,
   * accept, terminate...) are ignored.
   */
  private async handleCallEvent(businessId: string, calls: WACallEvent[]): Promise<void> {
    const session = this.sessions.get(businessId)
    if (!session || session.status !== 'connected') return

    for (const call of calls) {
      if (call.status !== 'offer' || call.isGroup) continue
      const caller = call.from
      if (!caller) continue

      try {
        await session.socket.rejectCall(call.id, caller).catch(() => undefined)
      } catch (error) {
        logger.warn({ error, businessId, caller }, 'rejectCall failed')
        continue
      }

      // rejectCall above still runs: hanging up is not a customer-visible
      // message and leaving calls unanswered would block the real phone. Only
      // the follow-up TEXT is gated, because that is what a customer reads.
      if (!(await allowsOutbound(await this.getChannelMode(businessId)))) return
      if (this.getCallCooldown(businessId).check(caller)) {
        this.scheduleCallReply(businessId, caller)
      }
    }
  }

  /**
   * Schedules the defensive call-rejection text. The timer captures the
   * businessId (not the socket) and re-resolves the live session at fire time,
   * so a quick reconnect does not lose the reply; it is a no-op if the session
   * is gone or not connected.
   */
  private scheduleCallReply(businessId: string, caller: string): void {
    const timer = setTimeout(() => {
      const session = this.sessions.get(businessId)
      if (!session || session.status !== 'connected' || !session.socket.user?.id) return
      session.socket
        .sendMessage(caller, { text: this.config.defensive.callRejectText })
        .then((result) => {
          this.sentRegistry.add(businessId, [extractSentMessageId(result)])
        })
        .catch((err) => {
          logger.warn({ err, businessId, caller }, 'call reject text send failed')
        })
    }, 1_000)
    this.trackReplyTimer(businessId, timer)
  }

  private cleanupMessageDedup(businessId: string): void {
    const ids = this.processedMessageIds.get(businessId)
    const timestamps = this.processedMessageTimestamps.get(businessId)
    if (!ids || !timestamps) return
    const now = Date.now()
    for (const [msgId, ts] of timestamps) {
      if (now - ts > this.MESSAGE_DEDUP_TTL_MS) {
        ids.delete(msgId)
        timestamps.delete(msgId)
      }
    }
  }

  private async handleMessages(
    session: ActiveSession,
    messages: WAMessage[],
    _type: 'append' | 'notify' | undefined
  ): Promise<void> {
    if (session.status !== 'connected') return

    session.lastActivityAt = Date.now()

    // CAPA 1: In-memory deduplication (fast, zero-latency first line of defense).
    // Uses msg.key.id from Baileys which is stable per message across reconnects.
    const seenIds = this.processedMessageIds.get(session.businessId) ?? new Set<string>()
    const seenTimestamps = this.processedMessageTimestamps.get(session.businessId) ?? new Map<string, number>()
    this.processedMessageIds.set(session.businessId, seenIds)
    this.processedMessageTimestamps.set(session.businessId, seenTimestamps)
    this.cleanupMessageDedup(session.businessId)

    for (const msg of messages) {
      const externalId = msg.key?.id ?? ''
      if (externalId && seenIds.has(externalId)) {
        console.log(`[session-manager] Duplicate message ignored (in-memory): ${externalId}`)
        continue
      }
      const fromMe = msg.key?.fromMe === true

      // La vendedora responde desde el MISMO número que el bridge, así que
      // `fromMe` es ambiguo: puede ser ella o puede ser MIA. El registro de
      // envíos desambigua de forma exacta (el key.id que devuelve sendMessage
      // es el mismo que vuelve en el upsert). Lo que nosea nuestros es un
      // mensaje humano, y debe reenviarse para que MIA aprenda de cómo vende.
      if (fromMe && this.sentRegistry.has(session.businessId, externalId)) {
        continue
      }

      if (msg.key?.remoteJid && isJidStatusBroadcast(msg.key.remoteJid)) continue
      if (msg.key?.remoteJid && isJidGroup(msg.key.remoteJid)) continue
      if (!msg.message) continue

      const remoteJid = msg.key.remoteJid
      if (!remoteJid) continue

      const extracted = extractMessage(msg.message as Record<string, unknown>)
      if (!extracted.content) continue

      const timestamp = toTimestamp(msg.messageTimestamp ?? undefined)
      const waId = jidNormalizedUser(remoteJid)
      const content = extracted.content
      const payload = extracted.payload

      try {
        // Forward to the MIA engine. A failed webhook (e.g. MIA app down)
        // must never crash the bridge or drop the connection. Audio uses a
        // shorter timeout so the defensive fallback stays near-instant.
        const isAudio = payload?.type === 'audio'
        const isHumanOutbound = fromMe

        // SIN presencia durante la generación. Antes se emitía 'composing'
        // envolviendo la llamada al webhook, pero en ese punto el bridge aún no
        // sabe si la respuesta se entregará: `deliver:false` (shadow) solo llega
        // en la respuesta. El cliente veía "escribiendo…" y luego nada, que es
        // peor que un silencio limpio. Ahora la presencia se emite únicamente
        // cuando ya sabemos que sí vamos a enviar.
        //
        // Un mensaje humano (vendedora) nunca genera respuesta automática, así
        // que jamás debe producir presencia: se persiste para aprendizaje y se
        // sigue al canal normal.
        const miaReply = isHumanOutbound
          ? await sendToMia(this.config, {
              businessId: session.businessId,
              externalId,
              customerExternalId: waId,
              customerName: msg.pushName ?? null,
              customerPhone: waId,
              content,
              payload,
              receivedAt: timestamp,
              fromHuman: true,
            })
          : await sendToMia(
              this.config,
              {
                businessId: session.businessId,
                externalId,
                customerExternalId: waId,
                customerName: msg.pushName ?? null,
                customerPhone: waId,
                content,
                payload,
                receivedAt: timestamp,
              },
              isAudio ? this.config.defensive.audioWebhookTimeoutMs : undefined
            )

        // Track as processed after successful forward to MIA (even if shadow/deliver=false).
        // If sendToMia threw, we don't track — allowing a potential retry on next reconnect.
        if (externalId) {
          seenIds.add(externalId)
          seenTimestamps.set(externalId, Date.now())
        }

        // Mensaje humano: queda persistido como material de aprendizaje. No hay
        // respuesta que enviar ni efectos que ejecutar.
        if (isHumanOutbound) continue

        // Shadow mode (deliver: false): MIA processed and stored the reply
        // for learning but must NOT send it to the customer.
        if (miaReply?.deliver === false) continue

        if (miaReply?.response && session.socket.user?.id) {
          // Ahora sí sabemos que se entrega: la presencia es segura.
          const deliverReply = async () => {
            const sent = await sendReply(
              session.socket,
              remoteJid,
              miaReply.response as string,
              miaReply.imageUrl
            )
            this.sentRegistry.add(session.businessId, sent.messageIds)
            session.consecutiveSendFailures = 0

            if (miaReply.interactive) {
              const interactiveIds = await sendInteractive(
                session.socket,
                remoteJid,
                miaReply.response as string,
                miaReply.interactive
              )
              this.sentRegistry.add(session.businessId, interactiveIds)
            }
          }

          try {
            await withTypingPresence(session.socket, remoteJid, deliverReply)
          } catch (sendErr) {
            session.consecutiveSendFailures += 1
            logger.error(
              { err: sendErr, businessId: session.businessId, jid: remoteJid },
              `send failed (${session.consecutiveSendFailures} consecutive)`
            )
            if (session.consecutiveSendFailures >= 3) {
              console.warn(
                `[session-manager] ${session.businessId}: ${session.consecutiveSendFailures} consecutive send failures, restarting`
              )
              void this.restart(session.businessId)
              return
            }
          }
        }

        // Fallback defensivo: cuando MIA es inalcanzable en un audio, el bridge
        // responde localmente para que el cliente no quede colgado. Solo cuando
        // NO estamos en shadow — en shadow el silencio es el comportamiento
        // correcto y este texto sería la única señal visible.
        if (!miaReply?.response && isAudio && session.socket.user?.id) {
          if (!(await allowsOutbound(await this.getChannelMode(session.businessId)))) continue
          if (this.getAudioCooldown(session.businessId).check(waId)) {
            const fallbackResult = await session.socket.sendMessage(remoteJid, {
              text: this.config.defensive.audioFallbackText,
            })
            this.sentRegistry.add(session.businessId, [extractSentMessageId(fallbackResult)])
          }
        }
      } catch (error) {
        console.error(
          `[session-manager] failed to forward message ${externalId} to MIA:`,
          error instanceof Error ? error.message : error
        )
      }
    }
  }

  async sendMessage(
    businessId: string,
    to: string,
    content: string,
    imageUrl?: string,
    interactive?: InteractiveComponent
  ): Promise<{ success: boolean; error?: string }> {
    const session = this.sessions.get(businessId)
    if (!session || session.status !== 'connected') {
      return { success: false, error: 'WhatsApp session is not connected' }
    }
    // This is an operator-initiated send (follow-ups, manual messages). It must
    // respect the channel mode too, otherwise a queued job can break a shadow
    // rehearsal that the realtime path honours.
    if (!(await allowsOutbound(await this.getChannelMode(businessId)))) {
      return { success: false, error: 'Channel mode does not allow outbound messages' }
    }
    try {
      const jid = jidNormalizedUser(to)
      await withTypingPresence(session.socket, jid, async () => {
        if (interactive) {
          const interactiveIds = await sendInteractive(
            session.socket,
            jid,
            content,
            interactive
          )
          this.sentRegistry.add(businessId, interactiveIds)
        } else {
          const sent = await sendReply(session.socket, jid, content, imageUrl)
          this.sentRegistry.add(businessId, sent.messageIds)
        }
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async disconnect(businessId: string): Promise<void> {
    const session = this.sessions.get(businessId)
    if (session) {
      session.listeners.clear()
      this.clearReconnectTimer(session)
      try {
        session.socket.end(undefined)
        session.socket.logout().catch(() => undefined)
      } catch {
        // ignore
      }
      this.sessions.delete(businessId)
    }
    this.clearSessionState(businessId)
    await this.store.delete(businessId)
  }
}

interface ExtractedMessage {
  content: string | null
  payload?: MessagePayload
}

function extractMessage(message: Record<string, unknown>): ExtractedMessage {
  const conversation = message.conversation as string | undefined
  if (conversation) return { content: conversation }

  const extended = message.extendedTextMessage as { text?: string } | undefined
  if (extended?.text) return { content: extended.text }

  const buttons = message.buttonsResponseMessage as
    | { selectedButtonId?: string; selectedDisplayText?: string }
    | undefined
  if (buttons?.selectedDisplayText) {
    return {
      content: buttons.selectedDisplayText,
      payload: {
        type: 'quick_reply',
        id: buttons.selectedButtonId ?? '',
        title: buttons.selectedDisplayText,
      },
    }
  }

  const list = message.listResponseMessage as
    | {
        title?: string
        singleSelectReply?: { selectedRowId?: string; selectedDisplayText?: string }
      }
    | undefined
  if (list?.singleSelectReply?.selectedDisplayText) {
    return {
      content: list.singleSelectReply.selectedDisplayText,
      payload: {
        type: 'list',
        id: list.singleSelectReply.selectedRowId ?? '',
        title: list.singleSelectReply.selectedDisplayText,
      },
    }
  }
  if (list?.title) return { content: list.title }

  const image = message.imageMessage as { caption?: string } | undefined
  if (image?.caption) return { content: image.caption }

  const audio = message.audioMessage
  const video = message.videoMessage as { caption?: string } | undefined
  if (audio) return { content: '[Audio recibido]', payload: { type: 'audio' } }
  if (video?.caption) return { content: video.caption }

  return { content: null }
}

/**
 * Envía un mensaje interactivo y devuelve los ids de lo enviado.
 *
 * El id se conoce antes de enviar (`generateWAMessageFromContent` lo produce y
 * además se necesita para `relayMessage`), así que se devuelve aunque el relay
 * devuelva una forma inesperada. Sin esto, un envío con botones sería
 * indistinguible de un mensaje humano en el `upsert` posterior.
 */
async function sendInteractive(
  socket: WASocket,
  jid: string,
  text: string,
  interactive: InteractiveComponent
): Promise<string[]> {
  const safe = sanitizeForWhatsApp(text)
  const userJid = socket.user?.id
  if (!userJid) throw new Error('Cannot send interactive message: socket user not ready')
  const messageContent: proto.IMessage = interactive.type === 'quick_reply'
    ? {
        interactiveMessage: {
          body: { text: safe },
          footer: { text: interactive.text },
          nativeFlowMessage: {
            messageVersion: 3,
            buttons: interactive.buttons.map((button) => ({
              name: 'quick_reply',
              buttonParamsJson: JSON.stringify({
                display_text: button.title,
                id: button.id,
              }),
            })),
          },
        },
      }
    : {
        listMessage: {
          title: safe,
          description: interactive.text,
          buttonText: interactive.buttonText,
          listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
          sections: interactive.sections.map((section) => ({
            title: section.title,
            rows: section.rows.map((row) => ({
              title: row.title,
              description: row.description,
              rowId: row.id,
            })),
          })),
        },
      }

  const waMessage = generateWAMessageFromContent(jid, messageContent, {
    userJid,
  })
  const messageId = waMessage.key?.id
  if (!waMessage.message || !messageId) throw new Error('Cannot send interactive message: no message content')
  const relayResult = await socket.relayMessage(jid, waMessage.message, {
    messageId,
  })
  const relayId = extractSentMessageId(relayResult)
  return relayId === null ? [messageId] : [messageId, relayId]
}

function toTimestamp(value: number | Long | Date | undefined): string {
  if (value === undefined) return new Date().toISOString()
  if (typeof value === 'object' && value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && 'toNumber' in value) {
    return new Date(Number((value as { toNumber(): number }).toNumber()) * 1000).toISOString()
  }
  return new Date(Number(value) * 1000).toISOString()
}
