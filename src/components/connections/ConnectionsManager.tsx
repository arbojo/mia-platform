'use client'

import { useState, useEffect } from 'react'
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
import { canUseWhatsApp } from '@/lib/system/edition'
import type { ChannelType } from '@/lib/channels/types'

interface Connection {
  id: string
  business_id: string
  assistant_id: string
  channel: string
  status: string
  last_sync: string | null
  error_message: string | null
  created_at: string
}

interface Assistant {
  id: string
  name: string
}

export function ConnectionsManager() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<ChannelType | ''>('')
  const [selectedAssistant, setSelectedAssistant] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [pingFeedback, setPingFeedback] = useState<Record<string, string>>({})

  const channels = [
    { id: 'web' as ChannelType, label: 'Chat Web', emoji: '\u{1F310}' },
    ...(canUseWhatsApp()
      ? [
          { id: 'whatsapp' as ChannelType, label: 'WhatsApp', emoji: '\u{1F4F1}' },
          { id: 'messenger' as ChannelType, label: 'Messenger', emoji: '\u{1F4AC}' },
          { id: 'instagram' as ChannelType, label: 'Instagram', emoji: '\u{1F4F7}' },
        ]
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
        setConnections((prev) => [connection, ...prev.filter((c) => c.id !== connection.id)])
        setSelectedChannel('')
        setSelectedAssistant('')
      }
    } finally {
      setCreating(false)
    }
  }

  async function handlePing(conn: Connection) {
    setPingFeedback((prev) => ({ ...prev, [conn.id]: 'Probando...' }))

    const res = await fetch(`/api/channels/connections/${conn.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ping' }),
    })

    if (res.ok) {
      const { connection, health } = await res.json()
      setConnections((prev) => prev.map((c) => (c.id === conn.id ? connection : c)))
      const latency = health?.latencyMs !== undefined ? ` · ${health.latencyMs}ms` : ''
      const detail = health?.error ? ` · ${health.error}` : latency
      setPingFeedback((prev) => ({ ...prev, [conn.id]: `${health?.status ?? connection.status}${detail}` }))
    } else {
      setPingFeedback((prev) => ({ ...prev, [conn.id]: 'Error al probar conexion' }))
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
            <Button
              onClick={handleCreate}
              disabled={!selectedChannel || !selectedAssistant || creating}
            >
              {creating ? 'Conectando...' : 'Conectar'}
            </Button>
          </div>
        </CardContent>
      </Card>

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
                      {conn.error_message ? ` · ${conn.error_message}` : ''}
                    </div>
                    {pingFeedback[conn.id] && (
                      <div className="text-xs text-muted-foreground">{pingFeedback[conn.id]}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={conn.status === 'connected' ? 'default' : 'secondary'}>
                    {conn.status}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePing(conn)}
                  >
                    Probar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(conn.id)}
                  >
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
