import type { EmployeeStatus } from '@/lib/dashboard/queries'

function StatusDot({ status }: { status: EmployeeStatus['status'] }) {
  const colors = {
    online: 'bg-emerald-500',
    idle: 'bg-amber-400',
    offline: 'bg-zinc-300',
  }
  const labels = {
    online: 'En linea',
    idle: 'Inactivo',
    offline: 'Desconectado',
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${colors[status]}`} />
      {labels[status]}
    </span>
  )
}

function ChannelBadge({ channel }: { channel: string }) {
  const icons: Record<string, string> = {
    web: '🌐',
    whatsapp: '📱',
    instagram: '📸',
    facebook: '💬',
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
      {icons[channel] ?? '🔗'} {channel}
    </span>
  )
}

function ReadinessBar({ value }: { value: number }) {
  const color =
    value >= 80 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-zinc-500">Conocimiento</span>
        <span className="font-medium text-zinc-700">{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

export function EmployeeStatusCard({ status }: { status: EmployeeStatus }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white">
            M
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{status.name}</h2>
            <StatusDot status={status.status} />
          </div>
        </div>
        <div className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700">
          {status.readyToSell ? 'Listo para vender' : 'Preparando...'}
        </div>
      </div>

      <div className="mb-4">
        <ReadinessBar value={status.knowledgeReadiness} />
      </div>

      {status.channels.length > 0 && (
        <div className="mb-3">
          <p className="mb-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Canales activos
          </p>
          <div className="flex flex-wrap gap-2">
            {status.channels.map((channel) => (
              <ChannelBadge key={channel} channel={channel} />
            ))}
          </div>
        </div>
      )}

      {status.lastActivity && (
        <p className="text-xs text-zinc-400">
          Ultima actividad:{' '}
          {new Date(status.lastActivity).toLocaleString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'short',
          })}
        </p>
      )}
    </div>
  )
}
