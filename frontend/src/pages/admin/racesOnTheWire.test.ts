import { describe, expect, it } from 'vitest'
import { RACE_KINDS, type RaceKind } from '../../data/types'
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
