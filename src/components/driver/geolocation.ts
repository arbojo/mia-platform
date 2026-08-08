'use client'

export interface GpsSample {
  lat: number
  lng: number
  capturedAt: string
}

const SAMPLE_GAP_MS = 3000

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no disponible'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    })
  })
}

function toSample(position: GeolocationPosition): GpsSample {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    capturedAt: new Date(position.timestamp).toISOString(),
  }
}

export async function captureGpsSamples(): Promise<[GpsSample, GpsSample]> {
  const first = toSample(await getCurrentPosition())
  await new Promise((resolve) => setTimeout(resolve, SAMPLE_GAP_MS))
  const second = toSample(await getCurrentPosition())
  return [first, second]
}

export function getCurrentGpsSample(): Promise<GpsSample> {
  return getCurrentPosition().then(toSample)
}
