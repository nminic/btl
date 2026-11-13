import { describe, expect, it } from 'vitest'
import {
  bestSingleRaces,
  countedIn,
  onTheBoardsOf,
  topByCategory,
  topByKilometers,
  topByProgress,
  topByTimeOnCourse,
  topPairs,
} from './derive'
import { boardsOpenOn, WARM_UP, warmUpShown } from './season'
import type { Competitor, RaceCategory, RacingPair, Result } from './types'

/* PDL, 12.11.2026 („Zagrevanje: istorijski prikaz pre prve sezone"), owner: the Top lists, the counters at
   the top of the right column of the front page and the turning chart by length carry a view called
   „Zagrevanje", the default before the first season, counted from every result up to now; „Ne ulazi ni u top
   listu tokom zvanične sezone., Ovo je samo istorijski prikaz zabave radi koji se neće ponavljati nakon
   1.1.2027. kad krenu zvanične sezone".

   **The postavka keeps every source of the answer apart.** 000001 is strong in the history and absent from
   2027; 000002 is weak in the history and strong in 2027. 000001's history is spread over three years, and in
   no single one of them is it what all three are together, so a warm-up of one year cannot pass for the
   warm-up of all of them. 000002 has one run of 2026 that is longer than any single run of 000001 in 2026,
   so a warm-up read as „2026 alone" changes the leader. And one run of 000002 dated 2027 counts in no season
   (its member was no member of it): it is neither the warm-up nor 2027. */

const member = (memberNumber: string): Competitor => ({
  memberNumber,
  firstName: 'Ime',
  lastName: memberNumber,
  gender: 'M',
  city: 'Beograd',
  country: 'RS',
  category: { season: 2027, ageBand: '40-54', beginner: false },
  categories: [{ season: 2027, ageBand: '40-54', beginner: false }],
  firstSeason: 2027,
  membershipBasis: 'payment',
  teamId: null,
  teamSince: null,
  profileHidden: false,
  birthdayShown: 'none',
  photo: null,
  smallPhoto: null,
  crop: null,
  bio: '',
})

let made = 0

function run(
  memberNumber: string,
  date: string,
  distanceKm: number,
  points: number,
  extra: Partial<Result> = {},
): Result {
  const counted = Number(date.slice(0, 4)) >= 2027

  return {
    id: (made += 1),
    memberNumber,
    raceId: (made += 1),
    raceName: `Trka ${String(made)}`,
    eventName: 'Trka',
    eventSlug: 'trka',
    date,
    distanceKm,
    ascentM: 0,
    descentM: 0,
    seconds: distanceKm * 300,
    points,
    category: 'half' satisfies RaceCategory,
    inItsSeason: counted,
    inItsStanding: counted,
    ...extra,
  }
}

const FIELD = [member('000001'), member('000002')]

/* 000001: 30 + 25 + 20 = 75 km of history over three years, nothing in 2027. */
const HIS_2015 = run('000001', '2015-04-04', 30, 40)
const HIS_2019 = run('000001', '2019-05-05', 25, 35)
const HIS_2026 = run('000001', '2026-06-06', 20, 30)
const HIS = [HIS_2015, HIS_2019, HIS_2026]
/* 000002: 22 km of history, all in 2026 (more than 000001 has in 2026 alone), and 40 km in 2027. */
const HERS_2026 = run('000002', '2026-07-07', 22, 33)
const HERS_2027 = run('000002', '2027-03-03', 40, 60)
/* And one run of 2027 that no season counts. */
const UNCOUNTED = run('000002', '2027-04-04', 99, 99, { inItsSeason: false, inItsStanding: false })

const RESULTS = [...HIS, HERS_2026, HERS_2027, UNCOUNTED]

describe('the warm-up is on offer before the first season and never after it', () => {
  it.each([
    ['2026-01-01', true],
    ['2026-12-31', true],
    ['2027-01-01', false],
    ['2027-12-31', false],
    ['2028-01-01', false],
  ])('on %s: %s', (today, shown) => {
    expect(warmUpShown(today)).toBe(shown)
    expect(boardsOpenOn(today)).toBe(shown ? WARM_UP : Number(today.slice(0, 4)))
  })
})

describe('what the warm-up counts', () => {
  it('counts every year before 2027 together, and nothing of 2027', () => {
    const history = [...HIS, HERS_2026].map((one) => one.id)

    expect(RESULTS.filter((one) => onTheBoardsOf(one, WARM_UP)).map((one) => one.id)).toEqual(history)
    expect(RESULTS.filter((one) => countedIn(one, WARM_UP)).map((one) => one.id)).toEqual(history)
  })

  it('leaves a season to what its season counts, and no run before 2027 in it', () => {
    expect(RESULTS.filter((one) => onTheBoardsOf(one, 2027)).map((one) => one.id)).toEqual([HERS_2027.id])
    expect(RESULTS.filter((one) => countedIn(one, 2027)).map((one) => one.id)).toEqual([HERS_2027.id])
  })

  it('sums the kilometres of all the history on its board, and only the season on the season`s', () => {
    expect(topByKilometers(FIELD, RESULTS, WARM_UP, 10).map((row) => [row.competitor.memberNumber, row.kilometers])).toEqual([
      ['000001', 75],
      ['000002', 22],
    ])
    expect(topByKilometers(FIELD, RESULTS, 2027, 10).map((row) => [row.competitor.memberNumber, row.kilometers])).toEqual([
      ['000002', 40],
    ])
  })

  it('does the same on the boards by length, on course, and of single races', () => {
    expect(topByCategory(FIELD, RESULTS, WARM_UP, 'half', 10).map((row) => [row.competitor.memberNumber, row.races])).toEqual([
      ['000001', 3],
      ['000002', 1],
    ])
    expect(topByCategory(FIELD, RESULTS, 2027, 'half', 10).map((row) => [row.competitor.memberNumber, row.races])).toEqual([
      ['000002', 1],
    ])
    expect(topByTimeOnCourse(FIELD, RESULTS, WARM_UP, 10).map((row) => [row.competitor.memberNumber, row.seconds])).toEqual([
      ['000001', 75 * 300],
      ['000002', 22 * 300],
    ])
    expect(topByTimeOnCourse(FIELD, RESULTS, 2027, 10).map((row) => row.competitor.memberNumber)).toEqual(['000002'])
    expect(bestSingleRaces(FIELD, RESULTS, WARM_UP, 10).map((row) => row.result.id)).toEqual([
      HIS_2015.id,
      HIS_2019.id,
      HERS_2026.id,
      HIS_2026.id,
    ])
    expect(bestSingleRaces(FIELD, RESULTS, 2027, 10).map((row) => row.result.id)).toEqual([HERS_2027.id])
  })

  it('draws the pairs of the first season over the races they ran together before it', () => {
    const shared = 7777
    const together = [
      run('000001', '2018-08-08', 10, 12, { raceId: shared }),
      run('000002', '2018-08-08', 10, 11, { raceId: shared }),
    ]
    const pair: RacingPair = { id: 1, season: 2027, memberNumbers: ['000001', '000002'] }
    const history = [...RESULTS, ...together]

    expect(topPairs([pair], FIELD, history, WARM_UP, 5).map((row) => [row.races, row.points])).toEqual([[1, 23]])
    /* And in 2027 the two of them have run nothing together, so the pair is not on the board. */
    expect(topPairs([pair], FIELD, history, 2027, 5)).toEqual([])
    /* A pair of another season is not the warm-up's. */
    expect(topPairs([{ ...pair, season: 2028 }], FIELD, history, WARM_UP, 5)).toEqual([])
  })

  it('has nobody on the board of progress, since it has no season before it', () => {
    expect(topByProgress(FIELD, RESULTS, WARM_UP, 5)).toEqual([])
  })
})
