import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { dictionaryLocale } from '../i18n/config'
import { useI18n } from '../i18n/useI18n'
import { applyHead } from './head'
import type { DeclareMeta, PageMeta } from './pageMetaContext'
import { ROUTES, seoKeyFor } from './routes'

/** No address matched, so the screen is the not found page. */
const NOT_FOUND = 'notFound'

/**
 * The three things a single page application has to do by hand on every route
 * change, because the browser no longer does them: name the document, describe
 * it, and say out loud that the page changed.
 *
 * Without the title, twenty routes share one browser tab name, one history entry
 * name and one bookmark name. Without the description, a search engine writes
 * its own from whatever text it finds first. Without the announcement, a screen
 * reader user clicks a link and hears nothing at all.
 *
 * A screen that shows one record replaces both texts with the record itself
 * through <PageMeta>, which hands them here rather than writing them anywhere.
 * The declaration is what this returns as `declare`.
 */
export function useRouteChrome(): { pageTitle: string; declare: DeclareMeta } {
  const { locale, t } = useI18n()
  const location = useLocation()
  const [declared, setDeclared] = useState<PageMeta | null>(null)

  const path = location.pathname.split('/').slice(2).join('/')
  const route = ROUTES.find((candidate) => candidate.path === path)
  const seoKey = seoKeyFor(path) ?? NOT_FOUND

  const title = declared?.title ?? t(`seo.${seoKey}.title`)
  const description = declared?.description ?? t(`seo.${seoKey}.description`)

  /* What the live region announces is the wording the person just clicked, so it
   * comes from the navigation label wherever there is one. The tab and the
   * shared link are read without the navigation around them, so those get the
   * fuller wording from the seo entry instead, or the record itself. */
  let pageTitle = title

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
    applyHead({
      title,
      description,
      siteName: t('app.name'),
      path,
      textLocale: dictionaryLocale(locale),
    })
  }, [title, description, path, locale, t])

  return { pageTitle, declare: setDeclared }
}
