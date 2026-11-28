import en from './en.json';
import sr from './sr.json';

/*
 * The same shape as the portal's engine (`frontend/src/i18n/translate.ts`), cut
 * to what this screen needs: dotted keys and {placeholder} interpolation. No text
 * a user sees is written in code (ADL A2, i18n from the first day).
 */

export type Dictionary = { [key: string]: string | Dictionary };
export type Locale = 'sr' | 'en';

export const DICTIONARIES: Record<Locale, Dictionary> = { sr, en };

/** Which of the two the app speaks is the phone's language (`./locale.ts`). The tag `Intl` formats numbers with: a decimal comma in Serbian. */
export const INTL_TAG: Record<Locale, string> = { sr: 'sr-Latn-RS', en: 'en' };

export type Translate = (key: string, params?: Record<string, string>) => string;

/** A key it does not know is answered with the key itself, as on the portal. */
export function translator(locale: Locale): Translate {
  return (key, params = {}) => {
    let node: string | Dictionary | undefined = DICTIONARIES[locale];
    for (const part of key.split('.')) node = typeof node === 'object' ? node[part] : undefined;
    if (typeof node !== 'string') return key;
    return node.replace(/\{(\w+)\}/g, (whole, name: string) => params[name] ?? whole);
  };
}

export function formatKilometres(locale: Locale, metres: number): string {
  return new Intl.NumberFormat(INTL_TAG[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Math.round(metres / 10) / 100,
  );
}

export function formatMetres(locale: Locale, metres: number): string {
  return new Intl.NumberFormat(INTL_TAG[locale], { maximumFractionDigits: 0 }).format(Math.round(metres));
}
