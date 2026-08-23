import { allFinished, rowsOf, storedRow, whatIsMissing, type RaceRow } from './raceRows'
import { fieldDate } from '../../forms/dateField'
import type { Race } from '../../data/types'

/** A race as the store keeps one, with only what a row reads off it. */
function race(id: string, date: string, distanceKm: number): Race {
  return {
    id,
    eventId: 'evt',
    name: 'Trka',
    renamed: 'no' as const,
    date,
    distanceKm,
    ascentM: 120,
    descentM: 140,
    category: 'short',
  }
}

const row = (over: Partial<RaceRow> = {}): RaceRow => ({
  id: '',
  name: 'Trka',
  renamed: 'no',
  date: '17/10/2026',
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
      [race('c', '2026-10-18', 5), race('a', '2026-10-17', 21.1), race('b', '2026-10-17', 10)],
      fieldDate,
    )

    expect(rows.map((one) => one.id)).toEqual(['b', 'a', 'c'])
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
  })

  it('writes an empty climb and fall as nought', () => {
    expect(storedRow(row(), 'evt')).toEqual({
      eventId: 'evt',
      name: 'Trka',
      renamed: 'no' as const,
      date: '2026-10-17',
      distanceKm: '10',
      ascentM: '0',
      descentM: '0',
    })
    /* And what was typed, where something was. Read through `Number`, so „042" is
       stored as the number it is rather than as the digits somebody typed. */
    expect(storedRow(row({ ascentM: '042', descentM: '7' }), 'evt')).toMatchObject({
      ascentM: '42',
      descentM: '7',
    })
  })
})
