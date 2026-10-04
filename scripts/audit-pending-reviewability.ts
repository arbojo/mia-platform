/**
 * Auditoría de revisabilidad de learning_events pendientes.
 *
 * Responde a una pregunta concreta: ¿puede un humano aprobar o rechazar cada
 * evento a través de la API, o queda atascado (visible en la base, invisible en
 * la UI, irresoluble desde la aplicación)?
 *
 * Replica las condiciones reales del flujo usando las MISMAS reglas que la
 * aplicación, importadas desde `@/lib/knowledge/teaching`. No hardcodea los
 * filtros: si divergen, el diagnóstico mentiría.
 *
 * Antes de existir ese módulo compartido, 8 de 15 eventos estaban atascados
 * (incluidos los 4 críticos) porque el flujo solo cubría 3 de los 5
 * correction_type y exigía corrected_response.
 *
 * Solo lectura. No escribe nada.
 */

import { config } from 'dotenv'
import { createAdminClient } from '../src/lib/supabase/admin'
import { resolveTeachingContent, TEACHING_TARGET } from '../src/lib/knowledge/teaching'

config({ path: '.env.local' })

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

type PendingEvent = {
  category: string | null
  correction_type: string | null
  severity: string | null
  status: string | null
  original_response: string | null
  corrected_response: string | null
  knowledge_change: Record<string, unknown> | null
}

async function main() {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('learning_events')
    .select('category,correction_type,severity,status,original_response,corrected_response,knowledge_change')
    .eq('business_id', BUSINESS_ID)
    .eq('status', 'pending')

  if (error) {
    console.error('ERROR: ' + error.message)
    process.exit(1)
  }

  const rows = (data ?? []) as PendingEvent[]

  const reasons = (e: PendingEvent): string[] => {
    const found: string[] = []
    if (!(e.correction_type in TEACHING_TARGET)) {
      found.push(`tipo '${e.correction_type}' no soportado`)
    }
    if (!resolveTeachingContent({
      correction_type: 'mistake_prevention',
      category: e.category,
      original_response: e.original_response,
      corrected_response: e.corrected_response,
      knowledge_change: e.knowledge_change,
    })) {
      found.push('sin contenido aprobable')
    }
    return found
  }

  const stuck = rows.filter((e) => reasons(e).length > 0)

  console.log(`learning_events pendientes: ${rows.length}`)
  console.log(`  revisables por la UI:      ${rows.length - stuck.length}`)
  console.log(`  atascados:                 ${stuck.length}`)
  console.log('')

  for (const e of rows.slice().sort((a, b) => (a.correction_type ?? '').localeCompare(b.correction_type ?? ''))) {
    const found = reasons(e)
    const target = (e.correction_type ?? '') in TEACHING_TARGET
      ? TEACHING_TARGET[e.correction_type as keyof typeof TEACHING_TARGET]
      : '-'

    console.log(
      [
        (e.severity ?? '?').padEnd(9),
        (e.correction_type ?? '?').padEnd(17),
        (e.category ?? '').padEnd(36),
        ('-> ' + target).padEnd(18),
        found.length ? 'ATASCADO: ' + found.join(' + ') : 'ok',
      ].join(' ')
    )
  }
}

main()