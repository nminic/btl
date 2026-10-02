import {
  allFinished,
  boundsOf,
  isWrong,
  newRaceRow,
  RACE_CELLS,
  rowsOf,
  sentenceFor,
  storedRow,
  whatIsMissing,
  whyWrong,
  type RaceCell,
  type RaceRow,
  type WhatIsWrong,
} from './raceRows'
import { fieldDate } from '../../forms/dateField'
import { RACE_KINDS, type Race } from '../../data/types'
import en from '../../i18n/en.json'
import sr from '../../i18n/sr.json'
import { translate } from '../../i18n/translate'
import { first } from '../../test/at'

/** A race as the store keeps one, with only what a row reads off it. */
function race(id: number, date: string, distanceKm: number): Race {
  return {
    id,
    eventId: 1,
    name: 'Trka',
    renamed: false,
    date,
    kind: 'length' as const,
    limitSeconds: 0,
    distanceKm,
    ascentM: 120,
    descentM: 140,
    category: 'short',
  }
}

const row = (over: Partial<RaceRow> = {}): RaceRow => ({
  id: '',
  name: 'Trka',
  renamed: false,
  date: '17/10/2026',
  kind: 'length',
  limitHours: '',
  distanceKm: '10',
  ascentM: '',
  descentM: '',
  ...over,
})

describe('the races of an event while they are being entered', () => {
  it('opens in the order they are run', () => {
    /* The day first and the length inside it, which is what „two mornings" reads
       as. Entered in the other order on purpose, so the sort is what puts them
       right rather than the order they happened to come in. */
    const rows = rowsOf(
      [race(3, '2026-10-18', 5), race(1, '2026-10-17', 21.1), race(2, '2026-10-17', 10)],
      fieldDate,
    )

    expect(rows.map((one) => one.id)).toEqual(['2', '1', '3'])
    expect(rows[0]?.date).toBe('17/10/2026')
    expect(rows[0]?.distanceKm).toBe('10')
  })

  it('asks for the day and the length, and for nothing else', () => {
    /* Owner, 23.08.2026: „uspon i spust nisu obavezni, jer ako su prazni tumače se
       kao 0/0". A flat road race is entered that way and always was. */
    expect(whatIsMissing(row())).toBeUndefined()
    expect(whatIsMissing(row({ ascentM: '', descentM: '' }))).toBeUndefined()
    expect(whatIsMissing(row({ date: '' }))).toBe('date')
    expect(whatIsMissing(row({ date: '31/02/2026' })), 'a day that is not a day').toBe('date')
    expect(whatIsMissing(row({ distanceKm: '' }))).toBe('distanceKm')
    /* Nought passes „not empty" and is not a distance, and the whole standing is
       worked out from it. */
    expect(whatIsMissing(row({ distanceKm: '0' }))).toBe('distanceKm')
  })

  it('keeps a measurement inside what a race can be', () => {
    /* The bounds the race's own form carried until 23.08.2026, which nearly went
       with it. `min` on a number box is decoration here: the form is `noValidate`
       and nothing reads `checkValidity`, so a round measured a climb of minus five
       hundred metres saved on the real screen. The formula then works out a profile
       nobody ran: `Le = L + (1.25×AP + 0.75×AN)/200` with a negative climb takes
       three kilometres off the effective length. */
    expect(whatIsMissing(row({ ascentM: '-500' }))).toBe('ascentM')
    expect(whatIsMissing(row({ descentM: '-1' }))).toBe('descentM')
    expect(whatIsMissing(row({ distanceKm: '9999999' }))).toBe('distanceKm')
    expect(whatIsMissing(row({ distanceKm: '0.05' })), 'fifty metres is not a race').toBe(
      'distanceKm',
    )
    expect(whatIsMissing(row({ ascentM: '30001' }))).toBe('ascentM')

    /* And the ends of the range are inside it. */
    expect(whatIsMissing(row({ distanceKm: '0.1' }))).toBeUndefined()
    expect(whatIsMissing(row({ distanceKm: '1000' }))).toBeUndefined()
    expect(whatIsMissing(row({ ascentM: '30000', descentM: '0' }))).toBeUndefined()
    /* Empty is nought for a climb and a fall, and nought is inside the range. */
    expect(whatIsMissing(row({ ascentM: '', descentM: '' }))).toBeUndefined()
    /* Something that is not a number at all is refused rather than read as one. */
    expect(whatIsMissing(row({ ascentM: 'sto' }))).toBe('ascentM')
  })

  /**
   * „21,1" IS HOW A LENGTH IS WRITTEN HERE, AND THIS IS WHERE AN ADMINISTRATOR WRITES IT.
   *
   * <p>Owner, 02.10.2026 (`btl-produkt/PDL.md`, „Odluke iz ciscenja nalaza"): „Polje za broj
   * prima i zarez i tacku, a portal salje tacku." The length of a race is typed into this
   * table and not into a form, so the comma has to be read here as it is on every form: to
   * the bounds as the number it is, a tenth of a kilometre being the floor. And the limit of a
   * timed race is hours with decimals on purpose, so „1,5" is an hour and a half.
   */
  it('reads a measure written with a comma as the number it is', () => {
    expect(whatIsMissing(row({ distanceKm: '21,1' }))).toBeUndefined()
    expect(whatIsMissing(row({ distanceKm: '0,1' }))).toBeUndefined()
    expect(whatIsMissing(row({ distanceKm: '0,05' }))).toBe('distanceKm')
    expect(whatIsMissing(row({ kind: 'time', distanceKm: '', limitHours: '1,5' }))).toBeUndefined()
  })

  /**
   * AND THE CLIMB AND THE FALL ARE WHOLE METRES, BECAUSE THE SERVER KEEPS THEM WHOLE.
   *
   * <p>`RaceWriteApi.Upsert` reads both as `Integer` and `race.ascent_m` is an `integer`, and the
   * race's own definition says so (`admin-trka.form.json`, `"integer": true`, held to the route
   * by `forms/wholeNumbers.test.ts`). „1.200" is twelve hundred metres written with a separator
   * for the thousands as often as it is one point two, and either reading is quietly another
   * climb; refused, the administrator types it again. The coordinator's reasoning, not the
   * owner's words.
   */
  it('refuses a separator in the climb and the fall, and takes a whole number', () => {
    expect(whatIsMissing(row({ ascentM: '1.200' }))).toBe('ascentM')
    expect(whatIsMissing(row({ descentM: '1,200' }))).toBe('descentM')
    expect(whatIsMissing(row({ ascentM: '1200', descentM: '1200' }))).toBeUndefined()
    expect(isWrong(row({ ascentM: '540,5' }), 'ascentM')).toBe(true)
  })

  it('holds the save back until every row is finished', () => {
    /* Owner: „validacija mi ne da da nastavim dalje dok svaki red nema sve obavezne
       podatke". One press writes the event and all of its races, so one unfinished
       row is the whole press refused. */
    expect(allFinished([row(), row({ distanceKm: '21.1' })])).toBe(true)
    expect(allFinished([row(), row({ distanceKm: '' })])).toBe(false)
    /* An event with no races at all is finished: one is entered a fortnight before
       its distances are known, and that is the ordinary state of it. */
    expect(allFinished([])).toBe(true)
  })

  it('takes a second race of the same length on the same morning', () => {
    /* Refused until 23.08.2026, on the reasoning that a race has no name of its own
       so two of 42,2 km on one morning are two entries nothing tells apart. The
       owner said that day: „u teoriji dve trke iste dužine mogu biti na istom
       događaju, čak mogu imati iste i vertikalne nagibe, ali to se retko dešava.
       Zavisi od staze koja se trči. Nemoj to da zabranjuješ."

       So the portal takes it. What tells two such races apart is the name the
       seventh round gives every race (PDL, 23.08.2026), not a rule that says one of
       them cannot exist. */
    expect(allFinished([row(), row()])).toBe(true)
    /* Down to the climb and the fall as well, which the owner named. */
    expect(allFinished([row({ ascentM: '250' }), row({ ascentM: '250' })])).toBe(true)
    /* What is still refused is a row that is not a race: no day, or no length. */
    expect(allFinished([row(), row({ distanceKm: '' })])).toBe(false)
  })

  it('reads a name of nothing but spaces as no name at all', () => {
    /* A name is what a race is picked out by, so „   " is not one: it looks answered
       and is not. Measured by a sweep on 23.08.2026: taking the `trim` out of all
       three places that read the name walks through 2151 tests, and a race saves
       under a name nobody can see.

       Both ends, because the row is asked twice: once to refuse the press, and once
       to write the record. */
    expect(whatIsMissing(row({ name: '   ' }))).toBe('name')
    expect(allFinished([row({ name: '   ' })])).toBe(false)
    /* And what is written is the name without the spaces around it, so „ Trka " and
       „Trka" are one race and not two. */
    expect(storedRow(row({ name: '  Trka  ' }), 'evt').name).toBe('Trka')
    /* And the cell says the same thing the press says. Asked of the other three and
       not of this one, the two answers drifted apart: the press refused a name of
       three spaces and the cell that carried it reported itself fine. A round
       measured that, and this line is the reason it cannot come back. */
    expect(isWrong(row({ name: '   ' }), 'name')).toBe(true)
  })

  it('opens a new row as a race of a length, in a word the portal knows', () => {
    /* The words this row carries are words `data/raceLabel.ts` reads back, and
       nothing between the two checks them. Written into the table where it used to
       be, `kind: 'ludilo'` passed the whole package (measured 30.08.2026), so it
       lives here where a case reads it.

       Both halves. „It is one of the three" alone would pass on a row that opened
       as a timed race, and a table with no column for a limit would then refuse
       to save a race whose limit nobody can set. */
    const fresh = newRaceRow('Događaj', '17/10/2026')

    expect(RACE_KINDS).toContain(fresh.kind)
    expect(fresh.kind).toBe('length')
    expect(fresh.limitHours).toBe('')
  })

  it('asks a length only of a race that fixes one', () => {
    /* A timed race and a free race carry nought, which is outside the bounds on
       purpose. Without this the table would refuse a length neither of them has,
       and the event holding one could not be saved at all: `allFinished` is what
       `AdminEvents` asks before it writes anything.

       The climb and the fall are still asked for, because a course has both
       whichever way it is run, and that half is asked here too so the exemption
       cannot quietly widen to every measurement on the row. */
    const timed = row({ kind: 'time', limitHours: '24', distanceKm: '0' })

    expect(whatIsMissing(timed)).toBeUndefined()
    expect(allFinished([timed])).toBe(true)
    expect(whatIsMissing({ ...timed, ascentM: '-5' })).toBe('ascentM')

    /* And a race of a length is asked for one exactly as before. */
    expect(whatIsMissing(row({ distanceKm: '0' }))).toBe('distanceKm')
  })

  it('hands a timed race back as it found it, through the row and out again', () => {
    /* Saving an event writes every row back over the race it came from
       (`AdminEvents.tsx`: `editRecord(row.id, storedRow(row, written))`), and it
       does that for races that already exist as well as for ones typed here. This
       table asks for a length and knows nothing of the other two kinds, so the row
       has to carry them or the save deletes them.

       Measured on 30.08.2026 before the row carried them, and on the record
       rather than on the screen: a race read into a row and written back out of
       it came back `kind: "length"` with a limit of nought, so its name would have
       gone from „24 h" to „0,0 km" and the limit the formula scores it against
       would be gone. The screen is measured by its own case
       (`pages/timedRace.test.tsx`), because the two halves refuse in different
       places and a sentence about one of them said the other. */
    const timed: Race = {
      ...race(4, '2026-09-19', 0),
      kind: 'time',
      limitSeconds: 86_400,
    }
    const back = storedRow(first(rowsOf([timed], (iso) => iso)), 'evt')

    expect(back.kind).toBe('time')
    expect(back.limitSeconds).toBe('86400')
  })

  it('writes an empty climb and fall as nought', () => {
    expect(storedRow(row(), 'evt')).toEqual({
      eventId: 'evt',
      name: 'Trka',
      renamed: 'false',
      date: '2026-10-17',
      kind: 'length',
      limitSeconds: '0',
      distanceKm: '10',
      ascentM: '0',
      descentM: '0',
      category: 'short',
    })
    /* And what was typed, where something was. Read through `Number`, so „042" is
       stored as the number it is rather than as the digits somebody typed. */
    expect(storedRow(row({ ascentM: '042', descentM: '7' }), 'evt')).toMatchObject({
      ascentM: '42',
      descentM: '7',
    })
  })

  /* THE ONE PLACE A ROW OF THIS TABLE IS CONVERTED, AND IT SENDS THE DOT. A race is not entered
     through a form, so the door a form leaves by (`forms/records.ts`, `storedNumbers`) never
     sees it; `storedRow` is this table's door, and what it writes is what `raceUpsertFrom`
     puts on the wire. 21,1 rather than a round number, so the category read off it is the
     half marathon and a comma read as nothing would show here as well as in the length. */
  it('writes a length and a limit typed with a comma as numbers with a dot', () => {
    expect(storedRow(row({ distanceKm: '21,1' }), 'evt')).toMatchObject({
      distanceKm: '21.1',
      category: 'half',
    })
    expect(
      storedRow(row({ kind: 'time', distanceKm: '', limitHours: '1,5' }), 'evt'),
    ).toMatchObject({ limitSeconds: '5400' })
  })

  it('writes the category the length says, and writes it again when the length changes', () => {
    /* A race carries a category (`data/types.ts`) and it is the length and nothing
       else, by the exact value and with no tolerance (PDL P5). The table stopped
       asking for it on 23.08.2026, when the owner took the column out, and the
       writing went with the asking.

       What that cost was measured by a review: a saved record is merged over the
       one before it, so a race of 42,2 km whose length is corrected to 10 kept
       `category: 'marathon'` on the record, and the record was a marathon of ten
       kilometres. Nothing draws it wrong today, because the public screens read the
       file rather than the layer of edits; the shape of the record is what the
       database phase inherits, which is why it is written rather than left.

       Both halves, because the first alone passes on a function that writes one
       category for everything. */
    expect(storedRow(row({ distanceKm: '42.2' }), 'evt')).toMatchObject({
      distanceKm: '42.2',
      category: 'marathon',
    })
    expect(storedRow(row({ distanceKm: '10' }), 'evt')).toMatchObject({
      distanceKm: '10',
      category: 'short',
    })
    /* And on the boundary, which is where „the exact value and no tolerance" means
       something: 21,1 is a half and 21,0 is not. */
    expect(storedRow(row({ distanceKm: '21.1' }), 'evt')).toMatchObject({ category: 'half' })
    expect(storedRow(row({ distanceKm: '21' }), 'evt')).toMatchObject({ category: 'short' })
  })
})

/**
 * WHAT IS WRONG WITH ONE CELL, ASKED OF THE ONE FUNCTION EVERY READER ASKS (PENDING, the table of
 * races, review of PR 463: WCAG 3.3.1 and 3.3.3).
 *
 * <p>The table refused „1.200" in the climb and said, in the one sentence it had, that the climb
 * and the fall may stay empty and are then read as nought. An administrator who obeyed it emptied
 * the cell and saved a climb of nought. A refusal has to say WHAT is wrong with the cell it marks
 * and what to do, so the answer to „why is this cell wrong" has one home and three readers: the
 * marking of the cell (`isWrong`), the refusal of the save (`whatIsMissing`) and the sentence that
 * is drawn for it (`sentenceFor`).
 *
 * <p>The axes are the cell, the kind of race (which decides whether a cell is asked at all) and the
 * way the cell is written. A cell is asked about only where its race fixes it, so the same writing
 * is wrong in one kind and nothing in another.
 */
describe('what is wrong with one cell of a row', () => {
  const NONE = undefined

  it.each<[string, Partial<RaceRow>, RaceCell, WhatIsWrong | undefined]>([
    ['an empty name', { name: '' }, 'name', 'missing'],
    ['a name of spaces', { name: '   ' }, 'name', 'missing'],
    ['a name', {}, 'name', NONE],
    ['no day', { date: '' }, 'date', 'missing'],
    ['a day that is not a day', { date: '31/02/2026' }, 'date', 'missing'],
    ['a day', {}, 'date', NONE],
    ['no length', { distanceKm: '' }, 'distanceKm', 'missing'],
    ['a length that is not a number', { distanceKm: 'sto' }, 'distanceKm', 'notANumber'],
    ['a length under the floor', { distanceKm: '0.05' }, 'distanceKm', 'outOfBounds'],
    ['a length over the ceiling', { distanceKm: '1001' }, 'distanceKm', 'outOfBounds'],
    ['a length with a comma', { distanceKm: '21,1' }, 'distanceKm', NONE],
    ['a length on the floor', { distanceKm: '0.1' }, 'distanceKm', NONE],
    ['a length on a timed race, which it does not ask', { kind: 'time', distanceKm: 'sto' }, 'distanceKm', NONE],
    ['no limit on a timed race', { kind: 'time', limitHours: '' }, 'limitHours', 'missing'],
    ['a limit that is not a number', { kind: 'time', limitHours: 'sto' }, 'limitHours', 'notANumber'],
    ['a limit of nought', { kind: 'time', limitHours: '0' }, 'limitHours', 'outOfBounds'],
    ['a limit over the ceiling', { kind: 'time', limitHours: '201' }, 'limitHours', 'outOfBounds'],
    ['a limit with a comma', { kind: 'time', limitHours: '1,5' }, 'limitHours', NONE],
    ['a limit on a race of a length, which it does not ask', { limitHours: 'sto' }, 'limitHours', NONE],
    ['an empty climb, which is nought', { ascentM: '' }, 'ascentM', NONE],
    ['a climb written with a dot for the thousands', { ascentM: '1.200' }, 'ascentM', 'notWhole'],
    ['a climb written with a comma for the thousands', { ascentM: '1,200' }, 'ascentM', 'notWhole'],
    ['a climb with a fraction that is nought', { ascentM: '10,0' }, 'ascentM', 'notWhole'],
    ['a climb written as a power of ten', { ascentM: '1e3' }, 'ascentM', 'notWhole'],
    ['a whole climb', { ascentM: '1200' }, 'ascentM', NONE],
    ['a climb that is not a number', { ascentM: 'sto' }, 'ascentM', 'notANumber'],
    ['a negative climb', { ascentM: '-500' }, 'ascentM', 'outOfBounds'],
    ['a climb over the ceiling', { ascentM: '30001' }, 'ascentM', 'outOfBounds'],
    ['a climb that is both separated and over the ceiling', { ascentM: '30.001' }, 'ascentM', 'notWhole'],
    ['an empty fall, which is nought', { descentM: '' }, 'descentM', NONE],
    ['a fall written with a dot for the thousands', { descentM: '1.200' }, 'descentM', 'notWhole'],
    ['a fall that is not a number', { descentM: 'sto' }, 'descentM', 'notANumber'],
    ['a negative fall', { descentM: '-1' }, 'descentM', 'outOfBounds'],
  ])('says %s', (_what, over, cell, expected) => {
    expect(whyWrong(row(over), cell)).toBe(expected)
  })

  /**
   * ONE ANSWER AND THREE READERS, so a cell cannot be marked that the save lets through or the
   * other way round (ADL A31). Asked over every combination of a few writings of each cell rather
   * than over a list of cases, so a state nobody thought of is asked too.
   */
  it('is the one answer the marking and the refusal of the save read', () => {
    const axes: Partial<RaceRow>[][] = [
      [{ name: '' }, { name: 'x' }],
      [{ date: '' }, { date: '17/10/2026' }],
      RACE_KINDS.map((kind) => ({ kind })),
      [{ distanceKm: '' }, { distanceKm: '10' }, { distanceKm: 'sto' }],
      [{ limitHours: '' }, { limitHours: '2' }, { limitHours: 'sto' }],
      [{ ascentM: '' }, { ascentM: '1200' }, { ascentM: '1.200' }],
      [{ descentM: '' }, { descentM: '-1' }],
    ]
    let rows: Partial<RaceRow>[] = [{}]

    for (const axis of axes) {
      rows = rows.flatMap((made) => axis.map((one) => ({ ...made, ...one })))
    }

    expect(rows.length, 'the grid is the whole of the combinations').toBe(
      2 * 2 * RACE_KINDS.length * 3 * 3 * 3 * 2,
    )

    for (const over of rows) {
      const one = row(over)
      const wrong = RACE_CELLS.filter((cell) => whyWrong(one, cell) !== undefined)

      for (const cell of RACE_CELLS) {
        expect(isWrong(one, cell), `${cell} of ${JSON.stringify(over)}`).toBe(wrong.includes(cell))
      }

      /* The save is held back exactly where some cell is wrong, and names the FIRST of them in
         the order the table draws them. */
      expect(whatIsMissing(one), JSON.stringify(over)).toBe(wrong[0])
      expect(allFinished([one])).toBe(wrong.length === 0)
    }
  })

  it('names every cell of the table, in the order it is drawn', () => {
    expect(RACE_CELLS).toEqual(['name', 'date', 'distanceKm', 'limitHours', 'ascentM', 'descentM'])
  })
})

describe('the sentence that says what is wrong with a cell', () => {
  it.each<[RaceCell, WhatIsWrong, string]>([
    ['name', 'missing', 'admin.race.wrong.name'],
    ['date', 'missing', 'admin.race.wrong.date'],
    ['distanceKm', 'missing', 'admin.race.wrong.missing'],
    ['limitHours', 'missing', 'admin.race.wrong.missing'],
    ['distanceKm', 'notANumber', 'admin.race.wrong.notANumber.decimal'],
    ['limitHours', 'notANumber', 'admin.race.wrong.notANumber.decimal'],
    ['ascentM', 'notANumber', 'admin.race.wrong.notANumber.whole'],
    ['descentM', 'notANumber', 'admin.race.wrong.notANumber.whole'],
    ['ascentM', 'notWhole', 'admin.race.wrong.notWhole'],
    ['descentM', 'notWhole', 'admin.race.wrong.notWhole'],
    ['distanceKm', 'outOfBounds', 'admin.race.wrong.outOfBounds'],
    ['ascentM', 'outOfBounds', 'admin.race.wrong.outOfBounds'],
  ])('is the one for %s, %s', (cell, why, key) => {
    expect(sentenceFor(cell, why)).toBe(key)
  })

  /**
   * THE FLOOR UNDER THE KEYS: every sentence a cell of this table can be given resolves in both
   * dictionaries. The keys are built from the cell and the reason, so a sentence that is not
   * written is a key drawn as ITSELF in front of an administrator (`i18n/translate.ts` answers the
   * key for a name it does not know), and nothing else fails on it. Derived from the cells and the
   * four reasons and not written out, so a fifth reason is a failure here before it is a screen.
   */
  it.each([
    ['sr', sr],
    ['en', en],
  ] as const)('resolves, for every cell and every reason it can have, in %s', (locale, dictionary) => {
    const reasons: WhatIsWrong[] = ['missing', 'notANumber', 'notWhole', 'outOfBounds']
    const unresolved: string[] = []

    for (const cell of RACE_CELLS) {
      for (const why of reasons) {
        const key = sentenceFor(cell, why)

        if (translate(dictionary, locale, key, boundsOf(cell, locale)) === key) {
          unresolved.push(`${cell} ${why} -> ${key}`)
        }
      }
    }

    expect(unresolved).toEqual([])
  })

  /**
   * THE NUMBERS IN THE SENTENCE ARE THE ONES THE SAVE HOLDS THE CELL TO, and written the way the
   * reader writes them: a comma for the decimals in Serbian and a dot in English, and no separator
   * for the thousands, because the sentence is about a cell that refuses one.
   */
  it('says the bounds of its own cell, in the way its language writes them', () => {
    expect(boundsOf('distanceKm', 'sr')).toEqual({ least: '0,1', most: '1000' })
    expect(boundsOf('distanceKm', 'en')).toEqual({ least: '0.1', most: '1000' })
    expect(boundsOf('limitHours', 'sr')).toEqual({ least: '0,1', most: '200' })
    expect(boundsOf('ascentM', 'sr')).toEqual({ least: '0', most: '30000' })
    expect(boundsOf('descentM', 'en')).toEqual({ least: '0', most: '30000' })
    expect(boundsOf('name', 'sr')).toEqual({})
    expect(boundsOf('date', 'en')).toEqual({})
  })
})
