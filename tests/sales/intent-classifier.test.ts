import { describe, it, expect } from 'vitest'
import { classifyUserIntent } from '@/lib/sales/intent-classifier'

describe('classifyUserIntent', () => {
  describe('explicit_purchase', () => {
    it.each([
      'quiero comprar Clean Nails',
      'quiero llevar uno',
      'me llevo uno',
      'lo llevo',
      'quiero pedir Neurotin',
      'dame uno',
      'dame una',
      'ponme uno',
      'quisiera comprar algo',
      'me gustaria comprar',
      'necesito comprar',
      'confirmar pedido',
      'confirmo el pedido',
      'quiero confirmar',
      'yo quiero',
      'lo quiero',
      'me interesa comprar',
    ])('"%s" → explicit_purchase', (msg) => {
      expect(classifyUserIntent(msg)).toBe('explicit_purchase')
    })
  })

  describe('casual', () => {
    it.each([
      'hola',
      'hola mia',
      'buenas',
      'buenos días',
      'buenas tardes',
      'gracias',
      'ok',
      'dale',
      'perfecto',
      'adiós',
      'chao',
      'help',
      'ayuda',
      'opciones',
      'qué tal',
      'cómo estás',
      '',
    ])('"%s" → casual', (msg) => {
      expect(classifyUserIntent(msg)).toBe('casual')
    })
  })

  describe('order_reference', () => {
    it.each([
      'qué pasó con mi pedido',
      'qué paso con mi pedido',
      'mi pedido de Clean Nails',
      'el pedido',
      'ese pedido',
      'qué pasó con la orden',
      'dónde está mi pedido',
      'cuándo llega mi pedido',
      'status del pedido',
      'estado del pedido',
      'qué fue de mi compra',
      'mi compra',
      'lo que pedí',
      'ese producto que pedí',
    ])('"%s" → order_reference', (msg) => {
      expect(classifyUserIntent(msg)).toBe('order_reference')
    })
  })

  describe('negation', () => {
    it.each([
      'no quiero comprar Clean Nails',
      'no lo quiero',
      'ya no quiero',
      'no me interesa',
      'mejor no',
      'olvídalo',
      'no gracias',
      'quiero cancelar Clean Nails',
      'cancelar mi pedido',
      'devolver',
      'me arrepentí',
      'cambié de opinión',
    ])('"%s" → casual (negation blocks purchase)', (msg) => {
      expect(classifyUserIntent(msg)).toBe('casual')
    })
  })

  describe('combined order_reference + purchase', () => {
    it.each([
      'quiero comprar Clean Nails otra vez',
      'mi pedido de Neurotin, quiero comprar uno nuevo',
    ])('"%s" → explicit_purchase', (msg) => {
      expect(classifyUserIntent(msg)).toBe('explicit_purchase')
    })
  })

  describe('regression: cancel-loop scenario', () => {
    it('"quiero cancelar el pedido" → casual (not purchase)', () => {
      expect(classifyUserIntent('quiero cancelar el pedido')).toBe('casual')
    })

    it('"gracias" → casual', () => {
      expect(classifyUserIntent('gracias')).toBe('casual')
    })

    it('"hola mia!!" → casual', () => {
      expect(classifyUserIntent('hola mia!!')).toBe('casual')
    })

    it('"qué pasó con mi pedido de Clean Nails" → order_reference', () => {
      expect(classifyUserIntent('qué pasó con mi pedido de Clean Nails')).toBe('order_reference')
    })
  })
})
