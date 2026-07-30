import { DEFAULT_LOCALE, LOCALES, type Locale } from '../i18n/config'

/* The only place in the portal that touches document.head. One record in, every
 * tag a page needs out: the browser tab, the description a search engine shows,
 * the address that counts as this page's own, and what a shared link looks like
 * on Viber, WhatsApp or Facebook.
 *
 * Kept in one function on purpose. Twenty screens each reaching for a meta tag
 * of their own is how a portal ends up with two titles and no description.
 *
 * There is deliberately no robots tag here. Nothing on the portal is hidden
 * from search engines in code: the QA site is kept out of the index by the
 * X-Robots-Tag header and robots.txt on the server (ADL A4a), which is the one
 * place that knows it is the QA site.
 */

/**
 * Where the portal answers. Written out rather than read from
 * window.location, because a canonical address has to name the real site even
 * while the page is being served from a development server or from QA.
 */
export const SITE_ORIGIN = 'https://balkanskatrkackaliga.net'

/* Open Graph wants a language and a region, joined by an underscore. It follows
 * the language the text is actually written in, exactly like the lang
 * attribute, and not the language in the address (ADL A2). */
const OG_LOCALES: Record<Locale, string> = {
  sr: 'sr_RS',
  en: 'en_GB',
}

export type PageHead = {
  /** Names the page. The league name is added after it, so it is not repeated. */
  title: string
  /** One sentence on what the page is for, at most 160 characters. */
  description: string
  siteName: string
  /** The path below the language, with no query and no fragment. */
  path: string
  /** The language in the address. */
  locale: Locale
  /** The language the text is written in, which is not always that one. */
  textLocale: Locale
}

function metaTag(attribute: 'name' | 'property', key: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)

  if (tag === null) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.append(tag)
  }

  tag.setAttribute('content', content)
}

function linkTag(rel: string, href: string, hreflang?: string): void {
  const selector =
    hreflang === undefined ? `link[rel="${rel}"]` : `link[rel="${rel}"][hreflang="${hreflang}"]`
  let tag = document.head.querySelector<HTMLLinkElement>(selector)

  if (tag === null) {
    tag = document.createElement('link')
    tag.setAttribute('rel', rel)

    if (hreflang !== undefined) {
      tag.setAttribute('hreflang', hreflang)
    }

    document.head.append(tag)
  }

  tag.setAttribute('href', href)
}

/** The full address of a screen in one language. */
export function addressOf(locale: Locale, path: string): string {
  return `${SITE_ORIGIN}/${locale}${path === '' ? '' : `/${path}`}`
}

export function applyHead(head: PageHead): void {
  const title = `${head.title} · ${head.siteName}`
  const url = addressOf(head.locale, head.path)

  document.title = title
  metaTag('name', 'description', head.description)

  /* Every screen has one address per language (ADL A2), so one page always has
   * two addresses. Without these, a search engine has to guess which of the two
   * to keep and counts the other as a copy of it.
   *
   * The query and the fragment are left out on purpose: a filtered table is the
   * same page as the unfiltered one, and a profile with ?sezona=2027 is the same
   * profile. */
  linkTag('canonical', url)

  for (const locale of LOCALES) {
    linkTag('alternate', addressOf(locale, head.path), locale)
  }

  // Which one to offer somebody whose language is neither of the two.
  linkTag('alternate', addressOf(DEFAULT_LOCALE, head.path), 'x-default')

  /* What a shared link shows. The image is the same on every page and is set
   * once in index.html, so it is not touched here; inventing a path to a picture
   * that does not exist would only turn a working preview into a broken one. */
  metaTag('property', 'og:title', title)
  metaTag('property', 'og:description', head.description)
  metaTag('property', 'og:site_name', head.siteName)
  metaTag('property', 'og:url', url)
  metaTag('property', 'og:locale', OG_LOCALES[head.textLocale])

  metaTag('name', 'twitter:title', title)
  metaTag('name', 'twitter:description', head.description)
}
