'use client'

import { useRouter } from 'next/navigation'
import { Truck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function DeliveryPaywall() {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-3xl">
      <div
        className="rounded-2xl border p-8 md:p-12"
        style={{
          borderColor: 'var(--atmosphere-border)',
          background:
            'linear-gradient(135deg, var(--atmosphere-bg), color-mix(in srgb, var(--atmosphere-glow) 35%, var(--atmosphere-bg)))',
        }}
      >
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider"
          style={{
            borderColor: 'var(--atmosphere-border)',
            color: 'var(--atmosphere-text-secondary)',
          }}
        >
          <Truck className="h-3.5 w-3.5" style={{ color: 'var(--atmosphere-accent)' }} />
          Delivery Hub
        </span>

        <h1
          className="mt-5 text-3xl font-bold leading-tight md:text-4xl"
          style={{ color: 'var(--atmosphere-text)' }}
        >
          Entregas coordinadas,{' '}
          <span style={{ color: 'var(--atmosphere-accent)' }}>clientes que vuelven</span>
        </h1>
        <p
          className="mt-3 text-sm leading-relaxed md:text-base"
          style={{ color: 'var(--atmosphere-text-secondary)' }}
        >
          Gestiona repartidores, rutas y estados de entrega sin salir de MIA. El módulo logístico
          está disponible en los planes Enterprise y Cloud.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => router.push('/dashboard/billing/upgrade')}
            className="h-10 px-6 font-semibold"
            style={{
              background:
                'linear-gradient(135deg, var(--atmosphere-accent), color-mix(in srgb, var(--atmosphere-accent) 70%, #000))',
              color: 'white',
            }}
          >
            Actualizar Plan
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard/billing/upgrade')}
            className="h-10 px-4 font-medium"
          >
            Ver planes
          </Button>
        </div>

        <Card className="mt-8 border-0 shadow-sm" style={{ background: 'var(--atmosphere-surface)' }}>
          <CardContent className="flex items-start gap-3 p-4">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'var(--atmosphere-glow)' }}
            >
              <Sparkles className="h-4 w-4" style={{ color: 'var(--atmosphere-accent)' }} />
            </div>
            <div className="text-xs leading-relaxed" style={{ color: 'var(--atmosphere-text-secondary)' }}>
              <p className="font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
                Delivery Hub
              </p>
              <p className="mt-1">
                Repartidores con portal propio (PWA), rutas optimizadas, seguimiento de entregas
                y notificaciones en tiempo real para tus clientes.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
