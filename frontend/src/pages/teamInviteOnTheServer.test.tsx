import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import sr from '../i18n/sr.json'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { answeredWith, did, refused, serverThat, type Asked } from '../test/serverAnswers'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'
import { recordKey } from '../session/context'
import { useSession } from '../session/useSession'
import { MEMBERS } from './admin/entityForms'

/**
 * „POZOVI U TIM" ON SOMEBODY ELSE'S PROFILE, AGAINST THE SERVER (T5, 10.10.2026).
 *
 * <p>Two defects closed in one place (QA review of 09.10.2026, row 4): the press wrote the
 * invitation and its message into the browser of the one asking, so the member asked never saw
 * it; and the button was drawn to every member of a team, while PDL 27.09.2026 gives it to whoever
 * leads the team alone („Samo administrator tima, kako pise u Pravilniku").
 *
 * <p><b>NOTHING IS FIRST ON ANY LIST HERE</b>: the reader leads `nisavski-maraton-klub`, the
 * SECOND team on file; the member on the page is `000006`, not the first member with no team; and
 * where the team's list names him, he is not its first row.
 */

/* EVERY WAIT OF THIS FILE IS GIVEN HALF OF THE TIME A CASE HAS, the arrangement
   `pages/admin/saveWhileSaving.test.tsx` holds and for its reason: `test/setup.ts` gives both
   `SLOW`, so a wait that never succeeds and the case waiting for it ran out together and the case
   ended in `Test timed out` and not in the assertion's own words, which a series of mutations
   cannot tell from a fault of the machine. Measured on the first series of T5 (10.10.2026): the
   case written for taking back the right application (`teamJoinOnTheServer.test.tsx`) timed out
   instead of failing. No wait here names a time of its own, so this line decides all of them, and
   the case at the foot of the file holds it. */
configure({ asyncUtilTimeout: SLOW / 2 })

const TEAMS_ON_FILE: { id: number; slug: string; name: string }[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/teams.json'), 'utf-8'),
)

type FileMember = { memberNumber: string; active: boolean }

const MEMBERS_ON_FILE: FileMember[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'),
)

const teamAt = (slug: string) =>
  must(
    TEAMS_ON_FILE.find((one) => one.slug === slug),
    `${slug} in the generated teams`,
  )

/** The reader's team, second on file. `000005` holds its seat and stands in it. */
const HIS = teamAt('nisavski-maraton-klub')

/** The first team on file, whose list must never be the one read for this reader. */
const FIRST = teamAt('dunavski-trkaci')

const LEADS_IT = '000005'

/** In the same team since 2017, so longer than the seat, and not its administrator. */
const STANDS_IN_IT = '000011'

/** The member on the page: no team, and not the first member with no team. */
const ASKED = '000006'

const ASKED_AT = '/sr/takmicar/000006-ivona-stamenkovska'

const ASKED_NAME = /Ivona Stamenkovska/

/** Another member with no team, for the next profile visited. */
const NEXT_AT = '/sr/takmicar/000008-ognjen-perisic'

/** A member of Dunavski trkači, for a profile that offers nothing. */
const IN_A_TEAM_AT = '/sr/takmicar/000013-damjan-krstic'

const DAY_IN = '2026-10-16'

const DAY_OUT = '2026-06-15'

type Invitation = { id: number; memberNumber: string | null; date: string }

/** What `POST` answers a new invitation with, which no list below carries. */
const NEW_KEY = 91

const json = (what: unknown, status = 200): Response =>
  new Response(JSON.stringify(what), { status, headers: { 'content-type': 'application/json' } })

/**
 * A SERVER THAT KEEPS EACH TEAM'S SENT INVITATIONS, AND ADDS ONE THE WAY THE ROUTE DOES.
 *
 * <p>A `POST` that answered 201 puts a row on the list of the team the ADDRESS names, naming the
 * member the BODY names, so a screen that asked the wrong team or named the wrong member is drawn
 * what it did rather than what it meant. A refusal changes nothing; `keeps: false` has the write
 * agree and the list not move, which is how a screen drawing the press is told from one drawing the
 * answer.
 */
type TheTeam = {
  lists?: Record<number, Invitation[]>
  post?: () => Response
  keeps?: boolean
  reading?: null | (() => Response | Promise<Response>)
  teams?: null | unknown[]
}

function aServerForTheTeam({
  lists = { [HIS.id]: [] },
  post = (): Response => json({ id: NEW_KEY, memberNumber: ASKED }, 201),
  keeps = true,
  reading = null,
  teams = null,
}: TheTeam = {}) {
  const standing: Record<number, Invitation[]> = { ...lists }

  return serverThat((path, init) => {
    const how = init?.method ?? 'GET'

    if (how === 'GET' && path === '/api/competitors') {
      return json(MEMBERS_ON_FILE.filter((one) => one.active))
    }

    if (how === 'GET' && path === '/api/teams' && teams !== null) {
      return json(teams)
    }

    const list = /^\/api\/teams\/(\d+)\/invitations$/.exec(path)

    if (list !== null && how === 'GET') {
      if (reading !== null) {
        return reading()
      }

      const rows = standing[Number(list[1])]

      return rows === undefined ? answeredWith(404) : json(rows)
    }

    if (list !== null && how === 'POST') {
      const answer = post()
      const named: unknown = JSON.parse(String(init?.body ?? '{}'))

      if (answer.status === 201 && keeps && typeof named === 'object' && named !== null) {
        standing[Number(list[1])] = [
          ...(standing[Number(list[1])] ?? []),
          { id: NEW_KEY, memberNumber: String(Reflect.get(named, 'memberNumber')), date: DAY_IN },
        ]
      }

      return answer
    }

    return how === 'GET' ? null : did()
  })
}

/** Every write of every verb, with what it carried. */
function writes(asked: Asked[]): { path: string; how: string; body: string }[] {
  return asked
    .filter((one) => (one.init?.method ?? 'GET') !== 'GET')
    .map((one) => ({ path: one.path, how: String(one.init?.method), body: String(one.init?.body ?? '') }))
}

const readsOfLists = (asked: Asked[]) =>
  asked
    .filter((one) => (one.init?.method ?? 'GET') === 'GET' && /\/invitations$/.test(one.path))
    .map((one) => one.path)

/** Lets everything already on its way land and be drawn. */
async function settled(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const theButton = () => screen.queryByRole('button', { name: sr.teams.invite })

const itStands = sr.teams.invited.replace('{team}', HIS.name)

/**
 * WHAT THE BROWSER HOLDS ABOUT THE INVITATION, which since T5 must stay empty whatever is pressed:
 * the session's invitations from every team at once, and the session's messages.
 *
 * <p><b>The messages are read AS THE MEMBER ASKED</b>, which is what the button does: the old
 * press wrote the invitation's message to him (`to: competitor.memberNumber`), and the session's
 * `inbox` shows the one signed in only what was written to him or to the whole league. Read as the
 * one who pressed, a message written to the member on the page is never on it, so a case looking
 * there would pass the old press.
 */
function HeldInTheBrowser() {
  const { invitations, inbox, signIn } = useSession()

  return (
    <>
      <button type="button" onClick={() => signIn(ASKED)}>
        read as the member asked
      </button>
      <ul aria-label="held in the browser">
        {invitations.map((one) => (
          <li key={one.id}>{`${one.id} | ${String(one.teamId)} | ${one.memberNumber}`}</li>
        ))}
        {inbox.map((one) => (
          <li key={one.id}>{`${one.to} | ${one.subject}`}</li>
        ))}
      </ul>
    </>
  )
}

const heldInTheBrowser = () =>
  within(screen.getByRole('list', { name: 'held in the browser' })).queryAllByRole('listitem')

/** Administration taking somebody out of his team, which a moderator moving a member writes and
 *  deleting a team writes for each of its members. A probe rather than the administration's
 *  screens, because what is measured is what the button does about it. */
function Emptied({ who }: { who: string }) {
  const { editRecord } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        editRecord(recordKey(MEMBERS.id, who), { teamId: '' })
      }}
    >
      isprazni {who}
    </button>
  )
}

describe('who is offered „Pozovi u tim"', () => {
  it('is offered to whoever leads the team, off the list of his own team', async () => {
    const server = aServerForTheTeam()

    try {
      renderAt(ASKED_AT, 'competitor', LEADS_IT, undefined, DAY_IN)

      expect(await screen.findByRole('button', { name: sr.teams.invite })).toBeVisible()
      /* His own team's list and no other, which is the second team on file. */
      expect(readsOfLists(server.asked)).toEqual([`/api/teams/${String(HIS.id)}/invitations`])
    } finally {
      server.stop()
    }
  }, SLOW)

  it('is not offered to a member who stands in the team without leading it, and nothing is asked for him', async () => {
    /* PDL 27.09.2026: „Poziv u tim šalje samo administrator tog tima." 000011 has been in the team
       longer than the founder who holds the seat, so a screen choosing the team by membership, or
       by who has been in it longest, offers him the button. */
    const server = aServerForTheTeam()

    try {
      renderAt(ASKED_AT, 'competitor', STANDS_IN_IT, undefined, DAY_IN)

      await screen.findByRole('heading', { level: 1, name: ASKED_NAME })
      await settled()

      expect(theButton()).toBeNull()
      expect(readsOfLists(server.asked)).toEqual([])
    } finally {
      server.stop()
    }
  }, SLOW)

  it.each([
    ['the founder whose seat it is', LEADS_IT, true],
    ['a member whose seat it is not', STANDS_IN_IT, false],
  ])('asks the seat the way the server answers it to a member: %s', async (_who, reader, offered) => {
    /* The shape `/api/teams` really answers a member: `foundedByMe`, and no seat number. */
    const teams = TEAMS_ON_FILE.map((one) => ({
      ...one,
      organizerMemberNumber: undefined,
      foundedByMe: one.id === HIS.id && reader === LEADS_IT,
    }))
    const server = aServerForTheTeam({ teams })

    try {
      renderAt(ASKED_AT, 'competitor', reader, undefined, DAY_IN)

      await screen.findByRole('heading', { level: 1, name: ASKED_NAME })
      await waitFor(() => {
        expect(theButton() !== null).toBe(offered)
      })
      await settled()

      expect(theButton() !== null).toBe(offered)
    } finally {
      server.stop()
    }
  }, SLOW)

  it.each([
    ['about somebody who already has a team', IN_A_TEAM_AT, 'competitor' as const, LEADS_IT, DAY_IN],
    ['outside the transfer window', ASKED_AT, 'competitor' as const, LEADS_IT, DAY_OUT],
    ['by a member who has no team of his own', NEXT_AT, 'competitor' as const, '000002', DAY_IN],
    ['to a visitor', ASKED_AT, 'visitor' as const, null, DAY_IN],
  ])('is not offered %s, and asks nothing', async (_how, address, role, reader, day) => {
    const server = aServerForTheTeam()

    try {
      renderAt(address, role, reader, undefined, day)

      await screen.findByRole('heading', { level: 1 })
      await settled()

      expect(theButton()).toBeNull()
      expect(readsOfLists(server.asked)).toEqual([])
    } finally {
      server.stop()
    }
  }, SLOW)
})

describe('who is offered „Pozovi u tim" when the record moves under him', () => {
  it('stops offering it to a leader whose team has just been emptied, and asks nothing more', async () => {
    /* Moved here from `teamInvite.test.tsx` with T5. The record is what says who is in a team, and
       the screen reads it each time it draws: held from the first drawing instead, the button would
       go on standing for somebody who is in no team, and the press would ask in the name of a team
       he has left. */
    const server = aServerForTheTeam()
    const user = setupUser()

    try {
      renderAt(ASKED_AT, 'competitor', LEADS_IT, undefined, DAY_IN, <Emptied who={LEADS_IT} />)

      expect(await screen.findByRole('button', { name: sr.teams.invite })).toBeVisible()

      await user.click(screen.getByRole('button', { name: `isprazni ${LEADS_IT}` }))

      expect(theButton()).toBeNull()
      expect(readsOfLists(server.asked)).toHaveLength(1)
    } finally {
      server.stop()
    }
  }, SLOW)
})

describe('what stands in the place of the button', () => {
  it('says the invitation stands where his team has asked HIM, and offers nothing to press', async () => {
    const server = aServerForTheTeam({
      lists: {
        [HIS.id]: [
          { id: 52, memberNumber: '000010', date: '2026-05-03' },
          { id: 57, memberNumber: null, date: '2026-05-07' },
          { id: 61, memberNumber: ASKED, date: '2026-05-09' },
        ],
      },
    })

    try {
      renderAt(ASKED_AT, 'competitor', LEADS_IT, undefined, DAY_IN)

      expect(await screen.findByText(itStands)).toBeVisible()
      expect(theButton()).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('offers the button where the list names others, and a member whose fee has lapsed', async () => {
    /* A team that has asked anybody at all is not a team that has asked him, and a row with no
       number is somebody the portal may not name, never the member on this page. */
    const server = aServerForTheTeam({
      lists: {
        [HIS.id]: [
          { id: 52, memberNumber: '000010', date: '2026-05-03' },
          { id: 57, memberNumber: null, date: '2026-05-07' },
        ],
      },
    })

    try {
      renderAt(ASKED_AT, 'competitor', LEADS_IT, undefined, DAY_IN)

      expect(await screen.findByRole('button', { name: sr.teams.invite })).toBeVisible()
      expect(screen.queryByText(itStands)).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('reads his own team and not the first team on file, which has asked the member', async () => {
    const server = aServerForTheTeam({
      lists: {
        [FIRST.id]: [{ id: 61, memberNumber: ASKED, date: '2026-05-09' }],
        [HIS.id]: [],
      },
    })

    try {
      renderAt(ASKED_AT, 'competitor', LEADS_IT, undefined, DAY_IN)

      expect(await screen.findByRole('button', { name: sr.teams.invite })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says so when the list cannot be read, offers no button over it, and asks again', async () => {
    let fails = true
    const server = aServerForTheTeam({
      reading: () => (fails ? answeredWith(500) : json([])),
    })
    const user = setupUser()

    try {
      renderAt(ASKED_AT, 'competitor', LEADS_IT, undefined, DAY_IN)

      expect(await screen.findByText(sr.data.error)).toBeVisible()
      expect(theButton()).toBeNull()

      fails = false
      await user.click(screen.getByRole('button', { name: sr.data.retry }))

      expect(await screen.findByRole('button', { name: sr.teams.invite })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('is read afresh for the next member visited, and nothing of the last is carried', async () => {
    const server = aServerForTheTeam({
      lists: { [HIS.id]: [{ id: 61, memberNumber: ASKED, date: '2026-05-09' }] },
    })

    try {
      const { router } = renderAt(ASKED_AT, 'competitor', LEADS_IT, undefined, DAY_IN)

      await screen.findByText(itStands)

      await act(async () => {
        await router.navigate(NEXT_AT)
      })

      expect(await screen.findByRole('button', { name: sr.teams.invite })).toBeVisible()
      expect(screen.queryByText(itStands)).toBeNull()
      /* Asked again for him, and not answered out of what was read for the last one: the team's
         list moves between two profiles as surely as between two days. */
      expect(readsOfLists(server.asked)).toHaveLength(2)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('does not carry a refusal about one member to the next one visited', async () => {
    const server = aServerForTheTeam({ post: () => refused('theWindowIsShut', 409) })
    const user = setupUser()

    try {
      const { router } = renderAt(ASKED_AT, 'competitor', LEADS_IT, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.invite }))
      await screen.findByRole('alert')

      await act(async () => {
        await router.navigate(NEXT_AT)
      })

      expect(await screen.findByRole('button', { name: sr.teams.invite })).toBeVisible()
      expect(screen.queryByRole('alert')).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)
})

describe('the press', () => {
  it('sends one invitation to his own team naming the member on the page, writes nothing into the browser, and says it stands', async () => {
    const server = aServerForTheTeam()
    const user = setupUser()

    try {
      renderAt(ASKED_AT, 'competitor', LEADS_IT, undefined, DAY_IN, <HeldInTheBrowser />)

      await user.click(await screen.findByRole('button', { name: sr.teams.invite }))

      const said = await screen.findByText(itStands)

      expect(writes(server.asked)).toEqual([
        {
          path: `/api/teams/${String(HIS.id)}/invitations`,
          how: 'POST',
          body: `{"memberNumber":"${ASKED}"}`,
        },
      ])
      /* The sentence took the place of the button and the keyboard with it. */
      await waitFor(() => {
        expect(said).toHaveFocus()
      })
      /* And the browser holds neither an invitation nor a message: both are the route's to write. */
      expect(heldInTheBrowser()).toEqual([])
      await user.click(screen.getByRole('button', { name: 'read as the member asked' }))
      expect(heldInTheBrowser()).toEqual([])
    } finally {
      server.stop()
    }
  }, SLOW)

  it('draws what the server answered and not what was pressed', async () => {
    const server = aServerForTheTeam({ keeps: false })
    const user = setupUser()

    try {
      renderAt(ASKED_AT, 'competitor', LEADS_IT, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.invite }))

      await waitFor(() => {
        expect(readsOfLists(server.asked)).toHaveLength(2)
      })
      await waitFor(() => {
        expect(theButton()).not.toHaveAttribute('aria-disabled')
      })
      expect(screen.queryByText(itStands)).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it.each([
    ['heHasAlreadyBeenAsked', 409, itStands],
    ['theWindowIsShut', 409, sr.teams.inviteRefused.theWindowIsShut],
    ['heIsAlreadyInATeam', 409, sr.teams.inviteRefused.heIsAlreadyInATeam],
    ['theFormIsNotComplete', 400, sr.teams.inviteRefused.theFormIsNotComplete],
  ])('says %s in its own words under the button, which stays', async (reason, status, words) => {
    const server = aServerForTheTeam({ post: () => refused(reason, status) })
    const user = setupUser()

    try {
      renderAt(ASKED_AT, 'competitor', LEADS_IT, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.invite }))

      expect(await screen.findByRole('alert')).toHaveTextContent(words)
      expect(theButton()).toBeVisible()
      /* A refusal is a thing that did not happen, so the list is not asked for again. */
      expect(readsOfLists(server.asked)).toHaveLength(1)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says a bare number out loud, because the route refuses everybody else with an empty 404', async () => {
    const server = aServerForTheTeam({ post: () => answeredWith(404) })
    const user = setupUser()

    try {
      renderAt(ASKED_AT, 'competitor', LEADS_IT, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.invite }))

      expect(await screen.findByRole('alert')).toHaveTextContent('404')
    } finally {
      server.stop()
    }
  }, SLOW)

  it('sends one invitation for two presses inside one task, and tells the button off while it is out', async () => {
    let answer: (value: Response) => void = () => {}
    const held = new Promise<Response>((resolve) => {
      answer = resolve
    })
    const server = aServerForTheTeam()
    const answering = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await answering(input, init)

      return init?.method === 'POST' ? held.then(() => response) : response
    }

    try {
      renderAt(ASKED_AT, 'competitor', LEADS_IT, undefined, DAY_IN)

      const button = await screen.findByRole('button', { name: sr.teams.invite })

      act(() => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-disabled', 'true')
      })

      answer(json({}, 201))

      await screen.findByText(itStands)

      expect(writes(server.asked)).toHaveLength(1)
    } finally {
      globalThis.fetch = answering
      server.stop()
    }
  }, SLOW)

  it('does not take the keyboard from a reader who moved on while the press was out', async () => {
    let answer: (value: Response) => void = () => {}
    const held = new Promise<Response>((resolve) => {
      answer = resolve
    })
    const server = aServerForTheTeam()
    const answering = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await answering(input, init)

      return init?.method === 'POST' ? held.then(() => response) : response
    }

    const user = setupUser()

    try {
      renderAt(ASKED_AT, 'competitor', LEADS_IT, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.invite }))

      const elsewhere = screen.getByRole('link', { name: sr.shell.skipToContent })

      elsewhere.focus()
      answer(json({}, 201))

      await screen.findByText(itStands)
      await settled()

      expect(elsewhere).toHaveFocus()
    } finally {
      globalThis.fetch = answering
      server.stop()
    }
  }, SLOW)
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
