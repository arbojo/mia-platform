import Link from 'next/link'
import { HeartHandshake } from 'lucide-react'

export default function ConversationsPage() {
  return (
    <div className="animate-appear-up flex flex-col items-center justify-center py-24">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: 'var(--elevation-2)',
          color: 'var(--atmosphere-accent)',
        }}
      >
        <HeartHandshake className="h-7 w-7" />
      </div>
      <h1
        className="mt-6 text-xl font-semibold"
        style={{ color: 'var(--atmosphere-text)' }}
      >
        Relaciones
      </h1>
      <p
        className="mt-2 max-w-md text-center text-sm leading-relaxed"
        style={{ color: 'var(--atmosphere-text-secondary)' }}
      >
        Aquí verás las conversaciones con tus clientes, el historial completo y el estado de cada relación.
      </p>
      <div
        className="mt-8 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium tracking-wider uppercase"
        style={{
          backgroundColor: 'rgba(201, 168, 76, 0.1)',
          color: 'var(--mia-gold)',
          border: '1px solid rgba(201, 168, 76, 0.2)',
        }}
      >
        Próximamente
      </div>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200"
        style={{
          backgroundColor: 'var(--elevation-2)',
          color: 'var(--atmosphere-text)',
        }}
      >
        ← Volver al Centro de Mando
      </Link>
    </div>
  )
}
