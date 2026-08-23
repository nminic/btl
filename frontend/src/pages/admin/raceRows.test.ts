import { allFinished, clashesWith, rowsOf, storedRow, whatIsMissing, type RaceRow } from './raceRows'
import { fieldDate } from '../../forms/dateField'
import type { Race } from '../../data/types'

/** A race as the store keeps one, with only what a row reads off it. */
function race(id: string, date: string, distanceKm: number): Race {
  return {
    id,
    eventId: 'evt',
    date,
    distanceKm,
    ascentM: 120,
    descentM: 140,
    category: 'short',
  }
}

const row = (over: Partial<RaceRow> = {}): RaceRow => ({
  id: '',
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

  it('refuses a second race of the same length on the same morning', () => {
    /* A race has no name of its own: two of 42,2 km on one morning of one event
       are two entries a member chooses between blindly, and whichever they pick
       decides where their time is filed. The rule lived on the race's own form
       until 23.08.2026; the form went and the rule stayed.

       Both rows are refused rather than the second one only, because neither is
       the wrong one: what is wrong is that there are two. */
    const two = [row(), row()]

    expect(clashesWith(two, 0)).toBe(true)
    expect(clashesWith(two, 1)).toBe(true)
    expect(allFinished(two)).toBe(false)

    /* Another morning is another race, and so is another length. */
    expect(allFinished([row(), row({ date: '18/10/2026' })])).toBe(true)
    expect(allFinished([row(), row({ distanceKm: '21.1' })])).toBe(true)
    /* And a row still being typed into is not a clash yet: it is not a race at
       all until it has a day and a length. */
    expect(clashesWith([row({ distanceKm: '' }), row({ distanceKm: '' })], 0)).toBe(false)
    /* Read as numbers, so „10" and „10.0" are one length rather than two. */
    expect(allFinished([row(), row({ distanceKm: '10.0' })])).toBe(false)
  })

  it('writes an empty climb and fall as nought', () => {
    expect(storedRow(row(), 'evt')).toEqual({
      eventId: 'evt',
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
