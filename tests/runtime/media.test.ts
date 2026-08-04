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

  it('does not match a keyword inside another word', () => {
    expect(triggerMatches('¿cómo son los clientes?', 'es')).toBe(false)
  })

  it('matches a keyword when followed by punctuation as a whole word', () => {
    expect(triggerMatches('¿cuánto vale?', 'vale')).toBe(true)
  })

  it('matches at the start of the message', () => {
    expect(triggerMatches('precio por favor', 'precio')).toBe(true)
  })

  it('matches multi-word trigger as an exact phrase', () => {
    expect(triggerMatches('me interesa el antes y después', 'antes y despues')).toBe(true)
  })

  it('does not match a multi-word trigger split across words', () => {
    expect(triggerMatches('antes de irte y despues de volver', 'antes y despues')).toBe(false)
  })
})
