import { describe, it, expect } from 'vitest'
import {
  haversineDistanceMeters,
  isFreshSample,
  samplesConsistent,
  isWithinRadius,
  validateGpsSamples,
  validateProximity,
  MAX_SKEW_MS,
  MAX_SAMPLE_GAP_MS,
  MAX_SAMPLE_SPREAD_METERS,
} from '@/lib/delivery/gps'
import { DeliveryError } from '@/lib/delivery/errors'

describe('haversineDistanceMeters', () => {
  it('returns ~0 for the same coordinate', () => {
    expect(haversineDistanceMeters(-34.6037, -58.3816, -34.6037, -58.3816)).toBeLessThan(1)
  })

  it('returns a realistic distance for Buenos Aires landmarks', () => {
    const distance = haversineDistanceMeters(-34.6037, -58.3816, -34.6158, -58.3774)
    expect(distance).toBeGreaterThan(1000)
    expect(distance).toBeLessThan(2000)
  })

  it('is symmetric', () => {
    const a = haversineDistanceMeters(0, 0, 1, 1)
    const b = haversineDistanceMeters(1, 1, 0, 0)
    expect(a).toBeCloseTo(b, 6)
  })
})

describe('isFreshSample', () => {
  it('accepts a recent sample', () => {
    const now = new Date().toISOString()
    const captured = new Date(Date.now() - 1000).toISOString()
    expect(isFreshSample(now, captured)).toBe(true)
  })

  it('rejects a sample older than the skew window', () => {
    const now = new Date().toISOString()
    const captured = new Date(Date.now() - (MAX_SKEW_MS + 10_000)).toISOString()
    expect(isFreshSample(now, captured)).toBe(false)
  })

  it('rejects a sample captured far in the future', () => {
    const now = new Date().toISOString()
    const captured = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    expect(isFreshSample(now, captured)).toBe(false)
  })
})

describe('samplesConsistent', () => {
  it('accepts two close samples captured within the gap window', () => {
    const a = { lat: -34.6037, lng: -58.3816, capturedAt: new Date().toISOString() }
    const b = { lat: -34.60371, lng: -58.38161, capturedAt: new Date(Date.now() + 2000).toISOString() }
    expect(samplesConsistent(a, b)).toBe(true)
  })

  it('rejects samples captured too far apart in time', () => {
    const a = { lat: -34.6037, lng: -58.3816, capturedAt: new Date().toISOString() }
    const b = {
      lat: -34.6037,
      lng: -58.3816,
      capturedAt: new Date(Date.now() + MAX_SAMPLE_GAP_MS + 5000).toISOString(),
    }
    expect(samplesConsistent(a, b)).toBe(false)
  })

  it('rejects samples too far apart geographically', () => {
    const a = { lat: -34.6037, lng: -58.3816, capturedAt: new Date().toISOString() }
    const b = {
      lat: -34.55,
      lng: -58.4,
      capturedAt: new Date(Date.now() + 1000).toISOString(),
    }
    const distance = haversineDistanceMeters(a.lat, a.lng, b.lat, b.lng)
    expect(distance).toBeGreaterThan(MAX_SAMPLE_SPREAD_METERS)
    expect(samplesConsistent(a, b)).toBe(false)
  })
})

describe('isWithinRadius', () => {
  it('returns true when inside the radius', () => {
    expect(isWithinRadius(-34.6037, -58.3816, -34.6038, -58.3816, 200)).toBe(true)
  })

  it('returns false when outside the radius', () => {
    const distance = haversineDistanceMeters(-34.6037, -58.3816, -34.6, -58.39)
    expect(distance).toBeGreaterThan(200)
    expect(isWithinRadius(-34.6037, -58.3816, -34.6, -58.39, 200)).toBe(false)
  })
})

describe('validateGpsSamples', () => {
  const fresh = (offsetMs: number) => ({
    lat: -34.6037,
    lng: -58.3816,
    capturedAt: new Date(Date.now() - offsetMs).toISOString(),
  })

  it('passes for valid samples', () => {
    expect(() =>
      validateGpsSamples({ samples: [fresh(1000), fresh(2000)], receivedAt: new Date().toISOString() })
    ).not.toThrow()
  })

  it('throws GPS_REJECTED for stale samples', () => {
    try {
      validateGpsSamples({
        samples: [fresh(MAX_SKEW_MS + 60_000), fresh(MAX_SKEW_MS + 60_000)],
        receivedAt: new Date().toISOString(),
      })
      throw new Error('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(DeliveryError)
      expect((error as DeliveryError).code).toBe('GPS_REJECTED')
      expect((error as DeliveryError).statusCode).toBe(409)
    }
  })

  it('throws GPS_REJECTED for inconsistent samples', () => {
    const a = fresh(1000)
    const b = { lat: -34.5, lng: -58.5, capturedAt: fresh(2000).capturedAt }
    try {
      validateGpsSamples({ samples: [a, b], receivedAt: new Date().toISOString() })
      throw new Error('should have thrown')
    } catch (error) {
      expect((error as DeliveryError).code).toBe('GPS_REJECTED')
    }
  })
})

describe('validateProximity', () => {
  it('throws GPS_REJECTED when no coordinates are stored for the visit', () => {
    try {
      validateProximity({
        visitLat: null,
        visitLng: null,
        sample: { lat: -34.6037, lng: -58.3816, capturedAt: new Date().toISOString() },
        radiusMeters: 200,
      })
      throw new Error('should have thrown')
    } catch (error) {
      expect((error as DeliveryError).code).toBe('GPS_REJECTED')
    }
  })

  it('throws GPS_REJECTED when the sample is outside the radius', () => {
    try {
      validateProximity({
        visitLat: -34.6037,
        visitLng: -58.3816,
        sample: { lat: -34.5, lng: -58.5, capturedAt: new Date().toISOString() },
        radiusMeters: 200,
      })
      throw new Error('should have thrown')
    } catch (error) {
      expect((error as DeliveryError).code).toBe('GPS_REJECTED')
    }
  })

  it('passes when inside the radius', () => {
    expect(() =>
      validateProximity({
        visitLat: -34.6037,
        visitLng: -58.3816,
        sample: { lat: -34.60371, lng: -58.3816, capturedAt: new Date().toISOString() },
        radiusMeters: 200,
      })
    ).not.toThrow()
  })
})
