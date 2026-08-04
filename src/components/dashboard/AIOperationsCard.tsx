import { getUsageByBusinessId } from '@/lib/ai/usage-report'

export async function AIOperationsCard({ businessId }: { businessId: string }) {
  const { monthly, projection, allTime } = await getUsageByBusinessId(businessId)

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-medium text-zinc-400 uppercase tracking-wider">
        Operaciones IA
      </h3>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard
          label="Costo del mes"
          value={`$${monthly.totalCost.toFixed(4)}`}
        />
        <MetricCard
          label="Proyección"
          value={`$${projection.projectedMonthlyCost.toFixed(4)}`}
        />
        <MetricCard
          label="Tokens (mes)"
          value={monthly.totalTokens.toLocaleString('es-MX')}
        />
        <MetricCard
          label="Solicitudes"
          value={monthly.totalRequests.toLocaleString('es-MX')}
        />
        <MetricCard
          label="Promedio/día"
          value={`$${projection.dailyAverage.toFixed(4)}`}
        />
        <MetricCard
          label="Total histórico"
          value={`$${allTime.totalCostAllTime.toFixed(4)}`}
        />
      </div>

      {monthly.costBySource.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Consumo por módulo
          </h4>
          <div className="space-y-2">
            {monthly.costBySource.slice(0, 5).map((item) => {
              const pct = monthly.totalCost > 0 ? (item.cost / monthly.totalCost) * 100 : 0
              return (
                <div key={item.source} className="flex items-center gap-3">
                  <span className="w-28 truncate text-sm text-zinc-600">{item.source}</span>
                  <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-olive-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs text-zinc-500">{pct.toFixed(0)}%</span>
                  <span className="w-20 text-right text-xs text-zinc-600">${item.cost.toFixed(4)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {monthly.costByType.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Consumo por tipo
          </h4>
          <div className="space-y-1">
            {monthly.costByType.map((item) => (
              <div key={item.requestType} className="flex items-center justify-between text-sm">
                <span className="text-zinc-600">{item.requestType}</span>
                <span className="text-zinc-500">
                  {item.requests} llamadas · ${item.cost.toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
      <p className="text-lg font-bold text-zinc-900">{value}</p>
      <p className="mt-1 text-sm text-zinc-500">{label}</p>
    </div>
  )
}
