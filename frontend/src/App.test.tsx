import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('shows the league logo with an accessible name', () => {
    render(<App />)
    const logo = screen.getByRole('img', { name: 'BALKANSKA TRKAČKA LIGA' })
    expect(logo).toHaveAttribute('src', '/btl-logo.jpg')
  })

  it('shows the league name as a hover tooltip', () => {
    render(<App />)
    expect(screen.getByRole('img', { name: 'BALKANSKA TRKAČKA LIGA' })).toHaveAttribute(
      'title',
      'BALKANSKA TRKAČKA LIGA',
    )
  })

  it('shows the under-construction notice', () => {
    render(<App />)
    expect(screen.getByText('Portal je u izgradnji')).toBeInTheDocument()
  })
})
