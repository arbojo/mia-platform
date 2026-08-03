'use client'

import { useState, useRef, useEffect } from 'react'
import { useI18n } from '@/components/dashboard/I18nProvider'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'
import { LOCALE_LABELS } from '@/lib/i18n/config'
import type { Locale } from '@/lib/i18n/config'
import { Languages, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const init = useRef(false)

  useEffect(() => {
    if (init.current) return
    init.current = true
    queueMicrotask(() => setMounted(true))
  }, [])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  if (!mounted) {
    return <div className="h-7 w-7" />
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200"
        style={{ color: 'var(--atmosphere-text-secondary)', backgroundColor: 'transparent' }}
        title={t.topbar.language}
        aria-label={t.topbar.language}
        aria-expanded={open}
      >
        <Languages className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-9 z-50 w-40 rounded-xl border p-1.5 shadow-lg"
          style={{
            backgroundColor: 'var(--elevation-2)',
            borderColor: 'var(--atmosphere-border)',
          }}
        >
          <p
            className="mb-1.5 px-2 pt-1 text-[10px] font-medium uppercase tracking-[0.12em]"
            style={{ color: 'var(--atmosphere-text)', opacity: 0.4 }}
          >
            {t.topbar.language}
          </p>
          {SUPPORTED_LOCALES.map((code: Locale) => (
            <button
              key={code}
              onClick={() => {
                setLocale(code)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium transition-all duration-200'
              )}
              style={{
                color:
                  locale === code
                    ? 'var(--atmosphere-accent)'
                    : 'var(--atmosphere-text-secondary)',
                backgroundColor: locale === code ? 'rgba(255,255,255,0.06)' : 'transparent',
              }}
            >
              <span>{LOCALE_LABELS[code]}</span>
              {locale === code && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
