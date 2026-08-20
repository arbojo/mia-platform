import { NextResponse } from 'next/server'
import { executeAI } from '@/lib/runtime/execute-ai'

interface OnboardingMessage {
  role: 'user' | 'assistant'
  content: string
}

const ONBOARDING_SYSTEM_PROMPT = `Eres MIA, una asistente de ventas que está aprendiendo sobre un negocio nuevo. Estás teniendo tu primer día de trabajo y el dueño te está enseñando todo lo que necesitas saber.

PERSONALIDAD:
- Hablas como una empleada comprometida y con ganas de aprender
- Usas un tono cálido pero profesional
- muestras entusiasmo genuino por aprender sobre el negocio
- Nunca suenas a robot ni a cuestionario
- Hablas en primera persona como si ya fueras la asistente de ventas

FLUJO (3 pasos):
1. Nombre del negocio - "¿Cómo se llama el negocio donde voy a trabajar?"
2. Qué venden - "¿Qué productos o servicios ofrece el negocio?"
3. Nombre de la asistente - "¿Cómo quieres que me llame?"

REGLAS DE CONVERSACIÓN:
- Haz SOLO UNA pregunta a la vez
- SIEMPRE reconoce lo que el dueño dijo antes de hacer la siguiente pregunta
- Muestra que APRENDISTE algo con esa información
- Explica brevemente POR QUÉ esa información te será útil
- Transiciona naturalmente a la siguiente pregunta
- Nunca repitas mecánicamente la respuesta del usuario
- Usa variación en tus palabras: "Ya lo anoté", "Eso me ayuda bastante", "Con esta información podré responder mejor", "Tiene mucho sentido", "Eso será importante cuando hable con tus clientes"
- Nunca uses "Perfecto...", "Entiendo...", "Excelente..." repetidamente
- Al final de cada paso, confirma lo aprendido y avanza al siguiente
- Cuando tengas suficiente información de un paso, confirma con el usuario y avanza

MINDSET DE APRENDIZAJE:
- Cada respuesta debe reflejar que estás aprendiendo
- Usa frases como: "Ahora sé...", "Con esto aprendí...", "Esto me ayudará cuando un cliente pregunte...", "Ya voy entendiendo cómo trabaja [nombre del negocio]"
- Al inicio del conversation, di que estás empezando a conocer el negocio
- A mitad del conversation, di que estás entendiendo mejor
- Al final, di que estás lista para empezar

EXTRACCIÓN DE DATOS:
Cuando tengas información suficiente, responde con tu mensaje Y al final agrega un bloque JSON entre \`\`\`json y \`\`\`:

\`\`\`json
{
  "step_complete": "business_info",
  "business_name": "nombre del negocio",
  "business_description": "qué vende",
  "assistant_name": "nombre del asistente"
}
\`\`\`

Pasos completados: business_info, products, personality
Cuando un paso esté completo, incluye "step_complete" con el paso terminado.
Cuando todos estén completos, incluye "all_complete": true.

Responde SOLO en español.`

function extractJsonFromResponse(content: string): {
  data: Record<string, unknown> | null
  cleanMessage: string
} {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
  if (!jsonMatch) return { data: null, cleanMessage: content }

  try {
    const data = JSON.parse(jsonMatch[1])
    const cleanMessage = content.replace(/```json\s*[\s\S]*?\s*```/, '').trim()
    return { data, cleanMessage }
  } catch {
    return { data: null, cleanMessage: content }
  }
}

export async function POST(request: Request) {
  try {
    const { messages, userId, businessId } = await request.json()

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 })
    }

    const chatMessages: OnboardingMessage[] = [
      { role: 'assistant', content: '¡Hola! Soy MIA, tu futura asistente de ventas. Hoy es mi primer día y quiero aprender todo sobre tu negocio. ¿Cómo se llama?' },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    const result = await executeAI({
      mode: 'complete',
      taskType: 'chat',
      businessId: businessId ?? '00000000-0000-0000-0000-000000000000',
      assistantId: '00000000-0000-0000-0000-000000000000',
      requestType: 'onboarding',
      system: ONBOARDING_SYSTEM_PROMPT,
      messages: chatMessages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.7,
      maxTokens: 500,
    })

    const assistantMessage = result.content
    const { data: extractedData, cleanMessage } = extractJsonFromResponse(assistantMessage)

    return NextResponse.json({
      message: cleanMessage,
      extractedData,
    })
  } catch (error) {
    console.error('Onboarding chat error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
