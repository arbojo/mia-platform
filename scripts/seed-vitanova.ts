import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const VITANOVA_OWNER_EMAIL = 'arbojo@gmail.com'

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
    .select('id, onboarding_status')
    .eq('owner_id', ownerId)
    .eq('name', 'Vitanova')
    .maybeSingle()
  if (existing) return existing

  const { data, error } = await supabase
    .from('businesses')
    .insert({
      owner_id: ownerId,
      name: 'Vitanova',
      onboarding_status: 'ready',
    })
    .select('id')
    .single()
  if (error) throw new Error(`business insert failed: ${error.message}`)
  return data
}

async function getOrCreateBrand(supabase: ReturnType<typeof createClient>, businessId: string) {
  const { data: existing } = await supabase
    .from('brand_identities')
    .select('business_id')
    .eq('business_id', businessId)
    .maybeSingle()
  if (existing) return existing

  const { error } = await supabase.from('brand_identities').insert({
    business_id: businessId,
    business_name: 'Vitanova',
    tagline: 'Bienestar y cuidado en casa',
    tone_of_voice: 'Cercano, honesto y consultivo: primero entender la necesidad, después recomendar',
    target_customers:
      'Personas que buscan bienestar y cuidado en casa (uñas, pies, abdomen, canas, facial) sin recurrir a clínicas ni procedimientos costosos.',
    differentiators:
      'Productos $449–$599 de efecto real verificable, pago contra entrega, envío gratis y una asesora virtual que nunca promete de más.',
  })
  if (error) throw new Error(`brand_identity insert failed: ${error.message}`)
  return { business_id: businessId }
}

async function getOrCreateAssistant(supabase: ReturnType<typeof createClient>, businessId: string) {
  const { data: existing } = await supabase
    .from('assistants')
    .select('id')
    .eq('business_id', businessId)
    .eq('name', 'MIA')
    .maybeSingle()
  if (existing) return existing

  const { data, error } = await supabase
    .from('assistants')
    .insert({
      business_id: businessId,
      name: 'MIA',
      communication_style: 'warm',
      personality: { warmth: 80, formality: 40, humor: 50, sales_aggressiveness: 40 },
      status: 'ready',
      is_active: true,
    })
    .select('id')
    .single()
  if (error) throw new Error(`assistant insert failed: ${error.message}`)

  await supabase.from('assistant_channels').insert({
    assistant_id: data.id,
    channel: 'web',
    is_active: true,
  })

  return data
}

async function seedProducts(supabase: ReturnType<typeof createClient>, businessId: string) {
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('business_id', businessId)
    .limit(1)
    .maybeSingle()
  if (existing) return

  const { error } = await supabase.from('products').insert([
    {
      business_id: businessId,
      name: 'Clean Nails',
      price: 599,
      description:
        'Luz UV para uñas con hongos (onicomicosis). Apoya el cuidado de la uña; los cambios son graduales conforme la uña crece y requieren constancia.',
      benefits:
        'Discreto, de uso en casa, con constancia apoya el aspecto de la uña afectada. Incluye envío gratis.',
      faq: [
        { q: '¿Funciona de verdad?', a: 'Con honestidad: no promete una curación. Es luz UV que apoya el cuidado; los cambios son graduales y dependen del ritmo de crecimiento de tu uña y de la constancia en cada sesión.' },
        { q: '¿Cuánto tarda?', a: 'Depende del ritmo de crecimiento de tu uña. Lo que sí controlas es la constancia: cada sesión cuenta.' },
        { q: '¿Cómo se paga?', a: 'Pago contra entrega, envío gratis. Necesitamos tu confirmación explícita y tu ciudad.' },
      ],
      is_active: true,
    },
    {
      business_id: businessId,
      name: 'Back2Fit',
      price: 499,
      description:
        'Chaleco moldeador masculino discreto, bajo la ropa, con soporte lumbar y efecto inmediato.',
      benefits:
        'Disimula y acomoda el torso de forma natural; delgado y transpirable. Llévate 2 piezas y ahorra 20%; con 3 hasta 30%.',
      faq: [
        { q: '¿Se nota que lo traigo?', a: 'Es delgado y transpirable. No te prometo otro cuerpo: disimula y acomoda el torso de forma natural.' },
        { q: '¿Se usa diario?', a: 'Sí, y si te llevas 2 piezas ahorras 20%; con 3 hasta 30%.' },
      ],
      is_active: true,
    },
    {
      business_id: businessId,
      name: 'Neurofeet',
      price: 449,
      description:
        'Calcetines de compresión graduada 20-30 mmHg que dan soporte y ayudan con la pesadez de piernas al trabajar de pie.',
      benefits:
        'Promoción fija: 3 pares al precio de 1 ($449). Es un apoyo de comodidad, no un tratamiento médico.',
      faq: [
        { q: '¿De verdad ayudan o es puro cuento?', a: 'Honestamente, son un apoyo de comodidad, no un tratamiento médico. Muchos clientes notan más ligereza. Si hay dolor intenso, lo correcto es consultar a un profesional.' },
        { q: '¿Qué talla soy?', a: 'Mide la parte más ancha de tu pantorrilla y compárala con la tabla. Deben sentirse firmes pero cómodos.' },
        { q: '¿Cuál es la promoción?', a: 'Paquete de 3 pares en $449 (al precio de 1).' },
      ],
      is_active: true,
    },
    {
      business_id: businessId,
      name: 'Neurotin',
      price: 449,
      description:
        'Calcetín corto de soporte para pie y tobillo: soporte en arco, talón y tobillo, de punta abierta para ser discreto.',
      benefits:
        'Discreto y fácil de usar con el calzado diario. Ideal para molestias de arco, talón o tobillo al caminar mucho.',
      faq: [
        { q: '¿Sirve con calzado normal?', a: 'Sí, es discreto y fácil de usar con el calzado diario.' },
      ],
      is_active: true,
    },
    {
      business_id: businessId,
      name: 'Bella Patch',
      price: 499,
      description:
        'Tiras tensoras faciales para un efecto lifting temporal. 60 tiras, hasta 30 puestas completas (≈$16.6 por puesta).',
      benefits:
        'Invisibles bajo maquillaje; efecto temporal para momentos especiales. No aplica descuento por cantidad, pero su precio por puesta compite con un procedimiento estético.',
      faq: [
        { q: '¿Se notan con maquillaje?', a: 'Son delgadas y se integran con maquillaje. Es un efecto temporal para el momento especial, no permanente.' },
        { q: '¿Hay descuento si llevo más?', a: 'Este producto no aplica descuento por cantidad, pero su precio por puesta es de los mejores frente a un procedimiento estético.' },
      ],
      is_active: true,
    },
    {
      business_id: businessId,
      name: 'Bye Canas',
      price: 499,
      description:
        'Champú de pigmentación progresiva sin amoníaco que oscurece las canas de forma natural y gradual.',
      benefits:
        'Sin olor fuerte y sin el resultado artificial de un tinte; se mantiene con el uso constante en la ducha. Tonos: Negro, Castaño y Castaño Claro.',
      faq: [
        { q: '¿Se ve natural o se nota pintado?', a: 'Es progresivo, así que va natural. No sale un negro intenso de golpe; eliges Negro, Castaño o Castaño Claro.' },
        { q: '¿Se mantiene?', a: 'Se mantiene con el uso constante en la ducha; es una rutina, no un tinte de una sola vez.' },
      ],
      is_active: true,
    },
  ])
  if (error) throw new Error(`products insert failed: ${error.message}`)
}

async function seedRules(supabase: ReturnType<typeof createClient>, businessId: string) {
  const { data: existing } = await supabase
    .from('sales_rules')
    .select('id')
    .eq('business_id', businessId)
    .limit(1)
    .maybeSingle()
  if (existing) return

  const { error } = await supabase.from('sales_rules').insert([
    {
      business_id: businessId,
      category: 'payment',
      content: 'Todos los pedidos se pagan contra entrega (COD). Nunca pedir pago por adelantado.',
      priority: 1,
      is_active: true,
    },
    {
      business_id: businessId,
      category: 'schedule',
      content: 'Para generar el pedido se requiere confirmación explícita del cliente y su ciudad (para la fecha de entrega). El "me interesa" no es una compra.',
      priority: 2,
      is_active: true,
    },
    {
      business_id: businessId,
      category: 'promotions',
      content: 'Back2Fit: 2 piezas ahorran 20%; 3 piezas hasta 30%.',
      priority: 3,
      is_active: true,
    },
    {
      business_id: businessId,
      category: 'promotions',
      content: 'Neurofeet: paquete de 3 pares al precio de 1 ($449).',
      priority: 4,
      is_active: true,
    },
    {
      business_id: businessId,
      category: 'restrictions',
      content: 'Bella Patch no aplica descuento por cantidad; anclar el valor por puesta frente a un procedimiento estético.',
      priority: 5,
      is_active: true,
    },
    {
      business_id: businessId,
      category: 'escalation',
      content: 'Dolor intenso, sospecha de condición médica o pedidos de diagnóstico: derivar a un profesional de la salud. No dar diagnósticos ni prometer tratamientos.',
      priority: 6,
      is_active: true,
    },
  ])
  if (error) throw new Error(`sales_rules insert failed: ${error.message}`)
}

async function seedKnowledge(supabase: ReturnType<typeof createClient>, businessId: string) {
  const { data: existing } = await supabase
    .from('knowledge_items')
    .select('id')
    .eq('business_id', businessId)
    .limit(1)
    .maybeSingle()
  if (existing) return

  const { error } = await supabase.from('knowledge_items').insert([
    {
      business_id: businessId,
      category: 'business_info',
      question: '¿Qué es Vitanova?',
      answer: 'Vitanova es una marca de bienestar y cuidado en casa: productos de $449 a $599 con efecto real verificable, envío gratis y pago contra entrega.',
      source: 'document',
      confidence: 'high',
      is_active: true,
    },
    {
      business_id: businessId,
      category: 'process',
      question: '¿Cómo se hace un pedido?',
      answer: 'El cliente confirma explícitamente el producto y su ciudad; el pago es contra entrega (COD) y el envío es gratis.',
      source: 'document',
      confidence: 'high',
      is_active: true,
    },
    {
      business_id: businessId,
      category: 'objection',
      question: '¿Esto de verdad funciona?',
      answer: 'Respuesta honesta por producto (C-010): Clean Nails y Bye Canas son graduales y exigen constancia; Back2Fit y Bella Patch tienen efecto inmediato pero temporal; Neurofeet y Neurotin son apoyos de comodidad, no tratamientos médicos.',
      source: 'document',
      confidence: 'high',
      is_active: true,
    },
    {
      business_id: businessId,
      category: 'objection',
      question: 'Es muy caro',
      answer: 'Recalibrar el ancla por uso (P-020): Clean Nails $599 ≈ costo de una sesión de clínica; Bye Canas $499 ≈ meses de uso; Bella Patch ≈$16.6 por puesta frente a un procedimiento estético.',
      source: 'document',
      confidence: 'high',
      is_active: true,
    },
    {
      business_id: businessId,
      category: 'tip',
      question: '¿Qué talla de Neurofeet necesito?',
      answer: 'Medir la parte más ancha de la pantorrilla y compararla con la tabla de tallas. Deben sentirse firmes pero cómodos.',
      source: 'document',
      confidence: 'high',
      is_active: true,
    },
    {
      business_id: businessId,
      category: 'tip',
      question: '¿Qué tono de Bye Canas elegir?',
      answer: 'Tonos disponibles: Negro, Castaño y Castaño Claro. Es progresivo y no sale un negro intenso de golpe.',
      source: 'document',
      confidence: 'high',
      is_active: true,
    },
  ])
  if (error) throw new Error(`knowledge insert failed: ${error.message}`)
}

async function seedInstructions(supabase: ReturnType<typeof createClient>, businessId: string) {
  const { data: existing } = await supabase
    .from('ai_instructions')
    .select('id')
    .eq('business_id', businessId)
    .limit(1)
    .maybeSingle()
  if (existing) return

  const { error } = await supabase.from('ai_instructions').insert([
    {
      business_id: businessId,
      instruction:
        'Sé la asesora virtual de Vitanova. Si te preguntan si eres un bot o IA, responde con honestidad que eres la asesora virtual de Vitanova y ancla en que los datos, productos y precios que compartes son reales. No finjas ser una persona.',
      priority: 1,
      is_active: true,
    },
    {
      business_id: businessId,
      instruction:
        'Nunca prometas curación, tratamientos, resultados garantizados ni otro cuerpo. Sé honesta sobre los límites de cada producto (efecto gradual, temporal o de comodidad).',
      priority: 2,
      is_active: true,
    },
    {
      business_id: businessId,
      instruction:
        'El "me interesa" no es una compra. Para cerrar, pide confirmación explícita del pedido y la ciudad del cliente (para la fecha de entrega). Pago contra entrega.',
      priority: 3,
      is_active: true,
    },
    {
      business_id: businessId,
      instruction:
        'Nunca uses presión, escasez fabricada, urgencia inventada ni ofertas de tiempo limitado falsas. La confianza se construye con veracidad.',
      priority: 4,
      is_active: true,
    },
    {
      business_id: businessId,
      instruction:
        'Si el cliente reporta dolor intenso o una posible condición médica, derívalo a un profesional de la salud. No des diagnósticos.',
      priority: 5,
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

  const owner = await findUserByEmail(supabase, VITANOVA_OWNER_EMAIL)
  if (!owner) {
    console.error(`Owner ${VITANOVA_OWNER_EMAIL} not found in auth.users. Seed aborted.`)
    process.exit(1)
  }

  const business = await getOrCreateBusiness(supabase, owner.id)
  const assistant = await getOrCreateAssistant(supabase, business.id)
  await getOrCreateBrand(supabase, business.id)
  await seedProducts(supabase, business.id)
  await seedRules(supabase, business.id)
  await seedKnowledge(supabase, business.id)
  await seedInstructions(supabase, business.id)

  console.log(
    `Vitanova ready: business=${business.id} assistant=${assistant.id} owner=${owner.id}`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
