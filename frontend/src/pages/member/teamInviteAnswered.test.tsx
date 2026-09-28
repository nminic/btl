import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderAt } from '../../test/render'
import {
  did,
  forgetEveryCookie,
  refused,
  answeredWith,
  serverThat,
  type Asked,
} from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { arrivedResource, clearResourceCache } from '../../data/client'
import { SLOW } from '../../test/slow'
import sr from '../../i18n/sr.json'

/**
 * ANSWERING A SERVED INVITATION INTO A TEAM, BY PRESSING A BUTTON.
 *
 * <p>Owner, PDL, 05.09.2026: „**Poziv u tim prihvata pozvani član.** Niko ne sme da upiše
 * promenu koja se tiče drugog čoveka bez njegove reči." Both routes it takes existed already -
 * `PUT /api/teams/{id}/invitations/{invitation}` and `GET /api/me/applications` - and nothing
 * called either, so a served invitation drew a subject, a sender and a body.
 *
 * <p><b>THE ADDRESS TAKES TWO KEYS AND THAT IS WHAT MOST OF THIS FILE IS ABOUT.</b> The pair
 * screen's route is satisfied by the one key the inbox already carries; this one needs the TEAM
 * as well, and the team can only come from `GET /api/me/applications`. So the fixture below is
 * built so that every number in that address has somewhere ELSE it could have come from.
 *
 * <p><b>WHY THE FIXTURE IS FOUR MESSAGES AND FOUR LISTS.</b> Every value an assertion here
 * reads could arrive from somewhere else if the code were wrong, so each has to have somewhere
 * else to arrive from:
 *
 * <ul>
 * <li><b>the message opened is NOT the newest</b>, so „this message" and „the first line of the
 * inbox" are different values. Newest first the order is 611, 613, 614, 612, and 612 is the one
 * opened;
 * <li><b>its invitation is NOT the first of the waiting ones</b>: 44 stands before 31 in
 * `teamInvitations`, so a screen sending the first invitation it can find sends 44;
 * <li><b>the two invitations name DIFFERENT TEAMS</b> (5 against 8), so a screen that found the
 * right invitation and took the team off the wrong row still fails;
 * <li><b>THE SAME KEY 31 STANDS IN THREE OF THE FOUR LISTS, EACH UNDER A DIFFERENT TEAM</b> -
 * an application at team 99 and a proposal at team 77 - so a screen reading the wrong list finds
 * something and builds a wrong address rather than finding nothing and drawing no buttons. That
 * is the one mistake a fixture with one list cannot catch: it would pass while the screen
 * answered off `teamApplications`;
 * <li><b>no key equals any other</b>. The messages are 611 to 614, the invitations 31 and 44,
 * the teams 5, 8, 77 and 99, so sending a message key or a team key where an invitation key
 * belongs cannot land on the right number by luck;
 * <li><b>a message that only tells, and one that asks about a PAIR, stand beside them</b>, which
 * are the two states in which these buttons must not appear at all.
 * </ul>
 *
 * <p><b>AND WHAT IS DELIBERATELY NOT HERE: a message carrying BOTH keys.</b> It would be the
 * shortest way to measure „which of the two travels", and it is a row the database refuses: V13
 * holds `check (team_invitation_id is null or pair_invite_id is null)`. So the swap is measured
 * the way it really shows - the opened message's `pairInviteId` is `null`, and a screen reading
 * that field instead finds nothing and draws no buttons at all.
 */

/* One reader and one inbox: whose mail is served is `member/inboxFromTheServer.test.tsx`'s
   question, and every case here is about what one member does with one question already his. */
const HIM = { role: 'competitor', account: 1, member: { memberNumber: '000007' } }

/** The key of the invitation this message asks about. Not 612, not 44. */
const HIS_INVITE = 31

/** The team that invitation really names, which only `/api/me/applications` can say. Not 5,
 *  not 77, not 99. */
const HIS_TEAM = 8

/**
 * THE ADDRESS THAT ANSWER MUST REACH, WRITTEN OUT RATHER THAN BUILT.
 *
 * <p><b>Not `theAnswerGoesTo(HIS_TEAM, HIS_INVITE)`, and `member/pairInviteAnswered.test.tsx`
 * paid for that lesson:</b> the screen builds its address with that same function, so a mutation
 * putting anything at all into it moves BOTH the address asked for and the address expected, and
 * the case stays green over a screen answering the wrong question. A guard may not be written in
 * terms of the thing it guards.
 *
 * <p>Spelt out, it also says what the route really is: the team comes FIRST and the invitation
 * second, which is the one thing about this address a reader cannot infer from the key names.
 */
const THE_ADDRESS = '/api/teams/8/invitations/31'

/** Every address the two halves of this fixture could have built instead, each a real mistake:
 *  the first invitation's team, the first invitation's key, both of the first invitation's, the
 *  message's key, the other lists' teams, and the invitation key read as a team. */
const THE_WRONG_ADDRESSES = [
  '/api/teams/5/invitations/31',
  '/api/teams/8/invitations/44',
  '/api/teams/5/invitations/44',
  '/api/teams/8/invitations/612',
  '/api/teams/99/invitations/31',
  '/api/teams/77/invitations/31',
  '/api/teams/31/invitations/31',
]

/**
 * THE ONE HE OPENS, and it is the OLDEST of the four rather than the newest.
 *
 * <p><b>ALREADY READ, and that is a measurement rather than a detail.</b> Opening an unread
 * message sends `POST /api/inbox/{id}/read` and a receipt the server accepts drops the inbox
 * cache (PDL 27a), so `/api/inbox` would be asked a second time for a reason that has nothing to
 * do with answering anything. Two cases below count those asks to tell „the screen read the
 * server again" from „the screen hid its own buttons"; with an unread message they would have
 * counted the receipt's re-read instead.
 */
const OPENED = {
  id: 612,
  from: 'Balkanska trkačka liga',
  subject: 'Poziv u tim „Dunavski trkači"',
  body: 'Tim „Dunavski trkači" te poziva da od naredne sezone trčiš za njih.',
  date: '2026-10-06',
  read: true,
  teamInvitationId: HIS_INVITE,
  pairInviteId: null,
}

/** ANOTHER TEAM'S INVITATION, newer, so that „the invitation this message asks about" and „the
 *  first invitation in the inbox" are two different numbers. */
const ANOTHER_TEAM_QUESTION = {
  ...OPENED,
  id: 611,
  subject: 'Poziv u tim „Savski maratonci"',
  date: '2026-10-09',
  read: false,
  teamInvitationId: 44,
}

/** A QUESTION ABOUT A PAIR, which these buttons must not answer and must not appear under. */
const A_PAIR_QUESTION = {
  ...OPENED,
  id: 613,
  subject: 'Poziv u trkački par',
  body: 'Milica te poziva u trkački par.',
  date: '2026-10-08',
  read: false,
  teamInvitationId: null,
  pairInviteId: 77,
}

/** AND ONE THAT ONLY TELLS, the other state of „does this message ask". */
const ONLY_TELLS = {
  ...OPENED,
  id: 614,
  subject: 'Članarina je evidentirana',
  body: 'Uplata je proknjižena.',
  date: '2026-10-07',
  read: false,
  teamInvitationId: null,
}

const ALL_FOUR = [ANOTHER_TEAM_QUESTION, A_PAIR_QUESTION, ONLY_TELLS, OPENED]

/**
 * WHAT `GET /api/me/applications` ANSWERS, with the key 31 standing in three lists under three
 * different teams.
 *
 * <p>`alreadyInATeam` is the one field of this answer a case overrides, and it is a field on the
 * ANSWER rather than on any invitation, which is `MyApplicationsApi`'s own arrangement: „it
 * cannot differ between two of his invitations".
 */
function waitingWhere(alreadyInATeam = false): unknown {
  return {
    /* The same key under a different team, so reading the wrong list is a wrong address rather
       than no address. */
    teamApplications: [{ id: HIS_INVITE, teamId: 99, date: '2026-10-01' }],
    teamInvitations: [
      { id: 44, teamId: 5, date: '2026-10-09' },
      { id: HIS_INVITE, teamId: HIS_TEAM, date: '2026-10-06' },
    ],
    teamProposals: [{ id: HIS_INVITE, teamId: 77, name: 'Dunavski trkači', date: '2026-10-02' }],
    pairInvites: [{ id: 77, memberNumber: '000031', sentByMe: false, date: '2026-10-08' }],
    alreadyInATeam,
  }
}

let server: { asked: Asked[]; stop: () => void } | null = null

/** Which invitations the fake server has closed. */
let closed = new Set<number>()

/**
 * A server that answers `GET /api/me`, the inbox, what he is waiting on and the one write, and
 * lets every other address fall through to the mock on the disc.
 *
 * <p><b>Both reads are rebuilt on every ask rather than handed back as fixtures</b>, because an
 * answered invitation stops being served as a question - `TeamJoiningWriteApi.theInvitationIsOver`
 * empties `message.team_invitation_id` and then deletes the row - and a fake server that answered
 * the same body for ever could not tell „the portal read the server again" from „the portal left
 * the buttons where they were".
 *
 * @param answering what the write answers, or `did()` for a route that took it
 */
function aServerWhere(
  waiting: unknown,
  answering: () => Response = () => did(),
): void {
  closed = new Set()

  server = serverThat((path, init) => {
    if (path === '/api/me') {
      return new Response(JSON.stringify(HIM), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (path === '/api/inbox') {
      return asJson(
        ALL_FOUR.map((row) =>
          row.teamInvitationId !== null && closed.has(row.teamInvitationId)
            ? { ...row, teamInvitationId: null }
            : row,
        ),
      )
    }

    if (path === '/api/me/applications') {
      return asJson(withoutTheClosed(waiting))
    }

    if (/^\/api\/teams\/\d+\/invitations\/\d+$/.test(path)) {
      const said = answering()

      if (said.status < 400) {
        closed.add(Number(path.slice(path.lastIndexOf('/') + 1)))
      }

      return said
    }

    /* AND EVERY OTHER WRITE IS REFUSED RATHER THAN LET THROUGH, so a screen that sent its answer
       somewhere else entirely does not quietly meet the 404 at the bottom of the disc reader and
       look like a route that said no. */
    return init?.method === undefined || init.method === 'GET' ? null : answeredWith(500)
  })
}

function asJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/** The waiting list with whatever the server has since closed taken out of it, which is what the
 *  real route does by deleting the row. */
function withoutTheClosed(waiting: unknown): unknown {
  if (waiting === null || typeof waiting !== 'object') {
    return waiting
  }

  const invitations: unknown = Reflect.get(waiting, 'teamInvitations')
  const standing = Array.isArray(invitations) ? invitations : []

  return {
    ...waiting,
    teamInvitations: standing.filter(
      (one: unknown) =>
        !(one !== null && typeof one === 'object' && closed.has(Number(Reflect.get(one, 'id')))),
    ),
  }
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
 * WHICH VERB CARRIED IT, and `member/pairInviteAnswered.test.tsx` measured why this is its own
 * question: a screen's `'PUT'` changed to `'POST'` left every case of that file green, because
 * the fake server matches on the path alone while `TeamJoiningWriteApi` maps `@PutMapping` at
 * this address and `@PostMapping` at a DIFFERENT one. A harness looser than the server is a
 * harness that can only be trusted where something asks the question it skips.
 */
function verbFor(path: string): (string | undefined)[] {
  return (server?.asked ?? []).filter((one) => one.path === path).map((one) => one.init?.method)
}

function theAcceptButton(): HTMLElement | null {
  return screen.queryByRole('button', { name: sr.teams.inviteAccept })
}

function theRefuseButton(): HTMLElement {
  return screen.getByRole('button', { name: sr.teams.inviteRefuse })
}

/** A day inside the transfer window, and one outside it. Whole days, written out rather than
 *  worked out from `inYearlyWindow`, for the reason `THE_ADDRESS` gives about itself. */
const IN_THE_WINDOW = '2026-11-15'
const OUTSIDE_IT = '2026-06-15'

/** The screen, opened on the message that asks, once the buttons are there. */
async function openTheQuestion(today = IN_THE_WINDOW): Promise<void> {
  renderAt(`/sr/poruke/${String(OPENED.id)}`, 'competitor', '000007', undefined, today)

  await screen.findByRole('heading', { level: 1, name: OPENED.subject })
  await screen.findByRole('button', { name: sr.teams.inviteRefuse })
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

describe('answering a served invitation into a team', () => {
  it(
    'accepts it, and sends both keys of the invitation this message asks about',
    async () => {
      const user = setupUser()

      aServerWhere(waitingWhere())
      await openTheQuestion()

      const accept = theAcceptButton()

      expect(accept).not.toBeNull()
      await user.click(accept as HTMLElement)

      /* **THE ADDRESS IS THE WHOLE OF THIS ASSERTION AND IT IS THE JOIN OF TWO ROUTES.** The
         invitation comes off `/api/inbox` and the team off `/api/me/applications`, and neither
         alone is an address. Seven other addresses this fixture could have produced are refused
         below, and each is a real mistake: the first invitation's team, its key, both of them,
         the message's key, and the same key read off either of the two other lists. */
      await waitFor(() => {
        expect(asked()).toContain(THE_ADDRESS)
      })

      for (const wrong of THE_WRONG_ADDRESSES) {
        expect(asked(), wrong).not.toContain(wrong)
      }

      /* **AND WHAT WAS SENT SAYS „PRIHVATI".** `TeamJoiningWriteApi.Answered` boxes this field
         on purpose - „a primitive would read it as „Odbij" and close somebody's question for
         him" - so a screen that sent nothing, or the wrong one of the two, answers for him. */
      expect(sentTo(THE_ADDRESS)).toEqual([{ accepted: true }])

      /* **AND BY `PUT`, which is the third of the three things a request is.** */
      expect(verbFor(THE_ADDRESS)).toEqual(['PUT'])
    },
    SLOW,
  )

  it(
    'refuses it, and that is a different body to the same address',
    async () => {
      const user = setupUser()

      aServerWhere(waitingWhere())
      await openTheQuestion()

      await user.click(theRefuseButton())

      await waitFor(() => {
        expect(asked()).toContain(THE_ADDRESS)
      })

      /* **THE SECOND HALF OF THE TWO BUTTONS, and it is the half that goes missing.** A screen
         that sent `true` from both would pass every case about accepting and would put the
         member into a team he refused. */
      expect(sentTo(THE_ADDRESS)).toEqual([{ accepted: false }])
      expect(verbFor(THE_ADDRESS)).toEqual(['PUT'])
    },
    SLOW,
  )

  it(
    'reads the inbox again once the server took the answer, and drops what he is waiting on',
    async () => {
      const user = setupUser()

      aServerWhere(waitingWhere())
      await openTheQuestion()

      const inboxBefore = asked().filter((one) => one === '/api/inbox').length

      await waitFor(() => {
        expect(arrivedResource('me/applications')).not.toBeUndefined()
      })

      const accept = theAcceptButton()

      await user.click(accept as HTMLElement)

      /* **The question is closed on the SERVER and the screen learns it by asking**, which is why
         the fake server above stops serving the pointer for an invitation it has answered. A
         screen that hid its own buttons would pass a case that only looked for them going. */
      await waitFor(() => {
        expect(theAcceptButton()).toBeNull()
      })

      expect(asked().filter((one) => one === '/api/inbox').length).toBeGreaterThan(inboxBefore)

      /* **AND THE SECOND CACHE IS DROPPED RATHER THAN RE-READ, which is a difference worth
         stating because it looks like a weaker claim and is the true one.** This component goes
         with the answer - the re-read line carries no pointer any more - so there is no mounted
         reader left to ask again, and a `revision` here would be machinery for nobody. What has
         to be true is that the next mount does not find the old answer waiting: entering a team
         leaves every OTHER team's invitation standing (PDL, 06.09.2026: „Poziv se ne pamti kao
         odgovoren") while `alreadyInATeam` turns true, so a kept answer would go on offering
         „Prihvati" under every one of them. */
      expect(arrivedResource('me/applications')).toBeUndefined()
    },
    SLOW,
  )

  it(
    'drops the teams it has read on „Prihvati" and leaves them alone on „Odbij"',
    async () => {
      const user = setupUser()

      /* **THE FLOOR UNDER BOTH HALVES: the roster really is in hand before either button is
         pressed.** `member/MessageDetail.tsx` reads `useTeams()` for the screen that answers a
         session-held invitation, so this name is populated on every message. Without this line
         „it was dropped" and „it was never there" are the same green. */
      aServerWhere(waitingWhere())
      await openTheQuestion()

      await waitFor(() => {
        expect(arrivedResource('teams')).not.toBeUndefined()
      })

      await user.click(theRefuseButton())

      await waitFor(() => {
        expect(asked()).toContain(THE_ADDRESS)
      })

      /* **„Odbij" WRITES NOTHING ABOUT A SQUAD** (PDL, 06.09.2026: „Odbijanje ne upisuje ništa o
         sastavu"), so a portal that dropped the teams after it would be throwing away an answer
         nothing had changed, and a reader of `member/teamWrites.ts` could no longer tell which of
         the two answers joins a team. */
      expect(arrivedResource('teams')).not.toBeUndefined()
    },
    SLOW,
  )

  it(
    'drops the teams it has read once „Prihvati" went through',
    async () => {
      const user = setupUser()

      aServerWhere(waitingWhere())
      await openTheQuestion()

      await waitFor(() => {
        expect(arrivedResource('teams')).not.toBeUndefined()
      })

      const accept = theAcceptButton()

      await user.click(accept as HTMLElement)

      /* **THE OTHER HALF OF THE SAME AXIS.** „Prihvati" is the one answer that writes
         `team_membership`, and `app/Shell.tsx` holds every screen under one outlet, so walking
         from this message to his own profile or to the team's page without a fresh read would
         show him no team a moment after he joined one. */
      await waitFor(() => {
        expect(arrivedResource('teams')).toBeUndefined()
      })
    },
    SLOW,
  )

  it(
    'holds „Prihvati" back outside the transfer window and keeps „Odbij" beside the sentence',
    async () => {
      const user = setupUser()

      aServerWhere(waitingWhere())
      await openTheQuestion(OUTSIDE_IT)

      /* **PDL, 06.09.2026: „„Prihvati" traži prelazni rok, „Odbij" ne."** Two halves of one
         sentence, and the second is the one that goes missing: the same entry says what taking
         it away would cost, „član pozvan 30. decembra ne bi mogao ni da prihvati ni da se
         oslobodi pitanja do sledećeg oktobra". */
      expect(theAcceptButton()).toBeNull()
      expect(screen.getByText(sr.teams.inviteWaits)).toBeVisible()

      /* AND IT IS NOT MERELY DRAWN: it still reaches the route, on a day the window is shut. */
      await user.click(theRefuseButton())

      await waitFor(() => {
        expect(asked()).toContain(THE_ADDRESS)
      })

      expect(sentTo(THE_ADDRESS)).toEqual([{ accepted: false }])
    },
    SLOW,
  )

  it(
    'holds „Prihvati" back for a member who already has a team, and keeps „Odbij"',
    async () => {
      const user = setupUser()

      aServerWhere(waitingWhere(true))
      await openTheQuestion()

      /* **PDL, 06.09.2026: „Čim član ima tim, nijedan drugi poziv ne nudi „Prihvati"."** The
         sentence names one button and this case is the other one still being there. */
      expect(theAcceptButton()).toBeNull()
      expect(screen.getByText(sr.teams.inviteOvertakenUnnamed)).toBeVisible()
      /* AND NOT THE OTHER SENTENCE, which is the half the backend's own note insists on: folded
         together, „Poziv čeka" and „u međuvremenu si ušao/la u tim" „would call every waiting
         invitation dead for nine months of the year". */
      expect(screen.queryByText(sr.teams.inviteWaits)).toBeNull()

      await user.click(theRefuseButton())

      await waitFor(() => {
        expect(asked()).toContain(THE_ADDRESS)
      })

      expect(sentTo(THE_ADDRESS)).toEqual([{ accepted: false }])
    },
    SLOW,
  )

  it(
    'says the window is shut, and not that he has a team, when both are true at once',
    async () => {
      aServerWhere(waitingWhere(true))
      await openTheQuestion(OUTSIDE_IT)

      /* **THE ORDER IS THE ROUTE'S OWN** (`TeamJoiningWriteApi.answering` asks
         `transferWindowOpen` and only then `standsInHisWay`), so the two doors answer one
         question one way. Read the other way round the screen would say „you have joined a team"
         where the route would have said „the window is shut", and nothing else would notice.
         It is the truthful order as well: leaving a team is in the very same window as joining
         one (PDL, 24.09.2026), so by October he may be free to accept. */
      expect(screen.getByText(sr.teams.inviteWaits)).toBeVisible()
      expect(screen.queryByText(sr.teams.inviteOvertakenUnnamed)).toBeNull()
      expect(theAcceptButton()).toBeNull()
    },
    SLOW,
  )

  it(
    'draws no buttons at all for a question the server does not say he is waiting on',
    async () => {
      aServerWhere({ ...(waitingWhere() as object), teamInvitations: [{ id: 44, teamId: 5, date: '2026-10-09' }] })

      renderAt(
        `/sr/poruke/${String(OPENED.id)}`,
        'competitor',
        '000007',
        undefined,
        IN_THE_WINDOW,
      )

      await screen.findByRole('heading', { level: 1, name: OPENED.subject })
      await screen.findByText(sr.teams.inviteClosed)

      /* **„Somebody else's" and „gone" are ONE answer here and that is written down rather than
         pretended about.** `GET /api/me/applications` answers only about the caller, so a key
         naming another member's question is simply not in the list and the screen cannot tell the
         two apart. What it must never do is guess a team: half an address is worse than none. */
      expect(theAcceptButton()).toBeNull()
      expect(screen.queryByRole('button', { name: sr.teams.inviteRefuse })).toBeNull()
      expect(asked().filter((one) => one.startsWith('/api/teams/'))).toEqual([])
    },
    SLOW,
  )

  it(
    'says the question is not there when the route answers 404, without re-reading the inbox',
    async () => {
      const user = setupUser()

      aServerWhere(waitingWhere(), () => answeredWith(404))
      await openTheQuestion()

      const before = asked().filter((one) => one === '/api/inbox').length

      await user.click(theRefuseButton())

      await screen.findByText(sr.teams.inviteClosed)

      /* **Told INSTEAD of the buttons**, because a question the server says is not there cannot
         be answered by pressing again. */
      expect(theAcceptButton()).toBeNull()
      expect(screen.queryByRole('button', { name: sr.teams.inviteRefuse })).toBeNull()

      /* **AND NOTHING IS DROPPED WHERE THE SERVER DID NOT AGREE.** Re-read, the line would come
         back unchanged, the buttons would return, and the member would be told two things at
         once. */
      expect(asked().filter((one) => one === '/api/inbox').length).toBe(before)
    },
    SLOW,
  )

  it(
    'reads a refusal the route names out of the very map the screen drew its own sentence from',
    async () => {
      const user = setupUser()

      /* The screen is drawn where „Prihvati" IS offered - the server says he has no team - and
         the route refuses with the name for the opposite. That is the real race this refusal
         exists for: he joined a team between the drawing and the press. */
      aServerWhere(waitingWhere(), () => refused('heIsAlreadyInATeam', 409))
      await openTheQuestion()

      const accept = theAcceptButton()

      expect(accept).not.toBeNull()
      await user.click(accept as HTMLElement)

      /* **THE JOIN BETWEEN THE TWO HALVES OF THIS GUARD, and it is one sentence read twice.** The
         case above draws this same sentence from `GET /api/me/applications` before anything is
         sent; this one draws it from the route's own word. A screen that answered the two out of
         two different keys would pass both of those cases separately and tell the member two
         different things about one fact. */
      expect(await screen.findByText(sr.teams.inviteOvertakenUnnamed)).toBeVisible()
    },
    SLOW,
  )

  it(
    'says a refusal it does not know out loud, code and all',
    async () => {
      const user = setupUser()

      aServerWhere(waitingWhere(), () => refused('somethingNobodyHasWritten'))
      await openTheQuestion()

      await user.click(theRefuseButton())

      /* A screen one release behind its server must not choose the nearest sentence it does have,
         which is `ServerSaid`'s own rule. `pages/account/refusals.test.ts` is what keeps this
         branch from ever being reached in production. */
      expect(await screen.findByText(/somethingNobodyHasWritten/)).toBeVisible()
    },
    SLOW,
  )

  it(
    'sends one answer when two presses land inside one task',
    async () => {
      aServerWhere(waitingWhere())
      await openTheQuestion()

      const refuse = theRefuseButton()

      /* **NOT `user.click` TWICE.** Testing Library awaits between clicks, which lets React
         render, so a guard held in `useState` alone would pass here while being absent. Two
         dispatches inside one `act` is the only shape that tells a ref from a state. */
      await act(async () => {
        refuse.click()
        refuse.click()
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(asked()).toContain(THE_ADDRESS)
      })

      /* A second „Prihvati" would meet `team_membership_one_team_at_a_time` rather than a tidy
         refusal, so what the member would read is whatever a broken constraint answers. */
      expect(sentTo(THE_ADDRESS)).toHaveLength(1)
    },
    SLOW,
  )

  it(
    'puts nothing at all under a message that only tells',
    async () => {
      aServerWhere(waitingWhere())

      renderAt(
        `/sr/poruke/${String(ONLY_TELLS.id)}`,
        'competitor',
        '000007',
        undefined,
        IN_THE_WINDOW,
      )

      await screen.findByRole('heading', { level: 1, name: ONLY_TELLS.subject })

      expect(theAcceptButton()).toBeNull()
      expect(screen.queryByRole('button', { name: sr.teams.inviteRefuse })).toBeNull()
      /* AND NO SENTENCE EITHER, which is the half that bites: a screen that ran on every message
         would find nothing in `teamInvitations` and draw „Ovaj poziv više ne stoji." under a
         receipt. */
      expect(screen.queryByText(sr.teams.inviteClosed)).toBeNull()
      /* AND IT DID NOT EVEN ASK. `GET /api/me/applications` has exactly one caller on the portal
         (`data/useResource.ts`, `useWhatIsWaiting`), so this is the one address that says whether
         this screen ran at all. */
      expect(asked()).not.toContain('/api/me/applications')
    },
    SLOW,
  )

  it(
    'leaves a message about a racing pair to the other screen, and the ADDRESS is what says so',
    async () => {
      const user = setupUser()

      aServerWhere(waitingWhere())

      renderAt(
        `/sr/poruke/${String(A_PAIR_QUESTION.id)}`,
        'competitor',
        '000007',
        undefined,
        IN_THE_WINDOW,
      )

      await screen.findByRole('heading', { level: 1, name: A_PAIR_QUESTION.subject })
      const refuse = await screen.findByRole('button', { name: sr.pair.refuse })

      /* **THE BUTTONS CANNOT TELL THE TWO SCREENS APART AND THAT IS A FACT ABOUT THE DICTIONARY,
         measured here rather than assumed.** `teams.inviteAccept` and `pair.accept` are both
         „Prihvati", and `teams.inviteRefuse` and `pair.refuse` are both „Odbij", so a query by
         accessible name matches whichever screen drew them. A first draft of this case asked for
         the team's refuse button to be absent and went red on the PAIR screen's own button,
         which is a case that would have passed just as happily over the two screens swapped.
         What tells them apart is where the press goes, so that is what is asked. */
      expect(asked()).not.toContain('/api/me/applications')

      await user.click(refuse)

      await waitFor(() => {
        expect(asked()).toContain('/api/pairs/77')
      })

      expect(asked().filter((one) => one.startsWith('/api/teams/'))).toEqual([])
    },
    SLOW,
  )
})
