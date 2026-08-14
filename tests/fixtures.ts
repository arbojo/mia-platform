export const FAKE_UUIDS = {
  assistant: 'a0000000-0000-4000-8000-000000000001',
  business: 'b0000000-0000-4000-8000-000000000002',
  customer: 'c0000000-0000-4000-8000-000000000003',
  conversation: 'd0000000-0000-4000-8000-000000000004',
  user: 'e0000000-0000-4000-8000-000000000005',
  product1: 'p0000000-0000-4000-8000-000000000010',
  product2: 'p0000000-0000-4000-8000-000000000011',
  rule1: 'r0000000-0000-4000-8000-000000000020',
  instruction1: 'i0000000-0000-4000-8000-000000000030',
  knowledge1: 'k0000000-0000-4000-8000-000000000040',
}

export const mockBusiness = {
  id: FAKE_UUIDS.business,
  name: 'Test Business',
  owner_id: FAKE_UUIDS.user,
  onboarding_status: 'ready' as const,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

export const mockAssistant = {
  id: FAKE_UUIDS.assistant,
  business_id: FAKE_UUIDS.business,
  name: 'Test Assistant',
  personality: {
    warmth: 70,
    formality: 50,
    humor: 30,
    sales_aggressiveness: 60,
  },
  communication_style: 'warm' as const,
  avatar_url: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  businesses: mockBusiness,
}

export const mockCustomer = {
  id: FAKE_UUIDS.customer,
  business_id: FAKE_UUIDS.business,
  name: 'Test Customer',
  phone: null,
  email: null,
  status: 'new',
  last_interaction: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

export const mockConversation = {
  id: FAKE_UUIDS.conversation,
  assistant_id: FAKE_UUIDS.assistant,
  customer_id: FAKE_UUIDS.customer,
  type: 'live',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

export const mockMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
  { role: 'user', content: '¿Qué productos tienen?' },
  { role: 'assistant', content: 'Tenemos zapatos y botas.' },
  { role: 'user', content: '¿Cuánto cuestan las botas?' },
]

export const mockBrandIdentity = {
  id: 'brand-00001-...',
  business_id: FAKE_UUIDS.business,
  business_name: 'Test Business',
  tagline: null,
  elevator_pitch: 'Somos una tienda de prueba.',
  target_customers: 'Personas que buscan calzado.',
  differentiators: 'Calidad y precio.',
  tone_of_voice: null,
  avatar_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

export const mockProducts = [
  {
    id: FAKE_UUIDS.product1,
    business_id: FAKE_UUIDS.business,
    name: 'Bota de Cuero',
    sku: 'BOTA-001',
    price: 150,
    description: 'Bota de cuero genuino',
    benefits: 'Duradera, impermeable',
    faq: {},
    restrictions: null,
    image_url: null,
    documents: [],
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: FAKE_UUIDS.product2,
    business_id: FAKE_UUIDS.business,
    name: 'Zapato Formal',
    sku: 'ZAPA-001',
    price: 120,
    description: 'Zapato de vestir',
    benefits: 'Cómodo, elegante',
    faq: {},
    restrictions: null,
    image_url: null,
    documents: [],
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

export const mockRules = [
  {
    id: FAKE_UUIDS.rule1,
    business_id: FAKE_UUIDS.business,
    content: 'Envío gratis en compras mayores a $100',
    category: 'promotions' as const,
    priority: 1,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

export const mockInstructions = [
  {
    id: FAKE_UUIDS.instruction1,
    business_id: FAKE_UUIDS.business,
    instruction: 'Saluda siempre al cliente por su nombre.',
    source: 'manual' as const,
    priority: 1,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
]

export const mockKnowledgeItems = [
  {
    id: FAKE_UUIDS.knowledge1,
    business_id: FAKE_UUIDS.business,
    category: 'faq' as const,
    question: '¿Hacen envíos a todo el país?',
    answer: 'Sí, hacemos envíos a todo México.',
    source: 'document' as const,
    confidence: 'high' as const,
    image_url: null,
    trigger_condition: null,
    media_type: 'image' as const,
    product_id: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

export const mockChannelConnection = {
  id: 'conn-00001',
  business_id: FAKE_UUIDS.business,
  assistant_id: FAKE_UUIDS.assistant,
  channel: 'widget',
  status: 'connected',
  credentials: {},
  configuration: {},
  last_sync: null,
  error_message: null,
}

export const mockLearningEvents = [
  {
    id: 'learn-00001',
    assistant_id: FAKE_UUIDS.assistant,
    original_response: 'No sé.',
    corrected_response: 'Déjame consultar con el equipo.',
    correction_type: 'knowledge',
    status: 'approved',
    severity: 'critical',
    category: 'knowledge',
    created_at: '2026-01-10T00:00:00Z',
  },
]

export const mockWireMessage = {
  channel: 'widget',
  externalId: 'ext-001',
  customerExternalId: 'visitor-abc-123',
  customerName: 'Widget Visitor',
  content: 'Hola, ¿qué productos tienen?',
  contentType: 'text' as const,
  metadata: { businessId: FAKE_UUIDS.business, assistantId: FAKE_UUIDS.assistant },
  receivedAt: new Date('2026-01-15T12:00:00Z'),
}
