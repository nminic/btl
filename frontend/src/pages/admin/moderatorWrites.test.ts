import { describe, expect, it } from 'vitest'
import { emailIn, identityIn, invitedFrom, ticksIn } from './moderatorWrites'

/**
 * WHAT THE SCREEN OF MODERATORS SENDS, AND WHAT IT READS BACK.
 *
 * <p>A module rather than a screen, for the same reason `leagueWrites.test.ts` gives
 * about its own: a question about a body and about an answer is asked of the function
 * that builds and reads them, not by mounting React round it. What the screen does with
 * these is measured where the screen is (`AdminModerators.test.tsx`).
 */

describe('what a moderator is invited with', () => {
  it('carries the three fields off the form', () => {
    expect(
      invitedFrom({ firstName: 'Ana', lastName: 'Jovanović', email: 'ana@primer.rs' }),
    ).toEqual({ firstName: 'Ana', lastName: 'Jovanović', email: 'ana@primer.rs' })
  })

  it('sends an empty string for a field the form did not carry, and never nothing at all', () => {
    /* `ModeratorWriteApi.whatTheFormLeftOut` treats a blank, an empty string and an
       absent field as one mistake with one fix - type it in - so a body that quietly
       dropped a field the form did not populate would be answered `theFormIsNotComplete`
       with nothing telling the superadmin which one. */
    expect(invitedFrom({ firstName: 'Ana' })).toEqual({
      firstName: 'Ana',
      lastName: '',
      email: '',
    })
  })
})

describe('the identity a new moderator comes back with', () => {
  it('is the number the database handed out', () => {
    expect(identityIn({ id: 42, email: 'ana@primer.rs' })).toBe(42)
  })

  it('is nothing where the answer carried no body at all', () => {
    /* A 204, and a 201 whose body could not be parsed: `askTheServer` answers
       `undefined` for both rather than claiming a shape. */
    expect(identityIn(undefined)).toBeNull()
    expect(identityIn(null)).toBeNull()
    expect(identityIn('42')).toBeNull()
  })

  it('is nothing where the body carries no identity, or one of the wrong kind', () => {
    expect(identityIn({ email: 'ana@primer.rs' })).toBeNull()
    /* Read without an assertion (ADL A14), so a number written as text is refused
       rather than coerced. */
    expect(identityIn({ id: '42' })).toBeNull()
    expect(identityIn({ id: 42.5 })).toBeNull()
  })

  it('refuses nought and below, which is not a range account.id can answer with', () => {
    expect(identityIn({ id: 0 })).toBeNull()
    expect(identityIn({ id: -1 })).toBeNull()
    expect(identityIn({ id: 1 })).toBe(1)
  })
})

describe('the address a new moderator comes back with', () => {
  it("is the row's own spelling", () => {
    /* Read back off the answer rather than off what was typed: `WhatAnAddressLooksLike`
       folds the address to lower case on the way in, so a screen that echoed the typed
       spelling would show one the database does not hold the moment the two differ by
       case. */
    expect(emailIn({ id: 42, email: 'ana@primer.rs' })).toBe('ana@primer.rs')
  })

  it('is nothing where the answer carried no body, no address, or one of the wrong kind', () => {
    expect(emailIn(undefined)).toBeNull()
    expect(emailIn(null)).toBeNull()
    expect(emailIn('ana@primer.rs')).toBeNull()
    expect(emailIn({ id: 42 })).toBeNull()
    // oxlint-disable-next-line typescript/no-magic-numbers
    expect(emailIn({ id: 42, email: 7 })).toBeNull()
    expect(emailIn({ id: 42, email: '' })).toBeNull()
  })
})

describe('what the table holds after a PUT', () => {
  it('is the rights the answer carried', () => {
    expect(ticksIn({ id: 42, rights: ['entity:events', 'queue:payments'] })).toEqual([
      'entity:events',
      'queue:payments',
    ])
  })

  it('is an empty list where the answer says the moderator holds nothing', () => {
    /* An empty list is not a broken record, it is a moderator who may do nothing yet
       (the portal's own words, `data/types.ts`), and it has to be told apart from
       "could not be read". */
    expect(ticksIn({ id: 42, rights: [] })).toEqual([])
  })

  it('is nothing where the answer carried no body, no rights, or one of the wrong kind', () => {
    expect(ticksIn(undefined)).toBeNull()
    expect(ticksIn(null)).toBeNull()
    expect(ticksIn('[]')).toBeNull()
    expect(ticksIn({ id: 42 })).toBeNull()
    expect(ticksIn({ id: 42, rights: 'entity:events' })).toBeNull()
    expect(ticksIn({ id: 42, rights: [1, 2] })).toBeNull()
  })
})
