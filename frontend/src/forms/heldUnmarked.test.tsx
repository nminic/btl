import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import sr from '../i18n/sr.json'
import { must } from '../test/at'
import { renderWithI18n } from '../test/render'
import { setupUser } from '../test/user'
import { FormRenderer } from './FormRenderer'
import type { FormDef } from './types'

/**
 * THE HELD FIELDS OF A FORM THAT SAYS SO CARRY NO MARK (PDL, „Na formi „Podaci" zaključana polja", owner,
 * 06.11.2026): „ne nose nikakvu oznaku, ni zvezdicu ni „(neobavezno)", jer ih član ne može popuniti."
 *
 * <p>One form with a held field of every kind that draws its name in a different branch of the renderer
 * (a plain box, a group of buttons, a day), each held, one of them empty, and a live obligatory box beside
 * them so that "no star anywhere" can never be what is satisfied. Asked with the prop and without it, because
 * the renderer is shared and every other form that holds a field (`NewResult`, the events, the
 * administration's form of a member) must draw it as it always did.
 */
const form: FormDef = {
  id: 'held-unmarked',
  titleKey: 'held.title',
  submitKey: 'form.submit',
  fields: [
    { name: 'name', type: 'text', labelKey: 'held.name', required: true },
    { name: 'father', type: 'text', labelKey: 'held.father', required: true },
    { name: 'document', type: 'text', labelKey: 'held.document', required: true },
    {
      name: 'gender',
      type: 'choice',
      labelKey: 'held.gender',
      required: true,
      options: [
        { value: 'M', labelKey: 'held.male' },
        { value: 'F', labelKey: 'held.female' },
      ],
    },
    { name: 'born', type: 'date', labelKey: 'held.born', required: true },
    { name: 'phone', type: 'text', labelKey: 'held.phone' },
  ],
}

const HELD = ['father', 'document', 'gender', 'born']
const INITIAL = { name: 'Ana', father: 'Petar', gender: 'M', born: '01/01/1980' }

function draw(unmarked: boolean, onSubmit = vi.fn()) {
  renderWithI18n(
    <FormRenderer
      form={form}
      initial={INITIAL}
      fixed={HELD}
      fixedUnmarked={unmarked || undefined}
      onSubmit={onSubmit}
    />,
  )

  return onSubmit
}

function fieldOf(label: RegExp, role: 'textbox' | 'radiogroup'): HTMLElement {
  return must(screen.getByRole(role, { name: label }).closest('.field'), `the field of ${String(label)}`)
}

describe('a held field of a form that asks for it carries no mark', () => {
  it('has no star, no word and no aria-required on any held kind, and keeps them on the free ones', () => {
    draw(true)

    for (const [label, role] of [
      [/held\.father/, 'textbox'],
      [/held\.document/, 'textbox'],
      [/held\.gender/, 'radiogroup'],
      [/held\.born/, 'textbox'],
    ] as const) {
      const field = fieldOf(label, role)

      expect(within(field).queryByText('*'), `star on ${String(label)}`).toBeNull()
      expect(field.textContent, `word on ${String(label)}`).not.toContain('neobavezno')
      expect(
        screen.getByRole(role, { name: label }),
        `aria-required on ${String(label)}`,
      ).not.toHaveAttribute('aria-required')
    }

    /* And the free ones are as they were: the obligatory name has its star, the free phone its word. */
    expect(within(fieldOf(/held\.name/, 'textbox')).getByText('*')).toBeInTheDocument()
    expect(fieldOf(/held\.phone/, 'textbox').textContent).toContain('neobavezno')
  })

  it('draws every held field marked as it was where the form does not ask for it', () => {
    draw(false)

    expect(within(fieldOf(/held\.father/, 'textbox')).getByText('*')).toBeInTheDocument()
    expect(within(fieldOf(/held\.gender/, 'radiogroup')).getByText('*')).toBeInTheDocument()
    expect(within(fieldOf(/held\.born/, 'textbox')).getByText('*')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /held\.father/ })).toHaveAttribute('aria-required', 'true')
  })

  it('does not let an empty held field keep the press from going', async () => {
    const user = setupUser()
    const sent = draw(true)

    /* `document` is held, obligatory in the definition and empty. */
    await user.click(screen.getByRole('button', { name: sr.form.submit }))

    expect(sent).toHaveBeenCalledTimes(1)
  })

  it('still refuses the press for a free obligatory field left empty, so the case above measures something', async () => {
    const user = setupUser()
    const sent = vi.fn()

    renderWithI18n(
      <FormRenderer
        form={form}
        initial={{ ...INITIAL, name: '' }}
        fixed={HELD}
        fixedUnmarked
        onSubmit={sent}
      />,
    )
    await user.click(screen.getByRole('button', { name: sr.form.submit }))

    expect(sent).not.toHaveBeenCalled()
  })

  it('keeps refusing an empty held field where the form does not ask for the marks to go', async () => {
    const user = setupUser()
    const sent = draw(false)

    await user.click(screen.getByRole('button', { name: sr.form.submit }))

    expect(sent).not.toHaveBeenCalled()
  })
})
