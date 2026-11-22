import type { Dictionary } from './translate'

export const LOCALES = ['sr', 'en'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'sr'

/* One dictionary per language, both of them written.
 *
 * ~~English exists as a route and as a language switch from day one, but the English
 * dictionary is written only once the Serbian content is locked (ADL A2: translations
 * come after the content, not next to it). Until then /en shows the Serbian text
 * rather than a screen full of raw keys.~~
 *
 * **Overturned 26.09.2026 by the owner**, who was told beforehand that the Serbian is
 * not locked and that several branches are adding keys to it, and chose to have the
 * dictionary written now regardless. English is a condition of launch (owner,
 * 11.08.2026) and nobody is paid to translate it (owner, 26.09.2026), so waiting for
 * a lock that has no date was buying nothing.
 *
 * **What is done instead of waiting.** The dictionary arrives before the lock, and the
 * guard carries the consequence: `bothDictionaries.test.ts` holds the two files to
 * exactly the same set of names, in both directions, so a Serbian key added tomorrow
 * fails the package until it has an English twin. That is the whole of what the lock
 * was protecting, and it is now measured on every run rather than remembered.
 *
 * **And what that guard had to be, because the obvious form measures nothing.** „The
 * same set of keys in both directions" is satisfied by a byte copy of `sr.json`:
 * measured 26.09.2026, with a copy in place and this table pointing at it, every case
 * about names and about placeholders passed, 6 of 6, exit code nought. A copy has
 * identical names by construction. So the question is asked of the **alphabet** as
 * well — the five letters Serbian Latin has and English does not — and 575 of the
 * Serbian sentences carry one. The league's own name is the one exception, and it is
 * named there rather than here (owner, 26.09.2026: the name stays Serbian and English
 * prose calls the league BTL).
 *
 * The written legal pages are **not** in either dictionary: the rulebook, the terms of
 * use and the privacy policy are served by the backend. The Serbian original is the one
 * that binds (PDL P18), and since 27.09.2026 it is only the English pages that say so -
 * the Serbian text itself is left untouched (owner, 27.09.2026). What is translated is
 * the four declarations a registrant affirms, and they carry a sentence saying which
 * version binds.
 *
 * **ONLY THE ONE BEING READ IS LOADED, since 22.11.2026** (inkrement „Poboljšanje performansi”, owner,
 * 22.11.2026, chose among the outcomes offered: „rečnik samo jezika koji se čita ide kao ZASEBAN
 * POSAO”). Both books used to travel in the portal's own piece, about 24 KB over the wire for the one
 * nobody reads. Each is a piece of its own now, asked for here by its language, and the language is the
 * one the address carries (PDL P18, 03.10.2026: „jezik nosi adresa”), so nothing about it is kept in the
 * browser. The page itself names the right piece to the browser before any code runs (`index.html`, the
 * SSI branch by language, written in by `vite.config.ts`), so the book arrives beside the portal and
 * not after it.
 *
 * A third language is one more row here and nothing else (PDL P18, „kao unos a ne kao razvoj”).
 *
 * An object and not a frozen table on purpose: a case that measures the moment BEFORE a book arrives
 * holds its row back with `vi.spyOn`, which is the only way to see that moment at all, because the
 * suite loads both books before its first case (`test/setup.ts`). */
export const DICTIONARY_LOADERS: Record<Locale, () => Promise<{ default: Dictionary } | undefined>> = {
  sr: () => import('./sr.json'),
  en: () => import('./en.json'),
}

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.some((one) => one === value)
}

/* The language each address is actually written in, which is now the language in the
 * address for both of them.
 *
 * ~~`/en` shows Serbian words until an English dictionary exists, and `lang="en"` over
 * Serbian text makes a screen reader read it with English phonetics, which is
 * unintelligible.~~ True until 26.09.2026, and the reason the table exists.
 *
 * **Kept as a table rather than folded away**, and that is about the next language
 * rather than about these two. A third arrives as an entry and not as a rewrite
 * (PDL P18), and its route, its switch and its `hreflang` can be there before its
 * dictionary is, which is the state `/en` was in until this change. While a locale is
 * in it, `lang` over its pages has to name the language the words are really in, in
 * either direction.
 *
 * This table moves together with DICTIONARY_LOADERS above; a test holds the two to each
 * other, and `bothDictionaries.test.ts` holds which way they point. The first cannot
 * tell one state from the other: it passes whichever way both of them lean, which is
 * right while either way could be true and not enough once only one is.
 *
 * **What this table does not buy, written down rather than guarded.** With only `sr`
 * and `en` in `LOCALES`, and both mapped to themselves, no case in the package can
 * tell a reader that calls `dictionaryLocale(locale)` apart from one that reads
 * `locale` directly - both answer the same today. The four production readers
 * (`format.ts`'s `formatDayInSentence`, `useRouteChrome.ts` twice, `head.ts`'s
 * `applyHead`) have to keep going through this function rather than the address's own
 * locale regardless, because the day a third locale is entered ahead of its
 * dictionary (PDL P18) is the day the two stop agreeing, and inlining `locale` at any
 * of them would pass every case that exists today and be wrong from the day that
 * entry is made. Not written as a test here, on purpose: a locale added only to make
 * this case possible would be a fifth reader invented for the guard rather than for
 * the portal, which is not a state to write a test against. */
const TEXT_LOCALES: Record<Locale, Locale> = {
  sr: 'sr',
  en: 'en',
}

export function dictionaryLocale(locale: Locale): Locale {
  return TEXT_LOCALES[locale]
}

/** The books that have arrived, by language, for the rest of the visit. */
const shelf = new Map<Locale, Dictionary>()

/** The books asked for and not yet here, so a second reader waits for the same request. */
const asked = new Map<Locale, Promise<Dictionary>>()

/** The book of a language if it has arrived, and nothing if it has not. */
export function loadedDictionary(locale: Locale): Dictionary | undefined {
  return shelf.get(locale)
}

/**
 * The book of a language, for a reader that is drawn only once it has arrived (`I18nProvider`, under
 * `LocaleLayout`, which waits for it). Asked before that, it says so instead of handing out an empty book,
 * which would put the bare keys on the screen.
 */
export function dictionaryFor(locale: Locale): Dictionary {
  const found = shelf.get(locale)

  if (found === undefined) {
    throw new Error(`the dictionary for ${locale} has not arrived yet`)
  }

  return found
}

/**
 * The book of a language, from the shelf or from the server.
 *
 * <p><b>A failure is not kept</b>: the next ask goes to the server again, so a weak connection that drops
 * one request does not leave the language unreachable for the rest of the visit.
 *
 * <p><b>Nothing from a piece that is gone.</b> Vite's wrapper answers `undefined` when `app/staleChunks.ts`
 * has stopped the failure in order to read the page again (the same answer `app/screens.tsx`'s `of` waits
 * on): the page is on its way to being replaced, so this waits for it and keeps nothing.
 */
export function loadDictionary(locale: Locale): Promise<Dictionary> {
  const found = shelf.get(locale)

  if (found !== undefined) {
    return Promise.resolve(found)
  }

  const waiting = asked.get(locale)

  if (waiting !== undefined) {
    return waiting
  }

  const request = DICTIONARY_LOADERS[locale]()
    .then((loaded) => {
      if (loaded === undefined) {
        return new Promise<Dictionary>(() => undefined)
      }

      shelf.set(locale, loaded.default)

      return loaded.default
    })
    .finally(() => asked.delete(locale))

  asked.set(locale, request)

  return request
}

/** The language a page is read in, from its address alone, the way `LocaleLayout` reads it. */
export function localeOfTheAddress(pathname: string): Locale {
  const first = pathname.split('/')[1]

  return isLocale(first) ? first : DEFAULT_LOCALE
}

/** Asks for the book of the page being opened, before anything is drawn (`main.tsx`). */
export function startTheFirstDictionary(page: { location: { pathname: string } }): Promise<Dictionary> {
  return loadDictionary(localeOfTheAddress(page.location.pathname))
}

/** For the cases that measure the moment before a book arrives: the shelf as a visit begins. */
export function forgetTheDictionaries(): void {
  shelf.clear()
  asked.clear()
}
