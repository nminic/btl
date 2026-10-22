import { describe, expect, it } from 'vitest'
import type { BtlEvent, Race } from '../../data/types'
import type { Answer } from '../account/askTheServer'
import {
  choosingTheEvent,
  choosingTheRace,
  emptyBlock,
  eventAndRaceOf,
  figuresOfANewRace,
  hintOf,
  kindOfTheRows,
  theEventPageAfter,
  typingTheEvent,
  whatIsWrongWithTheBlock,
  yearsOfTheDay,
  type TheBlock,
  type TheBlockIsAsked,
} from './eventAndRace'
import { theEventSavedOn } from './leagueResultWrites'

/**
 * THE BLOCK OF „UNOS REZULTATA ZA DOGAĐAJ”, asked without mounting anything (PDL P9, 19.10.2026).
 * The screen's own cases are `enterForAnEvent.test.tsx`; these hold what a screen does not reach by
 * itself, each state of the block on both sides of the rule that decides it.
 */

const TODAY = '2027-08-23'

const AN_EVENT: BtlEvent = {
  id: 9501,
  slug: 'gradska-liga-2027',
  name: 'Gradska liga',
  date: '2027-03-01',
  city: 'Novi Sad',
  country: 'RS',
  kind: 'race',
  featured: false,
  description: '',
  link: '',
  copiedFrom: null,
}

const A_RACE: Race = {
  id: 9601,
  eventId: AN_EVENT.id,
  name: 'Prvo kolo',
  renamed: true,
  date: '2027-03-07',
  kind: 'time',
  limitSeconds: 3600,
  distanceKm: 0,
  ascentM: 0,
  descentM: 0,
  category: 'short',
  dots: ['short'],
}

const OFFERED = [{ id: String(AN_EVENT.id), value: AN_EVENT.name, said: AN_EVENT.name, fills: {} }]

/** A new event of a length, filled in whole. */
const filled = (over: Partial<TheBlock> = {}): TheBlock => ({
  ...emptyBlock(),
  eventName: 'Jezerska trka',
  date: '01/06/2027',
  city: 'Ohrid',
  country: 'MK',
  raceName: 'Jezerska desetka',
  distanceKm: '10',
  ascentM: '20',
  descentM: '30',
  ...over,
})

/** What the block is asked against where a case does not say: the season of the day the cases stand on is
 *  open, and the one event above is offered. */
const ASKED: TheBlockIsAsked = { open: [2027], offered: OFFERED }

/** What is wrong with the block on the day the cases stand on. */
const boxes = (block: TheBlock, today = TODAY, asked = ASKED) =>
  whatIsWrongWithTheBlock(block, today, asked).map((one) => `${one.box} ${one.key}`)

describe('the event and the race of the block', () => {
  it('links an event typed exactly, and lets go of it on any other name, the race following a new one', () => {
    const linked = typingTheEvent({ ...emptyBlock(), eventName: 'Gradska lig', raceName: 'Gradska lig' }, 'gradska liga', OFFERED, [AN_EVENT])

    expect(linked.event).toEqual({ eventId: AN_EVENT.id, slug: AN_EVENT.slug, date: AN_EVENT.date })
    expect([linked.eventName, linked.raceName, linked.date]).toEqual(['gradska liga', '', '01/03/2027'])

    const left = typingTheEvent(linked, 'gradska ligaX', OFFERED, [AN_EVENT])

    expect([left.event, left.race, left.raceName]).toEqual([null, null, 'gradska ligaX'])
    /* A race named for itself is not written over. */
    expect(typingTheEvent({ ...left, raceName: 'Moja trka' }, 'Nova', OFFERED, [AN_EVENT]).raceName).toBe('Moja trka')
  })

  it('links nothing where the entry chosen is not in the calendar it was read from', () => {
    const block = filled()

    expect(choosingTheEvent(block, { id: '1', value: 'Nema', said: 'Nema', fills: {} }, [AN_EVENT])).toBe(block)
    expect(choosingTheRace(block, { id: '1', value: 'Nema', said: 'Nema', fills: {} }, [A_RACE])).toBe(block)
  })

  it('asks the rows under the chosen race’s kind, and under the new one’s otherwise', () => {
    const chosen = choosingTheRace(filled(), { id: String(A_RACE.id), value: A_RACE.name, said: '', fills: {} }, [A_RACE])

    expect(kindOfTheRows(chosen)).toBe('time')
    expect(kindOfTheRows(filled({ kind: 'free' }))).toBe('free')
    expect(figuresOfANewRace('free')).toEqual([])
    expect(figuresOfANewRace('time')).toEqual(['hours', 'minutes', 'seconds'])
  })
})

describe('what is wrong with the block', () => {
  it('is nothing when it is whole', () => {
    expect(boxes(filled())).toEqual([])
  })

  it('names each box, in the order they are drawn', () => {
    expect(boxes({ ...emptyBlock() })).toEqual([
      'eventName form.errors.required',
      'date form.errors.required',
      'city leagueResults.refused.theTownIsMissing',
      'raceName form.errors.required',
      'distanceKm form.errors.required',
      'ascentM form.errors.required',
      'descentM form.errors.required',
    ])
  })

  it('says a day still to come, and a town with no country, each in its own words', () => {
    expect(boxes(filled({ date: '24/08/2027' }))).toEqual(['date results.refused.theRaceHasNotBeenRun'])
    expect(boxes(filled({ date: TODAY.split('-').reverse().join('/') }))).toEqual([])
    expect(boxes(filled({ country: '' }))).toEqual(['city form.errors.countryMissing'])
  })

  it('takes a day of any year up to today, those before the league and those of a season long closed too', () => {
    /* Owner, 21.10.2026: „Moderator i admin smeju da unose rezultate za BILO KOJU prethodnu godinu”. The
       year before the league (the refusal of 19.10.2026) and the season not open (the refusal of
       20.10.2026) are neither said any more, on the day the year is nearest to and on a far one. */
    expect(boxes(filled({ date: '31/12/2026' }))).toEqual([])
    expect(boxes(filled({ date: '06/06/2015' }))).toEqual([])
    expect(boxes(filled({ date: '31/12/2027' }), '2028-03-01')).toEqual([])
    expect(boxes(filled({ date: '31/12/2027' }), '2031-03-01')).toEqual([])
    /* And still a day that has not come, whatever year it is in. */
    expect(boxes(filled({ date: '01/01/2028' }), '2027-12-31')).toEqual(['date results.refused.theRaceHasNotBeenRun'])
  })

  it('holds a course to a length above nought and whole climbs from nought up, and a limit above nought', () => {
    expect(boxes(filled({ distanceKm: '0', ascentM: '-1', descentM: '1,5' }))).toEqual([
      'distanceKm form.errors.required',
      'ascentM form.errors.required',
      'descentM form.errors.required',
    ])
    expect(boxes(filled({ ascentM: '0', descentM: '0' }))).toEqual([])
    expect(boxes(filled({ kind: 'time', hours: '0', minutes: '0', seconds: '0' }))).toEqual([
      'hours form.errors.required',
      'minutes form.errors.required',
      'seconds form.errors.required',
    ])
    expect(boxes(filled({ kind: 'time', minutes: '30' }))).toEqual([])
  })

  it('asks no day and no figure of a race of the calendar, and no town of an event of the calendar', () => {
    const onTheCalendar = choosingTheRace(
      choosingTheEvent(emptyBlock(), OFFERED[0] ?? { id: '', value: '', said: '', fills: {} }, [AN_EVENT]),
      { id: String(A_RACE.id), value: A_RACE.name, said: '', fills: {} },
      [A_RACE],
    )

    expect(boxes({ ...onTheCalendar, date: '' })).toEqual([])
  })
})

/**
 * A NEW RACE ON AN EVENT OF THE CALENDAR IS OF THAT EVENT'S YEAR (owner, 22.10.2026, PDL „Ekran 7b: dan
 * trke mora biti u godini izabranog događaja”, with the morning of 1 January kept as the exception).
 *
 * <p>The event is of 2027 and the cases stand on days of 2028, so the year of the event and the year
 * today is in are two different years, and the seasons open are said by each case: 2028 alone, 2027 and
 * 2028 on the morning of 1 January, or not known yet.
 */
describe('the day of a new race on an event of the calendar', () => {
  const onTheEvent = (date: string): TheBlock => ({
    ...choosingTheEvent(emptyBlock(), OFFERED[0] ?? { id: '', value: '', said: '', fills: {} }, [AN_EVENT]),
    date,
    raceName: 'Nova',
    distanceKm: '10',
    ascentM: '0',
    descentM: '0',
  })
  const IN_2028 = '2028-03-01'
  const OUT_OF_THE_WINDOW: TheBlockIsAsked = { open: [2028], offered: OFFERED }
  const THE_WINDOW: TheBlockIsAsked = { open: [2027, 2028], offered: OFFERED }
  const NOT_KNOWN: TheBlockIsAsked = { open: null, offered: OFFERED }
  const SAID = 'date leagueResults.refused.theDayIsNotInTheEventsYear'

  it('takes another day of the event’s year, which is not the year today is in', () => {
    expect(boxes(onTheEvent('01/06/2027'), IN_2028, OUT_OF_THE_WINDOW)).toEqual([])
  })

  it('says a day of the year after the event and a day of the year before it, in the server’s words', () => {
    expect(boxes(onTheEvent('01/02/2028'), IN_2028, OUT_OF_THE_WINDOW)).toEqual([SAID])
    expect(boxes(onTheEvent('31/12/2026'), IN_2028, OUT_OF_THE_WINDOW)).toEqual([SAID])
  })

  it('takes the other year while both are open, and only while they are', () => {
    expect(boxes(onTheEvent('01/01/2028'), '2028-01-01', THE_WINDOW)).toEqual([])
    expect(boxes(onTheEvent('01/01/2028'), '2028-01-01', OUT_OF_THE_WINDOW)).toEqual([SAID])
    /* Open seasons that do not hold the event's year give it no other. */
    expect(boxes(onTheEvent('01/01/2028'), '2028-01-01', { open: [2028, 2029], offered: OFFERED })).toEqual([SAID])
  })

  it('says nothing of the year before the open seasons are known, as the server will', () => {
    expect(boxes(onTheEvent('01/02/2028'), IN_2028, NOT_KNOWN)).toEqual([])
  })

  it('asks no year of a new event, whose day is its own', () => {
    expect(boxes(filled({ date: '01/02/2026' }), IN_2028, OUT_OF_THE_WINDOW)).toEqual([])
  })

  it('shows the calendar the event’s year, both open years on the morning of 1 January, and nothing where no event is chosen', () => {
    expect(yearsOfTheDay(onTheEvent(''), [2028])).toEqual({ first: 2027, last: 2027 })
    expect(yearsOfTheDay(onTheEvent(''), [2027, 2028])).toEqual({ first: 2027, last: 2028 })
    expect(yearsOfTheDay(onTheEvent(''), [2026, 2027])).toEqual({ first: 2026, last: 2027 })
    expect(yearsOfTheDay(onTheEvent(''), null)).toEqual({ first: 2027, last: 2027 })
    expect(yearsOfTheDay(filled(), [2027])).toBeUndefined()
    expect(yearsOfTheDay({ ...onTheEvent(''), race: { raceId: A_RACE.id, kind: 'time' } }, [2027])).toBeUndefined()
  })
})

/**
 * A NAME OF SEVERAL EDITIONS IS NOT SENT AS A NEW EVENT WHERE THE DAY IS IN THE YEAR OF ONE OF THEM (owner,
 * 22.10.2026, answering the author's question: „dugme ne pušta dok godina nije izabrana sa spiska, rečenicom
 * „Izaberi godinu sa spiska.” … godina bez izdanja i dalje pravi nov događaj”).
 *
 * <p>Two editions of one name, of 2025 and 2026, and a third event whose name only begins with it, so a name
 * that only begins an entry, a name of one edition and a year with no edition are each a different answer.
 */
describe('a name that stands for several editions', () => {
  const edition = (id: string, value: string, date: string) => ({ id, value, said: `${value} – ${date}`, fills: { eventId: id, date } })
  const EDITIONS = [
    edition('1', 'Beogradski maraton', '12/04/2026'),
    edition('2', 'Beogradski maraton', '06/04/2025'),
    edition('3', 'Beogradski maraton noću', '01/06/2026'),
  ]
  const asked: TheBlockIsAsked = { open: [2027], offered: EDITIONS }
  const named = (eventName: string, date: string) => boxes(filled({ eventName, raceName: eventName, date }), TODAY, asked)
  const SAID = 'eventName leagueResults.chooseTheYear'

  it('holds the save until a year is chosen, where the day is in the year of one of them', () => {
    expect(named('Beogradski maraton', '01/06/2026')).toEqual([SAID])
    expect(named('Beogradski maraton', '01/06/2025')).toEqual([SAID])
  })

  it('reads the name as the list does, in any case and with the spaces around it taken off', () => {
    expect(named('  beogradski MARATON ', '01/06/2026')).toEqual([SAID])
  })

  it('lets a year with no edition make a new event', () => {
    expect(named('Beogradski maraton', '01/06/2024')).toEqual([])
  })

  it('asks nothing of a name of one edition, of a name that only begins one, or of a block with no day yet', () => {
    expect(named('Beogradski maraton noću', '01/06/2026')).toEqual([])
    expect(named('Beogradski', '01/06/2026')).toEqual([])
    expect(named('Beogradski maraton', '')).toEqual(['date form.errors.required'])
  })

  it('asks nothing once an edition is chosen', () => {
    const chosen = { ...filled({ eventName: 'Beogradski maraton', date: '01/06/2026' }), event: { eventId: 1, slug: 'b', date: '2026-04-12' } }

    expect(boxes(chosen, TODAY, asked)).toEqual([])
  })
})

describe('what the save sends of the event and the race', () => {
  it('names a new event by its name, its one day and its town, and gives its race no day of its own', () => {
    expect(eventAndRaceOf(filled())).toEqual({
      event: { name: 'Jezerska trka', date: '2027-06-01', city: 'Ohrid', country: 'MK' },
      race: { name: 'Jezerska desetka', kind: 'length', distanceKm: 10, ascentM: 20, descentM: 30, limitSeconds: null },
    })
  })

  it('names an event of the calendar by its key, and a new race on it with its own day and its limit', () => {
    const linked = choosingTheEvent(filled(), OFFERED[0] ?? { id: '', value: '', said: '', fills: {} }, [AN_EVENT])

    expect(eventAndRaceOf({ ...linked, raceName: 'Sat', kind: 'time', hours: '1', date: '05/03/2027' })).toEqual({
      event: { id: AN_EVENT.id },
      race: { name: 'Sat', date: '2027-03-05', kind: 'time', distanceKm: null, ascentM: null, descentM: null, limitSeconds: 3600 },
    })
    expect(eventAndRaceOf({ ...linked, raceName: 'Slobodna', kind: 'free' }).race).toMatchObject({
      distanceKm: null,
      limitSeconds: null,
    })
  })
})

describe('where the screen goes once the save is written', () => {
  it('goes to the address the answer names, and to the chosen event’s own where it names none', () => {
    const linked = choosingTheEvent(filled(), OFFERED[0] ?? { id: '', value: '', said: '', fills: {} }, [AN_EVENT])

    expect(theEventPageAfter(filled(), 'jezerska-trka-2027', 'sr')).toBe('/sr/kalendar/jezerska-trka-2027')
    expect(theEventPageAfter(linked, null, 'sr')).toBe(`/sr/kalendar/${AN_EVENT.slug}`)
    expect(theEventPageAfter(filled(), null, 'en')).toBe('/en/kalendar/')
  })

  it('reads the address off the answer only where it is a word', () => {
    const done = (body: unknown): Answer => ({ got: 'done', body })

    expect(theEventSavedOn(done({ results: [1], event: 'jezerska-trka-2027' }))).toBe('jezerska-trka-2027')
    expect(theEventSavedOn(done({ results: [1] }))).toBeNull()
    expect(theEventSavedOn(done({ event: '' }))).toBeNull()
    expect(theEventSavedOn(done(null))).toBeNull()
    expect(theEventSavedOn({ got: 'refused', reason: 'theEventIsNotKnown' })).toBeNull()
  })

  it('finds the help of a box where a definition declares it, and none where it does not', () => {
    expect(hintOf([{ name: 'a', type: 'text', labelKey: 'x' }, { name: 'b', type: 'text', labelKey: 'y', hintKey: 'z' }])).toBe('z')
    expect(hintOf([{ name: 'a', type: 'text', labelKey: 'x' }])).toBeUndefined()
  })
})
