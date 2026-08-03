'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Locale } from '@/lib/i18n/config'
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { Dict } from '@/lib/i18n/dictionaries'

interface I18nContextValue {
  locale: Locale
  t: Dict
  setLocale: (locale: Locale) => Promise<void>
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  t: getDictionary(DEFAULT_LOCALE),
  setLocale: async () => {},
})

export function I18nProvider({
  locale: initialLocale,
  children,
}: {
  locale: Locale
  children: ReactNode
}) {
  const [locale, setLocaleState] = useState<Locale>(normalizeLocale(initialLocale))

  const setLocale = useCallback(async (next: Locale) => {
    const normalized = normalizeLocale(next)
    setLocaleState(normalized)
    try {
      await fetch('/api/profile/language', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: normalized }),
      })
    } catch {
      // La UI ya actualizó el idioma; si la persistencia falla, se reintenta
      // en el siguiente cambio o se refleja en el próximo render del servidor.
    }
  }, [])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: getDictionary(locale),
      setLocale,
    }),
    [locale, setLocale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
