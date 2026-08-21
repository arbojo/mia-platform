import { NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { handleApiError } from '@/lib/api-error'
import type { PlatformUsageBilling } from '@/lib/platform/types'

export const runtime = 'nodejs'

const COST_PER_INPUT_TOKEN = 0.00000015
const COST_PER_OUTPUT_TOKEN = 0.00000060

export async function GET() {
  try {
    await requirePlatformOwner()

    const supabase = createAdminClient()

    const [{ data: usageLogs, error: usageError }, { data: businesses }] = await Promise.all([
      supabase
        .from('ai_usage')
        .select('business_id, tokens_input, tokens_output, created_at'),
      supabase.from('businesses').select('id, name'),
    ])

    if (usageError) throw usageError

    const byBiz = new Map<
      string,
      { count: number; input: number; output: number; lastActive: string | null }
    >()
    for (const log of usageLogs ?? []) {
      const existing = byBiz.get(log.business_id) ?? {
        count: 0,
        input: 0,
        output: 0,
        lastActive: null,
      }
      existing.count++
      existing.input += log.tokens_input ?? 0
      existing.output += log.tokens_output ?? 0
      if (log.created_at && (!existing.lastActive || log.created_at > existing.lastActive)) {
        existing.lastActive = log.created_at
      }
      byBiz.set(log.business_id, existing)
    }

    const billing: PlatformUsageBilling[] = (businesses ?? []).map((biz) => {
      const data = byBiz.get(biz.id) ?? { count: 0, input: 0, output: 0, lastActive: null }
      const totalTokens = data.input + data.output
      const cost = data.input * COST_PER_INPUT_TOKEN + data.output * COST_PER_OUTPUT_TOKEN

      return {
        businessId: biz.id,
        businessName: biz.name,
        requestsCount: data.count,
        totalTokens,
        calculatedCostUsd: Number(cost.toFixed(4)),
        lastActive: data.lastActive,
      }
    })

    return NextResponse.json(billing)
  } catch (error) {
    return handleApiError(error)
  }
}
