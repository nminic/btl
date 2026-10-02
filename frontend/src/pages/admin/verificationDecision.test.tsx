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
      /* The box is still open with the typed reason in it, which is why the sentence is
         drawn above it rather than among the buttons: the moderator reads why and
         presses again instead of typing it a second time. */
      expect(screen.getByLabelText(/^Razlog odbijanja/)).toHaveValue('Nejasno.')
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
  /**
   * A server whose answer to the decision is held until `settle` is called.
   *
   * <p>`settle` takes a FUNCTION that makes the answer, not the answer: a `Response` body can be
   * read once, so one handed to two requests would be spent by the first and the second would meet
   * a body that is already gone - which reads exactly like a server that never answered.
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

  /** The box opened on the first card of the profiles, a reason typed, and the refusal sent. */
  async function sendTheRefusal(user: ReturnType<typeof setupUser>) {
    renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin', null, undefined, null, <Decided />)

    const waiting = within(await cardsIn())
    const first = within(waiting.getAllByRole('listitem')[0] ?? document.createElement('li'))

    await user.click(first.getByRole('button', { name: 'Odbij' }))
    await user.type(await screen.findByLabelText(/^Razlog odbijanja/), 'Tekst je prekratak.')
    await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))
  }

  const refusal = () =>
    new Response(JSON.stringify({ reason: 'O stavci je već odlučeno.' }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    })

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

      expect(await screen.findByRole('alert')).toHaveTextContent('O stavci je već odlučeno.')
      expect(screen.getByLabelText(/^Razlog odbijanja/)).toHaveValue('Tekst je prekratak.')
      expect(screen.getByRole('button', { name: 'Odustani' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      )
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

  it('lets the box be sent again, and put away, once a refusal is in', async () => {
    /* THE OTHER END OF THE SAME STATE: a refusal leaves the box open with the reason typed, so the
       moderator can read why and press again. A flag that stayed raised would leave him a box with
       two buttons that do nothing. */
    const user = setupUser()
    const { server, settle } = serverThatHoldsTheDecision()

    try {
      await sendTheRefusal(user)

      settle(refusal)
      await screen.findByRole('alert')

      /* `aria-disabled="false"` is how this box has always said a button is live (the attribute is
         written as a boolean), so the question is whether it is `true`, not whether it is there. */
      expect(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      )

      /* AND IT REALLY SENDS AGAIN, which the attribute cannot say: the guard that refuses a second
         press while one is out is a ref, and one left standing after the answer would answer every
         press with nothing, beside a button that looks live (`member/resultToTheServer.test.tsx`
         measures the same fault on the member's own results). */
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))
      await waitFor(() => {
        expect(decisionsIn(server.asked)).toHaveLength(2)
      })

      await user.click(screen.getByRole('button', { name: 'Odustani' }))

      expect(screen.queryByLabelText(/^Razlog odbijanja/)).not.toBeInTheDocument()
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
   */
  function serverThatHolds(...held: string[]) {
    const recorded = new Set<string>()
    let release: () => void = () => {}
    const letGo = new Promise<void>((resolve) => {
      release = resolve
    })

    const server = serverThat((path, init) => {
      if (init?.method !== 'POST' || !path.includes('/decision')) {
        return null
      }

      const second = recorded.has(path)

      recorded.add(path)

      const answer = () =>
        second
          ? refused('O stavci je već odlučeno.', 409)
          : new Response(JSON.stringify({ id: 1, state: 'decided' }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })

      return held.some((id) => pathOf(id) === path) ? letGo.then(answer) : answer()
    })

    return { server, release }
  }

  const countFor = (asked: Asked[], id: string) =>
    decisionsIn(asked).filter((one) => one.path === pathOf(id)).length

  /** Everything a case does to the page, written once. */
  async function pageWith(held: string[]) {
    const user = setupUser()
    const { server, release } = serverThatHolds(...held)

    renderAt(`/sr/${QUEUE.comments.path}`, 'superadmin', null, undefined, null, <Decided />)

    const cards = within(await cardsIn()).getAllByRole('listitem')

    /* Named by place, so a queue that grew or shrank would move every state under this table. */
    expect(cards).toHaveLength(4)

    return {
      user,
      server,
      release,
      sweep: () => fireEvent.click(screen.getByRole('button', { name: 'Odobri sve' })),
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
    }
  }

  type Page = Awaited<ReturnType<typeof pageWith>>

  type Scene = {
    name: string
    /** The cards whose answer the route holds. */
    held: string[]
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
  ]

  it.each(SCENES)('$name', async (scene) => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const page = await pageWith(scene.held)

    try {
      await scene.arrange(page)

      const button = page.confirm()
      const toldOff = button.getAttribute('aria-disabled') === 'true'
      const before = countFor(page.server.asked, scene.target)

      /* WHAT THE BUTTON SAYS IS WRITTEN DOWN, and the press is the other half of the claim. */
      expect(toldOff).toBe(scene.toldOff)

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
})
