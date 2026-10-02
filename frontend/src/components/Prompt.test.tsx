import { render, screen } from '@testing-library/react'
import { setupUser } from '../test/user'
import { Prompt } from './Prompt'

/**
 * THE SHEET'S OWN CONTRACT, ASKED WITHOUT THE SCREEN THAT DRAWS IT.
 *
 * <p>`pages/admin/paymentsActivation.test.tsx` measures what the payments screen does with this
 * sheet, and it measures it through `Payments`, whose own row also refuses a second press while
 * its request is out (`outstanding`). So a guard deleted from HERE would be caught by the row's
 * and the case would stay green. What follows asks the sheet alone, with handlers that count
 * their own calls, so each of its guards is the only thing standing between a press and its
 * handler.
 *
 * <p><b>There are two states and they are the whole of it</b>: nothing is out with the server
 * and every button and Escape answer, or `working` carries the sentence that says a request is
 * out and none of them does (owner, 02.10.2026: „Ne", „Odustani" and Escape are onemoguceni
 * while the request travels; PDL, „Odluke iz ciscenja nalaza").
 */
describe('the question sheet', () => {
  /** A sheet with two ways of saying yes and one way out, and a handler behind each. */
  function aSheet(working?: string) {
    const answers = { yes: vi.fn(), balance: vi.fn(), no: vi.fn() }

    render(
      <Prompt
        title="Prihvatam umanjen ukupan iznos?"
        choices={[
          { label: 'Da', onChoose: answers.yes },
          { label: 'Odobri iz balansa', onChoose: answers.balance },
        ]}
        decline="Ne"
        onDecline={answers.no}
        working={working}
      >
        <p>Sta se pita.</p>
      </Prompt>,
    )

    return answers
  }

  describe('with nothing out with the server', () => {
    it('answers each way of saying yes with its own handler and nothing else', async () => {
      const user = setupUser()
      const answers = aSheet()

      await user.click(screen.getByRole('button', { name: 'Odobri iz balansa' }))

      expect(answers.balance).toHaveBeenCalledTimes(1)
      expect(answers.yes).not.toHaveBeenCalled()
      expect(answers.no).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Da' }))

      expect(answers.yes).toHaveBeenCalledTimes(1)
      expect(answers.no).not.toHaveBeenCalled()
    })

    it('declines on the button that declines, and on Escape', async () => {
      const user = setupUser()
      const answers = aSheet()

      await user.click(screen.getByRole('button', { name: 'Ne' }))

      expect(answers.no).toHaveBeenCalledTimes(1)

      /* Escape is pressed with the focus inside the sheet, which is where the sheet put it. */
      await user.keyboard('{Escape}')

      expect(answers.no).toHaveBeenCalledTimes(2)
      expect(answers.yes).not.toHaveBeenCalled()
      expect(answers.balance).not.toHaveBeenCalled()
    })

    it('tells nobody that it is sending, and leaves every button live', () => {
      aSheet()

      /* A region that is always on the sheet, empty until there is something to say: one added
         together with its words is one a screen reader often misses (WCAG 2.2 AA, 4.1.3). */
      expect(screen.getByRole('status')).toBeEmptyDOMElement()

      for (const name of ['Da', 'Odobri iz balansa', 'Ne']) {
        expect(screen.getByRole('button', { name })).not.toHaveAttribute('aria-disabled')
      }
    })
  })

  describe('with a request out', () => {
    it('answers none of the ways of saying yes', async () => {
      const user = setupUser()
      const answers = aSheet('Šalje se')

      await user.click(screen.getByRole('button', { name: 'Da' }))
      await user.click(screen.getByRole('button', { name: 'Odobri iz balansa' }))

      expect(answers.yes).not.toHaveBeenCalled()
      expect(answers.balance).not.toHaveBeenCalled()
    })

    it('does not decline on the button that declines', async () => {
      const user = setupUser()
      const answers = aSheet('Šalje se')

      await user.click(screen.getByRole('button', { name: 'Ne' }))

      expect(answers.no).not.toHaveBeenCalled()
    })

    it('does not decline on Escape, and does not let the press through to the document', async () => {
      const bubbled: string[] = []
      const onBubble = (pressed: KeyboardEvent) => bubbled.push(pressed.key)

      document.addEventListener('keydown', onBubble)

      try {
        const user = setupUser()
        const answers = aSheet('Šalje se')

        /* The focus is put on a button of the sheet the way a press on one would have, so the
           Escape goes through the sheet's own handler and not past it. */
        await user.click(screen.getByRole('button', { name: 'Da' }))
        await user.keyboard('{Escape}')

        expect(answers.no).not.toHaveBeenCalled()
        expect(bubbled).toEqual([])
      } finally {
        document.removeEventListener('keydown', onBubble)
      }
    })

    it('says so in words, and tells every button off without taking one out of the tab order', () => {
      aSheet('Šalje se')

      expect(screen.getByRole('status')).toHaveTextContent('Šalje se')

      for (const name of ['Da', 'Odobri iz balansa', 'Ne']) {
        const button = screen.getByRole('button', { name })

        /* `aria-disabled` and never `disabled`: the button that was just pressed has the focus,
           and a native `disabled` would drop it to the top of the document. */
        expect(button).toHaveAttribute('aria-disabled', 'true')
        expect(button).not.toBeDisabled()
      }
    })

    it('keeps the focus on the button that was pressed', async () => {
      const user = setupUser()

      aSheet('Šalje se')

      const yes = screen.getByRole('button', { name: 'Da' })

      await user.click(yes)

      expect(yes).toHaveFocus()
    })
  })
})
