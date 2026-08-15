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
})
