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

const DEFAULT_TIMEOUT_MS = 8000

async function fetchWithTimeout(
  path: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const signal = init?.signal
  if (signal) {
    if (signal.aborted) {
      controller.abort()
    } else {
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }
  try {
    return await fetch(path, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function isUnauthorized(res: Response): void {
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.assign('/driver/login')
    }
    throw new DriverApiError('Sesión expirada', 401)
  }
}

export async function driverFetch<T>(
  path: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const res = await fetchWithTimeout(
    path,
    {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      credentials: 'same-origin',
    },
    timeoutMs
  )

  isUnauthorized(res)

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null
    throw new DriverApiError(body?.error ?? 'Error', res.status, body?.code)
  }

  return res.json() as Promise<T>
}

export async function driverUpload<T>(
  path: string,
  formData: FormData,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const res = await fetchWithTimeout(
    path,
    {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
    },
    timeoutMs
  )

  isUnauthorized(res)

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null
    throw new DriverApiError(body?.error ?? 'Error', res.status, body?.code)
  }

  return res.json() as Promise<T>
}
