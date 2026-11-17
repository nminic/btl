import { describe, expect, it } from 'vitest'
import { inYearlyWindow } from '../data/season'
import { whatTheTeamsOffer } from './teamOffer'

/* Two days on either side of the transfer window, checked rather than trusted: on the first a team can be
   founded, on the second it cannot. */
const OPEN = '2027-12-01'
const SHUT = '2027-06-01'

/* THE MEMBER ASKED ABOUT IS NEVER THE FIRST ROW AND NEVER THE ONLY ONE OF HIS KIND: the first row is in
   a team and the third is not, so an answer read off the first row, or off any member with no team, and
   not off the reader, says the wrong thing for one of them. */
const MEMBERS = [
  { memberNumber: '000001', teamId: 3 },
  { memberNumber: '000002', teamId: null },
  { memberNumber: '000003', teamId: null },
  { memberNumber: '000004', teamId: 7 },
]

describe('what the teams offer whoever is reading', () => {
  it('reads the two days it is asked on the right side of the window', () => {
    expect([inYearlyWindow(OPEN), inYearlyWindow(SHUT)]).toEqual([true, false])
  })

  it.each([
    ['a visitor', null, OPEN, 'nothing'],
    ['a member in a team, in the window', '000004', OPEN, 'nothing'],
    ['a member in a team, out of it', '000004', SHUT, 'nothing'],
    ['a member in no team, in the window', '000003', OPEN, 'button'],
    ['a member in no team, out of it', '000003', SHUT, 'sentence'],
    /* A signed-in person the league keeps no record of is not in a team either. */
    ['somebody with no record, in the window', '999999', OPEN, 'button'],
  ] as const)('offers %s: %s', (_who, memberNumber, today, offered) => {
    expect(whatTheTeamsOffer(memberNumber, MEMBERS, today)).toBe(offered)
  })
})
