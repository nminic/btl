import { act, screen } from '@testing-library/react'
import type { RouteObject } from 'react-router'
import { routeObjects } from '../../app/routeObjects'
import sr from '../../i18n/sr.json'
import { HOW_LONG_THE_DOOR_WAITS } from '../../session/useTheServersSession'
import { expectFrontPage, renderAt } from '../../test/render'
import { serverThat } from '../../test/serverAnswers'
import { NEEDS } from './needs'

/**
 * THE MOMENT BEFORE THE SERVER HAS SAID WHO IS READING, WHICH NO CASE ON THE PORTAL
 * USED TO HAVE.
 *
 * <p><b>The fault this file was written for, measured in the built portal by the owner
 * on 29.09.2026.</b> Loading any address under `/administracija` from cold - a new tab,
 * `F5`, a bookmark - threw the SUPERADMIN out onto the front page, against a server that
 * answered, at 0,4 s, 1,2 s and 3 s. So it was never a race that waiting could win.
 *
 * <p><b>Why it is certain rather than likely.</b> `app/App.tsx` mounts `RoleProvider`
 * with no prop at all, so in production the role at first paint is always the one
 * `roles/RoleProvider.tsx` defaults to, which is the visitor. The door decides while it
 * is drawing (`Guard.tsx`), and the answer to `GET /api/me` arrives in the continuation
 * of an effect (`session/useTheServersSession.ts`). By the time it lands the reader is
 * already outside.
 *
 * <p><b>And why no case saw it, which is a boundary of the fixture rather than a hole in
 * the coverage.</b> `test/render.tsx` renders every case with the role already known, so
 * the moment in which it is not known did not exist to be measured. These cases make it
 * exist the way the portal's own precedent says to - by putting a server in front whose
 * answer HAS NOT COME BACK YET, which is what `serverThat` is documented to be for - and
 * they render as `visitor`, which is what production's first paint really is. Nothing in
 * `test/render.tsx` is changed for them, because 1298 calls stand on it.
 *
 * <p><b>The decision they hold</b> (owner, 29.09.2026, chosen between three offered
 * outcomes): the door does not redirect until the server has answered who is reading,
 * and the price accepted for it is a short moment with a loading indicator instead of
 * the screen.
 */

/** A `GET /api/me` that has not come back, and the way to make it come back. */
function anAnswerThatHasNotArrived(): {
  arrivesAs: (body: unknown, status?: number) => Promise<void>
  stop: () => void
} {
  let deliver: (answer: Response) => void = () => undefined
  const waiting = new Promise<Response>((resolve) => {
    deliver = resolve
  })

  /* Everything else goes on to the disc reader exactly as it did, which is what the
     `?? disc(...)` inside `serverThat` is for: replacing the whole of `fetch` would
     leave every screen inside the shell empty, and that is a different fault reported
     as this one. */
  const { stop } = serverThat((path) => (path === '/api/me' ? waiting : null))

  return {
    arrivesAs: async (body: unknown, status = 200) => {
      deliver(
        new Response(status === 200 ? JSON.stringify(body) : null, {
          status,
          headers: status === 200 ? { 'content-type': 'application/json' } : undefined,
        }),
      )

      /* Two turns of the microtask queue: one for `fetch` to settle, one for the body.
         Written out rather than hidden in a helper, because a case that waits for the
         wrong number of them measures the moment BEFORE the answer while believing it
         measures the moment after. */
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
    },
    stop,
  }
}

/** What the server says about somebody it has let in. The shape `MeApi` really sends,
 *  and no more of it than every case here reads. */
function said(role: string): Record<string, unknown> {
  return { role, account: 1, member: null }
}

/**
 * The announced places on the page that are saying „waiting" this instant.
 *
 * <p>Both halves matter. The ROLE, because an indicator a screen reader never reads out
 * is the thing WCAG 2.2 asks for and the thing a hand-written spinner would quietly drop.
 * The WORD, because `app/Shell.tsx` keeps a second `role="status"` over every screen for
 * the name of the page, and a count that included it would be one whatever the door did.
 *
 * <p>The word is read out of the dictionary rather than spelt here, so this stays an
 * assertion about the portal instead of a copy of `sr.json`.
 */
function waitingOutLoud(): HTMLElement[] {
  return screen
    .queryAllByRole('status')
    .filter((one) => one.textContent === sr.data.loading)
}

/**
 * Every address under administration the ROUTER really serves, asked of the router.
 *
 * <p><b>Walked rather than written down, and asked of the dispatcher rather than of a
 * list beside it.</b> „Which addresses exist" is a question `routeObjects` already
 * answers, and a second list here would be a copy that stops agreeing with it the day
 * a sixteenth screen is added - which is the one day this file has to keep working.
 *
 * <p>Addresses carrying a `:` are left out because they are not something a reader can
 * type: the door behind them is the same door, reached through the queue addresses that
 * are listed whole.
 */
function everyAdministrativeAddress(): string[] {
  const found: string[] = []

  const walk = (routes: RouteObject[]): void => {
    for (const route of routes) {
      const path = route.path ?? ''

      if (path.startsWith('administracija') && !path.includes(':')) {
        found.push(path)
      }

      if (route.children !== undefined) {
        walk(route.children)
      }
    }
  }

  walk(routeObjects)

  return found
}

describe('the door on an administrative address, before the server has answered', () => {
  let server: ReturnType<typeof anAnswerThatHasNotArrived> | null = null

  afterEach(() => {
    server?.stop()
    server = null
  })

  it('does not throw the superadmin out while the answer is still on its way', async () => {
    /* THE FAULT ITSELF. Rendered as the visitor, which is what `App.tsx` really starts
       as, and the answer naming a superadmin arrives only after the door has had its
       chance to be wrong. */
    server = anAnswerThatHasNotArrived()

    const { router } = renderAt('/sr/administracija/dogadjaji', 'visitor', null)

    /* The address is read off the router and never off `window.location`: a memory
       router never writes to it, so a case that read it there would pass whatever the
       door did (`test/render.tsx`). */
    expect(router.state.location.pathname).toBe('/sr/administracija/dogadjaji')

    await server.arrivesAs(said('superadmin'))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Događaji' }),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe('/sr/administracija/dogadjaji')
  })

  it('shows the loading indicator where the screen will be, and says so out loud', async () => {
    /* The price the owner accepted, and it is the portal's own indicator rather than one
       written here: `components/Loader.tsx` is announced through `role="status"` and
       stands still under `prefers-reduced-motion` (`Loader.css`). Both halves are asked
       for - the ROLE, so a silent word on the page does not satisfy it, and the WORD, so
       the page title's own status region does not. `Resource.test.tsx` reads it the same
       way, and `inboxFromTheServer.test.tsx` takes the word out of the dictionary rather
       than spelling it again, which is what keeps this from being a copy of `sr.json`. */
    server = anAnswerThatHasNotArrived()

    renderAt('/sr/administracija/dogadjaji', 'visitor', null)

    expect(waitingOutLoud()).toHaveLength(1)

    await server.arrivesAs(said('superadmin'))

    expect(waitingOutLoud()).toHaveLength(0)
  })

  it('still refuses the reader the answer turns out to be, and waiting is not a pass', async () => {
    /* The direction that matters. Waiting may DELAY a refusal and may never turn one
       into an admission, and that is what this measures: the same deferred answer, and
       a competitor at the end of it. */
    server = anAnswerThatHasNotArrived()

    const { router } = renderAt('/sr/administracija/dogadjaji', 'visitor', null)

    expect(router.state.location.pathname).toBe('/sr/administracija/dogadjaji')

    await server.arrivesAs(said('competitor'))

    await expectFrontPage()
    expect(screen.queryByRole('heading', { level: 1, name: 'Događaji' })).not.toBeInTheDocument()
  })

  it('sends away the reader nobody is signed in as, once the server has said so', async () => {
    /* „Nobody is signed in" and „there was no answer" are the same `null` out of
       `session/theServer.ts`, and until this branch both were also „nothing happens at
       all". A 401 has to SETTLE the wait even though it changes no role, or the portal
       stands on the indicator for a visitor for ever. */
    server = anAnswerThatHasNotArrived()

    renderAt('/sr/administracija/dogadjaji', 'visitor', null)

    await server.arrivesAs(null, 401)

    await expectFrontPage()
  })

  it('sends away the reader whose answer the portal cannot read at all', async () => {
    /* The sixth way to be nobody, and the one furthest from a refusal: a server one
       release ahead, a proxy answering something else, an address that is not ours.
       `session/theServer.ts` narrows the role and never asserts it (ADL A14), so this
       ends as `null` exactly as a 401 does - and, like a 401, it has to END the waiting.
       Named separately from the 401 because until this branch all six were one silence,
       and a repair that settled only the ones it recognised would leave the portal
       standing on an indicator for the answers nobody anticipated. */
    server = anAnswerThatHasNotArrived()

    renderAt('/sr/administracija/dogadjaji', 'visitor', null)

    await server.arrivesAs({ role: 'wizard', account: 'not a number' })

    await expectFrontPage()
  })

  it('opens at once for a reader whose role is already in hand, and waits for nothing', async () => {
    /* THE OTHER HALF OF THE ORDER THE DOOR DECIDES IN. A role can be held before the
       answer in two ways - the development switch, and having just signed in, where
       `pages/member/SignIn.tsx` calls `become` and then navigates - and neither of them
       is a reader who should be made to wait for an answer to a question already put.
       Measured with an answer that NEVER comes, so the screen behind the door can only
       be drawing because the door never waited. */
    server = anAnswerThatHasNotArrived()

    renderAt('/sr/administracija/dogadjaji', 'superadmin', null)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Događaji' }),
    ).toBeVisible()
    expect(waitingOutLoud()).toHaveLength(0)
  })

  it('does not hold up an address that asks for nothing, which is most of the portal', async () => {
    /* The reach of this is the SIXTEEN addresses that ask for something and not the
       portal: `routeObjects.tsx` fits the door only where `needFor` names a need, and
       every other screen is handed through untouched. Measured with an answer that never
       comes, so a front page that draws itself here is one that never waited. Without
       this the repair would put a loading indicator in front of every visitor on every
       screen, which is a far worse fault than the one being repaired. */
    server = anAnswerThatHasNotArrived()

    renderAt('/sr', 'visitor', null)

    await expectFrontPage()
  })

  it('waits on every address the router serves under administration, not on one of them', async () => {
    /* The owner's own words about the reach: the door „stoji nad svakom zaštićenom
       adresom". Walked rather than named, so the sixteenth gets this on the day it is
       added; and counted against the table the door reads from, so a walk that quietly
       shrinks fails here rather than passing on one address. */
    const addresses = everyAdministrativeAddress()

    expect(addresses.length).toBeGreaterThan(13)
    expect(new Set(addresses).size).toBe(addresses.length)
    expect(addresses.every((path) => path in NEEDS)).toBe(true)

    for (const path of addresses) {
      const waiting = anAnswerThatHasNotArrived()

      try {
        const { router, unmount } = renderAt(`/sr/${path}`, 'visitor', null)

        expect(router.state.location.pathname).toBe(`/sr/${path}`)
        unmount()
      } finally {
        waiting.stop()
      }
    }
  })
})

/**
 * THE ONE OUTCOME A PROMISE CANNOT SETTLE: a socket accepted and never written to.
 *
 * <p>Every other way of failing comes back fast and by itself. This one never comes back
 * at all, and a door that waited on it would wait for ever - which is the single state in
 * which the repair would be worse than the fault. So it is bounded, and the bound and its
 * reasoning live on {@link HOW_LONG_THE_DOOR_WAITS}.
 *
 * <p><b>The bound is imported and never spelt again here.</b> A number written twice is
 * two numbers the day one of them is changed, and the one that would go stale is this one.
 */
describe('the door when the answer is never coming at all', () => {
  let server: ReturnType<typeof anAnswerThatHasNotArrived> | null = null

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    server?.stop()
    server = null
  })

  it('goes on waiting for as long as the bound says, and not a moment less', async () => {
    /* The half that keeps the bound from quietly becoming zero. A bound that fired at
       once would pass the case below and read as a repair, while putting the superadmin
       back on the front page on every hard load - the very fault this branch exists for,
       only now with a flicker of an indicator in front of it. */
    expect(HOW_LONG_THE_DOOR_WAITS).toBeGreaterThan(0)

    server = anAnswerThatHasNotArrived()

    const { router } = renderAt('/sr/administracija/dogadjaji', 'visitor', null)

    await act(async () => {
      vi.advanceTimersByTime(HOW_LONG_THE_DOOR_WAITS - 1)
      await Promise.resolve()
    })

    expect(router.state.location.pathname).toBe('/sr/administracija/dogadjaji')
    expect(waitingOutLoud()).toHaveLength(1)
  })

  it('stops waiting once the bound is up, and decides with the role it has', async () => {
    /* And it decides the way the portal decided before any of this: on the role there
       is, which at the first paint of a visit is the visitor. So the bound can only ever
       send somebody to the front page. There is no arrangement of a missing answer that
       opens a door. */
    server = anAnswerThatHasNotArrived()

    const { router } = renderAt('/sr/administracija/dogadjaji', 'visitor', null)

    await act(async () => {
      vi.advanceTimersByTime(HOW_LONG_THE_DOOR_WAITS)
      await Promise.resolve()
    })

    expect(router.state.location.pathname).toBe('/sr')
  })
})
