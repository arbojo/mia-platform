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

/**
 * Persists a Baileys AuthenticationState in Supabase (whatsapp_sessions).
 * `keys` is stored as `{ [type]: { [id]: value } }` in a JSONB column.
 * The bridge connects with the service role key, which bypasses RLS.
 */
export class SupabaseAuthStore {
  private readonly client: SupabaseClient

  constructor(private readonly config: BridgeConfig) {
    this.client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  async load(businessId: string): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
    const { data, error } = await this.client
      .from('whatsapp_sessions')
      .select('creds, keys')
      .eq('business_id', businessId)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to load WhatsApp session for ${businessId}: ${error.message}`)
    }

    let creds: AuthenticationCreds
    if (data && data.creds && Object.keys(data.creds as Record<string, unknown>).length > 0) {
      creds = JSON.parse(JSON.stringify(data.creds), BufferJSON.reviver) as AuthenticationCreds
    } else {
      creds = initAuthCreds()
    }

    const keysRow: Record<string, Record<string, unknown>> =
      data && data.keys ? (data.keys as Record<string, Record<string, unknown>>) : {}

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
            if (value && type === 'app-state-sync-key') {
              value = proto.Message.AppStateSyncKeyData.fromObject(
                value as Record<string, unknown>
              ) as unknown
            }
            if (value !== undefined && value !== null) {
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
                bucket[id] = value
              }
            }
            keysRow[type] = bucket
          }
          await this.writeKeys(businessId, keysRow)
        },

        clear: async (): Promise<void> => {
          await this.client
            .from('whatsapp_sessions')
            .update({ keys: {} })
            .eq('business_id', businessId)
        },
      },
    }

    const saveCreds = async (): Promise<void> => {
      await this.upsert(businessId, {
        creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)) as Record<string, unknown>,
        keys: keysRow,
      })
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
    await this.client.from('whatsapp_sessions').delete().eq('business_id', businessId)
  }
}
