import { createDeliveryAdmin } from './db'
import { canBusinessUseDeliveryHub } from '@/lib/system/edition'
import { DeliveryError } from './errors'

export async function assertDeliveryEditionAvailable(businessId: string): Promise<void> {
  if (!(await canBusinessUseDeliveryHub(businessId))) {
    throw new DeliveryError(
      'DELIVERY_NOT_ENABLED',
      'El Delivery Hub no está disponible en tu plan',
      403
    )
  }
}

export async function assertDeliveryHubEnabled(businessId: string): Promise<void> {
  await assertDeliveryEditionAvailable(businessId)

  const supabase = createDeliveryAdmin()
  const { data, error } = await supabase
    .from('business_settings')
    .select('enabled')
    .eq('business_id', businessId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.enabled) {
    throw new DeliveryError(
      'DELIVERY_NOT_ENABLED',
      'El Delivery Hub no está habilitado para este negocio',
      403
    )
  }
}

export async function getDeliverySettings(businessId: string) {
  const supabase = createDeliveryAdmin()
  const { data, error } = await supabase
    .from('business_settings')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}
