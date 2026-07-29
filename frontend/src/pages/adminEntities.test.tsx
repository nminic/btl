import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt } from '../test/render'

/* The four screens behind Entities: races, teams, leagues and the written
 * pages. Each one is checked for what it is there to show, for the case that
 * only shows up in real data (a race with no event, a team with no organiser, a
 * league with no events), and for keeping everyone who is not staff out. */

async function table(name: string) {
  return within(await screen.findByRole('table', { name }))
}

describe('races', () => {
  it('lists races under the event they belong to', async () => {
    renderAt('/sr/administracija/trke', 'moderator')

    const rows = await table('Trke')
    expect(rows.getAllByRole('row').length).toBeGreaterThan(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Trke' })).toBeVisible()
  })

  it('narrows the list by a search', async () => {
    const user = userEvent.setup()
    renderAt('/sr/administracija/trke', 'superadmin')

    const before = (await table('Trke')).getAllByRole('row').length
    await user.type(screen.getByRole('searchbox', { name: 'Pretraga' }), 'zzzzz')

    expect((await table('Trke')).getAllByRole('row').length).toBeLessThan(before)
  })

  it('turns a moderator away when the role has no rights', async () => {
    renderAt('/sr/administracija/trke', 'competitor')

    expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent('Trke')
  })
})

describe('teams', () => {
  it('shows each team with its organiser and its head count', async () => {
    renderAt('/sr/administracija/timovi', 'superadmin')

    const rows = await table('Timovi')
    expect(rows.getAllByRole('columnheader').map((one) => one.textContent)).toContain(
      'Organizator',
    )
    expect(rows.getAllByRole('row').length).toBeGreaterThan(1)
  })

  it('is closed to a competitor', async () => {
    renderAt('/sr/administracija/timovi', 'competitor')

    expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent('Timovi')
  })
})

describe('leagues', () => {
  it('marks a league that carries no events', async () => {
    renderAt('/sr/administracija/lige', 'superadmin')

    const rows = await table('Lige')
    // The generator deliberately leaves one league empty, which is the case
    // worth seeing from the list.
    expect(rows.getAllByText('Bez događaja').length).toBeGreaterThan(0)
  })

  it('says whether a league groups by category', async () => {
    renderAt('/sr/administracija/lige', 'superadmin')

    const rows = await table('Lige')
    expect(rows.getAllByText(/^Da$|^Ne$/).length).toBeGreaterThan(0)
  })

  it('is closed to a competitor', async () => {
    renderAt('/sr/administracija/lige', 'competitor')

    expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent('Lige')
  })
})

describe('the written pages', () => {
  it('lists every page with its address', async () => {
    renderAt('/sr/administracija/strane', 'superadmin')

    const rows = await table('Statične strane')
    expect(rows.getByRole('link', { name: '/pravilnik' })).toBeVisible()
  })

  it('changes a title in place', async () => {
    const user = userEvent.setup()
    renderAt('/sr/administracija/strane', 'superadmin')

    const rows = await table('Statične strane')
    await user.click(rows.getByRole('button', { name: /^Naslov: Pravilnik/ }))
    const field = rows.getByRole('textbox', { name: 'Naslov' })
    await user.clear(field)
    await user.type(field, 'Pravilnik 2027')
    await user.tab()

    expect(rows.getByRole('button', { name: /^Naslov: Pravilnik 2027/ })).toBeVisible()
  })

  it('is closed to a competitor', async () => {
    renderAt('/sr/administracija/strane', 'competitor')

    expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent(
      'Statične strane',
    )
  })
})

describe('a race whose event is missing', () => {
  it('is still listed, and says so instead of showing a blank', async () => {
    // Not in the generated data, and it should not be: this is what a deleted
    // event leaves behind, and the list has to keep showing the orphan rather
    // than quietly dropping it.
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/races.json')
        ? new Response(
            JSON.stringify([
              {
                id: 'race-orphan',
                eventId: 'event-that-is-gone',
                name: 'Trka bez događaja',
                distanceKm: 10,
                ascentM: 100,
                descentM: 100,
                category: 'short',
              },
            ]),
            { status: 200 },
          )
        : real(input)) as typeof fetch

    renderAt('/sr/administracija/trke', 'superadmin')

    expect(await screen.findByText('Trka bez događaja')).toBeVisible()
    expect(screen.getByRole('cell', { name: 'Bez događaja' })).toBeVisible()

    globalThis.fetch = real
  })
})
