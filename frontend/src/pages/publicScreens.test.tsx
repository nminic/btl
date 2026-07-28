import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt } from '../test/render'

/* One file for the screens a visitor sees. They share a shape: read the data
 * layer, sort it, put it in a table. */

describe('Rankings', () => {
  it('opens on a season that has a field, with the columns from the rulebook', async () => {
    renderAt('/sr/rang-liste')

    expect(await screen.findByRole('table')).toBeVisible()
    for (const column of ['#', 'Član', 'Kat.', 'Trke', 'Vreme', 'Bodovi']) {
      expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('row').length).toBeGreaterThan(2)
  })

  it('orders by points, with the podium marked', async () => {
    renderAt('/sr/rang-liste?sezona=2020')

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)
    const points = rows.map((row) => {
      const cells = within(row).getAllByRole('cell')
      return Number(cells[cells.length - 1].textContent!.replace(/\./g, '').replace(',', '.'))
    })

    expect([...points].sort((a, b) => b - a)).toEqual(points)
    expect(rows.filter((row) => row.className === 'podium')).toHaveLength(3)
  })

  it('keeps men and women apart', async () => {
    const user = userEvent.setup()
    renderAt('/sr/rang-liste?sezona=2020')

    const men = within(await screen.findByRole('table')).getAllByRole('row').length
    await user.click(screen.getByRole('button', { name: 'Žene' }))
    const women = within(screen.getByRole('table')).getAllByRole('row').length

    expect(women).not.toBe(men)
    expect(screen.getByRole('button', { name: 'Žene' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('goes back to the men after the women, and changes the season', async () => {
    const user = userEvent.setup()
    renderAt('/sr/rang-liste?sezona=2020')

    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Žene' }))
    await user.click(screen.getByRole('button', { name: 'Muškarci' }))
    expect(screen.getByRole('button', { name: 'Muškarci' })).toHaveAttribute('aria-pressed', 'true')

    await user.selectOptions(screen.getByLabelText('Sezona'), '2019')
    expect(screen.getByLabelText('Sezona')).toHaveValue('2019')
  })

  it('narrows by category and by search, and lets both go again', async () => {
    const user = userEvent.setup()
    renderAt('/sr/rang-liste?sezona=2020')

    const all = within(await screen.findByRole('table')).getAllByRole('row').length
    await user.selectOptions(screen.getByLabelText('Kat.'), 'M B')
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeLessThan(all)

    await user.selectOptions(screen.getByLabelText('Kat.'), '')
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(all)

    await user.type(screen.getByLabelText('Pretraga po imenu ili članskom broju'), 'M0005')
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2)
  })

  it('says so when a filter leaves nothing', async () => {
    renderAt('/sr/rang-liste?sezona=2020&trazi=nepostojeci')

    expect(
      await screen.findByText('U ovoj sezoni i kategoriji nema nijednog rezultata.'),
    ).toBeVisible()
  })

  it('leads from a row to the profile', async () => {
    renderAt('/sr/rang-liste?sezona=2020')

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)
    const link = within(rows[0]).getByRole('link')

    expect(link).toHaveAttribute('href', expect.stringContaining('/sr/takmicar/'))
  })
})

describe('Competitors', () => {
  it('lists everyone with their totals', async () => {
    renderAt('/sr/takmicari')

    expect(await screen.findByRole('table')).toBeVisible()
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeGreaterThan(20)
  })

  it('searches, and says so when nothing matches', async () => {
    const user = userEvent.setup()
    renderAt('/sr/takmicari')

    await user.type(await screen.findByLabelText('Pretraga'), 'M0001')
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2)

    await user.clear(screen.getByLabelText('Pretraga'))
    await user.type(screen.getByLabelText('Pretraga'), 'zzzz')
    expect(screen.getByText('Nema takmičara koji odgovara pretrazi.')).toBeVisible()
  })
})

describe('CompetitorProfile', () => {
  it('shows the totals and the results of one competitor', async () => {
    renderAt('/sr/takmicar/M0005')

    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Sve sezone' })).toBeVisible()
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeGreaterThan(2)
  })

  it('says so when the competitor does not exist', async () => {
    renderAt('/sr/takmicar/M9999')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovog takmičara nema.' }),
    ).toBeVisible()
  })

  it('handles a competitor with no results and no team', async () => {
    // M0021 is the deliberately empty profile in the generated data: a member
    // who has never raced.
    renderAt('/sr/takmicar/M0021')

    expect(await screen.findByText('Ovaj takmičar još nema nijedan rezultat.')).toBeVisible()
    expect(screen.getByText('Bez tima')).toBeInTheDocument()
  })
})

describe('EventDetail', () => {
  it('says so when the event does not exist', async () => {
    renderAt('/sr/kalendar/nepostojeci-dogadjaj')

    expect(await screen.findByRole('heading', { level: 1, name: 'Ovog događaja nema.' })).toBeVisible()
  })
})

describe('Pricing', () => {
  it('shows the price list, in both currencies, with the period that carries no ranking', async () => {
    renderAt('/sr/clanarina')

    expect(await screen.findByRole('heading', { level: 1, name: 'Članarina' })).toBeVisible()
    expect(screen.getAllByText(/40 EUR/)).toHaveLength(2)
    expect(screen.getByText('6.000 RSD')).toBeInTheDocument()
    expect(screen.getByText('Ne naplaćuje se')).toBeInTheDocument()
    expect(screen.getByText('(bez prava na rangiranje)')).toBeInTheDocument()
  })

  it('states that the fee is not refunded', async () => {
    renderAt('/sr/clanarina')

    expect(await screen.findByText(/Članarina se ne vraća/)).toBeVisible()
  })
})

describe('Teams', () => {
  it('ranks teams by the plain sum of their members', async () => {
    renderAt('/sr/timovi')

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)

    expect(rows.length).toBeGreaterThan(1)
    expect(rows[0].className).toBe('podium')
  })
})

describe('Leagues', () => {
  it('lists the leagues and how each one groups its field', async () => {
    renderAt('/sr/lige')

    expect(await screen.findByRole('heading', { level: 1, name: 'Lige' })).toBeVisible()
    expect(screen.getByText('Grupisanje po kategorijama')).toBeInTheDocument()
    expect(screen.getByText('Grupisanje samo po polu')).toBeInTheDocument()
  })
})
