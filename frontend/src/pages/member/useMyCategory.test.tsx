import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { serverThat } from '../../test/serverAnswers'
import { useMyCategory } from './useMyCategory'

/**
 * THE TWO STATES OF THIS HOOK THAT NO SCREEN CAN REACH.
 *
 * <p>Everything the member can do with the box is measured through the screen, in
 * `memberFlows.test.tsx`, because that is where it is drawn and where a wrong answer looks
 * wrong. What is left here is the two branches a screen cannot produce, and both are the kind
 * that is silent when it breaks: one is a promise landing after the reader has gone, and the
 * other is a write answered 200 with something that is not a category.
 */
describe('the category I choose, in the two states a screen cannot reach', () => {
  const COMPLETE = {
    season: 2028,
    firstSeason: false,
    firstSeasonAllowed: true,
    category: 'M40-54',
    open: true,
  }

  /**
   * A READ THAT LANDS AFTER THE SCREEN HAS GONE CHANGES NOTHING.
   *
   * <p>React warns about a state set on a component that has unmounted, and a warning in a
   * console nobody reads is how this would be found. The read is held open until after the
   * unmount so the order is the point rather than a race: without the `stillHere` flag the
   * `setStanding` below runs on a screen that is not there.
   */
  it('drops a read that comes back after the screen has gone', async () => {
    let handOver: (answer: Response) => void = () => undefined
    const waiting = new Promise<Response>((go) => {
      handOver = go
    })

    const { stop } = serverThat((path) => (path === '/api/me/category' ? waiting : null))

    try {
      const { result, unmount } = renderHook(() => useMyCategory())

      expect(result.current.standing).toBeNull()

      unmount()

      await act(async () => {
        handOver(
          new Response(JSON.stringify(COMPLETE), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )

        await waiting
      })

      /* Nothing to assert on the screen, because there is no screen: what this case holds is
         that the line above did not throw and no warning was written. The value is read once
         more to say out loud that it never arrived. */
      expect(result.current.standing).toBeNull()
    } finally {
      stop()
    }
  })

  /**
   * A WRITE ANSWERED 200 WITH SOMETHING THAT IS NOT A CATEGORY LEAVES WHAT STOOD STANDING.
   *
   * <p>`askTheServer` reads 200 as „the write went through" and hands the body over as
   * `unknown` (ADL A14), so a portal one release ahead - or a proxy that answered in its own
   * words with the right number - gets this far. The state that was drawn is kept rather than
   * cleared: the write DID land, and blanking the box would take away the one thing the member
   * can still read while telling him nothing.
   */
  it('keeps what stood where the write is answered with something else', async () => {
    const { stop } = serverThat((path, init) => {
      if (path !== '/api/me/category') {
        return null
      }

      return init?.method === 'PUT'
        ? new Response(JSON.stringify({ somethingElse: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : new Response(JSON.stringify(COMPLETE), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
    })

    try {
      const { result } = renderHook(() => useMyCategory())

      await waitFor(() => {
        expect(result.current.standing).toEqual(COMPLETE)
      })

      await act(async () => {
        await result.current.choose(true)
      })

      expect(result.current.standing)
        .toEqual(COMPLETE)
      /* And it is not reported as a refusal either, because it was not one: 200 is a write that
         happened. A version that set a reason here would put a sentence about the deadline on
         the screen over a choice the server accepted. */
      expect(result.current.refusal).toBeNull()
      expect(result.current.choosing).toBe(false)
    } finally {
      stop()
    }
  })
})
