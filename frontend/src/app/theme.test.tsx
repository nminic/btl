import { render, screen, waitFor } from '@testing-library/react'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'
import { storedTheme, THEME_STORAGE_KEY } from './themeContext'
import { useTheme } from './useTheme'

/* The theme is no longer a button in the header. It is a choice on the settings
 * screen, kept in one provider above every page, and written onto the root
 * element so the stored choice beats the media query in tokens.css. */

function Probe() {
  const { theme } = useTheme()

  return <span>{theme}</span>
}

describe('storedTheme', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is dark when nothing has been chosen', () => {
    expect(storedTheme()).toBe('dark')
  })

  it('is light only when light was chosen and written down', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    expect(storedTheme()).toBe('light')

    localStorage.setItem(THEME_STORAGE_KEY, 'nesto-trece')
    expect(storedTheme()).toBe('dark')
  })
})

describe('the theme on the page', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('opens dark, whatever the system prefers', async () => {
    renderAt('/sr')

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
  })

  it('opens in the theme that was chosen last time', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    renderAt('/sr')

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'))
  })

  it('is changed from settings, and the choice is remembered', async () => {
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', '000007')

    expect(await screen.findByRole('radio', { name: 'Tamna' })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: 'Svetla' }))

    expect(screen.getByRole('radio', { name: 'Svetla' })).toBeChecked()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'))

    await user.click(screen.getByRole('radio', { name: 'Tamna' }))

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
  })
})

describe('useTheme outside the provider', () => {
  it('says so instead of quietly rendering the wrong theme', () => {
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow('useTheme must be used inside ThemeProvider')

    complaints.mockRestore()
  })
})
