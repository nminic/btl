import { render, screen, within } from '@testing-library/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ClockProvider } from '../../clock/ClockProvider'
import { I18nProvider } from '../../i18n/I18nProvider'
import { SessionProvider } from '../../session/SessionProvider'
import type { SessionValue } from '../../session/context'
import { useSession } from '../../session/useSession'
import type { Race } from '../../data/types'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { raceFor } from './raceFor'
import { ReportResult } from './ReportResult'

/* A result reported from the event it was run at (owner, 03.08.2026).
 *
 * The portal already had a form for this and it began by asking which event,
 * then the date, then the distance, the climb and the descent, all of which the
 * portal knows: they are on the race.
 */

const EVENT = 'maraton-maratona-2015-03-14'
const REPORT = `/sr/kalendar/${EVENT}/prijava`

describe('the way to report a result', () => {
  it('asks whoever is not signed in to sign in', async () => {
    renderAt(REPORT)

    expect(await screen.findByRole('heading', { name: /prijav/i })).toBeVisible()
    expect(screen.queryByLabelText(/^Trka/)).toBeNull()
  })

  it('opens on a race of that event and asks for nothing the portal knows', async () => {
    renderAt(REPORT, 'competitor', '000007')

    const race = await screen.findByLabelText(/^Trka/)

    /* Preselected, so an event of one race is a time and nothing else. */
    expect((race as HTMLSelectElement).value).not.toBe('')

    for (const asked of [/Sati/, /Minuta/, /Sekundi/, /Komentar/]) {
      expect(screen.getByLabelText(asked)).toBeVisible()
    }

    /* And none of the five the race already carries. */
    for (const known of [/Naziv događaja/, /Datum/, /Dužina/, /Uspon/, /Spust/]) {
      expect(screen.queryByLabelText(known)).toBeNull()
    }
  })

  it('offers only the races of the event it was opened from', async () => {
    renderAt(REPORT, 'competitor', '000007')

    const race = await screen.findByLabelText(/^Trka/)
    const offered = Array.from((race as HTMLSelectElement).options).length

    expect(offered).toBeGreaterThan(1)
    expect(offered).toBeLessThan(10)
  })
})

describe('an address that names no event', () => {
  it('says so rather than drawing a form against nothing', async () => {
    renderAt('/sr/kalendar/nepostoji/prijava', 'competitor', '000007')

    expect(await screen.findByRole('heading', { name: 'Ovog događaja nema.' })).toBeVisible()
  })
})

/**
 * Puts the session into a state before the screen under it is looked at.
 *
 * In an effect and not in the body. Calling it while rendering sets state on the
 * provider above during a child's render, which React reports as an error and
 * which happens to work; the screen under it waits for its data anyway, so an
 * effect is early enough.
 */
function Given({ act, children }: { act: (session: SessionValue) => void; children: ReactNode }) {
  const session = useSession()
  const done = useRef(false)

  useEffect(() => {
    if (!done.current) {
      done.current = true
      act(session)
    }
  }, [act, session])

  return <>{children}</>
}

describe('an event with no races on it', () => {
  it('says there is nothing to report rather than offering an empty choice', async () => {
    /* A form whose one choice is empty is a form that cannot be submitted and
       does not say why.
     *
       It is a real state and not a defensive one: an event exists before its
       races do. During the fortnight before registration opens the owner enters
       a weekend, opens it to check, and adds the distances after. Every event in
       the generated data already has a race, so the state is reached here by
       taking the one race away, which is the same thing from the other end and
       is what an organiser dropping a distance does. */
    render(
      <ClockProvider>
        <I18nProvider locale="sr">
          <MemoryRouter initialEntries={['/sr/kalendar/resolution-run-2027-12-27/prijava']}>
            <SessionProvider initialMemberNumber="000007">
              <Given act={(session) => session.remove('races', 'evt-resolution-run-2027-12-27-550')}>
                <Routes>
                  <Route path="/sr/kalendar/:slug/prijava" element={<ReportResult />} />
                </Routes>
              </Given>
            </SessionProvider>
          </MemoryRouter>
        </I18nProvider>
      </ClockProvider>,
    )

    expect(await screen.findByText(/nema nijednu trku/)).toBeVisible()
    expect(screen.queryByLabelText(/^Trka/)).toBeNull()
    /* And the way back is the event it came from. */
    expect(screen.getByRole('link', { name: 'Nazad na događaj' })).toBeVisible()
  })
})

describe('a result reported this way', () => {
  it('says how many points it earned and that it is waiting', async () => {
    const user = setupUser()
    renderAt(REPORT, 'competitor', '000007')

    await user.type(await screen.findByLabelText(/Sati/), '3')
    await user.type(screen.getByLabelText(/Minuta/), '41')
    await user.type(screen.getByLabelText(/Sekundi/), '12')
    await user.type(screen.getByLabelText(/Komentar/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

    expect(await screen.findByRole('heading', { name: 'Rezultat je poslat' })).toBeVisible()
    /* The one thing the member came to find out (PDL P9). */
    expect(screen.getByText(/BTL poena/)).toBeVisible()
    expect(screen.getByText(/Moderator je proverava/)).toBeVisible()
  })

  it('reaches the queue the moderator decides in, with the points already worked out', async () => {
    const user = setupUser()
    const { router } = renderAt(REPORT, 'superadmin', '000007')

    await user.type(await screen.findByLabelText(/Sati/), '3')
    await user.type(screen.getByLabelText(/Minuta/), '41')
    await user.type(screen.getByLabelText(/Sekundi/), '12')
    await user.type(screen.getByLabelText(/Komentar/), 'Startni broj 412')
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))
    await screen.findByRole('heading', { level: 1 })

    await router.navigate('/sr/administracija/verifikacija/rezultati')

    const table = await screen.findByRole('table', { name: 'Čeka proveru' })

    expect(table).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Odobri' }).length).toBeGreaterThan(0)

    /* What the member wrote, as words. The name of the event is not a link
       here, because this form asks for words and there is no address: an
       unchecked sentence in an `href` is an address made of that sentence. */
    expect(within(table).getByText('Startni broj 412')).toBeVisible()
    expect(within(table).queryByRole('link', { name: /Maraton maratona/ })).toBeNull()
  })

  it('scores a time of nothing at nothing, rather than falling over', async () => {
    /* The three boxes take a nought each, so a member can send in 0:00:00 by
       mistyping or by pressing through. The formula has no answer for a time of
       nothing and says so by returning nothing; the screen then has to say
       something, and nought points is the truthful thing to say. */
    const user = setupUser()
    renderAt(REPORT, 'competitor', '000007')

    await user.type(await screen.findByLabelText(/Sati/), '0')
    await user.type(screen.getByLabelText(/Minuta/), '0')
    await user.type(screen.getByLabelText(/Sekundi/), '0')
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

    expect(await screen.findByRole('heading', { name: 'Rezultat je poslat' })).toBeVisible()
    expect(screen.getByText(/0,00 BTL poena/)).toBeVisible()
  })

  it('refuses a time that was never typed', async () => {
    const user = setupUser()
    renderAt(REPORT, 'competitor', '000007')

    await screen.findByLabelText(/^Trka/)
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

    expect(screen.getAllByText('Ovo polje je obavezno.')).toHaveLength(3)
  })
})

describe('which race a reported result is scored against', () => {
  /* The choice is drawn from the event's own races and the field is required, so
     in the portal the second half never runs. It is here because a lookup that
     can miss has to say what it does when it does, and scoring against whichever
     race the form opened on is a decision rather than a shrug: the one thing
     worse than the wrong distance is a page that throws while somebody is
     sending in a result they have just run. */
  const race = (id: string): Race => ({
    id,
    eventId: 'e1',
    name: id,
    distanceKm: 10,
    ascentM: 0,
    descentM: 0,
    category: 'short',
  })

  const opened = race('a')
  const other = race('b')

  it('is the one that was chosen', () => {
    expect(raceFor([opened, other], 'b', opened)).toBe(other)
  })

  it('is the one the form opened on when the choice names no race it holds', () => {
    expect(raceFor([opened, other], 'nepostoji', opened)).toBe(opened)
    expect(raceFor([], 'a', opened)).toBe(opened)
  })
})
