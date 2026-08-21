import { NextResponse } from 'next/server'

export class ApiAuthError extends Error {
  constructor() {
    super('No autorizado')
    this.name = 'ApiAuthError'
  }
}

export class ApiForbiddenError extends Error {
  constructor() {
    super('Acceso denegado')
    this.name = 'ApiForbiddenError'
  }
}

export function handleApiError(err: unknown, fallback = 'Error interno'): NextResponse {
  if (err instanceof ApiAuthError) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }

  if (err instanceof ApiForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 })
  }

  return NextResponse.json(
    { error: err instanceof Error ? err.message : fallback },
    { status: 500 },
  )
}
