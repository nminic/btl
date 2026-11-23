import { screen, waitFor, within } from '@testing-library/react'
import { at, must } from '../test/at'
import { SLOW } from '../test/slow'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'
import { fakeQueue } from '../test/fakeQueue'

/* THE SERVER'S TEAMS ARE IN FRONT OF EVERY CASE HERE since 23.11.2026, because the screens of teams
 * speak to routes (`POST /api/teams/direct`, `PUT` and `DELETE /api/teams/{id}`) and read the lists
 * again after a write instead of keeping the row in the session. `fakeQueue()` remembers what was
 * written and serves the two lists it changes. */
let theServerOfTeams: { stop: () => void } | null = null

beforeEach(() => {
  theServerOfTeams = fakeQueue()
})

afterEach(() => {
  theServerOfTeams?.stop()
  theServerOfTeams = null
})

/**
 * THE CELL IS MEASURED THROUGH THE SCREEN OF TEAMS SINCE B107, AND THIS IS THE SECOND TIME
 * IT HAS MOVED.
 *
 * <p>It was the events screen until 11.08.2026 and the members screen until 26.09.2026. Both
 * times the reason was the same shape: the screen stopped having a cell, and the cases had to
 * follow it rather than be deleted with it. The members screen lost its town cell because
 * there is no `PUT /api/competitors/{memberNumber}` for it to write to (see the note on
 * `admin/AdminMembers.tsx`), so the cell was writing a correction nobody could keep.
 *
 * <p><b>`admin/AdminTeams.tsx:338` is where it lives now</b>, and it is the same field under
 * the same label - `city`, „Mesto" - so nothing about these three cases changes except the
 * address they open. The first move taught this file what happens otherwise, and that note
 * is still below on the Enter case: a screen losing a caller quietly loses a guard, and
 * Enter went untested for a month and a half that way.
 */
describe('changing data in administration', () => {
  it('changes a value in the row it sits in, and keeps it', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Timovi' })
    const row = at(within(table).getAllByRole('row'), 1)
    // Named, because the row also carries the control that opens the whole
    // record on a form.
    const city = within(row).getByRole('button', { name: /^Mesto:/ })
    const before = must(city.textContent, 'the place on the row')

    await user.click(city)
    const box = within(row).getByRole('textbox')
    await user.clear(box)
    await user.type(box, 'Vršac')
    await user.tab()

    /* AWAITED: the town is written to the server (`PUT /api/teams/{id}`) and the row draws what the list
       holds when it is read again, so the cell shows the new town on the answer and not on the press. */
    await waitFor(() => {
      expect(within(row).getByRole('button', { name: /^Mesto:/ })).toHaveTextContent('Vršac')
    })
    expect(within(row).getByRole('button', { name: /^Mesto:/ })).not.toHaveTextContent(before)
  })

  it('takes Enter as done, without reaching for the mouse', async () => {
    /* The cell used to be tested through the events screen, whose town stopped
       being a cell on 11.08.2026 (it carries a country now, and a cell writes
       one field). Enter went untested with it, which is how a screen losing a
       caller quietly loses a guard. */
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Timovi' })
    const row = at(within(table).getAllByRole('row'), 1)

    await user.click(within(row).getByRole('button', { name: /^Mesto:/ }))
    const box = within(row).getByRole('textbox')
    await user.clear(box)
    await user.type(box, 'Kikinda{Enter}')

    await waitFor(() => {
      expect(within(row).getByRole('button', { name: /^Mesto:/ })).toHaveTextContent('Kikinda')
    })
  })

  it('lets an edit be abandoned', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Timovi' })
    const row = at(within(table).getAllByRole('row'), 1)
    const before = must(
      within(row).getByRole('button', { name: /^Mesto:/ }).textContent,
      'the place on the row',
    )

    await user.click(within(row).getByRole('button', { name: /^Mesto:/ }))
    await user.type(within(row).getByRole('textbox'), 'nešto')
    await user.keyboard('{Escape}')

    expect(within(row).getByRole('button', { name: /^Mesto:/ })).toHaveTextContent(before)
  })

  it('changes the place of an event on its form and nowhere else', async () => {
    /* The town was a cell until 11.08.2026, and stopped being one when it began
       carrying the country it is in (forms/types.ts). A cell writes one field
       of one record, so a town corrected in the row left the event in the
       country of the town it used to be in, and no screen shows a country.
       The name beside it went the same way and for the same shape of reason,
       its address. */
    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Događaji' })
    const row = at(within(table).getAllByRole('row'), 1)

    expect(within(row).queryByRole('button', { name: /^Mesto:/ })).toBeNull()
    expect(within(row).queryByRole('textbox')).toBeNull()
  })

  it('changes the name of an event on its form and nowhere else', async () => {
    /* Not in a cell, which is the whole of it. A cell writes one field of one
       record, and the address an event answers at is made out of its name and
       its day (entityForms.ts): renamed in the row, an event went on answering
       at the address of the name it used to have, and nothing said so. That the
       form writes the address again on every save is proved where it can be
       seen, on the category of a race (entityForms.test.tsx). */
    const user = setupUser()
    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Događaji' })
    const row = at(within(table).getAllByRole('row'), 1)

    expect(within(row).queryByRole('button', { name: /^Događaj:/ })).toBeNull()

    await user.click(within(row).getByRole('button', { name: /^Otvori:/ }))

    const name = await screen.findByLabelText(/^Naziv događaja/)
    await user.clear(name)
    await user.type(name, 'Novi naziv trke')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const listed = within(await screen.findByRole('table', { name: 'Događaji' }))

    expect(listed.getByText('Novi naziv trke')).toBeVisible()
  })
})

describe('the text of a competition', () => {
  /* **Read on the list of competitions** (owner, 07.09.2026): „Propozicije i Nagrade treba da se
     izlistavaju na ovoj strani, a ne kad se uđe u ligu". **And changed nowhere on it since
     21.11.2026** (PDL „Glava lista lige: na desktopu sve u jednom redu”): „male veze „Izmeni” kod
     Propozicija i Nagrada nestaju”, and the pencil in the head of the sheet leads to the form in the
     administration instead (`pages/league/leagueShowcase.test.tsx` holds where it leads). Until that
     day this block measured a box that was written in place, and each of its cases went with it.

     Every case below names the sheet of one competition and asks inside it. */
  const boxOf = async (name: RegExp) =>
    within(
      must(
        (await screen.findByRole('heading', { level: 2, name })).closest('article'),
        'the box of the competition',
      ),
    )

  it('is not shown while nobody has written it, and cannot be written here, by whoever runs it either', async () => {
    renderAt('/sr/lige?sezona=2027&liga=planinska-2027', 'superadmin')

    const box = await boxOf(/Planinska liga/)

    expect(box.queryByRole('heading', { name: 'Propozicije' })).not.toBeInTheDocument()
    expect(box.queryByRole('heading', { name: 'Nagrade' })).not.toBeInTheDocument()
    expect(box.queryByRole('button', { name: 'Izmeni' })).not.toBeInTheDocument()
    expect(box.queryByRole('textbox')).not.toBeInTheDocument()
  }, SLOW)

  it('is shown once it has been written, to a visitor and to whoever runs it alike, and offers no box to write in', async () => {
    for (const role of ['visitor', 'superadmin'] as const) {
      const { unmount } = renderAt('/sr/lige?sezona=2027', role)

      const box = await boxOf(/RunTrace liga/)

      expect(box.getByRole('heading', { name: 'Propozicije' })).toBeVisible()
      expect(box.getByRole('heading', { name: 'Nagrade' })).toBeVisible()
      expect(box.queryByRole('button', { name: 'Izmeni' }), role).not.toBeInTheDocument()
      expect(box.queryByRole('textbox'), role).not.toBeInTheDocument()
      unmount()
    }
  }, SLOW)
})

/* „CANCELS SENDING A RESULT BACK" STOOD HERE UNTIL R1 OF THE RESULTS FLOWS. It entered a result
   through the form and found it on the moderator's queue, both inside this browser's session, then
   opened the box that refuses it and gave the box up. The queue reads the server since R1 and the
   form's copy never reaches it, so the walk found no row and ran out its five seconds (CI, PR 502).
   What it measured, the box given up and nothing sent, is held in
   `pages/admin/resultsQueue.test.tsx`, „closes when the moderator gives it up, and sends nothing".
   And „leaves an already written competition text alone unless it is changed" stood under it until
   21.11.2026, when the box it pressed left the list of competitions (`pages/league/LeagueText.tsx`). */
