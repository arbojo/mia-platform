import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const publicPaths = ['/login', '/signup', '/auth', '/demo', '/', '/driver']

async function getBusinessForUser(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
) {
  const { data } = await supabase
    .from('businesses')
    .select('id, onboarding_status')
    .eq('owner_id', userId)
    .maybeSingle()
  return data
}

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path))

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const business = await getBusinessForUser(supabase, user.id)
    const url = request.nextUrl.clone()
    url.pathname = business ? '/dashboard' : '/demo'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/') {
    const business = await getBusinessForUser(supabase, user.id)
    const url = request.nextUrl.clone()
    url.pathname = business ? '/dashboard' : '/demo'
    return NextResponse.redirect(url)
  }

  if (
    user &&
    pathname === '/dashboard' &&
    !request.nextUrl.searchParams.has('skip-onboarding-check')
  ) {
    const business = await getBusinessForUser(supabase, user.id)
    if (!business) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard/onboarding'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
