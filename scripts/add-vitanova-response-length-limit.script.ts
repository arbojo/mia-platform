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
  'RESPUESTAS MÁXIMO 5 LÍNEAS (Vitanova): Ninguna respuesta puede ocupar más de 5 líneas, en ningún caso ni producto (dudas de producto, precios, cobertura, objeciones, cierre, seguimiento y ofertas). ÚNICA excepción: el bloque de captura/confirmación de la dirección de entrega (nombre, teléfono, ciudad y dirección), que sí puede ser más extenso. Mantén las respuestas cortas, directas y sin relleno.'

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
      priority: 16,
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