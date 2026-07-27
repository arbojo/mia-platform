import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { sessionId, conversationId, assistantId } = body

  const admin = createAdminClient()

  const { data: messages } = await admin
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'No messages' }, { status: 400 })
  }

  const { data: assistant } = await admin
    .from('assistants')
    .select('*, businesses(*)')
    .eq('id', assistantId)
    .single()

  if (!assistant) {
    return NextResponse.json({ error: 'Assistant not found' }, { status: 404 })
  }

  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'Cliente' : 'MIA'}: ${m.content}`)
    .join('\n\n')

  try {
    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        score: z.number().min(1).max(10),
        criteria: z.object({
          product_knowledge: z.number().min(1).max(10),
          empathy: z.number().min(1).max(10),
          objection_handling: z.number().min(1).max(10),
          closing: z.number().min(1).max(10),
          rule_following: z.number().min(1).max(10),
        }),
        strengths: z.array(z.string()),
        weaknesses: z.array(z.string()),
        suggestions: z.array(z.string()),
      }),
      prompt: `Evalúa esta conversación de ventas entre un cliente y MIA, una asistente de ventas.

Negocio: ${assistant.businesses?.name ?? 'Desconocido'}
MIA es una asistente de ventas que debe conocer los productos, respetar las reglas del negocio y ser empática con los clientes.

Conversación:
${conversationText}

Califica del 1 al 10 en cada criterio:
- product_knowledge: ¿MIA conoce bien los productos?
- empathy: ¿MIA es empática y cercana?
- objection_handling: ¿Maneja objeciones correctamente?
- closing: ¿Intenta cerrar la venta?
- rule_following: ¿Respeta las reglas del negocio?

Identifica fortalezas, debilidades y sugerencias concretas de mejora.`,
    })

    const evaluation = result.object

    if (sessionId) {
      await admin
        .from('lab_sessions')
        .update({
          status: 'completed',
          score: evaluation.score,
          criteria: evaluation.criteria,
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          suggestions: evaluation.suggestions,
          evaluation_model: 'gpt-4o-mini',
          message_count: messages.length,
        })
        .eq('id', sessionId)
    }

    return NextResponse.json({ evaluation })
  } catch (error) {
    console.error('Evaluation error:', error)
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 })
  }
}
