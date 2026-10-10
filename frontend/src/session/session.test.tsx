import { render, screen } from '@testing-library/react'
import type { EventComment } from '../data/types'
import { setupUser } from '../test/user'
import { SessionProvider } from './SessionProvider'
import { useSession } from './useSession'

function Probe() {
  const { inbox, markRead, notify } = useSession()

  return (
    <>
      <span data-testid="unread">{inbox.filter((one) => !one.read).length}</span>
      <span data-testid="subjects">{inbox.map((one) => one.subject).join(',')}</span>
      {/* WHICH ones are still unread, and not only how many. Since 28.09.2026 the store
          begins empty (PDL 34), so every message a case reads is one the case wrote, and a
          count alone cannot say that the RIGHT one was marked: two unread messages and a
          mark written over the head of the list leave the same „1" behind. */}
      <span data-testid="unreadSubjects">
        {inbox
          .filter((one) => !one.read)
          .map((one) => one.subject)
          .join(',')}
      </span>
      {/* THE ONE WRITTEN FIRST, which `notify` numbers `msg-1`. Named rather than taken off
          the list on purpose: the list is newest first, so the first one written is the LAST
          one drawn, and a mark written over `inbox[0]` marks the other one. */}
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
      {/* AND ONE TO THE WHOLE LEAGUE, which is the second state of the field the inbox
          filters on. Two messages rather than one is what lets the cases below tell „this
          member was written to" from „everybody was", and „the named one was marked" from
          „the list was"; before 28.09.2026 the same two states arrived free, because the
          bundle seeded two broadcasts into every session (PDL 34 took them out). */}
      <button
        type="button"
        onClick={() =>
          notify({
            from: 'Balkanska trkačka liga',
            to: '',
            subject: 'Poziv na skupštinu lige',
            body: 'Skupština se održava u novembru.',
            date: '2026-07-31',
          })
        }
      >
        posalji ligi
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
  /* WHAT A RUN WAS WORTH WHEN A MODERATOR DECIDED IT WAS ASKED OF THIS STORE until R2 of the
     results flows (10.10.2026), through `submit` and `decide`. Both left with the session's own
     copy of what was sent: the moderator's queue decides on the server since R1 and the member's
     list reads the server since R2, so the points are awarded where the approval is written
     (`VerificationWriteApi`, and `VerificationWriteApiTest` holds them there). The store keeps
     what no route serves yet, and the cases below are about that. */

  it('marks one message read and leaves the rest', async () => {
    const user = setupUser()
    renderProbe('000013')

    /* **THE CASE WRITES BOTH MESSAGES ITSELF, since 28.09.2026 (PDL 34).** It used to begin
       with one unread message the bundle had put there and end at „0", which measured the
       count and nothing else: with a single message, marking the named one and marking the
       whole list are the same act. */
    await user.click(screen.getByRole('button', { name: 'posalji poruku' }))
    await user.click(screen.getByRole('button', { name: 'posalji ligi' }))

    expect(screen.getByTestId('unread')).toHaveTextContent('2')

    await user.click(screen.getByRole('button', { name: 'procitaj' }))

    /* **And WHICH one is left, which is the half a count cannot say.** „Poziv na skupštinu"
       was written second, so it stands first on the list; the button marks the one written
       first. A mark written over `inbox[0]`, or over the whole list, leaves a different
       answer here and the same number above. */
    expect(screen.getByTestId('unread')).toHaveTextContent('1')
    expect(screen.getByTestId('unreadSubjects').textContent).toBe('Poziv na skupštinu lige')
  })

  it('puts a message written to one member into the inbox of that member', async () => {
    const user = setupUser()
    renderProbe('000013')

    /* The broadcast FIRST and the addressed one second, so that „newest first" is a claim
       about order rather than about there being one message: written the other way round,
       an inbox that never sorted at all would answer the same. */
    await user.click(screen.getByRole('button', { name: 'posalji ligi' }))
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
    await user.click(screen.getByRole('button', { name: 'posalji ligi' }))

    /* The store holds everybody's messages and the inbox holds one person's. A
       moderator who hands a picture back would otherwise read their own
       instruction a moment later (PDL P22), which is the whole reason a message
       carries an address. What the league writes to everybody still arrives, and this
       reader is a THIRD member: neither the one written to nor the one who wrote. */
    expect(screen.getByTestId('subjects')).not.toHaveTextContent('Profilna slika je vraćena')
    expect(screen.getByTestId('subjects')).toHaveTextContent('Poziv na skupštinu lige')
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
  const one: Omit<EventComment, 'id'> = {
    eventId: 1,
    memberNumber: '000007',
    who: 'Ime Prezime',
    date: '2026-08-06',
    rating: { organisation: 5, value: 4, ambience: 5 },
    body: 'Reci koje su izasle.',
  }

  return (
    <>
      {/* The QUEUE ITEM each one came out of, which is what the list is kept by
          and what a decision is filed under, and the identity the session handed
          the comment, which is below nought (`SessionProvider`, `publish`). */}
      <span data-testid="published">
        {published.map((each) => `${each.from}=${String(each.comment.id)}`).join(',')}
      </span>
      <button type="button" onClick={() => publish('ver-kom-1', one)}>
        pusti
      </button>
      <button type="button" onClick={() => publish('ver-kom-2', one)}>
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

    expect(screen.getByTestId('published').textContent).toBe('ver-kom-1=-1')

    /* And a different one is a different entry, so the check above is holding
       the identity rather than the length. */
    await user.click(screen.getByRole('button', { name: 'pusti drugi' }))

    expect(screen.getByTestId('published').textContent).toBe('ver-kom-1=-1,ver-kom-2=-2')
  })
})
