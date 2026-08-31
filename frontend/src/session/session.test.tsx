import { must } from '../test/at'
import { render, screen } from '@testing-library/react'
import type { EventComment } from '../data/types'
import { setupUser } from '../test/user'
import { SessionProvider } from './SessionProvider'
import { useSession } from './useSession'

function Probe() {
  const { submissions, submit, decide, amend, inbox, markRead, notify } = useSession()

  return (
    <>
      <span data-testid="statuses">{submissions.map((one) => one.status).join(',')}</span>
      {/* What the administration may put right, and the order the items stand in,
          which `amend` must leave alone: `resubmit` moves an item to the front
          and this one does not, because the moderator writing on it is the one
          already reading it. */}
      <span data-testid="said">
        {submissions
          .map(
            (one) =>
              `${one.raceName}|${one.raceKind}|${one.seconds}|${String(one.corrected)}` +
              `|${one.points}|${one.status}|${String(one.corrects?.seconds)}|${String(one.corrects?.points)}`,
          )
          .join(',')}
      </span>
      <button
        type="button"
        onClick={() => {
          /* The second and not the first, so „the one named" cannot be mistaken
             for „whichever is at the front": with the first amended, an
             implementation that always writes over the head of the list passes
             (measured 31.08.2026). */
          const second = submissions[1]

          if (second !== undefined) {
            amend(second.id, { raceName: 'Prava trka', raceKind: 'time', seconds: 86_400 })
          }
        }}
      >
        ispravi drugi
      </button>
      <button
        type="button"
        onClick={() => {
          /* By the very name the button beside it approves, so the two speak
             about the same item whichever order the list is in. */
          amend('sub-1', { raceName: 'Ispravljeno', raceKind: 'time', seconds: 86_400 })
        }}
      >
        ispravi odluceni
      </button>
      <span data-testid="unread">{inbox.filter((one) => !one.read).length}</span>
      <span data-testid="subjects">{inbox.map((one) => one.subject).join(',')}</span>
      <button
        type="button"
        onClick={() =>
          submit({
            memberNumber: '000001',
            raceName: `Trka ${submissions.length + 1}`,
            raceKind: 'length',
            city: 'Niš',
            country: 'RS',
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
      <button
        type="button"
        onClick={() =>
          submit({
            memberNumber: '000001',
            raceName: 'Ispravka',
            raceKind: 'length',
            city: 'Niš',
            country: 'RS',
            date: '2026-05-10',
            distanceKm: 21.1,
            ascentM: 0,
            descentM: 0,
            seconds: 6730,
            points: 23.55,
            category: 'half',
            photo: '',
            link: 'https://primer.rs/r',
            comment: '',
            corrects: {
              id: 'res-1',
              memberNumber: '000001',
              raceName: 'Ispravka',
              date: '2026-05-10',
              distanceKm: 21.1,
              ascentM: 0,
              descentM: 0,
              seconds: 6730,
              points: 23.55,
              category: 'half',
              raceId: 'trka-1',
              eventName: 'Probni događaj',
              eventSlug: 'probni-dogadjaj',
            },
          })
        }
      >
        posalji ispravku
      </button>
      <button type="button" onClick={() => amend('sub-1', { seconds: 0 })}>
        ponisti vreme
      </button>
      <button type="button" onClick={() => decide('sub-1', 'rejected', 'ne valja')}>
        odbij prvi
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

  it('puts right what the administration may change, and nothing else about the item', async () => {
    /* Owner, 30.08.2026: the administration may change the name of the event, the
       name of the race, the kind and the time before it decides. What it must not
       do is the two things the member's own correction does, and both are visible
       here: the item keeps its place, and it is not marked corrected.

       „Ispravljeno" is a word aimed at the moderator („samo labela", owner
       27.08.2026), and this moderator is the one writing on the row; marked, it
       would tell them somebody else had. Moved, it would leave the row they are
       reading and go to the front as though it were new. */
    const user = setupUser()
    renderProbe()

    await user.click(screen.getByRole('button', { name: 'posalji' }))
    await user.click(screen.getByRole('button', { name: 'posalji' }))

    const before = screen.getByTestId('said').textContent

    expect(before, 'the newest submission is first, as everything in this store is').toMatch(
      /^Trka 2\|/,
    )

    await user.click(screen.getByRole('button', { name: 'ispravi drugi' }))

    const after = must(screen.getByTestId('said').textContent, 'what the store holds').split(',')

    expect(after[1]).toMatch(/^Prava trka\|time\|86400\|false\|/)
    /* And the other one is untouched, which is the half that a change written
       over the whole list, or over whichever item is at the front, would fail. */
    expect(after[0]).toBe(must(before, 'what it held before').split(',')[0])
  })

  it('awards the points at the decision, from what the item holds by then', async () => {
    /* Owner, 31.08.2026: „bodovi treba da se dodele tek NAKON verifikacije." So
       what an item carries until then is the estimate its own form showed the
       member, and the number that counts is worked out at the decision, from what
       the item holds by then.

       Which is what makes a correction safe. Between the sending and the decision
       the administration may settle the kind and the time, and on a timed race the
       time is the race's own limit rather than a run (owner's own case: 23:23:15
       becoming 24:00:00). Awarded earlier, the row would show the new time beside
       the points of the old one, and the portal has already paid once for two
       halves of a row coming from different sums (`pages/member/NewResult.tsx`,
       28.08.2026). */
    const user = setupUser()
    renderProbe()

    await user.click(screen.getByRole('button', { name: 'posalji' }))
    await user.click(screen.getByRole('button', { name: 'posalji' }))

    const before = must(screen.getByTestId('said').textContent, 'before').split(',')[1]?.split('|')

    await user.click(screen.getByRole('button', { name: 'ispravi drugi' }))

    const fixed = must(screen.getByTestId('said').textContent, 'fixed').split(',')[1]?.split('|')

    expect(fixed?.[2], 'the time it was given').toBe('86400')
    /* And the points have **not** moved yet, because nobody has decided it. */
    expect(fixed?.[4], 'still the estimate it came with').toBe(before?.[4])

    /* The very item that was just corrected, which is the one 'ispravi drugi'
       names. */
    await user.click(screen.getByRole('button', { name: 'odobri prvi' }))

    const after = must(screen.getByTestId('said').textContent, 'after').split(',')[1]?.split('|')

    expect(after?.[5], 'decided').toBe('approved')
    expect(after?.[4], 'and now the points belong to the time beside them').not.toBe(before?.[4])
  })

  it('leaves the points alone on a refusal', async () => {
    /* „Nothing at all on a refusal beyond the answer itself": a member who is
       turned down is left exactly where they were, and the number they sent with
       is the number their own list goes on showing them. Held because the branch
       that awards them sits three lines away and would have been easy to write for
       both. */
    const user = setupUser()
    renderProbe()

    await user.click(screen.getByRole('button', { name: 'posalji' }))

    const before = must(screen.getByTestId('said').textContent, 'before').split('|')[4]

    await user.click(screen.getByRole('button', { name: 'odbij prvi' }))

    const after = must(screen.getByTestId('said').textContent, 'after').split('|')

    expect(after[5], 'refused').toBe('rejected')
    expect(after[4], 'and the points are the ones it came with').toBe(before)
  })

  it('awards nothing where the numbers are not a race', async () => {
    /* Reachable, and by the very panel this part adds: each of the three boxes
       accepts nought on its own, so a moderator may leave 0:0:0 standing, and a
       race run in no time is not a race (`data/scoring.ts` answers `null` for it).
       Nought points rather than a hole, which is how every other caller of the
       formula writes it. */
    const user = setupUser()
    renderProbe()

    await user.click(screen.getByRole('button', { name: 'posalji' }))
    await user.click(screen.getByRole('button', { name: 'ponisti vreme' }))
    await user.click(screen.getByRole('button', { name: 'odobri prvi' }))

    const row = must(screen.getByTestId('said').textContent, 'the store').split(',')[0]?.split('|')

    expect(row?.[5], 'decided').toBe('approved')
    expect(row?.[4], 'and worth nothing').toBe('0')
  })

  it('puts the time and the points it decided on into the standing, not the ones it was sent', async () => {
    /* A correction of a counted result carries the record it will replace. `decide`
       copies that record on approval and nothing recomputes it afterwards, so a
       time settled at verification and not carried across is a time the standing
       never sees: the item above would say 3:00:00 and the standing 1:52:10.

       Held apart from the item's own numbers, because the two are written in two
       places and one of them was measured passing while the other was right
       (review, 31.08.2026). */
    const user = setupUser()
    renderProbe()

    await user.click(screen.getByRole('button', { name: 'posalji ispravku' }))

    /* The correction is the only thing in the store, so it is what „the second"
       and „the first" both name here: `amend` and `decide` are pointed at the same
       submission by its id. */
    await user.click(screen.getByRole('button', { name: 'ispravi odluceni' }))
    await user.click(screen.getByRole('button', { name: 'odobri prvi' }))

    const row = must(screen.getByTestId('said').textContent, 'the store').split(',')[0]?.split('|')

    expect(row?.[2], 'the time it was given').toBe('86400')
    expect(row?.[6], 'and the record for the standing carries it too').toBe('86400')
    expect(row?.[7], 'with the points that belong to it').toBe(row?.[4])
  })

  it('leaves a submission alone once somebody has decided it', async () => {
    /* A panel left open over a row that has just been decided still has a live
       button, and a decided result is not the administration's to rewrite: what it
       holds is what somebody agreed to. Held here rather than only on the screen,
       because the screen is one caller and this is the fact. */
    const user = setupUser()
    renderProbe()

    await user.click(screen.getByRole('button', { name: 'posalji' }))
    await user.click(screen.getByRole('button', { name: 'posalji' }))
    await user.click(screen.getByRole('button', { name: 'odobri prvi' }))

    const rows = () => must(screen.getByTestId('said').textContent, 'the store').split(',')
    const approved = must(
      rows().find((one) => one.includes('|approved|')),
      'the one that was decided',
    )

    await user.click(screen.getByRole('button', { name: 'ispravi odluceni' }))

    expect(rows().find((one) => one.includes('|approved|'))).toBe(approved)
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
    eventId: 'evt-fruskogorski-maraton-2010',
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
