import { act, configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { clearResourceCache } from '../data/client'
import { fakeQueue } from '../test/fakeQueue'
import served from '../test/mock/verification.json'
import { renderAt } from '../test/render'
import sr from '../i18n/sr.json'
import { translate } from '../i18n/translate'
import { QUEUE } from '../pages/admin/queues'
import { serverThat, type Asked } from '../test/serverAnswers'
import { SLOW } from '../test/slow'
import { typeATownTheCodebookKnows } from '../test/town'
import { setupUser } from '../test/user'

/**
 * THE NUMBER BESIDE „ADMINISTRACIJA" FOLLOWS THE QUEUE IT COUNTS (PENDING 29561, from the review of
 * the change that made the queue drop after a member's own write).
 *
 * <p><b>The fault, measured on 19.10.2026 and written down by the review.</b> The shell stays
 * mounted from screen to screen, so the counter in the header reads `verification` once, when the
 * moderator arrives, and keeps what it read. A write that queues a row (a comment, a proposed team,
 * a picture) drops the answer from the cache once the server has taken it, and dropping says
 * nothing to a component that already holds the answer it was given: the header read „15" before
 * and after, while the card of the tab beside it went from three to four. That is the one thing
 * `Shell` says cannot happen, that the number over every screen and the column beside the work
 * disagree.
 *
 * <p><b>The axes, each stood on both sides.</b> What changed on the server: a row added (up) and
 * rows taken away (down), so a counter that only ever grows is told apart. WHICH name was dropped:
 * `verification`, which the counter follows, and another name, which it must not read again for
 * (the readers of every other name are as they were, `data/useResource.ts`). Where the drop came
 * from: a real write (a team proposed through the form) and the drop alone.
 */

/* Every wait is given less time than a case has, so a counter that never moves fails on its own
   assertion and not on the clock of the case, which says nothing about what was wrong. */
configure({ asyncUtilTimeout: SLOW / 2 })

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

const DAY = '2026-10-15'

/** The number the header link says is waiting, out of its accessible name. */
async function headerCount(): Promise<number> {
  const link = await screen.findByRole('link', { name: /^Administracija, \d+ na čekanju$/ })
  const said = /(\d+) na čekanju$/.exec(link.getAttribute('aria-label') ?? '')

  return Number(said?.[1])
}

/** The number beside the queue of the new teams in the navigation, which the section counts off the
 *  same answer and draws as a digit that a reader hears in words. */
async function tabCount(): Promise<number> {
  const nav = within(await screen.findByRole('navigation', { name: 'Odeljak Verifikacija' }))
  const link = nav.getByRole('link', { name: new RegExp(`^${translate(sr, 'sr', QUEUE.teams.labelKey)}, `) })

  return Number((link.textContent ?? '').replace(/\D/g, ''))
}

/** How many times the server was asked for the queue. */
function timesAskedForTheQueue(asked: Asked[]): number {
  return asked.filter((one) => one.path === '/api/verification').length
}

describe('the counter in the header', () => {
  it('counts a team the same member proposed, without a reload', async () => {
    /* A REAL WRITE and not the drop alone: the proposal goes through the form to the stand-in for
       `TeamWriteApi`, which puts a card on the queue, and the header is read before and after. The
       header never leaves the document in between. */
    const queue = fakeQueue()

    stops.push(queue.stop)

    const user = setupUser()
    const { router } = renderAt('/sr/administracija/verifikacija/timovi', 'superadmin', '000002', undefined, DAY)
    const before = await headerCount()

    await router.navigate('/sr/novi-tim')
    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await typeATownTheCodebookKnows(user, 'Čačak', 'RS')
    await user.type(screen.getByLabelText(/Zašto ovaj tim/), 'Trčimo zajedno već tri godine.')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    await waitFor(async () => {
      expect(await headerCount()).toBe(before + 1)
    })
  }, SLOW)

  it('follows the queue down as well as up', async () => {
    /* The server stops serving every card of one queue, and drops are the only thing that tells the
       header: a counter that grew by one on every drop would pass the case above and fail this. */
    let gone = false
    const teams = served.filter((one) => one.queue === 'teams')

    expect(teams.length, 'the generated queue holds no teams, so nothing is measured').toBeGreaterThan(0)

    const server = serverThat((path) =>
      path === '/api/verification'
        ? new Response(JSON.stringify(gone ? served.filter((one) => one.queue !== 'teams') : served), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : null,
    )

    stops.push(server.stop)

    renderAt('/sr/administracija/verifikacija/rezultati', 'superadmin', '000002', undefined, DAY)

    const before = await headerCount()
    const tabBefore = await tabCount()

    expect(tabBefore, 'the navigation counts no teams, so nothing is measured').toBe(teams.length)

    gone = true
    act(() => {
      clearResourceCache('verification')
    })

    /* The header AND the number beside the queue in the navigation: both stand beside the outlet
       and neither is unmounted, and they are counted off one answer. */
    await waitFor(async () => {
      expect(await headerCount()).toBe(before - teams.length)
    })
    await waitFor(async () => {
      expect(await tabCount()).toBe(0)
    })
  }, SLOW)

  it('reads the queue again for a drop of the queue and for no other name', async () => {
    const server = serverThat(() => null)

    stops.push(server.stop)

    renderAt('/sr/administracija/verifikacija/rezultati', 'superadmin', '000002', undefined, DAY)
    await headerCount()

    const held = timesAskedForTheQueue(server.asked)

    expect(held, 'the queue was never asked for, so nothing is measured').toBeGreaterThan(0)

    act(() => {
      clearResourceCache('places')
    })
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(timesAskedForTheQueue(server.asked), 'a name the counter does not read made it ask').toBe(held)

    act(() => {
      clearResourceCache('verification')
    })

    await waitFor(() => {
      expect(timesAskedForTheQueue(server.asked)).toBe(held + 1)
    })

    /* And a full clear, which is how the tests start a visit and how nothing in production drops: it
       drops the queue as well, and a counter that did not hear of it would hold the old number. */
    act(() => {
      clearResourceCache()
    })

    await waitFor(() => {
      expect(timesAskedForTheQueue(server.asked)).toBe(held + 2)
    })
  }, SLOW)
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
