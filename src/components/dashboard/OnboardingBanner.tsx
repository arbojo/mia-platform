'use client'

import { usePathname } from 'next/navigation'

export function OnboardingBanner({ onboardingStatus }: { onboardingStatus?: string }) {
  const pathname = usePathname()

  if (onboardingStatus === 'ready' || pathname.includes('onboarding')) {
    return null
  }

  return (
    <div className="mb-6 p-4 bg-violet-50 border border-violet-200 rounded-lg">
      <p className="text-violet-800">
        <strong>¡Bienvenido a MIA!</strong> Parece que aún no has completado
        la configuración de tu asistente.{' '}
        <a href="/dashboard/onboarding" className="underline font-medium">
          Continuar configuración
        </a>
      </p>
    </div>
  )
}
