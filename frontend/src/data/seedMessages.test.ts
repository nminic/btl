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
    expect(said).toContain(`${Number(REGISTRATION_OPENS.slice(8, 10))}. oktobra`)
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
