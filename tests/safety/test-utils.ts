import type { SafetyContext } from '@/lib/safety/types'

export async function run(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
  } catch (err) {
    console.log(`  ✗ ${name}`)
    const message = err instanceof Error ? err.message : String(err)
    console.error(`    ${message.replace(/\n/g, '\n    ')}`)
    process.exitCode = 1
  }
}

export const emptyContext: SafetyContext = {
  products: [],
  rules: [],
  memory: [],
}

export const priceContext: SafetyContext = {
  products: [
    { id: 'p1', name: 'Neurofeet', price: 499 },
    { id: 'p2', name: 'Neurotin', price: 399 },
  ],
  rules: [],
  memory: [],
}

export const noProductContext: SafetyContext = {
  products: [],
  rules: [],
  memory: [],
}

export const deliveryContext: SafetyContext = {
  products: [],
  rules: [
    { id: 'r1', category: 'zones', content: 'La entrega tarda de 3 a 5 días hábiles' },
  ],
  memory: [],
}

export const slowDeliveryContext: SafetyContext = {
  products: [],
  rules: [
    { id: 'r1', category: 'schedule', content: 'El envío mínimo es 5 días hábiles' },
  ],
  memory: [],
}

export const guaranteeContext: SafetyContext = {
  products: [],
  rules: [
    { id: 'r1', category: 'restrictions', content: 'Aceptamos devoluciones hasta 15 días después de la compra' },
  ],
  memory: [],
}

export const noReturnContext: SafetyContext = {
  products: [],
  rules: [
    { id: 'r1', category: 'restrictions', content: 'No aceptamos devoluciones, solo cambios físicos' },
  ],
  memory: [],
}

export const discountContext: SafetyContext = {
  products: [],
  rules: [
    { id: 'r1', category: 'promotions', content: 'Descuentos máximos de 30% en productos seleccionados' },
  ],
  memory: [],
}

export const immutableContext: SafetyContext = {
  products: [],
  rules: [],
  memory: [
    { id: 'm1', content: 'El negocio nunca abre los domingos', is_immutable: true },
  ],
}
