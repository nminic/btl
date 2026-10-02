import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, screen, waitFor } from '@testing-library/react'
import sr from '../../i18n/sr.json'
import type { Role } from '../../roles/context'
import { HOW_LONG_THE_DOOR_WAITS } from '../../session/useTheServersSession'
import { expectFrontPage, renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'

/**
 * THE MOMENT BEFORE THE SERVER HAS SAID WHO IS READING, ON THE TWO ADDRESSES THAT SEND A READER
 * AWAY BY WHO HE IS: A PROFILE AND THE PAGE OF AWARDS BESIDE IT.
 *
 * <p><b>The fault, measured in a review of PR 461 on 02.10.2026.</b> Loading a hidden member's
 * profile from cold - a new tab, `F5` - sometimes threw a reader who IS signed in onto the front
 * page. With the member served as hidden and a stand-in server in front: an account with no member
 * 2 times in 4 on the profile and 1 in 2 on the awards, the same account with `GET /api/me` held
 * back 1,5 s 2 times in 2, and member 000012 1 time in 2. The decision whether to turn the reader
 * away did not wait for the answer to the one question it is about.
 *
 * <p><b>It is the decision of 29.09.2026 carried to the two screens it was never carried to</b>
 * (`PDL.md`, „Cuvar ne preusmerava dok server ne kaze ko cita", owner, chosen between three offered
 * outcomes): a door does not redirect until the server has answered who is reading, and the price
 * accepted for it is a short moment with a loading indicator where the screen will be. It was
 * carried out in `pages/admin/Guard.tsx` only. **That these two screens are the same fault is the
 * assistant's derivation and not the owner's word**: both turn a reader away by who he is, and at
 * the first paint of a visit he is nobody (`app/App.tsx` mounts `RoleProvider` with no prop).
 *
 * <p><b>Why no case saw it, and it is the same boundary as `pages/admin/beforeTheAnswer.test.tsx`
 * measured.</b> `test/render.tsx` renders every case with the reader already known, so the moment in
 * which he is not known did not exist to be measured. These cases make it exist the way that file
 * does: a server in front whose `GET /api/me` HAS NOT COME BACK, and a render as `visitor`, which
 * is what production's first paint really is.
 *
 * <p><b>Why a number nobody has waits as well, and it is the owner's rule and not a convenience.</b>
 * PDL 06.09.2026: a hidden profile and a profile that does not exist must be ONE answer, „inace
 * posetilac po razlici sazna koji brojevi pripadaju skrivenim clanovima". A screen that waited for
 * the one and sent the other away at once would show that difference for exactly as long as the
 * answer takes. So all three ways to be unreadable wait, and all three end in the same place.
 */

const HIM = '/sr/takmicar/000007-strahinja-vukicevic'
const HER = '/sr/takmicar/000002-relja-momcilovic'
const NOBODY = '/sr/takmicar/000999-niko-nikic'

/**
 * The generated members as the server serves them, with the ones named here hidden.
 *
 * Served and not hidden through the overlay, because a hard load has no overlay: the first paint of
 * the profile is the whole visit, and nobody has pressed a box in the settings. The flag is the
 * one `CompetitorApi` selects on every row (`data/types.ts`, `profileHidden`).
 */
function competitorsServed(hidden: string[]): Response {
  const file: Record<string, unknown>[] = JSON.parse(
    readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'),
  )

  return new Response(
    JSON.stringify(
      file.map((one) => (hidden.includes(String(one.memberNumber)) ? { ...one, profileHidden: true } : one)),
    ),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

/**
 * A `GET /api/me` that has not come back, and the way to make it come back. `pages/admin/
 * beforeTheAnswer.test.tsx` writes the same thing; twenty test files on the portal each write
 * their own version of a server that holds an answer back, and there is no shared one.
 */
function aServerThatHasNotSaidWho(hidden: string[]): {
  asked: Asked[]
  arrivesAs: (body: unknown, status?: number) => Promise<void>
  stop: () => void
} {
  let deliver: (answer: Response) => void = () => undefined
  const waiting = new Promise<Response>((resolve) => {
    deliver = resolve
  })

  const { asked, stop } = serverThat((path) => {
    if (path === '/api/me') {
      return waiting
    }

    return path === '/api/competitors' ? competitorsServed(hidden) : null
  })

  return {
    asked,
    arrivesAs: async (body: unknown, status = 200) => {
      deliver(
        new Response(status === 200 ? JSON.stringify(body) : null, {
          status,
          headers: status === 200 ? { 'content-type': 'application/json' } : undefined,
        }),
      )

      /* Two turns of the microtask queue: one for `fetch` to settle, one for the body. Written out
         for the reason `pages/admin/beforeTheAnswer.test.tsx` gives: a case that waits for the wrong
         number of them measures the moment BEFORE the answer while believing it measures the one
         after. */
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
    },
    stop,
  }
}

/** What the server says about somebody it has let in: the shape `MeApi` really sends, and no more of
 *  it than the portal reads. A member carries his record; an account that races for nobody carries
 *  none (`session/theServer.ts`, „Absent rather than null"). */
const aMember = { role: 'competitor', account: 1, member: { memberNumber: '000002' } }
const anAccountThatRacesForNobody = { role: 'moderator', account: 1 }

/** The announced places on the page that say „waiting" this instant, by role AND by word: the page
 *  title keeps a `role="status"` of its own over every screen (`app/Shell.tsx`). */
function waitingOutLoud(): HTMLElement[] {
  return screen.queryAllByRole('status').filter((one) => one.textContent === sr.data.loading)
}

/**
 * Lets everything that is already on its way get here: every resource the screen asked for, and
 * the drawing of what they said.
 *
 * <p>**It has to be a wait for the DATA and not only for the answer**, because the decision is made
 * when both exist. A case that measured "still waiting" while the resources were still on their
 * way would pass for a screen that redirected the moment it could, which is the fault. The last
 * resource each screen asks for is waited for by name, and one turn of the macrotask queue goes
 * after it: the disc reader answers out of promise continuations alone, so nothing is left in
 * flight once a timer has fired.
 */
async function theDataHasArrived(asked: Asked[], last: string): Promise<void> {
  await waitFor(() => {
    expect(asked.map((one) => one.path)).toContain(last)
  })

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/** Every `h1` the document ever carried, kept from before the first render. The profile of a hidden
 *  member is an `h1` with his name, so „he was never drawn" is a question about this set and not
 *  about the page at the end of the visit. */
function watchingEveryHeading(): { seen: () => string[]; stop: () => void } {
  const names = new Set<string>()
  const read = () => {
    for (const one of document.querySelectorAll('h1')) {
      names.add(String(one.textContent))
    }
  }
  const observer = new MutationObserver(read)

  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  read()

  return {
    seen: () => {
      observer.takeRecords()
      read()

      return [...names]
    },
    stop: () => {
      observer.disconnect()
    },
  }
}

describe.each([
  { screen: 'the profile', suffix: '', last: '/api/pairs' },
  { screen: 'the page of awards', suffix: '/priznanja', last: '/api/ducats' },
])('$screen of a hidden member, before the server has said who is reading', ({ suffix, last }) => {
  let server: ReturnType<typeof aServerThatHasNotSaidWho> | null = null

  afterEach(() => {
    server?.stop()
    server = null
  })

  /** The visit as a cold load is: the session is empty for as long as nothing has been said, and
   *  every resource the screen needs has arrived. The three things a screen that did NOT wait could
   *  not satisfy at once are asserted here, so no case below has to remember to. The role is the
   *  visitor's, which is what production's first paint really is, unless a case says what the
   *  BROWSER holds. */
  async function loadedWhileItWaits(address: string, role: Role = 'visitor') {
    server = aServerThatHasNotSaidWho(['000007'])

    const { router } = renderAt(`${address}${suffix}`, role, null)

    await theDataHasArrived(server.asked, last)

    expect(router.state.location.pathname).toBe(`${address}${suffix}`)
    expect(waitingOutLoud()).toHaveLength(1)
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()

    return { router, server }
  }

  it('does not send the reader away while the answer is on its way, and shows nothing of the member', async () => {
    const { router } = await loadedWhileItWaits(HIM)

    /* The member's own words are nowhere on the page either: the screen is the loading indicator and
       nothing else, so a case that read only the address could not tell this from a screen drawing
       a hidden profile to a reader nobody had checked. */
    expect(screen.queryByText(/Članski broj 000007/)).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`${HIM}${suffix}`)
  }, SLOW)

  it('shows the profile to the member the server names, and never sent him away', async () => {
    const { router, server: held } = await loadedWhileItWaits(HIM)

    await held.arrivesAs(aMember)

    expect(await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })).toBeVisible()
    expect(router.state.location.pathname).toBe(`${HIM}${suffix}`)
    expect(waitingOutLoud()).toHaveLength(0)
  }, SLOW)

  it('shows it to an account that races for nobody too, which is administration', async () => {
    /* The reader PR 461 taught the screens about: signed in, with no member number. A wait that
       ended on a member number alone would end for him on „nobody" and send him away, which is the
       fault of 461 reached by another road. */
    const { router, server: held } = await loadedWhileItWaits(HIM)

    await held.arrivesAs(anAccountThatRacesForNobody)

    expect(await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })).toBeVisible()
    expect(router.state.location.pathname).toBe(`${HIM}${suffix}`)
  }, SLOW)

  it('still sends a visitor to the front page once the server says nobody is signed in, and never draws him first', async () => {
    /* THE DIRECTION THAT MATTERS, and the one `pages/admin/beforeTheAnswer.test.tsx` names the same
       way: waiting may DELAY a refusal and may never turn one into an admission. The same deferred
       answer, and nobody at the end of it.

       „Never draws him first" is asked of every heading the document ever carried, from before the
       first render. The page at the end of the visit is the front page, so nothing there can say
       whether the profile was on screen for a frame on the way. */
    const watch = watchingEveryHeading()

    try {
      const { router, server: held } = await loadedWhileItWaits(HIM)

      await held.arrivesAs(null, 401)
      await expectFrontPage()

      expect(router.state.location.pathname).toBe('/sr')
      expect(watch.seen().filter((name) => name.includes('Strahinja'))).toEqual([])
    } finally {
      watch.stop()
    }
  }, SLOW)

  it('sends away the reader whose answer the portal cannot read at all, the same way', async () => {
    /* The way to be nobody furthest from a refusal. It has to END the waiting as a 401 does, or the
       portal stands on an indicator for ever for the answers nobody anticipated. */
    const { router, server: held } = await loadedWhileItWaits(HIM)

    await held.arrivesAs({ role: 'wizard', account: 'not a number' })
    await expectFrontPage()

    expect(router.state.location.pathname).toBe('/sr')
  }, SLOW)

  it('waits for a number nobody has exactly as it waits for a hidden one, and ends in the same place', async () => {
    /* THE OWNER'S ONE ANSWER (PDL 06.09.2026). The number is in no list the server serves, which is
       also what a member whose fee has run out looks like, so this is two of the three ways to be
       unreadable in one case. Waiting for the hidden member and sending this one away at once would
       show a visitor, for as long as the answer takes, which numbers belong to members who hide. */
    server = aServerThatHasNotSaidWho(['000007'])

    const { router } = renderAt(`${NOBODY}${suffix}`, 'visitor', null)

    await theDataHasArrived(server.asked, last)

    expect(router.state.location.pathname).toBe(`${NOBODY}${suffix}`)
    expect(waitingOutLoud()).toHaveLength(1)

    await server.arrivesAs(null, 401)
    await expectFrontPage()

    expect(router.state.location.pathname).toBe('/sr')
  }, SLOW)

  it('goes by what the server says and not by the role the browser holds', async () => {
    /* THE SOURCE OF THE READER, SWAPPED, and it is the outcome the owner refused on 29.09.2026:
       „pamti se poslednja uloga u pregledacu", because what the browser says and what the server
       says can come apart. A browser holding the role of a competitor - the development switch, a
       role left from an earlier visit - against a server that says nobody is signed in is a reader
       to be turned away, whatever the browser holds. Neither the cases above nor the ones that sign
       somebody in during a visit can tell this reader from the visitor, because both of those carry
       the role and the session together; this is the one that parts them. */
    const { router, server: held } = await loadedWhileItWaits(HIM, 'competitor')

    await held.arrivesAs(null, 401)
    await expectFrontPage()

    expect(router.state.location.pathname).toBe('/sr')
  }, SLOW)
})

/**
 * WITH THE CLOCK STOPPED, WHICH IS WHAT SEPARATES „AT ONCE" FROM „EVENTUALLY".
 *
 * <p>**Why these cases do not run on the real clock, and it was measured the hard way.** A server
 * whose answer never comes is not waited on for ever: the portal gives up after
 * {@link HOW_LONG_THE_DOOR_WAITS}, and Testing Library's own wait is longer than that
 * (`test/setup.ts`, `SLOW`). A screen that kept a reader waiting who should have been let in at once
 * therefore drew the profile after ten seconds, and the case that asked „is it drawn" passed with
 * the screen wrong: the mutation that put the wait in front of the question about the reader
 * survived all eighteen cases of the first draft of this file, at 45 s a run instead of 6. Here
 * nothing can be drawn „after the bound", because no time goes by.
 *
 * <p>The bound and its reasoning live on {@link HOW_LONG_THE_DOOR_WAITS} and are imported and never
 * spelt again here: a number written twice is two numbers the day one of them is changed. These
 * screens wait on the same flag the door does, so the same bound ends the waiting, and ends it the
 * only way it can - on the role there is, which at the first paint is the visitor. It can send a
 * reader to the front page and can never open a profile.
 */
describe.each([
  { screen: 'the profile', suffix: '', last: '/api/pairs' },
  { screen: 'the page of awards', suffix: '/priznanja', last: '/api/ducats' },
])('$screen of a hidden member, with the clock stopped', ({ suffix, last }) => {
  let server: ReturnType<typeof aServerThatHasNotSaidWho> | null = null

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: false })
  })

  afterEach(() => {
    vi.useRealTimers()
    server?.stop()
    server = null
  })

  /** Everything already on its way, got here without a moment going by. Neither `waitFor` nor a
   *  `findBy` can be used while the clock is faked: Testing Library drains the queue after each of
   *  them with a timer that vitest's fake clock never fires, and the case hangs until its own
   *  timeout instead of failing. */
  async function theDataHasArrivedWithNoTimeGoingBy(): Promise<void> {
    await act(async () => {
      for (let turn = 0; turn < 30; turn += 1) {
        await Promise.resolve()
      }
    })
  }

  it('opens at once for a reader whose session is already in hand, and waits for nothing', async () => {
    /* THE OTHER HALF OF THE ORDER THE SCREEN DECIDES IN, and it is `Guard`'s own: a reader is held
       before the answer in two ways, the development switch and having just signed in
       (`pages/member/SignIn.tsx` writes the session and then navigates). Neither is a reader to be
       made to wait for a question already put. Measured with an answer that NEVER comes and a clock
       that does not move, so the screen can only be drawing because it never waited. */
    server = aServerThatHasNotSaidWho(['000007'])

    renderAt(`${HIM}${suffix}`, 'competitor', '000002')

    await theDataHasArrivedWithNoTimeGoingBy()

    expect(server.asked.map((one) => one.path)).toContain(last)
    expect(screen.getByRole('heading', { level: 1, name: /Strahinja Vukićević/ })).toBeVisible()
    expect(waitingOutLoud()).toHaveLength(0)
  }, SLOW)

  it('does not hold up a profile that is hidden from nobody, which is most of them', async () => {
    /* The reach of this is the hidden ones, and not the portal. Waiting before the question of
       whether the reader may open it would put an indicator in front of every profile for every
       visitor on a cold load, which is a far worse fault than the one being repaired. Measured with
       an answer that never comes and a clock that does not move. */
    server = aServerThatHasNotSaidWho(['000007'])

    const { router } = renderAt(`${HER}${suffix}`, 'visitor', null)

    await theDataHasArrivedWithNoTimeGoingBy()

    expect(server.asked.map((one) => one.path)).toContain(last)
    expect(screen.getByRole('heading', { level: 1, name: /Relja Momčilović/ })).toBeVisible()
    expect(router.state.location.pathname).toBe(`${HER}${suffix}`)
    expect(waitingOutLoud()).toHaveLength(0)
  }, SLOW)

  it('goes on waiting for as long as the bound says, and not a moment less, then decides as a visitor', async () => {
    server = aServerThatHasNotSaidWho(['000007'])

    const { router } = renderAt(`${HIM}${suffix}`, 'visitor', null)

    /* That the data really did arrive is asserted twice: by the request having been made, and by
       the last line of this case, which can only be true once it has - the screen decides when the
       bound ends, on what it was given. */
    await theDataHasArrivedWithNoTimeGoingBy()

    expect(server.asked.map((one) => one.path)).toContain(last)

    await act(async () => {
      vi.advanceTimersByTime(HOW_LONG_THE_DOOR_WAITS - 1)
      await Promise.resolve()
    })

    expect(router.state.location.pathname).toBe(`${HIM}${suffix}`)
    expect(waitingOutLoud()).toHaveLength(1)

    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })

    expect(router.state.location.pathname).toBe('/sr')
  }, SLOW)
})
