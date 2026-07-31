interface CustomerData {
  name: string | null
  phone: string | null
  email: string | null
  city: string | null
  tags: string[]
  status: string
  notes: string | null
  last_interaction: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statusColors: Record<string, string> = {
  new: 'var(--mia-blue)',
  contacted: 'var(--mia-gold)',
  interested: 'var(--mia-green)',
  converted: 'var(--mia-violet)',
  lost: 'var(--mia-platinum)',
}

const statusLabels: Record<string, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  interested: 'Interesado',
  converted: 'Convertido',
  lost: 'Perdido',
}

export function CustomerInfoCard({ customer }: { customer: CustomerData }) {
  const color = statusColors[customer.status] ?? 'var(--mia-platinum)'

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: 'var(--elevation-1)',
        borderColor: 'var(--atmosphere-border)',
      }}
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            color: 'var(--atmosphere-text)',
          }}
        >
          {(customer.name ?? '?').charAt(0).toUpperCase()}
        </div>
        <div>
          <div
            className="text-sm font-semibold"
            style={{ color: 'var(--atmosphere-text)' }}
          >
            {customer.name ?? 'Sin nombre'}
          </div>
          <div
            className="text-xs"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            {formatDate(customer.last_interaction)}
          </div>
        </div>
      </div>

      <div
        className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {statusLabels[customer.status] ?? customer.status}
      </div>

      <div className="space-y-2 text-sm">
        {customer.phone && (
          <div
            className="flex items-center gap-2"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            <span style={{ opacity: 0.5, minWidth: 60 }}>Teléfono</span>
            <span style={{ color: 'var(--atmosphere-text)' }}>{customer.phone}</span>
          </div>
        )}
        {customer.email && (
          <div
            className="flex items-center gap-2"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            <span style={{ opacity: 0.5, minWidth: 60 }}>Email</span>
            <span style={{ color: 'var(--atmosphere-text)' }}>{customer.email}</span>
          </div>
        )}
        {customer.city && (
          <div
            className="flex items-center gap-2"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            <span style={{ opacity: 0.5, minWidth: 60 }}>Ciudad</span>
            <span style={{ color: 'var(--atmosphere-text)' }}>{customer.city}</span>
          </div>
        )}
      </div>

      {customer.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {customer.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: 'var(--atmosphere-text-secondary)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {customer.notes && (
        <div className="mt-4">
          <div
            className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
          >
            Notas
          </div>
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            {customer.notes}
          </p>
        </div>
      )}
    </div>
  )
}
