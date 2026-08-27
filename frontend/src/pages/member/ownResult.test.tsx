import { screen, within } from '@testing-library/react'
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

  it('puts it behind everything else, rather than where it stood', async () => {
    /* Owner: „Vraća se na kraj reda kao nov." A moderator who has already opened
       this item read the numbers it had then; left in place with different
       numbers, the next press decides something they never saw.

       Three results, the first of them corrected, so the question is about order
       and not about a list of one. */
    function CorrectFirst() {
      const session = useSession()
      const done = useRef(false)

      useEffect(() => {
        if (!done.current && session.submissions.length === 3) {
          done.current = true
          session.resubmit('sub-3', {
            raceName: 'Treća trka',
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
       stands as Treća, Druga, Prva. Corrected is **Treća**, the one at the top,
       precisely because correcting the one already at the bottom would leave the
       order unchanged and this case would pass whether the move happened or not.
       Measured: with the move taken out, the first version of this test stayed
       green. */
    expect(names, 'the corrected result kept its place').toEqual([
      'Druga trka',
      'Prva trka',
      'Treća trka',
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

    expect(screen.queryByDisplayValue('Tuđa trka')).toBeNull()
  })
})
