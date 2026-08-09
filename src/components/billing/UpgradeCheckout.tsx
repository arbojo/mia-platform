'use client'

import { useState } from 'react'
import { Check, CreditCard, Lock, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type PlanId = 'professional' | 'enterprise'

interface Plan {
  id: PlanId
  name: string
  tagline: string
  features: string[]
  highlighted: boolean
}

const PLANS: Plan[] = [
  {
    id: 'professional',
    name: 'MIA Brain Professional',
    tagline: 'Para negocios en crecimiento con un solo punto de venta',
    highlighted: true,
    features: [
      'Inventory Hub: stock en tiempo real',
      'Descuento automático de stock por cada venta confirmada',
      'Alertas de reposición y movimientos auditados',
      'Sugerencias de reabastecimiento con IA',
      '3 asistentes y hasta 5 usuarios',
    ],
  },
  {
    id: 'enterprise',
    name: 'MIA Brain Enterprise',
    tagline: 'Para organizaciones multi-tenant y operaciones avanzadas',
    highlighted: false,
    features: [
      'Todo lo de Professional',
      'Delivery Hub y portal del repartidor',
      'Múltiples negocios y hasta 50 usuarios',
      'Soporte prioritario y onboarding dedicado',
    ],
  },
]

export function UpgradeCheckout() {
  const [selected, setSelected] = useState<PlanId>('professional')
  const [notice, setNotice] = useState<string | null>(null)
  const plan = PLANS.find((p) => p.id === selected) ?? PLANS[0]

  function handlePay() {
    // TODO: Integrar SDK de pasarela de pagos (Stripe/MercadoPago) en /dashboard/billing/upgrade.
    console.log('[checkout] Iniciar pago para plan:', selected)
    setNotice('Próximamente disponible: la pasarela de pagos se habilitará pronto.')
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 text-center">
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider"
          style={{
            borderColor: 'var(--atmosphere-border)',
            color: 'var(--atmosphere-text-secondary)',
          }}
        >
          <CreditCard className="h-3.5 w-3.5" style={{ color: 'var(--atmosphere-accent)' }} />
          Suscripción
        </span>
        <h1
          className="mt-4 text-3xl font-bold md:text-4xl"
          style={{ color: 'var(--atmosphere-text)' }}
        >
          Elige el plan que escala con tu negocio
        </h1>
        <p
          className="mt-2 text-sm md:text-base"
          style={{ color: 'var(--atmosphere-text-secondary)' }}
        >
          Desbloquea el Inventory Hub y el resto del ecosistema MIA.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {PLANS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelected(p.id)
                setNotice(null)
              }}
              className="text-left"
            >
              <Card
                className={`h-full cursor-pointer border-2 transition-all ${
                  selected === p.id ? 'shadow-md' : 'opacity-90 hover:opacity-100'
                }`}
                style={{
                  borderColor:
                    selected === p.id
                      ? 'var(--atmosphere-accent)'
                      : 'var(--atmosphere-border)',
                  background:
                    selected === p.id && p.highlighted
                      ? 'var(--atmosphere-glow)'
                      : undefined,
                }}
              >
                <CardHeader>
                  <CardTitle className="text-lg" style={{ color: 'var(--atmosphere-text)' }}>
                    {p.name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {p.tagline}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {p.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-xs"
                        style={{ color: 'var(--atmosphere-text-secondary)' }}
                      >
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          style={{ color: 'var(--atmosphere-accent)' }}
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>

        <div>
          <Card className="border-0 shadow-md" style={{ background: 'var(--atmosphere-surface)' }}>
            <CardHeader>
              <CardTitle className="text-base" style={{ color: 'var(--atmosphere-text)' }}>
                Resumen del pedido
              </CardTitle>
              <CardDescription className="text-xs">Plan seleccionado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="flex items-center justify-between rounded-xl border px-4 py-3"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
                  {plan.name}
                </span>
                <span className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  Precio a consultar
                </span>
              </div>

              <Button
                onClick={handlePay}
                className="w-full font-semibold"
                style={{
                  background:
                    'linear-gradient(135deg, var(--atmosphere-accent), color-mix(in srgb, var(--atmosphere-accent) 70%, #000))',
                  color: 'white',
                }}
              >
                Suscribirme ahora
              </Button>

              {notice && (
                <div
                  className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
                  style={{
                    borderColor: 'var(--atmosphere-border)',
                    color: 'var(--atmosphere-text-secondary)',
                  }}
                >
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--atmosphere-accent)' }} />
                  {notice}
                </div>
              )}

              <p
                className="flex items-center justify-center gap-1.5 text-[0.7rem]"
                style={{ color: 'var(--atmosphere-text-secondary)' }}
              >
                <Lock className="h-3 w-3" />
                Pago seguro · Sin cargos ocultos
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
