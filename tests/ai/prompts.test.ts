import { describe, it, expect } from 'vitest'
import { buildMasterPrompt, withMediaResolutionFeedback } from '@/lib/ai/prompts'
import type { MediaResolutionFeedback } from '@/lib/ai/prompts'

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

  it('no promete imágenes estáticamente en el prompt (DP-3): el estado truthful lo aporta el runtime', () => {
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
    expect(whatsapp).not.toContain('[IMAGEN_DISPONIBLE]')

    const streaming = build({ knowledge: knowledgeWithImage })
    expect(streaming).not.toContain('[IMAGEN_DISPONIBLE]')
  })

  it('MEDIA-SEMANTIC (contrato §8): la media (image_url) NO aparece como conocimiento general', () => {
    const prompt = build({
      knowledge: [
        KNOWLEDGE,
        {
          question: 'Multimedia: image',
          answer: 'precio, costo, cuanto cuesta',
          source: 'manual',
          image_url: 'https://abc123.supabase.co/storage/v1/object/public/knowledge-media/b-1/img.jpg',
          trigger_condition: 'precio',
        } as never,
      ],
    })
    // El conocimiento textual se mantiene intacto.
    expect(prompt).toContain('¿Envían a todo el país?')
    expect(prompt).toContain('Sí.')
    // El item de media no se renderiza como conocimiento genérico.
    expect(prompt).not.toContain('precio, costo, cuanto cuesta')
    expect(prompt).not.toContain('Multimedia: image')
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

  it('captura consolidada: lista 1-7 + AFIRMACIÓN CLARA en Control de Cierre (fallback sin sales_config)', () => {
    const prompt = build({ channel: 'whatsapp' })
    expect(prompt).toContain('7. Ciudad (ya confirmada: [ciudad del contexto])')
    expect(prompt).toContain('AFIRMACIÓN CLARA')
    expect(prompt).toContain('NUNCA digas "tu pedido está confirmado"')
    expect(prompt).toContain('Acepta cualquier forma válida en México')
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

  describe('post-sale state (sold + SALE_WON)', () => {
    it('conversationOutcome=sold → rama post-venta presente', () => {
      const prompt = build({ conversationOutcome: 'sold' })
      expect(prompt).toContain('Estado post-venta')
    })

    it('post-venta instruye NO reconfirmar NI reconstruir la venta cerrada', () => {
      const prompt = build({ conversationOutcome: 'sold' })
      expect(prompt).toContain('NO vuelvas a preguntar')
      expect(prompt).toContain('ya está cerrada y confirmada')
      expect(prompt).toContain('NO reconstruyas')
    })

    it('post-venta cubre saludos/gracias/afirmativas sin reconfirmación', () => {
      const prompt = build({ conversationOutcome: 'sold' })
      expect(prompt).toContain('"hola", "gracias"')
      expect(prompt).toContain('"sí", "ok", "que si"')
    })

    it('post-venta permite compra nueva explícita (no bloquea el flujo de venta)', () => {
      const prompt = build({ conversationOutcome: 'sold' })
      expect(prompt).toContain('venta NUEVA')
      // El catálogo y las reglas de venta siguen presentes
      expect(prompt).toContain('Bota de Cuero')
      expect(prompt).toContain('Envío gratis desde $100')
    })

    it('RETENTION_PENDING gana por precedencia: no se inyecta la rama post-venta', () => {
      const prompt = build({
        conversationOutcome: 'sold',
        lastCancelledOrder: {
          productName: 'Clean Nails',
          cancelledAt: new Date().toISOString(),
          hoursAgo: 1,
          pending: true,
        },
        userIntent: 'casual',
      })
      expect(prompt).not.toContain('Estado post-venta')
      expect(prompt).toContain('Estado de cancelación pendiente')
    })

    it('sin outcome=sold → sin rama post-venta', () => {
      const prompt = build({ conversationOutcome: 'pending' })
      expect(prompt).not.toContain('Estado post-venta')
    })

    it('sin outcome → sin rama post-venta', () => {
      const prompt = build()
      expect(prompt).not.toContain('Estado post-venta')
    })
  })
})

describe('withMediaResolutionFeedback — truthful media status (R6/R7)', () => {
  const BASE = '## System'

  const feedback = (mediaStatus: MediaResolutionFeedback['mediaStatus']): MediaResolutionFeedback => ({
    scope: ['p-1'],
    explicitScope: 'explicit',
    eligible: true,
    mediaStatus,
    assetSelected: 'a-1',
    claim: 'created',
    dispatched: mediaStatus === 'DISPATCHED',
    delivered: 'unknown',
  })

  it('mantiene el prompt intacto sin feedback', () => {
    expect(withMediaResolutionFeedback(BASE, null)).toBe(BASE)
    expect(withMediaResolutionFeedback(BASE, undefined)).toBe(BASE)
  })

  it('DISPATCHED: adjunta la imagen en este turno, sin prometer envío futuro ni negar', () => {
    const out = withMediaResolutionFeedback(BASE, feedback('DISPATCHED'))
    expect(out).toContain('media_status: DISPATCHED')
    expect(out).toContain('adjunta la imagen en este mismo mensaje')
    expect(out).toContain('delivered: unknown')
    expect(out).not.toContain('prometes un envío futuro')
    expect(out).toContain('NUNCA digas "no tengo imágenes"')
  })

  it('MEDIA_UNAVAILABLE_FOR_PRODUCT: honestidad textual, nunca inventar imagen', () => {
    const out = withMediaResolutionFeedback(BASE, feedback('MEDIA_UNAVAILABLE_FOR_PRODUCT'))
    expect(out).toContain('media_status: MEDIA_UNAVAILABLE_FOR_PRODUCT')
    expect(out).toContain('todavía no tengo fotos de ese producto')
    expect(out).toContain('No afirmes ni inventes ninguna imagen')
  })

  it('MEDIA_REQUEST_NOT_RECOGNIZED: respuesta textual natural sin capacidad genérica', () => {
    const out = withMediaResolutionFeedback(BASE, feedback('MEDIA_REQUEST_NOT_RECOGNIZED'))
    expect(out).toContain('media_status: MEDIA_REQUEST_NOT_RECOGNIZED')
    expect(out).toContain('No se detectó una solicitud de media clara')
    expect(out).toContain('responde con naturalidad en texto')
  })

  it('MEDIA_SCOPE_AMBIGUOUS: pide aclaración, no elige producto ni envía imagen', () => {
    const out = withMediaResolutionFeedback(BASE, feedback('MEDIA_SCOPE_AMBIGUOUS'))
    expect(out).toContain('media_status: MEDIA_SCOPE_AMBIGUOUS')
    expect(out).toContain('Pide aclaración de cuál quiere ver el cliente')
    expect(out).toContain('No elijas ni inventes un producto')
    expect(out).toContain('enumera los productos disponibles para la foto')
    expect(out).toContain('NUNCA afirmes que no puedes enviar imágenes')
  })

  it('NONE: respuesta textual, jamás incapacidad genérica', () => {
    const out = withMediaResolutionFeedback(BASE, feedback('NONE'))
    expect(out).toContain('media_status: NONE')
    expect(out).toContain('No alegues incapacidad')
    expect(out).not.toContain('media_status: DISPATCHED')
  })

  it('reglas no negociables: sin afirmar envío sin attachment del runtime ni promesas futuras (C-1, R7)', () => {
    for (const mediaStatus of ['DISPATCHED', 'MEDIA_UNAVAILABLE_FOR_PRODUCT', 'MEDIA_REQUEST_NOT_RECOGNIZED', 'MEDIA_SCOPE_AMBIGUOUS', 'NONE'] as const) {
      const out = withMediaResolutionFeedback(BASE, feedback(mediaStatus))
      expect(out).toContain('Nunca afirmes que enviaste una imagen si el runtime no la adjuntó (attachment ausente).')
      expect(out).toContain('No prometas envíos futuros de imágenes')
      expect(out).toContain('No presentes "no puedo enviar imágenes" como una incapacidad genérica del sistema')
      expect(out).toContain('El envío o no envío de imágenes es decisión exclusiva del runtime')
    }
  })

  it('MEDIA-SEMANTIC: con semanticDescription el feedback incluye el contexto del asset', () => {
    const out = withMediaResolutionFeedback(BASE, {
      ...feedback('DISPATCHED'),
      semanticDescription: 'Imagen del empaque de Bella Patch con el kit completo.',
      product: 'Bella Patch',
      mediaType: 'image',
    })
    expect(out).toContain('descripción_semántica: Imagen del empaque de Bella Patch con el kit completo.')
    expect(out).toContain('producto: Bella Patch')
    expect(out).toContain('medio: image')
    expect(out).toContain('describe únicamente lo que esa descripción permite afirmar')
  })

  it('MEDIA-SEMANTIC: sin descripción semántica no se inyecta el bloque', () => {
    const out = withMediaResolutionFeedback(BASE, feedback('DISPATCHED'))
    expect(out).not.toContain('descripción_semántica')
    expect(out).not.toContain('producto:')
  })

  it('existing_hit + DISPATCHED → directiva de REENVÍO (no la de primer envío)', () => {
    const out = withMediaResolutionFeedback(BASE, {
      ...feedback('DISPATCHED'),
      claim: 'existing_hit',
    })
    expect(out).toContain('Estás REENVIANDO la imagen')
    expect(out).toContain('reconócelo con naturalidad')
    expect(out).toContain('No le des excusas ni alegues ninguna incapacidad')
    expect(out).toContain('NUNCA digas "no tengo imágenes"')
    expect(out).not.toContain('te comparto la foto')
  })

  it('existing_hit + NONE → reconoce la foto ya compartida, sin prometer envío futuro', () => {
    const out = withMediaResolutionFeedback(BASE, {
      ...feedback('NONE'),
      claim: 'existing_hit',
    })
    expect(out).toContain('reconoce que esa foto ya se compartió antes')
    expect(out).toContain('no prometas un envío futuro')
    expect(out).not.toContain('Estás REENVIANDO')
  })
})
