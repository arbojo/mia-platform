export class DriverApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message)
    this.name = 'DriverApiError'
  }
}

export async function driverFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    credentials: 'same-origin',
  })

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.assign('/driver/login')
    }
    throw new DriverApiError('Sesión expirada', 401)
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null
    throw new DriverApiError(body?.error ?? 'Error', res.status, body?.code)
  }

  return res.json() as Promise<T>
}

export async function driverUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    body: formData,
    credentials: 'same-origin',
  })

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.assign('/driver/login')
    }
    throw new DriverApiError('Sesión expirada', 401)
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null
    throw new DriverApiError(body?.error ?? 'Error', res.status, body?.code)
  }

  return res.json() as Promise<T>
}
