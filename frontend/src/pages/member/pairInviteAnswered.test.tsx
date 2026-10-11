import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderAt } from '../../test/render'
import {
  answeredWith,
  did,
  forgetEveryCookie,
  refused,
  serverThat,
  type Asked,
} from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { arrivedResource, clearResourceCache, loadResource } from '../../data/client'
import { SLOW } from '../../test/slow'
import sr from '../../i18n/sr.json'
import { theServerWasAnswered } from './pairWrites'

/**
 * ANSWERING A SERVED INVITATION INTO A RACING PAIR, BY PRESSING A BUTTON.
 *
 * <p><b>Owner, PDL 27b, 27.09.2026, defining the outcome he chose by the question he asked it
 * with:</b> „Pod 1 ako to podrazumeva da clan moze klikom na dugme da prihvati ili odbije
 * poziv?" The answer is yes. Both routes it names existed already; what did not exist was any
 * screen calling either, so a served invitation drew a subject, a sender and a body.
 *
 * <p><b>THE HALF THIS FILE DOES NOT MEASURE, said here so the absence is a decision.</b> Only
 * the PAIR is answered. A team's invitation is answered by `member/ServedTeamInvite.tsx`, which
 * reads the team off `GET /api/me/applications`, and `member/teamInviteAnswered.test.tsx` measures
 * it.
 *
 * <p><b>WHY THE FIXTURE IS FOUR MESSAGES AND NOT ONE.</b> Every value an assertion here reads
 * could arrive from somewhere else if the code were wrong, so each has to have somewhere else
 * to arrive from:
 *
 * <ul>
 * <li><b>the message opened is NOT the newest</b>, so „this message" and „the first line of the
 * inbox" are different values. Newest first, the order is 611, 614, 613, 612, and 612 is the
 * one opened - last of the four;
 * <li><b>its invitation is NOT the only one of its kind and NOT the first</b>: 611 carries pair
 * invite 44 and stands above it, so a screen sending the first pair invite it can find sends 44
 * where 31 belongs;
 * <li><b>no key equals any other</b>. The invitations are 31, 44 and 77, the messages 611 to
 * 614, so sending a message key where an invitation key belongs cannot land on the right number
 * by luck;
 * <li><b>a message that only tells and one that asks about a TEAM stand beside them</b>, which
 * are the two states in which these buttons must not appear at all.
 * </ul>
 *
 * <p><b>AND WHAT IS DELIBERATELY NOT HERE: a message carrying BOTH keys.</b> It would be the
 * shortest way to measure „which of the two travels", and it is a row the database refuses:
 * V13 holds `check (team_invitation_id is null or pair_invite_id is null)`. So the swap is
 * measured the way it really shows - the opened message's `teamInvitationId` is `null`, and a
 * screen reading that field instead finds nothing and draws no buttons at all.
 */

/* One reader and no second inbox, unlike `member/inboxFromTheServer.test.tsx` which keys its
   answers by address: whose mail is served is that file's question, and every case here is
   about what one member does with one question that is already his. */
const HIM = { role: 'competitor', account: 1, member: { memberNumber: '000007' } }

/** The key of the invitation this message asks about, which is the one thing that must reach
 *  the route. Not 612, not 44, not 77. */
const HIS_INVITE = 31

/**
 * THE ADDRESS THAT ANSWER MUST REACH, WRITTEN OUT RATHER THAN BUILT.
 *
 * <p><b>An earlier draft of this file asked for `theAnswerGoesTo(HIS_INVITE)`, and that made
 * the strongest assertion here satisfy itself.</b> The screen builds its address with that same
 * function, so a mutation putting anything at all into it - a fixed `/api/pairs`, the message
 * key, the wrong invitation - moved BOTH the address asked for and the address expected, and
 * the case stayed green over a screen answering the wrong question. A guard may not be written
 * in terms of the thing it guards.
 *
 * <p>Spelt out, it also says what the route really is, which is the other half of its job:
 * `PUT /api/pairs/{id}` takes a `pair_invite.id` and not a pair's.
 */
const THE_ADDRESS = '/api/pairs/31'

/**
 * THE ONE HE OPENS, and it is the OLDEST of the four rather than the newest.
 *
 * <p><b>ALREADY READ, and that is a measurement rather than a detail of the fixture.</b>
 * Opening an unread message sends `POST /api/inbox/{id}/read` and a receipt the server accepts
 * drops the inbox cache (PDL 27a, `member/inboxRead.ts`) - so `/api/inbox` is asked a second
 * time for a reason that has nothing to do with answering anything. Two cases below count those
 * asks to tell „the screen read the server again" from „the screen hid its own buttons", and
 * with an unread message they would have counted the receipt's re-read instead: the first draft
 * of the 404 case did exactly that and went red on a count of two where the write had been
 * refused. Read, there is one source for that number again. What opening does to the count is
 * measured where it belongs, in `member/openingMarksItRead.test.tsx`.
 */
const OPENED = {
  id: 612,
  from: 'Milica Anđelković',
  subject: 'Poziv u trkački par',
  body: 'Milica te poziva u trkački par.',
  date: '2026-09-20',
  read: true,
  teamInvitationId: null,
  pairInviteId: HIS_INVITE,
}

/** ANOTHER PAIR INVITATION, newer, so that „the invitation this message asks about" and „the
 *  first pair invitation in the inbox" are two different numbers. */
const ANOTHER_PAIR_QUESTION = {
  ...OPENED,
  id: 611,
  subject: 'Poziv u trkački par od Jovane',
  date: '2026-09-26',
  read: false,
  pairInviteId: 44,
}

/** A QUESTION ABOUT A TEAM, which these buttons must not answer and must not appear under. */
const A_TEAM_QUESTION = {
  ...OPENED,
  id: 613,
  subject: 'Tim te poziva',
  body: 'Dunavski trkači te pozivaju u tim.',
  date: '2026-09-22',
  read: false,
  teamInvitationId: 77,
  pairInviteId: null,
}

/** AND ONE THAT ONLY TELLS, the other state of „does this message ask". */
const ONLY_TELLS = {
  ...OPENED,
  id: 614,
  subject: 'Članarina je evidentirana',
  body: 'Uplata je proknjižena.',
  date: '2026-09-24',
  read: false,
  pairInviteId: null,
}

/** How many of the four the envelope should be counting, which is every one but the one he has
 *  already read. */
const UNREAD = 3

const ALL_FOUR = [ANOTHER_PAIR_QUESTION, ONLY_TELLS, A_TEAM_QUESTION, OPENED]

let server: { asked: Asked[]; stop: () => void } | null = null

/**
 * A server that answers `GET /api/me`, the inbox, the read receipt and the one write, and lets
 * every other address fall through to the mock on the disc.
 *
 * <p><b>The inbox is rebuilt on every ask rather than handed back as a fixture</b>, because an
 * answered invitation stops being served as a question - `PairWriteApi.settle` deletes the
 * `pair_invite` row either way - and a fake server that answered the same body forever could
 * not tell „the portal read the server again" from „the portal left the buttons where they
 * were".
 *
 * @param answering what `PUT /api/pairs/{id}` answers, or null to leave the question standing
 */
function aServerWhere(
  rows: unknown[],
  answering: (
    path: string,
    init: RequestInit | undefined,
  ) => Response | Promise<Response> | null = () => did(),
): void {
  answered = new Set()

  server = serverThat((path, init) => {
    if (path === '/api/me') {
      return new Response(JSON.stringify(HIM), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (path === '/api/inbox') {
      return new Response(
        JSON.stringify(
          rows
            .filter((row) => !answered.has(keyOf(row)))
            .map((row) =>
              typeof row === 'object' && row !== null && answered.has(inviteOf(row))
                ? { ...row, pairInviteId: null }
                : row,
            ),
        ),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    if (/^\/api\/inbox\/\d+\/read$/.test(path)) {
      return did()
    }

    if (/^\/api\/pairs\/\d+$/.test(path)) {
      const said = answering(path, init)

      /* A pending answer is one the case is holding open on purpose, so nothing is closed on
         the server's side while it hangs - which is exactly the state that case looks at. */
      if (said !== null && said instanceof Response && said.status < 400) {
        /* The question is gone from the server's side once it is answered, which is what makes
           „the buttons went because the inbox was read again" different from „the buttons went
           because the screen hid them". */
        answered.add(`invite:${path.slice('/api/pairs/'.length)}`)
      }

      return said
    }

    return null
  })
}

/** Which invitations the fake server has closed. */
let answered = new Set<string>()

/** One field off a row the fake server is holding, asked of the object rather than asserted out
 *  of it (ADL A14, and `member/photoWrites.ts#theRowIn` reads an answer the same way). */
function fieldOf(row: unknown, name: string): string {
  return typeof row === 'object' && row !== null ? String(Reflect.get(row, name)) : ''
}

function keyOf(row: unknown): string {
  return `message:${fieldOf(row, 'id')}`
}

function inviteOf(row: unknown): string {
  return `invite:${fieldOf(row, 'pairInviteId')}`
}

/** Every address the portal asked for, in order. */
function asked(): string[] {
  return (server?.asked ?? []).map((one) => one.path)
}

/** What was sent to one address, as the route would parse it. */
function sentTo(path: string): unknown[] {
  return (server?.asked ?? [])
    .filter((one) => one.path === path)
    .map((one) => JSON.parse(String(one.init?.body ?? 'null')))
}

/**
 * WHICH VERB CARRIED IT, and this exists because a mutation survived without it.
 *
 * <p><b>Measured on 28.09.2026:</b> changing the screen's `'PUT'` to `'POST'` left all 31 cases
 * of this file and `member/inboxFromTheServer.test.tsx` green. The address was right, the body
 * was right, and nothing looked at the one remaining thing - so the survival was a real hole
 * and not a case run in the wrong file.
 *
 * <p><b>And the fake server is why it could hide, which is worth saying because it is a fault
 * in the measuring and not in the portal.</b> The server below matches on the path alone, so it
 * answers a `POST` exactly as it answers a `PUT`. The real one does not: `PairWriteApi` maps
 * only `@PutMapping` at this address, so a `POST` there reaches no handler at all and the
 * member's answer would never arrive. A harness looser than the server is a harness that can
 * only be trusted where something asks the question it skips.
 */
function verbFor(path: string): (string | undefined)[] {
  return (server?.asked ?? []).filter((one) => one.path === path).map((one) => one.init?.method)
}

/** The panel above every screen, which is where the count of unread messages is read. */
function theEnvelope(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: /Otvori poruke/ })
}

function theAcceptButton(): HTMLElement {
  return screen.getByRole('button', { name: sr.pair.accept })
}

function theRefuseButton(): HTMLElement {
  return screen.getByRole('button', { name: sr.pair.refuse })
}

/** The screen, opened on the message that asks, once its buttons are there. */
async function openTheQuestion(): Promise<void> {
  renderAt(`/sr/poruke/${String(OPENED.id)}`, 'competitor', '000007')

  await screen.findByRole('heading', { level: 1, name: OPENED.subject })
  await screen.findByRole('button', { name: sr.pair.accept })
}

beforeEach(() => {
  forgetEveryCookie()
  document.cookie = 'XSRF-TOKEN=imam'
  clearResourceCache()
})

afterEach(() => {
  server?.stop()
  server = null
  clearResourceCache()
})

describe('answering a served invitation into a racing pair', () => {
  it(
    'accepts it, and sends the key of the invitation this message asks about',
    async () => {
      const user = setupUser()

      aServerWhere(ALL_FOUR)
      await openTheQuestion()

      await user.click(theAcceptButton())

      /* **THE ADDRESS IS THE WHOLE OF THIS ASSERTION, AND IT IS THE JOIN.** Three other numbers
         in this fixture could stand here if the code were wrong and each is a real mistake
         somebody makes: the MESSAGE's key (612), the FIRST pair invitation in the list (44), and
         the team invitation of the message beside it (77). Asked as „some pair was answered",
         all four pass; asked as this address, only the right one does. */
      await waitFor(() => {
        expect(asked()).toContain(THE_ADDRESS)
      })

      expect(asked()).not.toContain('/api/pairs/44')
      expect(asked()).not.toContain('/api/pairs/77')
      expect(asked()).not.toContain('/api/pairs/612')

      /* **AND WHAT WAS SENT SAYS „PRIHVATI".** `PairWriteApi.Answered` boxes this field on
         purpose - „a primitive would read it as „Odbij" and close somebody's question for him" -
         so a screen that sent nothing, or sent the wrong one of the two, is a screen that
         answers for the member. */
      expect(sentTo(THE_ADDRESS)).toEqual([{ accepted: true }])

      /* **AND BY `PUT`, which is the third of the three things a request is.** `PairWriteApi`
         maps only `@PutMapping` at this address, so the same body sent by `POST` reaches no
         handler and the answer is lost without a word to anybody. */
      expect(verbFor(THE_ADDRESS)).toEqual(['PUT'])
    },
    SLOW,
  )

  it(
    'refuses it, and that is a different body to the same address',
    async () => {
      const user = setupUser()

      aServerWhere(ALL_FOUR)
      await openTheQuestion()

      await user.click(theRefuseButton())

      await waitFor(() => {
        expect(asked()).toContain(THE_ADDRESS)
      })

      /* **THE SECOND HALF OF THE OWNER'S SENTENCE, and it is the half that goes missing.** „da
         prihvati ili odbije" is two things; a screen that sent `true` from both buttons would
         pass every case about accepting and would put the member in a pair he refused. */
      expect(sentTo(THE_ADDRESS)).toEqual([{ accepted: false }])
    },
    SLOW,
  )

  it(
    'takes the buttons away once the server has the answer, by reading the inbox again',
    async () => {
      const user = setupUser()

      aServerWhere(ALL_FOUR)
      await openTheQuestion()

      /* Read off the envelope before the answer, so that what is asserted after it is the SAME
         value and not a number typed here. Checked against `UNREAD` ALONE, not `UNREAD + 1`:
         until PDL 34 (28.09.2026, „NECU MOCK PODATKE NIGDE", owner) the bundle seeded a
         broadcast into every session and this reading had to answer for it too. `messages`
         starts empty now, so the four rows this file wrote are the whole count. */
      const counting = (await theEnvelope()).getAttribute('aria-label')

      expect(counting).toContain(String(UNREAD))

      const before = asked().filter((one) => one === '/api/inbox').length

      await user.click(theAcceptButton())

      /* **The question is closed on the SERVER and the screen learns it by asking**, which is
         why the fake server above stops serving `pairInviteId` for an invitation it has
         answered. A screen that hid its own buttons would pass a case that only looked for them
         going; this one is green only if `/api/inbox` was asked again. */
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: sr.pair.accept })).toBeNull()
      })

      expect(asked().filter((one) => one === '/api/inbox').length).toBeGreaterThan(before)

      /* **AND ANSWERING READS NOTHING, which is measured rather than assumed.** PDL 27a makes
         opening the one trigger for a read mark; nothing was decided that answering a question
         marks anything, and the message he answered was already read besides. So the envelope
         must stand exactly where it did - a route that marked on the way past would take a
         number off it that the member never earned, and every other message here is unread and
         would have somewhere to fall from. */
      expect((await theEnvelope()).getAttribute('aria-label')).toBe(counting)
    },
    SLOW,
  )

  it(
    'says the question is no longer open when the route does not find it, and offers no second press',
    async () => {
      const user = setupUser()

      /* **404 IS THE ANSWER TO THREE QUESTIONS AT ONCE AND `PairWriteApi` MEANS IT TO BE.** The
         row is gone, or it is somebody else's, or one of the two has stopped paying: „„refused"
         and „not there" are one number and one empty body, so a caller walking the keys learns
         nothing about anybody." The member's truth is the same in all three. */
      aServerWhere(ALL_FOUR, () => answeredWith(404))
      await openTheQuestion()

      await user.click(theAcceptButton())

      expect(await screen.findByText(sr.pair.inviteClosed)).toBeVisible()

      /* Instead of the buttons and not beside them: a question the server says is not there
         cannot be answered by pressing again. */
      expect(screen.queryByRole('button', { name: sr.pair.accept })).toBeNull()
      expect(screen.queryByRole('button', { name: sr.pair.refuse })).toBeNull()

      /* **AND NOTHING WAS RE-READ**, which is `member/inboxRead.ts`'s own rule about a write the
         server did not agree to. Re-read, the line would come back without a key, this
         component would go, and the member would be left with the buttons gone and no word
         about why. */
      expect(asked().filter((one) => one === '/api/inbox').length).toBe(1)
    },
    SLOW,
  )

  it(
    'reads a number that is not 404 as a fault and not as a closed question',
    async () => {
      const user = setupUser()

      aServerWhere(ALL_FOUR, () => answeredWith(500))
      await openTheQuestion()

      await user.click(theAcceptButton())

      /* **The axis that makes the case above mean anything.** Read as „closed", a server that
         was down for a moment would tell a member his invitation had expired, and he would
         never press again. `ServerSaid` names the number instead and says to try again. */
      expect(
        await screen.findByText(sr.server.wrong.replace('{status}', '500')),
      ).toBeVisible()
      expect(screen.queryByText(sr.pair.inviteClosed)).toBeNull()
      expect(theAcceptButton()).toBeVisible()
    },
    SLOW,
  )

  it.each([
    ['theFormIsNotComplete', 400, sr.pair.answerRefused.theFormIsNotComplete],
    ['thePairWouldNotBeMixed', 409, sr.pair.answerRefused.thePairWouldNotBeMixed],
  ])(
    'draws the sentence for %s, which the route names and the screen answers',
    async (reason, status, said) => {
      const user = setupUser()

      aServerWhere(ALL_FOUR, () => refused(reason, status))
      await openTheQuestion()

      await user.click(theAcceptButton())

      /* **BOTH REASONS THE ANSWERING ROUTE CAN NAME, and the sentence is read out of the
         dictionary rather than typed here** - typed, this case would go on passing over a
         sentence somebody changed by accident. `member/pairWrites.ts` says why this pair of
         names has no derived floor under it yet and what putting one there would cost. */
      expect(await screen.findByText(said)).toBeVisible()

      /* The buttons stay: the route refused, the question still stands, and pressing again is
         the right thing for a member whose counterpart has since put his sex right. */
      expect(theAcceptButton()).toBeVisible()
    },
    SLOW,
  )

  it(
    'sends one request for two presses inside one task, which no awaited click can produce',
    async () => {
      aServerWhere(ALL_FOUR)
      await openTheQuestion()

      const accept = theAcceptButton()

      /* **THE GUARD IS A REF AND THIS IS THE ONLY SHAPE THAT SAYS SO.** `user.click` awaits
         between presses, so React renders, `sending` turns true and `disabled` alone would
         turn the second press away - a screen guarded only by state would pass and be
         unguarded. Both events are dispatched inside one `act` here, so the second handler runs
         before any render, reading whatever the first handler wrote synchronously. */
      await act(async () => {
        fireEvent.click(accept)
        fireEvent.click(accept)
      })

      await waitFor(() => {
        expect(sentTo(THE_ADDRESS)).toEqual([{ accepted: true }])
      })
    },
    SLOW,
  )

  it(
    'tells the button off while it waits rather than switching it off, so keyboard focus stays on it',
    async () => {
      const user = setupUser()
      /* A request that never comes back, which is the only way to look at the screen WHILE it
         is waiting. `serverThat` takes a promise for exactly this. */
      let release = (): void => {}

      aServerWhere(
        ALL_FOUR,
        () =>
          new Promise<Response>((settle) => {
            release = () => {
              settle(did())
            }
          }),
      )

      await openTheQuestion()
      await user.click(theAcceptButton())

      /* **THE DECISION THIS HOLDS IS THE PORTAL'S AND IT IS WRITTEN DOWN TWICE**
         (`member/ProfilePicture.tsx`, `event/RateEvent.tsx`, and the rule in
         `pages/Home.css` written for it): a control that cannot act right now is TOLD OFF and
         not SWITCHED OFF, because `disabled` takes it out of the tab order. A member answering
         by keyboard has focus on this button at the moment he presses it, so switching it off
         drops his focus to the top of the document - and he is the one reader who cannot see
         where it went.

         Asked as two things, because they are two: it still answers to the role of a button
         that can be focused (`disabled` would make `toHaveFocus` impossible to keep), and it
         says out loud that it will not act. */
      await waitFor(() => {
        expect(theAcceptButton()).toHaveAttribute('aria-disabled', 'true')
      })

      expect(theAcceptButton()).not.toHaveAttribute('disabled')

      theAcceptButton().focus()
      expect(theAcceptButton()).toHaveFocus()

      release()
    },
    SLOW,
  )

  it(
    'puts no such buttons under a message that only tells, nor under one that asks about a team',
    async () => {
      aServerWhere(ALL_FOUR)

      renderAt(`/sr/poruke/${String(ONLY_TELLS.id)}`, 'competitor', '000007')

      await screen.findByRole('heading', { level: 1, name: ONLY_TELLS.subject })

      expect(screen.queryByRole('button', { name: sr.pair.accept })).toBeNull()
      expect(screen.queryByRole('button', { name: sr.pair.refuse })).toBeNull()
    },
    SLOW,
  )

  it(
    'puts no pair buttons under a question about a team, whose own route needs a team',
    async () => {
      aServerWhere(ALL_FOUR)

      renderAt(`/sr/poruke/${String(A_TEAM_QUESTION.id)}`, 'competitor', '000007')

      await screen.findByRole('heading', { level: 1, name: A_TEAM_QUESTION.subject })

      /* **The third state of „what sort of question is this", and it is its own case.** Both
         keys are `number | null` on the wire and `data/useResource.ts#asServed` is the one
         place either could be put where the other belongs; read from `teamInvitationId`, this
         message would grow two buttons that answer `PUT /api/pairs/77` - an address about
         somebody's team invitation. */
      expect(screen.queryByRole('button', { name: sr.pair.accept })).toBeNull()
      expect(screen.queryByRole('button', { name: sr.pair.refuse })).toBeNull()
      /* And the team half is still unanswerable, which is the boundary this increment keeps. */
      expect(asked().filter((one) => one.startsWith('/api/teams/'))).toEqual([])
    },
    SLOW,
  )
})

describe('what an answered invitation makes stale', () => {
  /**
   * WHICH CACHE IS DROPPED IS DECIDED BY WHICH ANSWER WAS GIVEN, and that is measured here
   * rather than on the screen because the screen cannot show it.
   *
   * <p>`clearResourceCache` drops a promise and says nothing to anybody, which is the portal's
   * own words for it: „dropped without the bump, nothing re-reads". So the effect of dropping
   * `pairs` is on the NEXT screen that reads pairs, and `arrivedResource` is where it can be
   * seen at all.
   */
  async function withPairsInHand(): Promise<void> {
    clearResourceCache()
    await loadResource('pairs')

    expect(arrivedResource('pairs')).not.toBeUndefined()
  }

  it('drops the pairs the portal is holding when the answer was „Prihvati"', async () => {
    server = serverThat((path) => (/^\/api\/pairs\/\d+$/.test(path) ? did() : null))

    await withPairsInHand()
    await theServerWasAnswered(HIS_INVITE, true)

    /* **Accepting is the one answer that writes `racing_pair`.** `PairWriteApi.settle` deletes
       whatever pair either half held for the season being formed and inserts the new one, so a
       member walking from this message to his own profile would otherwise be shown no pair a
       moment after making one. */
    expect(arrivedResource('pairs')).toBeUndefined()
  })

  it('leaves them alone when the answer was „Odbij", because no pair changed', async () => {
    server = serverThat((path) => (/^\/api\/pairs\/\d+$/.test(path) ? did() : null))

    await withPairsInHand()
    await theServerWasAnswered(HIS_INVITE, false)

    /* **The other state of the same axis, and without it the case above is satisfied by a
       function that drops everything always.** Refusing closes the question and touches no
       pair, so a portal that re-read `pairs` here would be asking for an answer it already had.
    */
    expect(arrivedResource('pairs')).not.toBeUndefined()
  })

  it('leaves them alone when the route refused, whichever answer was pressed', async () => {
    server = serverThat((path) =>
      /^\/api\/pairs\/\d+$/.test(path) ? refused('thePairWouldNotBeMixed', 409) : null,
    )

    await withPairsInHand()
    await theServerWasAnswered(HIS_INVITE, true)

    /* **The axis this function cannot get wrong**, and `member/inboxRead.ts` states it for its
       own write: a cache dropped on the asking rather than on the answering is the portal
       drawing a pair the server refused to make. */
    expect(arrivedResource('pairs')).not.toBeUndefined()
  })

  /** `withPairsInHand`'s own shape, over `'inbox'`. Confirms the cache truly held a value
   *  first, so its absence afterward is the answer dropping it and not the value never
   *  having arrived - the other source an empty cache could have, ruled out before the
   *  case below reads anything into the one that is left. */
  async function withInboxInHand(): Promise<void> {
    clearResourceCache()
    await loadResource('inbox')

    expect(arrivedResource('inbox')).not.toBeUndefined()
  }

  it('drops the inbox too when the answer was „Odbij", the other half of „either way"', async () => {
    server = serverThat((path) => (/^\/api\/pairs\/\d+$/.test(path) ? did() : null))

    await withInboxInHand()
    await theServerWasAnswered(HIS_INVITE, false)

    /* **THE HALF OF „EITHER WAY" A REVIEW FOUND MEASURED BY NOTHING.** `member/pairWrites.ts`
       states the axis in its own words - „Both close the question, so the inbox is stale
       either way" - and only „Prihvati" proved it, by watching the screen re-read
       (`takes the buttons away...`, above). Read here instead of there: that case waits for a
       second `/api/inbox` to land and a whole render after it, which against the very mutation
       this guards never happens, so it spends the twenty seconds `test/setup.ts` gives
       `waitFor` before it fails at all. This reads the one value that changes the moment the
       `await` above returns - nothing to wait for and nothing to time out on. */
    expect(arrivedResource('inbox')).toBeUndefined()
  })

  /** `withPairsInHand`'s own shape, over what the member waits on, which his own profile draws
   *  the questions still standing off since P2 (10.10.2026, `profile/RacingPairLine.tsx`). */
  async function withWhatHeWaitsOnInHand(): Promise<void> {
    clearResourceCache()
    await loadResource('me/applications')

    expect(arrivedResource('me/applications')).not.toBeUndefined()
  }

  it.each([
    ['„Prihvati"', true],
    ['„Odbij"', false],
  ])('drops what he waits on when the answer was %s, because both close the question', async (_, accepted) => {
    server = serverThat((path) => (/^\/api\/pairs\/\d+$/.test(path) ? did() : null))

    await withWhatHeWaitsOnInHand()
    await theServerWasAnswered(HIS_INVITE, accepted)

    /* His own page lists the questions still standing off `GET /api/me/applications`, and either
       answer takes this one off it: held, the page would go on saying „Primljen poziv" about a
       question he has just answered. */
    expect(arrivedResource('me/applications')).toBeUndefined()
  })

  it.each([
    ['says the question is not there', () => answeredWith(404)],
    ['refuses with a reason it names', () => refused('thePairWouldNotBeMixed', 409)],
  ])('drops what he waits on when the route %s, and nothing else', async (_, answer) => {
    server = serverThat((path) => (/^\/api\/pairs\/\d+$/.test(path) ? answer() : null))

    await withWhatHeWaitsOnInHand()
    await loadResource('pairs')
    await theServerWasAnswered(HIS_INVITE, true)

    /* The empty 404 is a question that is no longer there, which that list would otherwise name
       until the next visit, and a refusal the route names is the server answering about rows this
       visit read earlier: both say the list is stale (derived 10.10.2026, from the remedy of the
       medium finding on PR 516, `theServerSaysTheScreenIsStale`). A refusal makes no pair, so the
       pairs stay in hand. */
    expect(arrivedResource('me/applications')).toBeUndefined()
    expect(arrivedResource('pairs')).not.toBeUndefined()
  })

  it('keeps what he waits on when the server said nothing about any row', async () => {
    server = serverThat((path) => (/^\/api\/pairs\/\d+$/.test(path) ? answeredWith(500) : null))

    await withWhatHeWaitsOnInHand()
    await theServerWasAnswered(HIS_INVITE, true)

    expect(arrivedResource('me/applications')).not.toBeUndefined()
  })
})
