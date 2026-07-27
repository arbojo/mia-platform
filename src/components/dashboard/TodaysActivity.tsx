import type { TodaysMetrics } from '@/lib/dashboard/queries'

function MetricCard({
  label,
  value,
  icon,
  suffix,
}: {
  label: string
  value: number | string
  icon: string
  suffix?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
      <div className="mb-2 text-xl">{icon}</div>
      <p className="text-2xl font-bold text-zinc-900">
        {typeof value === 'number' ? value.toLocaleString('es-MX') : value}
        {suffix && <span className="ml-1 text-sm font-normal text-zinc-400">{suffix}</span>}
      </p>
      <p className="mt-1 text-sm text-zinc-500">{label}</p>
    </div>
  )
}

export function TodaysActivity({ metrics }: { metrics: TodaysMetrics }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-medium text-zinc-400 uppercase tracking-wider">
        Actividad de hoy
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard
          icon="💬"
          label="Conversaciones"
          value={metrics.conversations}
        />
        <MetricCard
          icon="👥"
          label="Nuevos clientes"
          value={metrics.newCustomers}
        />
        <MetricCard
          icon="🔄"
          label="Clientes recurrentes"
          value={metrics.returningCustomers}
        />
        <MetricCard
          icon="✉️"
          label="Mensajes procesados"
          value={metrics.messagesHandled}
        />
        <MetricCard
          icon="🧠"
          label="Tokens consumidos"
          value={metrics.tokensConsumed}
        />
        <MetricCard
          icon="💰"
          label="Costo de IA hoy"
          value={`$${metrics.costToday.toFixed(4)}`}
        />
      </div>
    </div>
  )
}
