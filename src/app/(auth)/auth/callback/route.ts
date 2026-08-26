import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/route-handler'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const response = NextResponse.redirect(`${origin}/dashboard`)
    const supabase = await createClient(response)
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: business } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle()

        const destination = business ? '/dashboard' : '/dashboard/onboarding'
        return NextResponse.redirect(`${origin}${destination}`)
      }

      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
