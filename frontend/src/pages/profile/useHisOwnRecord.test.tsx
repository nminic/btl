import { act, configure, getConfig, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { aLapsedMembersPage, aServerThatAnswersWhenTold } from '../../test/hisPage'
import { SLOW } from '../../test/slow'
import { useHisOwnRecord } from './useHisOwnRecord'

/**
 * THE RECORD A MEMBER'S OWN PROFILE IS DRAWN FROM, as a hook: the four things it can be, and the
 * one it must never be.
 *
 * <p>PDL P8a, 25.09.2026, „Treba da moze da otvori svoj profil dokle god postoji". The hook is
 * handed the number on the page, which is also the reader's, and answers a state the portal's own
 * `Resource` draws: loading, the record, or a failed read that can be asked again. <b>The one it
 * must never be is another member's record</b>: the reader can change inside one visit, and an
 * answer is believed for the number it was asked for and for no other.
 *
 * <p>The server is stood in for by hand, one pending request at a time
 * (`test/hisPage.ts`, `aServerThatAnswersWhenTold`), because the order in which two answers arrive
 * is the thing two of these cases are about.
 */

/* EVERY WAIT OF THIS FILE IS GIVEN HALF OF THE TIME A CASE HAS, so that a wait which never succeeds ends
   the case with the assertion's own words and not with the case's clock. The global is `SLOW` for both
   (`test/setup.ts`): a mutation that leaves a screen undrawn would then end as `Test timed out` or as
   `Unable to find`, depending on which of two equal clocks ran out first, and a series of mutations
   that cannot tell the two apart counts a clock as a catch. The arrangement is the one
   `pages/admin/saveWhileSaving.test.tsx` found for itself, and it is set here for this file alone. */
configure({ asyncUtilTimeout: SLOW / 2 })

let stop: (() => void) | null = null

afterEach(() => {
  stop?.()
  stop = null
})

/** An answer of a member, said to be JSON, with `member` as given. */
function aMemberSaying(member: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ role: 'competitor', account: 1, member }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/** The stand-in server, with the way to put it back registered for the end of the case. */
function theServer() {
  const server = aServerThatAnswersWhenTold()

  stop = server.stop

  return server
}

describe('his own record', () => {
  it('is loading until the server answers, and then the record of the member it was asked for', async () => {
    const server = theServer()
    const { result } = renderHook(() => useHisOwnRecord('000032'))

    expect(result.current.status).toBe('loading')
    await waitFor(() => {
      expect(server.count()).toBe(1)
    })

    await act(async () => {
      server.answer(0, aMemberSaying(aLapsedMembersPage))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(result.current).toMatchObject({
      data: { memberNumber: '000032', firstName: 'Vojislav', lastName: 'Antonijević' },
    })
  }, SLOW)

  it.each([
    ['the answer names another member', () => aMemberSaying({ ...aLapsedMembersPage, memberNumber: '000040' })],
    ['the answer names nobody', () => new Response(JSON.stringify({ role: 'moderator', account: 1 }), { status: 200 })],
    ['the page is one the portal cannot believe', () => aMemberSaying({ ...aLapsedMembersPage, gender: 'X' })],
    ['the server refuses', () => new Response(null, { status: 401 })],
    ['the server cannot be reached', () => new Error('nema veze')],
  ])('is a failed read when %s, with the way to ask again', async (_what, theAnswer) => {
    const server = theServer()
    const { result } = renderHook(() => useHisOwnRecord('000032'))

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

  it('says it is asking again, and is the record when the second asking works', async () => {
    const server = theServer()
    const { result } = renderHook(() => useHisOwnRecord('000032'))

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

    /* Still the failed read while the second asking is out - the button is told off, not removed -
       and now saying so. The record has not come, so nothing is drawn from it. */
    await waitFor(() => {
      expect(server.count()).toBe(2)
    })
    expect(result.current).toMatchObject({ status: 'error', reading: true })

    await act(async () => {
      server.answer(1, aMemberSaying(aLapsedMembersPage))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
  }, SLOW)

  it('reads another member as not here yet, and drops the answer of the one who has gone', async () => {
    const server = theServer()
    const { result, rerender } = renderHook(({ asked }) => useHisOwnRecord(asked), {
      initialProps: { asked: '000032' },
    })

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })

    /* The reader changes before the first answer has come. The new number is asked for, and until
       its answer comes the hook is loading and not the first reader's. */
    rerender({ asked: '000040' })
    await waitFor(() => {
      expect(server.count()).toBe(2)
    })
    expect(result.current.status).toBe('loading')

    await act(async () => {
      server.answer(1, aMemberSaying({ ...aLapsedMembersPage, memberNumber: '000040', firstName: 'Ana' }))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current).toMatchObject({ status: 'ready', data: { memberNumber: '000040' } })
    })

    /* And the first reader's answer, which comes last. Believed, it would put his record under the
       second reader's number, or take the second reader's record away. It is dropped. */
    await act(async () => {
      server.answer(0, aMemberSaying(aLapsedMembersPage))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current).toMatchObject({ status: 'ready', data: { memberNumber: '000040', firstName: 'Ana' } })
  }, SLOW)

  it('does not draw the first reader\'s record under the second one\'s number while his answer is on its way', async () => {
    const server = theServer()
    const { result, rerender } = renderHook(({ asked }) => useHisOwnRecord(asked), {
      initialProps: { asked: '000032' },
    })

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    await act(async () => {
      server.answer(0, aMemberSaying(aLapsedMembersPage))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current).toMatchObject({ status: 'ready', data: { memberNumber: '000032' } })
    })

    /* The record of the first reader is HELD, and the reader changes. Until the second answer
       comes, what the hook says is that it is waiting - not the first man's record, which is
       what a hook that kept its answer without the number it was for would hand the screen. */
    rerender({ asked: '000040' })
    expect(result.current.status).toBe('loading')
  }, SLOW)

  it('does nothing with an answer that comes after the screen is gone', async () => {
    const server = theServer()
    const { result, unmount } = renderHook(() => useHisOwnRecord('000032'))

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    unmount()

    await act(async () => {
      server.answer(0, aMemberSaying(aLapsedMembersPage))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.status).toBe('loading')
  }, SLOW)
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    /* The floor under the paragraph at the head of the file, asked of the number that decides and not
       of the text of the file: take the `configure` away and both clocks are `SLOW` again. */
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
