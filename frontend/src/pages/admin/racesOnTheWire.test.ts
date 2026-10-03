import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RACE_KINDS, type RaceKind } from '../../data/types'
import { renderAt } from '../../test/render'
import { serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { raceUpsertFrom } from './eventWrites'
import type { RaceRow } from './raceRows'
import onTheWire from './racesOnTheWire.json'

/**
 * WHAT THE TABLE OF MORNINGS PUTS ON THE WIRE, HELD TO THE FILE THE ROUTE IS HELD TO.
 *
 * <p><b>Why this file exists, and it is a measurement of 03.10.2026 on QA.</b> The owner
 * entered an event with its races; `POST /api/events` answered 201 and the first
 * `POST /api/races` answered 400, and event 713 was left with no race at all. Every case on
 * this side was green, because every one of them answers `/api/races` from a stub
 * (`test/setup.ts`) that takes any body it is handed. And every case on the server's side was
 * green, because each sends a body written for it by hand. Both halves were measured; what
 * joins them was not.
 *
 * <p><b>So the join is a FILE, and both sides are held to it.</b> `racesOnTheWire.json` is
 * what this screen sends for one race of each kind, byte for byte what `askTheServer` puts on
 * the wire (`JSON.stringify` of `raceUpsertFrom`). This file holds that the screen sends
 * exactly that; `RaceWriteApiTest` reads the same file and replays every body against the
 * real route, through both doors the screen uses (`POST /api/races` for a new row,
 * `PUT /api/races/{id}` for one that is already a race). A change on either side that the
 * other does not follow fails one of the two, and changing the file alone fails this one.
 *
 * <p><b>The screen's own door is the third link, and it is held at the foot of this file.</b>
 * The first cases hold the BUILDER to the file; they cannot say that the screen hands a row to
 * the builder when it makes a race, and that call stands one token away from sending the record
 * instead (`admin/AdminEvents.tsx`, `writeTheRaces`). The last case walks the screen and reads
 * what really goes over.
 *
 * <p>The rows are the shape the owner typed: a race entered with „Nova trka" and only its
 * length written in (`newRaceRow` opens it as a race of a length), and one of each of the
 * other two kinds beside it. The cell a kind does not fix is left EMPTY here, because that is
 * the ordinary row; a row that still holds a number typed before its kind was changed is a
 * question about this side alone, and is asked below without the file.
 */

/** The event the rows hang off, as the screen names it: the id the server handed back. */
const UNDER = '713'

const ROWS: Record<RaceKind, RaceRow> = {
  /* What „Nova trka" opens and the owner fills in: a length with a comma, nothing else. */
  length: {
    id: '',
    name: 'BBKT',
    renamed: false,
    date: '10/01/2027',
    kind: 'length',
    limitHours: '',
    distanceKm: '21,1',
    ascentM: '',
    descentM: '',
  },
  time: {
    id: '',
    name: 'BBKT 6 h',
    renamed: true,
    date: '10/01/2027',
    kind: 'time',
    limitHours: '6',
    distanceKm: '',
    ascentM: '',
    descentM: '',
  },
  /* On the second morning, with a climb and a fall, so the set carries both states of
     those two cells: empty (read as nought) and written. */
  free: {
    id: '',
    name: 'BBKT slobodna',
    renamed: true,
    date: '11/01/2027',
    kind: 'free',
    limitHours: '',
    distanceKm: '',
    ascentM: '120',
    descentM: '120',
  },
}

/** What `askTheServer` really sends: the body through `JSON.stringify` and back, so a field
 *  that is `undefined` is gone exactly as it is gone on the wire. */
function onTheWireFor(row: RaceRow): unknown {
  return JSON.parse(JSON.stringify(raceUpsertFrom(row, UNDER)))
}

describe('what the table of mornings puts on the wire', () => {
  it('is held for every kind a race can be, and for no other', () => {
    /* The floor under the cases below: a fourth kind arrives here as a red gate rather than
       as a kind nobody measured on the wire. `RaceWriteApiTest` holds the same file to the
       kinds the server knows, so the two lists cannot drift apart through this file. */
    expect(Object.keys(onTheWire).sort()).toEqual([...RACE_KINDS].sort())
  })

  it.each(RACE_KINDS)('sends a race of the kind %s exactly as the file says', (kind) => {
    expect(onTheWireFor(ROWS[kind])).toStrictEqual(Reflect.get(onTheWire, kind))
  })
})

/**
 * The event the route hands back when the case below enters one, and it is NOT 713.
 *
 * <p>713 is what the file carries, because it is the event the owner entered on QA. A screen that
 * sent the file's own body would send that number, so the case answers with another one and
 * expects it on every race: the identity of the event is what the route said, and nothing the file
 * or the form holds.
 */
const MADE = 4242

/** A day as the date box takes it: its digits, with no separator. */
function digitsOf(day: string): string {
  return day.replace(/\//g, '')
}

/**
 * THE SCREEN HANDS ITS ROWS TO THAT BUILDER, WHICH IS THE JOIN THE CASES ABOVE CANNOT ASSERT.
 *
 * <p><b>Two halves and the thing between them.</b> The cases above say `raceUpsertFrom` answers
 * the file, and `RaceWriteApiTest` says the route takes the file. Neither says the SCREEN puts the
 * one in front of the other. `admin/AdminEvents.tsx` writes a race through two doors, `POST
 * /api/races` for a row that is not a race yet and `PUT /api/races/{id}` for one that is, and each
 * builds its body in an expression of its own; the record `storedRow` makes for the overlay is
 * bound a few lines above the first of them (`filed`), in reach of the call.
 *
 * <p><b>Measured on 03.10.2026 by an independent review of this change, and it is why this case
 * exists.</b> The POST door given that record in place of `raceUpsertFrom(row, eventId)` left the
 * 23 files that draw the event screen or call the builder green, `Tests 845 passed (845)`, and the
 * body of a race of a length in the record's shape is what the real route refuses with
 * `theLimitBelongsToATimedRace`. The same swap on the PUT door fell on the two cases of
 * `adminEntities.test.tsx` that expect null where a kind fixes no measure; they read the first race
 * a press writes, which on an event that stands is a PUT. What the other cases look at of a POST of
 * a race is its address and its `eventId` (`event/eventActions.test.tsx`). So the door the owner
 * went through on QA, a new event and then its races, was held by nothing.
 *
 * <p><b>The sources are kept apart, so the claim cannot be met by reading the file.</b> The event
 * the route hands back is not 713, the identity the file carries. The race of a length is typed
 * over a length the file does not hold (`42,2`, where the file has 21,1), and that is measured, not
 * decoration: a screen that sent the file's body for the row's kind, under the right event, passes
 * this case the moment that length is typed as the file has it, and fails on that one cell while it
 * is not. The second and third rows are named by hand and the third has a day of its own, so a body
 * built from the event's name or day, or from the first row, is not the one its row asked for.
 *
 * <p><b>What is not walked here.</b> A copy of an event (`?kopija=`) and a new race beside an event
 * that already stands reach the same call, `writeTheRaces`, with rows of the same shape; the PUT
 * door is held by the two cases of `adminEntities.test.tsx` named above.
 */
describe('what the screen sends when it saves the table of mornings', () => {
  it('sends each race entered beside a new event as the file says, under the event the route made', async () => {
    const server = serverThat((path, init) =>
      path === '/api/events' && init?.method === 'POST'
        ? new Response(JSON.stringify({ id: MADE, slug: 'bbkt-2027' }), {
            status: 201,
            headers: { 'content-type': 'application/json' },
          })
        : null,
    )

    try {
      const user = setupUser()
      /* The three rows as the reader types them: those of `ROWS`, but for the length of the race
         of a length, which is a length the file does not hold (the note above the case says why). */
      const typed: Record<RaceKind, RaceRow> = {
        ...ROWS,
        length: { ...ROWS.length, distanceKm: '42,2' },
      }

      renderAt('/sr/administracija/dogadjaji', 'superadmin')

      /* An event named as the file's rows are, on the day of the first of them: a new row opens
         under the event's name and on its day. */
      await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
      await user.type(screen.getByLabelText(/^Naziv događaja/), ROWS.length.name)
      await user.type(screen.getByLabelText(/^Datum/), digitsOf(ROWS.length.date))
      await user.type(screen.getByLabelText(/^Mesto/), 'Beograd')

      for (const [at, kind] of RACE_KINDS.entries()) {
        const row = typed[kind]
        const which = `${String(at + 1)}. trka`
        const box = (cell: string) => screen.getByRole('textbox', { name: `${cell}, ${which}` })
        const measures: [string, string][] = [
          ['Dužina (km)', row.distanceKm],
          ['Ograničenje (h)', row.limitHours],
          ['Uspon (m)', row.ascentM],
          ['Spust (m)', row.descentM],
        ]

        await user.click(screen.getByRole('button', { name: 'Nova trka' }))
        await user.selectOptions(screen.getByRole('combobox', { name: `Vrsta, ${which}` }), kind)

        /* A name typed by hand is a name that stops following the event, which is what `renamed`
           says: a row that is left alone keeps the event's own. */
        if (row.renamed) {
          await user.clear(box('Trka'))
          await user.type(box('Trka'), row.name)
        }

        await user.clear(box('Datum'))
        await user.type(box('Datum'), digitsOf(row.date))

        for (const [cell, said] of measures) {
          if (said !== '') {
            await user.type(box(cell), said)
          }
        }
      }

      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await screen.findByRole('status', { name: 'Sačuvano' })

      const sent = server.asked
        .filter((one) => one.path === '/api/races' && one.init?.method === 'POST')
        .map((one): unknown => JSON.parse(String(one.init?.body)))

      expect(sent, 'one POST for each row, in the order the table draws them').toStrictEqual(
        RACE_KINDS.map((kind) => ({
          ...Reflect.get(onTheWire, kind),
          eventId: MADE,
          /* The one cell typed over the file's: the comma becomes the dot the route reads. */
          ...(kind === 'length' ? { distanceKm: 42.2 } : {}),
        })),
      )
    } finally {
      server.stop()
    }
  }, SLOW)
})
