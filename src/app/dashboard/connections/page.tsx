import { ConnectionsManager } from '@/components/connections/ConnectionsManager'
import { canUseWhatsApp, getEffectiveEdition } from '@/lib/system/edition'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile, isDemoLead } from '@/lib/system/demo'

export default async function ConnectionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let whatsAppEnabled = canUseWhatsApp()
  if (user) {
    const profile = await getUserProfile(user.id)
    if (profile && isDemoLead(profile)) {
      whatsAppEnabled = false
    } else {
      const { data: businesses } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
      const business = businesses?.[0]
      if (business) {
        whatsAppEnabled = (await getEffectiveEdition(business.id)).capabilities.whatsapp
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conexiones de MIA</h1>
        <p className="text-muted-foreground">
          Administra los canales por donde MIA se comunica con tus clientes.
        </p>
      </div>
      <ConnectionsManager whatsAppEnabled={whatsAppEnabled} />
    </div>
  )
}
