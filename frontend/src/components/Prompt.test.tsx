import { fireEvent, render, screen } from '@testing-library/react'
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

  /**
   * THE SECOND CLICK OF A DOUBLE PRESS IS NOT AN ANSWER (22.10.2026). Measured in Chrome at 360px: the
   * sheet opens under the thumb that opened it, and the second click of a double press on an action of a
   * row landed on „Ne"; further left it would land on the first way of saying yes. A browser marks that
   * click with `detail` 2, the keyboard with 0, and a single press with 1.
   */
  describe('with a press repeated', () => {
    it('answers no button on the second click of a double press', () => {
      const answers = aSheet()

      for (const name of ['Da', 'Odobri iz balansa', 'Ne']) {
        fireEvent.click(screen.getByRole('button', { name }), { detail: 2 })
      }

      expect(answers.yes).not.toHaveBeenCalled()
      expect(answers.balance).not.toHaveBeenCalled()
      expect(answers.no).not.toHaveBeenCalled()
    })

    it('still answers a single press and the keyboard, on every button', () => {
      const answers = aSheet()

      /* `detail` 1 is a press of a pointer, 0 is Enter or the space bar on a focused button. */
      fireEvent.click(screen.getByRole('button', { name: 'Da' }), { detail: 1 })
      fireEvent.click(screen.getByRole('button', { name: 'Odobri iz balansa' }), { detail: 0 })
      fireEvent.click(screen.getByRole('button', { name: 'Ne' }), { detail: 1 })
      fireEvent.click(screen.getByRole('button', { name: 'Ne' }), { detail: 0 })

      expect(answers.yes).toHaveBeenCalledTimes(1)
      expect(answers.balance).toHaveBeenCalledTimes(1)
      expect(answers.no).toHaveBeenCalledTimes(2)
    })
  })

  /**
   * A SHEET THAT ASKS FOR A NUMBER AS WELL (22.10.2026): the field is a stop of the ring Tab walks, in
   * both directions, and the focus cannot leave the sheet from it.
   */
  describe('with a field in it', () => {
    function aSheetWithAField() {
      render(
        <>
          <button type="button">Iza lista</button>
          <Prompt title="Upiši uplatu" choices={[{ label: 'Upiši', onChoose: vi.fn() }]} decline="Odustani" onDecline={vi.fn()}>
            <label>
              Uplaćeno (RSD)
              <input type="text" />
            </label>
          </Prompt>
        </>,
      )

      return {
        field: screen.getByRole('textbox', { name: 'Uplaćeno (RSD)' }),
        record: screen.getByRole('button', { name: 'Upiši' }),
        keep: screen.getByRole('button', { name: 'Odustani' }),
      }
    }

    it('walks from the last button back to the field, and never out to the page', async () => {
      const user = setupUser()
      const { field, record, keep } = aSheetWithAField()

      /* The sheet opens on its question; the field is the first stop after it. */
      await user.tab()
      expect(field).toHaveFocus()

      await user.tab()
      expect(record).toHaveFocus()

      await user.tab()
      expect(keep).toHaveFocus()

      await user.tab()
      expect(field).toHaveFocus()
    })

    it('walks backwards from the field to the last button, and never out to the page', async () => {
      const user = setupUser()
      const { field, keep } = aSheetWithAField()

      await user.tab()
      expect(field).toHaveFocus()

      await user.tab({ shift: true })
      expect(keep).toHaveFocus()

      await user.tab({ shift: true })
      await user.tab({ shift: true })
      expect(field).toHaveFocus()
    })
  })

  /**
   * A PRESS ON THE BACKDROP KEEPS THE FOCUS IN THE SHEET (22.10.2026): measured in Chrome, the second click
   * of a double press lands there, and the body took the focus, so Escape and Tab no longer reached the
   * sheet. A press inside the sheet is the reader's own and is left alone.
   */
  it('keeps the focus in the sheet when the backdrop is pressed, and answers Escape after it', async () => {
    const user = setupUser()
    /* Drawn inside an element that takes the focus, as the portal's `main` does (`tabindex`): what stands
       around the sheet is not a press on the sheet. */
    const around = document.createElement('div')

    around.tabIndex = -1
    document.body.append(around)

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
      >
        <p>Sta se pita.</p>
      </Prompt>,
      { container: around },
    )
    const sheet = screen.getByRole('dialog')
    const backdrop = sheet.parentElement

    if (backdrop === null) {
      throw new Error('the sheet stands on no backdrop')
    }

    /* `false` is what dispatching answers when the default was prevented: on the backdrop and on the
       words of the sheet, and never on what takes the focus itself, a button or the question. */
    expect(fireEvent.mouseDown(backdrop)).toBe(false)
    expect(fireEvent.mouseDown(screen.getByText('Sta se pita.'))).toBe(false)
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Da' }))).toBe(true)
    expect(fireEvent.mouseDown(screen.getByRole('heading', { name: 'Prihvatam umanjen ukupan iznos?' }))).toBe(true)

    await user.click(backdrop)

    expect(sheet).toContainElement(document.activeElement instanceof HTMLElement ? document.activeElement : null)

    await user.keyboard('{Escape}')

    expect(answers.no).toHaveBeenCalledTimes(1)

    around.remove()
  })

  /**
   * EACH SHEET IS NAMED BY ITS OWN QUESTION (22.10.2026), and two may stand at once: a question about
   * the amount drawn over the sheet that asked for it. An id written out by hand is found where it
   * stands first, so the second sheet would carry the first one's name.
   */
  it('is described by its body, so that a reader hears what is asked about and not only the question', () => {
    /* The focus lands on the heading and skips the body, so without the description a reader of a sheet that deletes
       hears „Obriši događaj?" and „Obriši" and never which event or what goes with it (PR 645, review; PDL, 25.10.2026). */
    aSheet()

    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Sta se pita.')
  })

  it('names each of two sheets standing at once by its own question', () => {
    render(
      <>
        <Prompt title="Upiši uplatu" choices={[]} decline="Odustani" onDecline={vi.fn()}>
          <p>Prvi list.</p>
        </Prompt>
        <Prompt title="Prihvatam umanjen ukupan iznos?" choices={[]} decline="Ne" onDecline={vi.fn()}>
          <p>Drugi list.</p>
        </Prompt>
      </>,
    )

    expect(screen.getByRole('dialog', { name: 'Upiši uplatu' })).toHaveTextContent('Prvi list.')
    expect(screen.getByRole('dialog', { name: 'Prihvatam umanjen ukupan iznos?' })).toHaveTextContent('Drugi list.')
  })
})
