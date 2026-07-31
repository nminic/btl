import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { awardsOf } from './awards'
import { shortBio } from './bio'

/* The parts of the profile that a screen alone cannot show: the cut on a long
 * biography, the awards of somebody who has won nothing, and the one piece of
 * layout jsdom refuses to compute. */

describe('the biography, cut to fit beside the widgets', () => {
  it('leaves a short one alone', () => {
    expect(shortBio('Trčim zbog druženja.')).toBe('Trčim zbog druženja.')
  })

  it('cuts a long one at a word, never in the middle of one', () => {
    const long = `${'reč '.repeat(200)}kraj`
    const cut = shortBio(long)

    expect(cut.length).toBeLessThanOrEqual(361)
    expect(cut.endsWith('…')).toBe(true)
    // The character before the ellipsis is the end of a word, not half of one.
    expect(cut.slice(-2, -1)).not.toBe(' ')
    expect(long.startsWith(cut.slice(0, -1))).toBe(true)
  })

  it('cuts one long word rather than refusing to cut', () => {
    // Nothing on the portal writes like this; a row that arrives from somewhere
    // else might, and the layout still has to survive it.
    const wall = 'a'.repeat(900)

    expect(shortBio(wall)).toHaveLength(361)
  })

  it('now cuts a biography that used to fit', () => {
    /* The limit came down from six hundred to three hundred and sixty when the
       widget beside it lost its heading and a row (owner, 31.07.2026). A text
       right on the old limit must now be cut, or the card grows past the two it
       stands beside and the row of three stops being a row. */
    const wasFine = 'reč '.repeat(150).trim()

    expect(wasFine.length).toBeGreaterThan(361)
    expect(shortBio(wasFine).endsWith('…')).toBe(true)
  })
})

describe('what a competitor has won', () => {
  it('says so plainly where they have won nothing', async () => {
    // 000031 has never raced, so no board has ever had them on it.
    renderAt('/sr/takmicar/000031/priznanja')

    /* Named for what the screen actually holds. P16 also gives a medal for
       twelve points and figures for the boards of Article 25, and neither is
       here yet, so "no award at all" would have been a claim the screen cannot
       make. */
    expect(await screen.findByText('Ovaj takmičar još nema nijedan pehar ni plaketu.')).toBeVisible()
    expect(screen.getByText('Još nijedna značka.')).toBeVisible()
  })

  it('lists the seasons a place was taken in, newest first', async () => {
    renderAt('/sr/takmicar/000001/priznanja')

    const table = await screen.findByRole('table', { name: 'Pehari i plakete' })
    const seasons = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => Number(within(row).getAllByRole('cell')[0].textContent))

    expect(seasons.length).toBeGreaterThan(0)
    expect([...seasons].sort((left, right) => right - left)).toEqual(seasons)
  })

  it('is not there at all for a member who is no longer active', async () => {
    renderAt('/sr/takmicar/000032/priznanja')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovog takmičara nema.' }),
    ).toBeVisible()
  })
})

describe('clearing the filters', () => {
  it('puts the reader back on the season the profile opens on', async () => {
    const user = setupUser()
    renderAt('/sr/takmicar/000007?sezona=2010&duzina=marathon')

    expect(await screen.findByText(/nema nijednog rezultata/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Poništi filtere' }))

    expect(screen.getByRole('table', { name: 'Rezultati' })).toBeVisible()
    // The length is a row of six now, and the one that is on says which.
    expect(screen.getByRole('button', { name: 'Sve dužine Sve' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Maraton 42,2 km' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('the length, as one row of six', () => {
  it('narrows the table on one click and says which one is on', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/takmicar/000002?sezona=sve')

    const table = await screen.findByRole('table', { name: 'Rezultati' })
    const all = within(table).getAllByRole('row').length

    await user.click(screen.getByRole('button', { name: 'Polumaraton 21,1 km' }))

    const narrowed = within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row')
    expect(narrowed.length).toBeLessThan(all)
    expect(narrowed.length).toBeGreaterThan(1)
    expect(screen.getByRole('button', { name: 'Polumaraton 21,1 km' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Sve dužine Sve' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // One click, and the choice is in the address so the link carries it.
    expect(router.state.location.search).toContain('duzina=half')
  })

  it('is named by both of its names, at every width', async () => {
    renderAt('/sr/takmicar/000002?sezona=sve')

    await screen.findByRole('table', { name: 'Rezultati' })

    /* Both names are always in the reading, and only one of them is on screen.
       The first attempt hid the long one with `display: none` and the short one
       with `aria-hidden`, which between them left the control with no accessible
       name at all below 620px: six unnamed buttons on the width PDL P24 calls
       the main one. */
    expect(screen.getByRole('button', { name: 'Maraton 42,2 km' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sve dužine Sve' })).toBeVisible()
    expect(document.querySelector('.profile__length-short')).not.toHaveAttribute('aria-hidden')
  })

  it('hides one of the two names by moving it, never by removing it', () => {
    /* jsdom computes no media queries, so the rule is read as text, the way the
       badge art and the ring are tested (ADL A7). `display: none` on either name
       is what would take it out of the reading, and it is the one thing this
       stylesheet must not do to them. */
    const css = readFileSync(join(process.cwd(), 'src/pages/Profile.css'), 'utf-8')
    const block = css.slice(css.indexOf('.profile__length-short'))

    expect(block).not.toContain('display: none')
    expect(block).toContain('clip-path: inset(50%)')
    expect(block).toContain('@media (max-width: 620px)')
  })
})

describe('the line that ties a name to its slice', () => {
  it('is white on the theme the portal opens in, and readable on the other', () => {
    /* The owner asked for a white line. White is right where the line ends, on
       the band itself, but the stretch that crosses the card behind it would be
       white on white in the light theme. So the colour is a token with a value
       per theme. jsdom computes no media queries and no custom properties, so
       the rule is read as text, the way the badge art is tested (ADL A7). */
    const css = readFileSync(join(process.cwd(), 'src/components/CategoryDonut.css'), 'utf-8')

    expect(css).toContain('--donut-leader: #ffffff')
    expect(css).toContain("[data-theme='dark']")
    expect(css).toContain('stroke: var(--donut-leader)')
    // The ring turns, the text does not.
    expect(css).toContain('.donut__ring')
    expect(css).not.toContain('container-type: inline-size')
  })
})

describe('a season in which both a trophy and a plaque were taken', () => {
  /* Built by hand rather than found in the generated data, because what has to
     be shown is one competitor on two boards in one season: the general standing
     of their gender, and their own category inside it. Both give out three
     (PDL P16), so somebody near the top of a small field takes both. */
  const person = (memberNumber: string, birthYear: number) => ({
    memberNumber,
    firstName: 'Probni',
    lastName: memberNumber,
    gender: 'M' as const,
    city: 'Čačak',
    country: 'RS',
    birthYear,
    firstSeason2027: false,
    firstSeason: 2020,
    active: true,
    membershipBasis: 'payment' as const,
    teamId: null,
    teamSince: null,
    bio: '',
  })

  const race = (memberNumber: string, points: number, id: string) => ({
    id,
    memberNumber,
    raceId: 'r1',
    eventName: 'Proba',
    eventSlug: 'proba',
    date: '2027-05-01',
    distanceKm: 10,
    ascentM: 0,
    descentM: 0,
    seconds: 3000,
    points,
    category: 'short' as const,
  })

  it('carries both, the better place first', () => {
    const mine = person('000101', 1990)
    const others = [person('000102', 1990), person('000103', 1955)]
    const results = [
      race('000101', 100, 'a'),
      race('000102', 200, 'b'),
      race('000103', 300, 'c'),
    ]

    const awards = awardsOf(mine, [mine, ...others], results)

    /* Third of the three overall, second of the two in the age band, and the
       better place is listed first. */
    expect(awards.map((one) => one.kind)).toEqual(['category', 'overall'])
    expect(awards.map((one) => one.position)).toEqual([2, 3])
    expect(awards[0].category).not.toBe('')
    expect(awards[1].category).toBe('')
  })

  it('carries nothing from a season the competitor was not in the top three of', () => {
    const mine = person('000101', 1990)
    const others = Array.from({ length: 5 }, (_, index) => person(`00020${index}`, 1990))
    const results = [
      race('000101', 1, 'a'),
      ...others.map((one, index) => race(one.memberNumber, 100 + index, `b${index}`)),
    ]

    expect(awardsOf(mine, [mine, ...others], results)).toEqual([])
  })
})

describe('the address stays as short as it can be', () => {
  it('drops the season from it again when the season chosen is the one it opens on', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/takmicar/000007?sezona=sve')

    await screen.findByRole('heading', { level: 1 })
    const season = screen.getByLabelText('Sezona') as HTMLSelectElement
    const opensOn = within(season).getAllByRole('option')[1].getAttribute('value')!

    /* The address it started on, which has to be the one that changes. Read from
       the router: a memory router never touches window.location, so the old
       assertion against it passed no matter what the screen did. */
    expect(router.state.location.search).toBe('?sezona=sve')

    await user.selectOptions(season, opensOn)

    /* Written into the address only where it differs from the default, so a
       shared link carries what the reader chose and nothing more. The assertion
       has to be on the address: the value of the control is the same either
       way. */
    expect(season.value).toBe(opensOn)
    expect(router.state.location.search).toBe('')
  })

  it('names the board a place was taken on, in both kinds', async () => {
    // 000005 has taken a place in the general standing as well as in a category.
    renderAt('/sr/takmicar/000005/priznanja')

    const table = await screen.findByRole('table', { name: 'Pehari i plakete' })
    const boards = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[1].textContent)

    expect(boards.some((one) => one === 'Generalni plasman')).toBe(true)
    expect(boards.some((one) => one?.startsWith('Kategorija'))).toBe(true)
  })
})

describe('an empty table says which of the four kinds of nothing it is', () => {
  it('names the length where the season is all of them', async () => {
    /* Never raced at all is a different fact from raced but not this season, and
       that from raced but never at this length. A reader told the wrong one goes
       looking for a fault in the portal. */
    renderAt('/sr/takmicar/000031?sezona=sve&duzina=ultra')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText('Ovaj takmičar još nema nijedan rezultat.')).toBeVisible()
  })

  it('names the length for somebody who has raced, but never that far', async () => {
    // 000002 has raced a hundred and thirteen times and never an ultra.
    renderAt('/sr/takmicar/000002?sezona=sve&duzina=ultra')

    expect(
      await screen.findByText('Nema nijednog rezultata izabrane dužine.'),
    ).toBeVisible()
  })

  it('names both where both are chosen', async () => {
    renderAt('/sr/takmicar/000002?sezona=2010&duzina=ultra')

    expect(
      await screen.findByText('Za izabranu sezonu i dužinu nema nijednog rezultata.'),
    ).toBeVisible()
  })
})

describe('a member whose fee has run out', () => {
  it('is on no list of this season, and nowhere carries a link', async () => {
    /* PDL P11: "u tabeli tekuće godine se ne pojavljuje uopšte", "link ka
       profilu postoji samo dok je članarina aktivna". 000032 is the first such
       member in the data, and being the newest number they went straight to the
       top of "Najnoviji članovi" on the front page, linking to a profile this
       change had just made unreachable. */
    renderAt('/sr')

    const newest = await screen.findByRole('heading', { name: /Zajednica|Najnoviji/ })
    expect(newest).toBeVisible()
    expect(screen.queryByRole('link', { name: /Vojislav Antonijević/ })).not.toBeInTheDocument()
  })

  it('is not among the competitors either', async () => {
    renderAt('/sr/takmicari')

    await screen.findByRole('heading', { level: 1, name: 'Takmičari' })
    expect(screen.queryByText('Vojislav Antonijević')).not.toBeInTheDocument()
  })
})
