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
        <strong>Welcome!</strong> It looks like I still don&apos;t know enough about your business.{' '}
        <a href="/dashboard/onboarding" className="underline font-medium">
          Teach me more
        </a>
      </p>
    </div>
  )
}
