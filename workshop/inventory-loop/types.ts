export interface InventoryAsset {
  id: string
  business_id: string
  tracking_mode: 'quantity' | 'serial' | 'single'
  current_qty: number
}

export interface InventoryMovement {
  id: string
  asset_id: string
  quantity_delta: number
  movement_type:
    | 'initial'
    | 'sale'
    | 'purchase'
    | 'adjustment'
    | 'restock'
    | 'waste'
    | 'return'
    | 'import'
}

export interface InventoryIngestError {
  id: string
  sales_event_id: string
  error: string
}

export interface InventoryFixture {
  assets: InventoryAsset[]
  movements: InventoryMovement[]
  ingest_errors: InventoryIngestError[]
}

export type AnomalyKind = 'LEDGER_DRIFT' | 'ORPHAN_MOVEMENT' | 'INGEST_ERRORS'

export interface InventoryAnomaly {
  kind: AnomalyKind
  asset_id: string | null
  expected_qty: number | null
  actual_qty: number | null
  detail: string
}

export interface CandidateAdjustment {
  asset_id: string
  delta: number
  reason: string
}

export interface CandidateCorrection {
  diagnosis: string
  adjustments: CandidateAdjustment[]
}

export type LoopSignal = 'SUCCESS' | 'FAILURE' | 'SAFETY_REJECTED' | 'INFRA_FAILURE'

export type TerminalStatus = 'COMPLETE' | 'BLOCK'

export type CheckpointOutcome = 'ESCALATION_CHECKPOINTED' | 'ESCALATION_UNRECORDED' | 'none'

export type FailureReason =
  | 'INVALID_CANDIDATE_JSON'
  | 'SCHEMA_MISMATCH'
  | 'SAFETY_REJECTED'
  | 'VALIDATION_FAILURE'
  | 'INFRA_FAILURE'
  | 'ATTEMPTS_EXHAUSTED'
  | 'GOVERNANCE_REFUSED'
  | 'ESCALATION_UNRECORDED'
  | 'ESCALATION_FAILED'

export interface EvidenceRecord {
  mission_id: string
  attempt: number | null
  worker: string | null
  model: string | null
  start_time: string
  end_time: string
  duration_ms: number
  session_id: string | null
  observation: string
  anomaly: unknown
  diagnosis: string | null
  candidate: unknown
  validation_result: string
  failure_reason: FailureReason | null
  checkpoint: CheckpointOutcome
  next_action: string
}

export interface InventoryMissionResult {
  status: TerminalStatus
  reason: string
  failure_reason: FailureReason | null
  workerCalls: number
  attemptsUsed: number
  checkpoint: CheckpointOutcome
  sessionId: string | null
  anomaliesRemaining: InventoryAnomaly[]
}
