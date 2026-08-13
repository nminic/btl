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
  sr: sr,
  en: sr,
}

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.some((one) => one === value)
}

/* The language each address is actually written in, which is not always the
 * language in the address. `/en` shows Serbian words until an English
 * dictionary exists, and `lang="en"` over Serbian text makes a screen reader
 * read it with English phonetics, which is unintelligible.
 *
 * This table moves together with DICTIONARIES above; a test holds the two to
 * each other. */
const TEXT_LOCALES: Record<Locale, Locale> = {
  sr: 'sr',
  en: 'sr',
}

export function dictionaryLocale(locale: Locale): Locale {
  return TEXT_LOCALES[locale]
}

export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}
