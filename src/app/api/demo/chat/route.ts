import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/route-handler'
import { buildMasterPrompt } from '@/lib/ai/prompts'
import { recordAiUsage } from '@/lib/ai/knowledge'
import { getOpenAIClient, MODEL } from '@/lib/ai/client'
import { canDemoChat } from '@/lib/system/edition'
import { canServeTraffic } from '@/lib/runtime/assistant-gate'
import {
  getDemoFreeMessageLimit,
  getOrCreateProfile,
  incrementDemoInteractions,
} from '@/lib/system/demo'

const DEMO_BUSINESS_ID = '11111111-1111-4111-8111-111111111111'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(sessionId: string, limit: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(sessionId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(sessionId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}

export async function POST(request: Request) {
  try {
    if (!canDemoChat()) {
      return NextResponse.json({ error: 'Demo not available in this edition' }, { status: 403 })
    }

    const { messages, sessionId } = await request.json()

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    const limit = getDemoFreeMessageLimit()

    const supabaseResponse = NextResponse.next()
    const authSupabase = await createClient(supabaseResponse)
    const {
      data: { user },
    } = await authSupabase.auth.getUser()

    if (user) {
      await getOrCreateProfile(user.id)
      const interactions = await incrementDemoInteractions(user.id)
      if (interactions > limit) {
        return NextResponse.json(
          { error: 'Demo limit exceeded', limitExceeded: true, limit },
          { status: 429 }
        )
      }
    } else if (!checkRateLimit(sessionId, limit)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', limitExceeded: true, limit },
        { status: 429 }
      )
    }

    const supabase = createAdminClient()

    const { data: assistant } = await supabase
      .from('assistants')
      .select('*, businesses(*)')
      .eq('business_id', DEMO_BUSINESS_ID)
      .single()

    if (!assistant || !canServeTraffic(assistant.is_active ?? false, assistant.status)) {
      return NextResponse.json({ error: 'Demo not available' }, { status: 503 })
    }

    const context = await supabase
      .from('brand_identities')
      .select('*')
      .eq('business_id', DEMO_BUSINESS_ID)
      .single()

    const [productsResult, rulesResult, knowledgeResult, instructionsResult] =
      await Promise.all([
        supabase.from('products').select('*').eq('business_id', DEMO_BUSINESS_ID).eq('is_active', true),
        supabase.from('sales_rules').select('*').eq('business_id', DEMO_BUSINESS_ID).eq('is_active', true),
        supabase.from('knowledge_items').select('*').eq('business_id', DEMO_BUSINESS_ID).eq('is_active', true),
        supabase.from('ai_instructions').select('*').eq('business_id', DEMO_BUSINESS_ID).eq('is_active', true),
      ])

    const systemPrompt = buildMasterPrompt({
      business: assistant.businesses,
      brand: context.data,
      assistant,
      products: productsResult.data ?? [],
      rules: rulesResult.data ?? [],
      instructions: instructionsResult.data ?? [],
      knowledge: knowledgeResult.data ?? [],
    })

    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'system' as const, content: 'Este es un DEMO. Responde de forma breve y amable. Al final de cada respuesta, recuerda al usuario que puede crear su propia asistente.' },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    const completion = await getOpenAIClient().chat.completions.create({
      model: MODEL,
      messages: chatMessages,
      stream: true,
      max_tokens: 300,
    })

    let tokensInput = 0
    let tokensOutput = 0

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content
          if (content) {
            controller.enqueue(encoder.encode(content))
          }
          if (chunk.usage) {
            tokensInput = chunk.usage.prompt_tokens
            tokensOutput = chunk.usage.completion_tokens
          }
        }
        controller.close()

        if (tokensInput > 0 || tokensOutput > 0) {
          const cost = (tokensInput * 0.00015 + tokensOutput * 0.0006) / 1000
          await recordAiUsage({
            business_id: DEMO_BUSINESS_ID,
            assistant_id: assistant.id,
            model: MODEL,
            request_type: 'demo',
            tokens_input: tokensInput,
            tokens_output: tokensOutput,
            cost,
          })
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('Demo chat error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
