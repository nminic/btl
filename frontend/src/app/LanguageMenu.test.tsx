import { screen } from '@testing-library/react'
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
