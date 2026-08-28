import { fireEvent, screen, within } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { useSession } from '../../session/useSession'

/**
 * What a member may do with a result of their own after sending it.
 *
 * Owner, 27.08.2026, answering six questions at once: a member may change it and
 * may delete it („član ga ili briše (ima pravo na to, iako je verifikovan) ili
 * menja i dostavlja dokaz za tu izmenu"); everything may be changed except which
 * race it is („sve osim trke"), so whoever picked the wrong race deletes it and
 * enters another; a corrected result goes to the back of the queue rather than
 * keeping its place, because a moderator who has already read it would otherwise
 * decide numbers they never saw; and the queue is told that it was corrected and
 * nothing more („samo labela, ne šta je ispravljano"), which is also all that can
 * be said while no history of a result is kept (P9).
 *
 * Until this the screen offered one control on one state: a refused result could
 * be sent again. A result still waiting could be neither changed nor taken back,
 * and the decision that a member may delete their own had been written down since
 * before and never reached a screen at all.
 */

const ME = '000007'
const MINE = '/sr/moji-rezultati'
const QUEUE = '/sr/administracija/verifikacija/rezultati'

/** One result of a given member, waiting, written straight into the store. */
function Waiting({ whose, races }: { whose: string; races: string[] }) {
  const session = useSession()
  const done = useRef(false)

  useEffect(() => {
    if (!done.current) {
      done.current = true

      for (const raceName of races) {
        session.submit({
          memberNumber: whose,
          raceName,
          date: '2026-05-10',
          distanceKm: 21.1,
          ascentM: 540,
          descentM: 540,
          photo: '',
          seconds: 6730,
          points: 12.34,
          category: 'half',
          link: 'https://primer.rs/rezultati',
          comment: '',
        })
      }
    }
  }, [session, whose, races])

  return null
}

/** A press that sends one more result in, for a walk that needs one sent after
 *  something else has happened rather than on mount. */
function SendOne({ whose, race }: { whose: string; race: string }) {
  const session = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        session.submit({
          memberNumber: whose,
          raceName: race,
          date: '2026-05-10',
          distanceKm: 21.1,
          ascentM: 540,
          descentM: 540,
          photo: '',
          seconds: 6730,
          points: 12.34,
          category: 'half',
          link: 'https://primer.rs/rezultati',
          comment: '',
        })
      }}
    >
      posalji jos jedan
    </button>
  )
}

/** Everything in the store, in one line each, for what no screen draws. */
function Sent() {
  const { submissions } = useSession()

  return (
    <ul aria-label="store">
      {submissions.map((one) => (
        <li key={one.id}>{`${one.id} | ${one.raceName} | ${one.status} | ${String(one.corrected)}`}</li>
      ))}
    </ul>
  )
}

/** The list of results this member has sent in, as rows. */
function sent() {
  return within(screen.getByRole('list')).getAllByRole('listitem')
}

describe('a result of one’s own that is still waiting', () => {
  it('may be changed and may be taken back', async () => {
    /* Both controls, on the state that had neither. „Izmeni" and not „Pošalji
       ponovo", because the two moments differ: one that was sent back is sent
       again, one that nobody has decided is simply changed. */
    renderAt(MINE, 'competitor', ME, undefined, null, <Waiting whose={ME} races={['Probna trka']} />)

    const row = within(must(sent()[0], 'the result just sent'))

    expect(row.getByRole('link', { name: 'Izmeni rezultat: Probna trka' })).toBeVisible()
    expect(row.getByRole('button', { name: 'Obriši: Probna trka' })).toBeVisible()
    /* And not the words of a refusal, which is a different moment. */
    expect(row.queryByRole('link', { name: /^Pošalji ponovo/ })).toBeNull()
  })

  it('asks twice before it is gone, and then it is gone', async () => {
    /* The portal's one way of asking about something nothing brings back, taken
       from the rows of the administration rather than written a second time
       (`DeleteRecord`). The name of the race is on all three controls, so a list
       of six waiting results is six questions and not six buttons alike. */
    const user = setupUser()

    renderAt(MINE, 'competitor', ME, undefined, null, <Waiting whose={ME} races={['Probna trka']} />)

    await user.click(screen.getByRole('button', { name: 'Obriši: Probna trka' }))

    /* One press opens the question and does not answer it. */
    expect(screen.getByText('Probna trka')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Potvrdi brisanje: Probna trka' }))

    expect(screen.queryByText('Probna trka')).toBeNull()
    expect(screen.getByText('Nijedan rezultat još nije poslat na proveru.')).toBeVisible()
  })

  it('is left alone when the question is answered no', async () => {
    /* The other half of asking. A question with only one answer is not a
       question. */
    const user = setupUser()

    renderAt(MINE, 'competitor', ME, undefined, null, <Waiting whose={ME} races={['Probna trka']} />)

    await user.click(screen.getByRole('button', { name: 'Obriši: Probna trka' }))
    await user.click(screen.getByRole('button', { name: 'Odustani od brisanja: Probna trka' }))

    expect(screen.getByText('Probna trka')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Obriši: Probna trka' })).toBeVisible()
  })
})

describe('the sentence over the form while a result is being changed', () => {
  it('says what is being changed, and does not invent a refusal', async () => {
    /* Two ways in and two sentences since 27.08.2026. A result that was sent
       back carries the moderator's reason; one that is still waiting carries
       none, and told with the words of a refusal it says something was refused
       when nobody has decided anything, printing „Razlog je bio:" with nothing
       after it.

       Measured: with the sentence forced to the refusal wording for both, every
       other test here stayed green. */
    renderAt('/sr/rezultat/novi?ponovo=sub-1', 'competitor', ME, undefined, '2026-08-23', (
      <Waiting whose={ME} races={['Probna trka']} />
    ))

    expect(await screen.findByText(/Menjaš rezultat koji još čeka proveru/)).toBeVisible()
    expect(screen.queryByText(/Ispravljaš rezultat koji je odbijen/)).toBeNull()
  })
})

describe('a result that has already been decided', () => {
  it('offers neither of the two, because it is nobody’s to change any more', async () => {
    /* The boundary the owner drew: a member may change and may take back what is
       still waiting on somebody. An approved one has been counted, and what he
       said about that is a second road („ili menja i dostavlja dokaz za tu
       izmenu"), not these two controls on this list.

       Approved through the same store, so the only thing that differs between
       this case and the one above is the state of the result. The first version
       of this test never approved anything and asked the question of a waiting
       result, so it passed while measuring nothing; found by reading it back
       rather than by a round. */
    function Approved() {
      const session = useSession()
      const done = useRef(false)

      useEffect(() => {
        if (!done.current && session.submissions.length === 1) {
          done.current = true
          session.decide('sub-1', 'approved', '')
        }
      }, [session])

      return null
    }

    renderAt(MINE, 'competitor', ME, undefined, null, (
      <>
        <Waiting whose={ME} races={['Probna trka']} />
        <Approved />
      </>
    ))

    const row = within(must(sent()[0], 'the result that was approved'))

    expect(row.getByText('Probna trka')).toBeVisible()
    expect(row.queryByRole('link', { name: /^Izmeni/ })).toBeNull()
    expect(row.queryByRole('button', { name: /^Obriši/ })).toBeNull()
    expect(row.queryByRole('link', { name: /^Pošalji ponovo/ })).toBeNull()
  })
})

describe('the queue a corrected result comes back to', () => {
  it('is told that it was corrected, and nothing about what changed', async () => {
    /* The label and nothing behind it (owner: „samo labela, ne šta je
       ispravljano"), which is also all there is to say: the portal keeps no
       history of a result, so there is no before to show.

       Written through the store rather than through the form, because what is
       measured is what the moderator is shown; the walk through the form is the
       subject of `newResult.test.tsx`. */
    function Corrected() {
      const session = useSession()
      const done = useRef(false)

      useEffect(() => {
        if (!done.current) {
          done.current = true
          session.resubmit('sub-1', {
            raceName: 'Probna trka',
            date: '2026-05-10',
            distanceKm: 21.1,
            ascentM: 540,
            descentM: 540,
            photo: '',
            seconds: 6000,
            points: 15.5,
            category: 'half',
            link: 'https://primer.rs/rezultati',
            comment: '',
          })
        }
      }, [session])

      return null
    }

    renderAt(QUEUE, 'superadmin', null, undefined, null, (
      <>
        <Waiting whose={ME} races={['Probna trka']} />
        <Corrected />
      </>
    ))

    const row = must(
      (await screen.findAllByRole('row')).find((one) => within(one).queryByText('Probna trka') !== null),
      'the corrected result in the queue',
    )

    expect(within(row).getByText('Ispravljeno')).toBeVisible()
  })

  it('says nothing of the sort about one nobody has touched', async () => {
    /* The other direction, and the one that decides whether the label means
       anything: a mark on every row is a mark on none. */
    renderAt(QUEUE, 'superadmin', null, undefined, null, (
      <Waiting whose={ME} races={['Probna trka']} />
    ))

    const row = must(
      (await screen.findAllByRole('row')).find((one) => within(one).queryByText('Probna trka') !== null),
      'the untouched result in the queue',
    )

    expect(within(row).queryByText('Ispravljeno')).toBeNull()
  })

  it('puts it where a new one goes, rather than where it stood', async () => {
    /* Owner: „Vraća se na kraj reda kao nov." A moderator who has already opened
       this item read the numbers it had then; left in place with different
       numbers, the next press decides something they never saw.

       Where a new one goes is the front, because that is where `submit` puts one
       and every list in this store is newest first. The two halves of his
       sentence pull apart under such a list, and „kao nov" is the half that can be
       obeyed exactly: what the result loses is its old place, and what it gains is
       the place of anything freshly arrived.

       Three results, the first of them corrected, so the question is about order
       and not about a list of one. */
    function CorrectFirst() {
      const session = useSession()
      const done = useRef(false)

      useEffect(() => {
        if (!done.current && session.submissions.length === 3) {
          done.current = true
          session.resubmit('sub-1', {
            raceName: 'Prva trka',
            date: '2026-05-10',
            distanceKm: 21.1,
            ascentM: 540,
            descentM: 540,
            photo: '',
            seconds: 6000,
            points: 15.5,
            category: 'half',
            link: 'https://primer.rs/rezultati',
            comment: '',
          })
        }
      }, [session])

      return null
    }

    renderAt(MINE, 'competitor', ME, undefined, null, (
      <>
        <Waiting whose={ME} races={['Prva trka', 'Druga trka', 'Treća trka']} />
        <CorrectFirst />
      </>
    ))

    const names = sent().map((one) => within(one).getAllByRole('strong')[0]?.textContent ?? '')

    /* Sent in as Prva, Druga, Treća, and the newest is drawn first, so the list
       stands as Treća, Druga, Prva. Corrected is **Prva**, the one at the bottom,
       precisely because correcting one that is already where it would land leaves
       the order unchanged and this case would then pass whether it moved or not.
       Both earlier versions of this case did exactly that, once at each end. */
    expect(names, 'the corrected result kept its place').toEqual([
      'Prva trka',
      'Treća trka',
      'Druga trka',
    ])
  })
})

describe('one’s own result that has already been counted', () => {
  it('does not open in the form, whatever the address says', async () => {
    /* The road for a verified result is a different one (owner: „ili menja i
       dostavlja dokaz za tu izmenu"), and it is not this form quietly reopening
       something that is already in the standing. The list offers no way in, so
       the only way to try is to type the address, which is exactly why the form
       and not only the list has to say no.

       Measured: with the condition widened to let anything through, every other
       test here stayed green, so this case is the whole of that guard. */
    function Approved() {
      const session = useSession()
      const done = useRef(false)

      useEffect(() => {
        if (!done.current && session.submissions.length === 1) {
          done.current = true
          session.decide('sub-1', 'approved', '')
        }
      }, [session])

      return null
    }

    renderAt('/sr/rezultat/novi?ponovo=sub-1', 'competitor', ME, undefined, '2026-08-23', (
      <>
        <Waiting whose={ME} races={['Moja odobrena trka']} />
        <Approved />
      </>
    ))

    await screen.findByLabelText(/^Naziv trke/)

    /* Read off the sentence over the form and not off the boxes under it. The
       fields are seeded once, when the form mounts, and this result is written
       into the store a turn later, so the boxes would be empty either way and a
       question about them would measure nothing. The sentence is drawn on every
       render and says which of the three states the form is in. */
    expect(screen.getByText(/Rezultat ulazi u rang liste tek kad/)).toBeVisible()
    expect(screen.queryByText(/Menjaš rezultat koji još čeka/)).toBeNull()
    expect(screen.queryByText(/Ispravljaš rezultat koji je odbijen/)).toBeNull()
  })
})

describe('somebody else’s result that is only waiting', () => {
  it('does not open, however the address is typed', async () => {
    /* The same rule the refused one has, and it had to widen with the state:
       until 27.08.2026 the form looked only for a refused result, so widening it
       to „not decided" without carrying the owner across would have opened
       everybody's waiting results to everybody. The ids are `sub-1`, `sub-2` and
       so on, so the address is guessed on the first try. */
    renderAt(
      `/sr/rezultat/novi?ponovo=sub-1`,
      'competitor',
      ME,
      undefined,
      '2026-08-23',
      <Waiting whose="000021" races={['Tuđa trka']} />,
    )

    await screen.findByLabelText(/^Naziv trke/)

    /* Read off the sentence over the form and not off the boxes, for the reason
       the case above already gives: the boxes are seeded once at mount and this
       result reaches the store a turn later, so they are empty whether the guard
       is there or not. Measured by a review on 27.08.2026: with the owner taken
       out of the condition, this file stayed green at ten of ten while the form
       opened somebody else's result and said so in as many words. */
    expect(screen.getByText(/Rezultat ulazi u rang liste tek kad/)).toBeVisible()
    expect(screen.queryByText(/Menjaš rezultat koji još čeka/)).toBeNull()
    expect(screen.queryByText(/Ispravljaš rezultat koji je odbijen/)).toBeNull()
  })
})

describe('the race a correction is for', () => {
  it('cannot be changed into another one', async () => {
    /* Owner, 27.08.2026: „sve osim trke". A correction keeps the identity of the
       submission a moderator may already have read, so letting the race change
       turns that row into a different race under the same number while the queue
       is told only that something was corrected.

       Measured by a review before this was here: the box was an ordinary one, a
       member typed another name over it, and the same submission came back as
       „Sasvim druga trka" with the date, the length and the climb of that other
       race behind it. */
    const user = setupUser()

    /* From the list, for the reason the case above gives: a form opened straight
       at the address comes up with empty boxes and will not send. */
    renderAt(MINE, 'competitor', ME, undefined, '2026-08-23', (
      <>
        <Waiting whose={ME} races={['Probna trka']} />
        <Sent />
      </>
    ))

    await user.click(await screen.findByRole('link', { name: 'Izmeni rezultat: Probna trka' }))
    await screen.findByText(/Menjaš rezultat koji još čeka proveru/)

    const race = screen.getByLabelText(/^Naziv trke/)

    /* Reachable and refused rather than switched off, which is the portal's way
       of locking anything (PDL: „Odbijeno, ne ugašeno"). Both words, because a
       screen reader hears the first and a browser obeys the second. */
    expect(race).toHaveAttribute('aria-disabled', 'true')
    expect(race).toHaveAttribute('readonly')

    /* And then the half that actually holds. The lock is a courtesy to whoever is
       filling the form in; what must be true whatever reaches the code is that the
       race a correction carries is the one the submission already names. Measured
       by typing over the box and sending, which is exactly the walk a review used
       to get „Sasvim druga trka" into the store under the old number. */
    /* Forced past the lock rather than typed through it: `user.type` refuses a
       box that is not editable, which is the lock doing its job and is measured
       above. What is measured here is the half beneath it, so the value is
       changed the way any other code path could change it. */
    fireEvent.change(race, { target: { value: 'Sasvim druga trka' } })

    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))

    const stored = within(screen.getByRole('list', { name: 'store' })).getAllByRole('listitem')

    expect(stored).toHaveLength(1)
    expect(stored[0]?.textContent).toContain('Probna trka')
    expect(stored[0]?.textContent).not.toContain('Sasvim druga trka')
  })
})

describe('a result sent back unchanged', () => {
  it('is not marked as corrected, because nothing was', async () => {
    /* „Samo labela" (owner, 27.08.2026) is a label that has to mean something. A
       member who presses „Izmeni", looks at their own numbers and sends them back
       has corrected nothing, and the mark then tells a moderator to re-read a row
       that has not moved. Measured by a review before this was here: sending the
       identical values straight back put „Ispravljeno" on the row. */
    const user = setupUser()

    /* Walked in from the list rather than opened at the address. The form seeds
       its boxes once, when it mounts, and a probe writes into the store a turn
       later, so a form opened straight at the address comes up empty and refuses
       to send: the question would then be asked of a store nothing wrote to.
       Pressing „Izmeni" is also the road a member takes. */
    renderAt(MINE, 'competitor', ME, undefined, '2026-08-23', (
      <>
        <Waiting whose={ME} races={['Probna trka']} />
        <Sent />
      </>
    ))

    await user.click(await screen.findByRole('link', { name: 'Izmeni rezultat: Probna trka' }))
    await screen.findByText(/Menjaš rezultat koji još čeka proveru/)
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))

    /* The send really happened, or the question below is asked of a store nothing
       wrote to and answers the same whatever the rule is. */
    expect(await screen.findByText('Rezultat je ponovo poslat na proveru.')).toBeVisible()

    const stored = within(screen.getByRole('list', { name: 'store' })).getAllByRole('listitem')

    expect(stored).toHaveLength(1)
    expect(stored[0]?.textContent, 'nothing changed and it says it did').toContain('| false')
  })
})

describe('the number a deleted result leaves behind', () => {
  it('is never handed to anything else', async () => {
    /* The fault a review measured on 27.08.2026, and the reason it could happen
       at all: identities were counted from how many submissions there were, which
       is safe only while nothing is ever removed. `withdraw`, added the same day,
       is the first thing that removes one.

       The walk: one member sends a result, another member sends one, the first
       deletes theirs and sends another. Counted, the new one takes the number the
       second member's result holds; two submissions then answer to one id, and a
       moderator pressing „Odobri" on one approves both. Measured then: a result
       belonging to another member went into the standings on a press that never
       touched it.

       The rule the portal already keeps for every other numbered record is to
       count up from the highest number used (`raceIds.ts`), and its own note
       records this same fault measured on races four days earlier. */
    const user = setupUser()

    renderAt(MINE, 'competitor', ME, undefined, null, (
      <>
        <Waiting whose={ME} races={['Moja prva']} />
        <Waiting whose="000021" races={['Tuđa trka']} />
        <SendOne whose={ME} race="Moja druga" />
        <Sent />
      </>
    ))

    await user.click(await screen.findByRole('button', { name: 'Obriši: Moja prva' }))
    await user.click(screen.getByRole('button', { name: 'Potvrdi brisanje: Moja prva' }))
    await user.click(screen.getByRole('button', { name: 'posalji jos jedan' }))

    const held = within(screen.getByRole('list', { name: 'store' }))
      .getAllByRole('listitem')
      .map((one) => (one.textContent ?? '').split(' | ')[0])

    expect(held, 'the walk did not end with two results').toHaveLength(2)
    expect(new Set(held).size, `two submissions answer to one number: ${held.join(', ')}`).toBe(2)
  })
})
