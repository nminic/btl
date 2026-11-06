import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { topByProgress } from './derive'
import { categoryOfTheCode, frozenTablesIn, pointsAtTheFreeze, standIn, theLiveOne } from './frozen'
import { frozenAwardsOf } from '../pages/profile/awards'
import type { Competitor, Result } from './types'
import { must } from '../test/at'

/**
 * WHAT THE SCREENS READ A FROZEN SEASON WITH: the answer of `GET /api/frozen-tables/{season}` read into
 * types, the record a member of a frozen row is drawn with, and the season before on the list of progress.
 */

const SERVED: unknown = JSON.parse(readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'frozen-tables.json'), 'utf-8'))

/** The served answer with one field of one part written over. */
function servedWith(part: string, index: number, field: string, value: unknown): unknown {
  const copy: unknown = JSON.parse(JSON.stringify(SERVED))
  const rows: unknown = part === '' ? [copy] : Reflect.get(Object(copy), part)

  Reflect.set(Object(Array.isArray(rows) ? rows[index] : rows), field, value)

  return copy
}

const A_MEMBER: Competitor = {
  memberNumber: '000001',
  firstName: 'Danasnje',
  lastName: 'Ime',
  gender: 'M',
  city: 'Beograd',
  country: 'RS',
  category: null,
  categories: [{ season: 2027, ageBand: '25-39', beginner: false }],
  firstSeason: 2027,
  chosenCategory: '2027:yes',
  profileHidden: false,
  birthdayShown: 'none',
  teamId: 1,
  teamSince: 2027,
  bio: '',
  photo: 'lice.jpg',
  crop: null,
  smallPhoto: null,
}

describe('reading the tables of a frozen season', () => {
  it('reads the answer the server gives, every part of it', () => {
    const tables = frozenTablesIn(SERVED)

    expect(tables?.season).toBe(2027)
    expect(tables?.standings.map((one) => [one.position, one.memberNumber, one.who, one.category])).toEqual([
      [1, '000001', 'Vladan Đurišić', 'M40-54'],
      [2, '000005', 'Bogoljub Nikolajević', 'M25-39'],
      [3, null, 'Relja Momčilović', 'M25-39'],
      [1, '000003', 'Anđelija Vukotić', 'Ž25-39'],
      [2, null, null, 'Ž R'],
    ])
    expect(tables?.teams[2]?.slug).toBeNull()
    expect(tables?.pairs[0]?.halves.map((one) => one.memberNumber)).toEqual(['000001', '000003'])
    expect(tables?.leagues[0]?.columns[1]?.eventSlug).toBeNull()
    expect(tables?.pointsAtTheFreeze).toHaveLength(4)
  })

  it.each([
    ['nothing at all', null],
    ['a season that is not a number', servedWith('', 0, 'season', '2027')],
    ['a list that is not a list', servedWith('teams', 0, 'roster', {})],
    ['a gender of neither', servedWith('standings', 0, 'gender', 'X')],
    ['a name that is not text', servedWith('standings', 0, 'who', 7)],
    ['a number that is not one', servedWith('standings', 0, 'points', '412.5')],
    ['a previous season that is not a number', servedWith('boards', 0, 'previousPoints', 'x')],
    ['a pair of one', servedWith('pairs', 0, 'halves', [{ memberNumber: '000001', who: 'A', gender: 'M' }])],
    [
      'a pair of three',
      servedWith('pairs', 0, 'halves', [
        { memberNumber: '000001', who: 'A', gender: 'M' },
        { memberNumber: '000003', who: 'B', gender: 'F' },
        { memberNumber: '000005', who: 'C', gender: 'M' },
      ]),
    ],
  ])('refuses %s, rather than draw half a snapshot', (_what, body) => {
    expect(frozenTablesIn(body)).toBeNull()
  })

  it('refuses a pair whose second half is not there either', () => {
    expect(frozenTablesIn(servedWith('pairs', 0, 'halves', []))).toBeNull()
  })

  it('reads a pair of exactly two', () => {
    expect(frozenTablesIn(servedWith('pairs', 0, 'halves', [
      { memberNumber: null, who: null, gender: 'M' },
      { memberNumber: '000003', who: 'B', gender: 'F' },
    ]))?.pairs[0]?.halves[0]?.who).toBeNull()
  })
})

describe('the category a code names', () => {
  it('is the band, the beginners, or nothing for a code that is neither', () => {
    expect(categoryOfTheCode('M40-54', 2027)).toEqual({ season: 2027, ageBand: '40-54', beginner: false })
    expect(categoryOfTheCode('Ž R', 2027)).toEqual({ season: 2027, ageBand: '24-', beginner: true })
    expect(categoryOfTheCode('M99-100', 2027)).toBeNull()
  })
})

describe('the record a member of a frozen row is drawn with', () => {
  it('is his own where the portal still serves him, under the name and the category the freeze wrote', () => {
    const drawn = standIn({ memberNumber: '000001', who: 'Vladan Đurišić', gender: 'M' }, A_MEMBER, 2027, 'M40-54', '<x>')

    expect([drawn.firstName, drawn.lastName, drawn.photo, drawn.chosenCategory]).toEqual([
      'Vladan',
      'Đurišić',
      'lice.jpg',
      undefined,
    ])
    expect(drawn.categories).toEqual([{ season: 2027, ageBand: '40-54', beginner: false }])
  })

  it('keeps the gender the freeze wrote where the portal serves him as the other one since', () => {
    const drawn = standIn({ memberNumber: '000001', who: 'Vladan Đurišić', gender: 'M' }, { ...A_MEMBER, gender: 'F' }, 2027, null, '<x>')

    expect(drawn.gender).toBe('M')
  })

  it('is a name and nothing of today where the portal no longer serves him', () => {
    const drawn = standIn({ memberNumber: null, who: 'Relja', gender: 'M' }, undefined, 2027, null, '<x>')

    expect([drawn.memberNumber, drawn.firstName, drawn.lastName, drawn.photo, drawn.categories]).toEqual([
      '',
      'Relja',
      '',
      null,
      [],
    ])
  })

  it('is the word for a deleted member where the freeze left no name', () => {
    expect(standIn({ memberNumber: null, who: null, gender: 'F' }, undefined, 2027, 'Ž R', '<Obrisana članica>').firstName).toBe(
      '<Obrisana',
    )
  })

  it('finds him among the members served only by his number', () => {
    const live = new Map([['000001', A_MEMBER]])

    expect(theLiveOne({ memberNumber: '000001', who: 'X', gender: 'M' }, live)).toBe(A_MEMBER)
    expect(theLiveOne({ memberNumber: null, who: 'Danasnje Ime', gender: 'M' }, live)).toBeUndefined()
  })
})

describe("a member's trophies in a frozen season", () => {
  it('are the rows the freeze wrote for him, every kind, and nobody else’s', () => {
    const tables = must(frozenTablesIn(SERVED), 'the served tables')

    expect(frozenAwardsOf([tables], '000001')).toEqual([
      { season: 2027, kind: 'category', category: 'M40-54', position: 1, points: 412.5 },
      { season: 2027, kind: 'overall', category: '', position: 1, points: 412.5 },
      { season: 2027, kind: 'pair', category: '', position: 1, points: 160.4 },
      { season: 2027, kind: 'team', category: '', position: 1, points: 800.7, team: 'Dunavski trkači' },
    ])
  })

  it('refuse a kind the page does not draw, rather than draw it as another', () => {
    const tables = must(frozenTablesIn(servedWith('awards', 5, 'kind', 'figure')), 'the tables with a figure')

    expect(() => frozenAwardsOf([tables], '000001')).toThrow('figure')
  })
})

describe('the list of progress after a frozen season', () => {
  const result = (id: number, date: string, points: number): Result => ({
    id,
    memberNumber: '000001',
    raceId: id,
    raceName: 'Trka',
    eventName: 'Trka',
    eventSlug: 'trka',
    date,
    distanceKm: 10,
    ascentM: 0,
    descentM: 0,
    seconds: 3000,
    points,
    category: 'short',
    inItsSeason: true,
    inItsStanding: true,
  })
  const competitor: Competitor = { ...A_MEMBER, categories: [{ season: 2028, ageBand: '25-39', beginner: false }] }

  it('measures against what the season before held at its freeze, not what its results say now', () => {
    /* The season before reads 50 off the results today (a correction after the freeze) and held 30 at its
       freeze: measured live he went backwards, measured against the freeze he gained ten. */
    const results = [result(1, '2027-05-05', 50), result(2, '2028-05-05', 40)]
    const tables = frozenTablesIn(SERVED)

    expect(topByProgress([competitor], results, 2028, 5)).toEqual([])
    expect(
      topByProgress([competitor], results, 2028, 5, new Map([['000001', 30]])).map((one) => [one.previousPoints, one.gain]),
    ).toEqual([[30, 10]])
    expect(pointsAtTheFreeze(must(tables, 'the served tables')).get('000006')).toBe(55)
  })
})
