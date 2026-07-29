import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const BIZ = '0d40a769-7a21-4cb3-9472-bdc9638675d6'
const ASST = '132732af-030c-4d82-9e1d-5f0ae214ac38'

const TRAINING_CONVERSATIONS = [
  {
    mode: 'normal' as const,
    title: 'Consulta Clean Nails',
    messages: [
      { role: 'user' as const, content: 'Hola, me interesa Clean Nails. ¿Cómo funciona y qué precio tiene?' },
      { role: 'assistant' as const, content: '¡Hola! Claro, con gusto te explico. Clean Nails es un dispositivo de luz UV diseñado para apoyar el cuidado de uñas afectadas por hongos. Tiene un precio de $599. Se usa en casa, es muy sencillo: solo mantén la uña limpia y seca, y sigue las sesiones indicadas. Eso sí, los resultados requieren constancia, ya que la uña crece desde la raíz de forma gradual. ¿Te gustaría saber algo más en particular?' },
      { role: 'user' as const, content: '¿Cuánto tiempo se tarda en ver resultados?' },
      { role: 'assistant' as const, content: 'El tiempo puede variar según cada persona, pero los cambios en la apariencia de la uña son graduales porque acompañan el crecimiento natural. Lo importante es mantener una rutina constante. Muchos de nuestros clientes notan mejoras con el uso continuo. Si tienes dudas específicas, puedo orientarte con más detalle. ¿Te gustaría apartar uno?' },
    ],
  },
  {
    mode: 'normal' as const,
    title: 'Paquete Back2Fit + Bye Canas',
    messages: [
      { role: 'user' as const, content: '¿Me puedes decir cuánto cuesta el paquete de 2 Back2Fit?' },
      { role: 'assistant' as const, content: '¡Claro! El Back2Fit tiene un precio de $499 por pieza. En paquete de 2 piezas tiene un ahorro aproximado del 20%, quedando en $798. Es un chaleco moldeador de compresión abdominal para hombre que se usa discreto debajo de la ropa. Te ayuda a disimular visualmente el abdomen y brinda soporte lumbar. ¿Te gustaría aprovechar el paquete?' },
      { role: 'user' as const, content: 'Sí, me interesa. También quiero Bye Canas. ¿También tiene paquete?' },
      { role: 'assistant' as const, content: '¡Qué bien! Sí, Bye Canas también tiene paquete. Individual está en $499, y el paquete de 2 piezas en $798. Si llevas más de 3 piezas combinadas, aplica un 35% de descuento sobre el precio base. Déjame confirmarte: ¿quieres que te ayude a armarte la mejor promoción? Recuerda que el envío es gratis y puedes pagar contra entrega.' },
    ],
  },
  {
    mode: 'indecisive' as const,
    title: 'Duda Neurofeet vs Neurotin',
    messages: [
      { role: 'user' as const, content: 'Estoy entre Neurofeet y Neurotin, no sé cuál me conviene más.' },
      { role: 'assistant' as const, content: 'Entiendo, puede ser confuso. Déjame ayudarte. Neurofeet son calcetines de compresión graduada hasta debajo de la rodilla, ideales si sientes cansancio o pesadez en las piernas durante el día. Neurotin es un calcetín corto abierto de la punta, da soporte localizado en pie y tobillo. La elección depende de dónde sientas la necesidad. ¿En qué zona sientes más molestia o cansancio?' },
      { role: 'user' as const, content: 'Es más en las piernas, al final del día me pesan mucho.' },
      { role: 'assistant' as const, content: 'Entonces Neurofeet sería la opción más adecuada para ti. Proporcionan compresión graduada que ayuda justo con esa sensación de pesadez. Tenemos presentación de 3 pares en $449 o 5 pares en $599. Ambas con envío gratis y pago contra entrega. ¿Qué presentación te llama más la atención?' },
      { role: 'user' as const, content: 'No sé si realmente funcione...' },
      { role: 'assistant' as const, content: 'Es una duda muy válida. La compresión graduada tiene soporte comprobado para ayudar a disminuir la sensación de cansancio y pesadez en las piernas. Muchos de nuestros clientes nos comentan que notan la diferencia después de usarlos durante el día, especialmente si pasan mucho tiempo de pie o sentados. Te recomendaría probarlos, no pierdes nada con intentarlo y tenemos opciones accesibles. ¿Te gustaría probar el paquete de 3 pares?' },
    ],
  },
  {
    mode: 'difficult' as const,
    title: 'Objeción precio Bella Patch',
    messages: [
      { role: 'user' as const, content: '$499 por 60 tiras me parece caro. ¿Por qué tan caro?' },
      { role: 'assistant' as const, content: 'Entiendo tu punto. Las Bella Patch son tiras tensoras faciales invisibles diseñadas para dar un efecto lifting temporal de forma discreta. Cada paquete trae 60 tiras, que alcanzan para aproximadamente 30 puestas completas. Son muy delgadas y se integran con maquillaje, ideales para eventos u ocasiones especiales. Si lo ves por uso, cada aplicación sale como en $16.60, que comparado con un tratamiento estético profesional, es mucho más accesible.' },
      { role: 'user' as const, content: 'Hmm, sigo pensando que es caro para unas tiras.' },
      { role: 'assistant' as const, content: 'Entiendo perfectamente, es importante sentirse segura de la compra. Déjame preguntarte, ¿piensas usarlas para alguna ocasión en especial? Muchas clientas las usan para bodas, eventos o sesiones de fotos justamente por el efecto natural que dan. Además, el envío es gratis y puedes pagar contra entrega, así que no arriesgas nada. Si no te convencen, siempre puedes devolverlas. ¿Te gustaría intentarlo?' },
      { role: 'user' as const, content: 'Está bien, lo voy a pensar.' },
      { role: 'assistant' as const, content: 'Claro, tómate tu tiempo. Si gustas, puedo dejarte la información para cuando decidas. Recuerda que estoy aquí para ayudarte cuando gustes. ¿Te parece si te tomo tus datos para cuando te decidas?' },
    ],
  },
  {
    mode: 'critical' as const,
    title: 'Entrega urgente fuera de zona',
    messages: [
      { role: 'user' as const, content: 'Necesito Clean Nails para ayer, ¿lo puedes enviar hoy mismo a Morelia?' },
      { role: 'assistant' as const, content: 'Entiendo la urgencia, lamento la situación. Déjame comentarte que actualmente manejamos entregas en León, Lagos de Moreno, Irapuato, Silao y Guanajuato Capital. Morelia no está dentro de nuestras zonas de cobertura. No podría confirmarte una entrega para esa ciudad porque no tenemos rutas asignadas aún. ¿Te encuentras en Morelia o podría algún conocido recibirlo en alguna de nuestras zonas?' },
      { role: 'user' as const, content: 'Estoy en Morelia y no conozco a nadie en esas ciudades.' },
      { role: 'assistant' as const, content: 'Comprendo, es una situación difícil. Por el momento no puedo generar una orden de entrega fuera de nuestras zonas autorizadas. Lo que te recomiendo es que si en algún momento visitas León o alguna de las zonas donde entregamos, puedo tomarte tu pedido y tenerlo listo para cuando vengas. Lamento no tener una mejor opción ahora. ¿Hay algo más en lo que pueda ayudarte?' },
    ],
  },
]

async function main() {
  console.log('=== CREATING TRAINING SIMULATIONS ===\n')

  // Create a training customer
  const { data: customer } = await supabase
    .from('customers')
    .insert({ business_id: BIZ, name: 'Cliente de Prueba', phone: '000-000-0000', status: 'new' })
    .select()
    .single()

  for (const conv of TRAINING_CONVERSATIONS) {
    // 1. Create a conversation
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .insert({
        assistant_id: ASST,
        customer_id: customer!.id,
        type: 'training',
        status: 'active',
      })
      .select()
      .single()
    if (convErr) { console.error(`❌ Conversation error: ${convErr.message}`); continue }

    // 2. Insert messages
    const { error: msgErr } = await supabase
      .from('messages')
      .insert(
        conv.messages.map((m, i) => ({
          conversation_id: conversation.id,
          role: m.role,
          content: m.content,
          created_at: new Date(Date.now() - (conv.messages.length - i) * 60000).toISOString(),
        }))
      )
    if (msgErr) { console.error(`❌ Messages error: ${msgErr.message}`); continue }

    // 3. Create lab session
    const { data: session, error: sessErr } = await supabase
      .from('lab_sessions')
      .insert({
        business_id: BIZ,
        assistant_id: ASST,
        mode: conv.mode,
        title: conv.title,
        conversation_id: conversation.id,
      })
      .select()
      .single()
    if (sessErr) { console.error(`❌ Session error: ${sessErr.message}`); continue }

    // 4. Evaluate via OpenAI
    const conversationText = conv.messages
      .map(m => `${m.role === 'user' ? 'Cliente' : 'MIA'}: ${m.content}`)
      .join('\n\n')

    const evalResult = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Evalúa esta conversación de ventas y responde SOLO con JSON:
{
  "score": <1-10>,
  "criteria": { "product_knowledge": <1-10>, "empathy": <1-10>, "objection_handling": <1-10>, "closing": <1-10>, "rule_following": <1-10> },
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestions": ["..."]
}`
        },
        {
          role: 'user',
          content: `Negocio: Vitanova\nMIA es una asistente de ventas.\n\nConversación:\n${conversationText}`
        }
      ],
      temperature: 0.3,
    })

    const evalText = evalResult.choices[0].message.content!
    const evaluation = JSON.parse(evalText.replace(/```json?/gi, '').replace(/```/g, '').trim())

    // 5. Update session with results
    const { error: updErr } = await supabase
      .from('lab_sessions')
      .update({
        status: 'completed',
        score: evaluation.score,
        criteria: evaluation.criteria,
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        suggestions: evaluation.suggestions,
        evaluation_model: 'gpt-4o-mini',
        message_count: conv.messages.length,
      })
      .eq('id', session.id)
    if (updErr) { console.error(`❌ Update error: ${updErr.message}`); continue }

    console.log(`✅ ${conv.title} (${conv.mode}) → score: ${evaluation.score}/10`)
  }

  console.log('\n=== DONE ===')
}

main().catch(console.error)
