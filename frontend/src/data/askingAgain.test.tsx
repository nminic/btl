import { act, render, screen, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { answeredWith, serverThat } from '../test/serverAnswers'
import { setupUser } from '../test/user'
import type { ResourceName } from './client'
import { useResource, type ResourceState } from './useResource'

/**
 * A READER THAT FAILED AND IS ASKED AGAIN (decision of 02.10.2026, PENDING stavka 368, in the words
 * of the PDL's record of it and not the owner's: „Spisak koji ne moze da se ucita KAZE to, umesto da
 * izgleda prazan, uz dugme „Pokusaj ponovo"").
 *
 * <p>The hook's half of it, held against a real data layer and a server that answers what the case
 * says: `components/Resource.test.tsx` holds what the button does with a state it is handed, and
 * `pages/resourceAsksAgain.test.tsx` holds what a real screen does around it. What only the hook can
 * answer is who is asked and how many times the server is.
 *
 * <p><b>The axes are the answer</b> (it comes back, it comes back the same, it is still on its way),
 * <b>how many readers there are</b> (one; several that failed together; one that failed and one that
 * already holds the answer; two that read different addresses) <b>and what the reader is on</b> (the
 * address it first had and the address it is on now, which is the one name that changes under a
 * reader, `pages`, when the language does).
 *
 * <p>The server is held by the address and by nothing else, so every count below is of what the
 * portal ASKED and not of what it drew: a reader that drew the right words by reading something it
 * already held would pass a case about the words and fail the one about the count.
 */

const LISTS = '/api/leagues'
const OTHER = '/api/moderators'

type Answer = () => Response | Promise<Response>

/** What each address answers right now, which a case may change while it runs. */
let answers = new Map<string, Answer>()
let server: { asked: { path: string }[]; stop: () => void } | null = null

const failing = (status: number): Answer => () => answeredWith(status)
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
const serving =
  (...rows: string[]) =>
  (): Response =>
    new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } })

function theServerAnswers(who: Record<string, Answer>) {
  answers = new Map(Object.entries(who))
  server = serverThat((path) => answers.get(path)?.() ?? null)
}

/** How many times the portal asked for an address. */
const timesAsked = (path: string) =>
  (server?.asked ?? []).filter((one) => one.path === path).length

afterEach(() => {
  server?.stop()
  server = null
})

/** What a state says in words a case can read. A new failure has a different message from the one
 *  before it, so „failed again" and „still the old failure" are two different texts. */
function words(state: ResourceState<string[]>): string {
  if (state.status === 'loading') {
    return 'loading'
  }

  if (state.status === 'ready') {
    return `ready: ${state.data.join(',')}`
  }

  return `${state.reading ? 'asking again' : 'failed'}: ${state.error.message}`
}

/**
 * One reader of one address, drawn the way a screen would draw it: what it says, a button that asks
 * again while there is a failure to ask about, and how many different states it has been handed.
 *
 * <p>That last number is how a case tells a reader that was ASKED from one that was left alone: a
 * state is a new object every time a reader is told anything, so a reader that holds an answer and
 * is woken anyway has been handed one more than it should have been, with the same words on screen.
 */
function Reader({
  name,
  language,
  label,
}: {
  name: ResourceName
  language?: string
  label: string
}) {
  const state = useResource<string[]>(name, { language })
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

describe('a reader that failed, asked again', () => {
  it('reads again and draws what arrives when the server answers this time', async () => {
    theServerAnswers({ [LISTS]: failing(500) })

    render(<Reader name="leagues" label="A" />)
    await waitFor(() => expect(text('A')).toContain('failed: Cannot load leagues: 500'))

    answers.set(LISTS, serving('Liga'))
    await setupUser().click(ask('A'))

    await waitFor(() => expect(text('A')).toContain('ready: Liga'))
    expect(timesAsked(LISTS), 'once for the first read and once for the asking again').toBe(2)
  })

  it('says it is asking while the request is out, and says it failed again, with the asking over', async () => {
    theServerAnswers({ [LISTS]: failing(500) })

    render(<Reader name="leagues" label="A" />)
    await waitFor(() => expect(text('A')).toContain('failed: Cannot load leagues: 500'))

    const held = holding()

    answers.set(LISTS, held.answer)
    await setupUser().click(ask('A'))

    await waitFor(() => expect(text('A')).toContain('asking again'))
    /* Still the first failure's words: asking again is not an answer. */
    expect(text('A')).toContain('Cannot load leagues: 500')

    act(() => {
      held.release(answeredWith(503))
    })

    /* The second failure is ITS OWN state, with its own words and the asking over. A state that
       carried the first one's flag across would go on saying it was asking for ever. */
    await waitFor(() => expect(text('A')).toContain('failed: Cannot load leagues: 503'))
    expect(text('A')).not.toContain('asking again')
  })

  it('asks the server once, however many times it is told before the answer comes', async () => {
    theServerAnswers({ [LISTS]: failing(500) })

    render(<Reader name="leagues" label="A" />)
    await waitFor(() => expect(text('A')).toContain('failed'))

    const held = holding()

    answers.set(LISTS, held.answer)

    const user = setupUser()

    await user.click(ask('A'))
    await waitFor(() => expect(text('A')).toContain('asking again'))
    await user.click(ask('A'))

    expect(timesAsked(LISTS), 'a second asking went to the server while the first was out').toBe(2)

    act(() => {
      held.release(serving('Liga')())
    })
    await waitFor(() => expect(text('A')).toContain('ready: Liga'))
  })
})

describe('a failure that is on more than one reader', () => {
  it('is asked again for every reader of the address that is showing it, and the server is asked once', async () => {
    theServerAnswers({ [LISTS]: failing(500) })

    render(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="leagues" label="B" />
      </>,
    )
    await waitFor(() => expect(text('A')).toContain('failed'))
    await waitFor(() => expect(text('B')).toContain('failed'))
    expect(timesAsked(LISTS), 'two readers at once share one request').toBe(1)

    const held = holding()

    answers.set(LISTS, held.answer)
    await setupUser().click(ask('A'))

    /* The reader whose button was not pressed is told as well, and says so while the request is
       out: a neighbour left saying „cannot be read" beside a screen that has just read it is a
       sentence that lies. */
    await waitFor(() => expect(text('A')).toContain('asking again'))
    await waitFor(() => expect(text('B')).toContain('asking again'))

    act(() => {
      held.release(serving('Liga')())
    })

    await waitFor(() => expect(text('A')).toContain('ready: Liga'))
    await waitFor(() => expect(text('B')).toContain('ready: Liga'))
    expect(timesAsked(LISTS), 'one asking again for the two of them').toBe(2)
  })

  it('does not ask a reader that already holds the answer, and does not ask the server for it', async () => {
    theServerAnswers({ [LISTS]: failing(500) })

    const { rerender } = render(<Reader name="leagues" label="A" />)
    await waitFor(() => expect(text('A')).toContain('failed'))

    /* The server is back, and a reader that arrives now reads the answer. A is still showing the
       failure it had: nothing told it. */
    answers.set(LISTS, serving('Liga'))
    rerender(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="leagues" label="B" />
      </>,
    )
    await waitFor(() => expect(text('B')).toContain('ready: Liga'))
    expect(text('A')).toContain('failed')

    const handed = text('B')

    await setupUser().click(ask('A'))

    await waitFor(() => expect(text('A')).toContain('ready: Liga'))
    expect(text('B'), 'a reader that held the answer was handed another state').toBe(handed)
    expect(timesAsked(LISTS), 'A read what B had already read, and asked nobody').toBe(2)
  })

  it('does not ask a reader of another address', async () => {
    theServerAnswers({ [LISTS]: failing(500), [OTHER]: failing(500) })

    render(
      <>
        <Reader name="leagues" label="A" />
        <Reader name="moderators" label="B" />
      </>,
    )
    await waitFor(() => expect(text('A')).toContain('failed'))
    await waitFor(() => expect(text('B')).toContain('failed'))

    answers.set(LISTS, serving('Liga'))
    await setupUser().click(ask('A'))

    await waitFor(() => expect(text('A')).toContain('ready: Liga'))
    expect(text('B'), 'the other address was told to read again').toContain('failed')
    expect(timesAsked(OTHER)).toBe(1)
  })
})

describe('a reader whose address changes under it', () => {
  const SR = '/api/pages?lang=sr'
  const EN = '/api/pages?lang=en'

  it('asks again for the address it is on now and not for the one it first had', async () => {
    theServerAnswers({ [SR]: failing(500), [EN]: failing(500) })

    const { rerender } = render(<Reader name="pages" language="sr" label="P" />)
    await waitFor(() => expect(text('P')).toContain('failed'))

    rerender(<Reader name="pages" language="en" label="P" />)
    await waitFor(() => expect(timesAsked(EN)).toBe(1))
    await waitFor(() => expect(text('P')).toContain('failed'))

    answers.set(EN, serving('English'))
    await setupUser().click(ask('P'))

    await waitFor(() => expect(text('P')).toContain('ready: English'))
    expect(timesAsked(EN)).toBe(2)
    expect(timesAsked(SR), 'it went back to the language it had left').toBe(1)
  })

  it('draws what the address it is on now answers, and not an answer that lands late for the one it left', async () => {
    theServerAnswers({ [SR]: failing(500), [EN]: failing(500) })

    const { rerender } = render(<Reader name="pages" language="sr" label="P" />)
    await waitFor(() => expect(text('P')).toContain('failed'))

    const held = holding()

    answers.set(SR, held.answer)
    await setupUser().click(ask('P'))
    await waitFor(() => expect(text('P')).toContain('asking again'))

    /* The reader moves on while the request for the language it left is still out, and the new
       address answers. */
    answers.set(EN, serving('fresh'))
    rerender(<Reader name="pages" language="en" label="P" />)
    await waitFor(() => expect(text('P')).toContain('ready: fresh'))

    act(() => {
      held.release(serving('stale')())
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(text('P'), 'an answer for the address it had left won').toContain('ready: fresh')
  })
})
