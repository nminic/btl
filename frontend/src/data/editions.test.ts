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

function edition(id: number, copiedFrom: number | null = null): BtlEvent {
  return {
    id,
    slug: `bg-${String(id)}`,
    name: 'Beogradski maraton',
    date: '2027-04-03',
    city: 'Beograd',
    country: 'RS',
    description: '',
    link: '',
    kind: 'race',
    featured: false,
    copiedFrom,
  }
}

const FIRST = edition(4)
const SECOND = edition(6, 4)
const THIRD = edition(7, 6)
const OTHER = edition(8)

const ALL = [THIRD, OTHER, SECOND, FIRST]

describe('the editions of one race', () => {
  it('is the whole chain backwards, newest first', () => {
    expect(editionsOf(ALL, 7).map((one) => one.id)).toEqual([7, 6, 4])
  })

  it('stops where the reading started, and does not go forwards', () => {
    /* Read from the middle of a chain, what is above it is a later running that
       nobody was looking at: a comment written in 2027 does not belong under
       the 2026 page, which was already published when it was written. */
    expect(editionsOf(ALL, 6).map((one) => one.id)).toEqual([6, 4])
  })

  it('is the event alone where it was entered rather than copied', () => {
    expect(editionsOf(ALL, 8).map((one) => one.id)).toEqual([8])
  })

  it('is nothing at all for an event that is not there', () => {
    expect(editionsOf(ALL, 12)).toEqual([])
  })

  it('stops where the record stops, when a parent has been deleted', () => {
    /* Deleting an event is allowed and nothing forbids deleting one a copy came
       out of. The chain ends there rather than the screen ending. */
    const orphan = edition(9, 10)

    expect(editionsOf([orphan], 9).map((one) => one.id)).toEqual([9])
  })

  it('meets every event once, so a link that points at itself is not a hung page', () => {
    /* The link is a value in a record, and records are written by imports and
       by people as well as by the copy button. A page that never finishes
       drawing is the worst of the three ways to be wrong about this. */
    const itself = edition(11, 11)

    expect(editionsOf([itself], 11).map((one) => one.id)).toEqual([11])
  })

  it('survives two editions pointing at each other', () => {
    const one = edition(1, 2)
    const two = edition(2, 1)

    expect(editionsOf([one, two], 1).map((edition) => edition.id)).toEqual([1, 2])
  })
})
