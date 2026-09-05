import { describe, expect, it } from 'vitest'
import { first } from '../test/at'
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
    /* And the day, which cannot be read off the list the way the fee can: Serbian
       writes it in the genitive inside a sentence, and `formatDate` answers „1. oktobar
       2026.", the nominative. Read off the list, the message said that to every member
       for the length of one commit (review, 05.09.2026).

       So the sentence writes the day out and this holds the two together from the other
       end: the day the price list opens on is still the first of October. Move it to
       September and this fails, which is the whole of what the reading gave. */
    expect(said).toContain('1. oktobra')
    expect(REGISTRATION_OPENS.slice(5)).toBe('10-01')
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
