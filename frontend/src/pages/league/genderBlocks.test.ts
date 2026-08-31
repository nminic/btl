import { leagueGroups } from './leagueTable'
import type { Competitor } from '../../data/types'

/* Where the name of a block comes from, and what the table refuses to ask,
 * measured by what `leagueGroups` does rather than by the text of the file it
 * lives in.
 *
 * Three drafts of this guard read the source and each was measured wrong in turn:
 * one required a call anywhere in the file, so the mark written out by hand with
 * the call left standing beside it passed; the next required it in an assignment
 * to a variable of one name, and it broke on renaming that variable, which is the
 * false alarm the round before had just removed; and the refusal beside it once
 * held a control byte where its author had typed a word boundary, so it could not
 * fail at all. A claim about **where a value comes from** is a claim about
 * behaviour (all measured in review, 31.08.2026).
 *
 * The one place the portal turns a gender into a mark answers here for a
 * competition too, so a block on this screen is never called something the
 * standing calls otherwise: `data/categories.ts`, `genderMark`.
 */

/** What a category function does when the table reaches for one: nothing at all,
 *  loudly. The owner settled on 31.08.2026 that a competition ranks by gender and
 *  by nothing else — „Ne želim dodatna pravila" — so a category read anywhere in
 *  this table is the rule coming back, whether it names the blocks or only breaks
 *  a tie inside one. A refusal written over the text of the file held this until
 *  the guard above replaced it; deleting it with the text left the tie-break
 *  unmeasured for one round (review, 31.08.2026). */
vi.mock('../../data/categories', async (real) => {
  /* Built inside the factory: `vi.mock` is hoisted above everything in the file,
     so a helper declared outside it is not there yet when it runs. */
  const refuse = (name: string) => (): never => {
    throw new Error(`leagueGroups asked ${name}, and a competition ranks by gender alone`)
  }

  return {
    ...(await real<typeof import('../../data/categories')>()),
    /* Deliberately not „M" and „Ž": if the blocks still come back with those, the
       code that names them is not this function. */
    genderMark: (gender: string) => (gender === 'M' ? 'PRVI' : 'DRUGI'),
    categoryCodeFor: refuse('categoryCodeFor'),
    ageBandFor: refuse('ageBandFor'),
    categoryLabel: refuse('categoryLabel'),
  }
})

vi.mock('../../data/derive', async (real) => {
  const refuse = (name: string) => (): never => {
    throw new Error(`leagueGroups asked ${name}, and a competition ranks by gender alone`)
  }

  return {
    ...(await real<typeof import('../../data/derive')>()),
    categoryOfMember: refuse('categoryOfMember'),
    categoriesOf: refuse('categoriesOf'),
  }
})

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

const rowsOf = (people: Competitor[]) =>
  people.map((competitor) => ({ competitor, points: new Map<string, number>(), total: 0 }))

describe('the name of a block of the standing', () => {
  it('is whatever the portal calls that gender, and is not written here', () => {
    expect(leagueGroups(rowsOf([person('000001', 'M'), person('000002', 'F')])).map((one) => one.code)).toEqual([
      'DRUGI',
      'PRVI',
    ])
  })

  it('is settled without asking anything about a category, inside a block or outside one', () => {
    /* Two people of one gender, born eleven years apart, so a category would tell
       them apart if anything here asked for one. Their order is the order they
       arrived in, which `leagueTable` settled by the total and by the smaller
       member number; a tie broken by age band would be the extra rule the owner
       refused, and it would show up here as a throw rather than as a wrong order. */
    const older = { ...person('000003', 'M'), birthYear: 1966 }
    const groups = leagueGroups(rowsOf([person('000001', 'M'), older]))

    expect(groups.map((one) => one.code)).toEqual(['PRVI'])
    expect(groups[0]?.rows.map((one) => one.competitor.memberNumber)).toEqual(['000001', '000003'])
  })
})
