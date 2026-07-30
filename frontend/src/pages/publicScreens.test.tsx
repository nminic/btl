import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { loadResource } from '../data/client'
import { I18nProvider } from '../i18n/I18nProvider'
import { hueFor } from './competitorFace'
import { Delta, Rankings } from './Rankings'
import { renderAt, renderWithI18n } from '../test/render'
import { setupUser } from '../test/user'

/* One file for the screens a visitor sees. They share a shape: read the data
 * layer, sort it, put it in a table. */

/* The standing sits at /tabela. /top-liste is the page of Top 10 boards beside
 * it (PDL P28a), and has its own block further down. */
describe('Rankings', () => {
  it('opens on a season that has a field, with the columns from the rulebook', async () => {
    renderAt('/sr/tabela')

    expect(await screen.findByRole('table')).toBeVisible()
    /* The nine columns of PDL P12 that are always there. Δ is the tenth and it
       comes and goes with the season being shown, so it is pinned below on a
       given day rather than on whichever day the suite happens to run: this one
       opens on whatever season the data makes fullest, which moves as the
       calendar does. The two vertical columns stand beside the distance, and no
       column here is left out of the markup at any width. */
    for (const column of ['#', 'Član', 'Kat.', 'Trke', 'd (km)', '+ (m)', '− (m)', 'Vreme', 'Bodovi']) {
      expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('row').length).toBeGreaterThan(2)
  })

  /* The Δ column through the screen rather than the function, on a day inside
   * the season being shown. The season is over in real life, so the day has to
   * be given rather than taken off the clock, which is why the screen takes one
   * (Membership and the front page slots do the same). */
  function renderStandingOn(today: string, path: string) {
    return render(
      <I18nProvider locale="sr">
        <MemoryRouter initialEntries={[path]}>
          <Rankings today={today} />
        </MemoryRouter>
      </I18nProvider>,
    )
  }

  it('carries all ten columns of the rulebook while the season is running', async () => {
    // The 2026 season runs in the data from January to late July, so the end of
    // June is a reference with half a season behind it and a fortnight of racing
    // after it.
    renderStandingOn('2026-07-30', '/sr/tabela?sezona=2026')

    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('columnheader').map((one) => one.textContent)).toEqual([
      '#', 'Δ', 'Član', 'Kat.', 'Trke', 'd (km)', '+ (m)', '− (m)', 'Vreme', 'Bodovi',
    ])

    // Rows that really moved, not a column of dashes.
    expect(within(table).getAllByText(/mesta? naviše|mesta? naniže|mesto nav|mesto nan/).length)
      .toBeGreaterThan(0)
  })

  it('drops the Δ column in January, before the season has anything behind it', async () => {
    // The reference would be the end of December 2025, when the 2026 season had
    // not begun: nobody was in the table, so every row would be blank (PDL P12).
    renderStandingOn('2026-01-20', '/sr/tabela?sezona=2026')

    const table = await screen.findByRole('table')
    expect(within(table).queryByRole('columnheader', { name: 'Δ' })).not.toBeInTheDocument()
    expect(within(table).getAllByRole('columnheader')).toHaveLength(9)
  })

  it('drops it on a season that has been frozen, where nothing can move again', async () => {
    renderStandingOn('2026-07-30', '/sr/tabela?sezona=2020')

    const table = await screen.findByRole('table')
    expect(within(table).queryByRole('columnheader', { name: 'Δ' })).not.toBeInTheDocument()
    expect(within(table).getAllByRole('columnheader')).toHaveLength(9)
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
    const user = setupUser()
    renderAt('/sr/tabela?sezona=2020')

    const men = within(await screen.findByRole('table')).getAllByRole('row').length
    await user.click(screen.getByRole('button', { name: 'Žene' }))
    const women = within(screen.getByRole('table')).getAllByRole('row').length

    expect(women).not.toBe(men)
    expect(screen.getByRole('button', { name: 'Žene' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('goes back to the men after the women, and changes the season', async () => {
    const user = setupUser()
    renderAt('/sr/tabela?sezona=2020')

    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Žene' }))
    await user.click(screen.getByRole('button', { name: 'Muškarci' }))
    expect(screen.getByRole('button', { name: 'Muškarci' })).toHaveAttribute('aria-pressed', 'true')

    await user.selectOptions(screen.getByLabelText('Sezona'), '2019')
    expect(screen.getByLabelText('Sezona')).toHaveValue('2019')
  })

  it('narrows by category and by search, and lets both go again', async () => {
    const user = setupUser()
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

/* The Δ cell on its own, because the three cases that are not "level" cannot be
 * produced from a season that ended years ago (PDL P12). */
describe('the Δ cell', () => {
  it('draws a climb with an arrow the eye reads and words a screen reader reads', () => {
    renderWithI18n(<Delta places={2} />)

    expect(screen.getByText('▲2')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('2 mesta naviše')).toBeInTheDocument()
  })

  it('counts one place in the singular', () => {
    renderWithI18n(<Delta places={1} />)

    expect(screen.getByText('1 mesto naviše')).toBeInTheDocument()
  })

  it('draws a fall as the same shape the other way up, never as a minus', () => {
    renderWithI18n(<Delta places={-3} />)

    expect(screen.getByText('▼3')).toBeInTheDocument()
    expect(screen.getByText('3 mesta naniže')).toBeInTheDocument()
  })

  it('says a row has not moved rather than leaving the cell to be read as missing', () => {
    renderWithI18n(<Delta places={0} />)

    expect(screen.getByText('bez promene mesta')).toBeInTheDocument()
  })

  it('shows nothing for a member who was not in the table last month', () => {
    const { container } = renderWithI18n(<Delta places={undefined} />)

    // Not a dash and not a zero: neither of those is true of somebody who was
    // not there to move (PDL P12).
    expect(container).toBeEmptyDOMElement()
  })
})

describe('TopBoards', () => {
  /** The board with the given heading, looked up the way a screen reader does:
   *  through the region the heading names. */
  function board(name: string) {
    return within(screen.getByRole('region', { name }))
  }

  /* The eleven lists of Article 56, in the order the rulebook counts them out
     (PDL P28a), the five lengths included: longest first, as the article names
     them. This page is that article on a screen, so the article decides the
     order on it; the other screens keep the portal's own order, shortest first.
     Both empty boards are in here, because a list the rulebook names and the
     page leaves out is the fault this guards against. */
  const ELEVEN = [
    'Najviše kilometara',
    'Najduže na stazi',
    'Najbolje pojedinačne trke',
    'Najbolji napredak',
    'Najbolji tim',
    'Najbolji parovi',
    'Najviše ultramaratona',
    'Najviše maratona',
    'Najviše dužih trka',
    'Najviše polumaratona',
    'Najviše kraćih trka',
  ]

  it('carries all eleven lists of the rulebook, in the order it names them', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    expect(await screen.findByRole('heading', { level: 1, name: 'Top 10 liste' })).toBeVisible()

    const shown = screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent)

    expect(shown).toEqual(ELEVEN)
  })

  it('carries a board for every length, and each one stops at ten places', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    expect(await screen.findByRole('heading', { level: 1, name: 'Top 10 liste' })).toBeVisible()

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
    renderAt('/sr/top-liste?sezona=2019')

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
    renderAt('/sr/top-liste?sezona=2019')

    const rows = (await screen.findAllByRole('row')).length

    expect(rows).toBeGreaterThan(0)
    expect(board('Najduže na stazi').getAllByText(/^\d+ h \d{2}' \d{2}''$/).length).toBe(10)
  })

  it('stands the pairs board empty rather than inventing one', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('heading', { level: 2, name: 'Najbolji parovi' })
    const pairs = board('Najbolji parovi')

    expect(pairs.getByText(/stiže zajedno sa bazom/)).toBeVisible()
    expect(pairs.queryByRole('table')).not.toBeInTheDocument()
  })

  it('stands the progress board empty, and says the measure is not decided', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('heading', { level: 2, name: 'Najbolji napredak' })
    const progress = board('Najbolji napredak')

    // The rulebook names the list, but what it compares is still open (PDL
    // P28a), so the board says that rather than inventing a measure.
    expect(progress.getByText(/Merilo ove liste još nije određeno/)).toBeVisible()
    expect(progress.queryByRole('table')).not.toBeInTheDocument()
  })

  it('ranks the teams by points and leads to the team, not to a profile', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najbolji tim' })
    const teams = board('Najbolji tim')

    expect(teams.getByRole('columnheader', { name: 'Tim' })).toBeInTheDocument()
    expect(teams.getByRole('columnheader', { name: 'Članova' })).toBeInTheDocument()

    const rows = teams.getAllByRole('row').slice(1)
    expect(rows.length).toBeGreaterThan(1)
    expect(rows.length).toBeLessThanOrEqual(10)

    const points = rows.map((row) => {
      const cells = within(row).getAllByRole('cell')
      return Number(cells[cells.length - 1].textContent!.replace(/\./g, '').replace(',', '.'))
    })
    expect([...points].sort((left, right) => right - left)).toEqual(points)

    // The row is about the team, so the name leads to the team page.
    expect(within(rows[0]).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/sr/tim/'),
    )
  })

  it('narrows the team board to the chosen season like every other board', async () => {
    const user = setupUser()
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najbolji tim' })
    const before = board('Najbolji tim')
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent)

    await user.selectOptions(screen.getByLabelText('Sezona'), '2012')

    // 2012 has two results in it, and both belong to the same team.
    const after = board('Najbolji tim').getAllByRole('row').slice(1)
    expect(after).toHaveLength(1)
    expect(after.map((row) => row.textContent)).not.toEqual(before)
  })

  it('leads from every name to the profile behind it', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najviše kilometara' })
    const first = board('Najviše kilometara').getAllByRole('row')[1]

    expect(within(first).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/sr/takmicar/'),
    )
  })

  it('opens on a season of its own, and changes every board with one filter', async () => {
    const user = setupUser()
    renderAt('/sr/top-liste')

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
    renderAt('/sr/top-liste?sezona=2012')

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
    const user = setupUser()
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

  it('does not carry anybody whose fee has not been recorded', async () => {
    /* Before paying, a member has an account and is visible nowhere (PDL P8), and
       since 30.07.2026 they do not even have a member number: it is handed out at
       the moment the fee is recorded. Three of them used to sit in the member list
       as inactive members holding 000032 to 000034, and everything that reads that
       list reads all of it, so they turned up on the front page among the newest
       members. They are not members now; they wait in the queue of memberships,
       and nothing public can reach them.

       The names come out of the queue rather than being written down here. Written
       down, they were three names that competitors.json does not contain and could
       not contain, so the test could not fail whatever the generator did; asked of
       the queue, it fails the day one of the two files carries somebody the other
       one does. */
    const waiting = await loadResource<{ queue: string; who: string }[]>('verification')
    const names = waiting.filter((one) => one.queue === 'payments').map((one) => one.who)

    renderAt('/sr/takmicari')

    const list = within(await screen.findByRole('list'))
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      expect(list.queryByText(name)).not.toBeInTheDocument()
    }
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
    const user = setupUser()
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
    const user = setupUser()
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
  /** The first table on the screen is the standing; the drawers open inside it. */
  const standing = async () => within(await screen.findByRole('table'))

  it('ranks teams by the plain sum of their members', async () => {
    renderAt('/sr/timovi')

    const rows = (await standing()).getAllByRole('row').slice(1)

    expect(rows.length).toBeGreaterThan(1)
    expect(rows[0].className).toBe('podium')
  })

  it('opens a team to show who is in it and what each of them brought', async () => {
    const user = setupUser()
    renderAt('/sr/timovi')

    const toggle = (await standing()).getAllByRole('button', { name: /^Prikaži članove tima/ })[0]
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)

    const drawer = within(screen.getByRole('table', { name: /^Članovi tima/ }))
    const members = drawer.getAllByRole('row').slice(1)
    expect(members.length).toBeGreaterThan(0)
    // Each member is a link to their profile, and carries their own figures.
    expect(within(members[0]).getByRole('link')).toBeVisible()
    expect(drawer.getAllByRole('columnheader').map((one) => one.textContent)).toEqual([
      '#',
      'Član',
      'Trke',
      'd (km)',
      'Bodovi',
    ])
  })

  it('builds nothing for a drawer nobody opened, and still points at it', async () => {
    const user = setupUser()
    renderAt('/sr/timovi')

    const toggle = (await standing()).getAllByRole('button', { name: /^Prikaži članove tima/ })[0]
    const drawer = document.getElementById(toggle.getAttribute('aria-controls')!)

    /* The row is there whether the drawer is open or not, so aria-controls never
       points at nothing: a button that says it controls an element which does not
       exist is a broken promise to a screen reader.

       What is inside it is not. The drawer filters all 3522 results and ranks the
       members of its team, and a closed one did that too, on every render: fifty
       teams meant fifty passes over the whole result set for every single click. */
    expect(drawer).toBeInTheDocument()
    expect(drawer).not.toHaveTextContent(/\S/)
    expect(screen.queryByRole('table', { name: /^Članovi tima/ })).not.toBeInTheDocument()

    await user.click(toggle)
    expect(within(drawer!).getByRole('table', { name: /^Članovi tima/ })).toBeInTheDocument()

    // And it is emptied again on the way back, rather than kept for later.
    await user.click(screen.getAllByRole('button', { name: /^Sakrij članove tima/ })[0])
    expect(drawer).not.toHaveTextContent(/\S/)
  })

  it('reads one word on screen and the whole team out loud', async () => {
    renderAt('/sr/timovi')

    const toggle = (await standing()).getAllByRole('button', { name: /^Prikaži članove tima/ })[0]

    /* The sentence used to be the visible text, and it does not wrap: at 360px
       this column alone took 279 of the 661 pixels the table wanted inside a box
       328 wide, so the standing scrolled sideways (PDL P24). The team is still in
       the accessible name, because twenty buttons reading "Prikaži" are twenty
       buttons a screen reader cannot tell apart, and the visible word is the first
       word of that name, so what is heard contains what is seen (WCAG 2.2, 2.5.3). */
    expect(toggle.textContent).toBe('Prikaži')
    expect(toggle).toHaveAccessibleName(/^Prikaži članove tima \S/)
  })

  it('closes again, and says which state it is in', async () => {
    const user = setupUser()
    renderAt('/sr/timovi')

    const open = (await standing()).getAllByRole('button', { name: /^Prikaži članove tima/ })[0]
    await user.click(open)

    const close = screen.getAllByRole('button', { name: /^Sakrij članove tima/ })[0]
    expect(close).toHaveAttribute('aria-expanded', 'true')

    await user.click(close)

    expect(screen.getAllByRole('button', { name: /^Prikaži članove tima/ })[0]).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('says so for a team nobody has joined', async () => {
    const user = setupUser()
    renderAt('/sr/timovi')

    // The generator leaves one team empty on purpose, which is the case a table
    // of contributions has nothing to show for.
    await screen.findByRole('table')
    for (const toggle of screen.getAllByRole('button', { name: /^Prikaži članove tima/ })) {
      await user.click(toggle)
    }

    expect(screen.getByText('Ovaj tim još nema članova.')).toBeVisible()
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
