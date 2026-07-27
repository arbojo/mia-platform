import Link from 'next/link'

const actions = [
  {
    icon: '🎓',
    label: 'Entrenar a MIA',
    description: 'Ensenale a responder mejor',
    href: '/dashboard/assistants',
    color: 'bg-violet-50 hover:bg-violet-100 text-violet-700',
  },
  {
    icon: '📦',
    label: 'Subir catalogo',
    description: 'Agrega tus productos',
    href: '/dashboard/knowledge',
    color: 'bg-blue-50 hover:bg-blue-100 text-blue-700',
  },
  {
    icon: '📱',
    label: 'Conectar WhatsApp',
    description: 'Activa el canal de ventas',
    href: '/dashboard/connections',
    color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700',
  },
  {
    icon: '🔬',
    label: 'Ejecutar Studio',
    description: 'Analiza tu conocimiento',
    href: '/dashboard/knowledge-studio',
    color: 'bg-amber-50 hover:bg-amber-100 text-amber-700',
  },
  {
    icon: '🧪',
    label: 'Simulador de Ventas',
    description: 'Prueba a MIA con clientes',
    href: '/dashboard/laboratorio',
    color: 'bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-700',
  },
]

export function QuickActions() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-medium text-zinc-400 uppercase tracking-wider">
        Acciones rapidas
      </h3>
      <div className="space-y-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`flex items-center gap-3 rounded-xl p-3 transition-colors ${action.color}`}
          >
            <span className="text-xl">{action.icon}</span>
            <div>
              <p className="text-sm font-medium">{action.label}</p>
              <p className="text-xs opacity-70">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
