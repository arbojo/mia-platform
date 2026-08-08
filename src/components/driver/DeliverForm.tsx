'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { driverUpload } from '@/components/driver/api'
import { captureGpsSamples } from '@/components/driver/geolocation'
import { enqueueAction } from '@/components/driver/outbox'

const KINSHIPS = [
  { value: 'titular', label: 'Titular' },
  { value: 'familiar', label: 'Familiar' },
  { value: 'vecino', label: 'Vecino/a' },
  { value: 'recibe_tercero', label: 'Recibe un tercero' },
]

export function DeliverForm({
  visitId,
  orderId,
  driverId,
  amount,
  onDone,
}: {
  visitId: string
  orderId: string
  driverId: string
  amount: number | null
  onDone: () => void
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [kinship, setKinship] = useState('titular')
  const [amountCollected, setAmountCollected] = useState(amount !== null ? String(amount) : '')
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!fileRef.current?.files?.[0]) {
      setError('La foto de evidencia es obligatoria')
      return
    }

    setBusy(true)
    setError(null)

    try {
      let samples: Array<{ lat: number; lng: number; capturedAt: string }>
      try {
        samples = await captureGpsSamples()
      } catch {
        setError('Necesitás GPS activo para confirmar la entrega')
        setBusy(false)
        return
      }

      const formData = new FormData()
      formData.append('kinship', kinship)
      formData.append('amount_collected', amountCollected || '0')
      formData.append('payment_method', paymentMethod)
      formData.append('samples_lat1', String(samples[0].lat))
      formData.append('samples_lng1', String(samples[0].lng))
      formData.append('samples_captured_at1', samples[0].capturedAt)
      formData.append('samples_lat2', String(samples[1].lat))
      formData.append('samples_lng2', String(samples[1].lng))
      formData.append('samples_captured_at2', samples[1].capturedAt)
      formData.append('photo', fileRef.current.files[0])

      try {
        await driverUpload(`/api/driver/deliveries/${visitId}/delivered`, formData)
      } catch (err) {
        if (err instanceof TypeError) {
          await enqueueAction({
            idempotencyKey: `${driverId}:entrega_realizada:${visitId}:${new Date(samples[1].capturedAt).getTime()}`,
            eventType: 'entrega_realizada',
            visitId,
            orderId,
            samples,
            payload: { kinship, amount_collected: amountCollected, payment_method: paymentMethod },
          })
        } else {
          throw err
        }
      }

      router.push('/driver')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar entrega')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl bg-white p-4 shadow">
      <p className="text-sm font-semibold text-slate-700">Confirmar entrega</p>

      <label className="block text-xs font-medium text-slate-500">
        ¿Quién recibió el pedido?
        <select
          value={kinship}
          onChange={(e) => setKinship(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {KINSHIPS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>

      {!amount && (
        <label className="block text-xs font-medium text-slate-500">
          Importe cobrado ($)
          <input
            type="number"
            min="0"
            step="0.01"
            value={amountCollected}
            onChange={(e) => setAmountCollected(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      )}

      <label className="block text-xs font-medium text-slate-500">
        Medio de pago
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="qr">QR</option>
          <option value="tarjeta">Tarjeta</option>
        </select>
      </label>

      <label className="block text-xs font-medium text-slate-500">
        Foto de evidencia (obligatoria)
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      {photo && <p className="text-xs text-emerald-600">✓ {photo.name}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Confirmando...' : '✅ Confirmar entrega'}
      </button>
    </div>
  )
}
