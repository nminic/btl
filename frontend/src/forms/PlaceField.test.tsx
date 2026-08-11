import { render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import type { Place } from '../data/places'
import { I18nProvider } from '../i18n/I18nProvider'
import { at, must } from '../test/at'
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
  /* A town in a code the list of countries has no name for. */
  ['Bardejov', 'ZZ'],
  /* And a name two countries share, which is the ordinary case rather than the
     odd one: seven hundred and thirty eight of them stand in the codebook. */
  ['London', 'GB'],
  ['London', 'US'],
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
  const [country, setCountry] = useState('RS')

  return (
    <I18nProvider locale="sr">
      <PlaceField
        id="mesto"
        name="city"
        value={town}
        country={country}
        invalid={false}
        describedBy={undefined}
        onChange={(next, chosen) => {
          setTown(next)
          setCountry(chosen)
          onCountry(chosen)
        }}
      />
    </I18nProvider>
  )
}

function renderField() {
  const onCountry = vi.fn()
  render(<Holder onCountry={onCountry} />)

  /* Two comboboxes stand in this field since 11.08.2026, the town and the
     country beside it, so the town is asked for by name. */
  return {
    onCountry,
    box: screen.getByRole('combobox', { name: '' }),
    country: screen.getByRole('combobox', { name: 'Država' }),
  }
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

  it('leaves the country standing when the town is typed over, since it is on screen', async () => {
    /* It used to be cleared here, back when the country was written and never
       shown and the danger was an event edited from Beograd into Zagreb and
       filed in Serbia with nothing saying so. The country is a control beside
       the town since 11.08.2026, so what stands there is what will be saved and
       whoever is typing can see it. */
    const user = setupUser()
    const { box, onCountry, country } = renderField()

    await user.type(box, 'beo')
    await user.click(must((await offered())[0], 'the first town offered'))
    await user.type(box, 'x')

    expect(onCountry).toHaveBeenLastCalledWith('RS')
    expect(country).toHaveValue('RS')
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

  it('keeps the name of the country control the same, held or not', async () => {
    /* The sentence saying why it is held stands outside the label. Inside it,
       everything in a label is the name of the control: the name changed with
       the state, and a reader was told the same words twice, once as the name
       and once as the description. */
    const user = setupUser()
    const { box } = renderField()

    expect(screen.getByRole('combobox', { name: 'Država' })).toBeInTheDocument()

    await user.type(box, 'ber')
    await user.click(within(await screen.findByRole('listbox')).getByText(/Bern/))

    const country = screen.getByRole('combobox', { name: 'Država' })

    expect(country).toHaveAttribute('aria-disabled', 'true')
    expect(country).toHaveAccessibleDescription('Mesto je iz šifarnika, pa državu nosi sa sobom.')
  })

  it('will not let the country of a town it recognises be changed', async () => {
    /* Owner, 11.08.2026: „ukoliko se mesto prepozna, država se ne može
       promeniti. Dropdown države je aktivan samo ukoliko je slobodan unos
       mesta." The country of a known town is then not an answer somebody gives
       but a fact about the town, and a control that lets it be contradicted is
       one that files a race in the wrong country. */
    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'ber')
    const list = await screen.findByRole('listbox')
    await user.click(within(list).getByText(/Bern/))

    const country = screen.getByRole('combobox', { name: 'Država' })

    expect(country).toHaveValue('CH')
    expect(country).toHaveAttribute('aria-disabled', 'true')
  })

  it('takes no answer while it is held, however it is reached', async () => {
    /* Held rather than switched off, so it is still reachable: the keyboard can
       land on it and the words that say why can be read. What it must not do is
       take an answer, by either road. A select left reachable still opens on a
       press and still walks with the arrows, so both are stopped. */
    const user = setupUser()
    const { onCountry, box } = renderField()

    await user.type(box, 'ber')
    await user.click(within(await screen.findByRole('listbox')).getByText(/Bern/))

    const country = screen.getByRole('combobox', { name: 'Država' })

    onCountry.mockClear()
    await user.selectOptions(country, 'US')
    await user.type(country, '{ArrowDown}')

    expect(country).toHaveValue('CH')
    expect(onCountry).not.toHaveBeenCalled()
  })

  it('opens it again for a town typed over the one it knew', async () => {
    /* A hamlet of two hundred people that no codebook of the world has heard of
       is entered by hand, and then the country is the only way to say where the
       race is run. */
    const user = setupUser()
    const { onCountry, box } = renderField()

    await user.type(box, 'ber')
    await user.click(within(await screen.findByRole('listbox')).getByText(/Bern/))
    await user.type(box, 'ovce')

    const country = screen.getByRole('combobox', { name: 'Država' })

    expect(country).not.toHaveAttribute('aria-disabled', 'true')

    /* And it answers, by the keyboard as well as by the pointer: what stops the
       keys while it is held must not stop them once it is not. */
    await user.selectOptions(country, 'HR')
    await user.type(country, '{ArrowDown}')

    expect(onCountry).toHaveBeenLastCalledWith('HR')
  })

  it('recognises a town spelt out in full, without the list being touched', async () => {
    /* Somebody who knows how a town is spelt types it and never looks down. The
       codebook holds one Bern, so the country is not a question, and the field
       has to reach the same answer it would have reached had the row been
       pressed. Bern rather than a Serbian town because the field starts on
       Serbia: a town whose country is the one already standing there would let
       this pass while nothing moved. */
    const user = setupUser()
    const { onCountry, box } = renderField()

    await user.type(box, 'Bern')

    const country = screen.getByRole('combobox', { name: 'Država' })

    await waitFor(() => {
      expect(country).toHaveValue('CH')
    })
    expect(country).toHaveAttribute('aria-disabled', 'true')
    expect(onCountry).toHaveBeenLastCalledWith('CH')
  })

  it('leaves the choice open for a name two countries share', async () => {
    /* „London" typed out says nothing about which London: the name recognises
       no one place, so nothing here may answer for the person. */
    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'London')

    expect(screen.getByRole('combobox', { name: 'Država' })).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('holds the country of the London that was pressed', async () => {
    /* Picking is not typing: the row that was pressed said which of the two it
       was, so it is recognised even though the name is shared. */
    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'lond')

    const list = await screen.findByRole('listbox')
    const rows = within(list).getAllByRole('option')

    await user.click(at(rows, 1))

    const country = screen.getByRole('combobox', { name: 'Država' })

    expect(country).toHaveValue('US')
    expect(country).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows the country it holds even where the list has no name for it', async () => {
    /* A select handed a value it has no option for draws nothing: the box goes
       blank while the record still says ZZ. Whoever is looking sees a filled
       town beside an empty country, answers what looks unanswered, and the race
       has quietly moved to another country. */
    const user = setupUser()
    const { onCountry, box } = renderField()

    await user.type(box, 'bar')
    const list = await screen.findByRole('listbox')
    await user.click(within(list).getByText(/Bardejov/))

    const country = screen.getByRole('combobox', { name: 'Država' })

    expect(onCountry).toHaveBeenLastCalledWith('ZZ')
    expect(country).toHaveValue('ZZ')
    /* The code itself, because there is no name for it and a code is not a
       country: what is unanswered is the list, not the record. */
    expect(country).toHaveTextContent('ZZ')
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
