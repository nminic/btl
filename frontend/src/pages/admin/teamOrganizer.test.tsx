import { screen, within } from '@testing-library/react'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

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
    const { router } = renderAt('/sr/administracija/clanovi', 'superadmin')

    const members = within(await screen.findByRole('table', { name: 'Članovi' }))
    const row = must(
      members.getAllByRole('row').find((one) => /Vladan Đurišić/.test(one.textContent ?? '')),
      'the row of the member who runs Dunav',
    )

    await user.click(within(row).getByRole('button', { name: /^Obriši: Vladan Đurišić/ }))
    await user.click(screen.getByRole('button', { name: /^Potvrdi brisanje: Vladan Đurišić/ }))

    await router.navigate('/sr/administracija/timovi')

    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))
    const other = must(
      listed.getAllByRole('row').find((one) => /Nišavski maraton klub/.test(one.textContent ?? '')),
      'the row of a team that does not name the deleted member',
    )

    await user.click(within(other).getByRole('button', { name: /^Otvori/ }))

    const said = await chooser()

    expect(
      within(said)
        .queryAllByRole('option')
        .some((one) => one.textContent?.includes('000001') === true),
    ).toBe(false)
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
  }, SLOW)
})
