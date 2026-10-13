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

// Instrucciones DUPLICADAS → inactivar (no borrar). Se conservan:
//   p11 19981d1e (Neurotin/Neurofeet) sobre d3cea3de (p10) y f5ba560d (p9).
//   p-4 3a773123 (lectura del mensaje del cliente) sobre su gemela 49e99970.
const DISABLE = [
  'd3cea3de-4893-41d9-a289-2d31b47ec880',
  'f5ba560d-faac-4d52-bae6-bdcca9b75975',
  '49e99970-c5ff-49bb-86c1-42eb5bd84baa',
]

// p9 759b66e4 se reescribe para eliminar el conflicto con la regla de
// Diabetic Patch (p12) y con el molde prohibido por p6: no "ya conoces tu
// situación" y no la aclaración "no es un tratamiento" por iniciativa propia.
const REWRITE_ID = '759b66e4-b3da-4499-ae5e-bca3ba4f24cb'
const REWRITE =
  'MANEJO DE CONDICIONES YA NOMBRADAS (Vitanova): Si el cliente ya nombró su condición (diabetes, neuropatía, hongos en uñas, circulación, etc.), MIA NO lo deriva a un médico ni usa palabras de severidad como excusa; reencuadra en positivo con un beneficio concreto de vida diaria (p. ej. dormir mejor, caminar con menos pesadez, apoyo en la planta del pie) y continúa naturalmente con el precio o el cierre. ÚNICO caso de derivación: síntomas agudos sin diagnóstico previo (dolor de pecho, dificultad para respirar, desmayo); ahí deriva de inmediato.\n\nReglas:\n- Prohibido usar el molde "Como tú ya conoces tu situación" ni "Entiendo que [sensación] puede ser incómodo/a": varía siempre la redacción.\n- Prohibido responder "no" o "no aplica" a un cliente que ya nombró su condición: añade el producto igual.\n- Conforme a la regla de Diabetic Patch, NO se aclara por iniciativa propia que algo "no es un medicamento" ni "no es un tratamiento médico": ese matiz SOLO se menciona si el cliente pregunta directamente por él.'

// p10: tuteo español de México (sin voseo).
const TUTEO =
  'IDIOMA Y TONO (Vitanova, México): MIA se dirige SIEMPRE al cliente de tú (tuteo), en español mexicano natural. Está PROHIBIDO el voseo (nunca "pasás", "tenés", "querés", "sos", "decíme", "podés"). Revisa cada respuesta antes de enviarla y elimina cualquier voseo.'

function h() {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

async function main() {
  for (const id of DISABLE) {
    const res = await fetch(`${url}/rest/v1/ai_instructions?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...h(), Prefer: 'return=representation' },
      body: JSON.stringify({ is_active: false }),
    })
    console.log('disable', id.slice(0, 8), res.status)
  }

  const upd = await fetch(`${url}/rest/v1/ai_instructions?id=eq.${REWRITE_ID}`, {
    method: 'PATCH',
    headers: { ...h(), Prefer: 'return=representation' },
    body: JSON.stringify({ instruction: REWRITE }),
  })
  console.log('rewrite', REWRITE_ID.slice(0, 8), upd.status)

  const existing = await fetch(
    `${url}/rest/v1/ai_instructions?business_id=eq.${BIZ}&instruction=eq.${encodeURIComponent(TUTEO)}&select=id`,
    { headers: h() }
  ).then((r) => r.json())

  if (existing.length === 0) {
    const res = await fetch(`${url}/rest/v1/ai_instructions`, {
      method: 'POST',
      headers: { ...h(), Prefer: 'return=representation' },
      body: JSON.stringify({
        business_id: BIZ,
        instruction: TUTEO,
        priority: 10,
        source: 'manual',
        is_active: true,
      }),
    })
    console.log('insert tuteo', res.status, JSON.stringify(await res.json()))
  } else {
    console.log('tuteo ya existe, no se inserta. id=', existing[0].id)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})