import { must } from '../test/at'
import { useState } from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithI18n } from '../test/render'
import { setupUser } from '../test/user'
import registracija from './definitions/registracija.form.json'
import { FormRenderer } from './FormRenderer'
import type { FormDef, FormValues } from './types'

/* A caller may hand the renderer a different definition without remounting it.
 * No screen does today, and every one of the seven admin screens passes a
 * module-level constant, and the races inside an event hold theirs across
 * renders (EventRaces), so this is a contract of the component rather than a
 * path anybody walks. It is held anyway, because the fault it guards is not the
 * empty box: a field the state is not holding used to be saved as the string
 * "undefined", since `textFrom` in records.ts is `String(value)`. Blank on
 * screen and a word in the record is worse than the fault it replaced. */
const grown: FormDef = {
  id: 'proba',
  titleKey: 'proba.naslov',
  submitKey: 'form.submit',
  fields: [
    { name: 'ime', type: 'text', labelKey: 'proba.ime', required: true },
    { name: 'dopisano', type: 'text', labelKey: 'proba.dopisano' },
  ],
}

const everyType: FormDef = {
  id: 'proba',
  titleKey: 'proba.naslov',
  submitKey: 'form.submit',
  fields: [
    { name: 'ime', type: 'text', labelKey: 'proba.ime', required: true },
    { name: 'mejl', type: 'email', labelKey: 'proba.mejl', hintKey: 'proba.mejlPravilo' },
    { name: 'datum', type: 'date', labelKey: 'proba.datum' },
    { name: 'lozinka', type: 'password', labelKey: 'proba.lozinka' },
    { name: 'broj', type: 'number', labelKey: 'proba.broj', min: 1 },
    {
      name: 'pol',
      type: 'select',
      labelKey: 'proba.pol',
      options: [{ value: 'M', labelKey: 'proba.muski' }],
    },
    // A select whose options were left out of the definition: it must render
    // as an empty list, not crash the screen.
    { name: 'prazan', type: 'select', labelKey: 'proba.prazan' },
    { name: 'beleska', type: 'textarea', labelKey: 'proba.beleska' },
    /* A town, with no rule written beside it. The one place field the portal
       has does carry a rule, so without this the field is only ever drawn the
       one way and the case where it describes itself by nothing is never
       walked. */
    { name: 'mesto', type: 'place', labelKey: 'proba.mesto' },
    { name: 'saglasnost', type: 'checkbox', labelKey: 'proba.saglasnost', required: true },
  ],
}

describe('FormRenderer', () => {
  it('renders every supported field type', () => {
    renderWithI18n(<FormRenderer form={everyType} onSubmit={vi.fn()} />)

    // Unknown keys fall back to the key itself, which is exactly what makes a
    // missing translation visible instead of silent.
    expect(screen.getByLabelText(/proba.ime/)).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText(/proba.mejl/)).toHaveAttribute('type', 'email')
    // A date is a text field on purpose: the native one follows the browser
    // locale, so it would show mm/dd/yyyy to an English browser.
    expect(screen.getByLabelText(/proba.datum/)).toHaveAttribute('placeholder', 'dd/mm/gggg')
    expect(screen.getByLabelText(/proba.broj/)).toHaveAttribute('type', 'number')
    expect(screen.getByLabelText(/proba.pol/).tagName).toBe('SELECT')
    expect(screen.getByLabelText(/proba.prazan/).children).toHaveLength(1)
    expect(screen.getAllByRole('option', { name: 'Izaberi' })).toHaveLength(2)
    expect(screen.getByLabelText(/proba.beleska/).tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText(/proba.saglasnost/)).toHaveAttribute('type', 'checkbox')
    expect(screen.getByLabelText(/proba.lozinka/)).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText(/proba.mesto/)).toHaveAttribute('role', 'combobox')
    /* And it says it describes itself by nothing, rather than by the empty
       string: `aria-describedby=""` points a screen reader at an element with
       no id, which is not the same as pointing it nowhere. */
    expect(screen.getByLabelText(/proba.mesto/)).not.toHaveAttribute('aria-describedby')
  })

  it('puts the rule next to the field it belongs to', () => {
    renderWithI18n(<FormRenderer form={everyType} onSubmit={vi.fn()} />)

    const input = screen.getByLabelText(/proba.mejl/)
    const hintId = input.getAttribute('aria-describedby')

    expect(hintId).toBe('field-mejl-hint')
    expect(
      document.getElementById(must(hintId, 'an id joining the field to its hint')),
    ).toHaveTextContent('proba.mejlPravilo')
  })

  it('marks the fields that are not obligatory', () => {
    renderWithI18n(<FormRenderer form={everyType} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText(/proba.datum \(neobavezno\)/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/proba.ime \(neobavezno\)/)).not.toBeInTheDocument()
  })

  it('refuses to submit a broken form and describes each error', async () => {
    const user = setupUser()
    const onSubmit = vi.fn()
    renderWithI18n(<FormRenderer form={everyType} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getAllByText('Ovo polje je obavezno.')).toHaveLength(2)

    const broken = screen.getByLabelText(/proba.ime/)
    expect(broken).toHaveAttribute('aria-invalid', 'true')
    expect(broken.getAttribute('aria-describedby')).toBe('field-ime-error')
  })

  it('announces the failure and links to every broken field', async () => {
    const user = setupUser()
    renderWithI18n(<FormRenderer form={everyType} onSubmit={vi.fn()} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    // Without this, pressing the button with a broken form is silent for
    // anyone who cannot see the red text appear.
    const summary = screen.getByRole('alert')
    expect(summary).toHaveTextContent('Prijava nije poslata')
    expect(within(summary).getByRole('link', { name: /proba.ime/ })).toHaveAttribute(
      'href',
      '#field-ime',
    )
  })

  it('clears a field error as soon as the field is touched', async () => {
    const user = setupUser()
    renderWithI18n(<FormRenderer form={everyType} onSubmit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    expect(screen.getByLabelText(/proba.ime/)).toHaveAttribute('aria-invalid', 'true')

    await user.type(screen.getByLabelText(/proba.ime/), 'V')

    expect(screen.getByLabelText(/proba.ime/)).toHaveAttribute('aria-invalid', 'false')
    expect(screen.getAllByText('Ovo polje je obavezno.')).toHaveLength(1)
  })

  it('submits the values once the form is correct', async () => {
    const user = setupUser()
    const onSubmit = vi.fn()
    renderWithI18n(<FormRenderer form={everyType} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/proba.ime/), 'Vladan')
    await user.click(screen.getByLabelText(/proba.saglasnost/))
    await user.selectOptions(screen.getByLabelText(/proba.pol/), 'M')
    await user.type(screen.getByLabelText(/proba.beleska/), 'beleška')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ ime: 'Vladan', saglasnost: true, pol: 'M', beleska: 'beleška' }),
    )
  })

  it('submits trimmed values', async () => {
    const user = setupUser()
    const onSubmit = vi.fn()
    renderWithI18n(<FormRenderer form={everyType} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/proba.ime/), '  Vladan  ')
    await user.click(screen.getByLabelText(/proba.saglasnost/))
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ ime: 'Vladan' }))
  })

  /* A form keeps all its values in one place, so unless a field is left alone
     when nothing about it changed, every letter typed redraws every field. On the
     race form, whose one select offers all twelve hundred events, that meant
     rebuilding twelve hundred options per letter, and it is what put that screen
     over the time limit on CI (GitHub run 30528720474).
   *
   * Counted here as how often a field is asked for its words, which is what a
   * redraw of it costs. Three things have to hold for the count to stay put: the
   * memo around a field, one change handler made once for the whole form, and one
   * shared empty list for a field with no choices. Undo any of the three and this
   * fails, which is the point: none of them shows up on screen. */
  it('redraws the field that was typed into and no other', async () => {
    const user = setupUser()
    let asked = 0
    const counted: FormDef = {
      ...everyType,
      fields: everyType.fields.map((field) =>
        field.name === 'ime'
          ? field
          : {
              ...field,
              get labelKey() {
                asked += 1
                return `proba.${field.name}`
              },
            },
      ),
    }

    renderWithI18n(<FormRenderer form={counted} onSubmit={vi.fn()} />)

    const once = asked
    expect(once).toBe(everyType.fields.length - 1)

    await user.type(screen.getByLabelText(/proba.ime/), 'Vladan')

    // Six letters and eight other fields: it was forty eight more than this.
    expect(asked).toBe(once)
  })

  it('renders the registration definition straight from JSON', () => {
    renderWithI18n(<FormRenderer form={registracija as FormDef} onSubmit={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Registracija' })).toBeVisible()
    expect(screen.getByLabelText(/Veličina majice/)).toBeInTheDocument()
    expect(screen.getByText('Od države zavisi koji načini plaćanja ti se nude.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Pošalji prijavu' })).toBeInTheDocument()
  })
})

describe('a long box with no limit on it', () => {
  /* Nothing in the portal has one and a guard keeps it that way
     (definitions.test.ts), but the renderer is handed a definition and is in no
     position to insist. With no limit there is no room to run out of, so it
     counts nothing down and loses nothing to a paste. */
  it('counts nothing down and says nothing about a paste', async () => {
    const user = setupUser()
    renderWithI18n(<FormRenderer form={everyType} onSubmit={vi.fn()} />)

    const box = screen.getByLabelText(/proba.beleska/)

    expect(box).not.toHaveAttribute('maxlength')
    expect(box).not.toHaveAttribute('aria-describedby')

    await user.click(box)
    await user.paste('x'.repeat(5000))

    expect(box).toHaveValue('x'.repeat(5000))
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('a value longer than the limit that was later put on its field', () => {
  /* Which happens: a record is written where nothing capped it and then opened
     on a form that caps it. The paste arithmetic has to hold there too, and it
     is the one place where a paste can change the box while taking nothing in. */
  const capped: FormDef = {
    id: 'kratko',
    titleKey: 'proba.naslov',
    submitKey: 'form.submit',
    fields: [{ name: 'beleska', type: 'textarea', labelKey: 'proba.beleska', maxLength: 10 }],
  }

  it('keeps the message about what a paste lost, though the paste took nothing in', async () => {
    const user = setupUser()
    renderWithI18n(
      <FormRenderer form={capped} onSubmit={vi.fn()} initial={{ beleska: 'x'.repeat(20) }} />,
    )

    const box = screen.getByLabelText<HTMLTextAreaElement>(/proba.beleska/)
    await user.click(box)

    /* Five characters selected in a box already twice its limit: there is no
       room, so nothing is taken in, but the selection goes all the same and a
       change follows. That change is the paste's own and must not be read as
       the writer moving on, or the message about what they just lost is put up
       and taken down inside one event. */
    box.setSelectionRange(0, 5)
    fireEvent.paste(box, { clipboardData: { getData: () => 'yyy' } })
    fireEvent.change(box, { target: { value: 'x'.repeat(15) } })

    /* And the number it says, which is what the clamp on the room is for: the
       box is ten characters over its limit, so an unclamped room is minus five,
       and the three characters brought would be reported as eight lost. Held on
       the figure, because the sentence is the same either way. */
    expect(screen.getByRole('status')).toHaveTextContent(/Nalepljeni tekst je bio 3 znaka/)
  })

  it('keeps the message through a paste that fits only in part', async () => {
    /* Room for three and five brought: the box takes three, drops two, and a
       change follows carrying the three. That change is the paste's own, so the
       message about the two must survive it; read as the writer moving on, it
       goes up and comes down inside one event and nobody sees it. */
    const user = setupUser()
    renderWithI18n(
      <FormRenderer form={capped} onSubmit={vi.fn()} initial={{ beleska: 'x'.repeat(7) }} />,
    )

    const box = screen.getByLabelText<HTMLTextAreaElement>(/proba.beleska/)
    await user.click(box)

    box.setSelectionRange(7, 7)
    fireEvent.paste(box, { clipboardData: { getData: () => 'yyyyy' } })
    fireEvent.change(box, { target: { value: `${'x'.repeat(7)}yyy` } })

    expect(screen.getByRole('status')).toHaveTextContent(/Nalepljeni tekst je bio 2 znaka/)
  })

  it('clears the message on the next keystroke after a refused paste', async () => {
    /* A paste into a box with no room and nothing selected is refused whole: no
       change follows it, so the flag that lets one change through must not be
       raised. Raised anyway, it would eat the writer's next keystroke and the
       message about what was lost would linger past the moment it was true. */
    const user = setupUser()
    renderWithI18n(
      <FormRenderer form={capped} onSubmit={vi.fn()} initial={{ beleska: 'x'.repeat(10) }} />,
    )

    const box = screen.getByLabelText<HTMLTextAreaElement>(/proba.beleska/)
    await user.click(box)

    /* The caret at the end and nothing selected: the box is full, so the paste
       brings three characters and takes none. */
    box.setSelectionRange(10, 10)
    fireEvent.paste(box, { clipboardData: { getData: () => 'yyy' } })

    expect(screen.getByRole('status')).toHaveTextContent(/Nalepljeni tekst je bio 3 znaka/)

    /* The writer's own next change, which is the first thing that happens after
       a refused paste. */
    fireEvent.change(box, { target: { value: 'x'.repeat(9) } })

    expect(screen.getByRole('status')).not.toHaveTextContent(/Nalepljeni tekst/)
  })

  it('lets the next thing the writer does clear it', async () => {
    const user = setupUser()
    renderWithI18n(
      <FormRenderer form={capped} onSubmit={vi.fn()} initial={{ beleska: 'x'.repeat(20) }} />,
    )

    const box = screen.getByLabelText<HTMLTextAreaElement>(/proba.beleska/)
    await user.click(box)
    box.setSelectionRange(0, 5)
    fireEvent.paste(box, { clipboardData: { getData: () => 'yyy' } })
    fireEvent.change(box, { target: { value: 'x'.repeat(15) } })
    fireEvent.change(box, { target: { value: 'x'.repeat(14) } })

    /* Not empty: the box is still over its limit, so the region falls back to
       saying that, which is the other thing it is for. What has gone is the
       message about the paste. */
    expect(screen.getByRole('status')).not.toHaveTextContent(/Nalepljeni tekst/)
    expect(screen.getByRole('status')).toHaveTextContent(/granica je 10/)
  })
})

describe('a definition swapped under a form that is already on screen', () => {
  it('draws a field it is holding nothing for as empty, and does not save the word undefined', async () => {
    const smaller: FormDef = { ...grown, fields: grown.fields.slice(0, 1) }
    const sent: FormValues[] = []

    function Swapping() {
      const [form, setForm] = useState(smaller)

      return (
        <>
          <button type="button" onClick={() => setForm(grown)}>
            zameni
          </button>
          <FormRenderer form={form} onSubmit={(values) => sent.push(values)} />
        </>
      )
    }

    const user = setupUser()
    renderWithI18n(<Swapping />)

    expect(screen.queryByLabelText(/proba.dopisano/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'zameni' }))

    expect(screen.getByLabelText(/proba.dopisano/)).toHaveValue('')

    await user.type(screen.getByLabelText(/proba.ime/), 'Vladan')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    /* The half that mattered. The box looked blank either way; what is saved is
       what somebody reads back out of the record a year later. */
    expect(sent).toHaveLength(1)
    expect(sent[0]?.dopisano).toBe('')
  })
})
