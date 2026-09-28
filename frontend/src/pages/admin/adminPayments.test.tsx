import { screen, waitFor, within } from '@testing-library/react'
import { clearResourceCache } from '../../data/client'
import type { MembershipDue, Outstanding } from '../../data/types'
import { moderatorWith, renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { QUEUE } from './queues'

/**
 * THE SCREEN OF PAYMENTS READS A DERIVED LIST OFF THE SERVER (B125).
 *
 * <p><b>What it did before, which is the fault these cases hold shut.</b> It drew three rows
 * out of `verification.json`, a queue nothing in the backend has ever written - five places
 * write that table and not one writes `'payments'` - so the tab has always been empty in
 * reality while looking full in development.
 *
 * <p><b>WHAT IS DELIBERATELY NOT MEASURED HERE, because it is not written yet.</b> Nothing
 * activates a membership from this screen. The owner is settling how that works, per row, with
 * a box carrying a currency and the competitor's balance beside it, and a button would be a
 * guess at a shape he is in the middle of deciding. So there is no case about a write, and no
 * case is missing: there is no control to press.
 *
 * <p><b>NOTHING IN THE FIXTURE IS THE ONLY ONE OF ITS KIND, AND THE AXES ARE COUNTED</b>, the
 * way `adminMemberWrites.test.tsx` and `AdminModerators.test.tsx` count their own:
 *
 * <ul>
 * <li><b>Two hold a member number and two hold none</b>, which since V16 is the ordinary state
 * of somebody who has registered and never paid. So neither „has a number" nor „has none" can
 * stand in for anything.
 * <li><b>Two share a surname and two share a town</b>, so neither is an identity.
 * <li><b>„Marko" is one man's given name and another's surname</b>, which is the search case a
 * rule written over the two columns separately answers differently from one written over the
 * pair.
 * <li><b>The season served is 2031</b>, which no clock in this portal would produce for any day
 * it could be run on. A screen working the year out for itself - and `data/season.ts` has two
 * functions that would, each giving a different answer - cannot pass the case that reads it.
 * <li><b>Four rows</b>, so „the list is empty" can never stand in for anything narrower.
 * <li><b>Served neither alphabetically by given name nor by number</b>, so a screen that sorted
 * its own copy would pass a fixture already in order and fail the next one.
 * </ul>
 */
describe('the payments screen', () => {
  const ADDRESS = `/sr/${QUEUE.payments.path}`

  const ACCOUNTS: MembershipDue[] = [
    {
      competitorId: 41,
      memberNumber: '',
      firstName: 'Ana',
      lastName: 'Ilić',
      city: 'Novi Sad',
      currency: 'RSD',
      expected: 4800,
      balance: 0,
    },
    {
      competitorId: 23,
      memberNumber: '000031',
      firstName: 'Jovana',
      lastName: 'Ilić',
      city: 'Beograd',
      currency: 'RSD',
      expected: 4800,
      balance: 6000,
    },
    {
      competitorId: 58,
      memberNumber: '',
      firstName: 'Petar',
      lastName: 'Marko',
      city: 'Niš',
      currency: 'EUR',
      expected: 43.5,
      balance: 12.75,
    },
    {
      competitorId: 17,
      memberNumber: '000009',
      firstName: 'Marko',
      lastName: 'Marković',
      city: 'Niš',
      currency: 'RSD',
      expected: 4800,
      balance: 1500,
    },
  ]

  const OUTSTANDING: Outstanding = { season: 2031, accounts: ACCOUNTS }

  /**
   * The four served above, or whatever a case asks to be served instead.
   *
   * <p><b>Its own server rather than the shared one in `test/setup.ts`.</b> That file answers a
   * resource off the disc, which is right for a case that only needs the screen drawn, but a
   * case that has to know WHAT WAS ASKED FOR - the season it must not compute, the read it must
   * not repeat - has to record the requests, and that is what this does.
   */
  function serving(answer: Outstanding = OUTSTANDING) {
    clearResourceCache()

    return serverThat((path, init) => {
      if (path === '/api/payments' && (init?.method ?? 'GET') === 'GET') {
        return new Response(JSON.stringify(answer), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      return null
    })
  }

  /** How many times the list was read, and by what verb: a screen that only reads must only
   *  ever be seen reading. */
  function asksOf(asked: Asked[]): string[] {
    return asked.filter((one) => one.path === '/api/payments').map((one) => one.init?.method ?? 'GET')
  }

  it('draws the served rows in the order the server sent them', async () => {
    const server = serving()
    renderAt(ADDRESS, 'superadmin')

    const rows = await screen.findAllByRole('row')
    const names = rows.slice(1).map((one) => within(one).getAllByRole('cell')[0]?.textContent ?? '')

    expect(names).toEqual(['Ana Ilić', 'Jovana Ilić000031', 'Petar Marko', 'Marko Marković000009'])

    server.stop()
  })

  it('draws nothing the route does not serve', async () => {
    /* THE SCREEN THIS REPLACES DREW TWO FIELDS THE ANSWER HAS NOT GOT: the address a
       registration was known by, and the country under the town. The route answers five fields
       and neither is among them, so drawing either would mean reading a queue item again.
       Asked of the whole screen rather than of one cell, because the fault it guards against is
       a field reappearing anywhere on it. */
    const server = serving()
    renderAt(ADDRESS, 'superadmin')

    await screen.findByText('Marko Marković')

    expect(screen.queryByText(/@/)).toBeNull()
    expect(screen.queryByText('Srbija')).toBeNull()
    expect(screen.queryByText(/^RS$/)).toBeNull()

    /* AND THE TOWN IS THERE, which is the other half and is what keeps the line above from
       passing by drawing nothing at all. It tells two people of one name apart, which two of
       these four are. */
    const row = (await screen.findAllByRole('row')).slice(1)

    expect(row.map((one) => within(one).getAllByRole('cell')[1]?.textContent)).toEqual([
      'Novi Sad',
      'Beograd',
      'Niš',
      'Niš',
    ])

    server.stop()
  })

  it('names the season off the answer and never off a clock of its own', async () => {
    /* 2031 is a year no function in `data/season.ts` would produce for any day this can run
       on: `seasonRunning` answers the year being raced and `transfersTakeEffect` the next one,
       and there is no `seasonBeingPaidFor` on this side at all. So this case cannot be passed
       by working the year out, only by reading the one the route sent. */
    const server = serving()
    renderAt(ADDRESS, 'superadmin')

    expect(await screen.findByText(/2031/)).toBeVisible()

    server.stop()
  })

  it('never writes to the list itself, whatever is pressed on it', async () => {
    /* THE LIST IS DERIVED AND IS NEVER WRITTEN TO, which outlived the arrival of activation and
       is the reason this case was kept rather than deleted with its old name. A row leaves by a
       MEMBERSHIP being written - `POST /api/memberships` - and never by anything being recorded
       against `/api/payments`, which has no queue behind it: five places in the backend write
       `verification` and not one writes the word `payments`.

       WHAT CHANGED ON 28.09.2026 is that the screen now presses something. Every button on it is
       pressed here and the verbs that reached `/api/payments` are counted: one GET and nothing
       else. `paymentsActivation.test.tsx` measures what activation DOES send, and this measures
       what it must never send. */
    const server = serving()
    const user = setupUser()
    renderAt(ADDRESS, 'superadmin')

    await screen.findByText('Marko Marković')

    for (const one of screen.queryAllByRole('button')) {
      await user.click(one)
    }

    expect(asksOf(server.asked)).toEqual(['GET'])

    server.stop()
  })

  it('activates one man at a time and never all at once, and hands nothing back', async () => {
    /* THE ABSENCE OF THE SWEEP IS ITS OWN DECISION AND OUTLIVED THE SPECIFICATION. On the old
       queue a row meant „somebody says the money arrived"; on a derived list it means the
       OPPOSITE, so one press would activate every debtor at once and spend a member number on
       each - and the sequence only counts up, so a number spent in error is spent for good.

       And „Odbij" is gone with it: it existed to hand back something somebody had sent in, and
       nobody sends anything in here, so a reason written against one of these rows would reach a
       member as „your submission was handed back" about a submission he never made.

       THE SINGLE BUTTON IS NOW THERE, which is what changed on 28.09.2026, and it is counted
       rather than merely found: FOUR buttons named „Aktiviraj" for four rows. Asserted as a
       count because „there is a button called Aktiviraj" would pass a screen that drew one for
       the whole table, which is the very thing the paragraph above forbids. */
    const server = serving()
    renderAt(ADDRESS, 'superadmin')

    await screen.findByText('Marko Marković')

    const pressable = screen.getAllByRole('button').map((one) => one.textContent ?? '')

    expect(pressable.filter((one) => /sve/i.test(one))).toEqual([])
    expect(pressable.filter((one) => /odbij/i.test(one))).toEqual([])
    expect(pressable.filter((one) => one === 'Aktiviraj')).toHaveLength(ACCOUNTS.length)

    server.stop()
  })

  it('finds one man by number, by name and by both, and narrows nothing for an empty box', async () => {
    const server = serving()
    const user = setupUser()
    renderAt(ADDRESS, 'superadmin')

    await screen.findByText('Marko Marković')

    const box = screen.getByLabelText('Pretraga po članskom broju, imenu ili prezimenu')

    await user.type(box, '0009')
    expect(await screen.findAllByRole('row')).toHaveLength(2)

    await user.clear(box)
    await user.type(box, 'Marko Marković')
    expect(await screen.findAllByRole('row')).toHaveLength(2)

    /* „Marko" is Marković's given name and Petar's surname, so both are real answers. */
    await user.clear(box)
    await user.type(box, 'Marko')
    expect(await screen.findAllByRole('row')).toHaveLength(3)

    await user.clear(box)
    expect(await screen.findAllByRole('row')).toHaveLength(5)

    server.stop()
  })

  it('narrows without asking the server again', async () => {
    /* The search is the screen's own work and the route's `search` parameter is never sent -
       the cache is keyed by name with no parameter in it, so a narrowed answer stored under
       `payments` would be handed back to the next reader who asked for the whole list. Held as
       a case because it is the one thing about the search that could change silently. */
    const server = serving()
    const user = setupUser()
    renderAt(ADDRESS, 'superadmin')

    await screen.findByText('Marko Marković')
    await user.type(screen.getByLabelText('Pretraga po članskom broju, imenu ili prezimenu'), 'Marko')
    await screen.findByText('Petar Marko')

    expect(asksOf(server.asked)).toEqual(['GET'])

    server.stop()
  })

  it('tells an empty list apart from a search that matches nobody', async () => {
    /* TWO STATES AND TWO SENTENCES, which is the one thing about this screen that is about the
       first morning of October. An empty list is the ordinary state of a working portal -
       owner: „NIKO SE NE DOVODI U PORTAL DOK SE SAM NE PRIJAVI" - and a search that matches
       nobody is a moderator who mistyped a name off a bank statement. Told with one sentence,
       he reads „everybody is a member" and stops looking for the man whose money is sitting in
       the account. */
    const server = serving()
    const user = setupUser()
    renderAt(ADDRESS, 'superadmin')

    await screen.findByText('Marko Marković')
    await user.type(
      screen.getByLabelText('Pretraga po članskom broju, imenu ili prezimenu'),
      'Nikola',
    )

    expect(await screen.findByText('Nijedan nalog ne odgovara ovoj pretrazi.')).toBeVisible()
    expect(screen.queryByText('Svi nalozi imaju članstvo za ovu sezonu.')).toBeNull()

    server.stop()
  })

  it('says so plainly when nobody owes anything, which is the first day of the season', async () => {
    /* AND IT IS NOT AN ERROR. The route refuses nothing for an empty answer, so the screen may
       not draw an alarm over one either: on 1 October this is what a working portal looks
       like. */
    const server = serving({ season: 2031, accounts: [] })
    renderAt(ADDRESS, 'superadmin')

    expect(await screen.findByText('Svi nalozi imaju članstvo za ovu sezonu.')).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()

    server.stop()
  })

  it('says the season even when nobody owes anything', async () => {
    /* The heading is about the question and not about the rows, so it does not go away with
       them. Measured because the obvious way to write the empty state is to put the heading
       inside the branch that draws the table. */
    const server = serving({ season: 2031, accounts: [] })
    renderAt(ADDRESS, 'superadmin')

    expect(await screen.findByText(/2031/)).toBeVisible()

    server.stop()
  })

  it('draws nothing of the list for a moderator without the tick', async () => {
    /* THE DOOR AND THE ROUTE BOTH ANSWER, AND THEY READ DIFFERENT THINGS. This is the door:
       `needs.ts` reads the right off the SESSION, so a moderator holding another queue's tick
       never gets the screen. The route reads it off the SERVER and answers 404 (ADL A8), and
       that number reaches a screen as „some other answer, and here is its number" - measured in
       `askTheServer`, which reads a named refusal out of 400 and 409 only. So 401 and 404 are
       indistinguishable to this side, which is written down rather than guarded against: the
       screen cannot tell the reader what to do about either.

       WHAT THIS DELIBERATELY DOES NOT ASSERT, and it is measured rather than assumed: that
       `/api/payments` is never asked for at all. It is, once, by the counter in the
       administration's own navigation, which reads the derived length for the column beside the
       work (`queues.ts`, `notMembersYet`). For this moderator that read is answered 404 by the
       route and the number is thrown away unread, because both the column and the counter above count
       only the queues he may work in. So the request is a cost and not a leak - he is told
       nothing by it - and making a read conditional on a right is a widening of the data layer
       that no decision asks for. */
    const server = serving()
    renderAt(ADDRESS, 'moderator', null, moderatorWith(['queue:results']))

    await waitFor(() => {
      expect(screen.queryByRole('table', { name: QUEUE.payments.labelKey })).toBeNull()
    })

    expect(screen.queryByText('Marko Marković')).toBeNull()
    expect(screen.queryByText('Petar Marko')).toBeNull()
    expect(
      screen.queryByLabelText('Pretraga po članskom broju, imenu ili prezimenu'),
    ).toBeNull()

    server.stop()
  })
})
