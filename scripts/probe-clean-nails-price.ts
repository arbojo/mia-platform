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

  // Cronologia: cual de los dos precios aparece primero y cual es el mas reciente.
  const at499 = rows.filter((r) => /clean ?nails/i.test(flat(r.content)) && flat(r.content).includes('$499'))
  const at550 = rows.filter((r) => /clean ?nails/i.test(flat(r.content)) && flat(r.content).includes('$550'))
  const range = (xs: Row[]) =>
    xs.length ? `${xs[0].received_at.slice(0, 10)} -> ${xs[xs.length - 1].received_at.slice(0, 10)}` : '(nada)'

  console.log('CRONOLOGIA DE LOS PRECIOS DE Clean Nails')
  console.log(`   $499/$799 (menu) : ${at499.length} msgs  ${range(at499)}`)
  console.log(`   $550             : ${at550.length} msgs  ${range(at550)}`)

  const last499 = at499[at499.length - 1]?.received_at ?? ''
  const last550 = at550[at550.length - 1]?.received_at ?? ''
  console.log()
  console.log(
    last499 > last550
      ? `   -> $499/$799 es MAS RECIENTE (ultimo uso ${last499.slice(0, 10)})`
      : `   -> $550 es MAS RECIENTE (ultimo uso ${last550.slice(0, 10)})`
  )

  console.log()
  console.log('='.repeat(74))
  console.log('PRODUCTOS EN LA BASE')
  console.log('='.repeat(74))
  const { data: products, error: pErr } = await admin
    .from('products')
    .select('*')
    .eq('business_id', BUSINESS_ID)
  if (pErr) throw pErr
  console.log(`   ${(products ?? []).length} productos`)
  for (const p of (products ?? []) as Array<Record<string, unknown>>) {
    const name = String(p.name ?? p.title ?? '(sin nombre)')
    const price = p.price ?? p.base_price ?? p.unit_price ?? '(sin precio)'
    console.log(`   ${p.id}  ${name.padEnd(28)} precio=${price}  activo=${p.is_active ?? p.active ?? '-'}`)
    const extra = p.description ? `      desc: ${flat(String(p.description)).slice(0, 110)}` : ''
    console.log(extra)
  }
}

main().catch((e: unknown) => {
  console.error('ERROR:', e)
  process.exit(1)
})