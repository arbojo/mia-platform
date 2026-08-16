import { createInventoryAdmin } from './db'
import { canBusinessUseInventoryHub } from '@/lib/system/edition'
import { InventoryError } from './errors'

export async function assertInventoryEditionAvailable(businessId: string): Promise<void> {
  if (!(await canBusinessUseInventoryHub(businessId))) {
    throw new InventoryError(
      'INVENTORY_NOT_ENABLED',
      'El Inventory Hub no está disponible en tu plan',
      403
    )
  }
}

export async function assertInventoryHubEnabled(businessId: string): Promise<void> {
  await assertInventoryEditionAvailable(businessId)

  const supabase = createInventoryAdmin()
  const { data, error } = await supabase
    .from('business_settings')
    .select('enabled')
    .eq('business_id', businessId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.enabled) {
    throw new InventoryError(
      'INVENTORY_NOT_ENABLED',
      'El Inventory Hub no está habilitado para este negocio',
      403
    )
  }
}

export async function getInventorySettings(businessId: string) {
  const supabase = createInventoryAdmin()
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
