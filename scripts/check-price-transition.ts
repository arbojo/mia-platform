import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

interface Row {
  content: string
  received_at: string
  metadata: Record<string, unknown> | null
}

const flat = (s: string) => s.replace(/\s+/g, ' ').trim()
const label = (r: Row) => (typeof r.metadata?.author_label === 'string' ? r.metadata.author_label : 'customer')

async function main() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('channel_messages')
    .select('content, received_at, metadata')
    .eq('business_id', BUSINESS_ID)
    .like('external_id', 'harvest:%')
    .order('received_at', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as Row[]

  const nail = (r: Row) => /clean ?nails/i.test(flat(r.content))
  const at499 = rows.filter((r) => nail(r) && flat(r.content).includes('$499'))
  const at550 = rows.filter((r) => nail(r) && flat(r.content).includes('$550'))

  console.log('ULTIMOS 4 mensajes con el precio de $499/$799:')
  for (const r of at499.slice(-4)) {
    console.log(`   ${r.received_at.slice(0, 19)}  ${flat(r.content).slice(0, 95)}`)
  }
  console.log()
  console.log('PRIMEROS 4 mensajes con el precio de $550:')
  for (const r of at550.slice(0, 4)) {
    console.log(`   ${r.received_at.slice(0, 19)}  ${flat(r.content).slice(0, 95)}`)
  }

  const last499 = at499[at499.length - 1]?.received_at ?? ''
  const first550 = at550[0]?.received_at ?? ''
  console.log()
  console.log(`   ultimo $499/${last499.slice(0, 19)}`)
  console.log(`   primer $550 /${first550.slice(0, 19)}`)
  console.log(
    last499 > first550
      ? '   -> SOLAPE: el precio viejo se emitio DESPUES de empezar el nuevo'
      : '   -> sin solape: cambio de precio limpio'
  )

  // Conteo por dia para ver la transicion
  console.log()
  console.log('mensajes por dia (Clean Nails):')
  const perDay = new Map<string, Record<string, number>>()
  for (const r of rows.filter(nail)) {
    const day = r.received_at.slice(0, 10)
    const e = perDay.get(day) ?? { c499: 0, c550: 0 }
    if (flat(r.content).includes('$499')) e.c499 += 1
    if (flat(r.content).includes('$550')) e.c550 += 1
    perDay.set(day, e)
  }
  for (const [day, e] of perDay) {
    console.log(`   ${day}   $499:${String(e.c499).padStart(2)}   $550:${String(e.c550).padStart(2)}`)
  }

  const bogus = rows.filter((r) => /por favor,? elige|opción inválida|opcion invalida/i.test(flat(r.content)))
  if (bogus.length) {
    console.log()
    console.log(`mensajes de error de opcion del bot: ${bogus.length}`)
    for (const b of bogus.slice(0, 5)) console.log(`   [${label(b)}] ${flat(b.content).slice(0, 120)}`)
  }
}

main().catch((e: unknown) => {
  console.error('ERROR:', e)
  process.exit(1)
})