import {
  cardCategoryOf,
  categoryIn,
  rankingFor,
  rankingWithEverybody,
  standsIn,
} from './derive'
import { awardsOf } from '../pages/profile/awards'
import type { Competitor, Result } from './types'

/**
 * THE CATEGORY OF EACH SEASON, ON THIS SIDE (V81, PDL, owner, 30.10.2026).
 *
 * „poredak svake sezone prikazuje kategoriju te sezone", „Prikazuj u proslim, svakako se to zamrzava",
 * and of the places that are not tied to a season: „dok traje trenutna sezona, prikazuje se kategorija u
 * trenutnoj sezoni". The server answers both (`Competitor.category`, `Competitor.categories`); this file
 * measures that every reader takes the one that is its own.
 *
 * **The member under test is a different category in each season** - a beginner in 2027 and in his band
 * in 2028 - and his card speaks of 2028. So a reader that takes the card for a table, or one season for
 * another, files him under the other category, and that replacement of the source is what each case is
 * written against.
 */

const competitor = (memberNumber: string, over: Partial<Competitor> = {}): Competitor => ({
  memberNumber,
  firstName: 'Ime',
  lastName: `Prezime${memberNumber}`,
  gender: 'M',
  city: 'Beograd',
  country: 'RS',
  category: { season: 2027, ageBand: '40-54', beginner: false },
  categories: [{ season: 2027, ageBand: '40-54', beginner: false }],
  firstSeason: 2027,
  teamId: null,
  teamSince: null,
  profileHidden: false,
  birthdayShown: 'none',
  photo: null,
  smallPhoto: null,
  crop: null,
  bio: '',
  ...over,
})

/** A beginner in 2027, 25-39 in 2028, and his card speaks of 2028. */
const TWO_CATEGORIES = competitor('000001', {
  category: { season: 2028, ageBand: '25-39', beginner: false },
  categories: [
    { season: 2027, ageBand: '24-', beginner: true },
    { season: 2028, ageBand: '25-39', beginner: false },
  ],
})

/** A member of 2028 alone. */
const ONLY_2028 = competitor('000002', {
  category: { season: 2028, ageBand: '55+', beginner: false },
  categories: [{ season: 2028, ageBand: '55+', beginner: false }],
})

let made = 0

const run = (memberNumber: string, date: string, points: number): Result => ({
  id: (made += 1),
  memberNumber,
  raceId: 1,
  raceName: 'Trka',
  eventName: 'Trka',
  eventSlug: 'trka',
  date,
  distanceKm: 10,
  ascentM: 100,
  descentM: 100,
  seconds: 3000,
  points,
  category: 'long',
  inItsSeason: true,
  inItsStanding: true,
})

const numbers = (rows: { competitor: Competitor }[]) => rows.map((row) => row.competitor.memberNumber)

describe('the category of one season', () => {
  it('is the category of that season and of no other, and nothing where he stands in none', () => {
    expect(categoryIn(TWO_CATEGORIES, 2027)).toBe('M R')
    expect(categoryIn(TWO_CATEGORIES, 2028)).toBe('M25-39')
    expect(categoryIn(ONLY_2028, 2027)).toBeNull()
  })

  it('is not the card, which speaks of the season the server chose for it', () => {
    expect(cardCategoryOf(TWO_CATEGORIES)).toBe('M25-39')
    expect(cardCategoryOf(competitor('000003', { category: null }))).toBeNull()
  })

  it('says who stands in the table of a season', () => {
    expect(standsIn(ONLY_2028, 2028)).toBe(true)
    expect(standsIn(ONLY_2028, 2027)).toBe(false)
  })
})

describe('the table of a season', () => {
  const field = [TWO_CATEGORIES, ONLY_2028, competitor('000004')]
  const results = [run('000001', '2027-05-01', 30), run('000004', '2027-05-01', 20), run('000001', '2028-05-01', 10)]

  it('files him under the category of that season', () => {
    expect(numbers(rankingFor(field, results, { season: 2027, gender: 'M', categoryCode: 'M R' }))).toEqual([
      '000001',
    ])
    expect(numbers(rankingFor(field, results, { season: 2028, gender: 'M', categoryCode: 'M R' }))).toEqual([])
    expect(numbers(rankingFor(field, results, { season: 2028, gender: 'M', categoryCode: 'M25-39' }))).toEqual([
      '000001',
    ])
  })

  it('draws every member of that season, raced or not, and no member of another season', () => {
    expect(numbers(rankingWithEverybody(field, results, { season: 2027, gender: 'M' }))).toEqual([
      '000001',
      '000004',
    ])
    expect(numbers(rankingWithEverybody(field, results, { season: 2028, gender: 'M' }))).toEqual([
      '000001',
      '000002',
    ])
  })

  it('hands an award on the board of the category of that season', () => {
    const won = awardsOf(TWO_CATEGORIES, field, results).filter((one) => one.kind === 'category')

    expect(won.map((one) => [one.season, one.category])).toEqual([
      [2028, 'M25-39'],
      [2027, 'M R'],
    ])
  })
})

describe('a choice made in this visit', () => {
  it('is folded over the season it is for, and leaves the other season and a card of another season alone', () => {
    const chose = { ...TWO_CATEGORIES, chosenCategory: '2028:yes' }

    expect(categoryIn(chose, 2028)).toBe('M R')
    expect(cardCategoryOf(chose)).toBe('M R')
    expect(categoryIn(chose, 2027)).toBe('M R')

    const forTheOther = { ...TWO_CATEGORIES, chosenCategory: '2027:no' }

    expect(categoryIn(forTheOther, 2027)).toBe('M24-')
    expect(categoryIn(forTheOther, 2028)).toBe('M25-39')
    expect(cardCategoryOf(forTheOther)).toBe('M25-39')
  })

  it('reads nothing out of an overlay that is not a season and a yes or a no', () => {
    expect(categoryIn({ ...TWO_CATEGORIES, chosenCategory: 'yes' }, 2028)).toBe('M25-39')
  })
})
