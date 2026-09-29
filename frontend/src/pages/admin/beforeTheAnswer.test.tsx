import { act, screen } from '@testing-library/react'
import type { RouteObject } from 'react-router'
import { routeObjects } from '../../app/routeObjects'
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
    /* The price the owner accepted, and it is the portal's own indicator rather than
       one written here: `components/Loader.tsx` is announced (`role="status"`) and
       stands still under `prefers-reduced-motion` (`Loader.css`). Asked for by role and
       by name, so a silent indicator written by hand fails this. */
    server = anAnswerThatHasNotArrived()

    renderAt('/sr/administracija/dogadjaji', 'visitor', null)

    expect(screen.getByRole('status', { name: 'Učitavanje' })).toBeVisible()

    await server.arrivesAs(said('superadmin'))

    expect(screen.queryByRole('status', { name: 'Učitavanje' })).not.toBeInTheDocument()
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
