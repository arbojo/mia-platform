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

  const { data: existingByExternal } = await supabase
    .from('channel_messages')
    .select('customer_id')
    .eq('business_id', businessId)
    .eq('external_customer_id', message.customerExternalId)
    .eq('channel', message.channel)
    .not('customer_id', 'is', null)
    .limit(1)
    .single()

  if (existingByExternal?.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', existingByExternal.customer_id)
      .single()

    if (customer) {
      return {
        id: customer.id,
        businessId: customer.business_id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        isNew: false,
      }
    }
  }

  if (message.customerPhone) {
    const { data: existingByPhone } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .eq('phone', message.customerPhone)
      .limit(1)
      .single()

    if (existingByPhone) {
      return {
        id: existingByPhone.id,
        businessId: existingByPhone.business_id,
        name: existingByPhone.name,
        phone: existingByPhone.phone,
        email: existingByPhone.email,
        isNew: false,
      }
    }
  }

  if (message.customerEmail) {
    const { data: existingByEmail } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .eq('email', message.customerEmail)
      .limit(1)
      .single()

    if (existingByEmail) {
      return {
        id: existingByEmail.id,
        businessId: existingByEmail.business_id,
        name: existingByEmail.name,
        phone: existingByEmail.phone,
        email: existingByEmail.email,
        isNew: false,
      }
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
