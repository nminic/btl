import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor } from '../test/stylesheet'
import { bare } from '../test/sources'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  ['Bern', 'CH', 'Berne'],
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
      : real(input))

  return () => {
    globalThis.fetch = real
  }
}

/** The field, kept by something, because a field that cannot hold what was typed
 *  cannot be typed into. */
function Holder({
  onCountry,
  opensOn = { town: '', country: 'RS' },
  locked = false,
}: {
  onCountry: (code: string) => void
  /** What the field opens holding, for the record already written down. */
  opensOn?: { town: string; country: string }
  /** Held because the form around it is: a race chosen from the list fills the
   *  place in and the member may not move it. */
  locked?: boolean
}) {
  const [town, setTown] = useState(opensOn.town)
  const [country, setCountry] = useState(opensOn.country)

  return (
    <I18nProvider locale="sr">
      <PlaceField
        id="mesto"
        name="city"
        value={town}
        country={country}
        invalid={false}
        locked={locked}
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

function renderField(opensOn?: { town: string; country: string }, locked = false) {
  const onCountry = vi.fn()
  render(<Holder onCountry={onCountry} opensOn={opensOn} locked={locked} />)

  /* Two comboboxes stand in this field since 11.08.2026, the town and the
     country beside it, so the town is asked for by name. */
  return {
    onCountry,
    box: screen.getByRole('combobox', { name: '' }),
    country: screen.getByRole('combobox', { name: /^Država/ }),
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
    /* The name of the control does not move with its state. It never carried the
       reason: everything inside a label is the name, so a sentence put there
       changed the name with the state and a reader was told the same words twice,
       once as the name and once as the description.

       Since 23.08.2026 there is no sentence at all (owner: „Ne ispisuje se poruka
       Mesto je iz šifarnika, pa državu nosi sa sobom."), because it was drawn
       under the box and pushed the country out of line with the town beside it.
       What is left in its place is the rule on the town itself, which says the
       country comes with a town out of the codebook. */
    const user = setupUser()
    const { box } = renderField()

    expect(screen.getByRole('combobox', { name: /^Država/ })).toBeInTheDocument()

    await user.type(box, 'ber')
    await user.click(within(await screen.findByRole('listbox')).getByText(/Bern/))

    const country = screen.getByRole('combobox', { name: /^Država/ })

    expect(country).toBeDisabled()
    expect(country, 'the sentence is back, and with it the box moves').toHaveAccessibleDescription(
      '',
    )
    expect(screen.queryByText(/Mesto je iz šifarnika/)).toBeNull()
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

    const country = screen.getByRole('combobox', { name: /^Država/ })

    expect(country).toHaveValue('CH')
    expect(country).toBeDisabled()
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

    const country = screen.getByRole('combobox', { name: /^Država/ })

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

    const country = screen.getByRole('combobox', { name: /^Država/ })

    expect(country).not.toBeDisabled()

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

    const country = screen.getByRole('combobox', { name: /^Država/ })

    await waitFor(() => {
      expect(country).toHaveValue('CH')
    })
    expect(country).toBeDisabled()
    expect(onCountry).toHaveBeenLastCalledWith('CH')
  })

  it('recognises a town by its English name as well', async () => {
    /* The codebook carries both spellings and the portal searches both, because
       the keyboard does not change with the language of the page (data/places.ts).
       Recognition has to read the same list, or „Belgrade" typed out in full on
       the Serbian portal is a town the field has never heard of. Bern is Swiss,
       and the field opens on Serbia, so the country has somewhere to move to. */
    const user = setupUser()
    const { onCountry, box } = renderField()

    await user.type(box, 'Berne')

    const country = screen.getByRole('combobox', { name: /^Država/ })

    await waitFor(() => {
      expect(country).toHaveValue('CH')
    })
    expect(country).toBeDisabled()
    expect(onCountry).toHaveBeenLastCalledWith('CH')
  })

  it('leaves the choice open for a name two countries share', async () => {
    /* „London" typed out says nothing about which London: the name recognises
       no one place, so nothing here may answer for the person. */
    const user = setupUser()
    const { box } = renderField()

    await user.type(box, 'London')

    expect(screen.getByRole('combobox', { name: /^Država/ })).not.toBeDisabled()
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

    const country = screen.getByRole('combobox', { name: /^Država/ })

    expect(country).toHaveValue('US')
    expect(country).toBeDisabled()
  })

  it('fills a country the record has none of, without being touched', async () => {
    /* A record with a recognised town and no country at all is a hole rather
       than an answer, and filling a hole from the codebook is not rewriting
       anything. Left alone it was a dead end: the country was held shut on
       nothing, marked as the thing to fix, and refusing every press, so the form
       could not be sent and nothing on it could be changed to help. */
    const { onCountry } = renderField({ town: 'Bern', country: '' })

    const country = screen.getByRole('combobox', { name: /^Država/ })

    await waitFor(() => {
      expect(country).toHaveValue('CH')
    })
    expect(onCountry).toHaveBeenLastCalledWith('CH')
  })

  it('leaves alone a country the record already carries', async () => {
    /* And a record that says something is not corrected by the codebook behind
       whoever opened it: what was saved stands until somebody touches the town.
       Beograd is in the codebook as Serbian, and this record says Austria. */
    const { onCountry } = renderField({ town: 'Beograd', country: 'AT' })

    const country = screen.getByRole('combobox', { name: /^Država/ })

    /* Waited for by something that says the codebook has arrived, and not by the
       value itself: „AT" is what the field opens on, so a test that waits for it
       is answered before the first request goes out and would pass with no rule
       here at all. Recognising Beograd is what the arrival changes. */
    await waitFor(() => {
      expect(country).toBeDisabled()
    })

    expect(country).toHaveValue('AT')
    expect(onCountry).not.toHaveBeenCalled()
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

    const country = screen.getByRole('combobox', { name: /^Država/ })

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
        : real(input))

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

describe('the place on a form that is locked by the race chosen above it', () => {
  let stop = () => {}

  beforeEach(() => {
    stop = servingTheCodebook()
  })

  afterEach(() => {
    stop()
  })

  it('will not give up a town to the keyboard, which is the way past `readOnly`', async () => {
    /* „Odbijeno, ne ugašeno" is the portal's shape for a control that may not be
       answered, and it costs something: `disabled` would take the control out of
       the keyboard's path, so nobody reading by keyboard would ever be told why
       it cannot be answered. `readOnly` keeps it reachable and stops typing, and
       it stops nothing else.

       Measured by a review on 23.08.2026 with the keyboard alone: ArrowDown
       opened the list again, Enter took a town out of it, and the value went from
       „Be" to „Beocin" on a field the portal said was locked. A lock that is
       decoration is worse than none, which is what the same review said about the
       buttons of a choice. */
    const user = setupUser()
    const { box, onCountry } = renderField({ town: 'Be', country: 'RS' }, true)

    box.focus()
    /* Three presses and not one, so that the last two assertions measure something:
       one press only opens the list and leaves no row standing, so Enter after it
       writes nothing whether the lock is there or not. With three, the same walk
       gives „Beočin" in place of „Be", which is the scenario this case is named
       after.
     *
       The reason first written here was wrong and a review said so: the one press
       version did not pass with the lock taken out, because the assertion above
       about the list catches that on its own. What three presses buy is that the
       two below stop being decoration. */
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')

    expect(screen.queryByRole('listbox'), 'the list opened on a locked field').toBeNull()

    await user.keyboard('{Enter}')

    expect(box).toHaveValue('Be')
    expect(onCountry).not.toHaveBeenCalled()
  })

  it('will not give up a town to anything else that reaches it either', async () => {
    /* The half beneath the lock. `readOnly` is what a browser honours and this is
       what holds whatever else reaches the component, which is the same pair the
       form renderer keeps on every field it locks. Forced rather than typed,
       because `user.type` refuses a box that is not editable, and that refusal is
       the attribute doing its job rather than this guard. */
    const { box, onCountry } = renderField({ town: 'Be', country: 'RS' }, true)

    fireEvent.change(box, { target: { value: 'Beograd' } })

    expect(box).toHaveValue('Be')
    expect(onCountry).not.toHaveBeenCalled()
  })

  it('will not give up its country either, which was reachable and writing through', async () => {
    /* Two rules meet on this control and only one of them switched it off. A town
       from the codebook makes it `disabled`, which is the owner's own exception
       (23.08.2026); a form locked by the race above it leaves it reachable and
       merely told off, and until 28.08.2026 nothing under that refused anything.
       Measured by the same review: the country of a locked form changed by
       keyboard alone. */
    const { country, onCountry } = renderField({ town: 'Neko mesto', country: 'RS' }, true)

    expect(country).toHaveAttribute('aria-disabled', 'true')

    fireEvent.change(country, { target: { value: 'ME' } })

    expect(country).toHaveValue('RS')
    expect(onCountry).not.toHaveBeenCalled()
  })

  it('wears the dress the portal keeps for a control that will not answer', () => {
    /* The portal has one (`.field__control--held`) and four locked fields wore
       nothing at all. Measured by a review on 23.08.2026 by comparing computed
       styles: with `disabled` there had been exactly one visible difference, the
       cursor, and the change to `aria-disabled` took it away without putting
       anything in its place. A control that refuses and looks willing is a
       question the reader answers twice. */
    const { box, country } = renderField({ town: 'Neko mesto', country: 'RS' }, true)

    expect(box).toHaveClass('field__control--held')
    expect(country).toHaveClass('field__control--held')
  })

  it('leaves a field that is not held carrying no such word at all', () => {
    /* `undefined` and not `false`. Written as a bare boolean it put
       `aria-disabled="false"` on every live country select on the portal, and ADL
       records that same attribute once making five live buttons of the price list
       read as refused. Nothing on the portal matches a bare `[aria-disabled]`
       today, so the trap was set and had not gone off. */
    const { box, country } = renderField({ town: 'Neko mesto', country: 'RS' })

    expect(box).not.toHaveAttribute('aria-disabled')
    expect(country).not.toHaveAttribute('aria-disabled')
    expect(box).not.toHaveClass('field__control--held')
    expect(country).not.toHaveClass('field__control--held')
  })
})

describe('a lock that arrives while the list of towns is standing', () => {
  let stop = () => {}

  beforeEach(() => {
    stop = servingTheCodebook()
  })

  afterEach(() => {
    stop()
  })

  /** The field with a lock that can be turned while it stands, which is the only
   *  way to reach the state this is about: the list is opened by typing, and a
   *  locked field cannot be typed into. */
  function Turning() {
    const [locked, setLocked] = useState(false)
    const [town, setTown] = useState('Be')
    const [country, setCountry] = useState('RS')

    return (
      <I18nProvider locale="sr">
        <div
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              outerSawEscape()
            }
          }}
        >
          <button
            type="button"
            onClick={() => {
              setLocked(true)
            }}
          >
            izaberi trku
          </button>
          <PlaceField
            id="mesto"
            name="city"
            value={town}
            country={country}
            invalid={false}
            locked={locked}
            describedBy={undefined}
            onChange={(next, chosen) => {
              setTown(next)
              setCountry(chosen)
            }}
          />
        </div>
      </I18nProvider>
    )
  }

  const outerSawEscape = vi.fn()

  beforeEach(() => {
    outerSawEscape.mockClear()
  })

  it('will not give up the town to a press on a row of it', async () => {
    /* The fourth road in, and the only one a pointer takes. Three were shut and
       this was left open, which is the same fault in miniature: the lock was
       counted rather than the ways past it. Measured by a review on 28.08.2026:
       the field wearing `aria-disabled="true"` took „Beocin" in place of „Be". */
    const user = setupUser()

    render(<Turning />)

    const box = screen.getByRole('combobox', { name: '' })

    await user.type(box, 'o')

    const row = within(await screen.findByRole('listbox')).getAllByRole('option')[0]

    fireEvent.click(screen.getByRole('button', { name: 'izaberi trku' }))

    expect(box).toHaveAttribute('aria-disabled', 'true')

    fireEvent.mouseDown(must(row, 'a town on offer'))

    expect(box).toHaveValue('Beo')
  })

  it('still answers Escape, which is the one press that writes nothing', async () => {
    /* The first version of the lock refused every press, Escape with the rest, and
       a list left standing over a field locked under it then had no keyboard
       dismissal at all: WAI-ARIA 1.2 asks every combobox for one, and the rows of
       that list are live (the case above). Worse, the press went on to whatever
       ancestor was listening for it, of which the portal has four
       (`Dropdown`, `FieldHint`, `DatePicker`, `EditableCell`), so one Escape shut
       whatever the field was standing inside. */
    const user = setupUser()

    render(<Turning />)

    const box = screen.getByRole('combobox', { name: '' })

    await user.type(box, 'o')
    await screen.findByRole('listbox')

    fireEvent.click(screen.getByRole('button', { name: 'izaberi trku' }))

    box.focus()
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox'), 'escape left the list standing').toBeNull()
    expect(outerSawEscape, 'the press went on to whatever stands around it').not.toHaveBeenCalled()
  })
})

describe('what the portal’s dress for a held control actually says', () => {
  it('is a rule with a home, and not only a name on an element', () => {
    /* The case further up asks that the class is on the element, and the class
       name is written by hand in both places. That is half a guard: measured by a
       review on 28.08.2026 by renaming the rule in the stylesheet alone, all 2229
       tests stayed green while a locked field went back to looking exactly like a
       live one, down to the same background and the same text cursor.

       So the rule itself is read. Two declarations and no more: what makes a held
       control tell a reader it will not answer is that it is shaded and that the
       pointer stops promising an answer over it. */
    const held = ruleFor(
      readFileSync(join(process.cwd(), 'src/forms/PlaceField.css'), 'utf-8'),
      '.field__control--held',
      'PlaceField.css',
    )

    expect(held.background).toBe('var(--surface-hover)')
    expect(held.cursor).toBe('default')
  })

  it('reaches the fields a chosen race fills in, which is where they live', () => {
    /* `PlaceField` is not one of them. No form on the portal locks it today, and
       the fields a race really does lock are drawn by the renderer of forms from
       one shared set of properties. Measured by a review on 28.08.2026 in Chrome
       over the built stylesheet: the difference between the whole computed style
       of a field locked there and a live one was the empty set.

       **Three of the four**, and the fourth is written down rather than reached
       across for: the date is drawn by `forms/DatePicker.tsx`, which writes its
       own class and never sees this object, and that file is held by another
       change (`btl-produkt/PENDING.md`).

       Read off the renderer's source, because a screen that locks those fields is
       a flow of its own and this file is about the place. */
    const renderer = readFileSync(join(process.cwd(), 'src/forms/FormRenderer.tsx'), 'utf-8')

    expect(bare(renderer)).toContain("locked ? 'field__control field__control--held' : 'field__control'")
  })
})

describe('a locked place whose country the codebook could fill in', () => {
  let stop = () => {}

  beforeEach(() => {
    stop = servingTheCodebook()
  })

  afterEach(() => {
    stop()
  })

  /** A held field and a live one side by side, each with its own record.
   *
   *  Two rather than one, and it is the whole of what makes this measurable: the
   *  write being guarded happens without a press, a turn after the codebook
   *  arrives, so „it has not written" is true of any moment before that whether
   *  the guard is there or not. Measured on 28.08.2026: the first version of this
   *  waited for the town to be in its box, which is true at once, and passed with
   *  the guard taken out. The live twin says when the turn has come. */
  function Pair() {
    const [heldTown, setHeldTown] = useState('Beograd')
    const [heldCountry, setHeldCountry] = useState('')
    const [liveTown, setLiveTown] = useState('Beograd')
    const [liveCountry, setLiveCountry] = useState('')

    return (
      <I18nProvider locale="sr">
        <PlaceField
          id="drzano"
          name="drzano"
          value={heldTown}
          country={heldCountry}
          invalid={false}
          locked
          describedBy={undefined}
          onChange={(next, chosen) => {
            setHeldTown(next)
            setHeldCountry(chosen)
          }}
        />
        <PlaceField
          id="zivo"
          name="zivo"
          value={liveTown}
          country={liveCountry}
          invalid={false}
          describedBy={undefined}
          onChange={(next, chosen) => {
            setLiveTown(next)
            setLiveCountry(chosen)
          }}
        />
      </I18nProvider>
    )
  }

  it('still has its country filled in, because that write is the portal’s', async () => {
    /* The one write in this file that goes through a held field, and it was put
       behind the lock for a few hours on 28.08.2026 before a review measured what
       that did.
     *
       The lock says what the **reader** may not change. This is not a reader
       answering a control: it is the portal writing down a fact about the town, in
       the same breath as the four fields a chosen race fills in, of which the
       renderer of forms says that they „are not refused at all. They are filled by
       the portal from the race".
     *
       Behind the lock it made exactly one thing happen, and it was a dead end: the
       country stayed empty, the select was natively switched off because the town
       is recognised, and the form refused with „Popravi ova polja: Država" over a
       control nobody on the screen could answer.
     *
       Measured against the live twin, so what is asserted is that both arrive, and
       not merely that the assertion was made before either did. */
    render(<Pair />)

    const countries = () => screen.getAllByRole('combobox', { name: /^Država/ })

    await waitFor(() => {
      expect(must(countries()[1], 'the live country')).toHaveValue('RS')
    })

    expect(must(countries()[0], 'the held country')).toHaveValue('RS')
  })

})

describe('a place that is locked over what somebody was already typing in', () => {
  let stop = () => {}

  beforeEach(() => {
    stop = servingTheCodebook()
  })

  afterEach(() => {
    stop()
  })

  /** A live place that a press turns into a held one carrying a chosen entry:
   *  a town the codebook knows and a country that disagrees with it. */
  function Arriving() {
    const [locked, setLocked] = useState(false)
    const [town, setTown] = useState('Ne')
    const [country, setCountry] = useState('AT')

    return (
      <I18nProvider locale="sr">
        <button
          type="button"
          onClick={() => {
            setLocked(true)
            setTown('Beograd')
            setCountry('AT')
          }}
        >
          izaberi trku
        </button>
        <PlaceField
          id="mesto"
          name="city"
          value={town}
          country={country}
          invalid={false}
          locked={locked}
          describedBy={undefined}
          onChange={(next, chosen) => {
            setTown(next)
            setCountry(chosen)
          }}
        />
      </I18nProvider>
    )
  }

  it('keeps the country the record came with, rather than the codebook’s', async () => {
    /* The half a flat absence of a lock got wrong. Measured by a review on
       28.08.2026: type into a live place, so it counts as touched, then choose an
       entry above that locks it and fills in „Beograd" with the country „AT". The
       country came out „RS", the select was natively switched off because the town
       is recognised, and the record saved as Serbian though the entry said
       Austrian.

       „Where the codebook disagrees with what was saved, what was saved stands"
       is the rule this field already carries, and the early return that used to
       enforce it asks whether the field has been touched, which stops being the
       right question the moment a lock arrives over a field somebody has been
       typing in. */
    const user = setupUser()

    render(<Arriving />)

    const box = screen.getByRole('combobox', { name: '' })

    await user.type(box, 'k')

    fireEvent.click(screen.getByRole('button', { name: 'izaberi trku' }))

    const country = screen.getByRole('combobox', { name: /^Država/ })

    await waitFor(() => {
      expect(box).toHaveValue('Beograd')
    })

    expect(box).toHaveAttribute('aria-disabled', 'true')
    expect(country).toHaveValue('AT')
  })
})
