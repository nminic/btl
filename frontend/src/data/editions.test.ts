import { editionsOf } from './editions'
import type { BtlEvent } from './types'

/**
 * One race through the years.
 *
 * An event copied for the next season carries the id of the one it came out of,
 * and that is what makes a chain of editions readable (owner, 11.08.2026). What
 * it is for is the comments: what was said about last year's running is said
 * about this race, and until this every new edition opened with nothing.
 */

function edition(id: string, copiedFrom = ''): BtlEvent {
  return {
    id,
    slug: id,
    name: 'Beogradski maraton',
    date: '2027-04-03',
    city: 'Beograd',
    country: 'RS',
    organizer: 'x',
    kind: 'race',
    copiedFrom,
  }
}

const FIRST = edition('bg-2025')
const SECOND = edition('bg-2026', 'bg-2025')
const THIRD = edition('bg-2027', 'bg-2026')
const OTHER = edition('ns-2027')

const ALL = [THIRD, OTHER, SECOND, FIRST]

describe('the editions of one race', () => {
  it('is the whole chain backwards, newest first', () => {
    expect(editionsOf(ALL, 'bg-2027').map((one) => one.id)).toEqual([
      'bg-2027',
      'bg-2026',
      'bg-2025',
    ])
  })

  it('stops where the reading started, and does not go forwards', () => {
    /* Read from the middle of a chain, what is above it is a later running that
       nobody was looking at: a comment written in 2027 does not belong under
       the 2026 page, which was already published when it was written. */
    expect(editionsOf(ALL, 'bg-2026').map((one) => one.id)).toEqual(['bg-2026', 'bg-2025'])
  })

  it('is the event alone where it was entered rather than copied', () => {
    expect(editionsOf(ALL, 'ns-2027').map((one) => one.id)).toEqual(['ns-2027'])
  })

  it('is nothing at all for an event that is not there', () => {
    expect(editionsOf(ALL, 'nepostojeci')).toEqual([])
  })

  it('stops where the record stops, when a parent has been deleted', () => {
    /* Deleting an event is allowed and nothing forbids deleting one a copy came
       out of. The chain ends there rather than the screen ending. */
    const orphan = edition('bg-2028', 'obrisan')

    expect(editionsOf([orphan], 'bg-2028').map((one) => one.id)).toEqual(['bg-2028'])
  })

  it('meets every event once, so a link that points at itself is not a hung page', () => {
    /* The link is a value in a record, and records are written by imports and
       by people as well as by the copy button. A page that never finishes
       drawing is the worst of the three ways to be wrong about this. */
    const itself = edition('sam', 'sam')

    expect(editionsOf([itself], 'sam').map((one) => one.id)).toEqual(['sam'])
  })

  it('survives two editions pointing at each other', () => {
    const one = edition('a', 'b')
    const two = edition('b', 'a')

    expect(editionsOf([one, two], 'a').map((edition) => edition.id)).toEqual(['a', 'b'])
  })
})
