import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { theMembersForm } from '../pages/profile/memberData'
import { renderWithI18n } from '../test/render'
import { setupUser } from '../test/user'
import { FORMS } from './definitions'
import { FormRenderer } from './FormRenderer'
import type { FormDef, FormValues } from './types'

/**
 * WHAT THE RENDERER TELLS THE SCREEN AS IT IS TYPED INTO (`onChange`), AND WHICH OF ITS FIELDS A SENTENCE
 * OF THE SCREEN DESCRIBES (`fixedSaidBy`): the two props the member's own panel of his data hands it since
 * it took the registration's shape (PDL 06.11.2026, „Profil: forma „Podaci" po obliku forme za prijavu").
 *
 * <p>What the panel does with them is asked of the panel (`pages/member/personalDataAsTheRegistration.test.tsx`,
 * `heldFields.test.tsx`). What is asked here is what only the renderer can be asked: what it hands over and
 * when, which fields it describes, and that a form which hands neither is drawn as it always was.
 */

const asked: FormDef = {
  id: 'proba',
  titleKey: 'proba.naslov',
  submitKey: 'form.submit',
  fields: [
    { name: 'ime', type: 'text', labelKey: 'proba.ime', hintKey: 'proba.imePravilo' },
    { name: 'oca', type: 'text', labelKey: 'proba.oca' },
    { name: 'datum', type: 'date', labelKey: 'proba.datum' },
    {
      name: 'pol',
      type: 'choice',
      labelKey: 'proba.pol',
      options: [
        { value: 'M', labelKey: 'proba.m' },
        { value: 'F', labelKey: 'proba.f' },
      ],
    },
  ],
}

function describedBy(control: HTMLElement): string[] {
  return (control.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
}

describe('the screen told what is on the form', () => {
  it('is told nothing when the form opens, and everything on it at every move, as it was typed', async () => {
    const user = setupUser()
    const onChange = vi.fn<(values: FormValues) => void>()

    renderWithI18n(
      <FormRenderer form={asked} onSubmit={vi.fn()} initial={{ ime: 'Stari', oca: 'Petar' }} onChange={onChange} />,
    )

    expect(onChange).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/proba.ime/), 'x')

    /* What is on the screen and not what the form opened with, and every field of it, the untouched ones
       included: a screen that compared the opening values would find nothing changed. */
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ ime: 'Starix', oca: 'Petar' }))

    await user.click(screen.getByRole('radio', { name: 'proba.f' }))

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ ime: 'Starix', pol: 'F' }))
  })

  it('is told nothing when a held field is typed into, since nothing on the screen moved', async () => {
    const user = setupUser()
    const onChange = vi.fn<(values: FormValues) => void>()

    renderWithI18n(
      <FormRenderer form={asked} onSubmit={vi.fn()} initial={{ oca: 'Petar' }} fixed={['oca']} onChange={onChange} />,
    )

    await user.type(screen.getByLabelText(/proba.oca/), 'abc')

    expect(screen.getByLabelText(/proba.oca/)).toHaveValue('Petar')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('the sentence that says why the held fields are held', () => {
  const SAID = 'zasto-drzano'

  it('describes every held field, whatever it is drawn as, after its own rule, and no field that is not held', () => {
    renderWithI18n(
      <FormRenderer
        form={asked}
        onSubmit={vi.fn()}
        initial={{ datum: '1980-04-02', pol: 'M' }}
        fixed={['ime', 'datum', 'pol']}
        fixedSaidBy={SAID}
        above={<p id={SAID}>Ovo menja administracija.</p>}
      />,
    )

    const name = screen.getByLabelText(/proba.ime/)

    /* After the rule the field carries, which says what it is for, and before nothing else. */
    expect(describedBy(name)).toEqual(['field-ime-hint', SAID])
    expect(describedBy(screen.getByRole('textbox', { name: /proba.datum/ }))).toContain(SAID)

    for (const one of within(screen.getByRole('radiogroup', { name: /proba.pol/ })).getAllByRole('radio')) {
      expect(describedBy(one)).toContain(SAID)
    }

    expect(describedBy(screen.getByLabelText(/proba.oca/))).not.toContain(SAID)
  })

  it('adds nothing to any field where the screen hands none, held or not', () => {
    renderWithI18n(<FormRenderer form={asked} onSubmit={vi.fn()} fixed={['ime', 'oca']} />)

    expect(describedBy(screen.getByLabelText(/proba.ime/))).toEqual(['field-ime-hint'])
    expect(screen.getByLabelText(/proba.oca/)).not.toHaveAttribute('aria-describedby')
  })
})

/**
 * <p><b>Every other form of the portal is drawn as it was</b>: none of them hands either prop, and none of
 * them has its button held while nothing was typed into it, the registration and the administration's form
 * of a member's data, opened already filled, among them. A renderer that held the button of a form whose
 * fields still say what they opened with would hold all of them.
 */
describe('a form that hands neither', () => {
  it.each([...Object.values(FORMS).map((form): [string, FormDef] => [form.id, form]), ['podaci-clana', theMembersForm(true)]])(
    'has its button live when it opens, %s',
    (_, form) => {
      renderWithI18n(<FormRenderer form={form} onSubmit={vi.fn()} initial={{ firstName: 'Vladan' }} />)

      const sends = screen.getAllByRole('button').filter((one) => one.getAttribute('type') === 'submit')

      expect(sends, 'the form has its one button that sends').toHaveLength(1)
      expect(sends[0]).not.toHaveAttribute('aria-disabled')
    },
  )
})
