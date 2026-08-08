import type { NextResponse } from 'next/server'
import { SESSION_COOKIE, SESSION_TTL_MS } from './token'

export function setSessionCookie(response: NextResponse, cookieValue: string): NextResponse {
  response.cookies.set(SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  })
  return response
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}

export function applySessionSlide(response: NextResponse, slideTo: string | null): NextResponse {
  if (slideTo) {
    return setSessionCookie(response, slideTo)
  }
  return response
}
