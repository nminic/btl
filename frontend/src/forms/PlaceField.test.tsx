import { render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import type { Place } from '../data/places'
import { I18nProvider } from '../i18n/I18nProvider'
import { must } from '../test/at'
import { setupUser } from '../test/user'
import { PlaceField } from './PlaceField'

/**
 * The town somebody enters a race in.
 *
 * Two fields became one (owner, 10.08.2026): the codebook answers from the
 * second letter, the answer carries the country, and the country field is off
 * the form. What matters here is that the two values stay in step, that typing
 * still wins over the list, and that the list can be walked without a mouse.
 */

const CODEBOOK: Place[] = [
  ['Beograd', 'RS', 'Belgrade'],
  ['Beočin', 'RS'],
  ['Bern', 'CH'],
  ['Boston', 'US'],
]

/** The codebook as the portal fetches it. The list is a resource rather than an
 *  import, so a request is what these have to answer. */
function servingTheCodebook() {
  const real = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input).endsWith('/places.json')
      ? new Response(JSON.stringify(CODEBOOK), { status: 200 })
      : real(input)) as typeof fetch

  return () => {
    globalThis.fetch = real
  }
}

/** The field, kept by something, because a field that cannot hold what was typed
 *  cannot be typed into. */
function Holder({ onCountry }: { onCountry: (code: string) => void }) {
  const [town, setTown] = useState('')

  return (
    <I18nProvider locale="sr">
      <PlaceField
        id="mesto"
        name="city"
        value={town}
        invalid={false}
        describedBy={undefined}
        onChange={(next, country) => {
          setTown(next)
          onCountry(country)
        }}
      />
    </I18nProvider>
  )
}

function renderField() {
  const onCountry = vi.fn()
  render(<Holder onCountry={onCountry} />)

  return { onCountry, box: screen.getByRole('combobox') }
}

/** The offered towns, once they have arrived. The codebook is fetched on the
 *  second letter, so there is a moment where the right answer is "not yet". */
async function offered(): Promise<HTMLElement[]> {
  return within(await screen.findByRole('listbox')).getAllByRole('option')
}

describe('the town on a form', () => {
  let stop = () => {}

  beforeEach(() => {
    stop = servingTheCodebook()
  })

  afterEach(() => {
    stop()
  })

  it('offers nothing until the second letter, which is when the codebook is asked for', async () => {
    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'b')

    expect(box).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).toBeNull()

    await user.type(box, 'e')

    expect(await offered()).toHaveLength(3)
    expect(box).toHaveAttribute('aria-expanded', 'true')
  })

  it('says which country each town is in, which is the answer to "which Boston"', async () => {
    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'bos')

    expect(must((await offered())[0], 'the one town offered').textContent).toContain('(Sjedinjene')
  })

  it('writes the country of the town that was chosen', async () => {
    const user = setupUser()
    const { box, onCountry } = renderField()

    await user.type(box, 'beo')
    await user.click(must((await offered())[0], 'the first town offered'))

    expect(box).toHaveValue('Beograd')
    expect(onCountry).toHaveBeenLastCalledWith('RS')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('clears the country the moment the town is typed over', async () => {
    /* Left standing, an event in Beograd edited into Zagreb would be filed in
       Serbia, and nothing on the form would say so, because the country is no
       longer a field anybody looks at. */
    const user = setupUser()
    const { box, onCountry } = renderField()

    await user.type(box, 'beo')
    await user.click(must((await offered())[0], 'the first town offered'))
    await user.type(box, 'x')

    expect(onCountry).toHaveBeenLastCalledWith('')
  })

  it('takes a town the codebook has never heard of', async () => {
    /* A race is run in a hamlet of two hundred people. The suggestion is an
       offer, never a requirement. */
    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'Divčibare')

    expect(box).toHaveValue('Divčibare')
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull()
    })
  })

  it('is walked with the arrows and taken with Enter', async () => {
    const user = setupUser()
    const { box, onCountry } = renderField()

    await user.type(box, 'be')
    await offered()

    await user.keyboard('{ArrowDown}{ArrowDown}')
    /* The highlighted row is named rather than focused, so the keys go on
       reaching the box and a screen reader still reads the row. */
    expect(box).toHaveAttribute('aria-activedescendant', 'mesto-places-1')

    await user.keyboard('{Enter}')

    expect(box).toHaveValue('Beočin')
    expect(onCountry).toHaveBeenLastCalledWith('RS')
  })

  it('wraps at both ends, so the last row is one press up from the box', async () => {
    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'be')
    await offered()

    await user.keyboard('{ArrowUp}')
    expect(box).toHaveAttribute('aria-activedescendant', 'mesto-places-2')

    await user.keyboard('{ArrowDown}')
    expect(box).toHaveAttribute('aria-activedescendant', 'mesto-places-0')
  })

  it('walks back up a row at a time from the middle of the list', async () => {
    /* The wrap above only ever reaches the two ends, and a list that wrapped
       correctly and stepped wrongly would pass it. */
    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'be')
    await offered()

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}')

    expect(box).toHaveAttribute('aria-activedescendant', 'mesto-places-0')
  })

  it('closes on Escape and leaves what was typed alone', async () => {
    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'be')
    await offered()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(box).toHaveValue('be')
  })

  it('opens the list again with the down arrow, which is the way back from Escape', async () => {
    /* Closed, there is nothing to walk, and until this the only way back to the
       suggestions was to retype the town (WAI-ARIA 1.2, combobox: Down Arrow
       opens the listbox). */
    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'be')
    await offered()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()

    await user.keyboard('{ArrowDown}')

    expect(await offered()).toHaveLength(3)
    expect(box).toHaveValue('be')
  })

  it('does nothing on Enter while no row is highlighted, so the form can be submitted', async () => {
    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'be')
    await offered()

    await user.keyboard('{Enter}')

    expect(box).toHaveValue('be')
  })

  it('forgets which row was highlighted when the town is typed over', async () => {
    /* The list is about to be a different list, and the third row of it is not
       the row somebody was standing on: left where it was, Enter took a town
       nobody had looked at. */
    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'be')
    await offered()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(box).toHaveAttribute('aria-activedescendant', 'mesto-places-1')

    await user.type(box, 'o')

    expect(box).not.toHaveAttribute('aria-activedescendant')
  })

  it('is taken by a press of the mouse, and leaves the cursor in the box', async () => {
    /* Pointer down and not click, and the press kept off the box: a click is a
       press and a release, and anything that closes the list on the press
       leaves the release landing on whatever has moved under it. What holds it
       is where the cursor is afterwards, which a click would have taken away. */
    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'beo')
    const first = must((await offered())[0], 'the first town offered')

    await user.pointer({ target: first, keys: '[MouseLeft>]' })

    expect(box).toHaveValue('Beograd')
    expect(document.activeElement).toBe(box)
  })

  it('closes when something outside it is pressed', async () => {
    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'be')
    await offered()

    await user.click(document.body)

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull()
    })
  })

  it('leaves the field a plain box when the codebook cannot be fetched', async () => {
    /* Nothing is said about it: the person is typing a town they already know
       how to spell, and an error under the cursor would be noise about somebody
       else's problem. */
    stop()
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/places.json')
        ? new Response('', { status: 500 })
        : real(input)) as typeof fetch

    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'beo')

    expect(box).toHaveValue('beo')
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull()
    })

    globalThis.fetch = real
  })
})
