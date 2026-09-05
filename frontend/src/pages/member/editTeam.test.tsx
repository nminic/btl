import { screen, waitFor, within } from '@testing-library/react'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

/* A team changed by the member who administers it, and decided on like a new one.
 *
 * Owner, 04.09.2026: „Izmeni tim ulazi u podatke tima koji se menjaju i ponovo
 * prolaze verifikaciju, dok na strani timova ostaju postojeći podaci dok se novi
 * ne verifikuju."
 *
 * Dunavski trkači is the team all of this is asked of: 000001 founded it and is
 * still in it, so they administer it; 000007 is in it and does not.
 */

describe('the way to change a team', () => {
  it('is offered on the team page to the member who administers it', async () => {
    renderAt('/sr/tim/dunavski-trkaci', 'competitor', '000001')

    const change = await screen.findByRole('link', { name: 'Izmeni' })

    expect(change).toBeVisible()
    expect(change).toHaveAttribute('href', '/sr/tim/dunavski-trkaci/izmena')
  })

  it('follows the administrator a moderator names, and leaves the one they replaced', async () => {
    /* PDL, 04.09.2026: „Moderator ili administrator sme da dodeli drugog" kad je to
       mesto prazno, i to je upis u `organizerMemberNumber` na samom timu. Taj upis
       živi u sloju sesije, kao i sve što administracija promeni; pročitan sa fajla,
       ekran je i dalje davao „Izmeni" članu koga je moderator upravo zamenio, a
       njegova odobrena izmena se upisivala u zapis tima (review, 05.09.2026). */
    const user = setupUser()
    const { router } = renderAt('/sr/administracija/timovi', 'superadmin', '000001')

    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))
    const row = must(
      listed.getAllByRole('row').find((one) => /Dunavski trkači/.test(one.textContent ?? '')),
      'the row of the team being handed over',
    )

    await user.click(within(row).getByRole('button', { name: /^Otvori/ }))
    await user.selectOptions(await screen.findByLabelText(/Organizator tima/), '000007')
    await user.click(screen.getByRole('button', { name: /Sačuvaj/ }))

    await router.navigate('/sr/tim/dunavski-trkaci')
    await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })

    expect(screen.queryByRole('link', { name: 'Izmeni' })).toBeNull()

    await router.navigate('/sr/tim/dunavski-trkaci/izmena')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
  }, SLOW)

  it('is not offered to another member of the same team', async () => {
    /* 000007 runs for Dunav and did not found it. The button is about who may
       change the record, not about who belongs to the team. */
    renderAt('/sr/tim/dunavski-trkaci', 'competitor', '000007')

    await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })
    expect(screen.queryByRole('link', { name: 'Izmeni' })).toBeNull()
  })

  it('is not offered to somebody who is not signed in', async () => {
    /* And this is the one a wrong comparison would let through: a team nobody is
       in answers „nobody administers me", and a visitor is nobody too. */
    renderAt('/sr/tim/dunavski-trkaci')

    await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })
    expect(screen.queryByRole('link', { name: 'Izmeni' })).toBeNull()
  })

  it('sends whoever reaches the address without administering the team to the front page', async () => {
    /* Owner, 05.09.2026, of the way into founding a team and of this one with it:
       „Ako neko proba deeplink... treba da se preusmeri na homepage." Asked of the
       address the router ends on and not only of what is drawn: the front page has a
       heading like every other page, so a heading alone would pass over a screen that
       never redirected. */
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'competitor', '000007')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
    expect(screen.queryByLabelText(/Naziv tima/)).toBeNull()
  })

  it('says there is no such team when the address names one the league does not have', async () => {
    /* The same answer the team's own page gives, because it is the same question:
       an address typed by hand, or one left over from a team that has been deleted. */
    renderAt('/sr/tim/nema-ovog-tima/izmena', 'competitor', '000001')

    expect(await screen.findByRole('heading', { level: 1, name: 'Ovog tima nema.' })).toBeVisible()
    expect(screen.queryByLabelText(/Naziv tima/)).toBeNull()
  })

  it('sends everybody away from a team nobody is in', async () => {
    /* „Novoosnovani tim" has no members and no founder on the record, so it has no
       administrator either (`data/teamAdmin.ts` answers nobody). An address that
       nobody may use is not a page for anybody, not even for the member the portal
       would otherwise call its administrator. */
    const { router } = renderAt('/sr/tim/novoosnovani-tim/izmena', 'competitor', '000001')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
  })

  it('asks whoever reaches the address without signing in to sign in', async () => {
    renderAt('/sr/tim/dunavski-trkaci/izmena')

    expect(await screen.findByRole('heading', { name: /prijav/i })).toBeVisible()
    expect(screen.queryByLabelText(/Naziv tima/)).toBeNull()
  })
})

describe('the form a team is changed on', () => {
  it('opens on what the team says today, and asks for the reason afresh', async () => {
    /* Seeded, because a member changing a town should not have to type the name
       again; the reason is why this change should be allowed and last time's is
       not this time's. */
    renderAt('/sr/tim/dunavski-trkaci/izmena', 'competitor', '000001')

    expect(await screen.findByLabelText(/Naziv tima/)).toHaveValue('Dunavski trkači')
    expect(screen.getByLabelText(/^Mesto/)).toHaveValue('Novi Sad')
    expect(screen.getByLabelText(/^Država/)).toHaveValue('RS')
    expect(screen.getByLabelText(/Zašto ovaj tim/)).toHaveValue('')
  })

  it('does not refuse the team its own name', async () => {
    /* The name is taken, by the very team being changed. Compared against every
       other address and not against all of them, or a member could never change
       the town without also renaming the team. */
    const user = setupUser()
    renderAt('/sr/tim/dunavski-trkaci/izmena', 'competitor', '000001')

    await user.clear(await screen.findByLabelText(/^Mesto/))
    await user.type(screen.getByLabelText(/^Mesto/), 'Sremski Karlovci')
    await user.click(screen.getByRole('button', { name: 'Pošalji izmenu' }))

    expect(await screen.findByRole('heading', { name: 'Izmena je poslata' })).toBeVisible()
  })

  it('still refuses the name of another team', async () => {
    const user = setupUser()
    renderAt('/sr/tim/dunavski-trkaci/izmena', 'competitor', '000001')

    await user.clear(await screen.findByLabelText(/Naziv tima/))
    await user.type(screen.getByLabelText(/Naziv tima/), 'Vardarski krug')
    await user.click(screen.getByRole('button', { name: 'Pošalji izmenu' }))

    expect(await screen.findByText(/već postoji u ligi/)).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Izmena je poslata' })).toBeNull()
  })

  it('leaves the team as it is on the portal while the change waits', async () => {
    /* „Dok na strani timova ostaju postojeći podaci dok se novi ne verifikuju."
       Walked rather than reasoned about: send the change, then read the team's own
       page and the standing of the teams. */
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'competitor', '000001')

    await user.clear(await screen.findByLabelText(/Naziv tima/))
    await user.type(screen.getByLabelText(/Naziv tima/), 'Dunavska družina')
    await user.click(screen.getByRole('button', { name: 'Pošalji izmenu' }))
    await screen.findByRole('heading', { name: 'Izmena je poslata' })

    await router.navigate('/sr/tim/dunavski-trkaci')

    expect(await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })).toBeVisible()

    await router.navigate('/sr/timovi')

    const table = within(await screen.findByRole('table', { name: 'Timovi' }))

    expect(table.getByText('Dunavski trkači')).toBeVisible()
    expect(table.queryByText('Dunavska družina')).toBeNull()
  })
})

describe('a change waiting on the queue of teams', () => {
  it('says it is a change of a team and not a new one', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    /* **A change of name**, because that is the case the mark exists for: with the
       town changed and the name left alone, the team's own name and the name on the
       card are the same string and nothing tells which of the two is being read
       (review, 05.09.2026). */
    await user.clear(await screen.findByLabelText(/Naziv tima/))
    await user.type(screen.getByLabelText(/Naziv tima/), 'Dunavska družina')
    await user.clear(screen.getByLabelText(/^Mesto/))
    await user.type(screen.getByLabelText(/^Mesto/), 'Sremski Karlovci')
    await user.click(screen.getByRole('button', { name: 'Pošalji izmenu' }))
    await screen.findByRole('heading', { name: 'Izmena je poslata' })

    await router.navigate('/sr/administracija/verifikacija/timovi')

    const heading = await screen.findByRole('heading', { name: 'Dunavska družina' })
    const card = within(must(heading.closest('li'), 'the card the heading stands in'))

    /* And **which** team, by the name it carries now. „Izmena postojećeg tima" alone
       left the moderator to guess: a change of name puts the new one in the heading
       and the old one nowhere on the card, so the decision was taken blind (review,
       05.09.2026). */
    expect(card.getByText('Izmena tima „Dunavski trkači“')).toBeVisible()
    /* And the reason a moderator reads carries the new town, which is the thing
       being decided about. */
    expect(card.getByText(/Sremski Karlovci/)).toBeVisible()
  })

  it('is not held against the name of the team it is about', async () => {
    /* The card's own refusal, which is a second reader of the same rule and had no
       case of its own: a change that only moves the town keeps the name, and read
       against every address including the team's own it is „a name already taken".
       The moderator is then told to correct a name nobody changed, and the control
       that would approve it is dead. */
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await user.clear(await screen.findByLabelText(/^Mesto/))
    await user.type(screen.getByLabelText(/^Mesto/), 'Sremski Karlovci')
    await user.click(screen.getByRole('button', { name: 'Pošalji izmenu' }))
    await screen.findByRole('heading', { name: 'Izmena je poslata' })

    await router.navigate('/sr/administracija/verifikacija/timovi')

    const heading = await screen.findByRole('heading', { name: 'Dunavski trkači' })
    const card = within(must(heading.closest('li'), 'the card the heading stands in'))

    expect(card.queryByText(/već postoji u ligi/)).toBeNull()
    expect(card.getByRole('button', { name: 'Odobri' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('reaches the member as a change turned down, not as a proposal turned down', async () => {
    /* Refused under the queue's one heading, the administrator of a team whose change
       was turned down read „Predlog tima je vraćen" about a team they never proposed.
       The same fault `queues.ts` was written to stop, one queue further along
       (review, 05.09.2026). */
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await user.clear(await screen.findByLabelText(/^Mesto/))
    await user.type(screen.getByLabelText(/^Mesto/), 'Sremski Karlovci')
    await user.click(screen.getByRole('button', { name: 'Pošalji izmenu' }))
    await screen.findByRole('heading', { name: 'Izmena je poslata' })

    await router.navigate('/sr/administracija/verifikacija/timovi')

    const heading = await screen.findByRole('heading', { name: 'Dunavski trkači' })
    const card = within(must(heading.closest('li'), 'the card the heading stands in'))

    await user.click(card.getByRole('button', { name: 'Odbij' }))
    await user.type(screen.getByLabelText('Razlog odbijanja'), 'Mesto se ne poklapa sa prijavom.')
    await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

    await user.click(screen.getByRole('button', { name: /Otvori poruke/ }))

    expect(screen.getByRole('link', { name: /Izmena tima je vraćena/ })).toBeVisible()
    expect(screen.queryByRole('link', { name: /Predlog tima je vraćen/ })).toBeNull()
  }, SLOW)

  it('reaches the member as a change accepted, not as a proposal accepted', async () => {
    /* The fourth of the four outcomes this queue can send, and the only one nothing
       held: approved under the proposal's words, the administrator of a team whose
       change was taken read „Tvoj predlog tima je prihvaćen. Ti si njegov
       organizator." about a team they had run for years (review, 05.09.2026). */
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await user.clear(await screen.findByLabelText(/^Mesto/))
    await user.type(screen.getByLabelText(/^Mesto/), 'Sremski Karlovci')
    await user.click(screen.getByRole('button', { name: 'Pošalji izmenu' }))
    await screen.findByRole('heading', { name: 'Izmena je poslata' })

    await router.navigate('/sr/administracija/verifikacija/timovi')

    const heading = await screen.findByRole('heading', { name: 'Dunavski trkači' })
    const card = within(must(heading.closest('li'), 'the card the heading stands in'))

    await user.click(card.getByRole('button', { name: 'Odobri' }))
    await user.click(screen.getByRole('button', { name: /Otvori poruke/ }))

    expect(
      screen.getByRole('link', { name: /Izmena tima „Dunavski trkači“ je prihvaćena/ }),
    ).toBeVisible()
    expect(screen.queryByRole('link', { name: /predlog tima/i })).toBeNull()
  }, SLOW)

  it('cannot be approved once the team it names has been deleted', async () => {
    /* Approved anyway it wrote into an identity nothing answers to, settled the item,
       and told the member their team had been changed (review, 05.09.2026). The card
       says so instead, and the control that would take the decision is dead. */
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await user.clear(await screen.findByLabelText(/^Mesto/))
    await user.type(screen.getByLabelText(/^Mesto/), 'Sremski Karlovci')
    await user.click(screen.getByRole('button', { name: 'Pošalji izmenu' }))
    await screen.findByRole('heading', { name: 'Izmena je poslata' })

    await router.navigate('/sr/administracija/timovi')

    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))
    const row = must(
      listed.getAllByRole('row').find((one) => /Dunavski trkači/.test(one.textContent ?? '')),
      'the row of the team being deleted',
    )

    await user.click(within(row).getByRole('button', { name: /^Obriši/ }))
    await user.click(within(row).getByRole('button', { name: /^Potvrdi brisanje/ }))

    await router.navigate('/sr/administracija/verifikacija/timovi')

    const heading = await screen.findByRole('heading', { name: 'Dunavski trkači' })
    const card = within(must(heading.closest('li'), 'the card the heading stands in'))

    expect(card.getByText(/je u međuvremenu obrisan/)).toBeVisible()
    expect(card.getByRole('button', { name: 'Odobri' })).toHaveAttribute('aria-disabled', 'true')
  }, SLOW)

  it('writes into the team it is about when it is approved, rather than making a second one', async () => {
    /* The whole walk, because the two halves passed apart: a change that reaches
       the queue and an approval that creates a team would both look right on their
       own and leave the league with two teams of one name. */
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await user.clear(await screen.findByLabelText(/^Mesto/))
    await user.type(screen.getByLabelText(/^Mesto/), 'Sremski Karlovci')
    await user.click(screen.getByRole('button', { name: 'Pošalji izmenu' }))
    await screen.findByRole('heading', { name: 'Izmena je poslata' })

    await router.navigate('/sr/administracija/verifikacija/timovi')

    const heading = await screen.findByRole('heading', { name: 'Dunavski trkači' })
    const card = within(must(heading.closest('li'), 'the card the heading stands in'))

    await user.click(card.getByRole('button', { name: 'Odobri' }))
    await router.navigate('/sr/administracija/timovi')

    const table = within(await screen.findByRole('table', { name: 'Timovi' }))

    /* One row of that name, and the town it was changed to. Counted, because a
       creation would leave the old row standing beside a new one. */
    expect(table.getAllByText('Dunavski trkači')).toHaveLength(1)
    expect(table.getByText('Sremski Karlovci')).toBeVisible()
    expect(table.queryByText('Novi Sad')).toBeNull()
  })
})
