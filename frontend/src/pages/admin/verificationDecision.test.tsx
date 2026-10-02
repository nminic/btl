import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { Decided, Inbox } from '../../test/decided'
import { answeredWith, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { QUEUE } from './queues'
import { useSession } from '../../session/useSession'
import { useEffect } from 'react'
import sr from '../../i18n/sr.json'

/**
 * ONE MESSAGE THIS READER REALLY HAS, so that „the refusal wrote nothing" is read off a list
 * that is drawn and not off one that is empty whatever happens.
 *
 * <p><b>That floor used to arrive from the bundle and no longer does.</b>
 * `data/seedMessages.ts` put two broadcasts into every session until 28.09.2026, which is what
 * the case below meant by „not by an empty list - the seed already writes 000010 other mail";
 * PDL 34 („NECU MOCK PODATKE NIGDE", owner) took them out, and an absence asserted over an
 * empty list is an assertion that cannot fail.
 *
 * <p>Written once, on mount, through `notify` - the road the screen under test would itself
 * take - and addressed to this reader, so it is in `inbox` for the same reason a real one
 * would be.
 */
function OneMessageThatIsNotADecision() {
  const { notify } = useSession()

  useEffect(() => {
    notify({
      from: 'Balkanska trkačka liga',
      to: '000010',
      subject: 'Članarina je evidentirana',
      body: 'Uplata je zabeležena.',
      date: '2026-09-20',
    })
  }, [notify])

  return null
}

/**
 * THE MODERATOR'S DECISION REACHES THE SERVER, AND THE SCREEN CHANGES ONLY WHEN IT DID.
 *
 * <p><b>Why this file exists, and it is a fault the owner met himself rather than one
 * somebody imagined.</b> He approved his own photograph on QA on 26.09.2026 and it did not
 * appear. Measured the same day (PDL P28f): the route that writes it,
 * `VerificationWriteApi.decide` at `POST /api/verification/{id}/decision`, existed and
 * `grep -rn "/decision" frontend/src` found nothing calling it. The decision was written
 * into the browser - `settle`, in `session/context.ts` - the card left the queue, the
 * screen looked exactly as it looks when the work is done, and `competitor.photo_id` was
 * never written. F5 undid all of it.
 *
 * <p><b>So the one thing every case here holds is the ORDER</b>: the route is asked, and
 * nothing local happens except in the branch that ran because the answer said it did. The
 * mutation that names this file is therefore not „delete an assertion" but „put `settle`
 * back in front of the request": every case below that reads `session decisions` fails on
 * it, because a decision the screen took on its own is a decision with no `POST` behind it.
 *
 * <p><b>Three queues and not five.</b> `CARRIED_OUT_HERE` in `VerificationWriteApi` is
 * `{profiles, teams, comments}`, which is exactly the three `admin/PendingQueue.tsx`
 * serves. The route answers the other two 409 „Odluka o ovom redu još nije uvedena." -
 * `results` because ADL A36 settled what a result's transaction contains only on
 * 21.09.2026 and nothing carries it out yet, `payments` because a member cannot reach that
 * queue at all - and their screens (`ReviewQueue.tsx`, `Payments.tsx`) are untouched here.
 * That boundary is in the description of this change rather than left for a reader to find.
 */

/** Only what was sent to decide something, out of everything the visit asked for. */
const decisionsIn = (asked: Asked[]): Asked[] =>
  asked.filter((one) => one.path.includes('/decision'))

/** What one of those carried, read rather than asserted (ADL A14). */
const bodyOf = (one: Asked | undefined): unknown =>
  JSON.parse(String(one?.init?.body ?? 'null'))

/**
 * A server that records the decision, and lets every read go to the disc.
 *
 * `null` from the callback is what hands a request on (`test/serverAnswers.ts`), so the
 * queue itself, the members and the teams all still come out of the generated files and
 * the cases below are measured against the real data.
 */
const serverThatRecords = () =>
  serverThat((path, init) =>
    init?.method === 'POST' && path.includes('/decision')
      ? new Response(JSON.stringify({ id: 1, state: 'approved' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      : null,
  )

/** A server that refuses every decision the same way, and reads normally. */
const serverThatRefuses = (answer: () => Response) =>
  serverThat((path, init) =>
    init?.method === 'POST' && path.includes('/decision') ? answer() : null,
  )

const cardsIn = () => screen.findByRole('list', { name: /Čeka/ })

const decidedIn = () => within(screen.getByRole('list', { name: 'session decisions' }))

/** The sentence that says a request is out, wherever on the page it was drawn. */
const sending = () =>
  screen.queryAllByRole('status').filter((one) => one.textContent === sr.results.sending)

/**
 * A server whose answer to the decision is held until `settle` is called.
 *
 * <p>`settle` takes a FUNCTION that makes the answer, not the answer: a `Response` body can be read
 * once, so one handed to two requests would be spent by the first and the second would meet a body
 * that is already gone - which reads exactly like a server that never answered.
 */
function serverThatHoldsTheDecision() {
  let settle: (answer: () => Response) => void = () => {}
  const held = new Promise<() => Response>((resolve) => {
    settle = resolve
  })
  const server = serverThat((path, init) =>
    init?.method === 'POST' && path.includes('/decision') ? held.then((make) => make()) : null,
  )

  return { server, settle }
}

/** The route's refusal of a card somebody has already answered. */
const refusal = () =>
  new Response(JSON.stringify({ reason: 'O stavci je već odlučeno.' }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  })

/** The route's word that it took the decision. */
const taken = () =>
  new Response(JSON.stringify({ id: 1, state: 'rejected' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

describe('a decision on a queue served by the pending screen', () => {
  it('sends an approval to the route that records it, and nothing else', async () => {
    const user = setupUser()
    const server = serverThatRecords()

    try {
      renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin', null, undefined, null, <Decided />)

      const waiting = within(await cardsIn())
      const first = within(waiting.getAllByRole('listitem')[0] ?? document.createElement('li'))

      await user.click(first.getByRole('button', { name: 'Odobri' }))

      const sent = decisionsIn(server.asked)

      expect(sent).toHaveLength(1)
      /* The address carries the item, so this is also what says WHICH card was
         decided: a screen that posted a fixed address would settle the same row
         whichever button was pressed. */
      expect(sent[0]?.path).toBe('/api/verification/ver-bio-1/decision')
      expect(sent[0]?.init?.method).toBe('POST')
      /* Approving carries no reason, which is what `anApproval` is for and what the
         route reads: `DecidingOnASubmission` asks for one only when the answer is no. */
      expect(bodyOf(sent[0])).toEqual({ approved: true, reason: '' })
    } finally {
      server.stop()
    }
  })

  it('sends a refusal as the other act, with the reason the moderator typed', async () => {
    const user = setupUser()
    const server = serverThatRecords()

    try {
      renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin', null, undefined, null, <Decided />)

      const waiting = within(await cardsIn())
      const first = within(waiting.getAllByRole('listitem')[0] ?? document.createElement('li'))

      await user.click(first.getByRole('button', { name: 'Odbij' }))
      await user.type(await screen.findByLabelText(/^Razlog odbijanja/), 'Tekst je prekratak.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      const sent = decisionsIn(server.asked)

      expect(sent).toHaveLength(1)
      /* The same address as the approval above and for the same reason: a screen
         that posted a fixed address, or the subject's id in place of the queue
         item's own - `subjectId` is the empty string on a biography
         (`public/mock/verification.json`, `ver-bio-1`) - would send this exact
         request whichever card was open. */
      expect(sent[0]?.path).toBe('/api/verification/ver-bio-1/decision')
      /* Two acts and never one with a flag (`verificationWrites.ts`): what parts them
         on the wire is `approved`, and the reason travels only with the no. */
      expect(bodyOf(sent[0])).toEqual({ approved: false, reason: 'Tekst je prekratak.' })
    } finally {
      server.stop()
    }
  })

  it('refuses a comment even with an empty note, the one queue that may leave it blank', async () => {
    /* `SendBack` marks the reason optional on exactly one queue (owner,
       06.08.2026): a comment is deleted rather than handed back, and the note is
       a trace left for the next moderator rather than a reason owed to anybody
       (`queues.ts`, `outcomeFor`). `aRefusal` still has to answer `approved:
       false` for that empty reason, because `approved` and not the reason is
       what the route tells a no from a yes - an empty string sent as a yes
       would ask `VerificationWriteApi` to PUBLISH the very comment the
       moderator pressed to delete. */
    const user = setupUser()
    const server = serverThatRecords()

    try {
      renderAt(`/sr/${QUEUE.comments.path}`, 'superadmin', null, undefined, null, <Decided />)

      const waiting = within(await cardsIn())
      const first = within(waiting.getAllByRole('listitem')[0] ?? document.createElement('li'))

      await user.click(first.getByRole('button', { name: /^Obriši:/ }))
      await user.click(await screen.findByRole('button', { name: 'Obriši komentar' }))

      const sent = decisionsIn(server.asked)

      expect(sent).toHaveLength(1)
      expect(bodyOf(sent[0])).toEqual({ approved: false, reason: '' })
    } finally {
      server.stop()
    }
  })

  it('sends one for a picture and one for a text, which are two sorts on one queue', async () => {
    /* PDL P28a: the racing profile carries both, and the schema is what tells them
       apart - `verification.photo_id` - which is how `VerificationWriteApi` chooses
       between writing `competitor.bio` and `competitor.photo_id`. The screen draws
       them differently and must send for both; written against one sort only, a
       screen that worked for texts and not for pictures would pass, and a picture is
       the very thing the owner could not get approved. */
    const user = setupUser()
    const server = serverThatRecords()

    try {
      renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin', null, undefined, null, <Decided />)

      const waiting = within(await cardsIn())
      const cards = waiting.getAllByRole('listitem')

      for (const card of cards) {
        await user.click(within(card).getByRole('button', { name: 'Odobri' }))
      }

      /* Two biographies and two pictures, by the ids the generated queue carries, so
         this says which sorts went rather than only how many. */
      expect(decisionsIn(server.asked).map((one) => one.path)).toEqual([
        '/api/verification/ver-bio-1/decision',
        '/api/verification/ver-bio-2/decision',
        '/api/verification/ver-sli-1/decision',
        '/api/verification/ver-sli-2/decision',
      ])
    } finally {
      server.stop()
    }
  })

  it.each([
    [QUEUE.teams, 'ver-tim-1'],
    [QUEUE.comments, 'ver-kom-1'],
  ])('sends one from the queue of $id too, which is a different row', async (queue, id) => {
    /* One route, three rows, and the consequence of an approval differs on each: a
       team is made and its founder written into it, a comment is published onto its
       event, a profile has its text or its picture moved onto the member. Measured on
       more than one queue because „the screen sends" is satisfied by a screen that
       sends from one of them and not by the screen this change is about. */
    const user = setupUser()
    const server = serverThatRecords()

    try {
      renderAt(`/sr/${queue.path}`, 'superadmin', null, undefined, null, <Decided />)

      const waiting = within(await cardsIn())
      const first = within(waiting.getAllByRole('listitem')[0] ?? document.createElement('li'))

      await user.click(first.getByRole('button', { name: 'Odobri' }))

      expect(decisionsIn(server.asked).map((one) => one.path)).toEqual([
        `/api/verification/${id}/decision`,
      ])
    } finally {
      server.stop()
    }
  })

  it('leaves the card and the session untouched when the route refuses', async () => {
    /* THE ONE CASE THE WHOLE CHANGE IS FOR. The local view changes only in the branch
       that ran because the answer said it did, so a refusal has to leave BOTH things
       as they were: the card in the queue, and nothing in `decisions`. Read against
       the session rather than against the screen alone, because the screen emptying
       is what the fault looked like and the session is where the fault lived. */
    const user = setupUser()
    const server = serverThatRefuses(() => refused('O stavci je već odlučeno.', 409))

    try {
      renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin', null, undefined, null, <Decided />)

      const waiting = within(await cardsIn())
      const before = waiting.getAllByRole('listitem').length
      const first = within(waiting.getAllByRole('listitem')[0] ?? document.createElement('li'))

      await user.click(first.getByRole('button', { name: 'Odobri' }))

      /* The sentence arrives, which is what says the answer has been read at all. */
      expect(await screen.findByRole('alert')).toHaveTextContent('O stavci je već odlučeno.')
      expect(within(await cardsIn()).getAllByRole('listitem')).toHaveLength(before)
      expect(decidedIn().queryAllByRole('listitem')).toEqual([])
    } finally {
      server.stop()
    }
  })

  it('draws the reason WORD FOR WORD and never looks it up in the dictionary', async () => {
    /* THE SOURCE SWAP FOR AXIS 9, and it is the only mutation that parts the two
       readings. `VerificationWriteApi` refuses with a Serbian sentence rather than
       with a code, so the screen draws what came back; written `t(answer.reason)`
       instead, an unknown key comes back from `translate` unchanged and every other
       case here would still pass.
     *
       So the reason sent here IS a key of the dictionary. Drawn verbatim it reads
       `server.nothing`; looked up it reads „Portal nije uspeo da dođe do servera…",
       which is a sentence about something else entirely. */
    const user = setupUser()
    const server = serverThatRefuses(() => refused('server.nothing', 409))

    try {
      renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin', null, undefined, null, <Decided />)

      const waiting = within(await cardsIn())
      const first = within(waiting.getAllByRole('listitem')[0] ?? document.createElement('li'))

      await user.click(first.getByRole('button', { name: 'Odobri' }))

      const alert = await screen.findByRole('alert')

      expect(alert).toHaveTextContent('server.nothing')
      expect(alert).not.toHaveTextContent(/Portal nije uspeo/)
    } finally {
      server.stop()
    }
  })

  it.each([401, 404])(
    'says the number and settles nothing when the route answers %i',
    async (status) => {
      /* ADL A8, owner 13.09.2026: „neprijavljen dobija 401, a prijavljen kome pravo
         nedostaje dobija 404", and never 403. Neither carries a body, so neither
         carries a reason - `away()` in `VerificationWriteApi` is `sendError(404)` with
         nothing in it - and the sentence is the portal's own.
       *
         The 404 is the case that matters most on this screen and it is the one axis 8
         names: this moderator's LOCAL table of rights says he may decide this queue,
         which is why the screen drew him the card and the button at all. The route
         says the address is not there. If the card left the queue anyway the screen
         would be enforcing the right by itself, which is the whole of what A8 refuses. */
      const user = setupUser()
      const server = serverThatRefuses(() => answeredWith(status))

      try {
        renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin', null, undefined, null, <Decided />)

        const waiting = within(await cardsIn())
        const before = waiting.getAllByRole('listitem').length
        const first = within(waiting.getAllByRole('listitem')[0] ?? document.createElement('li'))

        await user.click(first.getByRole('button', { name: 'Odobri' }))

        expect(await screen.findByRole('alert')).toHaveTextContent(
          `Server je odgovorio brojem ${String(status)} i ništa nije promenjeno.`,
        )
        expect(within(await cardsIn()).getAllByRole('listitem')).toHaveLength(before)
        expect(decidedIn().queryAllByRole('listitem')).toEqual([])
      } finally {
        server.stop()
      }
    },
  )

  it('says so when the token did not match, which is its own answer', async () => {
    /* 403 is not a refusal by name and not „the address is not there": it is the one
       answer that means the request could not be proved to come from this page
       (`askTheServer`, `got: 'rejected'`). Told apart because the way out of it is to
       reload rather than to change anything about the item. */
    const user = setupUser()
    const server = serverThatRefuses(() => answeredWith(403))

    try {
      renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin', null, undefined, null, <Decided />)

      const waiting = within(await cardsIn())
      const first = within(waiting.getAllByRole('listitem')[0] ?? document.createElement('li'))

      await user.click(first.getByRole('button', { name: 'Odobri' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/nije uspeo da dokaže serveru/)
      expect(decidedIn().queryAllByRole('listitem')).toEqual([])
    } finally {
      server.stop()
    }
  })

  it('says so when the request never got an answer at all', async () => {
    const user = setupUser()
    const server = serverThat((path, init) =>
      init?.method === 'POST' && path.includes('/decision')
        ? Promise.reject(new Error('no connection'))
        : null,
    )

    try {
      renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin', null, undefined, null, <Decided />)

      const waiting = within(await cardsIn())
      const first = within(waiting.getAllByRole('listitem')[0] ?? document.createElement('li'))

      await user.click(first.getByRole('button', { name: 'Odobri' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/nije uspeo da dođe do servera/)
      expect(decidedIn().queryAllByRole('listitem')).toEqual([])
    } finally {
      server.stop()
    }
  })

  it('tells the member nothing when the route would not record the refusal', async () => {
    /* PDL P22: the reason reaches the inbox of whoever sent the item in. That is a
       consequence of a decision that has been RECORDED, so a refusal the route turned
       down must not send it - a member told „your picture was sent back" about a row
       still standing in `waiting` is the fault of this whole change with the sign
       flipped. */
    const user = setupUser()
    const server = serverThatRefuses(() => refused('Uz odbijanje je razlog obavezan.'))

    try {
      renderAt(
        `/sr/${QUEUE.profiles.path}`,
        'superadmin',
        '000010',
        undefined,
        null,
        <>
          <Decided />
          <Inbox />
          <OneMessageThatIsNotADecision />
        </>,
      )

      const waiting = within(await cardsIn())
      const first = within(waiting.getAllByRole('listitem')[0] ?? document.createElement('li'))

      await user.click(first.getByRole('button', { name: 'Odbij' }))
      await user.type(await screen.findByLabelText(/^Razlog odbijanja/), 'Nejasno.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Uz odbijanje je razlog obavezan.',
      )
      /* The box has closed with the answer (owner, 02.10.2026), so the sentence is what stands over
         the buttons it left behind, and the words typed into it went with it. */
      expect(screen.queryByLabelText(/^Razlog odbijanja/)).not.toBeInTheDocument()
      expect(decidedIn().queryAllByRole('listitem')).toEqual([])
      /* Signed in as the member `ver-bio-1` itself names (`memberNumber` "000010"
         in `public/mock/verification.json`), so a message that reached them
         would show up here. Matched by the heading a bio refusal is sent under
         and not by an empty list, the same way `adminFlows.test.tsx` reads this
         list for the payments queue. `decisions` above says nothing was RECORDED;
         this says the ONE message a recorded refusal would carry was not WRITTEN
         either - the mistake this guards against is `handBack` notifying on the
         branch that returns early instead of the one that settles.

         **The floor under „not by an empty list" is asserted first, and since
         28.09.2026 it is one this case puts there** (`OneMessageThatIsNotADecision`
         above): the bundle used to seed two broadcasts into every session, and PDL
         34 took them out, so without a line of its own this absence would hold over
         a list that is empty whatever the screen does. */
      const inbox = within(screen.getByRole('list', { name: 'session inbox' }))

      expect(inbox.getByText(/Članarina je evidentirana/)).toBeVisible()
      expect(inbox.queryByText(new RegExp(sr.verification.bioReturned))).toBeNull()
    } finally {
      server.stop()
    }
  })

  it('counts only what the route settled when a sweep meets a refusal', async () => {
    /* The line under the button already said the smaller number for a proposal whose
       name was taken; a card the route refused is the same shape of thing. Measured
       with a server that takes the first and refuses everything after it, so the
       number cannot be „all" or „none" by accident. */
    const user = setupUser()
    let answered = 0
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const server = serverThat((path, init) => {
      if (init?.method !== 'POST' || !path.includes('/decision')) {
        return null
      }

      answered += 1

      return answered === 1
        ? new Response(JSON.stringify({ id: 1, state: 'approved' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : refused('O stavci je već odlučeno.', 409)
    })

    try {
      renderAt(`/sr/${QUEUE.comments.path}`, 'superadmin', null, undefined, null, <Decided />)

      await cardsIn()
      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      /* One, two and five are three different sentences in Serbian, so the shape is
         what is matched (`admin/deleting.test.tsx` says the same). */
      expect(await screen.findByText(/^Rešen.* 1 stavk/)).toBeVisible()
      expect(decidedIn().getAllByRole('listitem')).toHaveLength(1)
      /* And every one of the four was asked about, so the walk did not stop at the
         first refusal. */
      expect(decisionsIn(server.asked)).toHaveLength(4)
    } finally {
      server.stop()
      confirm.mockRestore()
    }
  })

  it('a second press before the first has answered settles nothing twice, on the sweep or on a card', async () => {
    /* VISOK 1, review of PR 380. Neither button carried a guard while a walk was
       still out, so two presses before the first answer landed walked the same four
       waiting items twice - eight requests for four rows - and the line under the
       button ended up reporting whichever walk's `setSwept` happened to land last,
       which measured „Rešeno je 0 stavki." while all four had in fact been decided
       (the sweep's own comment above `approveAll`: "the count has to be the ones
       that went through or the line under the button would say a number the queue
       disagrees with").
     *
       Fired with `fireEvent` and not through `user`: `user.click` awaits its own
       click through to completion, so two of those could never be out at the same
       time, and the fault only shows with more than one walk in flight at once -
       which is what a real double press, or a card pressed while the sweep is
       still working through it, both are. */
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const answeredTimes: Record<string, number> = {}
    const server = serverThat((path, init) => {
      if (init?.method !== 'POST' || !path.includes('/decision')) {
        return null
      }

      answeredTimes[path] = (answeredTimes[path] ?? 0) + 1

      return answeredTimes[path] === 1
        ? new Response(JSON.stringify({ id: 1, state: 'approved' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : refused('O stavci je već odlučeno.', 409)
    })

    try {
      renderAt(`/sr/${QUEUE.comments.path}`, 'superadmin', null, undefined, null, <Decided />)

      const waiting = within(await cardsIn())
      const sweep = screen.getByRole('button', { name: 'Odobri sve' })
      const firstCard = waiting.getAllByRole('listitem')[0] ?? document.createElement('li')
      const firstApprove = within(firstCard).getByRole('button', { name: 'Odobri' })

      /* Three presses before any of them has been let to answer: the sweep twice,
         the way the review measured it, and a single card's own button once more -
         the other door this screen guards with the same flag. */
      fireEvent.click(sweep)
      fireEvent.click(sweep)
      fireEvent.click(firstApprove)

      expect(await screen.findByText(/^Rešen.* 4 stavk/)).toBeVisible()
      expect(decidedIn().getAllByRole('listitem')).toHaveLength(4)
      /* Four rows, four requests - not eight from the two sweeps, and not a fifth
         for the row the card pressed a second time. */
      expect(decisionsIn(server.asked)).toHaveLength(4)
    } finally {
      server.stop()
      confirm.mockRestore()
    }
  })

  it('opens the card the route refused, because on a telephone it is folded shut', async () => {
    /* THE ONE PLACE THE SENTENCE COULD HAVE BEEN DRAWN AND STILL NOT BEEN READABLE.
     *
       `Verification.css` gives `.pending__card` `display: none` below 51.25em and
       only `--open` brings it back, and the sentence is inside that card. From a
       single card that is harmless: the buttons are inside the fold too, so the
       moderator has already opened it. „Odobri sve" is NOT - it sits in the bar
       outside every card - so a refusal met during a sweep would land in a card still
       folded, and the count would drop with nothing anywhere saying why. That is the
       same fault `admin/verificationStyle.test.ts` exists for, one line further on.
     *
       Measured through `aria-expanded` rather than through the class, because that is
       what a moderator reading the screen is told and jsdom applies no stylesheet
       anyway. ONE card open and not „at least one": the fix is that the refused card
       opens, and a screen that opened all four would satisfy a weaker claim while
       being the scrolling the fold was written to end. */
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const server = serverThat((path, init) =>
      init?.method !== 'POST' || !path.includes('/decision')
        ? null
        : path.includes('ver-kom-2')
          ? refused('Stavku trenutno drži drugi moderator.', 409)
          : new Response(JSON.stringify({ id: 1, state: 'approved' }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
    )

    try {
      renderAt(`/sr/${QUEUE.comments.path}`, 'superadmin', null, undefined, null, <Decided />)

      await cardsIn()

      /* Nothing is open before the press, which is what makes the assertion below
         about the refusal rather than about how the screen happens to start. */
      expect(screen.queryAllByRole('button', { expanded: true })).toEqual([])

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Stavku trenutno drži drugi moderator.',
      )

      const open = screen.getAllByRole('button', { expanded: true })

      expect(open).toHaveLength(1)
      expect(open[0]).toHaveAccessibleName(/Srebrno jezero polumaraton/)
    } finally {
      server.stop()
      confirm.mockRestore()
    }
  })

  it('asks the server again after a decision, rather than reading what this visit fetched', async () => {
    /* AXIS 6, and the fault is one a review of PR 368 already found once on the
       competitions: a decision recorded on the server and patched only into the local
       overlay is a decision a remounted screen has never heard of, so the card comes
       back and is decided twice.
     *
       The source swap is the whole of the case: the SECOND reading of the queue
       answers something different from the first. A screen that kept the cached array
       draws the first answer and this fails; one that asks again draws the second. */
    const user = setupUser()
    let reads = 0
    const server = serverThat((path, init) => {
      if (init?.method === 'POST' && path.includes('/decision')) {
        return new Response(JSON.stringify({ id: 1, state: 'approved' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      if (path !== '/api/verification') {
        return null
      }

      reads += 1

      return new Response(
        JSON.stringify([
          {
            id: reads === 1 ? 7001 : 7002,
            queue: 'profiles',
            kind: 'bio',
            date: '2026-07-01',
            memberNumber: '000010',
            who: 'Miloje Stanojlović',
            subject: reads === 1 ? 'Prvo čitanje' : 'Drugo čitanje',
            subjectId: '10',
            body: 'Tekst o sebi.',
            photoId: null,
            rating: { organisation: 0, value: 0, ambience: 0 },
            city: '',
            country: 'RS',
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })

    try {
      const first = renderAt(
        `/sr/${QUEUE.profiles.path}`,
        'superadmin',
        null,
        undefined,
        null,
        <Decided />,
      )

      const waiting = within(await cardsIn())

      expect(waiting.getByText('Prvo čitanje')).toBeVisible()

      await user.click(waiting.getByRole('button', { name: 'Odobri' }))
      await screen.findByText('Nema nijedne stavke na čekanju.')

      first.unmount()

      renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin', null, undefined, null, <Decided />)

      /* The second answer, which only a screen that asked again can be holding. */
      expect(within(await cardsIn()).getByText('Drugo čitanje')).toBeVisible()
      expect(reads).toBe(2)
    } finally {
      server.stop()
    }
  })
})

/**
 * A REFUSAL THAT IS OUT WITH THE ROUTE: THE BOX CANNOT BE PUT AWAY, AND IT CANNOT BE SENT TWICE
 * (owner, 02.10.2026, choosing between three outcomes he was priced; PDL, „Odluke iz ciscenja
 * nalaza", first item: „Ne", „Odustani" and Escape are onemoguceni while the request travels. It
 * holds for every screen with a confirmation, and a box that asks for the reason a refusal is
 * written with is one).
 *
 * <p><b>What the box did until then, measured.</b> „Odbij uz ovaj razlog" sent the decision and
 * `handBack` kept NO record of it being out: „Odustani" closed the box over a request that went on,
 * so a refusal arriving afterwards was drawn above buttons with the typed reason already gone, and
 * a second press on „Odbij uz ovaj razlog" sent a second decision for the same card - the route
 * answered it 409 and the moderator was told his first one had failed.
 *
 * <p><b>The answer is HELD</b>, a promise that has not come back (`test/serverAnswers.ts` says why
 * it is the only way to measure a screen while it waits), so every case can press and inspect the
 * box before the route says anything.
 */
describe('a refusal that is out with the route', () => {
  /** The box opened on the first card of the profiles, a reason typed, and the refusal sent. */
  async function sendTheRefusal(user: ReturnType<typeof setupUser>) {
    renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin', null, undefined, null, <Decided />)

    const waiting = within(await cardsIn())
    const first = within(waiting.getAllByRole('listitem')[0] ?? document.createElement('li'))

    await user.click(first.getByRole('button', { name: 'Odbij' }))
    await user.type(await screen.findByLabelText(/^Razlog odbijanja/), 'Tekst je prekratak.')
    await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))
  }

  it('tells „Odustani" off, and keeps the box with what was typed in it', async () => {
    const user = setupUser()
    const { server, settle } = serverThatHoldsTheDecision()

    try {
      await sendTheRefusal(user)

      const keep = screen.getByRole('button', { name: 'Odustani' })

      /* TOLD OFF AND NOT SWITCHED OFF, which is how this box already tells off its confirming
         button: `disabled` would take the control out of the tab order. */
      expect(keep).toHaveAttribute('aria-disabled', 'true')
      expect(keep).not.toBeDisabled()

      await user.click(keep)

      /* THE BOX IS STILL THERE, with the reason in it: put away, it took the moderator's words
         with it and a refusal that arrived afterwards had nothing beside it to be read against. */
      expect(screen.getByLabelText(/^Razlog odbijanja/)).toHaveValue('Tekst je prekratak.')

      settle(refusal)

      /* AND THE ANSWER CLOSES THE BOX, which „Odustani" could not: the sentence is the answer, over
         the buttons the box leaves behind (owner, 02.10.2026). */
      expect(await screen.findByRole('alert')).toHaveTextContent('O stavci je već odlučeno.')
      expect(screen.queryByLabelText(/^Razlog odbijanja/)).not.toBeInTheDocument()
    } finally {
      server.stop()
    }
  })

  it('says that it is sending, only while it is', async () => {
    const user = setupUser()
    const { server, settle } = serverThatHoldsTheDecision()

    try {
      await sendTheRefusal(user)

      expect(sending()).toHaveLength(1)

      settle(refusal)
      await screen.findByRole('alert')

      expect(sending()).toHaveLength(0)
    } finally {
      server.stop()
    }
  })

  it('closes the box by itself when the decision goes through', async () => {
    const user = setupUser()
    const { server, settle } = serverThatHoldsTheDecision()

    try {
      await sendTheRefusal(user)
      await user.click(screen.getByRole('button', { name: 'Odustani' }))

      settle(
        () =>
          new Response(JSON.stringify({ id: 1, state: 'rejected' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      )

      await waitFor(() => {
        expect(screen.queryByLabelText(/^Razlog odbijanja/)).not.toBeInTheDocument()
      })
      expect(decidedIn().getAllByRole('listitem')).toHaveLength(1)
      expect(decisionsIn(server.asked)).toHaveLength(1)
    } finally {
      server.stop()
    }
  })

  it('sends one decision for two presses with nothing awaited between them', async () => {
    /* TWO RAW CLICKS IN ONE `act`, for the reason the double-press case above gives: `user.click`
       awaits its own click through and lets React render, so the flag beside the guard would
       already have caught up. Nothing commits between these two. */
    const user = setupUser()
    const { server, settle } = serverThatHoldsTheDecision()

    try {
      renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin', null, undefined, null, <Decided />)

      const waiting = within(await cardsIn())
      const first = within(waiting.getAllByRole('listitem')[0] ?? document.createElement('li'))

      await user.click(first.getByRole('button', { name: 'Odbij' }))
      await user.type(await screen.findByLabelText(/^Razlog odbijanja/), 'Tekst je prekratak.')

      const send = screen.getByRole('button', { name: 'Odbij uz ovaj razlog' })

      act(() => {
        send.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        send.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      /* COUNTED AFTER THE ANSWER HAS COME, because the request leaves a few turns after the press
         (the token is read first): counted at once, a second request still on its way would read
         as one that was never sent. */
      settle(refusal)
      await screen.findByRole('alert')

      expect(decisionsIn(server.asked)).toHaveLength(1)
    } finally {
      server.stop()
    }
  })

  it('does not tell a box off for a decision that is not its own, and sends what it is pressed for', async () => {
    /* A SOURCE REPLACEMENT, ASKED AS A CASE: „a request is out for THIS box" against „a request is
       out". `deciding` is true for a whole sweep as well, and a box opened on another card while the
       sweep is held has nothing of its own out - its buttons must answer, or a moderator who opened
       it to write a note would be told off by work that is not his. The sweep is held at its first
       decision, which is the state this case is about. */
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { server, settle } = serverThatHoldsTheDecision()

    try {
      renderAt(`/sr/${QUEUE.comments.path}`, 'superadmin', null, undefined, null, <Decided />)

      const cards = within(await cardsIn()).getAllByRole('listitem')

      expect(cards.length, 'a card for the box and others for the sweep').toBeGreaterThan(1)

      fireEvent.click(screen.getByRole('button', { name: 'Odobri sve' }))

      const last = within(cards[cards.length - 1] ?? document.createElement('li'))

      await user.click(last.getByRole('button', { name: /^Obriši:/ }))

      expect(screen.getByRole('button', { name: 'Odustani' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      )
      expect(screen.getByRole('button', { name: 'Obriši komentar' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      )
      expect(sending()).toHaveLength(0)

      await user.click(screen.getByRole('button', { name: 'Odustani' }))

      expect(screen.queryByRole('button', { name: 'Obriši komentar' })).not.toBeInTheDocument()

      /* AND IT SENDS WHAT IT IS PRESSED FOR, which the attributes above cannot say and which is the
         half of this case that was missing: it read the box as live and never pressed it, so a
         press that was silently dropped beside a button that looked live - the guard asked
         `outstanding`, the whole sweep's, while the display asked the card's own - read as green.
         The box is opened again and pressed, and the decision for THAT card is on its way. */
      await user.click(last.getByRole('button', { name: /^Obriši:/ }))
      await user.click(screen.getByRole('button', { name: 'Obriši komentar' }))

      await waitFor(() => {
        expect(
          decisionsIn(server.asked).filter(
            (one) => one.path === '/api/verification/ver-kom-4/decision',
          ),
        ).toHaveLength(1)
      })

      settle(
        () =>
          new Response(JSON.stringify({ id: 1, state: 'approved' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      )
      await screen.findByText(/^Rešen.* \d+ stavk/)
    } finally {
      server.stop()
      confirm.mockRestore()
    }
  })

})

/**
 * A REFUSAL CLOSES THE BOX AS A SUCCESS DOES (owner, 02.10.2026; PDL, „Odbijanje zatvara pitanje kao
 * i uspeh": „na svaki odgovor servera pitanje se zatvara, a razlog odbijanja stoji uz dugme").
 *
 * <p><b>What the box did until then, measured.</b> A decision the route took closed it; one the route
 * refused left it open with the reason typed and both buttons live again - so two answers to one
 * question left the screen in two states, and the activation, which closes on both, was the third.
 * What it costs is in the decision and the owner accepted it: a refusal that comes back „Uz odbijanje
 * je razlog obavezan." now finds the box gone and the typed words with it.
 *
 * <p>The sentence stays where this screen has always drawn it, on the card and above the buttons the
 * box leaves behind (`WhatTheServerSaid`), which is beside the one that asked; the focus goes to that
 * button, because the one that had it left with the box.
 */
describe('when the route refuses a refusal', () => {
  type Way = {
    name: string
    path: string
    /** What opens the box on a card of that queue. */
    opener: string | RegExp
    /** The words typed into it, where it asks for any. */
    typed: string
    /** What its confirming button is called. */
    confirm: string
  }

  const WAYS: Way[] = [
    {
      name: 'the profiles',
      path: QUEUE.profiles.path,
      opener: 'Odbij',
      typed: 'Tekst je prekratak.',
      confirm: 'Odbij uz ovaj razlog',
    },
    {
      /* The comments have a button of their own to open the box, and it is a second place the focus
         has to come back to: one that was left out would leave this queue the only one that drops it. */
      name: 'the comments',
      path: QUEUE.comments.path,
      opener: /^Obriši:/,
      typed: '',
      confirm: 'Obriši komentar',
    },
  ]

  describe.each(WAYS)('on the queue of $name', (way) => {
    /** The box opened on the first card, the words typed where it asks for them, and the refusal sent. */
    async function refuseTheFirstCard(user: ReturnType<typeof setupUser>) {
      renderAt(`/sr/${way.path}`, 'superadmin', null, undefined, null, <Decided />)

      const first = within(
        within(await cardsIn()).getAllByRole('listitem')[0] ?? document.createElement('li'),
      )

      await user.click(first.getByRole('button', { name: way.opener }))

      if (way.typed !== '') {
        await user.type(await screen.findByLabelText(/^Razlog odbijanja/), way.typed)
      }

      await user.click(screen.getByRole('button', { name: way.confirm }))

      return first
    }

    it('closes the box by itself, with the sentence on the card and the focus on the button that opened it', async () => {
      const user = setupUser()
      const { server, settle } = serverThatHoldsTheDecision()

      try {
        const first = await refuseTheFirstCard(user)

        settle(refusal)

        expect(await first.findByRole('alert')).toHaveTextContent('O stavci je već odlučeno.')
        expect(screen.queryByRole('button', { name: way.confirm })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Odustani' })).not.toBeInTheDocument()
        expect(sending()).toHaveLength(0)
        expect(first.getByRole('button', { name: way.opener })).toHaveFocus()
        /* And nothing was recorded, which is what a refusal is. */
        expect(decidedIn().queryAllByRole('listitem')).toEqual([])
      } finally {
        server.stop()
      }
    })

    it('can be asked again, and the second asking is sent', async () => {
      /* The guard against a second press is a ref, and one left standing after the answer would
         answer every press with nothing, beside a button that looks live. */
      const user = setupUser()
      const { server, settle } = serverThatHoldsTheDecision()

      try {
        const first = await refuseTheFirstCard(user)

        settle(refusal)
        await first.findByRole('alert')

        await user.click(first.getByRole('button', { name: way.opener }))

        if (way.typed !== '') {
          await user.type(await screen.findByLabelText(/^Razlog odbijanja/), way.typed)
        }

        await user.click(screen.getByRole('button', { name: way.confirm }))

        await waitFor(() => {
          expect(decisionsIn(server.asked)).toHaveLength(2)
        })
      } finally {
        server.stop()
      }
    })

    it('puts a box asked again after a refusal away, and starts it empty', async () => {
      /* The half the old case of „lets the box be sent again, and put away, once a refusal is in"
         measured: whatever the first attempt raised is let go of, so the way out of the second box is
         open - and the words typed into the first went with it, which is the price the owner was
         shown. */
      const user = setupUser()
      const { server, settle } = serverThatHoldsTheDecision()

      try {
        const first = await refuseTheFirstCard(user)

        settle(refusal)
        await first.findByRole('alert')

        await user.click(first.getByRole('button', { name: way.opener }))

        if (way.typed !== '') {
          const field = await screen.findByLabelText(/^Razlog odbijanja/)

          expect(field).toHaveValue('')

          /* Told off while the reason is empty, which is the box's own state and not a leftover: it is
             the words that let it send, so they are typed before it is asked. */
          await user.type(field, way.typed)
        }

        const keep = screen.getByRole('button', { name: 'Odustani' })

        expect(keep).not.toHaveAttribute('aria-disabled', 'true')
        expect(screen.getByRole('button', { name: way.confirm })).not.toHaveAttribute(
          'aria-disabled',
          'true',
        )
        expect(sending()).toHaveLength(0)

        await user.click(keep)

        expect(screen.queryByRole('button', { name: way.confirm })).not.toBeInTheDocument()
        expect(first.getByRole('button', { name: way.opener })).toHaveFocus()
      } finally {
        server.stop()
      }
    })
  })

  /**
   * THE ANSWER IS FOR ONE CARD, AND IT CLOSES THAT CARD'S BOX AND NO OTHER. Nothing stops a moderator
   * from opening the box on a second card while the first one's refusal is still out - the box on the
   * first is replaced - and the answer that comes back for the first must not take the second's away
   * with the words he has begun to write in it. The success of this was `setOpen(null)`, which closes
   * whichever box is open.
   */
  const ANSWERS: [string, () => Response][] = [
    ['goes through', taken],
    ['is refused', refusal],
  ]

  it.each(ANSWERS)('leaves the box on another card alone when the answer %s', async (_, answer) => {
    const user = setupUser()
    const { server, settle } = serverThatHoldsTheDecision()

    try {
      renderAt(`/sr/${QUEUE.comments.path}`, 'superadmin', null, undefined, null, <Decided />)

      const cards = within(await cardsIn()).getAllByRole('listitem')
      const last = within(cards[3] ?? document.createElement('li'))
      const third = within(cards[2] ?? document.createElement('li'))

      await user.click(last.getByRole('button', { name: /^Obriši:/ }))
      await user.click(screen.getByRole('button', { name: 'Obriši komentar' }))
      await waitFor(() => {
        expect(decisionsIn(server.asked)).toHaveLength(1)
      })

      /* The box on the last card is replaced, with its request still out. */
      await user.click(third.getByRole('button', { name: /^Obriši:/ }))
      expect(third.getByRole('button', { name: 'Obriši komentar' })).toBeInTheDocument()

      settle(answer)

      /* The answer has been taken in: the decision is recorded, or the sentence is on the card. */
      await waitFor(() => {
        expect(
          decidedIn().queryAllByRole('listitem').length + last.queryAllByRole('alert').length,
        ).toBe(1)
      })

      expect(third.getByRole('button', { name: 'Obriši komentar' })).toBeInTheDocument()
    } finally {
      server.stop()
    }
  })
})

/**
 * EVERY STATE A CONFIRMING PRESS CAN MEET ON THE COMMENTS QUEUE, AND ONE CLAIM ASKED OF ALL OF THEM.
 *
 * <p><b>The fault, measured by the review of this branch (02.10.2026) and not imagined.</b> „Odobri
 * sve" holds a walk (`outstanding`) for as long as it is out, and the hand-back's own guard asked that
 * same flag: a moderator who opened the box on a card the sweep had not reached and pressed „Obriši
 * komentar" pressed a button that read live (`aria-disabled="false"`, because the DISPLAY asked the
 * card's own request) and sent nothing. The sweep then reached that card and approved it. One fact
 * with two homes that disagree - and the case that should have caught it read the box as live and
 * never pressed it.
 *
 * <p><b>So the claim every state below is asked is the same one: a confirming button that is not
 * told off sends when it is pressed, and one that is told off sends nothing.</b> Read off the button
 * and off the server, and it is the DISAGREEMENT that fails, whichever way it lies. Each state also
 * writes down which of the two answers it gives (`toldOff`), so that a guard widened to tell off
 * every state, or narrowed to tell off none, cannot pass by agreeing with itself.
 */
describe('a confirming press, in every state the queue can be in', () => {
  const pathOf = (id: string) => `/api/verification/${id}/decision`

  /* The cards by the place they stand in the queue and by the item they are, which is what the
     address of a decision carries (`ver-kom-N` is the N-th comment waiting in the generated data). */
  const FIRST = { index: 0, id: 'ver-kom-1' }
  const THIRD = { index: 2, id: 'ver-kom-3' }
  const LAST = { index: 3, id: 'ver-kom-4' }

  /**
   * A server that holds the answer to the decisions on the cards it is told to, answers every other
   * one at once, and in which the FIRST decision for a card is the one that stands.
   *
   * <p>First, because that is what the route does (`VerificationWriteApi.decide`, `update ... where
   * state = 'waiting'`: the loser matches nothing and is told 409). It is decided when the request
   * ARRIVES and not when the answer is let go, so a held answer is a slow road back and not a late
   * decision. A server that answered every decision 200 would let the sweep's later approval overwrite
   * the moderator's refusal and read as though the refusal had never been sent, which is exactly the
   * picture the review drew and the one thing this case must be able to tell from the real one.
   *
   * <p><b>Each held card has a gate of its own, and `release` lets one go, or all.</b> One gate for
   * every card was enough while the question was whether a press is sent; it cannot say IN WHAT ORDER
   * two answers come back, and the order is the axis the review of round 2 found missing (the earlier
   * of two refusals answered first). `refusing` names the cards whose first decision the route refuses.
   */
  function serverThatHolds(held: string[], refusing: string[] = []) {
    const recorded = new Set<string>()
    const gates = new Map<string, { opens: () => void; shut: Promise<void> }>()

    for (const id of held) {
      let opens: () => void = () => {}
      const shut = new Promise<void>((resolve) => {
        opens = resolve
      })

      gates.set(pathOf(id), { opens, shut })
    }

    const server = serverThat((path, init) => {
      if (init?.method !== 'POST' || !path.includes('/decision')) {
        return null
      }

      const second = recorded.has(path)

      recorded.add(path)

      const answer = () =>
        second || refusing.some((id) => pathOf(id) === path)
          ? refused('O stavci je već odlučeno.', 409)
          : new Response(JSON.stringify({ id: 1, state: 'decided' }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })
      const gate = gates.get(path)

      return gate === undefined ? answer() : gate.shut.then(answer)
    })

    return {
      server,
      release: (id?: string) => {
        for (const [path, gate] of gates) {
          if (id === undefined || path === pathOf(id)) {
            gate.opens()
          }
        }
      },
    }
  }

  const countFor = (asked: Asked[], id: string) =>
    decisionsIn(asked).filter((one) => one.path === pathOf(id)).length

  /** Everything a case does to the page, written once. */
  async function pageWith(held: string[], refusing: string[] = []) {
    const user = setupUser()
    const { server, release } = serverThatHolds(held, refusing)

    renderAt(`/sr/${QUEUE.comments.path}`, 'superadmin', null, undefined, null, <Decided />)

    const cards = within(await cardsIn()).getAllByRole('listitem')

    /* Named by place, so a queue that grew or shrank would move every state under this table. */
    expect(cards).toHaveLength(4)

    return {
      user,
      server,
      release,
      sweep: () => fireEvent.click(screen.getByRole('button', { name: 'Odobri sve' })),
      card: (index: number) => within(cards[index] ?? document.createElement('li')),
      open: (card: number) =>
        user.click(
          within(cards[card] ?? document.createElement('li')).getByRole('button', {
            name: /^Obriši:/,
          }),
        ),
      confirm: () => screen.getByRole('button', { name: 'Obriši komentar' }),
      press: () => user.click(screen.getByRole('button', { name: 'Obriši komentar' })),
      /** The request leaves a few turns after the press (the token is read first), so it is waited for. */
      sentTo: (id: string, times: number) =>
        waitFor(() => {
          expect(countFor(server.asked, id)).toBe(times)
        }),
      /**
       * The answer for a card has been TAKEN IN: its decision is recorded, or the sentence of its
       * refusal is on its card. Its box is not on the page to say so - the box on the other card has
       * replaced it - so what is read is what the answer leaves behind.
       */
      answered: (card: { index: number; id: string }) =>
        waitFor(() => {
          const decided = decidedIn()
            .queryAllByRole('listitem')
            .some((one) => (one.textContent ?? '').startsWith(`${card.id} | `))
          const said =
            within(cards[card.index] ?? document.createElement('li')).queryAllByRole('alert').length > 0

          expect(decided || said, `the answer for ${card.id} has been taken in`).toBe(true)
        }),
    }
  }

  type Page = Awaited<ReturnType<typeof pageWith>>

  type Scene = {
    name: string
    /** The cards whose answer the route holds. */
    held: string[]
    /** The cards whose FIRST decision the route refuses, where a scene needs one that is. */
    refusing?: string[]
    /** Whether the state starts a sweep, which is what has to be waited out at the end. */
    sweeping: boolean
    /** Gets the screen into the state and leaves the box open on the card `target`. */
    arrange: (page: Page) => Promise<void>
    target: string
    /** What the button says in that state, written down so that no guard can agree with itself. */
    toldOff: boolean
  }

  const SCENES: Scene[] = [
    {
      name: 'nothing is out',
      held: [],
      sweeping: false,
      arrange: async (page) => {
        await page.open(LAST.index)
      },
      target: LAST.id,
      toldOff: false,
    },
    {
      name: 'a sweep is out, and the box is on a card it has not reached',
      held: [FIRST.id],
      sweeping: true,
      arrange: async (page) => {
        page.sweep()
        await page.open(LAST.index)
      },
      target: LAST.id,
      toldOff: false,
    },
    {
      name: 'a sweep is out, and the box is on the card it is asking about',
      held: [FIRST.id],
      sweeping: true,
      arrange: async (page) => {
        page.sweep()
        await page.open(FIRST.index)
      },
      target: FIRST.id,
      toldOff: false,
    },
    {
      name: 'the refusal of this very card is out',
      held: [LAST.id],
      sweeping: false,
      arrange: async (page) => {
        await page.open(LAST.index)
        await page.press()
        await page.sentTo(LAST.id, 1)
      },
      target: LAST.id,
      toldOff: true,
    },
    {
      name: 'the refusal of another card is out',
      held: [LAST.id],
      sweeping: false,
      arrange: async (page) => {
        await page.open(LAST.index)
        await page.press()
        await page.sentTo(LAST.id, 1)
        await page.open(THIRD.index)
      },
      target: THIRD.id,
      toldOff: false,
    },
    {
      name: 'a sweep is out, and the refusal of this very card is out',
      held: [FIRST.id, LAST.id],
      sweeping: true,
      arrange: async (page) => {
        page.sweep()
        await page.open(LAST.index)
        await page.press()
        await page.sentTo(LAST.id, 1)
      },
      target: LAST.id,
      toldOff: true,
    },
    {
      /* THE ANSWER OF ANOTHER CARD LETS GO OF ITS OWN CARD AND OF NO OTHER: a set that was emptied
         when any one refusal came back would leave this card's request out and its box live. */
      name: "the refusal of this very card is out, and another card's has come back",
      held: [LAST.id],
      sweeping: false,
      arrange: async (page) => {
        await page.open(LAST.index)
        await page.press()
        await page.sentTo(LAST.id, 1)
        await page.open(THIRD.index)
        await page.press()
        await page.sentTo(THIRD.id, 1)
        await waitFor(() => {
          expect(screen.queryByRole('button', { name: 'Obriši komentar' })).not.toBeInTheDocument()
        })
        await page.open(LAST.index)
      },
      target: LAST.id,
      toldOff: true,
    },
    /* THE ORDER OF TWO ANSWERS, which is the axis this table lacked until the review of round 2 (q6).
       The scene above has the LATER card's answer come back first, and a set that is let go of from the
       state of the render the press was made in passes it by accident: the later press was made after
       the earlier card was marked, so the state it carries still names it. The EARLIER answer first is
       the order that breaks it. Both cards are pressed, both answers are held, and the earlier is let go
       while the box of the later is open - one scene for an earlier that goes through and one for an
       earlier that is refused, because they leave the earlier card in two different states. */
    {
      name: 'two refusals are out, the earlier one has gone through, and the box of the later one is open',
      held: [LAST.id, THIRD.id],
      sweeping: false,
      arrange: async (page) => {
        await page.open(LAST.index)
        await page.press()
        await page.sentTo(LAST.id, 1)
        await page.open(THIRD.index)
        await page.press()
        await page.sentTo(THIRD.id, 1)
        page.release(LAST.id)
        await page.answered(LAST)
      },
      target: THIRD.id,
      toldOff: true,
    },
    {
      name: 'two refusals are out, the earlier one has been refused, and the box of the later one is open',
      held: [LAST.id, THIRD.id],
      refusing: [LAST.id],
      sweeping: false,
      arrange: async (page) => {
        await page.open(LAST.index)
        await page.press()
        await page.sentTo(LAST.id, 1)
        await page.open(THIRD.index)
        await page.press()
        await page.sentTo(THIRD.id, 1)
        page.release(LAST.id)
        await page.answered(LAST)
      },
      target: THIRD.id,
      toldOff: true,
    },
    {
      /* AND THE OTHER HALF OF THE SAME ORDER: what the earlier answer left behind. A card that was
         refused first and asked again once both are in must be live and must not say it is sending; the
         set that was let go of from a stale state kept it, and the box of a card nothing was out for
         stayed on „Šalje se". */
      name: 'two refusals were out, the earlier was refused and the later went through, and the refused card is asked again',
      held: [LAST.id, THIRD.id],
      refusing: [LAST.id],
      sweeping: false,
      arrange: async (page) => {
        await page.open(LAST.index)
        await page.press()
        await page.sentTo(LAST.id, 1)
        await page.open(THIRD.index)
        await page.press()
        await page.sentTo(THIRD.id, 1)
        page.release(LAST.id)
        await page.answered(LAST)
        page.release(THIRD.id)
        await page.answered(THIRD)
        await page.open(LAST.index)
      },
      target: LAST.id,
      toldOff: false,
    },
  ]

  it.each(SCENES)('$name', async (scene) => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const page = await pageWith(scene.held, scene.refusing)

    try {
      await scene.arrange(page)

      const button = page.confirm()
      const toldOff = button.getAttribute('aria-disabled') === 'true'
      const before = countFor(page.server.asked, scene.target)

      /* WHAT THE BUTTON SAYS IS WRITTEN DOWN, and the press is the other half of the claim. */
      expect(toldOff).toBe(scene.toldOff)

      /* AND THE SENTENCE SAYS THE SAME AS THE BUTTON: a box that is told off says it is sending, and one
         that is not says nothing. Both read what the box is handed (`working`), so a state in which
         they differ is a state in which one of them reads a second home. */
      expect(sending(), 'the sentence that a request is out').toHaveLength(toldOff ? 1 : 0)

      await page.user.click(button)

      /* THE CLAIM, counted BEFORE anything is let go: the sweep's own request for the same card
         arrives after that, and would be counted as the press's. */
      const sent = () => countFor(page.server.asked, scene.target) - before

      if (toldOff) {
        /* One turn of the event loop, which is longer than a request takes to leave a press (the
           token is read first, a few promises) and so long enough to say „nothing was sent". */
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0))
        })

        expect(sent(), 'a button that is told off sends nothing').toBe(0)
      } else {
        await waitFor(() => {
          expect(sent(), 'a button that is not told off sends').toBeGreaterThan(0)
        })

        /* It was this press that sent it, and what it sent is the refusal: the request at the place
           the count stood at is the first one after the press, whatever the sweep sends later. */
        const mine = decisionsIn(page.server.asked).filter(
          (one) => one.path === pathOf(scene.target),
        )[before]

        expect(bodyOf(mine)).toEqual({ approved: false, reason: '' })
      }

      /* Let everything go, so that nothing is left in flight when the case ends. */
      page.release()

      if (scene.sweeping) {
        await screen.findByText(/^Rešen.* \d+ stavk/)
      }

      await waitFor(() => {
        expect(sending()).toHaveLength(0)
      })
    } finally {
      page.server.stop()
      confirm.mockRestore()
    }
  })

  it('keeps the refusal of a card the sweep had not reached, and lets the sweep settle the rest', async () => {
    /* THE REVIEW'S OWN PICTURE, as a whole: four waiting, the sweep held on the first, the box opened
       on the last and pressed. What the moderator decided is what stands - the route records the
       first decision it receives for a card - and the sweep is told so by the one it was refused. */
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const page = await pageWith([FIRST.id])

    try {
      page.sweep()
      await page.open(LAST.index)
      await page.press()
      await page.sentTo(LAST.id, 1)

      page.release()
      await screen.findByText(/^Rešen.* 3 stavk/)

      const decided = decidedIn()
        .getAllByRole('listitem')
        .map((one) => one.textContent ?? '')
      const line = (id: string) => decided.find((one) => one.startsWith(`${id} | `)) ?? ''

      expect(line(LAST.id)).toMatch(/^ver-kom-4 \| rejected \|/)
      expect(line(FIRST.id)).toMatch(/^ver-kom-1 \| approved \|/)
      expect(line('ver-kom-2')).toMatch(/^ver-kom-2 \| approved \|/)
      expect(line(THIRD.id)).toMatch(/^ver-kom-3 \| approved \|/)
    } finally {
      page.server.stop()
      confirm.mockRestore()
    }
  })

  it('does not stop another card from being approved while a refusal is out', async () => {
    /* WHAT THIS GUARD DOES NOT TAKE FROM THE SCREEN, asked as a case. The first version marked the
       whole walk (`outstanding`) while a refusal was out, so „Odobri" on any other card, and the sweep
       with it, were told off for work that was not theirs - a prohibition `main` never had, with no
       sentence to say why. The box is the only thing a refusal out for one card may switch off. */
    const page = await pageWith([LAST.id])

    try {
      await page.open(LAST.index)
      await page.press()
      await page.sentTo(LAST.id, 1)

      const approve = page.card(FIRST.index).getByRole('button', { name: 'Odobri' })

      expect(approve).not.toHaveAttribute('aria-disabled', 'true')

      await page.user.click(approve)
      await page.sentTo(FIRST.id, 1)

      expect(
        bodyOf(decisionsIn(page.server.asked).find((one) => one.path === pathOf(FIRST.id))),
      ).toEqual({ approved: true, reason: '' })

      page.release()
    } finally {
      page.server.stop()
    }
  })
})
