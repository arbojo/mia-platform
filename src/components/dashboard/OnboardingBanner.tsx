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
        <strong>¡Bienvenida!</strong> Parece que todavía no conozco suficiente sobre tu negocio.{' '}
        <a href="/dashboard/onboarding" className="underline font-medium">
          Enséñame más
        </a>
      </p>
    </div>
  )
}
