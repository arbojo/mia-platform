'use client'

const DB_NAME = 'mia-driver-outbox'
const STORE = 'actions'

export interface OutboxAction {
  idempotencyKey: string
  eventType: string
  visitId: string
  orderId?: string | null
  samples?: Array<{ lat: number; lng: number; capturedAt: string }>
  payload?: Record<string, unknown>
  createdAt?: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'))
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'idempotencyKey' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function enqueueAction(action: OutboxAction): Promise<void> {
  const db = await openDb()
  const record: OutboxAction = {
    ...action,
    createdAt: action.createdAt ?? new Date().toISOString(),
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingActions(): Promise<OutboxAction[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).getAll()
    request.onsuccess = () => resolve((request.result as OutboxAction[]) ?? [])
    request.onerror = () => reject(request.error)
  })
}

export async function removeAction(idempotencyKey: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(idempotencyKey)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
