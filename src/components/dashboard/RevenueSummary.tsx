'use client'

import type { RevenueSummary as RevenueSummaryData } from '@/lib/dashboard/sales-intelligence'

interface RevenueSummaryProps {
  data: RevenueSummaryData
}

export function RevenueSummary({ data }: RevenueSummaryProps) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: 'var(--elevation-1)',
        borderColor: 'var(--atmosphere-border)',
      }}
    >
      <h3
        className="mb-4 text-sm font-semibold tracking-tight"
        style={{ color: 'var(--atmosphere-text)' }}
      >
        Ingresos este mes
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--mia-green)' }}
          >
            Ingresos
          </div>
          <div
            className="mt-1 text-xl font-bold tabular-nums"
            style={{ color: 'var(--atmosphere-text)' }}
          >
            ${data.totalRevenue.toLocaleString()}
          </div>
          <div
            className="mt-0.5 text-[10px]"
            style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
          >
            {data.dealCount} {data.dealCount === 1 ? 'venta' : 'ventas'}
          </div>
        </div>

        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)' }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--mia-gold)' }}
          >
            Pipeline
          </div>
          <div
            className="mt-1 text-xl font-bold tabular-nums"
            style={{ color: 'var(--atmosphere-text)' }}
          >
            ${data.pipelineValue.toLocaleString()}
          </div>
        </div>

        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            Costo IA
          </div>
          <div
            className="mt-1 text-xl font-bold tabular-nums"
            style={{ color: 'var(--atmosphere-text)' }}
          >
            ${data.aiCost.toLocaleString()}
          </div>
        </div>

        <div
          className="rounded-lg p-3"
          style={{
            backgroundColor:
              data.netReturn >= 0
                ? 'rgba(76, 175, 80, 0.1)'
                : 'rgba(244, 67, 54, 0.1)',
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{
              color: data.netReturn >= 0 ? 'var(--mia-green)' : 'var(--mia-platinum)',
            }}
          >
            Retorno neto
          </div>
          <div
            className="mt-1 text-xl font-bold tabular-nums"
            style={{ color: 'var(--atmosphere-text)' }}
          >
            ${data.netReturn.toLocaleString()}
          </div>
        </div>
      </div>

      {data.avgDealValue !== null && (
        <div
          className="mt-4 border-t pt-3 text-center"
          style={{ borderColor: 'var(--atmosphere-border)' }}
        >
          <span
            className="text-xs"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            Ticket promedio: <strong style={{ color: 'var(--atmosphere-text)' }}>${data.avgDealValue.toLocaleString()}</strong>
          </span>
        </div>
      )}
    </div>
  )
}
