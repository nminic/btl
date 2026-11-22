import { useMemo, type ReactNode } from 'react'
import { dictionaryFor, type Locale } from './config'
import { I18nContext, type I18nValue } from './context'
import { translate, type TranslateParams } from './translate'

type Props = {
  locale: Locale
  children: ReactNode
}

/* Drawn only once the book of its language has arrived (`LocaleLayout` waits for it, and the suite
 * loads both before its first case), so the book is taken once per language and not per sentence. */
export function I18nProvider({ locale, children }: Props) {
  const value = useMemo<I18nValue>(() => {
    const dictionary = dictionaryFor(locale)

    return {
      locale,
      t: (key: string, params?: TranslateParams) => translate(dictionary, locale, key, params),
    }
  }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
