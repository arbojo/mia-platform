import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LaboratorioClient } from '@/components/laboratorio/LaboratorioClient'

export default async function LaboratorioPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: businesses } = await supabase
    .from('businesses')
    .select('*, assistants(*)')
    .eq('owner_id', user.id)

  return (
    <LaboratorioClient businesses={businesses ?? []} />
  )
}
