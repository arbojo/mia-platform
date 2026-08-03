import { createAdminClient } from '@/lib/supabase/admin'
import type { Locale } from '@/lib/i18n/config'
import { normalizeLocale } from '@/lib/i18n/config'

export async function getProfileLanguage(userId: string): Promise<Locale> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('profiles')
    .select('language')
    .eq('id', userId)
    .maybeSingle()
  return normalizeLocale(data?.language ?? null)
}

export async function saveProfileLanguage(
  userId: string,
  language: Locale
): Promise<Locale> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, language },
      { onConflict: 'id' }
    )
    .select('language')
    .single()
  if (error) throw new Error(`Failed to save language: ${error.message}`)
  return normalizeLocale(data?.language ?? null)
}
