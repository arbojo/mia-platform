import { normalizeText, wordBoundaryPattern } from './media'

/**
 * R-ALIAS — Aliases determinísticos de producto para el scope explícito.
 *
 * detectExplicitScopes solo reconoce el nombre literal del catálogo o el SKU
 * ("Back2Fit" → "back2fit", token único). Frases naturales de referencia que el
 * cliente usa en la conversación — "back to fit" (3 tokens) o "faja" (genérico)
 * — nunca resuelven, dejando el scope anclado a un producto anterior (incidente
 * 2026-09-11: CleanNails activo envió un asset de otro producto).
 *
 * Este módulo agrega frases ALIAS estáticas, determinísticas y explícitas:
 *   - NUNCA LLM, nunca difuso: solo refuerza el match de nombre literal.
 *   - La clave es el nombre del producto normalizado (normalizeText) tal como
 *     lo devuelve el catálogo canónico. Si un negocio tiene un producto con ese
 *     nombre, los aliases aplican scoped a su producto.
 *   - Ampliar el registro = una línea; contrato documentado, testeado.
 *   - El match usa las mismas reglas del nombre literal: frase multi-palabra →
 *     substring de tokens; palabra única → límite de palabra con tolerancia de
 *     plural ("faja" alcanza "fajas").
 *
 * NOTA arquitectónica: el registro en código es la vía Fase 1 (sin riesgo de
 * orden schema/deploy). La vía multi-tenant definitiva (columna `aliases` en
 * `products`, gestionada por catálogo) queda como evolución posterior.
 */

const PRODUCT_ALIASES: Record<string, string[]> = {
  // Back2Fit (Vitanova): "back to fit" (lectura natural del nombre), el
  // degradado numérico "back 2 fit" y "back fit" (contracción), y "faja"
  // (término genérico con el que el cliente pide el producto).
  back2fit: ['back to fit', 'back 2 fit', 'back fit', 'faja'],
}

/** Frases alias registradas para un nombre de producto ya normalizado. */
export function productAliasPhrases(normalizedProductName: string): string[] {
  return PRODUCT_ALIASES[normalizedProductName] ?? []
}

/**
 * ¿El mensaje normalizado contiene alguna frase alias del producto?
 * Mismas reglas de fidelidad que el nombre literal: frase multi-palabra →
 * coincidencia de tokens contiguos; palabra única → límite de palabra con
 * tolerancia de plural/singular (wordBoundaryPattern, de media.ts).
 */
export function matchesProductAlias(normalizedMessage: string, alias: string): boolean {
  const normalized = normalizeText(alias)
  if (!normalized) return false
  return normalized.includes(' ')
    ? normalizedMessage.includes(normalized)
    : new RegExp(wordBoundaryPattern(normalized)).test(normalizedMessage)
}