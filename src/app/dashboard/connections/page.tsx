import { ConnectionsManager } from '@/components/connections/ConnectionsManager'

export default function ConnectionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">MIA Connections</h1>
        <p className="text-muted-foreground">
          Administra los canales por donde MIA se comunica con tus clientes.
        </p>
      </div>
      <ConnectionsManager />
    </div>
  )
}
