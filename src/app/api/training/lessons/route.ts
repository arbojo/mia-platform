import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const assistant_id = searchParams.get('assistant_id')
  const limit = parseInt(searchParams.get('limit') ?? '20', 10)

  if (!assistant_id) {
    return NextResponse.json({ error: 'Falta assistant_id' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: lessons, error } = await admin
    .from('learning_events')
    .select('id, original_response, corrected_response, correction_type, status, created_at, knowledge_item_id')
    .eq('assistant_id', assistant_id)
    .in('status', ['approved', 'modified'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const enrichedLessons = await Promise.all(
    (lessons ?? []).map(async (lesson) => {
      let entity_preview = null

      if (lesson.knowledge_item_id && lesson.correction_type === 'knowledge') {
        const { data: item } = await admin
          .from('knowledge_items')
          .select('question, answer')
          .eq('id', lesson.knowledge_item_id)
          .single()
        entity_preview = item
      }

      return {
        id: lesson.id,
        original_response: lesson.original_response,
        corrected_response: lesson.corrected_response,
        correction_type: lesson.correction_type,
        created_at: lesson.created_at,
        entity_preview,
      }
    })
  )

  return NextResponse.json({
    lessons: enrichedLessons,
    total: enrichedLessons.length,
  })
}
