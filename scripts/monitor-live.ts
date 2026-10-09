import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUSINESS = process.env.MONITOR_BUSINESS_ID ?? '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'
const WINDOW_MS = (Number(process.env.MONITOR_SECONDS ?? 105) || 105) * 1000
const LOOKBACK_SECONDS = Number(process.env.MONITOR_LOOKBACK_SECONDS ?? 4) || 4
const INTERVAL_MS = 1200

if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key)
const startIso = new Date(Date.now() - LOOKBACK_SECONDS * 1000).toISOString()

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-AR', { hour12: false }) : '??'

const clip = (s: string | null | undefined, n = 180) => {
  if (!s) return ''
  const flat = s.replace(/\s+/g, ' ').trim()
  return flat.length > n ? flat.slice(0, n) + '…' : flat
}

const seen = new Set<string>()

function print(
  tag: string,
  row: { id?: string; created_at?: string | null },
  body: string,
) {
  const key = `${tag}:${row.id ?? '?'}`
  if (seen.has(key)) return
  seen.add(key)
  console.log(`[${fmt(row.created_at)}] ${body}`)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function poll() {
  const { data: assistants } = await admin
    .from('assistants')
    .select('id')
    .eq('business_id', BUSINESS)
  const assistantIds = (assistants ?? []).map((a) => a.id)

  let conversationIds: string[] = []
  if (assistantIds.length > 0) {
    const { data: convos } = await admin
      .from('conversations')
      .select('id')
      .in('assistant_id', assistantIds)
    conversationIds = (convos ?? []).map((c) => c.id)
  }

  const { data: cm } = await admin
    .from('channel_messages')
    .select('id, created_at, direction, content, status, external_customer_id')
    .eq('business_id', BUSINESS)
    .gt('created_at', startIso)
    .order('created_at', { ascending: true })
  for (const r of cm ?? []) {
    const dir = r.direction === 'incoming' ? '📥 Cliente' : '📤 MIA-enviado'
    print(`cm:${r.id}`, r, `${dir} [${r.status ?? ''}] ${clip(r.content)}`)
  }

  if (conversationIds.length > 0) {
    const { data: msgs } = await admin
      .from('messages')
      .select('id, created_at, role, content, metadata')
      .in('conversation_id', conversationIds)
      .eq('role', 'assistant')
      .gt('created_at', startIso)
      .order('created_at', { ascending: true })
    for (const r of msgs ?? []) {
      const meta = (r.metadata ?? {}) as Record<string, unknown>
      const req = typeof meta.request_type === 'string' ? meta.request_type : ''
      const guard = meta.guard_triggered ? ' ⚠️guard' : ''
      const humanizedFlag = meta.humanized === true ? ' ✨humanizado' : ''
      print(
        `msg:${r.id}`,
        r,
        `🤖 MIA${req ? ` [${req}]` : ''}${guard}${humanizedFlag}: ${clip(r.content)}`,
      )
    }
  }

  const { data: usage } = await admin
    .from('ai_usage')
    .select('id, created_at, request_type, model, tokens_input, tokens_output, cost')
    .eq('business_id', BUSINESS)
    .gt('created_at', startIso)
    .order('created_at', { ascending: true })
  for (const r of usage ?? []) {
    print(
      `ai:${r.id}`,
      r,
      `⚡ ai_usage [${r.request_type}] ${r.model} in${r.tokens_input ?? 0}/out${r.tokens_output ?? 0} $${(r.cost ?? 0).toFixed(5)}`,
    )
  }
}

async function main() {
  console.log(
    `👁 Monitor en vivo — business ${BUSINESS.slice(0, 8)}… desde ${fmt(startIso)} (ventana ${WINDOW_MS / 1000}s)`,
  )
  const started = Date.now()
  while (Date.now() - started < WINDOW_MS) {
    try {
      await poll()
    } catch (err) {
      console.error('poll error:', err instanceof Error ? err.message : err)
    }
    await sleep(INTERVAL_MS)
  }
  console.log('⏹ Ventana del monitor finalizada.')
}

main()