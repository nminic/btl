import type { Race } from '../../data/types'
import { measureHeadingKey, measureKey } from './measureHeading'

/**
 * The head over the measure of the races of an event, and the word over each figure
 * (owner, 16.10.2026): „Pominje se dužina ili trajanje zavisno od toga kakva je trka.
 * BEZ MERE."
 */

const length: Pick<Race, 'kind'> = { kind: 'length' }
const time: Pick<Race, 'kind'> = { kind: 'time' }
const free: Pick<Race, 'kind'> = { kind: 'free' }

describe('the word of a race', () => {
  it('is how long it lasts for a timed race and how far it is for every other', () => {
    expect(measureKey('time')).toBe('event.duration')
    expect(measureKey('length')).toBe('event.distance')
    expect(measureKey('free')).toBe('event.distance')
  })

  it('reads a word it has never heard of as a race of a length', () => {
    /* `data/raceKind.ts`: the file is not checked between the disk and the screen. */
    expect(measureKey('ludilo')).toBe('event.distance')
  })
})

describe('the head over the measures of an event', () => {
  it('says the length where every race is of a length or free', () => {
    expect(measureHeadingKey([length, length])).toBe('event.distance')
    expect(measureHeadingKey([length, free])).toBe('event.distance')
    expect(measureHeadingKey([free, free])).toBe('event.distance')
  })

  it('says how long where every race is timed', () => {
    expect(measureHeadingKey([time])).toBe('event.duration')
    expect(measureHeadingKey([time, time, time])).toBe('event.duration')
  })

  it('says both where the two are mixed, whichever stands first and however many', () => {
    expect(measureHeadingKey([time, length])).toBe('event.distanceOrDuration')
    expect(measureHeadingKey([length, time])).toBe('event.distanceOrDuration')
    expect(measureHeadingKey([free, time])).toBe('event.distanceOrDuration')
    expect(measureHeadingKey([length, time, time])).toBe('event.distanceOrDuration')
  })

  it('says the length over no race at all, since that is the word true of most', () => {
    expect(measureHeadingKey([])).toBe('event.distance')
  })
})
