import { screen, within } from '@testing-library/react'
import { useSession } from '../session/useSession'
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
 * word travels: reporting a result writes the race's kind into the submission, so
 * an unknown word would be filed against the result and read again by whoever
 * decides on it.
 */

/** What the session was told, for a value no screen a member reaches draws. */
function Sent() {
  const { submissions } = useSession()

  return (
    <ul aria-label="sent">
      {submissions.map((one) => (
        <li key={one.id}>{`${one.raceId} | ${one.raceKind} | ${one.distanceKm}`}</li>
      ))}
    </ul>
  )
}

/** The event and race the sweep of every address already reports from. */
const EVENT = 'fruskogorski-maraton-2010'
const RACE = 'evt-fruskogorski-maraton-2010-05-08-5768'

/** The generated races, with that one race carrying a word from nowhere. */
async function withOddKind(served: typeof globalThis.fetch, input: RequestInfo | URL) {
  const answer = await served(input)
  const races: { id: string; kind: string }[] = await answer.json()

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
    renderAt(`/sr/kalendar/${EVENT}/prijava?trka=${RACE}`, 'competitor', '000002')

    expect(await screen.findByRole('heading', { level: 1, name: /Prijava rezultata/ })).toBeVisible()
    expect(screen.getByLabelText(/^Sati/)).toBeVisible()
    expect(screen.queryByLabelText(/^Dužina/)).toBeNull()
  })

  it('is filed as a race of a length, so the word reaches nothing that reads it later', async () => {
    /* The submission carries the kind, and whoever decides on it reads that word
       again (`admin/ReviewQueue.tsx`, which asks its own `raceKind` of it for the
       same reason). Written raw, „ludilo" would be filed against a real result and
       handed on.

       Read off the session rather than off a screen, because no screen a member can
       reach draws the kind of a result they have just sent. Same shape as
       `test/decided.tsx`, which exists for exactly that. */
    const user = setupUser()

    renderAt(
      `/sr/kalendar/${EVENT}/prijava?trka=${RACE}`,
      'competitor',
      '000002',
      undefined,
      null,
      <Sent />,
    )

    await user.type(await screen.findByLabelText(/^Sati/), '3')
    await user.type(screen.getByLabelText(/^Minuta/), '12')
    await user.type(screen.getByLabelText(/^Sekundi/), '5')
    await user.type(screen.getByLabelText(/^Link ka zvani/), 'https://primer.rs/rezultat')
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

    const sent = within(await screen.findByRole('list', { name: 'sent' }))

    /* The kind, and the length filed beside it. Both readings of the word are held
       from here: `ReportResult.tsx` made raw fails both cases in this file, and
       `reportedResult.ts` made raw fails this one — a race of a length answers for
       its own distance, so the other branch reads boxes the form never drew and files
       `NaN` in place of 57.68 (measured 05.09.2026).

       **Asked as a whole line and not as a pattern.** The first draft asked
       ``new RegExp(`^${RACE} \| length \| 57.68$`)``, and in a template literal
       „\|" is not an escaped pipe but a pipe: the pattern became three alternatives
       and matched the id alone, so it passed with the length unread. The lint rule
       that names it is a warning, not the gate. */
    expect(sent.getByText(`${RACE} | length | 57.68`)).toBeVisible()
    expect(sent.queryByText(/ludilo/)).toBeNull()
  })
})
