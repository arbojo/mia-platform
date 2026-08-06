import { requirePageAuth } from '@/lib/auth'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { OnboardingBanner } from '@/components/dashboard/OnboardingBanner'
import { AtmosphereProvider } from '@/components/dashboard/AtmosphereProvider'
import { MIAIndicator } from '@/components/dashboard/MIAIndicator'
import { ThemeProvider } from '@/components/dashboard/ThemeProvider'
import { AccessibilityProvider } from '@/components/dashboard/AccessibilityProvider'
import { I18nProvider } from '@/components/dashboard/I18nProvider'
import { TopBar } from '@/components/dashboard/TopBar'
import { getUserLocale } from '@/lib/i18n/server'

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

  return (
    <I18nProvider key={locale} locale={locale}>
      <ThemeProvider>
        <AtmosphereProvider>
          <AccessibilityProvider>
          <div
            data-layout-root
            className="flex min-h-screen"
            style={{
              backgroundColor: 'var(--atmosphere-bg)',
              backgroundImage: 'var(--atmosphere-gradient)',
              color: 'var(--atmosphere-text)',
              transition: 'background-color 0.6s ease, background-image 0.6s ease',
            }}
          >
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-auto">
              <TopBar />
              <main className="relative flex-1">
                <div className="p-8">
                  <OnboardingBanner onboardingStatus={business?.onboarding_status} />
                  {children}
                </div>
              </main>
            </div>
            <MIAIndicator status="active" />
          </div>
        </AccessibilityProvider>
      </AtmosphereProvider>
    </ThemeProvider>
    </I18nProvider>
  )
}
