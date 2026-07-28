import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Explodes(): never {
  throw new Error('puklo je')
}

describe('ErrorBoundary', () => {
  it('shows the children while nothing is wrong', () => {
    render(
      <ErrorBoundary fallback={<p>zamena</p>}>
        <p>sadržaj</p>
      </ErrorBoundary>,
    )

    expect(screen.getByText('sadržaj')).toBeInTheDocument()
  })

  it('shows the fallback instead of a blank page, and logs the cause', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary fallback={<p>zamena</p>}>
        <Explodes />
      </ErrorBoundary>,
    )

    expect(screen.getByText('zamena')).toBeInTheDocument()
    expect(logged).toHaveBeenCalled()

    logged.mockRestore()
  })
})
