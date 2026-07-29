import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BIZ_ID = '0d40a769-7a21-4cb3-9472-bdc9638675d6'

const items = [
  { business_id: BIZ_ID, category: 'faq', question: '¿Qué es Vitanova?', answer: 'Vitanova brinda soluciones para el bienestar mediante productos prácticos para uso en casa. Buscamos orientar al cliente y generar confianza antes que simplemente vender.', source: 'manual', confidence: 'high', is_active: true },
  { business_id: BIZ_ID, category: 'faq', question: '¿Cómo sé qué producto necesito?', answer: 'Cuéntame un poco más sobre lo que te gustaría tratar o mejorar y con gusto te orientaré sobre cuál de nuestros productos puede ser la mejor opción para ti.', source: 'manual', confidence: 'high', is_active: true },
  { business_id: BIZ_ID, category: 'faq', question: '¿Cuál es el plazo de entrega?', answer: 'Las entregas se realizan según las rutas programadas por zona. León: todos los días. Lagos de Moreno: martes, jueves y sábado. Irapuato, Silao y Guanajuato Capital: lunes, miércoles y viernes.', source: 'manual', confidence: 'high', is_active: true },
  { business_id: BIZ_ID, category: 'faq', question: '¿El envío es gratis?', answer: 'Sí, todos nuestros productos incluyen envío gratis. Además, puedes pagar contra entrega.', source: 'manual', confidence: 'high', is_active: true },
  { business_id: BIZ_ID, category: 'faq', question: '¿Cómo puedo pagar?', answer: 'Aceptamos pago contra entrega. Pagas hasta que recibes tu pedido.', source: 'manual', confidence: 'high', is_active: true },
  { business_id: BIZ_ID, category: 'objection', question: '¿Realmente funciona Clean Nails?', answer: 'Clean Nails está diseñado para apoyar el cuidado de las uñas mediante terapia de luz. Los resultados dependen de la constancia y el proceso natural de crecimiento de la uña.', source: 'manual', confidence: 'high', is_active: true },
  { business_id: BIZ_ID, category: 'objection', question: '¿No es caro?', answer: 'Nuestros productos tienen precios accesibles y ofrecemos paquetes con descuento. 2 piezas ~20% ahorro, 3 piezas hasta ~30%.', source: 'manual', confidence: 'high', is_active: true },
  { business_id: BIZ_ID, category: 'objection', question: '¿Tengo que comprar algo adicional?', answer: 'No, nuestros productos vienen completos y listos para usar. No requieres accesorios adicionales.', source: 'manual', confidence: 'high', is_active: true },
  { business_id: BIZ_ID, category: 'business_info', question: '¿Cuál es la filosofía de Vitanova?', answer: 'Escuchar primero, comprender el problema, recomendar con honestidad, evitar exageraciones, mantener trato respetuoso. Valores: honestidad, empatía, claridad, profesionalismo.', source: 'manual', confidence: 'high', is_active: true },
  { business_id: BIZ_ID, category: 'business_info', question: '¿Quién es MIA?', answer: 'MIA es la asesora virtual de Vitanova. Su función es ayudar a los clientes a encontrar el producto adecuado, resolver dudas, brindar información clara y acompañarlos durante todo el proceso de compra.', source: 'manual', confidence: 'high', is_active: true },
  { business_id: BIZ_ID, category: 'tip', question: '¿Cómo debo usar Clean Nails?', answer: 'Mantén la uña limpia y seca antes de usar el dispositivo. Retira esmalte si existe. La constancia es clave. Los cambios son graduales porque la uña crece desde la raíz.', source: 'manual', confidence: 'high', is_active: true },
  { business_id: BIZ_ID, category: 'tip', question: '¿Cómo elijo la talla de Neurofeet?', answer: 'Depende del número de calzado y el contorno de pantorrilla. Mide la parte más ancha de la pantorrilla y compárala con la tabla de tallas. Debe sentirse firme pero cómodo.', source: 'manual', confidence: 'high', is_active: true },
]

async function main() {
  const { error } = await supabase.from('knowledge_items').insert(items)
  if (error) { console.error('Insert error:', error.message); process.exit(1) }
  console.log('✅', items.length, 'knowledge items inserted')
}
main()
