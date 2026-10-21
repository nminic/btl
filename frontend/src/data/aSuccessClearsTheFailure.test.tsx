import { act, configure, render, screen, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../session/SessionProvider'
import { answeredWith, serverThat } from '../test/serverAnswers'
import { setupUser } from '../test/user'
import { clearResourceCache, type ResourceName } from './client'
import { useInbox, useResource, useWhatIsWaiting, type ResourceState } from './useResource'

/* EVERY WAIT OF THIS FILE IS SHORTER THAN THE CASE THAT IS WAITING (review of PR 618, round 1). The
   global is `SLOW` (twenty seconds, `test/setup.ts`) and a case here has Vitest's own five, so a wait
   that never succeeds was ended by the clock of the case and every mutation of this file failed as
   `Test timed out in 5000ms` and not on the sentence that says what is wrong. Two seconds is room for a
   runner several times slower than the one this was measured on, and leaves three for the rest of the
   case. Set here, and so for this file alone: every file has a configuration of its own. */
configure({ asyncUtilTimeout: 2_000 })

/**
 * A SUCCESSFUL READ OF AN ADDRESS TAKES THE FAILURE OFF EVERY OTHER READER OF THE SAME ADDRESS
 * (decision of 20.10.2026, `btl-produkt/ADL.md`, „Kad jedno mesto uspešno pročita istu adresu, greška
 * nestaje svuda gde se ta adresa čita", PENDING 28745: the panel under the envelope stood in its
 * failure beside the screen of messages that had read the inbox).
 *
 * <p>`data/askingAgain.test.tsx` holds who is asked when somebody PRESSES a button; this holds the
 * other road to the same end, where nobody pressed and a neighbour read the address.
 *
 * <p><b>The axes are the answer.</b> <i>Which address</i> the success is on (the same as the failure,
 * another). <i>What the other reader is doing</i> (showing a failure, loading, holding an answer).
 * <i>What the success is made of</i> (a read that was started by a mount, a read that was started by an
 * asking again). And the two things that must NOT happen, which are the reason this file counts what
 * the portal ASKED and how many states a reader was HANDED instead of reading words: a success that
 * makes anybody ask again, and a failure that makes anybody ask again.
 *
 * <p>The decision ends: „Piše se tako da ne može da zavrti petlju ponovnih pokušaja." The loop that
 * sentence is about is `success -> everybody reads again -> a success -> ...`, and it cannot start
 * here for a reason that is measured rather than argued: every case counts the requests, and a
 * reader that is told takes what the visit already holds.
 */

const LEAGUES = '/api/leagues'
const MODERATORS = '/api/moderators'

type Answer = () => Response | Promise<Response>

let answers = new Map<string, Answer>()
let server: { asked: { path: string }[]; stop: () => void } | null = null

const failing = (status: number): Answer => () => answeredWith(status)
const serving =
  (...rows: string[]) =>
  (): Response =>
    new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } })
const holding = (): { answer: Answer; release: (how: Response) => void } => {
  let release: (how: Response) => void = () => undefined

  return {
    answer: () =>
      new Promise<Response>((resolve) => {
        release = resolve
      }),
    release: (how) => {
      release(how)
    },
  }
}

function theServerAnswers(who: Record<string, Answer>) {
  answers = new Map(Object.entries(who))
  server = serverThat((path) => answers.get(path)?.() ?? null)
}

const timesAsked = (path: string) => (server?.asked ?? []).filter((one) => one.path === path).length

afterEach(() => {
  server?.stop()
  server = null
  vi.restoreAllMocks()
})

function words(state: ResourceState<string[]>): string {
  if (state.status === 'loading') {
    return 'loading'
  }

  if (state.status === 'ready') {
    return `ready: ${state.data.join(',')}`
  }

  return `${state.reading ? 'asking again' : 'failed'}: ${state.error.message}`
}

/** One reader, drawn as a screen would: what it says, and how many different states it was handed
 *  (a state is a new object every time a reader is told anything, so a reader that was made to ask
 *  again, or told twice, has been handed more than it should have been with the same words). */
function Reader({ name, label, revision }: { name: ResourceName; label: string; revision?: number }) {
  const state = useResource<string[]>(name, { revision })
  const seen = useRef(new Set<ResourceState<string[]>>())

  seen.current.add(state)

  return (
    <section aria-label={label}>
      <p>{words(state)}</p>
      <p>{`handed ${seen.current.size}`}</p>
      {state.status === 'error' && (
        <button type="button" onClick={state.readAgain}>
          {`Ask again: ${label}`}
        </button>
      )}
    </section>
  )
}

const text = (label: string) => screen.getByRole('region', { name: label }).textContent
const ask = (label: string) => screen.getByRole('button', { name: `Ask again: ${label}` })

/** The reader that failed and a second one mounted beside it later, with the server back. */
async function aFailureAndANeighbourThatReads() {
  theServerAnswers({ [LEAGUES]: failing(500) })

  const view = render(<Reader name="leagues" label="A" />)

  await waitFor(() => expect(text('A')).toContain('failed: Cannot load leagues: 500'))
  answers.set(LEAGUES, serving('Liga'))

  return view
}

describe('a reader that is showing a failure, when another reads the same address', () => {
  it('shows the answer without anybody asking, and the server is asked once for the neighbour and for nobody else', async () => {
    const { rerender } = await aFailureAndANeighbourThatReads()

    rerender(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="leagues" label="B" />
      </>,
    )

    await waitFor(() => expect(text('B')).toContain('ready: Liga'))
    await waitFor(() => expect(text('A')).toContain('ready: Liga'))
    /* One for the failure and one for the neighbour; nobody was made to ask again. */
    expect(timesAsked(LEAGUES), 'the success made somebody ask the server').toBe(2)
    /* A saw its loading, its failure and the answer, and nothing between: a reader told to ask again
       would have been handed a fourth state, the one that says it is asking. */
    expect(text('A')).toContain('handed 3')
    expect(text('A')).not.toContain('asking again')
    /* And the reader that read it is handed its loading and its answer, and no more for being the
       one that told the others. */
    expect(text('B')).toContain('handed 2')
  })

  it('stops offering to ask again, because there is nothing left to ask about', async () => {
    const { rerender } = await aFailureAndANeighbourThatReads()

    expect(ask('A')).toBeVisible()

    rerender(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="leagues" label="B" />
      </>,
    )

    await waitFor(() => expect(text('A')).toContain('ready: Liga'))
    expect(screen.queryByRole('button', { name: 'Ask again: A' })).toBeNull()
  })

  it('is told by an asking again as well, which is a read like any other', async () => {
    theServerAnswers({ [LEAGUES]: failing(500) })

    render(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="leagues" label="B" />
      </>,
    )
    await waitFor(() => expect(text('A')).toContain('failed'))
    await waitFor(() => expect(text('B')).toContain('failed'))

    answers.set(LEAGUES, serving('Liga'))
    await setupUser().click(ask('A'))

    await waitFor(() => expect(text('A')).toContain('ready: Liga'))
    await waitFor(() => expect(text('B')).toContain('ready: Liga'))
    /* The first read for the two of them and one asking again for the two of them. The success that
       came back from that asking told the readers that were still in the registry once more, and the
       one that had been answered already was not handed a state for it: A saw its loading, its
       failure, its asking and its answer; B the same four. */
    expect(timesAsked(LEAGUES)).toBe(2)
    expect(text('A')).toContain('handed 4')
    expect(text('B')).toContain('handed 4')
  })

  it('is left alone by a success on ANOTHER address, which is another fact', async () => {
    theServerAnswers({ [LEAGUES]: failing(500), [MODERATORS]: failing(500) })

    const { rerender } = render(<Reader name="leagues" label="A" />)

    await waitFor(() => expect(text('A')).toContain('failed'))
    answers.set(MODERATORS, serving('Sudija'))

    rerender(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="moderators" label="B" />
      </>,
    )

    await waitFor(() => expect(text('B')).toContain('ready: Sudija'))
    expect(text('A'), 'the failure of one address was taken off by the success of another').toContain(
      'failed: Cannot load leagues: 500',
    )
    expect(text('A')).toContain('handed 2')
    expect(timesAsked(LEAGUES)).toBe(1)
  })

  it('is taken off the failure it holds, and the failure of the other address stays, when two failed and one is read', async () => {
    theServerAnswers({ [LEAGUES]: failing(500), [MODERATORS]: failing(500) })

    const { rerender } = render(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="moderators" label="B" />
      </>,
    )

    await waitFor(() => expect(text('A')).toContain('failed'))
    await waitFor(() => expect(text('B')).toContain('failed'))
    answers.set(LEAGUES, serving('Liga'))

    rerender(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="moderators" label="B" />
        <Reader name="leagues" label="C" />
      </>,
    )

    await waitFor(() => expect(text('C')).toContain('ready: Liga'))
    await waitFor(() => expect(text('A')).toContain('ready: Liga'))
    expect(text('B'), 'a success on the leagues took the failure of the moderators').toContain('failed')
    expect(timesAsked(MODERATORS)).toBe(1)
  })
})

describe('a reader that is not showing a failure, when another reads the same address', () => {
  it('is not handed anything by the success of a neighbour while it is itself still loading, and takes its own answer', async () => {
    theServerAnswers({ [LEAGUES]: failing(500), [MODERATORS]: () => new Promise<Response>(() => undefined) })

    const { rerender } = render(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="moderators" label="L" />
      </>,
    )

    await waitFor(() => expect(text('A')).toContain('failed'))
    expect(text('L')).toContain('loading')

    answers.set(LEAGUES, serving('Liga'))
    rerender(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="moderators" label="L" />
        <Reader name="leagues" label="B" />
      </>,
    )

    await waitFor(() => expect(text('A')).toContain('ready: Liga'))
    expect(text('L'), 'a reader that was still loading was handed an answer that was not its own').toContain(
      'loading',
    )
    expect(text('L')).toContain('handed 1')
  })

  it('is loading on the same address when the failure is taken off, and it takes what arrives', async () => {
    const { rerender } = await aFailureAndANeighbourThatReads()
    const held = holding()

    answers.set(LEAGUES, held.answer)
    rerender(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="leagues" label="B" />
      </>,
    )

    await waitFor(() => expect(text('B')).toContain('loading'))
    /* The neighbour is on its way and the failure is still on A: nothing has been read yet. */
    expect(text('A')).toContain('failed')

    act(() => {
      held.release(serving('Liga')())
    })

    await waitFor(() => expect(text('B')).toContain('ready: Liga'))
    await waitFor(() => expect(text('A')).toContain('ready: Liga'))
    expect(timesAsked(LEAGUES)).toBe(2)
  })

  it('is not handed another state when it already holds the answer, and is not asked for it', async () => {
    theServerAnswers({ [LEAGUES]: serving('Liga') })

    const { rerender } = render(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="leagues" label="B" />
      </>,
    )

    await waitFor(() => expect(text('A')).toContain('ready: Liga'))
    await waitFor(() => expect(text('B')).toContain('ready: Liga'))

    const handed = text('A')

    /* A third reader arrives and reads: it is a success on the address, and it is told to nobody
       who failed, because nobody did. */
    rerender(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="leagues" label="B" />
        <Reader name="leagues" label="C" />
      </>,
    )
    await waitFor(() => expect(text('C')).toContain('ready: Liga'))

    expect(text('A'), 'a reader that held the answer was handed another state').toBe(handed)
    expect(timesAsked(LEAGUES)).toBe(1)
  })

  it('does not ask a reader that holds the answer when a button on a reader that failed later is pressed', async () => {
    theServerAnswers({ [LEAGUES]: serving('Liga') })

    const { rerender } = render(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="leagues" label="B" revision={0} />
      </>,
    )

    await waitFor(() => expect(text('A')).toContain('ready: Liga'))
    await waitFor(() => expect(text('B')).toContain('ready: Liga'))

    /* The cache is dropped and the server fails for the next read: B, which is told to read again by
       its revision, is the one that shows the failure; A holds the answer it had. */
    answers.set(LEAGUES, failing(500))
    act(() => {
      clearResourceCache('leagues')
    })
    rerender(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="leagues" label="B" revision={1} />
      </>,
    )
    await waitFor(() => expect(text('B')).toContain('failed'))

    const handed = text('A')

    answers.set(LEAGUES, serving('Liga'))
    await setupUser().click(ask('B'))

    await waitFor(() => expect(text('B')).toContain('ready: Liga'))
    expect(text('A'), 'a press on a reader that failed handed another state to one that held the answer').toBe(
      handed,
    )
    expect(timesAsked(LEAGUES)).toBe(3)
  })
})

describe('a failure', () => {
  it('makes nobody else ask the server, and does not change what they show', async () => {
    theServerAnswers({ [LEAGUES]: failing(500) })

    const { rerender } = render(<Reader name="leagues" label="A" />)

    await waitFor(() => expect(text('A')).toContain('failed'))

    rerender(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="leagues" label="B" />
      </>,
    )

    await waitFor(() => expect(text('B')).toContain('failed'))
    /* One for A and one for B, which is a reader that mounted; A was not made to ask for B's. */
    expect(timesAsked(LEAGUES), 'a failure made a neighbour ask again').toBe(2)
    expect(text('A')).toContain('handed 2')
    expect(text('A')).not.toContain('asking again')
  })
})

describe('what is told, and when', () => {
  it('is not told inside a render, which would be a warning from React for every reader it reached', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { rerender } = await aFailureAndANeighbourThatReads()

    rerender(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="leagues" label="B" />
      </>,
    )

    await waitFor(() => expect(text('A')).toContain('ready: Liga'))
    await waitFor(() => expect(text('B')).toContain('ready: Liga'))
    expect(complaint, 'a reader was updated while another one was being drawn').not.toHaveBeenCalled()
  })

  it('takes nothing from a reader that left before the answer came, and says nothing wrong to the others', async () => {
    const { rerender } = await aFailureAndANeighbourThatReads()
    const held = holding()

    answers.set(LEAGUES, held.answer)
    rerender(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="leagues" label="B" />
      </>,
    )
    await waitFor(() => expect(text('B')).toContain('loading'))

    /* The reader that asked leaves while its request is out. What arrives is still about the address
       and the one that failed is still showing a sentence that is no longer true. */
    rerender(<Reader name="leagues" label="A" />)
    act(() => {
      held.release(serving('Liga')())
    })

    await waitFor(() => expect(text('A')).toContain('ready: Liga'))
    expect(timesAsked(LEAGUES)).toBe(2)
  })
})

/**
 * AN ANSWER THAT WAS DROPPED BEFORE IT CAME TELLS NOBODY AND IS KEPT BY NOBODY (review of PR 618,
 * round 1, a high finding, and a leak of one member's mail to the next).
 *
 * <p><b>What was measured.</b> A read started for the previous caller is still out when the caller
 * changes. The new caller's own read fails, and then the old read arrives. `loadResource` wrote what
 * arrived into the cache although `clearResourceCache` had already thrown that promise away (that half
 * is older than the PR), and the reader's callback told every reader showing a failure of the address
 * that the address had arrived - so the NEW caller's panel, showing its failure, took what the cache
 * held, which was the PREVIOUS caller's mail. On the merge base the new caller stayed in his failure.
 *
 * <p><b>The rule is one sentence</b>: a read tells the others, and is kept, only while it is still the
 * read the visit holds for its address. A read that was dropped is an answer to a question nobody is
 * asking any more.
 *
 * <p><b>The axes are the answer.</b> <i>How the caller changed</i> (in place, under a panel that stays;
 * through a panel that comes down and another that goes up). <i>Which name</i> (the two that depend on
 * who is asking and are dropped by their own hooks: `inbox` and `me/applications`, each through the
 * hook that real screens use, inside the provider they use). And a name that does not depend on anybody
 * at all, dropped by a plain `clearResourceCache`, where the same two things are asked of a reader that
 * is showing a failure beside the one whose read was dropped.
 */

const MINE = '000041'
const HERS = '000042'

const SECRET = 'A-SECRET'

type TheNames = {
  name: ResourceName
  path: string
  /** The hook a real screen calls, handed whose it is. */
  use: (mine: string) => ResourceState<unknown>
  /** What the server answers the member who asked first, with the secret in it. */
  answer: () => Response
}

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

const THE_NAMES: TheNames[] = [
  {
    name: 'inbox',
    path: '/api/inbox',
    use: (mine) => useInbox(mine),
    answer: () =>
      json([
        {
          id: 901,
          from: 'Balkanska trkačka liga',
          subject: SECRET,
          body: 'Samo za prvog člana.',
          date: '2026-10-01',
          read: false,
          teamInvitationId: null,
          pairInviteId: null,
        },
      ]),
  },
  {
    name: 'me/applications',
    path: '/api/me/applications',
    use: (mine) => useWhatIsWaiting(mine),
    answer: () =>
      json({
        teamApplications: [],
        teamInvitations: [],
        teamProposals: [{ id: 902, teamId: null, name: SECRET, date: '2026-10-01' }],
        pairInvites: [],
        alreadyInATeam: false,
      }),
  },
]

/** The server that holds the FIRST read of an address and fails every one after it, which is the
 *  order of the sequence being measured: the previous caller's read is out, the new caller's fails. */
function theFirstReadIsHeldAndTheRestFail(path: string) {
  const held = holding()
  let calls = 0

  server = serverThat((asked) => {
    if (asked !== path) {
      return null
    }

    calls += 1

    return calls === 1 ? held.answer() : answeredWith(500)
  })

  return held
}

function wordsOfAnything(state: ResourceState<unknown>): string {
  if (state.status === 'loading') {
    return 'loading'
  }

  return state.status === 'ready' ? `ready: ${JSON.stringify(state.data)}` : `failed: ${state.error.message}`
}

function Panel({ mine, use }: { mine: string; use: (mine: string) => ResourceState<unknown> }) {
  return (
    <section aria-label="panel">
      <p>{wordsOfAnything(use(mine))}</p>
    </section>
  )
}

/** Long enough for an answer that was released to have gone all the way through the data layer, which
 *  is what makes a case that says „it did not reach the panel" mean it. The mutations of this file are
 *  what show the wait is long enough: a panel that IS reached is reached inside it. */
const aMomentForTheOldAnswer = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150))
  })

describe.each(THE_NAMES)('the answer to the previous caller of $name, arriving after the caller has changed', (one) => {
  it('does not reach the new caller\'s panel when the caller is switched under a panel that stays', async () => {
    const held = theFirstReadIsHeldAndTheRestFail(one.path)
    const panel = () => screen.getByRole('region', { name: 'panel' }).textContent
    const { rerender } = render(
      <SessionProvider>
        <Panel mine={MINE} use={one.use} />
      </SessionProvider>,
    )

    await waitFor(() => expect(timesAsked(one.path)).toBe(1))

    rerender(
      <SessionProvider>
        <Panel mine={HERS} use={one.use} />
      </SessionProvider>,
    )
    await waitFor(() => expect(panel()).toContain('failed'))

    held.release(one.answer())
    await aMomentForTheOldAnswer()

    expect(panel(), 'the previous caller\'s answer reached the new caller').not.toContain(SECRET)
    expect(panel()).toContain('failed')
  })

  it('does not reach the new caller\'s panel when the first panel came down and another went up', async () => {
    const held = theFirstReadIsHeldAndTheRestFail(one.path)
    const panel = () => screen.getByRole('region', { name: 'panel' }).textContent
    const { rerender } = render(
      <SessionProvider>
        <Panel mine={MINE} use={one.use} />
      </SessionProvider>,
    )

    await waitFor(() => expect(timesAsked(one.path)).toBe(1))

    /* Signed out: the panel is gone while its read is still out. */
    rerender(<SessionProvider>{null}</SessionProvider>)
    /* Signed in as somebody else: his read is the second, and it fails. */
    rerender(
      <SessionProvider>
        <Panel mine={HERS} use={one.use} />
      </SessionProvider>,
    )
    await waitFor(() => expect(panel()).toContain('failed'))

    held.release(one.answer())
    await aMomentForTheOldAnswer()

    expect(panel(), 'the previous caller\'s answer reached the new caller').not.toContain(SECRET)
    expect(panel()).toContain('failed')
  })
})

describe('an answer that the cache dropped before it came', () => {
  it('is not handed to a reader that is showing a failure, and is not kept for the next reader', async () => {
    const held = holding()
    let calls = 0

    server = serverThat((path) => {
      if (path !== LEAGUES) {
        return null
      }

      calls += 1

      if (calls === 1) {
        return held.answer()
      }

      return calls === 2 ? answeredWith(500) : serving('Fresh')()
    })

    const { rerender } = render(<Reader name="leagues" label="X" />)

    await waitFor(() => expect(timesAsked(LEAGUES)).toBe(1))

    /* The visit drops the address while X's read is out, and the reader that comes next fails. */
    act(() => {
      clearResourceCache('leagues')
    })
    rerender(
      <>
        <Reader name="leagues" label="X" />
        <Reader name="leagues" label="Y" />
      </>,
    )
    await waitFor(() => expect(text('Y')).toContain('failed'))

    held.release(serving('Dropped')())
    await aMomentForTheOldAnswer()

    expect(text('Y'), 'an answer the cache had dropped reached a reader showing a failure').toContain('failed')

    /* And it was not put back into the cache: a reader that arrives now finds nothing there, asks the
       server, and reads what the server answers, not the answer that was dropped. */
    rerender(
      <>
        <Reader name="leagues" label="X" />
        <Reader name="leagues" label="Y" />
        <Reader name="leagues" label="Z" />
      </>,
    )
    await waitFor(() => expect(text('Z')).toContain('ready: Fresh'))
    expect(timesAsked(LEAGUES), 'a dropped answer was kept and read instead of asking').toBe(3)
    expect(text('Y')).toContain('ready: Fresh')
  })
})
