import { useEffect } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { DEFAULT_LOCALE, isLocale, type Locale } from '../i18n/config'
import { I18nProvider } from '../i18n/I18nProvider'
import { Shell } from './Shell'

function DocumentLanguage({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return null
}

/* Every address carries the language (ADL A2). Anything that does not start
 * with a known language is treated as a path in the default language, so
 * /kalendar keeps working and lands on /sr/kalendar. */
export function LocaleLayout() {
  const { locale } = useParams()
  const location = useLocation()

  if (!isLocale(locale)) {
    return <Navigate to={`/${DEFAULT_LOCALE}${location.pathname}`} replace />
  }

  return (
    <I18nProvider locale={locale}>
      <DocumentLanguage locale={locale} />
      <Shell />
    </I18nProvider>
  )
}
