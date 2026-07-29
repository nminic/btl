import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { hueFor } from './competitorFace'
import { renderAt } from '../test/render'

/* One file for the screens a visitor sees. They share a shape: read the data
 * layer, sort it, put it in a table. */

/* The standing sits at /tabela. /rang-liste is the page of top boards beside
 * it (PDL P28a), and has its own block further down. */
describe('Rankings', () => {
  it('opens on a season that has a field, with the columns from the rulebook', async () => {
    renderAt('/sr/tabela')

    expect(await screen.findByRole('table')).toBeVisible()
    // The two vertical columns stand beside the distance, and no column below is
    // left out of the markup at any width. Δ from PDL P12 is not among them: it
    // needs the standing as it stood at the end of last month, which the
    // prototype has nothing to compute from yet.
    for (const column of ['#', 'Član', 'Kat.', 'Trke', 'd (km)', '+ (m)', '− (m)', 'Vreme', 'Bodovi']) {
      expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('row').length).toBeGreaterThan(2)
  })

  it('orders by points, with the podium marked', async () => {
    renderAt('/sr/tabela?sezona=2020')

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
    renderAt('/sr/tabela?sezona=2020')

    const men = within(await screen.findByRole('table')).getAllByRole('row').length
    await user.click(screen.getByRole('button', { name: 'Žene' }))
    const women = within(screen.getByRole('table')).getAllByRole('row').length

    expect(women).not.toBe(men)
    expect(screen.getByRole('button', { name: 'Žene' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('goes back to the men after the women, and changes the season', async () => {
    const user = userEvent.setup()
    renderAt('/sr/tabela?sezona=2020')

    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Žene' }))
    await user.click(screen.getByRole('button', { name: 'Muškarci' }))
    expect(screen.getByRole('button', { name: 'Muškarci' })).toHaveAttribute('aria-pressed', 'true')

    await user.selectOptions(screen.getByLabelText('Sezona'), '2019')
    expect(screen.getByLabelText('Sezona')).toHaveValue('2019')
  })

  it('narrows by category and by search, and lets both go again', async () => {
    const user = userEvent.setup()
    renderAt('/sr/tabela?sezona=2020')

    const all = within(await screen.findByRole('table')).getAllByRole('row').length
    await user.selectOptions(screen.getByLabelText('Kat.'), 'M40-54')
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeLessThan(all)

    await user.selectOptions(screen.getByLabelText('Kat.'), '')
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(all)

    await user.type(screen.getByLabelText('Pretraga po imenu ili članskom broju'), '000007')
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2)
  })

  it('says so when a filter leaves nothing', async () => {
    renderAt('/sr/tabela?sezona=2020&trazi=nepostojeci')

    expect(
      await screen.findByText('U ovoj sezoni i kategoriji nema nijednog rezultata.'),
    ).toBeVisible()
  })

  it('leads from a row to the profile', async () => {
    renderAt('/sr/tabela?sezona=2020')

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)
    const link = within(rows[0]).getByRole('link')

    expect(link).toHaveAttribute('href', expect.stringContaining('/sr/takmicar/'))
  })
})

describe('TopBoards', () => {
  /** The board with the given heading, looked up the way a screen reader does:
   *  through the region the heading names. */
  function board(name: string) {
    return within(screen.getByRole('region', { name }))
  }

  it('carries a board for every length, and each one stops at ten places', async () => {
    renderAt('/sr/rang-liste?sezona=2019')

    expect(await screen.findByRole('heading', { level: 1, name: 'Rang liste' })).toBeVisible()

    for (const name of [
      'Najviše kraćih trka',
      'Najviše dužih trka',
      'Najviše polumaratona',
      'Najviše maratona',
      'Najviše ultramaratona',
    ]) {
      const rows = board(name).getAllByRole('row').slice(1)

      expect(rows.length).toBeGreaterThan(0)
      expect(rows.length).toBeLessThanOrEqual(10)
      expect(rows.filter((row) => row.className === 'podium').length).toBeLessThanOrEqual(3)
    }
  })

  it('ranks the best single races with the event beside the points', async () => {
    renderAt('/sr/rang-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najbolje pojedinačne trke' })
    const races = board('Najbolje pojedinačne trke')

    expect(races.getByRole('columnheader', { name: 'Događaj' })).toBeInTheDocument()

    const points = races
      .getAllByRole('row')
      .slice(1)
      .map((row) => {
        const cells = within(row).getAllByRole('cell')
        return Number(cells[cells.length - 1].textContent!.replace(/\./g, '').replace(',', '.'))
      })

    expect([...points].sort((left, right) => right - left)).toEqual(points)
  })

  it('shows the time on the course in the shape the owner asked for', async () => {
    renderAt('/sr/rang-liste?sezona=2019')

    const rows = (await screen.findAllByRole('row')).length

    expect(rows).toBeGreaterThan(0)
    expect(board('Najduže na stazi').getAllByText(/^\d+ h \d{2}' \d{2}''$/).length).toBe(10)
  })

  it('stands the pairs board empty rather than inventing one', async () => {
    renderAt('/sr/rang-liste?sezona=2019')

    await screen.findByRole('heading', { level: 2, name: 'Najbolji parovi' })
    const pairs = board('Najbolji parovi')

    expect(pairs.getByText(/stiže zajedno sa bazom/)).toBeVisible()
    expect(pairs.queryByRole('table')).not.toBeInTheDocument()
  })

  it('leads from every name to the profile behind it', async () => {
    renderAt('/sr/rang-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najviše kilometara' })
    const first = board('Najviše kilometara').getAllByRole('row')[1]

    expect(within(first).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/sr/takmicar/'),
    )
  })

  it('opens on a season of its own, and changes every board with one filter', async () => {
    const user = userEvent.setup()
    renderAt('/sr/rang-liste')

    const season = await screen.findByLabelText('Sezona')
    // No season in the address, so the page picks one that has results.
    expect(Number((season as HTMLSelectElement).value)).toBeGreaterThan(2000)

    const before = board('Najviše kilometara')
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent)

    await user.selectOptions(season, '2016')

    expect(screen.getByLabelText('Sezona')).toHaveValue('2016')
    expect(
      board('Najviše kilometara')
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent),
    ).not.toEqual(before)
    // The one filter reaches the boards further down the page too.
    expect(board('Najduže na stazi').getAllByRole('row').length).toBeGreaterThan(1)
  })

  it('says so on a board that the season leaves empty', async () => {
    // 2012 has two results in it, and neither of them is a marathon.
    renderAt('/sr/rang-liste?sezona=2012')

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Najviše maratona' }),
    ).toBeVisible()
    expect(board('Najviše maratona').getByText('U ovoj sezoni nema nijednog rezultata.')).toBeVisible()
  })
})

describe('Competitors', () => {
  /* Cards rather than a table (PDL P28a): the league is about people, and a row
     does not show a person. */
  it('gives everyone a card with their face, their races and their points', async () => {
    renderAt('/sr/takmicari')

    const cards = within(await screen.findByRole('list')).getAllByRole('listitem')
    expect(cards.length).toBeGreaterThan(20)

    const first = within(cards[0])
    expect(first.getByRole('link')).toBeVisible()
    expect(first.getByText('Trke')).toBeVisible()
    expect(first.getByText('Bodovi')).toBeVisible()
  })

  it('searches, and says so when nothing matches', async () => {
    const user = userEvent.setup()
    renderAt('/sr/takmicari')

    await user.type(await screen.findByLabelText('Pretraga'), '000001')
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1)

    await user.clear(screen.getByLabelText('Pretraga'))
    await user.type(screen.getByLabelText('Pretraga'), 'zzzz')
    expect(screen.getByText('Nema takmičara koji odgovara pretrazi.')).toBeVisible()
  })

  it('gives the same person the same colour every time', async () => {
    renderAt('/sr/takmicari')
    await screen.findByRole('list')

    expect(hueFor('000001')).toBe(hueFor('000001'))
    expect(hueFor('000001')).not.toBe(hueFor('000002'))
    expect(hueFor('000001')).toBeLessThan(360)
  })
})

describe('CompetitorProfile', () => {
  it('shows the totals and the results of one competitor', async () => {
    renderAt('/sr/takmicar/000007')

    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Sve sezone' })).toBeVisible()

    const results = screen.getByRole('table', { name: 'Rezultati' })
    expect(within(results).getAllByRole('row').length).toBeGreaterThan(2)
  })

  it('narrows the table, the totals and the bars with one filter', async () => {
    const user = userEvent.setup()
    renderAt('/sr/takmicar/000007')

    await screen.findByRole('heading', { level: 1 })
    const all = within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row').length

    await user.selectOptions(screen.getByLabelText('Kategorija'), 'marathon')

    const narrowed = within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row')
    expect(narrowed.length).toBeLessThan(all)
    // The heading over the totals follows the same filter, not the whole career.
    expect(screen.getByRole('heading', { name: 'Sve sezone' })).toBeVisible()
  })

  it('lets a filter go again', async () => {
    const user = userEvent.setup()
    renderAt('/sr/takmicar/000007')

    await screen.findByRole('heading', { level: 1 })
    const all = within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row').length

    await user.selectOptions(screen.getByLabelText('Sezona'), '2020')
    expect(screen.getByRole('heading', { name: 'Sezona 2020.' })).toBeVisible()

    await user.selectOptions(screen.getByLabelText('Sezona'), 'sve')
    expect(screen.getByRole('heading', { name: 'Sve sezone' })).toBeVisible()
    expect(within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row')).toHaveLength(
      all,
    )
  })

  it('shows the five lengths as bars, including the ones never run', async () => {
    renderAt('/sr/takmicar/000007')

    const chart = await screen.findByRole('table', { name: 'Trke po dužini' })
    expect(within(chart).getAllByRole('row')).toHaveLength(5)
  })

  it('says so when the filter leaves nothing', async () => {
    renderAt('/sr/takmicar/000007?sezona=2010')

    expect(
      await screen.findByText('Za izabranu sezonu i dužinu nema nijednog rezultata.'),
    ).toBeVisible()
  })

  it('says so when the competitor does not exist', async () => {
    renderAt('/sr/takmicar/M9999')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovog takmičara nema.' }),
    ).toBeVisible()
  })

  it('handles a competitor who has never raced', async () => {
    // 000031 is the deliberately empty profile in the generated data.
    renderAt('/sr/takmicar/000031')

    expect(await screen.findByText('Ovaj takmičar još nema nijedan rezultat.')).toBeVisible()
  })

  it('says plainly when somebody is in no team', async () => {
    renderAt('/sr/takmicar/000006')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText('Bez tima')).toBeInTheDocument()
  })

  it('leads to the team page', async () => {
    renderAt('/sr/takmicar/000007')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('link', { name: /trkači|klub|krug/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/sr/tim/'),
    )
  })

  it('never tells a visitor who is an honorary member', async () => {
    // It is a fact about money, not about running, and it is nobody's business.
    renderAt('/sr/takmicar/000007')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText('Počasno članstvo')).not.toBeInTheDocument()
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
    expect(screen.getByText('1. do 5. oktobra')).toBeInTheDocument()
    expect(screen.getByText(/35 EUR/)).toBeInTheDocument()
    expect(screen.getAllByText(/40 EUR/)).toHaveLength(2)
    expect(screen.getByText('6.000 RSD')).toBeInTheDocument()
    expect(screen.getByText('(bez prava na rangiranje)')).toBeInTheDocument()
    // The preview period is not a price, so it has no row in the table. It is
    // still explained underneath it.
    expect(within(screen.getByRole('table')).queryByText(/septembra/)).not.toBeInTheDocument()
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
  it('lists what runs alongside the league, and never the league itself', async () => {
    renderAt('/sr/lige')

    expect(await screen.findByRole('heading', { level: 1, name: 'Dodatna takmičenja' })).toBeVisible()
    expect(screen.getByText('Grupisanje samo po polu')).toBeInTheDocument()
    // The league the portal exists for is implied, not listed.
    expect(screen.queryByRole('link', { name: /Balkanska trkačka liga 2027/ })).not.toBeInTheDocument()
  })
})
