import { createContext } from 'react'
import type { Locale } from './config'
import type { TranslateParams } from './translate'

export type Translate = (key: string, params?: TranslateParams) => string

export type I18nValue = {
  locale: Locale
  t: Translate
}

/* The context lives in its own module so the provider file exports a component
 * and nothing else, and the hook file exports a hook and nothing else. */
export const I18nContext = createContext<I18nValue | null>(null)
