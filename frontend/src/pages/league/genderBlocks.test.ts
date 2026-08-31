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
       then by the smaller member number. Anything sorted here again is a second ranking
       nobody asked for, and by age or by races it would be the extra rule the owner
       refused („Ne želim dodatna pravila", 31.08.2026).

       **Asked as the property, not as a list of orderings that must not happen.** Four
       drafts of this case chose people so that arrival differed from member number,
       from year of birth, from the beginner flag, from the number of races, from the
       season somebody joined in, and from the best single score. A review then
       enumerated eighty-four orderings a tie could be broken by and found three the
       fixture still could not tell from arrival — an age threshold at forty, one at
       forty-five, and the sum of the scores (measured 31.08.2026). Chasing them one at
       a time is the same walk that took nine rounds on the written pages: there is
       always another comparison.

       What is true of **every** one of them is that it moves a row past another row of
       its own block. So that is what is measured: each block, read in the order it
       comes back, must visit the input in increasing order. No ordering rule of any
       kind can hold while that does, and the fixture no longer has to be clever — it
       only has to have rows that could be moved, which means a tie.

       **A tie, and rows a rule would actually move.** An ordering that returns the
       arrival order changes nothing and is nothing to catch. A first draft had three
       level rows with the youngest first, and a threshold at forty then split them
       exactly where they already stood, so that rule passed (review, 31.08.2026). Five
       level rows now, born in 1985, 1995, 1970, 1980 and 1989, which is an order no cut
       by year of birth reproduces: **no threshold on age, in either direction, leaves
       the list as it arrived**, and neither does the beginner flag, the number of races,
       the season somebody joined or the best single score. Years rather than ages,
       because an age is a year minus a season and no season is fixed here. The sum of the scores cannot be
       such a rule at all, because the total **is** that sum here, as it is on the
       portal. */
    const rows = [
      { ...person('000007', 'M'), birthYear: 1985, firstSeason2027: false, scores: [50] },
      /* Three level with each other, so there is something a tie-break could move: with
         every total different there is no tie at all and a tie-break never fires, which
         was true of one earlier draft of this fixture. */
      { ...person('000005', 'M'), birthYear: 1985, firstSeason: 2022, firstSeason2027: false, scores: [9, 8, 3] },
      { ...person('000001', 'M'), birthYear: 1995, firstSeason: 2020, firstSeason2027: true, scores: [14, 6] },
      { ...person('000003', 'M'), birthYear: 1970, firstSeason: 2021, firstSeason2027: false, scores: [7, 6, 5, 2] },
      { ...person('000004', 'M'), birthYear: 1980, firstSeason: 2018, firstSeason2027: false, scores: [11, 6, 3] },
      { ...person('000006', 'M'), birthYear: 1989, firstSeason: 2023, firstSeason2027: false, scores: [10, 5, 4, 1] },
      /* And a woman, so the blocks are two and the reading below has to cross one. */
      { ...person('000009', 'F'), birthYear: 1992, firstSeason2027: false, scores: [30] },
      { ...person('000002', 'F'), birthYear: 1988, firstSeason2027: false, scores: [12, 8] },
    ].map(({ scores, ...competitor }) => ({
      competitor,
      points: new Map(scores.map((score, at) => [`race-${String(at)}`, score])),
      /* The total is the sum of what is shown and nothing else, which is what
         `leagueTable` means by it: a row whose total is not its own sum is a row the
         portal cannot produce, and an earlier draft of this fixture carried three of
         them (review, 31.08.2026). */
      total: scores.reduce((sum, score) => sum + score, 0),
    }))

    const groups = leagueGroups(rows)

    expect(groups.map((one) => one.code)).toEqual(['DRUGI', 'PRVI'])

    /* Every block reads the input forwards. A tie moved by age, by races, by the season
       somebody joined in, by the best score or by anything else makes one of these
       sequences go backwards. */
    const arrived = rows.map((row) => row.competitor.memberNumber)

    for (const group of groups) {
      /* Found by who the row is, not by which object it is: a `leagueGroups` that hands
         back copies — which is what happens the moment somebody gives a block its own
         numbering — made `indexOf` answer minus one for every row, and a list of minus
         ones is sorted, so the check passed over a real reordering (review,
         31.08.2026). */
      const seen = group.rows.map((row) => arrived.indexOf(row.competitor.memberNumber))

      expect(seen, group.code).not.toContain(-1)
      expect(seen, group.code).toEqual([...seen].sort((left, right) => left - right))
    }

    /* And the blocks between them hold everybody, so „keeps the order" is not kept by
       dropping somebody. */
    expect(groups.flatMap((group) => group.rows).length).toBe(rows.length)

    /* **And each block holds exactly the people of one gender.** Order inside a block
       is only half the question: a rule that sends somebody to the **other** block moves
       nobody within either one, so all three assertions above passed while a man stood
       among the women — measured with beginners grouped with the women (review,
       31.08.2026). What a block is called and who is in it are one fact, and they are
       asked together. */
    for (const group of groups) {
      const mark = group.code === 'PRVI' ? 'M' : 'F'

      expect(
        group.rows.map((row) => row.competitor.gender),
        `everybody in ${group.code} is ${mark}`,
      ).toEqual(group.rows.map(() => mark))
    }
  })
})
