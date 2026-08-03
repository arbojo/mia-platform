import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBridgeSecret } from '@/lib/baileys/config'
import { getBusinessContext } from '@/lib/ai/knowledge'
import { executeAI } from '@/lib/runtime/execute-ai'

interface FollowUpConfig {
  follow_up_template?: string | null
}

/**
 * Generates the re-engagement message for an inactive customer on a WhatsApp
 * connection. If the connection defines a follow_up_template it is used
 * verbatim; otherwise MIA drafts a short, personalized WhatsApp message using
 * the business context. Called by the WhatsApp Bridge worker. The bridge is
 * responsible for sending the message and persisting delivery state.
 */
export async function POST(request: Request) {
  try {
    const secret = request.headers.get('x-mia-webhook-secret')
    if (secret !== getBridgeSecret()) {
      return NextResponse.json({ error: 'Invalid bridge secret' }, { status: 401 })
    }

    const { businessId, customerId, connectionId } = await request.json()

    if (!businessId || !customerId || !connectionId) {
      return NextResponse.json(
        { error: 'Missing businessId, customerId or connectionId' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const [{ data: connection }, { data: customer }] = await Promise.all([
      supabase
        .from('channel_connections')
        .select('id, assistant_id, configuration')
        .eq('id', connectionId)
        .eq('business_id', businessId)
        .single(),
      supabase
        .from('customers')
        .select('id, name, phone, city, tags, notes')
        .eq('id', customerId)
        .eq('business_id', businessId)
        .single(),
    ])

    if (!connection || !customer) {
      return NextResponse.json({ error: 'Connection or customer not found' }, { status: 404 })
    }

    const config = (connection.configuration ?? {}) as FollowUpConfig

    if (config.follow_up_template) {
      const content = config.follow_up_template.replaceAll(
        '{name}',
        customer.name ?? 'cliente'
      )
      return NextResponse.json({
        success: true,
        content,
        template: true,
      })
    }

    const context = await getBusinessContext(businessId)

    const system = [
      `Eres ${context.brand?.business_name ?? 'el asistente de ventas'} de la empresa ${context.brand?.business_name ?? 'esta empresa'}.`,
      `Estás recontactando por WhatsApp a ${customer.name ?? 'un cliente'}${customer.city ? ` de ${customer.city}` : ''}.`,
      customer.tags && customer.tags.length > 0
        ? `Etiquetas del cliente: ${customer.tags.join(', ')}.`
        : '',
      customer.notes ? `Notas previas: ${customer.notes}.` : '',
      '',
      'Genera UN mensaje breve (máximo 2-3 frases, en español) de reenganche:',
      '1. Saludo natural y cercano, sin presionar.',
      '2. Una razón genuina para retomar el contacto (novedad, disponibilidad, recordatorio de su interés).',
      '3. Cierre abierto con una pregunta simple que invite a responder.',
      '',
      `Productos disponibles: ${context.products.map((p) => p.name).join(', ') || 'ninguno configurado'}.`,
    ]
      .filter(Boolean)
      .join('\n')

    const result = await executeAI({
      mode: 'complete',
      businessId,
      assistantId: connection.assistant_id,
      requestType: 'live_customer',
      system,
      messages: [{ role: 'user', content: 'Escribe el mensaje de reenganche.' }],
      maxTokens: 150,
      temperature: 0.7,
    })

    return NextResponse.json({
      success: true,
      content: result.content.trim(),
      template: false,
    })
  } catch (error) {
    console.error('Follow-up generation error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
