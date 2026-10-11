import { screen } from '@testing-library/react'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

/**
 * A race carrying a word that is not one of the three kinds, on the screens that
 * read it.
 *
 * `raceKind` has a guard of its own (`raceKind.test.ts`) and it holds the reading:
 * anything but the three is a race of a length. What had no guard is that the
 * screens go through it. **Every one of the 1612 races in the generated file is
 * `length`**, so a screen that read `race.kind` raw would draw exactly the same
 * thing as one that reads it through `raceKind`, and the whole gate would stay
 * green either way (review, 31.08.2026).
 *
 * So the file is served with one race changed, which is the shape
 * `adminEventKind.test.tsx` already uses for a resource that has to answer
 * something the generated data does not.
 *
 * **Why it matters and is not a curiosity.** The word chooses between things
 * written one per kind — the form to ask for, the sentence to say — and a lookup
 * with a word that is not there gives `undefined`, which takes the screen down to
 * the error boundary. It was measured doing exactly that on 30.08.2026. And the
 * word decides what is sent: which of the figures come off the race and which off the
 * boxes is chosen by it (`reportedResult.ts`).
 */

/** The event and race the sweep of every address already reports from. */
const EVENT = 'fruskogorski-maraton-2010'
const RACE = 396

/** The generated races, with that one race carrying a word from nowhere. */
async function withOddKind(served: typeof globalThis.fetch, input: RequestInfo | URL) {
  const answer = await served(input)
  const races: { id: number; kind: string }[] = await answer.json()

  const odd = races.map((one) => (one.id === RACE ? { ...one, kind: 'ludilo' } : one))

  /* **That the substitution reached something, said here.** Everything this file
     claims rests on one race carrying a word from nowhere, and every one of those
     claims is also true of a race of a length left alone: the whole point is that the
     two look identical on screen. So a fixture that hit nothing — the id renamed, the
     field renamed, the address no longer matching — would leave both cases green over
     untouched data, which is the very blindness this file exists to end, moved one
     level up into its own fixture (review, 05.09.2026).

     Counted rather than merely found, because two races of that id would mean the
     generated file has changed under this in a way that makes „the one race" a
     sentence about nothing. */
  expect(
    odd.filter((one) => one.kind === 'ludilo'),
    'the race this file serves with a kind from nowhere',
  ).toHaveLength(1)

  return new Response(JSON.stringify(odd), {
    headers: { 'content-type': 'application/json' },
  })
}

describe('a race whose kind is a word the portal does not know', () => {
  let served: typeof globalThis.fetch

  beforeEach(() => {
    served = globalThis.fetch
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('races') ? withOddKind(served, input) : served(input, init),
    )
  })

  afterEach(() => {
    vi.stubGlobal('fetch', served)
  })

  it('is reported on as a race of a length, rather than taking the screen down', async () => {
    /* The form of a race of a length is the one that does not ask for a distance,
       because the race fixes it. A word that is not one of the three would give
       `undefined` where the form is chosen, and this screen would be the error
       boundary instead. */
    renderAt(`/sr/kalendar/${EVENT}/prijava?trka=${String(RACE)}`, 'competitor', '000002')

    expect(await screen.findByRole('heading', { level: 1, name: /Prijava rezultata/ })).toBeVisible()
    expect(screen.getByLabelText(/^Sati/)).toBeVisible()
    expect(screen.queryByLabelText(/^Dužina/)).toBeNull()
  })

  it('is sent as a race of a length, so the race answers for its own distance', async () => {
    /* Since R2 of the results flows the kind itself is not sent from this road at all: the
       run goes to `POST /api/results` as the race's id and the four figures, and the server
       knows the race's kind. What the word still decides is WHICH figures this screen sends,
       and read raw it chooses the branch that reads boxes the form never drew, so the length
       goes as `NaN` in place of 57.68 (`reportedResult.ts` made raw, measured 05.09.2026).

       Read off the request, because no screen a member can reach draws what he has just sent
       until the server answers it back. */
    const user = setupUser()
    const sent: string[] = []
    const inner = globalThis.fetch

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/results' && init?.method === 'POST') {
        sent.push(String(init.body))
      }

      return inner(input, init)
    })

    renderAt(`/sr/kalendar/${EVENT}/prijava?trka=${String(RACE)}`, 'competitor', '000002')

    await user.type(await screen.findByLabelText(/^Sati/), '3')
    await user.type(screen.getByLabelText(/^Minuta/), '12')
    await user.type(screen.getByLabelText(/^Sekundi/), '5')
    await user.type(screen.getByLabelText(/^Link ka zvani/), 'https://primer.rs/rezultat')
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

    await screen.findByRole('heading', { name: 'Rezultat je poslat' })

    /* The race and the length beside it, as one record: both readings of the word are held
       from here, `ReportResult.tsx` made raw failing the case above and `reportedResult.ts`
       made raw failing this one. */
    expect(sent).toHaveLength(1)
    expect(JSON.parse(sent[0] ?? '{}')).toMatchObject({ raceId: RACE, distanceKm: 57.68 })
    expect(sent[0]).not.toMatch(/ludilo/)
  })
})
