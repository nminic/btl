import { act, render, screen } from '@testing-library/react'
import { I18nProvider } from '../../i18n/I18nProvider'
import { setupUser } from '../../test/user'
import { DeleteRecord } from './EntityEditor'

/**
 * THE QUESTION „OBRISI?" ON ITS OWN, WITHOUT ANY OF THE EIGHT PLACES THAT DRAW IT.
 *
 * <p>`DeleteRecord` is drawn by `RowActions` (four administrative lists) and directly by the
 * members' list, the team's own page and the member's own results, and each of those has cases
 * of its own about what a deletion DOES. What none of them can say is what the QUESTION does
 * while the deletion is out, because each holds its own guard against a second press: a guard
 * deleted from here would be caught by a screen's and the case would stay green. These cases ask
 * the component alone, with a handler whose answer is held until the case lets it go.
 *
 * <p><b>The rule is the owner's, 02.10.2026, chosen between three outcomes he was priced:</b>
 * „Ne", „Odustani" and Escape do nothing while a request is out, the state is said in words, and
 * whoever asked the question closes it when the answer arrives. Here that is: while the promise
 * `onDelete` returned is pending, both buttons are told off, the sentence is on the page, and
 * nothing the reader presses puts the question away or asks it a second time.
 */
describe('the question about deleting a record', () => {
  /** A deletion whose answer is held until `settle` is called, and a count of how often it was asked. */
  function aHeldDeletion() {
    let settle: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      settle = resolve
    })
    const onDelete = vi.fn(() => held)

    return { onDelete, settle }
  }

  function draw(onDelete: () => void | Promise<unknown>, onKeep?: () => void) {
    return render(
      <I18nProvider locale="sr">
        <DeleteRecord name="Probni tim" onDelete={onDelete} onKeep={onKeep} />
      </I18nProvider>,
    )
  }

  /** Asks the question, which is the first of the two presses. */
  async function ask(user: ReturnType<typeof setupUser>) {
    await user.click(screen.getByRole('button', { name: 'Obriši: Probni tim' }))
  }

  describe('with nothing out', () => {
    it('asks first, and the first press sends nothing', async () => {
      const user = setupUser()
      const onDelete = vi.fn()

      draw(onDelete)
      await ask(user)

      expect(onDelete).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Potvrdi brisanje: Probni tim' })).toBeVisible()
      expect(screen.getByRole('button', { name: 'Odustani od brisanja: Probni tim' })).toBeVisible()
    })

    it('answers a deletion that returns nothing at once, and says nothing about sending', async () => {
      /* The session's own deletions, which have nobody to wait for: the row leaves in the same
         render, so a sentence about sending would be false for the instant it was on the page. */
      const user = setupUser()
      const onDelete = vi.fn()

      draw(onDelete)
      await ask(user)
      await user.click(screen.getByRole('button', { name: 'Potvrdi brisanje: Probni tim' }))

      expect(onDelete).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Potvrdi brisanje: Probni tim' })).not.toHaveAttribute(
        'aria-disabled',
      )
    })

    it('puts the question away on „Odustani", and tells whoever asked', async () => {
      const user = setupUser()
      const onKeep = vi.fn()

      draw(vi.fn(), onKeep)
      await ask(user)
      await user.click(screen.getByRole('button', { name: 'Odustani od brisanja: Probni tim' }))

      expect(onKeep).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Obriši: Probni tim' })).toBeVisible()
      expect(
        screen.queryByRole('button', { name: 'Potvrdi brisanje: Probni tim' }),
      ).not.toBeInTheDocument()
    })

    it('puts the question away just the same where nobody asked to be told', async () => {
      const user = setupUser()

      draw(vi.fn())
      await ask(user)
      await user.click(screen.getByRole('button', { name: 'Odustani od brisanja: Probni tim' }))

      expect(screen.getByRole('button', { name: 'Obriši: Probni tim' })).toBeVisible()
    })
  })

  describe('with the deletion out', () => {
    it('tells both buttons off, without taking either out of the tab order', async () => {
      const user = setupUser()
      const { onDelete } = aHeldDeletion()

      draw(onDelete)
      await ask(user)
      await user.click(screen.getByRole('button', { name: 'Potvrdi brisanje: Probni tim' }))

      for (const name of ['Potvrdi brisanje: Probni tim', 'Odustani od brisanja: Probni tim']) {
        const button = screen.getByRole('button', { name })

        /* `aria-disabled` and never `disabled`: the control that was pressed has the focus (and
           `RowActions` has moved it on), and a native `disabled` drops it to the top of the page. */
        expect(button).toHaveAttribute('aria-disabled', 'true')
        expect(button).not.toBeDisabled()
      }
    })

    it('says that it is sending, and only while it is', async () => {
      const user = setupUser()
      const { onDelete, settle } = aHeldDeletion()

      draw(onDelete)
      await ask(user)

      expect(screen.queryByRole('status')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Potvrdi brisanje: Probni tim' }))

      expect(screen.getByRole('status')).toHaveTextContent('Šalje se')

      await act(async () => {
        settle()
      })

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('does not put the question away on „Odustani", and does not tell whoever asked', async () => {
      const user = setupUser()
      const onKeep = vi.fn()
      const { onDelete } = aHeldDeletion()

      draw(onDelete, onKeep)
      await ask(user)
      await user.click(screen.getByRole('button', { name: 'Potvrdi brisanje: Probni tim' }))
      await user.click(screen.getByRole('button', { name: 'Odustani od brisanja: Probni tim' }))

      expect(onKeep).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Potvrdi brisanje: Probni tim' })).toBeVisible()
    })

    it('sends one deletion for two presses with nothing awaited between them', async () => {
      /* TWO RAW CLICKS IN ONE `act`, for the reason `leaveTeam.test.tsx` and
         `paymentsActivation.test.tsx` give for theirs: `user.click` awaits its own click through
         and lets React render, so the state beside the guard would already have caught up and a
         guard reading it would pass. Nothing commits between these two. */
      const user = setupUser()
      const { onDelete } = aHeldDeletion()

      draw(onDelete)
      await ask(user)

      const sure = screen.getByRole('button', { name: 'Potvrdi brisanje: Probni tim' })

      act(() => {
        sure.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        sure.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      expect(onDelete).toHaveBeenCalledTimes(1)
    })

    it('lets the reader try again, and put the question away, once the answer has come', async () => {
      /* A refusal is the answer that leaves the question standing, and the promise settling is
         all the component can see of it: the screen drew the sentence in the same breath. */
      const user = setupUser()
      const onKeep = vi.fn()
      const { onDelete, settle } = aHeldDeletion()

      draw(onDelete, onKeep)
      await ask(user)
      await user.click(screen.getByRole('button', { name: 'Potvrdi brisanje: Probni tim' }))

      await act(async () => {
        settle()
      })

      expect(screen.getByRole('button', { name: 'Potvrdi brisanje: Probni tim' })).not.toHaveAttribute(
        'aria-disabled',
      )

      await user.click(screen.getByRole('button', { name: 'Odustani od brisanja: Probni tim' }))

      expect(onKeep).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Obriši: Probni tim' })).toBeVisible()
    })

    it('does nothing when the answer comes after the row has already left the page', async () => {
      /* The ordinary end of a successful deletion: the screen takes the row away, and with it
         this component, before the promise it handed back has settled. */
      const user = setupUser()
      const { onDelete, settle } = aHeldDeletion()
      const view = draw(onDelete)

      await ask(user)
      await user.click(screen.getByRole('button', { name: 'Potvrdi brisanje: Probni tim' }))

      view.unmount()

      await act(async () => {
        settle()
      })

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })
})
