import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ping, connect, disconnect } from '@/lib/channels/router'
import { toChannelConnection } from '@/lib/channels/connection'
import type { ChannelConnectionRow } from '@/lib/channels/connection'

const validActions = ['connect', 'disconnect', 'ping']

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { action } = await request.json()

    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: row } = await admin
      .from('channel_connections')
      .select('*')
      .eq('id', id)
      .single()

    if (!row) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', row.business_id)
      .eq('owner_id', user.id)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const connection = toChannelConnection(row as ChannelConnectionRow)

    const health =
      action === 'ping'
        ? await ping(connection.channel, connection)
        : action === 'connect'
          ? await connect(connection.channel, connection)
          : await disconnect(connection.channel, connection)

    const updateFields: Record<string, unknown> = {
      status: health.status,
      error_message: health.error ?? null,
      updated_at: new Date().toISOString(),
    }
    if (action !== 'disconnect') {
      updateFields.last_sync = new Date().toISOString()
    }

    const { data: updated, error } = await admin
      .from('channel_connections')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ connection: updated, health })
  } catch (error) {
    console.error('Connection action error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
