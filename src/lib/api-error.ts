import { NextResponse } from 'next/server'

export class ApiAuthError extends Error {
  constructor() {
    super('No autorizado')
    this.name = 'ApiAuthError'
  }
}

export function handleApiError(err: unknown, fallback = 'Error interno'): NextResponse {
  if (err instanceof ApiAuthError) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }

  return NextResponse.json(
    { error: err instanceof Error ? err.message : fallback },
    { status: 500 },
  )
}
