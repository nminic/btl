import { screen, within } from '@testing-library/react'
import { loadResource } from '../data/client'
import { hueFor } from './competitorFace'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

/* One file for the screens a visitor sees. They share a shape: read the data
 * layer, sort it, put it in a table. */

/* The standing sits at /tabela. /top-liste is the page of Top 10 boards beside
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

  it('ranks the progress by the points gained on the season before', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najbolji napredak' })
    const progress = board('Najbolji napredak')

    // The measure is the gain, so the gain is the column, with the season it is
    // measured against beside it (PDL P12, 30.07.2026).
    expect(progress.getByRole('columnheader', { name: 'Prirast' })).toBeInTheDocument()
    expect(progress.getByRole('columnheader', { name: 'Prethodna sezona' })).toBeInTheDocument()

    const gains = progress
      .getAllByRole('row')
      .slice(1)
      .map((row) => {
        const cells = within(row).getAllByRole('cell')
        return Number(cells[cells.length - 1].textContent!.replace(/\./g, '').replace(',', '.'))
      })

    expect(gains.length).toBeGreaterThan(1)
    expect(gains.length).toBeLessThanOrEqual(10)
    expect([...gains].sort((left, right) => right - left)).toEqual(gains)
  })

  it('leaves out whoever did not race the season before', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najbolji napredak' })

    /* Miloje Stanojlović scored the second most points of 2019 and ran nothing
       in 2018. Counting the season he was not there as a zero would make his
       whole score a gain and put him at the top of a board about improvement,
       which is the one thing a board about improvement must not do (PDL P12,
       30.07.2026). He is on the boards that measure the season itself. */
    expect(board('Najbolji napredak').queryByText('Miloje Stanojlović')).not.toBeInTheDocument()
    expect(board('Najviše kilometara').getByText('Miloje Stanojlović')).toBeVisible()
  })

  it('stands the progress board empty for a season nobody has a season before', async () => {
    renderAt('/sr/top-liste?sezona=2010')

    await screen.findByRole('heading', { level: 2, name: 'Najbolji napredak' })
    const progress = board('Najbolji napredak')

    /* 2010 is the first season with any results at all, so there is nothing to
       measure a gain against and the board says which rules left it empty. Both
       of them: a season in which everybody ran and nobody bettered their total
       is just as empty, and a sentence naming only the first tells that season
       that nobody ran (PDL P12, 30.07.2026). */
    expect(progress.getByText(/trčao i prethodne sezone i popravio njen zbir/)).toBeVisible()
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
  it('opens on the newest season this person raced, not on all of them', async () => {
    /* Owner's design decision, 30.07.2026. Member 000021 has two hundred and
       seventy-seven results; opening on all of them is twenty-three screens on a
       telephone, and the counters above were career totals under a heading that
       names a season. All seasons is one choice away. */
    renderAt('/sr/takmicar/000007')

    await screen.findByRole('heading', { level: 1 })
    const season = screen.getByLabelText('Sezona') as HTMLSelectElement
    const years = within(season)
      .getAllByRole('option')
      .map((one) => Number(one.getAttribute('value')))
      .filter((one) => !Number.isNaN(one))

    // The newest of them, named: "not all seasons" would pass on the oldest.
    expect(season.value).toBe(String(Math.max(...years)))
    /* The widget wears no heading any more (owner, 31.07.2026): the season is
       chosen above it and the ring beside it carries the race count. It keeps
       its name where a screen reader can still find it. */
    expect(screen.getByRole('region', { name: 'Zbirna statistika' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Zbirna statistika' })).not.toBeInTheDocument()
    /* And it counts everything except the races, which the ring beside it
       carries. The number itself is not lost: it is in the ring's own reading,
       which is what a screen reader gets instead of the drawing. */
    expect(screen.queryByText(/Odtrčanih trka/)).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('table', { name: 'Trke po dužini' })).getByRole('rowheader', {
        name: 'Zbirno',
      }).parentElement,
    ).toHaveTextContent(/\d+ trk/)
    expect(within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row').length)
      .toBeGreaterThan(1)
  })

  it('chooses the season inside the control that names the part', async () => {
    /* The season used to sit on a rule of its own with a sentence under it
       saying what it governed. Both are gone; the control that says "Pregled"
       carries it (owner, 31.07.2026). */
    renderAt('/sr/takmicar/000007')

    await screen.findByRole('heading', { level: 1 })
    const parts = screen.getByRole('navigation', { name: 'Delovi profila' })

    expect(within(parts).getByLabelText('Sezona')).toBeVisible()
    expect(screen.queryByText(/Sezona se bira jednom/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Izbor sezone važi za sve/)).not.toBeInTheDocument()
  })

  it('narrows only the table by length, and leaves the widgets on the season', async () => {
    /* The season governs everything on the page; the length governs the table
       and nothing else. A donut narrowed to marathons is a chart with one
       segment, and a scoreboard quietly showing marathon kilometres under a
       heading that names a season is a number meaning whatever the reader
       guesses. */
    const user = setupUser()
    renderAt('/sr/takmicar/000007?sezona=sve')

    await screen.findByRole('heading', { level: 1 })
    const all = within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row').length

    /* What the ring says before and after, read whole. Naming one length would
       not do any more: the ring names only the lengths this person has run, so
       an anchor row is not guaranteed to be there. Reading every row also makes
       the check stronger, because narrowing the ring to marathons would show up
       as rows disappearing, not merely as one number changing. */
    const ring = () =>
      within(screen.getByRole('table', { name: 'Trke po dužini' }))
        .getAllByRole('row')
        .map((row) => row.textContent)
    const before = ring()

    expect(before.length).toBeGreaterThan(1)

    await user.click(screen.getByRole('button', { name: 'Maraton 42,2 km' }))

    expect(within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row').length)
      .toBeLessThan(all)
    expect(ring()).toEqual(before)
  })

  it('lets a filter go again', async () => {
    const user = setupUser()
    renderAt('/sr/takmicar/000007?sezona=sve')

    await screen.findByRole('heading', { level: 1 })
    const all = within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row').length

    await user.selectOptions(screen.getByLabelText('Sezona'), '2020')
    expect(within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row').length)
      .toBeLessThan(all)

    await user.selectOptions(screen.getByLabelText('Sezona'), 'sve')
    expect(within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row')).toHaveLength(
      all,
    )
  })

  it('shows a season from the address that this person has nothing in', async () => {
    /* The select is built from the seasons they raced, so a season named in the
       address matched no option and the control drew itself empty. */
    renderAt('/sr/takmicar/000007?sezona=2010')

    await screen.findByRole('heading', { level: 1 })
    expect((screen.getByLabelText('Sezona') as HTMLSelectElement).value).toBe('2010')
  })

  it('gives the heading back to the name and puts the club in the line below', async () => {
    /* Owner, 31.07.2026. The club spent a day in brackets inside the heading and
       now stands after how long this person has been in the league: "U ligi od
       2014. · U klubu Dunavski trkači od 2014." Two different facts, said the
       way anybody would say them. */
    renderAt('/sr/takmicar/000001')

    const heading = await screen.findByRole('heading', { level: 1 })

    expect(heading.textContent).not.toMatch(/[()]/)
    expect(within(heading).queryByRole('link')).not.toBeInTheDocument()

    const club = screen.getByText(/U klubu/)
    expect(club.textContent).toMatch(/U klubu .+ od \d{4}\./)
    expect(within(club).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/tim/'),
    )
    expect(screen.getByText(/U ligi od \d{4}\./)).toBeVisible()
  })

  it('says nothing about a club for somebody who is in none', async () => {
    // 000002 has no team, and empty brackets or a year with nothing to belong
    // to would both be worse than the plain fact.
    renderAt('/sr/takmicar/000002')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText('Bez tima')).toBeVisible()
    expect(screen.queryByText(/U klubu/)).not.toBeInTheDocument()
  })

  it('leads to what the competitor has won, and back', async () => {
    const user = setupUser()
    renderAt('/sr/takmicar/000001')

    await screen.findByRole('heading', { level: 1 })
    await user.click(screen.getByRole('link', { name: 'Priznanja i nagrade' }))

    expect(await screen.findByRole('heading', { name: /Pehari i plakete/ })).toBeVisible()
    // Not season-scoped: what is won is never taken away (PDL P11).
    expect(screen.queryByLabelText('Sezona')).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Pregled' }))
    expect(await screen.findByRole('region', { name: 'Zbirna statistika' })).toBeVisible()
  })

  it('shows the biography beside the widgets where there is one', async () => {
    /* Named "Svojim rečima" rather than "Biografija" (owner, 31.07.2026): the
       box holds a paragraph the member wrote about themselves, and a biography
       promises a page. */
    renderAt('/sr/takmicar/000001')

    expect(await screen.findByRole('heading', { name: 'Svojim rečima' })).toBeVisible()
  })

  it('draws no biography card for the members who have not written one', async () => {
    // Most of them, which is the state the row has to look right in.
    renderAt('/sr/takmicar/000002')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('heading', { name: 'Svojim rečima' })).not.toBeInTheDocument()
  })

  it('hides the profile of a member who is no longer active', async () => {
    /* PDL P11: "Nigde na portalu nema vidljiv profil", "softverski je sakriven
       kao da ne postoji". Nothing read the flag, so the profile of somebody who
       had left was public; there was no such member in the data either, so the
       rule had nothing to be checked against. 000032 is one now. */
    renderAt('/sr/takmicar/000032')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovog takmičara nema.' }),
    ).toBeVisible()
  })

  it('names on the ring only the lengths this person has run', async () => {
    /* It used to draw all five whatever the counts were, so most profiles
       carried three rows reading nought (owner, 31.07.2026). Checked against the
       table of results rather than against a fixed number, or this passes on any
       count at all. */
    renderAt('/sr/takmicar/000007?sezona=sve')

    const chart = await screen.findByRole('table', { name: 'Trke po dužini' })
    // Everything the ring names, less the total, which is not a length.
    const named = within(chart)
      .getAllByRole('rowheader')
      .map((one) => one.textContent)
      .filter((one) => one !== 'Zbirno')

    const results = within(screen.getByRole('table', { name: 'Rezultati' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[2].textContent)

    expect(named.length).toBeGreaterThan(0)
    expect(named.length).toBeLessThan(5)
    expect([...named].sort()).toEqual([...new Set(results)].sort())
  })

  it('says which of the four kinds of nothing it is', async () => {
    /* Never raced at all is a different fact from raced but not this season, and
       a reader told the wrong one goes looking for a fault. */
    renderAt('/sr/takmicar/000007?sezona=2010')

    expect(await screen.findByText('U sezoni 2010. nema nijednog rezultata.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Poništi filtere' })).toBeVisible()
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
    // Nothing to filter, so nothing to reset.
    expect(screen.queryByRole('button', { name: 'Poništi filtere' })).not.toBeInTheDocument()
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
    // The fourth period ends on 30 September, because on 1 October the next
    // season goes on sale (owner, 30.07.2026).
    expect(screen.getByText('1. januara do 30. septembra')).toBeInTheDocument()
    expect(screen.getByText(/35 EUR/)).toBeInTheDocument()
    expect(screen.getAllByText(/40 EUR/)).toHaveLength(2)
    expect(screen.getByText('6.000 RSD')).toBeInTheDocument()
    expect(screen.getByText('(bez prava na rangiranje)')).toBeInTheDocument()
    /* The period of looking around, 15 to 30 September 2026, is not a price and
       has no row; it is explained underneath the table. The fourth row does end
       in September, which is a different September: from 1 October the next
       season goes on sale (owner, 30.07.2026). */
    expect(
      within(screen.getByRole('table')).queryByText(/15\. do 30\. septembra/),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/Od 15\. do 30\. septembra/)).toBeVisible()
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

describe('a member whose fee has run out, in the tables', () => {
  it('stands in the season they raced, with the name but no link', async () => {
    /* PDL P11 has two halves and this is both of them at once: the name stays
       in the table of the season they were a member of, and the link goes,
       because the profile it pointed at is hidden as though it did not exist.
       000032 raced in 2017 and their fee has since run out. */
    // Read on a day well after 2017, so that season is history.
    renderAt('/sr/tabela?sezona=2017', 'visitor', null, undefined, '2026-06-01')

    const table = await screen.findByRole('table')
    const gone = within(table).getByText(/Vojislav Antonijević/)

    expect(gone).toBeVisible()
    expect(
      within(table).queryByRole('link', { name: /Vojislav Antonijević/ }),
    ).not.toBeInTheDocument()
    // Everybody else still has one, or this would pass on a table with no links.
    expect(within(table).getAllByRole('link').length).toBeGreaterThan(0)
  })

  it('is not in the table of the season that is running now', async () => {
    /* The same table, the same season, read on two different days. 000032 raced
       in 2017 and their fee has since run out, so on a day in 2017 that table is
       the season now and they are not in it; on a day after it, it is history
       and they are.
     *
     * Read through the simulated clock and not through the SEASON constant. The
     * constant is 2027 for ever: on the day 2027 became history it would have
     * gone on hiding them from the one archive table the league had, and would
     * never have hidden them from 2028. */
    renderAt('/sr/tabela?sezona=2017', 'visitor', null, undefined, '2017-06-01')

    await screen.findByRole('table')
    expect(screen.queryByText(/Vojislav Antonijević/)).not.toBeInTheDocument()
  })
})
