import { slugify } from './rulebookToc'
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import { loadResource } from '../data/client'
import type { BtlEvent, League } from '../data/types'
import { at, first, last, must } from '../test/at'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'

describe('TeamDetail', () => {
  it('says a team had nobody that season, which is not the same as never having anybody', async () => {
    /* Nišavski maraton klub has five members today and none of them had joined
       by 2014, a season the control offers because those same people were racing
       then, under nobody's colours. The sentence has to tell those two silences
       apart: a team nobody has ever joined, and a team that had nobody that
       year. */
    renderAt('/sr/tim/nisavski-maraton-klub?sezona=2014', 'visitor', null, undefined, '2026-06-01')

    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible()
    expect(screen.getByText('Ovaj tim te sezone nije imao članova.')).toBeVisible()
    expect(screen.queryByText('Ovaj tim još nema članova.')).not.toBeInTheDocument()
  })

  it('shows the team, its totals and its members with what each contributed', async () => {
    /* Vardarski krug in 2026: five in the team that season, four of whom raced.
       Dunavski trkači was the example until the roster was scoped to the season
       being read, which took away the member who joins for 2027 and with them
       the row of zeros this case is about. */
    renderAt('/sr/tim/vardarski-krug', 'visitor', null, undefined, '2026-06-01')

    expect(await screen.findByRole('heading', { level: 1, name: 'Vardarski krug' })).toBeVisible()
    /* Three of one width across the top (owner, 31.07.2026): what the team says
       about itself, the ring of lengths, the figures. The figures wear no
       heading any more, the same as on a profile, and keep their name where a
       screen reader finds it. */
    expect(screen.getByRole('heading', { name: 'O timu' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Zbirna statistika' })).toBeVisible()

    const rows = within(screen.getByRole('table', { name: 'Članovi' }))
      .getAllByRole('row')
      .slice(1)
    expect(rows.length).toBeGreaterThan(1)

    // Ordered by what each member brought, and the top three marked. The last
    // row is a member who has not raced yet, and shows zeros rather than a gap.
    expect(first(rows).className).toBe('podium')
    expect(last(rows)).toHaveTextContent('0,00')
  })

  it('leads from a member back to their profile', async () => {
    renderAt('/sr/tim/dunavski-trkaci')

    const rows = within(await screen.findByRole('table', { name: 'Članovi' }))
      .getAllByRole('row')
      .slice(1)

    expect(within(first(rows)).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/sr/takmicar/'),
    )
  })

  it('holds up for a team nobody has joined yet', async () => {
    renderAt('/sr/tim/novoosnovani-tim')

    expect(await screen.findByRole('heading', { level: 1, name: 'Novoosnovani tim' })).toBeVisible()
    expect(screen.getByText('Ovaj tim još nema članova.')).toBeVisible()
  })

  it('says so when the team does not exist', async () => {
    renderAt('/sr/tim/nepostojeci')

    expect(await screen.findByRole('heading', { level: 1, name: 'Ovog tima nema.' })).toBeVisible()
  })

  it('is reachable from the list of teams', async () => {
    const user = setupUser()
    renderAt('/sr/timovi')

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)
    await user.click(first(within(first(rows)).getAllByRole('link')))

    expect(await screen.findByRole('heading', { name: 'O timu' })).toBeVisible()
  })
})

describe('EventDetail, the results of the league members who ran it', () => {
  /* The event used to end at its list of races, so the most natural route on the
     portal (calendar, day, event) answered nothing about anybody. PDL P10 asked
     for this outright and the owner asked for it again on 31.07.2026, from the
     other end: the name of a race on a profile is a link, and this is where it
     leads. */
  const RAN = '/sr/kalendar/jagodinski-maraton-2017'

  it('lists everyone who ran, best first', async () => {
    renderAt(RAN)

    const table = await screen.findByRole('table', { name: 'Rezultati članova' })
    const points = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => Number(must(at(within(row).getAllByRole('cell'), 4).textContent, 'text').replace(',', '.')))

    expect(points.length).toBeGreaterThan(1)
    expect([...points].sort((left, right) => right - left)).toEqual(points)
  })

  it('carries a link to the profile of everyone whose membership is live', async () => {
    renderAt(RAN)

    const table = await screen.findByRole('table', { name: 'Rezultati članova' })
    const links = within(table).getAllByRole('link')

    expect(links.length).toBeGreaterThan(0)
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('/sr/takmicar/'))
  })

  it('keeps the name of a member who has left, and takes away only the link', async () => {
    /* PDL P11: the profile is hidden as though it did not exist, but the history
       did happen, so the name stays in the table of the season they raced in.
       000032 is the one such member in the data, and until now they had no
       results at all, so this half of the rule had nothing to stand on. */
    renderAt(RAN)

    const table = await screen.findByRole('table', { name: 'Rezultati članova' })
    const gone = within(table).getByText('Vojislav Antonijević')

    expect(gone).toBeVisible()
    expect(within(gone).queryByRole('link')).not.toBeInTheDocument()
    expect(
      within(table).queryByRole('link', { name: 'Vojislav Antonijević' }),
    ).not.toBeInTheDocument()
  })

  it('says nothing at all about results for a race nobody has run yet', async () => {
    /* The whole of next season is like this, and "no results" on every one of
       those screens would mean nothing but "not yet". Read on a day before the
       race and not on whatever day the machine happens to hold: left to the real
       clock this test quietly turns into its own opposite on 17.01.2027. */
    renderAt('/sr/kalendar/sidski-novogodisnji-maraton-2027', 'visitor', null, undefined, '2026-12-01')

    await screen.findByRole('heading', { level: 1 })

    /* The results have to have arrived before their absence means anything. The
       heading above comes from the events file; the results are a second request
       over a file of more than a megabyte, so without this the two assertions
       below ran before the section could have existed either way, and passed on
       a version that always drew the sentence. */
    await act(async () => {
      await loadResource('results')
      await loadResource('competitors')
    })

    expect(screen.queryByRole('table', { name: 'Rezultati članova' })).not.toBeInTheDocument()
    expect(screen.queryByText('Sa ovog događaja nema unetih rezultata.')).not.toBeInTheDocument()
  })

  it('says so once that same race is in the past and still has nobody in it', async () => {
    /* The same event, read on a day after it was run. Then the silence stops
       being "not yet" and becomes a fact: the league was not there. Read through
       the simulated clock, which is the only way the portal is allowed to know
       what day it is (ADL A7). */
    renderAt('/sr/kalendar/sidski-novogodisnji-maraton-2027', 'visitor', null, undefined, '2027-06-01')

    expect(await screen.findByText('Sa ovog događaja nema unetih rezultata.')).toBeVisible()
    expect(screen.queryByRole('table', { name: 'Rezultati članova' })).not.toBeInTheDocument()
  })

  it('keeps a result whose member is not on the list, under the number it carries', async () => {
    /* Nothing in the generated data does this, and nothing should: every result
       belongs to a member. But the two files arrive in two requests, and a
       member list that is a moment behind the results would otherwise drop rows
       from a published table without a word. The row stays, under the one thing
       the result itself carries. */
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (!String(input).endsWith('/competitors.json')) {
        return real(input)
      }

      const all: { memberNumber: string }[] = await (await real(input)).json()

      return new Response(JSON.stringify(all.filter((one) => one.memberNumber !== '000001')), {
        status: 200,
      })
    })

    /* Put back whatever happens above, or a failing assertion leaves every later
       test in this file reading a member list with somebody cut out of it. The
       stub is installed once when the module loads, not per test. */
    try {
      renderAt(RAN)

      const table = await screen.findByRole('table', { name: 'Rezultati članova' })

      expect(within(table).getAllByText('000001').length).toBeGreaterThan(0)
      expect(within(table).queryByText('Vladan Đurišić')).not.toBeInTheDocument()
    } finally {
      globalThis.fetch = real
    }
  })

  it('is where the name of a race on a profile leads, and it has that runner in it', async () => {
    const user = setupUser()
    renderAt('/sr/takmicar/000001?sezona=sve')

    // Whose profile this is, taken from the screen rather than written down, so
    // the test does not have to be edited when the generated names change.
    const runner = must((await screen.findByRole('heading', { level: 1 })).textContent, 'text')
    const results = screen.getByRole('table', { name: 'Rezultati' })
    // Row 1 is the first result under the heading row, whichever race it is.
    const firstResult = at(within(results).getAllByRole('row'), 1)
    const race = first(within(firstResult).getAllByRole('link'))
    const event = must(race.textContent, 'text')

    await user.click(race)

    expect(await screen.findByRole('heading', { level: 1, name: event })).toBeVisible()

    /* The round trip is the point: the race a person ran leads to the event, and
       the event names that same person. Anything less would pass on an event
       table drawn from the wrong race. */
    const table = await screen.findByRole('table', { name: 'Rezultati članova' })
    /* All of them: one person can appear twice on one event, having run two of
       its races, and both rows are theirs. */
    const mine = within(table).getAllByRole('link', { name: runner })

    expect(mine.length).toBeGreaterThan(0)
    for (const one of mine) {
      /* The address carries the name now (PDL P11, pages/profileAddress.ts), and
         the name is read off the heading like everything else in this test, so a
         change in the generated data says so instead of quietly moving the link. */
      expect(one).toHaveAttribute('href', `/sr/takmicar/000001-${slugify(runner)}`)
    }
  })

  it('draws no table of races for an event that has none', async () => {
    /* Owner, 23.08.2026: a gathering and a training „i dalje stoji u kalendaru, može
       se otvoriti, i pokazuje detalje, opis i link ka strani organizatora ako
       postoji, ali bez trka".

       Measured by a round before this was here: a gathering drew a table with four
       headings and no rows, which is exactly the „a race whose distances nobody has
       entered yet" that its tile in the calendar was given its own colour to deny,
       so the tile and the page said opposite things. */
    const events = await loadResource<BtlEvent[]>('events')
    const gathering = must(
      events.find((one) => one.kind === 'gathering'),
      'a gathering in the data',
    )

    renderAt(`/sr/kalendar/${gathering.slug}`)

    expect(await screen.findByRole('heading', { level: 1, name: gathering.name })).toBeVisible()
    expect(screen.queryByRole('table', { name: /^Trke/ })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Dužina' })).toBeNull()

    /* And a race still has one, so this is not a page that lost its table for
       everybody. */
    const race = must(
      events.find((one) => one.kind === 'race'),
      'a race in the data',
    )

    cleanup()
    renderAt(`/sr/kalendar/${race.slug}`)

    expect(await screen.findByRole('table', { name: /^Trke/ })).toBeVisible()
  })
})

describe('LeagueDetail', () => {
  /* **The page of one competition is its name, the half of the field being read, and the
     standing** (owner, 07.09.2026): „na strani Lige ne postoje propozicije i nagrade (one se vide
     samo na listi svih liga), pa ni događaji koji ulaze u ligu, a ni dugme rezultati jer se odmah
     prikazuju rezultati."

     Three cases went with that sentence rather than being rewritten: the table of events that
     count, the column counting each event's races, and the nav between two parts. What the second
     of them was really about — that a count is read off the races and never off a list an event
     carries — is not lost: the standing itself is built that way (`league/leagueTable.ts`), and
     the number of entrants on the list of competitions is read off the very rows that standing
     draws. */

  it('shows the rules and the prizes on the list of competitions, and not on the page', async () => {
    /* Owner, 07.09.2026: „Propozicije i Nagrade treba da se izlistavaju na ovoj strani, a ne kad
       se uđe u ligu." RunTrace is the competition that carries both. */
    renderAt('/sr/lige?sezona=2027')

    expect(await screen.findByRole('heading', { name: 'Propozicije' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Nagrade' })).toBeVisible()

    cleanup()
    renderAt('/sr/liga/runtrace-2027')

    await screen.findByRole('heading', { level: 1, name: /RunTrace liga 2027/ })
    expect(screen.queryByRole('heading', { name: 'Propozicije' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Nagrade' })).not.toBeInTheDocument()
  })

  it('says how many events count and how many people are in it', async () => {
    /* Owner, 07.09.2026: „Osim sezone i broja događaja, treba da bude i Učesnika". Held against
       the files rather than against a number written here, and „Učesnika" against the standing
       itself: the owner said it is „Koliko ih je u tabeli", so the list and the page behind it
       cannot disagree without one of them being wrong. */
    renderAt('/sr/lige?sezona=2019')

    const box = must(
      (await screen.findByRole('heading', { level: 2, name: /Brdska liga 2019/ })).closest('li'),
      'the box of the competition',
    )
    const leagues = await loadResource<League[]>('leagues')
    const league = must(
      leagues.find((one) => one.slug === 'brdska-2019'),
      'takmičenje brdska-2019',
    )

    expect(within(box).getByText(new RegExp(`Sezona 2019`))).toBeVisible()
    expect(box.textContent).toContain(`Događaja: ${league.eventIds.length}`)

    /* **Waited for, because it arrives after the box does** (review, 07.09.2026). „Učesnika" is
       worked out of the three heaviest files on the portal, and the list no longer waits on them:
       the names, the seasons, the terms and the prizes draw out of the one small file, and this
       number fills in behind them. Read at once, it is still empty, which is what the screen
       deliberately shows while the answer is coming. */
    await waitFor(() => {
      expect(box.textContent).toMatch(/Učesnika: \d/)
    })

    const said = must(box.textContent, 'the line of facts')

    cleanup()

    /* And „Učesnika" against the standing itself, counted the way a reader would: both halves of
       the field, because the list carries one number for the competition and not one per gender.
       Neither half is the answer on its own, and that is the mutation this is written against:
       the men alone are a number the box could plausibly carry. */
    const user = setupUser()

    renderAt('/sr/liga/brdska-2019')

    const men = placings(await screen.findByRole('table', { name: 'Poredak takmičenja' })).length

    await user.click(screen.getByRole('button', { name: 'Žene' }))

    const women = placings(await screen.findByRole('table', { name: 'Poredak takmičenja' })).length

    expect(men, 'the men are the whole field').toBeGreaterThan(0)
    expect(women, 'the women are the whole field').toBeGreaterThan(0)
    expect(said).toContain(`Učesnika: ${String(men + women)}`)
  }, SLOW)

  it('hides both sections while neither has been written', async () => {
    /* The competition nobody has written anything about yet, and a visitor, who has no pencil to
       be offered. RunTrace carries the written text, so the two cases are two competitions rather
       than one. */
    renderAt('/sr/lige?sezona=2027')

    await screen.findAllByRole('heading', { level: 2 })
    expect(screen.queryAllByRole('heading', { name: 'Propozicije' })).toHaveLength(1)
  })

  it('holds up for a league with no events yet', async () => {
    renderAt('/sr/liga/planinska-2027')

    expect(await screen.findByRole('heading', { level: 1, name: /Planinska liga/ })).toBeVisible()
    expect(
      await screen.findByText('Na ovom takmičenju još nema nijednog rezultata.'),
    ).toBeVisible()
  })

  it('says so when nothing runs alongside the league', async () => {
    // Only the main league exists, and that one is never listed.
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/leagues.json')
        ? new Response(
            JSON.stringify([
              {
                id: 'league-btl-2027',
                slug: 'btl-2027',
                name: 'RunTrace liga 2027',
                season: 2027,
                rules: '',
                prizes: '',
                eventIds: [],
              },
            ]),
            { status: 200 },
          )
        : real(input))

    renderAt('/sr/lige')

    expect(await screen.findByText('Trenutno nema nijednog dodatnog takmičenja.')).toBeVisible()
    globalThis.fetch = real
  })

  it('says so when the league does not exist', async () => {
    renderAt('/sr/liga/nepostojeca')

    expect(await screen.findByRole('heading', { level: 1, name: 'Ove lige nema.' })).toBeVisible()
  })

  it('is reachable from the list of leagues, and opens on the standing', async () => {
    const user = setupUser()
    renderAt('/sr/lige?sezona=2027')

    await user.click(await screen.findByRole('link', { name: /RunTrace liga/ }))

    expect(await screen.findByRole('heading', { level: 1, name: /RunTrace liga/ })).toBeVisible()
    /* No nav between parts, and no button to the results: „a ni dugme rezultati jer se odmah
       prikazuju rezultati" (owner, 07.09.2026). */
    expect(screen.queryByRole('navigation', { name: 'Delovi takmičenja' })).toBeNull()
  })
})


/**
 * The rows of the competition grid that are people.
 *
 * Every row of the body is a placing since 07.09.2026, when the two blocks became one chosen half
 * and the heading that used to open each block went with them. The head of the table is still a
 * row and is still not a placing.
 *
 * Told apart by role and not by position: a placing carries a heading of its own row, the
 * runner's name, and cells beside it; the head of the table carries column headings and no cells.
 */
const placings = (grid: HTMLElement): HTMLElement[] =>
  within(grid)
    .getAllByRole('row')
    .filter(
      (row) =>
        within(row).queryAllByRole('rowheader').length > 0 &&
        within(row).queryAllByRole('cell').length > 0,
    )

describe('a competition, on one page', () => {
  /* Owner, 31.07.2026 for the grid and 07.09.2026 for the page being one: the standing is a grid,
     with everybody who ran down the side and every event of the competition across the top. The
     data has one competition that has actually been run; the three of 2027 are necessarily empty,
     which is why one was added.

     The second address (`/liga/:slug/rezultati`) named the same page as the first once the parts
     collapsed into one, so it is gone rather than kept as an alias: two addresses for one page is
     what the portal refuses everywhere else (P11). */
  const RUN = '/sr/liga/brdska-2019'

  it('opens on the standing, with the total in the second column', async () => {
    renderAt(RUN)

    const grid = await screen.findByRole('table', { name: 'Poredak takmičenja' })
    const heads = within(grid)
      .getAllByRole('columnheader')
      .map((one) => one.textContent)

    expect(heads[0]).toBe('Član')
    expect(heads[1]).toBe('Bodovi')
    // Everything after the first two is a race of the competition.
    expect(heads.length).toBeGreaterThan(2)
  })

  it('orders the half being read by that second column, highest first', async () => {
    /* One half at a time since 07.09.2026, so the question is the whole table's again, as it was
       before the two blocks stood one under the other. What has not changed is that a competition
       ranks nobody against somebody of the other gender: the ranking is inside the half, and the
       half is what the screen draws. */
    renderAt(RUN)

    const grid = await screen.findByRole('table', { name: 'Poredak takmičenja' })
    const totals = placings(grid).map((row) =>
      Number(must(first(within(row).getAllByRole('cell')).textContent, 'text').replace(',', '.')),
    )

    expect(totals.length, 'the standing has nobody in it').toBeGreaterThan(1)
    expect([...totals].sort((left, right) => right - left), 'the standing is out of order').toEqual(
      totals,
    )
  })

  it('leaves the cell of a race somebody did not run empty', async () => {
    renderAt(RUN)

    const grid = await screen.findByRole('table', { name: 'Poredak takmičenja' })
    const cells = placings(grid).flatMap((row) =>
      within(row).getAllByRole('cell').slice(1).map((cell) => cell.textContent),
    )

    // Nought would say they ran it and scored nothing.
    expect(cells.some((one) => one === '')).toBe(true)
    expect(cells.some((one) => one === '0,00')).toBe(false)
  })

  it('carries nothing but the name, the control and the standing', async () => {
    /* The whole of the owner's sentence of 07.09.2026, as one list of what is not here: no terms,
       no prizes, no table of the events that count, and no nav between parts. */
    renderAt(RUN)

    await screen.findByRole('table', { name: 'Poredak takmičenja' })

    expect(screen.queryByRole('heading', { name: 'Propozicije' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Nagrade' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Događaji koji ulaze u ligu' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Delovi takmičenja' })).toBeNull()
    /* And the one control that is here: which half of the field is being read. */
    expect(screen.getByRole('button', { name: 'Žene' })).toBeVisible()
  })

  it('says so plainly for a competition that has not been run', async () => {
    renderAt('/sr/liga/runtrace-2027')

    expect(await screen.findByText('Na ovom takmičenju još nema nijednog rezultata.')).toBeVisible()
  })
})

describe('the grid of a competition, in the details the review found unguarded', () => {
  const RUN = '/sr/liga/brdska-2019'

  it('names each row by its runner, as a heading of that row', async () => {
    renderAt(RUN)

    const grid = await screen.findByRole('table', { name: 'Poredak takmičenja' })
    const rows = placings(grid)

    /* A grid of bare cells leaves a screen reader reading numbers with nothing
       to attach them to. Every row is named by the person it belongs to. */
    expect(within(first(rows)).getByRole('rowheader')).toBeInTheDocument()
    expect(rows.every((row) => within(row).queryAllByRole('rowheader').length === 1)).toBe(true)
  })

  it('shows in the second column the sum of the cells beside it', async () => {
    renderAt(RUN)

    const grid = await screen.findByRole('table', { name: 'Poredak takmičenja' })
    const number = (text: string | null) =>
      text === null || text === '' ? 0 : Number(text.replace(/\./g, '').replace(',', '.'))

    /* A loop over nothing passes, and this one can now walk nothing: before the
       standing was split it read every row but the first, and a mutation that
       turned the runners' names into ordinary cells failed it on `Number(...)`
       being NaN. Reading placings by role, that same mutation leaves an empty
       list and a green test. Counted first, so the walk means something. */
    const rows = placings(grid)

    expect(rows.length, 'the standing has nobody in it').toBeGreaterThan(1)

    for (const row of rows) {
      const cells = within(row).getAllByRole('cell')
      const shown = number(first(cells).textContent)
      const races = cells.slice(1).reduce((sum, cell) => sum + number(cell.textContent), 0)

      /* Two decimals of rounding per cell, and up to sixteen cells. A reader has
         to be able to add the row up and land on the total. */
      expect(Math.abs(shown - races)).toBeLessThan(0.01)
    }
  })

  it('carries no link to a profile that is not there', async () => {
    /* PDL P11 on this screen too. The grid is one of five lists of a season and
       the rule is kept on the other four. */
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (!String(input).endsWith('/competitors.json')) {
        return real(input)
      }

      const all: { active: boolean }[] = await (await real(input)).json()

      return new Response(JSON.stringify(all.map((one) => ({ ...one, active: false }))), {
        status: 200,
      })
    })

    try {
      renderAt(RUN)

      const grid = await screen.findByRole('table', { name: 'Poredak takmičenja' })
      /* Asked of the body and not of the whole table, since 07.09.2026: every column heading is
         now a way to that event's page, so a question asked of the table would answer about those
         instead. What is asked here is whether a name in the standing leads anywhere. */
      const body = must(within(grid).getAllByRole('rowgroup')[1], 'the body of the standing')

      expect(within(body).getAllByRole('rowheader').length).toBeGreaterThan(0)
      expect(within(body).queryAllByRole('link')).toHaveLength(0)
    } finally {
      globalThis.fetch = real
    }
  })

  it('leaves out of the season now anyone whose fee has run out', async () => {
    /* Read on a day inside 2019, so that competition is the season running. The
       one member this is true of raced in 2017, so the list is made inactive to
       give the rule something to act on. */
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (!String(input).endsWith('/competitors.json')) {
        return real(input)
      }

      const all: { active: boolean }[] = await (await real(input)).json()

      return new Response(JSON.stringify(all.map((one) => ({ ...one, active: false }))), {
        status: 200,
      })
    })

    try {
      renderAt(RUN, 'visitor', null, undefined, '2019-06-01')

      expect(
        await screen.findByText('Na ovom takmičenju još nema nijednog rezultata.'),
      ).toBeVisible()
    } finally {
      globalThis.fetch = real
    }
  })
})

describe('the control that names the parts of a record', () => {
  it('carries the query from one part to the other', async () => {
    /* The whole reason the profile's season survives a trip to the trophies and
       back. Nothing was holding it. */
    renderAt('/sr/takmicar/000007?sezona=2010')

    await screen.findByRole('heading', { level: 1 })
    const parts = screen.getByRole('navigation', { name: 'Delovi profila' })

    for (const link of within(parts).getAllByRole('link')) {
      expect(link.getAttribute('href')).toContain('?sezona=2010')
    }
  })

  it('marks the part that is open, and only that one', async () => {
    renderAt('/sr/takmicar/000007/priznanja')

    const parts = await screen.findByRole('navigation', { name: 'Delovi profila' })
    const open = within(parts)
      .getAllByRole('link')
      .filter((one) => one.getAttribute('aria-current') !== null)

    /* Without `end` on the first one, the overview counts itself as open on
       every part below it and both are marked at once. */
    expect(open).toHaveLength(1)
    expect(first(open).textContent).toBe('Priznanja i nagrade')
  })
})

/**
 * What the organiser says the event is, and where they say the rest of it.
 *
 * Both fields were added to the form on 23.08.2026 and carried onto a copy from
 * that same day, and until 27.08.2026 no screen drew either: the address was
 * stored, could not be opened, and so was a record rather than a link. Owner,
 * 23.08.2026, on what an event's page shows even when it has no races at all: it
 * „pokazuje detalje, opis i link ka strani organizatora ako postoji, ali bez
 * trka".
 *
 * Served rather than read. No event in the generated file carries either field,
 * measured over all 1166 of them, so every one of these questions read off the
 * file has the same answer whether the page draws them or not.
 */
describe('the description of an event and the organiser’s page', () => {
  const SLUG = 'sidski-novogodisnji-maraton-2027'
  /* A gathering, which has no races at all and is what the owner's sentence is
     about. There are three in the file and this is the first of them. */
  const GATHERING = 'btl-sreda-mart-2027'
  const SAID = 'Trka se trči po zaleđenom nasipu, sa dva prelaza preko mosta.'

  /** Serves the file of events as it is, with one event given the two fields. */
  function eventCarrying(description: string, link: string, slug: string = SLUG) {
    const served = globalThis.fetch

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const answer = await served(input, init)

      if (!String(input).endsWith('/events.json')) {
        return answer
      }

      const events: BtlEvent[] = await answer.json()

      return new Response(
        JSON.stringify(
          events.map((one) => (one.slug === slug ? { ...one, description, link } : one)),
        ),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })

    return () => {
      vi.stubGlobal('fetch', served)
    }
  }

  it('draws both, above the races rather than under them', async () => {
    const restore = eventCarrying(SAID, 'https://organizator.example/trka')

    try {
      renderAt(`/sr/kalendar/${SLUG}`, 'visitor', null, undefined, '2026-12-01')

      const said = await screen.findByText(SAID)
      const link = screen.getByRole('link', { name: /^Strana organizatora/ })

      expect(said).toBeVisible()
      expect(link).toBeVisible()

      /* Above the table, which is the order the owner's sentence gives: details,
         then the description, then the link, and the races after all of it.
         Asked of the document rather than of the stylesheet, because jsdom lays
         nothing out and would answer the same whatever the order (ADL A18). */
      const table = screen.getByRole('table', { name: 'Trke' })

      expect(
        said.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
        'the description is drawn under the table',
      ).toBeTruthy()
      expect(
        link.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
        'the link is drawn under the table',
      ).toBeTruthy()
    } finally {
      restore()
    }
  })

  it('says where the link leads, and keeps this portal out of the other end', async () => {
    const restore = eventCarrying(SAID, 'https://organizator.example/trka')

    try {
      renderAt(`/sr/kalendar/${SLUG}`, 'visitor', null, undefined, '2026-12-01')

      const link = await screen.findByRole('link', { name: /^Strana organizatora/ })

      expect(link).toHaveAttribute('href', 'https://organizator.example/trka')
      /* `noreferrer` so the address of this page does not travel to a host
         somebody else chose, `noopener` for `window.opener`. Written out rather
         than left to what browsers do for `target="_blank"`, because a rule that
         depends on a default is a rule nobody can read. */
      expect(link).toHaveAttribute('rel', 'noreferrer noopener')
      expect(link).toHaveAttribute('target', '_blank')
      /* And the host, inside the link so it is read with it. The words of this
         link are the portal's own and so cannot lie; precisely because they
         cannot, they say nothing about where the press lands. */
      expect(within(link).getByText('organizator.example')).toBeVisible()
    } finally {
      restore()
    }
  })

  it('draws no link at all where what is stored is not an address', async () => {
    /* `javascript:` in an `href` is a script running on this portal with the
       reader's session around it. The form refuses it and the screen refuses it
       again, because a form rule is a courtesy to whoever fills it in and a store
       is a place things arrive in by other roads (data/outsideLink.ts).

       Nothing rather than a repaired address, and the description still drawn, so
       what is measured is the link being refused and not the whole block going. */
    const restore = eventCarrying(SAID, 'javascript:alert(1)')

    try {
      renderAt(`/sr/kalendar/${SLUG}`, 'visitor', null, undefined, '2026-12-01')

      expect(await screen.findByText(SAID)).toBeVisible()
      expect(screen.queryByRole('link', { name: /^Strana organizatora/ })).toBeNull()
      /* And the words are not on the page either, which the question above does
         not answer. Measured by a mutation: asked only of the kind that is
         refused („is the value empty" instead of „is it an address"), the block
         is drawn, React leaves out an `href` that is `undefined`, and an anchor
         without one is not a link in the accessible tree at all. So the question
         above went on answering „no link" while the page carried the words with
         nothing behind them, which is the dead control this condition exists to
         prevent. */
      expect(screen.queryByText('Strana organizatora')).toBeNull()
      expect(screen.queryByText('organizator.example')).toBeNull()
    } finally {
      restore()
    }
  })

  it('draws neither where the event carries neither, which is every event in the file', async () => {
    /* The ordinary case, and the reason both are drawn conditionally: neither
       field is required, and an empty paragraph under the name of an event is a
       gap nobody put there. */
    renderAt(`/sr/kalendar/${SLUG}`, 'visitor', null, undefined, '2026-12-01')

    await screen.findByRole('table', { name: 'Trke' })

    expect(screen.queryByRole('link', { name: /^Strana organizatora/ })).toBeNull()
    expect(screen.queryByText(SAID)).toBeNull()

    /* And no paragraph anywhere on the page is empty, which is the question the
       two above do not answer: drawn unconditionally the block carries no text,
       so „is the description there" and „is the link there" both go on saying no
       while all 1166 event pages gain a gap under the name.

       Asked of the role, which a paragraph does have. This was written as a
       `querySelector` on the class, over a comment claiming there was no role to
       ask for, and a round measured that claim wrong on 27.08.2026. The class
       would also have passed a rename that left the element exactly as empty. */
    const empty = screen
      .queryAllByRole('paragraph')
      .filter((one) => (one.textContent ?? '').trim() === '')

    expect(empty, 'an empty paragraph is drawn').toEqual([])
  })

  it('draws both for a gathering, which has no races at all', async () => {
    /* The case the owner's sentence is actually about, and the one none of the
       four above touched: every one of them opens a race. „i dalje stoji u
       kalendaru, može se otvoriti, i pokazuje detalje, opis i link ka strani
       organizatora ako postoji, ali bez trka" (owner, 23.08.2026) is a sentence
       about a gathering, so a guard that never opens one is a guard over the
       other half of it.

       Measured by a round on 27.08.2026: with both conditions narrowed to
       `event.kind === 'race'`, a gathering stopped drawing either and 267 tests
       stayed green. */
    const restore = eventCarrying(SAID, 'https://organizator.example/trka', GATHERING)

    try {
      renderAt(`/sr/kalendar/${GATHERING}`, 'visitor', null, undefined, '2026-12-01')

      expect(await screen.findByText(SAID)).toBeVisible()
      expect(screen.getByRole('link', { name: /^Strana organizatora/ })).toBeVisible()
      /* And still no table, which is the other half of the same sentence. */
      expect(screen.queryByRole('table', { name: 'Trke' })).toBeNull()
    } finally {
      restore()
    }
  })
})
