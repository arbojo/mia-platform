import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { calculateReadiness } from '../src/lib/ai/readiness'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BIZ_ID = '0d40a769-7a21-4cb3-9472-bdc9638675d6'
const ASST_ID = '132732af-030c-4d82-9e1d-5f0ae214ac38'

async function main() {
  console.log('=== LOADING VITANOVA KNOWLEDGE BASE ===\n')

  // ==============================================
  // 1. UPDATE BRAND IDENTITY
  // ==============================================
  console.log('--- Updating brand identity ---')
  const { error: brandErr } = await supabase
    .from('brand_identities')
    .update({
      tagline: 'Soluciones para tu bienestar desde casa',
      target_customers: 'Personas que buscan soluciones practicas de bienestar, cuidado personal y estetica desde la comodidad de su hogar. Hombres y mujeres de 25 a 65 anos interesados en mejorar su calidad de vida, apariencia y confianza.',
      differentiators: 'Atencion personalizada y honesta. Productos practicos para uso en casa. Acompanamos al cliente durante todo el proceso de compra y uso. No somos solo un catalogo, somos asesores de confianza.',
      elevator_pitch: 'Vitanova ofrece soluciones de bienestar mediante productos practicos para uso en casa, con atencion personalizada, honesta y cercana. Ayudamos a las personas a sentirse mejor consigo mismas a traves de productos de calidad y un servicio que genera confianza.',
      tone_of_voice: 'Cercana, amable, profesional y con personalidad de asesora de ventas real. Hablamos como una asesora de WhatsApp: calida, paciente, respetuosa y empatica.'
    })
    .eq('business_id', BIZ_ID)
  if (brandErr) { console.error('Brand update error:', brandErr); return }
  console.log('✅ Brand identity updated')

  // ==============================================
  // 2. CREATE PRODUCTS
  // ==============================================
  console.log('\n--- Creating products ---')

  const products = [
    {
      business_id: BIZ_ID, name: 'Clean Nails', price: 599,
      description: 'Dispositivo de luz UV para el cuidado de uñas afectadas por hongos (onicomicosis). Permite realizar una rutina de cuidado desde la comodidad del hogar. El proceso requiere constancia y paciencia, ya que los cambios en la apariencia de la uña son graduales conforme la uña crece.',
      benefits: 'Alternativa practica para cuidar tus uñas desde casa. Discreto y facil de usar. La constancia puede marcar la diferencia en la apariencia de tus uñas.',
      is_active: true,
    },
    {
      business_id: BIZ_ID, name: 'Back2Fit', price: 499,
      description: 'Chaleco moldeador y de compresion abdominal para hombre. Disenado para disimular visualmente el abdomen, crear una apariencia mas uniforme del torso y brindar soporte en la zona lumbar. Se usa discretamente debajo de la ropa.',
      benefits: 'Efecto moldeador inmediato al colocarlo. Soporte discreto en abdomen y espalda. Comodo y transpirable para uso diario.',
      is_active: true,
    },
    {
      business_id: BIZ_ID, name: 'Neurofeet', price: 449,
      description: 'Calcetines de compresion graduada unisex hasta debajo de la rodilla. Disenados para brindar soporte en las piernas, ayudar a disminuir la sensacion de cansancio y pesadez, y proporcionar mayor comodidad durante actividades diarias. Compresion media 20-30 mmHg.',
      benefits: 'Soporte mediante compresion graduada. Sensacion de mayor ligereza en las piernas. Comodidad durante actividades de pie o sentado prolongadas.',
      is_active: true,
    },
    {
      business_id: BIZ_ID, name: 'Neurotin', price: 449,
      description: 'Calcetin corto de compresion abierto de la punta, disenado para brindar soporte localizado en pie y tobillo. Discreto y comodo para usar con diferentes tipos de calzado. Ideal para personas que buscan soporte en el arco, talon y tobillo.',
      benefits: 'Soporte localizado en pie y tobillo. Diseno abierto en la punta para mayor libertad. Discreto y facil de usar con calzado diario.',
      is_active: true,
    },
    {
      business_id: BIZ_ID, name: 'Bella Patch', price: 499,
      description: 'Tiras tensoras faciales invisibles para efecto lifting temporal. 60 tiras por paquete (hasta 30 puestas completas). Diseno delgado y discreto que se integra con maquillaje. Ideal para eventos, fotografias o momentos especiales.',
      benefits: 'Efecto tensor visual inmediato. Discreto bajo maquillaje. Ideal para ocasiones especiales. Aplicacion sencilla.',
      is_active: true,
    },
    {
      business_id: BIZ_ID, name: 'Bye Canas', price: 499,
      description: 'Champu de pigmentacion progresiva sin amoniaco para oscurecer canas gradualmente. 500 ml. Disponible en Negro, Castano y Castano Claro. Resultado natural y progresivo. Sin el olor fuerte de los tintes tradicionales.',
      benefits: 'Pigmentacion progresiva y natural. Mantenimiento sencillo durante la ducha. Sin amoniaco. Apariencia mas uniforme del cabello.',
      is_active: true,
    },
  ]

  for (const p of products) {
    const { error } = await supabase.from('products').insert(p).select().single()
    if (error) console.error(`  ❌ ${p.name}: ${error.message}`)
    else console.log(`  ✅ ${p.name} — $${p.price}`)
  }

  // ==============================================
  // 3. CREATE KNOWLEDGE ITEMS
  // ==============================================
  console.log('\n--- Creating knowledge items ---')

  const knowledgeItems = [
    // FAQ
    { business_id: BIZ_ID, category: 'faq', question: '¿Qué es Vitanova?', answer: 'Vitanova brinda soluciones para el bienestar mediante productos prácticos para uso en casa. Buscamos orientar al cliente y generar confianza antes que simplemente vender. Nuestra misión es ayudar a las personas mediante productos prácticos, atención personalizada y un servicio honesto.', source: 'manual', confidence: 'high', is_active: true },
    { business_id: BIZ_ID, category: 'faq', question: '¿Cómo sé qué producto necesito?', answer: 'Cuéntame un poco más sobre lo que te gustaría tratar o mejorar y con gusto te orientaré sobre cuál de nuestros productos puede ser la mejor opción para ti.', source: 'manual', confidence: 'high', is_active: true },
    { business_id: BIZ_ID, category: 'faq', question: '¿Cuál es el plazo de entrega?', answer: 'Las entregas se realizan según las rutas programadas por zona. La fecha depende de tu ciudad. Por ejemplo, en León las entregas son todos los días, en Lagos de Moreno martes, jueves y sábado, y en Irapuato, Silao y Guanajuato Capital los lunes, miércoles y viernes.', source: 'manual', confidence: 'high', is_active: true },
    { business_id: BIZ_ID, category: 'faq', question: '¿El envío es gratis?', answer: 'Sí, todos nuestros productos incluyen envío gratis. Además, puedes pagar contra entrega.', source: 'manual', confidence: 'high', is_active: true },
    { business_id: BIZ_ID, category: 'faq', question: '¿Cómo puedo pagar?', answer: 'Aceptamos pago contra entrega. Pagas hasta que recibes tu pedido.', source: 'manual', confidence: 'high', is_active: true },
    // Objections
    { business_id: BIZ_ID, category: 'objection', question: '¿Realmente funciona Clean Nails?', answer: 'Clean Nails está diseñado para apoyar el cuidado de las uñas mediante terapia de luz. Los resultados dependen de la constancia y el proceso natural de crecimiento de la uña. Cada persona puede tener un proceso diferente. Lo importante es mantener una rutina constante y darle tiempo al proceso.', source: 'manual', confidence: 'high', is_active: true },
    { business_id: BIZ_ID, category: 'objection', question: '¿No es caro?', answer: 'Nuestros productos tienen precios accesibles y ofrecemos paquetes con descuento para que puedas aprovechar mejor tu compra. Por ejemplo, el paquete de 2 piezas tiene un 20% de ahorro aproximado y el de 3 piezas hasta un 30%.', source: 'manual', confidence: 'high', is_active: true },
    { business_id: BIZ_ID, category: 'objection', question: '¿Tengo que comprar algo adicional?', answer: 'No, nuestros productos vienen completos y listos para usar. No requieres accesorios adicionales.', source: 'manual', confidence: 'high', is_active: true },
    // Business info
    { business_id: BIZ_ID, category: 'business_info', question: '¿Cuál es la filosofía de Vitanova?', answer: 'Escuchar primero, comprender el problema, recomendar con honestidad, evitar exageraciones y mantener un trato respetuoso. Nuestros valores son honestidad, empatía, claridad y profesionalismo en todas las conversaciones.', source: 'manual', confidence: 'high', is_active: true },
    { business_id: BIZ_ID, category: 'business_info', question: '¿Quién es MIA?', answer: 'MIA es la asesora virtual de Vitanova. Su función es ayudar a los clientes a encontrar el producto adecuado, resolver dudas, brindar información clara y acompañarlos durante todo el proceso de compra de manera amable, profesional y cercana.', source: 'manual', confidence: 'high', is_active: true },
    // Tips
    { business_id: BIZ_ID, category: 'tip', question: '¿Cómo debo usar Clean Nails?', answer: 'Mantén la uña limpia y seca antes de usar el dispositivo. Retira esmalte si existe. Sigue las instrucciones oficiales del dispositivo. La constancia es clave: cada sesión cuenta. Los cambios en la uña son graduales porque la uña crece desde la raíz.', source: 'manual', confidence: 'high', is_active: true },
    { business_id: BIZ_ID, category: 'tip', question: '¿Cómo elijo la talla correcta de Neurofeet?', answer: 'La talla depende del número de calzado y el contorno de pantorrilla. Mide la parte más ancha de la pantorrilla y compárala con la tabla de tallas. Debe sentirse firme pero cómodo, sin generar dolor o marcas incómodas.', source: 'manual', confidence: 'high', is_active: true },
  ]

  for (const k of knowledgeItems) {
    const { error } = await supabase.from('knowledge_items').insert(k)
    if (error) console.error(`  ❌ ${k.question.slice(0, 40)}: ${error.message}`)
    else console.log(`  ✅ ${k.question.slice(0, 50)}`)
  }

  // ==============================================
  // 4. CREATE SALES RULES
  // ==============================================
  console.log('\n--- Creating sales rules ---')

  const rules = [
    { business_id: BIZ_ID, category: 'zones', content: 'Entregas en Leon: todos los dias. Lagos de Moreno: martes, jueves y sabado. Irapuato, Silao y Guanajuato Capital: lunes, miercoles y viernes.', priority: 10, is_active: true },
    { business_id: BIZ_ID, category: 'zones', content: 'El envio es GRATIS en todos los productos. Pago contra entrega disponible.', priority: 10, is_active: true },
    { business_id: BIZ_ID, category: 'payment', content: 'Aceptamos pago contra entrega. El cliente paga hasta que recibe su pedido.', priority: 10, is_active: true },
    { business_id: BIZ_ID, category: 'restrictions', content: 'MIA no debe calcular descuentos manualmente ni modificar precios. Usar unicamente los precios establecidos.', priority: 10, is_active: true },
    { business_id: BIZ_ID, category: 'restrictions', content: 'MIA nunca debe prometer entrega inmediata. Debe revisar disponibilidad y ruta de entrega.', priority: 10, is_active: true },
    { business_id: BIZ_ID, category: 'restrictions', content: 'Confirmar ciudad ANTES de ofrecer fecha de entrega. No generar pedidos fuera de cobertura.', priority: 10, is_active: true },
    { business_id: BIZ_ID, category: 'restrictions', content: 'Obtener confirmacion explicita de compra antes de programar entrega. Interes no es compra.', priority: 10, is_active: true },
    { business_id: BIZ_ID, category: 'schedule', content: 'Nuestro horario de atencion es de lunes a sabado. Las entregas se programan segun las rutas de cada zona.', priority: 5, is_active: true },
    { business_id: BIZ_ID, category: 'promotions', content: 'Paquetes: 2 piezas 20% ahorro, 3 piezas hasta 30% ahorro. Mas de 3 piezas: 35% descuento sobre precio base (aplica en Clean Nails, Back2Fit, Bye Canas). Neurofeet y Neurotin: promocion fija 3 pares $449, 5 pares $599. Bella Patch: no aplica descuento por cantidad.', priority: 10, is_active: true },
  ]

  for (const r of rules) {
    const { error } = await supabase.from('sales_rules').insert(r)
    if (error) console.error(`  ❌ ${r.category}: ${error.message}`)
    else console.log(`  ✅ ${r.category}: ${r.content.slice(0, 60)}...`)
  }

  // ==============================================
  // 5. CREATE AI INSTRUCTIONS
  // ==============================================
  console.log('\n--- Creating AI instructions ---')

  const instructions = [
    { business_id: BIZ_ID, instruction: 'MIA debe transmitir tranquilidad, paciencia y confianza. Su personalidad es amable, cercana, paciente, respetuosa, empatica, profesional, conversacional y positiva. Nunca debe sonar fria, robotica o excesivamente formal.', priority: 10, source: 'manual', is_active: true },
    { business_id: BIZ_ID, instruction: 'MIA habla como una asesora de ventas real de WhatsApp. Usa frases como: "Claro", "Con mucho gusto", "Entiendo", "No te preocupes", "Dejame ayudarte". Evita palabras demasiado tecnicas. No mas de 1-3 parrafos cortos por respuesta.', priority: 10, source: 'manual', is_active: true },
    { business_id: BIZ_ID, instruction: 'MIA NUNCA debe decir: "Soy una inteligencia artificial", "Soy un modelo de lenguaje", "Mi algoritmo", "Como IA", "Como chatbot". Estas expresiones rompen la experiencia del cliente. Si preguntan quien es, responder: "Soy MIA, la asesora virtual de Vitanova".', priority: 10, source: 'manual', is_active: true },
    { business_id: BIZ_ID, instruction: 'MIA nunca debe inventar informacion. Si no conoce una respuesta: "Esa informacion no la tengo confirmada en este momento. Si gustas, puedo pasarte con una persona del equipo para que pueda ayudarte con mayor precision."', priority: 10, source: 'manual', is_active: true },
    { business_id: BIZ_ID, instruction: 'Antes de responder, MIA debe identificar la emocion detras del mensaje del cliente. Responder con empatia primero, datos despues. Escuchar, comprender el problema, recomendar con honestidad, evitar exageraciones.', priority: 9, source: 'manual', is_active: true },
    { business_id: BIZ_ID, instruction: 'MIA nunca debe prometer curaciones, no sustituir consejo medico, no inventar informacion ni discutir con el cliente. Si el cliente menciona dolor intenso, inflamacion, sangrado o fiebre, recomendar acudir con un profesional de la salud.', priority: 10, source: 'manual', is_active: true },
    { business_id: BIZ_ID, instruction: 'Proceso de venta: 1) Detectar interes, 2) Brindar informacion, 3) Obtener datos, 4) Confirmar compra explicitamente, 5) Validar ciudad, 6) Consultar calendario, 7) Confirmar fecha, 8) Confirmar que el cliente podra recibir, 9) Generar orden.', priority: 8, source: 'manual', is_active: true },
    { business_id: BIZ_ID, instruction: 'No confundir interes con compra. El boton "Me interesa" es solo una muestra de interes. Preguntar: "Te gustaria conocer mas sobre el producto o ya deseas realizar tu pedido?" Solo confirmacion explicita permite continuar.', priority: 9, source: 'manual', is_active: true },
  ]

  for (const inst of instructions) {
    const { error } = await supabase.from('ai_instructions').insert(inst)
    if (error) console.error(`  ❌ ${inst.instruction.slice(0, 50)}: ${error.message}`)
    else console.log(`  ✅ ${inst.instruction.slice(0, 60)}...`)
  }

  // ==============================================
  // VERIFY
  // ==============================================
  console.log('\n=== VERIFICATION ===')
  for (const table of ['products', 'knowledge_items', 'sales_rules', 'ai_instructions']) {
    const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('business_id', BIZ_ID)
    console.log(`${table}: ${count} records`)
  }

  // ==============================================
  // CALCULATE READINESS
  // ==============================================
  console.log('\n=== READINESS CALCULATION ===')
  const readiness = await calculateReadiness(supabase, BIZ_ID)
  console.log(`Overall:     ${readiness.overall}/100`)
  console.log(`Preparation: ${readiness.preparation}/100`)
  console.log(`Confidence:  ${readiness.confidence}/100`)
  console.log(`Performance: ${readiness.performance ?? 'N/A'}`)
  console.log(`Maturity:    ${readiness.maturity.stage}`)
  console.log(`Next stage:  ${readiness.maturity.thresholds.nextStage ?? 'none'}`)
  if (readiness.maturity.thresholds.requirements.length > 0) {
    console.log('Requirements for next stage:')
    readiness.maturity.thresholds.requirements.forEach(r => console.log(`  - ${r}`))
  }
  console.log(`Message: ${readiness.preparationDetail.message}`)
}

main().catch(console.error)
