'use client'

import { TrendingUp, DollarSign, ShoppingCart, Percent, Package } from 'lucide-react'
import type { SalesMetrics } from '@/lib/dashboard/queries'
import { useI18n } from '@/components/dashboard/I18nProvider'
import type { Locale } from '@/lib/i18n/config'

const CURRENCIES: Record<Locale, string> = {
  es: 'ARS',
  en: 'USD',
  pt: 'BRL',
  ja: 'JPY',
}

function formatMoney(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCIES[locale],
    maximumFractionDigits: 0,
  }).format(value)
}

function MetricItem({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}14`, color }}>
          {icon}
        </span>
        <span className="text-xs font-medium" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-light tracking-tight" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

export function SalesMetricsCard({ metrics }: { metrics: SalesMetrics }) {
  const { t, locale } = useI18n()

  return (
    <section
      className="rounded-2xl border p-6 transition-all duration-500"
      style={{ backgroundColor: 'var(--elevation-1)', borderColor: 'var(--atmosphere-border)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4" style={{ color: 'var(--mia-green)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
          {t.sales.title}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricItem
          icon={<ShoppingCart className="h-3.5 w-3.5" />}
          label={t.sales.todaySales}
          value={String(metrics.todaySales)}
          color="var(--mia-green)"
        />
        <MetricItem
          icon={<DollarSign className="h-3.5 w-3.5" />}
          label={t.sales.todayRevenue}
          value={formatMoney(metrics.todayRevenue, locale)}
          color="var(--mia-green)"
        />
        <MetricItem
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label={t.sales.weekSales}
          value={String(metrics.weekSales)}
          color="var(--mia-cyan)"
        />
        <MetricItem
          icon={<Percent className="h-3.5 w-3.5" />}
          label={t.sales.conversion}
          value={`${metrics.conversionRate}%`}
          color="var(--mia-olive)"
        />
      </div>

      {metrics.topProducts.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <Package className="h-3.5 w-3.5" style={{ color: 'var(--atmosphere-text-secondary)' }} />
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.7 }}>
              {t.sales.topProducts}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {metrics.topProducts.map((p) => (
              <span
                key={p.name}
                className="rounded-full border px-3 py-1 text-xs"
                style={{ borderColor: 'var(--atmosphere-border)', color: 'var(--atmosphere-text)' }}
              >
                {p.name} · {p.count}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
