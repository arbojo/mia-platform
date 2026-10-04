import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveTeachingContent } from '@/lib/knowledge/teaching'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const assistantId = searchParams.get('assistantId')

  if (!assistantId) {
    return NextResponse.json({ error: 'Missing assistantId' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('learning_events')
    .select('id, correction_type, severity, category, original_response, corrected_response, knowledge_change, created_at')
    .eq('assistant_id', assistantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Se expone el contenido ya resuelto y no `corrected_response`: los
  // aprendizajes de tipo product/mistake_prevention guardan la regla en
  // knowledge_change.learning, y la UI debe mostrar exactamente el texto que se
  // materializará al aprobar, no un hueco.
  const events = (data ?? []).map((event) => ({
    ...event,
    content: resolveTeachingContent({
      correction_type: event.correction_type,
      category: event.category,
      original_response: event.original_response,
      corrected_response: event.corrected_response,
      knowledge_change: (event.knowledge_change ?? null) as Record<string, unknown> | null,
    }),
  }))

  return NextResponse.json({ events })
}
