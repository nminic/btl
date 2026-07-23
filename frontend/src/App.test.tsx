import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the league name', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'BALKANSKA TRKAČKA LIGA' }),
    ).toBeInTheDocument()
  })
})
