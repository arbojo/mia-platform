import { createDeliveryAdmin } from './db'
import { canUseDeliveryHub } from '@/lib/system/edition'
import { DeliveryError } from './errors'

export async function assertDeliveryHubEnabled(businessId: string): Promise<void> {
  if (!canUseDeliveryHub()) {
    throw new DeliveryError(
      'DELIVERY_NOT_ENABLED',
      'El Delivery Hub no está disponible en tu edición',
      403
    )
  }

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
