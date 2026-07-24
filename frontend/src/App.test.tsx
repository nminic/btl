import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders a main landmark', () => {
    render(<App />)
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('names the page after the league, announced only once', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Balkanska trkačka liga' }),
    ).toBeInTheDocument()
    // The logo is decorative: the heading text is the accessible name.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows the league name as a hover tooltip on the logo', () => {
    const { container } = render(<App />)
    const logo = container.querySelector('img')
    expect(logo).toHaveAttribute('title', 'BALKANSKA TRKAČKA LIGA')
    expect(logo).toHaveAttribute('src', '/btl-logo-640.jpg')
  })

  it('shows the under-construction notice', () => {
    render(<App />)
    expect(screen.getByText('Portal je u izgradnji')).toBeInTheDocument()
  })
})
