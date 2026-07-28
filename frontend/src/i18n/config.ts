import sr from './sr.json'
import type { Dictionary } from './translate'

export const LOCALES = ['sr', 'en'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'sr'

/* English exists as a route and as a language switch from day one, but the
 * English dictionary is written only once the Serbian content is locked
 * (ADL A2: translations come after the content, not next to it). Until then
 * /en shows the Serbian text rather than a screen full of raw keys. */
const DICTIONARIES: Record<Locale, Dictionary> = {
  sr: sr as Dictionary,
  en: sr as Dictionary,
}

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale)
}

export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}
