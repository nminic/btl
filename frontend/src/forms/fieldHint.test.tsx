import { screen, within } from '@testing-library/react'
import { fireEvent, render } from '@testing-library/react'
import { ClockProvider } from '../clock/ClockProvider'
import { I18nProvider } from '../i18n/I18nProvider'
import registracija from './definitions/registracija.form.json'
import { FormRenderer } from './FormRenderer'
import type { FormDef } from './types'
import { must } from '../test/at'
import { setupUser } from '../test/user'

/**
 * The rule a field carries, asked for rather than printed under it.
 *
 * Owner, 11.08.2026: „Svuda ćemo koristiti tooltip". What must not change with
 * it is that the rule is still read out with the field: a rule only sighted
 * people have is a rule half the people filling in the form do not.
 */
function renderForm() {
  render(
    <ClockProvider simulatedDay={null}>
      <I18nProvider locale="sr">
        <FormRenderer form={registracija as FormDef} onSubmit={() => {}} />
      </I18nProvider>
    </ClockProvider>,
  )
}

describe('the rule beside a field', () => {
  it('is not printed on the page, and is still what the field is described by', () => {
    renderForm()

    const address = screen.getByLabelText(/^Adresa za slanje$/)
    const said = address.getAttribute('aria-describedby')

    expect(said).toBe('field-address-hint')

    const rule = document.getElementById('field-address-hint')

    expect(rule).toHaveTextContent(/Ulica i broj/)
    /* In the document and out of sight: `clip-path` rather than `display: none`,
       which would take it out of the accessibility tree and with it the rule.
       jsdom applies no stylesheet, so what is held here is the shape that makes
       that possible, not the pixels. */
    expect(rule).toHaveClass('hint__text')
  })

  it('is closed by Escape pressed anywhere, while the pointer stays put', async () => {
    /* The case the whole rule exists for (WCAG 2.2 SC 1.4.13): somebody typing
       into a field with the pointer resting on the letter beside another one.
       The press goes to the field, not to the button, so a handler on the button
       never hears it and the box stayed open under a pointer that had not moved.
       SC 1.4.13 asks that it can be put away without moving either. */
    const user = setupUser()
    renderForm()

    const hint = must(
      screen
        .getByLabelText(/^Mesto$/)
        .closest('.field')
        ?.querySelector<HTMLElement>('.hint'),
      'the rule beside the town',
    )
    const asked = within(hint).getByRole('button', { name: 'Objašnjenje' })

    /* The keyboard goes first and stays where it is: pressing anything after
       this is pressing it into the field, not into the button. */
    await user.click(screen.getByLabelText(/^Adresa za slanje$/))
    await user.hover(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText(/^Adresa za slanje$/)).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(asked).toHaveAttribute('aria-expanded', 'false')
    /* And neither the pointer nor the keyboard was moved to do it, which is the
       whole of what SC 1.4.13 asks. */
    expect(screen.getByLabelText(/^Adresa za slanje$/)).toHaveFocus()
  })

  it('stays open under a pointer that leaves while the keyboard is on it', async () => {
    /* Two reasons hold it open and they are counted apart: taking the pointer
       away must not close what the focus is still holding. */
    const user = setupUser()
    renderForm()

    const hint = must(
      screen
        .getByLabelText(/^Mesto$/)
        .closest('.field')
        ?.querySelector<HTMLElement>('.hint'),
      'the rule beside the town',
    )
    const asked = within(hint).getByRole('button', { name: 'Objašnjenje' })

    await user.click(asked)
    await user.unhover(asked)

    expect(asked).toHaveFocus()
    expect(asked).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens on the button beside the field, and closes on leaving it', async () => {
    /* A press opens it and so does arriving with the keyboard. It does not
       close on a second press: a press is also an arrival, so a toggle would
       fight the focus the same press brings and the two would end where they
       started. */
    const user = setupUser()
    renderForm()

    const asked = within(
      screen.getByLabelText(/^Adresa za slanje$/).closest('.field') ?? document.body,
    ).getByRole('button', { name: 'Objašnjenje' })

    expect(asked).toHaveAttribute('aria-expanded', 'false')

    await user.click(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')

    /* Both reasons have to go: the press left the keyboard on it and the press
       left the pointer on it too. */
    await user.tab()
    await user.unhover(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on Escape, and lets nothing else have that press', async () => {
    /* A form inside a sheet would otherwise close the sheet with the same press
       that closes this. */
    const user = setupUser()
    let outside = 0

    render(
      <ClockProvider simulatedDay={null}>
        <I18nProvider locale="sr">
          <div onKeyDown={() => (outside += 1)}>
            <FormRenderer form={registracija as FormDef} onSubmit={() => {}} />
          </div>
        </I18nProvider>
      </ClockProvider>,
    )

    const asked = within(
      screen.getByLabelText(/^Adresa za slanje$/).closest('.field') ?? document.body,
    ).getByRole('button', { name: 'Objašnjenje' })

    await user.click(asked)

    /* Another key first: it is not this button's business and goes on its way,
       so whatever the form is standing in still hears it. */
    await user.keyboard('a')

    expect(asked).toHaveAttribute('aria-expanded', 'true')
    expect(outside).toBe(1)

    await user.keyboard('{Escape}')

    expect(asked).toHaveAttribute('aria-expanded', 'false')
    /* And Escape got no further than this. */
    expect(outside).toBe(1)
  })

  it('opens under the pointer and closes when it leaves', async () => {
    /* A tooltip is a thing a pointer asks for by resting on it. Held on the
       wrapper rather than on the letter, so that reaching down for the words
       does not close them on the way (WCAG 2.2 SC 1.4.13). */
    const user = setupUser()
    renderForm()

    const hint = must(
      screen
        .getByLabelText(/^Adresa za slanje$/)
        .closest('.field')
        ?.querySelector<HTMLElement>('.hint'),
      'the rule beside the address',
    )
    const asked = within(hint).getByRole('button', { name: 'Objašnjenje' })

    await user.hover(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')

    /* And the words themselves hold it open, so they can be read to the end and
       taken: the pointer travels from the letter into them without the box
       closing under it (WCAG 2.2 SC 1.4.13, hoverable). */
    await user.hover(within(hint).getByText(/Ulica i broj/))

    expect(asked).toHaveAttribute('aria-expanded', 'true')

    await user.unhover(within(hint).getByText(/Ulica i broj/))

    expect(asked).toHaveAttribute('aria-expanded', 'false')
  })

  it('says which field it is about without taking that field its name', () => {
    /* „Objašnjenje: Pol" would put the name of the field into the name of the
       button, and then every way of finding a control by its name finds two. */
    renderForm()

    const asked = within(
      screen.getByLabelText(/^Adresa za slanje$/).closest('.field') ?? document.body,
    ).getByRole('button', { name: 'Objašnjenje' })

    expect(asked).toHaveAttribute('aria-describedby', 'field-address-label')
    expect(document.getElementById('field-address-label')).toHaveTextContent('Adresa za slanje')
  })
})

describe('the rule of a field, once it is open', () => {
  it('is put away by Escape even when the keyboard is standing on it', async () => {
    /* The half of Escape that the button itself answers, so that a form inside
       a sheet is not closed by the same press. */
    const user = setupUser()
    renderForm()

    const asked = within(
      must(
        screen.getByLabelText(/^Mesto$/).closest<HTMLElement>('.field'),
        'the field of the town',
      ),
    ).getByRole('button', { name: 'Objašnjenje' })

    await user.click(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')

    expect(asked).toHaveAttribute('aria-expanded', 'false')
  })

  it('is asked for again after it was put away', async () => {
    /* Escape puts it away and nothing more: the next time the pointer or the
       keyboard arrives, it is a new asking. */
    const user = setupUser()
    renderForm()

    const asked = within(
      must(
        screen.getByLabelText(/^Mesto$/).closest<HTMLElement>('.field'),
        'the field of the town',
      ),
    ).getByRole('button', { name: 'Objašnjenje' })

    await user.click(asked)
    await user.keyboard('{Escape}')
    await user.unhover(asked)
    await user.hover(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('what nothing else was holding', () => {
  it('lets the summary of errors put the cursor inside the group', () => {
    /* A group is not focusable of itself, so following the link only scrolled:
       the keyboard stayed where it was, which is not what a list of things to
       fix promises. */
    renderForm()

    const group = screen.getByRole('group', { name: 'Pol' })

    expect(group).toHaveAttribute('tabindex', '-1')

    group.focus()

    expect(group).toHaveFocus()
  })

  it('keeps the letter out of what is read aloud', () => {
    /* The button is named „Objašnjenje" and shows „i". A control whose visible
       words are not in its name cannot be spoken to (WCAG 2.2 SC 2.5.3), so the
       letter is a drawing as far as a screen reader is concerned. */
    renderForm()

    const asked = within(
      must(
        screen.getByLabelText(/^Mesto$/).closest<HTMLElement>('.field'),
        'the field of the town',
      ),
    ).getByRole('button', { name: 'Objašnjenje' })

    expect(asked).toHaveAccessibleName('Objašnjenje')
    expect(must(asked.querySelector('span'), 'the letter drawn in it')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  it('asks for the rule again when the keyboard arrives after Escape', () => {
    renderForm()

    const asked = within(
      must(
        screen.getByLabelText(/^Mesto$/).closest<HTMLElement>('.field'),
        'the field of the town',
      ),
    ).getByRole('button', { name: 'Objašnjenje' })

    fireEvent.focus(asked)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(asked).toHaveAttribute('aria-expanded', 'false')

    fireEvent.blur(asked)
    fireEvent.focus(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('two rules standing side by side', () => {
  it('does not leave one open when the pointer sweeps into the other', () => {
    /* Two fields do stand next to each other in a row: „Adresa elektronske
       pošte" and „Lozinka" are sixteen pixels apart, and a pointer sweeping from
       the open words of one into the letter of the other is one sample of
       movement. Asked whether it was still in „a hint" rather than in this one,
       the first stayed open with nothing holding it. */
    renderForm()

    const letterOf = (label: RegExp) =>
      within(
        must(
          screen.getByLabelText(label).closest<HTMLElement>('.field'),
          'the field of that name',
        ),
      ).getByRole('button', { name: 'Objašnjenje' })

    const mail = letterOf(/^Adresa elektronske pošte$/)
    const password = letterOf(/^Lozinka$/)

    fireEvent.mouseOver(mail)

    expect(mail).toHaveAttribute('aria-expanded', 'true')

    fireEvent.mouseOut(mail, { relatedTarget: password })
    fireEvent.mouseOver(password, { relatedTarget: mail })

    expect(mail).toHaveAttribute('aria-expanded', 'false')
    expect(password).toHaveAttribute('aria-expanded', 'true')
  })

  it('is put away by one Escape, however many are open', () => {
    /* The press is heard on the way down, so every hint that is open hears it,
       and it is stopped before it reaches whatever the form is standing in. */
    renderForm()

    const letterOf = (label: RegExp) =>
      within(
        must(
          screen.getByLabelText(label).closest<HTMLElement>('.field'),
          'the field of that name',
        ),
      ).getByRole('button', { name: 'Objašnjenje' })

    const mail = letterOf(/^Adresa elektronske pošte$/)
    const password = letterOf(/^Lozinka$/)

    fireEvent.mouseOver(mail)
    fireEvent.focus(password)

    expect(mail).toHaveAttribute('aria-expanded', 'true')
    expect(password).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(mail).toHaveAttribute('aria-expanded', 'false')
    expect(password).toHaveAttribute('aria-expanded', 'false')
  })

  it('stays put away while the pointer only stirs inside the same letter', () => {
    /* Escape leaves the pointer where it is, and `mouseover` bubbles out of the
       letter drawn inside the button: a hair of movement over twenty four pixels
       brought back what had just been put away. */
    renderForm()

    const asked = within(
      must(
        screen.getByLabelText(/^Mesto$/).closest<HTMLElement>('.field'),
        'the field of the town',
      ),
    ).getByRole('button', { name: 'Objašnjenje' })
    const drawn = must(asked.querySelector('span'), 'the letter drawn in it')

    fireEvent.mouseOver(asked)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(asked).toHaveAttribute('aria-expanded', 'false')

    fireEvent.mouseOut(asked, { relatedTarget: drawn })
    fireEvent.mouseOver(asked, { relatedTarget: drawn })

    expect(asked).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('the pointer leaving the rule of a field', () => {
  it('closes it when the pointer leaves the window entirely', () => {
    /* Then there is nowhere it went: `relatedTarget` is null, which is not an
       element and so is not this hint either. Dispatched rather than acted,
       because leaving a window is not something a person does inside one. */
    renderForm()

    const hint = must(
      screen
        .getByLabelText(/^Mesto$/)
        .closest('.field')
        ?.querySelector<HTMLElement>('.hint'),
      'the rule beside the town',
    )
    const asked = within(hint).getByRole('button', { name: 'Objašnjenje' })

    fireEvent.mouseOver(asked)

    expect(asked).toHaveAttribute('aria-expanded', 'true')

    fireEvent.mouseOut(asked, { relatedTarget: null })

    expect(asked).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes it when the pointer goes to something that is not a hint', () => {
    renderForm()

    const hint = must(
      screen
        .getByLabelText(/^Mesto$/)
        .closest('.field')
        ?.querySelector<HTMLElement>('.hint'),
      'the rule beside the town',
    )
    const asked = within(hint).getByRole('button', { name: 'Objašnjenje' })

    fireEvent.mouseOver(asked)
    fireEvent.mouseOut(asked, { relatedTarget: screen.getByLabelText(/^Mesto$/) })

    expect(asked).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps it open while the pointer moves from the words back to the letter', () => {
    /* The other direction of the same journey: both halves ask about the hint
       they stand in, not about themselves. */
    renderForm()

    const hint = must(
      screen
        .getByLabelText(/^Mesto$/)
        .closest('.field')
        ?.querySelector<HTMLElement>('.hint'),
      'the rule beside the town',
    )
    const asked = within(hint).getByRole('button', { name: 'Objašnjenje' })
    const words = must(hint.querySelector<HTMLElement>('.hint__text'), 'the words of the rule')

    fireEvent.mouseOver(asked)
    fireEvent.mouseOut(asked, { relatedTarget: words })
    fireEvent.mouseOver(words)
    fireEvent.mouseOut(words, { relatedTarget: asked })

    expect(asked).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('a link inside the words of a field', () => {
  it('leads to the rules, in the language the form is being read in', () => {
    /* The confirmation says what is being agreed to and points at it (owner,
       11.08.2026). The address carries no language of its own in the definition:
       it is added here, from the page (ADL A2). */
    renderForm()

    const toRules = screen.getByRole('link', { name: 'pravilnikom' })

    expect(toRules).toHaveAttribute('href', '/sr/pravilnik')
    /* In a tab of its own, or following it would throw away a form that is half
       filled in. */
    expect(toRules).toHaveAttribute('target', '_blank')
  })

  it('keeps the sentence whole when a translation drops the mark', () => {
    /* „{link}" is the sort of thing that goes missing when somebody translates
       from the Serbian, and the dictionary guard cannot see it: the key resolves
       either way. What must not happen is the link sliding to the end of a
       sentence it belongs in the middle of. */
    render(
      <ClockProvider simulatedDay={null}>
        <I18nProvider locale="sr">
          <FormRenderer
            form={{
              id: 'proba',
              titleKey: 'proba.naslov',
              submitKey: 'proba.posalji',
              fields: [
                {
                  name: 'saglasnost',
                  type: 'checkbox',
                  labelKey: 'proba.bezOznake',
                  linkKey: 'proba.veza',
                  linkTo: 'pravilnik',
                },
              ],
            }}
            onSubmit={() => {}}
          />
        </I18nProvider>
      </ClockProvider>,
    )

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('proba.bezOznake')).toBeInTheDocument()
  })
})

describe('an answer chosen from buttons', () => {
  /* Owner, 11.08.2026: sex and category are buttons rather than lists, nothing
     is chosen to begin with, and exactly one must be. */
  it('starts with neither taken, and takes one at a time', async () => {
    const user = setupUser()
    renderForm()

    const male = screen.getByRole('radio', { name: 'Muški' })
    const female = screen.getByRole('radio', { name: 'Ženski' })

    expect(male).not.toBeChecked()
    expect(female).not.toBeChecked()

    await user.click(female)

    expect(female).toBeChecked()
    expect(male).not.toBeChecked()

    /* And it works as a switch: pressing the other one takes the first off. */
    await user.click(male)

    expect(male).toBeChecked()
    expect(female).not.toBeChecked()
  })

  it('is a group with a name of its own, and its rule is on the group', () => {
    renderForm()

    const group = screen.getByRole('group', { name: 'Pol' })

    expect(within(group).getAllByRole('radio')).toHaveLength(2)
    expect(screen.getByRole('radio', { name: 'Muški' })).toHaveAttribute(
      'aria-describedby',
      'field-gender-hint',
    )
  })

  it('refuses to go through with neither taken, and says which group is missing', async () => {
    const user = setupUser()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    const summary = screen.getByRole('alert')

    const toSex = within(summary).getByRole('link', { name: 'Pol' })

    expect(toSex).toBeInTheDocument()
    expect(within(summary).getByRole('link', { name: 'Kategorija' })).toBeInTheDocument()

    /* And it leads somewhere. Every other field is reached through its own
       control, which carries the id the summary points at; a group has no one
       control, so without an id of its own the link „Pol" pointed at nothing,
       and these two are the likeliest errors on this form. */
    const at = must(toSex.getAttribute('href'), 'the address the summary points at')

    expect(document.getElementById(at.replace('#', ''))).toBeInTheDocument()
  })
})

describe('a form laid out in rows', () => {
  it('puts the fields of one row together, and leaves the rest on their own', () => {
    /* Owner, 11.08.2026: on a wide screen the registration form is rows, and on
       a telephone every field keeps a line of its own. What is held here is the
       grouping; the width at which it stops is CSS and is held by
       styles/scale.test.ts. */
    renderForm()

    const first = must(
      screen.getByLabelText(/^Ime$/).closest<HTMLElement>('.form__row'),
      'the row the first name stands in',
    )

    /* Four rows: name and sex and birthday; the way in; where they live; the
       category and the shirt. */
    expect(document.querySelectorAll('.form__row')).toHaveLength(4)
    expect(within(first).getByLabelText(/^Ime$/)).toBeInTheDocument()
    expect(within(first).getByRole('group', { name: 'Pol' })).toBeInTheDocument()
    /* And what a row of four is, said to the stylesheet rather than written into
       it: the renderer counts the columns. */
    expect(first).toHaveStyle({ '--columns': '4' })

    /* The row of the address is two fields and three columns, because the town
       carries the country beside it. */
    const third = must(
      screen.getByLabelText(/^Adresa za slanje$/).closest<HTMLElement>('.form__row'),
      'the row the address stands in',
    )

    expect(third).toHaveStyle({ '--columns': '3' })

    /* „Svojim rečima" and the confirmation stand alone, as every field on every
       other form does. */
    expect(screen.getByLabelText(/Svojim rečima/).closest('.form__row')).toBeNull()
  })
})
