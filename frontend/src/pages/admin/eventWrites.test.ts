import { describe, expect, it } from 'vitest'
import { raceUpsertFrom, raceWrittenIn, upsertFrom, writtenIn } from './eventWrites'
import type { RaceRow } from './raceRows'

/**
 * WHAT THE CALENDAR SENDS, AND WHAT IT IS WILLING TO READ BACK.
 *
 * <p>Its own file rather than cases inside a screen's, which is the arrangement
 * `admin/leagueWrites` and `admin/priceWrites` already have: these are the shapes two
 * screens agree on with two routes, and a question about a shape should not have to mount
 * React to be asked.
 */

describe('what an event being written carries', () => {
  it('sends the town by hand and never a codebook key, because the form knows no key', () => {
    /* The route takes a town in one of two ways and refuses both at once
       (`theTownIsNotSaidOnce`): out of the world codebook by its key, or typed with the
       country beside it. `forms/PlaceField.tsx` writes a town and a country as text and
       knows no key at all, so every event this portal sends is the second kind. */
    const sent = upsertFrom({ name: 'Trka', date: '2027-05-08', city: 'Novi Sad', country: 'RS' })

    expect(sent.placeId).toBeNull()
    expect(sent.city).toBe('Novi Sad')
    expect(sent.country).toBe('RS')
  })

  it('turns the word the control writes into the flag the column keeps', () => {
    /* `forms/types.ts` holds every value as a string or a flag and the control is a select
       of two words (`entityForms.ts`, `start: { featured: 'no' }`). Read as `Boolean(...)`
       instead, the string „no" is true and every event would go in singled out. */
    expect(upsertFrom({ featured: 'yes' }).featured).toBe(true)
    expect(upsertFrom({ featured: 'no' }).featured).toBe(false)
    expect(upsertFrom({}).featured).toBe(false)
  })

  it('sends the empty string for what was left out, rather than dropping the field', () => {
    /* A field dropped from the JSON is a field the route reads as null, and
       `EventWriteApi.whatIsWrongWith` checks the SHAPE of a link before it looks at
       whether there is one. */
    const sent = upsertFrom({})

    expect(sent.description).toBe('')
    expect(sent.link).toBe('')
    expect(sent.name).toBe('')
  })
})

describe('what a race being written carries', () => {
  const row: RaceRow = {
    id: '',
    name: 'Polumaraton',
    renamed: true,
    date: '08/05/2027',
    kind: 'length',
    limitHours: '',
    distanceKm: '21.1',
    ascentM: '120',
    descentM: '110',
  }

  it('reads the numbers back out of the text the row keeps, and names its event', () => {
    const sent = raceUpsertFrom(row, '77')

    expect(sent.eventId).toBe(77)
    expect(sent.distanceKm).toBe(21.1)
    expect(sent.ascentM).toBe(120)
    expect(sent.descentM).toBe(110)
    expect(sent.renamed).toBe(true)
    /* And the day in the shape the route takes, which is not the shape the table asks in. */
    expect(sent.date).toBe('2027-05-08')
  })

  it('carries no category at all, because the length is what the server reads it off', () => {
    /* `raceRows.storedRow` works one out for the row this screen draws, and
       `RaceWriteApi.Upsert` takes nine fields with `category` not among them. Sent anyway
       it would be a second opinion about a derived value. */
    expect(Object.keys(raceUpsertFrom(row, '77'))).not.toContain('category')
  })

  it('turns the hours the table asks for into the seconds the column keeps', () => {
    const timed = raceUpsertFrom({ ...row, kind: 'time', limitHours: '24' }, '77')

    expect(timed.limitSeconds).toBe(86_400)
    /* And nought where the race is not run against a limit at all. */
    expect(raceUpsertFrom(row, '77').limitSeconds).toBe(0)
  })
})

/**
 * WHAT IS READ OFF AN ANSWER, AND WHAT IS REFUSED.
 *
 * <p>ADL A14: what comes off the wire is `unknown` and is narrowed by looking at it, so an
 * answer of another shape says „nothing of the kind is here" rather than being asserted
 * into a type. These cases are that refusal, one shape at a time.
 *
 * <p><b>Nought and below are refused on purpose and it is not defensiveness.</b> That is
 * exactly the range the session overlay used to hand out - `admin/raceIds.ts` counts DOWN
 * from nought - so an answer carrying one of those would be the very fault this whole
 * change closes, arriving through the front door.
 */
describe('the identity an answer carries', () => {
  it('is read when the answer carries both halves', () => {
    expect(writtenIn({ id: 91, slug: 'trka-2027' })).toEqual({ id: 91, slug: 'trka-2027' })
    expect(raceWrittenIn({ id: 91, eventDate: '2027-05-08', eventSlug: 'trka-2027' })).toBe(91)
  })

  it('is refused where the answer is not an object at all', () => {
    for (const body of [null, undefined, 'trka-2027', 91, true]) {
      expect(writtenIn(body), `${String(body)} was read as an identity`).toBeNull()
      expect(raceWrittenIn(body), `${String(body)} was read as an identity`).toBeNull()
    }
  })

  it('is refused where the number is not one a bigserial could have handed out', () => {
    for (const id of [0, -1, 1.5, Number.NaN, '91', null]) {
      expect(writtenIn({ id, slug: 'trka-2027' }), `${String(id)} was read as an identity`)
        .toBeNull()
      expect(raceWrittenIn({ id }), `${String(id)} was read as an identity`).toBeNull()
    }
  })

  it('refuses an event answer that carries a number and no address', () => {
    /* Both halves are needed and only the event's read says so: the id is what the row and
       every later route are addressed by, and the address is what a result joins to an
       event by and what an administrator copies into a link. */
    expect(writtenIn({ id: 91 })).toBeNull()
    expect(writtenIn({ id: 91, slug: 7 })).toBeNull()
  })
})
