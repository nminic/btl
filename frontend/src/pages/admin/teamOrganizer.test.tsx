import { screen, waitFor, within } from '@testing-library/react'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { did, serverThat } from '../../test/serverAnswers'

/* Who a team names as its organiser, on the screen where that is changed.
 *
 * **Why this file exists.** The list of people the form offers moved from the file to
 * what the session holds, so that the row and the form could not say two different things
 * about one team. Moved alone it made them say three: a `<select>` whose value names no
 * option leaves the first one showing, so a team whose organiser had just been deleted
 * drew somebody who had never run it, while the record went on holding the old number and
 * saving it back. The middle of those three was the only one nobody could see was wrong
 * (review, 05.09.2026).
 *
 * Dunavski trkači is named by 000001, who is deleted here to make that state.
 */

/** The chooser of the organiser, once a team's form is open. */
const chooser = async () => must(await screen.findByLabelText(/Organizator tima/), 'the chooser')

async function openDunav(user: ReturnType<typeof setupUser>) {
  const listed = within(await screen.findByRole('table', { name: 'Timovi' }))
  const row = must(
    listed.getAllByRole('row').find((one) => /Dunavski trkači/.test(one.textContent ?? '')),
    'the row of the team being opened',
  )

  await user.click(within(row).getByRole('button', { name: /^Otvori/ }))
}

describe('the organiser a team form offers', () => {
  it('holds whoever the record names, even after that member is deleted', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/administracija/clanovi', 'superadmin')

    const members = within(await screen.findByRole('table', { name: 'Članovi' }))
    const row = must(
      members.getAllByRole('row').find((one) => /Vladan Đurišić/.test(one.textContent ?? '')),
      'the row of the member who runs Dunav',
    )

    await user.click(within(row).getByRole('button', { name: /^Obriši: Vladan Đurišić/ }))
    await user.click(screen.getByRole('button', { name: /^Potvrdi brisanje: Vladan Đurišić/ }))

    await router.navigate('/sr/administracija/timovi')
    await openDunav(user)

    /* The record still names 000001, so the chooser shows 000001. Anything else is the
       form promising a change nobody asked for: written with the list alone, it showed
       the first member on it and saved the old one. */
    expect(await chooser()).toHaveValue('000001')
  }, SLOW)

  it('offers nobody who is gone, except the one being held', async () => {
    /* The other direction, so the rule above cannot be met by offering everybody who ever
       existed. A deleted member is on this list only because this one record names them. */
    const user = setupUser()
    /* A SERVER IN FRONT OF THE DELETION, since 26.09.2026. Taking a member away is
       `DELETE /api/competitors/{memberNumber}` now rather than a write to the session (see
       the note on `admin/AdminMembers.tsx`), and this whole case is about what the chooser
       offers AFTER one has gone. Without an answer the deletion is refused, he never
       leaves, and the case measures the chooser against a member who is still there.
       Narrowed to the write, so everything both screens READ still comes off the disc. */
    const server = serverThat((_path, init) => ((init?.method ?? 'GET') === 'GET' ? null : did()))
    const { router } = renderAt('/sr/administracija/clanovi', 'superadmin')

    const members = within(await screen.findByRole('table', { name: 'Članovi' }))
    const row = must(
      members.getAllByRole('row').find((one) => /Vladan Đurišić/.test(one.textContent ?? '')),
      'the row of the member who runs Dunav',
    )

    await user.click(within(row).getByRole('button', { name: /^Obriši: Vladan Đurišić/ }))
    await user.click(screen.getByRole('button', { name: /^Potvrdi brisanje: Vladan Đurišić/ }))

    /* AND WAITED FOR, ON THE SENTENCE THE SCREEN SAYS RATHER THAN ON THE ROW GOING AWAY.
       The press is no longer the deletion; the answer is. Two earlier drafts of this wait
       passed while measuring nothing, and both are named here because both look right:

       - `queryByText(/Vladan Đurišić/)` never matches at all. His given name and his family
         name are two text nodes inside the link, which is exactly why the search five lines
         above reads `row.textContent` instead of asking for the text.
       - „no row holds his name" is satisfied by the table having NO rows, and it briefly has
         none: a confirmed deletion clears the cache of members, so the list goes back to
         loading and the wait passed on an empty table.

       „Član je obrisan." is written in the one branch the answer approved, beside the write
       to the session itself, so it cannot be true early. */
    expect(await screen.findByText('Član je obrisan.')).toBeInTheDocument()

    await router.navigate('/sr/administracija/timovi')

    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))
    const other = must(
      listed.getAllByRole('row').find((one) => /Nišavski maraton klub/.test(one.textContent ?? '')),
      'the row of a team that does not name the deleted member',
    )

    await user.click(within(other).getByRole('button', { name: /^Otvori/ }))

    const said = await chooser()

    await waitFor(() => {
      expect(
        within(said)
          .queryAllByRole('option')
          .some((one) => one.textContent?.includes('000001') === true),
      ).toBe(false)
    })
    /* And its own organiser is still there, so the list was read rather than emptied,
       and there **once**: added without asking whether they are already offered, a
       member the record names would stand in the list twice, and a reader choosing
       between two of the same person is being asked a question with no answer. */
    expect(said).toHaveValue('000005')
    expect(
      within(said)
        .getAllByRole('option')
        .filter((one) => one.textContent?.includes('000005') === true),
    ).toHaveLength(1)

    server.stop()
  }, SLOW)
})
