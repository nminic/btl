import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ClockProvider } from '../clock/ClockProvider'
import { I18nProvider } from '../i18n/I18nProvider'
import { RoleProvider } from '../roles/RoleProvider'
import { SessionProvider } from '../session/SessionProvider'
import { useSession } from '../session/useSession'
import { AdminEvents } from './admin/AdminEvents'
import { at, inputElement, must, selectElement } from '../test/at'
import { Saved } from '../test/saved'
import { loadResource } from '../data/client'
import { eventSlug } from './admin/entityForms'
import { formatShortDate } from '../i18n/format'
import type { BtlEvent, Race, Result } from '../data/types'
import { fieldDate, isoDate, shiftDate } from '../forms/dateField'
import { renderAt } from '../test/render'
import { setupUser, type Pressing } from '../test/user'

/* The screens behind Podaci: the races inside their event, the teams, the
 * leagues and the written pages. Each is checked for what it is there to show,
 * for the case that only shows up in real data (a team with no organiser, a
 * league with no events), and for keeping everyone who is not staff out. */

async function table(name: string) {
  return within(await screen.findByRole('table', { name }))
}

describe('the races of an event', () => {
  /* A race is one length of one morning and is edited inside the event it is run
     at (owner, 06.08.2026). It had a screen of its own, where finding the event
     meant searching a list of eleven hundred, and a race made there could be
     saved against the wrong one. */
  async function openList() {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    return user
  }

  async function openFirstEvent() {
    const user = await openList()

    const rows = await table('Događaji')
    const first = at(rows.getAllByRole('row'), 1)

    await user.click(within(first).getByRole('button', { name: /^Otvori/ }))

    return user
  }

  it('lists them under the event, and asks nobody which event it is', async () => {
    await openFirstEvent()

    expect(await screen.findByRole('heading', { name: /^Trke na događaju/ })).toBeVisible()
    /* The screen has already answered that, and a question whose answer is on
       the page above it is a question with a wrong answer available. */
    expect(screen.queryByLabelText('Događaj')).toBeNull()
  })

  /** The table of races on the open event, and one row of it. */
  function races() {
    return within(screen.getByRole('table', { name: /^Trke na događaju/ }))
  }

  function rowsOfRaces() {
    return races().getAllByRole('row').slice(1)
  }

  function lastRow() {
    const all = rowsOfRaces()

    return within(must(all[all.length - 1], 'the row just opened'))
  }

  /** Everything a row is asked for, typed into the row itself. */
  async function fill(
    user: ReturnType<typeof setupUser>,
    row: ReturnType<typeof lastRow>,
    { day, km }: { day?: string; km: string },
  ) {
    if (day !== undefined) {
      await user.clear(row.getByLabelText(/^Dan trke/))
      await user.type(row.getByLabelText(/^Dan trke/), day)
    }

    await user.clear(row.getByLabelText(/^Dužina/))
    await user.type(row.getByLabelText(/^Dužina/), km)
  }

  it('names the button that removes a row by which row it is', async () => {
    /* A race has no name of its own (PDL P6), and in a table of rows the number
       of the row is what tells one „Obriši" from another. Read off the length, as
       it was until 23.08.2026, a row still being typed into gave „Obriši: ", and
       one of those buttons takes results with it. */
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))

    expect(lastRow().getByRole('button', { name: /^Obriši \d+\. trku$/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Obriši: ' })).toBeNull()
    /* And nothing opens a row any more: the row is open. */
    expect(screen.queryByRole('button', { name: /^Otvori:/ })).toBeNull()
  })

  it('takes a second race of the same length on the same morning', async () => {
    /* Refused until 23.08.2026, on the reasoning that a race has no name so two of
       one length on one morning are two entries a member would choose between
       blindly. The owner said that day: „u teoriji dve trke iste dužine mogu biti
       na istom događaju, čak mogu imati iste i vertikalne nagibe, ali to se retko
       dešava. Zavisi od staze koja se trči. Nemoj to da zabranjuješ."

       Measured here through the press, because it is the press that used to refuse
       it. */
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))
    await fill(user, lastRow(), { km: '17' })
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))
    await fill(user, lastRow(), { km: '17' })

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
    expect(
      screen.queryByText(/već ima trku te dužine/),
      'the portal still forbids two races of one length',
    ).toBeNull()
  })

  it('opens every race under the name of its event, and follows it when that changes', async () => {
    /* Owner, 23.08.2026: „svaka trka ipak treba da ima i svoj naziv koji je po
       default-u naziv događaja, ali se može po potrebi promeniti." A race that
       still carries its event's name follows it when the event is renamed; one
       that was renamed by hand keeps what it was given, which is the whole of
       `renamed`. */
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    const event = must(screen.getAllByLabelText(/^Naziv događaja/)[0], 'the name of the event')
    const was = inputElement(event).value
    const races = () => screen.getAllByLabelText(/^Trka,/).map((one) => inputElement(one).value)

    expect(races().length).toBeGreaterThan(0)
    expect(races().every((one) => one === was), 'a race opened under some other name').toBe(true)

    /* A second one, entered here rather than out of the file, so what is measured
       is both the race that came with the event and the race this screen made. */
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))

    expect(races()[1], 'a new row opened under some other name').toBe(was)

    /* One of them is given a name of its own, and only that one stops following. */
    const own = must(screen.getAllByLabelText(/^Trka,/)[1], 'the second race')

    await user.clear(own)
    await user.type(own, 'Polumaraton')

    await user.clear(event)
    await user.type(event, 'Drugo ime')

    const after = races()

    expect(after[0], 'a race that was never renamed did not follow its event').toBe('Drugo ime')
    expect(after[1], 'a race renamed by hand was overwritten by its event').toBe('Polumaraton')

    /* And it survives the round trip: the record keeps that the name was given by
       hand, so opening the event again and renaming it once more still leaves that
       race alone. Read back rather than trusted, because between the table and the
       record the flag is a word in a store that keeps only text. */
    await user.type(must(screen.getAllByLabelText(/^Dužina/)[1], 'the second length'), '21.1')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const again = within(await screen.findByRole('table', { name: 'Događaji' }))

    await user.click(
      within(at(again.getAllByRole('row'), 1)).getByRole('button', { name: /^Otvori:/ }),
    )
    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    const twice = must(screen.getAllByLabelText(/^Naziv događaja/)[0], 'the name again')

    await user.clear(twice)
    await user.type(twice, 'Treće ime')

    /* Sorted, because the rows are lined up by the day and the length inside it and
       the second race has just been given a length. What is asked is which name
       each carries, not which row it sits in. */
    expect([...races()].sort(), 'the record forgot which race was renamed by hand').toEqual(
      ['Polumaraton', 'Treće ime'].sort(),
    )
  })

  it('will not save a race with no name at all', async () => {
    /* It opens as the name of its event and may be changed, not taken away: a row
       with no name is a row nobody can pick out of a list of races. */
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    const first = must(screen.getAllByLabelText(/^Trka,/)[0], 'the name of the first race')

    await user.clear(first)
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()
    expect(first).toHaveAttribute('aria-invalid', 'true')
  })

  it('names every control in a row by the row it is in', async () => {
    /* „Dužina" twelve times over is twelve controls a screen reader cannot tell
       apart, and the table has no row heading to read them with. Written without
       the row for a day, and a round measured it: three rows, twelve controls, four
       names between them. */
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))

    const named = within(screen.getByRole('table', { name: /^Trke na događaju/ }))
      .getAllByRole('textbox')
      .concat(
        within(screen.getByRole('table', { name: /^Trke na događaju/ })).getAllByRole('spinbutton'),
      )
      .map((one) => one.getAttribute('aria-label') ?? '')

    expect(named.length).toBeGreaterThan(4)
    expect(new Set(named).size, 'two controls of the table answer to one name').toBe(named.length)
    /* And the row is in the name, rather than the name merely being unique by
       accident of the column. */
    for (const one of named) {
      expect(one).toMatch(/\d+\. trka$/)
    }
  })

  it('marks every kind of wrong in a row, not only the first thing missing', async () => {
    /* A climb of minus five hundred is as wrong as an empty length, and a cell that
       says it is fine sends a reader looking somewhere else (WCAG 2.2 SC 3.3.1).
       Measured before: the climb was marked and the fall beside it, equally wrong,
       said `aria-invalid="false"`. */
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    const climb = must(screen.getAllByLabelText(/^Uspon/)[0], 'the climb of the first race')
    const fall = must(screen.getAllByLabelText(/^Spust/)[0], 'the fall of the first race')

    await user.clear(climb)
    await user.type(climb, '-500')
    await user.clear(fall)
    await user.type(fall, '-900')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByText(/Svaka trka mora da ima/)).toBeVisible()
    expect(climb).toHaveAttribute('aria-invalid', 'true')
    expect(fall, 'the second wrong cell says it is fine').toHaveAttribute('aria-invalid', 'true')
  })

  it('will not save while a row is missing its day or its length', async () => {
    /* Owner, 23.08.2026: „validacija mi ne da da nastavim dalje dok svaki red nema
       sve obavezne podatke". One press writes the event and every one of its
       mornings, so one unfinished row is the whole press refused.

       The climb and the fall are not asked for; empty they are read as 0/0. */
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByText(/Svaka trka mora da ima dan i dužinu/)).toBeVisible()
    expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()

    await fill(user, lastRow(), { km: '12' })
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
  })

  it('attaches a race entered there to that event and to no other', async () => {
    /* The screen already answers which event it is, so nothing asks. What is
       measured is that the answer is the right one: the row lands under the event
       whose form it was entered under. */
    const user = await openFirstEvent()

    const named = must(
      screen.getByRole('heading', { name: /^Trke na događaju/ }).textContent,
      'the name of the event the races belong to',
    ).replace('Trke na događaju ', '')

    await user.click(screen.getByRole('button', { name: 'Nova trka' }))
    await fill(user, lastRow(), { km: '33' })
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const again = within(await screen.findByRole('table', { name: 'Događaji' }))

    await user.click(
      within(
        must(
          again.getAllByRole('row').find((row) => (row.textContent ?? '').includes(named)),
          'the event it was entered under',
        ),
      ).getByRole('button', { name: /^Otvori:/ }),
    )

    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    expect(
      rowsOfRaces().some((row) => within(row).queryByDisplayValue('33') !== null),
      'the race is not under the event it was entered on',
    ).toBe(true)
  })

  it('gives a new row the day the form above is showing', async () => {
    /* Owner, 23.08.2026: „dan trke datepicker koji se prvo menja default u sve što
       pokazuje Datum događaja gore (mogu promeniti naknadno ako želim)". Read off
       the form as it stands rather than off the record, so a race entered under a
       day that has not been saved yet still lands on it. */
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    const day = screen.getAllByLabelText(/^Datum/)[0]

    await user.clear(must(day, 'the date of the event'))
    await user.type(must(day, 'the date of the event'), '05061999')
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))

    expect(lastRow().getByLabelText(/^Dan trke/)).toHaveValue('05/06/1999')
  })

  it('takes the day of its first race, when a row is moved before it', async () => {
    /* The event is the day it begins (owner, 10.08.2026), so a race moved onto an
       earlier morning makes that day the event's. Written when the one press
       saves, because that is when the mornings are known.

       Moving the event's own date is the other direction and moves the rows with
       it (see the test above), so what is measured here is a **row** moved on its
       own. */
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    const day = must(screen.getAllByLabelText(/^Datum/)[0], 'the date of the event')
    /* One morning earlier and no more: the list opens on what is still ahead, so
       a race moved into the past would take its event out of the list with it and
       there would be nothing left to open. */
    const before = fieldDate(shiftDate(isoDate(inputElement(day).value), -1))

    const race = must(screen.getAllByLabelText(/^Dan trke/)[0], 'the first race')

    await user.clear(race)
    await user.type(race, before.replace(/\D/g, ''))
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const again = within(await screen.findByRole('table', { name: 'Događaji' }))

    await user.click(
      within(at(again.getAllByRole('row'), 1)).getByRole('button', { name: /^Otvori:/ }),
    )
    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    expect(
      must(screen.getAllByLabelText(/^Datum/)[0], 'the date of the event'),
      'the event stayed on a morning nothing runs on',
    ).toHaveValue(before)
  })

  it('confirms the day and the address it really wrote, not the ones on the form', async () => {
    /* The event follows its earliest race (owner, 10.08.2026), and until this was
       measured it followed it **after** the record was written: the confirmation
       and the address were both read off the form, which still said the day
       somebody typed. Measured 23.08.2026: „Datum 30/01/2027 … Adresa
       podgoricka-desetka-2027" over a record filed on 30.12.2026, so the address
       carried a year the event was no longer in and a copy made from it would have
       gone on carrying it.

       A month earlier and not a day, so the year moves too and the address has to
       move with it. */
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    const day = must(screen.getAllByLabelText(/^Datum/)[0], 'the date of the event')
    const was = isoDate(inputElement(day).value)

    await user.clear(day)
    await user.type(day, '15012027'.replace(/\D/g, ''))

    const race = must(screen.getAllByLabelText(/^Dan trke/)[0], 'the first race')

    await user.clear(race)
    await user.type(race, '30122026')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    const said = within(await screen.findByRole('status', { name: 'Sačuvano' }))

    expect(was, 'the walk starts from a day it does not move to').not.toBe('2026-12-30')
    /* The day it was filed on, rather than the day the form was left holding. */
    expect(said.getByText('30/12/2026'), 'the confirmation shows a day nothing was written on')
      .toBeVisible()
    expect(said.queryByText('15/01/2027')).toBeNull()
    /* And the address, which is built out of that day, is in the year the event is
       really in. */
    const address = must(
      said.getByText(/^Adresa događaja/).nextElementSibling?.textContent,
      'the address of the event',
    )

    expect(address, 'the address kept a year the event is not in').toMatch(/-2026$/)
  })

  it('refuses the address it would write, not the one on the form', async () => {
    /* The event follows its earliest race, so the year in its address is not the
       year somebody typed. Checked against the typed date, the clash was measured
       on a date the save never used: an event of 2027 moved onto a race of
       05/04/2025 was let through and filed as `beogradski-maraton-2025`, which the
       event of 2025 already answers to. Two records on one address, and a result
       finds its event by the address. Measured 23.08.2026.

       Two events of the same name are entered. The first is in 2026 and says so.
       The second says 2027 on its form and runs its only race in 2026, so it
       clashes with the first **only after the day is folded in**; asked about what
       was typed, the two are a year apart and both are let through. */
    const user = await openList()

    async function enter(day: string, raceDay: string) {
      await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
      await user.type(screen.getByLabelText(/^Naziv/), 'Probni događaj')
      await user.type(screen.getByLabelText(/^Datum/), day)
      await user.type(screen.getByLabelText(/^Mesto/), 'Beograd')
      await user.click(screen.getByRole('button', { name: 'Nova trka' }))
      const row = must(screen.getAllByLabelText(/^Dan trke/)[0], 'the day of the race')

      /* Emptied first: a new row opens on the day of the event (owner, 23.08.2026),
         so typing into it would append to a date that is already whole. */
      await user.clear(row)
      await user.type(row, raceDay)
      await user.type(must(screen.getAllByLabelText(/^Dužina/)[0], 'the length'), '10')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    }

    await enter('15012026', '30122026')
    expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    await enter('15012027', '30122026')

    expect(
      screen.queryByRole('status', { name: 'Sačuvano' }),
      'a second event was filed at an address the first one already answers to',
    ).toBeNull()
    expect(await screen.findByText(/već postoji/)).toBeVisible()
  })

  it('takes a race away when the row it was in is gone and the press lands', async () => {
    /* A row removed from the table is a race removed from the event, and the store
       hears about it in the same press that writes the rest. Held apart from the
       test below, which is about the table before anything is pressed. */
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    const before = screen.getAllByLabelText(/^Dužina/).length

    expect(before).toBeGreaterThan(0)

    await user.click(
      must(screen.getAllByRole('button', { name: /^Obriši \d+\. trku$/ })[0], 'the first row'),
    )
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const again = within(await screen.findByRole('table', { name: 'Događaji' }))

    await user.click(
      within(at(again.getAllByRole('row'), 1)).getByRole('button', { name: /^Otvori:/ }),
    )
    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    expect(screen.queryAllByLabelText(/^Dužina/)).toHaveLength(before - 1)
  })

  it('opens a row with no day at all where the event has none yet', async () => {
    /* A new event is entered name first, and a race may be added before the date
       is typed. The row then opens empty rather than on „NaN", and the press is
       refused until it is filled in. */
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))

    expect(must(screen.getAllByLabelText(/^Dan trke/)[0], 'the row just opened')).toHaveValue('')
  })

  it('leaves a row whose day was emptied where it is when the event moves', async () => {
    /* The rows move with the event (owner, 10.08.2026), and a row that has no day
       has nothing to move from: it is one somebody is still typing into. */
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })
    await user.clear(must(screen.getAllByLabelText(/^Dan trke/)[0], 'the first race'))

    const day = must(screen.getAllByLabelText(/^Datum/)[0], 'the date of the event')

    await user.clear(day)
    await user.type(day, '11062035')

    expect(must(screen.getAllByLabelText(/^Dan trke/)[0], 'the first race')).toHaveValue('')
  })

  it('gives a race entered after a deletion an identity nothing else holds', async () => {
    /* Counted rather than measured, the number a deleted race freed was handed to
       the next one entered: two records answered to one id, the table drew them
       under one key, and an edit to either reached both. Measured on this screen on
       23.08.2026, before the fix: React said „two children with the same key" and
       the third race was not drawn at all.

       Walked through the screen rather than over `nextRaceNumber` alone, because
       what was wrong was the list the number was counted from. */
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    const put = async (km: string) => {
      await user.click(screen.getByRole('button', { name: 'Nova trka' }))

      const all = screen.getAllByLabelText(/^Dužina/)

      await user.type(must(all[all.length - 1], 'the row just opened'), km)
    }

    await put('77')
    await put('88')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const open = async () => {
      const list = within(await screen.findByRole('table', { name: 'Događaji' }))

      await user.click(
        within(at(list.getAllByRole('row'), 1)).getByRole('button', { name: /^Otvori:/ }),
      )
      await screen.findByRole('heading', { name: /^Trke na događaju/ })
    }

    await open()

    /* The row of 77, gone. */
    const seventy = must(
      screen.getAllByLabelText(/^Dužina/).findIndex((box) => inputElement(box).value === '77'),
      'the row of 77 km',
    )

    await user.click(
      must(screen.getAllByRole('button', { name: /^Obriši \d+\. trku$/ })[seventy], 'its button'),
    )
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    await open()
    await put('99')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    await open()

    const left = screen.getAllByLabelText(/^Dužina/).map((box) => inputElement(box).value)

    expect(left, 'a race took the number a deleted one had freed').toContain('99')
    expect(left.filter((km) => km === '88'), 'two records answer to one identity')
      .toHaveLength(1)
  }, 20_000)

  it('takes a row off the table without touching what is saved until the press', async () => {
    /* Nothing here saves. A row taken off the table is gone from the table, and
       the store hears about it when the one button under it is pressed: the event
       and its mornings are one question, asked once. */
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    const before = rowsOfRaces().length

    await user.click(screen.getByRole('button', { name: 'Nova trka' }))

    expect(rowsOfRaces()).toHaveLength(before + 1)

    await user.click(lastRow().getByRole('button', { name: /^Obriši \d+\. trku$/ }))

    expect(rowsOfRaces()).toHaveLength(before)
  })

  it('leaves the results alone while two events answer at one address', async () => {
    /* A copy keeps the name and the day it was copied from, so until somebody
       changes the date two events answer where one did. A result names its event
       by address, so there is no telling whose is whose, and deleting them with
       either event takes the other's away. */
    const user = setupUser()
    const events = await loadResource<BtlEvent[]>('events')
    const scoredAt = await loadResource<Result[]>('results')
    const one = must(
      events.find((each) => scoredAt.some((result) => result.eventSlug === each.slug)),
      'an event that has results',
    )

    render(
      <ClockProvider>
        <I18nProvider locale="sr">
          <MemoryRouter initialEntries={['/sr/administracija/dogadjaji']}>
            <RoleProvider initialRole="superadmin" initialModerator={null}>
              <SessionProvider>
                <Removed />
                <Copy of={one} />
                <Routes>
                  <Route path="/sr/administracija/dogadjaji" element={<AdminEvents />} />
                </Routes>
              </SessionProvider>
            </RoleProvider>
          </MemoryRouter>
        </I18nProvider>
      </ClockProvider>,
    )

    /* The copy, made the way the button on the event makes it: same name, same
       day, so the same address. */
    await user.click(await screen.findByRole('button', { name: 'kopiraj' }))
    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), one.name)

    const row = must(
      (await table('Događaji'))
        .getAllByRole('row')
        .slice(1)
        .find((each) => (each.textContent ?? '').includes(formatShortDate(one.date, 'sr-Latn'))),
      'that event in the list',
    )

    await user.click(within(row).getByRole('button', { name: `Obriši: ${one.name}` }))
    await user.click(within(row).getByRole('button', { name: `Potvrdi brisanje: ${one.name}` }))

    expect(screen.getByTestId('removed-results')).toHaveTextContent('')
  })

  it('shows the address the save will leave, not the one the rule would build', async () => {
    /* Fifteen pairs of events in the history share a name inside one year, so
       their address carries the month as well, which the rule cannot build. The
       save keeps it; the form and the confirmation were showing the rule's
       answer, so an administrator copying a link before saving copied one that
       answers nowhere. */
    const user = setupUser()
    const events = await loadResource<BtlEvent[]>('events')
    const carried = must(
      events.find((one) => one.slug !== eventSlug(one.name, one.date)),
      'an event whose address carries more than the rule builds',
    )

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    await user.type(await screen.findByLabelText(/Pretraga/), carried.name)

    const row = must(
      within(await screen.findByRole('table', { name: 'Događaji' }))
        .getAllByRole('row')
        /* By the day, because the two of that name in that year are what put
           the month in the address in the first place. The list writes a date
           the way this language does. */
        .find((one) =>
          (one.textContent ?? '').includes(
            `${Number(carried.date.slice(8))}. ${Number(carried.date.slice(5, 7))}. ${carried.date.slice(0, 4)}.`,
          ),
        ),
      'the row of that event',
    )

    await user.click(within(row).getByRole('button', { name: /^Otvori/ }))

    const form = within(await screen.findByRole('form', { name: /Izmena događaja/ }))

    /* Not on the form: the row went off it on 11.08.2026, because there was
       nothing anybody could do about it there. It is still written on every
       save, and the confirmation is where it is read. */
    expect(form.queryByText(carried.slug)).toBeNull()

    await user.click(form.getByRole('button', { name: 'Sačuvaj' }))

    const said = await screen.findByRole('status', { name: 'Sačuvano' })

    expect(said).toHaveTextContent(carried.slug)
  })

  it('refuses to save a second event onto an address one already answers at', async () => {
    /* The rule itself is held in clash.test; what is held here is that the screen
       asks it, and asks it about the other events rather than about the one being
       saved. Given an empty list the check is inert and the copy goes through;
       given a list that includes the record itself, no event can ever be saved
       again. Both passed everything until this. */
    const user = setupUser()
    const events = await loadResource<BtlEvent[]>('events')
    const one = must(
      events.find((each) => each.date > '2027-01-01'),
      'an event ahead of us',
    )
    const day = `${one.date.slice(8, 10)}${one.date.slice(5, 7)}${one.date.slice(0, 4)}`

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
    await user.type(screen.getByLabelText(/^Naziv događaja/), one.name)
    await user.type(screen.getByLabelText(/^Datum/), day)
    await user.type(screen.getByLabelText(/^Mesto/), one.city)
    await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'race')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(
      await screen.findByText(/Događaj sa tim nazivom već postoji te godine/),
    ).toBeVisible()
    expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()

    /* And it goes through in another year, so the refusal is about the address
       and not about saving. Another day of the same year is the same address
       since 10.08.2026, which is the whole point: an event put off a week keeps
       everything that is joined to it. */
    const date = screen.getByLabelText(/^Datum/)

    await user.clear(date)
    await user.type(date, '15062028')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(screen.queryByText(/Događaj sa tim nazivom već postoji te godine/)).toBeNull()
    expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
  })

  it('lets an event be saved again without moving it', async () => {
    /* The other direction: an event compared against itself can never be saved,
       and every edit to any event is refused. */
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const rows = await table('Događaji')
    const first = at(rows.getAllByRole('row'), 1)
    const named = must(within(first).getAllByRole('cell')[1]?.textContent, 'the event')

    await user.click(within(first).getByRole('button', { name: `Otvori: ${named}` }))

    const city = await screen.findByLabelText(/^Mesto/)

    await user.clear(city)
    await user.type(city, 'Vranje')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
  })

  it('holds the measurements as numbers, because they are typed into the row', async () => {
    /* Every table on the portal writes a number the way this language writes one:
       a climb of 7120 metres as „7.120" and a distance as „42,20". This one does
       not, and that is the cost of the owner's change on 23.08.2026: the cells are
       boxes somebody types into, and a box holds the number it will be saved as.
       „42,20" typed into a number box is not a number at all.

       Said out loud rather than discovered: what a member reads is the event's own
       page, and that one still writes them this language's way
       (`pages/EventDetail.tsx`, held by its own tests). What is read here is a
       working screen, by whoever is entering the calendar. */
    const user = setupUser()
    const races = await loadResource<Race[]>('races')
    const steep = must(
      races.find((race) => race.ascentM >= 1000),
      'a race with a climb over a thousand metres',
    )
    const events = await loadResource<BtlEvent[]>('events')
    const its = must(
      events.find((one) => one.id === steep.eventId),
      'the event that race is run at',
    )

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), its.name)

    const row = must(
      (await table('Događaji'))
        .getAllByRole('row')
        .slice(1)
        .find((each) => (each.textContent ?? '').includes(formatShortDate(its.date, 'sr-Latn'))),
      'that event in the list',
    )

    await user.click(within(row).getByRole('button', { name: `Otvori: ${its.name}` }))
    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    const climbs = screen.getAllByLabelText(/^Uspon/)

    expect(
      climbs.some((box) => inputElement(box).value === String(steep.ascentM)),
      'the climb is not in the row as the number it will be saved as',
    ).toBe(true)
    /* And nothing in the row is written with a thousands separator, which would be
       a value no number box could take back. */
    expect(climbs.every((box) => !inputElement(box).value.includes('.'))).toBe(true)
  })

  it('says so where an event has none yet', async () => {
    /* The ordinary state of an event entered a fortnight before its distances
       are known, not a fault. Entered here rather than looked for, because every
       generated event has races: an event with none is exactly what somebody
       makes on this screen. */
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
    await user.type(screen.getByLabelText(/^Naziv događaja/), 'Trka bez trka')
    await user.type(screen.getByLabelText(/^Datum/), '01062027')
    await user.type(screen.getByLabelText(/^Mesto/), 'Niš')
    /* Already chosen, and left as it is: a new event is a race until somebody
       says otherwise (owner, 10.08.2026), so entering a calendar of a hundred
       races does not mean answering the same question a hundred times. */
    expect(screen.getByLabelText(/^Vrsta događaja/)).toHaveValue('race')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const rows = await table('Događaji')
    const made = must(
      rows
        .getAllByRole('row')
        .slice(1)
        .find((row) => (row.textContent ?? '').includes('Trka bez trka')),
      'the event that was just entered',
    )

    await user.click(within(made).getByRole('button', { name: /^Otvori:/ }))

    expect(await screen.findByText('Ovaj događaj još nema nijednu trku.')).toBeVisible()
  })
})

/**
 * The country an event is in, which no screen shows.
 *
 * It stopped being a field on 10.08.2026 and became the second half of the town
 * beside it (forms/types.ts). Nothing on any screen draws it, so an event
 * filed in the wrong country looks exactly like one filed in the right country,
 * and the first version of this went in carrying the word "undefined": the
 * layer that turns a form into a record walks the fields, and the country is
 * not one. Read here out of what the session was told to save, through the
 * screen and the keyboard, because a test that hands the record layer a country
 * of its own proves only that the record layer can copy a value.
 */
/**
 * The league the portal itself is.
 *
 * Every event counts towards it, its standings are the BTL tables, and there is
 * nothing anybody would ever change about it (owner, 10.08.2026: „Ona se
 * podrazumeva i ne uređuje se."). The generator stopped writing it on the same
 * day, so what is left is a guard against a league somebody makes by hand at
 * that address, and a guard nothing exercises is a line that can be deleted
 * without a test noticing. Both screens are asked, because both filter and each
 * would fail on its own.
 */
describe('Balkanska trkačka liga among the leagues', () => {
  /** The file, answered with the main league and one ordinary one. */
  function servingBoth() {
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/leagues.json')
        ? new Response(
            JSON.stringify([
              {
                id: 'league-btl-2027',
                slug: 'btl-2027',
                name: 'Balkanska trkačka liga 2027',
                season: 2027,
                groupsByCategory: true,
                rules: '',
                prizes: '',
                eventIds: [],
              },
              {
                id: 'league-druga-2027',
                slug: 'druga-2027',
                name: 'Druga liga 2027',
                season: 2027,
                groupsByCategory: false,
                rules: '',
                prizes: '',
                eventIds: [],
              },
            ]),
            { status: 200 },
          )
        : real(input))

    return () => {
      globalThis.fetch = real
    }
  }

  it('is not offered for editing, and the leagues beside it are', async () => {
    const stop = servingBoth()

    renderAt('/sr/administracija/lige', 'superadmin')

    const rows = await table('Lige')
    const words = rows.getAllByRole('row').map((one) => one.textContent ?? '')

    expect(words.some((one) => one.includes('Druga liga 2027'))).toBe(true)
    expect(words.some((one) => one.includes('Balkanska trkačka liga'))).toBe(false)

    stop()
  })

  it('is not listed to a visitor either, for the same reason', async () => {
    const stop = servingBoth()

    renderAt('/sr/lige')

    expect(await screen.findByRole('link', { name: /Druga liga 2027/ })).toBeVisible()
    expect(screen.queryByRole('link', { name: /Balkanska trkačka liga/ })).toBeNull()

    stop()
  })
})

/**
 * The form a new event is entered on (owner, 11.08.2026).
 *
 * Four changes in one breath, and each of them is a thing that used to be asked
 * for and is not any more, or the other way round.
 */
describe('what the form for a new event asks for', () => {
  async function openNew() {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))

    return user
  }

  it('does not ask for an organiser, which the portal follows nowhere', async () => {
    await openNew()

    expect(screen.queryByLabelText(/^Organizator/)).toBeNull()
  })

  it('does not show the address, which the portal makes for itself', async () => {
    /* It is still made and still saved (entityForms.ts, `addressOfEvent`); what
       went is the row on the form, which was a line nobody could act on. */
    await openNew()

    expect(screen.queryByText(/^Adresa događaja/)).toBeNull()
  })

  it('asks whether the event is featured, and opens on no', async () => {
    await openNew()

    const featured = screen.getByLabelText(/^Istaknuto/)

    expect(featured).toHaveValue('no')
    expect([...selectElement(featured).options].map((one) => one.textContent)).toEqual([
      'Ne',
      'Da',
    ])
  })

  it('opens on Serbia, and takes the country from a town that is in the codebook', async () => {
    /* Two halves of one answer, in one row: the town is typed and the country
       is chosen, and a town the codebook knows fills both. */
    const user = await openNew()
    const country = screen.getByLabelText(/^Država/)

    expect(country).toHaveValue('RS')

    await user.type(screen.getByLabelText(/^Mesto/), 'Zagre')
    await user.click(
      within(await screen.findByRole('listbox', { name: 'Ponuđena mesta' })).getByRole('option', {
        name: /^Zagreb/,
      }),
    )

    expect(country).toHaveValue('HR')
  })

  it('leaves the country to be chosen for a town the codebook has never heard of', async () => {
    /* A race in a hamlet of two hundred people. What must not happen is that it
       keeps the country of whatever town was chosen before it. */
    const user = await openNew()

    await user.type(screen.getByLabelText(/^Mesto/), 'Zagre')
    await user.click(
      within(await screen.findByRole('listbox', { name: 'Ponuđena mesta' })).getByRole('option', {
        name: /^Zagreb/,
      }),
    )
    await user.clear(screen.getByLabelText(/^Mesto/))
    await user.type(screen.getByLabelText(/^Mesto/), 'Divčibare')

    /* Left as it was, and on the screen: the country of a town the codebook does
       not have is chosen by hand, and what stands there is what will be saved.
       It used to be cleared here, back when it was written and never shown. */
    expect(screen.getByLabelText(/^Država/)).toHaveValue('HR')

    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')

    expect(screen.getByLabelText(/^Država/)).toHaveValue('RS')
  })

  it('offers the races before anything is saved, and saves them with the event', async () => {
    /* Owner, 23.08.2026: „kad se pravi novi događaj, isto treba da dodajem trke pre
       nego što sačuvam sve odjednom". The table stands under the form from the
       moment it opens, on an event that does not exist yet, and one press writes
       both.

       It used to be the other way round: a race could be hung only on a record
       that already had an identity, so the moderator saved, went back to a list of
       eleven hundred, and found the event they had made a moment ago. */
    const user = await openNew()

    expect(screen.getByRole('button', { name: 'Nova trka' })).toBeVisible()

    await user.type(screen.getByLabelText(/^Naziv događaja/), 'Trka sa trkama')
    await user.type(screen.getByLabelText(/^Datum/), '01062027')
    await user.type(screen.getByLabelText(/^Mesto/), 'Niš')

    await user.click(screen.getByRole('button', { name: 'Nova trka' }))

    const rows = screen.getAllByLabelText(/^Dužina/)

    /* The row opened on the day the form above is showing. */
    expect(must(screen.getAllByLabelText(/^Dan trke/)[0], 'the day of the race')).toHaveValue(
      '01/06/2027',
    )

    await user.type(must(rows[0], 'the length of the race'), '21.1')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()

    /* And the race is under the event rather than merely announced. „Sačuvano" is
       what the form says about itself, and it says it whether or not the rows were
       written: measured 23.08.2026, an `alsoSave` that skipped an event with no
       races of its own lost every row and the screen still said it was saved. The
       list is opened again and the event reopened, because that is the only thing
       that reads the record back. */
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))
    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), 'Trka sa trkama')

    const found = within(await screen.findByRole('table', { name: 'Događaji' }))

    await user.click(
      within(at(found.getAllByRole('row'), 1)).getByRole('button', { name: /^Otvori:/ }),
    )
    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    expect(
      screen.getAllByLabelText(/^Dužina/).map((one) => inputElement(one).value),
      'the race entered beside the new event was not written under it',
    ).toEqual(['21.1'])
  })

  it('takes a race with no name at all, since the length is what names it', async () => {
    /* A race is known by how long it is (owner, 11.08.2026), so nothing asks for a
       name; the row has no box for one. */
    const user = await openNew()

    await user.type(screen.getByLabelText(/^Naziv događaja/), 'Trka bez imena')
    await user.type(screen.getByLabelText(/^Datum/), '02062027')
    await user.type(screen.getByLabelText(/^Mesto/), 'Niš')
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))

    const under = within(screen.getByRole('table', { name: /^Trke na događaju/ }))

    expect(under.queryByLabelText(/^Naziv/), 'a race is asked for a name').toBeNull()

    await user.type(
      must(screen.getAllByLabelText(/^Dužina/)[0], 'the length of the race'),
      '21.1',
    )
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
  })
})

describe('the country an event is filed in', () => {
  /** One town out of the list the place field offers. Asked for by the name the
   *  list carries, because the portal has other listboxes open at once (the
   *  language menu is one) and "the listbox" is not one thing. */
  async function townOffered(named: string): Promise<HTMLElement> {
    const list = await screen.findByRole('listbox', { name: 'Ponuđena mesta' })

    return within(list).getByRole('option', { name: new RegExp(`^${named}`) })
  }

  /** The control that opens one event's record.
   *
   * Found by its date as well as its name: a race is run every year under the
   * same name, so "the row saying Fruškogorski maraton" is a dozen rows, and
   * the first one is not the one whose country was read. */
  async function openRow(event: BtlEvent, user: Pressing): Promise<HTMLElement> {
    /* Searched for first: the screen shows sixty rows of eleven hundred, and
       an event from 2010 is not among them. */
    await table('Događaji')
    await user.type(screen.getByLabelText(/^Pretraga/), event.name)

    const rows = await table('Događaji')
    const day = formatShortDate(event.date, 'sr-Latn')
    const mine = must(
      rows
        .getAllByRole('row')
        .slice(1)
        .find((row) => {
          const words = row.textContent ?? ''

          return words.includes(event.name) && words.includes(day)
        }),
      `the row for ${event.name} on ${day}`,
    )

    return within(mine).getByRole('button', { name: `Otvori: ${event.name}` })
  }

  /** What the session was told about one record, by id. */
  async function told(what: string): Promise<string> {
    const lines = within(await screen.findByRole('list', { name: 'session records' }))

    return must(
      lines.getAllByRole('listitem').find((one) => (one.textContent ?? '').includes(what)),
      `something saved for ${what}`,
    ).textContent ?? ''
  }

  it('comes with the town that was picked, on an event being entered', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin', null, undefined, null, <Saved />)

    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
    await user.type(screen.getByLabelText(/^Naziv događaja/), 'Trka sa mestom')
    await user.type(screen.getByLabelText(/^Datum/), '01062027')

    /* Picked out of the codebook rather than typed whole, because picking is
       what carries the country. */
    await user.type(screen.getByLabelText(/^Mesto/), 'Zagre')
    await user.click(await townOffered('Zagreb'))
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    expect(await told('Trka sa mestom')).toContain('country=HR')
  })

  it('changes with the town, on an event being edited', async () => {
    /* The fault this guards is written on the field itself: a race in Beograd
       edited into Zagreb would be filed in Serbia, and no screen would say so. */
    const user = setupUser()
    const events = await loadResource<BtlEvent[]>('events')
    const serbian = must(
      events.find((one) => one.country === 'RS' && one.city !== ''),
      'an event in Serbia',
    )

    renderAt('/sr/administracija/dogadjaji', 'superadmin', null, undefined, null, <Saved />)

    await user.click(await openRow(serbian, user))
    await user.clear(screen.getByLabelText(/^Mesto/))
    await user.type(screen.getByLabelText(/^Mesto/), 'Zagre')
    await user.click(await townOffered('Zagreb'))
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    expect(await told(serbian.id)).toContain('country=HR')
  })

  it('stays as it was where the town was not touched', async () => {
    /* The other half, and the one a fix for the first half breaks: saving a
       form that nobody typed a town into must not blank the country it came
       with. */
    const user = setupUser()
    const events = await loadResource<BtlEvent[]>('events')
    const serbian = must(
      events.find((one) => one.country === 'RS' && one.city !== ''),
      'an event in Serbia',
    )

    renderAt('/sr/administracija/dogadjaji', 'superadmin', null, undefined, null, <Saved />)

    await user.click(await openRow(serbian, user))
    /* Any change at all, so the save is a save: the organiser field went off
       this form on 11.08.2026 (owner), and what is under test here is the
       country beside the town rather than any particular field. */
    await user.type(screen.getByLabelText(/^Naziv događaja/), ' i prijatelji')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    expect(await told(serbian.id)).toContain('country=RS')
  })
})

describe('the address of a league', () => {
  /* A league is filed under an id nobody sees and answers at an address somebody
     chose: `runtrace-2027` is not what the rule would make of "RunTrace liga
     2027". So the form asks for it, like a written page, rather than deriving it
     from the name, which would take the address away from everyone who has it
     (PENDING, and the rule for teams and events of 03.08.2026). */
  it('is asked for on the form, and a league entered by hand answers at it', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/lige', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
    await user.type(screen.getByLabelText(/^Naziv lige/), 'Vojvođanska liga 2027')
    await user.type(screen.getByLabelText(/^Adresa/), 'vojvodjanska-2027')
    await user.type(screen.getByLabelText(/^Sezona/), '2027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const listed = within(await screen.findByRole('table', { name: 'Lige' }))

    /* The address is on the record, and it leads somewhere: a league entered by
       hand used to get an empty one and stand at /liga/, which is no league at
       all.

       What the address answers with is not read here. Nothing the administration
       creates reaches a public screen at all, because those read the file and
       not what this visit has added to it; that is older and wider than this
       form and is written down as its own job (PENDING, R7). */
    expect(listed.getByRole('link', { name: '/liga/vojvodjanska-2027' })).toHaveAttribute(
      'href',
      '/sr/liga/vojvodjanska-2027',
    )
  })

  it('is not saved without one, since a league without an address is at /liga/', async () => {
    /* The whole of what this rule is for. Without it the address saves empty,
       the list draws a link to /liga/, and the league is the one thing the
       portal cannot answer with. */
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
    await user.type(screen.getByLabelText(/^Naziv lige/), 'Liga bez adrese')
    await user.type(screen.getByLabelText(/^Sezona/), '2027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()
    expect(screen.getByLabelText(/^Adresa/)).toHaveAccessibleDescription(/obavezno/)
  })

  it('takes only what an address may be made of', async () => {
    /* Lower case, digits and dashes. A capital or a space is not refused for
       tidiness: the address is what the portal answers at, and a value that
       cannot stand in one is a league nobody reaches. */
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
    await user.type(screen.getByLabelText(/^Naziv lige/), 'Vojvođanska liga 2027')
    await user.type(screen.getByLabelText(/^Adresa/), 'BTL 2027')
    await user.type(screen.getByLabelText(/^Sezona/), '2027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()
    /* The complaint itself, and on the address. Matched against the words the
       hint under the field uses, this passed whether or not anything was wrong:
       the hint is part of what describes the field either way. */
    expect(screen.getByLabelText(/^Adresa/)).toHaveAccessibleDescription(
      /nije u očekivanom obliku/,
    )
  })

  it('is refused where another league already answers at it', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
    await user.type(screen.getByLabelText(/^Naziv lige/), 'Druga liga')
    await user.type(screen.getByLabelText(/^Adresa/), 'runtrace-2027')
    await user.type(screen.getByLabelText(/^Sezona/), '2027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByText(/već zauzeta/)).toBeVisible()
    expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()
  })

  it('lets a league be saved again without its own address getting in the way', async () => {
    /* Compared by identity rather than by address, every league refused the
       address it already answers at. */
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    const row = at((await table('Lige')).getAllByRole('row'), 1)

    await user.click(within(row).getByRole('button', { name: /^Otvori/ }))
    await user.click(await screen.findByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
  })
})

describe('teams', () => {
  it('shows each team with its organiser and its head count', async () => {
    renderAt('/sr/administracija/timovi', 'superadmin')

    const rows = await table('Timovi')
    expect(rows.getAllByRole('columnheader').map((one) => one.textContent)).toContain(
      'Organizator',
    )
    expect(rows.getAllByRole('row').length).toBeGreaterThan(1)
  })

  it('is closed to a competitor', async () => {
    renderAt('/sr/administracija/timovi', 'competitor')

    expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent('Timovi')
  })
})

describe('leagues', () => {
  it('marks a league that carries no events', async () => {
    renderAt('/sr/administracija/lige', 'superadmin')

    const rows = await table('Lige')
    // The generator deliberately leaves one league empty, which is the case
    // worth seeing from the list.
    expect(rows.getAllByText('Bez događaja').length).toBeGreaterThan(0)
  })

  it('says whether a league groups by category', async () => {
    renderAt('/sr/administracija/lige', 'superadmin')

    const rows = await table('Lige')
    expect(rows.getAllByText(/^Da$|^Ne$/).length).toBeGreaterThan(0)
  })

  it('is closed to a competitor', async () => {
    renderAt('/sr/administracija/lige', 'competitor')

    expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent('Lige')
  })
})

describe('the written pages', () => {
  it('lists every page with its address', async () => {
    renderAt('/sr/administracija/strane', 'superadmin')

    const rows = await table('Statične strane')
    expect(rows.getByRole('link', { name: '/pravilnik' })).toBeVisible()
  })

  it('changes a title in place', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/strane', 'superadmin')

    const rows = await table('Statične strane')
    await user.click(rows.getByRole('button', { name: /^Naslov: Opšti pravilnik/ }))
    const field = rows.getByRole('textbox', { name: 'Naslov' })
    await user.clear(field)
    await user.type(field, 'Pravilnik 2027')
    await user.tab()

    expect(rows.getByRole('button', { name: /^Naslov: Pravilnik 2027/ })).toBeVisible()
  })

  it('is closed to a competitor', async () => {
    renderAt('/sr/administracija/strane', 'competitor')

    expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent(
      'Statične strane',
    )
  })
})

/** Makes a copy of an event the way the button on its own page does: the same
 *  name and the same day, so the same address (event/EventActions.tsx). */
function Copy({ of }: { of: BtlEvent }) {
  const { create } = useSession()

  return (
    <button
      type="button"
      onClick={() =>
        create('events', `${of.id}-kopija-1`, {
          name: of.name,
          date: `${of.date.slice(8, 10)}/${of.date.slice(5, 7)}/${of.date.slice(0, 4)}`,
          city: of.city,
          country: of.country,
          kind: of.kind,
        })
      }
    >
      kopiraj
    </button>
  )
}

/** What the session has been told to remove, drawn beside the screen that tells
 *  it. The only way to see a race that is no longer anywhere: nothing on the
 *  portal draws a race outside its event, which is the whole reason the deletion
 *  has to carry them. */
function Removed() {
  const { deletions } = useSession()

  return (
    <>
      <span data-testid="removed">{(deletions.races ?? []).join(',')}</span>
      <span data-testid="removed-results">{(deletions.results ?? []).join(',')}</span>
    </>
  )
}

describe('an event that is deleted', () => {
  it('takes its races with it, since nothing shows a race outside its event', async () => {
    /* This is what used to leave an orphan: the race screen kept showing a race
       whose event was gone, because it was the one place a race could be seen at
       all. There is no such place now (owner, 06.08.2026), so a race left behind
       would be a record nobody can reach.

       Read off the session and not off a screen. The row goes whether or not the
       cascade runs, so the list of events proved nothing; and a record entered
       again under the same name is handed a new identity (entityForms.ts,
       `idFor`), so the races could not be made to reappear under it either. */
    const user = setupUser()
    const events = await loadResource<BtlEvent[]>('events')
    const races = await loadResource<Race[]>('races')
    const scoredAt = await loadResource<Result[]>('results')
    const one = must(
      events.find(
        (each) =>
          races.some((race) => race.eventId === each.id) &&
          scoredAt.some((result) => result.eventSlug === each.slug),
      ),
      'an event that has both races and results',
    )
    const its = races.filter((race) => race.eventId === one.id).map((race) => race.id)

    expect(its.length).toBeGreaterThan(0)

    render(
      <ClockProvider>
        <I18nProvider locale="sr">
          <MemoryRouter initialEntries={['/sr/administracija/dogadjaji']}>
            <RoleProvider initialRole="superadmin" initialModerator={null}>
              <SessionProvider>
                <Removed />
                <Routes>
                  <Route path="/sr/administracija/dogadjaji" element={<AdminEvents />} />
                </Routes>
              </SessionProvider>
            </RoleProvider>
          </MemoryRouter>
        </I18nProvider>
      </ClockProvider>,
    )

    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), one.name)

    /* By the name and the day both: the same race is run every year, so eight
       rows carry that name and only one of them is this morning. */
    const shown = formatShortDate(one.date, 'sr-Latn')
    const row = must(
      (await table('Događaji'))
        .getAllByRole('row')
        .slice(1)
        .find(
          (each) =>
            (each.textContent ?? '').includes(one.name) &&
            (each.textContent ?? '').includes(shown),
        ),
      'that event in the list',
    )

    await user.click(within(row).getByRole('button', { name: `Obriši: ${one.name}` }))
    await user.click(within(row).getByRole('button', { name: `Potvrdi brisanje: ${one.name}` }))

    const removed = (screen.getByTestId('removed').textContent ?? '').split(',')

    for (const race of its) {
      expect(removed, `${race} went with its event`).toContain(race)
    }

    /* And its results, which is what the same deletion does from the event's own
       page: left behind they go on counting in the standing and in the boards,
       each of them linking to a page that says the event does not exist. */
    const scored = scoredAt.filter((each) => each.eventSlug === one.slug).map((each) => each.id)
    const dropped = (screen.getByTestId('removed-results').textContent ?? '').split(',')

    expect(scored.length).toBeGreaterThan(0)

    for (const result of scored) {
      expect(dropped, `${result} went with its event`).toContain(result)
    }
  })
})
