import { z } from 'zod'
import { DeliveryError } from './errors'
import type { GpsSample } from './gps'

const gpsSampleSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  capturedAt: z.union([z.string(), z.number()]),
})

export const gpsSamplesSchema = z.tuple([gpsSampleSchema, gpsSampleSchema])

export function toIso(value: string | number): string {
  const date = typeof value === 'number' ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new DeliveryError('INVALID_INPUT', 'capturedAt inválido', 400)
  }
  return date.toISOString()
}

export function requireGpsSamples(raw: unknown): [GpsSample, GpsSample] {
  const parsed = gpsSamplesSchema.safeParse(raw)

  if (!parsed.success) {
    throw new DeliveryError('INVALID_INPUT', 'Se requieren dos muestras GPS válidas', 400)
  }

  return [
    {
      lat: parsed.data[0].lat,
      lng: parsed.data[0].lng,
      capturedAt: toIso(parsed.data[0].capturedAt),
    },
    {
      lat: parsed.data[1].lat,
      lng: parsed.data[1].lng,
      capturedAt: toIso(parsed.data[1].capturedAt),
    },
  ]
}
