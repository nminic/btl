import {
  bestOfficialSeason,
  bestSingleRaces,
  boardOfTen,
  cardCategoryOf,
  categoriesOf,
  categoryIn,
  rankingFor,
  rankingWithEverybody,
  rankTeams,
  resultsOf,
  standingSeasonOf,
  standsIn,
  topByCategory,
  topByKilometers,
  topByProgress,
  topByTimeOnCourse,
  topPairs,
} from './derive'
import { earnedDucats } from './ducatEarned'
import type { DucatFamily } from './ducatRule'
import { awardsOf } from '../pages/profile/awards'
import type { Competitor, RacingPair, Result, Team } from './types'

/**
 * „BEZ PRAVA RANGIRANJA" ON EVERY READER OF „WHO IS RANKED" THIS SIDE HAS.
 *
 * The owner, 28.10.2026: a member without the right to rank „ima profil, unosi rezultate i vidi svoje
 * bodove i statistiku na profilu; ne pojavljuje se u tabelama lige, rang listama ni u kategoriji, a
 * bodovi mu ne ulaze u zbir tima ni para". And 30.10.2026: he earns his ducats, his points count in
 * the threshold of the beginners' category, and his season counts as the previous one on the board
 * of best progress. Which runs are his without the right is the server's to say
 * (`Result.inItsStanding`, and since 30.10.2026 the categories `Competitor.categories` carries only for the
 * seasons he stands in, with no mark of „without the right" at all); this file measures what every reader
 * does with it.
 *
 * **The member without the right is the strongest of the field on every measure**, so a reader that
 * lets him through puts him FIRST and never merely somewhere: 80 points against 50 and 30, the
 * longest race and the longest time. And every run of his COUNTS IN ITS SEASON (`inItsSeason`), so a
 * reader that asks „was he a member" instead of „does he rank" lets him through. That replacement of
 * the source is the mutation each case below is written against.
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

let made = 0

const run = (memberNumber: string, date: string, points: number, over: Partial<Result> = {}): Result => ({
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
  ...over,
})

/** A run of a member who holds its season without the right to rank. */
const withoutTheRight = (memberNumber: string, date: string, points: number, over: Partial<Result> = {}): Result =>
  run(memberNumber, date, points, { inItsStanding: false, ...over })

const RANKED = competitor('000001')
const ALSO_RANKED = competitor('000003')
/* Without the right in the season shown, and raced: the server answers no category of that season
   for him, on his card or in his list (PDL, 30.10.2026). */
const UNRANKED = competitor('000002', { category: null, categories: [] })
/* Without the right in the season shown and NOT raced. */
const UNRANKED_UNRACED = competitor('000004', { category: null, categories: [] })
/* Ranked and not raced: the member the table of the running season does draw at nought. */
const RANKED_UNRACED = competitor('000006')

const FIELD = [RANKED, UNRANKED, ALSO_RANKED, UNRANKED_UNRACED, RANKED_UNRACED]

const RESULTS_2027 = [
  run('000001', '2027-05-01', 50),
  withoutTheRight('000002', '2027-05-01', 80, { distanceKm: 42, seconds: 15000, category: 'long' }),
  run('000003', '2027-05-01', 30),
]

const numbers = (rows: { competitor: Competitor }[]) => rows.map((row) => row.competitor.memberNumber)

describe('the standing season of a run', () => {
  it('is the season of the run where it counts in the standings, and none where it does not', () => {
    expect(standingSeasonOf(run('000001', '2027-05-01', 1))).toBe(2027)
    expect(standingSeasonOf(withoutTheRight('000002', '2027-05-01', 1))).toBeNull()
    /* And none for a run no season counts at all, whatever the second flag says. */
    expect(standingSeasonOf(run('000001', '2019-05-01', 1, { inItsSeason: false }))).toBeNull()
  })
})

describe('the table of a season', () => {
  it('leaves out a member without the right to rank, although he took the most points', () => {
    expect(numbers(rankingFor(FIELD, RESULTS_2027, { season: 2027, gender: 'M' }))).toEqual(['000001', '000003'])
  })

  it('draws every ranked member of the running season, raced or not, and nobody without the right', () => {
    expect(numbers(rankingWithEverybody(FIELD, RESULTS_2027, { season: 2027, gender: 'M' }))).toEqual([
      '000001',
      '000003',
      '000006',
    ])
  })

  it('offers no category that only a member without the right is in', () => {
    expect(categoriesOf(FIELD, 'M', 2027)).toEqual(['M40-54'])
  })

  it('files him under no category, and draws none for him', () => {
    expect(cardCategoryOf(RANKED)).toBe('M40-54')
    expect(categoryIn(RANKED, 2027)).toBe('M40-54')
    expect(cardCategoryOf(UNRANKED)).toBeNull()
    expect(categoryIn(UNRANKED, 2027)).toBeNull()

    /* Read as the category he chose, he would stand first in it. */
    expect(
      numbers(
        rankingFor(FIELD, [...RESULTS_2027, run('000002', '2026-05-01', 1, { inItsSeason: false })], {
          season: 2027,
          gender: 'M',
          categoryCode: 'M55+',
        }),
      ),
    ).toEqual([])
  })

  it('hands him no award, and the place he would have taken goes to the member who earned it', () => {
    expect(awardsOf(UNRANKED, FIELD, RESULTS_2027)).toEqual([])
    expect(awardsOf(RANKED, FIELD, RESULTS_2027).find((one) => one.kind === 'overall')?.position).toBe(1)
  })
})

describe('the boards', () => {
  it('fills the boards of ten with nobody without the right, before 2027 as after', () => {
    expect(boardOfTen(FIELD, [], 2027, 'M', '2026-12-01').map((slot) => slot.competitor.memberNumber)).toEqual([
      '000001',
      '000003',
      '000006',
    ])
    expect(boardOfTen(FIELD, RESULTS_2027, 2027, 'M', '2027-06-01').map((slot) => slot.competitor.memberNumber)).toEqual([
      '000001',
      '000003',
    ])
  })

  it('leaves him off every board of the season, though he leads each of them', () => {
    expect(numbers(topByKilometers(FIELD, RESULTS_2027, 2027, 10))).toEqual(['000001', '000003'])
    expect(numbers(topByTimeOnCourse(FIELD, RESULTS_2027, 2027, 10))).toEqual(['000001', '000003'])
    expect(numbers(topByCategory(FIELD, RESULTS_2027, 2027, 'long', 10))).toEqual(['000001', '000003'])
    expect(numbers(bestSingleRaces(FIELD, RESULTS_2027, 2027, 10))).toEqual(['000001', '000003'])
  })

  /**
   * THE TWO SEASONS OF THE BOARD OF PROGRESS ARE ASKED TWO QUESTIONS (owner, 30.10.2026: „prethodna
   * sezona bez prava rangiranja se računa kao prethodna"). 000008 held 2027 without the right and 2028
   * with it, so his 2027 is where he started from; 000009 the other way round, so his 2028 is no
   * standing of anybody's. Both improved, by 30 and by 50.
   */
  it('measures progress from a season held without the right, and never into one', () => {
    const climber = competitor('000008')
    const dropped = competitor('000009')
    const progress = topByProgress(
      [climber, dropped],
      [
        withoutTheRight('000008', '2027-05-01', 10),
        run('000008', '2028-05-01', 40),
        run('000009', '2027-05-01', 10),
        withoutTheRight('000009', '2028-05-01', 60),
      ],
      2028,
      10,
    )

    expect(progress.map((row) => [row.competitor.memberNumber, row.gain])).toEqual([['000008', 30]])
  })
})

describe('the sums of a team and of a pair', () => {
  it('adds nothing of his to his team, and still counts him in it', () => {
    const team: Team = {
      id: 7,
      slug: 'tim',
      crop: { x: 0.5, y: 0.5, size: 1 },
      name: 'Tim',
      city: 'Beograd',
      country: 'RS',
      organizerMemberNumber: '000001',
      bio: '',
      logo: null,
      smallLogo: null,
      alsoInTheTeam: [],
    }
    const members = [
      competitor('000001', { teamId: 7, teamSince: 2027 }),
      competitor('000002', { teamId: 7, teamSince: 2027, category: null, categories: [] }),
    ]
    const [row] = rankTeams([team], members, RESULTS_2027, 2027)

    expect(row?.totals.points).toBe(50)
    expect(row?.members).toBe(2)
  })

  it('stands no pair of his on the board of pairs', () => {
    const pairs: RacingPair[] = [
      { id: 1, season: 2027, memberNumbers: ['000001', '000002'] },
      { id: 2, season: 2027, memberNumbers: ['000003', '000005'] },
    ]
    const field = [...FIELD, competitor('000005')]
    const results = [...RESULTS_2027, run('000005', '2027-05-01', 5)]

    expect(topPairs(pairs, field, results, 2027, 10).map((row) => row.pair.id)).toEqual([2])
  })
})

describe('what he keeps', () => {
  it('sees every run of his season on his profile', () => {
    expect(resultsOf(RESULTS_2027, '000002', 2027).map((one) => one.points)).toEqual([80])
  })

  it('counts the season in the threshold of the beginners category', () => {
    expect(bestOfficialSeason(RESULTS_2027, '000002')).toBe(80)
  })

  it('earns the ducats of his runs', () => {
    const family: DucatFamily = {
      id: 'duk-proba',
      name: 'Proba',
      kind: 'raceCount',
      value: 2,
      period: 'always',
      top: 'ISTRČANIH',
      topFemale: '',
      bottom: 'TRKA',
      periodAt: 'none',
      mark: 'races',
      art: 'none',
      tier: 3,
      step: 0,
      last: 0,
      tierUpFrom: 0,
      counted: 'trka',
    }
    const two = [withoutTheRight('000002', '2027-05-01', 10), withoutTheRight('000002', '2027-06-01', 10)]

    expect(earnedDucats(UNRANKED, two, [family], '2027-07-01').map((ducat) => ducat.kind)).toEqual(['raceCount'])
  })
})

describe('whether he stands in the table of a season', () => {
  it('is told by a category of that season and of no other, with no mark of „without the right"', () => {
    const twoSeasons = competitor('000007', {
      categories: [
        { season: 2027, ageBand: '40-54', beginner: false },
        { season: 2028, ageBand: '40-54', beginner: false },
      ],
    })
    const onlyTheNext = competitor('000008', {
      category: { season: 2028, ageBand: '40-54', beginner: false },
      categories: [{ season: 2028, ageBand: '40-54', beginner: false }],
    })

    expect(standsIn(twoSeasons, 2027)).toBe(true)
    expect(standsIn(twoSeasons, 2028)).toBe(true)
    expect(standsIn(onlyTheNext, 2027)).toBe(false)
    expect(standsIn(onlyTheNext, 2028)).toBe(true)
    expect(standsIn(UNRANKED_UNRACED, 2027)).toBe(false)
  })
})
