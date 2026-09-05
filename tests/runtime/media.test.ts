import { describe, it, expect } from 'vitest'
import {
  normalizeText,
  triggerMatches,
  intentMatchesTrigger,
  isResendRequest,
} from '@/lib/runtime/media'

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

  it('tolerates singular/plural inflection of a keyword', () => {
    expect(triggerMatches('¿hacen envíos a mi ciudad?', 'envio')).toBe(true)
    expect(triggerMatches('flores rojas', 'flor')).toBe(true)
    expect(triggerMatches('hay fotos del producto', 'foto')).toBe(true)
  })

  it('does not match a multi-word trigger split across words', () => {
    expect(triggerMatches('antes de irte y despues de volver', 'antes y despues')).toBe(false)
  })
})

describe('intentMatchesTrigger', () => {
  it('matches an intent trigger', () => {
    expect(intentMatchesTrigger('catalog', 'intent:catalog')).toBe(true)
  })

  it('matches among comma-separated triggers', () => {
    expect(intentMatchesTrigger('shipping', 'precio, intent:shipping, pago')).toBe(true)
  })

  it('does not match a different intent', () => {
    expect(intentMatchesTrigger('price', 'intent:catalog')).toBe(false)
  })

  it('ignores non-intent triggers', () => {
    expect(intentMatchesTrigger('catalog', 'producto')).toBe(false)
  })
})

describe('isResendRequest', () => {
  it('detects an explicit resend request', () => {
    expect(isResendRequest('¿puedes enviar la imagen de nuevo?')).toBe(true)
    expect(isResendRequest('mándame la foto por favor')).toBe(true)
    expect(isResendRequest('¿me pasas la foto otra vez?')).toBe(true)
    expect(isResendRequest('no vi la foto, mándala de nuevo')).toBe(true)
  })

  it('detects resend requests with accents stripped', () => {
    expect(isResendRequest('¿me la pasás?')).toBe(false)
    expect(isResendRequest('envíame la fotografía nuevamente')).toBe(true)
  })

  it('does not flag first-time image requests as resend', () => {
    expect(isResendRequest('¿me muestras el catálogo?')).toBe(false)
    expect(isResendRequest('¿tienen fotos de los productos?')).toBe(false)
  })

  it('treats "ver la foto" as an explicit request to show the image', () => {
    expect(isResendRequest('quiero ver las fotos')).toBe(true)
  })

  it('returns false when there is no media word', () => {
    expect(isResendRequest('¿cuál es el precio?')).toBe(false)
    expect(isResendRequest('mándalo otra vez')).toBe(false)
  })
})

describe('DEC-20260904-MEDIA-CONTRACT — normalización R1.4 y resend R8 (TDD RED)', () => {
  it('R1.4: trigger plural alcanza intención singular (fotos ⇒ foto)', () => {
    expect(triggerMatches('¿me mandas una foto?', 'fotos')).toBe(true)
  })

  it('R1.4: palabra completa — "fotografía" NO es substring de "foto"', () => {
    expect(triggerMatches('fotografía', 'foto')).toBe(false)
  })

  it('R8 T5: "enséñamela de nuevo" = resend explícito sin palabra-media literal', () => {
    expect(isResendRequest('enséñamela de nuevo')).toBe(true)
  })

  it('R8 T6: "¿tienes otra foto?" NO es resend, es pedido de asset nuevo', () => {
    expect(isResendRequest('¿tienes otra foto?')).toBe(false)
  })
})
