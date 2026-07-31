import type { ChannelConnection, ChannelStatus, ChannelType } from './types'

export interface ChannelConnectionRow {
  id: string
  business_id: string
  assistant_id: string
  channel: string
  status: string
  credentials: Record<string, unknown> | null
  configuration: Record<string, unknown> | null
  last_sync: string | null
  error_message: string | null
}

export function toChannelConnection(row: ChannelConnectionRow): ChannelConnection {
  return {
    id: row.id,
    businessId: row.business_id,
    assistantId: row.assistant_id,
    channel: row.channel as ChannelType,
    status: row.status as ChannelStatus,
    credentials: row.credentials ?? {},
    configuration: row.configuration ?? {},
    lastSync: row.last_sync,
    errorMessage: row.error_message,
  }
}
