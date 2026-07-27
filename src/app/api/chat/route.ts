import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { processChatMessage, GatewayError } from '@/lib/channels/gateway'

export const runtime = 'nodejs'
export const maxDuration = 60

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  assistantId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  requestType: z.enum(['live_customer', 'simulation', 'training']).optional().default('live_customer'),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { messages, assistantId, conversationId, requestType } = parsed.data

    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .select('id, business_id, businesses!inner(owner_id)')
      .eq('id', assistantId)
      .single()

    if (assistantError || !assistant) {
      return Response.json({ error: 'Assistant not found' }, { status: 404 })
    }

    const business = Array.isArray(assistant.businesses)
      ? assistant.businesses[0]
      : assistant.businesses

    if (!business || business.owner_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await processChatMessage({
      assistantId,
      conversationId,
      messages,
      requestType,
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('Chat error:', error)

    if (error instanceof GatewayError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      )
    }

    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
