import { screen, within } from '@testing-library/react'
import { render } from '@testing-library/react'
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

    await user.tab()

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
      screen.getByLabelText(/^Adresa za slanje$/).closest('.field')?.querySelector('.hint'),
      'the rule beside the address',
    )
    const asked = within(hint).getByRole('button', { name: 'Objašnjenje' })

    await user.hover(hint)

    expect(asked).toHaveAttribute('aria-expanded', 'true')

    await user.unhover(hint)

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

    expect(within(summary).getByRole('link', { name: 'Pol' })).toBeInTheDocument()
    expect(within(summary).getByRole('link', { name: 'Kategorija' })).toBeInTheDocument()
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
