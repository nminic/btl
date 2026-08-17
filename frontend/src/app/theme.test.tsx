import { render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { must } from '../test/at'
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

describe('the theme before the first paint', () => {
  /* index.html carries the same decision as `storedTheme`, because it has to be
     made before any module is fetched. Two copies of one rule drift, and this one
     had: written for a stored value only, it left a visitor with nothing stored
     and a light system reading the light palette for the first frame (tokens.css
     follows the system while `data-theme` is absent) and then moved them to dark
     on mount. That is the flash the script exists to prevent.
   *
     Measured by running the script the browser runs, off the file the browser is
     served, rather than by reading it: a text comparison passes on two spellings
     of the same wrong rule. */
  const script = must(
    must(
      /<script>([\s\S]*?)<\/script>/.exec(readFileSync(join(process.cwd(), 'index.html'), 'utf-8')),
      'skript teme u index.html',
    )[1],
    'telo skripta teme',
  )

  function firstFrame(): string | undefined {
    delete document.documentElement.dataset.theme
    new Function(script)()

    return document.documentElement.dataset.theme
  }

  beforeEach(() => {
    localStorage.clear()
  })

  it.each([
    ['nothing stored', null],
    ['light stored', 'light'],
    ['dark stored', 'dark'],
    ['something else stored', 'nesto-trece'],
  ])('paints what the page settles in, with %s', (_case, stored) => {
    if (stored !== null) {
      localStorage.setItem(THEME_STORAGE_KEY, stored)
    }

    expect(firstFrame()).toBe(storedTheme())
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
