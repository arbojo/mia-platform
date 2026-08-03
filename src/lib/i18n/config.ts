export const SUPPORTED_LOCALES = ['es', 'en', 'pt', 'ja'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'es'

export const LOCALE_LABELS: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
  ja: '日本語',
}

export function normalizeLocale(value: string | null | undefined): Locale {
  if (value && (SUPPORTED_LOCALES as readonly string[]).includes(value)) {
    return value as Locale
  }
  return DEFAULT_LOCALE
}
