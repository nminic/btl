import { act, configure, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { serverThat } from '../../test/serverAnswers'
import { whereItWrote } from '../../test/sent'
import { SLOW } from '../../test/slow'
import { setupUser, type Pressing } from '../../test/user'

/**
 * THE CELL THE READER PRESSED ENTER IN IS STILL THE CELL WHEN THE PRESS HAS MADE ITS ROW (PENDING 29316,
 * review of PR 489, found on `main` at `6a15e071`; WCAG 2.2 SC 2.4.3).
 *
 * <p>A row of races that has not been written has no identity, and the press that writes it hands one
 * back onto the row (`AdminEvents.tsx`, `writeTheRaces`). The fieldset of the row, and each field in it,
 * were keyed by that identity, so the key changed in the middle of the press, React took the whole race
 * out and drew it again, and the box the reader was typing in left the document with the save still
 * out. The focus fell to the document and the next Tab started the page from the top. Both forms whose
 * press makes the races it writes are asked: a copy, whose rows are all new, and a new event.
 *
 * <p><b>The write is held and answered one at a time</b>, because the last answer closes the form and
 * there is then no box to ask about: the moment that matters is after the answer that gives the FIRST
 * row its identity and before the one that gives the second its own.
 *
 * <p><b>The element is compared, not the label.</b> A box drawn again carries the same name, so a case
 * that asked for the control by its name would find the new one and pass over a race that had been
 * replaced; `toBe` on the very node the reader stood on is what tells the two apart. <b>And the row he
 * is in is the FIRST of two</b>: its identity arrives while the second is still out, so a key that fell
 * back on the place of a row, or on the last one written, is told from the right one.
 */

/* Every wait is given half of what a case is given (`saveWhileSaving.test.tsx` says why): a mutation
   then fails on its assertion and not on the clock of the case. */
configure({ asyncUtilTimeout: SLOW / 2 })

const THE_LIST = '/sr/administracija/dogadjaji'

/** Event 32, a race with two races of a length of its own, opened as a copy. */
const THE_COPY = `${THE_LIST}?kopija=32`

/** A write that is out: where it went, what it carried, and the way to answer it. */
type Out = { path: string; init: RequestInit | undefined; done: (one: Response) => void }

describe('the box of a race the reader pressed Enter in, while the press makes that race', () => {
  let watching: ReturnType<typeof serverThat>
  let out: Out[]
  let harness: typeof fetch

  beforeEach(() => {
    out = []
    harness = globalThis.fetch
    watching = serverThat((path, init) => {
      const how = init?.method ?? 'GET'
      const ofAnEvent =
        path === '/api/events' ||
        path.startsWith('/api/events/') ||
        path === '/api/races' ||
        path.startsWith('/api/races/')

      if (how === 'GET' || !ofAnEvent) {
        return null
      }

      return new Promise<Response>((done) => {
        out.push({ path, init, done })
      })
    })
  })

  afterEach(() => {
    watching.stop()
  })

  /** Answers the oldest write that is out the way the portal's own route would, and waits for the
   *  next one, which the press makes straight away. */
  async function answer(): Promise<void> {
    const head = must(out.shift(), 'a write is out')
    const said = await harness(head.path, head.init)

    await act(async () => {
      head.done(said)
    })
    await waitFor(() => {
      expect(out).toHaveLength(1)
    })
    /* The render the answer caused, which is the one that would take the box out of the page. */
    await act(async () => {})
  }

  /** Presses Enter in the box and waits until the first write of the press is out. */
  async function pressEnterIn(user: Pressing, box: HTMLElement): Promise<void> {
    await user.click(box)
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(out).toHaveLength(1)
    })
  }

  /** The event, then the first race: after this the first row has its identity and the second is out. */
  async function untilTheFirstRowIsMade(): Promise<void> {
    await answer()
    expect(whereItWrote(watching.asked)).toEqual(['POST /api/events', 'POST /api/races'])
    await answer()
    expect(whereItWrote(watching.asked)).toEqual(['POST /api/events', 'POST /api/races', 'POST /api/races'])
  }

  /** Lets the press finish, so that nothing is left out when the case ends. */
  async function untilTheEnd(): Promise<void> {
    const head = must(out.shift(), 'the last write is out')
    const said = await harness(head.path, head.init)

    await act(async () => {
      head.done(said)
    })
  }

  it('stays the box he is in, on the first row of a copy of two', async () => {
    const user = setupUser()

    renderAt(THE_COPY, 'superadmin', '000001')
    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    const first = must(screen.getAllByLabelText(/^Dužina/)[0], 'the length of the first race')

    await pressEnterIn(user, first)
    await untilTheFirstRowIsMade()

    expect(first.isConnected, 'the box was taken out of the page by the press that saved its row').toBe(true)
    expect(document.activeElement, 'the focus left the box').toBe(first)

    await untilTheEnd()
  }, SLOW)

  it('stays the box he is in, on the first row of a new event of two', async () => {
    const user = setupUser()

    renderAt(THE_LIST, 'superadmin', '000001')
    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
    await user.type(screen.getByLabelText(/^Naziv događaja/), 'BBKT fokus')
    await user.type(screen.getByLabelText(/^Datum/), '10012027')
    await user.type(screen.getByLabelText(/^Mesto/), 'Niš')
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))

    const [first, second] = screen.getAllByLabelText(/^Dužina/)

    await user.type(must(first, 'the length of the first race'), '10')
    await user.type(must(second, 'the length of the second race'), '5')
    await pressEnterIn(user, must(first, 'the length of the first race'))
    await untilTheFirstRowIsMade()

    expect(first?.isConnected, 'the box was taken out of the page by the press that saved its row').toBe(true)
    expect(document.activeElement, 'the focus left the box').toBe(first)

    await untilTheEnd()
  }, SLOW)
})
