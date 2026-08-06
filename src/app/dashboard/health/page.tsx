import { requirePageAuth } from '@/lib/auth'
import { HealthDashboard } from '@/components/health/HealthDashboard'

export const metadata = {
  title: 'Salud · MIA',
  description: 'Estado del sistema y checks automáticos.',
}

export default async function HealthPage() {
  await requirePageAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Salud de MIA</h1>
        <p className="text-muted-foreground">
          Checks automáticos que verifican la conectividad, autenticación, persistencia y
          catálogo. Ejecuta una revisión o consulta el último reporte.
        </p>
      </div>
      <HealthDashboard />
    </div>
  )
}
