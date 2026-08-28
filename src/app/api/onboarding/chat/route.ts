import { NextResponse } from 'next/server'
import { executeAI } from '@/lib/runtime/execute-ai'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { QUIZ_QUESTIONS, getNextStep, buildConfirmationData } from '@/lib/onboarding/quiz'
import type { OnboardingStep, BusinessProfile, QuizAnswer, CapabilityIntent } from '@/lib/onboarding/types'
import { deriveCapabilities, normalizeAnswers, seedOperationalConfig } from '@/lib/onboarding/derive'
import { getEffectiveEdition } from '@/lib/system/edition'
import type { Edition } from '@/lib/system/edition'

interface OnboardingMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  messages: OnboardingMessage[]
  businessId?: string
  step?: OnboardingStep
  profile?: Partial<BusinessProfile>
  answers?: QuizAnswer[]
  capabilityIntent?: CapabilityIntent
  action?: 'next' | 'complete' | 'resume'
}

const ONBOARDING_SYSTEM_PROMPT = `Eres MIA, una asistente de ventas que está conociendo un negocio nuevo para configurarse perfectamente. Estás teniendo tu primer día y el dueño te está enseñando todo lo que necesitas saber.

PERSONALIDAD:
- Hablas como una empleada comprometida y con ganas de aprender
- Usas un tono cálido pero profesional
- Muestras entusiasmo genuino por aprender sobre el negocio
- Nunca suenas a robot ni a cuestionario
- Hablas en primera persona como si ya fueras la asistente de ventas

FLUJO ADAPTATIVO (8 preguntas máximo, algunas se saltan según respuestas):
1. Identidad: "¿Cómo se llama tu negocio y qué venden?"
2. Rubro: "¿En qué rubro? (calzado, ropa, inmobiliaria, bienestar, servicios, otro)"
3. Ambición comercial: "¿Quieres que MIA venda activamente o solo informe?"
4. Seguimiento: "¿Seguimiento y recuperación de clientes?" (solo si venta activa)
5. Complejidad: "¿Variantes (tallas/colores) o mayorista?"
6. Módulos: "¿Gestión de inventario y/o entregas?"
7. Canales: "¿Por dónde atiendes? (WhatsApp, Web, Landing, Telegram)"
8. Nombre: "¿Cómo se llama tu asistente?"
9. Confirmación: Resumen de todo lo entendido

REGLAS DE CONVERSACIÓN:
- Haz SOLO UNA pregunta a la vez
- SIEMPRE reconoce lo que el dueño dijo antes de hacer la siguiente pregunta
- Muestra que APRENDISTE algo con esa información
- Explica brevemente POR QUÉ esa información te será útil
- Transiciona naturalmente a la siguiente pregunta
- Nunca repitas mecánicamente la respuesta del usuario
- Usa variación: "Ya lo anoté", "Eso me ayuda bastante", "Con esto podré responder mejor", "Tiene mucho sentido", "Eso será importante cuando hable con tus clientes"
- Evita: "Perfecto...", "Entiendo...", "Excelente..." repetidamente
- Al final de cada respuesta, confirma lo aprendido y avanza

MINDSET DE APRENDIZAJE:
- Cada respuesta refleja que estás aprendiendo
- Usa: "Ahora sé...", "Con esto aprendí...", "Esto me ayudará cuando un cliente pregunte...", "Ya voy entendiendo cómo trabaja [negocio]"
- Inicio: "Estoy empezando a conocer tu negocio"
- Mitad: "Estoy entendiendo mejor tu negocio"
- Final: "Tengo una imagen clara, lista para configurarme"

FORMATO DE RESPUESTA:
Responde con tu mensaje natural. Cuando tengas información estructurada suficiente para un paso, agrega al final un bloque JSON:

\`\`\`json
{
  "step_complete": "identity",
  "extracted": { "name": "Zapatería El Paso", "description": "calzado familiar" },
  "next_question": "industry"
}
\`\`\`

Pasos: identity, industry, sales_ambition, followup, product_complexity, modules, channels, assistant_name, confirmation, complete
Cuando todos estén completos: "all_complete": true`

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

function getInitialMessage(): string {
  return '¡Hola! Soy MIA, tu futura asistente de ventas. Hoy es mi primer día y quiero aprender todo sobre tu negocio para configurarme perfectamente. ¿Cómo se llama tu negocio y qué venden?'
}

function getQuestionPrompt(step: OnboardingStep, profile: Partial<BusinessProfile>): string {
  const question = QUIZ_QUESTIONS.find((q) => q.step === step)
  if (!question) return ''

  let prompt = `\n\nPREGUNTA ACTUAL (${step}): "${question.label}"`

  if (question.type === 'select' && question.options) {
    prompt += '\nOpciones: ' + question.options.map((o) => o.label).join(', ')
  } else if (question.type === 'radio' && question.options) {
    prompt += '\nOpciones: ' + question.options.map((o) => o.label).join(' | ')
  } else if (question.type === 'multiselect' && question.options) {
    prompt += '\nOpciones (pueden elegir varias): ' + question.options.map((o) => o.label).join(', ')
  } else if (question.type === 'confirmation') {
    const confirmation = buildConfirmationData(profile as BusinessProfile)
    prompt += '\n\nDATOS PARA CONFIRMACIÓN:'
    prompt += `\n- Tipo: ${confirmation.businessType}`
    prompt += `\n- Qué vende: ${confirmation.whatYouSell}`
    prompt += `\n- Cómo vende: ${confirmation.howYouSell}`
    prompt += `\n- Canales: ${confirmation.channels}`
    prompt += `\n- Módulos: ${confirmation.modules}`
    prompt += '\nCapacidades detectadas: ' + confirmation.capabilities.map((c) => c.label).join(', ')
    prompt += '\n\nPregunta: "Esto es lo que entendí de tu negocio. ¿Está todo correcto o quieres cambiar algo?"'
  }

  return prompt
}

export async function POST(request: Request) {
  try {
    await requireAuth()
    const body: ChatRequest = await request.json()
    const { messages, businessId, step, profile, answers, capabilityIntent, action } = body

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 })
    }

    const supabase = await createClient()

    let currentBusinessId = businessId
    const initialStep: OnboardingStep = step ?? 'identity'
    let currentStep: OnboardingStep = initialStep
    const initialProfile: Partial<BusinessProfile> = profile ?? {}
    let currentProfile: Partial<BusinessProfile> = initialProfile
    const initialAnswers: QuizAnswer[] = answers ?? []
    let currentAnswers: QuizAnswer[] = initialAnswers
    const initialCapabilityIntent: CapabilityIntent = capabilityIntent ?? {
      explicit: [],
      inferred: [],
      unknown: [],
      sources: {},
    }
    const currentCapabilityIntent: CapabilityIntent = initialCapabilityIntent

    if (action === 'resume' && currentBusinessId) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('industry, capabilities, onboarding_answers, capability_sources, onboarding_status')
        .eq('id', currentBusinessId)
        .single()

      if (biz) {
        const savedAnswers = (biz.onboarding_answers as Record<string, unknown>)?.answers as QuizAnswer[] ?? []
        const savedProfile = (biz.onboarding_answers as Record<string, unknown>)?.profile as Partial<BusinessProfile> ?? {}
        currentAnswers = savedAnswers
        currentProfile = savedProfile
        currentStep = (biz.onboarding_status as OnboardingStep) ?? 'identity'
      }
    }

    if (!currentBusinessId) {
      const { data: existingBiz } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle()

      if (existingBiz) {
        currentBusinessId = existingBiz.id
      }
    }

    const chatMessages: OnboardingMessage[] = [
      { role: 'assistant', content: getInitialMessage() },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    const questionPrompt = getQuestionPrompt(currentStep, currentProfile)
    const systemPrompt = ONBOARDING_SYSTEM_PROMPT + questionPrompt

    const edition: Edition | null = currentBusinessId
      ? await getEffectiveEdition(currentBusinessId)
      : null

    const result = await executeAI({
      mode: 'complete',
      taskType: 'chat',
      businessId: currentBusinessId ?? '00000000-0000-0000-0000-000000000000',
      assistantId: '00000000-0000-0000-0000-000000000000',
      requestType: 'onboarding',
      system: systemPrompt,
      messages: chatMessages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.7,
      maxTokens: 800,
    })

    const assistantMessage = result.content
    const { data: extractedData, cleanMessage } = extractJsonFromResponse(assistantMessage)

    let nextStep = currentStep
    const updatedProfile: Partial<BusinessProfile> = { ...currentProfile }
    const updatedAnswers: QuizAnswer[] = [...currentAnswers]
    let updatedCapabilityIntent: CapabilityIntent = { ...currentCapabilityIntent }
    let allComplete = false
    let confirmationData: ReturnType<typeof buildConfirmationData> | null = null

    if (extractedData) {
      if (extractedData.step_complete) {
        const completedStep = extractedData.step_complete as OnboardingStep
        const question = QUIZ_QUESTIONS.find((q) => q.step === completedStep)
        const extracted = extractedData.extracted as Record<string, unknown> | undefined

        if (extracted) {
          for (const [key, value] of Object.entries(extracted)) {
            if (key === 'name') updatedProfile.name = value as string
            else if (key === 'description') updatedProfile.description = value as string
            else if (key === 'industry') updatedProfile.industry = value as string
            else if (key === 'salesMode') updatedProfile.salesMode = value as 'active' | 'informative'
            else if (key === 'followupMode') updatedProfile.followupMode = value as 'yes' | 'no'
            else if (key === 'productComplexity') updatedProfile.productComplexity = value as 'simple' | 'variants' | 'bulk' | 'both'
            else if (key === 'modules') updatedProfile.modules = value as ('inventory' | 'delivery' | 'both' | 'none')[]
            else if (key === 'channels') updatedProfile.channels = value as ('whatsapp' | 'webchat' | 'landing' | 'telegram')[]
            else if (key === 'assistantName') updatedProfile.assistantName = value as string
          }
        }

        const answer: QuizAnswer = {
          step: completedStep,
          questionId: question?.id ?? '',
          value: (extracted as unknown as string | string[] | boolean | null) ?? true,
          timestamp: new Date().toISOString(),
        }
        updatedAnswers.push(answer)

        nextStep = getNextStep(completedStep, updatedProfile) ?? 'complete'

        if (nextStep === 'confirmation' && edition) {
          updatedCapabilityIntent = deriveCapabilities(updatedProfile as BusinessProfile, edition)
          confirmationData = buildConfirmationData(updatedProfile as BusinessProfile)
        }

        if (nextStep === 'complete' && extractedData.all_complete) {
          allComplete = true
        }
      }
    }

    if (allComplete && currentBusinessId && edition) {
      const fullProfile = updatedProfile as BusinessProfile
      const intent = deriveCapabilities(fullProfile, edition)
      const operationalConfig = seedOperationalConfig(fullProfile, intent)
      normalizeAnswers(updatedAnswers, fullProfile)

      await supabase
        .from('businesses')
        .update({
          industry: fullProfile.industry,
          capabilities: [...intent.explicit, ...intent.inferred],
          onboarding_answers: { answers: updatedAnswers, profile: fullProfile },
          capability_sources: intent.sources,
          onboarding_status: 'ready',
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentBusinessId)

      if (operationalConfig.inventory) {
        await supabase.from('inventory.business_settings').upsert({
          business_id: currentBusinessId,
          enabled: true,
          vertical: fullProfile.industry ?? 'general',
          low_stock_threshold: 5,
          critical_stock_threshold: 2,
          auto_reorder: false,
          prediction_enabled: true,
          customer_promise_enabled: true,
          updated_at: new Date().toISOString(),
        })
      }

      if (operationalConfig.delivery) {
        await supabase.from('delivery.business_settings').upsert({
          business_id: currentBusinessId,
          enabled: true,
          default_zone: 'local',
          auto_assign: true,
          notify_customer: true,
          driver_app_required: true,
          gps_required: true,
          updated_at: new Date().toISOString(),
        })
      }

      if (operationalConfig.salesConfig) {
        await supabase.from('business_sales_config').upsert({
          business_id: currentBusinessId,
          ...operationalConfig.salesConfig,
          updated_at: new Date().toISOString(),
        })
      }

      const { data: assistant } = await supabase
        .from('assistants')
        .select('id')
        .eq('business_id', currentBusinessId)
        .maybeSingle()

      if (assistant) {
        for (const ch of operationalConfig.assistantChannels) {
          await supabase.from('assistant_channels').upsert({
            assistant_id: assistant.id,
            channel: ch.channel as 'web' | 'whatsapp' | 'messenger' | 'instagram',
            is_active: ch.is_active,
          })
        }
      }
    }

    return NextResponse.json({
      message: cleanMessage,
      step: nextStep,
      profile: updatedProfile,
      answers: updatedAnswers,
      capabilityIntent: updatedCapabilityIntent,
      allComplete,
      businessId: currentBusinessId,
      confirmationData,
    })
  } catch (error) {
    console.error('Onboarding chat error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: biz, error } = await supabase
      .from('businesses')
      .select('industry, capabilities, onboarding_answers, capability_sources, onboarding_status')
      .eq('id', businessId)
      .single()

    if (error || !biz) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json({
      businessId,
      industry: biz.industry,
      capabilities: biz.capabilities,
      onboardingAnswers: biz.onboarding_answers,
      capabilitySources: biz.capability_sources,
      onboardingStatus: biz.onboarding_status,
    })
  } catch (error) {
    console.error('Onboarding state error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}