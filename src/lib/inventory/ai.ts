import { generateObject } from 'ai'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createInventoryAdmin } from './db'
import { recordAiUsage } from '@/lib/ai/knowledge'
import { InventoryError } from './errors'
import { getProviderModel } from '@/lib/ai/task-routing'

const noteSchema = z.object({
  note: z
    .string()
    .max(500)
    .describe('Nota breve y concreta de reposición en español, en 2-4 oraciones'),
})

export interface AiSuggestionInput {
  businessId: string
  suggestionId: string
  productName: string
  sku: string | null
  currentQuantity: number
  threshold: number
  suggestedQty: number
  velocity7d: number
  velocity30d: number
  daysOut: number | null
}

export async function generateAiRestockNote(input: AiSuggestionInput): Promise<string> {
  const pub = createAdminClient()

  const { data: assistant } = await pub
    .from('assistants')
    .select('id')
    .eq('business_id', input.businessId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!assistant) {
    throw new InventoryError('NOT_FOUND', 'No se encontró un asistente para registrar el uso de IA', 404)
  }

  const prompt = `Eres un asesor de reposición de inventario para un negocio de venta directa.

PRODUCTO: ${input.productName}${input.sku ? ` (SKU: ${input.sku})` : ''}
STOCK ACTUAL: ${input.currentQuantity} unidades (umbral de alerta: ${input.threshold})
VELOCIDAD DE VENTA: ${input.velocity7d} unidades en 7 días, ${input.velocity30d} en 30 días
ÚLTIMA VENTA: ${input.daysOut === null ? 'sin ventas registradas' : `hace ${input.daysOut} días`}
CANTIDAD SUGERIDA POR REGLA: ${input.suggestedQty} unidades

ESCRIBE una nota breve y accionable para el equipo de reposición (2-4 oraciones, en español),
justificando la cantidad a reponer con datos. NO inventes información. No menciones precios ni costos.`

  const { model, modelName } = getProviderModel('extraction')

  const result = await generateObject({
    model,
    schema: noteSchema,
    prompt,
  })

  const note = result.object.note

  await recordAiUsage({
    business_id: input.businessId,
    assistant_id: assistant.id,
    model: modelName,
    request_type: 'inventory',
    tokens_input: result.usage.inputTokens ?? 0,
    tokens_output: result.usage.outputTokens ?? 0,
    cost: 0,
  })

  const inv = createInventoryAdmin()
  const { error } = await inv
    .from('restock_suggestions')
    .update({
      ai_summary: note,
      ai_used: true,
      tokens_used: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.suggestionId)
    .eq('business_id', input.businessId)

  if (error) throw error

  return note
}
