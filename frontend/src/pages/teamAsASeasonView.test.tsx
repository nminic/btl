import { screen, waitFor, within } from '@testing-library/react'
import { formatPoints } from '../i18n/format'
import sr from '../i18n/sr.json'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { serverThat } from '../test/serverAnswers'
import { SLOW } from '../test/slow'
import { aCompetitor, aTeam } from '../test/theAnswer'
import { setupUser } from '../test/user'

/**
 * THE PAGE OF A TEAM IS A SEASON VIEW, THE SAME ONE AS THE LIST OF TEAMS (PDL, „Odgovori vlasnika
 * 17.10.2026 na pitanja posle izvođenja").
 *
 * Owner, 17.10.2026: „Strana tima je sezonski prikaz kao spisak Timova: otvara tekuću sezonu (najmanje
 * 2027) i ne nudi sezone pre 2027." And 16.10.2026: „Prva sezona je 2027, pa su samim tim svi brojači
 * na nuli, a i sve su statistike prazne jer nema trka u 2027. godini."
 *
 * **Every figure on the page is of the season shown**: the counters, the ring of lengths and the
 * roster. They are read here off a team of three whose members raced in seasons on both sides of the
 * league's first, on answers written case by case (`test/serverAnswers.ts`), because the generated
 * files hold the imported history and a roster that is the same in every season.
 *
 * **Two kinds of day, and never one constant for both.** The day the page is READ on is the clock
 * (`renderAt`'s `today`); the day a result was run on is the date it carries. A case where the two
 * share a value is satisfied by a page that asks either, so the cases keep them apart: results are
 * dated in May and the page is read in June, December or January.
 */

const THE_TEAM = 51
const ITS_ADDRESS = 'sezonski-tim'
const ITS_NAME = 'Sezonski tim'

/** In the team since 2021, so in it for every season of the league. */
const FIRST = '000201'
const SECOND = '000202'
/** In the team from 2028 only, so out of the roster of 2027. */
const LATE = '000203'

/** The ring's own caption, read from the dictionary so a rename is followed and not failed on. */
const THE_RING = sr.profile.byCategory

function aMember(memberNumber: string, since: number) {
  return {
    ...aCompetitor,
    memberNumber,
    firstName: 'Ime',
    lastName: memberNumber,
    teamId: THE_TEAM,
    teamSince: since,
    photo: null,
    crop: null,
  }
}

let resultsMade = 700_000

function aResult(memberNumber: string, date: string, points: number, distanceKm = 10) {
  resultsMade += 1

  return {
    id: resultsMade,
    memberNumber,
    raceId: 275,
    raceName: 'Trka',
    eventName: 'Trka',
    eventSlug: 'trka',
    date,
    distanceKm,
    ascentM: 100,
    descentM: 100,
    seconds: 3000,
    points,
    category: 'short',
  }
}

const MEMBERS = [aMember(FIRST, 2021), aMember(SECOND, 2021), aMember(LATE, 2028)]

/** What the team did before the league, which is on no standing of it: 99 and 55 points. */
const BEFORE_THE_LEAGUE = [
  aResult(FIRST, '2026-05-01', 99),
  aResult(FIRST, '2019-05-01', 55),
  aResult(SECOND, '2025-05-01', 77),
]

/** What it did in the first season: two members who are in the team then, and the one who is not. */
const IN_2027 = [
  aResult(FIRST, '2027-05-02', 10, 10),
  aResult(SECOND, '2027-05-03', 6, 20),
  aResult(LATE, '2027-05-04', 7, 40),
]

function answering(results: unknown[], members: unknown[] = MEMBERS) {
  const answers = new Map<string, unknown[]>([
    ['/api/competitors', members],
    ['/api/teams', [{ ...aTeam, id: THE_TEAM, slug: ITS_ADDRESS, name: ITS_NAME, organizerMemberNumber: undefined, alsoInTheTeam: [] }]],
    ['/api/results', results],
  ])

  return serverThat((path) => {
    const answer = answers.get(path)

    return answer === undefined
      ? null
      : new Response(JSON.stringify(answer), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
  })
}

const HALF = SLOW / 2

/** The rows of the roster, by the name each carries. */
async function roster(): Promise<HTMLElement[]> {
  const table = await screen.findByRole('table', { name: 'Članovi' }, { timeout: HALF })

  return within(table).getAllByRole('row').slice(1)
}

function pointsOf(rows: HTMLElement[]): string[] {
  return rows.map((row) => must(within(row).getAllByRole('cell').at(-1), 'points').textContent ?? '')
}

function namesOf(rows: HTMLElement[]): string[] {
  return rows.map((row) => within(row).getAllByRole('cell')[1]?.textContent ?? '')
}

async function control(): Promise<HTMLSelectElement> {
  const found = await screen.findByLabelText('Sezona', {}, { timeout: HALF })

  if (!(found instanceof HTMLSelectElement)) {
    throw new Error('the season control is not a select')
  }

  return found
}

function offered(select: HTMLSelectElement): string[] {
  return within(select)
    .getAllByRole('option')
    .map((one) => one.textContent ?? '')
}

/** The figure the ring's hidden table gives for the whole of what it draws. */
function racesInTheRing(): string {
  const table = screen.getByRole('table', { name: THE_RING })

  return must(within(table).getAllByRole('row').at(-1), 'the total row').textContent ?? ''
}

describe('the page of a team, before the league has a season', () => {
  /* The three days are the three kinds the owner's sentence covers: a day of 2026, the last day of
     2026, and the first day of the league, none of which has a result of its own in it. */
  it.each(['2026-06-01', '2026-12-31', '2027-01-01'])(
    'opens on 2027, empty, on %s, although the team raced before it',
    async (day) => {
      const { stop } = answering(BEFORE_THE_LEAGUE)

      try {
        renderAt(`/sr/tim/${ITS_ADDRESS}`, 'visitor', null, undefined, day)

        const rows = await roster()
        const select = await control()

        expect(select.value).toBe('2027')
        /* Nothing before the first season is on offer, and the seasons the team raced in are
           exactly what would have been. */
        expect(offered(select)).toEqual(['2027'])
        /* Two in the team in 2027, each on nought: the 99, the 55 and the 77 are on no standing. */
        expect(namesOf(rows)).toEqual(['Ime 000201 000201', 'Ime 000202 000202'])
        expect(pointsOf(rows)).toEqual([formatPoints(0, 'sr'), formatPoints(0, 'sr')])
        expect(screen.queryByText(formatPoints(99, 'sr'))).toBeNull()
      } finally {
        stop()
      }
    },
    SLOW,
  )
})

describe('the page of a team, in 2027 and after', () => {
  it('is empty in 2027 when nobody has raced in it yet', async () => {
    const { stop } = answering(BEFORE_THE_LEAGUE)

    try {
      renderAt(`/sr/tim/${ITS_ADDRESS}`, 'visitor', null, undefined, '2027-06-01')

      const rows = await roster()

      expect(pointsOf(rows)).toEqual([formatPoints(0, 'sr'), formatPoints(0, 'sr')])
      expect((await control()).value).toBe('2027')
    } finally {
      stop()
    }
  }, SLOW)

  it('is empty in 2028 with a full 2027 one choice away', async () => {
    const user = setupUser()
    const { stop } = answering([...BEFORE_THE_LEAGUE, ...IN_2027])

    try {
      renderAt(`/sr/tim/${ITS_ADDRESS}`, 'visitor', null, undefined, '2028-06-01')

      const rows = await roster()
      const select = await control()

      expect(select.value).toBe('2028')
      expect(offered(select)).toEqual(['2028', '2027'])
      /* Three in the team in 2028, the late one among them, and every one of them on nought. */
      expect(rows).toHaveLength(3)
      expect(pointsOf(rows)).toEqual(Array.from({ length: 3 }, () => formatPoints(0, 'sr')))

      await user.selectOptions(select, '2027')

      /* And 2027 is the full one: the member who was not yet in the team is not on its roster,
         and the 7 he ran that year is on nobody's line of it. */
      await waitFor(
        async () => {
          expect(pointsOf(await roster())).toEqual([formatPoints(10, 'sr'), formatPoints(6, 'sr')])
        },
        { timeout: HALF },
      )
      expect(namesOf(await roster())).toEqual(['Ime 000201 000201', 'Ime 000202 000202'])
    } finally {
      stop()
    }
  }, SLOW)

  it('draws the counters, the ring and the roster of the season shown, and of no other', async () => {
    const { stop } = answering([...BEFORE_THE_LEAGUE, ...IN_2027])

    try {
      /* Read in 2028 with 2027 named in the address, so the season shown is not the running one and
         not the one the history ends on. */
      renderAt(`/sr/tim/${ITS_ADDRESS}?sezona=2027`, 'visitor', null, undefined, '2028-06-01')

      await roster()
      const counters = screen.getByRole('region', { name: sr.profile.stats })

      /* 30 kilometres: the two in the team ran 10 and 20 in 2027; the 40 of the member who was not
         yet in it, and the 10 of 2026, are not here. */
      await waitFor(() => {
        expect(counters).toHaveTextContent(/\b30\b/)
      }, { timeout: HALF })
      expect(counters).not.toHaveTextContent(/\b70\b/)
      /* The ring counts the same two results, and not the three of 2027 nor the five of the team's
         whole history. */
      expect(racesInTheRing()).toBe('Zbirno2 trke')
    } finally {
      stop()
    }
  }, SLOW)
})

describe('the page of a team, when the address names a season before the league', () => {
  /* A link from before 17.10.2026. The control cannot name 2019, so the page is that of the season it
     does open on, and nothing run in 2019 is drawn under any heading. */
  it.each([
    ['2026-06-01', '2027'],
    ['2028-06-01', '2028'],
  ])('on %s opens on %s, and the 55 points of 2019 are nowhere', async (day, opens) => {
    const { stop } = answering(BEFORE_THE_LEAGUE)

    try {
      renderAt(`/sr/tim/${ITS_ADDRESS}?sezona=2019`, 'visitor', null, undefined, day)

      const rows = await roster()
      const select = await control()

      expect(select.value).toBe(opens)
      expect(offered(select)).not.toContain('2019')
      expect(pointsOf(rows).every((one) => one === formatPoints(0, 'sr'))).toBe(true)
      expect(screen.queryByText(formatPoints(55, 'sr'))).toBeNull()
    } finally {
      stop()
    }
  }, SLOW)
})

describe('the page of a team that nobody was in yet', () => {
  /* Two different silences: a team nobody has ever joined, and a team that existed but had nobody in it
     that season. The only member joins in 2028, so the page opened on 2027 has an empty roster and
     the team has a member. */
  it('says it had nobody that season, which is not the same as never having anybody', async () => {
    const { stop } = answering([], [aMember(LATE, 2028)])

    try {
      renderAt(`/sr/tim/${ITS_ADDRESS}`, 'visitor', null, undefined, '2026-06-01')

      expect(await screen.findByText('Ovaj tim te sezone nije imao članova.', {}, { timeout: HALF })).toBeVisible()
      expect(screen.queryByText('Ovaj tim još nema članova.')).not.toBeInTheDocument()
      expect((await control()).value).toBe('2027')
    } finally {
      stop()
    }
  }, SLOW)
})
