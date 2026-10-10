import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { arrivedResource } from '../data/client'
import sr from '../i18n/sr.json'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { Asked } from '../test/saved'
import { answeredWith, did, refused, serverThat, type Asked as Request } from '../test/serverAnswers'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'

/**
 * A MEMBER ASKING A TEAM TO TAKE HIM, AND TAKING IT BACK, BOTH AGAINST THE SERVER (T5, 10.10.2026).
 *
 * <p>Owner, PDL P13: „Učlanjenje ide u oba smera kroz portal: takmičar šalje administratoru tima
 * zahtev na odobrenje, ili administrator šalje takmičaru poziv." Until T5 „Prijavi se u tim" and
 * „Povuci prijavu" wrote into `session/SessionProvider.tsx`, and every case about them was
 * satisfied by the browser's own copy. These read the socket.
 *
 * <p><b>NOTHING IS FIRST ON ANY LIST HERE</b>, the shape of `teamQueueOnTheServer.test.tsx`: the
 * page is `nisavski-maraton-klub`, the SECOND team on file; the member who asks is `000006`, not
 * the first member with no team; and where he has two applications, the one this page is about
 * is the second of them. A fixture with one of anything is satisfied by a screen that reached for
 * whatever came first.
 */

const TEAMS_ON_FILE: { id: number; slug: string; name: string }[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/teams.json'), 'utf-8'),
)

type FileMember = { memberNumber: string; teamId: number | null; active: boolean }

const MEMBERS_ON_FILE: FileMember[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'),
)

const teamAt = (slug: string) =>
  must(
    TEAMS_ON_FILE.find((one) => one.slug === slug),
    `${slug} in the generated teams`,
  )

/** The page every case is read on, and it is the second team on file. `000005` leads it. */
const THIS = teamAt('nisavski-maraton-klub')

/** Another team, for an application that is not this page's. */
const ANOTHER = teamAt('vardarski-krug')

/** A team nobody is in, so nobody could answer for it. */
const NOBODY_LEADS = teamAt('novoosnovani-tim')

/** A member with no team who is not the first member with no team on file. */
const ASKER = '000006'

/** A member of another team, for the way back out that does not depend on having no team. */
const ELSEWHERE = '000013'

/** A member the file carries with a fee that has lapsed, whom `/api/competitors` does not. */
const LAPSED = '000032'

/* A day inside the transfer window and a day outside it. Neither is a day any application below
   was sent on, so a screen drawing today where it means the day of the asking draws neither. */
const DAY_IN = '2026-10-16'

const DAY_OUT = '2026-06-15'

type Application = { id: number; teamId: number; date: string }

/** His application to another team, sent first, and his application to this one, sent second. */
const TO_ANOTHER: Application = { id: 71, teamId: ANOTHER.id, date: '2026-05-02' }

const TO_THIS: Application = { id: 74, teamId: THIS.id, date: '2026-05-04' }

/** The key `POST` answers a new application with, which no fixture above carries. */
const NEW_KEY = 90

const json = (what: unknown, status = 200): Response =>
  new Response(JSON.stringify(what), { status, headers: { 'content-type': 'application/json' } })

type HowItIsRead = null | (() => Response | Promise<Response>)

/**
 * A SERVER THAT KEEPS WHAT ONE MEMBER WAITS ON, AND CHANGES IT THE WAY THE TWO ROUTES DO.
 *
 * <p>`POST /api/teams/{id}/applications` that answered 201 puts a row on the list, on the team the
 * ADDRESS names, and `DELETE /api/teams/{id}/applications/{application}` that answered 204 takes the
 * row the address names off it. A refusal changes nothing. So what the screen draws afterwards is
 * what the list says, and a case can tell a screen that drew the press from one that drew the
 * answer by having the write agree and the list not change (`keeps: false`).
 *
 * <p>`/api/competitors` is answered as the server answers it, with nobody whose fee has lapsed:
 * the generated file still carries `000032` with `active: false`.
 */
type TheAsker = {
  rows?: Application[]
  alreadyInATeam?: boolean
  post?: () => Response
  remove?: () => Response
  keeps?: boolean
  reading?: HowItIsRead
}

function aServerForTheAsker({
  rows = [],
  alreadyInATeam = false,
  post = (): Response => json({ id: NEW_KEY, teamId: THIS.id }, 201),
  remove = did,
  keeps = true,
  reading = null,
}: TheAsker = {}) {
  let standing = [...rows]

  return serverThat((path, init) => {
    const how = init?.method ?? 'GET'

    if (how === 'GET' && path === '/api/competitors') {
      return json(MEMBERS_ON_FILE.filter((one) => one.active))
    }

    if (how === 'GET' && path === '/api/me/applications') {
      if (reading !== null) {
        return reading()
      }

      return json({
        teamApplications: standing,
        teamInvitations: [],
        teamProposals: [],
        pairInvites: [],
        alreadyInATeam,
      })
    }

    const asking = /^\/api\/teams\/(\d+)\/applications$/.exec(path)

    if (how === 'POST' && asking !== null) {
      const answer = post()

      if (answer.status === 201 && keeps) {
        standing = [...standing, { id: NEW_KEY, teamId: Number(asking[1]), date: DAY_IN }]
      }

      return answer
    }

    const one = /^\/api\/teams\/(\d+)\/applications\/(\d+)$/.exec(path)

    if (how === 'DELETE' && one !== null) {
      const answer = remove()

      if (answer.status === 204) {
        standing = standing.filter((row) => row.id !== Number(one[2]))
      }

      return answer
    }

    return how === 'GET' ? null : did()
  })
}

/** Every write of every verb, so naming the one expected cannot pass a screen that sent more. */
function writes(asked: Request[]): { path: string; how: string }[] {
  return asked
    .filter((one) => (one.init?.method ?? 'GET') !== 'GET')
    .map((one) => ({ path: one.path, how: String(one.init?.method) }))
}

const readsOfWhatHeWaitsOn = (asked: Request[]) =>
  asked.filter((one) => (one.init?.method ?? 'GET') === 'GET' && one.path === '/api/me/applications')
    .length

const at = (slug: string) => `/sr/tim/${slug}`

/** Lets everything already on its way land and be drawn: a read, its answer, and the render. */
async function settled(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/**
 * WHAT HE WAITS ON HAS ARRIVED AND BEEN DRAWN, which a case asserting that NOTHING is offered has
 * to wait for: the half draws nothing while it reads, so an absence read before the answer lands is
 * true of every screen, the wrong one included.
 */
async function whatHeWaitsOnHasLanded(): Promise<void> {
  await waitFor(() => {
    expect(arrivedResource('me/applications')).toBeDefined()
  })
  await settled()
}

const heading = (name: string) => screen.findByRole('heading', { level: 1, name }, { timeout: SLOW })

const applyButton = () => screen.queryByRole('button', { name: sr.teams.join })

const withdrawButton = () => screen.queryByRole('button', { name: sr.teams.joinWithdraw })

/** The applications the BROWSER holds, which since T5 must stay empty whatever is pressed. */
const heldInTheBrowser = () =>
  within(screen.getByRole('list', { name: 'open applications' })).queryAllByRole('listitem')

describe('„Prijavi se u tim", sent to the server', () => {
  it('asks THIS team, once, and then draws the way back that the server says stands', async () => {
    const server = aServerForTheAsker()
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN, <Asked />)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }, { timeout: SLOW }))

      expect(await screen.findByRole('button', { name: sr.teams.joinWithdraw }, { timeout: SLOW })).toBeVisible()
      expect(applyButton()).toBeNull()

      /* ONE WRITE OF ONE VERB TO THE ADDRESS OF THIS PAGE'S TEAM, which is the second on file, so a
         screen that took the first team asked the wrong one. */
      expect(writes(server.asked)).toEqual([
        { path: `/api/teams/${String(THIS.id)}/applications`, how: 'POST' },
      ])

      /* AND NOTHING IN THE BROWSER, which is the whole of the defect this replaced: the session held
         the application and the team never saw it. */
      expect(heldInTheBrowser()).toEqual([])
    } finally {
      server.stop()
    }
  }, SLOW)

  it('draws what the server answered and not what was pressed', async () => {
    /* The write agrees and the list does not move. A screen that drew the press would now offer
       „Povuci prijavu" over an application the server does not hold. */
    const server = aServerForTheAsker({ keeps: false })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }, { timeout: SLOW }))

      await waitFor(() => {
        expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
      })
      await waitFor(() => {
        expect(applyButton()).not.toHaveAttribute('aria-disabled')
      })
      expect(withdrawButton()).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('keeps the button as it was when the server refuses, says why under the row, and asks nothing again', async () => {
    const server = aServerForTheAsker({ post: () => refused('aQuestionAlreadyStands', 409) })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }, { timeout: SLOW }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        sr.teams.applyRefused.aQuestionAlreadyStands,
      )
      expect(applyButton()).toBeVisible()
      expect(applyButton()).not.toHaveAttribute('aria-disabled')
      /* Under the row of controls, not among them: the sentence is a child of the head itself, so
         `Rankings.css` gives it the whole width (`TeamDetail.tsx`). */
      expect(screen.getByRole('alert').parentElement).toHaveClass('rankings--tooled')
      /* Read once, when the page opened, and not again: a refusal is a thing that did not happen. */
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(1)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says a bare number out loud, because the route refuses everything else with an empty 404', async () => {
    const server = aServerForTheAsker({ post: () => answeredWith(404) })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }, { timeout: SLOW }))

      expect(await screen.findByRole('alert')).toHaveTextContent('404')
    } finally {
      server.stop()
    }
  }, SLOW)

  it('sends one application for two presses inside one task, and tells the button off while it is out', async () => {
    let answer: (value: Response) => void = () => {}
    const held = new Promise<Response>((resolve) => {
      answer = resolve
    })
    const server = aServerForTheAsker({ post: () => json({ id: NEW_KEY, teamId: THIS.id }, 201) })
    const answering = globalThis.fetch

    /* THE WRITE IS HELD, so the button can be read while it is out. */
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await answering(input, init)

      return init?.method === 'POST' ? held.then(() => response) : response
    }

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      const button = await screen.findByRole('button', { name: sr.teams.join }, { timeout: SLOW })

      /* NOT `user.click` TWICE: Testing Library lets React render between two clicks, so a guard
         held in the state alone would pass. Two dispatches inside one `act` tell a ref from a state
         (`member/teamInviteAnswered.test.tsx`). */
      act(() => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-disabled', 'true')
      })

      answer(json({}, 201))

      expect(await screen.findByRole('button', { name: sr.teams.joinWithdraw }, { timeout: SLOW })).toBeVisible()
      expect(writes(server.asked)).toEqual([
        { path: `/api/teams/${String(THIS.id)}/applications`, how: 'POST' },
      ])
    } finally {
      globalThis.fetch = answering
      server.stop()
    }
  }, SLOW)

  it('keeps the button told off until the list that replaces it has arrived', async () => {
    /* THE READ AFTER THE PRESS IS HELD. Released when the write answered, the button would be live
       for a render over an application already sent, and a second press would be answered
       `aQuestionAlreadyStands` (`useTeamQueue.ts`, „the row is live again and already answered"). */
    let reads = 0
    let release: () => void = () => {}
    const second = new Promise<void>((resolve) => {
      release = resolve
    })
    let rows: Application[] = []
    const server = aServerForTheAsker({
      post: () => {
        rows = [{ id: NEW_KEY, teamId: THIS.id, date: DAY_IN }]

        return json({ id: NEW_KEY, teamId: THIS.id }, 201)
      },
      reading: () => {
        reads += 1

        const body = {
          teamApplications: rows,
          teamInvitations: [],
          teamProposals: [],
          pairInvites: [],
          alreadyInATeam: false,
        }

        return reads === 1 ? json(body) : second.then(() => json(body))
      },
    })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      const button = await screen.findByRole('button', { name: sr.teams.join }, { timeout: SLOW })

      await user.click(button)

      await waitFor(() => {
        expect(reads).toBe(2)
      })

      /* The write has answered and the read has not: the old button stands, and it is told off. */
      expect(button).toHaveAttribute('aria-disabled', 'true')

      await user.click(button)

      expect(writes(server.asked)).toHaveLength(1)

      release()

      expect(await screen.findByRole('button', { name: sr.teams.joinWithdraw }, { timeout: SLOW })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('lets go and says so when the list read after the press cannot be read', async () => {
    let reads = 0
    const server = aServerForTheAsker({
      reading: () => {
        reads += 1

        return reads === 1
          ? json({ teamApplications: [], teamInvitations: [], teamProposals: [], pairInvites: [], alreadyInATeam: false })
          : answeredWith(500)
      },
    })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }, { timeout: SLOW }))

      expect(await screen.findByText(sr.data.error, {}, { timeout: SLOW })).toBeVisible()
      expect(screen.getByRole('button', { name: sr.data.retry })).toBeVisible()
      /* Neither button: with nothing known about what he waits on, one would be a second
         application and the other has no key to send. */
      expect(applyButton()).toBeNull()
      expect(withdrawButton()).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('moves the keyboard to the button that replaced the one pressed', async () => {
    const server = aServerForTheAsker()
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }, { timeout: SLOW }))

      const back = await screen.findByRole('button', { name: sr.teams.joinWithdraw }, { timeout: SLOW })

      await waitFor(() => {
        expect(back).toHaveFocus()
      })

      /* And the other way round: taken back inside the window, „Prijavi se u tim" stands again and
         the keyboard is on it. */
      await user.click(back)

      const again = await screen.findByRole('button', { name: sr.teams.join }, { timeout: SLOW })

      await waitFor(() => {
        expect(again).toHaveFocus()
      })
    } finally {
      server.stop()
    }
  }, SLOW)

  it('does not take the keyboard from a reader who moved on while the press was out', async () => {
    let answer: (value: Response) => void = () => {}
    const held = new Promise<Response>((resolve) => {
      answer = resolve
    })
    const server = aServerForTheAsker({ post: () => json({ id: NEW_KEY, teamId: THIS.id }, 201) })
    const answering = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await answering(input, init)

      return init?.method === 'POST' ? held.then(() => response) : response
    }

    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }, { timeout: SLOW }))

      const season = screen.getByLabelText('Sezona')

      season.focus()
      answer(json({}, 201))

      await screen.findByRole('button', { name: sr.teams.joinWithdraw }, { timeout: SLOW })

      expect(season).toHaveFocus()
    } finally {
      globalThis.fetch = answering
      server.stop()
    }
  }, SLOW)

  it('is not carried to the page of another team once refused', async () => {
    const server = aServerForTheAsker({ post: () => refused('aQuestionAlreadyStands', 409) })
    const user = setupUser()

    try {
      const { router } = renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }, { timeout: SLOW }))
      await screen.findByRole('alert')

      await act(async () => {
        await router.navigate(at(ANOTHER.slug))
      })

      await heading(ANOTHER.name)

      expect(screen.queryByRole('alert')).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)
})

describe('who is offered „Prijavi se u tim"', () => {
  it('is not offered while an application stands on another team, and that team offers the way back', async () => {
    const server = aServerForTheAsker({ rows: [TO_ANOTHER] })

    try {
      const { router } = renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await heading(THIS.name)
      await whatHeWaitsOnHasLanded()

      expect(applyButton()).toBeNull()
      expect(withdrawButton()).toBeNull()

      await act(async () => {
        await router.navigate(at(ANOTHER.slug))
      })

      expect(await screen.findByRole('button', { name: sr.teams.joinWithdraw }, { timeout: SLOW })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('counts no application to a team the list no longer has', async () => {
    /* A team deleted while the application waited took the row with it on the server
       (`team_application_team_fk`, on delete cascade); a list read earlier in the visit can still
       carry it, and an application about a team that is gone is about nothing (review, 06.09.2026). */
    const server = aServerForTheAsker({ rows: [{ id: 55, teamId: 999, date: '2026-05-01' }] })

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      expect(await screen.findByRole('button', { name: sr.teams.join }, { timeout: SLOW })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('is not offered outside the transfer window', async () => {
    const server = aServerForTheAsker()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_OUT)

      await heading(THIS.name)
      await whatHeWaitsOnHasLanded()

      expect(applyButton()).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('is not offered to a member whose record names a team, whatever the server says stands in his way', async () => {
    /* „Nema tim" se čita sa zapisa (`teamId`), ne po sezoni (PDL, 05.09.2026): the record names
       Dunavski trkači, and the answer about what he waits on says nothing stands in his way. */
    const server = aServerForTheAsker({ alreadyInATeam: false })

    try {
      renderAt(at(THIS.slug), 'competitor', ELSEWHERE, undefined, DAY_IN)

      await heading(THIS.name)
      await whatHeWaitsOnHasLanded()

      expect(applyButton()).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('is offered to a member whose record names no team, though the server says something stands in his way', async () => {
    /* The other direction of the same axis. The route decides the press, and the record decides
       the button, which is the decision quoted above. */
    const server = aServerForTheAsker({ alreadyInATeam: true })

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      expect(await screen.findByRole('button', { name: sr.teams.join }, { timeout: SLOW })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('is not offered on a team nobody is in, because there is nobody to answer', async () => {
    const server = aServerForTheAsker()

    try {
      renderAt(at(NOBODY_LEADS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await heading(NOBODY_LEADS.name)
      await whatHeWaitsOnHasLanded()

      expect(applyButton()).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it.each([
    ['a visitor', 'visitor' as const, null],
    ['a member whose fee has lapsed', 'competitor' as const, LAPSED],
  ])('draws nothing and asks nothing for %s', async (_who, role, number) => {
    const server = aServerForTheAsker({ rows: [TO_THIS] })

    try {
      renderAt(at(THIS.slug), role, number, undefined, DAY_IN)

      await heading(THIS.name)
      await settled()

      expect(applyButton()).toBeNull()
      expect(withdrawButton()).toBeNull()
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(0)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says so when what he waits on cannot be read, and asks again', async () => {
    let fails = true
    const server = aServerForTheAsker({
      reading: () =>
        fails
          ? answeredWith(500)
          : json({ teamApplications: [], teamInvitations: [], teamProposals: [], pairInvites: [], alreadyInATeam: false }),
    })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      expect(await screen.findByText(sr.data.error, {}, { timeout: SLOW })).toBeVisible()
      expect(applyButton()).toBeNull()

      fails = false
      await user.click(screen.getByRole('button', { name: sr.data.retry }))

      expect(await screen.findByRole('button', { name: sr.teams.join }, { timeout: SLOW })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)
})

describe('„Povuci prijavu", sent to the server', () => {
  it('takes back his application to THIS team, and not the first he has', async () => {
    const server = aServerForTheAsker({ rows: [TO_ANOTHER, TO_THIS] })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.joinWithdraw }, { timeout: SLOW }))

      await waitFor(() => {
        expect(withdrawButton()).toBeNull()
      })

      expect(writes(server.asked)).toEqual([
        { path: `/api/teams/${String(THIS.id)}/applications/${String(TO_THIS.id)}`, how: 'DELETE' },
      ])
      /* And the one on the other team still stands, so no way in is offered here either. */
      expect(applyButton()).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('is offered after the window has shut, and leaves nothing to press once it has gone', async () => {
    const server = aServerForTheAsker({ rows: [TO_THIS] })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_OUT)

      await user.click(await screen.findByRole('button', { name: sr.teams.joinWithdraw }, { timeout: SLOW }))

      await waitFor(() => {
        expect(withdrawButton()).toBeNull()
      })

      /* Outside the window nothing stands where it stood, so the keyboard is where the page left it. */
      expect(applyButton()).toBeNull()
      expect(document.activeElement).toBe(document.body)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('is offered to a member who has since come by a team', async () => {
    const server = aServerForTheAsker({ rows: [TO_THIS] })

    try {
      renderAt(at(THIS.slug), 'competitor', ELSEWHERE, undefined, DAY_IN)

      expect(await screen.findByRole('button', { name: sr.teams.joinWithdraw }, { timeout: SLOW })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says the number when the route refuses, since it names no reason', async () => {
    const server = aServerForTheAsker({ rows: [TO_THIS], remove: () => answeredWith(404) })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.joinWithdraw }, { timeout: SLOW }))

      expect(await screen.findByRole('alert')).toHaveTextContent('404')
      expect(withdrawButton()).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)
})
