import { act, configure, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { aServerThatAnswersWhenTold } from '../../test/hisPage'
import { SLOW } from '../../test/slow'
import { useMyMailLanguage } from './useMyMailLanguage'

/**
 * THE LANGUAGE OF THE MAIL, ASKED FOR BY THE ACCOUNT THAT IS READING (JM-B).
 *
 * <p>The shape is `useMyData`'s and so are its three guards: an answer is held by whoever it was
 * asked for, an answer that arrives after the reader has gone is not drawn, and a failed read can be
 * asked again. Every wait is given half of the time a case has, so a wait that never succeeds ends
 * the case in an assertion and not in its own clock.
 */
configure({ asyncUtilTimeout: SLOW / 2 })

let stop: (() => void) | null = null

afterEach(() => {
  stop?.()
  stop = null
})

function theServer() {
  const server = aServerThatAnswersWhenTold()

  stop = server.stop

  return server
}

const saying = (language: unknown): Response =>
  new Response(JSON.stringify({ role: 'moderator', account: 1, mailLanguage: language }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

describe('the language of the mail of the account that is reading', () => {
  it('is loading until the server answers, and then the language it says', async () => {
    const server = theServer()
    const { result } = renderHook(() => useMyMailLanguage('7'))

    expect(result.current).toEqual({ status: 'loading' })
    await waitFor(() => {
      expect(server.count()).toBe(1)
    })

    await act(async () => {
      server.answer(0, saying('en'))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', data: 'en' })
    })
  }, SLOW)

  it.each([
    ['a language the portal does not write', () => saying('de')],
    ['no language in the answer', () => saying(undefined)],
    ['the server refuses', () => new Response(null, { status: 401 })],
    ['the server cannot be reached', () => new Error('nema veze')],
  ])('is a failed read, with the way to ask again, when %s', async (_what, theAnswer) => {
    const server = theServer()
    const { result } = renderHook(() => useMyMailLanguage('7'))

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    await act(async () => {
      server.answer(0, theAnswer())
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
    expect(result.current).toMatchObject({ status: 'error', reading: false })
    expect(result.current).toHaveProperty('readAgain')
  }, SLOW)

  it('says it is asking again, and is the language when the second asking works', async () => {
    const server = theServer()
    const { result } = renderHook(() => useMyMailLanguage('7'))

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    await act(async () => {
      server.answer(0, new Response(null, { status: 500 }))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })

    act(() => {
      if (result.current.status === 'error') {
        result.current.readAgain()
      }
    })

    await waitFor(() => {
      expect(server.count()).toBe(2)
    })
    expect(result.current).toMatchObject({ status: 'error', reading: true })

    await act(async () => {
      server.answer(1, saying('sr'))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', data: 'sr' })
    })
  }, SLOW)

  it('is not an answer that was asked for somebody else', async () => {
    const server = theServer()
    const { result, rerender } = renderHook(({ reader }) => useMyMailLanguage(reader), {
      initialProps: { reader: '7' },
    })

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    await act(async () => {
      server.answer(0, saying('en'))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', data: 'en' })
    })

    rerender({ reader: '8' })

    /* The first man's language is not the second's: he is shown the loader, and his own answer is
       asked for. */
    expect(result.current).toEqual({ status: 'loading' })
    await waitFor(() => {
      expect(server.count()).toBe(2)
    })

    await act(async () => {
      server.answer(1, saying('sr'))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', data: 'sr' })
    })
  }, SLOW)

  it('does not draw an answer that arrives after the reader was replaced', async () => {
    const server = theServer()
    const { result, rerender } = renderHook(({ reader }) => useMyMailLanguage(reader), {
      initialProps: { reader: '7' },
    })

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })

    rerender({ reader: '8' })
    await waitFor(() => {
      expect(server.count()).toBe(2)
    })

    /* The first asking is answered LAST, with the first man's language. */
    await act(async () => {
      server.answer(1, saying('sr'))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', data: 'sr' })
    })

    await act(async () => {
      server.answer(0, saying('en'))
      await Promise.resolve()
    })

    expect(result.current).toEqual({ status: 'ready', data: 'sr' })
  }, SLOW)
})
