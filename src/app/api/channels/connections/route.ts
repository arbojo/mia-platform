import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ping } from '@/lib/channels/router'
import { toChannelConnection } from '@/lib/channels/connection'
import type { ChannelConnectionRow } from '@/lib/channels/connection'
import type { ChannelType } from '@/lib/channels/types'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: businesses } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)

    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ connections: [] })
    }

    const businessIds = businesses.map((b) => b.id)

    const { data: connections } = await supabase
      .from('channel_connections')
      .select('*')
      .in('business_id', businessIds)
      .order('created_at', { ascending: false })

    return NextResponse.json({ connections: connections ?? [] })
  } catch (error) {
    console.error('Get connections error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { businessId, assistantId, channel, credentials, configuration } = await request.json()

    if (!businessId || !assistantId || !channel) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const validChannels: ChannelType[] = ['web', 'whatsapp', 'messenger', 'instagram']
    if (!validChannels.includes(channel)) {
      return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .eq('owner_id', user.id)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const admin = createAdminClient()

    const storedCredentials =
      credentials && typeof credentials === 'object' ? credentials : {}
    const storedConfiguration =
      configuration && typeof configuration === 'object' ? configuration : {}
    const hasCredentials = Object.keys(storedCredentials).length > 0
    const status = channel === 'web' || hasCredentials ? 'connected' : 'disconnected'

    const { data: existing } = await admin
      .from('channel_connections')
      .select('*')
      .eq('business_id', businessId)
      .eq('assistant_id', assistantId)
      .eq('channel', channel)
      .limit(1)
      .single()

    let connection: ChannelConnectionRow | null = null
    let updated = false

    if (existing) {
      const result = await admin
        .from('channel_connections')
        .update({
          credentials: storedCredentials,
          configuration: storedConfiguration,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 })
      }

      connection = result.data
      updated = true
    } else {
      const result = await admin
        .from('channel_connections')
        .insert({
          business_id: businessId,
          assistant_id: assistantId,
          channel,
          credentials: storedCredentials,
          configuration: storedConfiguration,
          status,
        })
        .select()
        .single()

      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 })
      }

      connection = result.data
    }

    let health = null

    if (channel !== 'web' && connection) {
      health = await ping(
        channel as ChannelType,
        toChannelConnection(connection as ChannelConnectionRow)
      )

      await admin
        .from('channel_connections')
        .update({
          status: health.status,
          last_sync: new Date().toISOString(),
          error_message: health.error ?? null,
        })
        .eq('id', connection.id)

      connection.status = health.status
      connection.error_message = health.error ?? null
      connection.last_sync = new Date().toISOString()
    }

    return NextResponse.json({ connection, updated, health })
  } catch (error) {
    console.error('Create connection error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { connectionId } = await request.json()

    if (!connectionId) {
      return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: connection } = await admin
      .from('channel_connections')
      .select('id, business_id')
      .eq('id', connectionId)
      .single()

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', connection.business_id)
      .eq('owner_id', user.id)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await admin
      .from('channel_connections')
      .delete()
      .eq('id', connectionId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete connection error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
