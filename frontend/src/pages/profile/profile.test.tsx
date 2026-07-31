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

    expect(cut.length).toBeLessThanOrEqual(601)
    expect(cut.endsWith('…')).toBe(true)
    // The character before the ellipsis is the end of a word, not half of one.
    expect(cut.slice(-2, -1)).not.toBe(' ')
    expect(long.startsWith(cut.slice(0, -1))).toBe(true)
  })

  it('cuts one long word rather than refusing to cut', () => {
    // Nothing on the portal writes like this; a row that arrives from somewhere
    // else might, and the layout still has to survive it.
    const wall = 'a'.repeat(900)

    expect(shortBio(wall)).toHaveLength(601)
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
    expect((screen.getByLabelText('Dužina') as HTMLSelectElement).value).toBe('sve')
  })
})

describe('the ring beside its legend', () => {
  it('breaks on the width of the box it stands in, not on the width of the window', () => {
    /* Inside a 316px column on a wide desktop a viewport query insisted the ring
       sat beside a legend that needs 194px, and the two collided. jsdom computes
       no container queries, so the rule is read as text, the way the badge art
       is tested (ADL A7). */
    const css = readFileSync(join(process.cwd(), 'src/components/CategoryDonut.css'), 'utf-8')

    expect(css).toContain('container-type: inline-size')
    expect(css).toContain('@container donut (min-width: 380px)')
    expect(css).not.toContain('@media (min-width: 620px)')
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
    bio: '',
  })

  const race = (memberNumber: string, points: number, id: string) => ({
    id,
    memberNumber,
    raceId: 'r1',
    eventName: 'Proba',
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
    renderAt('/sr/takmicar/000007?sezona=sve')

    await screen.findByRole('heading', { level: 1 })
    const season = screen.getByLabelText('Sezona') as HTMLSelectElement
    const opensOn = within(season).getAllByRole('option')[1].getAttribute('value')!

    await user.selectOptions(season, opensOn)

    /* Written into the address only where it differs from the default, so a
       shared link carries what the reader chose and nothing more. The assertion
       has to be on the address: the value of the control is the same either
       way. */
    expect(season.value).toBe(opensOn)
    expect(window.location.search).toBe('')
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
