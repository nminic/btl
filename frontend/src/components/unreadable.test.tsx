import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Locale } from '../i18n/config'
import en from '../i18n/en.json'
import { I18nProvider } from '../i18n/I18nProvider'
import sr from '../i18n/sr.json'
import { setupUser } from '../test/user'
import { Unreadable } from './Unreadable'

/**
 * A LIST THAT COULD NOT BE READ, SAID AS THAT (decision of 02.10.2026, PENDING stavka 368, in the
 * words of the PDL's record of it and not the owner's: „Spisak koji ne moze da se ucita KAZE to,
 * umesto da izgleda prazan, uz dugme „Pokusaj ponovo"").
 *
 * <p>The component is the one place the sentence and the button come together, so every screen
 * that used to draw a failed read as an empty list says it the same way. What differs between
 * them is only which list it is about, and that is what is handed in: the sentence, and the name
 * of the list the button asks again for.
 *
 * <p><b>Two states and not one</b>: while the asking again is out the sentence is replaced by the
 * loader's own word, and when it comes back and fails again the sentence is a NEW alert, which is
 * what tells the reader the press was answered (WCAG 2.2 SC 4.1.3). The button is told off while
 * the request is out and not switched off, for the reason `member/ProfilePicture.tsx` gives: a
 * disabled control leaves the tab order and the browser drops a keyboard reader to the top of the
 * page.
 */
function shown(
  props: Partial<Parameters<typeof Unreadable>[0]> = {},
  locale: Locale = 'sr',
) {
  const onRetry = vi.fn()

  render(
    <I18nProvider locale={locale}>
      <Unreadable said="Spisak se ne može učitati." named="Poruke" reading={false} onRetry={onRetry} {...props} />
    </I18nProvider>,
  )

  return onRetry
}

describe('a list that could not be read', () => {
  it('says so as an alert, with a button that names the list it asks again for', () => {
    shown()

    expect(screen.getByRole('alert')).toHaveTextContent('Spisak se ne može učitati.')
    /* The visible word first and the list after it, so the name contains the label (WCAG 2.2 SC
       2.5.3) and two of these on one screen are told apart. */
    expect(screen.getByRole('button', { name: `${sr.data.retry}: Poruke` })).toHaveTextContent(
      sr.data.retry,
    )
  })

  it('asks again when the button is pressed', async () => {
    const onRetry = shown()

    await setupUser().click(screen.getByRole('button', { name: /Pokušaj ponovo/ }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('says it is asking while the request is out, and refuses a press without leaving the tab order', async () => {
    const onRetry = shown({ reading: true })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(sr.data.loading)

    const button = screen.getByRole('button', { name: /Pokušaj ponovo/ })

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()

    await setupUser().click(button)

    expect(onRetry, 'a press went through while the request was out').not.toHaveBeenCalled()
  })

  it('carries no aria-disabled when it is not asking', () => {
    shown()

    expect(screen.getByRole('button', { name: /Pokušaj ponovo/ })).not.toHaveAttribute('aria-disabled')
  })

  it('says the same in English', () => {
    shown({ said: 'The list cannot be read.', named: 'Messages' }, 'en')

    expect(screen.getByRole('alert')).toHaveTextContent('The list cannot be read.')
    expect(screen.getByRole('button', { name: `${en.data.retry}: Messages` })).toBeVisible()
  })

  it('is named by its own word when nothing names the list', () => {
    shown({ named: undefined })

    /* A whole screen that failed, or a part with no name, has nothing to say which list it is about,
       and a label that carried an empty one would be a button called „Pokušaj ponovo: ". */
    expect(screen.getByRole('button', { name: sr.data.retry })).toBeVisible()
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-label')
  })
})

/**
 * THE ALERT OF A SECOND FAILURE IS A NEW ELEMENT, AND THE ONE THE FIRST WAS IS GONE (02.10.2026).
 *
 * <p>Measured on the version PR 469 introduced: the sentence and the loader's word were two
 * different `<p>` elements in one place with no `key`, which React does not tell apart, so the
 * node that said „cannot be read" was the same node, with its `role` turned over, that had said
 * „Učitavanje" a moment before. A reader who pressed the button and was answered with the same
 * failure got an element whose role changed and nothing inserted, and an `alert` is what a screen
 * reader says when it is inserted. Whether a given one then says it is NOT measured here: what is
 * held is the document, which is the part this file can see.
 *
 * <p>The button is the one thing that is NOT replaced, and that is held beside it: it is where the
 * keyboard reader's focus is, and a control that is replaced takes the focus with it.
 */
describe('a list that could not be read, asked again', () => {
  const stand = (reading: boolean) => (
    <I18nProvider locale="sr">
      <Unreadable said="Spisak se ne može učitati." named="Poruke" reading={reading} onRetry={() => undefined} />
    </I18nProvider>
  )

  it('draws the alert of a second failure as a new element, and the first is no longer in the document', () => {
    const { rerender } = render(stand(false))
    const first = screen.getByRole('alert')

    rerender(stand(true))
    const asking = screen.getByRole('status')

    expect(first.isConnected, 'the first alert is still in the document while the request is out').toBe(false)

    rerender(stand(false))
    const second = screen.getByRole('alert')

    expect(second, 'the second failure is the first alert with its role turned back').not.toBe(first)
    expect(asking.isConnected, 'the word for asking is still in the document').toBe(false)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(second).toHaveTextContent('Spisak se ne može učitati.')
  })

  it('keeps the very same button through all of it, with the focus on it', () => {
    const { rerender } = render(stand(false))
    const button = screen.getByRole('button', { name: `${sr.data.retry}: Poruke` })

    button.focus()
    rerender(stand(true))
    expect(screen.getByRole('button', { name: `${sr.data.retry}: Poruke` })).toBe(button)
    expect(button).toHaveFocus()

    rerender(stand(false))
    expect(screen.getByRole('button', { name: `${sr.data.retry}: Poruke` })).toBe(button)
    expect(button).toHaveFocus()
  })
})
