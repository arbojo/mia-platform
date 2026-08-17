'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ChannelType } from '@/lib/channels/types'
import { ConnectionFollowUpConfig } from '@/components/connections/ConnectionFollowUpConfig'
import { Loader2, RefreshCw } from 'lucide-react'
import { MiaSpinner } from '@/components/ui/mia-spinner'

interface Connection {
  id: string
  business_id: string
  assistant_id: string
  channel: string
  status: string
  mode?: 'active' | 'shadow' | 'paused'
  configuration?: Record<string, unknown>
  last_sync: string | null
  created_at: string
}

interface Assistant {
  id: string
  name: string
}

type WaStatus = 'idle' | 'connecting' | 'generating' | 'connected' | 'error'

const WA_CONNECT_TIMEOUT_MS = 60000
const WA_FETCH_TIMEOUT_MS = 20000

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuidLike(value: string): boolean {
  return UUID_PATTERN.test(value)
}

function friendlyAssistantName(name: string | null | undefined, index: number): string {
  if (name && !isUuidLike(name)) return name
  return index === 0 ? 'Asistente Principal' : `Asistente ${index + 1}`
}

function connectionStatusLabel(status: string): string {
  if (status === 'connected') return 'Conectado'
  if (status === 'connecting') return 'Conectando...'
  return 'Desconectado'
}

function connectionStatusColor(status: string): string {
  if (status === 'connected') return 'var(--mia-green)'
  if (status === 'connecting') return 'var(--mia-gold)'
  return 'var(--mia-orange)'
}

const channelCardStyle: React.CSSProperties = {
  borderRadius: 'var(--mod-radius-lg)',
  border: '1px solid var(--atmosphere-border)',
  backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 90%, transparent)',
  backdropFilter: 'blur(24px) saturate(1.4)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
  boxShadow: '0 0 0 1px var(--module-accent-border), 0 0 24px var(--module-glow-soft)',
}

export function ConnectionsManager({ whatsAppEnabled }: { whatsAppEnabled: boolean }) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<ChannelType | ''>('')
  const [selectedAssistant, setSelectedAssistant] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  // WhatsApp (Baileys) flow
  const [waStatus, setWaStatus] = useState<WaStatus>('idle')
  const [waQr, setWaQr] = useState<string | null>(null)
  const [waPhone, setWaPhone] = useState<string | null>(null)
  const [waError, setWaError] = useState<string | null>(null)
  const [waRefreshing, setWaRefreshing] = useState(false)
  const [waAssistantId, setWaAssistantId] = useState('')
  const [waDebugLogs, setWaDebugLogs] = useState<string[]>([])
  const [waDebugOpen, setWaDebugOpen] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const waTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const waStatusRef = useRef<WaStatus>('idle')

  useEffect(() => {
    waStatusRef.current = waStatus
  }, [waStatus])

  const addDebugLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('es-AR', { hour12: false })
    setWaDebugLogs((prev) => [...prev.slice(-50), `${ts} ${msg}`])
  }, [])

  const channels = [
    { id: 'web' as ChannelType, label: 'Chat Web', emoji: '\u{1F310}' },
    ...(whatsAppEnabled
      ? [{ id: 'whatsapp' as ChannelType, label: 'WhatsApp', emoji: '\u{1F4F1}' }]
      : []),
  ]

  const channelMap = Object.fromEntries(channels.map((ch) => [ch.id, ch]))

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: businesses } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)

      if (!businesses || businesses.length === 0) return

      const bid = businesses[0].id
      setBusinessId(bid)

      const [connResult, asstResult] = await Promise.all([
        supabase
          .from('channel_connections')
          .select('*')
          .eq('business_id', bid)
          .order('created_at', { ascending: false }),
        supabase
          .from('assistants')
          .select('id, name')
          .eq('business_id', bid)
          .eq('is_active', true),
      ])

      setConnections(connResult.data ?? [])
      setAssistants(asstResult.data ?? [])
      setLoading(false)
      refreshWaStatus(bid)
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const clearWaTimeout = useCallback(() => {
    if (waTimeoutRef.current) {
      clearTimeout(waTimeoutRef.current)
      waTimeoutRef.current = null
    }
  }, [])

  const armWaTimeout = useCallback(() => {
    clearWaTimeout()
    waTimeoutRef.current = setTimeout(() => {
      closeWs()
      setWaError('La conexión con WhatsApp tardó demasiado. Reintenta.')
      setWaStatus('error')
      setWaQr(null)
    }, WA_CONNECT_TIMEOUT_MS)
  }, [clearWaTimeout, closeWs])

  useEffect(() => {
    return () => {
      closeWs()
      clearWaTimeout()
    }
  }, [closeWs, clearWaTimeout])

  async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), WA_FETCH_TIMEOUT_MS)
    try {
      return await fetch(url, { ...options, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  function cancelWhatsAppConnect() {
    clearWaTimeout()
    closeWs()
    setWaQr(null)
    setWaError(null)
    setWaStatus('idle')
  }

  async function handleCreate() {
    if (!businessId || !selectedChannel || !selectedAssistant) return

    setCreating(true)
    try {
      const res = await fetchWithTimeout('/api/channels/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          assistantId: selectedAssistant,
          channel: selectedChannel,
        }),
      })

      if (res.ok) {
        const { connection } = await res.json()
        setConnections((prev) => [connection, ...prev])
        setSelectedChannel('')
        setSelectedAssistant('')
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return

    const res = await fetchWithTimeout('/api/channels/connections', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: deleteId }),
    })

    if (res.ok) {
      setConnections((prev) => prev.filter((c) => c.id !== deleteId))
    }
    setDeleteId(null)
  }

  async function handleModeChange(connectionId: string, mode: 'active' | 'shadow' | 'paused') {
    const res = await fetchWithTimeout('/api/channels/connections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, mode }),
    })

    if (res.ok) {
      setConnections((prev) =>
        prev.map((c) => (c.id === connectionId ? { ...c, mode } : c)),
      )
    }
  }

  async function handleWhatsAppConnect() {
    if (!businessId) return
    const assistantId = waAssistantId
    if (!assistantId) return

    setWaStatus('connecting')
    setWaQr(null)
    setWaError(null)

    try {
      const sessionRes = await fetchWithTimeout('/api/channels/baileys/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, assistantId }),
      })

      if (!sessionRes.ok) {
        const err = (await sessionRes.json().catch(() => null)) as { error?: string } | null
        throw new Error(err?.error ?? 'No se pudo iniciar la sesión de WhatsApp')
      }

      await openWaSocket()
    } catch (error) {
      clearWaTimeout()
      setWaError(error instanceof Error ? error.message : 'Error desconocido')
      setWaStatus('error')
    }
  }

  async function handleWhatsAppReconnect() {
    if (!businessId) return

    setWaStatus('connecting')
    setWaQr(null)
    setWaError(null)
    setWaDebugLogs([])
    closeWs()
    addDebugLog('=== RECONNECT START ===')
    addDebugLog(`BusinessId: ${businessId}`)

    try {
      addDebugLog('POST /api/channels/baileys/reconnect...')
      const res = await fetchWithTimeout('/api/channels/baileys/reconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        addDebugLog(`Reconnect POST failed: ${res.status} ${err?.error ?? ''}`)
        throw new Error(err?.error ?? 'No se pudo reconectar WhatsApp')
      }

      const body = await res.json() as { status?: string; phone?: string }
      addDebugLog(`Reconnect POST OK: status=${body.status} phone=${body.phone ?? 'n/a'}`)

      await openWaSocket()
    } catch (error) {
      clearWaTimeout()
      addDebugLog(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
      setWaError(error instanceof Error ? error.message : 'Error desconocido')
      setWaStatus('error')
    }
  }

  async function openWaSocket() {
    if (!businessId) return

    addDebugLog('Requesting WS token...')
    const tokenRes = await fetchWithTimeout(
      `/api/channels/baileys/ws-token?businessId=${businessId}`
    )
    if (!tokenRes.ok) {
      addDebugLog(`WS token failed: ${tokenRes.status}`)
      throw new Error('No se pudo obtener el token de conexión')
    }
    const tokenData = (await tokenRes.json()) as { token: string; wsUrl: string }
    addDebugLog(`WS token OK. URL: ${tokenData.wsUrl}`)

    closeWs()
    const wsUrl = `${tokenData.wsUrl}?businessId=${businessId}&token=${tokenData.token}`
    addDebugLog(`Opening WS: ${wsUrl.slice(0, 80)}...`)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    armWaTimeout()
    addDebugLog('Timeout armed: 60s')

    ws.onopen = () => {
      addDebugLog('WS connected to bridge')
    }

    ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : String(event.data)
      addDebugLog(`WS ← ${raw.slice(0, 300)}`)
      const msg = JSON.parse(event.data) as {
        type: 'qr' | 'status' | 'error'
        qr?: string
        dataUrl?: string
        status?: string
        phone?: string
        message?: string
      }

      if (msg.type === 'qr') {
        setWaQr(msg.dataUrl ?? msg.qr ?? null)
        setWaStatus('generating')
        armWaTimeout()
        addDebugLog('QR received, timeout reset')
      } else if (msg.type === 'status') {
        if (msg.status === 'connected') {
          clearWaTimeout()
          setWaStatus('connected')
          setWaPhone(msg.phone ?? null)
          setWaQr(null)
          addDebugLog(`CONNECTED! phone=${msg.phone ?? 'n/a'}`)
          void reconcileBridgeStatus()
        } else if (msg.status === 'connecting') {
          setWaStatus('connecting')
          addDebugLog('Status: connecting')
        } else if (msg.status === 'disconnected') {
          clearWaTimeout()
          setWaStatus('idle')
          setWaQr(null)
          addDebugLog('Status: disconnected')
        } else if (msg.status === 'error') {
          clearWaTimeout()
          setWaStatus('error')
          addDebugLog('Status: error from bridge')
        }
      } else if (msg.type === 'error') {
        clearWaTimeout()
        setWaError(msg.message ?? 'Error de conexión')
        setWaStatus('error')
        addDebugLog(`Error event: ${msg.message}`)
      }
    }

    ws.onerror = () => {
      if (wsRef.current !== ws) return
      clearWaTimeout()
      addDebugLog('WS error event')
      setWaError('No se pudo conectar con el servicio de WhatsApp')
      setWaStatus('error')
    }

    ws.onclose = (ev) => {
      if (wsRef.current !== ws) return
      clearWaTimeout()
      addDebugLog(`WS closed: code=${ev.code} reason=${ev.reason || 'n/a'}`)
      if (waStatusRef.current !== 'connected' && waStatusRef.current !== 'idle') {
        setWaError('Se perdió la conexión con el servicio de WhatsApp')
        setWaStatus('error')
      }
    }
  }

  async function refreshWaStatus(bid?: string) {
    const targetId = bid ?? businessId
    if (!targetId) return

    setWaRefreshing(true)
    try {
      const res = await fetchWithTimeout(`/api/channels/baileys/session?businessId=${targetId}`)
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        setWaError(err?.error ?? 'No se pudo consultar el estado')
        setWaStatus('error')
        return
      }

      const data = (await res.json()) as {
        status?: string
        phone?: string | null
        bridgeEnabled?: boolean
      }

      if (data.bridgeEnabled === false) {
        setWaError('El puente de WhatsApp no está configurado en este entorno.')
        setWaStatus('error')
        return
      }

      setWaError(null)
      setWaPhone(data.phone ?? null)

      if (data.status === 'connected') {
        clearWaTimeout()
        setWaStatus('connected')
        setWaQr(null)
        void refreshConnections(targetId)
      } else if (data.status === 'connecting') {
        setWaStatus('connecting')
        openWaSocket().catch((err: unknown) => {
          setWaError(err instanceof Error ? err.message : 'No se pudo abrir la conexi�n')
          setWaStatus('error')
        })
      } else if (data.status === 'error') {
        clearWaTimeout()
        setWaStatus('error')
        void refreshConnections(targetId)
      } else {
        clearWaTimeout()
        setWaStatus('idle')
        setWaQr(null)
        void refreshConnections(targetId)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setWaError('La consulta de estado tardó demasiado.')
      } else {
        setWaError('No se pudo contactar el puente de WhatsApp.')
      }
      setWaStatus('error')
    } finally {
      setWaRefreshing(false)
    }
  }

  async function refreshConnections(bid?: string) {
    const targetId = bid ?? businessId
    if (!targetId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('channel_connections')
      .select('*')
      .eq('business_id', targetId)
      .order('created_at', { ascending: false })
    setConnections(data ?? [])
  }

  async function reconcileBridgeStatus() {
    if (!businessId) return
    try {
      await fetchWithTimeout(`/api/channels/baileys/session?businessId=${businessId}`)
    } catch {
      // reconciliation is best-effort: the GET persists the bridge status server-side
    }
    await refreshConnections()
  }

  async function handleWhatsAppLogout() {
    if (!businessId) return
    clearWaTimeout()
    closeWs()
    setWaStatus('idle')
    setWaQr(null)
    setWaPhone(null)
    setWaError(null)

    const res = await fetchWithTimeout('/api/channels/baileys/session', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId }),
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null
      setWaError(err?.error ?? 'No se pudo desconectar WhatsApp')
      setWaStatus('error')
    }
    refreshConnections()
  }

  const waSessionPersisted = connections.some((c) => c.channel === 'whatsapp')

  const waStatusMeta: Record<WaStatus, { label: string; color: string }> = {
    idle: {
      label: waSessionPersisted ? 'Desconectado' : 'No conectado',
      color: waSessionPersisted ? 'var(--mia-orange)' : 'var(--atmosphere-text-secondary)',
    },
    connecting: { label: 'Conectando...', color: 'var(--mia-gold)' },
    generating: { label: 'Generando codigo QR...', color: 'var(--mia-gold)' },
    connected: { label: waPhone ? `Conectado (${waPhone})` : 'Conectado', color: 'var(--mia-green)' },
    error: { label: 'Error', color: 'var(--mia-red)' },
  }

  if (loading) {
    return <div className="py-8 text-center text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>Cargando conexiones...</div>
  }

  return (
    <div className="space-y-6">
      <Card style={channelCardStyle}>
        <CardHeader>
          <CardTitle style={{ color: 'var(--atmosphere-text)' }}>Agregar canal</CardTitle>
          <CardDescription style={{ color: 'var(--atmosphere-text-secondary)' }}>
            Conecta un nuevo canal de comunicacion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--atmosphere-text)' }}>Canal</label>
              <Select value={selectedChannel} onValueChange={(v) => setSelectedChannel(v as ChannelType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar canal" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      {ch.emoji} {ch.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--atmosphere-text)' }}>Asistente</label>
              <Select value={selectedAssistant} onValueChange={(v) => setSelectedAssistant(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar asistente" />
                </SelectTrigger>
                <SelectContent>
                  {assistants.map((a, i) => (
                    <SelectItem key={a.id} value={a.id}>
                      {friendlyAssistantName(a.name, i)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} disabled={!selectedChannel || !selectedAssistant || creating}>
              {creating ? 'Conectando...' : 'Conectar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {whatsAppEnabled && (
        <Card style={channelCardStyle}>
          <CardHeader>
            <CardTitle style={{ color: 'var(--atmosphere-text)' }}>WhatsApp</CardTitle>
            <CardDescription style={{ color: 'var(--atmosphere-text-secondary)' }}>
              Conecta el WhatsApp de tu negocio escaneando el codigo QR desde la app de WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              {waStatus === 'connecting' || waStatus === 'generating' ? (
                <MiaSpinner className="h-4 w-4" style={{ color: waStatusMeta[waStatus].color }} />
              ) : (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: waStatusMeta[waStatus].color,
                    boxShadow:
                      waStatus === 'connected'
                        ? '0 0 8px var(--module-glow)'
                        : 'none',
                  }}
                />
              )}
              <span
                className="text-sm font-medium"
                style={{
                  color:
                    waStatus === 'idle' || waStatus === 'error'
                      ? waStatusMeta[waStatus].color
                      : 'var(--atmosphere-text)',
                }}
              >
                {waStatusMeta[waStatus].label}
              </span>
            </div>

            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--atmosphere-text)' }}>Asistente</label>
                <Select value={waAssistantId} onValueChange={(v) => setWaAssistantId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar asistente" />
                  </SelectTrigger>
                  <SelectContent>
                    {assistants.map((a, i) => (
                      <SelectItem key={a.id} value={a.id}>
                        {friendlyAssistantName(a.name, i)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => refreshWaStatus()}
                disabled={waRefreshing || waStatus === 'connecting' || waStatus === 'generating'}
              >
                {waRefreshing ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-4 w-4" />
                )}
                Estado
              </Button>
              {waStatus === 'connected' ? (
                <Button variant="destructive" onClick={handleWhatsAppLogout}>
                  Desconectar
                </Button>
              ) : waStatus === 'connecting' || waStatus === 'generating' ? (
                <Button variant="ghost" onClick={cancelWhatsAppConnect}>
                  Cancelar
                </Button>
              ) : (
                <Button
                  onClick={() => (waSessionPersisted ? handleWhatsAppReconnect() : handleWhatsAppConnect())}
                  disabled={!waSessionPersisted && !waAssistantId}
                >
                  {waStatus === 'error'
                    ? 'Reintentar'
                    : waSessionPersisted
                      ? 'Reconectar'
                      : 'Conectar WhatsApp'}
                </Button>
              )}
              {(waStatus === 'error' || waStatus === 'idle') && waSessionPersisted && (
                <Button variant="outline" onClick={handleWhatsAppLogout}>
                  Limpiar sesion
                </Button>
              )}
            </div>

            {waStatus === 'generating' && waQr && (
              <div className="flex flex-col items-center gap-2 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={waQr} alt="Código QR de WhatsApp" className="rounded-lg" width={320} height={320} />
                <p className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  Escanea este codigo con WhatsApp: Ajustes → Dispositivos vinculados
                </p>
              </div>
            )}

            {waStatus === 'error' && (
              <div
                className="rounded-lg border px-4 py-3 text-sm"
                style={{
                  borderColor: 'var(--atmosphere-border)',
                  backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 90%, transparent)',
                  color: 'var(--mia-red)',
                }}
              >
                {waError ?? 'Error al conectar WhatsApp'}
              </div>
            )}

            {waDebugLogs.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setWaDebugOpen(!waDebugOpen)}
                  className="text-xs font-mono cursor-pointer select-none"
                  style={{ color: 'var(--atmosphere-text-secondary)' }}
                >
                  {waDebugOpen ? '▼' : '▶'} Debug log ({waDebugLogs.length} eventos)
                </button>
                {waDebugOpen && (
                  <div
                    className="mt-2 rounded-lg border p-3 text-xs font-mono overflow-auto max-h-64 space-y-0.5"
                    style={{
                      borderColor: 'var(--atmosphere-border)',
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      color: 'var(--atmosphere-text-secondary)',
                    }}
                  >
                    {waDebugLogs.map((log, i) => (
                      <div key={i} style={{ color: log.includes('CONNECTED') ? 'var(--mia-green)' : log.includes('ERROR') || log.includes('failed') ? 'var(--mia-red)' : log.includes('QR') ? 'var(--mia-gold)' : undefined }}>
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {connections.length === 0 ? (
        <Card style={channelCardStyle}>
          <CardContent className="py-8 text-center text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            No hay canales conectados. Agrega uno arriba para empezar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <Card key={conn.id} style={channelCardStyle}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {channelMap[conn.channel as ChannelType]?.emoji ?? '\u{1F4E8}'}
                    </span>
                    <div>
                      <div className="font-medium" style={{ color: 'var(--atmosphere-text)' }}>
                        {channelMap[conn.channel as ChannelType]?.label ?? conn.channel}
                      </div>
                      <div
                        className="text-sm font-medium"
                        style={{ color: connectionStatusColor(conn.status) }}
                      >
                        {connectionStatusLabel(conn.status)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {conn.channel === 'whatsapp' && conn.status !== 'connected' && (
                      <Button
                        onClick={() => handleWhatsAppReconnect()}
                        disabled={waStatus === 'connecting' || waStatus === 'generating'}
                      >
                        {waStatus === 'connecting' || waStatus === 'generating'
                          ? 'Conectando...'
                          : 'Reconectar'}
                      </Button>
                    )}
                    <Select
                      value={conn.mode ?? 'active'}
                      onValueChange={(v) =>
                        handleModeChange(conn.id, v as 'active' | 'shadow' | 'paused')
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="shadow">Sombra</SelectItem>
                        <SelectItem value="paused">Pausado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Badge variant={conn.status === 'connected' ? 'default' : conn.status === 'connecting' ? 'outline' : 'secondary'}>
                      {connectionStatusLabel(conn.status)}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(conn.id)}>
                      Eliminar
                    </Button>
                  </div>
                </div>
                <ConnectionFollowUpConfig
                  connectionId={conn.id}
                  configuration={conn.configuration}
                  onUpdated={refreshConnections}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar conexion</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminara la conexion del canal. Los mensajes pasados no se perderan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
