import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const env = {}
for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
const BIZ = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

const INSTRUCTION =
  'PRECIO DESDE EL CATÁLOGO (Vitanova): Todo monto o precio que MIA escriba debe leerse literalmente del bloque de Productos (catálogo) del prompt o de la base de conocimiento. Está PROHIBIDO escribir un precio de memoria, calculado o inventado, o asignarle a un producto el precio de otro. Si el precio exacto no aparece en el contexto, no lo escribas: di que lo confirmas antes de darlo. Verifica además que el monto corresponda a la presentación correcta que se vende (el precio del paquete, no de una pieza suelta).'

function h() {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

async function main() {
  const existing = await fetch(
    `${url}/rest/v1/ai_instructions?business_id=eq.${BIZ}&instruction=eq.${encodeURIComponent(INSTRUCTION)}&select=id`,
    { headers: h() }
  ).then((r) => r.json())

  if (existing.length > 0) {
    console.log('Ya existe, no se inserta. id=', existing[0].id)
    return
  }

  const res = await fetch(`${url}/rest/v1/ai_instructions`, {
    method: 'POST',
    headers: { ...h(), Prefer: 'return=representation' },
    body: JSON.stringify({
      business_id: BIZ,
      instruction: INSTRUCTION,
      priority: 14,
      source: 'manual',
      is_active: true,
    }),
  })
  console.log(res.status, JSON.stringify(await res.json()))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})