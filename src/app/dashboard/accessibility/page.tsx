import { requireAuth } from '@/lib/auth'
import { AccessibilitySettings } from '@/components/accessibility/AccessibilitySettings'

export const metadata = {
  title: 'Accesibilidad · MIA',
  description: 'Preferencias de accesibilidad, ergonomía y confort visual.',
}

export default async function AccessibilityPage() {
  await requireAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Accesibilidad y Ergonomía</h1>
        <p className="text-muted-foreground">
          Ajusta cómo se ve y se siente MIA para reducir la fatiga visual. Tus preferencias se
          guardan en tu perfil y se aplican en todos los dispositivos.
        </p>
      </div>
      <AccessibilitySettings />
    </div>
  )
}
