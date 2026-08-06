import { requirePageAuth } from '@/lib/auth'
import { AccessibilitySettings } from '@/components/accessibility/AccessibilitySettings'
import { getUserLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/dictionaries'

export const metadata = {
  title: 'Accesibilidad · MIA',
  description: 'Preferencias de accesibilidad, ergonomía y confort visual.',
}

export default async function AccessibilityPage() {
  const { user } = await requirePageAuth()
  const locale = await getUserLocale(user.id)
  const t = getDictionary(locale)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.accessibility.title}</h1>
        <p className="text-muted-foreground">{t.accessibility.subtitle}</p>
      </div>
      <AccessibilitySettings />
    </div>
  )
}
