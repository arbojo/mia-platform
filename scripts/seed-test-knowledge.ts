import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BUSINESS_ID = 'a0000000-0000-0000-0000-000000000001'

async function seedKnowledge() {
  const knowledgeItems = [
    { category: 'faq', question: '¿De qué material están hechas las botas?', answer: 'Todas nuestras botas están hechas con piel genuina de la más alta calidad. Utilizamos piel de becerro, cabra, lagarto y serpiente, dependiendo del modelo. Cada par es 100% artesanal, hecho a mano en León, Guanajuato.', source: 'manual', confidence: 'high' },
    { category: 'faq', question: '¿Cómo cuido mis botas de piel?', answer: 'Recomendamos limpiar tus botas con un paño húmedo después de cada uso. Aplica crema o grasa para cuero cada 2-3 semanas para mantener la piel hidratada. No uses productos químicos agresivos. Guarda las botas en un lugar fresco y seco, preferiblemente con hormas para mantener su forma.', source: 'manual', confidence: 'high' },
    { category: 'faq', question: '¿Cómo sé qué talla pedir?', answer: 'Te sugerimos ordenar media talla MENOR de la que normalmente usas. Nuestras botas son fabricadas artesanalmente y el cuero se amolda al pie con el uso. Si tienes dudas, contáctanos por WhatsApp y te guiaremos en la talla correcta.', source: 'manual', confidence: 'high' },
    { category: 'faq', question: '¿Hacen envíos a toda la República?', answer: 'Sí, enviamos a todo México. El tiempo de entrega es de 3 a 5 días hábiles después de la confirmación del pedido. El envío es GRATIS en compras mayores a $2,500 MXN.', source: 'manual', confidence: 'high' },
    { category: 'faq', question: '¿Aceptan devoluciones?', answer: 'Sí, aceptamos cambios por talla dentro de los primeros 7 días posteriores a la entrega. El producto debe estar en las mismas condiciones en que fue recibido. No realizamos devoluciones de dinero, solo cambios.', source: 'manual', confidence: 'medium' },
    { category: 'objection', question: '¿Por qué son tan caras comparadas con otras botas?', answer: 'Nuestras botas son 100% artesanales, hechas a mano en León, Guanajuato por artesanos mexicanos con décadas de experiencia. Usamos piel genuina de la más alta calidad, no materiales sintéticos. Cada par es único y está diseñado para durar años con el cuidado adecuado. No somos revendedores, somos fabricantes directos, lo que garantiza la mejor relación calidad-precio.', source: 'manual', confidence: 'high' },
    { category: 'objection', question: '¿De verdad están hechas a mano?', answer: 'Sí, cada par de botas es hecho completamente a mano por artesanos en León, Guanajuato. Desde el corte de la piel hasta el cosido y acabado, todo el proceso es artesanal. No utilizamos producción en masa ni maquinaria industrial. Esto garantiza una calidad y atención al detalle que no encuentras en botas producidas en serie.', source: 'manual', confidence: 'high' },
    { category: 'objection', question: '¿Qué garantía tienen?', answer: 'Todas nuestras botas tienen garantía de fabricación por defectos en materiales o mano de obra. Cada par se inspecciona cuidadosamente antes de ser enviado. Al ser productos artesanales, el desgaste natural por uso no está cubierto por la garantía, pero ofrecemos servicio de reparación.', source: 'manual', confidence: 'medium' },
    { category: 'business_info', question: '¿Quiénes son los fabricantes?', answer: 'Somos fabricantes artesanales de León, Guanajuato, la capital del calzado en México. Cada par de botas está hecho a mano por artesanos locales con técnicas tradicionales transmitidas por generaciones. La calidad de nuestros materiales y la atención al detalle nos distingue.', source: 'manual', confidence: 'high' },
    { category: 'business_info', question: '¿Cómo comprar por mayoreo?', answer: 'Tenemos precios especiales para mayoreo y distribuidores. Si estás interesado en vender nuestros productos, contáctanos por WhatsApp al número que aparece en la página para recibir información sobre precios y condiciones.', source: 'manual', confidence: 'high' },
    { category: 'tip', question: '¿Puedo usar mis botas para montar a caballo?', answer: 'Sí, muchos de nuestros modelos son ideales para equitación. Sin embargo, te recomendamos consultarnos directamente para sugerirte el modelo más adecuado según el tipo de actividad ecuestre que realices.', source: 'manual', confidence: 'medium' },
    { category: 'tip', question: '¿Son impermeables?', answer: 'Nuestras botas de piel genuina ofrecen resistencia natural al agua, pero no son completamente impermeables. Recomendamos aplicar un protector impermeabilizante para cuero si las usarás en condiciones de lluvia frecuente.', source: 'manual', confidence: 'medium' },
  ]

  const { data: existing } = await supabase.from('knowledge_items').select('id').eq('business_id', BUSINESS_ID).limit(1)
  if (existing && existing.length > 0) {
    console.log('Knowledge items already exist, skipping seed.')
    return
  }

  const { data, error } = await supabase.from('knowledge_items').insert(
    knowledgeItems.map(k => ({ ...k, business_id: BUSINESS_ID }))
  ).select()

  if (error) { console.error('Error seeding knowledge:', error); return }
  console.log(`Seeded ${data.length} knowledge items.`)
}

async function seedMemory() {
  const { data: existing } = await supabase.from('business_memory').select('id').eq('business_id', BUSINESS_ID).limit(1)
  if (existing && existing.length > 0) {
    console.log('Business memory already exists, skipping seed.')
    return
  }

  const patterns = [
    { memory_type: 'pattern', category: 'faq_frequency', content: 'Los clientes preguntan frecuentemente sobre la talla correcta y si deben pedir una talla menor.', confidence: 85, observation_count: 12 },
    { memory_type: 'pattern', category: 'pricing_question', content: 'Varios clientes comparan nuestros precios con botas comerciales y preguntan por qué somos más caros.', confidence: 75, observation_count: 8 },
    { memory_type: 'pattern', category: 'delivery_question', content: 'Los clientes de fuera de León preguntan frecuentemente sobre tiempos de entrega a su ciudad.', confidence: 80, observation_count: 10 },
    { memory_type: 'pattern', category: 'objection_trend', content: 'Algunos clientes dudan de que sean realmente artesanales y piden confirmación del origen.', confidence: 65, observation_count: 5 },
    { memory_type: 'insight', category: 'customer_behavior', content: 'Los clientes que preguntan por materiales y proceso de fabricación tienen mayor tasa de conversión.', confidence: 70, observation_count: 6 },
    { memory_type: 'insight', category: 'sales_pattern', content: 'Mencionar la garantía de fabricación aumenta la confianza del cliente en la compra.', confidence: 60, observation_count: 4 },
  ]

  const { data, error } = await supabase.from('business_memory').insert(
    patterns.map(p => ({
      business_id: BUSINESS_ID,
      memory_type: p.memory_type,
      category: p.category,
      content: p.content,
      confidence: p.confidence,
      observation_count: p.observation_count,
      evidence: { source: 'conversation_analysis' },
    }))
  ).select()

  if (error) { console.error('Error seeding memory:', error); return }
  console.log(`Seeded ${data.length} business memory items.`)
}

async function seedLearningEvents() {
  const { data: existing } = await supabase.from('learning_events').select('id').eq('business_id', BUSINESS_ID).limit(1)
  if (existing && existing.length > 0) {
    console.log('Learning events already exist, skipping seed.')
    return
  }

  const corrections = [
    { original_response: 'Sí, este producto cura los hongos en las uñas.', corrected_response: 'No podemos hacer afirmaciones médicas sobre nuestros productos. Recomendamos consultar a un especialista.', correction_type: 'mistake_prevention', severity: 'critical', status: 'approved', category: 'prohibited_claim', message_id: null, knowledge_item_id: null },
    { original_response: 'El envío tarda 1 día.', corrected_response: 'El tiempo de entrega es de 3 a 5 días hábiles después de la confirmación del pedido.', correction_type: 'knowledge', severity: null, status: 'approved', category: null, message_id: null, knowledge_item_id: null },
    { original_response: 'Puedes comprar en pagos sin tarjeta.', corrected_response: 'Aceptamos PayPal, Mercado Pago y transferencia bancaria. Ofrecemos hasta 6 MSI con tarjetas participantes.', correction_type: 'rule', severity: null, status: 'approved', category: null, message_id: null, knowledge_item_id: null },
  ]

  const { data: asst } = await supabase.from('assistants').select('id').eq('business_id', BUSINESS_ID).eq('is_active', true).limit(1).single()
  if (!asst) { console.error('No assistant found'); return }

  const { data, error } = await supabase.from('learning_events').insert(
    corrections.map(c => ({
      business_id: BUSINESS_ID,
      assistant_id: asst.id,
      original_response: c.original_response,
      corrected_response: c.corrected_response,
      correction_type: c.correction_type,
      severity: c.severity,
      status: c.status,
      category: c.category,
      knowledge_change: {},
    }))
  ).select()

  if (error) { console.error('Error seeding learning events:', error); return }
  console.log(`Seeded ${data.length} learning events.`)
}

async function seedDecisions() {
  const { data: existing } = await supabase.from('business_memory').select('id').eq('business_id', BUSINESS_ID).eq('memory_type', 'decision').limit(1)
  if (existing && existing.length > 0) {
    console.log('Decisions already exist, skipping seed.')
    return
  }

  const decisions = [
    { content: 'No ofrecemos entregas en domingo. El costo operativo no compensa la demanda actual.', category: 'delivery_question', decision_priority: 'high', rationale: 'El costo de operar entregas en domingo es mayor al beneficio de conversión.' },
    { content: 'Los descuentos solo aplican en compras de mayoreo o paquetes. No descontamos productos individuales.', category: 'pricing_question', decision_priority: 'high', rationale: 'Protegemos el margen del producto individual y la percepción de valor de la marca.' },
    { content: 'No hacemos afirmaciones médicas sobre nuestros productos. Si un cliente pregunta por salud, lo derivamos.', category: 'customer_behavior', decision_priority: 'critical', rationale: 'Cumplimiento legal y protección del cliente. No somos profesionales de la salud.' },
    { content: 'Solo vendemos a través de nuestros canales oficiales (web, WhatsApp, tienda física). No tenemos distribuidores en plataformas externas.', category: 'customer_behavior', decision_priority: 'normal', rationale: 'Control de calidad en la experiencia de compra y prevención de fraudes.' },
  ]

  const { data, error } = await supabase.from('business_memory').insert(
    decisions.map(d => ({
      business_id: BUSINESS_ID,
      memory_type: 'decision',
      category: d.category,
      content: d.content,
      decision_priority: d.decision_priority,
      rationale: d.rationale,
      confidence: 90,
      observation_count: 1,
      evidence: { source: 'business_owner' },
    }))
  ).select()

  if (error) { console.error('Error seeding decisions:', error); return }
  console.log(`Seeded ${data.length} business decisions.`)
}

async function main() {
  await seedKnowledge()
  await seedMemory()
  await seedLearningEvents()
  await seedDecisions()

  console.log('\n=== VERIFICATION ===')
  const { count: kc } = await supabase.from('knowledge_items').select('*', { count: 'exact', head: true }).eq('business_id', BUSINESS_ID).eq('is_active', true) as unknown as { count: number }
  const { count: mc } = await supabase.from('business_memory').select('*', { count: 'exact', head: true }).eq('business_id', BUSINESS_ID).eq('is_active', true) as unknown as { count: number }
  const { count: lc } = await supabase.from('learning_events').select('*', { count: 'exact', head: true }).eq('business_id', BUSINESS_ID) as unknown as { count: number }
  const { count: dc } = await supabase.from('business_memory').select('*', { count: 'exact', head: true }).eq('business_id', BUSINESS_ID).eq('memory_type', 'decision').eq('is_active', true) as unknown as { count: number }
  
  console.log(`Knowledge items: ${kc}`)
  console.log(`Business memory: ${mc} (${dc} decisions)`)
  console.log(`Learning events: ${lc}`)
}

main().catch(console.error)
