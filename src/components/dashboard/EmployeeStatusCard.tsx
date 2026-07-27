import type { EmployeeStatus } from '@/lib/dashboard/queries'

function StatusDot({ status }: { status: EmployeeStatus['status'] }) {
  const colors = {
    online: 'bg-emerald-500',
    idle: 'bg-amber-400',
    offline: 'bg-zinc-300',
  }
  const labels = {
    online: 'Working',
    idle: 'Waiting for customers',
    offline: 'Offline',
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

function ConfidenceMessage({ value }: { value: number }) {
  let message: string
  let color: string

  if (value >= 80) {
    message = "I'm ready to answer most customer questions."
    color = 'text-emerald-600'
  } else if (value >= 50) {
    message = 'I still need to learn a little more before I can answer everything.'
    color = 'text-amber-600'
  } else {
    message = "I'm just getting started. Teach me more about your business."
    color = 'text-zinc-500'
  }

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-zinc-500">How prepared I feel</span>
        <span className={`text-sm font-medium ${color}`}>{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-violet-500 transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <p className={`mt-1.5 text-xs ${color}`}>{message}</p>
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
          {status.readyToSell ? 'Ready to sell' : 'Getting ready...'}
        </div>
      </div>

      <div className="mb-4">
        <ConfidenceMessage value={status.knowledgeReadiness} />
      </div>

      {status.channels.length > 0 && (
        <div className="mb-3">
          <p className="mb-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Where I work
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
          Last time I talked to a customer:{' '}
          {new Date(status.lastActivity).toLocaleString('en-US', {
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
