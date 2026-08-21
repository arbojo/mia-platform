'use client'

import React, { useEffect, useState, useCallback } from 'react'
import type {
  PlatformTenant,
  PlatformBridgeSession,
  PlatformUsageBilling,
  PlatformEdition,
} from '@/lib/platform/types'
import { TenantTable } from './TenantTable'
import { BridgeMonitor } from './BridgeMonitor'

export function PlatformAdminDashboard() {
  const [tenants, setTenants] = useState<PlatformTenant[]>([])
  const [bridges, setBridges] = useState<PlatformBridgeSession[]>([])
  const [billing, setBilling] = useState<PlatformUsageBilling[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionProcessing, setActionProcessing] = useState<string | null>(null)
  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  const showNotice = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setNotification({ message, type })
      setTimeout(() => setNotification(null), 4000)
    },
    []
  )

  useEffect(() => {
    async function fetchPlatformData() {
      try {
        const [resTenants, resBridges, resBilling] = await Promise.all([
          fetch('/api/admin/platform/overview'),
          fetch('/api/admin/platform/channels'),
          fetch('/api/admin/platform/billing-telemetry'),
        ])

        if (!resTenants.ok || !resBridges.ok || !resBilling.ok) {
          throw new Error('Error cargando datos de plataforma')
        }

        const [dataTenants, dataBridges, dataBilling] = await Promise.all([
          resTenants.json(),
          resBridges.json(),
          resBilling.json(),
        ])

        setTenants(dataTenants.businesses ?? [])
        setBridges(dataBridges ?? [])
        setBilling(dataBilling ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }
    void fetchPlatformData()
  }, [])

  const reloadPlatformData = useCallback(async () => {
    try {
      const [resTenants, resBridges, resBilling] = await Promise.all([
        fetch('/api/admin/platform/overview'),
        fetch('/api/admin/platform/channels'),
        fetch('/api/admin/platform/billing-telemetry'),
      ])
      if (resTenants.ok && resBridges.ok && resBilling.ok) {
        const [dataTenants, dataBridges, dataBilling] = await Promise.all([
          resTenants.json(),
          resBridges.json(),
          resBilling.json(),
        ])
        setTenants(dataTenants.businesses ?? [])
        setBridges(dataBridges ?? [])
        setBilling(dataBilling ?? [])
      }
    } catch {
      // silent — data stays stale until next user action
    }
  }, [])

  const handleReconnect = useCallback(
    async (businessId: string) => {
      setActionProcessing(`reconnect-${businessId}`)
      try {
        const res = await fetch('/api/admin/platform/actions/reconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Fallo al reconectar puente')
        showNotice('Puente reiniciado. QR emitido.', 'success')
        setTimeout(reloadPlatformData, 1500)
      } catch (err) {
        showNotice(
          err instanceof Error ? err.message : 'Error al reconectar',
          'error'
        )
      } finally {
        setActionProcessing(null)
      }
    },
    [reloadPlatformData, showNotice]
  )

  const handleEditionChange = useCallback(
    async (businessId: string, edition: PlatformEdition) => {
      setActionProcessing(`edition-${businessId}`)
      try {
        const res = await fetch('/api/admin/platform/actions/update-edition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId, edition }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el plan')
        showNotice(`Plan actualizado a ${edition.toUpperCase()}.`, 'success')
        setTenants((prev) =>
          prev.map((biz) =>
            biz.id === businessId ? { ...biz, edition } : biz
          )
        )
      } catch (err) {
        showNotice(
          err instanceof Error ? err.message : 'Error al actualizar plan',
          'error'
        )
      } finally {
        setActionProcessing(null)
      }
    },
    [showNotice]
  )

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-zinc-400 font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="h-6 w-6 animate-spin rounded-full border border-zinc-100 border-t-transparent" />
          <p className="text-[11px] tracking-widest uppercase">
            Conectando Centro de Mando
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="border border-zinc-800 bg-zinc-900/10 p-6 text-center">
          <p className="text-xs text-zinc-400">{error}</p>
        </div>
      </div>
    )
  }

  const globalTokens = billing.reduce((sum, b) => sum + b.totalTokens, 0)
  const globalCost = billing.reduce((sum, b) => sum + b.calculatedCostUsd, 0)
  const connectedBridges = bridges.filter((b) => b.status === 'connected').length

  return (
    <div className="space-y-8 text-zinc-100">
      {notification && (
        <div
          className={`fixed top-6 right-6 z-50 border px-4 py-3 text-xs tracking-wider transition-all duration-300 ${
            notification.type === 'success'
              ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
              : 'bg-zinc-950 text-zinc-100 border-zinc-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{notification.type === 'success' ? '\u25A0' : '\u25B2'}</span>
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <div className="mb-12 flex items-end justify-between border-b border-zinc-800 pb-8">
        <div>
          <div className="text-[10px] tracking-widest text-zinc-500 uppercase">
            MIA System Core Infrastructure
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 mt-1">
            SaaS Control Panel
          </h1>
          <p className="text-[10px] text-zinc-400 mt-1 font-sans">
            Aislamiento Fisico PostgreSQL RLS y Controladores de Transacciones
            Colectivas.
          </p>
        </div>
        <div className="border border-zinc-700 bg-transparent px-3 py-1 text-[10px] tracking-wider text-zinc-300 uppercase">
          Super Admin Secure Node Activo
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Clientes Activos" value={String(tenants.length)} />
        <MetricCard
          label="Canales WhatsApp"
          value={String(connectedBridges)}
          suffix={`/ ${bridges.length}`}
        />
        <MetricCard
          label="Tokens Acumulados"
          value={globalTokens.toLocaleString()}
        />
        <MetricCard
          label="Costo Acumulado USD"
          value={`$${globalCost.toFixed(4)}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <TenantTable
          tenants={tenants}
          onEditionChange={handleEditionChange}
          actionProcessing={actionProcessing}
        />
        <BridgeMonitor
          bridges={bridges}
          onReconnect={handleReconnect}
          actionProcessing={actionProcessing}
        />
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  suffix,
}: {
  label: string
  value: string
  suffix?: string
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-900/10 p-5 transition-all hover:border-zinc-700">
      <p className="text-[10px] tracking-widest text-zinc-500 uppercase">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-100">
        {value}
        {suffix && (
          <span className="text-xs font-normal text-zinc-500 tracking-normal ml-1">
            {suffix}
          </span>
        )}
      </p>
    </div>
  )
}
