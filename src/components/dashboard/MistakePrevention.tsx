import type { MistakePreventionItem } from '@/lib/dashboard/queries'

const SEVERITY_CONFIG = {
  critical: { label: 'Crítico', color: 'bg-red-50 border-red-200 text-red-700', dot: 'bg-red-500', icon: '🚫' },
  high: { label: 'Importante', color: 'bg-orange-50 border-orange-200 text-orange-700', dot: 'bg-orange-500', icon: '⚠️' },
  medium: { label: 'Precaución', color: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-400', icon: '⚡' },
  low: { label: 'Lección', color: 'bg-zinc-50 border-zinc-200 text-zinc-600', dot: 'bg-zinc-300', icon: '📝' },
}

const CATEGORY_LABELS: Record<string, string> = {
  prohibited_claim: 'Afirmación prohibida',
  incorrect_pricing: 'Precio incorrecto',
  incorrect_delivery: 'Entrega incorrecta',
  wrong_comparison: 'Comparación incorrecta',
  bad_escalation: 'Escalación inadecuada',
}

export function MistakePrevention({ items }: { items: MistakePreventionItem[] }) {
  const active = items.filter((i) => i.severity === 'critical' || i.severity === 'high')
  const rest = items.filter((i) => i.severity === 'medium' || i.severity === 'low')

  if (items.length === 0) return null

  return (
    <div className="rounded-2xl border border-red-100 bg-white p-6">
      <h3 className="text-lg font-semibold text-zinc-900">Lo que evito</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Lecciones aprendidas que me ayudan a no cometer errores
      </p>

      <div className="mt-4 space-y-2">
        {active.map((item) => {
          const cfg = SEVERITY_CONFIG[item.severity]
          return (
            <div key={item.id} className={`rounded-lg border px-4 py-3 ${cfg.color}`}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-base">{cfg.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                    <span className="text-xs font-semibold uppercase tracking-wider">{cfg.label}</span>
                    {item.category && (
                      <span className="text-xs opacity-75">{CATEGORY_LABELS[item.category] ?? item.category}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium">{item.content}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {rest.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-zinc-400 hover:text-zinc-600">
            {rest.length} lección{rest.length > 1 ? 'es' : ''} adicional{rest.length > 1 ? 'es' : ''}
          </summary>
          <div className="mt-2 space-y-2">
            {rest.map((item) => {
              const cfg = SEVERITY_CONFIG[item.severity]
              return (
                <div key={item.id} className={`rounded-lg border px-4 py-2.5 ${cfg.color}`}>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-sm">{cfg.icon}</span>
                    <div className="flex-1">
                      <span className="text-xs font-medium">{item.content}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}
