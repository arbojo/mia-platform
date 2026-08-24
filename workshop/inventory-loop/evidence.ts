import { appendFileSync } from 'node:fs'
import type { EvidenceRecord } from './types'

export function appendInventoryEvidence(filePath: string, record: EvidenceRecord): void {
  appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8')
}

export interface EvidenceSink {
  append(record: EvidenceRecord): void
}

export function fileEvidenceSink(filePath: string): EvidenceSink {
  return { append: (record) => appendInventoryEvidence(filePath, record) }
}

export function memoryEvidenceSink(records: EvidenceRecord[]): EvidenceSink {
  return { append: (record) => records.push(record) }
}
