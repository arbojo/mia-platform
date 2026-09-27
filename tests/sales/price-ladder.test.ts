import { describe, it, expect } from 'vitest'

import {
  parsePriceLadder,
  formatPriceLadder,
  resolveLineTotal,
  type PriceLadderLabels,
} from '@/lib/sales/price-ladder'

const labels: PriceLadderLabels = {
  header: 'Precio por cantidad',
  perPieces: (qty) => `${qty} pzas`,
  fromPieces: (qty) => `Desde ${qty} pzas`,
  note: 'Nota',
}

describe('parsePriceLadder', () => {
  it('parsea una escalera por volumen', () => {
    const ladder = parsePriceLadder({
      tiers: [
        { qty: 1, price: 550 },
        { qty: 2, price: 880 },
        { qty: 3, price: 1188 },
      ],
      open_tier: { min_qty: 4, discount_pct: 35 },
    })

    expect(ladder).toEqual({
      tiers: [
        { qty: 1, price: 550 },
        { qty: 2, price: 880 },
        { qty: 3, price: 1188 },
      ],
      open_tier: { min_qty: 4, discount_pct: 35 },
    })
  })

  it('parsea una promoción fija sin open_tier y conserva el note', () => {
    const ladder = parsePriceLadder({
      tiers: [
        { qty: 3, price: 449 },
        { qty: 5, price: 599 },
      ],
      note: 'No aplicar descuentos adicionales.',
    })

    expect(ladder?.tiers).toHaveLength(2)
    expect(ladder?.open_tier).toBeUndefined()
    expect(ladder?.note).toBe('No aplicar descuentos adicionales.')
  })

  it('devuelve null para ausencia de escalera (producto legacy)', () => {
    expect(parsePriceLadder(null)).toBeNull()
    expect(parsePriceLadder(undefined)).toBeNull()
  })

  it('devuelve null cuando el valor no es un objeto', () => {
    expect(parsePriceLadder('$550')).toBeNull()
    expect(parsePriceLadder(550)).toBeNull()
    expect(parsePriceLadder([{ qty: 1, price: 550 }])).toBeNull()
  })

  it('devuelve null si no hay tiers utilizables: media escalera es peor que ninguna', () => {
    expect(parsePriceLadder({ tiers: [] })).toBeNull()
    expect(parsePriceLadder({ tiers: 'no-es-un-array' })).toBeNull()
    expect(parsePriceLadder({ note: 'sin tiers' })).toBeNull()
  })

  it('descarta tiers con qty o price inválidos', () => {
    const ladder = parsePriceLadder({
      tiers: [
        { qty: 1, price: 550 },
        { qty: 0, price: 880 },
        { qty: -2, price: 100 },
        { qty: 3, price: -1 },
        { qty: 'cuatro', price: 100 },
        { qty: 4, price: null },
        { 'basura': true },
        { qty: 3, price: 1188 },
      ],
    })

    expect(ladder?.tiers).toEqual([
      { qty: 1, price: 550 },
      { qty: 3, price: 1188 },
    ])
  })

  it('ordena los tiers por cantidad', () => {
    const ladder = parsePriceLadder({
      tiers: [
        { qty: 3, price: 1188 },
        { qty: 1, price: 550 },
        { qty: 2, price: 880 },
      ],
    })

    expect(ladder?.tiers.map((t) => t.qty)).toEqual([1, 2, 3])
  })

  it('ignora un open_tier inválido en vez de renderizarlo como 0%', () => {
    const ladder = parsePriceLadder({
      tiers: [{ qty: 1, price: 550 }],
      open_tier: { min_qty: 4, discount_pct: 0 },
    })

    expect(ladder?.open_tier).toBeUndefined()
  })

  it('ignora un note vacío', () => {
    const ladder = parsePriceLadder({ tiers: [{ qty: 1, price: 550 }], note: '   ' })
    expect(ladder?.note).toBeUndefined()
  })
})

describe('formatPriceLadder', () => {
  it('renderiza la escalera con unidad explícita en cada tramo', () => {
    const ladder = parsePriceLadder({
      tiers: [
        { qty: 1, price: 550 },
        { qty: 2, price: 880 },
        { qty: 3, price: 1188 },
      ],
      open_tier: { min_qty: 4, discount_pct: 35 },
    })

    expect(formatPriceLadder(ladder!, labels)).toBe(
      [
        '  Precio por cantidad:',
        '    - 1 pzas: $550',
        '    - 2 pzas: $880',
        '    - 3 pzas: $1188',
        '    - Desde 4 pzas: 35%',
      ].join('\n')
    )
  })

  it('renderiza el note y omite open_tier cuando no existe', () => {
    const ladder = parsePriceLadder({
      tiers: [
        { qty: 3, price: 449 },
        { qty: 5, price: 599 },
      ],
      note: 'No aplicar descuentos adicionales.',
    })

    expect(formatPriceLadder(ladder!, labels)).toBe(
      [
        '  Precio por cantidad:',
        '    - 3 pzas: $449',
        '    - 5 pzas: $599',
        '    - Nota: No aplicar descuentos adicionales.',
      ].join('\n')
    )
  })

  it('muestra los centavos cuando el importe los tiene y los omite cuando no', () => {
    const ladder = parsePriceLadder({
      tiers: [
        { qty: 2, price: 499 },
        { qty: 3, price: 898.2 },
        { qty: 4, price: 1397.2 },
      ],
    })

    // 898.2 must not reach MIA as "898.2 pesos": it is a truncated quote.
    expect(formatPriceLadder(ladder!, labels)).toContain('3 pzas: $898.20')
    expect(formatPriceLadder(ladder!, labels)).toContain('4 pzas: $1397.20')
    expect(formatPriceLadder(ladder!, labels)).toContain('2 pzas: $499')
    expect(formatPriceLadder(ladder!, labels)).not.toContain('$499.00')
  })
})

const CLEAN_NAILS = parsePriceLadder({
  tiers: [
    { qty: 1, price: 550 },
    { qty: 2, price: 880 },
    { qty: 3, price: 1188 },
  ],
  open_tier: { min_qty: 4, discount_pct: 35 },
})

const BACK2FIT = parsePriceLadder({
  tiers: [
    { qty: 2, price: 499 },
    { qty: 3, price: 898 },
    { qty: 4, price: 998 },
    { qty: 5, price: 1397 },
    { qty: 6, price: 1497 },
    { qty: 7, price: 1896 },
    { qty: 8, price: 1996 },
    { qty: 9, price: 2395 },
    { qty: 10, price: 2495 },
  ],
  note: 'No se vende por pieza: el mínimo es 2 y cada par es 2x1 (se paga una y la segunda va de regalo). Si la cantidad es impar, la pieza que sobra se agrega a $399.',
})

const NEUROTIN = parsePriceLadder({
  tiers: [
    { qty: 3, price: 449 },
    { qty: 5, price: 599 },
  ],
  note: 'No aplicar descuentos adicionales.',
})

describe('resolveLineTotal', () => {
  it('resuelve un producto por paquete desde el tier exacto, no multiplicando el precio base', () => {
    const three = resolveLineTotal(NEUROTIN, 449, 3)
    const five = resolveLineTotal(NEUROTIN, 449, 5)

    expect(three?.lineTotal).toBe(449)
    expect(three?.source).toBe('tier')
    expect(five?.lineTotal).toBe(599)
    expect(five?.source).toBe('tier')
  })

  it('nunca trata el precio de paquete como precio unitario (el bug de 449 x 5)', () => {
    const resolved = resolveLineTotal(NEUROTIN, 449, 5)

    expect(resolved?.lineTotal).not.toBe(449 * 5)
    expect(resolved?.effectiveUnitPrice).toBe(119.8)
  })

  it('devuelve null para cantidades que la escalera nunca pricelessó en vez de inventar', () => {
    expect(resolveLineTotal(NEUROTIN, 449, 1)).toBeNull()
    expect(resolveLineTotal(NEUROTIN, 449, 2)).toBeNull()
    expect(resolveLineTotal(NEUROTIN, 449, 4)).toBeNull()
    expect(resolveLineTotal(NEUROTIN, 449, 6)).toBeNull()
  })

  it('aplica open_tier cuando el producto si se vende por unidad', () => {
    expect(resolveLineTotal(CLEAN_NAILS, 550, 1)?.lineTotal).toBe(550)
    expect(resolveLineTotal(CLEAN_NAILS, 550, 2)?.lineTotal).toBe(880)
    expect(resolveLineTotal(CLEAN_NAILS, 550, 3)?.lineTotal).toBe(1188)
    expect(resolveLineTotal(CLEAN_NAILS, 550, 4)?.lineTotal).toBe(1430)
    expect(resolveLineTotal(CLEAN_NAILS, 550, 4)?.source).toBe('open_tier')
  })

  it('resuelve el 2x1 de Back2Fit por tier exacto y no admite una pieza suelta', () => {
    expect(resolveLineTotal(BACK2FIT, 499, 1)).toBeNull()
    expect(resolveLineTotal(BACK2FIT, 499, 2)?.lineTotal).toBe(499)
    expect(resolveLineTotal(BACK2FIT, 499, 3)?.lineTotal).toBe(898)
    expect(resolveLineTotal(BACK2FIT, 499, 4)?.lineTotal).toBe(998)
    expect(resolveLineTotal(BACK2FIT, 499, 5)?.lineTotal).toBe(1397)
    expect(resolveLineTotal(BACK2FIT, 499, 6)?.lineTotal).toBe(1497)
  })

  it('no escala más allá del último tier precificado de Back2Fit', () => {
    expect(resolveLineTotal(BACK2FIT, 499, 10)?.lineTotal).toBe(2495)
    expect(resolveLineTotal(BACK2FIT, 499, 11)).toBeNull()
    expect(resolveLineTotal(BACK2FIT, 499, 12)).toBeNull()
  })

  it('el 2x1 nunca cobra por encima del precio de lista del par', () => {
    // The offer advertises $249.50 per piece. Any ladder where a larger quantity
    // costs more per piece than the advertised 2x1 rate is a quote MIA would
    // have to defend as "actually it's more expensive if you buy more".
    const rate = resolveLineTotal(BACK2FIT, 499, 2)!.lineTotal / 2

    for (const qty of [4, 6, 8, 10]) {
      const resolved = resolveLineTotal(BACK2FIT, 499, qty)!
      expect(resolved.effectiveUnitPrice).toBeLessThanOrEqual(rate)
    }
  })

  it('el impar se captura: 3 cuesta menos que 4 y el salto no llega a media pieza', () => {
    const three = resolveLineTotal(BACK2FIT, 499, 3)!.lineTotal
    const four = resolveLineTotal(BACK2FIT, 499, 4)!.lineTotal
    const unit = resolveLineTotal(BACK2FIT, 499, 2)!.lineTotal

    expect(four).toBeGreaterThan(three)
    expect(four - three).toBeLessThan(unit / 2)
  })

  it('rechaza la matematica de open_tier si el precio base es de paquete', () => {
    const packLadder = parsePriceLadder({
      tiers: [
        { qty: 3, price: 449 },
        { qty: 5, price: 599 },
      ],
      open_tier: { min_qty: 6, discount_pct: 10 },
    })

    expect(resolveLineTotal(packLadder, 449, 6)).toBeNull()
  })

  it('cae al precio base cuando el producto no tiene escalera (Bella Patch)', () => {
    const one = resolveLineTotal(null, 550, 1)
    const three = resolveLineTotal(null, 550, 3)

    expect(one?.lineTotal).toBe(550)
    expect(one?.source).toBe('base')
    expect(three?.lineTotal).toBe(1650)
  })

  it('rechaza cantidades invalidas y precios base no numericos', () => {
    expect(resolveLineTotal(CLEAN_NAILS, 550, 0)).toBeNull()
    expect(resolveLineTotal(CLEAN_NAILS, 550, -2)).toBeNull()
    expect(resolveLineTotal(CLEAN_NAILS, 550, 1.5)).toBeNull()
    expect(resolveLineTotal(null, null, 2)).toBeNull()
    expect(resolveLineTotal(null, Number.NaN, 2)).toBeNull()
  })

  it('mantiene el invariante unit_price x quantity === line_total dentro del redondeo', () => {
    const cases: Array<[ReturnType<typeof parsePriceLadder>, number, number]> = [
      [CLEAN_NAILS, 550, 3],
      [CLEAN_NAILS, 550, 4],
      [BACK2FIT, 499, 2],
      [BACK2FIT, 499, 3],
      [NEUROTIN, 449, 5],
    ]

    for (const [ladder, base, qty] of cases) {
      const resolved = resolveLineTotal(ladder, base, qty)
      expect(resolved).not.toBeNull()
      const viaUnit = (resolved!.effectiveUnitPrice as number) * qty
      expect(Math.abs(viaUnit - resolved!.lineTotal)).toBeLessThanOrEqual(0.02)
    }
  })
})
