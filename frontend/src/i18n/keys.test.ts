import { EXTRA_ADDRESSES, ROUTES } from '../app/routes'
import registracija from '../forms/definitions/registracija.form.json'
import type { FormDef } from '../forms/types'
import sr from './sr.json'
import { translate, type Dictionary } from './translate'

const dictionary = sr as Dictionary

/* translate() returns the key itself when a key is missing, which keeps the
 * screen usable but is invisible to every other test: a route pointing at
 * nav.nepostoji renders "nav.nepostoji" and nothing fails. This is the test
 * that notices. */
function resolves(key: string): boolean {
  return translate(dictionary, 'sr', key) !== key
}

describe('translation keys used in code', () => {
  it('exist for every route label', () => {
    const missing = ROUTES.map((route) => route.labelKey).filter((key) => !resolves(key))

    expect(missing).toEqual([])
  })

  it('exist for every part of the registration form', () => {
    const form = registracija as FormDef
    const keys = [form.titleKey, form.submitKey]

    for (const field of form.fields) {
      keys.push(field.labelKey)

      if (field.hintKey !== undefined) {
        keys.push(field.hintKey)
      }

      for (const option of field.options ?? []) {
        keys.push(option.labelKey)
      }
    }

    expect(keys.filter((key) => !resolves(key))).toEqual([])
  })

  it('notices a key that is not there', () => {
    expect(resolves('nav.nepostoji')).toBe(false)
  })
})

/* The words every address needs for a browser tab, a search result and a shared
 * link. The not found page is in here too, because an address that does not
 * exist is still a page somebody is looking at. */
const SEO_KEYS = [...ROUTES, ...EXTRA_ADDRESSES].map((address) => address.seoKey).concat('notFound')

describe('the seo entry of every address', () => {
  it('has a name and a sentence', () => {
    const missing = SEO_KEYS.flatMap((key) => [`seo.${key}.title`, `seo.${key}.description`]).filter(
      (key) => !resolves(key),
    )

    expect(missing).toEqual([])
  })

  it('keeps every description to the 160 characters a search engine shows', () => {
    const tooLong = SEO_KEYS.map((key) => translate(dictionary, 'sr', `seo.${key}.description`))
      .filter((text) => text.length > 160)

    expect(tooLong).toEqual([])
  })

  it('describes the page rather than repeating its name', () => {
    const repeated = SEO_KEYS.filter(
      (key) =>
        translate(dictionary, 'sr', `seo.${key}.description`) ===
        translate(dictionary, 'sr', `seo.${key}.title`),
    )

    expect(repeated).toEqual([])
  })

  it('names each of the five records after the record itself', () => {
    // The screen replaces both texts once it has loaded the record (PageMeta).
    // The message is the one that must not: its subject is personal data (P23).
    const missing = ['competitor', 'event', 'team', 'league']
      .flatMap((key) => [`seo.${key}.recordTitle`, `seo.${key}.recordDescription`])
      .filter((key) => !resolves(key))

    expect(missing).toEqual([])
    expect(resolves('seo.message.recordTitle')).toBe(false)
  })
})
