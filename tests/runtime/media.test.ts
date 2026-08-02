import { describe, it, expect } from 'vitest'
import { normalizeText, triggerMatches } from '@/lib/runtime/media'

describe('normalizeText', () => {
  it('lowercases and trims', () => {
    expect(normalizeText('  Hola Mundo  ')).toBe('hola mundo')
  })

  it('removes accents', () => {
    expect(normalizeText('¿Cuánto cuesta el artículo?')).toBe('cuanto cuesta el articulo')
  })

  it('collapses whitespace', () => {
    expect(normalizeText('a   b\t\nc')).toBe('a b c')
  })
})

describe('triggerMatches', () => {
  it('matches a single keyword', () => {
    expect(triggerMatches('¿cuál es el precio?', 'precio')).toBe(true)
  })

  it('matches ignoring accents and case', () => {
    expect(triggerMatches('Quiero ver el ASPECTO físico', 'aspecto fisico')).toBe(true)
  })

  it('matches any comma-separated keyword', () => {
    expect(triggerMatches('¿me pasas fotos del producto?', 'precio, fotos, testimonio')).toBe(true)
  })

  it('does not match unrelated messages', () => {
    expect(triggerMatches('¿a qué hora cierran?', 'precio')).toBe(false)
  })

  it('requires a full keyword, not a partial match', () => {
    expect(triggerMatches('presupuesto', 'precio')).toBe(false)
  })
})
