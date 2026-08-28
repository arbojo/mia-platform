import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { OnboardingStep, BusinessProfile, QuizAnswer, CapabilityIntent } from '@/lib/onboarding/types'
import type { CapabilityId } from '@/lib/system/capabilities'
import { isStepSkipped, buildConfirmationData, deriveCapabilitiesFromProfile } from '@/lib/onboarding/quiz'
import { getEffectiveEdition } from '@/lib/system/edition'

export async function GET(request: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: biz, error } = await supabase
      .from('businesses')
      .select('industry, capabilities, onboarding_answers, capability_sources, onboarding_status, name')
      .eq('id', businessId)
      .single()

    if (error || !biz) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const onboardingAnswers = biz.onboarding_answers as Record<string, unknown> | null
    const savedAnswers = (onboardingAnswers?.answers as QuizAnswer[]) ?? []
    const savedProfile = (onboardingAnswers?.profile as Partial<BusinessProfile>) ?? {}
    const currentStatus = biz.onboarding_status as OnboardingStep | null
    const initialStep: OnboardingStep = currentStatus ?? 'identity'
    const currentStep: OnboardingStep = initialStep
    let capabilityIntent: CapabilityIntent | null = null
    let confirmationData: ReturnType<typeof buildConfirmationData> | null = null

    if (savedProfile.industry) {
      await getEffectiveEdition(businessId)
      capabilityIntent = {
        explicit: [],
        inferred: [],
        unknown: [],
        sources: (biz.capability_sources as Partial<Record<CapabilityId, 'onboarding' | 'inferred' | 'industry_default'>>) ?? {},
      }

      if (currentStep === 'confirmation' || currentStep === 'complete') {
        capabilityIntent = {
          explicit: [],
          inferred: [],
          unknown: [],
          sources: (biz.capability_sources as Partial<Record<CapabilityId, 'onboarding' | 'inferred' | 'industry_default'>>) ?? {},
        }
        const derived = deriveCapabilitiesFromProfile(savedProfile as BusinessProfile)
        for (const cap of derived) {
          const sources = capabilityIntent.sources as Record<string, string>
          const source = sources[cap] ?? 'onboarding'
          if (source === 'industry_default') capabilityIntent.inferred.push(cap)
          else capabilityIntent.explicit.push(cap)
        }
        confirmationData = buildConfirmationData(savedProfile as BusinessProfile)
      }
    }

    const skippedSteps: OnboardingStep[] = []
    const allSteps: OnboardingStep[] = [
      'identity', 'industry', 'sales_ambition', 'followup',
      'product_complexity', 'modules', 'channels', 'assistant_name',
      'confirmation', 'complete'
    ]

    for (const step of allSteps) {
      if (isStepSkipped(step, savedProfile)) {
        skippedSteps.push(step)
      }
    }

    return NextResponse.json({
      businessId,
      name: biz.name,
      industry: biz.industry,
      capabilities: biz.capabilities,
      onboardingStatus: biz.onboarding_status,
      currentStep,
      profile: savedProfile,
      answers: savedAnswers,
      capabilityIntent,
      confirmationData,
      skippedSteps,
      canResume: biz.onboarding_status !== 'ready',
    })
  } catch (error) {
    console.error('Onboarding state error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}