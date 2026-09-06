import { describe, expect, it } from 'vitest'
import { first } from '../test/at'
import { DEFAULT_LOCALE } from '../i18n/config'
import { formatDayInSentence } from '../i18n/format'
import { priceOn, REGISTRATION_OPENS } from './pricing'
import { FIRST_MESSAGES } from './seedMessages'

/* The two messages the inbox starts with are records, not the portal's own words, so
 * nothing holds their wording. What is held is the one thing in them that has a home
 * somewhere else: the fee and the day the season opens.
 *
 * ADL A12: an amount is never a number written into code, and the price list exists so
 * that „the screen that sets prices and the page that publishes them" cannot say
 * different things. This message publishes both. Written out, the two moved in
 * `pricing.ts` and the inbox went on announcing the old ones, with the whole gate
 * green (review, 05.09.2026).
 */
describe('the messages the inbox starts with', () => {
  it('announce the fee and the day the price list holds, not ones of their own', () => {
    const said = first(FIRST_MESSAGES).body

    expect(said).toContain(`${priceOn(REGISTRATION_OPENS).eur} EUR`)
    /* What that catches, said exactly, because it is narrower than it looks: a fee
       written out by hand **that has drifted**. Written out and still right, it passes,
       and the two mutations were run to see it — 35 by hand with the list at 35 passes,
       35 by hand with the list at 44 fails (05.09.2026). Drift is the fault ADL A12 is
       about; a hand-written number that agrees with the list is the same sentence. */
    /* And the day, in the case a sentence takes. Read through `formatDate`, which
       answers the nominative „1. oktobar 2026.", this message told every member
       „učlanjenje kreće 1. oktobar 2026." for the length of one commit (review,
       05.09.2026, ADL A35).

       **With the space in front of it, which is the whole of what binds the left end.**
       Written as `toContain('1. oktobra')` the message could say „21. oktobra" and pass,
       because nothing bound it (review, 05.09.2026); written with the formatter's whole
       answer and no space, „21. oktobra 2026." still passes, because it ends with „1.
       oktobra 2026." (measured here, same day, by putting that day in the message). */
    expect(said).toContain(` ${formatDayInSentence(REGISTRATION_OPENS, DEFAULT_LOCALE)}`)
  })

  it('are the league talking to everybody, which is what an empty recipient means', () => {
    /* Both, and it is the half a reader of the record would guess wrong: an empty `to`
       is not a message with no recipient but one addressed to the whole league
       (`session/context.ts`). */
    for (const one of FIRST_MESSAGES) {
      expect(one.to, one.id).toBe('')
    }
  })
})

describe('the season the portal greets its members with', () => {
  /**
   * The first letter every member reads names a season, and it must be the league's own.
   *
   * **Asked by making the constant answer differently, not by reading the text.** „Is this year
   * derived" cannot be answered by looking at a string: the right answer and the wrong one are
   * the same six characters while `FIRST_SEASON` is 2027, so a case that compares the sentence to
   * „2027" passes whether the year was read or typed (review, 06.09.2026). What separates them is
   * a portal whose first season is not 2027, and only the module that owns that number can make
   * one.
   *
   * The same shape `genderMark` is measured by: ask the tool to answer differently and require
   * the sentence to follow.
   */
  it('reads the year from the league rather than carrying its own', async () => {
    vi.resetModules()
    vi.doMock('./pricing', async () => {
      const real = await vi.importActual<typeof import('./pricing')>('./pricing')

      return { ...real, SEASON: 9999 }
    })

    /* Put back in `finally`, because a mock left standing by a failed assertion is a mock the
       next case inherits: the portal has already had one such escape reach a commit
       (`CLAUDE.md`, 01.09.2026). */
    try {
      const { FIRST_MESSAGES } = await import('./seedMessages')

      expect(FIRST_MESSAGES[0]?.subject).toContain('9999')
    } finally {
      vi.doUnmock('./pricing')
      vi.resetModules()
    }
  })
})
