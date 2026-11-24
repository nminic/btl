import { useEffect, useReducer, type ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { DEFAULT_LOCALE, isLocale, loadDictionary, loadedDictionary, type Locale } from '../i18n/config'
import { I18nProvider } from '../i18n/I18nProvider'
import { BoxesSentProvider } from '../pages/profile/BoxesSentProvider'
import { Shell } from './Shell'

/* Every address carries the language
 * (PDL P18, „Adrese nose **jezički prefiks za sve jezike, uključujući srpski**").
 * Anything that does not start
 * with a known language is treated as a path in the default language, so
 * /kalendar keeps working and lands on /sr/kalendar. */
export function LocaleLayout() {
  const { locale } = useParams()
  const location = useLocation()

  if (!isLocale(locale)) {
    // Query and hash come along: without them a filtered screen quietly loses
    // its filter on the way to the default language.
    return (
      <Navigate
        to={`/${DEFAULT_LOCALE}${location.pathname}${location.search}${location.hash}`}
        replace
      />
    )
  }

  return (
    <OnceItsBookIsHere locale={locale}>
      <I18nProvider locale={locale}>
        <BoxesSentProvider>
          <Shell />
        </BoxesSentProvider>
      </I18nProvider>
    </OnceItsBookIsHere>
  )
}

/**
 * NOTHING UNTIL THE BOOK OF THE LANGUAGE HAS ARRIVED, which is what the page was before the portal's code
 * arrived at all (`index.html` draws nothing in `#root`), so a visit never shows a bare key or a sentence
 * of the other language (inkrement „Poboljšanje performansi”, owner, 22.11.2026: „rečnik samo jezika koji
 * se čita”).
 *
 * <p>The first page of a visit is the usual way here, and the book is usually already on its way: the page
 * names it to the browser (`index.html`) and `main.tsx` asks for it before anything is drawn. A change of
 * language does not come here at all: the language control waits for the book before it moves
 * (`app/LanguageMenu.tsx`), so the screen before stays. What is left is a step back across a change of
 * language after the page was read again, and an address typed into a tab already open.
 *
 * <p>A book that does not arrive leaves the page as it is, empty: the portal has no words in which to say
 * so, and no sentence may be written in the code instead (ADL, 01.09.2026: „nijedan `.tsx` ne sme da
 * sadrži srpsku prozu, sav tekst ide kroz rečnik”). A piece the deploy replaced reads the page again once
 * (`app/staleChunks.ts`).
 */
function OnceItsBookIsHere({ locale, children }: { locale: Locale; children: ReactNode }) {
  const [, arrived] = useReducer((times: number) => times + 1, 0)
  const here = loadedDictionary(locale) !== undefined

  useEffect(() => {
    if (!here) {
      loadDictionary(locale).then(arrived, () => undefined)
    }
  }, [locale, here])

  return here ? children : null
}
