import { act, configure, getConfig, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { aServerThatAnswersWhenTold } from '../../test/hisPage'
import { aNeverPaidRecord } from '../../test/neverPaid'
import { SLOW } from '../../test/slow'
import { useMyData } from './useMyData'

/**
 * THE DATA OF SOMEBODY WHO HAS REGISTERED AND HAS NOT PAID, as a hook: the three things it can be,
 * and the one it must never be.
 *
 * <p>PDL P8, the entry „Šta sme neplaćen član" (10.10.2026, chosen by the owner between offered
 * outcomes; the sentence is the record's): he may change „svoje podatke za evidenciju i majicu".
 * The hook is handed the account the screen is drawn for and answers a state the portal's own
 * `Resource` draws: loading, the six facts, or a failed read that can be asked again. <b>The one it
 * must never be is somebody else's data</b>: the reader can change inside one visit, and an answer
 * is believed for the account it was asked under and for no other.
 *
 * <p>This is `pages/profile/useHisOwnRecord.test.tsx` for a person with no number, case for case
 * where the cases apply, and the server is stood in for the same way: one pending request at a
 * time (`test/hisPage.ts`, `aServerThatAnswersWhenTold`), because the order in which two answers
 * arrive is the thing two of these cases are about.
 */

/* EVERY WAIT OF THIS FILE IS GIVEN HALF OF THE TIME A CASE HAS, so that a wait which never succeeds
   ends the case with the assertion's own words and not with the case's clock (`pages/admin/
   saveWhileSaving.test.tsx` found the arrangement for itself). */
configure({ asyncUtilTimeout: SLOW / 2 })

let stop: (() => void) | null = null

afterEach(() => {
  stop?.()
  stop = null
})

/** An answer of somebody who registered and has not paid, with the record as given. */
function aNewcomerSaying(record: Record<string, unknown> = aNeverPaidRecord): Response {
  return new Response(JSON.stringify({ role: 'competitor', account: 1, member: record }), {
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

describe('his own data', () => {
  it('is loading until the server answers, and then the facts of the account it was asked for', async () => {
    const server = theServer()
    const { result } = renderHook(() => useMyData(7))

    expect(result.current.status).toBe('loading')
    await waitFor(() => {
      expect(server.count()).toBe(1)
    })

    await act(async () => {
      server.answer(0, aNewcomerSaying())
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(result.current).toEqual({
      status: 'ready',
      data: {
        firstName: 'Tek',
        lastName: 'Stigao',
        gender: 'M',
        city: 'Beograd',
        ageBand: '25-39',
        firstSeason2027: false,
        address: 'Ulica Nova 3',
        phone: '',
        country: 'RS',
        shirtSize: 'XL',
      },
    })
  }, SLOW)

  it.each([
    ['the answer has a record the portal cannot believe', () => aNewcomerSaying({ ...aNeverPaidRecord, gender: 'X' })],
    ['the answer has no record at all', () => new Response(JSON.stringify({ role: 'moderator', account: 1 }), { status: 200 })],
    ['the server refuses', () => new Response(null, { status: 401 })],
    ['the server cannot be reached', () => new Error('nema veze')],
  ])('is a failed read when %s, with the way to ask again', async (_what, theAnswer) => {
    const server = theServer()
    const { result } = renderHook(() => useMyData(7))

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

  it('says it is asking again, and is the data when the second asking works', async () => {
    const server = theServer()
    const { result } = renderHook(() => useMyData(7))

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
       and now saying so. The data has not come, so nothing is drawn from it. */
    await waitFor(() => {
      expect(server.count()).toBe(2)
    })
    expect(result.current).toMatchObject({ status: 'error', reading: true })

    await act(async () => {
      server.answer(1, aNewcomerSaying())
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
  }, SLOW)

  it('stops saying it is asking when the second asking fails as well', async () => {
    const server = theServer()
    const { result } = renderHook(() => useMyData(7))

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
      expect(result.current).toMatchObject({ status: 'error', reading: true })
    })

    await act(async () => {
      server.answer(1, new Response(null, { status: 500 }))
      await Promise.resolve()
    })

    /* Told off while the second asking was out, and asking again once it has failed too: a button
       that stayed told off after the answer would be one nobody can press, and the reader would be
       stuck on a screen that says it is trying and is not. */
    await waitFor(() => {
      expect(result.current).toMatchObject({ status: 'error', reading: false })
    })
  }, SLOW)

  it('reads another account as not here yet, and drops the answer of the one who has gone', async () => {
    const server = theServer()
    const { result, rerender } = renderHook(({ asked }) => useMyData(asked), {
      initialProps: { asked: 7 },
    })

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })

    /* The reader changes before the first answer has come. The new account is asked for, and until
       its answer comes the hook is loading and not the first reader's. */
    rerender({ asked: 8 })
    await waitFor(() => {
      expect(server.count()).toBe(2)
    })
    expect(result.current.status).toBe('loading')

    await act(async () => {
      server.answer(1, aNewcomerSaying({ ...aNeverPaidRecord, firstName: 'Ana' }))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current).toMatchObject({ status: 'ready', data: { firstName: 'Ana' } })
    })

    /* And the first reader's answer, which comes last. Believed, it would put his name under the
       second reader's account, or take the second reader's data away. It is dropped. */
    await act(async () => {
      server.answer(0, aNewcomerSaying())
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current).toMatchObject({ status: 'ready', data: { firstName: 'Ana' } })
  }, SLOW)

  it("does not draw the first reader's data under the second one's account while his answer is on its way", async () => {
    const server = theServer()
    const { result, rerender } = renderHook(({ asked }) => useMyData(asked), {
      initialProps: { asked: 7 },
    })

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    await act(async () => {
      server.answer(0, aNewcomerSaying())
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current).toMatchObject({ status: 'ready', data: { firstName: 'Tek' } })
    })

    /* The data of the first reader is HELD, and the reader changes. Until the second answer comes,
       what the hook says is that it is waiting - not the first man's data, which is what a hook that
       kept its answer without the account it was for would hand the screen. */
    rerender({ asked: 8 })
    expect(result.current.status).toBe('loading')
  }, SLOW)

  /* **A MEMBER IS ASKED FOR UNDER HIS NUMBER AND SOMEBODY WHO HAS NONE UNDER HIS ACCOUNT**
     (`Settings.tsx`, since 18.10.2026), and the two keys are never the same key: an account `7` and a
     member number `'7'` would be one reader if the hook compared them loosely, and the answer held for
     the first would be drawn under the second. */
  it('holds an answer against a member number, and never against an account that looks like it', async () => {
    const server = theServer()
    const { result, rerender } = renderHook<
      ReturnType<typeof useMyData>,
      { asked: number | string }
    >(({ asked }) => useMyData(asked), { initialProps: { asked: '7' } })

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    await act(async () => {
      server.answer(0, aNewcomerSaying())
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    rerender({ asked: 7 })
    expect(result.current.status).toBe('loading')
  }, SLOW)

  it('does nothing with an answer that comes after the screen is gone', async () => {
    const server = theServer()
    const { result, unmount } = renderHook(() => useMyData(7))

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    unmount()

    await act(async () => {
      server.answer(0, aNewcomerSaying())
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.status).toBe('loading')
  }, SLOW)
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    /* The floor under the paragraph at the head of the file, asked of the number that decides and
       not of the text of the file: take the `configure` away and both clocks are `SLOW` again. */
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
