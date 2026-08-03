import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  getAccessibilityPreferences,
  normalizeAccessibilityPreferences,
  saveAccessibilityPreferences,
  type AccessibilityPreferences,
} from '@/lib/system/accessibility'

const USER_ID = 'a0000000-0000-4000-8000-000000000001'

function makeSupabaseMock(overrides: {
  preferences?: unknown
  readError?: boolean
  updateError?: boolean
}) {
  const from = vi.fn()
  const chain = {} as {
    select?: ReturnType<typeof vi.fn>
    upsert?: ReturnType<typeof vi.fn>
    eq?: ReturnType<typeof vi.fn>
    maybeSingle?: ReturnType<typeof vi.fn>
  }

  chain.maybeSingle = vi.fn(async () =>
    overrides.readError
      ? { data: null, error: { message: 'read failed' } }
      : { data: { preferences: overrides.preferences ?? null }, error: null },
  )
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  if (overrides.updateError) {
    chain.upsert = vi.fn(async () => ({ data: null, error: { message: 'upsert failed' } }))
  } else {
    chain.upsert = vi.fn(() => chain)
  }

  from.mockReturnValue(chain)
  const supabase = { from } as unknown as ReturnType<typeof createAdminClient>
  vi.mocked(createAdminClient).mockReturnValue(supabase)

  return { from, chain }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('normalizeAccessibilityPreferences', () => {
  it('returns defaults when input is null', () => {
    expect(normalizeAccessibilityPreferences(null)).toEqual(DEFAULT_ACCESSIBILITY_PREFERENCES)
  })

  it('returns defaults when input is an empty object', () => {
    expect(normalizeAccessibilityPreferences({})).toEqual(DEFAULT_ACCESSIBILITY_PREFERENCES)
  })

  it('keeps valid values and coerces invalid ones to defaults', () => {
    const raw = {
      mirror_layout: true,
      optical_mode: false,
      font_weight: 'bold',
      color_temperature: 'warm',
    }
    expect(normalizeAccessibilityPreferences(raw)).toEqual({
      mirror_layout: true,
      optical_mode: false,
      font_weight: 'bold',
      color_temperature: 'warm',
    })
  })

  it('treats non-boolean flags as false', () => {
    const raw = { mirror_layout: 'yes', optical_mode: 1 }
    const result = normalizeAccessibilityPreferences(raw)
    expect(result.mirror_layout).toBe(false)
    expect(result.optical_mode).toBe(false)
  })

  it('falls back to defaults for unknown enum values', () => {
    const result = normalizeAccessibilityPreferences({
      font_weight: 'extra-bold',
      color_temperature: 'searing',
    })
    expect(result.font_weight).toBe('normal')
    expect(result.color_temperature).toBe('neutral')
  })
})

describe('getAccessibilityPreferences', () => {
  it('returns defaults when no row exists', async () => {
    makeSupabaseMock({})
    const result = await getAccessibilityPreferences(USER_ID)
    expect(result).toEqual(DEFAULT_ACCESSIBILITY_PREFERENCES)
  })

  it('returns normalized preferences from the profile', async () => {
    const stored: Partial<AccessibilityPreferences> = {
      mirror_layout: true,
      font_weight: 'medium',
      color_temperature: 'cool',
    }
    makeSupabaseMock({ preferences: stored })
    const result = await getAccessibilityPreferences(USER_ID)
    expect(result.mirror_layout).toBe(true)
    expect(result.optical_mode).toBe(false)
    expect(result.font_weight).toBe('medium')
    expect(result.color_temperature).toBe('cool')
  })

  it('returns defaults on read error', async () => {
    makeSupabaseMock({ readError: true })
    const result = await getAccessibilityPreferences(USER_ID)
    expect(result).toEqual(DEFAULT_ACCESSIBILITY_PREFERENCES)
  })
})

describe('saveAccessibilityPreferences', () => {
  it('normalizes and persists the given preferences', async () => {
    const { chain } = makeSupabaseMock({})

    const result = await saveAccessibilityPreferences(USER_ID, {
      mirror_layout: true,
      optical_mode: false,
      font_weight: 'bold',
      color_temperature: 'warm',
    })

    expect(result.mirror_layout).toBe(true)
    expect(result.optical_mode).toBe(false)
    expect(result.font_weight).toBe('bold')
    expect(result.color_temperature).toBe('warm')

    const upsertPayload = chain.upsert!.mock.calls[0][0] as { preferences: unknown }
    expect(upsertPayload).toMatchObject({ id: USER_ID, preferences: result })
    expect(chain.upsert).toHaveBeenCalledWith({ id: USER_ID, preferences: result }, {
      onConflict: 'id',
    })
  })

  it('coerces invalid values to defaults when persisting', async () => {
    makeSupabaseMock({})

    const result = await saveAccessibilityPreferences(USER_ID, {
      mirror_layout: 'yes' as never,
      optical_mode: true,
      font_weight: 'extra-bold' as never,
      color_temperature: 'neutral',
    })

    expect(result.mirror_layout).toBe(false)
    expect(result.optical_mode).toBe(true)
    expect(result.font_weight).toBe('normal')
    expect(result.color_temperature).toBe('neutral')
  })

  it('throws when the update fails', async () => {
    makeSupabaseMock({ updateError: true })
    await expect(
      saveAccessibilityPreferences(USER_ID, DEFAULT_ACCESSIBILITY_PREFERENCES),
    ).rejects.toThrow()
  })
})
