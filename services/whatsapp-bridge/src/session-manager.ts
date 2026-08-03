import makeWASocket, {
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  isJidStatusBroadcast,
  isJidGroup,
} from '@whiskeysockets/baileys'
import type { WASocket, ConnectionState, WAMessage } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import QRCode from 'qrcode'
import P from 'pino'
import { SupabaseAuthStore } from './supabase-store.js'
import { sendToMia } from './mia-client.js'
import type { BridgeConfig } from './config.js'

export type SessionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
export type SessionEvent =
  | { type: 'qr'; qr: string; dataUrl?: string }
  | { type: 'pairing_code'; pairingCode: string }
  | { type: 'status'; status: SessionStatus; phone?: string }
  | { type: 'error'; message: string }

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
      void this.connect(businessId)
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

    socket.ev.on('creds.update', saveCreds)

    socket.ev.on('connection.update', (update: Partial<ConnectionState>) => {
      void this.handleConnectionUpdate(session, update, saveCreds)
    })

    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      void this.handleMessages(session, messages, type)
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

      const text = extractText(msg.message as Record<string, unknown>)
      if (!text) continue

      const externalId = msg.key.id ?? ''
      const timestamp = toTimestamp(msg.messageTimestamp ?? undefined)
      const waId = jidNormalizedUser(remoteJid)

      try {
        // Forward to the MIA engine. A failed webhook (e.g. MIA app down)
        // must never crash the bridge or drop the connection.
        const miaReply = await sendToMia(this.config, {
          businessId: session.businessId,
          externalId,
          customerExternalId: waId,
          customerName: msg.pushName ?? null,
          customerPhone: waId,
          content: text,
          receivedAt: timestamp,
        })

        if (miaReply?.response && session.socket.user?.id) {
          if (miaReply.imageUrl) {
            await session.socket.sendMessage(remoteJid, {
              image: { url: miaReply.imageUrl },
              caption: miaReply.response,
            })
          } else {
            await session.socket.sendMessage(remoteJid, { text: miaReply.response })
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
    imageUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    const session = this.sessions.get(businessId)
    if (!session || session.status !== 'connected') {
      return { success: false, error: 'WhatsApp session is not connected' }
    }
    try {
      const jid = jidNormalizedUser(to)
      if (imageUrl) {
        await session.socket.sendMessage(jid, { image: { url: imageUrl }, caption: content })
      } else {
        await session.socket.sendMessage(jid, { text: content })
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
    await this.store.delete(businessId)
  }
}

function extractText(message: Record<string, unknown>): string | null {
  const conversation = message.conversation as string | undefined
  if (conversation) return conversation

  const extended = message.extendedTextMessage as { text?: string } | undefined
  if (extended?.text) return extended.text

  const image = message.imageMessage as { caption?: string } | undefined
  if (image?.caption) return image.caption

  const audio = message.audioMessage
  const video = message.videoMessage as { caption?: string } | undefined
  if (audio) return '[Audio recibido]'
  if (video?.caption) return video.caption

  return null
}

function toTimestamp(value: number | Long | Date | undefined): string {
  if (value === undefined) return new Date().toISOString()
  if (typeof value === 'object' && value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && 'toNumber' in value) {
    return new Date(Number((value as { toNumber(): number }).toNumber()) * 1000).toISOString()
  }
  return new Date(Number(value) * 1000).toISOString()
}
