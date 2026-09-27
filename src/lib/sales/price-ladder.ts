/**
 * Price ladder: the volume pricing structure of a product.
 *
 * A product price is not a single number. `products.price` holds the base price,
 * but the commercial reality is a ladder (1 / 2 / 3 pieces) plus, for some
 * products, an open-ended bulk rule. This module owns the shape of that ladder,
 * its defensive parsing (the column is JSONB, so it arrives as `unknown`) and
 * its rendering for the prompt.
 *
 * Tier prices are ABSOLUTE totals for that quantity, never formulas. The
 * "no menciones fórmulas matemáticas" policy governs MIA's speech, not the data.
 */

export interface PriceTier {
  qty: number
  price: number
}

export interface PriceOpenTier {
  min_qty: number
  discount_pct: number
}

export interface PriceLadder {
  tiers: PriceTier[]
  open_tier?: PriceOpenTier
  note?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Parses the raw JSONB value of `products.price_ladder`.
 *
 * Returns null for anything unusable so a malformed ladder degrades to the base
 * price instead of injecting broken text into the prompt. A ladder with no
 * valid tiers is treated as absent: rendering half a ladder would be worse than
 * rendering none, because the model would fill the gap by inventing prices.
 */
export function parsePriceLadder(raw: unknown): PriceLadder | null {
  if (!isRecord(raw)) return null

  const rawTiers = raw.tiers
  if (!Array.isArray(rawTiers)) return null

  const tiers: PriceTier[] = []
  for (const entry of rawTiers) {
    if (!isRecord(entry)) continue
    const qty = toFiniteNumber(entry.qty)
    const price = toFiniteNumber(entry.price)
    if (qty === null || price === null) continue
    if (qty <= 0 || price < 0) continue
    tiers.push({ qty, price })
  }
  if (tiers.length === 0) return null

  tiers.sort((a, b) => a.qty - b.qty)

  const ladder: PriceLadder = { tiers }

  if (isRecord(raw.open_tier)) {
    const minQty = toFiniteNumber(raw.open_tier.min_qty)
    const discountPct = toFiniteNumber(raw.open_tier.discount_pct)
    if (minQty !== null && discountPct !== null && minQty > 0 && discountPct > 0) {
      ladder.open_tier = { min_qty: minQty, discount_pct: discountPct }
    }
  }

  if (typeof raw.note === 'string' && raw.note.trim().length > 0) {
    ladder.note = raw.note.trim()
  }

  return ladder
}

/**
 * Where a resolved line total came from. Kept for auditing: when a total is
 * disputed, this says which rule produced it.
 */
export type LineTotalSource = 'base' | 'tier' | 'open_tier'

export interface ResolvedLineTotal {
  /** Absolute amount for the whole line, already rounded to cents. */
  lineTotal: number
  /** lineTotal / qty, rounded to cents. Keeps unit_price meaningful downstream. */
  effectiveUnitPrice: number
  source: LineTotalSource
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Resolves what a line is actually worth for a given quantity.
 *
 * `products.price` is NOT a unit price in general. For most of the catalog it is
 * (one unit, so `base * qty` plus an open-ended bulk rule is safe), but a
 * product sold only in packs carries the PACK price there: Neurotin's
 * `products.price` is 449, which is the price of three pairs, not of one. Reading
 * it as a unit price turns a five-pair order into 449 * 5 = $2,245 when the
 * ladder the customer was quoted says $599.
 *
 * So the ladder decides, and the base price only participates where it is
 * provably a unit price:
 *
 *  1. exact tier match      -> that tier's absolute price
 *  2. qty >= open_tier      -> base * qty * (1 - pct), only when the cheapest tier
 *                              is qty 1, which is what proves `base` is a unit
 *                              price rather than a pack price
 *  3. anything else         -> null. A quantity the business never priced has no
 *                              honest answer, and guessing one invents revenue.
 *
 * Rule 3 is the whole point. Interpolating "5 pairs costs 449, so 4 pairs costs
 * 449" would hand the customer a free pair; scaling the pack price would invent a
 * number nobody quoted. Returning null defers to the business instead.
 */
export function resolveLineTotal(
  ladder: PriceLadder | null,
  basePrice: number | null | undefined,
  qty: number
): ResolvedLineTotal | null {
  if (!Number.isInteger(qty) || qty < 1) return null

  if (ladder === null) {
    if (typeof basePrice !== 'number' || !Number.isFinite(basePrice)) return null
    const lineTotal = round2(basePrice * qty)
    return { lineTotal, effectiveUnitPrice: round2(basePrice), source: 'base' }
  }

  const exact = ladder.tiers.find((tier) => tier.qty === qty)
  if (exact) {
    return {
      lineTotal: round2(exact.price),
      effectiveUnitPrice: round2(exact.price / qty),
      source: 'tier',
    }
  }

  const openTier = ladder.open_tier
  const baseIsUnitPrice = ladder.tiers[0]?.qty === 1
  if (
    openTier &&
    baseIsUnitPrice &&
    qty >= openTier.min_qty &&
    typeof basePrice === 'number' &&
    Number.isFinite(basePrice)
  ) {
    const lineTotal = round2(basePrice * qty * (1 - openTier.discount_pct / 100))
    return { lineTotal, effectiveUnitPrice: round2(lineTotal / qty), source: 'open_tier' }
  }

  return null
}

export interface PriceLadderLabels {
  header: string
  perPieces: (qty: number) => string
  fromPieces: (qty: number) => string
  note: string
}

/**
 * Renders the ladder for the system prompt.
 *
 * The unit is always explicit ("3 por $449") because a bare number next to a
 * base price reads as a total for one unit and is the fastest way to get MIA to
 * quote the wrong amount.
 */
/**
 * Formats a tier amount the way it is quoted, not the way it is stored.
 *
 * `numeric` arrives as a JS number, so 898.20 stringifies as "898.2" and MIA
 * would say "898.2 pesos" — a truncated amount on a quote the customer is
 * expected to pay. Cents are therefore always shown when they exist.
 *
 * Whole amounts stay bare ("$499", not "$499.00") because that is how the
 * business quotes them; padding them reads as a bank statement and makes the
 * ladder harder to scan against what the customer was told.
 */
function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export function formatPriceLadder(ladder: PriceLadder, labels: PriceLadderLabels): string {
  const lines = [`  ${labels.header}:`]

  for (const tier of ladder.tiers) {
    lines.push(`    - ${labels.perPieces(tier.qty)}: $${formatAmount(tier.price)}`)
  }

  if (ladder.open_tier) {
    lines.push(`    - ${labels.fromPieces(ladder.open_tier.min_qty)}: ${ladder.open_tier.discount_pct}%`)
  }

  if (ladder.note) {
    lines.push(`    - ${labels.note}: ${ladder.note}`)
  }

  return lines.join('\n')
}
