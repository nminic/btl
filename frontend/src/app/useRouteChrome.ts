import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { dictionaryLocale } from '../i18n/config'
import { useI18n } from '../i18n/useI18n'
import { ROUTES } from './routes'

/**
 * The two things a single page application has to do by hand on every route
 * change, because the browser no longer does them: name the document, and say
 * out loud that the page changed.
 *
 * Without the title, twenty routes share one browser tab name, one history
 * entry name and one bookmark name. Without the announcement, a screen reader
 * user clicks a link and hears nothing at all.
 */
export function useRouteChrome(): string {
  const { locale, t } = useI18n()
  const location = useLocation()

  const path = location.pathname.split('/').slice(2).join('/')
  const route = ROUTES.find((candidate) => candidate.path === path)

  let pageTitle = t('notFound.title')

  if (path === '') {
    pageTitle = t('nav.home')
  } else if (route !== undefined) {
    pageTitle = t(route.labelKey)
  }

  useEffect(() => {
    // The dictionary language, not the address language: /en still shows
    // Serbian words until an English dictionary exists.
    document.documentElement.lang = dictionaryLocale(locale)
  }, [locale])

  useEffect(() => {
    document.title = `${pageTitle} · ${t('app.name')}`
  }, [pageTitle, t])

  return pageTitle
}
