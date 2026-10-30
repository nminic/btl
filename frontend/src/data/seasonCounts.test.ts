import {
  bestOfficialSeason,
  bestSingleRaces,
  boardOfTen,
  rankingFor,
  rankTeams,
  seasonOf,
  seasonsCounted,
  seasonsOnOffer,
  seasonsWithResults,
  topByCategory,
  topByKilometers,
  topByProgress,
  topByTimeOnCourse,
  topPairs,
  yearOf,
} from './derive'
import { awardsOf } from '../pages/profile/awards'
import { must } from '../test/at'
import { aTeam } from '../test/theAnswer'
import type { Competitor, RacingPair, Result, Team } from './types'

/**
 * A RUN THAT NO SEASON COUNTS IS IN NO TABLE, NO BOARD AND NO AWARD OF ANY SEASON, AND STILL IN
 * THE HISTORY.
 *
 * PDL P9, the owner's choice of 18.10.2026 on the recommendation put to him: „Rezultat za datum pre
 * 2027 ili za godinu kad čovek nije bio član vidi se na profilu člana (istorija, krugovi po tipu
 * trke) i na strani događaja, a ne ulazi ni u jednu sezonsku tabelu, Top listu ni nagradu." The
 * server says which runs count (`Result.inItsSeason`); `seasonOf` is the one place that reads it.
 *
 * **One fixture, and the run that must not count is the one that would win.** Two men and a woman.
 * In 2027 the first man has 10 points over 10 km and the second 5 over 5 km, both counted; the
 * second man also has a run of 2027 that counts in no season, worth 100 points over 50 km in four
 * hours, on the race the woman ran too. Counted, it puts him first on every board below and makes
 * the pair a pair; not counted, the first man leads and the pair shares no counted race. So every
 * case reads the same 2027, and the only thing that parts the right answer from the wrong one is
 * whether that one run is read by its season or by its year (`yearOf`).
 */

const man = (memberNumber: string): Competitor => ({
  memberNumber,
  firstName: 'Ime',
  lastName: memberNumber,
  gender: 'M',
  city: 'Beograd',
  country: 'RS',
  ageBand: '40-54',
  firstSeason2027: false,
  firstSeason: 2027,
  unranked: false,
  membershipBasis: 'payment',
  teamId: 1,
  teamSince: 2027,
  profileHidden: false,
  birthdayShown: 'none',
  photo: null,
  smallPhoto: null,
  crop: null,
  bio: '',
})

const FIRST = man('000001')
const SECOND = man('000002')
const HER = { ...man('000003'), gender: 'F' as const, teamId: null, teamSince: null }
const EVERYBODY = [FIRST, SECOND, HER]

let made = 0

const run = (
  memberNumber: string,
  date: string,
  points: number,
  distanceKm: number,
  inItsSeason: boolean,
  over: Partial<Result> = {},
): Result => ({
  id: (made += 1),
  memberNumber,
  raceId: 10 + made,
  raceName: 'Trka',
  eventName: 'Trka',
  eventSlug: 'trka',
  date,
  distanceKm,
  ascentM: 0,
  descentM: 0,
  seconds: 3000,
  points,
  category: 'short',
  inItsSeason,
  inItsStanding: inItsSeason,
  ...over,
})

const SHARED_RACE = 99

const RESULTS: Result[] = [
  run(FIRST.memberNumber, '2027-05-01', 10, 10, true),
  run(SECOND.memberNumber, '2027-05-02', 5, 5, true),
  /* The run no season counts: a year he was no member of. */
  run(SECOND.memberNumber, '2027-06-01', 100, 50, false, { raceId: SHARED_RACE, seconds: 14_400 }),
  run(HER.memberNumber, '2027-06-01', 8, 50, true, { raceId: SHARED_RACE }),
]

const numbers = (rows: { competitor: Competitor }[]) => rows.map((row) => row.competitor.memberNumber)

describe('the season a run counts in', () => {
  it('is none for a run that counts in no season, and the year is still the year', () => {
    const uncounted = must(RESULTS[2], 'the run no season counts')

    expect(seasonOf(uncounted)).toBeNull()
    expect(yearOf(uncounted)).toBe(2027)
    expect(seasonOf(must(RESULTS[0], 'a counted run'))).toBe(2027)
  })

  it('is what a seasonal view offers, while the history keeps the year', () => {
    /* A year whose every run counts in no season: on the history, not on offer. */
    const only = [run(FIRST.memberNumber, '2029-05-01', 3, 3, false), ...RESULTS]

    expect(seasonsCounted(only)).toEqual([2027])
    expect(seasonsOnOffer(only, '2027-06-15')).toEqual([2027])
    expect(seasonsWithResults(only)).toEqual([2029, 2027])
  })
})

describe('a run that no season counts', () => {
  it('is not in the standing of its season', () => {
    expect(numbers(rankingFor(EVERYBODY, RESULTS, { season: 2027, gender: 'M' }))).toEqual([
      FIRST.memberNumber,
      SECOND.memberNumber,
    ])
    expect(rankingFor(EVERYBODY, RESULTS, { season: 2027, gender: 'M' })[1]?.points).toBe(5)
  })

  it('is not on the board of ten', () => {
    expect(boardOfTen(EVERYBODY, RESULTS, 2027, 'M', '2027-06-15').map((one) => one.points)).toEqual([10, 5])
  })

  it('is not on the boards of a category, of the kilometres, of the time on course and of single races', () => {
    expect(numbers(topByCategory(EVERYBODY, RESULTS, 2027, 'short', 10))[0]).toBe(FIRST.memberNumber)
    expect(numbers(topByKilometers(EVERYBODY, RESULTS, 2027, 10)).slice(0, 2)).toEqual([
      HER.memberNumber,
      FIRST.memberNumber,
    ])
    expect(topByTimeOnCourse(EVERYBODY, RESULTS, 2027, 10).find((one) => one.competitor === SECOND)?.seconds).toBe(
      3000,
    )
    expect(bestSingleRaces(EVERYBODY, RESULTS, 2027, 10).map((one) => one.result.points)).not.toContain(100)
  })

  it('is not a season before, on the board of progress', () => {
    /* A third man whose one run of 2027 counts in no season, worth 2, and whose 2028 is worth 20.
       Read by its year, 2027 is a season of 2 he grew 18 from; read by its season, he has no season
       before 2028 to grow from, and the board leaves him off. */
    const third = man('000004')
    const later = [
      ...RESULTS,
      run(third.memberNumber, '2027-07-01', 2, 2, false),
      run(third.memberNumber, '2028-05-01', 20, 20, true),
    ]

    expect(numbers(topByProgress([...EVERYBODY, third], later, 2028, 10))).not.toContain(third.memberNumber)

    /* And the season shown: the second man's only run of 2028 counts in no season, worth 100. Read
       by its year, he grew 95 from his 5 of 2027; read by its season, he has no 2028 at all. */
    const shown = [...RESULTS, run(SECOND.memberNumber, '2028-05-01', 100, 50, false)]

    expect(numbers(topByProgress(EVERYBODY, shown, 2028, 10))).not.toContain(SECOND.memberNumber)
  })

  it('makes no race shared, on the board of pairs', () => {
    const pair: RacingPair = { id: 1, season: 2027, memberNumbers: [SECOND.memberNumber, HER.memberNumber] }

    expect(topPairs([pair], EVERYBODY, RESULTS, 2027, 10)).toEqual([])
  })

  it('is not in the standing of the teams', () => {
    /* `rankTeams` is handed the season's runs by its callers, which ask `seasonOf`; handed all of
       them it would carry the 100. What the screens hand it is measured in
       `pages/teamAsASeasonView.test.tsx` and `pages/Teams` cases. */
    const team: Team = { ...aTeam, id: 1 }
    const inSeason = RESULTS.filter((one) => seasonOf(one) === 2027)

    expect(rankTeams([team], EVERYBODY, inSeason, 2027)[0]?.totals.points).toBe(15)
  })

  it("does not close the beginners' category", () => {
    const later = [run(SECOND.memberNumber, '2026-05-01', 50, 50, false), ...RESULTS]

    expect(bestOfficialSeason(later, SECOND.memberNumber)).toBe(5)
  })

  it('wins no award of its season', () => {
    /* Counted, his 105 would put him first overall; not counted he is second, which is still a place,
       so the award is there and says second. */
    const places = awardsOf(SECOND, EVERYBODY, RESULTS).map((one) => [one.season, one.position])

    expect(places).toContainEqual([2027, 2])
    expect(places).not.toContainEqual([2027, 1])
  })
})
