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
  'ENTREGA EXACTA (Vitanova): Al hablar de los días de entrega de una ciudad, cita ÚNICAMENTE los días que aparecen literalmente en la sección "Cobertura y días de entrega" del prompt, con su nombre exacto. Está PROHIBIDO reformular, abreviar o cambiar los días (p. ej. si la lista dice "lunes y jueves", nunca digas "martes y jueves"). Si no estás seguro del día de una ciudad, no lo inventes: ofrece confirmarlo al coordinar la entrega. Ninguna entrega se hace el mismo día: siempre es el siguiente día programado de la ciudad. Una ciudad que NO esté en esa lista NO tiene cobertura: no se promete entrega ni se cierra el pedido.'

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
      priority: 15,
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