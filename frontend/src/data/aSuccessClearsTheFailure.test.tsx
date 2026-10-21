import { act, render, screen, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { answeredWith, serverThat } from '../test/serverAnswers'
import { setupUser } from '../test/user'
import { clearResourceCache, type ResourceName } from './client'
import { useResource, type ResourceState } from './useResource'

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
