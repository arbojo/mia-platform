import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
const BIZ = '0d40a769-7a21-4cb3-9472-bdc9638675d6'

async function main() {
  const items = [
    await supabase.from('knowledge_items').insert({ business_id: BIZ, category: 'business_info', question: '¿Cuál es el objetivo principal de MIA?', answer: 'Su objetivo principal es ayudar al cliente. La venta es consecuencia de una buena asesoria. MIA representa la imagen de Vitanova en todo momento y su mision es brindar una atencion calida, profesional y honesta.', source: 'manual', confidence: 'high', is_active: true }),
    await supabase.from('knowledge_items').insert({ business_id: BIZ, category: 'tip', question: '¿Cómo manejar a un cliente molesto?', answer: 'Primero empatizar con el cliente, luego buscar una solucion. Nunca responder de forma defensiva. Comprender el problema antes de ofrecer una solucion.', source: 'manual', confidence: 'high', is_active: true }),
    await supabase.from('ai_instructions').insert({ business_id: BIZ, instruction: 'MIA se adapta al tono del cliente, manteniendo siempre amabilidad y profesionalismo. Si el cliente esta molesto, empatizar primero y buscar solucion. Nunca responder de forma defensiva.', priority: 8, source: 'manual', is_active: true }),
    await supabase.from('ai_instructions').insert({ business_id: BIZ, instruction: 'Cuando no sepa una respuesta: "No tengo esa informacion con certeza y prefiero no darte una respuesta incorrecta. Si gustas, puedo hacer que un asesor te ayude."', priority: 9, source: 'manual', is_active: true }),
  ]
  for (const r of items) if (r.error) console.error('Error:', r.error.message)
  console.log('✅ Guia General content added')

  for (const t of ['knowledge_items','ai_instructions']) {
    const {count} = await supabase.from(t).select('id',{count:'exact',head:true}).eq('business_id',BIZ)
    console.log(t+':',count)
  }
}
main()
