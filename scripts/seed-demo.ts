import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEMO_BUSINESS_ID = '11111111-1111-4111-8111-111111111111'
const DEMO_OWNER_EMAIL = 'demo@mia-platform.local'

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) out[match[1]] = match[2].trim()
  }
  return out
}

async function findUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (error) throw new Error(`listUsers failed: ${error.message}`)
  const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  return found ? { id: found.id } : null
}

async function getOrCreateBusiness(supabase: ReturnType<typeof createClient>, ownerId: string) {
  const { data: existing } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', DEMO_BUSINESS_ID)
    .maybeSingle()
  if (existing) return existing

  const { data, error } = await supabase
    .from('businesses')
    .insert({
      id: DEMO_BUSINESS_ID,
      owner_id: ownerId,
      name: 'MIA Demo',
      onboarding_status: 'ready',
    })
    .select('id')
    .single()
  if (error) throw new Error(`business insert failed: ${error.message}`)
  return data
}

async function getOrCreateAssistant(supabase: ReturnType<typeof createClient>) {
  const { data: existing } = await supabase
    .from('assistants')
    .select('id')
    .eq('business_id', DEMO_BUSINESS_ID)
    .eq('is_active', true)
    .maybeSingle()
  if (existing) return existing

  const { data, error } = await supabase
    .from('assistants')
    .insert({
      business_id: DEMO_BUSINESS_ID,
      name: 'Luna',
      communication_style: 'warm',
      is_active: true,
    })
    .select('id')
    .single()
  if (error) throw new Error(`assistant insert failed: ${error.message}`)
  return data
}

async function getOrCreateBrand(supabase: ReturnType<typeof createClient>) {
  const { data: existing } = await supabase
    .from('brand_identities')
    .select('business_id')
    .eq('business_id', DEMO_BUSINESS_ID)
    .maybeSingle()
  if (existing) return existing

  const { error } = await supabase.from('brand_identities').insert({
    business_id: DEMO_BUSINESS_ID,
    business_name: 'MIA Demo',
    tagline: 'Tu asistente de ventas que conversa, recuerda y vende por vos',
    tone_of_voice: 'Cercano, profesional y orientado a vender sin presión',
  })
  if (error) throw new Error(`brand_identity insert failed: ${error.message}`)
  return { business_id: DEMO_BUSINESS_ID }
}

async function seedProducts(supabase: ReturnType<typeof createClient>) {
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('business_id', DEMO_BUSINESS_ID)
    .limit(1)
    .maybeSingle()
  if (existing) return

  const { error } = await supabase.from('products').insert([
    {
      business_id: DEMO_BUSINESS_ID,
      name: 'MIA Brain — Evaluation',
      price: 0,
      description: 'Tu asistente entrenado con tus productos, conocimientos y reglas. Un canal web para empezar a vender hoy.',
      benefits: 'Conoce tu negocio en minutos, conversa con tus clientes, aprende de cada interacción.',
      faq: [
        { q: '¿Cuánto cuesta?', a: 'Es gratis, es el laboratorio de evaluación.' },
        { q: '¿Puedo conectar WhatsApp?', a: 'En esta edición solo canal web. Al activar tu plan liberás WhatsApp.' },
      ],
      is_active: true,
    },
    {
      business_id: DEMO_BUSINESS_ID,
      name: 'MIA Brain — Professional',
      price: 149,
      description: 'Producción real con múltiples canales: WhatsApp, web y más. Memoria de cada cliente y seguimiento inteligente.',
      benefits: 'Vende 24/7 por WhatsApp, recuerda a cada cliente, hace seguimiento automático.',
      faq: [
        { q: '¿Qué incluye?', a: 'Hasta 3 asistentes y 5 usuarios con canales WhatsApp, web y Telegram.' },
      ],
      is_active: true,
    },
    {
      business_id: DEMO_BUSINESS_ID,
      name: 'MIA Brain — Cloud',
      price: 499,
      description: 'Despliegue cloud administrado con escala ilimitada y múltiples negocios.',
      benefits: 'Multi-tenant, escala ilimitada, soporte dedicado.',
      faq: [{ q: '¿Para quién es?', a: 'Para organizaciones con múltiples marcas o gran volumen.' }],
      is_active: true,
    },
  ])
  if (error) throw new Error(`products insert failed: ${error.message}`)
}

async function seedKnowledge(supabase: ReturnType<typeof createClient>) {
  const { data: existing } = await supabase
    .from('knowledge_items')
    .select('id')
    .eq('business_id', DEMO_BUSINESS_ID)
    .limit(1)
    .maybeSingle()
  if (existing) return

  const { error } = await supabase.from('knowledge_items').insert([
    {
      business_id: DEMO_BUSINESS_ID,
      category: 'objection',
      question: 'Es muy caro',
      answer: 'Entiendo. Cada plan se paga con lo que vende: un cliente recuperado o una venta nocturna por WhatsApp ya cubre el plan. Empecemos con la Evaluation, es gratis y funciona de verdad.',
      source: 'manual',
      confidence: 'high',
      is_active: true,
    },
    {
      business_id: DEMO_BUSINESS_ID,
      category: 'faq',
      question: '¿Qué es MIA?',
      answer: 'MIA es una plataforma de ventas por conversación: entrenás una asistente con tu negocio y ella conversa con tus clientes, recuerda cada interacción y hace seguimiento.',
      source: 'manual',
      confidence: 'high',
      is_active: true,
    },
    {
      business_id: DEMO_BUSINESS_ID,
      category: 'tip',
      question: '¿Cómo empiezo?',
      answer: 'Con la Evaluation Edition creás tu asistente en el onboarding, cargás productos y reglas, y la entrenás en el Laboratorio antes de activarla.',
      source: 'manual',
      confidence: 'high',
      is_active: true,
    },
  ])
  if (error) throw new Error(`knowledge insert failed: ${error.message}`)
}

async function seedRules(supabase: ReturnType<typeof createClient>) {
  const { data: existing } = await supabase
    .from('sales_rules')
    .select('id')
    .eq('business_id', DEMO_BUSINESS_ID)
    .limit(1)
    .maybeSingle()
  if (existing) return

  const { error } = await supabase.from('sales_rules').insert([
    {
      business_id: DEMO_BUSINESS_ID,
      category: 'payment',
      content: 'Los pagos se gestionan por invitación: el equipo de MIA acompaña la activación de cada plan.',
      priority: 1,
      is_active: true,
    },
    {
      business_id: DEMO_BUSINESS_ID,
      category: 'promotions',
      content: 'Anualmente se aplica un 20% de descuento en el plan Professional.',
      priority: 2,
      is_active: true,
    },
    {
      business_id: DEMO_BUSINESS_ID,
      category: 'escalation',
      content: 'Si el cliente pide facturación o dudas técnicas profundas, derivar al equipo de MIA.',
      priority: 3,
      is_active: true,
    },
  ])
  if (error) throw new Error(`sales_rules insert failed: ${error.message}`)
}

async function seedInstructions(supabase: ReturnType<typeof createClient>) {
  const { data: existing } = await supabase
    .from('ai_instructions')
    .select('id')
    .eq('business_id', DEMO_BUSINESS_ID)
    .limit(1)
    .maybeSingle()
  if (existing) return

  const { error } = await supabase.from('ai_instructions').insert([
    {
      business_id: DEMO_BUSINESS_ID,
      instruction: 'Nunca inventes precios ni características que no estén en tu base de conocimientos. Ante la duda, ofrecé que el equipo humano de MIA responda.',
      priority: 1,
      is_active: true,
    },
    {
      business_id: DEMO_BUSINESS_ID,
      instruction: 'Sé cercano y consultivo: primero entendé la necesidad, después recomendá el plan que mejor la cubra.',
      priority: 2,
      is_active: true,
    },
  ])
  if (error) throw new Error(`ai_instructions insert failed: ${error.message}`)
}

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, serviceRole)

  let ownerId = (await findUserByEmail(supabase, DEMO_OWNER_EMAIL))?.id ?? null
  if (!ownerId) {
    const { data: authResult, error: userError } = await supabase.auth.admin.createUser({
      email: DEMO_OWNER_EMAIL,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { is_demo: true },
    })
    if (userError) throw new Error(`createUser failed: ${userError.message}`)
    ownerId = authResult.user.id
  }

  const business = await getOrCreateBusiness(supabase, ownerId)
  const assistant = await getOrCreateAssistant(supabase)
  await getOrCreateBrand(supabase)
  await seedProducts(supabase)
  await seedKnowledge(supabase)
  await seedRules(supabase)
  await seedInstructions(supabase)

  console.log(
    `Demo ready: business=${business.id} assistant=${assistant.id} owner=${ownerId}`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
