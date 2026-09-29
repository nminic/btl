import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import sr from '../i18n/sr.json'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { did, refused, serverThat, type Asked } from '../test/serverAnswers'
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

/** Three applications, and the one every write case presses is the MIDDLE one. No day is
 *  `DAY_IN` or `DAY_OUT`, so a screen drawing today where it means the day of the asking would
 *  be drawing a different string. */
const ASKING = [
  { id: 41, memberNumber: '000004', date: '2026-05-02' },
  { id: 57, memberNumber: '000006', date: '2026-05-04' },
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
 */
const ASKED = [
  { id: 88, memberNumber: '000010', date: '2026-05-03' },
  { id: 94, memberNumber: null, date: '2026-05-07' },
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
 */
function aServerWithAQueue(toAWrite: () => Response = did) {
  let asking = ASKING
  let asked = ASKED

  return serverThat((path, init) => {
    const how = init?.method ?? 'GET'

    if (how === 'GET' && path === '/api/teams') {
      return listOf(TEAMS_ON_FILE)
    }

    if (how === 'GET' && path === '/api/competitors') {
      return listOf(MEMBERS_ON_FILE.filter((one) => one.active))
    }

    if (how === 'GET' && path === `/api/teams/${String(MINE.id)}/applications`) {
      return listOf(asking)
    }

    if (how === 'GET' && path === `/api/teams/${String(MINE.id)}/invitations`) {
      return listOf(asked)
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
   * A QUEUE THE ROUTE REFUSES IS THE SAME AS AN EMPTY ONE, and that is ADL A8 rather than a
   * shortcut. `TeamJoiningApi` answers 404 both to a team that does not exist and to a caller
   * who does not lead it, „so no answer here is an oracle for which teams exist", and a screen
   * that told the two apart would be claiming a difference the server refuses to make.
   */
  it('draws nothing when the route answers 404, though this reader holds the seat', async () => {
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

      /* Waited for through something the page really draws, so the absence below is measured on
         a page that arrived rather than on one that had not got there yet. */
      expect(await screen.findByRole('heading', { name: MINE.name }, { timeout: SLOW })).toBeVisible()

      expect(screen.queryByRole('heading', { name: sr.teams.joinWaiting })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: sr.teams.inviteSent })).not.toBeInTheDocument()
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

      /* And the sentence about the refusal is gone, because it was about a press two presses
         ago. */
      expect(screen.queryByText(sr.teams.decideRefused.theWindowIsShut)).not.toBeInTheDocument()

      expect(writes(server.asked)).toHaveLength(2)
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
