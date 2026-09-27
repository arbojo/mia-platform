import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  analyzeConversationPatterns,
  upsertBusinessMemory,
  calculateSkillLevels,
  calculateLearningVelocity,
} from '@/lib/ai/memory'

/**
 * Runs the business-level learning pipeline (patterns, skills, velocity) on a
 * schedule so MIA learns from recent conversations without a manual button.
 *
 * Auth: Vercel Cron auto-sends `Authorization: Bearer <CRON_SECRET>` when the
 * CRON_SECRET env var is configured; manual/headless runs use the shared
 * secret (x-mia-cron-secret) matching MIA_CRON_SECRET. This mirrors the repo's
 * existing cron convention while following Vercel's documented mechanism.
 *
 * Both verbs are exported because Vercel Cron only ever issues a GET. A
 * POST-only route still shows as an active schedule in the dashboard while
 * every single run fails with 405, which is indistinguishable from "MIA just
 * isn't learning" until someone reads the logs.
 */
function verifyCronAuth(request: Request): boolean {
  const schedulerSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (schedulerSecret && authorization === `Bearer ${schedulerSecret}`) {
    return true
  }

  const secret = request.headers.get('x-mia-cron-secret')
  const expectedSecret = process.env.MIA_CRON_SECRET
  return Boolean(secret && expectedSecret && secret === expectedSecret)
}

async function runLearningForBusiness(businessId: string) {
  const [patterns, skills, velocity] = await Promise.all([
    analyzeConversationPatterns(businessId),
    calculateSkillLevels(businessId),
    calculateLearningVelocity(businessId),
  ])

  const memoryCreated =
    patterns.length > 0 ? (await upsertBusinessMemory(businessId, patterns)).length : 0

  return {
    business_id: businessId,
    status: 'completed',
    patterns_detected: patterns.length,
    memory_created: memoryCreated,
    skills_updated: skills.length,
    velocity,
  }
}

/**
 * Shared by GET and POST. `businessId` is null when the caller wants every
 * tenant processed, which is what the scheduled run does: the cron path in
 * vercel.json carries no query string.
 */
async function handleCron(request: Request, businessId: string | null) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  let businessIds: string[]

  if (businessId) {
    const { data: business } = await admin
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .maybeSingle()

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }
    businessIds = [business.id]
  } else {
    const { data: businesses, error } = await admin.from('businesses').select('id')

    if (error) {
      console.error('[memory-analyze] Failed to list businesses:', error)
      return NextResponse.json({ error: 'Failed to list businesses' }, { status: 500 })
    }
    businessIds = (businesses ?? []).map((b) => b.id)
  }

  const results: Array<Record<string, unknown>> = []
  for (const id of businessIds) {
    try {
      results.push(await runLearningForBusiness(id))
    } catch (error) {
      console.error(`[memory-analyze] Failed for business ${id}:`, error)
      results.push({
        business_id: id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const failed = results.filter((r) => r.status === 'failed').length

  return NextResponse.json({
    status: 'completed',
    businesses_processed: results.length,
    businesses_failed: failed,
    businesses: results,
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  return handleCron(request, searchParams.get('business_id'))
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { business_id } = body as { business_id?: string }
  return handleCron(request, business_id ?? null)
}
