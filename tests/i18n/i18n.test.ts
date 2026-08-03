import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getProfileLanguage, saveProfileLanguage } from '@/lib/system/language'

const USER_ID = 'a0000000-0000-4000-8000-000000000002'

function makeSupabaseMock(overrides: {
  language?: string | null
  readError?: boolean
  saveError?: boolean
}) {
  const from = vi.fn()
  const chain = {} as {
    select?: ReturnType<typeof vi.fn>
    upsert?: ReturnType<typeof vi.fn>
    eq?: ReturnType<typeof vi.fn>
    maybeSingle?: ReturnType<typeof vi.fn>
    single?: ReturnType<typeof vi.fn>
  }

  chain.maybeSingle = vi.fn(async () =>
    overrides.readError
      ? { data: null, error: { message: 'read failed' } }
      : { data: { language: overrides.language ?? null }, error: null },
  )
  chain.single = vi.fn(async () =>
    overrides.saveError
      ? { data: null, error: { message: 'save failed' } }
      : { data: { language: overrides.language ?? 'es' }, error: null },
  )
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.upsert = vi.fn(() => chain)

  from.mockReturnValue(chain)
  const supabase = { from } as unknown as ReturnType<typeof createAdminClient>
  vi.mocked(createAdminClient).mockReturnValue(supabase)

  return { from, chain }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('normalizeLocale', () => {
  it('falls back to default for null and undefined', () => {
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE)
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE)
  })

  it('accepts supported locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(normalizeLocale(locale)).toBe(locale)
    }
  })

  it('falls back to default for unsupported values', () => {
    expect(normalizeLocale('fr')).toBe(DEFAULT_LOCALE)
    expect(normalizeLocale('')).toBe(DEFAULT_LOCALE)
    expect(normalizeLocale('ES' as never)).toBe(DEFAULT_LOCALE)
  })
})

describe('getDictionary', () => {
  it('returns the es dictionary for es locale', () => {
    const dict = getDictionary('es')
    expect(dict.nav.commandCenter).toBe('Centro de Mando')
    expect(dict.common.appName).toBe('MIA')
  })

  it('returns the en dictionary for en locale', () => {
    const dict = getDictionary('en')
    expect(dict.nav.commandCenter).toBe('Command Center')
  })

  it('returns the pt dictionary for pt locale', () => {
    const dict = getDictionary('pt')
    expect(dict.nav.commandCenter).toBe('Central de Comando')
  })

  it('returns the ja dictionary for ja locale', () => {
    const dict = getDictionary('ja')
    expect(dict.nav.commandCenter).toBe('コマンドセンター')
  })

  it('shares the same key shape across all dictionaries', () => {
    const base = getDictionary('es')
    const others = [getDictionary('en'), getDictionary('pt'), getDictionary('ja')]
    const baseKeys = Object.keys(base).sort()
    for (const dict of others) {
      expect(Object.keys(dict).sort()).toEqual(baseKeys)
    }
  })
})

describe('getProfileLanguage', () => {
  it('returns the stored language', async () => {
    makeSupabaseMock({ language: 'en' })
    const result = await getProfileLanguage(USER_ID)
    expect(result).toBe('en')
  })

  it('returns default when no row exists', async () => {
    makeSupabaseMock({ language: null })
    const result = await getProfileLanguage(USER_ID)
    expect(result).toBe(DEFAULT_LOCALE)
  })

  it('normalizes invalid stored values', async () => {
    makeSupabaseMock({ language: 'fr' })
    const result = await getProfileLanguage(USER_ID)
    expect(result).toBe(DEFAULT_LOCALE)
  })
})

describe('saveProfileLanguage', () => {
  it('upserts the language and returns it', async () => {
    const { chain } = makeSupabaseMock({ language: 'pt' })

    const result = await saveProfileLanguage(USER_ID, 'pt')

    expect(result).toBe('pt')
    expect(chain.upsert).toHaveBeenCalledWith(
      { id: USER_ID, language: 'pt' },
      { onConflict: 'id' },
    )
  })

  it('throws when the save fails', async () => {
    makeSupabaseMock({ saveError: true })
    await expect(saveProfileLanguage(USER_ID, 'en')).rejects.toThrow()
  })
})
