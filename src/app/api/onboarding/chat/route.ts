import { NextResponse } from 'next/server'
import { getOpenAIClient, MODEL } from '@/lib/ai/client'
import { recordAiUsage } from '@/lib/ai/knowledge'

interface OnboardingMessage {
  role: 'user' | 'assistant'
  content: string
}

const ONBOARDING_SYSTEM_PROMPT = `Eres MIA, una asistente de configuración de negocios. Tu objetivo es ayudar al dueño de un negocio a configurar su asistente de ventas.

FLUJO:
1. Primero pregunta el nombre del negocio
2. Luego pregunta qué vende (productos/servicios)
3. Pregunta quiénes son sus clientes
4. Pregunta qué lo diferencia de la competencia
5. Pregunta si tiene reglas importantes (envíos, pagos, horarios)
6. Finalmente pregunta cómo quiere llamar a su asistente

REGLAS:
- Haz UNA pregunta a la vez
- Sé breve y amable
- Cuando tengas suficiente información de un paso, confirma con el usuario y avanza al siguiente
- No uses jerga técnica (nada de "prompts", "embeddings", "APIs")
- Al final, confirma TODA la información antes de crear el negocio

EXTRACCIÓN DE DATOS:
Cuando tengas información suficiente, responde con tu mensaje Y al final agrega un bloque JSON entre \`\`\`json y \`\`\`:

\`\`\`json
{
  "step_complete": "business_info",
  "business_name": "nombre del negocio",
  "business_description": "qué vende",
  "target_customers": "quiénes son sus clientes",
  "differentiators": "qué lo diferencia",
  "products": [{"name": "producto", "price": 0, "description": "descripción", "benefits": "beneficios"}],
  "rules": [{"category": "zones|payment|schedule|promotions|restrictions", "content": "regla"}],
  "assistant_name": "nombre del asistente"
}
\`\`\`

Pasos completados: business_info, products, rules, personality
Cuando un paso esté completo, incluye "step_complete" con el paso terminado.
Cuando todos estén completos, incluye "all_complete": true.

Categorías de reglas:
- zones: zonas de envío
- payment: métodos de pago
- schedule: horarios
- promotions: promociones
- restrictions: restricciones

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
    const { messages, userId } = await request.json()

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 })
    }

    const chatMessages: OnboardingMessage[] = [
      { role: 'assistant', content: '¡Hola! Soy MIA, tu asistente de configuración. Voy a ayudarte a crear tu asistente de ventas. Primero, ¿cómo se llama tu negocio?' },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    const completion = await getOpenAIClient().chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: ONBOARDING_SYSTEM_PROMPT },
        ...chatMessages,
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    const assistantMessage = completion.choices[0]?.message?.content ?? ''
    const { data: extractedData, cleanMessage } = extractJsonFromResponse(assistantMessage)

    const tokensInput = completion.usage?.prompt_tokens ?? 0
    const tokensOutput = completion.usage?.completion_tokens ?? 0

    if (tokensInput > 0 || tokensOutput > 0) {
      const cost = (tokensInput * 0.00015 + tokensOutput * 0.0006) / 1000
      await recordAiUsage({
        business_id: '00000000-0000-0000-0000-000000000000',
        assistant_id: '00000000-0000-0000-0000-000000000000',
        model: MODEL,
        request_type: 'onboarding',
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        cost,
      }).catch(() => {})
    }

    return NextResponse.json({
      message: cleanMessage,
      extractedData,
    })
  } catch (error) {
    console.error('Onboarding chat error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
