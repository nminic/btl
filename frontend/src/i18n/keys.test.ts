import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EXTRA_ADDRESSES, ROUTES } from '../app/routes'
import registracija from '../forms/definitions/registracija.form.json'
import { DUCAT_KINDS } from '../data/ducatRule'
import { QUEUES } from '../pages/admin/queues'
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

  it('names every kind a ducat rule can be written in', () => {
    /* Composed rather than written out: `ruleSentence` asks for
       `ducats.kind.${rule.kind}`, which said.test does not read, since a name
       built out of a value is a family and not a name. The family is closed, so
       it is walked here instead.

       These sixteen had a guard by accident until 10.08.2026: the ducat editor's
       definition listed them all in full, and deleting that screen took the only
       place they were written out with it. A kind left unnamed prints
       `ducats.kind.halfCount` in the middle of a sentence in the rulebook and on
       every member's page of awards. */
    expect(DUCAT_KINDS.filter((kind) => !resolves(`ducats.kind.${kind}`))).toEqual([])
  })

  it('names each of the eight queues, within the same 160 characters', () => {
    /* The eight queues share one address pattern, so their words are composed
       rather than written out (QueueMeta). A search engine cuts a description at
       the same place whether it was composed or not. */
    const composed = QUEUES.map((queue) => ({
      title: translate(dictionary, 'sr', 'seo.verificationQueue.queueTitle', {
        name: translate(dictionary, 'sr', queue.labelKey),
      }),
      description: translate(dictionary, 'sr', 'seo.verificationQueue.queueDescription', {
        name: translate(dictionary, 'sr', queue.labelKey),
        source: translate(dictionary, 'sr', queue.sourceKey),
      }),
    }))

    expect(new Set(composed.map((one) => one.title)).size).toBe(QUEUES.length)
    expect(composed.filter((one) => one.description.length > 160)).toEqual([])
    expect(composed.filter((one) => one.title.includes('{'))).toEqual([])
  })

  it('calls the boards what the rulebook and the navigation call them', () => {
    /* "Rang liste" is not a second name for the page: it is the Top liste, in
       the navigation, on the page itself and in Article 55 alike (PDL P28a; the
       owner shortened it from "Top 10 liste" on 04.08.2026). The description of
       the home page once counted the boards among the "rang liste", which puts
       a retired name in front of every visitor and in every search result. */
    expect(translate(dictionary, 'sr', 'seo.home.description')).toContain('Top liste')

    const sentences = SEO_KEYS.map((key) => translate(dictionary, 'sr', `seo.${key}.description`))
    expect(sentences.filter((text) => text.includes('rang liste'))).toEqual([])
  })

  it('says the same thing in index.html, which is served before React runs', () => {
    /* The three tags in index.html are the same sentence as the home page's, and
       they are what a reader sees in the tab and what a client running no
       JavaScript ends up with. They are written out twice by necessity, so they
       are held together here. */
    const page = readFileSync(join(process.cwd(), 'index.html'), 'utf-8')
    const sentence = translate(dictionary, 'sr', 'seo.home.description')

    expect(page.split(sentence)).toHaveLength(4)
  })

  it('names each of the five records after the record itself', () => {
    // The screen replaces both texts once it has loaded the record (PageMeta).
    // The message is the one that must not: its subject is personal data (P23).
    const missing = ['competitor', 'event', 'team', 'league', 'calendarDay']
      .flatMap((key) => [`seo.${key}.recordTitle`, `seo.${key}.recordDescription`])
      .filter((key) => !resolves(key))

    expect(missing).toEqual([])
    expect(resolves('seo.message.recordTitle')).toBe(false)
  })
})
