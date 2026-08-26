import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processStreaming, RuntimeError } from '@/lib/runtime/runtime'
import { resolveConversation } from '@/lib/conversation/resolver'
import { WidgetAdapter } from '@/lib/channels/adapters/widget'
import { resolveCustomer } from '@/lib/channels/identity'
import { LandingContextError } from '@/lib/ai/knowledge'
import type { LandingContext } from '@/lib/ai/knowledge'
import { detectIntent, isSalesIntent } from '@/lib/runtime/intents'
import { canServeTraffic } from '@/lib/runtime/assistant-gate'

function parseLandingContext(raw: unknown): LandingContext | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object') return undefined
  const lc = raw as Record<string, unknown>
  if (typeof lc.landingId !== 'string' || lc.landingId.length === 0 || lc.landingId.length > 64) {
    throw new LandingContextError('Invalid landing context', 'INVALID_LANDING_CONTEXT')
  }
  const brand = typeof lc.brand === 'string' ? lc.brand.slice(0, 100) : undefined
  const product = typeof lc.product === 'string' ? lc.product.slice(0, 100) : undefined
  const productId = typeof lc.productId === 'string' ? lc.productId.slice(0, 64) : undefined
  return { landingId: lc.landingId, brand, product, productId }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { messages, assistantId } = body

    if (!assistantId || typeof assistantId !== 'string') {
      return NextResponse.json({ error: 'assistantId required' }, { status: 400 })
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 })
    }

    const landingContext = parseLandingContext(body.landingContext)

    const lastMessage = messages[messages.length - 1]
    const intent = lastMessage?.content ? detectIntent(lastMessage.content) : null

    const adapter = new WidgetAdapter()
    const normalized = await adapter.receiveMessage(body)

    const supabase = createAdminClient()

    const { data: assistant } = await supabase
      .from('assistants')
      .select('id, business_id, is_active, status')
      .eq('id', assistantId)
      .single()

    if (!assistant || !canServeTraffic(assistant.is_active ?? false, assistant.status)) {
      return NextResponse.json({ error: 'Assistant not found' }, { status: 404 })
    }

    const businessId = assistant.business_id

    const customer = await resolveCustomer(businessId, {
      channel: 'widget',
      customerExternalId: normalized.customerExternalId,
      customerName: normalized.customerName,
    })

    await supabase.from('channel_messages').insert({
      business_id: businessId,
      customer_id: customer.id,
      channel: 'widget',
      direction: 'incoming',
      content: lastMessage?.content ?? '',
      external_id: normalized.externalId,
      external_customer_id: normalized.customerExternalId,
      status: 'received',
    })

    const conversationId = (await resolveConversation(assistantId, customer.id)) ?? undefined

    const result = await processStreaming({
      assistantId,
      businessId,
      conversationId,
      messages,
      requestType: 'live_customer',
      landingContext,
      intentTag: intent,
    })

    const streamResponse = result.toStructuredStreamResponse()
    const headers = new Headers(streamResponse.headers)
    headers.set('X-MIA-Sales-Intent', isSalesIntent(intent) ? '1' : '0')
    if (conversationId) {
      headers.set('X-MIA-Conversation-Id', conversationId)
    }

    return new Response(streamResponse.body, {
      status: streamResponse.status,
      headers,
    })
  } catch (error) {
    console.error('Widget chat error:', error)

    if (error instanceof LandingContextError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      )
    }

    if (error instanceof RuntimeError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      )
    }

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
