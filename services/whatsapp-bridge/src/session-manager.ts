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
import { SupabaseAuthStore } from './supabase-store.js'
import { sendToMia } from './mia-client.js'
import { sendReply } from './media-url.js'
import { createCooldownStore, type CooldownStore } from './guards.js'
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
  reconnectAttempt: number
  reconnectTimer: ReturnType<typeof setTimeout> | null
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

  // Manager-level defensive state. Lives across socket reconnects (a transient
  // 'close' deletes the ActiveSession object, see handleConnectionUpdate) so
  // anti-spam windows survive microcortes. Cleared only on logout/disconnect.
  private readonly cooldownCalls = new Map<string, CooldownStore>()
  private readonly cooldownAudio = new Map<string, CooldownStore>()
  private readonly pendingReplyTimers = new Map<string, Set<NodeJS.Timeout>>()

  constructor(config: BridgeConfig) {
    this.config = config
    this.store = new SupabaseAuthStore(config)
  }

  getStore(): SupabaseAuthStore {
    return this.store
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
      reconnectAttempt: 0,
      reconnectTimer: null,
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
      reconnectAttempt: session.reconnectAttempt,
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
      session.socket.logout().catch(() => undefined)
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

    const attempt = session.reconnectAttempt + 1
    this.scheduleReconnect(businessId, attempt)
  }

  private clearReconnectTimer(session: ActiveSession): void {
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer)
      session.reconnectTimer = null
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
  }

  private scheduleReconnect(businessId: string, attempt: number): void {
    const { health } = this.config
    const delay = Math.min(
      health.baseReconnectDelayMs * 2 ** (attempt - 1),
      health.maxReconnectDelayMs
    )
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
      session.reconnectAttempt = 0
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

      // Exponential backoff on unexpected disconnects. Never retry on logout.
      session.reconnectAttempt += 1
      this.scheduleReconnect(session.businessId, session.reconnectAttempt)
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
        .catch((err) => {
          logger.warn({ err, businessId, caller }, 'call reject text send failed')
        })
    }, 1_000)
    this.trackReplyTimer(businessId, timer)
  }

  private async handleMessages(
    session: ActiveSession,
    messages: WAMessage[],
    _type: 'append' | 'notify' | undefined
  ): Promise<void> {
    if (session.status !== 'connected') return

    session.lastActivityAt = Date.now()

    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue
      if (msg.key.remoteJid && isJidStatusBroadcast(msg.key.remoteJid)) continue
      if (msg.key.remoteJid && isJidGroup(msg.key.remoteJid)) continue
      if (!msg.message) continue

      const remoteJid = msg.key.remoteJid
      if (!remoteJid) continue

      const extracted = extractMessage(msg.message as Record<string, unknown>)
      if (!extracted.content) continue

      const externalId = msg.key.id ?? ''
      const timestamp = toTimestamp(msg.messageTimestamp ?? undefined)
      const waId = jidNormalizedUser(remoteJid)

      try {
        // Forward to the MIA engine. A failed webhook (e.g. MIA app down)
        // must never crash the bridge or drop the connection. Audio uses a
        // shorter timeout so the defensive fallback stays near-instant.
        const isAudio = extracted.payload?.type === 'audio'
        const miaReply = await sendToMia(
          this.config,
          {
            businessId: session.businessId,
            externalId,
            customerExternalId: waId,
            customerName: msg.pushName ?? null,
            customerPhone: waId,
            content: extracted.content,
            payload: extracted.payload,
            receivedAt: timestamp,
          },
          isAudio ? this.config.defensive.audioWebhookTimeoutMs : undefined
        )

        // Shadow mode (deliver: false): MIA processed and stored the reply
        // for learning but must NOT send it to the customer.
        if (miaReply?.deliver === false) continue

        if (miaReply?.response && session.socket.user?.id) {
          if (miaReply.interactive) {
            await sendInteractive(
              session.socket,
              remoteJid,
              miaReply.response,
              miaReply.interactive
            )
          } else {
            // Imagen de producto si aplica (con fallback defensivo a texto si
            // la descarga de la imagen falla o la URL no es segura).
            await sendReply(session.socket, remoteJid, miaReply.response, miaReply.imageUrl)
          }
        }

        // Defensive fallback: when MIA is unreachable for an audio message the
        // bridge answers locally so the customer is never left hanging. At most
        // once per jid per window to avoid a flood of identical texts.
        if (!miaReply?.response && isAudio && session.socket.user?.id) {
          if (this.getAudioCooldown(session.businessId).check(waId)) {
            await session.socket.sendMessage(remoteJid, {
              text: this.config.defensive.audioFallbackText,
            })
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
    try {
      const jid = jidNormalizedUser(to)
      if (interactive) {
        await sendInteractive(session.socket, jid, content, interactive)
      } else {
        await sendReply(session.socket, jid, content, imageUrl)
      }
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

function sendInteractive(
  socket: WASocket,
  jid: string,
  text: string,
  interactive: InteractiveComponent
): Promise<unknown> {
  const userJid = socket.user?.id
  if (!userJid) throw new Error('Cannot send interactive message: socket user not ready')
  const messageContent: proto.IMessage = interactive.type === 'quick_reply'
    ? {
        interactiveMessage: {
          body: { text },
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
          title: text,
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
  return socket.relayMessage(jid, waMessage.message, {
    messageId,
  })
}

function toTimestamp(value: number | Long | Date | undefined): string {
  if (value === undefined) return new Date().toISOString()
  if (typeof value === 'object' && value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && 'toNumber' in value) {
    return new Date(Number((value as { toNumber(): number }).toNumber()) * 1000).toISOString()
  }
  return new Date(Number(value) * 1000).toISOString()
}
