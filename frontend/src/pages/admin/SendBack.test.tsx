import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../../i18n/I18nProvider'
import { setupUser } from '../../test/user'
import { SendBack } from './SendBack'

/**
 * THE BOX THAT ASKS FOR A REASON, ASKED ON ITS OWN, WITHOUT THE QUEUE THAT DRAWS IT.
 *
 * <p>`admin/verificationDecision.test.tsx` measures what the queue does with this box, and the
 * queue guards the same request itself (`handBackGuarded`, which refuses a second walk off a
 * ref), so a guard deleted from HERE would be caught by the queue's and the case would stay green.
 * What follows asks the box alone, with handlers that count their own calls, so each of its guards
 * is the only thing standing between a press and its handler.
 *
 * <p><b>Two states</b>: nothing out, and every button answers; or `working` is set - the decision
 * this box sent is still out with the route - and neither does (owner, 02.10.2026: „Ne", „Odustani"
 * and Escape are onemoguceni while the request travels, with the state said in words; PDL, „Odluke
 * iz ciscenja nalaza", first item).
 */
describe('the box that asks for a reason', () => {
  /** A box with a reason already typed, and a handler behind each of its two buttons. */
  async function aBox(working?: boolean) {
    const user = setupUser()
    const answers = { confirm: vi.fn(), cancel: vi.fn() }

    render(
      <I18nProvider locale="sr">
        <SendBack
          subject="Probni član"
          onConfirm={answers.confirm}
          onCancel={answers.cancel}
          working={working}
        />
      </I18nProvider>,
    )

    await user.type(screen.getByLabelText(/^Razlog odbijanja/), 'Tekst je prekratak.')

    return { user, answers }
  }

  const confirm = () => screen.getByRole('button', { name: 'Odbij uz ovaj razlog' })
  const cancel = () => screen.getByRole('button', { name: 'Odustani' })

  describe('with nothing out', () => {
    it('sends the reason that was typed, and nothing else', async () => {
      const { user, answers } = await aBox()

      await user.click(confirm())

      expect(answers.confirm).toHaveBeenCalledTimes(1)
      expect(answers.confirm).toHaveBeenCalledWith('Tekst je prekratak.')
      expect(answers.cancel).not.toHaveBeenCalled()
    })

    it('puts the box away on „Odustani", and sends nothing', async () => {
      const { user, answers } = await aBox()

      await user.click(cancel())

      expect(answers.cancel).toHaveBeenCalledTimes(1)
      expect(answers.confirm).not.toHaveBeenCalled()
    })

    it('says nothing about sending, and tells no button off', async () => {
      await aBox()

      expect(screen.queryByText('Šalje se')).not.toBeInTheDocument()
      expect(confirm()).not.toHaveAttribute('aria-disabled', 'true')
      expect(cancel()).not.toHaveAttribute('aria-disabled')
    })
  })

  describe('with the decision out', () => {
    it('sends nothing on the button that sends', async () => {
      const { user, answers } = await aBox(true)

      await user.click(confirm())

      expect(answers.confirm).not.toHaveBeenCalled()
    })

    it('does not put the box away on „Odustani"', async () => {
      const { user, answers } = await aBox(true)

      await user.click(cancel())

      expect(answers.cancel).not.toHaveBeenCalled()
    })

    it('says so in words, and tells both buttons off without taking one out of the tab order', async () => {
      await aBox(true)

      expect(screen.getByRole('status')).toHaveTextContent('Šalje se')

      for (const button of [confirm(), cancel()]) {
        /* `aria-disabled` and never `disabled`: the control that was pressed has the focus, and a
           native `disabled` would drop it to the top of the document. */
        expect(button).toHaveAttribute('aria-disabled', 'true')
        expect(button).not.toBeDisabled()
      }
    })

    it('keeps the reason that was typed', async () => {
      await aBox(true)

      expect(screen.getByLabelText(/^Razlog odbijanja/)).toHaveValue('Tekst je prekratak.')
    })
  })
})
