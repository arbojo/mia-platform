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

const label = (r: Row): string =>
  typeof r.metadata?.author_label === 'string' ? r.metadata.author_label : 'customer'

interface Failure {
  id: string
  title: string
  test: (r: Row) => boolean
  severity: 'critico' | 'alto' | 'medio'
}

const FAILURES: Failure[] = [
  {
    id: 'meta_leak',
    title: 'Fuga de instrucciones internas al cliente',
    severity: 'critico',
    test: (r) =>
      /mi base de datos|no tengo informaci[oó]n|reglas del juego|no puedo crear un mensaje|como puedo ayudar|soy un asistente/i.test(
        r.content
      ),
  },
  {
    id: 'menu_loop',
    title: 'Bucle de menús: el bot repite el menú al cliente',
    severity: 'critico',
    test: (r) => /qu[eé] te gustar[ií]a saber|para continuar, por favor elige|debes elegir un n[uú]mero/i.test(r.content),
  },
  {
    id: 'fabricated_testimonial',
    title: 'Testimonio inventado presentado como real',
    severity: 'critico',
    test: (r) =>
      /este cliente lleva|como puedes notar|ha dejado su tratamiento|cliente satisfecha|p[ií]en.*resultados/i.test(
        r.content
      ),
  },
  {
    id: 'unsupported_urgency',
    title: 'Urgencia o escasez sin sustento',
    severity: 'alto',
    test: (r) =>
      /se est[aá] agotando|cada d[ií]a sin|ap[uú]rate|últimos|ya se est[aá] acabando|spots disponibles/i.test(
        r.content
      ),
  },
  {
    id: 'followup_spam',
    title: 'Seguimiento automático después de que el humano ya respondió',
    severity: 'alto',
    test: (r) => /solo quer[ií]a saber si te qued[oó]|pudiste revisar la informaci[oó]n|d[ií]a qued[oó] alguna duda/i.test(r.content),
  },
  {
    id: 'sells_to_supplier',
    title: 'Vende a un proveedor que ofrece catálogo (intención invertida)',
    severity: 'critico',
    test: (r) => /marca directa|sin intermediarios|cat[aá]logo digital|lista de precios|mayoreo/i.test(r.content),
  },
]

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

  const isBot = (r: Row) => label(r) === 'bot' || label(r) === 'bot_bug'
  const botRows = rows.filter(isBot)
  const humanRows = rows.filter((r) => label(r) === 'human')
  const internalRows = rows.filter((r) => label(r) === 'internal')

  // Los fallos del bot y las tecnicas de la vendedora solo aplican a mensajes
  // salientes: un mensaje entrante del cliente no puede ser un fallo del bot.
  const outgoingRows = rows.filter((r) => r.direction === 'outgoing')

  const conversations = new Map<string, Row[]>()
  for (const r of rows) {
    const key = r.external_customer_id ?? '?'
    conversations.set(key, [...(conversations.get(key) ?? []), r])
  }

  const lines: string[] = []
  const push = (...p: unknown[]) => lines.push(p.join(' '))

  push('# Fallos del bot y tecnicas de la vendedora — evidencia cuantificada')
  push('')
  push('Autor de cada mensaje definido por regla determinista o por clasificacion de')
  push('estilo corregida; cada fila guarda `author_label_reason` en la base.')
  push('')
  push(`mensajes analizados      : ${rows.length}`)
  push(`conversaciones           : ${conversations.size}`)
  push(`mensajes del cliente     : ${rows.length - outgoingRows.length}`)
  push(`mensajes del bot         : ${botRows.length}`)
  push(`mensajes de la vendedora : ${humanRows.length}`)
  push(`mensajes internos        : ${internalRows.length} (excluidos del analisis)`)
  push('')
  push('='.repeat(76))
  push('FALLOS DEL BOT')
  push('='.repeat(76))
  push('')

  for (const failure of FAILURES) {
    const hits = outgoingRows.filter(failure.test)
    const hitBots = hits.filter(isBot)
    const hitHumans = hits.filter((r) => label(r) === 'human')
    const affected = new Set(hits.map((r) => r.external_customer_id)).size
    push(`[${failure.severity.toUpperCase()}] ${failure.title}`)
    push(
      `   ${hits.length} mensajes · ${hitBots.length} del bot · ${hitHumans.length} de la vendedora · ${affected} conversaciones afectadas`
    )
    for (const sample of hits.slice(0, 2)) {
      push(`   ej. [${label(sample)}] "${sample.content.replace(/\s+/g, ' ').slice(0, 120)}"`)
    }
    push('')
  }

  // Rafagas de bot: 3+ mensajes seguidos del bot
  let bursts = 0
  let longest = 0
  for (const msgs of conversations.values()) {
    let run = 0
    for (const m of msgs) {
      if (label(m) === 'bot' || label(m) === 'bot_bug') {
        run += 1
        if (run >= 3) bursts += 1
        longest = Math.max(longest, run)
      } else {
        run = 0
      }
    }
  }
  push('='.repeat(76))
  push('RAFAGAS DEL BOT (>=3 mensajes seguidos sin intervencion humana)')
  push('='.repeat(76))
  push(`   mensajes dentro de rafagas : ${bursts}`)
  push(`   rafaga mas larga           : ${longest} mensajes seguidos`)
  push('')

  // Coherencia de precios
  const prices = new Map<string, Set<string>>()
  for (const r of rows) {
    const m = r.content.match(/\$\s?([\d,]{3,7})/g)
    if (!m) continue
    const jid = r.external_customer_id ?? '?'
    const set = prices.get(jid) ?? new Set<string>()
    m.forEach((p) => set.add(p.replace(/\s/g, '')))
    prices.set(jid, set)
  }
  const conflicting = [...prices.entries()].filter(([, s]) => s.size > 1)
  push('='.repeat(76))
  push('PRECIO INCONSISTENTE DENTRO DE UNA MISMA CONVERSACION')
  push('='.repeat(76))
  push(`   conversaciones con mas de un precio citado: ${conflicting.length}`)
  for (const [jid, set] of conflicting.slice(0, 6)) {
    push(`   ${jid}: ${[...set].join(' , ')}`)
  }
  push('')

  push('='.repeat(76))
  push('TECNICAS DE LA VENDEDORA (ocurrencias)')
  push('='.repeat(76))
  const TECHNIQUES: Array<[string, RegExp]> = [
    ['reencuadra sin forzar la venta (ofrece agendar en vez de comprar)', /puede agendarlo|quedo a espera|agendar su envio/i],
    ['corrige al cliente con explicacion en vez de descartar', /no, es totalmente|no se preocupe|es totalmente mecanico/i],
    ['advierte con honestidad y reencuadra (no promete milagro)', /ya no se recupera|pero como puede ver|ayuda a que la/i],
    ['admite incertidumbre en vez de inventar certeza', /no se exactamente|no conozco a alguien|los tiempos son diferentes/i],
    ['lee la foto del cliente y personaliza', /como puede ver en la foto|de hecho veo|veo que solo es la/i],
    ['despacha la duda concreta en una frase', /^se usa dos veces|^no hay costo en el envio|^es recargable/i],
    ['cierra con disponibilidad concreta', /entregas diarias|entregamos todos los dias|mismo dia que agende/i],
    ['se disculpa del bot con humor', /una disculpa nuestro bot|jajaja/i],
    ['reduce friccion con pago contra entrega', /paga hasta que reciba|pago contra entrega|efectivo tarjeta o transferencia/i],
  ]
  for (const [name, re] of TECHNIQUES) {
    const human = humanRows.filter((r) => re.test(r.content)).length
    const bot = botRows.filter((r) => re.test(r.content)).length
    push(`   ${String(human).padStart(3)}x  vendedora   ${String(bot).padStart(3)}x  bot   ${name}`)
  }

  writeFileSync(path.join(OUT_DIR, 'harvest-bot-failures.md'), lines.join('\n'), 'utf8')
  console.log(lines.slice(0, 60).join('\n'))
  console.log('...')
  console.log('escrito en docs/analysis/harvest-bot-failures.md')
}

main().catch((error: unknown) => {
  console.error('ERROR:', error)
  process.exit(1)
})