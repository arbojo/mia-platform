import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { deriveCapabilities, seedOperationalConfig } from '@/lib/onboarding/derive'
import { getEffectiveEdition } from '@/lib/system/edition'
import type { BusinessProfile } from '@/lib/onboarding/types'

export async function POST(request: Request) {
  try {
    await requireAuth()
    const { businessId, profile, answers, capabilityIntent } = await request.json()

    if (!businessId || !profile || !answers) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()
    const edition = await getEffectiveEdition(businessId)

    const intent = capabilityIntent ?? deriveCapabilities(profile as BusinessProfile, edition)
    const operationalConfig = seedOperationalConfig(profile as BusinessProfile, intent)

    const allCapabilities = [...intent.explicit, ...intent.inferred]

    const { error: businessError } = await supabase
      .from('businesses')
      .update({
        industry: profile.industry,
        capabilities: allCapabilities,
        onboarding_answers: { answers, profile },
        capability_sources: intent.sources,
        onboarding_status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId)

    if (businessError) throw businessError

    if (operationalConfig.inventory) {
      const { error } = await supabase.from('inventory.business_settings').upsert({
        business_id: businessId,
        enabled: true,
        vertical: profile.industry ?? 'general',
        low_stock_threshold: 5,
        critical_stock_threshold: 2,
        auto_reorder: false,
        prediction_enabled: true,
        customer_promise_enabled: true,
        updated_at: new Date().toISOString(),
      })
      if (error) console.error('Error seeding inventory:', error)
    }

    if (operationalConfig.delivery) {
      const { error } = await supabase.from('delivery.business_settings').upsert({
        business_id: businessId,
        enabled: true,
        default_zone: 'local',
        auto_assign: true,
        notify_customer: true,
        driver_app_required: true,
        gps_required: true,
        updated_at: new Date().toISOString(),
      })
      if (error) console.error('Error seeding delivery:', error)
    }

    if (operationalConfig.salesConfig) {
      const { error } = await supabase.from('business_sales_config').upsert({
        business_id: businessId,
        ...operationalConfig.salesConfig,
        updated_at: new Date().toISOString(),
      })
      if (error) console.error('Error seeding sales config:', error)
    }

    const { data: assistant } = await supabase
      .from('assistants')
      .select('id')
      .eq('business_id', businessId)
      .maybeSingle()

    if (assistant) {
      for (const ch of operationalConfig.assistantChannels) {
        const { error } = await supabase.from('assistant_channels').upsert({
          assistant_id: assistant.id,
          channel: ch.channel as 'web' | 'whatsapp' | 'messenger' | 'instagram',
          is_active: ch.is_active,
        })
        if (error) console.error('Error seeding assistant channel:', error)
      }
    }

    return NextResponse.json({ success: true, businessId })
  } catch (error) {
    console.error('Onboarding complete error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}