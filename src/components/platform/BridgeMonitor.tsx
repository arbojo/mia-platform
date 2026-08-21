'use client'

import React from 'react'
import type { PlatformBridgeSession } from '@/lib/platform/types'

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  connected: { dot: 'bg-emerald-400 animate-pulse', label: 'Conectado' },
  connecting: { dot: 'bg-amber-400 animate-pulse', label: 'Conectando' },
  disconnected: { dot: 'bg-rose-500', label: 'Desconectado' },
  error: { dot: 'bg-rose-500', label: 'Error' },
}

export function BridgeMonitor({ bridges }: { bridges: PlatformBridgeSession[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-md">
      <h2 className="mb-4 text-sm font-medium tracking-wide text-slate-300">
        Estatus del Puente Baileys
      </h2>
      <div className="space-y-3">
        {bridges.map((session) => {
          const style = STATUS_STYLES[session.status] ?? STATUS_STYLES.disconnected
          return (
            <div
              key={session.businessId}
              className="flex items-center justify-between rounded-lg border border-slate-800/50 bg-slate-950/45 p-4"
            >
              <div>
                <p className="text-xs font-medium text-slate-200">{session.businessName}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {session.phone ?? 'Sin numero vinculado'}
                </p>
                {session.errorMessage && (
                  <p className="mt-1 text-[10px] text-rose-400">{session.errorMessage}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  {style.label}
                </span>
              </div>
            </div>
          )
        })}
        {bridges.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-500">
            No hay sesiones de WhatsApp registradas
          </p>
        )}
      </div>
    </div>
  )
}
