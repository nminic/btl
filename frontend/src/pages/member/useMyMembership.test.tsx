import { act, configure, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { PaymentMethod } from '../../data/paymentQr'
import { anInvoice, answeringInvoice, serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { useMyMembership } from './useMyMembership'

/**
 * WHAT HE OWES, AS A HOOK: an answer is believed only for the season and the way to pay it was asked
 * under (PDL, decision of 25.10.2026, „ista rečenica kao kad iznos ne stigne"), so an answer held for
 * one season or one money is never handed out for another while it is asked again. The screen's own
 * cases (`whatHeSends.test.tsx`) never move the season or the way to pay inside one visit, so this is
 * where that half is held.
 */
configure({ asyncUtilTimeout: SLOW / 2 })

let stop: (() => void) | null = null

afterEach(() => {
  stop?.()
  stop = null
})

/** The route, each request of which waits to be answered by its number. */
function theServer() {
  const pending: ((answer: Response) => void)[] = []

  const { stop: putBack } = serverThat((path, init) =>
    path === '/api/me/membership' && init?.method === undefined
      ? new Promise<Response>((resolve) => {
          pending.push(resolve)
        })
      : null,
  )

  stop = putBack

  return {
    count: () => pending.length,
    answer: async (which: number, response: Response) => {
      const waiting = pending[which]

      if (waiting === undefined) {
        throw new Error(`nothing was asked at /api/me/membership as number ${which}`)
      }

      await act(async () => {
        waiting(response)
        await Promise.resolve()
      })
    },
  }
}

type Asked = { season: number; methods: PaymentMethod[] }

describe('what he owes', () => {
  it('is asked again, and nothing is handed out meanwhile, when the season on sale moves', async () => {
    const server = theServer()
    const { result, rerender } = renderHook(({ season, methods }: Asked) => useMyMembership('000032', season, methods), {
      initialProps: { season: 2027, methods: ['ips'] },
    })

    await waitFor(() => expect(server.count()).toBe(1))
    await server.answer(0, answeringInvoice(anInvoice(2027, 'RSD')))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender({ season: 2028, methods: ['ips'] })
    expect(result.current.status).toBe('loading')

    await waitFor(() => expect(server.count()).toBe(2))
    await server.answer(1, answeringInvoice(anInvoice(2028, 'RSD')))
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ready', data: { season: 2028 } }))
  }, SLOW)

  it('is asked again, and nothing is handed out meanwhile, when the way he pays moves', async () => {
    const server = theServer()
    const { result, rerender } = renderHook(({ season, methods }: Asked) => useMyMembership('000032', season, methods), {
      initialProps: { season: 2027, methods: ['ips'] },
    })

    await waitFor(() => expect(server.count()).toBe(1))
    await server.answer(0, answeringInvoice(anInvoice(2027, 'RSD')))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender({ season: 2027, methods: ['paypal'] })
    expect(result.current.status).toBe('loading')

    await waitFor(() => expect(server.count()).toBe(2))
    await server.answer(1, answeringInvoice(anInvoice(2027, 'EUR')))
    await waitFor(() =>
      expect(result.current).toMatchObject({ status: 'ready', data: { toTransfer: { currency: 'EUR' } } }),
    )
  }, SLOW)

  /* The caller hands in a new array on every render; asking again for each would be a read on every
     render, and the read writes the promise of the season on the server. */
  it('is not asked again for the same ways to pay handed in as a new array', async () => {
    const server = theServer()
    const { result, rerender } = renderHook(({ season, methods }: Asked) => useMyMembership('000032', season, methods), {
      initialProps: { season: 2027, methods: ['ips'] },
    })

    await waitFor(() => expect(server.count()).toBe(1))
    await server.answer(0, answeringInvoice(anInvoice(2027, 'RSD')))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender({ season: 2027, methods: ['ips'] })
    rerender({ season: 2027, methods: ['ips'] })
    /* Long enough for a read the renders started to have reached the server. */
    await act(async () => {
      await new Promise((settled) => setTimeout(settled, 100))
    })

    expect(result.current.status).toBe('ready')
    expect(server.count()).toBe(1)
  }, SLOW)
})
