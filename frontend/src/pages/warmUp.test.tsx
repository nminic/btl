import { configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import competitorsFile from '../test/mock/competitors.json'
import resultsFile from '../test/mock/results.json'
import { formatNumber } from '../i18n/format'
import { must, selectElement } from '../test/at'
import { matchingMedia } from '../test/media'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'

/* PDL, 12.11.2026 („Zagrevanje: istorijski prikaz pre prve sezone"), owner: „Da dodaš default predsezonsku
   sezonu na Top Listama", „Neka se i na Top Listama zove Zagrevanje", „Samo top liste, ali i widgeti na
   naslovnoj strani gore desno (umesto Sezona 2027. treba da se zove zagrevanje) i ovaj rotirajući widget po
   dužini trke", counted from every result up to now, and „neće ponavljati nakon 1.1.2027".

   **Read against the history as it is served** (2010 to 2026, nothing in 2027), and not moved forward into
   league seasons as the other cases of these screens are (`test/leagueSeasons.ts`): the warm-up is exactly
   that history. What a case expects is worked out here from the files, by plain arithmetic, and never by the
   functions the screens draw with. Two days apart, the last before the first season and its first. */

const BEFORE = '2026-12-31'
const FIRST_DAY = '2027-01-01'

type Row = { memberNumber: string | null; date: string; distanceKm: number; category: string }
type Person = { memberNumber: string; firstName: string; lastName: string }

const ROWS: Row[] = resultsFile
const PEOPLE: Person[] = competitorsFile
const KNOWN = new Set(PEOPLE.map((one) => one.memberNumber))
const HISTORY = ROWS.filter((one) => Number(one.date.slice(0, 4)) < 2027)

function personOf(memberNumber: string): Person {
  return must(PEOPLE.find((person) => person.memberNumber === memberNumber), memberNumber)
}

function nameOf(memberNumber: string): string {
  const one = personOf(memberNumber)

  return `${one.firstName} ${one.lastName}`
}

/** The member who leads on a sum over the history, and the sum, held to be alone at the top so that the
 *  case reads one name and not the order of a tie. */
function leaderOf(measure: (row: Row) => number): { memberNumber: string; total: number } {
  const totals = new Map<string, number>()

  for (const row of HISTORY) {
    if (row.memberNumber !== null && KNOWN.has(row.memberNumber)) {
      totals.set(row.memberNumber, (totals.get(row.memberNumber) ?? 0) + measure(row))
    }
  }

  const [first, second] = [...totals].sort((left, right) => right[1] - left[1])
  const top = must(first, 'a leader')

  expect(top[1], 'the history has a tie at the top').toBeGreaterThan(must(second, 'a second')[1])

  return { memberNumber: top[0], total: top[1] }
}

/* In hundredths, so a sum of figures of two decimals is exact. */
const KILOMETRES = leaderOf((row) => Math.round(row.distanceKm * 100))
const SHORT = leaderOf((row) => (row.category === 'short' ? 1 : 0))

/** What the same member ran in one year of it, to tell „every year" from „the last one". */
const HIS_LAST_YEAR = HISTORY.filter(
  (row) => row.memberNumber === KILOMETRES.memberNumber && row.date.startsWith('2026'),
).reduce((sum, row) => sum + Math.round(row.distanceKm * 100), 0)

function board(name: string) {
  return within(screen.getByRole('region', { name }))
}

let waits = getConfig().asyncUtilTimeout

beforeEach(() => {
  waits = getConfig().asyncUtilTimeout
  configure({ asyncUtilTimeout: SLOW / 2 })
})

afterEach(() => {
  configure({ asyncUtilTimeout: waits })
})

describe('the Top lists, before and from the first season', () => {
  it('open on the warm-up the day before, and every board counts all the history', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/top-liste', 'visitor', null, undefined, BEFORE)

    const season = selectElement(await screen.findByLabelText('Sezona'))

    expect(season.value).toBe('zagrevanje')
    expect(within(season).getByRole('option', { selected: true })).toHaveTextContent('Zagrevanje')
    expect(within(season).getAllByRole('option').map((one) => one.textContent)).toEqual(['2027', 'Zagrevanje'])
    expect(router.state.location.search).toBe('')

    /* The leader of all the years together, with all of them summed: not the leader of 2026 alone. */
    expect(HIS_LAST_YEAR).not.toBe(KILOMETRES.total)
    const leader = must(board('Najviše kilometara').getAllByRole('row')[1], 'the first place')
    expect(leader).toHaveTextContent(personOf(KILOMETRES.memberNumber).lastName)
    expect(leader).toHaveTextContent(formatNumber(KILOMETRES.total / 100, 'sr', 2))

    /* The board of progress has no season before it to grow from, and says so in its own words; and the
       pairs of the history are of 2019, none of the first season, so that board says it in its own. */
    expect(board('Najbolji napredak').getByText('U zagrevanju se napredak ne meri.')).toBeVisible()
    expect(
      board('Najbolji trkački parovi').getByText('U zagrevanju nijedan trkački par nema zajedničku trku.'),
    ).toBeVisible()

    /* And 2027 is a season of its own, which holds none of it. */
    await user.selectOptions(season, '2027')
    expect(router.state.location.search).toBe('?sezona=2027')
    expect(board('Najviše kilometara').getByText('U ovoj sezoni nema nijednog rezultata.')).toBeVisible()

    await user.selectOptions(season, 'zagrevanje')
    expect(router.state.location.search).toBe('')
    expect(board('Najviše kilometara').getAllByRole('row').length).toBeGreaterThan(1)
  }, SLOW)

  it('say in the words of the warm-up that it is empty, when it is', async () => {
    const served = globalThis.fetch

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input) === '/api/results'
        ? new Response('[]', { headers: { 'content-type': 'application/json' } })
        : served(input, init),
    )

    try {
      renderAt('/sr/top-liste', 'visitor', null, undefined, BEFORE)

      await screen.findByLabelText('Sezona')
      expect(board('Najviše kilometara').getByText('U zagrevanju nema nijednog rezultata.')).toBeVisible()
      expect(board('Najviše kilometara').queryByText('U ovoj sezoni nema nijednog rezultata.')).not.toBeInTheDocument()
    } finally {
      vi.stubGlobal('fetch', served)
    }
  }, SLOW)

  it('have no warm-up from the first day of the season, and an address naming it falls back', async () => {
    renderAt('/sr/top-liste?sezona=zagrevanje', 'visitor', null, undefined, FIRST_DAY)

    const season = selectElement(await screen.findByLabelText('Sezona'))

    expect(season.value).toBe('2027')
    expect(within(season).queryByRole('option', { name: 'Zagrevanje' })).not.toBeInTheDocument()
    expect(board('Najviše kilometara').getByText('U ovoj sezoni nema nijednog rezultata.')).toBeVisible()
    expect(board('Najbolji napredak').queryByText('U zagrevanju se napredak ne meri.')).not.toBeInTheDocument()
  }, SLOW)
})

describe('the front page, before and from the first season', () => {
  let previous = window.matchMedia

  beforeEach(() => {
    previous = window.matchMedia
    /* With less motion asked for, so the counters stand on their targets and the chart does not turn. */
    window.matchMedia = matchingMedia((query) => query.includes('reduced-motion'))
  })

  afterEach(() => {
    window.matchMedia = previous
  })

  function rowOf(label: string): string {
    return must(screen.getByText(label, { exact: false }).parentElement?.textContent, label).trim()
  }

  it('calls the counters at the top of the right column the warm-up, and counts all the history in them', async () => {
    renderAt('/sr', 'visitor', null, undefined, BEFORE)

    expect(await screen.findByRole('heading', { level: 2, name: 'Zagrevanje' })).toBeVisible()
    expect(screen.queryByRole('heading', { level: 2, name: /^Sezona/ })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(rowOf('Prijavljenih rezultata:')).toBe(`Prijavljenih rezultata: ${String(HISTORY.length)} rezultata`)
    })
  }, SLOW)

  it('calls them the season from its first day, at nought', async () => {
    renderAt('/sr', 'visitor', null, undefined, FIRST_DAY)

    expect(await screen.findByRole('heading', { level: 2, name: 'Sezona 2027.' })).toBeVisible()
    expect(screen.queryByRole('heading', { level: 2, name: 'Zagrevanje' })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(rowOf('Članova lige:')).toMatch(/[1-9]/)
    })
    expect(rowOf('Prijavljenih rezultata:')).toBe('Prijavljenih rezultata: 0 rezultata')
  }, SLOW)

  it('turns the chart by length over all the history before, and over the season from its first day', async () => {
    const before = renderAt('/sr', 'visitor', null, undefined, BEFORE)
    const chart = await screen.findByRole('region', { name: 'Najviše trka po distanci' })

    expect(within(chart).getByText('Najviše kraćih trka')).toBeVisible()
    const tallest = must(within(chart).getAllByRole('listitem')[0], 'the tallest bar')

    expect(within(tallest).getByRole('link')).toHaveAccessibleName(expect.stringContaining(nameOf(SHORT.memberNumber)))
    expect(tallest).toHaveTextContent(String(SHORT.total))
    /* A profile opens on all the years by default, which is the warm-up, so the bar names the length alone. */
    expect(within(tallest).getByRole('link').getAttribute('href')).toMatch(/\?duzina=short$/)
    before.unmount()

    renderAt('/sr', 'visitor', null, undefined, FIRST_DAY)

    const empty = await screen.findByRole('region', { name: 'Najviše trka po distanci' })
    expect(within(empty).getByText('U ovoj sezoni još nema istrčanih trka ove distance.')).toBeVisible()
  }, SLOW)

  it('says in the words of the warm-up that its chart is empty, when it is', async () => {
    const served = globalThis.fetch

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input) === '/api/results'
        ? new Response('[]', { headers: { 'content-type': 'application/json' } })
        : served(input, init),
    )

    try {
      renderAt('/sr', 'visitor', null, undefined, BEFORE)

      const chart = await screen.findByRole('region', { name: 'Najviše trka po distanci' })
      expect(within(chart).getByText('U zagrevanju nema trka ove distance.')).toBeVisible()
    } finally {
      vi.stubGlobal('fetch', served)
    }
  }, SLOW)
})
