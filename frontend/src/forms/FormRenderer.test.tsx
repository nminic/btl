import { must } from '../test/at'
import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import { renderWithI18n } from '../test/render'
import { setupUser } from '../test/user'
import registracija from './definitions/registracija.form.json'
import { FormRenderer } from './FormRenderer'
import type { FormDef } from './types'

/* The renderer keeps its values in state, seeded once from the definition it was
 * first given. A screen that swaps one definition for another without remounting
 * therefore hands it fields it is holding nothing for, and those must draw empty
 * rather than draw `undefined` or fall over. The entity editor is the screen
 * that can do it: it renders one FormRenderer with no key and picks the
 * definition by which entity is being edited. */
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

describe('a definition swapped under a form that is already on screen', () => {
  it('draws a field it is holding nothing for as empty, not as undefined', async () => {
    const smaller: FormDef = { ...grown, fields: grown.fields.slice(0, 1) }

    function Swapping() {
      const [form, setForm] = useState(smaller)

      return (
        <>
          <button type="button" onClick={() => setForm(grown)}>
            zameni
          </button>
          <FormRenderer form={form} onSubmit={() => {}} />
        </>
      )
    }

    const user = setupUser()
    renderWithI18n(<Swapping />)

    expect(screen.queryByLabelText(/proba.dopisano/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'zameni' }))

    /* Empty, and not the word "undefined", which is what an unguarded lookup
       would put in the box. The state was seeded from the first definition and
       is not reseeded, so this field is the one case the renderer holds nothing
       for. */
    expect(screen.getByLabelText(/proba.dopisano/)).toHaveValue('')
  })
})
