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

interface Connection {
  id: string
  business_id: string
  assistant_id: string
  channel: string
  status: string
  last_sync: string | null
  created_at: string
}

interface Assistant {
  id: string
  name: string
}

type WaStatus = 'idle' | 'connecting' | 'connected' | 'error'

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
  const [waAssistantId, setWaAssistantId] = useState('')
  const wsRef = useRef<WebSocket | null>(null)

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
    }

    load()
  }, [])

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => closeWs()
  }, [closeWs])

  async function handleCreate() {
    if (!businessId || !selectedChannel || !selectedAssistant) return

    setCreating(true)
    try {
      const res = await fetch('/api/channels/connections', {
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

    const res = await fetch('/api/channels/connections', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: deleteId }),
    })

    if (res.ok) {
      setConnections((prev) => prev.filter((c) => c.id !== deleteId))
    }
    setDeleteId(null)
  }

  async function handleWhatsAppConnect() {
    if (!businessId || !waAssistantId) return
    setWaStatus('connecting')
    setWaQr(null)
    setWaError(null)

    try {
      const sessionRes = await fetch('/api/channels/baileys/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, assistantId: waAssistantId }),
      })

      if (!sessionRes.ok) {
        const err = (await sessionRes.json().catch(() => null)) as { error?: string } | null
        throw new Error(err?.error ?? 'No se pudo iniciar la sesión de WhatsApp')
      }

      const tokenRes = await fetch(`/api/channels/baileys/ws-token?businessId=${businessId}`)
      if (!tokenRes.ok) {
        throw new Error('No se pudo obtener el token de conexión')
      }
      const tokenData = (await tokenRes.json()) as { token: string; wsUrl: string }

      closeWs()
      const ws = new WebSocket(`${tokenData.wsUrl}?businessId=${businessId}&token=${tokenData.token}`)
      wsRef.current = ws

      ws.onmessage = (event) => {
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
          setWaStatus('connecting')
        } else if (msg.type === 'status') {
          if (msg.status === 'connected') {
            setWaStatus('connected')
            setWaPhone(msg.phone ?? null)
            setWaQr(null)
            refreshConnections()
          } else if (msg.status === 'disconnected') {
            setWaStatus('idle')
            setWaQr(null)
          }
        } else if (msg.type === 'error') {
          setWaError(msg.message ?? 'Error de conexión')
          setWaStatus('error')
        }
      }

      ws.onerror = () => {
        setWaError('No se pudo conectar con el servicio de WhatsApp')
        setWaStatus('error')
      }
    } catch (error) {
      setWaError(error instanceof Error ? error.message : 'Error desconocido')
      setWaStatus('error')
    }
  }

  async function refreshConnections() {
    if (!businessId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('channel_connections')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
    setConnections(data ?? [])
  }

  async function handleWhatsAppLogout() {
    if (!businessId) return
    setWaStatus('idle')
    setWaQr(null)
    setWaPhone(null)
    closeWs()

    await fetch('/api/channels/baileys/session', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId }),
    })
    refreshConnections()
  }

  if (loading) {
    return <div className="text-muted-foreground py-8 text-center">Cargando conexiones...</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Agregar canal</CardTitle>
          <CardDescription>Conecta un nuevo canal de comunicacion</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Canal</label>
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
              <label className="text-sm font-medium mb-1 block">Asistente</label>
              <Select value={selectedAssistant} onValueChange={(v) => setSelectedAssistant(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar asistente" />
                </SelectTrigger>
                <SelectContent>
                  {assistants.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
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
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp (Baileys)</CardTitle>
            <CardDescription>
              Conecta el WhatsApp de tu negocio escaneando el codigo QR desde la app de WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Asistente</label>
                <Select value={waAssistantId} onValueChange={(v) => setWaAssistantId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar asistente" />
                  </SelectTrigger>
                  <SelectContent>
                    {assistants.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {waStatus !== 'connected' ? (
                <Button
                  onClick={handleWhatsAppConnect}
                  disabled={!waAssistantId || waStatus === 'connecting'}
                >
                  {waStatus === 'connecting' ? 'Conectando...' : 'Conectar WhatsApp'}
                </Button>
              ) : (
                <Button variant="destructive" onClick={handleWhatsAppLogout}>
                  Desconectar
                </Button>
              )}
            </div>

            {waStatus === 'connecting' && waQr && (
              <div className="flex flex-col items-center gap-2 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={waQr} alt="Código QR de WhatsApp" className="rounded-lg" width={320} height={320} />
                <p className="text-sm text-muted-foreground">
                  Escanea este codigo con WhatsApp: Ajustes → Dispositivos vinculados
                </p>
              </div>
            )}

            {waStatus === 'connected' && (
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm">
                  WhatsApp conectado{waPhone ? ` (${waPhone})` : ''}
                </span>
              </div>
            )}

            {waStatus === 'error' && (
              <p className="text-sm text-red-600">{waError ?? 'Error al conectar WhatsApp'}</p>
            )}
          </CardContent>
        </Card>
      )}

      {connections.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hay canales conectados. Agrega uno arriba para empezar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <Card key={conn.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {channelMap[conn.channel as ChannelType]?.emoji ?? '\u{1F4E8}'}
                  </span>
                  <div>
                    <div className="font-medium">
                      {channelMap[conn.channel as ChannelType]?.label ?? conn.channel}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {conn.status === 'connected' ? 'Conectado' : 'Desconectado'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={conn.status === 'connected' ? 'default' : 'secondary'}>
                    {conn.status}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(conn.id)}>
                    Eliminar
                  </Button>
                </div>
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
