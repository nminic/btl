import { getLocales } from 'expo-localization';
import type { Locale } from './translate';

type PhoneLocale = { languageCode: string | null; languageTag: string };

/**
 * „Aplikacija prati jezik telefona: srpski na srpskom, engleski na svakom drugom"
 * (PDL, „Aplikacija prati jezik telefona"). A phone set to Serbian in Cyrillic is
 * still a Serbian phone, and it gets Serbian in Latin script, the only script the
 * app is written in. Only the phone's first language decides.
 */
export function localeFor(phone: readonly PhoneLocale[]): Locale {
  const first = phone[0];
  if (first === undefined) return 'en';
  const language = first.languageCode ?? first.languageTag.split(/[-_]/)[0];
  return language.toLowerCase() === 'sr' ? 'sr' : 'en';
}

export function phoneLocale(): Locale {
  return localeFor(getLocales());
}
