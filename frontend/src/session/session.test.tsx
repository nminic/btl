import { render, screen } from '@testing-library/react'
import { setupUser } from '../test/user'
import { SessionProvider } from './SessionProvider'
import { useSession } from './useSession'

function Probe() {
  const { submissions, submit, decide, messages, markRead } = useSession()

  return (
    <>
      <span data-testid="statuses">{submissions.map((one) => one.status).join(',')}</span>
      <span data-testid="unread">{messages.filter((one) => !one.read).length}</span>
      <button
        type="button"
        onClick={() =>
          submit({
            memberNumber: '000001',
            eventName: `Trka ${submissions.length + 1}`,
            date: '2026-05-10',
            distanceKm: 10,
            ascentM: 0,
            descentM: 0,
            startTime: '10:00',
            seconds: 3000,
            photo: '',
            points: 1,
            category: 'short',
            link: 'https://primer.rs',
          })
        }
      >
        posalji
      </button>
      <button type="button" onClick={() => decide('sub-1', 'approved', '')}>
        odobri prvi
      </button>
      <button type="button" onClick={() => markRead('msg-1')}>
        procitaj
      </button>
    </>
  )
}

function renderProbe() {
  return render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  )
}

describe('the session store', () => {
  it('decides one submission and leaves the others alone', async () => {
    const user = setupUser()
    renderProbe()

    await user.click(screen.getByRole('button', { name: 'posalji' }))
    await user.click(screen.getByRole('button', { name: 'posalji' }))
    expect(screen.getByTestId('statuses')).toHaveTextContent('pending,pending')

    await user.click(screen.getByRole('button', { name: 'odobri prvi' }))

    // Only the one named changes; the other stays where it was.
    expect(screen.getByTestId('statuses').textContent).toContain('approved')
    expect(screen.getByTestId('statuses').textContent).toContain('pending')
  })

  it('marks one message read and leaves the rest', async () => {
    const user = setupUser()
    renderProbe()

    expect(screen.getByTestId('unread')).toHaveTextContent('1')
    await user.click(screen.getByRole('button', { name: 'procitaj' }))
    expect(screen.getByTestId('unread')).toHaveTextContent('0')
  })
})

describe('useSession', () => {
  it('refuses to work outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow('useSession must be used inside SessionProvider')

    spy.mockRestore()
  })
})
