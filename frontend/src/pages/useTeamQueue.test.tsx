import { act, renderHook } from '@testing-library/react'
import type { Dispatch, SetStateAction } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { serverThat } from '../test/serverAnswers'
import { useTeamQueue } from './useTeamQueue'

/**
 * WHAT THE HOOK WRITES AFTER THE SCREEN HAS GONE, COUNTED AT THE WRITE.
 *
 * <p>**Why the cases below cannot ask the hook's result.** After `unmount()` `result.current` is
 * frozen on the last render, so „the list is still what it was" is satisfied by the unmount
 * itself, whether or not the guard is there (measured: the guard in `read` and the one in
 * `readAgain` switched off, and the file stayed at 3 passed). And on the React this portal runs
 * a state set on an unmounted component draws nothing and warns of nothing, so there is no
 * screen to read it off either. The one place the write can be seen is the setter, so
 * `useState` is wrapped to note each call of a setter made once `gone` is true.
 *
 * <p>The wrapper hands back a setter of its own, stable like the real one, and changes nothing
 * about what it does. Only the modules of this portal see it: `react-dom` and the testing
 * library resolve their own copy of React and are not touched.
 */
const ledger = vi.hoisted(() => ({ gone: false, written: 0, writtenAfter: 0 }))

vi.mock('react', async (real) => {
  const actual = await real<typeof import('react')>()

  return {
    ...actual,
    useState: <S,>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>] => {
      const [value, set] = actual.useState(initial)
      const noted = actual.useCallback(
        (next: SetStateAction<S>) => {
          ledger.written += 1

          if (ledger.gone) {
            ledger.writtenAfter += 1
          }

          set(next)
        },
        [set],
      )

      return [value, noted]
    },
  }
})

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
  beforeEach(() => {
    ledger.gone = false
    ledger.written = 0
    ledger.writtenAfter = 0
  })

  it('sees a write while the screen is there, which is what makes a count of none worth reading', async () => {
    const { stop } = serverThat((path) =>
      path === '/api/teams/2/applications' || path === '/api/teams/2/invitations'
        ? new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
        : null,
    )

    try {
      renderHook(() => useTeamQueue(2))

      await vi.waitFor(() => {
        expect(ledger.written, 'a read that landed on a screen that is there').toBeGreaterThan(0)
      })
      expect(ledger.writtenAfter).toBe(0)
    } finally {
      stop()
    }
  })

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
      ledger.gone = true

      /* The read is let go AFTER the unmount so the order is the point rather than a race. */
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
      /* The part of this that can fail: the result above is frozen by the unmount and says the
         same with the guard gone. What the hook wrote after it left is counted at the setter. */
      expect(ledger.writtenAfter, 'a state was written after the screen had gone').toBe(0)
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
      ledger.gone = true

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
      expect(ledger.writtenAfter, 'a state was written after the screen had gone').toBe(0)
    } finally {
      stop()
    }
  })

  /**
   * TWO PRESSES THAT ARRIVE BEFORE A REDRAW ARE ONE ASKING, AND THE NEXT ONE AFTER IT IS ANOTHER.
   *
   * <p>`components/Unreadable.tsx` tells the button off while an asking is out, but it does it by
   * a render, and two presses fired before the render the first one causes both read the flag as
   * false. The guard that holds is the ref inside the hook, and no screen can fire a second press
   * in that gap, so this is the one place it is held: the screen's cases press once per redraw and
   * would pass with the ref gone.
   *
   * <p>The third press is the other half of the same guard. A ref that is never put back would
   * refuse every press for the rest of the page's life, and a screen that says „Pokusaj ponovo"
   * and then does nothing is worse than one that said nothing.
   */
  it('makes one asking of two presses before a redraw, and lets the next one in', async () => {
    const { asked, stop } = serverThat((path) =>
      path === '/api/teams/2/applications' || path === '/api/teams/2/invitations'
        ? new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
        : null,
    )
    const applicationReads = () =>
      asked.filter((one) => one.path === '/api/teams/2/applications').length

    try {
      const { result } = renderHook(() => useTeamQueue(2))

      await vi.waitFor(() => {
        expect(applicationReads(), 'the read the page makes by itself').toBe(1)
      })

      await act(async () => {
        const first = result.current.readAgain()
        const second = result.current.readAgain()

        await Promise.all([first, second])
      })

      expect(applicationReads(), 'two presses before a redraw are one asking').toBe(2)

      await act(async () => {
        await result.current.readAgain()
      })

      expect(applicationReads(), 'the next press after it is let in').toBe(3)
    } finally {
      stop()
    }
  })
})
