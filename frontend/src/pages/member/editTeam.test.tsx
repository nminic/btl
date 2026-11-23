import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { configure, screen, waitFor, within } from '@testing-library/react'
import { must } from '../../test/at'
import { sayYes } from '../../test/deleteSheet'
import { fakeQueue } from '../../test/fakeQueue'
import { renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { typeATownTheCodebookKnows } from '../../test/town'
import { setupUser } from '../../test/user'

/* Every wait is given half of what a case is given, for the reason `admin/deleting.test.tsx` gives and
   `admin/saveWhileSaving.test.tsx` is the precedent of: a wait that is stuck then fails on its own
   assertion with its own sentence, and not on the clock of the case, which says nothing about what was
   wrong (a mutation that removes the effect measured here was only ever „not measured" before). */
configure({ asyncUtilTimeout: SLOW / 2 })

const MOCK_TEAMS: { slug: string; bio: string; link: string }[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'teams.json'), 'utf-8'),
)

const DUNAV = must(
  MOCK_TEAMS.find((one) => one.slug === 'dunavski-trkaci'),
  'the team every case here acts on',
)

/* A team changed by the member who administers it, and decided on like a new one.
 *
 * Owner, 04.09.2026: „Izmeni tim ulazi u podatke tima koji se menjaju i ponovo
 * prolaze verifikaciju, dok na strani timova ostaju postojeći podaci dok se novi
 * ne verifikuju."
 *
 * Dunavski trkači is the team all of this is asked of: 000001 founded it and is
 * still in it, so they administer it; 000007 is in it and does not.
 */

/* EVERY CASE HERE HAS THE SERVER'S TEAMS IN FRONT OF IT, because since 23.11.2026 this form, the
 * queue it files into and the administration's own screen all speak to routes
 * (`POST /api/teams/{id}/changes`, `POST /api/verification/{id}/decision`, `PUT` and `DELETE
 * /api/teams/{id}`) and none of them writes a team into the session. `fakeQueue()` remembers
 * what was posted and serves the two resources a screen reads again after it. */
let queue: { asked: Asked[]; stop: () => void } | null = null

beforeEach(() => {
  queue = fakeQueue()
})

afterEach(() => {
  queue?.stop()
  queue = null
})

/** The decisions the screen sent, in the order it sent them. */
function decisionsSent(): Asked[] {
  return (queue?.asked ?? []).filter((one) => one.init?.method === 'POST' && one.path.endsWith('/decision'))
}

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

  it('sends away a member number the answer has no record of', async () => {
    /* **THE OTHER REASON THIS ADDRESS REFUSES SOMEBODY, and it is not the permission.**
       A visit carries a member number and the list carries records; the two can part,
       and since 21.09.2026 they part for a reason of their own: a member whose fee has
       lapsed is not on `/api/competitors` at all (owner, 13.09.2026), so the number a
       browser remembered may name nobody in the answer.

       Both reasons end on the front page, which is the same sentence the owner gave for
       the deeplink, and reading one of them off the screen rather than the address would
       pass over a page that never redirected. */
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'competitor', '000999')

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
  it('opens on what the team says today, the description and the link included', async () => {
    /* Seeded, because a member changing a town should not have to type the name
       again, nor the description the team already has. The note „Zašto ovaj tim" is gone
       since 23.11.2026 and the description stands in its place (PDL P13). */
    renderAt('/sr/tim/dunavski-trkaci/izmena', 'competitor', '000001')

    expect(await screen.findByLabelText(/Naziv tima/)).toHaveValue('Dunavski trkači')
    expect(screen.getByLabelText(/^Mesto/)).toHaveValue('Novi Sad')
    expect(screen.getByLabelText(/^Država/)).toHaveValue('RS')
    expect(screen.getByLabelText(/^Opis tima/)).toHaveValue(DUNAV.bio)
    expect(screen.getByLabelText(/^Link/)).toHaveValue(DUNAV.link)
  })

  /**
   * THE TEAMS AS THEY ARE SERVED, WITH THE TOWN OF DUNAVSKI TRKAČI PUT WHERE THE CASE WANTS IT.
   *
   * <p>No team in the file is recorded in a different country from the one the codebook gives
   * its town (measured over all four, 03.10.2026), and that disagreement is exactly what the two
   * cases below are about, so it is made rather than hoped for. Read off the same file the
   * portal's own reader reads, and changed in nothing but the two words.
   */
  const teamsWithDunavAt = (city: string, country: string): Response => {
    const teams: { slug: string; city: string; country: string }[] = JSON.parse(
      readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'teams.json'), 'utf-8'),
    )

    return new Response(
      JSON.stringify(
        teams.map((one) => (one.slug === 'dunavski-trkaci' ? { ...one, city, country } : one)),
      ),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }

  it('is not rewritten by the codebook while nobody has touched the town', async () => {
    /* A RECORD OPENED FOR EDITING IS LEFT EXACTLY AS IT WAS WRITTEN (`forms/PlaceField.tsx`),
       and this form is one since 03.10.2026: it is the proposal's own, seeded, so it draws the
       town as a place and the codebook speaks to it. A form that quietly rewrites a field
       nobody has been near saves something other than what it was opened on, and the card the
       moderator reads would show a country nobody chose.

       The record says Kranj and Croatia, and the codebook says Kranj is in Slovenia. The
       select is switched off the moment the codebook has arrived (it recognises the town),
       which is the proof that it HAS spoken; and what stands in it is still the record's
       word, and it is what the moderator is sent. */
    const server = serverThat((path, init) =>
      path === '/api/teams' && init?.method === undefined ? teamsWithDunavAt('Kranj', 'HR') : null,
    )

    try {
      const user = setupUser()
      const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

      expect(await screen.findByLabelText(/^Mesto/)).toHaveValue('Kranj')

      const country = screen.getByLabelText(/^Država/)

      await waitFor(
        () => {
          expect(country).toBeDisabled()
        },
        { timeout: 3000 },
      )

      expect(country).toHaveValue('HR')

      await user.click(screen.getByRole('button', { name: 'Pošalji izmenu' }))
      await screen.findByRole('heading', { name: 'Izmena je poslata' })
      await router.navigate('/sr/administracija/verifikacija/timovi')

      const heading = await screen.findByRole('heading', { name: 'Dunavski trkači' })
      const card = within(must(heading.closest('li'), 'the card the heading stands in'))

      expect(card.getByLabelText('Mesto')).toHaveValue('Kranj')
      expect(card.getByLabelText(/^Država/)).toHaveValue('HR')
    } finally {
      server.stop()
    }
  }, SLOW)

  it('takes the country the codebook gives once the town of the record has been typed over', async () => {
    /* The other half of the case above, which is what keeps it from being a form that never
       lets the codebook speak: the moment the town is touched, the codebook's word about the
       town that is typed is the one that stands (PDL, 11.08.2026), and a record seeded with
       Croatia then goes to the moderator with the Slovenia the typed town is in. */
    const server = serverThat((path, init) =>
      path === '/api/teams' && init?.method === undefined ? teamsWithDunavAt('Kranj', 'HR') : null,
    )

    try {
      const user = setupUser()
      const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

      await user.clear(await screen.findByLabelText(/^Mesto/))
      await typeATownTheCodebookKnows(user, 'Kranj', 'SI')
      await user.click(screen.getByRole('button', { name: 'Pošalji izmenu' }))
      await screen.findByRole('heading', { name: 'Izmena je poslata' })
      await router.navigate('/sr/administracija/verifikacija/timovi')

      const heading = await screen.findByRole('heading', { name: 'Dunavski trkači' })
      const card = within(must(heading.closest('li'), 'the card the heading stands in'))

      expect(card.getByLabelText('Mesto')).toHaveValue('Kranj')
      expect(card.getByLabelText(/^Država/)).toHaveValue('SI')
    } finally {
      server.stop()
    }
  }, SLOW)

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

    expect(await screen.findByText(/Tim sa ovim nazivom već postoji/)).toBeVisible()
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
    expect(card.getByText('Izmena tima "Dunavski trkači"')).toBeVisible()
    /* And the reason a moderator reads carries the new town, which is the thing
       being decided about. */
    expect(card.getByLabelText('Mesto')).toHaveValue('Sremski Karlovci')
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

    expect(card.queryByText(/Tim sa ovim nazivom već postoji/)).toBeNull()
    expect(card.getByRole('button', { name: 'Odobri' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  /* THE NOTICE OF A DECISION IS THE ROUTE'S, NOT THE SCREEN'S, since 23.11.2026
     (`VerificationWriteApi`, and `TeamDecisionsCarryWhatTheCardShowsTest` for the sentence it
     writes to the administrator: a change turned down or taken, and never „predlog tima"). What
     this screen owes is the request, to the number the card carries and with the answer the
     moderator gave; and that it writes no notice of its own beside the server's, which is the
     second sentence the member used to read. */
  it('is turned down at the route, and reaches the member as a change turned down, not as a proposal', async () => {
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

    await waitFor(() => {
      expect(decisionsSent()).toHaveLength(1)
    })

    const sent = must(decisionsSent()[0], 'the decision')

    expect(sent.path).toMatch(/^\/api\/verification\/\d+\/decision$/)
    expect(JSON.parse(String(sent.init?.body))).toMatchObject({
      approved: false,
      reason: 'Mesto se ne poklapa sa prijavom.',
    })

    /* The refusal is the one notice the screen still writes (the moderator's own words, under the
       heading of a change and never of a proposal, `queues.ts`): the route writes the notice of an
       approval and says nothing of a refusal. */
    await user.click(screen.getByRole('button', { name: /Otvori poruke/ }))

    expect(await screen.findByRole('link', { name: /Izmena tima je vraćena/ })).toBeVisible()
    expect(screen.queryByRole('link', { name: /Predlog tima je vraćen/ })).toBeNull()
  }, SLOW)

  it('is approved at the route with the team as the card shows it, and the screen writes no notice of its own', async () => {
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

    await waitFor(() => {
      expect(decisionsSent()).toHaveLength(1)
    })

    const body = JSON.parse(String(must(decisionsSent()[0], 'the decision').init?.body))

    expect(body).toMatchObject({
      approved: true,
      team: { name: 'Dunavski trkači', city: 'Sremski Karlovci', country: 'RS', bio: DUNAV.bio, link: DUNAV.link },
    })

    await user.click(screen.getByRole('button', { name: /Otvori poruke/ }))

    expect(screen.queryByRole('link', { name: /Izmena tima|predlog tima/i })).toBeNull()
  }, SLOW)

  it('goes to the route like a served proposal waiting beside it, each to the address of its own card', async () => {
    /* VISOK 2, review of PR 380, which was about a card made up in the browser that the route could
       not carry (`prop-1`). There is no such card any more: a change is a card of the server's like
       every other one, with a number of its own, and the case now holds the opposite - that both
       are asked, and that the address of each is its own and not the other's. */
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await user.clear(await screen.findByLabelText(/^Mesto/))
    await user.type(screen.getByLabelText(/^Mesto/), 'Sremski Karlovci')
    await user.click(screen.getByRole('button', { name: 'Pošalji izmenu' }))
    await screen.findByRole('heading', { name: 'Izmena je poslata' })

    await router.navigate('/sr/administracija/verifikacija/timovi')

    const oursHeading = await screen.findByRole('heading', { name: 'Dunavski trkači' })
    const ours = within(must(oursHeading.closest('li'), 'the card of the change this visit just made'))

    await user.click(ours.getByRole('button', { name: 'Odobri' }))

    const servedHeading = await screen.findByRole('heading', { name: 'Timočka trkačka družina' })
    const served = within(must(servedHeading.closest('li'), 'a card served off the file, waiting beside it'))

    await user.click(served.getByRole('button', { name: 'Odobri' }))

    await waitFor(() => {
      expect(decisionsSent()).toHaveLength(2)
    })

    expect(decisionsSent().map((one) => one.path)).toEqual([
      expect.stringMatching(/^\/api\/verification\/\d+\/decision$/),
      '/api/verification/ver-tim-1/decision',
    ])
  }, SLOW)

  it('is handed back at the route too, beside a served proposal that is handed back', async () => {
    /* The other door onto the same boundary: `handBack` is a call of its own and not `approveAll`'s. */
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await user.clear(await screen.findByLabelText(/^Mesto/))
    await user.type(screen.getByLabelText(/^Mesto/), 'Sremski Karlovci')
    await user.click(screen.getByRole('button', { name: 'Pošalji izmenu' }))
    await screen.findByRole('heading', { name: 'Izmena je poslata' })

    await router.navigate('/sr/administracija/verifikacija/timovi')

    const oursHeading = await screen.findByRole('heading', { name: 'Dunavski trkači' })
    const ours = within(must(oursHeading.closest('li'), 'the card of the change this visit just made'))

    await user.click(ours.getByRole('button', { name: 'Odbij' }))
    await user.type(screen.getByLabelText('Razlog odbijanja'), 'Mesto se ne poklapa sa prijavom.')
    await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

    const servedHeading = await screen.findByRole('heading', { name: 'Timočka trkačka družina' })
    const served = within(must(servedHeading.closest('li'), 'a card served off the file, waiting beside it'))

    await user.click(served.getByRole('button', { name: 'Odbij' }))
    await user.type(screen.getByLabelText('Razlog odbijanja'), 'Nepotpun opis tima.')
    await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

    await waitFor(() => {
      expect(decisionsSent()).toHaveLength(2)
    })

    expect(decisionsSent().map((one) => one.path)).toEqual([
      expect.stringMatching(/^\/api\/verification\/\d+\/decision$/),
      '/api/verification/ver-tim-1/decision',
    ])
  }, SLOW)

  /* A SECOND CHANGE OF A TEAM WHILE THE FIRST WAITS REPLACES IT (PDL P13, [ODLUKA 23.11.2026], owner:
     „nova zamenjuje staru"), and the queue keeps one card of it. The route does it
     (`TeamWriteApiTest`, in Java, with the three things it must not reach); what the screen holds is
     that it asks for it once per send and draws what the queue then holds. `fakeQueue` does the same
     as the route, so these cases measure the screen's reading of it and not the fake. */
  const sendAChange = async (
    user: ReturnType<typeof setupUser>,
    router: { navigate: (to: string) => Promise<void> },
    name: string,
    slug = 'dunavski-trkaci',
  ) => {
    await router.navigate(`/sr/tim/${slug}/izmena`)
    await user.clear(await screen.findByLabelText(/Naziv tima/))
    await user.type(screen.getByLabelText(/Naziv tima/), name)
    await user.click(screen.getByRole('button', { name: 'Pošalji izmenu' }))
    await screen.findByRole('heading', { name: 'Izmena je poslata' })
  }

  it('leaves one card of the team, with the words sent last, when a second change is sent while the first waits', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await sendAChange(user, router, 'Dunavska družina')
    await sendAChange(user, router, 'Dunavski klub')
    await router.navigate('/sr/administracija/verifikacija/timovi')

    expect(await screen.findByRole('heading', { name: 'Dunavski klub' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Dunavska družina' })).toBeNull()
  }, SLOW)

  it('leaves the proposal of a new team where it was when a change is replaced beside it', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await sendAChange(user, router, 'Dunavska družina')
    await sendAChange(user, router, 'Dunavski klub')
    await router.navigate('/sr/administracija/verifikacija/timovi')

    const heading = await screen.findByRole('heading', { name: 'Timočka trkačka družina' })
    const card = within(must(heading.closest('li'), 'the proposal of the new team'))

    expect(card.getByLabelText('Mesto')).toHaveValue('Zaječar')
  }, SLOW)

  it('opens a second card when the first has been decided, and leaves the decided one decided', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await sendAChange(user, router, 'Dunavska družina')
    await router.navigate('/sr/administracija/verifikacija/timovi')

    const first = await screen.findByRole('heading', { name: 'Dunavska družina' })

    await user.click(
      within(must(first.closest('li'), 'the card of the first change')).getByRole('button', {
        name: 'Odobri',
      }),
    )
    await waitFor(() => {
      expect(decisionsSent()).toHaveLength(1)
    })

    await sendAChange(user, router, 'Dunavski klub', 'dunavska-druzina')
    await router.navigate('/sr/administracija/verifikacija/timovi')

    expect(await screen.findByRole('heading', { name: 'Dunavski klub' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Dunavska družina' })).toBeNull()
    expect(decisionsSent()).toHaveLength(1)
  }, SLOW)

  /* A DECISION NAMES THE WORDS IT WAS TAKEN ABOUT (PDL P13, [ODLUKA 23.11.2026], „nova zamenjuje staru"; the
     shape is the picture's, `seenPhotoId`). The moderator who has the first change open when the second
     is written over it is refused with the sentence, the card is read again, and the team has not moved;
     asked again over the new words, the same press goes through. `fakeQueue` answers as the route does
     (`VerificationWriteApi.whyTheChangeIsNotTheOneHeSaw`, in Java). */
  const THE_CHANGE_WAS_CHANGED = 'Izmena tima je promenjena, pogledaj je ponovo.'

  /** What the team is called on the server, which is what a decision that did not go through leaves. */
  const theTeamIsCalled = async (): Promise<string> => {
    const teams: { id: number; name: string }[] = await (await fetch('/api/teams')).json()

    return must(teams.find((one) => one.id === 1), 'the team every case here acts on').name
  }

  /** The second change, sent behind the screen's back, which is what an administrator does while the
   *  moderator looks at the first. */
  const sendBehindHisBack = async (
    name: string,
    more: { city: string; bio: string; link: string } = { city: 'Novi Sad', bio: DUNAV.bio, link: DUNAV.link },
  ): Promise<void> => {
    await fetch('/api/teams/1/changes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, city: more.city, country: 'RS', bio: more.bio, link: more.link }),
    })
  }

  it('refuses the approval of a change that was replaced while the moderator looked, says so and reads the card again', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await sendAChange(user, router, 'Dunavska družina')
    await router.navigate('/sr/administracija/verifikacija/timovi')

    const first = await screen.findByRole('heading', { name: 'Dunavska družina' })

    await sendBehindHisBack('Dunavski klub')
    await user.click(
      within(must(first.closest('li'), 'the card of the first change')).getByRole('button', { name: 'Odobri' }),
    )

    expect(await screen.findByText(THE_CHANGE_WAS_CHANGED)).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Dunavski klub' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Dunavska družina' })).toBeNull()
    expect(await theTeamIsCalled()).toBe('Dunavski trkači')

    /* THE SAME PRESS, OVER WHAT HE SAW NOW, GOES THROUGH. */
    const second = screen.getByRole('heading', { name: 'Dunavski klub' })

    await user.click(
      within(must(second.closest('li'), 'the card he reads now')).getByRole('button', { name: 'Odobri' }),
    )

    await waitFor(() => {
      expect(decisionsSent()).toHaveLength(2)
    })
    await waitFor(async () => {
      expect(await theTeamIsCalled()).toBe('Dunavski klub')
    })
  }, SLOW)

  it('refuses the refusal of a change that was replaced while the moderator looked, as the picture does', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await sendAChange(user, router, 'Dunavska družina')
    await router.navigate('/sr/administracija/verifikacija/timovi')

    const first = await screen.findByRole('heading', { name: 'Dunavska družina' })

    await sendBehindHisBack('Dunavski klub')
    await user.click(
      within(must(first.closest('li'), 'the card of the first change')).getByRole('button', { name: 'Odbij' }),
    )
    await user.type(screen.getByLabelText('Razlog odbijanja'), 'Opis nije potreban.')
    await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

    expect(await screen.findByText(THE_CHANGE_WAS_CHANGED)).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Dunavski klub' })).toBeVisible()
  }, SLOW)

  it('names what the card showed and not what the moderator typed over it, beside the correction', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await sendAChange(user, router, 'Dunavska družina')
    await router.navigate('/sr/administracija/verifikacija/timovi')

    const heading = await screen.findByRole('heading', { name: 'Dunavska družina' })
    const card = within(must(heading.closest('li'), 'the card of the change'))

    await user.clear(card.getByLabelText('Naziv tima'))
    await user.type(card.getByLabelText('Naziv tima'), 'Dunavski ispravljen')
    await user.click(card.getByRole('button', { name: 'Odobri' }))

    await waitFor(() => {
      expect(decisionsSent()).toHaveLength(1)
    })

    const sent = JSON.parse(String(must(decisionsSent()[0], 'the decision').init?.body))

    expect(sent.seenTeam.name).toBe('Dunavska družina')
    expect(sent.team.name).toBe('Dunavski ispravljen')
    expect(await theTeamIsCalled()).toBe('Dunavski ispravljen')
  }, SLOW)

  /* AFTER THE 409 THE MODERATOR SEES THE NEW WORDS AND NOT HIS OLD CORRECTION (review of PR 807, round 2).
     The card keeps its key when a second change is written over it, and a correction kept under the key
     alone outlived the words it was typed over: the card drew the correction, the new words were seen
     nowhere, and the second press named words he had never been shown. A correction is now kept under the
     card AND THE WORDS it was typed over (`editsKeyOf`), so when the words change it is not found. */
  const THE_NEW_WORDS = { city: 'Sremski Karlovci', bio: 'Nov opis tima.', link: 'https://klub.example' }

  it('draws every word of the new change after the 409, and not what the moderator had typed over the old', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await sendAChange(user, router, 'Dunavska družina')
    await router.navigate('/sr/administracija/verifikacija/timovi')

    const first = await screen.findByRole('heading', { name: 'Dunavska družina' })
    const card = within(must(first.closest('li'), 'the card of the first change'))

    /* He corrects every box he is given, so every one of them can show the old correction. */
    await user.clear(card.getByLabelText('Naziv tima'))
    await user.type(card.getByLabelText('Naziv tima'), 'Dunavska Družina')
    await user.clear(card.getByLabelText('Mesto'))
    await user.type(card.getByLabelText('Mesto'), 'Zemun')
    await user.clear(card.getByLabelText('Opis tima'))
    await user.type(card.getByLabelText('Opis tima'), 'Moj opis.')
    await user.clear(card.getByLabelText('Link'))
    await user.type(card.getByLabelText('Link'), 'https://moj.example')

    await sendBehindHisBack('Dunavski klub', THE_NEW_WORDS)
    await user.click(card.getByRole('button', { name: 'Odobri' }))

    expect(await screen.findByText(THE_CHANGE_WAS_CHANGED)).toBeVisible()

    const heading = await screen.findByRole('heading', { name: 'Dunavski klub' })
    const now = within(must(heading.closest('li'), 'the card he reads now'))

    expect(screen.queryByRole('heading', { name: /Dunavska/i })).toBeNull()
    expect(now.getByLabelText('Naziv tima')).toHaveValue('Dunavski klub')
    expect(now.getByLabelText('Mesto')).toHaveValue(THE_NEW_WORDS.city)
    expect(now.getByLabelText('Opis tima')).toHaveValue(THE_NEW_WORDS.bio)
    expect(now.getByLabelText('Link')).toHaveValue(THE_NEW_WORDS.link)
  }, SLOW)

  it('names the new words as seen and as the team on the second press, when he corrects nothing after the 409', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await sendAChange(user, router, 'Dunavska družina')
    await router.navigate('/sr/administracija/verifikacija/timovi')

    const first = await screen.findByRole('heading', { name: 'Dunavska družina' })
    const card = within(must(first.closest('li'), 'the card of the first change'))

    await user.clear(card.getByLabelText('Naziv tima'))
    await user.type(card.getByLabelText('Naziv tima'), 'Dunavska Družina')
    await sendBehindHisBack('Dunavski klub', THE_NEW_WORDS)
    await user.click(card.getByRole('button', { name: 'Odobri' }))
    await screen.findByText(THE_CHANGE_WAS_CHANGED)

    const heading = await screen.findByRole('heading', { name: 'Dunavski klub' })

    await user.click(
      within(must(heading.closest('li'), 'the card he reads now')).getByRole('button', { name: 'Odobri' }),
    )
    await waitFor(() => {
      expect(decisionsSent()).toHaveLength(2)
    })

    const sent = JSON.parse(String(must(decisionsSent()[1], 'the second press').init?.body))

    expect(sent.seenTeam).toEqual({ name: 'Dunavski klub', city: THE_NEW_WORDS.city, country: 'RS', bio: THE_NEW_WORDS.bio, link: THE_NEW_WORDS.link })
    expect(sent.team).toEqual(sent.seenTeam)
    expect(await theTeamIsCalled()).toBe('Dunavski klub')
  }, SLOW)

  it('leaves the correction of another card of the same queue where it was when the 409 reads it again', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci/izmena', 'superadmin', '000001')

    await sendAChange(user, router, 'Dunavska družina')
    await router.navigate('/sr/administracija/verifikacija/timovi')

    const other = await screen.findByRole('heading', { name: 'Timočka trkačka družina' })
    const theirs = within(must(other.closest('li'), 'the card of another proposal'))

    await user.clear(theirs.getByLabelText('Mesto'))
    await user.type(theirs.getByLabelText('Mesto'), 'Bor')

    const first = screen.getByRole('heading', { name: 'Dunavska družina' })

    await sendBehindHisBack('Dunavski klub', THE_NEW_WORDS)
    await user.click(
      within(must(first.closest('li'), 'the card of the first change')).getByRole('button', {
        name: 'Odobri',
      }),
    )
    await screen.findByText(THE_CHANGE_WAS_CHANGED)
    await screen.findByRole('heading', { name: 'Dunavski klub' })

    const again = screen.getByRole('heading', { name: 'Timočka trkačka družina' })

    expect(
      within(must(again.closest('li'), 'the card of another proposal')).getByLabelText('Mesto'),
    ).toHaveValue('Bor')
  }, SLOW)

  it('cannot be approved once the team it names has been deleted', async () => {
    /* Approved anyway it wrote into an identity nothing answers to, settled the item,
       and told the member their team had been changed (review, 05.09.2026). The card
       says so instead, and the control that would take the decision is dead. */

    /* AND THE DELETION IN THE MIDDLE OF THIS WALK GOES THROUGH THE ROUTE SINCE 26.09.2026,
       because Dunav is a SERVED team and `admin/AdminTeams.tsx` sends
       `DELETE /api/teams/{id}` for one of those. Without an answer the request came back 404
       off the disc reader (whose pattern does not match an address with an id) and the team
       was never deleted at all, so the card had nothing to report. */
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
    await sayYes(user, 'Obriši tim?')

    /* THE DELETION IS REALLY THROUGH BEFORE THE WALK GOES ON, because it lands on the answer
       rather than on the press. Navigating away first would leave the rest of this case
       measuring a team that had not been deleted yet. */
    await waitFor(() => {
      expect(
        within(screen.getByRole('table', { name: 'Timovi' })).queryByText('Dunavski trkači'),
      ).toBeNull()
    })

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
    expect(await table.findAllByText('Dunavski trkači')).toHaveLength(1)
    expect(table.getByText('Sremski Karlovci')).toBeVisible()
    expect(table.queryByText('Novi Sad')).toBeNull()
  })
})
