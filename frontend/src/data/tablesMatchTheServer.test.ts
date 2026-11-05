import { describe, expect, it } from 'vitest'
import SEASON from './tablesBothSidesWrite.json'
import {
  CATEGORIES,
  bestSingleRaces,
  rankingFor,
  rankMembers,
  rankTeams,
  standingSeasonOf,
  standsIn,
  topByCategory,
  topByKilometers,
  topByProgress,
  topByTimeOnCourse,
  topPairs,
  numbered,
} from './derive'
import { AGE_BANDS, categoryCodeFor, type AgeBand } from './categories'
import { leagueGroups, leagueTable } from '../pages/league/leagueTable'
import type {
  BtlEvent,
  Competitor,
  Gender,
  League,
  Race,
  RaceCategory,
  RacingPair,
  Result,
  Team,
} from './types'

/**
 * THE TABLES A FROZEN SEASON WRITES DOWN ARE THE TABLES THIS PORTAL DRAWS, AND THE TWO MEET ON ONE FILE.
 *
 * The owner, 31.07.2026: „Zamrznuta sezona je materijalizovan zapis, ne izračun." The screens order a
 * running season with `derive.ts` and `leagueTable.ts`; at 16:00 on 1 January the server orders the
 * season that ended with its own copy of the same ladders (`SeasonTables.java`) and writes the result
 * down. Neither can read the other, so `tablesBothSidesWrite.json` holds one season of runs and the
 * order every table comes out in: `SeasonTablesTest` requires the server to give exactly that, and this
 * requires the screen's functions to. Edited to suit one side, the file fails on the other. The shape
 * is the payment slip's (`ipsSlipBothSidesWrite.json`).
 *
 * The file is built so every rung of every ladder decides at least one place against the rung after it
 * (the header of `SeasonTables.java` names what it cannot hold). The members the server reads are the
 * ones who hold the season with the right to rank; the screen is handed the same people, those without
 * the right as members with no category of the season and runs its standings do not count.
 */

type Fixture = typeof SEASON

const LIMITLESS = Number.MAX_SAFE_INTEGER

/** What the file says, read as the portal's own type, or the case stops on the line that is wrong. */
function gender(text: string): Gender {
  if (text === 'M' || text === 'F') {
    return text
  }

  throw new Error(`no gender ${text}`)
}

function band(text: string): AgeBand {
  const found = AGE_BANDS.find((one) => one === text)

  if (found === undefined) {
    throw new Error(`no band ${text}`)
  }

  return found
}

function length(text: string): RaceCategory {
  const found = CATEGORIES.find((one) => one === text)

  if (found === undefined) {
    throw new Error(`no length ${text}`)
  }

  return found
}

function given<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key)

  if (value === undefined) {
    throw new Error(`the file names ${String(key)} and does not hold it`)
  }

  return value
}

function inputs(season: Fixture) {
  const races = new Map(season.races.map((one) => [one.id, one]))
  const days = new Map(season.events.map((one) => [one.id, one.date]))
  const teamOf = new Map(season.teams.flatMap((team) => team.roster.map((id) => [id, team.id] as const)))

  const competitors: Competitor[] = season.members.map((one) => ({
    memberNumber: one.number,
    firstName: 'Ime',
    lastName: one.number,
    gender: gender(one.gender),
    city: 'Beograd',
    country: 'RS',
    category: null,
    categories: one.ranks
      ? [{ season: season.season, ageBand: band(one.ageBand), beginner: one.beginner }]
      : [],
    firstSeason: 2027,
    membershipBasis: 'payment',
    teamId: teamOf.get(one.id) ?? null,
    teamSince: teamOf.has(one.id) ? season.season : null,
    profileHidden: false,
    birthdayShown: 'none',
    photo: null,
    smallPhoto: null,
    crop: null,
    bio: '',
  }))

  const numberOf = new Map(season.members.map((one) => [one.id, one.number]))

  const result = (id: number, member: number, race: number, date: string, points: number, rest: Partial<Result>) => {
    const theRace = given(races, race)

    return {
      id,
      memberNumber: given(numberOf, member),
      raceId: race,
      raceName: theRace.name,
      eventName: theRace.name,
      eventSlug: String(theRace.event),
      date,
      distanceKm: Number(theRace.kilometers),
      ascentM: 0,
      descentM: 0,
      seconds: 0,
      points,
      category: length(theRace.length),
      inItsSeason: true,
      inItsStanding: true,
      ...rest,
    } satisfies Result
  }

  const results: Result[] = [
    ...season.runs.map((one) =>
      result(one.id, one.member, one.race, one.date, Number(one.points), {
        ascentM: one.ascent,
        descentM: one.descent,
        seconds: one.seconds,
        inItsStanding: one.standing,
      }),
    ),
    /* What each member held in the season before, as one run of it; the server is handed the sum. */
    ...Object.entries(season.before).map(([member, points], index) =>
      result(-1 - index, Number(member), 999, given(days, 99), Number(points), { inItsStanding: false }),
    ),
  ]

  const teams: Team[] = season.teams.map((one) => ({
    id: one.id,
    slug: `tim-${one.id}`,
    name: one.name,
    city: 'Beograd',
    country: 'RS',
    bio: '',
    logo: null,
    crop: null,
    smallLogo: null,
    alsoInTheTeam: [],
  }))

  const pairs: RacingPair[] = season.pairs.map((one) => ({
    id: one.id,
    season: season.season,
    memberNumbers: [given(numberOf, one.man), given(numberOf, one.woman)],
  }))

  const events: BtlEvent[] = season.events.map((one) => ({
    id: one.id,
    slug: String(one.id),
    name: one.name,
    date: one.date,
    city: 'Beograd',
    country: 'RS',
    kind: 'race',
    featured: false,
    description: '',
    link: '',
    copiedFrom: null,
  }))

  const allRaces: Race[] = season.races.map((one) => ({
    id: one.id,
    eventId: one.event,
    name: one.name,
    renamed: false,
    date: given(days, one.event),
    kind: 'length',
    limitSeconds: 0,
    distanceKm: Number(one.kilometers),
    ascentM: 0,
    descentM: 0,
    category: length(one.length),
    dots: [],
  }))

  const leagues: League[] = season.leagues.map((one) => ({
    id: one.id,
    slug: `liga-${one.id}`,
    name: one.name,
    season: season.season,
    raceIds: one.races,
    eventIds: [],
    rules: '',
    prizes: '',
  }))

  return { competitors, results, teams, pairs, events, allRaces, leagues }
}

/** Every table of the season, as the screens order it. */
function tables(season: Fixture) {
  const { competitors, results, teams, pairs, events, allRaces, leagues } = inputs(season)
  const year = season.season
  const numbers = (rows: { competitor: Competitor }[]) => rows.map((row) => row.competitor.memberNumber)
  const codes = [
    ...new Set(
      competitors.flatMap((one) =>
        one.categories.map((category) => categoryCodeFor(one.gender, category.ageBand, category.beginner)),
      ),
    ),
  ].sort()

  const ofTheSeason = results.filter((one) => standingSeasonOf(one) === year)

  return {
    standing: Object.fromEntries(
      (['M', 'F'] as const).map((gender) => [gender, numbers(rankingFor(competitors, results, { season: year, gender }))]),
    ),
    category: Object.fromEntries(
      codes.map((code) => {
        const ofThe: Gender = code.startsWith('M') ? 'M' : 'F'

        return [code, numbers(rankingFor(competitors, results, { season: year, gender: ofThe, categoryCode: code }))]
      }),
    ),
    teams: rankTeams(teams, competitors, results, year).map((row) => row.team.id),
    teamPages: Object.fromEntries(
      teams.map((team) => {
        /* `TeamDetail.tsx`: the roster of the season, those who stand in it, their runs of it. */
        const roster = competitors.filter((one) => one.teamId === team.id && standsIn(one, year))
        const mine = new Set(roster.map((one) => one.memberNumber))

        return [
          String(team.id),
          numbers(rankMembers(roster, numbered(ofTheSeason).filter((one) => mine.has(one.memberNumber)))),
        ]
      }),
    ),
    byLength: Object.fromEntries(
      CATEGORIES.map((one) => [one, numbers(topByCategory(competitors, results, year, one, LIMITLESS))]),
    ),
    kilometers: numbers(topByKilometers(competitors, results, year, LIMITLESS)),
    timeOnCourse: numbers(topByTimeOnCourse(competitors, results, year, LIMITLESS)),
    progress: numbers(topByProgress(competitors, results, year, LIMITLESS)),
    bestRaces: bestSingleRaces(competitors, results, year, LIMITLESS).map((row) => row.result.id),
    pairs: topPairs(pairs, competitors, results, year, LIMITLESS).map((row) => [
      row.pair.id,
      row.competitors[0].memberNumber,
    ]),
    leagues: Object.fromEntries(
      leagues.map((league) => {
        const table = leagueTable(league, events, allRaces, results, competitors)

        return [
          String(league.id),
          {
            columns: table.columns.map((column) => column.eventId),
            ...Object.fromEntries(
              leagueGroups(table.rows).map((group) => [
                group.code === 'M' ? 'M' : 'F',
                group.rows.map((row) => row.competitor.memberNumber),
              ]),
            ),
          },
        ]
      }),
    ),
  }
}

describe('the tables a frozen season writes down', () => {
  it('come out of the screen in the order the server writes them', () => {
    expect(tables(SEASON)).toEqual(SEASON.expected)
  })

  it('and every rung of the file decides somewhere, or a ladder could lose one and still match', () => {
    /* The file's own floor: a table the file leaves empty, or a list of one, measures no ladder. */
    const drawn = tables(SEASON)

    for (const list of [
      drawn.standing.M,
      drawn.standing.F,
      drawn.teams,
      drawn.kilometers,
      drawn.timeOnCourse,
      drawn.progress,
      drawn.bestRaces,
      drawn.pairs,
      drawn.byLength.short,
    ]) {
      expect(list?.length ?? 0).toBeGreaterThan(1)
    }
  })
})
