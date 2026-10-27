import { screen, waitFor, within } from '@testing-library/react'
import { formatPoints } from '../i18n/format'
import sr from '../i18n/sr.json'
import { must } from '../test/at'
import { matchingMedia } from '../test/media'
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
    smallPhoto: null,
  }
}

let resultsMade = 700_000

/** @param inItsSeason whether a season counts it (`Result.inItsSeason`): true for a run of a member
 *  of that year, and false for a run of a year before the league, which no season counts. */
function aResult(memberNumber: string, date: string, points: number, distanceKm = 10, inItsSeason = true) {
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
    inItsSeason,
  }
}

const MEMBERS = [aMember(FIRST, 2021), aMember(SECOND, 2021), aMember(LATE, 2028)]

/** What the team did before the league, which is on no standing of it: 99 and 55 points. */
const BEFORE_THE_LEAGUE = [
  aResult(FIRST, '2026-05-01', 99, 10, false),
  aResult(FIRST, '2019-05-01', 55, 10, false),
  aResult(SECOND, '2025-05-01', 77, 10, false),
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

/**
 * THE COUNTERS READ WITH THE UNROLLING OFF, which is what makes a `not` beside them mean anything.
 *
 * `Counters` climbs every figure from nought to its target over 900 ms on `requestAnimationFrame`
 * (`home/useCountUp.ts`), so every value below the target is a frame on the way there. A wait for
 * the right figure is satisfied by a frame that merely passes through it on the way to a wrong one
 * (10 on the road to 30, 30 on the road to 70), and the `not` that follows then asks the page
 * BEFORE it has got to the wrong figure and passes too. Seen once on CI: the page read „Kilometara:
 * -13,29 km" in one such frame. With less motion asked for the figure is nought and then its target
 * and nothing between (`Home.test.tsx` reads its own counters the same way).
 *
 * @returns the way to put the media query back
 */
function withLessMotion(): () => void {
  const previous = window.matchMedia

  window.matchMedia = matchingMedia((query) => query.includes('reduced-motion'))

  return () => {
    window.matchMedia = previous
  }
}

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
    const lessMotion = withLessMotion()
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
      lessMotion()
    }
  }, SLOW)
})

describe('the page of a team, and a run of 2027 that no season counts', () => {
  /* PDL P9, 18.10.2026: a run of a year its member was no member of „ne ulazi ni u jednu sezonsku
     tabelu". The second member is in the team in 2027 and ran 20 km in it; here that run is one of a
     year he was no member of, so the team's 2027 is the first member's 10 km alone, and the ring holds
     one run. The same 2027 as the case above, so the season and the roster cannot be what differs. */
  it('leaves it out of the counters, the ring and the roster of that season', async () => {
    const lessMotion = withLessMotion()
    const { stop } = answering([
      aResult(FIRST, '2027-05-02', 10, 10),
      aResult(SECOND, '2027-05-03', 6, 20, false),
    ])

    try {
      renderAt(`/sr/tim/${ITS_ADDRESS}?sezona=2027`, 'visitor', null, undefined, '2028-06-01')

      const rows = await roster()
      const counters = screen.getByRole('region', { name: sr.profile.stats })

      await waitFor(() => {
        expect(counters).toHaveTextContent(/\b10\b/)
      }, { timeout: HALF })
      expect(counters).not.toHaveTextContent(/\b30\b/)
      expect(racesInTheRing()).toBe('Zbirno1 trka')
      expect(pointsOf(rows)).not.toContain(formatPoints(6, 'sr'))
    } finally {
      stop()
      lessMotion()
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

/**
 * THE SEASON THAT HAS NOT BEGUN, IN THE TRANSFER WINDOW (PDL, „Odgovori vlasnika 17.10.2026, uveče").
 *
 * Owner, 17.10.2026: „Strana tima u prelaznom roku nudi i sledeću sezonu, isto kao spisak Timova
 * (`transfersTakeEffect`), sa sastavom kakav će biti."
 *
 * **Three days with three jobs, never one value for them.** The day the page is READ on is the clock;
 * the day a result was run on is the date it carries (May of 2027, for all of them); and the season a
 * member joins the team from is a year (`LATE` joins from 2028, which is what a founder of a team made
 * in the window is given). A case where the reading day and the date of a result shared a value would
 * be satisfied by a page that asked either.
 *
 * **The window is 15 October to 31 December** (`inYearlyWindow`), so the days below sit on both edges
 * of it, and 1 January is the first day after it: the season that was on offer is now the running one
 * and the next one is not on offer again.
 */
describe('the page of a team, in the transfer window', () => {
  const RESULTS = [...BEFORE_THE_LEAGUE, ...IN_2027]

  it.each(['2027-11-11', '2027-11-20', '2027-12-31'])(
    'offers the season that has not begun on %s, and still opens on the running one',
    async (day) => {
      const { stop } = answering(RESULTS)

      try {
        renderAt(`/sr/tim/${ITS_ADDRESS}`, 'visitor', null, undefined, day)

        const rows = await roster()
        const select = await control()

        expect(offered(select)).toEqual(['2028', '2027'])
        /* The running one, with its own roster: the member who joins from 2028 is not on it. */
        expect(select.value).toBe('2027')
        expect(namesOf(rows)).toEqual(['Ime 000201 000201', 'Ime 000202 000202'])
        expect(pointsOf(rows)).toEqual([formatPoints(10, 'sr'), formatPoints(6, 'sr')])
      } finally {
        stop()
      }
    },
    SLOW,
  )

  it('draws the roster as it will be in the season that has not begun, and then the running one again', async () => {
    const user = setupUser()
    const { stop } = answering(RESULTS)

    try {
      renderAt(`/sr/tim/${ITS_ADDRESS}`, 'visitor', null, undefined, '2027-11-12')

      await roster()
      await user.selectOptions(await control(), '2028')

      /* Three, the founder among them, and every one on nought: nobody has run in 2028 yet. The
         2027 results (10, 6 and the 7 of the member who is not on the roster of 2027) are on none
         of these lines. */
      await waitFor(
        async () => {
          expect(namesOf(await roster())).toEqual([
            'Ime 000201 000201',
            'Ime 000202 000202',
            'Ime 000203 000203',
          ])
        },
        { timeout: HALF },
      )
      expect(pointsOf(await roster())).toEqual(Array.from({ length: 3 }, () => formatPoints(0, 'sr')))
      expect((await control()).value).toBe('2028')

      await user.selectOptions(await control(), '2027')

      await waitFor(
        async () => {
          expect(namesOf(await roster())).toEqual(['Ime 000201 000201', 'Ime 000202 000202'])
        },
        { timeout: HALF },
      )
    } finally {
      stop()
    }
  }, SLOW)

  it('opens on the season that has not begun when the address names it', async () => {
    const { stop } = answering(RESULTS)

    try {
      renderAt(`/sr/tim/${ITS_ADDRESS}?sezona=2028`, 'visitor', null, undefined, '2027-11-12')

      await roster()

      expect((await control()).value).toBe('2028')
      expect(namesOf(await roster())).toHaveLength(3)
    } finally {
      stop()
    }
  }, SLOW)
})

describe('the page of a team, outside the transfer window', () => {
  const RESULTS = [...BEFORE_THE_LEAGUE, ...IN_2027]

  /* A day of the running season, the day before the window opens, and the last day of the one before
     it, so the edges are read from both sides. */
  it.each(['2027-01-15', '2027-06-01', '2027-11-10'])(
    'offers only the running season on %s',
    async (day) => {
      const { stop } = answering(RESULTS)

      try {
        renderAt(`/sr/tim/${ITS_ADDRESS}`, 'visitor', null, undefined, day)

        await roster()
        const select = await control()

        expect(offered(select)).toEqual(['2027'])
        expect(select.value).toBe('2027')
      } finally {
        stop()
      }
    },
    SLOW,
  )

  it('holds an address that names the season that has not begun against what it offers', async () => {
    const { stop } = answering(RESULTS)

    try {
      renderAt(`/sr/tim/${ITS_ADDRESS}?sezona=2028`, 'visitor', null, undefined, '2027-06-01')

      const rows = await roster()

      expect((await control()).value).toBe('2027')
      expect(namesOf(rows)).toEqual(['Ime 000201 000201', 'Ime 000202 000202'])
    } finally {
      stop()
    }
  }, SLOW)

  it('on the first day after the window, has the season that was next as the running one and offers no further', async () => {
    const { stop } = answering(RESULTS)

    try {
      renderAt(`/sr/tim/${ITS_ADDRESS}`, 'visitor', null, undefined, '2028-01-01')

      const rows = await roster()
      const select = await control()

      expect(select.value).toBe('2028')
      expect(offered(select)).toEqual(['2028', '2027'])
      /* The founder who joined from 2028 is on the running roster now. */
      expect(rows).toHaveLength(3)
    } finally {
      stop()
    }
  }, SLOW)
})

describe('the page of a team, in the transfer window before the league has a season', () => {
  /* The season a transfer takes effect in is never earlier than the first (`transfersTakeEffect`), and
     the one shown is the first as well, so there is nothing further to offer. Two days of two kinds:
     one of 2026, where "the running one plus one" would be 2028, and one of 2025, where "the year plus
     one" would be 2026, a season the league does not have. */
  it.each(['2026-11-01', '2025-11-01'])('offers 2027 and nothing else on %s', async (day) => {
    const { stop } = answering(BEFORE_THE_LEAGUE)

    try {
      renderAt(`/sr/tim/${ITS_ADDRESS}`, 'visitor', null, undefined, day)

      await roster()
      const select = await control()

      expect(offered(select)).toEqual(['2027'])
      expect(select.value).toBe('2027')
    } finally {
      stop()
    }
  }, SLOW)
})
