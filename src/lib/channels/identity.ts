import { createAdminClient } from '@/lib/supabase/admin'

interface CustomerMessage {
  channel: string
  customerExternalId: string
  customerName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
}

interface ResolvedCustomer {
  id: string
  businessId: string
  name: string | null
  phone: string | null
  email: string | null
  isNew: boolean
}

export async function resolveCustomer(
  businessId: string,
  message: CustomerMessage
): Promise<ResolvedCustomer> {
  const supabase = createAdminClient()

  const enrichExisting = async (
    customer: {
      id: string
      business_id: string
      name: string | null
      phone: string | null
      email: string | null
    }
  ): Promise<ResolvedCustomer> => {
    const patch: { name?: string; phone?: string } = {}
    const incomingName = message.customerName?.trim()
    const incomingPhone = message.customerPhone?.trim()

    if (!customer.name?.trim() && incomingName) {
      patch.name = incomingName
    }
    if (!customer.phone?.trim() && incomingPhone) {
      patch.phone = incomingPhone
    }

    let resolvedName = customer.name
    let resolvedPhone = customer.phone

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('customers').update(patch).eq('id', customer.id)
      if (error) {
        throw new Error(`Failed to enrich customer ${customer.id}: ${error.message}`)
      }
      resolvedName = patch.name ?? customer.name
      resolvedPhone = patch.phone ?? customer.phone
    }

    return {
      id: customer.id,
      businessId: customer.business_id,
      name: resolvedName,
      phone: resolvedPhone,
      email: customer.email,
      isNew: false,
    }
  }

  const { data: existingByExternal } = await supabase
    .from('channel_messages')
    .select('customer_id')
    .eq('business_id', businessId)
    .eq('external_customer_id', message.customerExternalId)
    .eq('channel', message.channel)
    .not('customer_id', 'is', null)
    .limit(1)
    .maybeSingle()

  if (existingByExternal?.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', existingByExternal.customer_id)
      .single()

    if (customer) {
      return await enrichExisting(customer)
    }
  }

  if (message.customerPhone) {
    const { data: existingByPhone } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .eq('phone', message.customerPhone)
      .limit(1)
      .maybeSingle()

    if (existingByPhone) {
      return await enrichExisting(existingByPhone)
    }
  }

  if (message.customerEmail) {
    const { data: existingByEmail } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .eq('email', message.customerEmail)
      .limit(1)
      .maybeSingle()

    if (existingByEmail) {
      return await enrichExisting(existingByEmail)
    }
  }

  const { data: newCustomer, error } = await supabase
    .from('customers')
    .insert({
      business_id: businessId,
      name: message.customerName ?? null,
      phone: message.customerPhone ?? null,
      email: message.customerEmail ?? null,
      status: 'new',
    })
    .select()
    .single()

  if (error || !newCustomer) {
    throw new Error(`Failed to create customer: ${error?.message}`)
  }

  return {
    id: newCustomer.id,
    businessId: newCustomer.business_id,
    name: newCustomer.name,
    phone: newCustomer.phone,
    email: newCustomer.email,
    isNew: true,
  }
}
