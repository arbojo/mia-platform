'use client'

const headers = { 'Content-Type': 'application/json' }

export async function adminFetch<T>(
  path: string,
  businessId: string,
  init?: RequestInit
): Promise<T> {
  const separator = path.includes('?') ? '&' : '?'
  const res = await fetch(`${path}${separator}business_id=${encodeURIComponent(businessId)}`, {
    ...init,
    headers: init?.body instanceof FormData ? undefined : { ...headers, ...init?.headers },
    cache: 'no-store',
  })

  const body = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string }

  if (!res.ok) {
    throw new Error(body?.error ?? body?.code ?? `Error ${res.status}`)
  }

  return body
}
