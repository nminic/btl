import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { arrivedResource } from '../data/client'
import sr from '../i18n/sr.json'
import { useSession } from '../session/useSession'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { Asked } from '../test/saved'
import { answeredWith, did, refused, serverThat, type Asked as Request } from '../test/serverAnswers'
import { theCookieNames, whoTheCookieCurrentlyNames } from '../test/setup'
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

/** A second member with no team, who signs in after the first on the same page. Not the first
 *  member with no team on file, and not the one who asks everywhere else in this file. */
const NEXT_ASKER = '000012'

/* A day inside the transfer window and a day outside it. Neither is a day any application below
   was sent on, so a screen drawing today where it means the day of the asking draws neither. */
const DAY_IN = '2026-10-16'

const DAY_OUT = '2026-06-15'

type Application = { id: number; teamId: number; date: string }

/** His application to another team, sent first, and his application to this one, sent second. */
const TO_ANOTHER: Application = { id: 71, teamId: ANOTHER.id, date: '2026-05-02' }

const TO_THIS: Application = { id: 74, teamId: THIS.id, date: '2026-05-04' }

/**
 * WHAT THE MEMBER WHO SIGNS IN AFTER THE FIRST HAS APPLIED TO: rows of his own, because an
 * application is one member's and so no id of the first reader's can stand on this list, and the one
 * to this page's team second, as on the first reader's.
 */
const NEXT_ONES: Application[] = [
  { id: 77, teamId: ANOTHER.id, date: '2026-05-03' },
  { id: 78, teamId: THIS.id, date: '2026-05-05' },
]

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
  /**
   * What each reader waits on, by his number, for a case in which somebody else signs in after the
   * first. Given, it is what the list is answered from instead of `rows`: the route answers the one
   * who is signed in and nobody else (`MyApplicationsApi` reads the session and nothing the caller
   * sends), and in this harness the one who is signed in is whoever the cookie names.
   */
  lists?: Record<string, Application[]>
  alreadyInATeam?: boolean
  /** The season he owes before he can enter a team, as `GET /api/me/applications` answers it. */
  seasonToPayFor?: number | null
  /**
   * The season he comes to owe at the moment the application is answered, whatever the answer: a
   * fee cancelled between the drawing and the press, which is what a refusal of `theSeasonIsNotPaid`
   * is the route saying. The same arrangement as `meanwhile`.
   */
  becomesOwing?: number
  post?: () => Response
  remove?: () => Response
  keeps?: boolean
  /**
   * Rows that reach his list at the moment the application is answered, whatever the answer: an
   * application sent in the meantime from another tab, which is what a refusal of
   * `aQuestionAlreadyStands` is the route saying. The same arrangement `pairInviteOnTheServer.test.tsx`
   * gives its `meanwhile`.
   */
  meanwhile?: Application[]
  /**
   * Keys that leave his list at the moment the taking back is answered, whatever the answer: a team
   * that has decided about the application in the meantime, which is what the empty 404 of the
   * taking back is the route saying.
   */
  goneMeanwhile?: number[]
  reading?: HowItIsRead
}

function aServerForTheAsker({
  rows = [],
  lists,
  alreadyInATeam = false,
  seasonToPayFor = null,
  becomesOwing,
  post = (): Response => json({ id: NEW_KEY, teamId: THIS.id }, 201),
  remove = did,
  keeps = true,
  meanwhile = [],
  goneMeanwhile = [],
  reading = null,
}: TheAsker = {}) {
  let standing = [...rows]
  let owed = seasonToPayFor

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
        teamApplications:
          lists === undefined ? standing : (lists[whoTheCookieCurrentlyNames()?.memberNumber ?? ''] ?? []),
        teamInvitations: [],
        teamProposals: [],
        pairInvites: [],
        alreadyInATeam,
        seasonToPayFor: owed,
      })
    }

    const asking = /^\/api\/teams\/(\d+)\/applications$/.exec(path)

    if (how === 'POST' && asking !== null) {
      const answer = post()

      standing = [...standing, ...meanwhile]
      owed = becomesOwing ?? owed

      if (answer.status === 201 && keeps) {
        standing = [...standing, { id: NEW_KEY, teamId: Number(asking[1]), date: DAY_IN }]
      }

      return answer
    }

    const one = /^\/api\/teams\/(\d+)\/applications\/(\d+)$/.exec(path)

    if (how === 'DELETE' && one !== null) {
      const answer = remove()

      standing = standing.filter((row) => !goneMeanwhile.includes(row.id))

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

const heading = (name: string) => screen.findByRole('heading', { level: 1, name })

const applyButton = () => screen.queryByRole('button', { name: sr.teams.join })

const withdrawButton = () => screen.queryByRole('button', { name: sr.teams.joinWithdraw })

/** The applications the BROWSER holds, which since T5 must stay empty whatever is pressed. */
const heldInTheBrowser = () =>
  within(screen.getByRole('list', { name: 'open applications' })).queryAllByRole('listitem')

/**
 * WHICH OF THE TWO BUTTONS THE PAGE DRAWS to the one who is signed in: the way in, the way back,
 * both or neither. Both and neither are answers too, so a screen that is still reading, or draws
 * both, is not taken for either of the right ones.
 */
const whatIsDrawn = () => ({ wayIn: applyButton() !== null, wayBack: withdrawButton() !== null })

const THE_WAY_IN_ONLY = { wayIn: true, wayBack: false }

const THE_WAY_BACK_ONLY = { wayIn: false, wayBack: true }

const NEITHER = { wayIn: false, wayBack: false }

/**
 * The reader signs out, in place, the way the header's menu does (`app/AccountMenu.tsx`): the
 * portal forgets him at once and the page stays where it is, with nobody on it. The cookie goes
 * with him, so what the fake route answers next is answered to whoever signs in.
 */
function LeaveInPlace() {
  const { signOut } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        theCookieNames(null)
        signOut()
      }}
    >
      odjavi prvog člana
    </button>
  )
}

/** Somebody else signs in, in place, with the cookie and the session both naming him: what the
 *  route answers about what he waits on is his, and so is what the page draws. */
function Become({ who }: { who: string }) {
  const { signIn } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        theCookieNames({ role: 'competitor', memberNumber: who })
        signIn(who)
      }}
    >
      postani {who}
    </button>
  )
}

describe('„Prijavi se u tim", sent to the server', () => {
  it('asks THIS team, once, and then draws the way back that the server says stands', async () => {
    const server = aServerForTheAsker()
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN, <Asked />)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }))

      expect(await screen.findByRole('button', { name: sr.teams.joinWithdraw })).toBeVisible()
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

      await user.click(await screen.findByRole('button', { name: sr.teams.join }))

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

  /* **THE VERB FOLLOWS THE SEX OF THE READER, WHO SENT THE APPLICATION** (PDL P18, 18.10.2026, „I
     rečenice „Prihvatio/la si…” i „…poslao/la…” biraju reč po polu člana koji čita"). `ASKER` is a
     woman (Ivona) and the man is `000008`: a screen that kept one sentence for everybody fails one
     of the two, and neither is the other's word. */
  it.each([
    ['a woman', ASKER, sr.teams.applyRefused.aQuestionAlreadyStandsFemale, /je poslala\./],
    ['a man', '000008', sr.teams.applyRefused.aQuestionAlreadyStands, /je poslao\./],
  ])('says in the word of the sex of the reader that the application was sent: %s', async (_who, member, words, verb) => {
    const server = aServerForTheAsker({ post: () => refused('aQuestionAlreadyStands', 409) })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', member, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }))

      const said = await screen.findByRole('alert')

      expect(said).toHaveTextContent(words)
      expect(said).toHaveTextContent(verb)
      expect(said).not.toHaveTextContent('/la')
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says why under the row when the server refuses, and keeps the button where the list it reads again leaves it', async () => {
    /* The list does not move: the refusal is true of the server and the list is true of the
       server, so the button stays and the sentence is the only thing that changed. The case below
       is the one where the list does move. */
    const server = aServerForTheAsker({ post: () => refused('aQuestionAlreadyStands', 409) })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }))

      /* Ivona, so in her word; the man's is the case above. */
      expect(await screen.findByRole('alert')).toHaveTextContent(
        sr.teams.applyRefused.aQuestionAlreadyStandsFemale,
      )
      expect(applyButton()).toBeVisible()
      await waitFor(() => {
        expect(applyButton()).not.toHaveAttribute('aria-disabled')
      })
      /* Under the row of controls, not among them: the sentence is a child of the head itself, so
         `Rankings.css` gives it the whole width (`TeamDetail.tsx`). */
      expect(screen.getByRole('alert').parentElement).toHaveClass('rankings--tooled')
      /* Read again, and not once: the route said what the page was drawn from is stale, whatever
         the list then turns out to say (PENDING, PR 516, derived 10.10.2026). */
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('stops offering the press once the refusal has sent the list to be read again, and that application is on ANOTHER team\'s page', async () => {
    /* He asked ANOTHER team from a second tab after this page had read what he waits on. The route
       refuses a second application anywhere, and the page was drawn from a list that did not know:
       left alone it offers the press again and again, and the refusal is the same each time. The
       member's application is on the SECOND of the two teams in this fixture and not the first, and
       the page is the other one: a screen that took whatever application came first for this page's
       own would draw „Povuci prijavu" here. */
    const server = aServerForTheAsker({
      post: () => refused('aQuestionAlreadyStands', 409),
      meanwhile: [TO_ANOTHER],
    })
    const user = setupUser()

    try {
      const { router } = renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }))

      /* Said, and said where the list leaves nothing: the sentence names the team to take it back
         on, which is the one thing this page cannot draw. */
      expect(await screen.findByRole('alert')).toHaveTextContent(
        sr.teams.applyRefused.aQuestionAlreadyStandsFemale,
      )
      await waitFor(() => {
        expect(whatIsDrawn()).toEqual(NEITHER)
      })
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
      /* One write, and nothing sent again behind the reader's back. */
      expect(writes(server.asked)).toEqual([
        { path: `/api/teams/${String(THIS.id)}/applications`, how: 'POST' },
      ])

      /* And the team it stands on offers the way back, read off the list that was read again. */
      await act(async () => {
        await router.navigate(at(ANOTHER.slug))
      })

      expect(await screen.findByRole('button', { name: sr.teams.joinWithdraw })).toBeVisible()
      expect(screen.queryByRole('alert')).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says a bare number out loud, because the route refuses everything else with an empty 404, and reads again', async () => {
    const server = aServerForTheAsker({ post: () => answeredWith(404), meanwhile: [TO_ANOTHER] })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }))

      expect(await screen.findByRole('alert')).toHaveTextContent('404')
      /* The empty 404 is the route saying the question it was asked is not there, so it is the
         same kind of refusal as the named one: the list is read again, and an application on
         another team takes the press away. */
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
      await waitFor(() => {
        expect(whatIsDrawn()).toEqual(NEITHER)
      })
    } finally {
      server.stop()
    }
  }, SLOW)

  it.each([
    ['a server error', 500],
    ['a refused token', 403],
  ])('says %s at once, reads nothing again, and leaves the button live', async (_what, status) => {
    /* The server said nothing about any row, so there is nothing to read again and pressing again
       is what helps (`member/pairWrites.ts`, `theServerSaysTheScreenIsStale`). */
    const server = aServerForTheAsker({ post: () => answeredWith(status), meanwhile: [TO_ANOTHER] })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }))

      expect(await screen.findByRole('alert')).toBeVisible()
      await waitFor(() => {
        expect(applyButton()).not.toHaveAttribute('aria-disabled')
      })
      await settled()

      /* The application that reached the list in the meantime is NOT drawn: nothing asked for it. */
      expect(applyButton()).toBeVisible()
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(1)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says the refusal only once the list has been read again, and tells the button off until then', async () => {
    /* The read that follows the refusal is held, so what the page says WHILE it is out can be read.
       Said at once, the reader would hear „you already have an application" over a „Prijavi se u
       tim" that the read is about to take away. */
    let posted = false
    let release = (): void => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const server = aServerForTheAsker({
      post: () => {
        posted = true

        return refused('aQuestionAlreadyStands', 409)
      },
      meanwhile: [TO_ANOTHER],
    })
    const answering = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await answering(input, init)

      return posted && String(input) === '/api/me/applications' ? held.then(() => response) : response
    }

    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      const button = await screen.findByRole('button', { name: sr.teams.join })

      await user.click(button)
      await waitFor(() => {
        expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
      })
      await settled()

      expect(screen.queryByRole('alert')).toBeNull()
      expect(button).toHaveAttribute('aria-disabled', 'true')

      release()

      expect(await screen.findByRole('alert')).toHaveTextContent(
        sr.teams.applyRefused.aQuestionAlreadyStandsFemale,
      )
      expect(whatIsDrawn()).toEqual(NEITHER)
    } finally {
      globalThis.fetch = answering
      server.stop()
    }
  }, SLOW)

  it('does not put the refusal of one team on the page of another when the read lands after the reader has walked there', async () => {
    /* This half stays mounted across teams (`app/routeObjects.tsx` carries no `key` on that route),
       and a refusal held for the read to land is drawn when it lands. Walked to another team's
       page in between, it would be drawn there, past the reset that clears a refusal when the page
       changes. */
    let posted = false
    let release = (): void => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const server = aServerForTheAsker({
      post: () => {
        posted = true

        return refused('aQuestionAlreadyStands', 409)
      },
    })
    const answering = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await answering(input, init)

      return posted && String(input) === '/api/me/applications' ? held.then(() => response) : response
    }

    const user = setupUser()

    try {
      const { router } = renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }))
      await waitFor(() => {
        expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
      })

      await act(async () => {
        await router.navigate(at(ANOTHER.slug))
      })
      await heading(ANOTHER.name)

      release()
      await settled()
      await waitFor(() => {
        expect(applyButton()).not.toHaveAttribute('aria-disabled')
      })

      expect(screen.queryByRole('alert')).toBeNull()
    } finally {
      globalThis.fetch = answering
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

      const button = await screen.findByRole('button', { name: sr.teams.join })

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

      expect(await screen.findByRole('button', { name: sr.teams.joinWithdraw })).toBeVisible()
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
          seasonToPayFor: null,
        }

        return reads === 1 ? json(body) : second.then(() => json(body))
      },
    })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      const button = await screen.findByRole('button', { name: sr.teams.join })

      await user.click(button)

      await waitFor(() => {
        expect(reads).toBe(2)
      })

      /* The write has answered and the read has not: the old button stands, and it is told off. */
      expect(button).toHaveAttribute('aria-disabled', 'true')

      await user.click(button)

      expect(writes(server.asked)).toHaveLength(1)

      release()

      expect(await screen.findByRole('button', { name: sr.teams.joinWithdraw })).toBeVisible()
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
          ? json({ teamApplications: [], teamInvitations: [], teamProposals: [], pairInvites: [], alreadyInATeam: false, seasonToPayFor: null })
          : answeredWith(500)
      },
    })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }))

      expect(await screen.findByText(sr.data.error)).toBeVisible()
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

      await user.click(await screen.findByRole('button', { name: sr.teams.join }))

      const back = await screen.findByRole('button', { name: sr.teams.joinWithdraw })

      await waitFor(() => {
        expect(back).toHaveFocus()
      })

      /* And the other way round: taken back inside the window, „Prijavi se u tim" stands again and
         the keyboard is on it. */
      await user.click(back)

      const again = await screen.findByRole('button', { name: sr.teams.join })

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

      await user.click(await screen.findByRole('button', { name: sr.teams.join }))

      const season = screen.getByLabelText('Sezona')

      season.focus()
      answer(json({}, 201))

      await screen.findByRole('button', { name: sr.teams.joinWithdraw })

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

      await user.click(await screen.findByRole('button', { name: sr.teams.join }))
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

      expect(await screen.findByRole('button', { name: sr.teams.joinWithdraw })).toBeVisible()
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

      expect(await screen.findByRole('button', { name: sr.teams.join })).toBeVisible()
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

      expect(await screen.findByRole('button', { name: sr.teams.join })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('draws the owner\'s sentence where the button would stand when the server says he owes the season', async () => {
    /* PDL, 30.10.2026: „U tim za sezonu [sezona] ulaziš kad platiš članarinu za tu sezonu. Uplatu
       ćeš naći na strani Moja članarina." The number is the SERVER's (2029 here, not the year the
       fixture's clock stands in), so a screen that worked the season out itself says another. */
    const server = aServerForTheAsker({ seasonToPayFor: 2029 })

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await heading(THIS.name)
      await whatHeWaitsOnHasLanded()

      expect(applyButton()).toBeNull()
      expect(screen.getByText(sr.teams.joinWhenPaid.replace('{season}', '2029'))).toBeVisible()
      expect(screen.getByText(/Uplatu ćeš naći na strani Moja članarina\.$/)).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('draws that sentence under the row of controls and not among them', async () => {
    const server = aServerForTheAsker({ seasonToPayFor: 2028 })

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await heading(THIS.name)
      await whatHeWaitsOnHasLanded()

      expect(
        screen.getByText(sr.teams.joinWhenPaid.replace('{season}', '2028')).parentElement,
      ).toHaveClass('rankings--tooled')
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says nothing about a fee outside the transfer window, where nobody enters a team', async () => {
    const server = aServerForTheAsker({ seasonToPayFor: 2028 })

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_OUT)

      await heading(THIS.name)
      await whatHeWaitsOnHasLanded()

      expect(applyButton()).toBeNull()
      expect(screen.queryByText(/ulaziš kad platiš članarinu/)).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says nothing about a fee to a member who has an application standing elsewhere, and keeps the way back', async () => {
    /* The order is the route's: the application standing is asked before the fee, and the way back
       is not touched by it (PDL, 06.09.2026). */
    const server = aServerForTheAsker({ rows: [TO_ANOTHER], seasonToPayFor: 2028 })

    try {
      renderAt(at(ANOTHER.slug), 'competitor', ASKER, undefined, DAY_IN)

      expect(await screen.findByRole('button', { name: sr.teams.joinWithdraw })).toBeVisible()
      expect(screen.queryByText(/ulaziš kad platiš članarinu/)).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('does not say the refusal of a fee as a refusal: the sentence that stands in the button\'s place says it, once', async () => {
    /* He paid when the page was drawn, and the fee was cancelled before the press: the route
       refuses with `theSeasonIsNotPaid`, the list is read again and now says he owes 2028. The
       refusal is the same words as the sentence the page then draws, so drawn as well it would
       stand twice, and under an alert that tells the reader something went wrong with a button
       that is no longer there. */
    const server = aServerForTheAsker({
      post: () => refused('theSeasonIsNotPaid', 409),
      becomesOwing: 2028,
    })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }))

      expect(
        await screen.findByText(sr.teams.joinWhenPaid.replace('{season}', '2028')),
      ).toBeVisible()
      expect(screen.getAllByText(/ulaziš kad platiš članarinu/)).toHaveLength(1)
      expect(screen.queryByRole('alert')).toBeNull()
      expect(applyButton()).toBeNull()
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('draws the button again, and no sentence, when the fee was paid again before the list was read', async () => {
    /* The race the other way: the route refused for a fee that the list read again no longer owes.
       Nothing is left to say, and the button is back for a second press. */
    const server = aServerForTheAsker({ post: () => refused('theSeasonIsNotPaid', 409) })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.join }))
      await waitFor(() => {
        expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
      })
      await settled()

      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByText(/ulaziš kad platiš članarinu/)).toBeNull()
      expect(applyButton()).toBeVisible()
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
          : json({ teamApplications: [], teamInvitations: [], teamProposals: [], pairInvites: [], alreadyInATeam: false, seasonToPayFor: null }),
    })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      expect(await screen.findByText(sr.data.error)).toBeVisible()
      expect(applyButton()).toBeNull()

      fails = false
      await user.click(screen.getByRole('button', { name: sr.data.retry }))

      expect(await screen.findByRole('button', { name: sr.teams.join })).toBeVisible()
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

      await user.click(await screen.findByRole('button', { name: sr.teams.joinWithdraw }))

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

      await user.click(await screen.findByRole('button', { name: sr.teams.joinWithdraw }))

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

      expect(await screen.findByRole('button', { name: sr.teams.joinWithdraw })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says the number when the route refuses, since it names no reason, and reads again', async () => {
    /* The list still holds the row (the server says nothing moved), so the button stands. */
    const server = aServerForTheAsker({ rows: [TO_THIS], remove: () => answeredWith(404) })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.joinWithdraw }))

      expect(await screen.findByRole('alert')).toHaveTextContent('404')
      expect(withdrawButton()).toBeVisible()
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('takes the button away and offers the way in again when the 404 is a team that has decided in the meantime', async () => {
    /* The team answered the application while this page was open, and the row left the list. The
       taking back is refused 404 because the row is not there, and a page that left it alone would
       go on drawing „Povuci prijavu" over it, with „Prijavi se u tim" offered on no team at all
       until the page was loaded again (PENDING, PR 516). Two teams, and the member's is the SECOND
       of them, so a read of the wrong row cannot pass. */
    const server = aServerForTheAsker({
      rows: [TO_THIS],
      remove: () => answeredWith(404),
      goneMeanwhile: [TO_THIS.id],
    })
    const user = setupUser()

    try {
      const { router } = renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.joinWithdraw }))

      expect(await screen.findByRole('alert')).toHaveTextContent('404')
      await waitFor(() => {
        expect(whatIsDrawn()).toEqual(THE_WAY_IN_ONLY)
      })
      expect(applyButton()).not.toHaveAttribute('aria-disabled')
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
      /* One write: the taking back, and nothing sent on the reader's behalf after it. */
      expect(writes(server.asked)).toEqual([
        { path: `/api/teams/${String(THIS.id)}/applications/${String(TO_THIS.id)}`, how: 'DELETE' },
      ])

      /* And no other team offers less than this one does: the list is one list for the visit. */
      await act(async () => {
        await router.navigate(at(ANOTHER.slug))
      })
      await heading(ANOTHER.name)

      expect(await screen.findByRole('button', { name: sr.teams.join })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('reads nothing again when the taking back is refused with a number that says nothing about any row', async () => {
    const server = aServerForTheAsker({
      rows: [TO_THIS],
      remove: () => answeredWith(500),
      goneMeanwhile: [TO_THIS.id],
    })
    const user = setupUser()

    try {
      renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN)

      await user.click(await screen.findByRole('button', { name: sr.teams.joinWithdraw }))

      expect(await screen.findByRole('alert')).toHaveTextContent('500')
      await waitFor(() => {
        expect(withdrawButton()).not.toHaveAttribute('aria-disabled')
      })
      await settled()

      expect(withdrawButton()).toBeVisible()
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(1)
    } finally {
      server.stop()
    }
  }, SLOW)
})

describe('whose applications the page draws', () => {
  /* THE LIST IS THE READER'S AND THE PAGE IS NOT. The portal signs out and signs in without
     anything being reloaded (`app/AccountMenu.tsx` signs out in place; `pages/member/SignIn.tsx`
     signs in and navigates), and the page of a team is the same page for whoever is reading it:
     `here` in `AskingThisTeam.tsx` is the team and the season and nothing of the reader. The list
     is the member's (PDL, 06.09.2026: „traženo po broju člana kroz sve timove"). What it draws has
     to come from what the route says to the one who is signed in NOW, and two things can
     hand him the first reader's list instead: the number the half gives `useWhatIsWaiting`
     (`mine`) and the cache that is dropped when that number changes (`data/useResource.ts`,
     `theWaitingNowBelongsTo`). Measured 10.10.2026: `mine={here}` in place of
     `mine={me.memberNumber}` left every case that mounts a team's page green, because not one of
     them has a second reader.

     **SIGNED OUT FIRST, NOT SWITCHED.** A reader changes in one of two ways, and in neither is the
     half left standing for the next one: the header's menu signs out in place, which leaves the
     team's page with nobody on it and the half gone, and the sign in page signs in and navigates
     (`pages/member/SignIn.tsx`), so the team's page is off the screen by then. What has to hold is
     what the second reader MOUNTS onto. A switch from one number to the next with the half left
     standing is a road nothing on the portal takes. It is also one this half does not survive
     cleanly: `ForAMember` has no key of the reader's and `useResource` keeps the state it has
     while its owner changes, so it would go on drawing the first reader's buttons until the second
     one's list landed (measured 10.10.2026, with that list held). A case asking for „nothing of
     the first's" there would be asking for what the half does not do.

     **The two lists differ in the one row that matters, and in both directions.** An application
     the first reader sent to this team is not drawn to the next, who is no party to it (a „Povuci
     prijavu" over a row that is not his); and one that stands with the next reader takes the
     button's place instead of „Prijavi se u tim" being offered over it, which the route would
     refuse. Neither can be had without the list being read AGAIN, once for each reader, which is
     the second thing every row holds. */
  it.each([
    [
      'the first had applied to this team and the next has not',
      [TO_ANOTHER, TO_THIS],
      [],
      THE_WAY_BACK_ONLY,
      THE_WAY_IN_ONLY,
    ],
    [
      'the first had not and the next has applied to this team',
      [],
      NEXT_ONES,
      THE_WAY_IN_ONLY,
      THE_WAY_BACK_ONLY,
    ],
  ])(
    'draws what the route says to the reader who signs in after the first on the same page, and nothing of the first’s, when %s',
    async (_, first, next, firstSees, nextSees) => {
      /* HIS LIST IS HELD while the page is looked at. Asked right after the click and answered at
         once, a half that drew the first reader's list for the first paint and his own a moment
         later would pass: by the time a click is handed back, an answer that came at once has
         landed (measured 10.10.2026: dropping the cache in an effect, after the render that reads
         it, kept a form of this case that did not hold his list green). „Nothing of the first's"
         is exactly the paint that comes before his own list can, so it is looked at while it is
         out. */
      let answerHim: () => void = () => {}
      const held = new Promise<void>((resolve) => {
        answerHim = resolve
      })
      const server = aServerForTheAsker({ lists: { [ASKER]: first, [NEXT_ASKER]: next } })
      const answering = globalThis.fetch

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await answering(input, init)
        const heIsAsking =
          String(input) === '/api/me/applications' &&
          whoTheCookieCurrentlyNames()?.memberNumber === NEXT_ASKER

        return heIsAsking ? held.then(() => response) : response
      }

      const user = setupUser()

      try {
        renderAt(at(THIS.slug), 'competitor', ASKER, undefined, DAY_IN, (
          <>
            <LeaveInPlace />
            <Become who={NEXT_ASKER} />
          </>
        ))

        /* The first reader is told what his own list says, from the one read that went out for him. */
        await waitFor(() => {
          expect(whatIsDrawn()).toEqual(firstSees)
        })
        expect(readsOfWhatHeWaitsOn(server.asked)).toBe(1)

        await user.click(screen.getByRole('button', { name: 'odjavi prvog člana' }))

        /* Nobody is signed in: the page stays, and nothing of this half is drawn to nobody. */
        expect(whatIsDrawn()).toEqual(NEITHER)

        await user.click(screen.getByRole('button', { name: `postani ${NEXT_ASKER}` }))

        /* While his own list is out nothing of this half is drawn, and so nothing of the first
           reader's: the page asks for his list and draws no list at all until it has come. That it
           WAS asked for is the second read, which is also what tells a list read for him from the
           first reader's list served to him. */
        expect(whatIsDrawn()).toEqual(NEITHER)
        expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)

        answerHim()

        /* And then his own: the right one of the two, and nothing asked again. */
        await waitFor(() => {
          expect(whatIsDrawn()).toEqual(nextSees)
        })
        expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
      } finally {
        globalThis.fetch = answering
        server.stop()
      }
    },
    SLOW,
  )
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
