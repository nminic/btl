import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { setupUser } from '../test/user'
import { Dropdown } from './Dropdown'

/**
 * A PANEL KEEPS WHAT IT HAD WHEN THE HEADER IS DRAWN AGAIN IN THE OTHER SHAPE (PENDING, review of PR 755,
 * 17.11.2026: „pri promeni širine preko 700 px u hodu (rotacija telefona) fokus pada na BODY, a otvoren panel
 * naloga se zatvara"). The shell draws the envelope and the picture after the words on a telephone and after the
 * language on a desktop, so crossing 700px takes one panel down and draws another in its place. The stand-in here
 * is the same: the panel stands in one of two parents, and a button moves it from one to the other, which is the
 * one thing that takes a component down and draws it again with the same props.
 *
 * <p>What is asked, and what the real window asks of the same code in Chrome (`geometry/headerAcrossTheBreak.geometry.ts`):
 * the panel that was open is open, the focus is on the same control, and a panel that was shut is shut and holds
 * no focus. The axes, each stood on both sides: open or shut; the focus on the button, on a link inside the panel,
 * or nowhere in it; and a panel that went away and was not replaced, which must leave nothing for the next one.
 */

/** Two places for the same panel, which is two shapes of the header, and a way to draw none at all. */
function Header({ id = 'account-menu' }: { id?: string }) {
  const [where, setWhere] = useState<'tools' | 'cells' | 'nowhere'>('tools')
  const panel = (
    <Dropdown id={id} className="account" label="Open the account" trigger={<span>picture</span>}>
      {(close) => (
        <>
          <a href="/first">first</a>
          <a href="/second">second</a>
          <button type="button" onClick={close}>
            close
          </button>
        </>
      )}
    </Dropdown>
  )

  return (
    <>
      <button type="button" onClick={() => setWhere(where === 'tools' ? 'cells' : 'tools')}>
        turn
      </button>
      <button type="button" onClick={() => setWhere('nowhere')}>
        sign out
      </button>
      <button type="button" onClick={() => setWhere('tools')}>
        sign in
      </button>
      <div data-testid="tools">{where === 'tools' && panel}</div>
      <div data-testid="cells">{where === 'cells' && panel}</div>
    </>
  )
}

const OPEN = { name: 'Open the account' }

/** The window is turned: the same state change a press makes, and no focus moves with it, because a window that
 *  is turned is not a control that is pressed. */
const turn = () => fireEvent.click(screen.getByRole('button', { name: 'turn' }))

describe('a panel drawn again in another place', () => {
  it('is open if it was open, and open once', async () => {
    const user = setupUser()

    render(<Header />)
    await user.click(screen.getByRole('button', OPEN))
    expect(screen.getByRole('button', OPEN)).toHaveAttribute('aria-expanded', 'true')

    turn()

    expect(screen.getByTestId('cells')).toContainElement(screen.getByRole('button', OPEN))
    expect(screen.getByRole('button', OPEN)).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'first' })).toBeVisible()
  })

  it('is shut if it was shut, and holds no focus', () => {
    render(<Header />)
    turn()

    expect(screen.getByTestId('cells')).toContainElement(screen.getByRole('button', OPEN))
    expect(screen.getByRole('button', OPEN)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', OPEN)).not.toHaveFocus()
  })

  it('gives the focus back to its button when the button had it', async () => {
    const user = setupUser()

    render(<Header />)
    await user.click(screen.getByRole('button', OPEN))
    expect(screen.getByRole('button', OPEN)).toHaveFocus()

    turn()

    expect(screen.getByTestId('cells')).toContainElement(screen.getByRole('button', OPEN))
    expect(screen.getByRole('button', OPEN)).toHaveFocus()
  })

  it('gives the focus back to the link inside it that had it, and not to the first one', async () => {
    const user = setupUser()

    render(<Header />)
    await user.click(screen.getByRole('button', OPEN))
    screen.getByRole('link', { name: 'second' }).focus()
    expect(screen.getByRole('link', { name: 'second' })).toHaveFocus()

    turn()

    expect(screen.getByTestId('cells')).toContainElement(screen.getByRole('link', { name: 'second' }))
    expect(screen.getByRole('link', { name: 'second' })).toHaveFocus()
  })

  it('takes no focus when the focus was somewhere else', async () => {
    const user = setupUser()

    render(<Header />)
    await user.click(screen.getByRole('button', OPEN))
    screen.getByRole('button', { name: 'sign in' }).focus()

    turn()

    expect(screen.getByRole('button', OPEN)).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', OPEN)).not.toHaveFocus()
    expect(screen.getByRole('button', { name: 'sign in' })).toHaveFocus()
  })

  it('leaves nothing behind for the next reader when it goes and is not replaced', async () => {
    const user = setupUser()

    render(<Header />)
    await user.click(screen.getByRole('button', OPEN))
    expect(screen.getByRole('button', OPEN)).toHaveFocus()

    /* Somebody signs out with the panel open and the focus on it, and somebody else signs in. Neither press is
       a click of a mouse: a click on `sign out` would take the focus off the panel before the panel goes, and
       then there would be nothing left behind to leave (measured: with the line that forgets the focus taken
       out, the case passed on its own and was caught only by the map leaking from a case that ran before it). */
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'sign out' }))
    })
    expect(screen.queryByRole('button', OPEN)).not.toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'sign in' }))
    })

    expect(screen.getByRole('button', OPEN)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', OPEN)).not.toHaveFocus()
  })
})

/** The two panels of one header, each with its own id, and the turn that takes both down and draws both again. */
function TwoPanels() {
  const [where, setWhere] = useState<'tools' | 'cells'>('tools')
  const panel = (id: string, label: string) => (
    <Dropdown id={id} className="account" label={label} trigger={<span>{label}</span>}>
      {() => <a href="/x">{label} link</a>}
    </Dropdown>
  )
  const both = (
    <>
      {panel('first-menu', 'Open the first')}
      {panel('second-menu', 'Open the second')}
    </>
  )

  return (
    <>
      <button type="button" onClick={() => setWhere(where === 'tools' ? 'cells' : 'tools')}>
        turn
      </button>
      <div data-testid="tools">{where === 'tools' && both}</div>
      <div data-testid="cells">{where === 'cells' && both}</div>
    </>
  )
}

describe('two panels with their own ids, drawn again together', () => {
  /* THE SECOND SOURCE of what a drawn-again panel has: its own id, or any other panel's. With one panel in the
     page the two are the same value, so the case above cannot tell the panel that keeps what is ITS OWN from the
     panel that takes whatever was kept last (PENDING, review of PR 818: two panels with different ids sharing
     no state had no guard). The one that was open stays open and the one that was shut stays shut, in both
     orders. */
  it.each([
    ['first', 'Open the first', 'Open the second'],
    ['second', 'Open the second', 'Open the first'],
  ])('keeps the %s open and the other shut', async (_which, opened, other) => {
    const user = setupUser()

    render(<TwoPanels />)
    await user.click(screen.getByRole('button', { name: opened }))
    fireEvent.click(screen.getByRole('button', { name: 'turn' }))

    const cells = within(screen.getByTestId('cells'))

    expect(cells.getByRole('button', { name: opened })).toHaveAttribute('aria-expanded', 'true')
    expect(cells.getByRole('button', { name: other })).toHaveAttribute('aria-expanded', 'false')
  })

  /* IN BOTH ORDERS (PENDING, review of PR 820, 28.11.2026): with the focus on the second only, a panel that took
     the focus for itself because it is drawn last passes, and so does a panel that never asked at all. With the focus
     on the first, the panel drawn after it also asks for the focus when it is drawn again, and it must not get it. */
  it.each([
    ['first', 'Open the first', 'Open the second'],
    ['second', 'Open the second', 'Open the first'],
  ])('gives the focus to the %s, the panel that had it, though the other asks for it too', async (_which, had, other) => {
    const user = setupUser()

    render(<TwoPanels />)
    await user.click(screen.getByRole('button', { name: had }))
    expect(screen.getByRole('button', { name: had })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'turn' }))

    const cells = within(screen.getByTestId('cells'))

    expect(cells.getByRole('button', { name: had })).toHaveFocus()
    expect(cells.getByRole('button', { name: other })).not.toHaveFocus()
  })
})
