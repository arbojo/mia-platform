import { requireAuth } from '@/lib/auth'
import { DeliveryError } from './errors'

export async function requireDeliveryAdmin(
  businessId: string | null
): Promise<{ userId: string; businessId: string }> {
  if (!businessId) {
    throw new DeliveryError('INVALID_INPUT', 'business_id es requerido', 400)
  }

  const { user, supabase } = await requireAuth()

  const { data, error } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new DeliveryError('FORBIDDEN', 'No autorizado para este negocio', 403)
  }

  return { userId: user.id, businessId }
}
