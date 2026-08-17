import { render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'
import { BAR, storedTheme, THEME_STORAGE_KEY } from './themeContext'
import { useTheme } from './useTheme'

/* The theme is no longer a button in the header. It is a choice on the settings
 * screen, kept in one provider above every page, and written onto the root
 * element so the stored choice beats the media query in tokens.css. */

/** The one captured group of a match, or a failure naming what was being read. */
function group(found: RegExpExecArray | null, what: string): string {
  return must(must(found, what)[1], `grupa u ${what}`)
}

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
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf-8')
  const script = group(/<script>([\s\S]*?)<\/script>/.exec(html), 'skript teme u index.html')

  /** The page as it is served, so the script has the tag it writes to. */
  function firstFrame(): { theme: string | undefined; bar: string | null } {
    delete document.documentElement.dataset.theme

    const tag = document.createElement('meta')

    tag.setAttribute('name', 'theme-color')
    tag.setAttribute('content', group(/name="theme-color"\s+content="([^"]+)"/.exec(html), 'traka'))
    document.head.append(tag)
    new Function(script)()

    const painted = { theme: document.documentElement.dataset.theme, bar: tag.getAttribute('content') }

    tag.remove()

    return painted
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

    const painted = firstFrame()

    expect(painted.theme).toBe(storedTheme())
    /* The bar as well, and in the same breath as the palette. Written for the dark
       theme alone, a member who chose the light one read a light page under an
       almost black bar until React mounted, which is this flash in the other
       direction. */
    expect(painted.bar).toBe(BAR[storedTheme()])
  })

  it('tells the browser to paint its own bar in the colour of that theme', () => {
    /* The stylesheet does not reach the address bar; this tag is the only thing
       that does. It said `#ffffff` while the portal opened dark for everybody who
       had not chosen otherwise, so an Android phone drew a white bar above an
       almost black page from the first frame.
     *
       Four copies of the dark background have to agree, not three: the tag in
       index.html, the map in themeContext, the token under `[data-theme='dark']`,
       and the token under the media query, where the whole dark palette is written
       a second time. The fourth is what a visitor with no JavaScript and a dark
       system reads, and nothing held it: set to white, with the dark `--text`
       beside it, the whole suite passed and that reader got white on white. */
    const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf-8')

    const tokenBg = (selector: string) =>
      group(
        new RegExp(`${selector}\\s*\\{[^}]*?--bg:\\s*(#[0-9a-f]{3,8})`, 'i').exec(tokens),
        `--bg pod ${selector}`,
      )

    const dark = tokenBg(":root\\[data-theme='dark'\\]")

    expect(group(/name="theme-color"\s+content="([^"]+)"/.exec(html), 'theme-color')).toBe(dark)
    expect(BAR.dark).toBe(dark)
    expect(BAR.light).toBe(tokenBg(':root'))
    expect(tokenBg(":root:not\\(\\[data-theme='light'\\]\\)")).toBe(dark)
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

  it('moves the browser bar with the choice, both ways', async () => {
    /* The tag is written once in index.html for the theme the page opens in, and a
       member who switches keeps that bar unless something moves it. Both
       directions, because a handler that only ever writes one colour looks right
       from whichever side you test it. */
    const user = setupUser()

    /* The tag as index.html serves it, put into this document because a test
       renders the application and not the page around it. Read from the file
       rather than written here, so this walks the real tag. Every other test in
       this file renders without it, which is the other branch: a document with no
       such tag is left alone rather than made to grow one. */
    const tag = document.createElement('meta')

    tag.setAttribute('name', 'theme-color')
    tag.setAttribute(
      'content',
      group(
        /name="theme-color"\s+content="([^"]+)"/.exec(
          readFileSync(join(process.cwd(), 'index.html'), 'utf-8'),
        ),
        'theme-color u index.html',
      ),
    )
    document.head.append(tag)

    renderAt('/sr/podesavanja', 'competitor', '000007')

    const bar = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content')

    await user.click(await screen.findByRole('radio', { name: 'Svetla' }))
    await waitFor(() => expect(bar()).toBe(BAR.light))

    await user.click(screen.getByRole('radio', { name: 'Tamna' }))
    await waitFor(() => expect(bar()).toBe(BAR.dark))

    tag.remove()
  })
})

describe('useTheme outside the provider', () => {
  it('says so instead of quietly rendering the wrong theme', () => {
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow('useTheme must be used inside ThemeProvider')

    complaints.mockRestore()
  })
})
