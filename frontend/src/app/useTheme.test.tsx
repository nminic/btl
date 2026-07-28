import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTheme } from './useTheme'

function Probe() {
  const { theme, toggle } = useTheme()

  return (
    <button type="button" onClick={toggle}>
      {theme}
    </button>
  )
}

function setSystemDark(dark: boolean) {
  window.matchMedia = ((query: string) => ({ matches: dark, media: query })) as typeof matchMedia
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
    setSystemDark(false)
  })

  it('follows the system preference on the first visit', () => {
    setSystemDark(true)
    render(<Probe />)

    expect(screen.getByRole('button')).toHaveTextContent('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('does not store a preference nobody chose', () => {
    setSystemDark(true)
    render(<Probe />)

    // Storing the detected value would pin the theme forever: the visitor
    // would switch the system to light and the site would stay dark.
    expect(localStorage.getItem('btl-theme')).toBeNull()
  })

  it('keeps following the system on a second visit', () => {
    setSystemDark(true)
    const first = render(<Probe />)
    first.unmount()

    setSystemDark(false)
    render(<Probe />)

    expect(screen.getByRole('button')).toHaveTextContent('light')
  })

  it('falls back to light when the system says nothing', () => {
    render(<Probe />)

    expect(screen.getByRole('button')).toHaveTextContent('light')
  })

  it('remembers an explicit choice over the system preference', () => {
    localStorage.setItem('btl-theme', 'dark')
    setSystemDark(false)
    render(<Probe />)

    expect(screen.getByRole('button')).toHaveTextContent('dark')
  })

  it('ignores a damaged stored value', () => {
    localStorage.setItem('btl-theme', 'plava')
    render(<Probe />)

    expect(screen.getByRole('button')).toHaveTextContent('light')
  })

  it('toggles both ways and stores the choice', async () => {
    const user = userEvent.setup()
    render(<Probe />)
    const button = screen.getByRole('button')

    await user.click(button)
    expect(button).toHaveTextContent('dark')
    expect(localStorage.getItem('btl-theme')).toBe('dark')

    await user.click(button)
    expect(button).toHaveTextContent('light')
    expect(localStorage.getItem('btl-theme')).toBe('light')
  })
})
