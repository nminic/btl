import { screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useSearchParams } from 'react-router'
import { renderWithI18n } from '../test/render'
import { setupUser } from '../test/user'
import { Pager } from './Pager'
import { pageFrom, PER_PAGE } from './pageOf'

/* Fifty placed to a page (owner, 03.08.2026, PDL P24).
 *
 * The competition grid is the table this was asked for, and no competition in
 * the generated data has more than thirty two people in it, so the paging is
 * exercised here rather than through that screen. What the screen does with it
 * is one slice, tested where the slice is: `leagueResults.test.tsx`.
 */

describe('which page the address asks for', () => {
  it('is the first one when it asks for nothing', () => {
    expect(pageFrom(null, 500)).toBe(1)
  })

  it('is the first one when what it asks for is not a page', () => {
    /* Anything can be typed into an address, and none of it may throw or hand
       back a slice from nowhere. */
    for (const asked of ['0', '-3', 'druga', '2.5', '', ' ']) {
      expect(pageFrom(asked, 500)).toBe(1)
    }
  })

  it('is the one asked for when there is one', () => {
    expect(pageFrom('3', 500)).toBe(3)
  })

  it('is never past the end', () => {
    /* Five hundred rows are ten pages, so page eleven is page ten. Without this
       a hand-typed number gives an empty table and no way back to the rows. */
    expect(pageFrom('11', 500)).toBe(10)
    expect(pageFrom('400', 51)).toBe(2)
  })

  it('is the first one when there are no rows at all', () => {
    expect(pageFrom('4', 0)).toBe(1)
  })

  it('holds fifty', () => {
    expect(PER_PAGE).toBe(50)
  })
})

/** The pager over a table of that many rows, with the address it is reading. */
function Paged({ rows }: { rows: number }) {
  const [params] = useSearchParams()
  const location = useLocation()

  return (
    <>
      <Pager page={pageFrom(params.get('strana'), rows)} rows={rows} label="Strane" />
      {/* So a test can read the address the pager wrote, which is the whole of
          what pressing a step does. */}
      <p data-testid="adresa">{location.search}</p>
    </>
  )
}

const show = (rows: number, at = '/sr/liga/proba') =>
  renderWithI18n(
    <MemoryRouter initialEntries={[at]}>
      <Paged rows={rows} />
    </MemoryRouter>,
  )

const address = () => screen.getByTestId('adresa').textContent

describe('the way from one page to the next', () => {
  it('is not drawn when everything fits on one page', () => {
    /* A control that can do nothing is a control that has to be read before it
       can be dismissed. */
    show(50)

    expect(screen.queryByRole('navigation', { name: 'Strane' })).toBeNull()
  })

  it('says which rows are on the screen and which page of how many', () => {
    show(137)

    expect(screen.getByText('Prikazano 1 do 50 od 137')).toBeVisible()
    expect(screen.getByText('Strana 1 od 3')).toBeVisible()
  })

  it('counts the last page by what is left on it', () => {
    show(137, '/sr/liga/proba?strana=3')

    expect(screen.getByText('Prikazano 101 do 137 od 137')).toBeVisible()
  })

  it('leads nowhere from either end, and says so by the control rather than by its absence', () => {
    show(137)

    expect(screen.getByRole('button', { name: 'Prethodna' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Sledeća' })).toHaveAttribute('aria-disabled', 'false')
  })

  it('has no step forward on the last page', () => {
    show(137, '/sr/liga/proba?strana=3')

    expect(screen.getByRole('button', { name: 'Sledeća' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Prethodna' })).toHaveAttribute('aria-disabled', 'false')
  })

  it('is a landmark with a name, so it can be found and left', () => {
    show(137)

    expect(within(screen.getByRole('navigation', { name: 'Strane' })).getAllByRole('button'))
      .toHaveLength(2)
  })
})

describe('pressing a step', () => {
  it('writes the page into the address, so it can be sent to somebody', async () => {
    const user = setupUser()
    show(137)

    await user.click(screen.getByRole('button', { name: 'Sledeća' }))

    expect(address()).toBe('?strana=2')
    expect(screen.getByText('Prikazano 51 do 100 od 137')).toBeVisible()
  })

  it('takes the number back off the address on the way to the first page', async () => {
    /* The first page is the one with no number on it, so the address of a table
       nobody has paged through stays the address of the table. */
    const user = setupUser()
    show(137, '/sr/liga/proba?strana=2')

    await user.click(screen.getByRole('button', { name: 'Prethodna' }))

    expect(address()).toBe('')
    expect(screen.getByText('Prikazano 1 do 50 od 137')).toBeVisible()
  })

  it('leaves everything else in the address where it was', async () => {
    /* The competition grid is opened with a season on it, and paging must not
       be the thing that loses it. */
    const user = setupUser()
    show(137, '/sr/liga/proba?sezona=2027')

    await user.click(screen.getByRole('button', { name: 'Sledeća' }))

    expect(address()).toContain('sezona=2027')
    expect(address()).toContain('strana=2')
  })
})

describe('a step at the end of the road', () => {
  it('stays where the keyboard left it rather than switching itself off', async () => {
    /* Switched off, the button that took a reader to the last page vanished
       from under their finger, the focus fell to the document, and the next Tab
       started again from the skip link. */
    const user = setupUser()
    show(137, '/sr/liga/proba?strana=2')

    const next = screen.getByRole('button', { name: 'Sledeća' })
    await user.click(next)

    expect(next).toHaveAttribute('aria-disabled', 'true')
    expect(next).toHaveFocus()
  })

  it('does nothing when it is pressed anyway', async () => {
    const user = setupUser()
    show(137, '/sr/liga/proba?strana=3')

    await user.click(screen.getByRole('button', { name: 'Sledeća' }))

    expect(address()).toBe('?strana=3')
    expect(screen.getByText('Strana 3 od 3')).toBeVisible()
  })
})

describe('a page handed in from outside its bounds', () => {
  it('is held inside them, so nothing draws a slice from nowhere', () => {
    /* The screen reads the address through `pageFrom`, but a second caller who
       forgot to would otherwise get "Prikazano 451 do 137 od 137" and two steps
       that both look usable. */
    renderWithI18n(
      <MemoryRouter initialEntries={['/sr/liga/proba']}>
        <Pager page={9} rows={137} label="Strane" />
      </MemoryRouter>,
    )

    expect(screen.getByText('Strana 3 od 3')).toBeVisible()
    expect(screen.getByText('Prikazano 101 do 137 od 137')).toBeVisible()
  })
})

describe('the numbers in it', () => {
  it('are written the way the rest of the portal writes numbers', () => {
    /* Thousands are grouped everywhere else on the portal, through one place
       (ADL A7). A standing of two thousand is a real number for this league. */
    show(2000)

    expect(screen.getByText('Prikazano 1 do 50 od 2.000')).toBeVisible()
  })
})
