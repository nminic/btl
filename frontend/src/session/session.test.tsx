import { render, screen } from '@testing-library/react'
import { setupUser } from '../test/user'
import { SessionProvider } from './SessionProvider'
import { useSession } from './useSession'

function Probe() {
  const { submissions, submit, decide, inbox, markRead, notify } = useSession()

  return (
    <>
      <span data-testid="statuses">{submissions.map((one) => one.status).join(',')}</span>
      <span data-testid="unread">{inbox.filter((one) => !one.read).length}</span>
      <span data-testid="subjects">{inbox.map((one) => one.subject).join(',')}</span>
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
      <button
        type="button"
        onClick={() =>
          notify({
            from: 'Balkanska trkačka liga',
            to: '000013',
            subject: 'Profilna slika je vraćena',
            body: 'Pošalji sliku na kojoj ti se vidi lice.',
            date: '2026-07-30',
          })
        }
      >
        posalji poruku
      </button>
    </>
  )
}

function renderProbe(memberNumber: string | null = null) {
  return render(
    <SessionProvider initialMemberNumber={memberNumber}>
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

  it('puts a message written to one member into the inbox of that member', async () => {
    const user = setupUser()
    renderProbe('000013')

    await user.click(screen.getByRole('button', { name: 'posalji poruku' }))

    // Newest first, which is where somebody looking for what just arrived looks.
    expect(screen.getByTestId('subjects').textContent?.split(',')[0]).toBe(
      'Profilna slika je vraćena',
    )
    expect(screen.getByTestId('unread')).toHaveTextContent('2')
  })

  it('keeps a message addressed to somebody else out of the inbox', async () => {
    const user = setupUser()
    renderProbe('000014')

    await user.click(screen.getByRole('button', { name: 'posalji poruku' }))

    /* The store holds everybody's messages and the inbox holds one person's. A
       moderator who hands a picture back would otherwise read their own
       instruction a moment later (PDL P22), which is the whole reason a message
       carries an address. What the league writes to everybody still arrives. */
    expect(screen.getByTestId('subjects')).not.toHaveTextContent('Profilna slika je vraćena')
    expect(screen.getByTestId('subjects')).toHaveTextContent('Dobro došao u pripremu sezone 2027')
  })
})

describe('useSession', () => {
  it('refuses to work outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow('useSession must be used inside SessionProvider')

    spy.mockRestore()
  })
})
