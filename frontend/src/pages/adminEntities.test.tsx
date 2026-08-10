import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ClockProvider } from '../clock/ClockProvider'
import { I18nProvider } from '../i18n/I18nProvider'
import { RoleProvider } from '../roles/RoleProvider'
import { SessionProvider } from '../session/SessionProvider'
import { useSession } from '../session/useSession'
import { AdminEvents } from './admin/AdminEvents'
import { at, must } from '../test/at'
import { loadResource } from '../data/client'
import { formatShortDate } from '../i18n/format'
import type { BtlEvent, Race } from '../data/types'
import { expectFrontPage, renderAt } from '../test/render'
import { setupUser } from '../test/user'

/* The screens behind Podaci: the races inside their event, the teams, the
 * leagues and the written pages. Each is checked for what it is there to show,
 * for the case that only shows up in real data (a team with no organiser, a
 * league with no events), and for keeping everyone who is not staff out. */

async function table(name: string) {
  return within(await screen.findByRole('table', { name }))
}

describe('the races of an event', () => {
  /* A race is one length of one morning and is edited inside the event it is run
     at (owner, 06.08.2026). It had a screen of its own, where finding the event
     meant searching a list of eleven hundred, and a race made there could be
     saved against the wrong one. */
  async function openFirstEvent() {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const rows = await table('Događaji')
    const first = at(rows.getAllByRole('row'), 1)

    await user.click(within(first).getByRole('button', { name: /^Otvori/ }))

    return user
  }

  it('lists them under the event, and asks nobody which event it is', async () => {
    await openFirstEvent()

    expect(await screen.findByRole('heading', { name: /^Trke na događaju/ })).toBeVisible()
    /* The screen has already answered that, and a question whose answer is on
       the page above it is a question with a wrong answer available. */
    expect(screen.queryByLabelText('Događaj')).toBeNull()
  })

  it('has no screen of its own any more', async () => {
    renderAt('/sr/administracija/trke', 'superadmin')

    await expectFrontPage()
  })

  it('attaches a race entered there to that event and to no other', async () => {
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    const named = must(
      screen.getByRole('heading', { name: /^Trke na događaju/ }).textContent,
      'the name of the event the races belong to',
    ).replace('Trke na događaju ', '')

    await user.click(screen.getByRole('button', { name: 'Nova trka' }))
    await user.type(screen.getByLabelText(/^Naziv trke/), 'Probna trka')
    await user.type(screen.getByLabelText(/^Dužina/), '10')
    await user.type(screen.getByLabelText(/^Uspon/), '0')
    await user.type(screen.getByLabelText(/^Spust/), '0')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    /* The confirmation says what was written down, the event among it, because
       the event is written on the record without being asked for. Found by its
       own heading: a form carries live regions of its own while it is being
       filled in. */
    const said = await screen.findByRole('status', { name: 'Sačuvano' })

    expect(said).toHaveTextContent('Probna trka')
    expect(said).toHaveTextContent(named)
  })

  it('says so where an event has none yet', async () => {
    /* The ordinary state of an event entered a fortnight before its distances
       are known, not a fault. Entered here rather than looked for, because every
       generated event has races: an event with none is exactly what somebody
       makes on this screen. */
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
    await user.type(screen.getByLabelText(/^Naziv događaja/), 'Trka bez trka')
    await user.type(screen.getByLabelText(/^Datum/), '01062027')
    await user.type(screen.getByLabelText(/^Mesto/), 'Niš')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.type(screen.getByLabelText(/^Organizator/), 'BTL')
    await user.selectOptions(screen.getByLabelText(/^Stanje/), 'confirmed')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const rows = await table('Događaji')
    const made = must(
      rows
        .getAllByRole('row')
        .slice(1)
        .find((row) => (row.textContent ?? '').includes('Trka bez trka')),
      'the event that was just entered',
    )

    await user.click(within(made).getByRole('button', { name: /^Otvori:/ }))

    expect(await screen.findByText('Ovaj događaj još nema nijednu trku.')).toBeVisible()
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
    const user = setupUser()
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

/** What the session has been told to remove, drawn beside the screen that tells
 *  it. The only way to see a race that is no longer anywhere: nothing on the
 *  portal draws a race outside its event, which is the whole reason the deletion
 *  has to carry them. */
function Removed() {
  const { deletions } = useSession()

  return <span data-testid="removed">{(deletions.races ?? []).join(',')}</span>
}

describe('an event that is deleted', () => {
  it('takes its races with it, since nothing shows a race outside its event', async () => {
    /* This is what used to leave an orphan: the race screen kept showing a race
       whose event was gone, because it was the one place a race could be seen at
       all. There is no such place now (owner, 06.08.2026), so a race left behind
       would be a record nobody can reach.

       Read off the session and not off a screen. The row goes whether or not the
       cascade runs, so the list of events proved nothing; and a record entered
       again under the same name is handed a new identity (entityForms.ts,
       `idFor`), so the races could not be made to reappear under it either. */
    const user = setupUser()
    const events = await loadResource<BtlEvent[]>('events')
    const races = await loadResource<Race[]>('races')
    const one = must(
      events.find(
        (each) => each.date > '2027-01-01' && races.some((race) => race.eventId === each.id),
      ),
      'an event ahead of us that has races',
    )
    const its = races.filter((race) => race.eventId === one.id).map((race) => race.id)

    expect(its.length).toBeGreaterThan(0)

    render(
      <ClockProvider>
        <I18nProvider locale="sr">
          <MemoryRouter initialEntries={['/sr/administracija/dogadjaji']}>
            <RoleProvider initialRole="superadmin" initialModerator={null}>
              <SessionProvider>
                <Removed />
                <Routes>
                  <Route path="/sr/administracija/dogadjaji" element={<AdminEvents />} />
                </Routes>
              </SessionProvider>
            </RoleProvider>
          </MemoryRouter>
        </I18nProvider>
      </ClockProvider>,
    )

    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), one.name)

    /* By the name and the day both: the same race is run every year, so eight
       rows carry that name and only one of them is this morning. */
    const shown = formatShortDate(one.date, 'sr-Latn')
    const row = must(
      (await table('Događaji'))
        .getAllByRole('row')
        .slice(1)
        .find(
          (each) =>
            (each.textContent ?? '').includes(one.name) &&
            (each.textContent ?? '').includes(shown),
        ),
      'that event in the list',
    )

    await user.click(within(row).getByRole('button', { name: `Obriši: ${one.name}` }))
    await user.click(within(row).getByRole('button', { name: `Potvrdi brisanje: ${one.name}` }))

    const removed = (screen.getByTestId('removed').textContent ?? '').split(',')

    for (const race of its) {
      expect(removed, `${race} went with its event`).toContain(race)
    }
  })
})
