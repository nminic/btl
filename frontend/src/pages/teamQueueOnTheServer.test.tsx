import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import sr from '../i18n/sr.json'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { answeredWith, did, refused, serverThat, type Asked } from '../test/serverAnswers'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'

/**
 * WHAT A TEAM SEES WAITING ON IT, AND WHAT IT PRESSES, BOTH AGAINST THE SERVER.
 *
 * <p>Owner, PDL 06.09.2026: „Uz to strana tima pokazuje i pozive koje je poslala, da tim ne
 * zavisi od poruke." Until 29.09.2026 both lists came out of `session/SessionProvider.tsx` and
 * nothing was sent anywhere, so every case about them was satisfied by the browser's own copy.
 * These read the socket.
 *
 * <p><b>NOTHING IS FIRST ON ANY LIST HERE, and that is the whole shape of this file.</b> The
 * team is `nisavski-maraton-klub`, which is the SECOND team on file; the application pressed is
 * the SECOND of three; the invitation taken back is the SECOND of three; the member answered is
 * neither the first in the roster nor the reader; and no row's day is the day it is read on. A
 * fixture with one of anything is satisfied by a screen that reached for whatever came first.
 *
 * <p><b>AND THE TWO MIDDLE ROWS ARE ONE NUMBER.</b> The application pressed and the invitation
 * taken back both carry `SHARED_NUMBER`, for the reason given where it is declared. The last
 * `describe` in this file is where that is measured.
 */

/* Read rather than restated: which team is which and who is in it are facts about the seed, and
   a fixture that wrote them out again would pass the day the seed moved and the portal did
   not. */
const TEAMS_ON_FILE: { id: number; slug: string; name: string }[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/teams.json'), 'utf-8'),
)

type FileMember = {
  memberNumber: string
  firstName: string
  lastName: string
  teamId: number | null
  active: boolean
}

const MEMBERS_ON_FILE: FileMember[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'),
)

const teamAt = (slug: string) =>
  must(
    TEAMS_ON_FILE.find((one) => one.slug === slug),
    `${slug} in the generated teams`,
  )

const memberAt = (number: string) =>
  must(
    MEMBERS_ON_FILE.find((one) => one.memberNumber === number),
    `${number} in the generated roster`,
  )

const nameOf = (number: string) => `${memberAt(number).firstName} ${memberAt(number).lastName}`

/** The team all of this is asked of, and it is the second on file. `000005` holds its seat and
 *  stands in it, so he leads it; `000011` runs for it and does not. */
const MINE = teamAt('nisavski-maraton-klub')

/** Another team whose seat its own reader holds, for the case that a reader who leads ONE team
 *  is nobody on the page of another. */
const NOT_MINE = teamAt('vardarski-krug')

const LEADS_IT = '000005'

const STANDS_IN_IT = '000011'

const ALSO_STANDS_IN_IT = '000002'

const LEADS_ANOTHER = '000003'

/* A day inside the transfer window and a day outside it. „Prihvati" traži prelazni rok, „Odbij"
   ne (PDL, 06.09.2026), so the difference between these two is one button and nothing else. */
const DAY_IN = '2026-10-15'

const DAY_OUT = '2026-06-15'

/**
 * THE ONE NUMBER THAT STANDS ON BOTH LISTS, on the middle row of each.
 *
 * <p>`team_application.id` and `team_invitation.id` are two `bigserial` columns, each with a
 * sequence of its own (`V12__joining_a_team_and_a_pair.sql`), so an application and an
 * invitation with the same number is an ordinary state of the portal and not a coincidence a
 * fixture may leave out. `QueueRow` says so in its own type: „application 7 and invitation 7
 * are two different rows."
 *
 * <p><b>Until 29.09.2026 the two lists stood on disjoint numbers</b> (41, 57 and 63 against 88,
 * 94 and 99), and that is why the kind, which is half of a row's name, had no guard: nothing in
 * this file could tell a screen that names a row by its kind and its number from one that names
 * it by its number alone (review of PR 448). Only these two rows repeat a number, so every other
 * row is still one whose number belongs to nobody else.
 */
const SHARED_NUMBER = 57

/** Three applications, and the one every write case presses is the MIDDLE one. No day is
 *  `DAY_IN` or `DAY_OUT`, so a screen drawing today where it means the day of the asking would
 *  be drawing a different string. */
const ASKING = [
  { id: 41, memberNumber: '000004', date: '2026-05-02' },
  { id: SHARED_NUMBER, memberNumber: '000006', date: '2026-05-04' },
  { id: 63, memberNumber: '000008', date: '2026-05-06' },
]

const PRESSED = must(ASKING[1], 'the middle application')

/**
 * Three invitations, and the middle one names NOBODY.
 *
 * <p>That is the asymmetry of the two routes standing in one fixture: an invitation to a member
 * whose fee has lapsed keeps its row and loses its name („whom it asked, or NULL where his fee
 * has since lapsed", `TeamJoiningApi.Invitation`), while an application from such a member is
 * not listed at all. The third names a number the roster has not got, which is the other way a
 * name can be missing and is a different sentence.
 *
 * <p>The middle one is also the row that shares its number with the middle application
 * (`SHARED_NUMBER`). The other two are numbered in ascending order beside it, as the route gives
 * them, and neither repeats a number that stands on the other list.
 */
const ASKED = [
  { id: 52, memberNumber: '000010', date: '2026-05-03' },
  { id: SHARED_NUMBER, memberNumber: null, date: '2026-05-07' },
  { id: 99, memberNumber: '000099', date: '2026-05-09' },
]

const TAKEN_BACK = must(ASKED[1], 'the middle invitation')

const listOf = (what: unknown): Response =>
  new Response(JSON.stringify(what), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

/**
 * A SERVER THAT ANSWERS BOTH QUEUES AND BOTH WRITES THE WAY THE ROUTES DO, AND REMEMBERS.
 *
 * <p><b>The team is taken off the ADDRESS and never off the fixture</b>, so a screen that asked
 * the right question about the wrong team is answered nothing here and the assertions say so.
 * That is the one mistake two routes with an id in the path invite.
 *
 * <p><b>It also carries out what the writes really do to the lists</b>, because that is what
 * the screen is then measured on: answering an application takes its row out (the route deletes
 * it either way, „an accepted, refused or withdrawn invitation is a row that has been
 * DELETED"), and taking an invitation back takes that row out.
 *
 * @param toAWrite what the two write routes answer, 204 where a case does not say otherwise.
 *                 Anything else leaves both lists exactly as they were, because a refusal is a
 *                 thing that did not happen.
 * @param failing how each list is read, which a case may change while it runs: nothing for a
 *                list that is read, a number for a route that answers that number, nought for a
 *                server that cannot be reached at all, and a function for an answer that has to
 *                be held (the only way to look at the screen while it is asking again).
 */
type HowAListIsRead = null | number | (() => Response | Promise<Response>)

function aServerWithAQueue(
  toAWrite: () => Response = did,
  failing: { applications: HowAListIsRead; invitations: HowAListIsRead } = {
    applications: null,
    invitations: null,
  },
) {
  let asking = ASKING
  let asked = ASKED

  const read = (how: HowAListIsRead, rows: unknown): Response | Promise<Response> => {
    if (how === null) {
      return listOf(rows)
    }

    if (typeof how === 'function') {
      return how()
    }

    return how === 0 ? Promise.reject(new TypeError('Failed to fetch')) : answeredWith(how)
  }

  return serverThat((path, init) => {
    const how = init?.method ?? 'GET'

    if (how === 'GET' && path === '/api/teams') {
      return listOf(TEAMS_ON_FILE)
    }

    if (how === 'GET' && path === '/api/competitors') {
      return listOf(MEMBERS_ON_FILE.filter((one) => one.active))
    }

    if (how === 'GET' && path === `/api/teams/${String(MINE.id)}/applications`) {
      return read(failing.applications, asking)
    }

    if (how === 'GET' && path === `/api/teams/${String(MINE.id)}/invitations`) {
      return read(failing.invitations, asked)
    }

    const decided = new RegExp(`^/api/teams/${String(MINE.id)}/applications/(\\d+)$`).exec(path)

    if (how === 'PUT' && decided !== null) {
      const answer = toAWrite()

      if (answer.status === 204) {
        asking = asking.filter((one) => one.id !== Number(decided[1]))
      }

      return answer
    }

    const withdrawn = new RegExp(`^/api/teams/${String(MINE.id)}/invitations/(\\d+)$`).exec(path)

    if (how === 'DELETE' && withdrawn !== null) {
      const answer = toAWrite()

      if (answer.status === 204) {
        asked = asked.filter((one) => one.id !== Number(withdrawn[1]))
      }

      return answer
    }

    /* Everything else a GET goes on to the disc reader, which is what keeps the rest of the
       team's page drawn. Anything else written is answered 204 so that a write this screen
       should not be sending shows up in the record rather than as a broken page. */
    return how === 'GET' ? null : did()
  })
}

/** What was written, and to where, off the recording server's own account of it. */
function writes(asked: Asked[]): { path: string; how: string; body: string }[] {
  return asked
    .filter((one) => one.init?.method !== undefined && one.init.method !== 'GET')
    .map((one) => ({
      path: one.path,
      how: String(one.init?.method),
      body: String(one.init?.body ?? ''),
    }))
}

/** Which addresses were READ, so a case can say that a screen asked nothing at all. */
const reads = (asked: Asked[]) =>
  asked.filter((one) => (one.init?.method ?? 'GET') === 'GET').map((one) => one.path)

const waitingList = async () =>
  within(await screen.findByRole('list', { name: sr.teams.joinWaiting }, { timeout: SLOW }))

const sentList = async () =>
  within(await screen.findByRole('list', { name: sr.teams.inviteSent }, { timeout: SLOW }))

const at = (slug: string) => `/sr/tim/${slug}`

describe('the two queues on a team its reader leads', () => {
  it('draws every application with the man and the day, off the route', async () => {
    const server = aServerWithAQueue()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      const rows = (await waitingList()).getAllByRole('listitem')

      /* Three rows and in the order the route gave them, which is oldest first. Read as a
         list of texts rather than one by one, so a screen that drew the right three in the
         wrong order fails here. */
      expect(rows.map((one) => one.textContent)).toEqual([
        expect.stringContaining(nameOf('000004')),
        expect.stringContaining(nameOf('000006')),
        expect.stringContaining(nameOf('000008')),
      ])

      /* AND THE DAY OF THE ASKING, not the day it is read on. The two are different strings
         here on purpose: `DAY_IN` is 15 October and every row is in May. */
      expect(must(rows[1], 'the middle row').textContent).toContain('4. 5. 2026.')
      expect(must(rows[1], 'the middle row').textContent).not.toContain('15. 10. 2026.')
    } finally {
      server.stop()
    }
  }, SLOW)

  it('draws every invitation it has sent, and names nobody where the fee has lapsed', async () => {
    const server = aServerWithAQueue()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      const rows = (await sentList()).getAllByRole('listitem')

      /* THREE ROWS AND THREE DIFFERENT ANSWERS TO „who is this about", which is why all three
         stand in one fixture: a name, the sentence for a member the portal may not name, and a
         bare number for one the roster has not got. */
      expect(rows.map((one) => one.textContent)).toEqual([
        expect.stringContaining(nameOf('000010')),
        expect.stringContaining(sr.teams.inviteLapsed),
        expect.stringContaining('000099'),
      ])

      /* And the row that names nobody names nobody: the number is withheld as well as the
         name, which is what „NI POSREDNO" (PDL, 13.09.2026) asks for. */
      expect(must(rows[1], 'the middle row').textContent).toContain('7. 5. 2026.')
      expect(must(rows[1], 'the middle row').textContent).not.toMatch(/\d{6}/)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('offers both answers inside the transfer window, each naming its own man', async () => {
    const server = aServerWithAQueue()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      await waitingList()

      /* Both controls carry the name of whoever is being answered about, because two members
         waiting on one team put two controls with one name on the screen otherwise (WCAG 2.2
         AA, SC 2.4.6). Asked for the MIDDLE row, so a screen labelling every button with the
         first man's name fails. */
      expect(
        screen.getByRole('button', {
          name: `${sr.teams.joinTaken}: ${nameOf(PRESSED.memberNumber)}`,
        }),
      ).toBeVisible()
      expect(
        screen.getByRole('button', {
          name: `${sr.teams.joinRefused}: ${nameOf(PRESSED.memberNumber)}`,
        }),
      ).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  /**
   * OUTSIDE THE WINDOW THE LIST IS STILL DRAWN AND „Odbij" IS STILL OFFERED.
   *
   * <p>PDL, 06.09.2026: „<b>„Prihvati" traži prelazni rok, „Odbij" ne.</b> ... Odbijanje ne
   * upisuje ništa o sastavu nego samo završava pitanje." The entry names what binding both
   * would cost, and the prototype this replaces did bind both: it drew the whole section under
   * `inYearlyWindow(today)`, so for nine months of the year a team could neither take somebody
   * in nor free him of the question.
   *
   * <p><b>The mutation this case exists for is putting that condition back on the section</b>,
   * and it fails on the heading rather than on the button.
   */
  it('still draws the applications outside the window, with „Odbij" and no „Primi u tim"', async () => {
    const server = aServerWithAQueue()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_OUT)

      expect((await waitingList()).getAllByRole('listitem')).toHaveLength(3)

      expect(
        screen.getByRole('button', {
          name: `${sr.teams.joinRefused}: ${nameOf(PRESSED.memberNumber)}`,
        }),
      ).toBeVisible()

      /* And nothing that could take him in, which is the half a merely invisible button would
         leave open. */
      expect(screen.queryAllByRole('button', { name: new RegExp(`^${sr.teams.joinTaken}:`) })).toEqual(
        [],
      )
    } finally {
      server.stop()
    }
  }, SLOW)

  it('still offers „Povuci poziv" outside the window, because it writes nothing about a squad', async () => {
    const server = aServerWithAQueue()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_OUT)

      await sentList()

      expect(
        screen.getByRole('button', {
          name: `${sr.teams.inviteWithdraw}: ${sr.teams.inviteLapsed}`,
        }),
      ).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('draws no heading for a queue the route answers empty', async () => {
    const server = serverThat((path, init) => {
      const how = init?.method ?? 'GET'

      if (how === 'GET' && path === '/api/teams') {
        return listOf(TEAMS_ON_FILE)
      }

      if (how === 'GET' && path === '/api/competitors') {
        return listOf(MEMBERS_ON_FILE.filter((one) => one.active))
      }

      if (how === 'GET' && path === `/api/teams/${String(MINE.id)}/applications`) {
        return listOf([])
      }

      return how === 'GET' && path === `/api/teams/${String(MINE.id)}/invitations`
        ? listOf(ASKED)
        : null
    })

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      /* The other queue is drawn, which is what says the screen got as far as drawing anything:
         a page that failed to load at all would satisfy the absence below by itself. */
      expect((await sentList()).getAllByRole('listitem')).toHaveLength(3)

      expect(
        screen.queryByRole('heading', { name: sr.teams.joinWaiting }),
      ).not.toBeInTheDocument()
    } finally {
      server.stop()
    }
  }, SLOW)

  /**
   * A QUEUE THE ROUTE REFUSES IS A QUEUE THAT COULD NOT BE READ, and it is NOT the same as an empty
   * one since 02.10.2026 (PENDING stavka 368; the case below says what is drawn instead).
   * `TeamJoiningApi` answers 404 both to a team that does not exist and to a caller who does not
   * lead it, „so no answer here is an oracle for which teams exist" (ADL A8), and a screen that
   * said which of the two it was would be claiming a difference the server refuses to make. So the
   * sentence says only that the list could not be read, and why is not on offer.
   */
  it('says both queues cannot be read when the route answers 404, though this reader holds the seat', async () => {
    const server = serverThat((path, init) => {
      const how = init?.method ?? 'GET'

      if (how === 'GET' && path === '/api/teams') {
        return listOf(TEAMS_ON_FILE)
      }

      if (how === 'GET' && path === '/api/competitors') {
        return listOf(MEMBERS_ON_FILE.filter((one) => one.active))
      }

      return how === 'GET' && path.startsWith(`/api/teams/${String(MINE.id)}/`)
        ? new Response(null, { status: 404 })
        : null
    })

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      /* Waited for through something the page really draws, so what follows is measured on a page
         that arrived rather than on one that had not got there yet. */
      expect(await screen.findByRole('heading', { name: MINE.name }, { timeout: SLOW })).toBeVisible()

      expect(await screen.findByText(sr.teams.applicationsUnreadable, undefined, { timeout: SLOW })).toBeVisible()
      expect(screen.getByText(sr.teams.invitationsUnreadable)).toBeVisible()
      expect(screen.queryByRole('list', { name: sr.teams.joinWaiting })).toBeNull()
      expect(screen.queryByRole('list', { name: sr.teams.inviteSent })).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)
})

describe('the two queues for a reader they are not for', () => {
  /* FIVE READERS AND ONE ANSWER, and three of them stand in a team, because „a member of this
     team" is not one state: the one who leads it is answered, and two who merely stand in it are
     not. The prototype this replaces drew the SENT INVITATIONS for every member of the team;
     the narrowing follows the owner's decision of 27.09.2026 („Poziv u tim salje samo
     administrator tog tima") and its recorded consequence about taking one back. */
  it.each([
    ['somebody who stands in the team and does not lead it', STANDS_IN_IT, MINE.slug],
    ['another member who stands in the team and does not lead it', ALSO_STANDS_IN_IT, MINE.slug],
    ['somebody who leads a different team', LEADS_ANOTHER, MINE.slug],
    ['the reader of a team he has nothing to do with', LEADS_IT, NOT_MINE.slug],
  ])('draws neither queue for %s, and asks for neither', async (_who, reader, slug) => {
    const server = aServerWithAQueue()

    try {
      renderAt(at(slug), 'competitor', reader, undefined, DAY_IN)

      expect(
        await screen.findByRole('heading', { name: teamAt(slug).name }, { timeout: SLOW }),
      ).toBeVisible()

      expect(screen.queryByRole('heading', { name: sr.teams.joinWaiting })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: sr.teams.inviteSent })).not.toBeInTheDocument()

      /* AND NOTHING WAS ASKED OF EITHER ADDRESS, which is the half a hidden section leaves
         open: a screen that fetched and then declined to draw would still be telling the
         server who is reading which team's queue. */
      expect(reads(server.asked).filter((one) => /\/applications$|\/invitations$/.test(one))).toEqual(
        [],
      )
    } finally {
      server.stop()
    }
  }, SLOW)

  it('draws neither queue for a visitor, and asks for neither', async () => {
    const server = aServerWithAQueue()

    try {
      renderAt(at(MINE.slug), 'visitor', null, undefined, DAY_IN)

      expect(
        await screen.findByRole('heading', { name: MINE.name }, { timeout: SLOW }),
      ).toBeVisible()

      expect(screen.queryByRole('heading', { name: sr.teams.joinWaiting })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: sr.teams.inviteSent })).not.toBeInTheDocument()
      expect(reads(server.asked).filter((one) => /\/applications$|\/invitations$/.test(one))).toEqual(
        [],
      )
    } finally {
      server.stop()
    }
  }, SLOW)
})

describe('what the team presses', () => {
  const takeHimIn = () =>
    screen.getByRole('button', { name: `${sr.teams.joinTaken}: ${nameOf(PRESSED.memberNumber)}` })

  const refuseHim = () =>
    screen.getByRole('button', {
      name: `${sr.teams.joinRefused}: ${nameOf(PRESSED.memberNumber)}`,
    })

  const takeItBack = () =>
    screen.getByRole('button', {
      name: `${sr.teams.inviteWithdraw}: ${sr.teams.inviteLapsed}`,
    })

  it('sends „Primi u tim" to that row of that team, and reads the queue again', async () => {
    const server = aServerWithAQueue()
    const user = setupUser()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      await waitingList()
      await user.click(takeHimIn())

      /* The row is gone because the ROUTE took it out and the screen read the list again. The
         route answers 204, so nothing about what stands afterwards was in the answer. */
      await waitFor(
        () => {
          expect((screen.getAllByRole('listitem') ?? []).map((one) => one.textContent)).not.toContain(
            expect.stringContaining(nameOf(PRESSED.memberNumber)),
          )
        },
        { timeout: SLOW },
      )

      await waitFor(
        async () => {
          expect((await waitingList()).getAllByRole('listitem')).toHaveLength(2)
        },
        { timeout: SLOW },
      )

      /* ONE WRITE, TO THE MIDDLE ROW OF THE SECOND TEAM, and carrying the answer rather than an
         empty body: `accepted` is the whole difference between taking somebody in and closing
         his question. */
      expect(writes(server.asked)).toEqual([
        {
          path: `/api/teams/${String(MINE.id)}/applications/${String(PRESSED.id)}`,
          how: 'PUT',
          body: '{"accepted":true}',
        },
      ])
    } finally {
      server.stop()
    }
  }, SLOW)

  it('sends „Odbij" to the same row with the other answer', async () => {
    const server = aServerWithAQueue()
    const user = setupUser()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      await waitingList()
      await user.click(refuseHim())

      await waitFor(
        async () => {
          expect((await waitingList()).getAllByRole('listitem')).toHaveLength(2)
        },
        { timeout: SLOW },
      )

      expect(writes(server.asked)).toEqual([
        {
          path: `/api/teams/${String(MINE.id)}/applications/${String(PRESSED.id)}`,
          how: 'PUT',
          body: '{"accepted":false}',
        },
      ])
    } finally {
      server.stop()
    }
  }, SLOW)

  it('sends „Povuci poziv" to that invitation, and the row goes', async () => {
    const server = aServerWithAQueue()
    const user = setupUser()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      await sentList()
      await user.click(takeItBack())

      await waitFor(
        async () => {
          expect((await sentList()).getAllByRole('listitem')).toHaveLength(2)
        },
        { timeout: SLOW },
      )

      /* The row that names nobody is still addressable, which is the whole reason the route
         keeps it: dropped from the list, the team would be shown an empty place, ask the same
         man again and be refused. */
      expect(writes(server.asked)).toEqual([
        {
          path: `/api/teams/${String(MINE.id)}/invitations/${String(TAKEN_BACK.id)}`,
          how: 'DELETE',
          body: '{}',
        },
      ])
    } finally {
      server.stop()
    }
  }, SLOW)

  /**
   * THE REFUSAL STANDS UNDER THE ROW IT WAS PRESSED ON AND UNDER NO OTHER.
   *
   * <p>Two rows are two questions about two people, and a sentence floating above both would
   * leave the reader working out which of them it is about. Measured on the MIDDLE row so that
   * a screen drawing it under the first fails.
   */
  it('says why „Primi u tim" did not happen, under that row', async () => {
    const server = aServerWithAQueue(() => refused('theWindowIsShut', 409))
    const user = setupUser()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      const rows = (await waitingList()).getAllByRole('listitem')

      await user.click(takeHimIn())

      expect(
        await screen.findByText(sr.teams.decideRefused.theWindowIsShut, undefined, {
          timeout: SLOW,
        }),
      ).toBeVisible()

      /* Under the middle row and not under the first, read off the row itself rather than off
         the page. */
      expect(must(rows[1], 'the middle row').textContent).toContain(
        sr.teams.decideRefused.theWindowIsShut,
      )
      expect(must(rows[0], 'the first row').textContent).not.toContain(
        sr.teams.decideRefused.theWindowIsShut,
      )

      /* And nothing was taken out of the list, because a refusal is a thing that did not
         happen. */
      expect((await waitingList()).getAllByRole('listitem')).toHaveLength(3)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says the number out loud when the withdrawal is refused, since that route names no reason', async () => {
    const server = aServerWithAQueue(() => new Response(null, { status: 404 }))
    const user = setupUser()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      await sentList()
      await user.click(takeItBack())

      /* `server.wrong` is „Server je odgovorio brojem {status}...", which is what an empty 404
         can honestly be turned into: `TeamJoiningWriteApi.takeBack` answers 204 or an empty 404
         and names nothing, so there is no sentence of its own to draw. */
      expect(
        await screen.findByText(/404/, undefined, { timeout: SLOW }),
      ).toBeVisible()

      expect((await sentList()).getAllByRole('listitem')).toHaveLength(3)
    } finally {
      server.stop()
    }
  }, SLOW)

  /**
   * A REFUSAL DOES NOT LEAVE THE ROW DEAD, which is what a guard released anywhere but in a
   * `finally` would do.
   */
  it('lets the same row be pressed again after a refusal', async () => {
    let refuseIt = true
    const server = aServerWithAQueue(() =>
      refuseIt ? refused('theWindowIsShut', 409) : did(),
    )
    const user = setupUser()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      await waitingList()
      await user.click(takeHimIn())

      expect(
        await screen.findByText(sr.teams.decideRefused.theWindowIsShut, undefined, {
          timeout: SLOW,
        }),
      ).toBeVisible()

      refuseIt = false

      await user.click(takeHimIn())

      await waitFor(
        async () => {
          expect((await waitingList()).getAllByRole('listitem')).toHaveLength(2)
        },
        { timeout: SLOW },
      )

      /* The sentence is gone, but this case says NOTHING about why: the row it stood under
         went out of the list when the second press succeeded, so it would be gone whether
         the sentence was cleared or not. The case below is the one that tells the two
         apart, and it was written because a mutation deleting `setRefused(null)` walked
         straight through this one. */
      expect(screen.queryByText(sr.teams.decideRefused.theWindowIsShut)).not.toBeInTheDocument()

      expect(writes(server.asked)).toHaveLength(2)
    } finally {
      server.stop()
    }
  }, SLOW)

  /**
   * A PRESS ON ANOTHER ROW CLEARS THE SENTENCE, AND THE ROW IT STOOD UNDER IS STILL THERE.
   *
   * <p><b>Written because a mutation survived</b> (series of 29.09.2026, the one that deletes
   * `setRefused(null)`). The case above walks the same code and cannot see it: there, the row
   * that was refused is the row that then succeeds, so it leaves the list and takes its
   * sentence with it whether anything cleared the sentence or not. Two sources for one absence.
   *
   * <p>So here the two presses are on TWO rows. The middle row is refused, the first row is then
   * answered and goes; the middle row is still drawn, and what has to be gone from under it is
   * the sentence and nothing else.
   */
  it('clears the sentence when another row is pressed, and leaves that row standing', async () => {
    let refuseIt = true
    const server = aServerWithAQueue(() => (refuseIt ? refused('theWindowIsShut', 409) : did()))
    const user = setupUser()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      await waitingList()
      await user.click(takeHimIn())

      expect(
        await screen.findByText(sr.teams.decideRefused.theWindowIsShut, undefined, {
          timeout: SLOW,
        }),
      ).toBeVisible()

      refuseIt = false

      const other = must(ASKING[0], 'the first application')

      await user.click(
        screen.getByRole('button', {
          name: `${sr.teams.joinRefused}: ${nameOf(other.memberNumber)}`,
        }),
      )

      await waitFor(
        async () => {
          expect((await waitingList()).getAllByRole('listitem')).toHaveLength(2)
        },
        { timeout: SLOW },
      )

      /* The refused row is STILL THERE, which is what makes the absence below about the
         sentence rather than about the row. */
      const rows = (await waitingList()).getAllByRole('listitem')

      expect(rows.map((one) => one.textContent)).toEqual([
        expect.stringContaining(nameOf(PRESSED.memberNumber)),
        expect.stringContaining(nameOf('000008')),
      ])
      expect(must(rows[0], 'the row that was refused').textContent).not.toContain(
        sr.teams.decideRefused.theWindowIsShut,
      )
      expect(screen.queryByText(sr.teams.decideRefused.theWindowIsShut)).not.toBeInTheDocument()
    } finally {
      server.stop()
    }
  }, SLOW)
})

describe('two presses on one row', () => {
  const takeHimIn = () =>
    screen.getByRole('button', { name: `${sr.teams.joinTaken}: ${nameOf(PRESSED.memberNumber)}` })

  /**
   * TWO PRESSES WITH NOTHING AWAITED BETWEEN THEM ARE ONE REQUEST.
   *
   * <p><b>`user.click` cannot produce a genuine double press</b>, which is the finding of the
   * review of PR 442 in as many words: it awaits its own click and lets React render, so the
   * state beside the ref has caught up by the time a second press is tried and a mutation
   * swapping one for the other survives. So this fires two raw clicks on the very same button
   * inside one `act`: nothing commits between them, and the second is handled by the very
   * closure the first was.
   *
   * <p>What the second request would cost is `TeamJoiningWriteApi.decide`'s 404 - the row is no
   * longer there to be answered - drawn over an answer that had just gone through.
   */
  it('sends one request, and tells the control off while its own request is out', async () => {
    const server = aServerWithAQueue()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      await waitingList()

      const button = takeHimIn()

      act(() => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      await waitFor(
        async () => {
          expect((await waitingList()).getAllByRole('listitem')).toHaveLength(2)
        },
        { timeout: SLOW },
      )

      expect(writes(server.asked)).toEqual([
        {
          path: `/api/teams/${String(MINE.id)}/applications/${String(PRESSED.id)}`,
          how: 'PUT',
          body: '{"accepted":true}',
        },
      ])
    } finally {
      server.stop()
    }
  }, SLOW)

  /**
   * AND THE LOCK IS ON THE ROW RATHER THAN ON THE SCREEN.
   *
   * <p>Two rows are two questions about two different people, and answering one must not hold
   * the other up. The first answer is held open so the order is the point rather than a race:
   * while the middle application is still travelling, the first one is answered and gets
   * through.
   */
  it('lets another row be pressed while one row has a request out', async () => {
    let letItAnswer = () => {}
    const held = new Promise<void>((go) => {
      letItAnswer = go
    })

    const server = aServerWithAQueue()
    const answering = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith(`/applications/${String(PRESSED.id)}`) && init?.method === 'PUT') {
        await held
      }

      return answering(input, init)
    }

    const user = setupUser()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      await waitingList()
      await user.click(takeHimIn())

      /* It says out loud that it cannot act, rather than going away and taking the keyboard
         focus with it. */
      await waitFor(
        () => {
          expect(takeHimIn()).toHaveAttribute('aria-disabled', 'true')
        },
        { timeout: SLOW },
      )

      const other = must(ASKING[0], 'the first application')

      /* And the OTHER row is not told off, which is the half „is anything out" would get
         wrong. */
      const its = screen.getByRole('button', {
        name: `${sr.teams.joinRefused}: ${nameOf(other.memberNumber)}`,
      })

      expect(its).not.toHaveAttribute('aria-disabled')

      await user.click(its)

      /* THE OTHER ROW'S ANSWER REALLY WENT, and it went while the first was still out: the
         held request has not even reached the recording server yet, which is what „still out"
         means and is the second half of this claim. A lock on the screen rather than on the row
         would leave this list empty. */
      await waitFor(
        () => {
          expect(writes(server.asked).map((one) => one.path)).toEqual([
            `/api/teams/${String(MINE.id)}/applications/${String(other.id)}`,
          ])
        },
        { timeout: SLOW },
      )

      letItAnswer()

      /* And once it is let go, the first one lands as well, so nothing was lost by being made
         to wait. Read as a set rather than in order: the holding is in front of the recorder,
         so the request that was held is recorded last however it was sent. */
      await waitFor(
        () => {
          expect(writes(server.asked).map((one) => one.path).sort()).toEqual(
            [
              `/api/teams/${String(MINE.id)}/applications/${String(other.id)}`,
              `/api/teams/${String(MINE.id)}/applications/${String(PRESSED.id)}`,
            ].sort(),
          )
        },
        { timeout: SLOW },
      )
    } finally {
      globalThis.fetch = answering
      server.stop()
    }
  }, SLOW)
})

/**
 * A ROW IS A KIND AND A NUMBER, AND THESE ARE THE CASES THAT HOLD THE KIND.
 *
 * <p>`useTeamQueue.theSameRow` names a row by its kind AND its number, and `TeamQueue.why` says
 * the same thing again by hand to decide which row a refusal is drawn under: one fact in two
 * homes. While no two rows shared a number the kind was half of a name that nothing guarded.
 * The review of PR 448 compared by the number alone in the one and dropped `refused.row.kind ===
 * row.kind` from the other, and every case in this file stayed green both times.
 *
 * <p>Here the middle application and the middle invitation are ONE NUMBER (`SHARED_NUMBER`), so
 * they are two rows to a screen that keeps the kind and one row to a screen that has lost it.
 * <b>Each case begins by saying that the two rows really do share a number</b>, because a
 * fixture that stopped repeating it would leave both cases measuring nothing and still green.
 */
describe('one number on both lists', () => {
  const takeHimIn = () =>
    screen.getByRole('button', { name: `${sr.teams.joinTaken}: ${nameOf(PRESSED.memberNumber)}` })

  const takeItBack = () =>
    screen.getByRole('button', {
      name: `${sr.teams.inviteWithdraw}: ${sr.teams.inviteLapsed}`,
    })

  /**
   * A REFUSAL STANDS UNDER THE ROW IT WAS PRESSED ON AND NOT UNDER THE ROW THAT HAS ITS NUMBER.
   *
   * <p>The half of `why` that is the kind. Application 57 is refused here, and invitation 57 is
   * drawn on the same page a few lines below it. Compared by the number alone, a sentence about a
   * window on a squad would stand under a team's invitation to somebody else, and be drawn with
   * the dictionary of the other verb.
   *
   * <p><b>The row the sentence must not stand under is measured as a row that is THERE.</b> It is
   * found, and it is the one that names nobody, before anything is asked about the sentence: an
   * absence read off a list that was never drawn would be satisfied by a screen that drew
   * nothing.
   */
  it('draws a refusal under the application and not under the invitation that has its number', async () => {
    const server = aServerWithAQueue(() => refused('theWindowIsShut', 409))
    const user = setupUser()

    try {
      expect(TAKEN_BACK.id).toBe(PRESSED.id)

      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      const application = must(
        (await waitingList()).getAllByRole('listitem')[1],
        'the application that has the shared number',
      )
      const invitation = must(
        (await sentList()).getAllByRole('listitem')[1],
        'the invitation that has the shared number',
      )

      await user.click(takeHimIn())

      /* On the application's own row FIRST, which is what says the press was refused and drawn
         at all: everything below is an absence, and it is measured after this. */
      expect(
        await within(application).findByText(sr.teams.decideRefused.theWindowIsShut, undefined, {
          timeout: SLOW,
        }),
      ).toBeVisible()

      /* The invitation is drawn, and it is the one that names nobody, which is the one that
         stands at this number. Then the sentence is asked for across the whole list of
         invitations rather than across that one row, so no other row can carry it either. */
      expect(invitation.textContent).toContain(sr.teams.inviteLapsed)
      expect(
        (await sentList()).queryByText(sr.teams.decideRefused.theWindowIsShut),
      ).not.toBeInTheDocument()
    } finally {
      server.stop()
    }
  }, SLOW)

  /**
   * THE LOCK AND THE MARK ARE ON THE ROW, AND A ROW IS A KIND AND A NUMBER.
   *
   * <p>Application 57's answer is held on the wire. While it is out, invitation 57 is taken back
   * and the route REFUSES, and four things must be true after that. They are the four places
   * `theSameRow` is asked, each measured on its own, so that `one.id === two.id` in any ONE of
   * them fails here and not only the mutation that changes all four at once:
   *
   * <ul>
   * <li>invitation 57's control is not told off by application 57's request (`busy`);
   * <li>its own request goes out at all, which is what the sentence under its row says (the
   * guard in `send`);
   * <li>once that request is over, application 57's control is STILL told off (the release in
   * `finally`, for the list a render reads);
   * <li>and a second press on application 57 is STILL swallowed (the release in `finally`, for
   * the list a handler reads).
   * </ul>
   *
   * <p><b>The withdrawal is refused rather than answered 204, and that is the whole design of the
   * last step.</b> A press that got past the guard would clear that sentence at once
   * (`setRefused(null)`), where a second request in flight only shows up in the record some time
   * later, and a case that waits for something NOT to happen cannot say how long is enough.
   *
   * <p>The same sentence is also the answer to `why`'s kind in the other direction: it is the
   * refusal of an invitation, and it must not be drawn under the application that has its number.
   *
   * <p><b>Its own clock is twice `SLOW`</b>, for the reason `event/eventActions.test.tsx` gives: a
   * wait that never resolves would otherwise die on the case's clock at the same instant as its
   * own, and print `Test timed out` where it could have named the step.
   */
  it('keeps an application locked while the invitation with its number is taken back and refused', async () => {
    let letItAnswer = () => {}
    const held = new Promise<void>((go) => {
      letItAnswer = go
    })
    let refuseIt = true

    const server = aServerWithAQueue(() => (refuseIt ? new Response(null, { status: 404 }) : did()))
    const answering = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith(`/applications/${String(PRESSED.id)}`) && init?.method === 'PUT') {
        await held
      }

      return answering(input, init)
    }

    const user = setupUser()

    try {
      expect(TAKEN_BACK.id).toBe(PRESSED.id)

      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      await waitingList()
      await sentList()
      await user.click(takeHimIn())

      await waitFor(
        () => {
          expect(takeHimIn()).toHaveAttribute('aria-disabled', 'true')
        },
        { timeout: SLOW },
      )

      /* `busy`: the application's request is out, and the invitation is another row. */
      expect(takeItBack()).not.toHaveAttribute('aria-disabled')

      await user.click(takeItBack())

      /* The guard in `send`: the withdrawal went while the application's request was still out,
         and the route's refusal is drawn under ITS row. */
      const invitation = must(
        (await sentList()).getAllByRole('listitem')[1],
        'the invitation that has the shared number',
      )

      expect(await within(invitation).findByText(/404/, undefined, { timeout: SLOW })).toBeVisible()

      /* And under the application that has its number it is NOT drawn: that is `why`'s kind, from
         the other side. The application is a row that is there and names its own man. */
      const application = must(
        (await waitingList()).getAllByRole('listitem')[1],
        'the application that has the shared number',
      )

      expect(application.textContent).toContain(nameOf(PRESSED.memberNumber))
      expect(within(application).queryByText(/404/)).not.toBeInTheDocument()

      /* The release in `finally`, for what a render reads: the invitation's request is over and
         the application's is not. */
      expect(takeHimIn()).toHaveAttribute('aria-disabled', 'true')

      /* The release in `finally`, for what a handler reads: a second press on the application
         is swallowed, so it leaves the sentence where it is. */
      await user.click(takeHimIn())

      expect(within(invitation).getByText(/404/)).toBeVisible()

      refuseIt = false
      letItAnswer()

      await waitFor(
        async () => {
          expect((await waitingList()).getAllByRole('listitem')).toHaveLength(2)
        },
        { timeout: SLOW },
      )

      /* One request each, and the withdrawal came first because the other was held. */
      expect(writes(server.asked).map((one) => `${one.how} ${one.path}`)).toEqual([
        `DELETE /api/teams/${String(MINE.id)}/invitations/${String(TAKEN_BACK.id)}`,
        `PUT /api/teams/${String(MINE.id)}/applications/${String(PRESSED.id)}`,
      ])
    } finally {
      globalThis.fetch = answering
      server.stop()
    }
  }, SLOW * 2)
})

/**
 * A LIST THAT COULD NOT BE READ SAYS SO, AND DOES NOT LOOK LIKE A LIST THAT HOLDS NOTHING (owner,
 * 02.10.2026, PENDING stavka 368).
 *
 * <p>Measured with a probe on the screen before this existed: the server answered an error to
 * both reads only AFTER a press that succeeded, and what the team saw was both headings gone and
 * the two applications it had never answered gone with them, with nothing saying that the server
 * had not been reached. The decision he took after being shown that moment, in the words of the
 * PDL's record of it and not his: „Spisak koji ne moze da se ucita KAZE to, umesto da izgleda
 * prazan, uz dugme „Pokusaj ponovo"."
 *
 * <p><b>The axes are the list, the way it fails, and the moment.</b> The two lists fail on their
 * own (one read can come back while the other does not), by four different routes that are one
 * outcome, and at two different moments: the first read of the page, and the read that follows a
 * press that worked.
 *
 * <p><b>A list that is read and holds nothing is still no section at all</b> (`draws no heading
 * for a queue the route answers empty`, above): the decision is about a list that could not be
 * read, and a heading over a list that was read and is empty announced applications that were not
 * there (review, 06.09.2026).
 */
describe('a queue that could not be read', () => {
  type Failing = { applications: HowAListIsRead; invitations: HowAListIsRead }

  const asking = () => screen.getByRole('heading', { name: sr.teams.joinWaiting })
  const asked = () => screen.getByRole('heading', { name: sr.teams.inviteSent })
  const retryOf = (list: string) => screen.queryByRole('button', { name: `${sr.data.retry}: ${list}` })
  const refuseHim = () =>
    screen.getByRole('button', {
      name: `${sr.teams.joinRefused}: ${nameOf(PRESSED.memberNumber)}`,
    })

  it('says the applications cannot be read, draws the invitations, and offers to ask again', async () => {
    const server = aServerWithAQueue(did, { applications: 500, invitations: null })

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      expect(await screen.findByText(sr.teams.applicationsUnreadable, undefined, { timeout: SLOW })).toBeVisible()
      expect(asking(), 'a list that cannot be read keeps its name').toBeVisible()
      expect(screen.queryByRole('list', { name: sr.teams.joinWaiting })).toBeNull()
      expect(retryOf(sr.teams.joinWaiting)).toBeVisible()

      /* AND THE OTHER LIST IS DRAWN AS IT IS: its own read came back. Saying both could not be
         read over a list that was read would be the opposite of the fault, a screen that hides
         what it has. */
      expect((await sentList()).getAllByRole('listitem')).toHaveLength(3)
      expect(screen.queryByText(sr.teams.invitationsUnreadable)).toBeNull()
      expect(retryOf(sr.teams.inviteSent)).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says the invitations cannot be read, draws the applications, and offers to ask again', async () => {
    const server = aServerWithAQueue(did, { applications: null, invitations: 500 })

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      expect(await screen.findByText(sr.teams.invitationsUnreadable, undefined, { timeout: SLOW })).toBeVisible()
      expect(asked()).toBeVisible()
      expect(screen.queryByRole('list', { name: sr.teams.inviteSent })).toBeNull()
      expect(retryOf(sr.teams.inviteSent)).toBeVisible()

      expect((await waitingList()).getAllByRole('listitem')).toHaveLength(3)
      expect(screen.queryByText(sr.teams.applicationsUnreadable)).toBeNull()
      expect(retryOf(sr.teams.joinWaiting)).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says both when both fail, each under its own name and with its own button', async () => {
    const server = aServerWithAQueue(did, { applications: 500, invitations: 500 })

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      expect(await screen.findByText(sr.teams.applicationsUnreadable, undefined, { timeout: SLOW })).toBeVisible()
      expect(screen.getByText(sr.teams.invitationsUnreadable)).toBeVisible()
      expect(asking()).toBeVisible()
      expect(asked()).toBeVisible()
      /* Two buttons with one visible word, told apart by the list each is about (WCAG 2.2 SC
         2.5.3 keeps the visible word first in the name). */
      expect(retryOf(sr.teams.joinWaiting)).toBeVisible()
      expect(retryOf(sr.teams.inviteSent)).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  /* FOUR WAYS TO FAIL AND ONE SENTENCE: the sentence does not say which, because the route does
     not (a 404 is „no such team" and „not yours" at once, ADL A8) and a screen that guessed would
     be claiming what it cannot know. */
  it.each([
    ['a 500', 500],
    ['a 404', 404],
    ['a 401', 401],
    ['a server that cannot be reached', 0],
  ])('says it on %s', async (_how, how) => {
    const server = aServerWithAQueue(did, { applications: how, invitations: null })

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      expect(await screen.findByText(sr.teams.applicationsUnreadable, undefined, { timeout: SLOW })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('asks both lists again when the button is pressed, and draws what comes back', async () => {
    const failing: Failing = { applications: 500, invitations: 500 }
    const server = aServerWithAQueue(did, failing)
    const user = setupUser()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)
      await screen.findByText(sr.teams.applicationsUnreadable, undefined, { timeout: SLOW })

      const before = reads(server.asked).filter((one) => /\/applications$|\/invitations$/.test(one)).length

      failing.applications = null
      failing.invitations = null
      await user.click(must(retryOf(sr.teams.joinWaiting), 'the button of the applications'))

      expect((await waitingList()).getAllByRole('listitem')).toHaveLength(3)
      expect((await sentList()).getAllByRole('listitem')).toHaveLength(3)
      expect(screen.queryByText(sr.teams.applicationsUnreadable)).toBeNull()
      expect(screen.queryByText(sr.teams.invitationsUnreadable)).toBeNull()

      /* BOTH addresses were asked once more: they are one question in two routes, and a screen
         that showed a fresh queue beside a stale one would be telling two different moments. */
      const after = reads(server.asked).filter((one) => /\/applications$|\/invitations$/.test(one)).length

      expect(after - before).toBe(2)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says it is asking while the answer is out, and says the failure again when it comes back the same', async () => {
    let letGo: () => void = () => undefined
    const failing: Failing = { applications: 500, invitations: null }
    const server = aServerWithAQueue(did, failing)
    const user = setupUser()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)
      await screen.findByText(sr.teams.applicationsUnreadable, undefined, { timeout: SLOW })

      failing.applications = () =>
        new Promise<Response>((resolve) => {
          letGo = () => {
            resolve(answeredWith(500))
          }
        })
      await user.click(must(retryOf(sr.teams.joinWaiting), 'the button of the applications'))

      /* While it is out the sentence is replaced by the loader's own word, and the button is told
         off rather than switched off, so a second press while it is out asks nothing more. */
      expect(await screen.findByText(sr.data.loading)).toBeVisible()
      expect(screen.queryByText(sr.teams.applicationsUnreadable)).toBeNull()
      expect(retryOf(sr.teams.joinWaiting)).toHaveAttribute('aria-disabled', 'true')

      const out = reads(server.asked).filter((one) => /\/applications$/.test(one)).length

      await user.click(must(retryOf(sr.teams.joinWaiting), 'the button of the applications'))
      expect(reads(server.asked).filter((one) => /\/applications$/.test(one)).length).toBe(out)

      letGo()

      /* And it says it AGAIN, which is what tells the reader the press was answered: the same
         sentence coming back is a new alert and not the old one left standing. */
      expect(await screen.findByText(sr.teams.applicationsUnreadable)).toBeVisible()
      expect(screen.queryByText(sr.data.loading)).toBeNull()
      expect(retryOf(sr.teams.joinWaiting)).not.toHaveAttribute('aria-disabled', 'true')
    } finally {
      server.stop()
    }
  }, SLOW)

  /**
   * THE MOMENT THE OWNER WAS SHOWN: the press worked, and the read that follows it could not.
   *
   * <p>The row that was answered is gone from the server, and what is left on the page is rows
   * that were true a second ago. They are NOT drawn: a list that says it could not be read and is
   * drawn anyway is a list the team goes on answering from, and the one it just answered is among
   * the rows it would be shown (`useResource`: „a screen showing half its data as if it were all
   * of it is worse than a screen saying it is broken").
   */
  it('says both lists cannot be read after a press that worked, and draws none of what it held', async () => {
    const failing: Failing = { applications: null, invitations: null }
    const server = aServerWithAQueue(() => {
      failing.applications = 500
      failing.invitations = 500

      return did()
    }, failing)
    const user = setupUser()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      await waitingList()
      await user.click(refuseHim())

      expect(await screen.findByText(sr.teams.applicationsUnreadable, undefined, { timeout: SLOW })).toBeVisible()
      expect(screen.getByText(sr.teams.invitationsUnreadable)).toBeVisible()
      expect(screen.queryByRole('list', { name: sr.teams.joinWaiting })).toBeNull()
      expect(screen.queryByRole('list', { name: sr.teams.inviteSent })).toBeNull()

      /* And asking again brings back what the server really holds: the application that was
         answered is not in it. */
      failing.applications = null
      failing.invitations = null
      await user.click(must(retryOf(sr.teams.joinWaiting), 'the button of the applications'))

      await waitFor(
        async () => {
          expect((await waitingList()).getAllByRole('listitem')).toHaveLength(2)
        },
        { timeout: SLOW },
      )
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says nothing while the first read is still on its way, and draws the list when it comes', async () => {
    /* A read that has not come back is not one that failed. Both lists start as lists that were
       read and hold nothing, which draws no section, and the sentence is for a read that really
       did fail: said while the first read is out, it would be said over every page that is merely
       slow. */
    let letGo: () => void = () => undefined
    const failing: Failing = {
      applications: () =>
        new Promise<Response>((resolve) => {
          letGo = () => {
            resolve(listOf(ASKING))
          }
        }),
      invitations: null,
    }
    const server = aServerWithAQueue(did, failing)

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      /* The page has arrived, and neither list has: the two are one question in two routes and
         are drawn together, so nothing of either is on the screen while one is still out. */
      expect(await screen.findByRole('heading', { name: MINE.name }, { timeout: SLOW })).toBeVisible()
      expect(screen.queryByText(sr.teams.applicationsUnreadable)).toBeNull()
      expect(screen.queryByText(sr.teams.invitationsUnreadable)).toBeNull()
      expect(screen.queryByRole('heading', { name: sr.teams.joinWaiting })).toBeNull()
      expect(screen.queryByRole('heading', { name: sr.teams.inviteSent })).toBeNull()

      letGo()

      expect((await waitingList()).getAllByRole('listitem')).toHaveLength(3)
      expect((await sentList()).getAllByRole('listitem')).toHaveLength(3)
      expect(screen.queryByText(sr.teams.applicationsUnreadable)).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('lets the next press through after an asking again that failed', async () => {
    /* The other half of the guard against a second press while one is out: a guard written with a
       ref that is never turned back would refuse every press for the rest of the visit, so a team
       whose server came back after the second try could never be shown its queue. */
    const failing: Failing = { applications: 500, invitations: null }
    const server = aServerWithAQueue(did, failing)
    const user = setupUser()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)
      await screen.findByText(sr.teams.applicationsUnreadable, undefined, { timeout: SLOW })

      const applicationsAsked = () =>
        reads(server.asked).filter((one) => /\/applications$/.test(one)).length

      await user.click(must(retryOf(sr.teams.joinWaiting), 'the button of the applications'))

      /* Until the asking again has really come back and failed: a second press made while it is
         still out is refused, which is the other case's business and would make this one wait for
         a read that was never sent. */
      await waitFor(() => {
        expect(applicationsAsked()).toBe(2)
      })
      await waitFor(() => {
        expect(retryOf(sr.teams.joinWaiting)).not.toHaveAttribute('aria-disabled', 'true')
      })

      failing.applications = null
      await user.click(must(retryOf(sr.teams.joinWaiting), 'the button of the applications'))

      expect((await waitingList()).getAllByRole('listitem')).toHaveLength(3)
      expect(applicationsAsked()).toBe(3)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says both lists are being asked for while both answers are out', async () => {
    /* One press asks BOTH lists, so both sentences give way to the loader's word, and the button
       of each list is told off: a screen that tells only the list it was pressed under that
       something is happening leaves the other one saying it could not be read over a read that is
       out. */
    const failing: Failing = { applications: 500, invitations: 500 }
    const server = aServerWithAQueue(did, failing)
    const user = setupUser()

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)
      await screen.findByText(sr.teams.applicationsUnreadable, undefined, { timeout: SLOW })

      failing.applications = () => new Promise<Response>(() => undefined)
      failing.invitations = () => new Promise<Response>(() => undefined)
      await user.click(must(retryOf(sr.teams.joinWaiting), 'the button of the applications'))

      expect(await screen.findAllByText(sr.data.loading)).toHaveLength(2)
      expect(screen.queryByText(sr.teams.applicationsUnreadable)).toBeNull()
      expect(screen.queryByText(sr.teams.invitationsUnreadable)).toBeNull()
      expect(retryOf(sr.teams.joinWaiting)).toHaveAttribute('aria-disabled', 'true')
      expect(retryOf(sr.teams.inviteSent)).toHaveAttribute('aria-disabled', 'true')
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says nothing about a list that was read and holds nothing', async () => {
    /* The other side of every case above: told apart from a list that could not be read, an empty
       list stays no section, so a team with nothing waiting is not told its queue is broken. */
    const server = serverThat((path, init) => {
      const how = init?.method ?? 'GET'

      if (how === 'GET' && path === '/api/teams') {
        return listOf(TEAMS_ON_FILE)
      }

      if (how === 'GET' && path === '/api/competitors') {
        return listOf(MEMBERS_ON_FILE.filter((one) => one.active))
      }

      return how === 'GET' && path.startsWith(`/api/teams/${String(MINE.id)}/`) ? listOf([]) : null
    })

    try {
      renderAt(at(MINE.slug), 'competitor', LEADS_IT, undefined, DAY_IN)

      expect(await screen.findByRole('heading', { name: MINE.name }, { timeout: SLOW })).toBeVisible()
      expect(screen.queryByText(sr.teams.applicationsUnreadable)).toBeNull()
      expect(screen.queryByText(sr.teams.invitationsUnreadable)).toBeNull()
      expect(screen.queryByRole('heading', { name: sr.teams.joinWaiting })).toBeNull()
      expect(screen.queryByRole('heading', { name: sr.teams.inviteSent })).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)
})
