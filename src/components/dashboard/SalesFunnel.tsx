'use client'

import type { SalesFunnel as SalesFunnelData } from '@/lib/dashboard/sales-intelligence'

interface SalesFunnelProps {
  data: SalesFunnelData
}

function FunnelBar({
  label,
  count,
  value,
  color,
  maxCount,
  showValue,
}: {
  label: string
  count: number
  value?: number
  color: string
  maxCount: number
  showValue?: boolean
}) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0

  return (
    <div className="flex items-center gap-3">
      <span
        className="w-28 text-right text-xs font-medium"
        style={{ color: 'var(--atmosphere-text)' }}
      >
        {label}
      </span>
      <div className="flex-1">
        <div
          className="h-7 rounded-lg transition-all duration-500"
          style={{
            width: `${Math.max(4, pct)}%`,
            backgroundColor: color,
            opacity: 0.7,
          }}
        />
      </div>
      <span
        className="w-20 text-left text-sm font-semibold tabular-nums"
        style={{ color: 'var(--atmosphere-text)' }}
      >
        {count}
      </span>
      {showValue && value !== undefined && (
        <span
          className="w-24 text-left text-xs tabular-nums"
          style={{ color: 'var(--atmosphere-text-secondary)' }}
        >
          ${value.toLocaleString()}
        </span>
      )}
    </div>
  )
}

export function SalesFunnel({ data }: SalesFunnelProps) {
  const maxCount = Math.max(data.active.count, data.interested.count, data.sold.count, data.notInterested.count, 1)

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
        Embudo de ventas
      </h3>

      <div className="space-y-2">
        <FunnelBar
          label={data.active.label}
          count={data.active.count}
          color="var(--mia-blue)"
          maxCount={maxCount}
        />
        <FunnelBar
          label={data.interested.label}
          count={data.interested.count}
          value={data.interested.value}
          color="var(--mia-gold)"
          maxCount={maxCount}
          showValue
        />
        <FunnelBar
          label={data.sold.label}
          count={data.sold.count}
          value={data.sold.value}
          color="var(--mia-green)"
          maxCount={maxCount}
          showValue
        />
        <FunnelBar
          label={data.notInterested.label}
          count={data.notInterested.count}
          color="var(--mia-platinum)"
          maxCount={maxCount}
        />
      </div>

      <div className="mt-4 flex items-center gap-4 border-t pt-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
        <div>
          <div
            className="text-xs"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            Resueltas
          </div>
          <div
            className="text-lg font-bold tabular-nums"
            style={{ color: 'var(--atmosphere-text)' }}
          >
            {data.totalResolved}
          </div>
        </div>
        <div className="h-8 w-px" style={{ backgroundColor: 'var(--atmosphere-border)' }} />
        <div>
          <div
            className="text-xs"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            Conversión
          </div>
          <div
            className="text-lg font-bold tabular-nums"
            style={{
              color:
                data.conversionRate !== null && data.conversionRate >= 30
                  ? 'var(--mia-green)'
                  : data.conversionRate !== null && data.conversionRate >= 10
                    ? 'var(--mia-gold)'
                    : 'var(--atmosphere-text)',
            }}
          >
            {data.conversionRate !== null ? `${data.conversionRate}%` : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}
