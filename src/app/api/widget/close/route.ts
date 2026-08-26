import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveCustomer } from '@/lib/channels/identity'
import { resolveConversation } from '@/lib/conversation/resolver'
import { recordWidgetSale } from '@/lib/sales/widget'
import { LandingContextError } from '@/lib/ai/knowledge'
import type { LandingContext } from '@/lib/ai/knowledge'
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
    const { assistantId, conversationId, customerExternalId, customerName } = body

    if (!assistantId || typeof assistantId !== 'string') {
      return NextResponse.json({ error: 'assistantId required' }, { status: 400 })
    }

    const landingContext = parseLandingContext(body.landingContext)
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

    let resolvedCustomerId: string
    let resolvedConversationId: string | null = null
    let resolvedCustomerName: string | null =
      typeof customerName === 'string' && customerName.length > 0 ? customerName : null

    const externalId =
      typeof customerExternalId === 'string' && customerExternalId.length > 0
        ? customerExternalId
        : 'anonymous'

    if (typeof conversationId === 'string' && conversationId.length > 0) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, customer_id')
        .eq('id', conversationId)
        .eq('assistant_id', assistantId)
        .maybeSingle()

      if (conv?.customer_id) {
        resolvedConversationId = conv.id
        resolvedCustomerId = conv.customer_id
      } else {
        const customer = await resolveCustomer(businessId, {
          channel: 'widget',
          customerExternalId: externalId,
          customerName: resolvedCustomerName,
        })
        resolvedCustomerId = customer.id
        resolvedCustomerName = customer.name ?? resolvedCustomerName
        resolvedConversationId = (await resolveConversation(assistantId, customer.id)) ?? null
      }
    } else {
      const customer = await resolveCustomer(businessId, {
        channel: 'widget',
        customerExternalId: externalId,
        customerName: resolvedCustomerName,
      })
      resolvedCustomerId = customer.id
      resolvedCustomerName = customer.name ?? resolvedCustomerName
      resolvedConversationId = (await resolveConversation(assistantId, customer.id)) ?? null
    }

    let productName: string | null = landingContext?.product ?? null
    let amount: number | null = null
    if (landingContext?.productId) {
      const { data: product } = await supabase
        .from('products')
        .select('name, price')
        .eq('business_id', businessId)
        .eq('id', landingContext.productId)
        .maybeSingle()
      if (product) {
        productName = product.name ?? productName
        amount = typeof product.price === 'number' ? product.price : null
      }
    }

    const result = await recordWidgetSale({
      businessId,
      assistantId,
      conversationId: resolvedConversationId,
      customerId: resolvedCustomerId,
      customerName: resolvedCustomerName,
      productName,
      amount,
    })

    return NextResponse.json({ ...result, conversationId: resolvedConversationId })
  } catch (error) {
    console.error('Widget close error:', error)

    if (error instanceof LandingContextError) {
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
