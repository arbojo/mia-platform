import { NextResponse, type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()
    const admin = createAdminClient()
    const url = new URL(request.url)
    const statusFilter = url.searchParams.get('status') || 'pending'

    const { data: business } = await admin
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const { data: suggestions, error } = await admin
      .from('experience_suggestions')
      .select('*, parent:experience_memory(*)')
      .eq('business_id', business.id)
      .eq('status', statusFilter)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ suggestions: suggestions ?? [] })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
