-- =============================================
-- ADD price_ladder COLUMN TO products
-- =============================================
-- A product price is not a single number: the commercial reality is a ladder
-- (1 / 2 / 3 pieces) plus, for some products, an open-ended bulk rule.
-- `products.price` can only hold the base price, so the ladder had nowhere to
-- live and was duplicated as prose across the knowledge base and the policy
-- document. This column makes the ladder structured data owned by the product.
--
-- Shape:
--   {
--     "tiers":     [ { "qty": 1, "price": 550 }, { "qty": 2, "price": 880 } ],
--     "open_tier": { "min_qty": 4, "discount_pct": 35 },   -- optional
--     "note":      "No aplicar descuentos adicionales."   -- optional
--   }
--
-- Tier prices are absolute totals for that quantity, never formulas: the
-- "no menciones fórmulas matemáticas" policy governs MIA's speech, not the data.
--
-- Nullable for backward compatibility: existing rows get NULL and the prompt
-- renders exactly as before. Consumers must treat NULL as "no ladder defined"
-- and fall back to `price`.
-- =============================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_ladder JSONB;

COMMENT ON COLUMN public.products.price_ladder IS
  'Escalera de precios por cantidad: tiers[{qty,price}] (precios totales por esa cantidad), open_tier opcional {min_qty,discount_pct} y note opcional. NULL = sin escalera; usar products.price como precio base.';
