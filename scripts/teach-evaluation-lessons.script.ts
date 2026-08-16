import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const VITANOVA_OWNER_EMAIL = 'arbojo@gmail.com'

const LESSONS: Array<{ instruction: string }> = [
  {
    instruction:
      'Al abordar la inquietud del cliente sobre la efectividad de un producto (ej. tiras Bella Patch), valida primero su preocupación con empatía (ej. "Entiendo que quieras asegurarte") y responde con el efecto honesto por producto según tu conocimiento (efecto inmediato y temporal vs gradual con constancia). Si el cliente pide testimonios o estudios, no los inventes: ofrece que el equipo comparta evidencia real por WhatsApp.',
  },
  {
    instruction:
      'Al presentar un producto, anticipa de forma breve y natural la duda de efectividad: menciona el tipo de efecto (inmediato y temporal para Back2Fit y Bella Patch; gradual con constancia para Clean Nails y Bye Canas; apoyo de comodidad para Neurofeet y Neurotin) según tu conocimiento, sin extenderte si el cliente no lo pide.',
  },
  {
    instruction:
      'Varía las preguntas de cierre: no repitas la misma frase en mensajes consecutivos. Intenta cerrar solo cuando el cliente haya mostrado interés concreto (preguntó por precio, envío o formas de pago) o pida comprar; en fase de información, responde y sostén el cierre.',
  },
]

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) out[match[1]] = match[2].trim()
  }
  return out
}

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, serviceRole)

  const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const owner = users.users.find((u) => u.email?.toLowerCase() === VITANOVA_OWNER_EMAIL)
  if (!owner) {
    console.error(`Owner ${VITANOVA_OWNER_EMAIL} not found.`)
    process.exit(1)
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', owner.id)
    .eq('name', 'Vitanova')
    .maybeSingle()
  if (!business) {
    console.error('Vitanova business not found.')
    process.exit(1)
  }

  const { data: existing } = await supabase
    .from('ai_instructions')
    .select('id, instruction')
    .eq('business_id', business.id)
    .eq('source', 'correction')

  const existingTexts = new Set((existing ?? []).map((i) => i.instruction.trim()))

  let inserted = 0
  for (const lesson of LESSONS) {
    const text = lesson.instruction.trim()
    if (existingTexts.has(text)) {
      console.log(`∃ ya existe: ${text.slice(0, 60)}...`)
      continue
    }

    const { data, error } = await supabase
      .from('ai_instructions')
      .insert({
        business_id: business.id,
        instruction: text,
        source: 'correction',
      })
      .select('id')
      .single()

    if (error) {
      console.error(`Insert failed: ${error.message}`)
      process.exit(1)
    }

    await supabase.from('knowledge_versions').insert({
      business_id: business.id,
      entity_type: 'ai_instruction',
      entity_id: data.id,
      new_value: { instruction: text },
      change_source: 'correction',
      changed_by: owner.id,
    })

    inserted += 1
    console.log(`✓ instrucción insertada: ${text.slice(0, 60)}...`)
  }

  console.log(`\nListo: ${inserted} insertada(s), ${LESSONS.length - inserted} ya existente(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
