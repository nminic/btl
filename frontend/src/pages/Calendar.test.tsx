import { screen, within } from '@testing-library/react'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

describe('Calendar', () => {
  it('opens on a month that has something in it', async () => {
    renderAt('/sr/kalendar')

    expect(await screen.findByRole('heading', { level: 1, name: 'Kalendar' })).toBeVisible()
    // The month heading only appears once the events are in, so waiting for it
    // is what separates "still loading" from "loaded and empty".
    await screen.findByRole('heading', { level: 2 })
    expect(screen.getAllByRole('link').some((link) => link.className === 'chip')).toBe(true)
  })

  it('opens on the month named in the address', async () => {
    renderAt('/sr/kalendar?mesec=2027-05')

    expect(await screen.findByRole('heading', { level: 2, name: 'maj 2027.' })).toBeVisible()
  })

  it('walks to the previous and the next month', async () => {
    const user = setupUser()
    renderAt('/sr/kalendar?mesec=2027-05')

    await user.click(await screen.findByRole('button', { name: 'Sledeći mesec' }))
    expect(screen.getByRole('heading', { level: 2, name: 'jun 2027.' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Prethodni mesec' }))
    expect(screen.getByRole('heading', { level: 2, name: 'maj 2027.' })).toBeVisible()

    // December to January has to roll the year over, not the month number.
    await user.click(screen.getByRole('button', { name: 'Prethodni mesec' }))
    expect(screen.getByRole('heading', { level: 2, name: 'april 2027.' })).toBeVisible()
  })

  it('says so when a month holds nothing', async () => {
    renderAt('/sr/kalendar?mesec=2029-01')

    expect(await screen.findByText('U ovom mesecu nema nijednog događaja.')).toBeVisible()
  })

  it('draws only the days of the month, never a square of nothing', async () => {
    /* May 2027 has 31 days and begins on a Saturday (owner, 31.07.2026: no dead
       cells). Padded to whole weeks it would carry five empty squares before the
       month and six after it, and those read as days with nothing on rather than
       as days of another month. The first day is placed in its own column
       instead. */
    const { container } = renderAt('/sr/kalendar?mesec=2027-05')

    await screen.findByRole('heading', { level: 2, name: 'maj 2027.' })

    const days = container.querySelectorAll('.day')
    expect(days).toHaveLength(31)
    expect((days[0] as HTMLElement).style.gridColumnStart).toBe('6')
  })

  it('rings today, and only today', async () => {
    const { container } = renderAt(
      '/sr/kalendar?mesec=2026-08',
      'visitor',
      null,
      undefined,
      '2026-08-13',
    )

    await screen.findByRole('heading', { level: 2 })

    expect(container.querySelectorAll('.day--today')).toHaveLength(1)
    /* The ring is gold, and a colour cannot be the only way to know which day it
       is, so the word travels with it. */
    expect(screen.getByText(', Danas')).toBeInTheDocument()
  })

  it('goes back to the running month from wherever it has been walked to', async () => {
    const user = setupUser()
    renderAt('/sr/kalendar?mesec=2019-06', 'visitor', null, undefined, '2026-08-13')

    await screen.findByRole('heading', { level: 2, name: 'jun 2019.' })
    await user.click(screen.getByRole('button', { name: 'Prikaži tekući mesec' }))

    expect(screen.getByRole('heading', { level: 2, name: 'avgust 2026.' })).toBeVisible()
  })

  it('sends a day with more on it than fits to a page of its own', async () => {
    const user = setupUser()
    // 1 June 2019 holds six events, one more than a day shows.
    renderAt('/sr/kalendar?mesec=2019-06')

    await screen.findByRole('heading', { level: 2, name: 'jun 2019.' })
    await user.click(screen.getByRole('link', { name: /Još 1/ }))

    /* A page and not a panel: a day is a thing somebody sends to somebody else,
       and the panel used to draw itself under the whole grid, which on a
       telephone is under everything. */
    expect(
      await screen.findByRole('heading', { level: 1, name: /1\. jun 2019\./ }),
    ).toBeVisible()
    expect(within(screen.getByRole('list', { name: '' })).getAllByRole('listitem')).toHaveLength(6)
  })

  it('says a day it does not recognise the same way it says an empty one', async () => {
    renderAt('/sr/kalendar/dan/nije-datum')

    expect(await screen.findByRole('heading', { level: 1, name: 'Kalendar' })).toBeVisible()
    expect(screen.getByText('U ovom mesecu nema nijednog događaja.')).toBeVisible()
  })

  it('names the lengths a day holds, in colour and in words', async () => {
    const { container } = renderAt('/sr/kalendar?mesec=2019-06')

    await screen.findByRole('heading', { level: 2, name: 'jun 2019.' })

    /* A colour on its own says nothing to anybody who cannot separate two of
       them, so every dot is drawn aria-hidden beside a name a screen reader
       reads. The legend under the grid says what the colours mean. */
    const dots = container.querySelectorAll('.chip .length-dot')
    expect(dots.length).toBeGreaterThan(0)
    expect([...dots].every((dot) => dot.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(within(screen.getByRole('list', { name: 'Boje kružića' })).getAllByRole('listitem'))
      .toHaveLength(5)
  })

  it('leads from a chip to the event', async () => {
    const user = setupUser()
    renderAt('/sr/kalendar?mesec=2027-05')

    await screen.findByRole('heading', { level: 2, name: 'maj 2027.' })
    const chips = screen.getAllByRole('link').filter((link) => link.className === 'chip')

    expect(chips.length).toBeGreaterThan(0)
    await user.click(chips[0])

    expect(
      await screen.findByRole('link', { name: 'Nazad na kalendar' }, { timeout: 4000 }),
    ).toBeVisible()
  })
})
