'use client'

import React from 'react'
import type { PlatformBridgeSession } from '@/lib/platform/types'

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  connected: { dot: 'bg-zinc-100 animate-pulse', label: 'Conectado' },
  connecting: { dot: 'bg-zinc-500', label: 'Conectando' },
  disconnected: { dot: 'bg-transparent border border-zinc-600', label: 'Desconectado' },
  error: { dot: 'bg-zinc-600', label: 'Error' },
}

interface BridgeMonitorProps {
  bridges: PlatformBridgeSession[]
  onReconnect?: (businessId: string) => Promise<void>
  actionProcessing?: string | null
}

export function BridgeMonitor({
  bridges,
  onReconnect,
  actionProcessing,
}: BridgeMonitorProps) {
  return (
    <div className="border border-zinc-800 bg-zinc-900/10 p-6">
      <h2 className="mb-6 text-xs font-bold tracking-wider text-zinc-300 uppercase">
        Monitoreo de Puentes Baileys Activo
      </h2>
      <div className="space-y-4">
        {bridges.map((session) => {
          const style = STATUS_STYLES[session.status] ?? STATUS_STYLES.disconnected
          const isProcessing = actionProcessing === `reconnect-${session.businessId}`
          return (
            <div
              key={session.businessId}
              className="flex items-center justify-between border border-zinc-800 p-4 hover:border-zinc-700 transition-colors"
            >
              <div>
                <p className="text-xs font-bold text-zinc-200">{session.businessName}</p>
                <p className="mt-1 text-[10px] text-zinc-500">
                  {session.phone ?? 'Sin numero vinculado'}
                </p>
                {session.errorMessage && (
                  <p className="mt-1 text-[10px] text-zinc-400">{session.errorMessage}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                  <span className="text-[9px] text-zinc-400 uppercase tracking-widest">
                    {style.label}
                  </span>
                </div>
                {onReconnect && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => onReconnect(session.businessId)}
                    className="border border-zinc-700 px-2.5 py-1 text-[9px] tracking-wider uppercase text-zinc-300 hover:bg-zinc-100 hover:text-zinc-950 active:scale-95 transition-all focus:outline-none disabled:opacity-40"
                  >
                    {isProcessing ? 'Reconnecting...' : 'Reboot'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {bridges.length === 0 && (
          <p className="py-8 text-center text-xs text-zinc-500">
            No hay sesiones de WhatsApp registradas
          </p>
        )}
      </div>
    </div>
  )
}
