import { vi } from 'vitest'
import { SLOW } from '../../test/slow'
import type { BtlEvent, Race, Result } from '../../data/types'
import { fireEvent, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
/** The counted results as the portal reads them, straight out of the file the
 *  screens are served. Read rather than written down because a result's number
 *  is the file's to choose, and a case about whose result it is has to name one
 *  that really belongs to somebody else. */
const countedResults: Result[] = JSON.parse(
  readFileSync(join(process.cwd(), 'public/mock/results.json'), 'utf-8'),
)
/** The calendar as the files hold it, for the one case that asks what a
 *  correction of a counted result wrote down: the answer has to come from the
 *  race and its event, and nothing on a screen shows either. */
const allRaces: Race[] = JSON.parse(
  readFileSync(join(process.cwd(), 'public/mock/races.json'), 'utf-8'),
)
const allEvents: BtlEvent[] = JSON.parse(
  readFileSync(join(process.cwd(), 'public/mock/events.json'), 'utf-8'),
)

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
          raceKind: 'length',
          city: 'Niš',
          country: 'RS',
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
          raceKind: 'length',
          city: 'Niš',
          country: 'RS',
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
        <li key={one.id}>
          {`${one.id} | ${one.raceName} | ${one.status} | ${String(one.corrected)}`}
          {/* The kind and the place too, since nothing else on the portal draws
              them: they are written for the parts that come after this one, and a
              value nobody reads is a value nobody can see go wrong. Written apart
              so a row can be asked about them without matching the whole line. */}
          <span data-testid={`said-${one.id}`}>{`${one.raceKind} / ${one.city} / ${one.country}`}</span>
        </li>
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
            raceKind: 'length',
            city: 'Niš',
            country: 'RS',
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
            raceKind: 'length',
            city: 'Niš',
            country: 'RS',
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

describe('a submission of one’s own that a moderator has already approved', () => {
  it('does not open on the `?ponovo=` road, whatever the address says', async () => {
    /* Two things on this screen are called „counted“ and they are not the same
       thing, which is worth saying here because the block further down carries
       the other one and reads like a contradiction of this one.
     *
       **This** is a `Submission` a moderator has approved: it stays in the queue's
       own store wearing „Odobreno“, and the road to it is `?ponovo=`. **That** is
       a `Result` in the standing, which is a different record with a different id,
       and the road to it is `?ispravka=`. A member may change the second (owner,
       27.08.2026: „ili menja i dostavlja dokaz za tu izmenu (ponovo)“); the first
       has no road at all, because in the prototype an approval produces no
       `Result` and there is nothing to take out of any standing. That gap is
       recorded in `btl-produkt/PENDING.md` and waits on the owner, since closing
       it means deciding what an approval does.
     *
       What this case guards is that the door for a submission still being decided
       does not quietly reopen one that has been. The list offers no way in, so the
       only way to try is to type the address, which is exactly why the form and
       not only the list has to say no.

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

describe('somebody else’s result that has been counted', () => {
  it('does not open on the `?ispravka=` road either, however the address is typed', async () => {
    /* The same rule the waiting one has, on the road added beside it. It is the
       one condition standing between a member and another member's standing, and
       it is worth spelling out what goes if it fails: the screen opens saying
       „Menjaš rezultat koji je već uračunat“, and Pošalji then calls
       `remove(RESULTS, …)` on somebody else's number. Their result leaves every
       ranking, every board and their own profile, and a submission goes into the
       queue under the number of whoever typed the address.
     *
       Measured by a review on 28.08.2026: with the owner taken out of the
       condition the whole suite stayed green at 2222 of 2222, and the screen
       really did open. The sibling road had had this case since 27.08.2026 and it
       was not copied across with the rest of it.
     *
       The number is read out of the file rather than written here: the ids are
       the file's business, and a member's own result would prove nothing. */
    const theirs = must(
      countedResults.find((one) => one.memberNumber !== '000001'),
      'a counted result belonging to somebody else',
    )

    renderAt(`/sr/rezultat/novi?ispravka=${theirs.id}`, 'competitor', '000001', undefined, '2026-08-23')

    await screen.findByLabelText(/^Naziv trke/)

    expect(screen.getByText(/Rezultat ulazi u rang liste tek kad/)).toBeVisible()
    expect(screen.queryByText(/Menjaš rezultat koji je već uračunat/)).toBeNull()
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
  }, SLOW)
})

describe('a result that has been counted', () => {
  /** A member with results in the file, and the one row this is about. */
  const COUNTED = '/sr/moji-rezultati'

  /** The first counted result, whichever race it happens to be: this member has
   *  run some of them in more than one season, so a name does not name a row. */
  const firstCounted = async () => {
    const table = within(await screen.findByRole('table', { name: 'Uračunato' }))

    return within(must(table.getAllByRole('row')[1], 'the first counted result'))
  }

  /** Every counted row as the words in it, in the order the table draws them.
   *  Enough to tell one row from another: the same race run twice differs by its
   *  date, and two results of one race on one day would be the same result. */
  const countedRows = async () =>
    within(await screen.findByRole('table', { name: 'Uračunato' }))
      .getAllByRole('row')
      /* Without the heading, which is a row to `getAllByRole` and not a result.
         Left in, the comparison below would drop it instead of the row pressed
         and pass whatever was deleted. */
      .slice(1)
      /* The result and not the controls beside it. What a row offers changes with
         the state of the queue: since 28.08.2026 a counted result whose correction
         is waiting loses its „Izmeni" until somebody decides. That is a change to
         what may be done, not to what is counted, and these cases are about the
         standing. */
      .map((one) =>
        within(one)
          .getAllByRole('cell')
          .slice(0, -1)
          .map((cell) => cell.textContent ?? '')
          .join(' | '),
      )

  /** What that row is a result of, read off the row rather than assumed. */
  const raceOf = (row: ReturnType<typeof within>) =>
    must(row.getAllByRole('cell')[1]?.textContent, 'the race of the row')

  it('may be taken back, which it may not have been before', async () => {
    /* Owner, 27.08.2026: „član ga ili briše (ima pravo na to, iako je
       verifikovan)". That overturned the older rule, which allowed it only while
       the result was still waiting. Verification is a check of what is true, not
       a transfer of ownership.

       Read through the store the administration deletes with, so a result taken
       back leaves every screen that reads results and not only this one. */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, null)

    const before = await countedRows()
    const row = await firstCounted()

    await user.click(row.getByRole('button', { name: /^Obriši/ }))
    await user.click(screen.getByRole('button', { name: /^Potvrdi brisanje/ }))

    /* The whole table before against the whole table after, and not the count of
       either. Measured by a review on 28.08.2026: with `remove` given another
       result's number the table was still one row shorter, so a press that
       deleted somebody's third result read as success. Row by row it cannot: the
       order is by date and nothing else (`resultsOf`), so taking out the first
       leaves exactly the rest of the list, and taking out any other leaves the
       first still standing at the front. */
    expect(await countedRows()).toEqual(before.slice(1))
  }, SLOW)

  it('leads to the form with its own numbers, and the race locked', async () => {
    /* „Ili menja i dostavlja dokaz za tu izmenu (ponovo)" (owner, same day). The
       race is locked here for the same reason it is locked on a waiting result:
       „sve osim trke". */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

    const row = await firstCounted()
    const race = raceOf(row)

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))

    expect(await screen.findByText(/Menjaš rezultat koji je već uračunat/)).toBeVisible()
    expect(screen.getByLabelText(/^Naziv trke/)).toHaveAttribute('readonly')
    expect(screen.getByLabelText(/^Naziv trke/)).toHaveValue(race)
  })

  it('gives up its category on a phone rather than its controls', async () => {
    /* The column had to come from somewhere. Measured by a review on 28.08.2026
       at 360 by 780: with the new column the table drew 504 pixels inside a box of
       328 and both controls stood entirely past the right edge, where nothing on
       the screen said they were there.
     *
       The category is what goes, and not at random: it is worked out from the
       distance and nothing else (`categoryOf`), it is named in full on the profile
       and in every ranking, and the race beside it already says which race this
       was. The controls exist on no other screen, so they are the last thing to
       go. The moderator's queue makes the same trade with five of its columns.
     *
       jsdom draws no stylesheet, so what is measured is the ask and not the
       pixels; the pixels are in `ownResultStyle.test.ts`.

       **Both the heading and the cell**, because the fact has two homes and they
       have to agree. Measured by a review on 28.08.2026 with the ask taken off the
       heading alone: at 360px the head drew five columns and the body four, so the
       body slid one column left and the points stood under „Kat.", the controls
       under „Bodovi", and the last column empty, while the whole suite of 2224
       stayed green. */
    renderAt(COUNTED, 'competitor', '000001', undefined, null)

    const table = within(await screen.findByRole('table', { name: 'Uračunato' }))
    const headings = within(must(table.getAllByRole('row')[0], 'the heading row')).getAllByRole(
      'columnheader',
    )
    const row = await firstCounted()
    const cells = row.getAllByRole('cell')

    expect(must(headings[2], 'the category heading').className).toContain('table__hide-phone')
    expect(must(cells[2], 'the category').className).toContain('table__hide-phone')
    expect(must(headings[5], 'the heading of what a member may do').className).not.toContain(
      'table__hide-phone',
    )
    expect(must(cells[5], 'what a member may do').className).not.toContain('table__hide-phone')
  })

  it('says what is missing even when the box holds only spaces', async () => {
    /* The sentence is the whole of what this road adds to the form, and it was
       skipped for anything that is not exactly empty. Measured by a review on
       28.08.2026: three spaces in Link and the member saw only „obavezno polje",
       which does not say that a link or a picture is what this particular change
       needs. Sending was refused either way, so nothing got past; what was lost
       was the explanation. */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

    const row = await firstCounted()

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji je već uračunat/)
    await user.type(screen.getByLabelText(/^Link/), '   ')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))

    expect(
      await screen.findByText(/mora da ide link ka zvaničnim rezultatima ili slika/),
    ).toBeVisible()
  })

  it('keeps its own race whatever the box is made to say', async () => {
    /* „Sve osim trke“ (owner, 27.08.2026) was written for a submission being sent
       again and the counted result was added beside it without carrying the rule
       across: the name was read off the record only when `correcting` was set, so
       on this road it came out of the box after all.
     *
       Measured by a review on 28.08.2026 with exactly this walk: the queue took
       „Sasvim druga trka“ in place of the race the member had actually run, under
       a member who never ran it. The lock is still a courtesy and is measured by
       the case above; what is measured here is what holds when something reaches
       the code past it, which is the same half the sibling road already guards. */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23', <Sent />)

    const row = await firstCounted()
    const race = raceOf(row)

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji je već uračunat/)

    fireEvent.change(screen.getByLabelText(/^Naziv trke/), { target: { value: 'Sasvim druga trka' } })

    await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))
    await screen.findByText('Rezultat je ponovo poslat na proveru.')

    const stored = within(screen.getByRole('list', { name: 'store' })).getAllByRole('listitem')

    expect(stored).toHaveLength(1)
    expect(stored[0]?.textContent).toContain(race)
    expect(stored[0]?.textContent).not.toContain('Sasvim druga trka')
  })

  it('is refused without new proof, and taken with it', async () => {
    /* The one rule this road has that the others do not. Both halves, because a
       refusal that never lifts is a screen nobody can get past. */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

    const row = await firstCounted()

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji je već uračunat/)
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))

    expect(
      await screen.findByText(/mora da ide link ka zvaničnim rezultatima ili slika/),
    ).toBeVisible()

    await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))

    expect(await screen.findByText('Rezultat je ponovo poslat na proveru.')).toBeVisible()
  })

  it('leaves the standing exactly as it was while the correction waits', async () => {
    /* Owner, 28.08.2026, choosing between four outcomes: the old result stays
       where it is while the correction waits, and changes when a moderator agrees
       with it.

       Until then this screen took the result out of the standing the moment the
       correction was sent, so a refusal lost the points for good: measured that
       day, a profile fell from 180 races and 1.752,86 points to 179 and 1.744,60
       with no way back, because an approved submission produced no result. That
       contradicted the portal's own rule that the standing is brought up to date
       **after** verification (owner, 27.08.2026).

       The cost the owner accepted is the other half of this case and is measured
       nowhere else: while the correction waits, the standing holds the numbers the
       member has themselves said are wrong. */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

    const before = await countedRows()
    const row = await firstCounted()

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji je već uračunat/)
    await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))
    await screen.findByText('Rezultat je ponovo poslat na proveru.')

    /* Walked back rather than rendered again: the prototype keeps this visit's
       changes in the session, and a second render is a second visit that never
       saw them. */
    await user.click(screen.getByRole('link', { name: 'Moji rezultati' }))

    expect(await countedRows(), 'the standing moved before anybody decided').toEqual(before)
  }, SLOW)

  /** A press that settles the newest submission, standing on the member's own
   *  screen: the session is one, so a moderator's decision reaches this visit
   *  without leaving the page it has to be measured on. */
  function Decide({ as }: { as: 'approved' | 'rejected' }) {
    const { submissions, decide } = useSession()

    return (
      <button
        type="button"
        onClick={() => {
          const newest = submissions[0]

          if (newest !== undefined) {
            decide(newest.id, as, '')
          }
        }}
      >
        {as === 'approved' ? 'odobri' : 'odbij'}
      </button>
    )
  }

  /** The walk a member takes: open the newest counted result, correct it, send it. */
  async function corrected(user: ReturnType<typeof setupUser>) {
    const row = await firstCounted()

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji je već uračunat/)

    const hours = screen.getByLabelText(/^Sati/)

    await user.clear(hours)
    await user.type(hours, '9')
    await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))
    await screen.findByText('Rezultat je ponovo poslat na proveru.')
    await user.click(screen.getByRole('link', { name: 'Moji rezultati' }))
  }

  it('changes when somebody agrees with it, which is what „after verification" means', async () => {
    /* The other half of the owner's choice, and the half the prototype did not
       have at all: until 28.08.2026 an approved submission produced no result, so
       agreeing with a correction changed nothing anywhere. „Odmah se ažurira
       poredak nakon verifikacije" (owner, 27.08.2026) is the sentence, and this is
       where „nakon" happens.

       One row and not one more: the corrected record keeps the identity of the one
       it replaces, so the standing holds one result for one race. */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23', <Decide as="approved" />)

    const before = await countedRows()

    await corrected(user)
    await user.click(screen.getByRole('button', { name: 'odobri' }))

    const after = await countedRows()

    expect(after, 'the standing grew or shrank instead of changing').toHaveLength(before.length)
    expect(after[0], 'the corrected row did not change').not.toEqual(before[0])
    expect(after.slice(1), 'a row nobody touched changed').toEqual(before.slice(1))
  }, SLOW)

  it('carries the numbers of the last correction, not of the first', async () => {
    /* A critical fault, measured by a review on 28.08.2026. A correction of a
       counted result may itself be corrected before anybody decides it, and that
       second correction goes down the `resubmit` road, which keeps the
       submission's earlier fields. So the record waiting to be counted stayed the
       first version: the moderator read the second set of numbers, pressed Odobri,
       and the first set went into the standing.

       That is exactly the fault `resubmit` exists to prevent, in its own words: „a
       moderator who has already read it would otherwise decide numbers they never
       saw."

       The walk is the one a member really takes: correct a counted result, then
       press Izmeni on the submission that is still waiting and correct it again. */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23', <Decide as="approved" />)

    const before = await countedRows()

    await corrected(user)

    /* And again, from the list of what is waiting, which is where the way on is:
       the counted row itself no longer offers one while its correction stands. */
    const sent = within(must(document.querySelector('.submissions'), 'the list of what was sent'))

    await user.click(sent.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji još čeka proveru/)

    const hours = screen.getByLabelText(/^Sati/)

    await user.clear(hours)
    await user.type(hours, '7')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))
    await screen.findByText('Rezultat je ponovo poslat na proveru.')
    await user.click(screen.getByRole('link', { name: 'Moji rezultati' }))
    await user.click(screen.getByRole('button', { name: 'odobri' }))

    const after = await countedRows()

    expect(after, 'the standing grew or shrank instead of changing').toHaveLength(before.length)
    /* Seven hours, which is what the moderator read, and not nine, which is what
       the first correction said. */
    expect(after[0]).toContain('7:')
    expect(after[0]).not.toContain('9:')
  }, SLOW)

  it('offers no second correction, because two rows for one race is the fault', async () => {
    /* Since 28.08.2026 the result stays in the standing while a correction waits
       (owner), so the row goes on looking exactly as it did and the „Izmeni" link
       stayed live. Measured by a review the same day: one counted result then took
       as many corrections as somebody cared to send, the queue grew a row for
       each, and one press of „Odobri sve" walked them newest first, so what ended
       up counted was the oldest of them.

       That is the fault the portal already refuses for a waiting result: „two rows
       for one race, and the moderator reading the same morning twice" (owner,
       06.08.2026).

       The way on is not lost, which is the other half: the correction is in the
       list above and carries its own „Izmeni". */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

    const row = await firstCounted()
    const race = raceOf(row)

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji je već uračunat/)
    await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))
    await screen.findByText('Rezultat je ponovo poslat na proveru.')
    await user.click(screen.getByRole('link', { name: 'Moji rezultati' }))

    const again = await firstCounted()

    expect(again.queryByRole('link', { name: /^Izmeni rezultat/ })).toBeNull()
    /* And the way on is still there, one section up. */
    const sent = within(must(document.querySelector('.submissions'), 'the list of what was sent'))

    expect(sent.getByRole('link', { name: `Izmeni rezultat: ${race}` })).toBeVisible()
  }, SLOW)

  it('refuses the road even when the address is typed', async () => {
    /* The list offers no way in once a correction is waiting, so the only way to
       try is to type the address, which is exactly why the form and not only the
       list has to say no: a second correction of one result puts two rows for one
       race in front of a moderator, and „Odobri sve" walks them newest first, so
       what ends up counted is the oldest.

       The waiting correction is written straight into the store, because that is
       the state being guarded and the road to it through the screen is the one
       being closed. */
    const mine = must(
      countedResults.find((one) => one.memberNumber === '000001'),
      'a counted result of this member',
    )

    function Correcting() {
      const session = useSession()
      const done = useRef(false)

      useEffect(() => {
        if (!done.current) {
          done.current = true
          session.submit({
            memberNumber: '000001',
            raceName: mine.raceName,
            raceKind: 'length',
            city: 'Niš',
            country: 'RS',
            date: '2026-05-10',
            distanceKm: 21.1,
            ascentM: 0,
            descentM: 0,
            photo: '',
            seconds: 6730,
            points: 12.34,
            category: 'half',
            link: 'https://primer.rs/rezultati',
            comment: '',
            corrects: { ...mine, seconds: 6730 },
          })
        }
      }, [session])

      return null
    }

    renderAt(
      `/sr/rezultat/novi?ispravka=${mine.id}`,
      'competitor',
      '000001',
      undefined,
      '2026-08-23',
      <Correcting />,
    )

    await screen.findByLabelText(/^Naziv trke/)

    expect(screen.queryByText(/Menjaš rezultat koji je već uračunat/)).toBeNull()
    expect(screen.getByText(/Rezultat ulazi u rang liste tek kad/)).toBeVisible()
  }, SLOW)

  it('is left exactly where it was when the correction is turned down', async () => {
    /* The whole point of the outcome the owner chose: a member whose correction is
       refused keeps the points they had. Until 28.08.2026 they lost them for good.
     */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23', <Decide as="rejected" />)

    const before = await countedRows()

    await corrected(user)
    await user.click(screen.getByRole('button', { name: 'odbij' }))

    expect(await countedRows(), 'a refusal moved the standing').toEqual(before)
  }, SLOW)

  it('says which kind of race it was and where, read off the race and its event', async () => {
    /* The member is asked neither on this road: the kind is not theirs to change
       (owner, 30.08.2026) and the race behind the result answers for the place.
       So the submission has to carry what the race and its event say, and nothing
       on any screen draws either value, which is why it is asked of the store.

       Measured because it was not held at all: with „free / Nigde / ZZ" written
       here in place of the three, the whole portal stayed green (review,
       30.08.2026). */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23', <Sent />)

    const row = await firstCounted()
    const named = raceOf(row)
    const race = must(allRaces.find((one) => one.name === named), `the race ${named}`)
    const event = must(allEvents.find((one) => one.id === race.eventId), 'its event')

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji je već uračunat/)
    await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))
    await screen.findByText('Rezultat je ponovo poslat na proveru.')

    const [written] = within(screen.getByRole('list', { name: 'store' })).getAllByRole('listitem')
    const said = within(must(written, 'the correction')).getByTestId(/^said-/)

    expect(said.textContent).toBe(`${race.kind} / ${event.city} / ${event.country}`)
  }, SLOW)

  it('is not asked either question on the way back in through the list of what was sent', async () => {
    /* The short form is the short form on both roads to it. A correction of a
       counted result is not asked its kind or its place, but the submission it
       makes is a submission like any other: the member can reopen it from the
       list of what they have sent, and that road drew the full form with both
       boxes open and unlocked. One click and the kind the member was never asked
       for was theirs to set, on a correction of a result already counted
       (measured in review, 30.08.2026). */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

    const row = await firstCounted()

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji je već uračunat/)
    await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))
    await screen.findByText('Rezultat je ponovo poslat na proveru.')

    await user.click(screen.getByRole('link', { name: 'Moji rezultati' }))

    /* From the list of what was sent, which is where a waiting correction lives:
       the counted table stops offering the way in while one waits. */
    const sentList = within(must(document.querySelector('.submissions'), 'the list of what was sent'))

    await user.click(await sentList.findByRole('link', { name: /^Izmeni rezultat: / }))

    expect(await screen.findByText(/Menjaš rezultat koji/)).toBeVisible()
    expect(screen.queryByLabelText(/^Vrsta trke/)).toBeNull()
    expect(screen.queryByLabelText('Mesto')).toBeNull()
  }, SLOW)

  it('is still sent when the race under it is gone from the calendar', async () => {
    /* A counted result reads its kind and its place off the race it belongs to
       and that race's event, because the form for correcting one does not ask
       either (owner, 30.08.2026). A race can leave the calendar under a counted
       result, which the administration measures and warns about elsewhere
       (`adminEventKind.test.tsx`), and then there is nothing to read: what the
       member typed is all there is, and the correction still has to go.

       The calendar is emptied rather than a race deleted, since what is being
       measured is the lookup coming back with nothing, and an empty answer is the
       shortest way to that. */
    const served = globalThis.fetch
    const user = setupUser()

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('races') ? new Response('[]', { status: 200 }) : served(input, init),
    )

    try {
      renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23', <Sent />)

      const row = await firstCounted()

      await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
      await screen.findByText(/Menjaš rezultat koji je već uračunat/)
      await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
      await user.click(screen.getByRole('button', { name: /^Pošalji/ }))

      expect(await screen.findByText('Rezultat je ponovo poslat na proveru.')).toBeVisible()

      /* And what it wrote, which is the half this case exists for. Empty, and
         never the word „undefined": the form for correcting a counted result has
         no box for either, so reading one out of its values gives nothing at all
         and `String(nothing)` writes that word into the record and back into the
         next form somebody opens (measured in review, 30.08.2026). */
      const [written] = within(screen.getByRole('list', { name: 'store' })).getAllByRole('listitem')
      const said = within(must(written, 'the correction')).getByTestId(/^said-/)

      /* Three empty answers, and above all not the word „undefined": the form
         for correcting a counted result has no box for either, so reading one
         out of its values gives nothing at all, and `String(nothing)` writes that
         word into the record and back into the next form somebody opens
         (measured in review, 30.08.2026). */
      expect(said.textContent).toBe(' /  / ')
    } finally {
      vi.unstubAllGlobals()
    }
  }, SLOW)
})

