import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EXTRA_ADDRESSES, ROUTES } from '../app/routes'
import { registracija } from '../forms/definitions'
import { CATEGORIES } from '../data/derive'
import { EVENT_KINDS, ITEM_KINDS, PENDING_QUEUE_IDS, RATING_MARKS } from '../data/types'
import { NOTIFICATION_KEYS, SUBMISSION_STATUSES } from '../session/context'
import { LOCALES } from './config'
import { ROLES } from '../roles/context'
import { DUCAT_KINDS } from '../data/ducatRule'
import { JUNIOR, PRICES } from '../data/pricing'
import { ENTITY_FORMS, RACES } from '../pages/admin/entityForms'
import { QUEUES } from '../pages/admin/queues'
import sr from './sr.json'
import { translate } from './translate'

const dictionary = sr

/* translate() returns the key itself when a key is missing, which keeps the
 * screen usable but is invisible to every other test: a route pointing at
 * nav.nepostoji renders "nav.nepostoji" and nothing fails. This is the test
 * that notices. */
function resolves(key: string): boolean {
  /* All three counts, because a leaf may be the three forms of a plural rather
     than a sentence. Without a count at all, translate answers a plural leaf
     with the key itself, which reads exactly like a name that is not there; with
     one count only, a leaf that has "one" and has lost the other two answers for
     a single race and prints its own name for every other number. Serbian picks
     a different form at 1, at 2 and at 5. */
  return [1, 2, 5].every((count) => translate(dictionary, 'sr', key, { count }) !== key)
}

describe('translation keys used in code', () => {
  it('exist for every route label', () => {
    const missing = ROUTES.map((route) => route.labelKey).filter((key) => !resolves(key))

    expect(missing).toEqual([])
  })

  it('exist for every part of the registration form', () => {
    const form = registracija
    const keys = [form.titleKey, form.submitKey]

    for (const field of form.fields) {
      keys.push(field.labelKey)

      if (field.hintKey !== undefined) {
        keys.push(field.hintKey)
      }

      /* And the words of a link inside a label, which is the third kind of text
         a field carries (forms/types.ts, `linkKey`). Left out, deleting the word
         „pravilnikom" would have left a link whose text is the key itself, on
         the sentence somebody agrees to. */
      if (field.linkKey !== undefined) {
        keys.push(field.linkKey)
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

})

/**
 * The names the portal does not write out: a stem and a value off a closed list,
 * `t(`ducats.kind.${rule.kind}`)`.
 *
 * said.test reads names written out in full and cannot read one of these, since
 * a name built out of a value is a family rather than a name. Each family is
 * therefore walked here against the list it is built from.
 *
 * Three of these went missing in a fortnight, all invisibly. The sixteen ducat
 * kinds had a guard by accident until 10.08.2026: the ducat editor listed them
 * all in full, and deleting that screen took the only place they were written
 * out with it. The heading over the form for a race lost its cover the same way,
 * when the races left the list of entities the walk over the screens is built
 * from. The five countries in the dictionary were a second list beside the file
 * the select is filled from, and it holds two hundred and fifty two: a team
 * proposed from Slovenia reached the moderator as `country.SI`. That one is not
 * on the list below because it is gone: both screens read the file (countryName).
 *
 * A family belongs here the day a name is composed out of a value, whether or
 * not `t(` is on the same line: `rights.ts` and `entityForms.ts` build one into a
 * field and hand it on. What finds them is a search for a backticked string
 * whose text ends in a dot before the `${`.
 *
 * Where a family is walked somewhere better it stays there and not here: the
 * rights matrix walks its own names (rights.test) and the addresses walk theirs
 * (SEO_KEYS above).
 */
describe('the names the portal composes out of a list', () => {
  const FAMILIES: { of: string; each: readonly string[] }[] = [
    { of: 'ducats.kind', each: DUCAT_KINDS },
    /* The five values a ducat can be worth. Written out rather than read off a
       list in the source, because there is no such list: the values are a union
       of five numbers, and the coin is drawn from the number itself. */
    { of: 'ducats.tier', each: ['1', '2', '3', '4', '5'] },
    /* Both halves for every entity that has a form, the races included: theirs is
       edited inside its event and is therefore not in ENTITY_FORMS, which is
       exactly how the heading over it came to be uncovered.

       A fixed entity has no "new" heading and must not have one: its rows are the
       year itself, nothing is added and nothing is removed (owner, 30.07.2026). */
    {
      of: 'admin.form.new',
      each: [...ENTITY_FORMS, RACES].filter((one) => one.fixed !== true).map((one) => one.id),
    },
    { of: 'admin.form.edit', each: [...ENTITY_FORMS, RACES].map((one) => one.id) },
    /* What the text on a card is called, asked for by PendingQueue. Not one per
       queue: the results and the payments have screens written for them and
       neither shows a card with text, and the racing profile holds two sorts of
       thing and asks by the sort (`bodyLabelFor`). */
    {
      of: 'verification.body',
      each: [
        ...PENDING_QUEUE_IDS.filter((id) => id !== 'payments' && id !== 'profiles'),
        /* And one per sort of thing the racing profile holds, off the same list
           the screen reads (data/types.ts). */
        ...ITEM_KINDS.filter((kind) => kind !== ''),
      ],
    },
    { of: 'pricing.rows', each: [...PRICES, JUNIOR].map((row) => row.key) },
    { of: 'event.kind', each: EVENT_KINDS },
    { of: 'profile.lengthsShort', each: ['all', ...CATEGORIES] },
    { of: 'profile.categoryWord', each: CATEGORIES },
    { of: 'category', each: CATEGORIES },
    { of: 'home.mostOf', each: CATEGORIES },
    { of: 'calendar.weekdays', each: ['1', '2', '3', '4', '5', '6', '7'] },
    { of: 'myProfile.notify', each: NOTIFICATION_KEYS },
    /* The role switch, which is a thing of the workshop rather than of the
       portal, and still a select somebody reads. */
    { of: 'role', each: ROLES },
    { of: 'admin.basisValue', each: ['payment', 'honorary'] },
    { of: 'status', each: SUBMISSION_STATUSES },
    { of: 'topBoards.byLength', each: CATEGORIES },
    { of: 'event.rating', each: RATING_MARKS },
    { of: 'language', each: LOCALES },
  ]

  it('has every one of them, for every value on the list it is built from', () => {
    const missing = FAMILIES.flatMap(({ of, each }) =>
      [...each].map((value) => `${of}.${value}`).filter((key) => !resolves(key)),
    )

    expect(missing).toEqual([])
  })

  it('walks a family of more than one value, so the check is not over nothing', () => {
    /* The lists are read off the source, and a list that became empty would make
       its family pass by having nothing in it. */
    expect(FAMILIES.filter((one) => one.each.length < 2)).toEqual([])
  })
})

describe('the words the search engine is given', () => {
  it('names each of the seven queues, within the same 160 characters', () => {
    /* The seven queues share one address pattern, so their words are composed
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
