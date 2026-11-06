/* Intl treats plain "sr" as Serbian in Cyrillic, so a date formatted with it
 * comes back as "10. април 2027". This portal is Latin script only, without
 * exception, which makes the script subtag mandatory in every Intl call.
 *
 * The route keeps the short code (/sr/kalendar); only the formatter sees this.
 */
const INTL_TAGS: Record<string, string> = {
  sr: 'sr-Latn',
  /* Plain "en" is American English ("October 1, 2026"), while the dictionary and
   * `og:locale` (head.ts) are British. Owner's decision, 26.09.2026: en-GB. */
  en: 'en-GB',
}

export function intlTag(locale: string): string {
  return INTL_TAGS[locale] ?? locale
}
