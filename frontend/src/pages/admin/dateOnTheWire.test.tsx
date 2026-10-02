import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { dogadjaj, registracija, unosRezultata } from '../../forms/definitions'
import { storedDates } from '../../forms/records'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { SLOW } from '../../test/slow'
import { raceUpsertFrom } from './eventWrites'
import type { RaceRow } from './raceRows'

/**
 * EVERY FORM THAT ASKS FOR A DAY PUTS IT ON THE WIRE THE WAY THE SERVER READS IT.
 *
 * <p><b>Why this file exists, and it is a measurement of 29.09.2026 rather than tidiness.</b>
 * Dates are written and read as `dd/mm/gggg` everywhere on the portal (PDL P8,
 * `forms/dateField.ts`), and `forms/records.ts`'s `valuesFor` writes exactly that into the
 * values a form holds. Every route that takes one declares a `LocalDate`, which Jackson reads
 * as ISO-8601 and as nothing else: nothing under `backend/src/main/resources` names a date
 * format. So there is a conversion between the two on every road from a form to a route, and
 * a road that forgets it does not fail halfway - it fails BEFORE the route is entered at all,
 * with Spring's own 400 carrying no reason, which the screen can only report as a number.
 *
 * <p><b>That is exactly what happened, and it reached the owner on QA.</b> The calendar's own
 * road forgot it: `POST /api/events` carried `"date":"08/05/2027"` and `PUT /api/events/{id}`
 * carried `"date":"16/01/2027"`, so no event could be saved at all, neither a new one nor one
 * being changed.
 *
 * <p><b>And nothing could see it, which is the part worth keeping.</b>
 * `pages/account/refusals.test.ts` is a floor over the NAMES a route can answer with, held to
 * the Java source in both directions, and it was green: a body the route cannot parse never
 * reaches a name. Three of the four forms that carry a day were already right AND each had a
 * case reading its own request body (`Registration.test.tsx`, `resultToTheServer.test.tsx`,
 * and the race's own in `eventWrites.test.ts`); the fourth was the only one with no such case
 * and the only one that was wrong. This file is that coincidence turned into a rule.
 */

/** Where the definitions live, which is the only list of forms there is. */
const DEFINITIONS = join(process.cwd(), 'src', 'forms', 'definitions')

/**
 * THE FORMS THAT REALLY DECLARE A DAY, READ OFF THE FILES RATHER THAN REMEMBERED.
 *
 * <p>The floor under the table below, and the whole reason this is a gate rather than four
 * cases: a fifth form that asks for a date arrives here as a red gate on the day it is
 * written, and somebody answers the question once instead of finding out on QA.
 */
function formsThatAskForADay(): string[] {
  return readdirSync(DEFINITIONS)
    .filter((name) => name.endsWith('.form.json'))
    .filter((name) => {
      const read: unknown = JSON.parse(readFileSync(join(DEFINITIONS, name), 'utf-8'))
      const fields: unknown = typeof read === 'object' && read !== null
        ? Reflect.get(read, 'fields')
        : undefined

      return (
        Array.isArray(fields) &&
        fields.some((one: unknown) => typeof one === 'object' && one !== null
          && Reflect.get(one, 'type') === 'date')
      )
    })
    .sort((left, right) => left.localeCompare(right))
}

/**
 * The one row of the table of mornings the race half of this needs, which is the shape
 * `admin/EventRaces.tsx` keeps and `raceUpsertFrom` takes.
 */
const A_MORNING: RaceRow = {
  id: '',
  name: 'Polumaraton',
  renamed: true,
  date: '',
  kind: 'length',
  limitHours: '',
  distanceKm: '21.1',
  ascentM: '120',
  descentM: '110',
}

/**
 * WHAT EACH OF THEM PUTS ON THE WIRE, GIVEN WHAT THE FORM HOLDS.
 *
 * <p><b>Three of the four go through ONE door, and each row hands that door its own
 * definition.</b> Owner, 02.10.2026 (`btl-produkt/PDL.md`, „Odluke iz ciscenja nalaza"): the
 * conversion of a date has one place for every form, which is `storedDates` in
 * `forms/records.ts`, called by `FormRenderer` when a form is sent. Until that day each
 * screen converted for itself (`upsertFrom` through `isoDate`, the other two through
 * `storedDate`), and those three crossings are gone: a screen now reads the day it is handed.
 * Each row asks the door about the field ITS form really has, so a definition whose date is
 * renamed or retyped fails here under its own name.
 *
 * <p><b>The table of mornings keeps a road of its own, and that is a boundary rather than an
 * exception.</b> A race is not entered through a form: `admin/EventRaces.tsx` draws a row of
 * controls per race and `raceRows.storedRow` is the one place those rows are converted. Its
 * definition is on disk, so it is named here, and the road named is the one it really takes.
 *
 * <p>That a screen really hands over what the door made is asserted where its own request body
 * is read: the calendar below, `pages/Registration.test.tsx` („birthDate" is `1985-04-12` and
 * `2012-05-20`) and `pages/member/resultToTheServer.test.tsx` („day" is `2026-05-10`).
 */
const ONTO_THE_WIRE: Record<string, (day: string) => string> = {
  'admin-dogadjaj.form.json': (day) => String(storedDates(dogadjaj, { date: day }).date),
  'admin-trka.form.json': (day) => raceUpsertFrom({ ...A_MORNING, date: day }, '77').date,
  'registracija.form.json': (day) =>
    String(storedDates(registracija, { birthDate: day }).birthDate),
  'unos-rezultata.form.json': (day) => String(storedDates(unosRezultata, { date: day }).date),
}

describe('every form that asks for a day', () => {
  it('is named here, and names no form that does not ask for one', () => {
    /* Both directions, the shape `pages/account/refusals.test.ts` already has: a form that
       gains a date field fails this, and a name left behind after one loses its date field
       fails it too, so the table cannot quietly stop covering anything. */
    expect(Object.keys(ONTO_THE_WIRE).sort((left, right) => left.localeCompare(right))).toEqual(
      formsThatAskForADay(),
    )
  })

  /**
   * THE DAY AND THE MONTH ARE DIFFERENT NUMBERS, AND THAT IS THE WHOLE POSTAVKA.
   *
   * <p>16 and 01, so the reader's shape and the route's shape are two different strings and a
   * conversion that swapped the pieces would answer `2027-16-01` rather than the right thing
   * by accident. A date like 05/05/2027 satisfies this case whichever way round it is read.
   */
  it.each(Object.entries(ONTO_THE_WIRE))('sends an ISO day from %s', (_form, onto) => {
    expect(onto('16/01/2027')).toBe('2027-01-16')
  })
})

/** Every write the screen made, in order, with its body read back. */
function wroteBy(asked: Asked[], how: string, under: RegExp) {
  return asked
    .filter((one) => one.init?.method === how && under.test(one.path))
    .map((one) => {
      /* Annotated rather than asserted (ADL A14, and `oxlint` refuses the assertion
         outright): `JSON.parse` answers `any`, and what came off the wire is narrowed by
         looking at it in `said` below rather than claimed to be of any shape here. */
      const body: unknown = JSON.parse(String(one.init?.body))

      return { path: one.path, body }
    })
}

/** One field off a body that came back as `unknown` (ADL A14). */
function said(body: unknown, field: string): unknown {
  return typeof body === 'object' && body !== null ? Reflect.get(body, field) : undefined
}

/**
 * AND THE SCREEN REALLY TAKES THAT ROAD, WHICH IS THE JOIN THE CASES ABOVE CANNOT ASSERT.
 *
 * <p><b>Two halves and the thing between them.</b> The cases above say the door converts the
 * day of the calendar's own definition; `eventWrites.test.ts` says `upsertFrom` hands on the
 * day it is given without converting it a second time. Neither of them says the SCREEN puts
 * the one in front of the other: the calendar folds the values, writes them as text and builds
 * the body out of them (`admin/EntityEditor.tsx`, `admin/AdminEvents.tsx`), and any of those
 * steps can put the reader's `dd/mm/gggg` back on the wire, which is the fault this whole file
 * is about. These cases are that join, and they read what really went over rather than what a
 * module answers.
 */
describe('the calendar screen', () => {
  it('sends the day of the event it was opened on, as the route reads it', async () => {
    const server = serverThat(() => null)
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const openers = await screen.findAllByRole('button', { name: /^Otvori: / }, { timeout: 20000 })

    /* THE SECOND AND NOT THE FIRST, because the served file is read below to say what the
       right answer is: opened on the first row, `events[0].date` and „the date of the event
       this case acts on" would be one value and the case would pass either way. */
    await user.click(must(openers[1], 'a second event to open'))

    await screen.findByRole('combobox', { name: /Mesto/ }, { timeout: 20000 })
    await user.click(must(screen.getAllByRole('button', { name: 'Sačuvaj' })[0], 'Sačuvaj'))

    const wrote = must(wroteBy(server.asked, 'PUT', /^\/api\/events\/\d+$/)[0], 'the change sent')
    /* WHICH event is read off the ADDRESS the screen chose, and the day it should carry is
       read out of the served file by that identity - so the two values come from two places
       and a screen sending somebody else's day fails here. */
    const id = Number(must(/\/api\/events\/(\d+)$/.exec(wrote.path), 'the identity')[1])
    const file: unknown = JSON.parse(
      readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'events.json'), 'utf-8'),
    )
    const standing = must(
      (Array.isArray(file) ? file : []).find(
        (one: unknown) => said(one, 'id') === id,
      ),
      'the event this case acts on',
    )

    expect(said(wrote.body, 'date')).toBe(said(standing, 'date'))
    /* And the mornings under it went over the same way, which is the axis this case would
       otherwise measure nothing about: one press writes the event and its races, and it was
       the EVENT's date that was wrong while the race's was right. */
    for (const race of wroteBy(server.asked, 'PUT', /^\/api\/races\/\d+$/)) {
      expect(said(race.body, 'date')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }

    server.stop()
  }, SLOW)

  it('sends the day that was typed into a new event, and not the one it opened on', async () => {
    const server = serverThat(() => null)
    const user = setupUser()

    /* The address carries 8 May and the box is then typed over with 16 January, so what the
       form OPENED on and what it SENDS are two different days. Read off an untouched form,
       `?nov=2027-05-08` and the answer would be the same string and this would pass whether or
       not anything converted anything. */
    renderAt('/sr/administracija/dogadjaji?nov=2027-05-08', 'superadmin')

    const town = await screen.findByRole('combobox', { name: /Mesto/ }, { timeout: 20000 })
    const day = screen.getByRole('textbox', { name: /Datum/ })

    await user.clear(day)
    await user.type(day, '16012027')
    await user.type(screen.getByRole('textbox', { name: /Naziv doga/ }), 'Ohrid trčat')
    await user.type(town, 'Ohrid')
    await user.click(must(screen.getAllByRole('button', { name: 'Sačuvaj' })[0], 'Sačuvaj'))

    const wrote = must(wroteBy(server.asked, 'POST', /^\/api\/events$/)[0], 'the event sent')

    expect(said(wrote.body, 'date')).toBe('2027-01-16')

    /* AND THE CONFIRMATION SPELLS IT THE WAY THE FORM ASKED FOR IT. What is confirmed is the
       values as they left the form, and since 02.10.2026 they leave holding the day the way a
       record keeps it; read straight out, the confirmation said „2027-01-16" under a field
       that is typed and read as dd/mm/gggg everywhere else on the portal (PDL P8). */
    const confirmed = await screen.findByRole('status', { name: 'Sačuvano' })

    expect(within(confirmed).getByText('16/01/2027')).toBeInTheDocument()
    expect(within(confirmed).queryByText('2027-01-16')).not.toBeInTheDocument()

    server.stop()
  }, SLOW)

  /**
   * THE DAY A RACE FOLDS INTO THE EVENT GOES OVER AS THE ROUTE READS IT TOO.
   *
   * <p>The event follows its first morning (owner, 10.08.2026), so a race moved to a day
   * before the event makes that day the event's, and the screen folds it into the values
   * before anything reads them (`alsoFolds`). That fold is asked TWICE: once over what was
   * typed, by the rule that refuses a clash, and once over what the form hands over, which
   * since 02.10.2026 keeps its day the way a record does. Folded into the typed shape on the
   * second asking, the body carried `dd/mm/gggg` and the route could not read it.
   *
   * <p><b>Two sources, separated:</b> the race is moved to the day BEFORE the one in the
   * event's own box, so the day that goes over can only have come from the race. Read off an
   * event whose race stands on its own day, the fold never happens and this would pass whether
   * or not it was right.
   */
  it('sends the day of the earliest race when a race moves the event, as the route reads it', async () => {
    const server = serverThat(() => null)
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const openers = await screen.findAllByRole('button', { name: /^Otvori: / }, { timeout: 20000 })

    await user.click(must(openers[1], 'a second event to open'))
    await screen.findByRole('combobox', { name: /Mesto/ }, { timeout: 20000 })

    const own = screen.getByRole('textbox', { name: /^Datum$/ })
    const typed = must(/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(inputValue(own)), 'the day of the event')
    const before = new Date(Date.UTC(Number(typed[3]), Number(typed[2]) - 1, Number(typed[1]) - 1))
    const iso = before.toISOString().slice(0, 10)
    const race = screen.getByRole('textbox', { name: /^Datum, 1\. trka$/ })

    await user.clear(race)
    await user.type(race, `${iso.slice(8)}${iso.slice(5, 7)}${iso.slice(0, 4)}`)
    await user.click(must(screen.getAllByRole('button', { name: 'Sačuvaj' })[0], 'Sačuvaj'))

    const wrote = must(wroteBy(server.asked, 'PUT', /^\/api\/events\/\d+$/)[0], 'the change sent')

    expect(said(wrote.body, 'date')).toBe(iso)

    server.stop()
  }, SLOW)
})

/** What a box holds, read without asserting what kind of element it is (ADL A14). */
function inputValue(box: HTMLElement): string {
  return box instanceof HTMLInputElement ? box.value : ''
}
