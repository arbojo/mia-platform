import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBlendedPatterns } from '@/lib/heuristic/blender'

export const runtime = 'nodejs'

const createPatternSchema = z.object({
  pattern_key: z.string().min(1).max(100),
  customer_objection: z.string().min(1).max(500),
  sample_raw_query: z.string().max(500).optional(),
  suggested_response: z.string().min(1).max(2000),
  conversion_probability: z.number().min(0).max(1).optional(),
  confidence_level: z.number().min(0).max(1).optional(),
})

export async function GET() {
  try {
    const { user } = await requireAuth()
    const admin = createAdminClient()

    const { data: business } = await admin
      .from('businesses')
      .select('id, industry')
      .eq('owner_id', user.id)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const industry = business.industry || 'general'
    const patterns = await getBlendedPatterns(business.id, industry)

    return NextResponse.json({ patterns })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const parsed = createPatternSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { data: pattern, error } = await admin
      .from('experience_memory')
      .insert({
        business_id: business.id,
        scope: 'business',
        pattern_key: parsed.data.pattern_key,
        customer_objection: parsed.data.customer_objection,
        sample_raw_query: parsed.data.sample_raw_query ?? null,
        suggested_response: parsed.data.suggested_response,
        conversion_probability: parsed.data.conversion_probability ?? 0.500,
        confidence_level: parsed.data.confidence_level ?? 0.500,
        observation_count: 1,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ pattern }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
