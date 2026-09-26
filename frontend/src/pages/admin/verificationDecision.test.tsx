import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { Decided } from '../../test/decided'
import { answeredWith, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { QUEUE } from './queues'

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
      /* Two acts and never one with a flag (`verificationWrites.ts`): what parts them
         on the wire is `approved`, and the reason travels only with the no. */
      expect(bodyOf(sent[0])).toEqual({ approved: false, reason: 'Tekst je prekratak.' })
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
      renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin', '000010', undefined, null, <Decided />)

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
