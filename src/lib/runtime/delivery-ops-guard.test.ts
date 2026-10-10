import { describe, it, expect } from 'vitest'
import { detectDeliveryOps, buildDeliveryOpsResponse } from './delivery-ops-guard'

describe('detectDeliveryOps', () => {
  it('detects reschedule', () => {
    expect(detectDeliveryOps('Podrías reagendar mi entrega para mañana')?.kind).toBe('reschedule')
    expect(detectDeliveryOps('Quiero reprogramar el envío')?.kind).toBe('reschedule')
    expect(detectDeliveryOps('Puedo cambiar el día de entrega')?.kind).toBe('reschedule')
    expect(detectDeliveryOps('Necesito cambiar mi pedido')?.kind).toBe('reschedule')
  })

  it('detects driver on the way / driver mentions', () => {
    expect(detectDeliveryOps('Ya va en camino el repartidor')?.kind).toBe('driver_on_the_way')
    expect(detectDeliveryOps('Viene en camino')?.kind).toBe('driver_on_the_way')
    expect(detectDeliveryOps('Mi repartidor ya salió')?.kind).toBe('driver_on_the_way')
    expect(detectDeliveryOps('El repartidor va para allá')?.kind).toBe('driver_on_the_way')
  })

  it('detects customer waiting / arrival', () => {
    expect(detectDeliveryOps('Ya llegué')?.kind).toBe('customer_waiting')
    expect(detectDeliveryOps('Ya llegue a casa')?.kind).toBe('customer_waiting')
    expect(detectDeliveryOps('Ya estoy en casa')?.kind).toBe('customer_waiting')
    expect(detectDeliveryOps('Estoy afuera')?.kind).toBe('customer_waiting')
    expect(detectDeliveryOps('En la puerta')?.kind).toBe('customer_waiting')
    expect(detectDeliveryOps('Cuánto falta para que llegue')?.kind).toBe('customer_waiting')
    expect(detectDeliveryOps('Cuándo llega')?.kind).toBe('customer_waiting')
  })

  it('does not fire on generic shipping questions', () => {
    expect(detectDeliveryOps('¿Tienen entrega a domicilio?')?.kind).toBe(null)
    expect(detectDeliveryOps('¿Cuánto cuesta el envío?')?.kind).toBe(null)
    expect(detectDeliveryOps('¿Hacen envíos?')?.kind).toBe(null)
    expect(detectDeliveryOps('¿Incluye envío?')?.kind).toBe(null)
  })

  it('does not fire on normal sales conversation', () => {
    expect(detectDeliveryOps('Me interesa el producto')?.kind).toBe(null)
    expect(detectDeliveryOps('¿Tiene stock?')?.kind).toBe(null)
    expect(detectDeliveryOps('Quisiera comprar')?.kind).toBe(null)
  })
})

describe('buildDeliveryOpsResponse', () => {
  it('returns non-empty responses per kind', () => {
    expect(buildDeliveryOpsResponse('reschedule')).toMatch(/reparto/)
    expect(buildDeliveryOpsResponse('driver_on_the_way')).toMatch(/aviso/)
    expect(buildDeliveryOpsResponse('customer_waiting')).toMatch(/aviso/)
    expect(buildDeliveryOpsResponse(null as any)).toMatch(/reparto/)
  })
})

