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

    /* And the address answers the same way, which is where the rule really lives: a
       hidden control is not a rule, and that was a finding once already (04.09.2026).
       Two of the three doors read `teamOf` and neither had a case: put back on their own
       comparison, the whole gate stayed green (review, 05.09.2026). */
    await router.navigate('/sr/novi-tim')

    expect(await screen.findByLabelText(/Naziv tima/)).toBeVisible()
  }, SLOW)

  it('takes the roster with it from the other place a team can be deleted too', async () => {
    /* Two buttons that delete one thing must not delete two different amounts of it.
       Administration has always been able to delete a team, and it left the people in it
       pointing at a record that was gone: the portal went on refusing them a new team,
       because `teamId` still named one, while their profile showed no club, because
       `teams.find` answered nothing. Found by measurement, not by a screen (review,
       05.09.2026). */
    const user = setupUser()
    const { router } = renderAt('/sr/administracija/timovi', 'superadmin', '000001', undefined, DAY)

    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))
    const row = must(
      listed.getAllByRole('row').find((one) => /Dunavski trkači/.test(one.textContent ?? '')),
      'the row of the team being deleted',
    )

    await user.click(within(row).getByRole('button', { name: /^Obriši: Dunavski trkači/ }))
    await user.click(screen.getByRole('button', { name: /^Potvrdi brisanje: Dunavski trkači/ }))

    await router.navigate('/sr/timovi')

    /* The same answer the team's own page gives: nobody is left in a team that is gone,
       so the way to found one opens again. */
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

  it('is not offered to a visitor, on the team whose administrator is nobody', async () => {
    /* **Asked of the team that has no administrator, which is the only place it can be
       asked.** `teamAdminOf` answers `null` for a team nobody is in, and a visitor's own
       member number is `null` too, so the two match unless something says otherwise.
       Asked of a team that does have an administrator, this passes whether that
       something is there or not, and it did: taking it out left the whole gate green
       (review, 05.09.2026). Novoosnovani tim has no members and no organiser. */
    renderAt('/sr/tim/novoosnovani-tim')

    await screen.findByRole('heading', { level: 1, name: 'Novoosnovani tim' })

    expect(screen.queryByRole('button', { name: /^Obriši/ })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Izmeni' })).toBeNull()
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

    /* The count itself and not „not empty": emptying one member of another team would
       pass a reading that only refuses nought, and that member loses their team while
       their team loses their points (review, 05.09.2026). Nišavski has five. */
    expect(await screen.findByText('Niš · 5 članova')).toBeVisible()
  }, SLOW)
})
