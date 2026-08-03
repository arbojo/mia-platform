import { es } from './es'
import { en } from './en'
import { pt } from './pt'
import { ja } from './ja'
import type { Locale } from '../config'
import { DEFAULT_LOCALE } from '../config'
import type { Dict } from './es'

export type { Dict }

const dictionaries: Record<Locale, Dict> = { es, en, pt, ja }

export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE]
}
