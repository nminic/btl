import { DEFAULT_LOCALE, dictionaryLocale, LOCALES, type Locale } from '../i18n/config'

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
 * attribute, and not the language in the address
 * (ADL A7, ODLUKA 30.07.2026, „Dok engleski rečnik ne postoji, engleska grana se"). */
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
  /**
   * The language the text is actually written in, which is not always the language
   * in the address: `dictionaryLocale` (`i18n/config.ts`) can point a locale at
   * another one's words while its own dictionary is not ready yet. `sr` and `en`
   * both have one today, so the two agree for both of them; a locale entered ahead
   * of its translation (PDL P18) is the case this field exists for.
   *
   * The language in the address is deliberately not here, for the same reason:
   * `applyHead` reads this field, not `path`'s own locale, for the canonical
   * address and for which alternates to offer, and following the address instead
   * would point both at words that are not really there yet.
   */
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

/**
 * The full address of a screen in one language, in the one spelling a search
 * engine should keep.
 *
 * **Lower case, and no slash on the end.** Both are what everybody else does and
 * what the owner asked for (16.08.2026: „uradi kako je industrijski standard i
 * tvoja preporuka"), and both are needed for the same reason: a path is
 * case-sensitive and a trailing slash is a different path, so
 * `/sr/TAKMICAR/000127-nikola-minic` and `/sr/takmicar/000127-nikola-minic/`
 * are three addresses for one page unless something says which of them is the
 * one. Left alone, each of them named itself as canonical, which is a page
 * telling a search engine „I am the original" three times over.
 *
 * Done here rather than on the screens, because it is true of all forty of them
 * and nothing about it belongs to any one. The profile and its trophies used to
 * do it for themselves, through a mechanism nothing else used, and a review
 * measured that the mechanism could not change anything else at all.
 *
 * Only the path, never the origin or the language: the origin is fixed and the
 * two languages are `sr` and `en`, which are lower case to begin with. And only
 * the canonical link, never where the reader is sent: a reader who typed capitals
 * stays where they are and reads the page they asked for.
 */
export function addressOf(locale: Locale, path: string): string {
  const one = canonicalPath(path)

  return `${SITE_ORIGIN}/${locale}${one === '' ? '' : `/${one}`}`
}

/**
 * The one form of a path this portal answers to: lower case, no slash on the end.
 *
 * The router matches without regard to case, so /sr/KALENDAR really is the
 * calendar screen and not a miss. Everything that reads the address therefore has
 * to agree about which form of it is the address, or the page ends up naming one
 * address as the original while looking its own name up under another. It did:
 * the canonical link said /sr/kalendar and the tab said „Ove strane nema".
 *
 * Nothing is stripped from the front, because `path` never carries a slash there
 * (useRouteChrome cuts the language off with `slice(2).join('/')`), and a guard
 * against something that cannot arrive is a line no test can defend.
 */
export function canonicalPath(path: string): string {
  return path.toLowerCase().replace(/\/+$/, '')
}

export function applyHead(head: PageHead): void {
  /* The name of the league goes on the end of every title, and exactly once.
     The front page and the main competition already begin with it, so adding it
     again would read "Balkanska trkačka liga 2027 · Balkanska trkačka liga".
     One check, and nothing anywhere else has to know about the exception. */
  const title = head.title.startsWith(head.siteName)
    ? head.title
    : `${head.title} · ${head.siteName}`
  const canonical = addressOf(head.textLocale, head.path)

  document.title = title
  metaTag('name', 'description', head.description)

  /* Which address counts as this page's own.
   *
   * Not the address being read, but the address of the language the text is
   * actually written in, named by `dictionaryLocale` (src/i18n/config.ts) rather
   * than by `head.path`'s own locale. Two addresses over one text is one page
   * competing with itself, and a search engine keeps whichever of the two it
   * likes - the state /en was in before 26.09.2026, when it served the Serbian
   * words under its own address while `dictionaryLocale('en')` still answered
   * `sr`.
   *
   * `sr` and `en` both answer their own name today, so the canonical address is
   * the address being read, for both of them. That follows from the table behind
   * `dictionaryLocale` and is not written here as a fact of its own: a third
   * locale entered ahead of its dictionary (PDL P18) falls into the state /en
   * used to be in, and this line does not change for that to keep holding.
   *
   * The query and the fragment are left out on purpose: a filtered table is the
   * same page as the unfiltered one, and a profile with ?sezona=2027 is the same
   * profile. */
  linkTag('canonical', canonical)

  /* One alternative per language that has words of its own - `dictionaryLocale(one)
   * === one` is exactly that condition, not an /en special case. Offering a locale
   * whose dictionary is not ready yet is an invitation to index the same text
   * twice, under two sets of addresses, and to serve a reader a page in a language
   * they did not ask for; that was /en's own state before 26.09.2026, and is the
   * state a locale entered ahead of its dictionary will be in the same way. */
  for (const locale of LOCALES.filter((one) => dictionaryLocale(one) === one)) {
    linkTag('alternate', addressOf(locale, head.path), locale)
  }

  // Which one to offer somebody whose language is none of the above.
  linkTag('alternate', addressOf(DEFAULT_LOCALE, head.path), 'x-default')

  /* What a shared link shows. The image is the same on every page and is set
   * once in index.html, so it is not touched here; inventing a path to a picture
   * that does not exist would only turn a working preview into a broken one. */
  metaTag('property', 'og:title', title)
  metaTag('property', 'og:description', head.description)
  metaTag('property', 'og:site_name', head.siteName)
  /* The canonical address, not the one being read: a link shared off /en has to
     gather its likes and its shares on the one address that counts as the page,
     the same way the canonical says it does. */
  metaTag('property', 'og:url', canonical)
  metaTag('property', 'og:locale', OG_LOCALES[head.textLocale])

  metaTag('name', 'twitter:title', title)
  metaTag('name', 'twitter:description', head.description)
}
