import { describe, it, expect } from 'vitest'
import { buildMasterPrompt } from '@/lib/ai/prompts'

const BUSINESS = {
  id: 'b-1',
  name: 'Vitanova',
  owner_id: 'u-1',
} as never

const BRAND = {
  business_name: 'Vitanova',
  elevator_pitch: 'Calzado de calidad.',
  target_customers: 'Personas que buscan comodidad.',
  differentiators: 'Precio justo.',
  tone_of_voice: 'cercano',
} as never

const ASSISTANT = {
  name: 'MIA',
  communication_style: 'profesional',
  personality: {
    warmth: 80,
    formality: 40,
    humor: 60,
    sales_aggressiveness: 75,
  },
} as never

const PRODUCT = {
  name: 'Bota de Cuero',
  price: 150,
  description: 'Bota impermeable',
  benefits: 'Duradera',
} as never

const RULE = {
  content: 'Envío gratis desde $100',
  priority: 1,
  category: 'promotions',
} as never

const INSTRUCTION = {
  instruction: 'Saluda siempre por nombre.',
  source: 'manual',
} as never

const KNOWLEDGE = {
  question: '¿Envían a todo el país?',
  answer: 'Sí.',
  source: 'document',
} as never

function build(overrides?: Partial<Parameters<typeof buildMasterPrompt>[0]>) {
  return buildMasterPrompt({
    business: BUSINESS,
    brand: BRAND,
    assistant: ASSISTANT,
    products: [PRODUCT],
    rules: [RULE],
    instructions: [INSTRUCTION],
    knowledge: [KNOWLEDGE],
    ...overrides,
  })
}

describe('buildMasterPrompt', () => {
  it('incluye identidad del asistente y negocio', () => {
    const prompt = build()
    expect(prompt).toContain('MIA')
    expect(prompt).toContain('Vitanova')
  })

  it('incluye productos con precio y beneficios', () => {
    const prompt = build()
    expect(prompt).toContain('Bota de Cuero')
    expect(prompt).toContain('150')
    expect(prompt).toContain('Duradera')
  })

  it('incluye reglas e instrucciones', () => {
    const prompt = build()
    expect(prompt).toContain('Envío gratis desde $100')
    expect(prompt).toContain('Saluda siempre por nombre.')
  })

  it('incluye conocimiento', () => {
    const prompt = build()
    expect(prompt).toContain('¿Envían a todo el país?')
    expect(prompt).toContain('Sí.')
  })

  it('marca mensaje sin productos', () => {
    const prompt = build({ products: [] })
    expect(prompt).not.toContain('Bota de Cuero')
  })

  it('incluye nota de tono desde brand', () => {
    const prompt = build()
    expect(prompt).toContain('cercano')
  })

  it('añade directive de intent tag para whatsapp', () => {
    const prompt = build({ channel: 'whatsapp', intentTag: 'intent-1' })
    expect(prompt).toContain('INTENT_TAG: intent-1')
  })

  it('incluye memoria de negocio y lecciones recientes', () => {
    const prompt = build({
      memory: [
        {
          id: 'm-1',
          business_id: 'b-1',
          memory_type: 'decision',
          category: 'pricing',
          content: 'Nunca bajar precio de botas.',
          evidence: {},
          confidence: 90,
          first_observed_at: '2026-01-01',
          last_observed_at: '2026-01-01',
          observation_count: 5,
          is_active: true,
          is_immutable: true,
        } as never,
      ],
      recentLessons: [
        {
          id: 'l-1',
          original_response: 'No sé',
          corrected_response: 'Déjame revisar',
          correction_type: 'knowledge',
          severity: 'critical',
          created_at: '2026-01-01',
        } as never,
      ],
    })
    expect(prompt).toContain('Nunca bajar precio de botas.')
    expect(prompt).toContain('No sé')
  })

  it('incluye memoria de cliente cuando existe', () => {
    const prompt = build({ customerMemory: 'Cliente prefiere botas café.' })
    expect(prompt).toContain('Cliente prefiere botas café.')
  })

  it('promete una imagen solo en canales que despachan media', () => {
    const knowledgeWithImage = [
      {
        question: '¿Envían a todo el país?',
        answer: 'Sí.',
        source: 'document',
        image_url: 'https://example.com/img.jpg',
        trigger_condition: 'envio',
      },
    ] as never

    const whatsapp = build({ channel: 'whatsapp', knowledge: knowledgeWithImage })
    expect(whatsapp).toContain('[IMAGEN_DISPONIBLE]')

    const streaming = build({ knowledge: knowledgeWithImage })
    expect(streaming).not.toContain('[IMAGEN_DISPONIBLE]')
  })

  it('incluye la regla anti-bucle de rechazo/desvio en es', () => {
    const prompt = build()
    expect(prompt).toContain('SI EL CLIENTE NIEGA O CAMBIA DE TEMA')
    expect(prompt).toContain('no insistas')
    expect(prompt).toContain('repitas la pregunta de confirmación ni el gancho de cierre')
  })

  it('incluye la regla anti-bucle de rechazo/desvio en en', () => {
    const prompt = build({ locale: 'en' })
    expect(prompt).toContain('IF THE CUSTOMER DECLINES OR CHANGES SUBJECT')
    expect(prompt).toContain('do not insist')
  })

  it('askCity condicional: no pide ciudad en fase de investigación en es', () => {
    const prompt = build({ channel: 'whatsapp' })
    expect(prompt).toContain('Pregunta la ciudad SOLO cuando el cliente pida envío/entrega')
    expect(prompt).toContain('fase de investigación')
    expect(prompt).toContain('NO preguntes la ciudad')
    expect(prompt).toContain('no la vuelvas a preguntar')
  })

  it('askCity condicional: no pide ciudad en fase de investigación en en', () => {
    const prompt = build({ channel: 'whatsapp', locale: 'en' })
    expect(prompt).toContain('Ask for the city ONLY when the customer requests shipping/delivery')
    expect(prompt).toContain('research phase')
    expect(prompt).toContain('do NOT ask for the city')
  })

  it('closing policies: sostiene el cierre en fase de investigación y no repite gancho', () => {
    const prompt = build({ channel: 'whatsapp' })
    expect(prompt).toContain('SOSTÉN el cierre')
    expect(prompt).toContain('No repitas el mismo gancho ni la misma pregunta en mensajes consecutivos')
  })

  it('closing policies: sostiene el cierre en fase de investigación y no repite gancho en en', () => {
    const prompt = build({ channel: 'whatsapp', locale: 'en' })
    expect(prompt).toContain('HOLD the close')
    expect(prompt).toContain('Do not repeat the same hook or question in consecutive messages')
  })

  it('waOrderCapture: formato de dirección de una línea y no auto-confirmar', () => {
    const prompt = build({ channel: 'whatsapp' })
    expect(prompt).toContain('DIRECCIÓN: captúrala en UNA línea')
    expect(prompt).toContain('Col. <colonia>')
    expect(prompt).toContain('NUNCA digas "tu pedido está confirmado"')
  })

  it('waOrderCapture: formato de dirección de una línea y no auto-confirmar en en', () => {
    const prompt = build({ channel: 'whatsapp', locale: 'en' })
    expect(prompt).toContain('ADDRESS: capture it in ONE line')
    expect(prompt).toContain('NEVER say "your order is confirmed"')
  })

  describe('lastCancelledOrder guard', () => {
    const cancelledBase = {
      productName: 'Bota de Cuero',
      cancelledAt: '2025-01-01T00:00:00Z',
      hoursAgo: 5,
    }

    it('casual message + cancelled order → blocks reconstruction', () => {
      const prompt = build({
        lastCancelledOrder: { ...cancelledBase, pending: false },
        userIntent: 'casual',
        conversationOutcome: 'won',
      })
      expect(prompt).toContain('Guardia de venta cancelada')
      expect(prompt).toContain('NO reconstruyas')
      expect(prompt).toContain('NO presentes pedidos pendientes')
    })

    it('order_reference + cancelled → explains but no reopen', () => {
      const prompt = build({
        lastCancelledOrder: { ...cancelledBase, pending: false },
        userIntent: 'order_reference',
        conversationOutcome: 'won',
      })
      expect(prompt).toContain('Referencia a pedido cancelado')
      expect(prompt).toContain('NO re abras ni reconstruyas')
    })

    it('explicit_purchase + cancelled → allows new sale', () => {
      const prompt = build({
        lastCancelledOrder: { ...cancelledBase, pending: false },
        userIntent: 'explicit_purchase',
        conversationOutcome: 'won',
      })
      expect(prompt).toContain('Nueva venta iniciada')
      expect(prompt).toContain('NO reutilices ni reconstruyas')
      expect(prompt).toContain('compra completamente nueva')
    })

    it('no userIntent + cancelled → empty guard (no injection)', () => {
      const prompt = build({
        lastCancelledOrder: { ...cancelledBase, pending: false },
        userIntent: undefined,
        conversationOutcome: 'won',
      })
      expect(prompt).not.toContain('Guardia de venta cancelada')
    })

    it('RETENTION_PENDING: casual → blocks reconstruction with pending message', () => {
      const prompt = build({
        lastCancelledOrder: { ...cancelledBase, pending: true },
        userIntent: 'casual',
        conversationOutcome: 'won',
      })
      expect(prompt).toContain('Estado de cancelación pendiente')
      expect(prompt).toContain('cancelación AÚN NO está confirmada')
      expect(prompt).toContain('NO reconstruyas')
      expect(prompt).toContain('Puedes responder preguntas sobre productos normalmente')
    })

    it('RETENTION_PENDING: order_reference → pending reference', () => {
      const prompt = build({
        lastCancelledOrder: { ...cancelledBase, pending: true },
        userIntent: 'order_reference',
        conversationOutcome: 'won',
      })
      expect(prompt).toContain('Referencia a pedido con cancelación pendiente')
      expect(prompt).toContain('NO re abras ni reconstruyas')
    })

    it('RETENTION_PENDING: explicit_purchase → allows new sale', () => {
      const prompt = build({
        lastCancelledOrder: { ...cancelledBase, pending: true },
        userIntent: 'explicit_purchase',
        conversationOutcome: 'won',
      })
      expect(prompt).toContain('Nueva venta iniciada')
      expect(prompt).toContain('pedido con cancelación pendiente')
      expect(prompt).toContain('compra completamente nueva')
    })

    it('conversationOutcome=cancelled → no guard (CHECK prevents it)', () => {
      const prompt = build({
        lastCancelledOrder: cancelledBase,
        conversationOutcome: 'cancelled',
      })
      expect(prompt).not.toContain('Guardia de venta cancelada')
    })
  })
})
