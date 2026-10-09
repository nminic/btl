import { describe, expect, it } from 'vitest'
import type { Competitor } from '../../data/types'
import { aCompetitor } from '../../test/theAnswer'
import { appended, profileFor, reachable } from './visible'

/**
 * WHETHER THIS READER MAY SEE THIS PROFILE, asked of the rule itself and not of a screen.
 *
 * <p>The screens have cases of their own (`profile/profile.test.tsx`, `profilePrivacy.test.tsx`,
 * `profile/hisOwnProfile.test.tsx`); what is held here is the order the rule asks its questions in,
 * which a screen cannot show because it only ever meets the answer. Every row below is ONE
 * reader and ONE profile, and no number is shared by the two readers it tells apart.
 *
 * <p>PDL P8a, 25.09.2026, „Treba da moze da otvori svoj profil dokle god postoji": a member whose
 * fee has lapsed is on no row of the list the server serves, so the rule finds nobody for him,
 * and `his` is the answer that says the page is his and the list cannot show it.
 */

const ONE = (memberNumber: string, changes: Partial<Competitor> = {}): Competitor => ({
  ...aCompetitor,
  memberNumber,
  ...changes,
})

const THE_LIST = [ONE('000001'), ONE('000007', { profileHidden: true }), ONE('000012')]

describe('the profile a reader may see', () => {
  it('is the member the list carries, for a reader who may read it', () => {
    expect(profileFor(THE_LIST, '000001', false, true, null)).toEqual({
      kind: 'shown',
      competitor: THE_LIST[0],
    })
  })

  it('is a hidden profile to a reader who may read a hidden one, and never to one who may not', () => {
    expect(profileFor(THE_LIST, '000007', true, true, null)).toEqual({
      kind: 'shown',
      competitor: THE_LIST[1],
    })
    expect(profileFor(THE_LIST, '000007', false, true, null)).toEqual({ kind: 'none' })
  })

  it('is nobody for a number nobody has, and the same nobody as a hidden profile', () => {
    expect(profileFor(THE_LIST, '000999', true, true, null)).toEqual({ kind: 'none' })
    expect(profileFor(THE_LIST, '000999', false, true, '000012')).toEqual(
      profileFor(THE_LIST, '000007', false, true, '000012'),
    )
  })

  it('is nobody for an address that carried no number at all', () => {
    expect(profileFor(THE_LIST, undefined, true, true, '000012')).toEqual({ kind: 'none' })
  })

  it('waits for as long as the server has not said who is reading, and for all three alike', () => {
    expect(profileFor(THE_LIST, '000007', false, false, null)).toEqual({ kind: 'waiting' })
    expect(profileFor(THE_LIST, '000999', false, false, null)).toEqual({ kind: 'waiting' })
    expect(profileFor(THE_LIST, undefined, false, false, null)).toEqual({ kind: 'waiting' })
  })

  /* **HIS OWN PAGE, WHICH THE LIST CANNOT SHOW HIM.** One member whose fee has lapsed: the list
     the server serves does not carry him, and the number on the page is the one the session names
     for the reader. */
  it('is HIS when the number is the reader\'s own and the list does not carry him', () => {
    expect(profileFor(THE_LIST, '000032', false, true, '000032')).toEqual({
      kind: 'his',
      memberNumber: '000032',
    })
  })

  it('is his before the server has said anything about the fee, because the number is the session\'s', () => {
    expect(profileFor(THE_LIST, '000032', false, false, '000032')).toEqual({
      kind: 'his',
      memberNumber: '000032',
    })
  })

  it('is NOT his for any other number, however many readers have one', () => {
    /* The wrong sources a rule could take `his` from, each one a way for a reader to be let
       through to a page that is not his: any reader with a number, the first member of the list,
       and a reader whose number is only the same length. */
    expect(profileFor(THE_LIST, '000999', false, true, '000032')).toEqual({ kind: 'none' })
    expect(profileFor(THE_LIST, '000001', false, true, '000032')).toMatchObject({ kind: 'shown' })
    expect(profileFor([ONE('000001', { profileHidden: true })], '000001', false, true, '000032')).toEqual({
      kind: 'none',
    })
    expect(profileFor(THE_LIST, '000032', false, true, '000033')).toEqual({ kind: 'none' })
  })

  it('is NOT his for a reader who is nobody, whatever the address says', () => {
    expect(profileFor(THE_LIST, '000032', false, true, null)).toEqual({ kind: 'none' })
    expect(profileFor(THE_LIST, '000032', true, true, null)).toEqual({ kind: 'none' })
  })

  it('asks the redirect only when the profile is not his: his own hidden page is his', () => {
    /* A member whose own row is hidden and who is not let read hidden ones. The list carrying
       him at all is the stale case - he renewed during the visit and the list was read before -
       and the answer is the same as for a lapsed member: his own page is not hidden from him. */
    const hidden = [ONE('000032', { profileHidden: true })]

    expect(profileFor(hidden, '000032', false, true, '000032')).toEqual({
      kind: 'his',
      memberNumber: '000032',
    })
    expect(profileFor(hidden, '000032', false, true, '000012')).toEqual({ kind: 'none' })
  })
})

describe('whether anything may lead a reader to a profile', () => {
  it('is no for a hidden profile and a reader who may not read one, and yes otherwise', () => {
    expect(reachable(ONE('000007', { profileHidden: true }), false)).toBe(false)
    expect(reachable(ONE('000007', { profileHidden: true }), true)).toBe(true)
    expect(reachable(ONE('000001'), false)).toBe(true)
  })
})

describe('an address with something hung off it', () => {
  it('is nothing where there is no address, and the address and the query where there is', () => {
    expect(appended(undefined, '?sezona=2019')).toBeUndefined()
    expect(appended('/sr/takmicar/000001', '?sezona=2019')).toBe('/sr/takmicar/000001?sezona=2019')
  })
})
