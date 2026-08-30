import { SLOW } from '../../test/slow'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, screen, within } from '@testing-library/react'
import { at, first, inputElement, must } from '../../test/at'
import { moderatorWith, renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { loadResource } from '../../data/client'
import type { BtlEvent, Race } from '../../data/types'
import { copiedRace } from './copiedRace'
import { fieldDate, shiftDate } from '../../forms/dateField'
import { nextSeason } from '../admin/nextSeason'

/* What can be done with an event, from the event's own page (owner,
 * 03.08.2026): copied and deleted by whoever administers events, and reported a
 * result on by whoever is signed in.
 */

/** An event with races on it, by the address the calendar links to. */
const EVENT = '/sr/kalendar/maraton-maratona-2015'
/** The same event, named for what it is where that matters, and one that runs over
 *  two mornings. The second is what the day column is drawn for, and the only
 *  reading in which the count of columns has a part for it. */
const ONE_DAY = EVENT
const TWO_DAYS = '/sr/kalendar/balkansko-prvenstvo-veterana-2021'
/** Four mornings and the same length on each of them, which is the only shape in
 *  which a race is known by more than its length (data/raceLabel.ts). */
const FOUR_MORNINGS = '/sr/kalendar/danube-maraton-2022-03'
/** Twelve races of one name on one morning, four of which agree on the length as it
 *  is written, so this page is where a label that gives up too early is seen
 *  (data/raceLabel.ts). */
const TWELVE_RACES = '/sr/kalendar/btl-dezorijentiring-2018'

/** The table of races, which is the one named after them. */
function races(): HTMLElement {
  return screen.getByRole('table', { name: 'Trke' })
}

async function openEvent(
  role: Parameters<typeof renderAt>[1],
  member: string | null = null,
  moderator?: Parameters<typeof renderAt>[3],
  where: string = EVENT,
) {
  const rendered = renderAt(where, role, member, moderator)
  await screen.findByRole('heading', { level: 1 })

  return rendered
}

/** The sheet that decides what an empty control box costs, read rather than
 *  quoted: the rule below turns on the name of a class, and a guard that writes
 *  that name by hand goes quiet the day the class is renamed. */
const rankingsCss = readFileSync(join(process.cwd(), 'src/pages/Rankings.css'), 'utf-8')

describe('who is offered what on an event', () => {
  it('offers a visitor nothing at all, and no column to put it in', async () => {
    await openEvent('visitor')

    for (const name of ['Kopiranje', 'Brisanje']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }

    expect(screen.queryByRole('link', { name: 'Dodaj komentar' })).toBeNull()
    expect(screen.queryByRole('link', { name: /^Unesi rezultat/ })).toBeNull()
    /* And the table is four columns rather than five with an empty one: „tabela
       ostaje kraca za tu kolonu" (owner, 23.08.2026). */
    expect(
      within(races()).getAllByRole('columnheader').map((one) => one.textContent),
    ).toEqual(['Trka', 'Dužina', 'Uspon', 'Spust'])
  })

  it('names each race in the first column, not only the category it falls in', async () => {
    /* Owner, 23.08.2026: „u opisu događaja gde su izlistane trke nedostaje naziv trke
       u prvoj koloni." A race carries a name since isporuka 121, and this table was
       the one place that still read a race by the category it falls in.

       Measured on the one race in the data that carries a name of its own,
       „Mrazijada, polumaraton" under the event „Mrazijada": every other race is named
       after its event, so a table drawing the wrong one of the two looks right. */
    await openEvent('visitor', null, undefined, '/sr/kalendar/mrazijada-2020')

    const table = within(await screen.findByRole('table', { name: 'Trke' }))
    const first = must(table.getAllByRole('row')[1], 'the first race')

    expect(
      must(within(first).getAllByRole('cell')[0], 'the first cell').textContent,
      'the first column is not the name of the race',
    ).toBe('Mrazijada, polumaraton')
  })

  it('offers the superadmin the copy and the deletion', async () => {
    await openEvent('superadmin')

    expect(screen.getByRole('button', { name: 'Kopiranje' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Brisanje' })).toBeVisible()
  })

  it('offers a moderator without the events neither of them', async () => {
    /* Rights are granular and this is the whole point of them: somebody trusted
       to judge results is not thereby trusted to delete a race weekend
       (rights.ts, PDL P21). */
    await openEvent('moderator', null, moderatorWith(['queue:results']))

    expect(screen.queryByRole('button', { name: 'Kopiranje' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Brisanje' })).toBeNull()
  })

  it('offers a signed-in member the way in, once per race, in the table', async () => {
    /* It stood over the table until 23.08.2026 and asked which race afterwards.
       The owner had it moved into the rows, where the race is already decided,
       and the button over the table went with the question.

       Every row and not merely one: a column drawn with a button in the first
       row alone reads as a table where only the first race can be reported. */
    await openEvent('competitor', '000007')

    const rows = within(races()).getAllByRole('row').slice(1)

    expect(rows.length).toBeGreaterThan(1)

    for (const row of rows) {
      expect(within(row).getByRole('link', { name: /^Unesi rezultat/ })).toBeVisible()
    }

    expect(screen.queryByRole('link', { name: 'Prijavi rezultat' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Brisanje' })).toBeNull()
  })

  it('counts the columns it says it has, with the way in and without it', async () => {
    /* The count rides on the element and the sheet turns it into a width
       (Profile.css). It is written by hand three lines from the headings it
       counts, and measured on 23.08.2026: changing the four to a three left the
       whole suite green while the table drew five columns in the width of four and
       ended 253px short of the edge the owner asked for.

       Both readings, because the count is what changes between them: five for
       somebody who may enter a result, four for a visitor. */
    /* Three readings and not two, because the count has three parts and one of
       them was uncovered until 23.08.2026: dropping `overDays` from the sum left
       all 2073 tests green while a visitor to an event of two mornings got a table
       213px short of where the owner asked it to end. An event that runs over one
       morning cannot say anything about the part that counts the second. */
    for (const [who, where, member] of [
      ['a member', ONE_DAY, '000007'],
      ['a visitor', ONE_DAY, null],
      ['a visitor of a weekend', TWO_DAYS, null],
    ] as const) {
      await openEvent(who === 'a member' ? 'competitor' : 'visitor', member, undefined, where)

      const table = races()
      const headings = within(table).getAllByRole('columnheader')

      expect(
        table.style.getPropertyValue('--race-columns'),
        `the table shown to ${who} counts itself wrong`,
      ).toBe(String(headings.length))

      /* And how many the fullest reading of this same event would have, which is what
         a column's share of the box is worked out from: „tabela ostaje kraća za tu
         kolonu, pa se prethodne završavaju gde i kad ih ima više" (owner,
         23.08.2026). The fullest reading is this one plus the way in, where the way
         in is not drawn.

         Asked because a round measured what its absence costs: with the part that
         counts the second morning left out of that sum, all 2157 tests stayed green
         while the first column of a weekend event moved 35,59px between a visitor and
         a member, which is exactly the fault the sum was added to remove. */
      const wayIn = headings.some((one) => one.textContent === 'Opcije')

      expect(
        table.style.getPropertyValue('--race-full'),
        `the table shown to ${who} does not know how wide it can get`,
      ).toBe(String(headings.length + (wayIn ? 0 : 1)))

      cleanup()
    }
  })

  it('draws no control box at all where there is nothing to press', async () => {
    /* Being signed in stopped being enough on 23.08.2026, when the report moved
       into the rows of the table. What the row beside the name can still hold is
       the administrator's pair and the rating, and the rating asks for a result of
       one's own on this event.

       An empty box is not nothing: `.rankings--tooled:has(> .rankings__head-tool)`
       turns the head into a grid of `1fr auto` with a gap, so the heading loses
       16px to a control nobody can see. Measured on 23.08.2026 with the condition
       written as „signed in": the box was drawn with no children and the `h1` came
       out 1052px wide against 1068. */
    /* A member who did not run this one. `000007` did, so the rating is offered to
       them and there is a box to hold it; the reading that says anything is the one
       where a signed-in member has nothing at all. */
    await openEvent('competitor', '000001', undefined, ONE_DAY)

    const head = must(
      screen.getByRole('heading', { level: 1 }).closest('.rankings--tooled'),
      'the head of the event',
    )

    expect(
      head.querySelector('.rankings__head-tool'),
      'a control box is drawn for a member with nothing to press',
    ).toBeNull()

    /* And the same thing asked of the rule that really charges for it, because
       the line above cannot fail on its own: it passes when the box is absent and
       it passes just as quietly when the class is renamed and the box is drawn
       under the new name. Measured on 28.08.2026 by renaming it in
       `EventActions.tsx`: the line above stayed green while the empty box was in
       the head.

       The name is read out of the stylesheet rather than written here, so the two
       cannot drift apart. `Rankings.css` charges the sixteen pixels through
       `.rankings--tooled:has(> .X)`, so whatever `X` is there today is what has to
       be absent here, and a rename that reaches both places is measured while a
       rename that reaches only one takes the charge away with it.

       An earlier version of this asked instead for „no empty child", which was
       wrong in both directions and a review measured both: an empty child that is
       not the control box failed it while the stylesheet charged nothing, and a
       box under another name with one empty child inside it passed while the head
       carried one. */
    const charged = must(
      /\.rankings--tooled:has\(>\s*\.([\w-]+)\)/.exec(rankingsCss)?.[1],
      'the class the head is charged for',
    )

    expect(
      head.querySelector(`.${charged}`),
      'the box the stylesheet charges sixteen pixels for is drawn',
    ).toBeNull()
  })

  it('offers nothing on a race that has not been run yet', async () => {
    /* PDL P9 refuses a result dated in the future, and a race carries its own day,
       so on the Saturday of a weekend the Saturday races can be reported and the
       Sunday one cannot. A button that leads to a form which then refuses the date
       is a dead end the reader was invited into.

       Measured on 23.08.2026: with the day dropped from that decision, the whole
       suite stayed green while every race of every future event carried a button.
       This is the reading that says otherwise, and it needs a weekend to say it:
       one morning of an event cannot tell whether the decision reads the day at
       all. */
    renderAt(TWO_DAYS, 'competitor', '000007', undefined, '2021-09-17')

    await screen.findByRole('heading', { level: 1 })

    const rows = within(races()).getAllByRole('row').slice(1)
    const offered = rows.map((row) => within(row).queryByRole('link', { name: /^Unesi rezultat/ }))

    /* Two races on the Friday and two on the Saturday after it. */
    expect(offered.filter(Boolean)).toHaveLength(2)
    expect(offered.filter((one) => one === null)).toHaveLength(2)
    /* And the column is still drawn, because some race on this event can be
       reported: what is empty is the cell, not the table. */
    expect(within(races()).getAllByRole('columnheader').map((one) => one.textContent))
      .toContain('Opcije')
  })

  it('offers an administrator who is also a member all three', async () => {
    /* An administrator runs too, so the two sets do not exclude one another. */
    await openEvent('superadmin', '000007')

    expect(screen.getByRole('button', { name: 'Kopiranje' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Brisanje' })).toBeVisible()
    /* A link, because it leads to another screen, and in the table because that
       is where the race is (EventDetail.tsx). */
    expect(within(races()).getAllByRole('link', { name: /^Unesi rezultat/ }).length)
      .toBeGreaterThan(0)
  })
})

describe('reporting a result from the event', () => {
  it('names every way into the form for a different race', async () => {
    /* Twelve links reading „Unesi rezultat" and leading twelve places is one entry
       said twelve times in a screen reader's list of links, so each is named by its
       race (`pages/EventDetail.tsx`, WCAG 2.2 SC 2.4.4). That the naming really
       parts them is measured on the function that does it (`raceLabel`, in
       reportResult.test.tsx), and here on the page itself, because the page also
       chooses **what set** the race is named among and a right rule over the wrong
       set draws the same two links.

       This event because it is the hardest one in the file: twelve races, one name,
       one morning, and four lengths that agree once written the ordinary way. */
    renderAt(TWELVE_RACES, 'competitor', '000007')

    await screen.findByRole('heading', { level: 1 })

    const named = within(races())
      .getAllByRole('link', { name: /^Unesi rezultat/ })
      .map((link) => must(link.getAttribute('aria-label'), 'what the row calls the race'))

    expect(named.length, 'the file no longer holds the event this is about').toBe(12)
    expect(new Set(named).size, `two links read the same: ${named.join(' / ')}`).toBe(12)
  })

  it('calls a race the same thing in the row and in the form the row opens', async () => {
    /* A race is known by its name and its length, and by its day as well where two
       of them share both (`data/raceLabel.ts`; it had no name of its own until
       23.08.2026 and was known by the length alone). What it is
       known among decides that, and the two screens were reading two different
       sets: the table read every race of the event and the form read only those
       already run.

       Measured on 23.08.2026 on this event, on the day of its first morning: the
       row said „42,2 km, 14. 3. 2022." and the form said „42,2 km". One race, two
       names, two steps of one flow, and a screen reader hears both. */
    const user = setupUser()

    renderAt(FOUR_MORNINGS, 'competitor', '000007', undefined, '2022-03-14')

    await screen.findByRole('heading', { level: 1 })

    const row = must(within(races()).getAllByRole('row')[1], 'the first race')
    const link = within(row).getByRole('link', { name: /^Unesi rezultat/ })
    const named = must(link.getAttribute('aria-label'), 'what the row calls the race').replace(
      'Unesi rezultat: ',
      '',
    )

    /* The day is part of it here, which is what makes this reading worth having:
       on an event of one length a morning the two sets cannot disagree. */
    expect(named).toMatch(/\d{1,2}\. \d{1,2}\. \d{4}\./)

    await user.click(link)

    expect(await screen.findByText(/Prijavljuješ rezultat/)).toHaveTextContent(named)
  })

  it('carries the race into the form, so it asks neither which event nor which race', async () => {
    const user = setupUser()
    const { router } = await openEvent('competitor', '000007')

    const row = must(within(races()).getAllByRole('row')[1], 'the first race')

    await user.click(within(row).getByRole('link', { name: /^Unesi rezultat/ }))

    expect(router.state.location.pathname).toBe(`${EVENT}/prijava`)
    expect(router.state.location.search).toMatch(/^[?]trka=/)
    /* The form opens on it: the time is asked for, the race is not. */
    expect(await screen.findByLabelText(/Sati/)).toBeVisible()
    expect(screen.queryByLabelText(/^Trka/)).toBeNull()
  })
})

describe('a race carried into a copy of its event', () => {
  /* The record itself and not the screen, because the copy is the third place a
     race is written and only here can it be asked with a race the data has not
     got: every race in `public/mock/races.json` is a race of a length, so a copy
     measured through the table can only ever say what it says about a length.

     What this catches is a field left out. Nothing downstream can tell a race that
     never carried a kind from one that has none, so the copy would quietly become
     a race of a length the first time somebody saved it. */
  const timed: Race = {
    id: 'r1',
    eventId: 'e1',
    name: 'Šri Činmoj ultramaraton',
    renamed: 'yes',
    date: '2026-09-19',
    kind: 'time',
    limitSeconds: 86_400,
    distanceKm: 0,
    ascentM: 0,
    descentM: 0,
    category: 'short',
  }

  it('is the same kind of race it was, and keeps the limit it was run to', () => {
    const copy = copiedRace(timed, 'e2', 365)

    expect(copy.kind).toBe('time')
    expect(copy.limitSeconds).toBe('86400')
  })

  it('names every field a race record has, so none is dropped on the way', () => {
    /* Both halves. „It has a kind" alone would pass on a record that had lost the
       length instead, and the whole point of the copy is that a race comes across
       entire. Compared against the race itself rather than a list written out here,
       which would be a second place to keep up to date. */
    const copy = copiedRace(timed, 'e2', 0)

    /* Every field a race has except two: the id, because a copy is a new race and
       gets a number of its own, and the category, which is read off the length and
       is never written by hand (`data/raceCategory.ts`). */
    expect(Object.keys(copy).sort()).toEqual(
      Object.keys(timed)
        .filter((one) => one !== 'id' && one !== 'category')
        .sort(),
    )
  })
})

describe('deleting an event', () => {
  it('asks first, and says how many races go with it', async () => {
    /* Nothing brings any of it back, and deleting an event of five races from a
       page showing one of them is easy to do by mistake. */
    const user = setupUser()
    const asked: string[] = []
    const confirm = vi.spyOn(window, 'confirm').mockImplementation((message) => {
      asked.push(String(message))

      return false
    })

    try {
      await openEvent('superadmin')
      await user.click(await screen.findByRole('button', { name: 'Brisanje' }))

      expect(asked).toHaveLength(1)
      expect(first(asked)).toMatch(/Obrisati događaj/)
      expect(first(asked)).toMatch(/trk/)
      /* Answered no, so the event is still on screen. */
      expect(screen.getByRole('button', { name: 'Brisanje' })).toBeVisible()
    } finally {
      confirm.mockRestore()
    }
  })

  it('takes the races with it and leaves for the month it was in', async () => {
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      const { router } = await openEvent('superadmin')
      const races = within(await screen.findByRole('table', { name: /Trke|trke/ }))
        .getAllByRole('row')
        .slice(1).length

      expect(races).toBeGreaterThan(0)

      /* Somebody who ran it, taken off the event's own list of results, so the
         profile looked at afterwards is one that had a link to this event. */
      const who = within(await screen.findByRole('table', { name: /Rezultati/ })).getAllByRole(
        'link',
      )
      const ran = must(
        must(first(who).getAttribute('href'), 'veza ka takmičaru').split('/').pop(),
        'broj takmičara',
      )

      await user.click(screen.getByRole('button', { name: 'Brisanje' }))

      expect(router.state.location.pathname).toBe('/sr/kalendar')

      /* And it is gone rather than merely left behind: the address it had
         answers as an address the portal does not have. */
      await router.navigate(EVENT)
      expect(await screen.findByRole('heading', { name: 'Ovog događaja nema.' })).toBeVisible()

      /* And so is everything that hung off it. A result carries the address of
         its event, so without this the event left the calendar while its results
         went on counting, each of them linking to a page that now says the event
         does not exist.
       *
         Checked on a profile, which is a screen that names the event. The
         standing does not name events at all, so looking there proved nothing:
         the whole deletion of results could be taken out and it stayed green. */
      await router.navigate(`/sr/takmicar/${ran}?sezona=2015`)

      const listed = within(await screen.findByRole('table', { name: 'Rezultati' }))

      expect(listed.queryAllByRole('link', { name: 'Maraton maratona' })).toHaveLength(0)
      /* And the row is gone rather than merely unlinked. */
      expect(listed.queryByText('Maraton maratona')).toBeNull()
    } finally {
      confirm.mockRestore()
    }
  })
})


describe('copying an event', () => {
  it('opens the copy on its own form, at the date', async () => {
    /* The date is the one thing that is certainly wrong on a copy, which is what
       makes this worth a button: next season's calendar is this season's with
       the dates moved. */
    const user = setupUser()
    const { router } = await openEvent('superadmin')

    const name = must(screen.getByRole('heading', { level: 1 }).textContent, 'ime događaja')

    await user.click(screen.getByRole('button', { name: 'Kopiranje' }))

    expect(router.state.location.pathname).toBe('/sr/administracija/dogadjaji')
    expect(router.state.location.search).toMatch(/zapis=/)

    const date = await screen.findByLabelText('Datum')

    expect(date).toHaveFocus()
    /* Everything else came across, so the only thing to do is the date. */
    expect(screen.getByLabelText(/Naziv događaja/)).toHaveValue(name)
  })

  it('offers a season on and a week on, both counted from the event copied', async () => {
    /* Owner, 23.08.2026: two buttons of the same height as the calendar's, in the
       row with the date, „+1y" chosen to begin with and „+1w" exactly seven days
       after the event being copied. His reason: „veoma zgodno za treninge i
       nedeljne trkice".

       And both always counted from that event, never from what the box holds now
       (owner, same day). That is the half that is easy to lose, and it is what makes
       a button mean one thing: after a day typed by hand, a press goes back to the
       count from the original, and two presses give what one press gives. */
    const user = setupUser()
    const events = await loadResource<BtlEvent[]>('events')

    await openEvent('superadmin')

    /* Found by its address and not by its name: the same race is run every season,
       so eight events carry this name and only one of them is the morning open. */
    const copied = must(
      events.find((one) => one.slug === EVENT.slice(EVENT.lastIndexOf('/') + 1)),
      'the event being copied',
    )

    await user.click(screen.getByRole('button', { name: 'Kopiranje' }))

    const date = await screen.findByLabelText('Datum')
    const season = screen.getByRole('button', { name: '+1y' })
    const week = screen.getByRole('button', { name: '+1w' })

    /* A season on to begin with, which is the day the copy already carries. */
    expect(season).toHaveAttribute('aria-pressed', 'true')
    expect(week).toHaveAttribute('aria-pressed', 'false')

    await user.click(week)

    expect(date, 'a week on is not seven days after the event copied').toHaveValue(
      fieldDate(shiftDate(copied.date, 7)),
    )
    expect(week).toHaveAttribute('aria-pressed', 'true')
    expect(season).toHaveAttribute('aria-pressed', 'false')

    /* Pressed twice is pressed once. */
    await user.click(week)

    expect(date).toHaveValue(fieldDate(shiftDate(copied.date, 7)))

    /* And a day typed by hand does not become the thing the buttons count from. */
    await user.clear(date)
    await user.type(date, '01012099')
    expect(season).toHaveAttribute('aria-pressed', 'false')
    expect(week).toHaveAttribute('aria-pressed', 'false')

    await user.click(season)

    expect(date, 'the season on was counted from the day typed by hand').toHaveValue(
      fieldDate(nextSeason(copied.date)),
    )
  })

  it('keeps the structure: every race copied, and every copy on the copied event', async () => {
    /* What copying is for (owner, 03.08.2026): the races come across and hang
       off the copy, so next season's weekend is last season's weekend with the
       date moved rather than five races typed again.

       Counted under the copy itself, which is where a race is now seen at all
       (owner, 06.08.2026): a copied race that answers to no event is a race no
       screen on the portal draws, so the count under the copy is the whole
       proof. */
    const user = setupUser()

    await openEvent('superadmin')

    const races = within(await screen.findByRole('table', { name: 'Trke' }))
      .getAllByRole('row')
      .slice(1).length

    expect(races).toBeGreaterThan(1)

    await user.click(screen.getByRole('button', { name: 'Kopiranje' }))

    const date = await screen.findByLabelText('Datum')
    await user.clear(date)
    await user.type(date, '14032027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    /* The copy, found by name and then by the day it was moved to: the list
       opens on what is still ahead and keeps sixty rows, and a copy made for
       March 2027 is not among the first sixty of those. */
    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), 'Maraton maratona')

    const events = within(await screen.findByRole('table', { name: 'Događaji' }))
    const copy = must(
      events
        .getAllByRole('row')
        .slice(1)
        .find((row) => (row.textContent ?? '').includes('2027')),
      'the copied event in the list',
    )

    await user.click(within(copy).getByRole('button', { name: /^Otvori:/ }))

    const under = within(await screen.findByRole('table', { name: /^Trke na događaju/ }))

    expect(under.getAllByRole('row').slice(1)).toHaveLength(races)
  })

  it('never carries being featured across to the copy', async () => {
    /* Being singled out is a choice about this running of the race and not
       something the race carries (owner, 11.08.2026): next season's calendar is
       made by copying, and a copy that arrived already featured would put five
       events on the front page of a season nobody has planned yet. Copied off a
       featured event, which is the only way to tell the rule from the default. */
    const user = setupUser()

    renderAt('/sr/kalendar/beogradski-maraton-2027', 'superadmin')
    await screen.findByRole('heading', { level: 1 })
    await user.click(screen.getByRole('button', { name: 'Kopiranje' }))
    await screen.findByLabelText('Datum')

    expect(screen.getByLabelText(/^Istaknuto/)).toHaveValue('no')
  })

  it('gives a second copy an identity of its own', async () => {
    /* The suffix counted the races and not the copies, and the number of races
       does not change when a copy is made, so pressing the button twice wrote
       two records under one id. Two records under one id is the fault the
       numbering exists to prevent: the list draws them under one key, a lookup
       finds only the first, and an edit to either changes both. */
    const user = setupUser()
    const { router } = await openEvent('superadmin')

    await user.click(screen.getByRole('button', { name: 'Kopiranje' }))
    await screen.findByLabelText('Datum')

    const first = router.state.location.search

    await router.navigate(EVENT)
    /* The event's own heading, not merely any first-level one: the screen left
       behind has one of its own and it is there while this one is loading. */
    await screen.findByRole('button', { name: 'Kopiranje' })
    await user.click(screen.getByRole('button', { name: 'Kopiranje' }))
    await screen.findByLabelText('Datum')

    expect(router.state.location.search).not.toBe(first)
  })

  it('opens the copy as a copy: named so, without the three it keeps, on next season', async () => {
    /* Three of the owner's own sentences from 23.08.2026, and none of them was
       measured by anything until a round said so: the whole of the screen could be
       taken out and the package stayed green.

       „Kopiranje dogadjaja treba da se zove u vrhu Kopiranje a ne Izmena, I ne
       treba da se pominju Mesto, Drzava, Vrsta dogadjaja nego se kopiraju po
       default-u. Istaknuto moze da ostane." And: „Datum treba automatski da postane
       proporcionalan datumu kopiranog dogadjaja u narednoj godini." */
    const user = setupUser()

    renderAt(EVENT, 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Kopiranje' }))

    /* The screen says what it is doing, rather than „Izmena", which was the truth
       about the record and not about the work. */
    expect(await screen.findByRole('heading', { name: 'Kopiranje događaja' })).toBeVisible()

    /* The three it keeps are not put in question. */
    expect(screen.queryByLabelText(/^Mesto/), 'the copy is asked for its town').toBeNull()
    expect(screen.queryByLabelText(/^Država/), 'the copy is asked for its country').toBeNull()
    expect(screen.queryByLabelText(/^Vrsta/), 'the copy is asked what kind it is').toBeNull()
    /* And the one that does change from season to season stays. */
    expect(screen.getByLabelText(/^Istaknuto/)).toBeVisible()

    /* The same place in next year's calendar, worked out from the day it was
       copied from. „Maraton maratona" of 2015 ran on the second Saturday of March;
       the second Saturday of March 2016 is the twelfth. */
    expect(screen.getByLabelText('Datum')).toHaveValue('12/03/2016')

    /* And every race under it moved by the same number of days, so two mornings
       stay two mornings. */
    for (const day of screen.getAllByLabelText(/^Datum, /)) {
      expect(inputElement(day).value, 'a race stayed in the season it was copied from')
        .toMatch(/\/2016$/)
    }
  })

  it('takes the races with it, and gives the copy an address of its own', async () => {
    /* Entering an event and its five races again by hand is the work this exists
       to remove, so a copy without the races is a button that saves nothing.

       The address is the other half. It was blank on anything entered by hand,
       so a record sat in the administration's list and answered nowhere; an
       event works it out from its own name and day now, and works it out again
       whenever either is changed (entityForms.ts, EntityEditor.tsx).

       What this cannot check yet is the copy on the calendar. Nothing the
       administration creates reaches a public screen at all, because those read
       the file and not what this visit has added to it; that is older and wider
       than this button and is written down as its own job. */
    const user = setupUser()
    await openEvent('superadmin')

    const races = within(await screen.findByRole('table', { name: 'Trke' }))
      .getAllByRole('row')
      .slice(1).length

    expect(races).toBeGreaterThan(1)

    await user.click(screen.getByRole('button', { name: 'Kopiranje' }))

    const date = await screen.findByLabelText('Datum')
    await user.clear(date)
    await user.type(date, '14032027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    /* The address follows the year it was moved into, rather than the year it
       was copied from: an address is the name and the year since 10.08.2026, so
       an event put off a week inside its season keeps it. */
    const saved = await screen.findByRole('status', { name: 'Sačuvano' })

    expect(saved).toHaveTextContent('maraton-maratona-2027')

    /* And the races came across, counted on the copy itself. Counting rows that
       matched "Maraton maratona" on the list of races proved nothing: eight
       events answer to that name and twenty-six races with them, so four is
       fewer than twenty-six whether or not anything was copied at all. */
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))
    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), 'Maraton maratona')

    const listed = within(await screen.findByRole('table'))
    const copy = must(
      listed.getAllByRole('row').find((row) => /2027\./.test(row.textContent ?? '')),
      'red kopije u spisku događaja',
    )

    /* The fourth column is the count of races, read as a whole cell. Matched as
       a substring it passed against the date beside it, which holds a four of
       its own, so the copy could arrive with no races and nothing would say
       so. */
    expect(at(within(copy).getAllByRole('cell'), 3).textContent).toBe(String(races))
  })

  it('carries the name of a race into the copy, and that it was given by hand', async () => {
    /* A race renamed „Mrazijada, polumaraton" is still that next season, and one
       that only ever carried its event's name goes on following it (owner,
       23.08.2026). `renamed` is not decoration: a copy that comes across as „no"
       starts following its event again, so the first rename of the event undoes a
       choice the administrator made, without a trace.

       Measured on the one race in the data that carries a name of its own; a round
       measured that both of these lines could be taken out and all 2139 tests would
       pass. */
    const user = setupUser()
    await openEvent('superadmin', null, undefined, '/sr/kalendar/mrazijada-2020')

    await user.click(await screen.findByRole('button', { name: 'Kopiranje' }))

    const date = await screen.findByLabelText('Datum')
    await user.clear(date)
    await user.type(date, '05012031')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    /* Back into the copy, where the rows say what came across. */
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))
    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), 'Mrazijada')

    const listed = within(await screen.findByRole('table'))
    const copy = must(
      listed.getAllByRole('row').find((row) => /2031\./.test(row.textContent ?? '')),
      'red kopije u spisku događaja',
    )

    await user.click(within(copy).getByRole('button', { name: /^Otvori:/ }))
    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    const names = screen.getAllByLabelText(/^Trka,/).map((one) => inputElement(one).value)

    expect(names, 'the copy was handed the name of its event').toContain('Mrazijada, polumaraton')

    /* And it did not start following the event again: renaming the event leaves it
       alone, which is only true if `renamed` came across as well. */
    const named = must(screen.getAllByLabelText(/^Naziv događaja/)[0], 'the name of the copy')

    await user.clear(named)
    await user.type(named, 'Drugo ime')

    expect(
      screen.getAllByLabelText(/^Trka,/).map((one) => inputElement(one).value),
      'the copy forgot that the race had been renamed by hand',
    ).toContain('Mrazijada, polumaraton')
  }, SLOW)

  it('lets a copied race that was never renamed go on following its event', async () => {
    /* The other half of the rule, and the half the guard above cannot reach: the
       event it measures on has exactly one race and that race is renamed, so
       `renamed: 'yes'` written flat into the copy passes it. A round measured that:
       with the flag hard-coded, all 2148 tests stayed green while every copied race
       stopped following its event.

       „Maraton maratona 2015" has four races and not one of them is renamed, so
       renaming the copy must move all four. */
    const user = setupUser()
    await openEvent('superadmin')

    await user.click(await screen.findByRole('button', { name: 'Kopiranje' }))

    const date = await screen.findByLabelText('Datum')
    await user.clear(date)
    await user.type(date, '14032032')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))
    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), 'Maraton maratona')

    const listed = within(await screen.findByRole('table'))
    const copy = must(
      listed.getAllByRole('row').find((row) => /2032[.]/.test(row.textContent ?? '')),
      'red kopije u spisku događaja',
    )

    await user.click(within(copy).getByRole('button', { name: /^Otvori:/ }))
    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    const named = must(screen.getAllByLabelText(/^Naziv događaja/)[0], 'the name of the copy')

    await user.clear(named)
    await user.type(named, 'Novo ime')

    const names = screen.getAllByLabelText(/^Trka,/).map((one) => inputElement(one).value)

    expect(names.length).toBeGreaterThan(1)
    expect(
      names.every((one) => one === 'Novo ime'),
      `the copy stopped following its event: ${names.join(' | ')}`,
    ).toBe(true)
  }, SLOW)

  it('does not hand a third copy the races the second one answers to', async () => {
    /* The third home of one fault, and the last to be put right: the identity of a
       copied race was counted rather than measured. A count goes back down and the
       numbers do not, so emptying one copy frees a number that another copy still
       holds. Measured 23.08.2026 on „Maraton maratona 2015": copy, copy, empty the
       first copy, copy again, and the third copy took the four ids the second copy
       answers to. `editRecord` is filed by id, so saving the third moved **both**
       onto it and the second was left with no races at all. */
    const user = setupUser()
    const { router } = await openEvent('superadmin')
    const races = within(await screen.findByRole('table', { name: 'Trke' }))
      .getAllByRole('row')
      .slice(1).length

    async function copyOnto(day: string) {
      await user.click(await screen.findByRole('button', { name: 'Kopiranje' }))
      const date = await screen.findByLabelText('Datum')
      await user.clear(date)
      await user.type(date, day)
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await screen.findByRole('status', { name: 'Sačuvano' })
      await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))
    }

    async function openCopy(year: string) {
      const search = await screen.findByPlaceholderText('Naziv ili mesto')
      await user.clear(search)
      await user.type(search, 'Maraton maratona')

      const row = must(
        within(await screen.findByRole('table'))
          .getAllByRole('row')
          .find((one) => new RegExp(`${year}[.]`).test(one.textContent ?? '')),
        `red kopije iz ${year}`,
      )

      await user.click(within(row).getByRole('button', { name: /^Otvori/ }))
      await screen.findByRole('heading', { name: /^Trke na događaju/ })
    }

    await copyOnto('14032027')
    /* Back to the event that is being copied, for the second copy. The list of
       events offers „Otvori" and not a link out to the calendar. */
    await router.navigate(EVENT)
    await screen.findByRole('heading', { level: 1 })
    await copyOnto('14032028')

    /* The first copy is emptied, which is what frees the numbers the second one
       holds. Emptied in the administration and not deleted from its own page,
       which would be shorter: nothing the administration creates reaches a public
       screen, so the copy has no page of its own to delete it from. Measured, and
       written down because it is the obvious shortcut. */
    await openCopy('2027')
    for (const button of screen.getAllByRole('button', { name: /^Obriši \d+\. trku$/ }).reverse()) {
      await user.click(button)
    }
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    /* And now a third copy, which counted would land on the second one's ids. */
    await router.navigate(EVENT)
    await screen.findByRole('heading', { level: 1 })
    await copyOnto('14032029')

    await openCopy('2029')

    expect(screen.queryAllByLabelText(/^Dužina/).length, 'the third copy lost a row').toBe(races)

    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))
    await openCopy('2028')

    expect(
      screen.queryAllByLabelText(/^Dužina/).length,
      'the second copy was left without the races it had',
    ).toBe(races)
    /* Its own budget, and the reason for it. ADL A2 keeps the package at 5000ms as
       a **performance** budget rather than a guard against hanging, so a longer one
       has to say what it is paying for. This walk makes three copies of an event of
       four races, opens two forms and saves them, which is the shortest sequence
       that reaches the fault at all: measured 1390ms warm on this machine, and a
       package under load has been measured at three to four times its warm time
       (`adminFlows.test.tsx`, 1,6s warm against 4,4s loaded), which is 4,2 to 5,6s
       and either side of the default. Fifteen seconds is ten times warm; a fourfold
       slowdown of the copy itself would still be caught by the other tests of this
       file, which keep the default. */
  }, SLOW)
})
