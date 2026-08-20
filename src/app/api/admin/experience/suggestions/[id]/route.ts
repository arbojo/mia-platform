import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

interface PatchBody {
  status: 'approved' | 'dismissed'
  customizedResponse?: string
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { user } = await requireAuth()
    const admin = createAdminClient()

    const { data: business } = await admin
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const body: PatchBody = await request.json()

    if (!['approved', 'dismissed'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data: suggestion, error: fetchError } = await admin
      .from('experience_suggestions')
      .select('*, parent:experience_memory(*)')
      .eq('id', params.id)
      .eq('business_id', business.id)
      .single()

    if (fetchError || !suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    if (body.status === 'approved') {
      const parent = suggestion.parent as {
        pattern_key: string
        customer_objection: string
        suggested_response: string
        conversion_probability: number
        confidence_level: number
      }

      const finalResponse = body.customizedResponse || parent.suggested_response

      const { error: memError } = await admin.from('experience_memory').insert({
        business_id: business.id,
        scope: 'business',
        pattern_key: parent.pattern_key,
        customer_objection: parent.customer_objection,
        suggested_response: finalResponse,
        conversion_probability: parent.conversion_probability,
        confidence_level: parent.confidence_level,
        observation_count: 1,
      })

      if (memError) throw memError

      const { error: kiError } = await admin.from('knowledge_items').insert({
        business_id: business.id,
        category: 'objection',
        question: parent.customer_objection,
        answer: finalResponse,
        source: 'experience_memory',
        confidence: 'medium',
      })

      if (kiError) throw kiError
    }

    const { data: updated, error: updateError } = await admin
      .from('experience_suggestions')
      .update({
        status: body.status,
        customized_response: body.customizedResponse ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json(updated)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
