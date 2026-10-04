import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

interface Row {
  external_customer_id: string | null
  direction: 'incoming' | 'outgoing'
  content: string
  received_at: string
  metadata: Record<string, unknown> | null
}

const label = (r: Row): string =>
  typeof r.metadata?.author_label === 'string' ? r.metadata.author_label : 'customer'
const isBot = (r: Row) => label(r) === 'bot' || label(r) === 'bot_bug'
const flat = (s: string) => s.replace(/\s+/g, ' ').trim()

async function main() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('channel_messages')
    .select('external_customer_id, direction, content, received_at, metadata')
    .eq('business_id', BUSINESS_ID)
    .like('external_id', 'harvest:%')
    .order('received_at', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as Row[]
  const outgoing = rows.filter((r) => r.direction === 'outgoing')

  console.log('='.repeat(78))
  console.log('CONTEXTO DE PRECIOS: la metrica "precio inconsistente" mezcla productos')
  console.log('='.repeat(78))
  const priceRows = outgoing.filter((r) => /\$\s?[\d,]{3,7}/.test(r.content))
  for (const r of priceRows.slice(0, 25)) {
    const ctx = flat(r.content).match(/.{0,70}\$\s?[\d,]{3,7}.{0,40}/)?.[0] ?? flat(r.content).slice(0, 110)
    console.log(`[${label(r).padEnd(5)}] ${ctx}`)
  }

  console.log()
  console.log('='.repeat(78))
  console.log('CITAS REALES POR FALLO DEL BOT')
  console.log('='.repeat(78))
  const FAILURES: Array<[string, RegExp]> = [
    ['testimonio_inventado', /este cliente lleva|este cliente tiene un mes|su uña era tan gruesa/i],
    ['meta_leak', /mi base de datos|no tengo informaci[oó]n|reglas del juego|no puedo crear un mensaje|como puedo ayudar|soy un asistente/i],
    ['menu_loop', /qu[eé] te gustar[ií]a saber|para continuar, por favor elige|debes elegir un n[uú]mero/i],
    ['followup_spam', /solo quer[ií]a saber si te qued[oó]|pudiste revisar la informaci[oó]n|d[ií]a qued[oó] alguna duda/i],
    ['unsupported_claims', /\+500 clientes|spots disponibles|se est[aá] agotando|ap[uú]rate/i],
  ]
  for (const [id, re] of FAILURES) {
    const hits = outgoing.filter((r) => re.test(r.content))
    const bots = hits.filter(isBot)
    const convos = new Set(bots.map((r) => r.external_customer_id)).size
    console.log()
    console.log(`--- ${id}: ${bots.length} mensajes del bot en ${convos} conversaciones ---`)
    for (const b of bots.slice(0, 4)) {
      console.log(`   (${(b.external_customer_id ?? '').slice(-4)}) ${flat(b.content).slice(0, 190)}`)
    }
  }

  console.log()
  console.log('='.repeat(78))
  console.log('CITAS REALES DE LA VENDEDORA (set humano, ya depurado)')
  console.log('='.repeat(78))
  const TECHNIQUES: Array<[string, RegExp]> = [
    ['honestidad_y_reencuadre', /ya no se recupera|pero como puede ver|ayuda a que la/i],
    ['admite_incertidumbre', /no se exactamente|no conozco a alguien|los tiempos son diferentes/i],
    ['lee_la_foto', /como puede ver en la foto|de hecho veo|veo que solo es la/i],
    ['una_frase', /^se usa dos veces|^no hay costo en el envio|^es recargable/i],
    ['humor_con_el_bot', /una disculpa nuestro bot|jajaja/i],
    ['reencuadra_sin_forzar', /puede agendarlo|quedo a espera|quedo a espera/i],
    ['cierre_concreto', /entregas a partir de|le llegaria hoy|mismo dia que agende/i],
  ]
  for (const [id, re] of TECHNIQUES) {
    const hits = rows.filter((r) => label(r) === 'human' && re.test(r.content))
    console.log()
    console.log(`--- ${id}: ${hits.length} mensajes ---`)
    for (const h of hits.slice(0, 4)) {
      console.log(`   (${(h.external_customer_id ?? '').slice(-4)}) ${flat(h.content).slice(0, 190)}`)
    }
  }
}

main().catch((e: unknown) => {
  console.error('ERROR:', e)
  process.exit(1)
})