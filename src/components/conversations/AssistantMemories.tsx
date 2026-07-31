interface Memory {
  id: string
  memory_type: string
  content: string
  created_at: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const memoryIcons: Record<string, string> = {
  preference: '⭐',
  previous_question: '❓',
  purchase_history: '🛒',
  important_note: '📌',
}

const memoryLabels: Record<string, string> = {
  preference: 'Preferencia',
  previous_question: 'Pregunta previa',
  purchase_history: 'Historial de compra',
  important_note: 'Nota importante',
}

export function AssistantMemories({ memories }: { memories: Memory[] }) {
  if (memories.length === 0) {
    return (
      <div
        className="rounded-xl border p-5 text-center"
        style={{
          backgroundColor: 'var(--elevation-1)',
          borderColor: 'var(--atmosphere-border)',
        }}
      >
        <p
          className="text-sm"
          style={{ color: 'var(--atmosphere-text-secondary)' }}
        >
          Aún no tengo recuerdos registrados sobre este cliente.
        </p>
      </div>
    )
  }

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
        Lo que sé de este cliente
      </h3>
      <div className="space-y-3">
        {memories.map((m) => (
          <div key={m.id} className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-sm">
              {memoryIcons[m.memory_type] ?? '📝'}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--mia-gold)', opacity: 0.8 }}
                >
                  {memoryLabels[m.memory_type] ?? m.memory_type}
                </span>
                <span
                  className="text-[10px]"
                  style={{
                    color: 'var(--atmosphere-text-secondary)',
                    opacity: 0.5,
                  }}
                >
                  {formatDate(m.created_at)}
                </span>
              </div>
              <p
                className="mt-0.5 text-sm leading-relaxed"
                style={{ color: 'var(--atmosphere-text-secondary)' }}
              >
                {m.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
