import { act, configure, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { answeringBook, serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { useMyBalance } from './useMyBalance'

/**
 * THE BOOK, AS A HOOK: held for the reader it was asked under and for no other, the arrangement
 * `useMyWaitingText.test.tsx` measures for the same reason. A reader can change inside one visit (a
 * shared laptop at a race), and the first man's balance must not be drawn as the second man's.
 */
configure({ asyncUtilTimeout: SLOW / 2 })

let stop: (() => void) | null = null

afterEach(() => {
  stop?.()
  stop = null
})

/** The book's route, each request of which waits to be answered by its number. */
function theServer() {
  const pending: ((answer: Response) => void)[] = []

  const { stop: putBack } = serverThat((path) =>
    path === '/api/me/membership'
      ? new Promise<Response>((resolve) => {
          pending.push(resolve)
        })
      : null,
  )

  stop = putBack

  return {
    count: () => pending.length,
    answer: (which: number, response: Response) => {
      const waiting = pending[which]

      if (waiting === undefined) {
        throw new Error(`nothing was asked at /api/me/membership as number ${which}`)
      }

      waiting(response)
    },
  }
}

describe('the book of a member', () => {
  it('is loading until the server answers, and then the money it said', async () => {
    const server = theServer()
    const { result } = renderHook(() => useMyBalance('000001'))

    expect(result.current.status).toBe('loading')
    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    await act(async () => {
      server.answer(0, answeringBook({ amount: 600, currency: 'RSD' }))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', data: { amount: 600, currency: 'RSD' } })
    })
  }, SLOW)

  it('is a failed read, not a nought, where the server would not say', async () => {
    const server = theServer()
    const { result } = renderHook(() => useMyBalance('000001'))

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    await act(async () => {
      server.answer(0, new Response(null, { status: 404 }))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
  }, SLOW)

  it("is not the first reader's under the second one's number while his answer is on its way", async () => {
    const server = theServer()
    const { result, rerender } = renderHook(({ asked }) => useMyBalance(asked), {
      initialProps: { asked: '000001' },
    })

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    await act(async () => {
      server.answer(0, answeringBook({ amount: 600, currency: 'RSD' }))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    rerender({ asked: '000002' })
    expect(result.current.status).toBe('loading')
  }, SLOW)
})
