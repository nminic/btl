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
  yearsOffered,
  type TheBlock,
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

const boxes = (block: TheBlock) => whatIsWrongWithTheBlock(block, TODAY).map((one) => `${one.box} ${one.key}`)

describe('the years offered', () => {
  it('are none before the league, and every year from 2027 to today', () => {
    expect(yearsOffered('2026-12-31')).toEqual([])
    expect(yearsOffered('2027-01-01')).toEqual([2027])
    expect(yearsOffered('2029-05-05')).toEqual([2027, 2028, 2029])
  })
})

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

  it('says a day before the league, a day still to come, and a town with no country, each in its own words', () => {
    expect(boxes(filled({ date: '31/12/2026' }))).toEqual(['date leagueResults.refused.theDayIsBeforeTheLeague'])
    expect(boxes(filled({ date: '24/08/2027' }))).toEqual(['date results.refused.theRaceHasNotBeenRun'])
    expect(boxes(filled({ date: TODAY.split('-').reverse().join('/') }))).toEqual([])
    expect(boxes(filled({ country: '' }))).toEqual(['city form.errors.countryMissing'])
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
