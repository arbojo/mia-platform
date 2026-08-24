import type { InventoryFixture } from './types'

export function saneFixture(): InventoryFixture {
  return {
    assets: [
      { id: 'asset-a1', business_id: 'biz-1', tracking_mode: 'quantity', current_qty: 7 },
      { id: 'asset-a2', business_id: 'biz-1', tracking_mode: 'quantity', current_qty: 8 },
    ],
    movements: [
      { id: 'm1', asset_id: 'asset-a1', quantity_delta: 10, movement_type: 'initial' },
      { id: 'm2', asset_id: 'asset-a1', quantity_delta: -3, movement_type: 'sale' },
      { id: 'm3', asset_id: 'asset-a2', quantity_delta: 4, movement_type: 'initial' },
      { id: 'm4', asset_id: 'asset-a2', quantity_delta: 6, movement_type: 'purchase' },
      { id: 'm5', asset_id: 'asset-a2', quantity_delta: -2, movement_type: 'waste' },
    ],
    ingest_errors: [],
  }
}

export function driftedLedgerFixture(): InventoryFixture {
  const fixture = saneFixture()
  fixture.assets[0]!.current_qty = 3
  return fixture
}

export function ingestErrorsFixture(): InventoryFixture {
  const fixture = saneFixture()
  fixture.ingest_errors = [
    { id: 'err-1', sales_event_id: 'sale-1', error: 'INSUFFICIENT_STOCK' },
    { id: 'err-2', sales_event_id: 'sale-2', error: 'INSUFFICIENT_STOCK' },
  ]
  return fixture
}

export function orphanMovementFixture(): InventoryFixture {
  const fixture = saneFixture()
  fixture.movements.push({
    id: 'm-orphan',
    asset_id: 'asset-ghost',
    quantity_delta: 5,
    movement_type: 'import',
  })
  return fixture
}

export function mixedCorruptFixture(): InventoryFixture {
  const fixture = saneFixture()
  fixture.assets[0]!.current_qty = 1
  fixture.movements.push({
    id: 'm-orphan',
    asset_id: 'asset-ghost',
    quantity_delta: 5,
    movement_type: 'import',
  })
  fixture.ingest_errors = [
    { id: 'err-1', sales_event_id: 'sale-9', error: 'INSUFFICIENT_STOCK' },
  ]
  return fixture
}
