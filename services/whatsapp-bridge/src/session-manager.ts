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

interface ActiveSession {
  businessId: string
  socket: WASocket
  status: SessionStatus
  listeners: Set<SessionListener>
  connectedPhone: string | null
  qrTimeout: ReturnType<typeof setTimeout> | null
}

const logger = P({ level: 'warn' })

export class SessionManager {
  private readonly sessions = new Map<string, ActiveSession>()
  private readonly store: SupabaseAuthStore
  private readonly config: BridgeConfig

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

  subscribe(businessId: string, listener: SessionListener): () => void {
    let session = this.sessions.get(businessId)
    if (!session) {
      // Ensure a session exists if credentials are already persisted
      void this.connect(businessId)
      session = this.sessions.get(businessId)
      if (!session) {
        return () => undefined
      }
    }
    session.listeners.add(listener)
    return () => session?.listeners.delete(listener)
  }

  async connect(businessId: string): Promise<void> {
    if (this.sessions.has(businessId)) {
      return
    }

    const { state, saveCreds } = await this.store.load(businessId)
    const { version } = await fetchLatestBaileysVersion()

    logger.info(`Connecting Baileys for business ${businessId} (version ${version.join('.')})`)

    const socket = makeWASocket({
      version,
      auth: state,
      browser: Browsers.windows('MIA Sales Assistant'),
      logger,
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
    }
    this.sessions.set(businessId, session)

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
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode
      const isLoggedOut =
        statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession

      session.status = isLoggedOut ? 'disconnected' : 'error'
      session.listeners.clear()
      this.sessions.delete(session.businessId)

      if (isLoggedOut) {
        this.emit(session, { type: 'status', status: 'disconnected' })
        await this.store.updateStatus(session.businessId, {
          status: 'disconnected',
          phone: null,
        })
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

      // Reconnect after a delay (but never for logout/bad session)
      const delay = Number((lastDisconnect?.error as Boom | undefined)?.output?.statusCode) === DisconnectReason.connectionReplaced ? 0 : 5000
      setTimeout(() => {
        void this.connect(session.businessId).catch((err) => {
          logger.error(err, 'Reconnect failed')
        })
      }, delay)
    }
  }

  private async handleMessages(
    session: ActiveSession,
    messages: WAMessage[],
    _type: 'append' | 'notify' | undefined
  ): Promise<void> {
    if (session.status !== 'connected') return

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

      // Fire-and-forget forwarding to the MIA engine.
      // MIA replies via the returned payload which the bridge then sends back.
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
        await session.socket.sendMessage(remoteJid, { text: miaReply.response })
      }
    }
  }

  async sendMessage(
    businessId: string,
    to: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> {
    const session = this.sessions.get(businessId)
    if (!session || session.status !== 'connected') {
      return { success: false, error: 'WhatsApp session is not connected' }
    }
    try {
      const jid = jidNormalizedUser(to)
      await session.socket.sendMessage(jid, { text: content })
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async disconnect(businessId: string): Promise<void> {
    const session = this.sessions.get(businessId)
    if (session) {
      session.listeners.clear()
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
