import { act, configure, fireEvent, render, screen, within } from '@testing-library/react'
import { I18nProvider } from '../../i18n/I18nProvider'
import { sayYes, theSheet } from '../../test/deleteSheet'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { DeleteSheet } from './DeleteSheet'

/* Every wait is given half of what a case is given, for the reason `rowMembership.test.tsx` gives: a
   mutation then fails on its assertion and not on the clock of the case. */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * THE SHEET THAT ASKS „OBRIŠI X?" ON ITS OWN, WITHOUT ANY OF THE PLACES THAT DRAW IT (owner, 23.10.2026 and
 * 24.10.2026, PDL „Odgovori od 24.10.2026 (popodne)": „Stari „Sigurno?" u redu time nestaje iz portala").
 *
 * <p>These are the cases `deleteRecord.test.tsx` asked of the question that stood in the row until 24.10.2026
 * (`DeleteRecord`, deleted with them), asked of its successor, and each one fails on its own mutation of `DeleteSheet.tsx` or of `Prompt.tsx`
 * (the series is in the description of PR 645). What no screen can say is what the sheet does while the
 * deletion is out, because each screen holds a guard of its own: a guard deleted from here would be caught by
 * a screen's and the case would stay green. The handler's answer is held until the case lets it go.
 */
describe('the sheet that asks before a deletion', () => {
  /** A deletion whose every call is held on its own, so that two answers can be let go one after the other. */
  function heldDeletions() {
    const settles: (() => void)[] = []
    const onDelete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settles.push(resolve)
        }),
    )

    return { onDelete, settle: (which: number) => settles[which]?.() }
  }

  function draw(
    onDelete: () => void | Promise<unknown>,
    props: { onKeep?: () => void; opener?: string; look?: string } = {},
  ) {
    return render(
      <I18nProvider locale="sr">
        <DeleteSheet name="Prvi tim" asks="Obriši tim?" onDelete={onDelete} {...props} />
        <DeleteSheet name="Drugi tim" asks="Obriši tim?" onDelete={onDelete} {...props} />
      </I18nProvider>,
    )
  }

  const second = () => screen.getByRole('button', { name: 'Obriši: Drugi tim' })

  it('asks first, names the record under the question, and the first press sends nothing', async () => {
    const user = setupUser()
    const onDelete = vi.fn()

    draw(onDelete)
    await user.click(second())

    const sheet = await theSheet('Obriši tim?')

    expect(within(sheet).getByText('Drugi tim')).toBeInTheDocument()
    expect(within(sheet).queryByText('Prvi tim')).toBeNull()
    expect(within(sheet).getAllByRole('button').map((one) => one.textContent)).toEqual(['Obriši', 'Odustani'])
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('answers a deletion that returns nothing at once, and says nothing about sending', async () => {
    const user = setupUser()
    const onDelete = vi.fn()

    draw(onDelete)
    await user.click(second())
    await sayYes(user, 'Obriši tim?')

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Šalje se')).toBeNull()
  })

  it('takes the keyboard to the question and puts it back on the cross of the row that asked, the second', async () => {
    const user = setupUser()

    draw(vi.fn())
    second().focus()
    await user.keyboard('{Enter}')

    expect(within(await theSheet('Obriši tim?')).getByRole('heading', { name: 'Obriši tim?' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(second()).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Obriši: Prvi tim' })).not.toHaveFocus()
  })

  it('tells whoever asked when the READER puts it away, and not when an answer does', async () => {
    const user = setupUser()
    const onKeep = vi.fn()
    const { onDelete, settle } = heldDeletions()

    draw(onDelete, { onKeep })
    await user.click(second())
    await user.click(within(await theSheet('Obriši tim?')).getByRole('button', { name: 'Odustani' }))

    expect(onKeep).toHaveBeenCalledTimes(1)

    await user.click(second())
    await user.keyboard('{Escape}')

    expect(onKeep).toHaveBeenCalledTimes(2)

    await user.click(second())
    await sayYes(user, 'Obriši tim?')
    await act(async () => {
      settle(0)
    })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onKeep).toHaveBeenCalledTimes(2)
  })

  it('puts it away just the same where nobody asked to be told', async () => {
    const user = setupUser()

    draw(vi.fn())
    await user.click(second())
    await user.click(within(await theSheet('Obriši tim?')).getByRole('button', { name: 'Odustani' }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('with the deletion out, tells both buttons off, says that it is sending, and puts nothing away', async () => {
    const user = setupUser()
    const onKeep = vi.fn()
    const { onDelete } = heldDeletions()

    draw(onDelete, { onKeep })
    await user.click(second())

    const sheet = await sayYes(user, 'Obriši tim?')

    for (const name of ['Obriši', 'Odustani']) {
      const one = within(sheet).getByRole('button', { name })

      /* TOLD OFF AND NOT SWITCHED OFF: the one that was pressed has the focus. */
      expect(one).toHaveAttribute('aria-disabled', 'true')
      expect(one).not.toBeDisabled()
    }

    expect(within(sheet).getByRole('status')).toHaveTextContent('Šalje se')

    await user.click(within(sheet).getByRole('button', { name: 'Odustani' }))
    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog', { name: 'Obriši tim?' })).toBe(sheet)
    expect(onKeep).not.toHaveBeenCalled()
  })

  it('sends one deletion for two presses with nothing awaited between them', async () => {
    const user = setupUser()
    const { onDelete } = heldDeletions()

    draw(onDelete)
    await user.click(second())

    const yes = within(await theSheet('Obriši tim?')).getByRole('button', { name: 'Obriši' })

    act(() => {
      yes.click()
      yes.click()
    })

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('does not take the second click of a double press for an answer', async () => {
    const user = setupUser()
    const onDelete = vi.fn()

    draw(onDelete)
    await user.click(second())

    const yes = within(await theSheet('Obriši tim?')).getByRole('button', { name: 'Obriši' })

    fireEvent.click(yes, { detail: 2 })
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(yes, { detail: 1 })
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('closes by itself when the answer comes, and can be asked again, and the second asking is sent', async () => {
    const user = setupUser()
    const { onDelete, settle } = heldDeletions()

    draw(onDelete)
    await user.click(second())
    await sayYes(user, 'Obriši tim?')
    await act(async () => {
      settle(0)
    })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(second()).toHaveFocus()
    expect(screen.queryByText('Šalje se')).toBeNull()

    await user.click(second())

    /* NOTHING OF THE FIRST ATTEMPT IS LEFT ON IT. */
    const again = within(await theSheet('Obriši tim?'))

    expect(again.getByRole('button', { name: 'Obriši' })).not.toHaveAttribute('aria-disabled')
    expect(again.getByRole('button', { name: 'Odustani' })).not.toHaveAttribute('aria-disabled')

    await user.click(again.getByRole('button', { name: 'Obriši' }))
    expect(onDelete).toHaveBeenCalledTimes(2)
  })

  it('puts a sheet asked again after an answer away', async () => {
    const user = setupUser()
    const { onDelete, settle } = heldDeletions()

    draw(onDelete)
    await user.click(second())
    await sayYes(user, 'Obriši tim?')
    await act(async () => {
      settle(0)
    })
    await user.click(second())
    await user.click(within(await theSheet('Obriši tim?')).getByRole('button', { name: 'Odustani' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(second()).toHaveFocus()
  })

  it('does nothing when the answer comes after the row has already left the page', async () => {
    /* The ordinary end of a successful deletion: the screen takes the row away, and with it this
       component, before the promise it handed back has settled. */
    const user = setupUser()
    const { onDelete, settle } = heldDeletions()
    const view = draw(onDelete)

    await user.click(second())
    await sayYes(user, 'Obriši tim?')

    view.unmount()

    await act(async () => {
      settle(0)
    })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('names the cross after what a screen says, and puts no name under a question that has none', async () => {
    const user = setupUser()

    render(
      <I18nProvider locale="sr">
        <DeleteSheet
          name="Ocena"
          asks="Obriši svoju ocenu?"
          opener="Obriši svoju ocenu"
          look="button button--secondary"
          onDelete={vi.fn()}
        />
      </I18nProvider>,
    )

    const cross = screen.getByRole('button', { name: 'Obriši svoju ocenu' })

    expect(cross).toHaveClass('button', 'button--secondary', 'entity-delete')
    /* The word the cross shows on the pointer is the screen's as well, not only its name. */
    expect(cross).toHaveTextContent('Obriši svoju ocenu')

    await user.click(cross)

    expect(within(await theSheet('Obriši svoju ocenu?')).queryByText('Ocena')).toBeNull()
  })
})
