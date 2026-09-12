import { describe, it, expect } from 'vitest'
import { repairMediaDenial } from '@/lib/runtime/media-negation-guard'

const REAL_FIXTURE =
  'No tengo imágenes del Clean Nails en este momento. Pero puedo ofrecerte más información sobre su uso y beneficios. Si deseas saber más o hacer un pedido, ¡aquí estoy para ayudarte!'

describe('repairMediaDenial', () => {
  it('corrige el caso real (negación en oración propia, resto intacto)', () => {
    const repair = repairMediaDenial(REAL_FIXTURE, { productName: 'Clean Nails' })
    expect(repair.corrected).toBe(true)
    expect(repair.matched.length).toBeGreaterThan(0)
    expect(repair.text).toBe(
      'Pero puedo ofrecerte más información sobre su uso y beneficios. Si deseas saber más o hacer un pedido, ¡aquí estoy para ayudarte!'
    )
  })

  it('detecta variantes de falta de media (no tengo …)', () => {
    expect(repairMediaDenial('No tengo fotos del producto. Te mando lo demás.').text).toBe(
      'Te mando lo demás.'
    )
    expect(repairMediaDenial('Todavía no tengo la foto lista.').corrected).toBe(true)
    expect(repairMediaDenial('Aún no tengo fotos, disculpa.').corrected).toBe(true)
    expect(repairMediaDenial('No tenemos imágenes de ese modelo.').corrected).toBe(true)
  })

  it('detecta incapacidad de envío', () => {
    expect(repairMediaDenial('Lo siento, no puedo enviarte imágenes.').corrected).toBe(true)
    expect(repairMediaDenial('No puedo mandarte fotos por ahora.').corrected).toBe(true)
    expect(repairMediaDenial('No te puedo enviar la foto todavía.').corrected).toBe(true)
    expect(repairMediaDenial('No puedo mostrarle la imagen, pero te paso precio.').corrected).toBe(true)
  })

  it('detecta el impersonal "no hay imágenes"', () => {
    expect(repairMediaDenial('No hay imágenes del producto, pero te cuento.').corrected).toBe(true)
  })

  it('NO marca preguntas retóricas', () => {
    expect(repairMediaDenial('¿Por qué no tengo imágenes en el chat?').corrected).toBe(false)
  })

  it('NO marca afirmaciones positivas ni tercera persona', () => {
    expect(repairMediaDenial('Tengo imágenes bien claras, te las adjunto.').corrected).toBe(false)
    expect(repairMediaDenial('El cliente dice que no tiene fotos todavía.').corrected).toBe(false)
  })

  it('passthrough intacto si no hay negación', () => {
    const input = 'Gracias por esperar, aquí va la información que pediste.'
    const repair = repairMediaDenial(input)
    expect(repair.corrected).toBe(false)
    expect(repair.text).toBe(input)
  })

  it('fallback genérico si la negación cubre todo el turno', () => {
    expect(repairMediaDenial('No tengo imágenes en este momento.').text).toBe(
      'Aquí tienes la imagen.'
    )
  })

  it('fallback con nombre de producto', () => {
    expect(
      repairMediaDenial('No tengo imágenes.', { productName: 'Clean Nails' }).text
    ).toBe('Aquí tienes la imagen de Clean Nails.')
  })

  it('respeta la exclamación inversa interior', () => {
    const out = repairMediaDenial('No tengo fotos ahora. ¡Pero te paso toda la información enseguida!')
    expect(out.text).toBe('¡Pero te paso toda la información enseguida!')
  })

  it('multi-línea: descarta la oración negadora', () => {
    const out = repairMediaDenial('No tengo fotos.\nAquí tienes el precio.')
    expect(out.text).toBe('Aquí tienes el precio.')
  })
})