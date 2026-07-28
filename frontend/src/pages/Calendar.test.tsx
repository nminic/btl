import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt } from '../test/render'

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
    const user = userEvent.setup()
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

  it('opens a day from its date and closes it again', async () => {
    const user = userEvent.setup()
    renderAt('/sr/kalendar?mesec=2027-05')

    const dayButtons = await screen.findAllByRole('button', { name: /Prikaži ceo dan/ })
    await user.click(dayButtons[0])

    const detail = screen.getByRole('region')
    expect(within(detail).getByRole('heading', { level: 2 })).toBeVisible()

    await user.click(within(detail).getByRole('button', { name: 'Zatvori dan' }))
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('shows an empty day as empty when its date is opened', async () => {
    const user = userEvent.setup()
    renderAt('/sr/kalendar?mesec=2029-01')

    const dayButtons = await screen.findAllByRole('button', { name: /Prikaži ceo dan/ })
    await user.click(dayButtons[0])

    expect(within(screen.getByRole('region')).getByText('U ovom mesecu nema nijednog događaja.')).toBeVisible()
  })

  it('collapses a crowded day behind a button that opens it', async () => {
    const user = userEvent.setup()
    // 1 June 2019 holds six events, more than a cell shows.
    renderAt('/sr/kalendar?mesec=2019-06')

    await screen.findByRole('heading', { level: 2, name: 'jun 2019.' })
    await user.click(screen.getByRole('button', { name: /Još 3/ }))

    const detail = screen.getByRole('region')
    expect(within(detail).getAllByRole('listitem')).toHaveLength(6)
  })

  it('leads from a chip to the event', async () => {
    const user = userEvent.setup()
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
