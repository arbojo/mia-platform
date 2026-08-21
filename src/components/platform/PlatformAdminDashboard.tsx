'use client'

import React, { useEffect, useState } from 'react'
import type {
  PlatformTenant,
  PlatformBridgeSession,
  PlatformUsageBilling,
} from '@/lib/platform/types'
import { TenantTable } from './TenantTable'
import { BridgeMonitor } from './BridgeMonitor'

export function PlatformAdminDashboard() {
  const [tenants, setTenants] = useState<PlatformTenant[]>([])
  const [bridges, setBridges] = useState<PlatformBridgeSession[]>([])
  const [billing, setBilling] = useState<PlatformUsageBilling[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    fetchPlatformData()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-light">Cargando consola de plataforma...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      </div>
    )
  }

  const globalTokens = billing.reduce((sum, b) => sum + b.totalTokens, 0)
  const globalCost = billing.reduce((sum, b) => sum + b.calculatedCostUsd, 0)
  const connectedBridges = bridges.filter((b) => b.status === 'connected').length

  return (
    <div className="space-y-8 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Centro de Mando de Infraestructura
          </h1>
          <p className="mt-1 text-xs font-light text-slate-400">
            Gobernanza y telemetria global de MIA Platform
          </p>
        </div>
        <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-1 text-xs font-medium text-indigo-400 backdrop-blur-md">
          Super Admin
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Clientes Activos" value={String(tenants.length)} />
        <MetricCard
          label="Puentes WhatsApp Conectados"
          value={connectedBridges}
          suffix={`/ ${bridges.length}`}
          accent="text-emerald-400"
        />
        <MetricCard
          label="Tokens Acumulados"
          value={globalTokens.toLocaleString()}
          accent="text-indigo-400"
        />
        <MetricCard
          label="Costo de Operacion Estimado"
          value={`$${globalCost.toFixed(4)}`}
          suffix="USD"
          accent="text-sky-400"
          valueSize="text-2xl"
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <TenantTable tenants={tenants} />
        <BridgeMonitor bridges={bridges} />
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  suffix,
  accent,
  valueSize,
}: {
  label: string
  value: string
  suffix?: string
  accent?: string
  valueSize?: string
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-xl transition-all duration-300 hover:border-slate-700/50 hover:bg-slate-900/60">
      <p className="text-xs font-light text-slate-400">{label}</p>
      <p className={`mt-2 font-semibold ${valueSize ?? 'text-3xl'} ${accent ?? 'text-slate-100'}`}>
        {value}
        {suffix && (
          <span className="ml-1 text-sm font-normal text-slate-400">{suffix}</span>
        )}
      </p>
    </div>
  )
}
