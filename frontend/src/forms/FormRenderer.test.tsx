import { renderToStaticMarkup } from 'react-dom/server'
import sr from '../i18n/sr.json'
import { translate } from '../i18n/translate'
import { must } from '../test/at'
import { useState, type ReactNode } from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithI18n } from '../test/render'
import { setupUser } from '../test/user'
import { registracija } from './definitions'
import { FormRenderer } from './FormRenderer'
import { plainWords, worded } from './worded'
import type { FieldDef, FormDef, FormValues } from './types'

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
    /* A field of another kind carrying a link in its words. The one the portal
       has today is a confirmation, so without this the other branch that draws
       words was never asked to draw a link, and losing it there would have gone
       unsaid (forms/worded.tsx). */
    {
      name: 'saVezom',
      type: 'text',
      /* A key the dictionary really has, and one that carries the mark: an
         unknown key falls back to itself, and „proba.saVezom" holds no mark, so
         nothing would ever have been drawn and the guard below would have held
         nothing. */
      labelKey: 'registration.healthStatement',
      linkKey: 'registration.healthStatementLink',
      linkTo: 'pravilnik',
    },
    /* The whole world in one select, which three forms ask for and none of them
       is the registration: it opens unanswered, so „Izaberi" has to be there
       once and only once. */
    { name: 'drzava', type: 'country', labelKey: 'proba.drzava' },
    /* A town, with no rule written beside it. The one place field the portal
       has does carry a rule, so without this the field is only ever drawn the
       one way and the case where it describes itself by nothing is never
       walked. */
    { name: 'mesto', type: 'place', labelKey: 'proba.mesto' },
    { name: 'saglasnost', type: 'checkbox', labelKey: 'proba.saglasnost', required: true },
    /* Buttons with no rule beside them. The two the portal has both carry one,
       so without this the case where a choice describes itself by nothing is
       never walked. */
    {
      name: 'izbor',
      type: 'choice',
      labelKey: 'proba.izbor',
      options: [
        { value: 'da', labelKey: 'proba.da' },
        { value: 'ne', labelKey: 'proba.ne' },
      ],
    },
  ],
}

describe('the words of a field with a link in them', () => {
  /* Read on their own, because the one sentence the portal has carries a single
     mark and the shapes that go wrong carry none or two. */
  const veza = { name: 'saglasnost', type: 'checkbox', labelKey: 'proba.saglasnost' } as const
  const withLink = { ...veza, linkKey: 'proba.veza', linkTo: 'pravilnik' }
  const words = (one: ReactNode) =>
    renderToStaticMarkup(<>{one}</>)

  it('leaves them alone when the field carries no link', () => {
    expect(words(worded('Pročitao sam pravila.', veza, 'sr', (key) => key)))
      .toBe('Pročitao sam pravila.')
  })

  it('puts the link where the mark is', () => {
    expect(words(worded('Upoznat sam sa {link} i pristajem.', withLink, 'sr', (key) => key)))
      .toBe('Upoznat sam sa <a href="/sr/pravilnik" target="_blank" rel="noreferrer">proba.veza</a> i pristajem.')
  })

  it('keeps the sentence whole when a translation drops the mark', () => {
    expect(words(worded('Upoznat sam sa pravilima.', withLink, 'sr', (key) => key)))
      .toBe('Upoznat sam sa pravilima.')
  })

  it('draws nothing at all when a field says what a link reads but not where it goes', () => {
    /* Both halves are needed and both functions ask for both: asked for one of
       them, one would draw the words of a link and the other would leave
       „{link}" standing on the screen. A definition like this is refused before
       it gets here (forms/definitions.test.ts), and these two are what makes the
       refusal safe rather than necessary. */
    const half = { ...veza, linkKey: 'proba.veza' }

    expect(words(worded('Upoznat sam sa {link} i pristajem.', half, 'sr', (key) => key)))
      .toBe('Upoznat sam sa {link} i pristajem.')
    expect(plainWords('Upoznat sam sa {link} i pristajem.', half, (key) => key))
      .toBe('Upoznat sam sa {link} i pristajem.')
  })

  it('keeps everything after a second mark, rather than losing it', () => {
    /* Taken as two halves, a sentence carrying the mark twice lost everything
       past the second one without a word. The link is drawn once, where it is
       first asked for, and the rest is the sentence as it was written. */
    expect(words(worded('Prvo {link} pa {link} i kraj.', withLink, 'sr', (key) => key)))
      .toBe('Prvo <a href="/sr/pravilnik" target="_blank" rel="noreferrer">proba.veza</a> pa {link} i kraj.')
  })
})

/* The star beside the name of a field that has to be answered (owner,
   12.08.2026: „Obavezna polja treba da imaju zvezdicu pored").
 *
 * A fixture of its own, because what is being held is a pair at each of the
 * three places a name is drawn: with the star and without it. `everyType` has
 * one obligatory confirmation and one optional group of buttons, so on its own
 * it would walk one half of each pair and leave the other unsaid. */
const bothWays: FormDef = {
  id: 'proba',
  titleKey: 'proba.naslov',
  submitKey: 'form.submit',
  fields: [
    { name: 'ime', type: 'text', labelKey: 'proba.ime', required: true },
    { name: 'dopisano', type: 'text', labelKey: 'proba.dopisano' },
    { name: 'saglasnost', type: 'checkbox', labelKey: 'proba.saglasnost', required: true },
    { name: 'beleska', type: 'checkbox', labelKey: 'proba.beleska' },
    {
      name: 'izbor',
      type: 'choice',
      labelKey: 'proba.izbor',
      required: true,
      options: [
        { value: 'da', labelKey: 'proba.da' },
        { value: 'ne', labelKey: 'proba.ne' },
      ],
    },
    {
      name: 'pol',
      type: 'choice',
      labelKey: 'proba.pol',
      options: [{ value: 'M', labelKey: 'proba.muski' }],
    },
    /* The two controls the renderer does not build itself. Both take the word
       through a prop of their own, so both can lose it without any of the
       fields above noticing. */
    { name: 'datum', type: 'date', labelKey: 'proba.datum', required: true },
    { name: 'mesto', type: 'place', labelKey: 'proba.mesto', required: true },
  ],
}

/* Found through the words rather than through the control, because the three
   places draw three different controls and one of them, the group of buttons,
   has no control the name belongs to at all.

   At the top of the file rather than inside one `describe`, because a second copy grew
   in another one and the name of the class then had two homes in a single file. */
const starOn = (key: string) => {
  const field = must(screen.getByText(key).closest<HTMLElement>('.field'), `the field named ${key}`)

  return field.querySelector('.field__required')
}

describe('the star of an obligatory field', () => {

  it('stands beside the name of every field that has to be answered', () => {
    renderWithI18n(<FormRenderer form={bothWays} onSubmit={vi.fn()} />)

    expect(starOn('proba.ime')).not.toBeNull()
    expect(starOn('proba.saglasnost')).not.toBeNull()
    expect(starOn('proba.izbor')).not.toBeNull()
  })

  it('is drawn for the eye alone, and never read out', () => {
    /* A reader says „obavezno" from `aria-required` on the control, so read out
       as well the star is the same thing said twice, and said as a loose
       „zvezdica" standing between a name and a box. The test below holds the
       other half: hidden here and said nowhere else, the whole thing would be
       silent. */
    renderWithI18n(<FormRenderer form={bothWays} onSubmit={vi.fn()} />)

    expect(starOn('proba.ime')).toHaveAttribute('aria-hidden', 'true')
    expect(starOn('proba.saglasnost')).toHaveAttribute('aria-hidden', 'true')
    expect(starOn('proba.izbor')).toHaveAttribute('aria-hidden', 'true')
  })

  it('stands beside no field that may be left empty', () => {
    renderWithI18n(<FormRenderer form={bothWays} onSubmit={vi.fn()} />)

    expect(starOn('proba.dopisano')).toBeNull()
    expect(starOn('proba.beleska')).toBeNull()
    expect(starOn('proba.pol')).toBeNull()
  })

  it('says of every field that may be left empty that it may, whatever kind it is', () => {
    /* Both halves of the rule reach all three kinds. The confirmation was given
       the star and not the word, so an optional confirmation was the one field
       on the portal that said nothing either way: no star, and no „(neobavezno)"
       beside it either. */
    renderWithI18n(<FormRenderer form={bothWays} onSubmit={vi.fn()} />)

    for (const key of ['proba.dopisano', 'proba.beleska', 'proba.pol']) {
      const words = screen.getByText(key).textContent ?? ''

      expect(words, `${key} does not say it may be left empty`).toContain('(neobavezno)')
    }
  })

  it('is said to a screen reader by the control, since the star is not', () => {
    /* The other half of the decision above, and the half that was missing: the
       star is hidden and nothing else said a word, so a reader met a legend
       about a mark it could not find and fourteen fields that never said they
       had to be answered.

       Held on all four kinds of control, because they carry it four different
       ways: the plain ones through the shared props, the group of buttons on
       the group itself (a radio is not obligatory, the choice between them is),
       and the date and the town each through a prop of their own. */
    renderWithI18n(<FormRenderer form={bothWays} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText('proba.ime')).toHaveAttribute('aria-required', 'true')
    expect(screen.getByLabelText('proba.saglasnost')).toHaveAttribute('aria-required', 'true')
    expect(screen.getByRole('radiogroup', { name: 'proba.izbor' })).toHaveAttribute(
      'aria-required',
      'true',
    )
    expect(screen.getByLabelText('proba.datum')).toHaveAttribute('aria-required', 'true')
    /* The town and the country beside it: half an answer is not an answer. */
    expect(screen.getByLabelText('proba.mesto')).toHaveAttribute('aria-required', 'true')
    expect(screen.getByLabelText(/^Država/)).toHaveAttribute('aria-required', 'true')
  })

  it('is said by no control that may be left empty', () => {
    renderWithI18n(<FormRenderer form={bothWays} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText(/proba.dopisano/)).not.toHaveAttribute('aria-required')
    /* Matched on the opening of the name and not the whole of it: a group that
       may be left empty carries „(neobavezno)" after its name. */
    expect(screen.getByRole('radiogroup', { name: /^proba\.pol/ })).not.toHaveAttribute(
      'aria-required',
    )
  })

  it('marks the country beside a town, which is a field of its own', () => {
    /* The town carries its country in a second control with its own id, its own
       error and its own line in the summary, so it is a field and says what
       every field says. It said neither of the two things: a bare „Država"
       under a legend promising that starred fields are obligatory, while an
       empty country really did stop the form.

       Its own state, too: obligatory where the town is, and free where the town
       is (forms/PlaceField.tsx). */
    renderWithI18n(<FormRenderer form={bothWays} onSubmit={vi.fn()} />)

    const asked = screen.getByLabelText(/^Država/)

    expect(asked).toHaveAttribute('aria-required', 'true')
    expect(
      must(asked.closest('.place__country-pick'), 'the country field').querySelector(
        '.field__required',
      ),
    ).not.toBeNull()

    /* And the star is outside the words, as everywhere: „Država" is the name. */
    expect(must(asked.closest('.place__country-pick'), 'the country field')
      .querySelector('label')?.textContent).toBe('Država')
  })

  it('is not part of the name the field is found by', () => {
    /* Which is why it is drawn outside the label and not inside it. Inside, the
       name of every obligatory field gained a star: „Ime" became „Ime *" for a
       screen reader and for everything that goes looking for a field by name,
       and thirty seven tests said so at once. Held exactly, since a match on
       part of the words would pass either way. */
    renderWithI18n(<FormRenderer form={bothWays} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText('proba.ime')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'proba.izbor' })).toBeInTheDocument()
  })

  it('is explained once over the form, where there is one to explain', () => {
    renderWithI18n(<FormRenderer form={bothWays} onSubmit={vi.fn()} />)

    expect(screen.getByText('Polja sa zvezdicom su obavezna.')).toBeInTheDocument()
  })

  it('is not explained on a form that draws none', () => {
    /* A line about a mark that is nowhere on the screen is a line to work out
       rather than a line to read. */
    const nothingAsked: FormDef = {
      id: 'proba',
      titleKey: 'proba.naslov',
      submitKey: 'form.submit',
      fields: [{ name: 'dopisano', type: 'text', labelKey: 'proba.dopisano' }],
    }

    renderWithI18n(<FormRenderer form={nothingAsked} onSubmit={vi.fn()} />)

    expect(screen.queryByText('Polja sa zvezdicom su obavezna.')).not.toBeInTheDocument()
  })
})

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
    /* Four of them: the two selects with nothing chosen, the country beside the
       town, and the country asked for on its own. All four open unanswered on a
       form that does not say which country it starts in
       (forms/CountryOptions.tsx). */
    expect(screen.getAllByRole('option', { name: 'Izaberi' })).toHaveLength(4)
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

  it('draws a link in the words of a field that is not a confirmation', () => {
    /* `worded` is called from both branches that write a label, and only one of
       them had a field to prove it: the words of an ordinary field carrying a
       link went through the same function and nothing said so. */
    renderWithI18n(<FormRenderer form={everyType} onSubmit={vi.fn()} />)

    const field = must(
      screen.getByText(/zdravstveno sposoban/).closest<HTMLElement>('.field'),
      'the field whose words carry a link',
    )

    expect(within(field).getByRole('link', { name: 'pravilnikom' })).toHaveAttribute(
      'href',
      '/sr/pravilnik',
    )
    /* And the mark itself never reaches the screen. */
    expect(within(field).queryByText(/\{link\}/)).toBeNull()
  })

  it("hands a derived value every field of the form, and the town country", () => {
    /* What a derived value is worked out of, which is the whole of what a save
       will write down and not only what somebody typed.
     *
       This holds the contract and not the choice behind it: the form reads
       `filled` rather than the bare state everywhere, and the two are the same
       set of keys until a caller hands the form another definition without
       remounting it. No caller does, so nothing here can tell the two apart, and
       saying so is more useful than a test that pretends to. */
    const seen: string[] = []

    renderWithI18n(
      <FormRenderer
        form={everyType}
        onSubmit={vi.fn()}
        derived={(values) => {
          seen.push(Object.keys(values).sort().join(','))

          return []
        }}
      />,
    )

    /* Every field of the definition, and the country the town carries. */
    expect(seen[0]).toContain('country')
    expect(seen[0]).toContain('mesto')
  })

  it('writes the words of a link, and not the mark, wherever a link cannot go', () => {
    /* A summary of errors is a list of links to fields, and a link inside a link
       is not a thing; a definition list of what was saved is not a place to
       follow anything either. Both write the name of the field on its own, and
       the mark itself reached the screen the day the first sentence carried one
       (forms/worded.tsx, `plainWords`). */
    const field: FieldDef = {
      name: 'saglasnost',
      type: 'checkbox',
      labelKey: 'registration.healthStatement',
      linkKey: 'registration.healthStatementLink',
      linkTo: 'pravilnik',
    }
    const said = plainWords(
      translate(sr, 'sr', field.labelKey),
      field,
      (key) => translate(sr, 'sr', key),
    )

    expect(said).toBe(
      'Potvrđujem da sam upoznat sa pravilnikom i da sam zdravstveno sposoban za rekreativan sport.',
    )
    expect(said).not.toContain('{link}')
  })

  it('offers one way of saying nothing at all in a list of countries', () => {
    /* „Izaberi" comes with the list, since the list is the one that knows
       whether the code it was handed is one it can name. Written in the renderer
       as well, every country select that opened unanswered began with the same
       word twice, and three forms open one that way. */
    renderWithI18n(<FormRenderer form={everyType} onSubmit={vi.fn()} />)

    const land = screen.getByLabelText(/proba.drzava/)

    expect(within(land).getAllByRole('option', { name: 'Izaberi' })).toHaveLength(1)
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
    renderWithI18n(<FormRenderer form={registracija} onSubmit={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Registracija' })).toBeVisible()
    expect(screen.getByLabelText(/Veličina majice/)).toBeInTheDocument()
    /* The town, which carries the country beside it: the form used to ask for
       the two separately (owner, 11.08.2026). */
    expect(screen.getByRole('combobox', { name: /Država/i })).toBeInTheDocument()
    /* And the rule the address carries, in the document and out of sight until
       it is asked for (FieldHint.tsx). */
    expect(
      screen.getByText(/Ulica i broj, na koje ti stižu majica i finišerska medalja/),
    ).toBeInTheDocument()
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

describe('a field the form has taken back off the screen', () => {
  const askingParent: FormDef = {
    id: 'proba',
    titleKey: 'proba.naslov',
    submitKey: 'form.submit',
    fields: [
      { name: 'datum', type: 'date', labelKey: 'proba.datum', required: true },
      {
        name: 'staratelj',
        type: 'text',
        labelKey: 'proba.dopisano',
        showWhenYoungerThan: { field: 'datum', years: 16 },
      },
    ],
  }

  it('is not sent with the rest of the form', async () => {
    /* The registration form asks for a parent's name and their relationship the
       moment a date of birth says the applicant is under sixteen, and takes both
       away again when the date is corrected. Taking a field off the screen used
       to leave its value in what was sent: enter 2015, name the parent, correct
       the year to 1990, submit, and a third party was still named in the record.
     *
       PDL P23 collects nothing that is not needed and the signature exists only
       as the legal basis for a member under sixteen, so with the basis gone the
       name has no ground to stand on. Nothing keeps it today because there is no
       database yet, which is exactly why it had to be caught now: this object is
       the contract the backend will be written against.
     *
       The test that existed watched the field leave the screen, which it always
       did. What is sent is the half nobody was looking at. */
    const sent: FormValues[] = []
    const user = setupUser()

    renderWithI18n(
      <FormRenderer
        form={askingParent}
        onSubmit={(values) => {
          sent.push(values)
        }}
      />,
    )

    const birth = screen.getByLabelText(/proba.datum/)

    await user.type(birth, '01012015')
    await user.type(screen.getByLabelText(/proba.dopisano/), 'Milena Đurišić')

    await user.clear(birth)
    await user.type(birth, '01011990')

    expect(screen.queryByLabelText(/proba.dopisano/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(sent).toHaveLength(1)
    expect(sent[0]).not.toHaveProperty('staratelj')
  })

  it('takes a field that only agrees with another one out of what is sent', async () => {
    /* A repeated password carries nothing of its own: whether the two match is a
       rule of the form, answered here, and not a fact a backend is owed. It was
       going out in the body beside the first one, so the secret travelled twice
       and had a second place to end up in a proxy log or a crash report. */
    const sent: FormValues[] = []
    const user = setupUser()
    const twice: FormDef = {
      id: 'proba',
      titleKey: 'proba.naslov',
      submitKey: 'form.submit',
      fields: [
        { name: 'lozinka', type: 'password', labelKey: 'proba.lozinka', required: true },
        {
          name: 'lozinkaOpet',
          type: 'password',
          labelKey: 'proba.dopisano',
          required: true,
          matches: 'lozinka',
        },
      ],
    }

    renderWithI18n(
      <FormRenderer
        form={twice}
        onSubmit={(values) => {
          sent.push(values)
        }}
      />,
    )

    await user.type(screen.getByLabelText(/proba.lozinka/), 'trkacka2027')
    await user.type(screen.getByLabelText(/proba.dopisano/), 'trkacka2027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(sent).toHaveLength(1)
    expect(sent[0]?.lozinka).toBe('trkacka2027')
    expect(sent[0]).not.toHaveProperty('lozinkaOpet')
  })

  it('is still sent while it is on the screen', async () => {
    /* The other half, so the fix cannot be „send nothing conditional". A parent
       named by somebody who really is under sixteen is the whole point of the
       field. */
    const sent: FormValues[] = []
    const user = setupUser()

    renderWithI18n(
      <FormRenderer
        form={askingParent}
        onSubmit={(values) => {
          sent.push(values)
        }}
      />,
    )

    await user.type(screen.getByLabelText(/proba.datum/), '01012015')
    await user.type(screen.getByLabelText(/proba.dopisano/), 'Milena Đurišić')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(sent).toHaveLength(1)
    expect(sent[0]?.staratelj).toBe('Milena Đurišić')
  })

  it('takes with it the value it was writing beside itself', async () => {
    /* A place field writes two values: the town into its own name and the
       country the town came with into another, which has no field of its own to
       be found under. Leaving out only what the definition names therefore left
       the country standing after its town had gone.
     *
       Nothing on the portal draws that arrangement today, since the one form
       with a conditional field has no place field in it. The fault was built the
       moment the country was let through by name, which is why it is closed
       while it is still cheap. */
    const sent: FormValues[] = []
    const user = setupUser()
    const conditionalPlace: FormDef = {
      id: 'proba',
      titleKey: 'proba.naslov',
      submitKey: 'form.submit',
      fields: [
        { name: 'datum', type: 'date', labelKey: 'proba.datum', required: true },
        {
          name: 'mesto',
          type: 'place',
          labelKey: 'proba.mesto',
          showWhenYoungerThan: { field: 'datum', years: 16 },
        },
      ],
    }

    renderWithI18n(
      <FormRenderer
        form={conditionalPlace}
        onSubmit={(values) => {
          sent.push(values)
        }}
      />,
    )

    const birth = screen.getByLabelText(/proba.datum/)

    await user.type(birth, '01012015')
    await user.type(screen.getByLabelText(/proba.mesto/), 'Beograd')

    await user.clear(birth)
    await user.type(birth, '01011990')

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(sent).toHaveLength(1)
    expect(sent[0]).not.toHaveProperty('mesto')
    expect(sent[0]).not.toHaveProperty('country')
  })
})

describe('a field asked of everybody and demanded of some', () => {
  const asking: FormDef = {
    id: 'proba',
    titleKey: 'proba.naslov',
    submitKey: 'form.submit',
    fields: [
      { name: 'datum', type: 'date', labelKey: 'proba.datum', required: true },
      {
        name: 'dokument',
        type: 'text',
        labelKey: 'proba.dopisano',
        required: true,
        optionalWhenYoungerThan: { field: 'datum', years: 16 },
      },
    ],
  }

  it('takes the star off the field it will not demand, and puts it back', async () => {
    /* The screen half of the rule, which nothing measured: removing `asAsked` from the
       renderer left the whole suite green while a fifteen year old saw a star and
       `aria-required` on a document they cannot have. The star is precisely what makes a
       parent type their own number, which is the harm the rule exists to prevent, so the
       screen and the validation saying different things is not a cosmetic difference. */
    const user = setupUser()

    renderWithI18n(<FormRenderer form={asking} onSubmit={() => {}} />)

    const birth = screen.getByLabelText(/proba.datum/)
    const document_ = () => screen.getByLabelText(/proba.dopisano/)
    /* And the star itself, not only what a screen reader is told. The first version of
       this test asked for `aria-required` alone, under a name about the star and a
       comment saying the star is what makes a parent type their own number: a review
       drew the star from the written definition instead of from `asAsked`, and the test
       stayed green while a fifteen year old saw it. */
    const star = () => starOn('proba.dopisano')

    expect(document_(), 'demanded while the date says nothing').toHaveAttribute(
      'aria-required',
      'true',
    )
    expect(star(), 'no star while the date says nothing').not.toBeNull()

    await user.type(birth, '01012015')

    expect(document_(), 'still demanded of a child').not.toHaveAttribute('aria-required')
    expect(star(), 'a child is still shown the star').toBeNull()

    await user.clear(birth)
    await user.type(birth, '01011990')

    expect(document_(), 'no longer demanded of an adult').toHaveAttribute('aria-required', 'true')
    expect(star(), 'an adult is no longer shown the star').not.toBeNull()
  })
})

/* A form whose list fills a group of buttons and a town, which no list on the
 * portal does today. It is here because the lock was written on `shared`, and the
 * two kinds of control that do not use `shared` were locked in name only: the form
 * said the value cannot be changed and it could. */
const fillsEverything: FormDef = {
  id: 'proba',
  titleKey: 'proba.naslov',
  submitKey: 'form.submit',
  fields: [
    { name: 'trka', type: 'text', labelKey: 'proba.trka' },
    {
      name: 'izbor',
      type: 'choice',
      labelKey: 'proba.izbor',
      options: [
        { value: 'da', labelKey: 'proba.da' },
        { value: 'ne', labelKey: 'proba.ne' },
      ],
    },
    { name: 'mesto', type: 'place', labelKey: 'proba.mesto' },
  ],
}

describe('a field filled from a list', () => {
  it('is locked whatever kind of control it is drawn as', async () => {
    const user = setupUser()

    renderWithI18n(
      <FormRenderer
        form={fillsEverything}
        suggests={{
          trka: [
            {
              id: 'jedna',
              value: 'Probna trka',
              said: 'Probna trka – 19.04.2026. – 42,2 km',
              fills: { izbor: 'da', mesto: 'Beograd' },
            },
          ],
        }}
        onSubmit={() => undefined}
      />,
    )

    await user.type(screen.getByLabelText(/proba.trka/), 'pr')
    await user.click(screen.getByRole('button', { name: /Probna trka/ }))

    /* Every button of the group, not the group: `disabled` is a property of a
       control and a group of radio buttons is not one. */
    for (const one of screen.getAllByRole('radio')) {
      expect(one, 'a button of the group takes an answer it was not given').toBeDisabled()
    }

    expect(screen.getByLabelText(/proba.mesto/), 'the town still takes typing').toBeDisabled()
  })
})

/* Two obligatory fields, one of them typed against a list. What it is for is the
 * difference between „this field is answered" and „the form is answered". */
const askedAndAsked: FormDef = {
  id: 'proba',
  titleKey: 'proba.naslov',
  submitKey: 'form.submit',
  fields: [
    { name: 'trka', type: 'text', labelKey: 'proba.trka', required: true },
    { name: 'drugo', type: 'text', labelKey: 'proba.drugo', required: true },
  ],
}

describe('a list to type against, on a form that opens already filled in', () => {
  /** The same form the lock test uses, with a value in the box from the start. */
  function opened(initial: FormValues) {
    renderWithI18n(
      <FormRenderer
        form={fillsEverything}
        initial={initial}
        suggests={{
          trka: [
            {
              id: 'jedna',
              value: 'Probna trka',
              said: 'Probna trka – 19.04.2026. – 42,2 km',
              fills: { izbor: 'da', mesto: 'Beograd' },
            },
          ],
        }}
        onSubmit={() => undefined}
      />,
    )
  }

  it('says nothing until somebody types', async () => {
    /* Measured 23.08.2026: derived from the value alone, the list opened by itself
       on the form a member reaches by pressing „Ispravi i pošalji ponovo" on a
       refused result. Eight rows stood over the fields under the box and the live
       region said „8 trka iz kalendara odgovara" to somebody who had typed
       nothing. */
    opened({ trka: 'Probna trka' })

    expect(screen.queryByRole('button', { name: /Probna trka/ })).toBeNull()
    expect(screen.getAllByRole('status').map((one) => one.textContent)).not.toContain(
      '1 trka iz kalendara odgovara',
    )
  })

  it('opens on the first letter typed into it, and closes on the way out', async () => {
    /* The other half: shut is where it starts and not where it stays. And it
       closes when the cursor leaves, because it stands over the fields under the
       box: a list left open while the cursor walks past it hides the box it lands
       on (WCAG 2.2 SC 2.4.11). */
    const user = setupUser()

    opened({})

    await user.type(screen.getByLabelText(/proba.trka/), 'pr')

    expect(screen.getByRole('button', { name: /Probna trka/ })).toBeVisible()

    await user.tab()
    await user.tab()

    expect(screen.queryByRole('button', { name: /Probna trka/ })).toBeNull()
  })
})

describe('the errors a form is holding while somebody types', () => {
  it('lose only the fields that were touched, and not the whole form', async () => {
    /* Measured 23.08.2026: one letter typed into a field with a list took away
       nine messages and the summary over them, while the same letter typed into
       any other field took away one. A reader walking the summary lost it on
       touching the first field and had to send the form unfinished again to get it
       back (WCAG 2.2 SC 3.3.1). */
    const user = setupUser()

    renderWithI18n(
      <FormRenderer
        form={askedAndAsked}
        suggests={{ trka: [{ id: 'a', value: 'Probna', said: 'Probna', fills: {} }] }}
        onSubmit={() => undefined}
      />,
    )

    await user.click(screen.getByRole('button', { name: sr.form.submit }))

    expect(screen.getAllByText(sr.form.errors.required)).toHaveLength(2)

    await user.type(screen.getByLabelText(/proba.trka/), 'p')

    expect(screen.getAllByText(sr.form.errors.required), 'the other field lost its error too')
      .toHaveLength(1)
    expect(screen.queryByRole('alert'), 'the summary went with it').not.toBeNull()
  })
})

/* A form on which nothing is obligatory as it is written, and one field becomes
 * obligatory once another is answered. Nothing on the portal is built this way
 * today, which is why the second of the two faults below could not be reached
 * through the content and is measured here instead.
 *
 * The first one could be, and was: `unos-rezultata` and `prijava-sa-trke` both ask
 * for a link that a picture frees (Član 37), so a member who sent the form without
 * one, read „Ovo polje je obavezno." and then attached a picture was left with the
 * message under a field the form had stopped asking for. What kept it out of the
 * PR that found it was the risk, not the reach: `PENDING.md` records „popravka
 * dira stanje `FormRenderer`-a... izmena sa realnim rizikom regresije, a PR se
 * zatvarao". Both are held here, because a form built for the purpose can put the
 * second field's obligation on the first without any content at all. */
const askedByAnswer: FormDef = {
  id: 'proba',
  titleKey: 'proba.naslov',
  submitKey: 'form.submit',
  fields: [
    { name: 'slika', type: 'photo', labelKey: 'proba.slika' },
    {
      name: 'rec',
      type: 'text',
      labelKey: 'proba.rec',
      requiredWhenFilled: { field: 'slika' },
    },
  ],
}

/* And the other way round: obligatory as written, and let go once a picture
 * arrives, which is what Član 37 says about the link to the official results. */
const freedByPicture: FormDef = {
  id: 'proba',
  titleKey: 'proba.naslov',
  submitKey: 'form.submit',
  fields: [
    {
      name: 'veza',
      type: 'text',
      labelKey: 'proba.veza',
      required: true,
      /* A shape as well as a demand, because the two are what the filter has to
         tell apart: one goes with the demand and the other does not. */
      pattern: '^https?://.+',
      optionalWhenFilled: { field: 'slika' },
    },
    { name: 'slika', type: 'photo', labelKey: 'proba.slika' },
  ],
}

/** A picture chosen in the box of that name. */
async function attach(user: ReturnType<typeof setupUser>) {
  await user.upload(
    screen.getByLabelText(/proba.slika/),
    new File(['proba'], 'dokaz.jpg', { type: 'image/jpeg' }),
  )
}

describe('the legend that explains the star', () => {
  it('is drawn for a star that only another answer brings', async () => {
    /* Recorded 22.08.2026: the legend was read off the written definition and the
       star off `asAsked`, so a form whose only star arrives from another answer
       drew the mark and never the sentence that says what it means. Unreachable on
       the portal, because `link` is written `required: true` and the sentence
       therefore always stood. */
    const user = setupUser()

    renderWithI18n(<FormRenderer form={askedByAnswer} onSubmit={() => undefined} />)

    expect(screen.queryByText(sr.form.requiredNote)).toBeNull()

    await attach(user)

    expect(screen.getByLabelText(/proba.rec/)).toHaveAttribute('aria-required', 'true')
    expect(screen.getByText(sr.form.requiredNote)).toBeVisible()
  })
})

describe('an error that says a field is obligatory', () => {
  it('goes when the form stops asking for that field', async () => {
    /* Recorded 22.08.2026: a member sends the form without the link, is told the
       link is obligatory, and then attaches a picture, which by Član 37 lets the
       link go. The star and `aria-required` went; the red line under the box and
       the entry in the summary stayed, so the screen said in one breath that the
       field need not be answered and that it is wrong to have left it. */
    const user = setupUser()

    renderWithI18n(<FormRenderer form={freedByPicture} onSubmit={() => undefined} />)

    await user.click(screen.getByRole('button', { name: sr.form.submit }))

    const summary = screen.getByRole('alert')

    expect(within(summary).getByRole('link')).toBeVisible()
    expect(screen.getByText(sr.form.errors.required)).toBeVisible()

    await attach(user)

    expect(screen.getByLabelText(/proba.veza/), 'the field is still said to be obligatory')
      .not.toHaveAttribute('aria-required')
    expect(screen.queryByText(sr.form.errors.required), 'the message stayed').toBeNull()
    expect(screen.queryByRole('alert'), 'the summary stayed').toBeNull()
  })

  it('stays where the field is still obligatory', async () => {
    /* The other direction, and the half that would be lost by simply emptying the
       errors: a field nothing has freed is still refused, and still says so. */
    const user = setupUser()

    renderWithI18n(<FormRenderer form={freedByPicture} onSubmit={() => undefined} />)

    await user.click(screen.getByRole('button', { name: sr.form.submit }))
    await user.type(screen.getByLabelText(/proba.veza/), 'a')
    await user.clear(screen.getByLabelText(/proba.veza/))
    await user.click(screen.getByRole('button', { name: sr.form.submit }))

    expect(screen.getByText(sr.form.errors.required)).toBeVisible()
  })
})

describe('an error that is not about a field being obligatory', () => {
  it('stays after the form stops asking for that field', async () => {
    /* The half the comment over `shown` promises and nothing measured until
     23.08.2026: „a badly written address is still a badly written address". Read
     through a filter that dropped every error of a field the form no longer
     asks for, a member who typed `trka.rs/rezultati` and then attached a picture
     would press Pošalji and see nothing happen at all: the form refuses, because
     the shape is still wrong, and says so nowhere. */
    const user = setupUser()
    const sent: FormValues[] = []

    renderWithI18n(<FormRenderer form={freedByPicture} onSubmit={(one) => sent.push(one)} />)

    await user.type(screen.getByLabelText(/proba.veza/), 'trka.rs/rezultati')
    await user.click(screen.getByRole('button', { name: sr.form.submit }))

    expect(screen.getByText(sr.form.errors.pattern)).toBeVisible()

    await attach(user)

    /* No longer obligatory: the star is gone. Still wrong: the message is not. */
    expect(screen.getByLabelText(/proba.veza/)).not.toHaveAttribute('aria-required')
    expect(screen.getByText(sr.form.errors.pattern), 'the shape stopped being wrong')
      .toBeVisible()

    await user.click(screen.getByRole('button', { name: sr.form.submit }))

    expect(sent, 'the form was sent with an address it refuses').toEqual([])
  })
})

describe('the legend, once the last star goes', () => {
  it('goes with it', async () => {
    /* The other direction of the same reading, and the one a form of nothing but
       optional fields exists to prevent: a sentence explaining a mark that is not
       drawn anywhere. `freedByPicture` has exactly one obligatory field and a
       picture lets it go, so attaching one takes the last star off the form. */
    const user = setupUser()

    renderWithI18n(<FormRenderer form={freedByPicture} onSubmit={() => undefined} />)

    expect(screen.getByText(sr.form.requiredNote)).toBeVisible()

    await attach(user)

    expect(screen.queryByText(sr.form.requiredNote)).toBeNull()
  })
})
