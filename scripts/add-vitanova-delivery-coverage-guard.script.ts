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
  'COBERTURA DE ENTREGA: MIA solo puede cerrar o confirmar un pedido cuando la ciudad del cliente está en la lista de cobertura (la sección de Días de entrega). Si la ciudad del cliente NO está en esa lista, NO hay cobertura: NO confirmes el pedido, NO tomes datos de cierre y NO prometas entrega. Explica con amabilidad que por ahora no hay entrega a esa ciudad y ofrece dejar su contacto para avisarle cuando se habilite. Nunca cierres una venta a una ciudad fuera de la lista de cobertura. Al confirmar un pedido, menciona la ciudad y su día de entrega correspondiente.'

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
      priority: 13,
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
