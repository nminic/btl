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
