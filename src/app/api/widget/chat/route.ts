import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processStreaming, RuntimeError } from '@/lib/runtime/runtime'
import { resolveConversation } from '@/lib/conversation/resolver'
import { WidgetAdapter } from '@/lib/channels/adapters/widget'
import { resolveCustomer } from '@/lib/channels/identity'

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

    const adapter = new WidgetAdapter()
    const normalized = await adapter.receiveMessage(body)

    const supabase = createAdminClient()

    const { data: assistant } = await supabase
      .from('assistants')
      .select('id, business_id')
      .eq('id', assistantId)
      .eq('is_active', true)
      .single()

    if (!assistant) {
      return NextResponse.json({ error: 'Assistant not found' }, { status: 404 })
    }

    const businessId = assistant.business_id

    const customer = await resolveCustomer(businessId, {
      channel: 'widget',
      customerExternalId: normalized.customerExternalId,
      customerName: normalized.customerName,
    })

    const conversationId = (await resolveConversation(assistantId, customer.id)) ?? undefined

    const result = await processStreaming({
      assistantId,
      businessId,
      conversationId,
      messages,
      requestType: 'live_customer',
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('Widget chat error:', error)

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
