import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ClockProvider } from '../clock/ClockProvider'
import { I18nProvider } from '../i18n/I18nProvider'
import sr from '../i18n/sr.json'
import { htmlElement, inputElement, must } from '../test/at'
import { aFailedRead } from '../test/failedRead'
import { setupUser } from '../test/user'
import { FormRenderer } from './FormRenderer'
import type { FormDef, FormValues, Suggestion, UnreadableList } from './types'

/**
 * A LIST A FIELD IS TYPED AGAINST THAT COULD NOT BE READ SAYS SO UNDER THE BOX, AND THE BOX STAYS A
 * BOX (decision of 03.10.2026, chosen between the outcomes offered, in the words of the PDL's record of
 * it and not the owner's: „Kad spisak trka na formi za rezultat ne može da se učita, uz polje stoji da
 * ne može, uz „Pokušaj ponovo"." The towns are the boundary and are held where they are typed,
 * `pages/member/racesUnreadable.test.tsx`).
 *
 * <p>This is the layer of the renderer and the box. What the sentence is and which read it is about
 * belong to the screen that hands them in, and are held on the real screen; the cases here hold what
 * the form does with what it is given: where it draws it, what it does to the box, what it does to
 * the keyboard, and that it draws nothing for a box nobody can type into.
 *
 * <p><b>The axes</b>: the field the sentence is about and a field beside it that it is not about;
 * whether the asking is out; whether the box is held; whether the list is rows or the way it failed,
 * and the box on either side of that; and where the keyboard is when the button goes (on it, on
 * another box, nowhere).
 */

const aListThatMayFail: FormDef = {
  id: 'proba',
  titleKey: 'proba.naslov',
  submitKey: 'form.submit',
  fields: [
    { name: 'trka', type: 'text', labelKey: 'proba.trka' },
    { name: 'dopisano', type: 'text', labelKey: 'proba.dopisano' },
  ],
}

const SAID = 'Spisak se ne može učitati.'

/** What the field is told about a list that failed, with the asking again counted by the case. */
function unreadable(how: Parameters<typeof aFailedRead>[0] = {}): UnreadableList {
  return { said: SAID, named: 'Trke', read: aFailedRead(how) }
}

/** The rows of a list that came. One is enough: what is held here is not what a list offers. */
const ROWS: Suggestion[] = [{ id: 'a', value: 'Probna trka', said: 'Probna trka', fills: {} }]

/** The whole form as one tree, so a case can draw it again with the list arrived. */
function stand(
  over: {
    list?: Suggestion[] | UnreadableList
    fixed?: string[]
    onSubmit?: (values: FormValues) => void
  } = {},
) {
  return (
    <ClockProvider>
      <I18nProvider locale="sr">
        <FormRenderer
          form={aListThatMayFail}
          suggests={over.list === undefined ? undefined : { trka: over.list }}
          fixed={over.fixed}
          onSubmit={over.onSubmit ?? (() => undefined)}
        />
      </I18nProvider>
    </ClockProvider>
  )
}

const box = (name: RegExp) => inputElement(screen.getByLabelText(name))
const fieldOf = (control: HTMLElement) => htmlElement(must(control.closest('.field'), 'the field around it'))
const RETRY = new RegExp(sr.data.retry)

describe('a list that could not be read, in the form', () => {
  it('is said under the box it is about, after it, and nowhere beside it, with a button named after the list', () => {
    render(stand({ list: unreadable() }))

    const about = box(/proba.trka/)
    const field = within(fieldOf(about))
    const said = field.getByRole('alert')

    expect(said).toHaveTextContent(SAID)
    expect(field.getByRole('button', { name: `${sr.data.retry}: Trke` })).toBeVisible()
    /* After the box and not inside it. */
    expect(about.contains(said)).toBe(false)
    expect(about.compareDocumentPosition(said) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    /* And before the box next to it, which is the other box this sentence is not about. */
    expect(said.compareDocumentPosition(box(/proba.dopisano/)) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    /* One of each on the page, so the field beside it is quiet. */
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: RETRY })).toHaveLength(1)
    expect(within(fieldOf(box(/proba.dopisano/))).queryByRole('alert')).toBeNull()
  })

  it('says nothing when the list came, with rows or without', () => {
    const { rerender } = render(stand({ list: ROWS }))

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: RETRY })).toBeNull()

    rerender(stand({ list: [] }))

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: RETRY })).toBeNull()
  })

  it('goes on taking what is typed into the box, and sends it', async () => {
    const sent = vi.fn()

    render(stand({ list: unreadable(), onSubmit: sent }))

    const user = setupUser()
    const about = box(/proba.trka/)

    /* A box held would be readOnly and say so; this one is typed into. */
    expect(about).not.toHaveAttribute('readonly')
    expect(about).not.toHaveAttribute('aria-disabled')
    await user.type(about, 'Maraton maratona')

    expect(about).toHaveValue('Maraton maratona')
    /* Nothing is offered by a list that did not come: the only buttons on the page are the way to
       ask again and the one that sends. */
    expect(screen.getAllByRole('button').map((one) => one.textContent)).toEqual([
      sr.data.retry,
      sr.form.submit,
    ])

    await user.click(screen.getByRole('button', { name: sr.form.submit }))

    expect(sent).toHaveBeenCalledTimes(1)
    expect(sent.mock.calls[0]?.[0]).toMatchObject({ trka: 'Maraton maratona' })
  })

  it('is the same box on either side of the failure, so a reader who was in it is not moved', () => {
    const { rerender } = render(stand({ list: unreadable() }))
    const before = box(/proba.trka/)

    rerender(stand({ list: [] }))

    expect(box(/proba.trka/), 'the box was drawn again as another element when the list came').toBe(before)
  })

  it('is not drawn for a box that is held, because nothing is typed into it', () => {
    render(stand({ list: unreadable(), fixed: ['trka'] }))

    expect(box(/proba.trka/)).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: RETRY })).toBeNull()
  })
})

describe('the button that asks the list again', () => {
  it('asks once per press, through the read it was given', async () => {
    const readAgain = vi.fn()

    render(stand({ list: unreadable({ readAgain }) }))
    await setupUser().click(screen.getByRole('button', { name: RETRY }))

    expect(readAgain).toHaveBeenCalledTimes(1)
  })

  it('says it is asking while the asking is out, and refuses a press without leaving the tab order', async () => {
    const readAgain = vi.fn()

    render(stand({ list: unreadable({ readAgain, reading: true }) }))

    const button = screen.getByRole('button', { name: RETRY })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(within(fieldOf(box(/proba.trka/))).getByText(sr.data.loading)).toBeVisible()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()

    await setupUser().click(button)

    expect(readAgain, 'a press went through while the asking was out').not.toHaveBeenCalled()
  })
})

describe('where the keyboard is when the button goes because the asking worked', () => {
  it('goes back to the box, which is where the reader was working, when the button had it', () => {
    const { rerender } = render(stand({ list: unreadable() }))

    screen.getByRole('button', { name: RETRY }).focus()
    rerender(stand({ list: ROWS }))

    expect(screen.queryByRole('button', { name: RETRY })).toBeNull()
    expect(box(/proba.trka/), 'the keyboard was left on the body when the button went').toHaveFocus()
  })

  it('does not go there for a reader who was on another box', () => {
    const { rerender } = render(stand({ list: unreadable() }))

    box(/proba.dopisano/).focus()
    rerender(stand({ list: ROWS }))

    expect(box(/proba.dopisano/)).toHaveFocus()
  })

  it('does not go there for a press that never had the keyboard on the button', () => {
    const { rerender } = render(stand({ list: unreadable() }))

    fireEvent.click(screen.getByRole('button', { name: RETRY }))
    rerender(stand({ list: ROWS }))

    expect(document.body).toHaveFocus()
  })

  it('goes there once, and a later drawing does not take the keyboard back from where the reader went', () => {
    const { rerender } = render(stand({ list: unreadable() }))

    screen.getByRole('button', { name: RETRY }).focus()
    rerender(stand({ list: ROWS }))
    expect(box(/proba.trka/)).toHaveFocus()

    box(/proba.dopisano/).focus()
    rerender(stand({ list: ROWS }))

    expect(box(/proba.dopisano/), 'the keyboard was taken back to the box on a drawing that changed nothing').toHaveFocus()
  })
})
