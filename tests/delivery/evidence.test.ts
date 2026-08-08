import { describe, it, expect } from 'vitest'
import { detectImageType, validateEvidencePhoto, MAX_EVIDENCE_BYTES } from '@/lib/delivery/evidence'
import { DeliveryError } from '@/lib/delivery/errors'

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
])
const webp = Buffer.concat([
  Buffer.from([0x52, 0x49, 0x46, 0x46]),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from([0x57, 0x45, 0x42, 0x50]),
  Buffer.alloc(8),
])
const text = Buffer.from('not an image at all')

describe('detectImageType', () => {
  it('detects jpeg', () => {
    expect(detectImageType(jpeg)).toBe('jpeg')
  })

  it('detects png', () => {
    expect(detectImageType(png)).toBe('png')
  })

  it('detects webp', () => {
    expect(detectImageType(webp)).toBe('webp')
  })

  it('returns null for unknown content', () => {
    expect(detectImageType(text)).toBeNull()
  })

  it('returns null for buffers too short to hold a magic number', () => {
    expect(detectImageType(Buffer.from([0xff]))).toBeNull()
    expect(detectImageType(Buffer.alloc(0))).toBeNull()
  })
})

describe('validateEvidencePhoto', () => {
  it('rejects an empty buffer', () => {
    try {
      validateEvidencePhoto(Buffer.alloc(0))
      throw new Error('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(DeliveryError)
      expect((error as DeliveryError).code).toBe('INVALID_INPUT')
      expect((error as DeliveryError).statusCode).toBe(400)
    }
  })

  it('rejects buffers over the size limit', () => {
    const oversized = Buffer.alloc(MAX_EVIDENCE_BYTES + 1)
    oversized[0] = 0xff
    oversized[1] = 0xd8
    oversized[2] = 0xff
    try {
      validateEvidencePhoto(oversized)
      throw new Error('should have thrown')
    } catch (error) {
      expect((error as DeliveryError).code).toBe('INVALID_INPUT')
    }
  })

  it('rejects non-image content', () => {
    try {
      validateEvidencePhoto(Buffer.alloc(100).fill(0x41))
      throw new Error('should have thrown')
    } catch (error) {
      expect((error as DeliveryError).code).toBe('INVALID_INPUT')
    }
  })

  it('accepts a valid jpeg within size limits', () => {
    const valid = Buffer.alloc(100)
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(valid)
    expect(validateEvidencePhoto(valid)).toBe('jpeg')
  })
})
