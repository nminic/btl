import { configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import sr from '../i18n/sr.json'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { answeredWith, forgetEveryCookie, serverThat } from '../test/serverAnswers'
import { SLOW } from '../test/slow'
import { HOW_LONG_THE_DOOR_WAITS } from './useTheServersSession'
import { useSession } from './useSession'

/**
 * UNTIL THE SERVER HAS SAID WHO IS READING, NOTHING ON THE PORTAL SAYS ANYTHING ABOUT THE READER
 * (owner, 10.10.2026, chosen between offered outcomes; PDL, P26 of the answers of that day: „Dok
 * server ne kaže ko čita: dugmad u zaglavlju nevidljiva, rečenica o komentarima ide u isti posao,
 * pad mreže isto kao posetiocu"; the wording was offered to him and the choice is his).
 *
 * <p>At the first paint of every visit the session names nobody, and that nobody is the same
 * whether the reader is a visitor or a member whose cookie `GET /api/me` has not been asked about
 * yet. The portal drew it as a visitor, so a member was offered „Prijavi se" and „Učlani se", told
 * on a screen of his own „Za ovo treba prijava", and told on a past event that the comments are
 * for members. The sentence is taken here in its three places and its four states.
 *
 * <p><b>The three places:</b> the header (the two links of a visitor), the sentence under the
 * comments of a race that has been run, and the eleven screens of the member area. The eleven are
 * walked where the list of them has its floor (`pages/member/oneQuestion.test.tsx`, „while the
 * server has not said"), and are not listed again here: a second list is a copy that stops
 * agreeing with the first.
 *
 * <p><b>The four states, which are the axis:</b> the answer has not come back; it came back and
 * named a member; it came back and named nobody (a 401); and it never came because the network is
 * gone. The last is the owner's „pad mreže isto kao posetiocu". The second and the third are what
 * keeps the first from being „the session names nobody" read as a wait, which would make a visitor
 * wait for ever for an answer he already has.
 *
 * <p><b>Every wait is given half of the time the portal itself waits for the answer</b>
 * (`HOW_LONG_THE_DOOR_WAITS`), and that is shorter than the half of a case that
 * `pages/admin/saveWhileSaving.test.tsx` uses, for a reason measured on the first series of
 * mutations: a wait of ten seconds is the bound after which the portal stops waiting by itself, so
 * a screen that waits for ever for the wrong reason was let go by the bound, and a case waiting
 * the same ten seconds saw the sentence arrive and passed. Shorter than the bound, a wait that
 * never succeeds ends in its assertion's own words; the floor at the foot of this file holds it.
 */

configure({ asyncUtilTimeout: HOW_LONG_THE_DOOR_WAITS / 2 })

/** A past event with comments the portal serves, so the section under it has something to say. */
const RAN = '/sr/kalendar/fruskogorski-maraton-2010'
/** One nobody has run yet, read on a day before it. */
const AHEAD = '/sr/kalendar/podgoricka-desetka-2027'
const BEFORE_AHEAD = '2026-12-31'

/** An active member of the files the server serves, as `GET /api/me` names him. */
const A_MEMBER = { role: 'competitor', account: 107, member: { memberNumber: '000021' } }

/**
 * A `GET /api/me` that has not come back, and the ways to make it come back.
 *
 * <p>The disc reader keeps every other request, which is what `serverThat` is for: replacing the
 * whole of `fetch` leaves the screens empty, and that is another fault reported as this one.
 */
function aMeThatHasNotArrived(): {
  saysAMember: () => void
  saysNobody: () => void
  isGone: () => void
  stop: () => void
} {
  let deliver: (answer: Response) => void = () => undefined
  let fail: (why: unknown) => void = () => undefined
  const waiting = new Promise<Response>((resolve, reject) => {
    deliver = resolve
    fail = reject
  })
  const { stop } = serverThat((path) => (path === '/api/me' ? waiting : null))

  return {
    saysAMember: () =>
      deliver(
        new Response(JSON.stringify(A_MEMBER), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    saysNobody: () => deliver(answeredWith(401)),
    isGone: () => fail(new TypeError('Failed to fetch')),
    stop,
  }
}

let server: ReturnType<typeof aMeThatHasNotArrived> | null = null

afterEach(() => {
  server?.stop()
  server = null
  forgetEveryCookie()
})

/** The announced places on the page saying „waiting" this instant, by their words and not by a class. */
function waitingOutLoud(part?: string): HTMLElement[] {
  const words = part === undefined ? sr.data.loading : sr.data.loadingPart.replace('{part}', part)

  return screen.queryAllByRole('status').filter((one) => one.textContent === words)
}

const SIGN_IN = { name: sr.shell.signIn }
const JOIN = { name: sr.shell.join }

/**
 * The link of the header with these words, whether or not a reader is offered it.
 *
 * <p>By its words and not by an accessible name, because a hidden element has none: the name of a
 * node taken out of the tree is empty, so `findByRole` with a name can never find the very thing
 * these cases are about. `hidden: true` is what lets the query see it at all, and the role is
 * still asked, so a `<span>` with the words would not be found.
 */
function theHeaderLink(words: string): HTMLElement | null {
  return (
    within(screen.getByRole('banner'))
      .queryAllByRole('link', { hidden: true })
      .find((one) => one.textContent === words) ?? null
  )
}

/** Waits until the header has drawn the link, which is „is there" and says nothing about being offered. */
async function theHeaderLinkIsThere(words: string): Promise<HTMLElement> {
  return waitFor(() => must(theHeaderLink(words), `the header link „${words}"`))
}

describe('the two links of a visitor in the header', { timeout: SLOW }, () => {
  it('are there and not offered while the answer is on its way', async () => {
    server = aMeThatHasNotArrived()
    renderAt('/sr', 'visitor', null)

    for (const words of [sr.shell.signIn, sr.shell.join]) {
      /* There all the same, which is how „mesto ostaje" is asked: a link taken out of the
         document would shrink the row of tools and grow it back under the pointer. */
      const there = await theHeaderLinkIsThere(words)

      /* And out of the reader's tree: not found by role with a name, which is how „ništa se ne
         izgovara" is asked. */
      expect(screen.queryByRole('link', { name: words })).toBeNull()

      expect(there).toHaveAttribute('aria-hidden', 'true')
      /* Out of the tab order twice over: by the attribute, and by `inert`, which also refuses
         the click and the focus a script may give it. */
      expect(there).toHaveAttribute('tabindex', '-1')
      expect(there).toHaveAttribute('inert')
      expect(there).toHaveClass('shell__guest--waiting')
      /* And not by the `hidden` attribute, which is `display: none` and gives the row its width
         back: the one other way to hide a link, and the wrong one (`app/shellStyle.test.ts`). */
      expect(there).not.toHaveAttribute('hidden')
    }
  })

  it('are offered once the server has said nobody is signed in', async () => {
    server = aMeThatHasNotArrived()
    renderAt('/sr', 'visitor', null)
    await theHeaderLinkIsThere(sr.shell.signIn)
    server.saysNobody()

    for (const link of [SIGN_IN, JOIN]) {
      const offered = await screen.findByRole('link', link)

      expect(offered).not.toHaveAttribute('aria-hidden')
      expect(offered).not.toHaveAttribute('tabindex')
      expect(offered).not.toHaveAttribute('inert')
      expect(offered).not.toHaveClass('shell__guest--waiting')
    }
  })

  it('are offered when the network is gone, exactly as to a visitor', async () => {
    server = aMeThatHasNotArrived()
    renderAt('/sr', 'visitor', null)
    await theHeaderLinkIsThere(sr.shell.signIn)
    server.isGone()

    expect(await screen.findByRole('link', SIGN_IN)).not.toHaveAttribute('inert')
    expect(await screen.findByRole('link', JOIN)).not.toHaveAttribute('inert')
  })

  it('are never there for a member, who is offered his account instead', async () => {
    server = aMeThatHasNotArrived()
    renderAt('/sr', 'visitor', null)
    await theHeaderLinkIsThere(sr.shell.signIn)
    server.saysAMember()

    expect(await screen.findByRole('button', { name: 'Otvori nalog' })).toBeVisible()
    expect(theHeaderLink(sr.shell.signIn)).toBeNull()
    expect(theHeaderLink(sr.shell.join)).toBeNull()
  })

  it('are not waited for by somebody the session already names', async () => {
    /* The member number handed in is what the prototype's development switch does, and the
       answer is still on its way: the header knows him, so it has nothing to wait for and no
       link of a visitor to hide. */
    server = aMeThatHasNotArrived()
    renderAt('/sr', 'competitor', '000021')

    expect(await screen.findByRole('button', { name: 'Otvori nalog' })).toBeVisible()
    expect(theHeaderLink(sr.shell.signIn)).toBeNull()
  })
})

describe('the sentence under the comments of a race that has been run', { timeout: SLOW }, () => {
  const FOR_MEMBERS = sr.event.commentsForMembers
  const HEADING = { level: 2, name: sr.event.comments } as const

  it('is a small indicator in its place while the answer is on its way', async () => {
    server = aMeThatHasNotArrived()
    renderAt(RAN, 'visitor', null)

    /* The heading is there, because a race that has been run has a section whoever reads it, and
       it must not move when the answer lands. The sentence is not, and the indicator names the
       section it stands for. */
    expect(await screen.findByRole('heading', HEADING)).toBeVisible()
    expect(screen.queryByText(FOR_MEMBERS)).toBeNull()
    expect(waitingOutLoud(sr.event.comments)).toHaveLength(1)
  })

  it('is said when the server has said nobody is signed in', async () => {
    server = aMeThatHasNotArrived()
    renderAt(RAN, 'visitor', null)
    await screen.findByRole('heading', HEADING)
    server.saysNobody()

    expect(await screen.findByText(FOR_MEMBERS)).toBeVisible()
    expect(waitingOutLoud(sr.event.comments)).toHaveLength(0)
  })

  it('is said when the network is gone, exactly as to a visitor', async () => {
    server = aMeThatHasNotArrived()
    renderAt(RAN, 'visitor', null)
    await screen.findByRole('heading', HEADING)
    server.isGone()

    expect(await screen.findByText(FOR_MEMBERS)).toBeVisible()
    expect(waitingOutLoud(sr.event.comments)).toHaveLength(0)
  })

  it('is not said to a member, whose comments replace the indicator', async () => {
    server = aMeThatHasNotArrived()
    renderAt(RAN, 'visitor', null)
    await screen.findByRole('heading', HEADING)
    server.saysAMember()

    expect(await screen.findByRole('button', { name: 'Otvori nalog' })).toBeVisible()
    await waitFor(() => expect(waitingOutLoud(sr.event.comments)).toHaveLength(0))
    expect(screen.queryByText(FOR_MEMBERS)).toBeNull()
  })

  it('is said at once to somebody the sign in form has already named, who waits for nothing', async () => {
    /* An ACCOUNT with no record, which `SignIn` writes into the session the moment the server
       agrees (`theServerSignedMeIn`) and which is not an active member: the sentence is true of
       him, and the answer to `GET /api/me` is still on its way. Asked of „the server has not
       answered" alone he would be shown an indicator for as long as the request took. */
    server = aMeThatHasNotArrived()

    function SignsIn() {
      const { theServerSignedMeIn } = useSession()

      useEffect(() => {
        theServerSignedMeIn({
          account: 107,
          memberNumber: null,
          country: null,
          firstSeason: null,
          teamId: null,
          membershipBasis: null,
          referralCode: null,
          referredCount: null,
          hasARecord: false,
          feeStands: null,
        })
      }, [theServerSignedMeIn])

      return null
    }

    renderAt(RAN, 'visitor', null, undefined, null, <SignsIn />)

    await screen.findByRole('heading', HEADING)

    expect(screen.getByText(FOR_MEMBERS)).toBeVisible()
    expect(waitingOutLoud(sr.event.comments)).toHaveLength(0)
  })

  it('is nothing at all before the race, while waiting and after', async () => {
    /* The sentence on a race to come would say which races have something to read about, and the
       indicator would say the same; so neither is drawn, before the answer or after it. */
    server = aMeThatHasNotArrived()
    renderAt(AHEAD, 'visitor', null, undefined, BEFORE_AHEAD)
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByRole('heading', HEADING)).toBeNull()
    expect(waitingOutLoud(sr.event.comments)).toHaveLength(0)

    server.saysNobody()
    await screen.findByRole('link', SIGN_IN)

    expect(screen.queryByRole('heading', HEADING)).toBeNull()
    expect(screen.queryByText(FOR_MEMBERS)).toBeNull()
  })
})

describe('what is waited for, and how long', () => {
  it('is shorter than the bound after which the portal stops waiting by itself', () => {
    /* Take the `configure` at the head of the file away and every wait is longer than the bound,
       so a reader the portal wrongly keeps waiting is let go by the bound at the very moment the
       case gives up, and the case passes. Strictly shorter, and by a margin that is not a race. */
    expect(getConfig().asyncUtilTimeout).toBeLessThan(HOW_LONG_THE_DOOR_WAITS)
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
