import { leagueGroups } from './leagueTable'
import type { Competitor } from '../../data/types'

/* Where the name of a block comes from, asked of what `leagueGroups` returns
 * rather than of the text of the file it lives in.
 *
 * Three drafts of this guard read the source and each was measured wrong in turn:
 * one required a call anywhere in the file, and the mark written out by hand with
 * the call left standing beside it passed; the next required it in an assignment
 * to a variable of one name, and it broke on renaming that variable, which is the
 * false alarm the round before had just removed; and the refusal beside it once
 * held a control byte where its author had typed a word boundary, so it could not
 * fail at all. A claim about **where a value comes from** is a claim about
 * behaviour, and this is how behaviour is asked (all three measured in review,
 * 31.08.2026).
 *
 * The one place the portal turns a gender into a mark answers here for a
 * competition too, so a block on this screen is never called something the
 * standing calls otherwise: `data/categories.ts`, `genderMark`.
 */

vi.mock('../../data/categories', async (real) => ({
  ...(await real<typeof import('../../data/categories')>()),
  /* Deliberately not „M" and „Ž": if the blocks still come back with those, the
     code that names them is not this function. */
  genderMark: (gender: string) => (gender === 'M' ? 'PRVI' : 'DRUGI'),
}))

const person = (memberNumber: string, gender: 'M' | 'F'): Competitor => ({
  memberNumber,
  firstName: 'Ime',
  lastName: memberNumber,
  gender,
  city: 'Beograd',
  country: 'RS',
  birthYear: 1985,
  firstSeason2027: false,
  firstSeason: 2019,
  active: true,
  membershipBasis: 'payment',
  referralCode: 'proba0000',
  referredBy: null,
  teamId: null,
  teamSince: null,
  bio: '',
})

describe('the name of a block of the standing', () => {
  it('is whatever the portal calls that gender, and is not written here', () => {
    const rows = [person('000001', 'M'), person('000002', 'F')].map((competitor) => ({
      competitor,
      points: new Map<string, number>(),
      total: 0,
    }))

    expect(leagueGroups(rows).map((one) => one.code)).toEqual(['DRUGI', 'PRVI'])
  })
})
