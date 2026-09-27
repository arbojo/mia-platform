import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { guardProduction } from './production-guard'

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
      'Productos $449–$550 de efecto real verificable, pago contra entrega, envío gratis y una asesora virtual que nunca promete de más.',
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
      price: 550,
      price_ladder: {
        tiers: [
          { qty: 1, price: 550 },
          { qty: 2, price: 880 },
          { qty: 3, price: 1188 },
        ],
        open_tier: { min_qty: 4, discount_pct: 35 },
      },
      description:
        'Luz UV e infrarroja para uñas con hongos (onicomicosis). Está diseñada para eliminar el hongo de la uña, y lo consigue con uso constante.',
      benefits:
        'Discreta, de uso en casa. Elimina el hongo de la uña con uso constante. Incluye envío gratis.',
      faq: [
        { q: '¿Funciona de verdad?', a: 'Sí, está diseñada para eliminar el hongo de la uña, y lo consigue con uso constante. Se usa dos veces al día en sesiones de 7 minutos y notarás la mejoría conforme crece la uña nueva. La constancia es la clave.' },
        { q: '¿Cuánto tarda?', a: 'Depende del ritmo de crecimiento de tu uña. Lo que sí controlas es la constancia: cada sesión cuenta.' },
        { q: '¿Cómo se paga?', a: 'Pago contra entrega, envío gratis. Necesitamos tu confirmación explícita y tu ciudad.' },
      ],
      is_active: true,
    },
    {
      business_id: businessId,
      name: 'Back2Fit',
      price: 499,
      price_ladder: {
        tiers: [
          { qty: 2, price: 499 },
          { qty: 3, price: 898 },
          { qty: 4, price: 998 },
          { qty: 5, price: 1397 },
          { qty: 6, price: 1497 },
          { qty: 7, price: 1896 },
          { qty: 8, price: 1996 },
          { qty: 9, price: 2395 },
          { qty: 10, price: 2495 },
        ],
        note: 'No se vende por pieza: el mínimo es 2 y cada par es 2x1 (se paga una y la segunda va de regalo). Si la cantidad es impar, la pieza que sobra se agrega a $399.',
      },
      description:
        'Chaleco moldeador masculino discreto, bajo la ropa, con soporte lumbar y efecto inmediato.',
      benefits:
        'Disimula y acomoda el torso de forma natural; delgado y transpirable.',
      faq: [
        { q: '¿Se vende por pieza?', a: 'No, el mínimo es 2 y cada par es 2x1: pagas una y la segunda va de regalo. Si te llevas una cantidad impar, esa pieza se agrega con 20% de descuento.' },
        { q: '¿Se nota que lo traigo?', a: 'Es delgado y transpirable. No te prometo otro cuerpo: disimula y acomoda el torso de forma natural.' },
        { q: '¿Se usa diario?', a: 'Sí, está pensado para usarlo bajo la ropa en el día a día.' },
      ],
      is_active: true,
    },
    {
      business_id: businessId,
      name: 'Neurofeet',
      price: 449,
      price_ladder: {
        tiers: [
          { qty: 3, price: 449 },
          { qty: 5, price: 599 },
        ],
        note: 'No aplicar descuentos adicionales. Se pueden mezclar tallas y colores: blanco y negro, tallas S a XL.',
      },
      description:
        'Calcetines de compresión graduada 20-30 mmHg que dan soporte y ayudan con la pesadez de piernas al trabajar de pie.',
      benefits:
        'Promoción fija: 3 pares al precio de 1 ($449). Es un apoyo de comodidad, no un tratamiento médico.',
      faq: [
        { q: '¿De verdad ayudan o es puro cuento?', a: 'Honestamente, son un apoyo de comodidad, no un tratamiento médico. Muchos clientes notan más ligereza. Si hay dolor intenso, lo correcto es consultar a un profesional.' },
        { q: '¿Qué talla soy?', a: 'Mide la parte más ancha de tu pantorrilla y compárala con la tabla. Deben sentirse firmes pero cómodos.' },
        { q: '¿Cuál es la promoción?', a: 'Paquetes de 3 pares en $449 o 5 pares en $599. Puedes mezclar tallas y colores: hay en blanco y negro, y las tallas van de la S a la XL. No se aplican descuentos adicionales.' },
      ],
      is_active: true,
    },
    {
      business_id: businessId,
      name: 'Neurotin',
      price: 449,
      price_ladder: {
        tiers: [
          { qty: 3, price: 449 },
          { qty: 5, price: 599 },
        ],
        note: 'No aplicar descuentos adicionales. Se pueden mezclar tallas y colores: blanco y negro, tallas S a XL.',
      },
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
      content: 'Para generar el pedido se requiere confirmación explícita del cliente y su ciudad (para la fecha de entrega). El "me interesa" no es una compra. Si el cliente se niega o desvía la conversación, NO insistas ni repitas la pregunta de confirmación: acéptalo con naturalidad y quédate disponible.',
      priority: 2,
      is_active: true,
    },
    {
      business_id: businessId,
      category: 'promotions',
      content: 'Back2Fit: no se vende por pieza, el mínimo es 2 y cada par es 2x1. Al ofrecerlo, MIA siempre anuncia que la segunda pieza va de regalo y toma el importe exclusivamente de la escalera por cantidad. Si la cantidad es impar, la pieza que sobra se cobra con 20% de descuento. Nunca cotizar una sola pieza ni un precio que no esté en la escalera; si el cliente pide más de 10 piezas, escalar al equipo.',
      priority: 3,
      is_active: true,
    },
    {
      business_id: businessId,
      category: 'promotions',
      content: 'Neurofeet: paquete de 3 pares en $449 o 5 pares en $599. Se pueden mezclar tallas y colores (blanco y negro, tallas S a XL). No se aplican descuentos adicionales.',
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
      content: 'Dolor intenso, sospecha de condición médica o pedidos de diagnóstico: derivar a un profesional de la salud. No dar diagnósticos. No prometer tratamientos ni resultados para condiciones que el producto NO está diseñado para tratar: Clean Nails está diseñado para el hongo de la uña, no para diabetes, neuropatía ni ninguna otra condición.',
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
      answer: 'Vitanova es una marca de bienestar y cuidado en casa: productos de $449 a $550 con efecto real verificable, envío gratis y pago contra entrega.',
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
      answer: 'Recalibrar el ancla por uso (P-020): Clean Nails $550 cuesta menos que una sola sesión de clínica y da todas las sesiones en casa; Bye Canas $499 ≈ meses de uso; Bella Patch ≈$16.6 por puesta frente a un procedimiento estético.',
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
        'Nunca prometas resultados garantizados, tiempos exactos ni resultados idénticos para todos, y nunca generes miedo para vender. Aplica la promesa honesta correspondiente a ESE producto: Clean Nails está diseñado para eliminar el hongo de la uña y lo consigue con uso constante, así que MIA PUEDE afirmarlo siempre ligado a la constancia; Bye Canas es gradual y exige constancia; Back2Fit tiene efecto inmediato; Bella Patch tiene efecto temporal; Neurofeet y Neurotin son apoyos de comodidad, nunca tratamientos médicos. Sé honesta sobre los límites de cada producto.',
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
        'Si el cliente reporta dolor intenso o una posible condición médica, derívalo a un profesional de la salud. No des diagnósticos. No prometer tratamientos ni resultados para condiciones que el producto NO está diseñado para tratar: Clean Nails está diseñado para el hongo de la uña, no para diabetes, neuropatía ni ninguna otra condición.',
      priority: 5,
      is_active: true,
    },
  ])
  if (error) throw new Error(`ai_instructions insert failed: ${error.message}`)
}

async function seedDeliverySchedules(supabase: ReturnType<typeof createClient>, businessId: string) {
  const { data: existing } = await supabase
    .from('delivery_schedules')
    .select('id')
    .eq('business_id', businessId)
    .limit(1)
    .maybeSingle()
  if (existing) return

  // Días en formato JS (0=domingo ... 6=sábado). Fuente: docs extraídos
  // de Vitanova. Regla de negocio: siempre el siguiente día programado.
  const { error } = await supabase.from('delivery_schedules').insert([
    { business_id: businessId, city: 'León', delivery_days: [0, 1, 2, 3, 4, 5, 6] },
    { business_id: businessId, city: 'Lagos de Moreno', delivery_days: [2, 4, 6] },
    { business_id: businessId, city: 'Irapuato', delivery_days: [1, 3, 5] },
    { business_id: businessId, city: 'Silao', delivery_days: [1, 3, 5] },
    { business_id: businessId, city: 'Guanajuato Capital', delivery_days: [1, 3, 5] },
  ])
  if (error) throw new Error(`delivery_schedules insert failed: ${error.message}`)
}

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  guardProduction({ url, label: 'seed-vitanova' })

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
  await seedDeliverySchedules(supabase, business.id)

  console.log(
    `Vitanova ready: business=${business.id} assistant=${assistant.id} owner=${owner.id}`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
