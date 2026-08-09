'use client'

import { useRouter } from 'next/navigation'
import {
  PackageSearch,
  BellRing,
  ScrollText,
  Sparkles,
  Boxes,
  TrendingUp,
  AlertTriangle,
  PackageCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// TODO: Integrar SDK de pasarela de pagos (Stripe/MercadoPago) en /dashboard/billing/upgrade.

const BENEFITS = [
  {
    icon: Boxes,
    title: 'Stock en tiempo real',
    description: 'Cada venta confirmada descuenta stock de forma automática e inmediata.',
  },
  {
    icon: BellRing,
    title: 'Alertas de reposición',
    description: 'Detección de stock bajo y agotados para no quedarte sin producto.',
  },
  {
    icon: ScrollText,
    title: 'Movimientos auditados',
    description: 'Registro completo de entradas, salidas y ajustes con trazabilidad.',
  },
  {
    icon: Sparkles,
    title: 'Sugerencias con IA',
    description: 'Recomendaciones de reabastecimiento basadas en demanda y velocidad.',
  },
]

const OVERVIEW_CARDS = [
  { label: 'Con stock', value: '87', tone: 'var(--atmosphere-accent)' },
  { label: 'Stock bajo', value: '9', tone: 'var(--mia-gold)' },
  { label: 'Agotados', value: '4', tone: '#c2410c' },
]

export function InventoryPaywall() {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-4xl">
      <div
        className="rounded-2xl border p-8 md:p-12"
        style={{
          borderColor: 'var(--atmosphere-border)',
          background:
            'linear-gradient(135deg, var(--atmosphere-bg), color-mix(in srgb, var(--atmosphere-glow) 35%, var(--atmosphere-bg)))',
        }}
      >
        <div className="grid items-center gap-10 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-5">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider"
              style={{
                borderColor: 'var(--atmosphere-border)',
                color: 'var(--atmosphere-text-secondary)',
              }}
            >
              <PackageSearch className="h-3.5 w-3.5" style={{ color: 'var(--atmosphere-accent)' }} />
              Inventory Hub
            </span>

            <div className="space-y-3">
              <h1
                className="text-3xl font-bold leading-tight md:text-4xl"
                style={{ color: 'var(--atmosphere-text)' }}
              >
                Stock bajo control,{' '}
                <span style={{ color: 'var(--atmosphere-accent)' }}>
                  ventas en piloto automático
                </span>
              </h1>
              <p
                className="text-sm leading-relaxed md:text-base"
                style={{ color: 'var(--atmosphere-text-secondary)' }}
              >
                ¿Tu stock se termina y te enteras solo cuando el repartidor o el almacén
                te avisan que ya no hay producto? Evita quiebres de inventario y pérdidas
                de venta. Elige el plan que escala con tu operación.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
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
                ¿Dudas sobre la contratación? Ver planes
              </Button>
            </div>
          </div>

          <Card
            className="relative overflow-hidden border-0 shadow-lg"
            style={{ background: 'var(--atmosphere-surface)' }}
          >
            <CardHeader className="border-b px-5 py-4" style={{ borderColor: 'var(--atmosphere-border)' }}>
              <div className="flex items-center justify-between">
                <CardTitle
                  className="text-sm font-semibold"
                  style={{ color: 'var(--atmosphere-text)' }}
                >
                  Resumen de inventario
                </CardTitle>
                <span
                  className="flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: 'var(--atmosphere-accent)' }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--atmosphere-accent)' }} />
                  En vivo
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <div className="grid grid-cols-3 gap-2">
                {OVERVIEW_CARDS.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-xl border p-3 text-center"
                    style={{ borderColor: 'var(--atmosphere-border)' }}
                  >
                    <p
                      className="text-lg font-bold"
                      style={{ color: card.tone }}
                    >
                      {card.value}
                    </p>
                    <p
                      className="mt-0.5 text-[0.65rem] font-medium"
                      style={{ color: 'var(--atmosphere-text-secondary)' }}
                    >
                      {card.label}
                    </p>
                  </div>
                ))}
              </div>

              <div
                className="flex items-center gap-3 rounded-xl border p-3"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'var(--atmosphere-glow)' }}
                >
                  <TrendingUp className="h-4 w-4" style={{ color: 'var(--atmosphere-accent)' }} />
                </div>
                <div className="text-xs">
                  <p className="font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
                    Reposición sugerida
                  </p>
                  <p style={{ color: 'var(--atmosphere-text-secondary)' }}>
                    Aceite de oliva extra virgen +24
                  </p>
                </div>
              </div>

              <div
                className="flex items-center gap-3 rounded-xl border p-3"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'var(--atmosphere-glow)' }}
                >
                  <AlertTriangle className="h-4 w-4" style={{ color: 'var(--mia-gold)' }} />
                </div>
                <div className="text-xs">
                  <p className="font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
                    9 productos con stock bajo
                  </p>
                  <p style={{ color: 'var(--atmosphere-text-secondary)' }}>
                    Revisar en la próxima reposición
                  </p>
                </div>
              </div>

              <div
                className="flex items-center gap-3 rounded-xl border p-3"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'var(--atmosphere-glow)' }}
                >
                  <PackageCheck className="h-4 w-4" style={{ color: 'var(--atmosphere-accent)' }} />
                </div>
                <div className="text-xs">
                  <p className="font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
                    Última venta descontó stock
                  </p>
                  <p style={{ color: 'var(--atmosphere-text-secondary)' }}>
                    Se actualiza automáticamente al cerrar la venta
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {BENEFITS.map((benefit) => (
            <Card
              key={benefit.title}
              className="border-0 shadow-sm"
              style={{ background: 'var(--atmosphere-surface)' }}
            >
              <CardContent className="p-4">
                <div
                  className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'var(--atmosphere-glow)' }}
                >
                  <benefit.icon className="h-4.5 w-4.5" style={{ color: 'var(--atmosphere-accent)' }} />
                </div>
                <CardDescription
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--atmosphere-text)' }}
                >
                  {benefit.title}
                </CardDescription>
                <p
                  className="mt-1 text-xs leading-relaxed"
                  style={{ color: 'var(--atmosphere-text-secondary)' }}
                >
                  {benefit.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
