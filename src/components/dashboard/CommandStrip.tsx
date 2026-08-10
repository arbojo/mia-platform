'use client'

import { useState } from 'react'
import { Bell, Moon, Sun } from 'lucide-react'
import { MODULES, useModule, type ModuleKey } from '@/components/layout/AppLayout'
import { useTheme } from '@/components/dashboard/ThemeProvider'
import { useI18n } from '@/components/dashboard/I18nProvider'
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/config'
import { SignalIndicator } from '@/components/signals/SignalIndicator'
import { MIAInbox } from '@/components/signals/MIAInbox'
import { useContextMenu, type ContextMenuItems } from '@/components/ui/context-menu'

export function CommandStrip() {
  const [inboxOpen, setInboxOpen] = useState(false)
  const { activeModule, setModule } = useModule()
  const { theme, toggle } = useTheme()
  const { locale, setLocale, t } = useI18n()
  const { openMenu } = useContextMenu()

  const moduleKeys = Object.keys(MODULES) as ModuleKey[]

  const chipItems: ContextMenuItems = [
    {
      label: theme === 'dark' ? t.topbar.toggleLight : t.topbar.toggleDark,
      icon: theme === 'dark' ? Sun : Moon,
      onSelect: toggle,
    },
    'separator',
    { label: t.topbar.language, heading: true },
    ...SUPPORTED_LOCALES.map((code: Locale) => ({
      label: LOCALE_LABELS[code],
      checked: locale === code,
      onSelect: () => setLocale(code),
    })),
    'separator',
    { label: MODULES[activeModule].label, heading: true },
    ...moduleKeys.map((key) => ({
      label: MODULES[key].label,
      icon: MODULES[key].icon,
      checked: key === activeModule,
      onSelect: () => setModule(key),
    })),
    'separator',
    { label: 'MIA Signals', icon: Bell, onSelect: () => setInboxOpen(true) },
  ]

  const ModuleIcon = MODULES[activeModule].icon

  return (
    <div className="relative flex items-center justify-end gap-2 px-6 py-2.5">
      <button
        type="button"
        onClick={(e) => openMenu(e, chipItems)}
        onContextMenu={(e) => openMenu(e, chipItems)}
        className="flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200"
        style={{
          borderColor: 'var(--atmosphere-border)',
          color: 'var(--module-accent-strong)',
          backgroundColor: 'color-mix(in srgb, var(--module-accent-soft) 40%, transparent)',
        }}
        title={MODULES[activeModule].description}
      >
        <ModuleIcon className="h-3.5 w-3.5" style={{ color: 'var(--module-accent)' }} />
        <span>{MODULES[activeModule].label}</span>
      </button>
      <div className="relative">
        <SignalIndicator state="observacion" onClick={() => setInboxOpen(!inboxOpen)} />
        <MIAInbox open={inboxOpen} onClose={() => setInboxOpen(false)} />
      </div>
    </div>
  )
}
