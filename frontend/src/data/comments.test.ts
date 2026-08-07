import { must } from '../test/at'
import { loadResource } from './client'
import type { BtlEvent, Competitor, EventComment } from './types'

/**
 * What the record of comments has to hold together.
 *
 * The generated data is what every screen test reads, so a row that could not
 * exist in the portal is a row those tests are quietly built on. Three of these
 * went wrong while the feature was being written: a comment filed under an
 * event nobody has, a name that belonged to a different member number, and a
 * comment dated before the race it is about.
 *
 * The one exception is written down rather than left to be discovered: a
 * comment may be older than its event's date, because approving a change of
 * date moves an event onto a new one and what was written stays where it was
 * published (types.ts, `subjectId`). What may not happen is a comment about a
 * race that had not been run when it was written, which is a different thing
 * and is what PDL P9 refuses.
 */

const dateOf = (events: BtlEvent[], id: string) => events.find((one) => one.id === id)?.date

describe('the comments in the record', () => {
  it('are each about an event the portal has', async () => {
    const comments = await loadResource<EventComment[]>('comments')
    const events = await loadResource<BtlEvent[]>('events')

    expect(comments.length).toBeGreaterThan(4)
    expect(comments.filter((one) => dateOf(events, one.eventId) === undefined)).toEqual([])
  })

  it('are each written by a member the portal has, or by nobody it still has', async () => {
    const comments = await loadResource<EventComment[]>('comments')
    const competitors = await loadResource<Competitor[]>('competitors')

    /* The name travels with the comment because the member may leave (PDL P11),
       so it has to be the name that member has while they are still here: read
       off the record on one screen and off the comment on another, the two must
       not be able to disagree. */
    const wrong = comments.filter((one) => {
      const who = competitors.find((each) => each.memberNumber === one.memberNumber)

      return who !== undefined && `${who.firstName} ${who.lastName}` !== one.who
    })

    expect(wrong.map((one) => one.id)).toEqual([])
  })

  it('are none of them written before the race they are about', async () => {
    const comments = await loadResource<EventComment[]>('comments')
    const events = await loadResource<BtlEvent[]>('events')

    /* One row is older than its event on purpose, and it is named here rather
       than allowed by a rule: approving a change of date moves an event onto a
       new one and what was already published stays where it was (types.ts,
       `subjectId`), so the record has to be able to carry that and the screens
       have to be shown doing it. Named, because a rule saying "older is fine"
       would allow the thing this test is for: a comment about a race that had
       not been run when it was written, which PDL P9 refuses. */
    const moved = ['kom-8']
    const early = comments.filter(
      (one) => !moved.includes(one.id) && one.date < (dateOf(events, one.eventId) ?? ''),
    )

    expect(early.map((one) => `${one.id} on ${one.eventId}`)).toEqual([])

    /* And each named one really is the case it is named for, so the list cannot
       quietly become a place to put whatever fails. */
    for (const id of moved) {
      const one = must(
        comments.find((each) => each.id === id),
        `${id} in the record`,
      )

      expect(one.date < (dateOf(events, one.eventId) ?? ''), `${id} is older than its event`)
        .toBe(true)
    }
  })
})
