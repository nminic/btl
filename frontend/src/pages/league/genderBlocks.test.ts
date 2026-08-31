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

/** What the five functions that turn a person into a category do when this table
 *  reaches for one: nothing at all, loudly. The owner settled on 31.08.2026 that a
 *  competition ranks by gender and by nothing else — „Ne želim dodatna pravila" —
 *  so a category read here is the rule coming back, whether it names the blocks or
 *  only breaks a tie inside one. A refusal written over the text of the file held
 *  this until the guard above replaced it, and deleting it with the text left the
 *  tie-break unmeasured for a round (review, 31.08.2026).
 *
 *  **These five, and not „every category function":** a comparison written straight
 *  on `birthYear` reaches none of them, and a claim that no category can come back
 *  at all would be wider than this holds. What holds that is the case below, where
 *  three orders disagree so only the one the table settled can produce the answer. */
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

  it('keeps the order the table settled, and settles nothing of its own inside a block', () => {
    /* The blocks are slices of an order `leagueTable` already fixed, by the total and
       then by the smaller member number. Anything sorted here again is a second
       ranking nobody asked for, and by age it would be the extra rule the owner
       refused („Ne želim dodatna pravila", 31.08.2026).

       **Four people, and not two.** With a pair there are only two possible answers,
       so any second order either agrees with arrival or reverses it, and a tie broken
       by year of birth agreed — it passed the first draft of this case. With four, one
       clear of the rest and three level with each other, every field they differ in
       points somewhere else than arrival does (all measured in review, 31.08.2026):

         arrival          000007, 000005, 000001, 000003
         member number    000007, 000001, 000003, 000005
         born, oldest     000007, 000001, 000005, 000003
         born, youngest   000007, 000003, 000005, 000001
         beginner first   000007, 000001, 000005, 000003
         fewest races     000007, 000001, 000005, 000003
         joined earliest  000007, 000001, 000003, 000005
         best single      000007, 000001, 000003, 000005

       What the mocks beside this hold is narrower and worth saying exactly: the five
       functions named there are refused, and a comparison written straight on a field
       of the competitor reaches none of them. This case is what holds that, and it
       holds more than `birthYear`. Each field the rows differ in was added because
       sorting on it had passed: the flag for a first season, which is a category by
       another name; the number of races, which is the likeliest extra rule a running
       league would reach for; and the season somebody joined in, which shares half a
       name with the flag and is a different column entirely. */
    const rows = [
      /* One clear of the rest, so a rule about ranking by the total has something to
         get wrong: with every row on nought, sorting the block by the total the wrong
         way round could not fail here, while the name of this case promised it could. */
      { ...person('000007', 'M'), birthYear: 1985, firstSeason2027: false, firstSeason: 2019, races: 1, best: 50, total: 50 },
      /* And three level with each other, so a tie-break has something to break: with
         every total different there is no tie at all, and a tie-break added to the
         code never fires. Both of those were true of two earlier drafts of this
         fixture, one after the other (review, 31.08.2026). */
      { ...person('000005', 'M'), birthYear: 1980, firstSeason2027: false, firstSeason: 2022, races: 3, best: 9, total: 20 },
      { ...person('000001', 'M'), birthYear: 1970, firstSeason2027: true, firstSeason: 2020, races: 2, best: 14, total: 20 },
      { ...person('000003', 'M'), birthYear: 1990, firstSeason2027: false, firstSeason: 2021, races: 4, best: 11, total: 20 },
    ].map(({ total, races, best, ...competitor }) => ({
      competitor,
      /* As many races as the row is given, so „fewer races first" is an order of its
         own here: every row carried an empty map until 31.08.2026 and that ordering,
         the likeliest one for a running league, changed nothing and passed. */
      /* Each race worth a different number of points, and the best of them somewhere
         else than the arrival order: every race was worth exactly one until 31.08.2026,
         so „the better single result first" — an ordering read off the values rather
         than the count — changed nothing here and passed. */
      points: new Map(Array.from({ length: races }, (_, at) => [`race-${String(at)}`, best - at])),
      total,
    }))
    const groups = leagueGroups(rows)

    expect(groups.map((one) => one.code)).toEqual(['PRVI'])
    expect(groups[0]?.rows.map((one) => one.competitor.memberNumber)).toEqual([
      '000007',
      '000005',
      '000001',
      '000003',
    ])
  })
})
