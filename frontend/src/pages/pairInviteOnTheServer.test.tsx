import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import sr from '../i18n/sr.json'
import { arrivedResource } from '../data/client'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { answeredWith, did, refused, serverThat, type Asked } from '../test/serverAnswers'
import { theCookieNames, whoTheCookieCurrentlyNames } from '../test/setup'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'
import { useToday } from '../clock/useClock'
import { useSession } from '../session/useSession'

/**
 * „POZOVI U TRKAČKI PAR" AND THE QUESTIONS STILL STANDING, AGAINST THE SERVER (P2, 10.10.2026).
 *
 * <p>QA review of 09.10.2026, row 5: the press wrote the question and its message into the browser
 * of the one asking, so the member asked never saw it and the pair could not be made. Since P2 the
 * press sends `POST /api/pairs`, whether a question stands between the two is read off
 * `GET /api/me/applications`, and so are the questions the reader's own page carries, „i poslate i
 * primljene" (PDL, 07.09.2026). The answer in the inbox and „Raskini" were on the server before this
 * file (`member/pairInviteAnswered.test.tsx`, `pages/pairBrokenOnTheServer.test.tsx`).
 *
 * <p><b>NOTHING IS FIRST ON ANY LIST HERE.</b> The reader has asked one member and been asked by
 * another before the member on the page comes into it, so a question standing with HER is never
 * the first row; the list carries a row with no number, which is somebody whose fee has lapsed;
 * and on the reader's own page a question named by a number the list of members does not carry
 * stands beside the others. The reader, the member on the page and the members of his questions are
 * five different people, and none of their numbers is a key of anything else in the fixture.
 */

/* EVERY WAIT OF THIS FILE IS GIVEN HALF OF THE TIME A CASE HAS, the arrangement
   `pages/admin/saveWhileSaving.test.tsx` holds and for its reason: a wait that never succeeds must
   end in the assertion's own words and never in `Test timed out`, which a series of mutations
   cannot tell from a fault of the machine (`btl/CLAUDE.md`, odeljak 25). The case at the foot of
   the file holds it. */
configure({ asyncUtilTimeout: SLOW / 2 })

type FileMember = { memberNumber: string; active: boolean }

const MEMBERS_ON_FILE: FileMember[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'),
)

/** The reader: a man with no pair, 000002 Relja Momčilović. */
const READER = '000002'

const HIS_OWN = '/sr/takmicar/000002-relja-momcilovic'

/** The member on the page: a woman with no pair, 000015 Katarina Novaković. */
const HER = '000015'

const HER_PAGE = '/sr/takmicar/000015-katarina-novakovic'

/** Another woman with no question standing between her and the reader, for the next profile. */
const NEXT_PAGE = '/sr/takmicar/000006-ivona-stamenkovska'

/** A man, so the button is never offered on his page, and nothing is asked for it. */
const SAME_SEX_PAGE = '/sr/takmicar/000004-caslav-radenkovic'

/** A second man, for the reader who signs in after the first on the same page. */
const ANOTHER_READER = '000004'

/** A day the season being formed is 2027 and the season being run is none yet. */
const DAY = '2026-10-16'

type Row = { id: number; memberNumber: string | null; sentByMe: boolean; date: string }

/**
 * WHAT THE READER WAITS ON BEFORE ANY OF IT IS ABOUT HER: a question he sent to 000009 Milica
 * Bogdanović, one 000030 Isidora Živković sent to him, and one whose other member has let the fee
 * lapse, which the route answers with no number. Oldest first, as `MyApplicationsApi` orders them.
 */
const HIS_QUESTIONS: Row[] = [
  { id: 41, memberNumber: '000009', sentByMe: true, date: '2026-10-02' },
  { id: 43, memberNumber: '000030', sentByMe: false, date: '2026-10-04' },
  { id: 47, memberNumber: null, sentByMe: true, date: '2026-10-06' },
]

/** A question between him and HER, after the three above, in the direction a case names. */
const withHer = (sentByMe: boolean): Row => ({
  id: 52,
  memberNumber: HER,
  sentByMe,
  date: '2026-10-08',
})

/**
 * WHAT THE READER WHO SIGNS IN AFTER THE FIRST WAITS ON, none of it about HER: a question he sent to
 * 000006 Ivona Stamenkovska. Rows of his own, because a question is between two members and so none
 * of these ids can stand on the first reader's list.
 */
const THE_NEXT_READERS_QUESTIONS: Row[] = [
  { id: 71, memberNumber: '000006', sentByMe: true, date: '2026-10-03' },
]

/** What `POST` answers a new question with, which no row above carries. */
const NEW_KEY = 91

const json = (what: unknown, status = 200): Response =>
  new Response(JSON.stringify(what), { status, headers: { 'content-type': 'application/json' } })

type ThePair = {
  /** What each reader waits on, by his number. */
  lists?: Record<string, Row[]>
  /** What `/api/pairs` answers. */
  pairs?: { id: number; season: number; memberNumbers: string[] }[]
  post?: () => Response
  /** Whether a question the route agreed to is then on the list, which is how a screen drawing
   *  the answer is told from one drawing the press. */
  keeps?: boolean
  /** Rows that reach the reader's list at the moment the question is answered, whatever the
   *  answer: a question asked in the meantime from somewhere else. */
  meanwhile?: Row[]
  /** How `/api/me/applications` is answered instead, for a case about a read that fails. */
  reading?: null | (() => Response | Promise<Response>)
}

/**
 * A SERVER THAT KEEPS WHAT EACH READER WAITS ON, AND ADDS A QUESTION THE WAY THE ROUTE DOES.
 *
 * <p>Who is reading is whoever the cookie names, which is how the real route knows it
 * (`MyApplicationsApi` reads the session and nothing the caller sends). A `POST` that answered 201
 * puts a row on the asker's list naming the member the BODY names, so a screen that named the wrong
 * member is drawn what it did rather than what it meant.
 */
function aServerForThePair({
  lists = { [READER]: HIS_QUESTIONS, [ANOTHER_READER]: [] },
  pairs = [],
  post = (): Response => json({ id: NEW_KEY, memberNumber: HER }, 201),
  keeps = true,
  meanwhile = [],
  reading = null,
}: ThePair = {}) {
  const standing: Record<string, Row[]> = { ...lists }
  const reader = (): string => whoTheCookieCurrentlyNames()?.memberNumber ?? ''

  return serverThat((path, init) => {
    const how = init?.method ?? 'GET'

    if (how === 'GET' && path === '/api/competitors') {
      return json(MEMBERS_ON_FILE.filter((one) => one.active))
    }

    if (how === 'GET' && path === '/api/pairs') {
      return json(pairs)
    }

    if (how === 'GET' && path === '/api/me/applications') {
      if (reading !== null) {
        return reading()
      }

      return json({
        teamApplications: [],
        teamInvitations: [],
        teamProposals: [],
        pairInvites: standing[reader()] ?? [],
        alreadyInATeam: false,
      })
    }

    if (how === 'POST' && path === '/api/pairs') {
      const answer = post()
      const named: unknown = JSON.parse(String(init?.body ?? '{}'))
      const asker = reader()

      standing[asker] = [...(standing[asker] ?? []), ...meanwhile]

      if (answer.status === 201 && keeps && typeof named === 'object' && named !== null) {
        standing[asker] = [
          ...(standing[asker] ?? []),
          { id: NEW_KEY, memberNumber: String(Reflect.get(named, 'memberNumber')), sentByMe: true, date: DAY },
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

const readsOfWhatHeWaitsOn = (asked: Asked[]): number =>
  asked.filter((one) => (one.init?.method ?? 'GET') === 'GET' && one.path === '/api/me/applications')
    .length

const reads = (asked: Asked[]): string[] =>
  asked.filter((one) => (one.init?.method ?? 'GET') === 'GET').map((one) => one.path)

/** Lets everything already on its way land and be drawn. */
async function settled(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const theButton = () => screen.queryByRole('button', { name: sr.pair.invite })

/**
 * WHICH OF THE TWO THE PROFILE DRAWS in answer to „is a question standing between us": the sentence
 * that one stands, or the button that asks one. Both and neither are answers too, so a screen that
 * draws both, or is still reading, is not taken for either of the right ones.
 */
const whatIsDrawn = () => ({
  sentence: screen.queryByText(sr.pair.asked) !== null,
  button: theButton() !== null,
})

const THE_SENTENCE_ONLY = { sentence: true, button: false }

const THE_BUTTON_ONLY = { sentence: false, button: true }

/** Each line the profile draws about pairs, in the order it draws them. */
const pairRows = (): string[] =>
  [...document.querySelectorAll('.profile__pair')].map((one) => one.textContent ?? '')

/**
 * WHAT THE BROWSER HOLDS ABOUT A QUESTION, which since P2 must stay empty whatever is pressed: the
 * session's questions about a pair, and the session's messages.
 *
 * <p><b>The messages are read AS THE MEMBER ASKED</b>, which is what the button did: the old press
 * wrote the question's message to her (`to: competitor.memberNumber`), and the session's `inbox`
 * shows whoever is signed in only what was written to them or to the whole league. Read as the one
 * who pressed, a message written to her is never on it, so a case looking there would pass the old
 * press. `pages/teamInviteOnTheServer.test.tsx` holds a team's press the same way.
 */
function HeldInTheBrowser() {
  const { pairInvites, inbox, signIn } = useSession()

  return (
    <>
      <button type="button" onClick={() => signIn(HER)}>
        read as the member asked
      </button>
      <ul aria-label="held in the browser">
        {pairInvites.map((one) => (
          <li key={one.id}>{`${one.id} | ${one.from} | ${one.to}`}</li>
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

/** A question the session holds, written the way the press wrote it until P2, so a page that read
 *  the session's questions instead of the server's has something of its own to draw. */
function HeldBeforeP2({ from, to }: { from: string; to: string }) {
  const today = useToday()
  const { invitePair, notify } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        const id = invitePair({ from, to })

        notify({
          from: sr.app.name,
          to,
          subject: sr.pair.inviteSubject,
          body: sr.pair.inviteBody.replaceAll('{who}', from),
          date: today,
          pairInvite: id,
        })
      }}
    >
      pitanje u pregledacu
    </button>
  )
}

describe('who is offered „Pozovi u trkački par"', () => {
  it('is offered to a member on the profile of somebody of the other sex, once the server says no question stands', async () => {
    const server = aServerForThePair()

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

      expect(await screen.findByRole('button', { name: sr.pair.invite })).toBeVisible()
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(1)
    } finally {
      server.stop()
    }
  }, SLOW)

  it.each([
    ['a visitor', 'visitor', null, HER_PAGE],
    ['a member reading somebody of the same sex', 'competitor', READER, SAME_SEX_PAGE],
  ] as const)('is offered to nobody, and nothing is asked, for %s', async (_, role, who, page) => {
    const server = aServerForThePair()

    try {
      renderAt(page, role, who, undefined, DAY)

      await screen.findByRole('heading', { level: 1 })
      await settled()

      /* The reads that did go out are the anchor: the page asked for its members, so a list of
         what was asked that is empty for some other reason cannot pass. */
      expect(reads(server.asked)).toContain('/api/competitors')
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(0)
      expect(theButton()).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it.each([
    [
      'he holds a pair for the season being formed',
      DAY,
      [{ id: 61, season: 2027, memberNumbers: [READER, '000006'] }],
    ],
    [
      'she holds a pair for the season being formed',
      DAY,
      [{ id: 62, season: 2027, memberNumbers: ['000004', HER] }],
    ],
    /* `transfersTakeEffect` floors the season at the league's first, so on a clock set before the
       league had a season the question is about 2027 and her pair for 2027 stands in its way; a
       year worked out by hand asks about 2026 and offers the button beside a pair that exists. */
    [
      'the clock is set before the league had a season and she holds a pair for its first',
      '2025-10-15',
      [{ id: 63, season: 2027, memberNumbers: ['000004', HER] }],
    ],
  ])('is offered to nobody, and nothing is asked, when %s', async (_, day, pairs) => {
    const server = aServerForThePair({ pairs })

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, day)

      await screen.findByRole('heading', { level: 1, name: /Katarina/ })
      await settled()

      expect(reads(server.asked)).toContain('/api/pairs')
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(0)
      expect(theButton()).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('is offered beside a pair of the season being run, which is not the season being formed', async () => {
    /* On 15 January the season being run is 2027 and the season a pair is made for is 2028: his
       pair for 2027 is the one he races in and stands in the way of nothing. */
    const server = aServerForThePair({
      pairs: [{ id: 64, season: 2027, memberNumbers: [READER, '000006'] }],
    })

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, '2027-01-15')

      expect(await screen.findByRole('button', { name: sr.pair.invite })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)
})

describe('what stands in the place of the button', () => {
  it.each([
    ['he asked her', true],
    ['she asked him', false],
  ])('says a question stands where one names the member on this page, when %s', async (_, sentByMe) => {
    const server = aServerForThePair({
      lists: { [READER]: [...HIS_QUESTIONS, withHer(sentByMe)] },
    })

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

      const said = await screen.findByText(sr.pair.asked)

      expect(said).toBeVisible()
      expect(theButton()).toBeNull()
      /* Drawn because the server says so on arrival, and not in the place of a button the reader
         pressed, so the keyboard stays wherever it was. */
      expect(said).not.toHaveFocus()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('offers the button where the reader’s questions name others, and a member whose fee has lapsed', async () => {
    const server = aServerForThePair()

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

      expect(await screen.findByRole('button', { name: sr.pair.invite })).toBeVisible()
      expect(screen.queryByText(sr.pair.asked)).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('offers nothing while what the reader waits on is still being read', async () => {
    /* The button is a claim that no question stands, so it waits for the list that says so, and
       no loader stands in its place either, which is `profile/InviteToTeam.tsx`'s answer directly
       above it. */
    let release = (): void => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const server = aServerForThePair({
      reading: () =>
        held.then(() =>
          json({
            teamApplications: [],
            teamInvitations: [],
            teamProposals: [],
            pairInvites: HIS_QUESTIONS,
            alreadyInATeam: false,
          }),
        ),
    })

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

      await screen.findByRole('heading', { level: 1, name: /Katarina/ })
      await waitFor(() => {
        expect(readsOfWhatHeWaitsOn(server.asked)).toBe(1)
      })
      await settled()

      expect(theButton()).toBeNull()
      expect(screen.queryByText(sr.pair.asked)).toBeNull()
      expect(screen.queryByText(sr.data.loading)).toBeNull()

      release()

      expect(await screen.findByRole('button', { name: sr.pair.invite })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says so when what the reader waits on cannot be read, offers no button over it, and asks again', async () => {
    let fails = true
    const server = aServerForThePair({
      reading: () =>
        fails
          ? answeredWith(500)
          : json({
              teamApplications: [],
              teamInvitations: [],
              teamProposals: [],
              pairInvites: [],
              alreadyInATeam: false,
            }),
    })
    const user = setupUser()

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

      expect(await screen.findByText(sr.data.error)).toBeVisible()
      expect(theButton()).toBeNull()

      fails = false
      await user.click(screen.getByRole('button', { name: sr.data.retry }))

      expect(await screen.findByRole('button', { name: sr.pair.invite })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('is drawn for the next member visited from what the server says of her, and nothing of the last is carried', async () => {
    const server = aServerForThePair({
      lists: { [READER]: [...HIS_QUESTIONS, withHer(true)] },
    })

    try {
      const { router } = renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

      await screen.findByText(sr.pair.asked)

      await act(async () => {
        await router.navigate(NEXT_PAGE)
      })

      expect(await screen.findByRole('button', { name: sr.pair.invite })).toBeVisible()
      expect(screen.queryByText(sr.pair.asked)).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('does not carry a refusal about one member to the next one visited', async () => {
    const server = aServerForThePair({ post: () => refused('aPairAlreadyHolds', 409) })
    const user = setupUser()

    try {
      const { router } = renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

      await user.click(await screen.findByRole('button', { name: sr.pair.invite }))
      await screen.findByRole('alert')

      await act(async () => {
        await router.navigate(NEXT_PAGE)
      })

      expect(await screen.findByRole('button', { name: sr.pair.invite })).toBeVisible()
      expect(screen.queryByRole('alert')).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('does not carry what one reader was told to the next one signed in on the same page', async () => {
    const server = aServerForThePair({ post: () => refused('aPairAlreadyHolds', 409) })
    const user = setupUser()

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, DAY, <Become who={ANOTHER_READER} />)

      await user.click(await screen.findByRole('button', { name: sr.pair.invite }))
      await screen.findByRole('alert')

      await user.click(screen.getByRole('button', { name: `postani ${ANOTHER_READER}` }))

      /* WHAT THE FIRST READER WAS TOLD IS NOT DRAWN TO THE NEXT ONE, and that is all this case
         measures: the component is keyed by the reader as well as by the member on the page, so it
         comes down with the refusal it holds. What the next reader WAITS ON is another fact and is
         not measured here: neither list names her (his own is empty and the first one's names
         others), so the button is the same screen whether the list was read again for him or served
         from the first reader's. The case below tells the two apart. */
      await waitFor(() => {
        expect(screen.queryByRole('alert')).toBeNull()
      })
      expect(await screen.findByRole('button', { name: sr.pair.invite })).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)

  /* THE LIST IS THE READER'S, AND SIGNING IN AS SOMEBODY ELSE HAPPENS IN PLACE (the profile is one
     component across every member's address), so what the page draws has to come from what the
     route says to the one who is signed in NOW. Two things can hand him the first reader's list
     instead, and the case above tells neither from the right answer: the number the page gives
     `useWhatIsWaiting` (`profile/InviteToPair.tsx`, `mine`) and the cache that is dropped when that
     number changes (`data/useResource.ts`, `theWaitingNowBelongsTo`). Review of PR 518,
     10.10.2026: `mine` taken from the member on the page and not from the reader kept every case
     of this file green.

     **The two lists differ in the one row that matters, and in both directions.** A question the
     first reader asked is not drawn to the next, who is no party to it; and a question that stands
     with the next reader takes the button's place, instead of the button being offered over it,
     which the route would refuse. Neither can be had without the list being read AGAIN, once for
     each reader, which is the second thing every row holds. */
  it.each([
    [
      'the first had asked her and the next has not',
      [...HIS_QUESTIONS, withHer(true)],
      THE_NEXT_READERS_QUESTIONS,
      THE_SENTENCE_ONLY,
      THE_BUTTON_ONLY,
    ],
    [
      'the first had not asked her and the next was asked by her',
      HIS_QUESTIONS,
      [...THE_NEXT_READERS_QUESTIONS, { ...withHer(false), id: 72 }],
      THE_BUTTON_ONLY,
      THE_SENTENCE_ONLY,
    ],
  ])('draws what the route says to the reader signed in after the first, and nothing of the first’s, when %s', async (_, first, next, firstSees, nextSees) => {
    const server = aServerForThePair({ lists: { [READER]: first, [ANOTHER_READER]: next } })
    const user = setupUser()

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, DAY, <Become who={ANOTHER_READER} />)

      /* The first reader is told what his own list says, from the one read that went out for him. */
      await waitFor(() => {
        expect(whatIsDrawn()).toEqual(firstSees)
      })
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(1)

      await user.click(screen.getByRole('button', { name: `postani ${ANOTHER_READER}` }))

      /* At once, whether or not his own list has landed yet: whatever is drawn is not the first
         reader's. Held by the wait below alone, a screen that served the first reader's list would
         be told only when that wait runs out. */
      expect(whatIsDrawn()).not.toEqual(firstSees)

      /* And then his own: the right one of the two, and the second read, which is what tells a
         list read for him from the first reader's list served to him. */
      await waitFor(() => {
        expect(whatIsDrawn()).toEqual(nextSees)
      })
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
    } finally {
      server.stop()
    }
  }, SLOW)
})

describe('the press', () => {
  it('sends one question naming the member on the page, writes nothing into the browser, and says it stands', async () => {
    const server = aServerForThePair()
    const user = setupUser()

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, DAY, <HeldInTheBrowser />)

      await user.click(await screen.findByRole('button', { name: sr.pair.invite }))

      const said = await screen.findByText(sr.pair.asked)

      expect(writes(server.asked)).toEqual([
        { path: '/api/pairs', how: 'POST', body: `{"memberNumber":"${HER}"}` },
      ])
      /* Read again after the server agreed, which is where the sentence comes from. */
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
      /* The sentence took the place of the button and the keyboard with it. */
      await waitFor(() => {
        expect(said).toHaveFocus()
      })
      /* And the browser holds neither a question nor a message: both are the route's to write. */
      expect(heldInTheBrowser()).toEqual([])
      await user.click(screen.getByRole('button', { name: 'read as the member asked' }))
      expect(heldInTheBrowser()).toEqual([])
    } finally {
      server.stop()
    }
  }, SLOW)

  it('draws what the server answered and not what was pressed', async () => {
    const server = aServerForThePair({ keeps: false })
    const user = setupUser()

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

      await user.click(await screen.findByRole('button', { name: sr.pair.invite }))

      await waitFor(() => {
        expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
      })
      await waitFor(() => {
        expect(theButton()).not.toHaveAttribute('aria-disabled')
      })
      expect(screen.queryByText(sr.pair.asked)).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('puts „poslat" in the place of the button when the route says a question already stands, read again off the server, and says it once', async () => {
    /* She asked him from her own page in the meantime: the route refuses a second question
       between the two, and what he waits on now names her. */
    let posted = false
    let release = (): void => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const server = aServerForThePair({
      post: () => {
        posted = true

        return refused('aQuestionAlreadyStands', 409)
      },
      meanwhile: [withHer(false)],
    })
    const answering = globalThis.fetch

    /* The read that follows the refusal is held, so what the page says WHILE it is out can be read:
       the refusal is the same words as the sentence that takes the button's place, and said at once
       it would be said twice. */
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await answering(input, init)

      return posted && String(input) === '/api/me/applications' ? held.then(() => response) : response
    }

    const user = setupUser()

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

      await user.click(await screen.findByRole('button', { name: sr.pair.invite }))
      await waitFor(() => {
        expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
      })
      await settled()

      expect(screen.queryByRole('alert')).toBeNull()
      expect(theButton()).toHaveAttribute('aria-disabled', 'true')

      release()

      await waitFor(() => {
        expect(theButton()).toBeNull()
      })

      const said = screen.getByText(sr.pair.asked)

      /* Said once, in the button's place, and not a second time as a refusal under it. */
      expect(screen.queryByRole('alert')).toBeNull()
      await waitFor(() => {
        expect(said).toHaveFocus()
      })
    } finally {
      globalThis.fetch = answering
      server.stop()
    }
  }, SLOW)

  it.each([
    ['aPairAlreadyHolds', 409, sr.pair.inviteRefused.aPairAlreadyHolds],
    ['thePairWouldNotBeMixed', 409, sr.pair.inviteRefused.thePairWouldNotBeMixed],
    ['theFormIsNotComplete', 400, sr.pair.inviteRefused.theFormIsNotComplete],
  ])('says %s in its own words under the button, which stays, and reads again what the page was drawn from', async (reason, status, words) => {
    const server = aServerForThePair({ post: () => refused(reason, status) })
    const user = setupUser()

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

      await user.click(await screen.findByRole('button', { name: sr.pair.invite }))

      expect(await screen.findByRole('alert')).toHaveTextContent(words)
      /* A refusal that names a row says the page was drawn from something stale, so the list is
         asked for again (derived 10.10.2026 from the remedy of the medium finding on PR 516), and
         the pairs are dropped for the next screen that reads them. */
      await waitFor(() => {
        expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
      })
      await waitFor(() => {
        expect(theButton()).not.toHaveAttribute('aria-disabled')
      })
      expect(theButton()).toBeVisible()
      expect(arrivedResource('pairs')).toBeUndefined()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says what the empty 404 means in the route’s own terms, and reads again', async () => {
    const server = aServerForThePair({ post: () => answeredWith(404) })
    const user = setupUser()

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

      await user.click(await screen.findByRole('button', { name: sr.pair.invite }))

      expect(await screen.findByRole('alert')).toHaveTextContent(sr.pair.inviteRefused.notThere)
      await waitFor(() => {
        expect(readsOfWhatHeWaitsOn(server.asked)).toBe(2)
      })
      expect(arrivedResource('pairs')).toBeUndefined()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('reads nothing again when the server said nothing about any row', async () => {
    const server = aServerForThePair({ post: () => answeredWith(500) })
    const user = setupUser()

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

      await user.click(await screen.findByRole('button', { name: sr.pair.invite }))

      expect(await screen.findByRole('alert')).toHaveTextContent('500')
      await waitFor(() => {
        expect(theButton()).not.toHaveAttribute('aria-disabled')
      })
      await settled()

      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(1)
      expect(arrivedResource('pairs')).toBeDefined()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('sends one question for two presses inside one task, and tells the button off while it is out', async () => {
    let answer: (value: Response) => void = () => {}
    const held = new Promise<Response>((resolve) => {
      answer = resolve
    })
    const server = aServerForThePair()
    const answering = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await answering(input, init)

      return init?.method === 'POST' ? held.then(() => response) : response
    }

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

      const button = await screen.findByRole('button', { name: sr.pair.invite })

      act(() => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-disabled', 'true')
      })
      /* Told off and not switched off: it keeps its place in the order of the keyboard. */
      expect(button).not.toHaveAttribute('disabled')

      answer(json({}, 201))

      await screen.findByText(sr.pair.asked)

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
    const server = aServerForThePair()
    const answering = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await answering(input, init)

      return init?.method === 'POST' ? held.then(() => response) : response
    }

    const user = setupUser()

    try {
      renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

      await user.click(await screen.findByRole('button', { name: sr.pair.invite }))

      const elsewhere = screen.getByRole('link', { name: sr.shell.skipToContent })

      elsewhere.focus()
      answer(json({}, 201))

      await screen.findByText(sr.pair.asked)
      await settled()

      expect(elsewhere).toHaveFocus()
    } finally {
      globalThis.fetch = answering
      server.stop()
    }
  }, SLOW)
})

describe('the questions still standing on the reader’s own page', () => {
  it('are read off the server, each from its own side and named after the other member, oldest first, with no day', async () => {
    /* `000099` is on no list of members, so the route's number is what is said. */
    const server = aServerForThePair({
      lists: {
        [READER]: [...HIS_QUESTIONS, { id: 58, memberNumber: '000099', sentByMe: true, date: '2026-10-07' }],
      },
    })
    const user = setupUser()

    try {
      /* And a question the browser holds, from him to Ivona, which a page reading the session
         instead of the server would draw. */
      renderAt(HIS_OWN, 'competitor', READER, undefined, DAY, <HeldBeforeP2 from={READER} to="000006" />)

      await user.click(screen.getByRole('button', { name: 'pitanje u pregledacu' }))
      await screen.findByText(/Poslat poziv: Milica Bogdanović/)

      const rows = pairRows()

      expect(rows).toHaveLength(2)
      expect(rows[0]).toBe(sr.pair.none)

      const standing = must(rows[1], 'the line of questions')
      const spans = [...document.querySelectorAll('.profile__pair-waiting')].map((one) =>
        (one.textContent ?? '').trim(),
      )

      /* The row with no number is not drawn at all: it would tell him whose fee has lapsed. */
      expect(spans).toEqual([
        'Poslat poziv: Milica Bogdanović.',
        'Primljen poziv: Isidora Živković.',
        'Poslat poziv: 000099.',
      ])
      /* And they are sentences apart and not run into one another, which is what the line read
         as before a space stood between them (review, 07.09.2026: „Nije u trkačkom paru.Primljen
         poziv: Relja Momčilović.Primljen poziv: Časlav Radenković."). */
      expect(standing).toContain('Milica Bogdanović. Primljen poziv: Isidora Živković. Poslat poziv')
      expect(standing).not.toContain('Relja')
      expect(standing).not.toContain('Ivona')
      expect(standing).not.toMatch(/2026|10\./)
      expect(must(document.querySelectorAll('.profile__pair')[1], 'the line').querySelector('img')).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('stand beside the pairs the reader holds, after them', async () => {
    const server = aServerForThePair({
      pairs: [{ id: 65, season: 2027, memberNumbers: [READER, '000006'] }],
    })

    try {
      renderAt(HIS_OWN, 'competitor', READER, undefined, DAY)

      await screen.findByText(/Primljen poziv: Isidora Živković/)

      const rows = pairRows()

      expect(rows).toHaveLength(2)
      expect(must(rows[0], 'the pair')).toContain('Ivona Stamenkovska')
      expect(must(rows[1], 'the questions')).toContain('Poslat poziv: Milica Bogdanović.')
    } finally {
      server.stop()
    }
  }, SLOW)

  it('are not drawn, nor asked for, on somebody else’s page', async () => {
    const server = aServerForThePair()

    try {
      const { router } = renderAt(SAME_SEX_PAGE, 'competitor', READER, undefined, DAY)

      await screen.findByRole('heading', { level: 1, name: /Časlav/ })
      await settled()

      expect(reads(server.asked)).toContain('/api/pairs')
      expect(readsOfWhatHeWaitsOn(server.asked)).toBe(0)
      expect(pairRows()).toEqual([])

      /* And on her page, where the button reads what he waits on, none of it is drawn either. */
      await act(async () => {
        await router.navigate(HER_PAGE)
      })
      await screen.findByRole('button', { name: sr.pair.invite })

      expect(pairRows()).toEqual([])
      expect(screen.queryByText(/Poslat poziv|Primljen poziv/)).toBeNull()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('say so when they cannot be read, and the pairs stay drawn', async () => {
    let fails = true
    const server = aServerForThePair({
      pairs: [{ id: 65, season: 2027, memberNumbers: [READER, '000006'] }],
      reading: () =>
        fails
          ? answeredWith(500)
          : json({
              teamApplications: [],
              teamInvitations: [],
              teamProposals: [],
              pairInvites: HIS_QUESTIONS,
              alreadyInATeam: false,
            }),
    })
    const user = setupUser()

    try {
      renderAt(HIS_OWN, 'competitor', READER, undefined, DAY)

      expect(await screen.findByText(sr.data.error)).toBeVisible()
      expect(must(pairRows()[0], 'the pair')).toContain('Ivona Stamenkovska')

      fails = false
      await user.click(screen.getByRole('button', { name: sr.data.retry }))

      expect(await screen.findByText(/Poslat poziv: Milica Bogdanović/)).toBeVisible()
    } finally {
      server.stop()
    }
  }, SLOW)
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
