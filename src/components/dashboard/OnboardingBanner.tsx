'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'

export function OnboardingBanner({ onboardingStatus }: { onboardingStatus?: string }) {
  const pathname = usePathname()
  const [dismissed, setDismissed] = useState(false)

  if (onboardingStatus === 'ready' || pathname.includes('onboarding') || dismissed) {
    return null
  }

  return (
    <div className="relative mb-6 p-4 bg-violet-50 border border-violet-200 rounded-lg">
      <button
        onClick={() => setDismissed(true)}
        aria-label="Cerrar aviso"
        className="absolute right-3 top-3 rounded-lg p-1 transition-colors duration-200 hover:bg-violet-100"
        style={{ color: '#7c3aed' }}
      >
        <X className="h-4 w-4" />
      </button>
      <p className="text-violet-800 pr-8">
        <strong>¡Bienvenida!</strong> Parece que todavía no conozco suficiente sobre tu negocio.{' '}
        <a href="/dashboard/onboarding" className="underline font-medium">
          Enséñame más
        </a>
      </p>
    </div>
  )
}
