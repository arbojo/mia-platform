'use client'

import React from 'react'
import type { PlatformTenant } from '@/lib/platform/types'

const STAGE_LABELS: Record<string, string> = {
  observation: 'Observacion',
  understanding: 'Comprension',
  mentor: 'Mentor',
  advisor: 'Asesor',
  autonomous: 'Autonomo',
}

const STAGE_COLORS: Record<string, string> = {
  observation: 'bg-slate-700 text-slate-300',
  understanding: 'bg-amber-500/15 text-amber-400',
  mentor: 'bg-sky-500/15 text-sky-400',
  advisor: 'bg-indigo-500/15 text-indigo-400',
  autonomous: 'bg-emerald-500/15 text-emerald-400',
}

export function TenantTable({ tenants }: { tenants: PlatformTenant[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-md">
      <h2 className="mb-4 text-sm font-medium tracking-wide text-slate-300">
        Monitoreo de Onboarding y Conversiones
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="pb-3 font-medium">Negocio</th>
              <th className="pb-3 font-medium">Edicion</th>
              <th className="pb-3 font-medium">Etapa Cognitiva</th>
              <th className="pb-3 font-medium text-right">Ganadas</th>
              <th className="pb-3 font-medium text-right">Perdidas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {tenants.map((biz) => (
              <tr key={biz.id} className="text-slate-300 hover:bg-slate-900/25">
                <td className="py-3 font-medium text-slate-200">{biz.name}</td>
                <td className="py-3">
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                    {biz.edition ?? 'global'}
                  </span>
                </td>
                <td className="py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STAGE_COLORS[biz.maturityStage] ?? STAGE_COLORS.observation}`}
                  >
                    {STAGE_LABELS[biz.maturityStage] ?? biz.maturityStage}
                  </span>
                </td>
                <td className="py-3 text-right font-medium text-emerald-400">{biz.salesWon}</td>
                <td className="py-3 text-right font-medium text-rose-400">{biz.salesLost}</td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
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
