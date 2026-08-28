import { requirePageAuth } from '@/lib/auth'
import { ActivityRail } from '@/components/dashboard/ActivityRail'
import { CommandStrip } from '@/components/dashboard/CommandStrip'
import { OnboardingBanner } from '@/components/dashboard/OnboardingBanner'
import { AtmosphereProvider } from '@/components/dashboard/AtmosphereProvider'
import { MIAIndicator } from '@/components/dashboard/MIAIndicator'
import { ThemeProvider } from '@/components/dashboard/ThemeProvider'
import { AccessibilityProvider } from '@/components/dashboard/AccessibilityProvider'
import { I18nProvider } from '@/components/dashboard/I18nProvider'
import { AppLayout } from '@/components/layout/AppLayout'
import { ContextMenuProvider } from '@/components/ui/context-menu'
import { GlassLoader } from '@/components/ui/glass-loader'
import { TourProvider } from '@/components/tour/TourProvider'
import { getUserLocale } from '@/lib/i18n/server'
import { resolveCapabilities } from '@/lib/system/capabilities'
import { getEffectiveEdition } from '@/lib/system/edition'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { supabase, user } = await requirePageAuth()
  const locale = await getUserLocale(user.id)

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()

  const isPlatformOwner =
    !!process.env.PLATFORM_OWNER_ID && user.id === process.env.PLATFORM_OWNER_ID

  let capabilities = undefined
  if (business) {
    try {
      const edition = await getEffectiveEdition(business.id)
      capabilities = resolveCapabilities(
        business.id,
        edition,
        (business as Record<string, unknown>).industry as string | null ?? null,
        (business as Record<string, unknown>).capabilities as string[] | null ?? null,
      )
    } catch {
      // Capability resolution failure must never block dashboard loading
    }
  }

  return (
    <I18nProvider key={locale} locale={locale}>
      <ThemeProvider>
        <AtmosphereProvider>
      <AccessibilityProvider>
        <ContextMenuProvider>
          <TourProvider>
            <AppLayout>
              <ActivityRail isPlatformOwner={isPlatformOwner} capabilities={capabilities} />
              <div className="flex flex-1 flex-col overflow-auto">
                <CommandStrip />
                <main className="relative flex-1">
                  <div className="p-8">
                    <OnboardingBanner onboardingStatus={business?.onboarding_status} />
                    {children}
                  </div>
                </main>
              </div>
              <MIAIndicator />
              <GlassLoader />
            </AppLayout>
          </TourProvider>
        </ContextMenuProvider>
      </AccessibilityProvider>
      </AtmosphereProvider>
    </ThemeProvider>
    </I18nProvider>
  )
}
