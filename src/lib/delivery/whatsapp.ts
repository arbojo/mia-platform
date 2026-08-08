import { createAdminClient } from '@/lib/supabase/admin'
import { createDeliveryAdmin } from './db'

const WHATSAPP_API_VERSION = 'v21.0'
const WHATSAPP_API_BASE = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`

interface WhatsAppCredentials {
  phoneNumberId: string
  accessToken: string
}

export async function getWhatsAppCredentials(businessId: string): Promise<WhatsAppCredentials | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('channel_connections')
    .select('credentials, status')
    .eq('business_id', businessId)
    .eq('channel', 'whatsapp')
    .order('updated_at', { ascending: false })

  if (error) {
    throw error
  }

  const connection =
    data?.find((c) => c.status === 'connected') ?? data?.[0]

  const credentials = (connection?.credentials ?? {}) as {
    phone_number_id?: string
    access_token?: string
  }

  if (!credentials.phone_number_id || !credentials.access_token) {
    return null
  }

  return {
    phoneNumberId: credentials.phone_number_id,
    accessToken: credentials.access_token,
  }
}

export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

export function buildWaMeLink(phone: string | null | undefined, text: string): string {
  const digits = normalizePhone(phone)
  if (!digits) return ''
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export async function enqueueWhatsApp(params: {
  businessId: string
  to: string
  text: string
}): Promise<{ queued: boolean; skipped: boolean }> {
  const delivery = createDeliveryAdmin()
  const { data: settings, error: settingsError } = await delivery
    .from('business_settings')
    .select('whatsapp_notify, wa_business_id')
    .eq('business_id', params.businessId)
    .maybeSingle()

  if (settingsError) {
    throw settingsError
  }

  const to = normalizePhone(params.to)
  if (
    !settings ||
    !settings.whatsapp_notify ||
    !settings.wa_business_id ||
    !to
  ) {
    return { queued: false, skipped: true }
  }

  const { error } = await delivery.from('outbox_events').insert({
    business_id: params.businessId,
    kind: 'whatsapp',
    status: 'pending',
    payload: {
      to,
      text: params.text,
      wa_business_id: settings.wa_business_id,
    },
  })

  if (error) {
    throw error
  }

  void processWhatsAppOutbox(params.businessId)

  return { queued: true, skipped: false }
}

export async function processWhatsAppOutbox(businessId: string): Promise<void> {
  const delivery = createDeliveryAdmin()
  const { data: pending, error } = await delivery
    .from('outbox_events')
    .select('*')
    .eq('business_id', businessId)
    .eq('kind', 'whatsapp')
    .eq('status', 'pending')
    .limit(10)

  if (error || !pending?.length) {
    return
  }

  const credentials = await getWhatsAppCredentials(businessId)

  for (const event of pending) {
    const payload = (event.payload ?? {}) as {
      to?: string
      text?: string
      wa_business_id?: string
    }

    let result: { ok: boolean; error?: string }

    if (!credentials || !payload.to || !payload.text) {
      result = { ok: false, error: 'WhatsApp no configurado para el negocio' }
    } else {
      result = await sendGraphText({
        phoneNumberId: credentials.phoneNumberId,
        accessToken: credentials.accessToken,
        to: payload.to,
        text: payload.text,
      })
    }

    const attempts = (event.attempts ?? 0) + 1
    const status = result.ok ? 'sent' : attempts >= 3 ? 'dead_letter' : 'failed'

    await delivery
      .from('outbox_events')
      .update({
        status,
        attempts,
        last_error: result.error ?? null,
        sent_at: result.ok ? new Date().toISOString() : null,
      })
      .eq('id', event.id)
  }
}

export async function sendGraphText(params: {
  phoneNumberId: string
  accessToken: string
  to: string
  text: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${WHATSAPP_API_BASE}/${params.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: params.to,
          type: 'text',
          text: { body: params.text },
        }),
      }
    )

    if (!response.ok) {
      const errorData = (await response.json()) as { error?: { message?: string } }
      return {
        ok: false,
        error: errorData.error?.message ?? `HTTP ${response.status}`,
      }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export type DeliveryNotificationKind = 'voy_en_camino' | 'ya_estoy_aqui'

export function buildDeliveryNotificationText(
  kind: DeliveryNotificationKind,
  params: {
    orderNumber: string
    customerName: string
    driverName: string
    amount: number | null
    paidAtSale: boolean
  }
): string {
  const amountLine =
    params.amount !== null && params.amount !== undefined && !params.paidAtSale
      ? `\nImporte a abonar: $${params.amount}`
      : params.amount !== null && params.amount !== undefined
        ? `\nPedido abonado: $${params.amount}`
        : ''

  const body =
    kind === 'voy_en_camino'
      ? `Hola ${params.customerName}! 🚚\n\nTu pedido ${params.orderNumber} va en camino. Te lo lleva ${params.driverName}.${amountLine}`
      : `Hola ${params.customerName}! 📍\n\n${params.driverName} ya está en la puerta con tu pedido ${params.orderNumber}.${amountLine}`

  return body
}
