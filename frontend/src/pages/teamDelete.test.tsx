import { screen, waitFor, within } from '@testing-library/react'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'

/* A day inside the transfer window, because founding a team is only offered there
   (owner, 05.09.2026), and the half of this that matters most is what the founder of
   a deleted team may do next. Read on the real day, that half would measure the
   window rather than the deletion. */
const DAY = '2026-10-15'

/* A team taken down by the member who administers it.
 *
 * Owner, 04.09.2026: „Obriši tim pokreće Da li ste sigurni? dijalog i onda se tim
 * briše kao i bodovi iz tabele za tu sezonu." And 05.09.2026, on what follows:
 * „svako brisanje tima do kraja godine je OK i besplatno, ne brani mu se da napravi
 * novi tim."
 *
 * Dunavski trkači is the team all of this is asked of: 000001 founded it and is still
 * in it, so they administer it; 000007 runs for it and does not.
 *
 * **What is not asked here, said plainly.** The owner's „zamrznuta tabela ostaje" is
 * not measured on this side at all: freezing happens at 1 January 16:00 and belongs to
 * the backend (`clock/context.ts`), so there is nothing in this portal that could hold
 * or break it. It is written down for the database rather than pretended at here.
 */

/** The name of the team, wherever it is drawn as a row of the standing. */
const listedTeams = async () =>
  within(await screen.findByRole('table', { name: 'Timovi' })).getAllByRole('row')

describe('a team its administrator takes down', () => {
  it('is asked about twice, and one press changes nothing', async () => {
    /* The portal's one way of asking about something nothing brings back, and it is
       the reason nothing here writes a dialog of its own: the first press opens the
       question, the second answers it. Pressed once, the team is still there. */
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci', 'competitor', '000001', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: /^Obriši: Dunavski trkači/ }))

    /* And both answers are on offer, each carrying the name, so a reader who arrives
       at the question is told what it is about without going back up the page. */
    expect(screen.getByRole('button', { name: /^Potvrdi brisanje: Dunavski trkači/ })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /^Odustani od brisanja: Dunavski trkači/ }))

    await router.navigate('/sr/timovi')

    expect(
      (await listedTeams()).some((one) => /Dunavski trkači/.test(one.textContent ?? '')),
    ).toBe(true)
  }, SLOW)

  it('goes out of the standing with its points, once the question is answered', async () => {
    /* „pa se tim briše kao i bodovi iz tabele za tu sezonu": one act and not two,
       because there is no standing without a record. Measured on the standing rather
       than on the record, because the standing is what the owner named and because it
       read the file until 05.09.2026, when a team deleted this visit went on standing
       in it with its points. */
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci', 'competitor', '000001', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: /^Obriši: Dunavski trkači/ }))
    await user.click(screen.getByRole('button', { name: /^Potvrdi brisanje: Dunavski trkači/ }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr/timovi')
    })

    expect(
      (await listedTeams()).some((one) => /Dunavski trkači/.test(one.textContent ?? '')),
    ).toBe(false)
    /* And the other teams are still there, which is what says the table was read and
       not merely emptied. */
    expect(
      (await listedTeams()).some((one) => /Nišavski maraton klub/.test(one.textContent ?? '')),
    ).toBe(true)
  }, SLOW)

  it('leaves the people who were in it without a team, and free to found another', async () => {
    /* Two halves of one rule. „ne brani mu se da napravi novi tim" is the owner's, and
       the way this portal takes somebody out of a team is to write an empty string over
       their `teamId`, because the session keeps values as text. Read as a team, that
       empty string would refuse the founder the very thing the owner allowed, and it
       would refuse it on the address as well; `teamOf` is the one reading that knows an
       empty string is not a team. */
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci', 'competitor', '000001', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: /^Obriši: Dunavski trkači/ }))
    await user.click(screen.getByRole('button', { name: /^Potvrdi brisanje: Dunavski trkači/ }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr/timovi')
    })

    /* The way in is offered again, on the screen the owner put it on. The address
       itself answers the same way and is not asked here: all three doors — this
       button, the address, and the queue that decides — read one function, and that
       function is asked about an empty string on its own (`data/derive.test.ts`).
       Asked here as well it would be the same measurement twice, once cheaply and
       once through a screen. */
    expect(await screen.findByRole('link', { name: 'Predloži tim' })).toBeVisible()
  }, SLOW)

  it('is not offered to a member of the team who does not administer it', async () => {
    /* 000007 runs for Dunav and did not found it. Taking the team down is about who
       may change the record, not about who belongs to it, and it is the same boundary
       the way into changing the team already draws. */
    renderAt('/sr/tim/dunavski-trkaci', 'competitor', '000007')

    await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })

    expect(screen.queryByRole('button', { name: /^Obriši/ })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Izmeni' })).toBeNull()
  })

  it('is not offered to somebody who is not signed in at all', async () => {
    /* The administrator of a team nobody is in is nobody, and a visitor's own „nobody"
       must not match it. That comparison has been got wrong once already on the way in
       to changing a team. */
    renderAt('/sr/tim/dunavski-trkaci')

    await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })

    expect(screen.queryByRole('button', { name: /^Obriši/ })).toBeNull()
  })

  it('does not touch anybody outside it, which is what taking one team down means', async () => {
    /* The half a reading over the whole file would get wrong: emptying `teamId` on
       everybody would pass every case above and leave the portal with no teams at all.
       Nišavski maraton klub keeps its people, and its own page still counts them. */
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci', 'competitor', '000001', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: /^Obriši: Dunavski trkači/ }))
    await user.click(screen.getByRole('button', { name: /^Potvrdi brisanje: Dunavski trkači/ }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr/timovi')
    })

    await router.navigate('/sr/tim/nisavski-maraton-klub')

    const said = must(
      (await screen.findByRole('heading', { level: 1, name: 'Nišavski maraton klub' })).closest(
        '.profile',
      ),
      'the page of the team that was not deleted',
    )

    expect(within(said).queryByText(/0 članova/)).toBeNull()
  }, SLOW)
})
