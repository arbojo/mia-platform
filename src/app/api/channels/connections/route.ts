import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

    const { businessId, assistantId, channel } = await request.json()

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

    const { data: existing } = await admin
      .from('channel_connections')
      .select('id')
      .eq('business_id', businessId)
      .eq('assistant_id', assistantId)
      .eq('channel', channel)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Channel already connected' }, { status: 409 })
    }

    const { data: connection, error } = await admin
      .from('channel_connections')
      .insert({
        business_id: businessId,
        assistant_id: assistantId,
        channel,
        status: channel === 'web' ? 'connected' : 'disconnected',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ connection })
  } catch (error) {
    console.error('Create connection error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { connectionId, mode } = await request.json()

    if (!connectionId || !mode) {
      return NextResponse.json({ error: 'Missing connectionId or mode' }, { status: 400 })
    }

    const validModes = ['active', 'shadow', 'paused']
    if (!validModes.includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
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

    const { data: updated, error } = await admin
      .from('channel_connections')
      .update({ mode, updated_at: new Date().toISOString() })
      .eq('id', connectionId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ connection: updated })
  } catch (error) {
    console.error('Update connection mode error:', error)
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
