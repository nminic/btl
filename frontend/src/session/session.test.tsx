import { render, screen } from '@testing-library/react'
import type { EventComment } from '../data/types'
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
            seconds: 3000,
            photo: '',
            points: 1,
            category: 'short',
            link: 'https://primer.rs',
    comment: '',
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

/* What a moderator letting a comment out writes down, and what happens when they
   let the same one out twice.
 *
 * Not reachable from the queue today: an item that has been settled leaves the
 * list of waiting ones, so nothing on that screen offers a second decision on
 * it. The rule lives here because the list does, and because the screen is being
 * rebuilt around exactly this (owner, 06.08.2026, no section of settled items):
 * a list that grows on every call would draw the comment twice under its event
 * the day a second decision becomes possible. */
function Published() {
  const { published, publish } = useSession()
  const one: EventComment = {
    id: 'ver-kom-1',
    eventId: 'evt-fruskogorski-maraton-2010-05-08',
    memberNumber: '000007',
    who: 'Ime Prezime',
    date: '2026-08-06',
    rating: { organisation: 5, value: 4, ambience: 5 },
    body: 'Reci koje su izasle.',
  }

  return (
    <>
      <span data-testid="published">{published.map((each) => each.id).join(',')}</span>
      <button type="button" onClick={() => publish(one)}>
        pusti
      </button>
      <button type="button" onClick={() => publish({ ...one, id: 'ver-kom-2' })}>
        pusti drugi
      </button>
    </>
  )
}

describe('what has been let out', () => {
  it('keeps one entry however many times the same comment is let out', async () => {
    const user = setupUser()

    render(
      <SessionProvider>
        <Published />
      </SessionProvider>,
    )

    expect(screen.getByTestId('published')).toHaveTextContent('')

    await user.click(screen.getByRole('button', { name: 'pusti' }))
    await user.click(screen.getByRole('button', { name: 'pusti' }))

    expect(screen.getByTestId('published').textContent).toBe('ver-kom-1')

    /* And a different one is a different entry, so the check above is holding
       the identity rather than the length. */
    await user.click(screen.getByRole('button', { name: 'pusti drugi' }))

    expect(screen.getByTestId('published').textContent).toBe('ver-kom-1,ver-kom-2')
  })
})
