import { render } from '@testing-library/react'
import en from '../i18n/en.json'
import { formatNumber } from '../i18n/format'
import sr from '../i18n/sr.json'
import { translate, type Dictionary } from '../i18n/translate'
import { must } from '../test/at'
import { person } from '../test/plate'
import cases from './shareCard.cases.json'
import { Portrait } from './Portrait'

/**
 * THE FOUR THINGS THE SHARED CARD OF A PROFILE WRITES THE WAY THIS SIDE WRITES THEM.
 *
 * The card a profile is shared with is drawn on the server (`backend/.../domain/card`), which has
 * no browser and no copy of this side at run time, so four facts the portal already has get a
 * second home there: the initials in an empty circle (owner, 15.11.2026: „Kad nema profilne slike, u
 * krugu treba da se nađu inicijali, a ne čovečuljak”), which form of a word a count takes, how a
 * count is written and how kilometres are. `shareCard.cases.json` is what both homes are held to:
 * this file holds THIS side to it, and `CompetitorCardTest` and `WhatACardSaysTest` hold the
 * server to the same file. So the day either side writes one of them differently, one of the two
 * fails, and the file says which.
 *
 * **The initials are asked of the circle itself**, drawn as a member without a portrait, and not of
 * a function: the circle is what every screen draws (`components/oneFace.test.ts`), so it is what
 * the card has to agree with.
 */

const DICTIONARIES: Record<string, Dictionary> = { sr, en }

describe('what the shared card of a profile writes as this side writes it', () => {
  it('draws the initials of a member without a portrait', () => {
    expect(cases.initials.length).toBeGreaterThan(0)

    for (const one of cases.initials) {
      const { container, unmount } = render(
        <Portrait competitor={person('000061', one.firstName, one.lastName)} />,
      )

      expect(container.textContent, `${one.firstName} ${one.lastName}`).toBe(one.initials)
      unmount()
    }
  })

  it('declines a word for a count into the form the file names', () => {
    for (const [locale, forms] of Object.entries(cases.plurals)) {
      const dictionary = must(DICTIONARIES[locale], `a dictionary for ${locale}`)

      expect(Object.keys(forms).length, locale).toBeGreaterThan(0)

      /* A word whose forms are different words in the language, so the form that was chosen can be
         read back off the word that came out. */
      const one = translate(dictionary, locale, 'profile.categoryWord.short.one')
      const other = translate(dictionary, locale, 'profile.categoryWord.short.other')

      expect(one, locale).not.toBe(other)

      for (const [count, form] of Object.entries(forms)) {
        expect(
          translate(dictionary, locale, 'profile.categoryWord.short', { count: Number(count) }),
          `${locale} ${count}`,
        ).toBe(translate(dictionary, locale, `profile.categoryWord.short.${form}`))
      }
    }
  })

  it('writes a count and kilometres as the file writes them', () => {
    for (const [locale, rows] of Object.entries(cases.counts)) {
      for (const [count, written] of rows) {
        expect(formatNumber(Number(count), locale, 0), `${locale} ${count}`).toBe(written)
      }
    }

    for (const [locale, rows] of Object.entries(cases.kilometres)) {
      for (const [kilometres, written] of rows) {
        expect(formatNumber(Number(kilometres), locale, 2), `${locale} ${kilometres}`).toBe(written)
      }
    }
  })
})
