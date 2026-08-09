import { createInventoryAdmin } from './db'
import { canUseInventoryHub } from '@/lib/system/edition'
import { InventoryError } from './errors'

export function assertInventoryEditionAvailable(): void {
  if (!canUseInventoryHub()) {
    throw new InventoryError(
      'INVENTORY_NOT_ENABLED',
      'El Inventory Hub no está disponible en tu edición',
      403
    )
  }
}

export async function assertInventoryHubEnabled(businessId: string): Promise<void> {
  assertInventoryEditionAvailable()

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
