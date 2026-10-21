import { screen } from '@testing-library/react'
import { htmlElement } from '../test/at'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

describe('LanguageMenu', () => {
  it('opens and closes from its own button', async () => {
    const user = setupUser()
    renderAt('/sr')

    const button = await screen.findByRole('button', { name: 'Jezik' })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('ticks the language in use', async () => {
    const user = setupUser()
    renderAt('/sr')

    await user.click(await screen.findByRole('button', { name: 'Jezik' }))

    expect(screen.getByRole('option', { name: 'Srpski' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'English' })).toHaveAttribute('aria-selected', 'false')
  })

  /* THE FOCUS LEAVING (28508 and 28844, WCAG 2.2 SC 2.4.11). Escape and a press elsewhere
     used to be the only ways out, so Tab past the last language left the list open over
     whatever came next in the header, the button that opens the navigation included. */
  it('closes when Tab takes the focus past its last item, and leaves the focus where it went', async () => {
    const user = setupUser()
    renderAt('/sr')

    const button = await screen.findByRole('button', { name: 'Jezik' })
    await user.click(button)
    screen.getByRole('option', { name: 'English' }).focus()

    await user.tab()

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).not.toBe(document.body)
    expect(screen.getByRole('listbox')).not.toContainElement(htmlElement(document.activeElement))
    expect(button).not.toHaveFocus()
  })

  it('closes when Shift+Tab takes the focus off its button, and leaves the focus where it went', async () => {
    const user = setupUser()
    renderAt('/sr')

    const button = await screen.findByRole('button', { name: 'Jezik' })
    await user.click(button)
    expect(button).toHaveFocus()

    await user.tab({ shift: true })

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).not.toHaveFocus()
    expect(document.activeElement).not.toBe(document.body)
  })

  it('stays open while the focus moves from the button into the list and between its items', async () => {
    const user = setupUser()
    renderAt('/sr')

    const button = await screen.findByRole('button', { name: 'Jezik' })
    await user.click(button)

    await user.tab()
    expect(screen.getByRole('option', { name: 'Srpski' })).toHaveFocus()
    expect(button).toHaveAttribute('aria-expanded', 'true')

    await user.tab()
    expect(screen.getByRole('option', { name: 'English' })).toHaveFocus()
    expect(button).toHaveAttribute('aria-expanded', 'true')

    await user.tab({ shift: true })
    await user.tab({ shift: true })
    expect(button).toHaveFocus()
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('stays open when the focus goes nowhere an element can be named', async () => {
    const user = setupUser()
    renderAt('/sr')

    const button = await screen.findByRole('button', { name: 'Jezik' })
    await user.click(button)
    expect(button).toHaveFocus()

    // The list itself cannot take focus: the press blurs the button with a null
    // relatedTarget, which is not the reader leaving the box.
    await user.click(screen.getByRole('listbox'))

    expect(button).not.toHaveFocus()
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes on Escape', async () => {
    const user = setupUser()
    renderAt('/sr')

    const button = await screen.findByRole('button', { name: 'Jezik' })
    await user.click(button)
    await user.keyboard('{Escape}')

    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes when something else is clicked', async () => {
    const user = setupUser()
    renderAt('/sr')

    const button = await screen.findByRole('button', { name: 'Jezik' })
    await user.click(button)
    await user.click(screen.getByRole('main'))

    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('changes the language from the keyboard', async () => {
    const user = setupUser()
    renderAt('/sr/timovi')

    await user.click(await screen.findByRole('button', { name: 'Jezik' }))
    screen.getByRole('option', { name: 'English' }).focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('option', { name: 'English' })).toHaveAttribute('aria-selected', 'true')
  })

  it('leaves a key it does not handle alone', async () => {
    const user = setupUser()
    renderAt('/sr')

    await user.click(await screen.findByRole('button', { name: 'Jezik' }))
    screen.getByRole('option', { name: 'English' }).focus()
    await user.keyboard('{ArrowDown}')

    expect(screen.getByRole('option', { name: 'Srpski' })).toHaveAttribute('aria-selected', 'true')
  })
})
