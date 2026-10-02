import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { serverThat } from '../test/serverAnswers'
import { useTeamQueue } from './useTeamQueue'

/**
 * THE ONE STATE OF THIS HOOK THAT NO SCREEN CAN REACH.
 *
 * <p>Everything a team sees and presses is measured through the screen it is drawn on
 * (`pages/teamQueueOnTheServer.test.tsx`), because that is where a wrong answer looks wrong.
 * What is left here is the branch a screen cannot produce, and it is the kind that is silent
 * when it breaks: a read landing after the reader has gone.
 *
 * <p>The shape is `member/useMyCategory.test.tsx`'s, for the same branch and the same reason.
 */
describe('the team queue, in the state a screen cannot reach', () => {
  it('drops a read that comes back after the screen has gone', async () => {
    let handOver: (answer: Response) => void = () => undefined
    const waiting = new Promise<Response>((go) => {
      handOver = go
    })

    /* Only the applications are held, so that the pair really is settled by the unmount rather
       than by both halves happening to arrive late. */
    const { stop } = serverThat((path) => {
      if (path === '/api/teams/2/applications') {
        return waiting
      }

      return path === '/api/teams/2/invitations'
        ? new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
        : null
    })

    try {
      const { result, unmount } = renderHook(() => useTeamQueue(2))

      expect(result.current.applications).toEqual({ got: 'rows', rows: [] })

      unmount()

      /* React warns about a state set on a component that has unmounted, and a warning in a
         console nobody reads is how this would be found. The read is let go AFTER the unmount
         so the order is the point rather than a race. */
      await act(async () => {
        handOver(
          new Response(JSON.stringify([{ id: 41, memberNumber: '000004', date: '2026-05-02' }]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )

        await waiting
      })

      expect(result.current.applications).toEqual({ got: 'rows', rows: [] })
    } finally {
      stop()
    }
  })

  /**
   * THE SAME BRANCH ON THE OTHER WAY INTO A READ: asking again.
   *
   * <p>`readAgain` is what „Pokusaj ponovo" calls, and it sets a flag of its own around the read
   * (`reading`), so it has a second landing that the first read does not: the flag is cleared
   * after the read comes back, and a flag cleared on a screen that has gone is a state set on
   * nothing. The read is let go AFTER the unmount, so the order is the point and not a race.
   */
  it('drops the end of an asking again that lands after the screen has gone', async () => {
    let handOver: (answer: Response) => void = () => undefined
    const waiting = new Promise<Response>((go) => {
      handOver = go
    })
    let asked = 0

    const { stop } = serverThat((path) => {
      if (path === '/api/teams/2/applications') {
        asked += 1

        /* The first read answers at once, so the hook is settled and there is something to ask
           again about; the second is the one held. */
        return asked === 1 ? new Response(null, { status: 500 }) : waiting
      }

      return path === '/api/teams/2/invitations'
        ? new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
        : null
    })

    try {
      const { result, unmount } = renderHook(() => useTeamQueue(2))

      await act(async () => {
        await Promise.resolve()
      })
      await vi.waitFor(() => {
        expect(result.current.applications).toEqual({ got: 'unreadable' })
      })

      await act(async () => {
        void result.current.readAgain()
        await Promise.resolve()
      })

      expect(result.current.reading, 'asking again is out').toBe(true)

      unmount()

      await act(async () => {
        handOver(
          new Response(JSON.stringify([{ id: 41, memberNumber: '000004', date: '2026-05-02' }]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )

        await waiting
      })

      /* Nothing was written after the unmount: the flag still says what it said when the reader
         left, and the list is still what it was. */
      expect(result.current.reading).toBe(true)
      expect(result.current.applications).toEqual({ got: 'unreadable' })
    } finally {
      stop()
    }
  })
})
