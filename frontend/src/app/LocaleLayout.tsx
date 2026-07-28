import { Navigate, useLocation, useParams } from 'react-router'
import { DEFAULT_LOCALE, isLocale } from '../i18n/config'
import { I18nProvider } from '../i18n/I18nProvider'
import { Shell } from './Shell'

/* Every address carries the language (ADL A2). Anything that does not start
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
    <I18nProvider locale={locale}>
      <Shell />
    </I18nProvider>
  )
}
