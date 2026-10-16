import { createAdminClient } from '@/lib/supabase/admin'
import { getSalesConfig } from '@/lib/ai/knowledge'
import {
  isWithinSendingHours,
  RECOVERY_WINDOW_MS,
  recoveryTextFor,
  resolveRecoveryEligibility,
  selectDueAttempt,
  type RecoveryAttempt,
  type RecoveryEligibilityState,
} from '@/lib/sales/recovery'

/**
 * Reads the current state of a business's WhatsApp conversations and returns
 * the recovery messages that are due RIGHT NOW. Read-only: the bridge worker
 * is the one that sends and persists the attempt markers.
 *
 * The scan is stateless — every call recomputes eligibility and the attempt
 * decision from the database, so a candidate that no longer qualifies (customer
 * replied, order confirmed, human takeover, opted out, ...) simply drops out.
 *
 * Anti-spam gates applied here (all derived from live state, never stored):
 * - Opt-out: `customers.recovery_opt_out_at NOT NULL` removes the candidate.
 * - Quiet hours: attempts are only emitted inside the business's local sending
 *   window; outside it the next scan (inside the window) picks the attempt up,
 *   or the 24h ceiling drops it.
 * - Daily cap: once a connection has sent `recovery_max_per_day` recovery
 *   messages in the rolling 24h, the scan returns nothing.
 */

export interface RecoveryConnection {
  id: string
  assistant_id: string
  business_id: string
  configuration: Record<string, unknown> | null
}

export interface RecoveryDue {
  customerId: string
  conversationId: string
  phone: string
  attempt: RecoveryAttempt
  content: string
  inboundVersion: string
}

interface ConversationRow {
  id: string
  customer_id: string | null
  status: string | null
  outcome: string | null
  ai_paused_at: string | null
  sales_cancelled_at: string | null
}

interface CustomerRow {
  id: string
  phone: string | null
  status: string | null
  recovery_opt_out_at: string | null
}

interface MessageRow {
  conversation_id: string | null
  created_at: string
}

interface OutgoingRow {
  customer_id: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

interface SalesEventRow {
  conversation_id: string | null
  event_type: string | null
  created_at: string
}

const MAX_CONVERSATIONS = 500
const MAX_ROWS = 5000

function latestBy<T extends { created_at: string }>(rows: T[]): T | null {
  let latest: T | null = null
  for (const row of rows) {
    if (!latest || new Date(row.created_at).getTime() > new Date(latest.created_at).getTime()) {
      latest = row
    }
  }
  return latest
}

function isRecoveryAttempt(value: unknown): value is RecoveryAttempt {
  return value === 1 || value === 2 || value === 3 || value === 4
}

export async function scanRecoveryCandidates(params: {
  connection: RecoveryConnection
  now?: number
}): Promise<RecoveryDue[]> {
  const supabase = createAdminClient()
  const now = params.now ?? Date.now()

  const { data: convData } = await supabase
    .from('conversations')
    .select('id, customer_id, status, outcome, ai_paused_at, sales_cancelled_at')
    .eq('assistant_id', params.connection.assistant_id)
    .eq('status', 'active')
    .eq('type', 'live')
    .limit(MAX_CONVERSATIONS)

  const conversations = (convData ?? []) as ConversationRow[]
  if (conversations.length === 0) return []

  const salesConfig = await getSalesConfig(params.connection.business_id)

  const convIds = conversations.map((c) => c.id)
  const customerIds = [
    ...new Set(
      conversations.map((c) => c.customer_id).filter((id): id is string => Boolean(id))
    ),
  ]
  if (customerIds.length === 0) return []

  const windowStart = new Date(now - RECOVERY_WINDOW_MS).toISOString()

  const [messagesRes, customersRes, outgoingRes, eventsRes] = await Promise.all([
    supabase
      .from('messages')
      .select('conversation_id, created_at')
      .in('conversation_id', convIds)
      .eq('role', 'user')
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS),
    supabase
      .from('customers')
      .select('id, phone, status, recovery_opt_out_at')
      .in('id', customerIds),
    supabase
      .from('channel_messages')
      .select('customer_id, created_at, metadata')
      .in('customer_id', customerIds)
      .eq('channel', 'whatsapp')
      .eq('direction', 'outgoing')
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS),
    supabase
      .from('sales_events')
      .select('conversation_id, event_type, created_at')
      .in('conversation_id', convIds)
      .limit(MAX_ROWS),
  ])

  const lastInboundByConv = new Map<string, string>()
  for (const row of (messagesRes.data ?? []) as MessageRow[]) {
    if (!row.conversation_id) continue
    const current = lastInboundByConv.get(row.conversation_id)
    if (!current || new Date(row.created_at).getTime() > new Date(current).getTime()) {
      lastInboundByConv.set(row.conversation_id, row.created_at)
    }
  }

  const customersById = new Map<string, CustomerRow>()
  for (const row of (customersRes.data ?? []) as CustomerRow[]) {
    customersById.set(row.id, row)
  }

  const lastOutboundByCustomer = new Map<string, string>()
  const recoveryMarkers = new Set<string>()
  let recoverySendsInWindow = 0
  for (const row of (outgoingRes.data ?? []) as OutgoingRow[]) {
    if (!row.customer_id) continue
    const current = lastOutboundByCustomer.get(row.customer_id)
    if (!current || new Date(row.created_at).getTime() > new Date(current).getTime()) {
      lastOutboundByCustomer.set(row.customer_id, row.created_at)
    }
    const meta = row.metadata
    if (meta && meta.recovery === true) {
      const attempt = meta.recovery_attempt
      const version = meta.recovery_inbound_version
      if (isRecoveryAttempt(attempt) && typeof version === 'string') {
        recoveryMarkers.add(`${row.customer_id}:${attempt}:${version}`)
      }
      if (new Date(row.created_at).getTime() >= now - RECOVERY_WINDOW_MS) {
        recoverySendsInWindow += 1
      }
    }
  }

  // Daily cap: stop emitting once the connection has hit its recovery budget.
  if (recoverySendsInWindow >= salesConfig.recovery_max_per_day) return []

  // Quiet hours: never emit outside the business's local sending window.
  const withinSendingHours = isWithinSendingHours({
    now,
    timezone: salesConfig.timezone,
    startHour: salesConfig.recovery_sending_start_hour,
    endHour: salesConfig.recovery_sending_end_hour,
  })
  if (!withinSendingHours) return []

  const eventsByConv = new Map<string, SalesEventRow[]>()
  for (const row of (eventsRes.data ?? []) as SalesEventRow[]) {
    if (!row.conversation_id) continue
    const list = eventsByConv.get(row.conversation_id) ?? []
    list.push(row)
    eventsByConv.set(row.conversation_id, list)
  }

  const due: RecoveryDue[] = []

  for (const conversation of conversations) {
    const customerId = conversation.customer_id
    if (!customerId) continue

    const customer = customersById.get(customerId)
    const lastInboundAt = lastInboundByConv.get(conversation.id)
    if (!lastInboundAt) continue

    const events = eventsByConv.get(conversation.id) ?? []
    const hasCommercialConsultation = events.some(
      (e) => e.event_type === 'SALE_STARTED' || e.event_type === 'PRODUCT_SELECTED'
    )
    const latestClosing = latestBy(
      events.filter(
        (e) =>
          e.event_type === 'SALE_WON' ||
          e.event_type === 'SALE_LOST' ||
          e.event_type === 'SALE_CANCELLED'
      )
    )
    const openCycleAfterClosing = latestClosing
      ? events.some(
          (e) =>
            (e.event_type === 'SALE_STARTED' || e.event_type === 'PRODUCT_SELECTED') &&
            new Date(e.created_at).getTime() > new Date(latestClosing.created_at).getTime()
        )
      : false
    const hasConfirmedOrder =
      latestClosing?.event_type === 'SALE_WON' && !openCycleAfterClosing
    const rejectedByEvent =
      latestClosing?.event_type === 'SALE_LOST' && !openCycleAfterClosing
    const hasRejectedOffer =
      rejectedByEvent ||
      conversation.outcome === 'not_interested' ||
      customer?.status === 'lost'

    const state: RecoveryEligibilityState = {
      conversationStatus: conversation.status,
      aiPausedAt: conversation.ai_paused_at,
      salesCancelledAt: conversation.sales_cancelled_at,
      hasConfirmedOrder,
      hasRejectedOffer,
      hasCommercialConsultation,
      lastInboundAt,
      lastMiaOutboundAt: lastOutboundByCustomer.get(customerId) ?? null,
      customerPhone: customer?.phone ?? null,
      connectionAvailable: true,
      optedOut: Boolean(customer?.recovery_opt_out_at),
    }

    const eligibility = resolveRecoveryEligibility(state)
    if (!eligibility.eligible) continue

    const attempt = selectDueAttempt({
      now,
      lastInboundAt: new Date(lastInboundAt).getTime(),
      attempt1SentForVersion: recoveryMarkers.has(`${customerId}:1:${lastInboundAt}`),
      attempt2SentForVersion: recoveryMarkers.has(`${customerId}:2:${lastInboundAt}`),
      attempt3SentForVersion: recoveryMarkers.has(`${customerId}:3:${lastInboundAt}`),
      attempt4SentForVersion: recoveryMarkers.has(`${customerId}:4:${lastInboundAt}`),
    })
    if (!attempt) continue
    if (!customer?.phone) continue

    due.push({
      customerId,
      conversationId: conversation.id,
      phone: customer.phone,
      attempt,
      content: recoveryTextFor(attempt),
      inboundVersion: lastInboundAt,
    })
  }

  return due
}
