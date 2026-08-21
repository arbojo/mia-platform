'use client'

import React from 'react'
import type { PlatformTenant, PlatformEdition } from '@/lib/platform/types'

const STAGE_LABELS: Record<string, string> = {
  observation: 'Observacion',
  understanding: 'Comprension',
  mentor: 'Mentor',
  advisor: 'Asesor',
  autonomous: 'Autonomo',
}

const VALID_EDITIONS: PlatformEdition[] = ['evaluation', 'professional', 'enterprise', 'cloud']

interface TenantTableProps {
  tenants: PlatformTenant[]
  onEditionChange?: (businessId: string, edition: PlatformEdition) => Promise<void>
  actionProcessing?: string | null
}

export function TenantTable({
  tenants,
  onEditionChange,
  actionProcessing,
}: TenantTableProps) {
  return (
    <div className="border border-zinc-800 bg-zinc-900/10 p-6">
      <h2 className="mb-6 text-xs font-bold tracking-wider text-zinc-300 uppercase">
        Registro de Inquilinos y Subscripcion
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] text-zinc-500 uppercase">
              <th className="pb-3 font-medium">Negocio</th>
              <th className="pb-3 font-medium">Edicion</th>
              <th className="pb-3 font-medium">Cognicion</th>
              <th className="pb-3 font-medium text-right">Conversion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/50">
            {tenants.map((biz) => {
              const isProcessing = actionProcessing === `edition-${biz.id}`
              return (
                <tr key={biz.id} className="hover:bg-zinc-900/20 transition-colors">
                  <td className="py-4 font-semibold text-zinc-200 pr-2">{biz.name}</td>
                  <td className="py-4">
                    {onEditionChange ? (
                      <select
                        disabled={isProcessing}
                        value={biz.edition ?? ''}
                        onChange={(e) => {
                          const val = e.target.value as PlatformEdition
                          if (val) onEditionChange(biz.id, val)
                        }}
                        className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px] rounded px-1.5 py-0.5 focus:outline-none focus:border-zinc-500 disabled:opacity-50 font-mono uppercase"
                      >
                        {VALID_EDITIONS.map((ed) => (
                          <option key={ed} value={ed}>
                            {ed.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[9px] text-zinc-400 font-mono uppercase">
                        {biz.edition ?? 'global'}
                      </span>
                    )}
                  </td>
                  <td className="py-4">
                    <span className="border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[9px] text-zinc-400 capitalize">
                      {STAGE_LABELS[biz.maturityStage] ?? biz.maturityStage}
                    </span>
                  </td>
                  <td className="py-4 text-right font-medium text-zinc-100">
                    {biz.salesWon}{' '}
                    <span className="text-[10px] text-zinc-500">WON</span>
                  </td>
                </tr>
              )
            })}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-zinc-500">
                  No hay negocios registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
