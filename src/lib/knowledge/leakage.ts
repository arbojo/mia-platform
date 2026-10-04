/**
 * Detección de fuga de transcripción en instrucciones.
 *
 * Origen del problema: `propose-harvest-learnings.ts` metió texto crudo de
 * WhatsApp en el campo `corrected_response` de siete eventos, y
 * `resolveTeachingContent()` da prioridad a ese campo sobre
 * `knowledge_change.learning`. El fragmento se materializó literal como
 * instrucción permanente. Un script de aprobación en lote escribió directo a la
 * base y produjo tres filas idénticas del mismo mensaje.
 *
 * El criterio es coincidencia literal tras normalizar espacios y mayúsculas. Un
 * texto sintetizado nunca será substring de un mensaje real, así que un match es
 * una fuga y solo una fuga. Preferimos reportar de menos porque la limpieza
 * desactiva filas.
 *
 * Módulo compartido: la auditoría y la limpieza deben usar el mismo criterio. Si
 * divergen, la limpieza podría tocar filas que la auditoría nunca vio.
 */

export type LeakedInstruction = {
  id: string
  instruction: string
  source: string | null
  is_active: boolean | null
  created_at: string
}

export type LeakMessage = {
  content: string | null
  received_at: string
  external_id: string | null
}

/** Colapsa espacios y baja a minúsculas para comparar sin falsos negativos por formato. */
export function normalizeLeakText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

export type LeakSource = {
  external_id: string | null
  received_at: string
  excerpt: string
}

/**
 * Devuelve los mensajes cuyo contenido contiene *literalmente* el texto de la
 * instrucción. Vacío significa que el texto no proviene de una conversación.
 */
export function findLeakSources(text: string, messages: LeakMessage[]): LeakSource[] {
  const needle = normalizeLeakText(text)
  if (!needle) return []

  const found: LeakSource[] = []
  for (const message of messages) {
    const haystack = normalizeLeakText(message.content ?? '')
    if (!haystack.includes(needle)) continue

    const at = haystack.indexOf(needle)
    const from = Math.max(0, at - 40)
    found.push({
      external_id: message.external_id,
      received_at: message.received_at,
      excerpt: (message.content ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(from, at + needle.length + 40),
    })
  }
  return found
}

/** Agrupa instrucciones con texto idéntico: aplicación repetida, no fuga de transcripción. */
export function groupDuplicates(instructions: LeakedInstruction[]): Map<string, LeakedInstruction[]> {
  const groups = new Map<string, LeakedInstruction[]>()
  for (const instruction of instructions) {
    const key = normalizeLeakText(instruction.instruction ?? '')
    if (!key) continue
    const group = groups.get(key)
    if (group) group.push(instruction)
    else groups.set(key, [instruction])
  }
  for (const [key, group] of groups) {
    if (group.length < 2) groups.delete(key)
  }
  return groups
}

export type LeakageReport = {
  /** Instrucciones cuyo texto aparece literal en un mensaje. */
  leaked: Array<{ instruction: LeakedInstruction; sources: LeakSource[] }>
  /** Texto normalizado -> filas idénticas. */
  duplicates: Map<string, LeakedInstruction[]>
  /** Fugas activas, únicas por id. */
  leakedActiveIds: string[]
}

/** El cliente de Supabase pagina en bloques de 1000; sin esto solo se lee la primera tanda. */
export const LEAK_PAGE_SIZE = 1000

type SupabaseLike = ReturnType<typeof import('../supabase/admin').createAdminClient>

/**
 * Carga todas las instrucciones del negocio. Centralizado porque la primera
 * versión de la auditoría no paginó y reportó 5 fugas menos de las reales.
 */
export async function fetchLeakInstructions(
  admin: SupabaseLike,
  businessId: string,
): Promise<LeakedInstruction[]> {
  const { data, error } = await admin
    .from('ai_instructions')
    .select('id,instruction,source,is_active,created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`leer ai_instructions: ${error.message}`)
  return (data ?? []) as LeakedInstruction[]
}

/** Carga todos los mensajes con contenido, paginando hasta agotar el corpus. */
export async function fetchLeakMessages(
  admin: SupabaseLike,
  businessId: string,
): Promise<LeakMessage[]> {
  const messages: LeakMessage[] = []

  for (let from = 0; ; from += LEAK_PAGE_SIZE) {
    const { data, error } = await admin
      .from('channel_messages')
      .select('content,received_at,external_id')
      .eq('business_id', businessId)
      .not('content', 'is', null)
      .order('received_at', { ascending: true })
      .range(from, from + LEAK_PAGE_SIZE - 1)

    if (error) throw new Error(`leer channel_messages: ${error.message}`)
    messages.push(...((data ?? []) as LeakMessage[]))
    if (!data || data.length < LEAK_PAGE_SIZE) break
  }

  return messages
}

export function detectLeakage(
  instructions: LeakedInstruction[],
  messages: LeakMessage[],
): LeakageReport {
  const leaked: LeakageReport['leaked'] = []
  const leakedActiveIds: string[] = []

  for (const instruction of instructions) {
    const sources = findLeakSources(instruction.instruction ?? '', messages)
    if (sources.length === 0) continue
    leaked.push({ instruction, sources })
    if (instruction.is_active) leakedActiveIds.push(instruction.id)
  }

  return { leaked, duplicates: groupDuplicates(instructions), leakedActiveIds }
}