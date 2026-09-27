import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/cron/auth'
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
 * Both verbs are exported because Vercel Cron only ever issues a GET. A
 * POST-only route still shows as an active schedule in the dashboard while
 * every single run fails with 405, which is indistinguishable from "MIA just
 * isn't learning" until someone reads the logs.
 */

/**
 * Supabase/PostgREST failures arrive as plain objects
 * (`{ code, message, details, hint }`), not as Error instances, so an
 * `instanceof Error` check reports "Unknown error" for every database problem
 * and leaves the only useful clue in the server logs. That is how a missing
 * `conversations.business_id` column stayed invisible while all five tenants
 * failed on every scheduled run.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string' && error) return error
  if (typeof error === 'object' && error !== null) {
    const { message, code } = error as { message?: unknown; code?: unknown }
    if (typeof message === 'string' && message) {
      return typeof code === 'string' && code ? `${code}: ${message}` : message
    }
  }
  return 'Unknown error'
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
        error: describeError(error),
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
