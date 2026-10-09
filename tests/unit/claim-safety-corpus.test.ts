import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { findForbiddenClaims, findMedicalReferrals } from '../../src/lib/ai/claim-safety'

interface CorpusCase {
  id: string
  category: string
  source: string
  input: string
  context?: string
  should_flag: boolean
  expected_kind: 'claim' | 'referral' | 'none'
  severity: 'high' | 'medium' | 'low'
  note?: string
}

interface Corpus {
  version: string
  meta: Record<string, unknown>
  cases: CorpusCase[]
}

function loadCorpus(): Corpus {
  const filePath = path.join(__dirname, '..', 'fixtures', 'health-safety-corpus.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as Corpus
}

describe('claim safety corpus (Fase 3)', () => {
  const corpus = loadCorpus()

  describe.each(corpus.cases)('$id [$category] (should_flag=$should_flag, kind=$expected_kind)', (c) => {
    it('matches expected detection', () => {
      const claims = findForbiddenClaims(c.input)
      const refs = findMedicalReferrals(c.input)
      const hasClaim = claims.length > 0
      const hasReferral = refs.length > 0

      if (c.should_flag) {
        if (c.expected_kind === 'claim') {
          expect(hasClaim).toBe(true)
        } else if (c.expected_kind === 'referral') {
          expect(hasReferral || hasClaim).toBe(true)
        }
      } else {
        if (c.expected_kind === 'none') {
          expect(hasClaim).toBe(false)
        }
      }
    })
  })
})
