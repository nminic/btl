import { act, configure, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { aServerThatAnswersWhenTold } from '../../test/hisPage'
import { SLOW } from '../../test/slow'
import { myOwnRecordFromMe } from '../../test/theAnswer'
import { useMyWaitingText } from './useMyWaitingText'

/**
 * THE WORDS OF A MEMBER'S OWN THAT WAIT FOR A MODERATOR, as a hook (PDL P11, owner, 18.10.2026: „Dok
 * tekst o sebi čeka odobrenje, član ga vidi u Podešavanjima sa oznakom da čeka").
 *
 * <p>The same arrangement as `useMyData.test.tsx` and for the same reason: an answer is believed for
 * the member it was asked under and for no other, and the reader can change inside one visit (a
 * shared laptop at a race). A hook that held the words of the first man under a key every member
 * shares would draw them in the second man's box, as a text of his that waits, and the screen above
 * it, which is keyed by the member and so remounts, would never show the fault: only the hook can.
 */
configure({ asyncUtilTimeout: SLOW / 2 })

let stop: (() => void) | null = null

afterEach(() => {
  stop?.()
  stop = null
})

/** `GET /api/me` for a member whose words wait as given, or whose words do not wait at all. */
function saying(waiting: string | null): Response {
  const { bioWaiting: _template, ...withoutTheTemplatesOwn } = myOwnRecordFromMe

  return new Response(
    JSON.stringify({
      role: 'competitor',
      account: 1,
      member: { ...withoutTheTemplatesOwn, ...(waiting === null ? {} : { bioWaiting: waiting }) },
      mailLanguage: 'sr',
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

function theServer() {
  const server = aServerThatAnswersWhenTold()

  stop = server.stop

  return server
}

describe('the words of his that wait', () => {
  it('are loading until the server answers, and then the words it said', async () => {
    const server = theServer()
    const { result } = renderHook(() => useMyWaitingText('000001'))

    expect(result.current.status).toBe('loading')
    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    await act(async () => {
      server.answer(0, saying('Reči koje čekaju.'))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', data: 'Reči koje čekaju.' })
    })
  }, SLOW)

  it('are the empty box where the server says none wait', async () => {
    const server = theServer()
    const { result } = renderHook(() => useMyWaitingText('000001'))

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    await act(async () => {
      server.answer(0, saying(null))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', data: '' })
    })
  }, SLOW)

  it('are a failed read that can be asked again when the server refuses', async () => {
    const server = theServer()
    const { result } = renderHook(() => useMyWaitingText('000001'))

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    await act(async () => {
      server.answer(0, new Response(null, { status: 401 }))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
    expect(result.current).toHaveProperty('readAgain')
  }, SLOW)

  it("are not the first reader's under the second one's number while his answer is on its way", async () => {
    const server = theServer()
    const { result, rerender } = renderHook(({ asked }) => useMyWaitingText(asked), {
      initialProps: { asked: '000001' },
    })

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    await act(async () => {
      server.answer(0, saying('Reči prvog člana.'))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', data: 'Reči prvog člana.' })
    })

    /* HELD, and the reader changes. What the hook says until the second answer comes is that it is
       waiting, and not the first man's words, which is what a hook that kept its answer under a key
       every member shares would hand the screen. */
    rerender({ asked: '000002' })
    expect(result.current.status).toBe('loading')
  }, SLOW)

  it("drops the answer of the reader who has gone, which comes last", async () => {
    const server = theServer()
    const { result, rerender } = renderHook(({ asked }) => useMyWaitingText(asked), {
      initialProps: { asked: '000001' },
    })

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    rerender({ asked: '000002' })
    await waitFor(() => {
      expect(server.count()).toBe(2)
    })

    await act(async () => {
      server.answer(1, saying(null))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', data: '' })
    })

    await act(async () => {
      server.answer(0, saying('Reči prvog člana.'))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current).toEqual({ status: 'ready', data: '' })
  }, SLOW)
})
