import { createAdminClient } from '@/lib/supabase/admin'

export interface CustomerMemory {
  interests: string[]
  objections: string[]
  questions: string[]
  preferences: string[]
  tags?: string[]
  status?: string | null
  city?: string | null
  lastInteraction: string | null
  summary: string
}

export async function getCustomerMemory(customerId: string): Promise<CustomerMemory | null> {
  const supabase = createAdminClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('memory, last_interaction, tags, status, city')
    .eq('id', customerId)
    .maybeSingle()

  if (!customer?.memory) return null

  const memory = customer.memory as Record<string, unknown>

  const tags = Array.isArray(customer.tags) ? (customer.tags as string[]) : []
  const status = customer.status as string | null
  const city = customer.city as string | null

  return {
    interests: Array.isArray(memory.interests) ? memory.interests as string[] : [],
    objections: Array.isArray(memory.objections) ? memory.objections as string[] : [],
    questions: Array.isArray(memory.questions) ? memory.questions as string[] : [],
    preferences: Array.isArray(memory.preferences) ? memory.preferences as string[] : [],
    tags,
    status,
    city,
    lastInteraction: customer.last_interaction,
    summary: typeof memory.summary === 'string' ? memory.summary : '',
  }
}

export async function extractCustomerMemory(
  customerId: string,
  assistantId: string,
): Promise<CustomerMemory> {
  const supabase = createAdminClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('name, memory')
    .eq('id', customerId)
    .maybeSingle()

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, created_at')
    .eq('customer_id', customerId)
    .eq('assistant_id', assistantId)
    .order('created_at', { ascending: false })
    .limit(5)

  const conversationIds = conversations?.map((c) => c.id) ?? []

  const { data: messages } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .in('conversation_id', conversationIds.length > 0 ? conversationIds : ['none'])
    .order('created_at', { ascending: true })
    .limit(50)

  const existingMemory = customer?.memory as Record<string, unknown> | undefined
  const memory = mergeMemory(existingMemory, customer?.name ?? null, messages ?? [])

  await supabase
    .from('customers')
    .update({
      memory: JSON.parse(JSON.stringify(memory)),
      last_interaction: new Date().toISOString(),
    })
    .eq('id', customerId)

  return memory
}

function mergeMemory(
  existing: Record<string, unknown> | undefined,
  customerName: string | null,
  messages: Array<{ role: string; content: string; created_at: string }>,
): CustomerMemory {
  const interests = new Set<string>(Array.isArray(existing?.interests) ? existing!.interests as string[] : [])
  const objections = new Set<string>(Array.isArray(existing?.objections) ? existing!.objections as string[] : [])
  const questions = new Array<string>()
  const preferences = new Set<string>(Array.isArray(existing?.preferences) ? existing!.preferences as string[] : [])

  if (Array.isArray(existing?.questions)) {
    questions.push(...(existing!.questions as string[]))
  }

  for (const msg of messages) {
    if (msg.role === 'user') {
      const lower = msg.content.toLowerCase()
      if (lower.includes('precio') || lower.includes('cuanto') || lower.includes('cuesta') || lower.includes('costo')) {
        objections.add('price')
      }
      if (lower.includes('envío') || lower.includes('envio') || lower.includes('entrega') || lower.includes('llegar')) {
        objections.add('delivery')
      }
      if (lower.includes('garantía') || lower.includes('garantia') || lower.includes('devolver') || lower.includes('cambio')) {
        objections.add('guarantee')
      }
      if (lower.includes('whatsapp') || lower.includes('llamar') || lower.includes('teléfono') || lower.includes('telefono')) {
        preferences.add('prefers_phone')
      }
      questions.push(msg.content)
    }
  }

  const lastInteraction = messages.length > 0 ? messages[messages.length - 1].created_at : null

  const summary = buildSummary(customerName, interests, objections, preferences)

  return {
    interests: [...interests],
    objections: [...objections],
    questions: questions.slice(-5),
    preferences: [...preferences],
    lastInteraction,
    summary,
  }
}

function buildSummary(
  name: string | null,
  interests: Set<string>,
  objections: Set<string>,
  preferences: Set<string>,
): string {
  const parts: string[] = []
  if (name) parts.push(name)
  if (interests.size > 0) parts.push(`Interested in: ${[...interests].join(', ')}`)
  if (objections.size > 0) parts.push(`Concerns: ${[...objections].join(', ')}`)
  if (preferences.size > 0) parts.push(`Prefers: ${[...preferences].join(', ')}`)
  return parts.join('. ') || ''
}

export function formatCustomerMemoryForPrompt(memory: CustomerMemory): string {
  const parts: string[] = []

  if (memory.summary) parts.push(`Resumen: ${memory.summary}`)
  if (memory.tags && memory.tags.length > 0) parts.push(`Etiquetas: ${memory.tags.join(', ')}`)
  if (memory.status) parts.push(`Estado: ${memory.status}`)
  if (memory.city) parts.push(`Ciudad: ${memory.city}`)
  if (memory.interests.length > 0) parts.push(`Intereses: ${memory.interests.join(', ')}`)
  if (memory.objections.length > 0) parts.push(`Objeciones: ${memory.objections.join(', ')}`)
  if (memory.questions.length > 0) parts.push(`Preguntas previas: ${memory.questions.join(', ')}`)
  if (memory.preferences.length > 0) parts.push(`Preferencias: ${memory.preferences.join(', ')}`)
  if (memory.lastInteraction) {
    const d = new Date(memory.lastInteraction)
    parts.push(`Última interacción: ${d.toLocaleDateString('es-MX')}`)
  }

  return parts.join('\n')
}
