import { configure, screen, waitFor, within } from '@testing-library/react'
import { clearResourceCache } from '../../data/client'
import { renderAt } from '../../test/render'
import { did, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { must } from '../../test/at'
import { SLOW } from '../../test/slow'

/* Every wait is given half of what a case is given (`admin/saveWhileSaving.test.tsx`). */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * „DODAJ ČLANA” AND „IZBACI” ON THE ADMINISTRATION'S SCREEN OF TEAMS (PDL P13, „[ODLUKA 23.11.2026 ...]
 * Administracija dodaje i izbacuje članove tima direktno”).
 *
 * <p><b>The axes, and nothing is the only one of its kind:</b> the team acted on is served second of three
 * and keyed neither lowest nor highest, so an address built off the first or the last team is a different
 * address; it has two members, and another team has one, so „its members" is a filter that can fail; the box
 * offers the two members in no team and never one who is in a team; and every write is read off the
 * recording server, never off what the case typed.
 */
describe('members of a team moved by the administration', () => {
  const ACTED = 14

  const ITS_NAME = 'Savski tim'

  const TEAMS = [
    { id: 12, slug: 'vardarski-krug', name: 'Vardarski krug', city: 'Skoplje', country: 'MK', bio: '',
      logo: null, crop: null, smallLogo: null, organizerMemberNumber: '000003' },
    { id: ACTED, slug: 'savski-tim', name: ITS_NAME, city: 'Šabac', country: 'RS', bio: '',
      logo: null, crop: null, smallLogo: null, organizerMemberNumber: '000007' },
    { id: 9, slug: 'dunavski-trkaci', name: 'Dunavski trkači', city: 'Novi Sad', country: 'RS', bio: '',
      logo: null, crop: null, smallLogo: null, organizerMemberNumber: '' },
  ]

  const MEMBERS = [
    { memberNumber: '000002', firstName: 'Relja', lastName: 'Momčilović', teamId: ACTED },
    { memberNumber: '000007', firstName: 'Strahinja', lastName: 'Vukićević', teamId: ACTED },
    { memberNumber: '000003', firstName: 'Anđelija', lastName: 'Vukotić', teamId: 12 },
    { memberNumber: '000005', firstName: 'Časlav', lastName: 'Radenković', teamId: null },
    { memberNumber: '000008', firstName: 'Milica', lastName: 'Ranković', teamId: null },
  ]

  function listOf(what: unknown): Response {
    return new Response(JSON.stringify(what), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  function serving(toAWrite: (asked: string, init: RequestInit | undefined) => Response = did) {
    clearResourceCache()

    return serverThat((path, init) => {
      const how = init?.method ?? 'GET'

      if (how === 'GET' && path === '/api/teams') {
        return listOf(TEAMS)
      }

      if (how === 'GET' && path === '/api/competitors') {
        return listOf(MEMBERS)
      }

      return how === 'GET' ? null : toAWrite(path, init)
    })
  }

  function writes(asked: Asked[]): { path: string; how: string; body: unknown }[] {
    return asked
      .filter((one) => one.init?.method !== undefined && one.init.method !== 'GET')
      .map((one) => ({
        path: one.path,
        how: String(one.init?.method),
        body: typeof one.init?.body === 'string' ? JSON.parse(one.init.body) : null,
      }))
  }

  function reads(asked: Asked[], path: string): number {
    return asked.filter((one) => one.path === path && (one.init?.method ?? 'GET') === 'GET').length
  }

  /** Opens the members under the acted team's row, by the button its head count is. */
  async function openTheTeam(user: ReturnType<typeof setupUser>) {
    await user.click(await screen.findByRole('button', { name: `2 Članovi tima ${ITS_NAME}` }))

    return screen.getByRole('region', { name: `Članovi tima ${ITS_NAME}` })
  }

  const IN_WINDOW = '2026-11-25'

  /** The question „Izbaci” asks (PDL P13, [ODLUKE 23.11.2026], (3)), answered by its own words. */
  async function answer(user: ReturnType<typeof setupUser>, word: 'Da' | 'Ne') {
    const sheet = await screen.findByRole('dialog', { name: 'Izbaci člana iz tima?' })

    await user.click(within(sheet).getByRole('button', { name: word }))

    return sheet
  }

  it('draws the team\'s own members under its row, each with Izbaci, and offers only members in no team',
    async () => {
      const server = serving()
      const user = setupUser()
      renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

      const toggle = await screen.findByRole('button', { name: `2 Članovi tima ${ITS_NAME}` })

      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('region', { name: `Članovi tima ${ITS_NAME}` })).toBeNull()

      const panel = await openTheTeam(user)

      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(within(panel).getAllByRole('listitem').map((one) => one.textContent)).toEqual([
        'Relja Momčilović (000002)',
        'Strahinja Vukićević (000007)',
      ].map((one) => expect.stringContaining(one)))
      expect(within(panel).getByRole('button', { name: 'Izbaci iz tima: Relja Momčilović (000002)' }))
        .toBeVisible()

      await user.click(within(panel).getByRole('combobox', { name: 'Član koga dodaješ' }))

      expect(within(panel).getAllByRole('option').map((one) => one.textContent)).toEqual([
        'Časlav Radenković (000005)',
        'Milica Ranković (000008)',
      ])

      server.stop()
    }, SLOW)

  it('opens one team at a time, shuts it on a second press, and says a team with nobody is empty', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

    const acted = await screen.findByRole('button', { name: `2 Članovi tima ${ITS_NAME}` })
    const empty = screen.getByRole('button', { name: '0 Članovi tima Dunavski trkači' })

    await user.click(acted)
    await user.click(empty)

    expect(screen.queryByRole('region', { name: `Članovi tima ${ITS_NAME}` })).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Članovi tima Dunavski trkači' }))
      .getByText('U timu nema nikoga.')).toBeVisible()

    await user.click(empty)

    expect(empty).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Članovi tima Dunavski trkači' })).toBeNull()

    server.stop()
  }, SLOW)

  it('adds the member chosen to ITS OWN team by his number, and reads both lists again', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

    const panel = await openTheTeam(user)
    const before = reads(server.asked, '/api/competitors')

    await user.type(within(panel).getByRole('combobox', { name: 'Član koga dodaješ' }), 'Milica')
    await user.click(within(panel).getByRole('option', { name: 'Milica Ranković (000008)' }))
    await user.click(within(panel).getByRole('button', { name: 'Dodaj člana' }))

    await waitFor(() => {
      expect(writes(server.asked)).toEqual([
        { path: `/api/teams/${String(ACTED)}/members`, how: 'POST', body: { memberNumber: '000008' } },
      ])
    })
    await waitFor(() => {
      expect(reads(server.asked, '/api/competitors')).toBeGreaterThan(before)
    })
    expect(await screen.findByText('Član je dodat u tim.')).toBeInTheDocument()

    server.stop()
  }, SLOW)

  it('sends nothing for a name typed and not chosen, and says to choose', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

    const panel = await openTheTeam(user)

    await user.type(within(panel).getByRole('combobox', { name: 'Član koga dodaješ' }), 'Milica')
    await user.click(within(panel).getByRole('button', { name: 'Dodaj člana' }))

    expect(await within(panel).findByRole('alert')).toHaveTextContent('Izaberi člana sa spiska.')
    expect(writes(server.asked)).toEqual([])

    server.stop()
  }, SLOW)

  it('takes out the member pressed on, at his number under ITS OWN team', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

    const panel = await openTheTeam(user)

    await user.click(within(panel).getByRole('button', { name: 'Izbaci iz tima: Strahinja Vukićević (000007)' }))
    await answer(user, 'Da')

    await waitFor(() => {
      expect(writes(server.asked)).toEqual([
        { path: `/api/teams/${String(ACTED)}/members/000007`, how: 'DELETE', body: {} },
      ])
    })
    expect(await screen.findByText('Član je izveden iz tima.')).toBeInTheDocument()

    server.stop()
  }, SLOW)

  it.each([
    ['theSeasonIsNotPaid', 'Taj član nije platio članarinu za sezonu 2027.'],
    ['heIsAlreadyInATeam', 'Taj član je već u nekom timu.'],
    ['theWindowIsShut', 'Članovi se dodaju i izbacuju samo u prelaznom roku, od 21. novembra do 31. decembra.'],
    ['theMemberIsNotKnown', 'Portal ne poznaje tog člana.'],
  ])('says the route\'s %s in the panel\'s own sentence, and keeps what was chosen', async (reason, sentence) => {
    const server = serving(() => refused(reason, 409))
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

    const panel = await openTheTeam(user)
    const box = within(panel).getByRole('combobox', { name: 'Član koga dodaješ' })

    await user.type(box, 'Časlav')
    await user.click(within(panel).getByRole('option', { name: 'Časlav Radenković (000005)' }))
    await user.click(within(panel).getByRole('button', { name: 'Dodaj člana' }))

    expect(await within(panel).findByRole('alert')).toHaveTextContent(sentence)
    expect(box).toHaveValue('Časlav Radenković (000005)')

    server.stop()
  }, SLOW)

  it('says heIsNotInTheTeam when a member pressed on has already gone', async () => {
    const server = serving(() => refused('heIsNotInTheTeam', 409))
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

    const panel = await openTheTeam(user)

    await user.click(within(panel).getByRole('button', { name: 'Izbaci iz tima: Relja Momčilović (000002)' }))
    await answer(user, 'Da')

    expect(await within(panel).findByRole('alert')).toHaveTextContent('Taj član više nije u ovom timu.')
    must(writes(server.asked)[0], 'the write')

    server.stop()
  }, SLOW)

  it('asks before taking a member out, names him under the question, and sends nothing until Da', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

    const panel = await openTheTeam(user)

    await user.click(within(panel).getByRole('button', { name: 'Izbaci iz tima: Strahinja Vukićević (000007)' }))

    const sheet = await screen.findByRole('dialog', { name: 'Izbaci člana iz tima?' })

    expect(sheet).toHaveTextContent('Strahinja Vukićević (000007) izlazi iz tima Savski tim.')
    expect(writes(server.asked)).toEqual([])

    server.stop()
  }, SLOW)

  it('puts the question away on Ne, sends nothing, and the row is as it was', async () => {
    const server = serving()
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

    const panel = await openTheTeam(user)
    const out = within(panel).getByRole('button', { name: 'Izbaci iz tima: Strahinja Vukićević (000007)' })

    await user.click(out)
    await answer(user, 'Ne')

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Izbaci člana iz tima?' })).toBeNull()
    })
    expect(writes(server.asked)).toEqual([])
    expect(out).toBeVisible()
    expect(screen.queryByText('Član je izveden iz tima.')).toBeNull()

    server.stop()
  }, SLOW)

  it('sends one deletion for Da pressed twice while the first is out', async () => {
    let release: () => void = () => undefined
    const held = new Promise<void>((done) => {
      release = done
    })
    clearResourceCache()

    /* The write is held until the second press has been made, so the second press meets a request that is
       still out. */
    const holding = serverThat((path, init) => {
      const how = init?.method ?? 'GET'

      if (how === 'GET' && path === '/api/teams') {
        return listOf(TEAMS)
      }

      if (how === 'GET' && path === '/api/competitors') {
        return listOf(MEMBERS)
      }

      return how === 'GET' ? null : held.then(() => did())
    })
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin', null, undefined, IN_WINDOW)

    const panel = await openTheTeam(user)

    await user.click(within(panel).getByRole('button', { name: 'Izbaci iz tima: Strahinja Vukićević (000007)' }))

    const sheet = await answer(user, 'Da')

    await user.click(within(sheet).getByRole('button', { name: 'Da' }))
    release()

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Izbaci člana iz tima?' })).toBeNull()
    })
    expect(writes(holding.asked).filter((one) => one.how === 'DELETE')).toHaveLength(1)

    holding.stop()
  }, SLOW)
})
