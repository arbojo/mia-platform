import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { DeliveryError } from './errors'

export const EVIDENCE_BUCKET = 'delivery-evidence'
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024
export const SIGNED_URL_TTL_SECONDS = 300

export type EvidenceImageType = 'jpeg' | 'png' | 'webp'

const MIME_BY_TYPE: Record<EvidenceImageType, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export function detectImageType(buffer: Buffer): EvidenceImageType | null {
  if (
    buffer.length > 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpeg'
  }

  if (
    buffer.length > 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png'
  }

  if (
    buffer.length > 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp'
  }

  return null
}

export function validateEvidencePhoto(buffer: Buffer): EvidenceImageType {
  if (buffer.byteLength === 0) {
    throw new DeliveryError('INVALID_INPUT', 'La foto de evidencia es obligatoria', 400)
  }

  if (buffer.byteLength > MAX_EVIDENCE_BYTES) {
    throw new DeliveryError('INVALID_INPUT', 'La foto supera el tamaño máximo de 10 MB', 400)
  }

  const type = detectImageType(buffer)
  if (!type) {
    throw new DeliveryError('INVALID_INPUT', 'Formato de imagen no permitido (JPEG, PNG o WebP)', 400)
  }

  return type
}

export async function uploadEvidencePhoto(params: {
  businessId: string
  driverId: string
  orderId: string
  buffer: Buffer
  type: EvidenceImageType
}): Promise<string> {
  const storagePath = `${params.businessId}/${params.driverId}/${params.orderId}/${crypto.randomUUID()}.${params.type}`

  const supabase = createAdminClient()
  const { error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, params.buffer, {
      contentType: MIME_BY_TYPE[params.type],
      upsert: false,
    })

  if (error) {
    throw new DeliveryError('GPS_REJECTED', 'No se pudo guardar la evidencia', 500)
  }

  return storagePath
}

export async function getSignedEvidenceUrl(storagePath: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

  if (error || !data) {
    return null
  }

  return data.signedUrl
}
