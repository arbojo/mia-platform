import type { Locale } from '@/lib/i18n/config'
import { normalizeLocale } from '@/lib/i18n/config'
import { getProfileLanguage } from '@/lib/system/language'

export async function getUserLocale(userId: string): Promise<Locale> {
  return normalizeLocale(await getProfileLanguage(userId))
}
