import { useMemo, type ReactNode } from 'react'
import { dictionaryFor, type Locale } from './config'
import { I18nContext, type I18nValue } from './context'
import { translate, type TranslateParams } from './translate'

type Props = {
  locale: Locale
  children: ReactNode
}

export function I18nProvider({ locale, children }: Props) {
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: (key: string, params?: TranslateParams) =>
        translate(dictionaryFor(locale), locale, key, params),
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
