import { ConnectionsManager } from '@/components/connections/ConnectionsManager'
import { canUseWhatsApp } from '@/lib/system/edition'

export default function ConnectionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conexiones de MIA</h1>
        <p className="text-muted-foreground">
          Administra los canales por donde MIA se comunica con tus clientes.
        </p>
      </div>
      <ConnectionsManager whatsAppEnabled={canUseWhatsApp()} />
    </div>
  )
}
