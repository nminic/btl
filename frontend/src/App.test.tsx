import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('prikazuje naziv lige', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'BALKANSKA TRKAČKA LIGA' }),
    ).toBeInTheDocument()
  })
})
