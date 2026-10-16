/**
 * One-off retroactive recovery backfill.
 *
 * Re-engages leads whose last inbound is older than the live recovery window
 * (10 min / 2 h / 6 h / 23 h, hard ceiling 24 h) but within the last N days.
 * The live `selectDueAttempt` intentionally ignores anything >= 24h old, so this
 * script carries its own retro decision (attempt 1 if nothing sent yet for the
 * last inbound version; attempt 2 after a randomised delay once attempt 1
 * landed). Message copy is imported from `src/lib/sales/recovery.ts` so the two
 * flows cannot drift.
 *
 * Anti-spam: honours the customer opt-out (`customers.recovery_opt_out_at`) and
 * the business's local sending window from `business_sales_config` (overridable
 * with `--hours` / `--tz`). Sends are dripped with randomised, irregular gaps
 * (plus occasional long breaks). Order is shuffled. Idempotent via
 * `channel_messages` markers, so it is safe to re-run (resume).
 *
 * Default mode is DRY-RUN. Nothing is sent until `--send` is passed.
 *
 * Usage:
 *   # dry-run (default) — prints the eligible list, sends nothing
 *   node --max-http-header-size=65536 --experimental-strip-types scripts/recovery-backfill.script.ts --plan
 *
 *   # explicit dry-run
 *   ... --plan
 *
 *   # send with drip
 *   ... --send
 *
 *   # keep draining (attempt 1 + attempt 2) in one long-lived process
 *   ... --send --watch
 *
 * Flags: --limit=N --window-days=7 --min-gap-min=3 --max-gap-min=10
 *        --break-every-min=3 --break-every-max=5 --break-min=20 --break-max=45
 *        --attempt2-min=90 --attempt2-max=240 --hours=9-19 --tz=America/Mexico_City
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { isWithinSendingHours, recoveryTextFor } from '../src/lib/sales/recovery.ts'

const env: Record<string, string> = {}
// Split on CRLF too: the local .env.local mixes LF and CRLF lines, and a
// trailing \r would otherwise defeat the `.*$` capture below.
for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const DEFAULT_BRIDGE_URL = 'https://mia-whatsapp-bridge.fly.dev'

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY
let bridgeUrl = env.WHATSAPP_BRIDGE_URL ?? DEFAULT_BRIDGE_URL
const bridgeSecret = env.WHATSAPP_BRIDGE_SECRET

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'
const ASSISTANT_ID = '2f57cd29-fef3-4167-8745-4f02b57d4850'

const MS_MIN = 60_000
const MS_HOUR = 60 * MS_MIN
const MS_DAY = 24 * MS_HOUR

type Args = {
  send: boolean
  watch: boolean
  limit: number
  windowDays: number
  minGapMin: number
  maxGapMin: number
  breakEveryMin: number
  breakEveryMax: number
  breakMin: number
  breakMax: number
  attempt2Min: number
  attempt2Max: number
  hourStart: number
  hourEnd: number
  tz: string
  bridgeUrl: string
  allowLocalhost: boolean
}

function parseArgs(argv: string[]): Args {
  const get = (name: string, def: number) => {
    const hit = argv.find((a) => a.startsWith(`${name}=`))
    if (!hit) return def
    const n = Number(hit.split('=')[1])
    return Number.isFinite(n) ? n : def
  }
  const str = (name: string, def: string) => {
    const hit = argv.find((a) => a.startsWith(`${name}=`))
    return hit ? hit.split('=')[1] ?? def : def
  }
  const hours = str('--hours', '9-19').split('-')
  return {
    send: argv.includes('--send'),
    watch: argv.includes('--watch'),
    limit: get('--limit', 0),
    windowDays: get('--window-days', 7),
    minGapMin: get('--min-gap-min', 3),
    maxGapMin: get('--max-gap-min', 10),
    breakEveryMin: get('--break-every-min', 3),
    breakEveryMax: get('--break-every-max', 5),
    breakMin: get('--break-min', 20),
    breakMax: get('--break-max', 45),
    attempt2Min: get('--attempt2-min', 90),
    attempt2Max: get('--attempt2-max', 240),
    hourStart: Number(hours[0]) || 9,
    hourEnd: Number(hours[1]) || 19,
    tz: str('--tz', 'America/Mexico_City'),
    bridgeUrl: str('--bridge-url', ''),
    allowLocalhost: argv.includes('--allow-localhost'),
  }
}

function h() {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  }
}

function maskPhone(p: string | null): string {
  if (!p) return '—'
  const s = p.replace(/\D/g, '')
  if (s.length < 4) return '***'
  return `+***${s.slice(-4)}`
}

const shortId = (id: string) => id.slice(0, 8)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

function localHour(now: Date, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now)
    const hour = parts.find((p) => p.type === 'hour')?.value
    return hour ? Number(hour) % 24 : now.getHours()
  } catch {
    return now.getHours()
  }
}

function inWindow(now: Date, a: Args): boolean {
  return isWithinSendingHours({
    now: now.getTime(),
    timezone: a.tz,
    startHour: a.hourStart,
    endHour: a.hourEnd,
  })
}

async function waitUntilWindow(a: Args): Promise<void> {
  while (!inWindow(new Date(), a)) {
    const hour = localHour(new Date(), a.tz)
    const hoursToWait = hour < a.hourStart ? a.hourStart - hour : 24 - hour + a.hourStart
    const wait = Math.max(5 * MS_MIN, Math.min(hoursToWait * MS_HOUR, 30 * MS_MIN))
    console.log(`[backfill] outside ${a.hourStart}-${a.hourEnd} ${a.tz}; waiting ${Math.round(wait / MS_MIN)}min`)
    await sleep(wait)
  }
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init)
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`${r.status} ${t}`)
  }
  return r.json() as Promise<T>
}

interface SalesConfigRow {
  timezone: string | null
  recovery_sending_start_hour: number | null
  recovery_sending_end_hour: number | null
}

async function fetchSalesConfig(): Promise<SalesConfigRow | null> {
  const rows = await fetchJSON<SalesConfigRow[]>(
    `${supabaseUrl}/rest/v1/business_sales_config?business_id=eq.${BUSINESS_ID}&select=timezone,recovery_sending_start_hour,recovery_sending_end_hour&limit=1`,
    { headers: h() }
  )
  return rows[0] ?? null
}

interface ConvRow {
  id: string
  customer_id: string | null
  status: string | null
  outcome: string | null
  ai_paused_at: string | null
  sales_cancelled_at: string | null
}
interface MsgRow {
  conversation_id: string | null
  created_at: string
}
interface CustRow {
  id: string
  phone: string | null
  status: string | null
  recovery_opt_out_at: string | null
}
interface OutRow {
  customer_id: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}
interface EvRow {
  conversation_id: string | null
  event_type: string | null
  created_at: string
}

function latestBy<T extends { created_at: string }>(rows: T[]): T | null {
  let latest: T | null = null
  for (const row of rows) {
    if (!latest || new Date(row.created_at).getTime() > new Date(latest.created_at).getTime()) {
      latest = row
    }
  }
  return latest
}

interface Candidate {
  convId: string
  custId: string
  phone: string
  lastInboundAt: string
  attempt: 1 | 2
  content: string
  attempt2DueAt: number | null
}

interface ScanState {
  candidates: Candidate[]
  sentKeys: Set<string>
  attempt2DueByKey: Map<string, number>
}

const key = (custId: string, attempt: 1 | 2, version: string) => `${custId}:${attempt}:${version}`

async function scan(a: Args, now: number): Promise<ScanState> {
  const windowStartISO = new Date(now - a.windowDays * MS_DAY).toISOString()
  const windowEnd24hISO = new Date(now - 24 * MS_HOUR).toISOString()

  const convs = await fetchJSON<ConvRow[]>(
    `${supabaseUrl}/rest/v1/conversations?assistant_id=eq.${ASSISTANT_ID}&status=eq.active&type=eq.live&select=id,customer_id,status,outcome,ai_paused_at,sales_cancelled_at&limit=500`,
    { headers: h() }
  )
  if (convs.length === 0) return { candidates: [], sentKeys: new Set(), attempt2DueByKey: new Map() }

  const convIds = convs.map((c) => c.id)
  const custIds = [...new Set(convs.map((c) => c.customer_id).filter((x): x is string => !!x))]
  if (custIds.length === 0) return { candidates: [], sentKeys: new Set(), attempt2DueByKey: new Map() }

  const [msgs, custs, out, evs] = await Promise.all([
    fetchJSON<MsgRow[]>(
      `${supabaseUrl}/rest/v1/messages?conversation_id=in.(${convIds.join(',')})&role=eq.user&created_at=gte.${encodeURIComponent(windowStartISO)}&created_at=lt.${encodeURIComponent(windowEnd24hISO)}&select=conversation_id,created_at&order=created_at.desc&limit=5000`,
      { headers: h() }
    ),
    fetchJSON<CustRow[]>(
      `${supabaseUrl}/rest/v1/customers?id=in.(${custIds.join(',')})&select=id,phone,status,recovery_opt_out_at`,
      { headers: h() }
    ),
    fetchJSON<OutRow[]>(
      `${supabaseUrl}/rest/v1/channel_messages?customer_id=in.(${custIds.join(',')})&channel=eq.whatsapp&direction=eq.outgoing&select=customer_id,created_at,metadata&order=created_at.desc&limit=5000`,
      { headers: h() }
    ),
    fetchJSON<EvRow[]>(
      `${supabaseUrl}/rest/v1/sales_events?conversation_id=in.(${convIds.join(',')})&select=conversation_id,event_type,created_at&limit=5000`,
      { headers: h() }
    ),
  ])

  const lastInboundByConv = new Map<string, string>()
  for (const m of msgs) {
    if (!m.conversation_id) continue
    const cur = lastInboundByConv.get(m.conversation_id)
    if (!cur || new Date(m.created_at) > new Date(cur)) lastInboundByConv.set(m.conversation_id, m.created_at)
  }

  const custById = new Map(custs.map((c) => [c.id, c] as const))

  const lastOutByCust = new Map<string, string>()
  const sentKeys = new Set<string>()
  const attempt2DueByKey = new Map<string, number>()
  for (const o of out) {
    if (!o.customer_id) continue
    const cur = lastOutByCust.get(o.customer_id)
    if (!cur || new Date(o.created_at) > new Date(cur)) lastOutByCust.set(o.customer_id, o.created_at)
    const meta = o.metadata
    if (meta && meta.recovery === true) {
      const attempt = meta.recovery_attempt
      const version = meta.recovery_inbound_version
      if ((attempt === 1 || attempt === 2) && typeof version === 'string') {
        sentKeys.add(key(o.customer_id, attempt, version))
        if (attempt === 1 && typeof meta.retro_attempt2_due_at === 'number') {
          attempt2DueByKey.set(key(o.customer_id, 1, version), meta.retro_attempt2_due_at)
        }
      }
    }
  }

  const evByConv = new Map<string, EvRow[]>()
  for (const e of evs) {
    if (!e.conversation_id) continue
    const list = evByConv.get(e.conversation_id) ?? []
    list.push(e)
    evByConv.set(e.conversation_id, list)
  }

  const candidates: Candidate[] = []
  for (const conv of convs) {
    const custId = conv.customer_id
    if (!custId) continue
    const cust = custById.get(custId)
    const lastInboundAt = lastInboundByConv.get(conv.id)
    if (!lastInboundAt) continue

    const events = evByConv.get(conv.id) ?? []
    const hasCommercial = events.some(
      (e) => e.event_type === 'SALE_STARTED' || e.event_type === 'PRODUCT_SELECTED'
    )
    const latestClosing = latestBy(
      events.filter(
        (e) => e.event_type === 'SALE_WON' || e.event_type === 'SALE_LOST' || e.event_type === 'SALE_CANCELLED'
      )
    )
    const openAfter = latestClosing
      ? events.some(
          (e) =>
            (e.event_type === 'SALE_STARTED' || e.event_type === 'PRODUCT_SELECTED') &&
            new Date(e.created_at).getTime() > new Date(latestClosing.created_at).getTime()
        )
      : false
    const hasConfirmedOrder = latestClosing?.event_type === 'SALE_WON' && !openAfter
    const hasRejectedOffer =
      (latestClosing?.event_type === 'SALE_LOST' && !openAfter) ||
      conv.outcome === 'not_interested' ||
      cust?.status === 'lost'

    const lastMia = lastOutByCust.get(custId) ?? null
    const phone = cust?.phone ?? null

    if (!phone) continue
    if (cust?.recovery_opt_out_at) continue
    if (!hasCommercial) continue
    if (conv.status !== 'active') continue
    if (conv.ai_paused_at) continue
    if (conv.sales_cancelled_at) continue
    if (hasConfirmedOrder) continue
    if (hasRejectedOffer) continue
    if (!lastMia || new Date(lastMia).getTime() <= new Date(lastInboundAt).getTime()) continue

    const v = lastInboundAt
    const k1 = key(custId, 1, v)
    const k2 = key(custId, 2, v)

    if (!sentKeys.has(k1)) {
      candidates.push({
        convId: conv.id,
        custId,
        phone,
        lastInboundAt: v,
        attempt: 1,
        content: recoveryTextFor(1),
        attempt2DueAt: null,
      })
    } else if (!sentKeys.has(k2)) {
      const stored = attempt2DueByKey.get(k1)
      candidates.push({
        convId: conv.id,
        custId,
        phone,
        lastInboundAt: v,
        attempt: 2,
        content: recoveryTextFor(2),
        attempt2DueAt: stored ?? now + rand(a.attempt2Min, a.attempt2Max) * MS_MIN,
      })
    }
  }

  return { candidates, sentKeys, attempt2DueByKey }
}

async function stillEligible(c: Candidate): Promise<{ ok: boolean; reason?: string }> {
  const [convRows, lastMsgs, custRows] = await Promise.all([
    fetchJSON<Pick<ConvRow, 'status' | 'outcome' | 'ai_paused_at'>[]>(
      `${supabaseUrl}/rest/v1/conversations?id=eq.${c.convId}&select=status,outcome,ai_paused_at&limit=1`,
      { headers: h() }
    ),
    fetchJSON<{ created_at: string }[]>(
      `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${c.convId}&role=eq.user&select=created_at&order=created_at.desc&limit=1`,
      { headers: h() }
    ),
    fetchJSON<Pick<CustRow, 'recovery_opt_out_at'>[]>(
      `${supabaseUrl}/rest/v1/customers?id=eq.${c.custId}&select=recovery_opt_out_at&limit=1`,
      { headers: h() }
    ),
  ])
  const conv = convRows[0]
  if (!conv) return { ok: false, reason: 'conversation_missing' }
  if (custRows[0]?.recovery_opt_out_at) return { ok: false, reason: 'opted_out' }
  if (conv.status !== 'active') return { ok: false, reason: 'conversation_closed' }
  if (conv.ai_paused_at) return { ok: false, reason: 'human_takeover' }
  if (conv.outcome === 'not_interested') return { ok: false, reason: 'offer_rejected' }
  const newestInbound = lastMsgs[0]?.created_at ?? null
  if (newestInbound !== c.lastInboundAt) return { ok: false, reason: 'new_inbound' }
  return { ok: true }
}

async function insertProcessing(c: Candidate, attempt2DueAt: number | null): Promise<string | undefined> {
  const metadata: Record<string, unknown> = {
    recovery: true,
    recovery_attempt: c.attempt,
    recovery_inbound_version: c.lastInboundAt,
    recovery_retroactive: true,
  }
  if (c.attempt === 1 && attempt2DueAt !== null) metadata.retro_attempt2_due_at = attempt2DueAt

  const r = await fetch(`${supabaseUrl}/rest/v1/channel_messages`, {
    method: 'POST',
    headers: { ...h(), Prefer: 'return=representation' },
    body: JSON.stringify({
      business_id: BUSINESS_ID,
      customer_id: c.custId,
      channel: 'whatsapp',
      direction: 'outgoing',
      content: c.content,
      status: 'processing',
      metadata,
    }),
  })
  if (!r.ok) throw new Error(`insert channel_messages ${r.status}`)
  const rows = (await r.json()) as { id?: string }[]
  return rows[0]?.id
}

async function updateCm(id: string, patch: Record<string, unknown>): Promise<void> {
  const r = await fetch(`${supabaseUrl}/rest/v1/channel_messages?id=eq.${id}`, {
    method: 'PATCH',
    headers: h(),
    body: JSON.stringify(patch),
  })
  if (!r.ok) throw new Error(`update channel_messages ${r.status}`)
}

async function insertSignal(c: Candidate): Promise<void> {
  const r = await fetch(`${supabaseUrl}/rest/v1/mia_signals`, {
    method: 'POST',
    headers: h(),
    body: JSON.stringify({
      business_id: BUSINESS_ID,
      type: 'SALES',
      priority: 'info',
      title: 'Recuperación retroactiva enviada',
      message: `Intento ${c.attempt} retroactivo enviado a ${maskPhone(c.phone)}`,
      source: 'recovery-backfill',
      status: 'active',
      action_available: null,
      action_payload: { customer_id: c.custId, attempt: c.attempt },
    }),
  })
  if (!r.ok) throw new Error(`insert mia_signals ${r.status}`)
}

async function sendViaBridge(c: Candidate): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${bridgeUrl}/v1/sessions/${BUSINESS_ID}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-mia-bridge-secret': bridgeSecret },
    body: JSON.stringify({ to: c.phone, content: c.content }),
  })
  if (res.ok) return { ok: true }
  const t = await res.text().catch(() => '')
  return { ok: false, error: `${res.status} ${t}` }
}

async function runPass(a: Args, now: number): Promise<{ sent: number; skipped: number; failed: number }> {
  const state = await scan(a, now)
  let list = state.candidates
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  if (a.limit > 0) list = list.slice(0, a.limit)

  let sent = 0
  let skipped = 0
  let failed = 0
  let sinceBreak = 0
  const nextBreakAt = rand(a.breakEveryMin, a.breakEveryMax)

  for (const c of list) {
    if (c.attempt === 2 && c.attempt2DueAt !== null && Date.now() < c.attempt2DueAt) {
      skipped++
      continue
    }
    await waitUntilWindow(a)

    const fresh = await stillEligible(c)
    if (!fresh.ok) {
      console.log(`[backfill] skip ${shortId(c.convId)} (${fresh.reason})`)
      skipped++
      continue
    }

    const attempt2DueAt =
      c.attempt === 1 ? Date.now() + rand(a.attempt2Min, a.attempt2Max) * MS_MIN : null

    let rowId: string | undefined
    try {
      rowId = await insertProcessing(c, attempt2DueAt)
    } catch (e) {
      console.error('[backfill] marker insert failed:', e)
      failed++
      continue
    }

    const result = await sendViaBridge(c)
    if (result.ok) {
      if (rowId) await updateCm(rowId, { status: 'sent', sent_at: new Date().toISOString() })
      await insertSignal(c)
      sent++
      console.log(`[backfill] sent #${sent} (attempt ${c.attempt}) to ${maskPhone(c.phone)}`)
    } else {
      if (rowId) await updateCm(rowId, { status: 'failed', error_message: result.error ?? 'bridge error' })
      failed++
      console.error('[backfill] send failed:', result.error)
    }

    sinceBreak++
    if (sinceBreak >= nextBreakAt) {
      const br = rand(a.breakMin, a.breakMax) * MS_MIN
      console.log(`[backfill] long break ${Math.round(br / MS_MIN)}min`)
      await sleep(br)
      sinceBreak = 0
    } else {
      const gap = rand(a.minGapMin, a.maxGapMin) * MS_MIN
      await sleep(gap)
    }
  }

  return { sent, skipped, failed }
}

async function main() {
  const raw = process.argv.slice(2)
  const a = parseArgs(raw)
  if (a.bridgeUrl) bridgeUrl = a.bridgeUrl
  if (!supabaseUrl || !supabaseKey) {
    console.error('[backfill] missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }
  if (a.send && (!bridgeUrl || !bridgeSecret)) {
    console.error('[backfill] missing WHATSAPP_BRIDGE_URL / WHATSAPP_BRIDGE_SECRET in .env.local')
    process.exit(1)
  }
  if (a.send && /localhost|127\.0\.0\.1/.test(bridgeUrl) && !a.allowLocalhost) {
    console.error(
      `[backfill] refusing to send to a local bridge (${bridgeUrl}). ` +
        'Pass --bridge-url=https://mia-whatsapp-bridge.fly.dev (or --allow-localhost).'
    )
    process.exit(1)
  }

  // Quiet hours come from the business config unless the CLI overrides them.
  const hoursProvided = raw.some((x) => x.startsWith('--hours='))
  const tzProvided = raw.some((x) => x.startsWith('--tz='))
  try {
    const cfg = await fetchSalesConfig()
    if (cfg) {
      if (!tzProvided && cfg.timezone) a.tz = cfg.timezone
      if (!hoursProvided) {
        if (cfg.recovery_sending_start_hour !== null) a.hourStart = cfg.recovery_sending_start_hour
        if (cfg.recovery_sending_end_hour !== null) a.hourEnd = cfg.recovery_sending_end_hour
      }
    }
  } catch (e) {
    console.error('[backfill] could not load business_sales_config, using CLI/default window:', e)
  }

  const now = Date.now()
  console.log('[backfill] mode:', a.send ? 'SEND' : 'DRY-RUN', '| watch:', a.watch)
  console.log('[backfill] bridge:', bridgeUrl)
  console.log('[backfill] window:', `${a.windowDays}d -> 24h`, '| hours:', `${a.hourStart}-${a.hourEnd} ${a.tz}`)

  const state = await scan(a, now)
  let preview = state.candidates
  for (let i = preview.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[preview[i], preview[j]] = [preview[j], preview[i]]
  }
  if (a.limit > 0) preview = preview.slice(0, a.limit)

  console.log(`\n[backfill] ELIGIBLE: ${preview.length} (de ${state.candidates.length})`)
  console.table(
    preview.map((c, i) => ({
      n: i + 1,
      conv: shortId(c.convId),
      cust: shortId(c.custId),
      phone: maskPhone(c.phone),
      lastInbound: `${Math.floor((now - new Date(c.lastInboundAt).getTime()) / MS_HOUR)}h`,
      attempt: c.attempt,
      due: c.attempt2DueAt ? new Date(c.attempt2DueAt).toISOString() : 'now',
    }))
  )

  if (!a.send) {
    console.log('\n[backfill] DRY-RUN. Nada enviado. Usa --send para enviar con goteo irregular.')
    return
  }

  console.log('\n[backfill] starting drip...')
  const totals = await runPass(a, Date.now())
  if (a.watch) {
    while (true) {
      await sleep(5 * MS_MIN)
      const r = await runPass(a, Date.now())
      totals.sent += r.sent
      totals.skipped += r.skipped
      totals.failed += r.failed
      if (r.sent === 0 && r.skipped === 0) break
    }
  }
  console.log(`\n[backfill] DONE sent=${totals.sent} skipped=${totals.skipped} failed=${totals.failed}`)
}

main().catch((e) => {
  console.error('[backfill] fatal:', e)
  process.exit(1)
})
