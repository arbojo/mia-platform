import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RecoveryMonitor,
  loadRecoveryConfig,
  recoveryMarkerMetadata,
  type RecoveryConfig,
} from './recovery-monitor.js'
import type { BridgeConfig } from './config.js'
import type { SessionManager } from './session-manager.js'

const BUSINESS_ID = 'biz-1'
const CONNECTION_ID = 'conn-wa-1'

const baseConfig = {
  miaAppUrl: 'http://mia.test',
  bridgeSecret: 'bridge-secret',
  supabaseUrl: 'http://supabase.test',
  supabaseServiceRoleKey: 'service-role',
} as unknown as BridgeConfig

const recoveryConfig: RecoveryConfig = { checkIntervalMs: 60_000 }

interface FakeCalls {
  seq: string[]
  inserted: Record<string, unknown>[]
  updated: Record<string, unknown>[]
  signals: Record<string, unknown>[]
}

function createFakeDb(connection: unknown): { db: unknown; calls: FakeCalls } {
  const calls: FakeCalls = { seq: [], inserted: [], updated: [], signals: [] }

  const db = {
    from(table: string) {
      if (table === 'channel_connections') {
        const q: Record<string, unknown> = {}
        const self = () => q
        q.select = self
        q.eq = self
        q.mode = undefined
        q.maybeSingle = () => Promise.resolve({ data: connection, error: null })
        return q
      }
      if (table === 'channel_messages') {
        return {
          insert(row: Record<string, unknown>) {
            calls.seq.push('insert-marker')
            calls.inserted.push(row)
            return {
              select() {
                return {
                  single: () => Promise.resolve({ data: { id: 'cm-1' }, error: null }),
                }
              },
            }
          },
          update(patch: Record<string, unknown>) {
            return {
              eq() {
                calls.updated.push(patch)
                return Promise.resolve({ error: null })
              },
            }
          },
        }
      }
      if (table === 'mia_signals') {
        return {
          insert(row: Record<string, unknown>) {
            calls.signals.push(row)
            return Promise.resolve({ error: null })
          },
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }

  return { db, calls }
}

function createManager(sendResult: { success: boolean; error?: string } = { success: true }) {
  const seq: string[] = []
  const sendMessage = vi.fn(async () => {
    seq.push('send')
    return sendResult
  })
  const manager = {
    listHealth: () => [{ businessId: BUSINESS_ID, status: 'connected' }],
    sendMessage,
  }
  return { manager: manager as unknown as SessionManager, sendMessage, seq }
}

function stubFetch(payload: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status,
    text: async () => '',
    json: async () => payload,
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const dueItem = {
  customerId: 'cust-1',
  conversationId: 'conv-1',
  phone: '5214771234567',
  attempt: 1 as const,
  content: 'hola',
  inboundVersion: '2026-02-01T11:45:00.000Z',
}

describe('loadRecoveryConfig', () => {
  it('defaults to a 60s scan interval', () => {
    expect(loadRecoveryConfig({} as unknown as NodeJS.ProcessEnv)).toEqual({
      checkIntervalMs: 60_000,
    })
  })

  it('honours RECOVERY_CHECK_INTERVAL_MS when valid', () => {
    expect(
      loadRecoveryConfig({ RECOVERY_CHECK_INTERVAL_MS: '15000' } as unknown as NodeJS.ProcessEnv)
    ).toEqual({ checkIntervalMs: 15_000 })
  })

  it('falls back on invalid values', () => {
    expect(
      loadRecoveryConfig({ RECOVERY_CHECK_INTERVAL_MS: '-5' } as unknown as NodeJS.ProcessEnv)
    ).toEqual({ checkIntervalMs: 60_000 })
  })
})

describe('recoveryMarkerMetadata', () => {
  it('builds the dedup marker shape', () => {
    expect(recoveryMarkerMetadata(2, '2026-02-01T11:45:00.000Z', CONNECTION_ID)).toEqual({
      recovery: true,
      recovery_attempt: 2,
      recovery_inbound_version: '2026-02-01T11:45:00.000Z',
      connection_id: CONNECTION_ID,
    })
  })
})

describe('RecoveryMonitor', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('persists the marker before sending, then records the outcome', async () => {
    const { db, calls } = createFakeDb({
      id: CONNECTION_ID,
      assistant_id: 'asst-1',
      configuration: { recovery_enabled: true },
    })
    const { manager, sendMessage, seq } = createManager({ success: true })
    stubFetch({ success: true, due: [dueItem] })

    const monitor = new RecoveryMonitor(
      manager,
      baseConfig,
      recoveryConfig,
      db as never
    )
    await monitor.scanOnce()

    expect(sendMessage).toHaveBeenCalledWith(BUSINESS_ID, dueItem.phone, dueItem.content)
    expect(calls.inserted).toHaveLength(1)
    expect(calls.inserted[0]).toMatchObject({
      customer_id: dueItem.customerId,
      direction: 'outgoing',
      status: 'processing',
      metadata: expect.objectContaining({
        recovery: true,
        recovery_attempt: 1,
        recovery_inbound_version: dueItem.inboundVersion,
      }),
    })
    // The marker is written BEFORE the send so a crash can never double-send.
    expect(seq.indexOf('insert-marker')).toBeLessThan(seq.indexOf('send'))
    expect(calls.updated).toEqual([{ status: 'sent', sent_at: expect.any(String) }])
    expect(calls.signals).toHaveLength(1)
  })

  it('does nothing when recovery is not enabled on the connection', async () => {
    const { db } = createFakeDb({
      id: CONNECTION_ID,
      assistant_id: 'asst-1',
      configuration: { recovery_enabled: false },
    })
    const { manager, sendMessage } = createManager()
    const fetchMock = stubFetch({ success: true, due: [dueItem] })

    const monitor = new RecoveryMonitor(manager, baseConfig, recoveryConfig, db as never)
    await monitor.scanOnce()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('claims the marker even when the send fails (no duplicate on retry)', async () => {
    const { db, calls } = createFakeDb({
      id: CONNECTION_ID,
      assistant_id: 'asst-1',
      configuration: { recovery_enabled: true },
    })
    const { manager, sendMessage, seq } = createManager({
      success: false,
      error: 'session down',
    })
    const fetchMock = stubFetch({ success: true, due: [dueItem] })

    const monitor = new RecoveryMonitor(manager, baseConfig, recoveryConfig, db as never)
    await monitor.scanOnce()

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(seq.filter((s) => s === 'send')).toHaveLength(1)
    expect(calls.inserted).toHaveLength(1)
    expect(calls.updated[0]).toMatchObject({ status: 'failed', error_message: 'session down' })
    expect(calls.signals).toHaveLength(0)

    // MIA dedups on the marker, so the next scan returns nothing for it.
    stubFetch({ success: true, due: [] })
    await monitor.scanOnce()
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('stays silent when MIA is unreachable', async () => {
    const { db } = createFakeDb({
      id: CONNECTION_ID,
      assistant_id: 'asst-1',
      configuration: { recovery_enabled: true },
    })
    const { manager, sendMessage } = createManager()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      })
    )

    const monitor = new RecoveryMonitor(manager, baseConfig, recoveryConfig, db as never)
    await monitor.scanOnce()

    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('processes every due item in one scan', async () => {
    const { db, calls } = createFakeDb({
      id: CONNECTION_ID,
      assistant_id: 'asst-1',
      configuration: { recovery_enabled: true },
    })
    const { manager, sendMessage } = createManager({ success: true })
    stubFetch({
      success: true,
      due: [dueItem, { ...dueItem, customerId: 'cust-2', attempt: 2, content: 'sigo aquí' }],
    })

    const monitor = new RecoveryMonitor(manager, baseConfig, recoveryConfig, db as never)
    await monitor.scanOnce()

    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(calls.inserted).toHaveLength(2)
    expect(calls.signals).toHaveLength(2)
  })
})
