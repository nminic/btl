import { screen, waitFor, within } from '@testing-library/react'
import { clearResourceCache } from '../../data/client'
import type { Moderator } from '../../data/types'
import { renderAt } from '../../test/render'
import { answeredWith, did, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { at, must } from '../../test/at'
import { SLOW } from '../../test/slow'
import { RIGHTS } from './rights'

/**
 * THE SCREEN OF MODERATORS WRITES TO THE SERVER, SINCE B106 (PDL P28c point 2).
 *
 * **NOTHING IN THE FIXTURE IS THE ONLY ONE OF ITS KIND, AND THE AXES ARE COUNTED**, the
 * way `adminLeagues.test.tsx` counts its own:
 *
 * - **Served out of order on purpose**, neither by name nor by id, so a screen that
 *   quietly sorted its own copy would pass this fixture and fail the next one that
 *   happened to arrive already alphabetical.
 * - **One moderator holds TWO different rights, from the two different groups**
 *   (`entity:events` and `queue:payments`). A version of this screen that kept only the
 *   one box that was pressed would satisfy a fixture with a single right and drop the
 *   other the first time either was touched.
 * - **A third moderator, holding a right of his own, stands beside the first two** so a
 *   row disabled while its own request is out can be told apart from a row that never
 *   held anything up.
 *
 * Nothing is read out of what was typed or ticked. Every assertion about a write reads
 * the request the screen really made, off the recording server.
 */
describe('the moderators screen', () => {
  const TWO_RIGHTS = 40

  const ONE_RIGHT = 27

  const NO_RIGHTS = 12

  const MODERATORS: Moderator[] = [
    {
      id: TWO_RIGHTS,
      firstName: 'Zoran',
      lastName: 'Vuković',
      email: 'zoran.vukovic@primer.rs',
      rights: ['entity:events', 'queue:payments'],
    },
    {
      id: NO_RIGHTS,
      firstName: 'Ana',
      lastName: 'Jovanović',
      email: 'ana.jovanovic@primer.rs',
      rights: [],
    },
    {
      id: ONE_RIGHT,
      firstName: 'Marko',
      lastName: 'Petrović',
      email: 'marko.petrovic@primer.rs',
      rights: ['entity:teams'],
    },
  ]

  /** The four served above, with whatever a case wants said about a write. Everything
   *  else goes on to the disc. */
  function serving(
    toAWrite: (asked: string, init: RequestInit | undefined) => Response | Promise<Response> = did,
  ) {
    clearResourceCache()

    return serverThat((path, init) => {
      const how = init?.method ?? 'GET'

      if (path === '/api/moderators' && how === 'GET') {
        return new Response(JSON.stringify(MODERATORS), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      return how === 'GET' ? null : toAWrite(path, init)
    })
  }

  /** What was written, and to where: the recording server's own account of it. */
  function writes(asked: Asked[]): { path: string; how: string; body: unknown }[] {
    return asked
      .filter((one) => one.init?.method !== undefined && one.init.method !== 'GET')
      .map((one) => ({
        path: one.path,
        how: String(one.init?.method),
        body: typeof one.init?.body === 'string' ? JSON.parse(one.init.body) : null,
      }))
  }

  /** Every right this screen believes a named moderator holds, in `RIGHTS`' own order -
   *  built the way `toggleRight` builds the body of a `PUT`, so a test does not guess at
   *  an order the production code never promised. */
  function rightsOf(...keys: string[]): string[] {
    return RIGHTS.map((one) => one.key).filter((key) => keys.includes(key))
  }

  async function openMatrix() {
    return within(await screen.findByRole('table', { name: 'Prava moderatora' }))
  }

  /**
   * Presses Delete on a named moderator, both times, which is what the row asks for.
   *
   * Found by the button's own accessible name and not by the row's `textContent`: the
   * first name and the last name are two cells, so the row's text runs them together
   * with no space between - `ZoranVuković` - while `name` is built as a JavaScript
   * string with one (`AdminModerators.tsx`). Only the button's label is spelled the way
   * a reader would type it.
   */
  async function deleteNamed(user: ReturnType<typeof setupUser>, name: string) {
    const button = await screen.findByRole('button', { name: `Obriši: ${name}` })
    const row = must(button.closest('tr'), `the row of ${name}`)

    await user.click(button)
    await user.click(within(row).getByRole('button', { name: `Potvrdi brisanje: ${name}` }))

    return row
  }

  it('draws the served rows in the order the server sent them, not its own', async () => {
    const server = serving()

    renderAt('/sr/administracija/moderatori', 'superadmin')

    const rows = within(await screen.findByRole('table', { name: 'Moderatori' })).getAllByRole(
      'row',
    )

    /* Zoran first, Ana second, Marko third - alphabetical by neither name nor id
       (40, 12, 27). A screen sorting its own copy would draw Ana first. Row 0 is the
       header. */
    expect(at(rows, 1)).toHaveTextContent('Zoran')
    expect(at(rows, 2)).toHaveTextContent('Ana')
    expect(at(rows, 3)).toHaveTextContent('Marko')

    server.stop()
  }, SLOW)

  it('has nothing to open on an existing row: there is no route to write a name or address to',
    async () => {
      const server = serving()

      renderAt('/sr/administracija/moderatori', 'superadmin')

      const rows = within(await screen.findByRole('table', { name: 'Moderatori' }))

      await rows.findByText('zoran.vukovic@primer.rs')
      expect(rows.queryByRole('button', { name: /^Otvori/ })).not.toBeInTheDocument()
      expect(rows.getByRole('button', { name: 'Obriši: Zoran Vuković' })).toBeVisible()

      server.stop()
    }, SLOW)

  it('sends a new one to POST /api/moderators with the three typed fields', async () => {
    const server = serving(() =>
      new Response(JSON.stringify({ id: 501, email: 'novi.moderator@primer.rs' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const user = setupUser()

    renderAt('/sr/administracija/moderatori', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Nov moderator' }))
    await user.type(screen.getByLabelText(/^Ime/), 'Novi')
    await user.type(screen.getByLabelText(/^Prezime/), 'Moderator')
    /* Typed in a case the server will fold, so the row drawn afterwards can be checked
       against what the ANSWER carries and never against what was typed. */
    await user.type(screen.getByLabelText(/^Adresa elektronske pošte/), 'NOVI.MODERATOR@PRIMER.RS')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    await screen.findByRole('status', { name: 'Sačuvano' })

    expect(writes(server.asked)).toEqual([
      {
        path: '/api/moderators',
        how: 'POST',
        body: { firstName: 'Novi', lastName: 'Moderator', email: 'NOVI.MODERATOR@PRIMER.RS' },
      },
    ])

    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const listed = within(await screen.findByRole('table', { name: 'Moderatori' }))

    /* The row's own spelling, read back off the answer - not the upper case typed in. */
    expect(listed.getByText('novi.moderator@primer.rs')).toBeVisible()
    expect(listed.getByText('zoran.vukovic@primer.rs')).toBeVisible()

    server.stop()
  }, SLOW)

  it('shows the typed address where the answer names none, and never blanks it', async () => {
    /* `Made` always carries an email in practice - this is the defensive half of
       `emailIn`, read the way `identityIn`'s own „no usable id" branch is: a body that
       does not carry the field is answered with what was typed rather than with
       nothing. */
    const server = serving(() =>
      new Response(JSON.stringify({ id: 502 }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const user = setupUser()

    renderAt('/sr/administracija/moderatori', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Nov moderator' }))
    await user.type(screen.getByLabelText(/^Ime/), 'Nova')
    await user.type(screen.getByLabelText(/^Prezime/), 'Moderatorka')
    await user.type(screen.getByLabelText(/^Adresa elektronske pošte/), 'nova@primer.rs')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const listed = within(await screen.findByRole('table', { name: 'Moderatori' }))

    expect(listed.getByText('nova@primer.rs')).toBeVisible()

    server.stop()
  }, SLOW)

  it('says so, and draws no row, where a 201 carries no identity to draw one under',
    async () => {
      const server = serving(() => answeredWith(201))
      const user = setupUser()

      renderAt('/sr/administracija/moderatori', 'superadmin')

      await user.click(await screen.findByRole('button', { name: 'Nov moderator' }))
      await user.type(screen.getByLabelText(/^Ime/), 'Novi')
      await user.type(screen.getByLabelText(/^Prezime/), 'Moderator')
      await user.type(screen.getByLabelText(/^Adresa elektronske pošte/), 'novi@primer.rs')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/Osveži stranu/)
      expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()

      server.stop()
    }, SLOW)

  it('says a taken address is taken, and it is the ROUTE that says so and not the screen',
    async () => {
      const server = serving(() => refused('theAddressIsTaken', 409))
      const user = setupUser()

      renderAt('/sr/administracija/moderatori', 'superadmin')

      await user.click(await screen.findByRole('button', { name: 'Nov moderator' }))
      await user.type(screen.getByLabelText(/^Ime/), 'Zoran')
      await user.type(screen.getByLabelText(/^Prezime/), 'Vuković')
      await user.type(screen.getByLabelText(/^Adresa elektronske pošte/), 'zoran.vukovic@primer.rs')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(writes(server.asked).map((one) => one.how)).toEqual(['POST'])
      expect(await screen.findByRole('alert')).toHaveTextContent('Na toj adresi već postoji nalog.')
      /* What was typed is still there, so the reader corrects one field instead of three. */
      expect(screen.getByLabelText(/^Ime/)).toHaveValue('Zoran')

      server.stop()
    }, SLOW)

  it('sends a deletion to DELETE on its own address and takes that row away', async () => {
    const server = serving()
    const user = setupUser()

    renderAt('/sr/administracija/moderatori', 'superadmin')

    await deleteNamed(user, 'Zoran Vuković')

    expect(writes(server.asked)).toEqual([
      { path: `/api/moderators/${TWO_RIGHTS}`, how: 'DELETE', body: {} },
    ])

    const listed = within(await screen.findByRole('table', { name: 'Moderatori' }))

    expect(listed.queryByText('Zoran')).toBeNull()
    /* And nobody else went with it. Deleting by the wrong key takes a neighbour. */
    expect(listed.getByText('Ana')).toBeVisible()
    expect(listed.getByText('Marko')).toBeVisible()

    /* Said once and politely, for whoever is not watching the list - the focus has
       already moved to „Nov moderator". */
    expect(await screen.findByText('Moderator je obrisan.')).toBeInTheDocument()

    server.stop()
  }, SLOW)

  it('keeps the row and says why where the route refused the deletion', async () => {
    const server = serving(() => answeredWith(404))
    const user = setupUser()

    renderAt('/sr/administracija/moderatori', 'superadmin')

    await deleteNamed(user, 'Zoran Vuković')

    const listed = within(await screen.findByRole('table', { name: 'Moderatori' }))

    expect(listed.getByText('Zoran')).toBeVisible()
    expect(await screen.findByRole('alert')).toHaveTextContent('404')

    server.stop()
  }, SLOW)

  it('deletes one made this very visit at the id the DATABASE handed out, never a session one',
    async () => {
      const server = serving((_asked, init) =>
        init?.method === 'POST'
          ? new Response(JSON.stringify({ id: 501, email: 'novi@primer.rs' }), {
              status: 201,
              headers: { 'content-type': 'application/json' },
            })
          : did(),
      )
      const user = setupUser()

      renderAt('/sr/administracija/moderatori', 'superadmin')

      await user.click(await screen.findByRole('button', { name: 'Nov moderator' }))
      await user.type(screen.getByLabelText(/^Ime/), 'Novi')
      await user.type(screen.getByLabelText(/^Prezime/), 'Moderator')
      await user.type(screen.getByLabelText(/^Adresa elektronske pošte/), 'novi@primer.rs')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await screen.findByRole('status', { name: 'Sačuvano' })
      await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

      await deleteNamed(user, 'Novi Moderator')

      expect(writes(server.asked).map((one) => `${one.how} ${one.path}`)).toEqual([
        'POST /api/moderators',
        'DELETE /api/moderators/501',
      ])

      const listed = within(await screen.findByRole('table', { name: 'Moderatori' }))

      expect(listed.queryByText('novi@primer.rs')).toBeNull()
      expect(listed.getByText('zoran.vukovic@primer.rs')).toBeVisible()

      server.stop()
    }, SLOW)

  it('sends the whole row on a tick, keeping the right that was not pressed', async () => {
    /* `Ticked.rights` is read back rather than trusted, so the box only ticks once the
       route answers with a body this screen can parse - `did()` (204, no body) is right
       for a DELETE and wrong here. */
    const server = serving((_path, init) =>
      init?.method === 'PUT'
        ? new Response(
            JSON.stringify({
              id: TWO_RIGHTS,
              rights: rightsOf('entity:events', 'queue:payments', 'entity:teams'),
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        : did(),
    )
    const user = setupUser()

    renderAt('/sr/administracija/moderatori', 'superadmin')

    const matrix = await openMatrix()
    const teamsBox = matrix.getByRole('checkbox', { name: 'Zoran Vuković, uređivanje timova' })

    await user.click(teamsBox)
    await waitFor(() => expect(teamsBox).toBeChecked())

    expect(writes(server.asked)).toEqual([
      {
        path: `/api/moderators/${TWO_RIGHTS}`,
        how: 'PUT',
        body: { rights: rightsOf('entity:events', 'queue:payments', 'entity:teams') },
      },
    ])

    server.stop()
  }, SLOW)

  it('sends the remaining right on an untick, and never an empty list while one stands',
    async () => {
      const server = serving((_path, init) =>
        init?.method === 'PUT'
          ? new Response(
              JSON.stringify({ id: TWO_RIGHTS, rights: rightsOf('queue:payments') }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
          : did(),
      )
      const user = setupUser()

      renderAt('/sr/administracija/moderatori', 'superadmin')

      const matrix = await openMatrix()
      const eventsBox = matrix.getByRole('checkbox', { name: 'Zoran Vuković, uređivanje događaja' })

      await user.click(eventsBox)
      await waitFor(() => expect(eventsBox).not.toBeChecked())

      expect(writes(server.asked)).toEqual([
        {
          path: `/api/moderators/${TWO_RIGHTS}`,
          how: 'PUT',
          body: { rights: rightsOf('queue:payments') },
        },
      ])

      server.stop()
    }, SLOW)

  it('says why a tick did not save, beside that moderator, and leaves the box as it was',
    async () => {
      const server = serving(() => refused('aRightTheMatrixDoesNotHold'))
      const user = setupUser()

      renderAt('/sr/administracija/moderatori', 'superadmin')

      const matrix = await openMatrix()
      const teamsBox = matrix.getByRole('checkbox', { name: 'Zoran Vuković, uređivanje timova' })

      await user.click(teamsBox)

      expect(await screen.findByRole('alert')).toHaveTextContent('Portal ne poznaje to pravo.')
      expect(teamsBox).not.toBeChecked()

      server.stop()
    }, SLOW)

  it('says a tick saved but cannot be shown, where the answer names no usable rights',
    async () => {
      const server = serving(() => answeredWith(200))
      const user = setupUser()

      renderAt('/sr/administracija/moderatori', 'superadmin')

      const matrix = await openMatrix()
      const teamsBox = matrix.getByRole('checkbox', { name: 'Zoran Vuković, uređivanje timova' })

      await user.click(teamsBox)

      expect(await screen.findByRole('alert')).toHaveTextContent(/Osveži stranu/)
      /* Not believed on the strength of the click alone: a body this screen cannot
         read is not a confirmed set, so the box stays where it was. */
      expect(teamsBox).not.toBeChecked()

      server.stop()
    }, SLOW)

  it('holds every box of a row still while its own request is out, and leaves others free',
    async () => {
      let settle = (): void => {}
      const held = new Promise<Response>((resolve) => {
        settle = () =>
          resolve(
            new Response(JSON.stringify({ id: TWO_RIGHTS, rights: ['queue:payments'] }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          )
      })
      const server = serving(() => held)
      const user = setupUser()

      renderAt('/sr/administracija/moderatori', 'superadmin')

      const matrix = await openMatrix()
      const eventsBox = matrix.getByRole('checkbox', { name: 'Zoran Vuković, uređivanje događaja' })
      const paymentsBox = matrix.getByRole('checkbox', {
        name: 'Zoran Vuković, odlučivanje o uplatama',
      })
      const otherRowBox = matrix.getByRole('checkbox', { name: 'Marko Petrović, uređivanje timova' })

      await user.click(eventsBox)

      expect(eventsBox).toBeDisabled()
      expect(paymentsBox).toBeDisabled()
      expect(otherRowBox).not.toBeDisabled()

      settle()
      await waitFor(() => expect(eventsBox).not.toBeDisabled())

      server.stop()
    }, SLOW)

  describe('what this visit wrote, once the screen is left and returned to', () => {
    /** The moderators above, remembered and changed by a write - the same shape
     *  `adminLeagues.test.tsx`'s own `servingWithMemory` keeps, over moderators. */
    function servingWithMemory() {
      clearResourceCache()

      const remembered = MODERATORS.map((one) => ({ ...one, rights: [...one.rights] }))

      return serverThat((path, init) => {
        const how = init?.method ?? 'GET'
        const changed = /^\/api\/moderators\/(\d+)$/.exec(path)
        const sent: Record<string, unknown> =
          typeof init?.body === 'string' ? JSON.parse(init.body) : {}

        if (path === '/api/moderators' && how === 'GET') {
          return new Response(JSON.stringify(remembered), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }

        if (path === '/api/moderators' && how === 'POST') {
          const id = 501

          remembered.push({
            id,
            firstName: String(sent.firstName),
            lastName: String(sent.lastName),
            email: String(sent.email).toLowerCase(),
            rights: [],
          })

          return new Response(
            JSON.stringify({ id, email: String(sent.email).toLowerCase() }),
            { status: 201, headers: { 'content-type': 'application/json' } },
          )
        }

        if (changed !== null && how === 'PUT') {
          const pos = remembered.findIndex((one) => one.id === Number(changed[1]))
          /* Looked at rather than claimed (ADL A14): `sent.rights` is `unknown`, and
             `.map(String)` reads whatever is there without asserting it was already a
             `string[]`. */
          const rights = Array.isArray(sent.rights) ? sent.rights.map(String) : []

          if (pos !== -1) {
            remembered[pos] = { ...at(remembered, pos), rights }
          }

          return new Response(JSON.stringify({ id: Number(changed[1]), rights }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }

        if (changed !== null && how === 'DELETE') {
          const pos = remembered.findIndex((one) => one.id === Number(changed[1]))

          if (pos !== -1) {
            remembered.splice(pos, 1)
          }

          return did()
        }

        return how === 'GET' ? null : did()
      })
    }

    /** Away to another screen and back, with the other screen really drawn in between -
     *  the same wait `adminLeagues.test.tsx` measured was missing until it was written
     *  down (25.09.2026): two navigations with nothing between them do not unmount
     *  anything. */
    async function awayAndBack(router: ReturnType<typeof renderAt>['router']) {
      await router.navigate('/sr/administracija/timovi')
      await screen.findByRole('table', { name: 'Timovi' })
      await router.navigate('/sr/administracija/moderatori')
    }

    it('keeps a moderator made this visit after the screen is left and returned to',
      async () => {
        const server = servingWithMemory()
        const user = setupUser()
        const { router } = renderAt('/sr/administracija/moderatori', 'superadmin')

        await user.click(await screen.findByRole('button', { name: 'Nov moderator' }))
        await user.type(screen.getByLabelText(/^Ime/), 'Novi')
        await user.type(screen.getByLabelText(/^Prezime/), 'Moderator')
        await user.type(screen.getByLabelText(/^Adresa elektronske pošte/), 'novi@primer.rs')
        await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
        await screen.findByRole('status', { name: 'Sačuvano' })
        await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

        await awayAndBack(router)

        const listed = within(await screen.findByRole('table', { name: 'Moderatori' }))

        expect(listed.getByText('novi@primer.rs')).toBeVisible()

        server.stop()
      }, SLOW)

    it('keeps a tick after the screen is left and returned to', async () => {
      const server = servingWithMemory()
      const user = setupUser()
      const { router } = renderAt('/sr/administracija/moderatori', 'superadmin')

      const matrix = await openMatrix()
      const teamsBox = matrix.getByRole('checkbox', { name: 'Zoran Vuković, uređivanje timova' })

      await user.click(teamsBox)
      await waitFor(() => expect(teamsBox).toBeChecked())

      await awayAndBack(router)

      const again = await openMatrix()

      expect(
        again.getByRole('checkbox', { name: 'Zoran Vuković, uređivanje timova' }),
      ).toBeChecked()
      /* And what was not pressed is exactly as it was, read off the server and not
         off a guess. */
      expect(
        again.getByRole('checkbox', { name: 'Zoran Vuković, uređivanje događaja' }),
      ).toBeChecked()

      server.stop()
    }, SLOW)

    it('does not bring a deleted moderator back after the screen is left and returned to',
      async () => {
        const server = servingWithMemory()
        const user = setupUser()
        const { router } = renderAt('/sr/administracija/moderatori', 'superadmin')

        await deleteNamed(user, 'Zoran Vuković')

        await awayAndBack(router)

        const listed = within(await screen.findByRole('table', { name: 'Moderatori' }))

        expect(listed.queryByText('Zoran')).toBeNull()
        expect(listed.getByText('Ana')).toBeVisible()

        server.stop()
      }, SLOW)
  })
})
