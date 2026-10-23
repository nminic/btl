import { describe, expect, it } from 'vitest'
import type { BtlEvent, Race } from '../../data/types'
import type { Answer } from '../account/askTheServer'
import {
  aNewEditionOf,
  changingTheDay,
  choosingTheEvent,
  choosingTheRace,
  emptyBlock,
  eventAndRaceOf,
  figuresOfANewRace,
  hintOf,
  kindOfTheRows,
  theEventPageAfter,
  theNameHasOneEdition,
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

/** The same name once more, in 2026: a name of two editions, and the box links neither by being typed. */
const SEVERAL = [...OFFERED, { id: '9502', value: AN_EVENT.name, said: AN_EVENT.name, fills: {} }]

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
  /* The name stands in two years, so the edition chosen holds the day to its year (the owner's decision of
     22.10.2026 as it stands for such a name; a name of one edition is the next block's). */
  const OUT_OF_THE_WINDOW: TheBlockIsAsked = { open: [2028], offered: SEVERAL }
  const THE_WINDOW: TheBlockIsAsked = { open: [2027, 2028], offered: SEVERAL }
  const NOT_KNOWN: TheBlockIsAsked = { open: null, offered: SEVERAL }
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
    expect(boxes(onTheEvent('01/01/2028'), '2028-01-01', { open: [2028, 2029], offered: SEVERAL })).toEqual([SAID])
  })

  it('says nothing of the year before the open seasons are known, as the server will', () => {
    expect(boxes(onTheEvent('01/02/2028'), IN_2028, NOT_KNOWN)).toEqual([])
  })

  it('asks no year of a new event, whose day is its own', () => {
    expect(boxes(filled({ date: '01/02/2026' }), IN_2028, OUT_OF_THE_WINDOW)).toEqual([])
  })

  it('shows the calendar the event’s year, both open years on the morning of 1 January, and nothing where no event is chosen', () => {
    expect(yearsOfTheDay(onTheEvent(''), [2028], SEVERAL)).toEqual({ first: 2027, last: 2027 })
    expect(yearsOfTheDay(onTheEvent(''), [2027, 2028], SEVERAL)).toEqual({ first: 2027, last: 2028 })
    expect(yearsOfTheDay(onTheEvent(''), [2026, 2027], SEVERAL)).toEqual({ first: 2026, last: 2027 })
    expect(yearsOfTheDay(onTheEvent(''), null, SEVERAL)).toEqual({ first: 2027, last: 2027 })
    expect(yearsOfTheDay(filled(), [2027], SEVERAL)).toBeUndefined()
    expect(
      yearsOfTheDay({ ...onTheEvent(''), race: { raceId: A_RACE.id, kind: 'time' } }, [2027], SEVERAL),
    ).toBeUndefined()
  })
})

/**
 * A NAME OF ONE EDITION AND A DAY OF ANOTHER YEAR MAKE A NEW EDITION (owner, 23.10.2026, PDL „Unos trke sa
 * imenom događaja koji ima samo jedno izdanje, a dan trke je u drugoj godini, pravi novo izdanje tog
 * događaja, isto kao za ime sa više izdanja”). The name typed exactly links its one edition, and the block
 * then asks for what a name that links nothing is asked for.
 *
 * <p>The event is of 2027 and the cases stand on days of 2028; every axis the rule reads has a case on
 * both sides: one edition or two, the day in the edition's year or in another, a window or none, seasons
 * known or not, and the name as the list keeps it or as it was typed.
 */
describe('a new edition of a name of one edition', () => {
  /* The list holds other events first, so the one linked is never the first entry, and a name that only
     begins the linked one, which is not a second edition of it. */
  const ALONGSIDE = [
    { id: '9700', value: 'Zimska liga', said: 'Zimska liga', fills: {} },
    { id: '9701', value: 'Gradska liga noću', said: 'Gradska liga noću', fills: {} },
    ...OFFERED,
  ]
  const IN_2028 = '2028-03-01'
  const ALONE: TheBlockIsAsked = { open: [2028], offered: ALONGSIDE }
  const THE_WINDOW: TheBlockIsAsked = { open: [2027, 2028], offered: ALONGSIDE }
  const NOT_KNOWN: TheBlockIsAsked = { open: null, offered: ALONGSIDE }
  const onTheOnlyEdition = (date: string, over: Partial<TheBlock> = {}): TheBlock => ({
    ...typingTheEvent(emptyBlock(), 'gradska LIGA', ALONGSIDE, [AN_EVENT]),
    date,
    raceName: 'Nova',
    distanceKm: '10',
    ascentM: '0',
    descentM: '0',
    ...over,
  })
  const TOWN_MISSING = 'city leagueResults.refused.theTownIsMissing'

  it('counts the editions of the chosen event’s own name, as the list spells it and not as it was typed', () => {
    /* „Gradska liga noću” only begins the name, so it is no second edition of it. */
    expect(theNameHasOneEdition(onTheOnlyEdition(''), ALONGSIDE)).toBe(true)
    /* The same name in another case is. */
    expect(theNameHasOneEdition(onTheOnlyEdition(''), [...ALONGSIDE, { id: '9702', value: 'GRADSKA LIGA', said: '', fills: {} }])).toBe(false)
    expect(theNameHasOneEdition(onTheOnlyEdition(''), SEVERAL)).toBe(false)
    expect(theNameHasOneEdition(emptyBlock(), ALONGSIDE)).toBe(false)
    /* A list that does not hold the chosen event says nothing of its name. */
    expect(theNameHasOneEdition(onTheOnlyEdition(''), [])).toBe(false)
  })

  it('asks the town of a day in another year, and refuses neither that day nor anything else', () => {
    expect(boxes(onTheOnlyEdition('01/02/2028'), IN_2028, ALONE)).toEqual([TOWN_MISSING])
    expect(boxes(onTheOnlyEdition('31/12/2026'), IN_2028, ALONE)).toEqual([TOWN_MISSING])
    expect(boxes(onTheOnlyEdition('01/02/2028', { city: 'Ohrid', country: 'MK' }), IN_2028, ALONE)).toEqual([])
    expect(boxes(onTheOnlyEdition('01/02/2028', { city: 'Ohrid' }), IN_2028, ALONE)).toEqual([
      'city form.errors.countryMissing',
    ])
  })

  it('still asks no town of a day in the edition’s own year', () => {
    expect(boxes(onTheOnlyEdition('01/06/2027'), IN_2028, ALONE)).toEqual([])
    expect(aNewEditionOf(onTheOnlyEdition('01/06/2027'), ALONE)).toBe(false)
    expect(aNewEditionOf(onTheOnlyEdition('01/02/2028'), ALONE)).toBe(true)
  })

  it('does not make a new edition on the morning of 1 January, when both years are open and the race goes on the event', () => {
    expect(boxes(onTheOnlyEdition('01/01/2028'), '2028-01-01', THE_WINDOW)).toEqual([])
    expect(aNewEditionOf(onTheOnlyEdition('01/01/2028'), THE_WINDOW)).toBe(false)
    expect(aNewEditionOf(onTheOnlyEdition('01/01/2028'), { ...THE_WINDOW, open: [2028] })).toBe(true)
  })

  it('makes nothing before the open seasons are known, as the box says nothing of the year then either', () => {
    expect(aNewEditionOf(onTheOnlyEdition('01/02/2028'), NOT_KNOWN)).toBe(false)
    expect(boxes(onTheOnlyEdition('01/02/2028'), IN_2028, NOT_KNOWN)).toEqual([])
  })

  it('makes nothing where no day is typed, where the race is one of the calendar’s, or where no event is chosen', () => {
    expect(aNewEditionOf(onTheOnlyEdition(''), ALONE)).toBe(false)
    expect(aNewEditionOf(onTheOnlyEdition('01/02/2028', { race: { raceId: A_RACE.id, kind: 'time' } }), ALONE)).toBe(false)
    expect(aNewEditionOf(filled({ date: '01/02/2028' }), ALONE)).toBe(false)
  })

  it('makes nothing of a name of several editions, whose chosen edition keeps the refusal', () => {
    const several: TheBlockIsAsked = { open: [2028], offered: SEVERAL }

    expect(aNewEditionOf(onTheOnlyEdition('01/02/2028'), several)).toBe(false)
    expect(boxes(onTheOnlyEdition('01/02/2028'), IN_2028, several)).toEqual([
      'date leagueResults.refused.theDayIsNotInTheEventsYear',
    ])
  })

  it('shows the calendar every year of a name of one edition, and still the edition’s year for several', () => {
    expect(yearsOfTheDay(onTheOnlyEdition(''), [2028], ALONGSIDE)).toBeUndefined()
    expect(yearsOfTheDay(onTheOnlyEdition(''), null, ALONGSIDE)).toBeUndefined()
    expect(yearsOfTheDay(onTheOnlyEdition(''), [2028], SEVERAL)).toEqual({ first: 2027, last: 2027 })
  })

  it('sends the new edition as the new event it is, by the list’s name, with its own day and the town typed', () => {
    expect(
      eventAndRaceOf(onTheOnlyEdition('01/02/2028', { city: ' Ohrid ', country: 'MK', raceName: ' Prva ' }), ALONE),
    ).toEqual({
      event: { name: 'Gradska liga', date: '2028-02-01', city: 'Ohrid', country: 'MK' },
      race: { name: 'Prva', kind: 'length', distanceKm: 10, ascentM: 0, descentM: 0, limitSeconds: null },
    })
  })

  it('gives the race the event’s name, as the list spells it, when the day makes a new edition and the race has none', () => {
    const typed = onTheOnlyEdition('01/06/2027', { raceName: '' })

    expect(typed.raceName).toBe('')
    expect(changingTheDay(typed, '01/02/2028', ALONE).raceName).toBe('Gradska liga')
    expect(changingTheDay(typed, '01/02/2028', ALONE).date).toBe('01/02/2028')
  })

  it('never writes over a race that has a name, whatever it is', () => {
    expect(changingTheDay(onTheOnlyEdition('01/06/2027', { raceName: 'Moja trka' }), '01/02/2028', ALONE).raceName).toBe('Moja trka')
  })

  it('takes the name back when the day goes back to the edition’s year, and only if it was the event’s own', () => {
    const made = changingTheDay(onTheOnlyEdition('01/06/2027', { raceName: '' }), '01/02/2028', ALONE)

    expect(changingTheDay(made, '01/06/2027', ALONE).raceName).toBe('')
    expect(changingTheDay({ ...made, raceName: 'Prva' }, '01/06/2027', ALONE).raceName).toBe('Prva')
  })

  it('leaves the race alone where the day changes and nothing is made or given up', () => {
    const made = changingTheDay(onTheOnlyEdition('01/06/2027', { raceName: '' }), '01/02/2028', ALONE)

    expect(changingTheDay(made, '02/02/2028', ALONE).raceName).toBe('Gradska liga')
    expect(changingTheDay(onTheOnlyEdition('01/06/2027', { raceName: '' }), '02/06/2027', ALONE).raceName).toBe('')
    expect(changingTheDay(onTheOnlyEdition('01/06/2027', { raceName: '' }), '01/02/2028', NOT_KNOWN).raceName).toBe('')
    expect(changingTheDay(onTheOnlyEdition('01/06/2027', { raceName: '' }), '01/02/2028', { open: [2028], offered: SEVERAL }).raceName).toBe('')
  })

  it('sends the edition itself, by its key and with the race’s own day, where nothing makes a new one', () => {
    const own = eventAndRaceOf(onTheOnlyEdition('01/06/2027', { city: 'Ohrid', country: 'MK' }), ALONE)
    const inTheWindow = eventAndRaceOf(onTheOnlyEdition('01/01/2028'), THE_WINDOW)
    const several = eventAndRaceOf(onTheOnlyEdition('01/02/2028'), { open: [2028], offered: SEVERAL })
    const unknown = eventAndRaceOf(onTheOnlyEdition('01/02/2028'), NOT_KNOWN)

    expect(own.event).toEqual({ id: AN_EVENT.id })
    expect(own.race).toMatchObject({ date: '2027-06-01' })
    expect(inTheWindow.event).toEqual({ id: AN_EVENT.id })
    expect(inTheWindow.race).toMatchObject({ date: '2028-01-01' })
    expect([several.event, unknown.event]).toEqual([{ id: AN_EVENT.id }, { id: AN_EVENT.id }])
    expect([several.race, unknown.race]).toEqual([
      expect.objectContaining({ date: '2028-02-01' }),
      expect.objectContaining({ date: '2028-02-01' }),
    ])
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
  const entry = (id: string, value: string, fills: Record<string, string>) => ({ id, value, said: value, fills })
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

  it('reads an entry that carries no day as of no year, so it holds nothing', () => {
    /* The type lets an entry fill nothing (`forms/types.ts`, `fills`), and the event's list always fills the
       day; an entry without one is not an edition of any year the block could be asked about. */
    const dayless = { open: [2027], offered: [entry('9', 'Bez dana', {}), entry('8', 'Bez dana', {})] }

    expect(boxes(filled({ eventName: 'Bez dana', date: '01/06/2026' }), TODAY, dayless)).toEqual([])
  })

  it('asks nothing once an edition is chosen', () => {
    const chosen = { ...filled({ eventName: 'Beogradski maraton', date: '01/06/2026' }), event: { eventId: 1, slug: 'b', date: '2026-04-12' } }

    expect(boxes(chosen, TODAY, asked)).toEqual([])
  })
})

describe('what the save sends of the event and the race', () => {
  it('names a new event by its name, its one day and its town, and gives its race no day of its own', () => {
    expect(eventAndRaceOf(filled(), ASKED)).toEqual({
      event: { name: 'Jezerska trka', date: '2027-06-01', city: 'Ohrid', country: 'MK' },
      race: { name: 'Jezerska desetka', kind: 'length', distanceKm: 10, ascentM: 20, descentM: 30, limitSeconds: null },
    })
  })

  it('names an event of the calendar by its key, and a new race on it with its own day and its limit', () => {
    const linked = choosingTheEvent(filled(), OFFERED[0] ?? { id: '', value: '', said: '', fills: {} }, [AN_EVENT])

    expect(eventAndRaceOf({ ...linked, raceName: 'Sat', kind: 'time', hours: '1', date: '05/03/2027' }, ASKED)).toEqual({
      event: { id: AN_EVENT.id },
      race: { name: 'Sat', date: '2027-03-05', kind: 'time', distanceKm: null, ascentM: null, descentM: null, limitSeconds: 3600 },
    })
    expect(eventAndRaceOf({ ...linked, raceName: 'Slobodna', kind: 'free' }, ASKED).race).toMatchObject({
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
