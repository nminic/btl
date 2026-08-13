import { act, screen, within } from '@testing-library/react'
import { loadResource } from '../data/client'
import type { BtlEvent, Race } from '../data/types'
import { at, first, last, must } from '../test/at'
import { renderAt } from '../test/render'
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
      expect(one).toHaveAttribute('href', '/sr/takmicar/000001')
    }
  })
})

/** The event a row leads to, found by the address on its link. By the name it
 *  would be the wrong one: the same race is run every year and eight events
 *  carry that name. */
const eventOf = (events: BtlEvent[], row: HTMLElement) => {
  const href = within(row).getByRole('link').getAttribute('href') ?? ''

  return events.find((one) => href.endsWith(`/${one.slug}`))
}

describe('LeagueDetail', () => {
  it('lists the events that count towards the league', async () => {
    renderAt('/sr/liga/runtrace-2027')

    expect(await screen.findByRole('heading', { level: 1, name: /RunTrace liga 2027/ }))
      .toBeVisible()

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.length).toBeGreaterThan(1)
    expect(within(first(rows)).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/sr/kalendar/'),
    )
  })

  it('counts the races of each event off the races themselves', async () => {
    /* The count used to be read off a list the event carried, which only the
       generator ever filled, so a race entered by hand was one this column never
       saw (ADL A7, 06.08.2026). Read off the races, the two agree by
       construction. */
    renderAt('/sr/liga/runtrace-2027')

    await screen.findByRole('heading', { level: 1, name: /RunTrace liga 2027/ })

    const events = await loadResource<BtlEvent[]>('events')
    const races = await loadResource<Race[]>('races')
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    const found = must(
      rows
        .map((row) => ({ row, event: eventOf(events, row) }))
        .find(({ event }) => races.some((race) => race.eventId === event?.id)),
      'an event of the league that has races',
    )
    const mine = races.filter((race) => race.eventId === found.event?.id).length

    expect(mine).toBeGreaterThan(0)
    expect(within(found.row).getAllByRole('cell')[3]?.textContent).toBe(String(mine))
  })

  it('shows the rules and the prizes that have been written', async () => {
    // Both live under the second part now (owner, 31.07.2026).
    renderAt('/sr/liga/runtrace-2027')

    expect(await screen.findByRole('heading', { name: 'Propozicije' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Nagrade' })).toBeVisible()
  })

  it('hides both sections while neither has been written', async () => {
    /* The league nobody has written anything about yet. RunTrace carries the
       written text, so the two cases are two leagues rather than one. */
    renderAt('/sr/liga/planinska-2027')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('heading', { name: 'Propozicije' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Nagrade' })).not.toBeInTheDocument()
  })

  it('holds up for a league with no events yet', async () => {
    renderAt('/sr/liga/planinska-2027')

    expect(await screen.findByRole('heading', { level: 1, name: /Planinska liga/ })).toBeVisible()
    expect(screen.getByText('Ovoj ligi još nije dodeljen nijedan događaj.')).toBeVisible()
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
                groupsByCategory: true,
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

  it('is reachable from the list of leagues', async () => {
    const user = setupUser()
    renderAt('/sr/lige')

    await user.click(await screen.findByRole('link', { name: /RunTrace liga/ }))

    expect(await screen.findByRole('heading', { name: /Događaji koji ulaze u ligu/ })).toBeVisible()
  })
})

describe('a competition, in two parts', () => {
  /* Owner, 31.07.2026: the same shape the profile has. The standing is a grid,
     with everybody who ran down the side and every race across the top. The
     data has one competition that has actually been run; the three of 2027 are
     necessarily empty, which is why one was added. */
  const RUN = '/sr/liga/brdska-2019/rezultati'

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

  it('orders the rows by that second column, highest first', async () => {
    renderAt(RUN)

    const grid = await screen.findByRole('table', { name: 'Poredak takmičenja' })
    const totals = within(grid)
      .getAllByRole('row')
      .slice(1)
      .map((row) => Number(must(first(within(row).getAllByRole('cell')).textContent, 'text').replace(',', '.')))

    expect(totals.length).toBeGreaterThan(1)
    expect([...totals].sort((left, right) => right - left)).toEqual(totals)
  })

  it('leaves the cell of a race somebody did not run empty', async () => {
    renderAt(RUN)

    const grid = await screen.findByRole('table', { name: 'Poredak takmičenja' })
    const cells = within(grid).getAllByRole('row').slice(1).flatMap((row) =>
      within(row).getAllByRole('cell').slice(1).map((cell) => cell.textContent),
    )

    // Nought would say they ran it and scored nothing.
    expect(cells.some((one) => one === '')).toBe(true)
    expect(cells.some((one) => one === '0,00')).toBe(false)
  })

  it('keeps the written text on the other part, and not on this one', async () => {
    const user = setupUser()
    renderAt(RUN)

    await screen.findByRole('table', { name: 'Poredak takmičenja' })
    expect(screen.queryByRole('heading', { name: 'Propozicije' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Propozicije' }))

    expect(await screen.findByRole('heading', { name: 'Propozicije' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Nagrade' })).toBeVisible()
    // The events that count moved here too, under what is written about them.
    expect(screen.getByRole('table', { name: 'Događaji koji ulaze u ligu' })).toBeVisible()
    expect(screen.queryByRole('table', { name: 'Poredak takmičenja' })).not.toBeInTheDocument()
  })

  it('says so plainly for a competition that has not been run', async () => {
    renderAt('/sr/liga/runtrace-2027/rezultati')

    expect(await screen.findByText('Na ovom takmičenju još nema nijednog rezultata.')).toBeVisible()
  })
})

describe('the grid of a competition, in the details the review found unguarded', () => {
  const RUN = '/sr/liga/brdska-2019/rezultati'

  it('names each row by its runner, as a heading of that row', async () => {
    renderAt(RUN)

    const grid = await screen.findByRole('table', { name: 'Poredak takmičenja' })
    const rows = within(grid).getAllByRole('row').slice(1)

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

    for (const row of within(grid).getAllByRole('row').slice(1)) {
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

      expect(within(grid).getAllByRole('rowheader').length).toBeGreaterThan(0)
      expect(within(grid).queryAllByRole('link')).toHaveLength(0)
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
