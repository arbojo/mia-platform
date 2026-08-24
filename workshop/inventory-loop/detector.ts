import type {
  CandidateCorrection,
  InventoryAnomaly,
  InventoryFixture,
  InventoryMovement,
} from './types'

export function ledgerSum(fixture: InventoryFixture, assetId: string): number {
  return fixture.movements
    .filter((movement) => movement.asset_id === assetId)
    .reduce((sum, movement) => sum + movement.quantity_delta, 0)
}

export function detectInventoryAnomalies(fixture: InventoryFixture): InventoryAnomaly[] {
  const anomalies: InventoryAnomaly[] = []
  const knownAssetIds = new Set(fixture.assets.map((asset) => asset.id))

  for (const movement of fixture.movements) {
    if (!knownAssetIds.has(movement.asset_id)) {
      anomalies.push({
        kind: 'ORPHAN_MOVEMENT',
        asset_id: movement.asset_id,
        expected_qty: null,
        actual_qty: null,
        detail: `movement ${movement.id} references unknown asset ${movement.asset_id}`,
      })
    }
  }

  for (const asset of fixture.assets) {
    if (asset.tracking_mode !== 'quantity') continue
    const expected = ledgerSum(fixture, asset.id)
    if (expected !== asset.current_qty) {
      anomalies.push({
        kind: 'LEDGER_DRIFT',
        asset_id: asset.id,
        expected_qty: expected,
        actual_qty: asset.current_qty,
        detail: `asset ${asset.id}: current_qty=${asset.current_qty} but ledger sums ${expected}`,
      })
    }
  }

  if (fixture.ingest_errors.length > 0) {
    const distinctErrors = [...new Set(fixture.ingest_errors.map((e) => e.error))]
    anomalies.push({
      kind: 'INGEST_ERRORS',
      asset_id: null,
      expected_qty: 0,
      actual_qty: fixture.ingest_errors.length,
      detail: `${fixture.ingest_errors.length} ingest error(s): ${distinctErrors.join(', ')}`,
    })
  }

  return anomalies
}

export function projectCorrection(
  fixture: InventoryFixture,
  candidate: CandidateCorrection,
): InventoryFixture {
  const projectedMovements: InventoryMovement[] = candidate.adjustments.map(
    (adjustment, index): InventoryMovement => ({
      id: `candidate-adjustment-${index + 1}`,
      asset_id: adjustment.asset_id,
      quantity_delta: adjustment.delta,
      movement_type: 'adjustment',
    }),
  )
  return {
    assets: fixture.assets.map((asset) => ({ ...asset })),
    movements: [...fixture.movements, ...projectedMovements],
    ingest_errors: fixture.ingest_errors.map((error) => ({ ...error })),
  }
}

export function anomalySignature(anomalies: readonly InventoryAnomaly[]): string {
  return anomalies
    .map((anomaly) =>
      anomaly.kind === 'LEDGER_DRIFT'
        ? `LEDGER_DRIFT:${anomaly.asset_id}:${anomaly.expected_qty}:${anomaly.actual_qty}`
        : anomaly.kind === 'ORPHAN_MOVEMENT'
          ? `ORPHAN_MOVEMENT:${anomaly.asset_id}`
          : `INGEST_ERRORS:${anomaly.actual_qty}`,
    )
    .sort()
    .join('|')
}
