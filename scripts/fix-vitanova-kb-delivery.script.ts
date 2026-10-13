import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const env = {}
for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY

const ID = '5328e2df-4574-405e-9927-5ba007e4df53'
// Alinea con la regla de entrega: nunca el mismo día, días por ciudad desde la
// sección de cobertura. Evita afirmar "mismo día en León" (contradice el prompt).
const ANSWER =
  'Hacemos entregas a domicilio en las ciudades con cobertura: León, Aguascalientes, Lagos de Moreno, Irapuato, Silao y Guanajuato Capital. Los días de entrega varían por ciudad; si me confirmas tu municipio, te digo el día y horario exactos. Ninguna entrega se coordina el mismo día: siempre se programa para el siguiente día de entrega de tu ciudad.'

function h() {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

async function main() {
  const res = await fetch(`${url}/rest/v1/knowledge_items?id=eq.${ID}`, {
    method: 'PATCH',
    headers: { ...h(), Prefer: 'return=representation' },
    body: JSON.stringify({ answer: ANSWER }),
  })
  const body = await res.json()
  console.log(res.status, JSON.stringify(body))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})