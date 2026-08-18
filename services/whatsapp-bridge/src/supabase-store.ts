import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  initAuthCreds,
  BufferJSON,
  proto,
} from '@whiskeysockets/baileys'
import type {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
  SignalDataSet,
} from '@whiskeysockets/baileys'
import type { BridgeConfig } from './config.js'

interface SessionRow {
  creds: Record<string, unknown>
  keys: Record<string, Record<string, unknown>>
  status: string
}

function serializeValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer))
}

function deserializeValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver) as T
}

/**
 * Persists a Baileys AuthenticationState in Supabase (whatsapp_sessions).
 * `keys` is stored as `{ [type]: { [id]: value } }` in a JSONB column.
 * The bridge connects with the service role key, which bypasses RLS.
 *
 * All writes are serialized per-business via a promise chain to prevent
 * last-write-wins races between concurrent keys.set() and saveCreds() calls.
 */
interface CachedState {
  creds: AuthenticationCreds
  keysRow: Record<string, Record<string, unknown>>
}

export class SupabaseAuthStore {
  private readonly client: SupabaseClient
  private readonly writeQueues = new Map<string, Promise<void>>()
  private readonly stateCache = new Map<string, CachedState>()

  constructor(private readonly config: BridgeConfig) {
    this.client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  private enqueueWrite(businessId: string, fn: () => Promise<void>): Promise<void> {
    const prev = this.writeQueues.get(businessId) ?? Promise.resolve()
    const next = prev.then(fn, fn)
    this.writeQueues.set(businessId, next)
    return next
  }

  async load(businessId: string): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
    let creds: AuthenticationCreds
    let keysRow: Record<string, Record<string, unknown>>

    const cached = this.stateCache.get(businessId)
    if (cached) {
      creds = cached.creds
      keysRow = cached.keysRow
    } else {
      const { data, error } = await this.client
        .from('whatsapp_sessions')
        .select('creds, keys')
        .eq('business_id', businessId)
        .maybeSingle()

      if (error) {
        throw new Error(`Failed to load WhatsApp session for ${businessId}: ${error.message}`)
      }

      if (data && data.creds && Object.keys(data.creds as Record<string, unknown>).length > 0) {
        creds = deserializeValue(data.creds) as AuthenticationCreds
      } else {
        creds = initAuthCreds()
      }

      const rawKeys: Record<string, Record<string, unknown>> =
        data && data.keys ? (data.keys as Record<string, Record<string, unknown>>) : {}

      keysRow = {}
      for (const type of Object.keys(rawKeys)) {
        const bucket = rawKeys[type]
        if (!bucket) continue
        keysRow[type] = {}
        for (const id of Object.keys(bucket)) {
          const raw = bucket[id]
          if (raw !== undefined && raw !== null) {
            keysRow[type][id] = deserializeValue(raw)
          }
        }
      }

      this.stateCache.set(businessId, { creds, keysRow })
    }

    const state: AuthenticationState = {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[]
        ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
          const out: Record<string, unknown> = {}
          const bucket = keysRow[type] ?? {}
          for (const id of ids) {
            let value = bucket[id]
            if (value !== undefined && value !== null) {
              value = deserializeValue(value)
              if (type === 'app-state-sync-key') {
                value = proto.Message.AppStateSyncKeyData.fromObject(
                  value as Record<string, unknown>
                ) as unknown
              }
              out[id] = value
            }
          }
          return out as { [id: string]: SignalDataTypeMap[T] }
        },

        set: async (data: SignalDataSet): Promise<void> => {
          for (const type of Object.keys(data) as Array<keyof SignalDataTypeMap>) {
            const values = data[type]
            if (!values) continue
            const bucket = keysRow[type] ?? {}
            for (const id of Object.keys(values)) {
              const value = values[id]
              if (value === null || value === undefined) {
                delete bucket[id]
              } else {
                bucket[id] = serializeValue(value)
              }
            }
            keysRow[type] = bucket
          }
          await this.enqueueWrite(businessId, () =>
            this.writeKeys(businessId, serializeValue(keysRow) as Record<string, Record<string, unknown>>)
          )
        },

        clear: async (): Promise<void> => {
          keysRow = {}
          this.stateCache.delete(businessId)
          await this.client
            .from('whatsapp_sessions')
            .update({ keys: {}, updated_at: new Date().toISOString() })
            .eq('business_id', businessId)
        },
      },
    }

    const saveCreds = async (): Promise<void> => {
      this.stateCache.set(businessId, { creds, keysRow })
      await this.enqueueWrite(businessId, () =>
        this.upsert(businessId, {
          creds: serializeValue(creds) as Record<string, unknown>,
          keys: serializeValue(keysRow) as Record<string, Record<string, unknown>>,
        })
      )
    }

    return { state, saveCreds }
  }

  private async writeKeys(
    businessId: string,
    keys: Record<string, Record<string, unknown>>
  ): Promise<void> {
    const { error } = await this.client
      .from('whatsapp_sessions')
      .update({ keys, updated_at: new Date().toISOString() })
      .eq('business_id', businessId)
    if (error) {
      throw new Error(`Failed to persist WhatsApp keys: ${error.message}`)
    }
  }

  private async upsert(
    businessId: string,
    payload: { creds: Record<string, unknown>; keys: Record<string, Record<string, unknown>> }
  ): Promise<void> {
    const { error } = await this.client
      .from('whatsapp_sessions')
      .upsert(
        {
          business_id: businessId,
          creds: payload.creds,
          keys: payload.keys,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'business_id' }
      )
    if (error) {
      throw new Error(`Failed to persist WhatsApp session: ${error.message}`)
    }
  }

  async flushWrites(businessId: string): Promise<void> {
    const queue = this.writeQueues.get(businessId)
    if (queue) await queue
  }

  async updateStatus(
    businessId: string,
    fields: Partial<Pick<SessionRow, 'status'>> & {
      phone?: string | null
      pairing_code?: string | null
      error_message?: string | null
      last_qr?: string | null
    }
  ): Promise<void> {
    await this.client
      .from('whatsapp_sessions')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('business_id', businessId)
  }

  async getSession(businessId: string): Promise<SessionRow | null> {
    const { data } = await this.client
      .from('whatsapp_sessions')
      .select('creds, keys, status')
      .eq('business_id', businessId)
      .maybeSingle()
    return (data as SessionRow | null) ?? null
  }

  async delete(businessId: string): Promise<void> {
    this.writeQueues.delete(businessId)
    this.stateCache.delete(businessId)
    await this.client.from('whatsapp_sessions').delete().eq('business_id', businessId)
  }
}
