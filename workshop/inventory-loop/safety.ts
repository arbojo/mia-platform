import type { CandidateCorrection, InventoryFixture } from './types'

export interface SafetyVerdict {
  ok: boolean
  violations: string[]
}

export type CandidateParseResult =
  | { ok: true; candidate: CandidateCorrection }
  | { ok: false; error: string }

const FORBIDDEN_CONTENT_PATTERNS: readonly RegExp[] = [
  /insert\s+into/i,
  /update\s+inventory/i,
  /delete\s+from/i,
  /drop\s+(table|database)/i,
  /supabase/i,
  /service[_-]?role/i,
  /\.env\b/i,
  /business_settings/i,
  /postgres(ql)?:\/\//i,
]

export function parseCandidateCorrection(raw: string): CandidateParseResult {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, error: 'no JSON object found in worker output' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return { ok: false, error: 'worker output is not valid JSON' }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'candidate must be a JSON object' }
  }
  const keys = Object.keys(parsed).sort()
  if (keys.length !== 2 || keys[0] !== 'adjustments' || keys[1] !== 'diagnosis') {
    return {
      ok: false,
      error: `unexpected candidate keys: expected [adjustments, diagnosis], got [${keys.join(', ')}]`,
    }
  }
  const record = parsed as Record<string, unknown>
  if (typeof record.diagnosis !== 'string' || !record.diagnosis.trim()) {
    return { ok: false, error: 'diagnosis must be a non-empty string' }
  }
  if (!Array.isArray(record.adjustments)) {
    return { ok: false, error: 'adjustments must be an array' }
  }
  const adjustments: CandidateCorrection['adjustments'] = []
  for (const entry of record.adjustments) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return { ok: false, error: 'each adjustment must be an object' }
    }
    const adjustmentKeys = Object.keys(entry).sort()
    if (
      adjustmentKeys.length !== 3 ||
      adjustmentKeys[0] !== 'asset_id' ||
      adjustmentKeys[1] !== 'delta' ||
      adjustmentKeys[2] !== 'reason'
    ) {
      return {
        ok: false,
        error: `adjustment keys must be exactly [asset_id, delta, reason], got [${adjustmentKeys.join(', ')}]`,
      }
    }
    const adjustment = entry as Record<string, unknown>
    if (typeof adjustment.asset_id !== 'string') {
      return { ok: false, error: 'asset_id must be a string' }
    }
    if (typeof adjustment.delta !== 'number' || !Number.isInteger(adjustment.delta)) {
      return { ok: false, error: 'delta must be an integer' }
    }
    if (typeof adjustment.reason !== 'string' || !adjustment.reason.trim()) {
      return { ok: false, error: 'reason must be a non-empty string' }
    }
    adjustments.push({
      asset_id: adjustment.asset_id,
      delta: adjustment.delta,
      reason: adjustment.reason,
    })
  }
  return { ok: true, candidate: { diagnosis: record.diagnosis, adjustments } }
}

export function validateCandidateSafety(
  candidate: CandidateCorrection,
  fixture: InventoryFixture,
): SafetyVerdict {
  const violations: string[] = []
  const adjustableIds = new Set(
    fixture.assets.filter((asset) => asset.tracking_mode === 'quantity').map((asset) => asset.id),
  )

  for (const adjustment of candidate.adjustments) {
    if (adjustment.delta === 0) {
      violations.push(`zero-delta adjustment for ${adjustment.asset_id}`)
    }
    if (!adjustableIds.has(adjustment.asset_id)) {
      violations.push(
        `adjustment targets unknown or non-quantity-mode asset ${adjustment.asset_id}`,
      )
    }
  }

  const serialized = JSON.stringify(candidate)
  for (const pattern of FORBIDDEN_CONTENT_PATTERNS) {
    if (pattern.test(serialized)) {
      violations.push(`forbidden content matching ${pattern} anywhere in candidate`)
    }
  }

  return { ok: violations.length === 0, violations: [...new Set(violations)] }
}
