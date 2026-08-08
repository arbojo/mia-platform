'use client'

import { useEffect, useState } from 'react'
import { driverFetch } from '@/components/driver/api'

export function DriverLogin({
  token,
  driverId,
}: {
  token: string
  driverId: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function login() {
      try {
        await driverFetch('/api/driver/auth', {
          method: 'POST',
          body: JSON.stringify({ driverId, token }),
        })
        if (!cancelled) {
          window.location.assign('/driver')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
          setLoading(false)
        }
      }
    }

    void login()

    return () => {
      cancelled = true
    }
  }, [token, driverId])

  if (error) {
    return (
      <div className="rounded-xl bg-white p-6 text-center shadow">
        <p className="text-lg font-semibold text-red-600">Sesión no válida</p>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
        <p className="mt-4 text-xs text-slate-400">
          Pedí un nuevo enlace de acceso a tu administrador.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white p-6 text-center shadow">
      <p className="text-slate-600">Ingresando...</p>
      {loading && (
        <div className="mx-auto mt-4 h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      )}
    </div>
  )
}
