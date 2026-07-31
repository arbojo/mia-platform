import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase } = await requireAuth()
    const { id } = await params

    const { error } = await supabase
      .from('conversations')
      .update({ status: 'archived' })
      .eq('id', id)

    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard/conversations/${id}?error=archive_failed`, _request.url)
      )
    }

    return NextResponse.redirect(
      new URL(`/dashboard/conversations/${id}?archived=true`, _request.url)
    )
  } catch {
    return NextResponse.redirect(
      new URL('/dashboard/conversations?error=auth', _request.url)
    )
  }
}
