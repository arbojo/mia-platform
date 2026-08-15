import type { Dict } from '@/lib/i18n/dictionaries'

export interface TourStep {
  target: string
  titleKey: string
  descKey: string
}

export interface TourDef {
  key: string
  steps: TourStep[]
}

export const TOUR_STORAGE_PREFIX = 'mia-tour-seen:'

export function tourSeenKey(pathname: string): string {
  return `${TOUR_STORAGE_PREFIX}${pathname}`
}

export function getTourText(t: Dict, key: string): string {
  const parts = key.split('.')
  let value: unknown = t.tour
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part]
    } else {
      return key
    }
  }
  return typeof value === 'string' ? value : key
}
