import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  PIXEL_EVENT_NAMES,
  type PixelVisitContext,
} from '@mia/core'

const eventSchema = z.object({
  eventName: z.enum(PIXEL_EVENT_NAMES),
  secondsFromStart: z.number().int().min(0).default(0),
  value: z.record(z.string(), z.unknown()).default({}),
})

const visitSchema = z.object({
  landingId: z.string().min(1).max(100),
  landingVersion: z.string().max(50).default('v1'),
  sessionToken: z.string().min(1).max(100),
  assistantId: z.string().uuid().optional(),
  businessId: z.string().uuid().optional(),
  userAgent: z.string().max(500).optional(),
  deviceType: z.enum(['mobile', 'tablet', 'desktop']).optional(),
  screenWidth: z.number().int().positive().optional(),
  screenHeight: z.number().int().positive().optional(),
  language: z.string().max(20).optional(),
  referrer: z.string().max(1000).optional(),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
  isBounce: z.boolean().optional(),
})

const trackSchema = z.object({
  visit: visitSchema,
  events: z.array(eventSchema).max(50),
})

async function resolveBusinessId(
  supabase: ReturnType<typeof createAdminClient>,
  visit: PixelVisitContext
): Promise<string | null> {
  if (visit.businessId) return visit.businessId

  if (visit.assistantId) {
    const { data } = await supabase
      .from('assistants')
      .select('business_id')
      .eq('id', visit.assistantId)
      .single()

    if (data?.business_id) return data.business_id
  }

  return null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = trackSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid pixel payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { visit, events } = parsed.data
    const supabase = createAdminClient()

    const businessId = await resolveBusinessId(supabase, visit)
    if (!businessId) {
      return NextResponse.json({ error: 'Could not resolve tenant' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('landing_visits')
      .select('id')
      .eq('session_token', visit.sessionToken)
      .eq('landing_id', visit.landingId)
      .maybeSingle()

    let visitId = existing?.id ?? null

    if (!visitId) {
      const { data: created, error: createError } = await supabase
        .from('landing_visits')
        .insert({
          business_id: businessId,
          landing_id: visit.landingId,
          landing_version: visit.landingVersion,
          session_token: visit.sessionToken,
          user_agent: visit.userAgent,
          device_type: visit.deviceType,
          screen_width: visit.screenWidth,
          screen_height: visit.screenHeight,
          language: visit.language,
          referrer: visit.referrer,
          utm_source: visit.utmSource,
          utm_medium: visit.utmMedium,
          utm_campaign: visit.utmCampaign,
          utm_content: visit.utmContent,
          utm_term: visit.utmTerm,
          is_bounce: visit.isBounce ?? false,
        })
        .select('id')
        .single()

      if (createError || !created) {
        console.error('Pixel visit create error:', createError)
        return NextResponse.json({ error: 'Failed to create visit' }, { status: 500 })
      }
      visitId = created.id
    }

    const { error: updateError } = await supabase
      .from('landing_visits')
      .update({ last_seen: new Date().toISOString(), is_bounce: visit.isBounce ?? false })
      .eq('id', visitId)

    if (updateError) {
      console.error('Pixel visit touch error:', updateError)
    }

    if (events.length > 0) {
      const { error: insertError } = await supabase.from('landing_events').insert(
        events.map((e) => ({
          business_id: businessId,
          visit_id: visitId,
          event_name: e.eventName,
          seconds_from_start: e.secondsFromStart,
          value: e.value,
        }))
      )

      if (insertError) {
        console.error('Pixel events insert error:', insertError)
      }
    }

    return NextResponse.json({ visitId, accepted: events.length })
  } catch (error) {
    console.error('Pixel track error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
