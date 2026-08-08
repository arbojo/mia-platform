import { DeliveryError } from './errors'

export interface GpsSample {
  lat: number
  lng: number
  capturedAt: string
}

export const MAX_SKEW_MS = 2 * 60 * 1000
export const MAX_CLOCK_AHEAD_MS = 5 * 60 * 1000
export const MAX_SAMPLE_GAP_MS = 30 * 1000
export const MAX_SAMPLE_SPREAD_METERS = 500

export function haversineDistanceMeters(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number
): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(latB - latA)
  const dLng = toRad(lngB - lngA)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function isFreshSample(receivedAt: string, capturedAt: string): boolean {
  const skew = new Date(receivedAt).getTime() - new Date(capturedAt).getTime()
  return skew >= -MAX_CLOCK_AHEAD_MS && skew <= MAX_SKEW_MS
}

export function samplesConsistent(a: GpsSample, b: GpsSample): boolean {
  const gap = Math.abs(new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
  if (gap > MAX_SAMPLE_GAP_MS) return false

  const distance = haversineDistanceMeters(a.lat, a.lng, b.lat, b.lng)
  return distance <= MAX_SAMPLE_SPREAD_METERS
}

export function isWithinRadius(
  visitLat: number,
  visitLng: number,
  sampleLat: number,
  sampleLng: number,
  radiusMeters: number
): boolean {
  return haversineDistanceMeters(visitLat, visitLng, sampleLat, sampleLng) <= radiusMeters
}

export function validateGpsSamples(params: {
  samples: [GpsSample, GpsSample]
  receivedAt: string
}): void {
  for (const sample of params.samples) {
    if (!isFreshSample(params.receivedAt, sample.capturedAt)) {
      throw new DeliveryError(
        'GPS_REJECTED',
        'Captura GPS demasiado antigua o con reloj inconsistente',
        409
      )
    }
  }

  if (!samplesConsistent(params.samples[0], params.samples[1])) {
    throw new DeliveryError(
      'GPS_REJECTED',
      'Muestras GPS inconsistentes entre sí',
      409
    )
  }
}

export function validateProximity(params: {
  visitLat: number | null
  visitLng: number | null
  sample: GpsSample
  radiusMeters: number
}): void {
  if (
    params.visitLat === null ||
    params.visitLng === null ||
    !isWithinRadius(params.visitLat, params.visitLng, params.sample.lat, params.sample.lng, params.radiusMeters)
  ) {
    throw new DeliveryError(
      'GPS_REJECTED',
      'No estás dentro del radio de entrega del cliente',
      409
    )
  }
}
