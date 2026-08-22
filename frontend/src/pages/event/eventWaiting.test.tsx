import { screen } from '@testing-library/react'
import type { ResourceState } from '../../data/useResource'
import type { EventComment, Result } from '../../data/types'
import { renderAt } from '../../test/render'

/**
 * What the foot of an event does while its two lower parts are not there yet.
 *
 * An event still to be run draws neither the results nor the comments, so it
 * must not hold a box open for either: the reader would watch a space that
 * resolves into nothing, and on a broken connection an alert about a part that
 * was never going to be drawn.
 *
 * Both parts in every case, because the two are one decision. They diverged
 * once, on the error state, and each carried a comment saying the other agreed
 * with it.
 *
 * The state is forced, because it cannot be caught by hand: these parts mount
 * only after the event itself has arrived, and by then the files have been read
 * off the disc and settled. Only these two resources are held; everything else
 * on the screen loads as it does.
 */

/** What the two hooks are made to answer with, per case. Typed against their own
 *  returns, so a change to either shape is a build error here rather than a file
 *  that goes on passing while proving nothing. */
let comments: ResourceState<EventComment[]> = { status: 'loading' }
let results: ResourceState<Result[]> = { status: 'loading' }

vi.mock('../../data/useResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/useResource')>()),
  useComments: (): ResourceState<EventComment[]> => comments,
  useResults: (): ResourceState<Result[]> => results,
}))

const RAN = 'fruskogorski-maraton-2010'
const AHEAD = 'podgoricka-desetka-2027'
const BEFORE = '2026-12-31'

/** The two parts, by what each says while it waits and what it is called. */
const PARTS = [
  ['the comments', 'Učitavanje: Komentari', 'Komentari'],
  ['the results', 'Učitavanje: Rezultati članova', 'Rezultati članova'],
] as const

function waiting(): void {
  comments = { status: 'loading' }
  results = { status: 'loading' }
}

function broken(): void {
  comments = { status: 'error', error: new Error('pukla veza') }
  results = { status: 'error', error: new Error('pukla veza') }
}

describe('a part of an event that has not arrived', () => {
  for (const [name, said] of PARTS) {
    it(`holds a box open for ${name} where the race has been run`, async () => {
      waiting()
      renderAt(`/sr/kalendar/${RAN}`, 'competitor', '000007', undefined, BEFORE)

      expect(await screen.findByText(said)).toBeVisible()
    })
  }

  it('holds none where the race has not been run', async () => {
    waiting()
    renderAt(`/sr/kalendar/${AHEAD}`, 'competitor', '000007', undefined, BEFORE)

    /* Waited for by something else on the screen, so the check is made after the
       event itself has arrived and the sections would have been drawn. The table
       of races and not the heading over it: the heading went on 23.08.2026 and
       the table names itself in a caption instead. */
    await screen.findByRole('table', { name: 'Trke' })

    for (const [, said, heading] of PARTS) {
      expect(screen.queryByText(said)).toBeNull()
      expect(screen.queryByRole('heading', { name: heading })).toBeNull()
    }
  })
})

describe('a part of an event that will not arrive', () => {
  it('says so where the race has been run', async () => {
    broken()
    renderAt(`/sr/kalendar/${RAN}`, 'competitor', '000007', undefined, BEFORE)

    expect(await screen.findAllByRole('alert')).toHaveLength(PARTS.length)
  })

  it('says nothing where the race has not been run', async () => {
    broken()
    renderAt(`/sr/kalendar/${AHEAD}`, 'competitor', '000007', undefined, BEFORE)

    await screen.findByRole('table', { name: 'Trke' })

    /* An alert about a section nobody was going to be shown is worse than the
       silence: it is the portal reporting a fault in something it had already
       decided not to draw. */
    expect(screen.queryByRole('alert')).toBeNull()

    for (const [, , heading] of PARTS) {
      expect(screen.queryByRole('heading', { name: heading })).toBeNull()
    }
  })
})
