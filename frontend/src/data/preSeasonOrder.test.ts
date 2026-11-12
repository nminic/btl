import { describe, expect, it } from 'vitest'
import { boardOfTen, rankingWithEverybody } from './derive'
import type { Competitor, Result } from './types'

/* PDL, 12.11.2026 („Predsezonski poredak Top 10 i BTL tabele"), owner: members WITHOUT points in the
   season shown are ordered by the BTL points of all their history, descending, then by member number.
   Members WITH season points keep the season ordering.

   **The field is built so that no two sources of the order agree.** The history order (4, 2, 3, 1, 5)
   is neither the member number order (1..5), nor its reverse, nor the order of the first or the last
   result, and 000002 and 000003 tie on history so the second key decides on its own. */

const BEFORE_THE_SEASON = '2026-12-31'

const member = (memberNumber: string): Competitor => ({
  memberNumber,
  firstName: 'Ime',
  lastName: 'Prezime',
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

/* A run before 2027, which no season counts, as the history of a member is made of. */
const old = (memberNumber: string | null, date: string, points: number): Result => ({
  id: (made += 1),
  memberNumber,
  raceId: 36,
  raceName: 'Trka',
  eventName: 'Trka',
  eventSlug: 'trka',
  date,
  distanceKm: 10,
  ascentM: 100,
  descentM: 100,
  seconds: 3000,
  points,
  category: 'short',
  inItsSeason: false,
  inItsStanding: false,
})

const inTheSeason = (memberNumber: string, points: number): Result => ({
  ...old(memberNumber, '2027-03-01', points),
  inItsSeason: true,
  inItsStanding: true,
})

const FIELD = ['000001', '000002', '000003', '000004', '000005'].map(member)

const HISTORY: Result[] = [
  old('000001', '2019-05-01', 10),
  old('000002', '2018-05-01', 90),
  old('000002', '2020-05-01', 60),
  old('000003', '2021-05-01', 100),
  old('000003', '2017-05-01', 50),
  old('000004', '2016-05-01', 200),
  /* Somebody who is not in the field, and a run nobody owns: neither is anybody's history. */
  old('000099', '2019-05-01', 900),
  old(null, '2019-05-01', 900),
]

const numbers = (slots: { competitor: Competitor }[]) => slots.map((slot) => slot.competitor.memberNumber)

describe('the pre-season order of the members without points in the season', () => {
  it('puts the front page board in the order of the points of all their history, then of their number', () => {
    expect(numbers(boardOfTen(FIELD, HISTORY, 2027, 'M', BEFORE_THE_SEASON))).toEqual([
      '000004',
      '000002',
      '000003',
      '000001',
      '000005',
    ])
  })

  it('puts the table in the same order, under nobody who has points in the season', () => {
    expect(numbers(rankingWithEverybody(FIELD, HISTORY, { season: 2027, gender: 'M' }))).toEqual([
      '000004',
      '000002',
      '000003',
      '000001',
      '000005',
    ])
  })

  it('leaves the ones with points in the season in the season order, whatever their history', () => {
    /* 000001 has more history than 000005, and 000005 has more points in the season. */
    const results = [...HISTORY, inTheSeason('000005', 8), inTheSeason('000001', 3)]
    const table = numbers(rankingWithEverybody(FIELD, results, { season: 2027, gender: 'M' }))

    expect(table).toEqual(['000005', '000001', '000004', '000002', '000003'])

    const board = boardOfTen(FIELD, results, 2027, 'M', BEFORE_THE_SEASON)

    expect(numbers(board)).toEqual(table)
    expect(board.map((slot) => slot.ranked)).toEqual([true, true, false, false, false])
  })
})
