import { createAdminClient } from '@/lib/supabase/admin'

export type FontWeightPreference = 'normal' | 'medium' | 'bold'
export type ColorTemperature = 'neutral' | 'warm' | 'cool'

export interface AccessibilityPreferences {
  /** Sidebar a la derecha (modo espejo) en vez de la izquierda. */
  mirror_layout: boolean
  /** Paleta antifatiga: sin negro puro ni blanco brillante. */
  optical_mode: boolean
  /** Peso de fuente global para reducir fatiga visual. */
  font_weight: FontWeightPreference
  /** Filtro CSS de temperatura de color (cálido / frío). */
  color_temperature: ColorTemperature
}

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  mirror_layout: false,
  optical_mode: false,
  font_weight: 'normal',
  color_temperature: 'neutral',
}

const FONT_WEIGHTS: FontWeightPreference[] = ['normal', 'medium', 'bold']
const COLOR_TEMPERATURES: ColorTemperature[] = ['neutral', 'warm', 'cool']

export function normalizeAccessibilityPreferences(
  raw: unknown
): AccessibilityPreferences {
  const value = (raw ?? {}) as Partial<Record<keyof AccessibilityPreferences, unknown>>

  const font_weight =
    value.font_weight && FONT_WEIGHTS.includes(value.font_weight as FontWeightPreference)
      ? (value.font_weight as FontWeightPreference)
      : DEFAULT_ACCESSIBILITY_PREFERENCES.font_weight

  const color_temperature =
    value.color_temperature &&
    COLOR_TEMPERATURES.includes(value.color_temperature as ColorTemperature)
      ? (value.color_temperature as ColorTemperature)
      : DEFAULT_ACCESSIBILITY_PREFERENCES.color_temperature

  return {
    mirror_layout: value.mirror_layout === true,
    optical_mode: value.optical_mode === true,
    font_weight,
    color_temperature,
  }
}

export async function getAccessibilityPreferences(
  userId: string
): Promise<AccessibilityPreferences> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return DEFAULT_ACCESSIBILITY_PREFERENCES
  return normalizeAccessibilityPreferences(
    (data as { preferences?: unknown } | null)?.preferences
  )
}

export async function saveAccessibilityPreferences(
  userId: string,
  next: AccessibilityPreferences
): Promise<AccessibilityPreferences> {
  const normalized = normalizeAccessibilityPreferences(next)

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, preferences: normalized }, { onConflict: 'id' })

  if (error) throw new Error(`No se pudieron guardar las preferencias: ${error.message}`)
  return normalized
}
