import { config } from 'dotenv'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'
const OUT_DIR = path.join('docs', 'analysis')

interface Row {
  external_customer_id: string | null
  direction: 'incoming' | 'outgoing'
  content: string
  received_at: string
  metadata: Record<string, unknown> | null
}

function authorOf(row: Row): string {
  const label = row.metadata?.author_label
  if (typeof label === 'string') {
    if (label === 'human') return 'HUMANA'
    if (label === 'bot') return 'bot'
    if (label === 'bot_bug') return 'bug'
    return 'CLIENTE'
  }
  return 'CLIENTE'
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('channel_messages')
    .select('external_customer_id, direction, content, received_at, metadata')
    .eq('business_id', BUSINESS_ID)
    .like('external_id', 'harvest:%')
    .order('received_at', { ascending: true })

  if (error) throw error

  const rows = (data ?? []) as Row[]
  const conversations = new Map<string, Row[]>()
  for (const row of rows) {
    const key = row.external_customer_id ?? '(sin telefono)'
    const list = conversations.get(key) ?? []
    list.push(row)
    conversations.set(key, list)
  }

  const ranked = [...conversations.entries()].sort((a, b) => b[1].length - a[1].length)

  const lines: string[] = []
  lines.push('# Conversaciones historicas (cosecha Android, mayo-julio 2026)')
  lines.push('')
  lines.push('LEYENDA: CLIENTE = mensaje entrante | HUMANA = vendedora real | bot = menu automatico')
  lines.push('')

  let convIndex = 0
  for (const [phone, msgs] of ranked) {
    const humanCount = msgs.filter((m) => authorOf(m) === 'HUMANA').length
    convIndex += 1
    lines.push('')
    lines.push('='.repeat(78))
    lines.push(
      `CONVERSACION ${String(convIndex).padStart(2, '0')}  ${phone}  |  ${msgs.length} mensajes  |  ${humanCount} humanos`
    )
    lines.push('='.repeat(78))
    for (const m of msgs) {
      const who = authorOf(m)
      const stamp = m.received_at.replace('T', ' ').slice(0, 16)
      const body = String(m.content).replace(/\r/g, '').trim()
      lines.push(`[${stamp}] ${who.padEnd(8)} ${body.replace(/\n/g, '\n           ')}`)
    }
  }

  writeFileSync(path.join(OUT_DIR, 'harvest-conversations.txt'), lines.join('\n'), 'utf8')

  const humans = rows.filter((r) => authorOf(r) === 'HUMANA')
  const customers = rows.filter((r) => r.direction === 'incoming')
  console.log('conversaciones      :', conversations.size)
  console.log('mensajes humanos    :', humans.length)
  console.log('mensajes de cliente :', customers.length)
  console.log('escrito en          : docs/analysis/harvest-conversations.txt')
}

main().catch((error: unknown) => {
  console.error('ERROR:', error)
  process.exit(1)
})