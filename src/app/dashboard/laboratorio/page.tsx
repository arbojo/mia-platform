import { requireAuth } from '@/lib/auth'
import { LaboratorioClient } from '@/components/laboratorio/LaboratorioClient'

export default async function LaboratorioPage() {
  const { supabase, user } = await requireAuth()

  const { data: businesses } = await supabase
    .from('businesses')
    .select('*, assistants(*)')
    .eq('owner_id', user.id)

  return (
    <LaboratorioClient businesses={businesses ?? []} />
  )
}
