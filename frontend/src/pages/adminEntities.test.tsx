import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ClockProvider } from '../clock/ClockProvider'
import { I18nProvider } from '../i18n/I18nProvider'
import { RoleProvider } from '../roles/RoleProvider'
import { SessionProvider } from '../session/SessionProvider'
import { useSession } from '../session/useSession'
import { AdminEvents } from './admin/AdminEvents'
import { at, must } from '../test/at'
import { Saved } from '../test/saved'
import { loadResource } from '../data/client'
import { eventSlug } from './admin/entityForms'
import { formatNumber, formatShortDate } from '../i18n/format'
import type { BtlEvent, Race, Result } from '../data/types'
import { expectFrontPage, renderAt } from '../test/render'
import { setupUser, type Pressing } from '../test/user'

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

  it('says that opening a race puts the event form away', async () => {
    /* The form is unmounted while a race is open, so what was typed into it and
       not saved is gone. Said before the button rather than discovered after
       it. */
    await openFirstEvent()

    expect(
      await screen.findByText(/Dok se trka uređuje, forma događaja se sklanja/),
    ).toBeVisible()
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

    /* And it is on the event, not merely named beside it. The confirmation reads
       the words for the event off `shownKey`, which is a different thing from the
       `value` written onto the record; the table of races is filtered by that
       value, so this is the half that holds the attachment (entityForms.ts,
       `racesOf`). */
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const races = within(
      await screen.findByRole('table', { name: `Trke na događaju ${named}` }),
    )

    expect(races.getByText('Probna trka')).toBeVisible()
  })

  it('gives a race its own day, starting on the day of its event', async () => {
    /* One event may run over more than one morning: two races on the Saturday
       and one on the Sunday are one event with three races (owner, 10.08.2026).
       The day of the event is the day it begins, and a race entered under it
       starts on that day, because that is the right answer nine times in ten. */
    const user = await openFirstEvent()

    await screen.findByRole('heading', { name: /^Trke na događaju/ })
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))

    /* Whatever the day of the event on the screen is: the list opens on what is
       still ahead, so which event is first depends on the day the tests run. */
    const day = screen.getByLabelText(/^Dan trke/)
    const startsOn = must(
      /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String((day as HTMLInputElement).value)),
      'the day the form opened on',
    )

    await user.type(screen.getByLabelText(/^Naziv trke/), 'Nedeljna desetka')
    await user.clear(day)
    await user.type(day, `${String(Number(startsOn[1]) + 1).padStart(2, '0')}${startsOn[2]}${startsOn[3]}`)
    await user.type(screen.getByLabelText(/^Dužina/), '10')
    await user.type(screen.getByLabelText(/^Uspon/), '0')
    await user.type(screen.getByLabelText(/^Spust/), '0')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const races = within(await screen.findByRole('table', { name: /^Trke na događaju/ }))
    const row = within(must(races.getByText('Nedeljna desetka').closest('tr'), 'the new race'))

    expect(
      row.getByText(`${Number(startsOn[1]) + 1}. ${Number(startsOn[2])}. ${startsOn[3]}.`),
    ).toBeVisible()
  })

  it('takes the day of its first race, when a race is entered before it', async () => {
    /* Owner, 10.08.2026: the event's date is the day it begins, and that is the
       day of its first race. So a race entered on an earlier day is not a race
       before its event; it is the event starting earlier. */
    const user = setupUser()

    const { router } = renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const open2027 = async () => {
      const search = await screen.findByLabelText(/Pretraga/)

      await user.clear(search)
      await user.type(search, 'Beogradski maraton')

      return must(
        within(await screen.findByRole('table', { name: 'Događaji' }))
          .getAllByRole('row')
          .find(
            (one) =>
              /Beogradski maraton/.test(one.textContent ?? '') &&
              /2027/.test(one.textContent ?? ''),
          ),
        'the event of 2027',
      )
    }

    await user.click(within(await open2027()).getByRole('button', { name: /^Otvori/ }))
    await user.click(await screen.findByRole('button', { name: 'Nova trka' }))

    /* The day before the one the form opened on, which is the event's own. */
    const day = screen.getByLabelText(/^Dan trke/)
    const was = must(
      /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String((day as HTMLInputElement).value)),
      'the day the form opened on',
    )

    await user.type(screen.getByLabelText(/^Naziv trke/), 'Petak, kratka trka')
    await user.clear(day)
    await user.type(
      day,
      `${String(Number(was[1]) - 1).padStart(2, '0')}${was[2]}${was[3]}`,
    )
    await user.type(screen.getByLabelText(/^Dužina/), '5')
    await user.type(screen.getByLabelText(/^Uspon/), '0')
    await user.type(screen.getByLabelText(/^Spust/), '0')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    /* Out of the race and then out of the event, because leaving the race leaves
       the event's own form standing. Read where the list draws it, which is the
       whole point: the event now begins a day earlier. */
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))
    await router.navigate('/sr/administracija/dogadjaji')

    const moved = await open2027()

    expect(
      within(moved).getByText(`${Number(was[1]) - 1}. ${Number(was[2])}. ${was[3]}.`),
    ).toBeVisible()
  })

  it('keeps the confirmation of a save when a race is deleted after it', async () => {
    /* The form is drawn again when a race moves the event, so that saving it
       does not drag the races back. The confirmation must survive that: a
       moderator who has just saved and then deletes a race would otherwise watch
       "Sačuvano" disappear, the empty form come back, and the focus fall to the
       page. */
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const search = await screen.findByLabelText(/Pretraga/)

    await user.type(search, 'Beogradski maraton')

    const listed = must(
      within(await screen.findByRole('table', { name: 'Događaji' }))
        .getAllByRole('row')
        .find(
          (one) =>
            /Beogradski maraton/.test(one.textContent ?? '') && /2027/.test(one.textContent ?? ''),
        ),
      'the event of 2027',
    )

    await user.click(within(listed).getByRole('button', { name: /^Otvori/ }))
    await user.click(await screen.findByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    const first_race = within(
      at(
        within(await screen.findByRole('table', { name: /^Trke na događaju/ }))
          .getAllByRole('row')
          .slice(1),
        0,
      ),
    )

    await user.click(first_race.getByRole('button', { name: /^Obriši/ }))
    await user.click(first_race.getByRole('button', { name: /^Potvrdi brisanje/ }))

    expect(screen.getByRole('status', { name: 'Sačuvano' })).toBeVisible()
  })

  it('does not drag the races back when the event is saved after one of them moved it', async () => {
    /* The workflow the screen invites: change something about the races, then
       correct the town on the event and save. The form was seeded when it was
       drawn, so it still held the day the event was on before the race moved it,
       and the save measured the move from there: a two-day event whose first
       race had just been deleted had the race that was left dragged back onto
       the morning nothing runs on any more. */
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const find2027 = async () => {
      const search = await screen.findByLabelText(/Pretraga/)

      await user.clear(search)
      await user.type(search, 'Beogradski maraton')

      return must(
        within(await screen.findByRole('table', { name: 'Događaji' }))
          .getAllByRole('row')
          .find(
            (one) =>
              /Beogradski maraton/.test(one.textContent ?? '') &&
              /2027/.test(one.textContent ?? ''),
          ),
        'the event of 2027',
      )
    }

    await user.click(within(await find2027()).getByRole('button', { name: /^Otvori/ }))

    const races = within(await screen.findByRole('table', { name: /^Trke na događaju/ }))
      .getAllByRole('row')
      .slice(1)
    const second_day = String(at(within(at(races, 1)).getAllByRole('cell'), 1).textContent)
    const first_race = within(at(races, 0))

    await user.click(first_race.getByRole('button', { name: /^Obriši/ }))
    await user.click(first_race.getByRole('button', { name: /^Potvrdi brisanje/ }))

    /* The event's own form is still on screen. Saved without a word changed. */
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    /* Opened again from the list, so what is read is what the session now
       holds. */
    await user.click(within(await find2027()).getByRole('button', { name: /^Otvori/ }))

    const after = within(await screen.findByRole('table', { name: /^Trke na događaju/ }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => String(at(within(row).getAllByRole('cell'), 1).textContent))

    expect(after).toEqual([second_day])
  })

  it('stays where it is when a race that is not the first is deleted', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const find2027 = async () => {
      const search = await screen.findByLabelText(/Pretraga/)

      await user.clear(search)
      await user.type(search, 'Beogradski maraton')

      return must(
        within(await screen.findByRole('table', { name: 'Događaji' }))
          .getAllByRole('row')
          .find(
            (one) =>
              /Beogradski maraton/.test(one.textContent ?? '') &&
              /2027/.test(one.textContent ?? ''),
          ),
        'the event of 2027',
      )
    }

    await user.click(within(await find2027()).getByRole('button', { name: /^Otvori/ }))

    const races = within(await screen.findByRole('table', { name: /^Trke na događaju/ }))
      .getAllByRole('row')
      .slice(1)

    /* Two mornings, which is what makes either end of the rule sayable. */
    expect(new Set(races.map((row) => at(within(row).getAllByRole('cell'), 1).textContent)).size).toBe(2)

    const first_day = String(at(within(at(races, 0)).getAllByRole('cell'), 1).textContent)

    /* The last one first, which must move nothing: the event begins when it
       began, whatever is taken off the end of it. */
    const last = within(at(races, races.length - 1))

    await user.click(last.getByRole('button', { name: /^Obriši/ }))
    await user.click(last.getByRole('button', { name: /^Potvrdi brisanje/ }))
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    expect(within(await find2027()).getByText(first_day)).toBeVisible()
  })

  it('follows what is left when the first race is deleted', async () => {
    /* The other end of the same rule: an event dated on a morning nothing runs
       on is as wrong as one dated before its first race (owner, 10.08.2026). */
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const find2027 = async () => {
      const search = await screen.findByLabelText(/Pretraga/)

      await user.clear(search)
      await user.type(search, 'Beogradski maraton')

      return must(
        within(await screen.findByRole('table', { name: 'Događaji' }))
          .getAllByRole('row')
          .find(
            (one) =>
              /Beogradski maraton/.test(one.textContent ?? '') &&
              /2027/.test(one.textContent ?? ''),
          ),
        'the event of 2027',
      )
    }

    await user.click(within(await find2027()).getByRole('button', { name: /^Otvori/ }))

    const races = within(await screen.findByRole('table', { name: /^Trke na događaju/ }))
      .getAllByRole('row')
      .slice(1)
    const second_day = String(at(within(at(races, 1)).getAllByRole('cell'), 1).textContent)
    const first_race = within(at(races, 0))

    await user.click(first_race.getByRole('button', { name: /^Obriši/ }))
    await user.click(first_race.getByRole('button', { name: /^Potvrdi brisanje/ }))
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    expect(within(await find2027()).getByText(second_day)).toBeVisible()
  })

  it('moves the races with the event, by the same number of days', async () => {
    /* Owner, 10.08.2026: this is what makes copying last season's event worth
       doing. Two races on the Saturday and one on the Sunday stay two and one
       after the date is moved a year on, and a single race is corrected on its
       own form afterwards.

       An event that really does run over two mornings, because one whose races
       are all on the same day passes whatever the move does to them. */
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    await user.type(await screen.findByLabelText(/Pretraga/), 'Beogradski maraton')

    const listed = must(
      within(await screen.findByRole('table', { name: 'Događaji' }))
        .getAllByRole('row')
        /* The 2027 one: the name has been run every year since 2010 and the
           list holds every year of it, oldest first. */
        .find((one) => /Beogradski maraton/.test(one.textContent ?? '') && /2027/.test(one.textContent ?? '')),
      'the event that runs over two mornings',
    )

    await user.click(within(listed).getByRole('button', { name: /^Otvori/ }))

    const daysOf = async () =>
      within(await screen.findByRole('table', { name: /^Trke na događaju/ }))
        .getAllByRole('row')
        .slice(1)
        .map((row) => String(at(within(row).getAllByRole('cell'), 1).textContent))

    const before = await daysOf()

    expect(new Set(before).size).toBe(2)

    const date = screen.getByLabelText(/^Datum/)
    const was = must(
      /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String((date as HTMLInputElement).value)),
      'the day the event is on',
    )

    await user.clear(date)
    await user.type(date, `${was[1]}${was[2]}${String(Number(was[3]) + 1)}`)
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    /* Opened again, because leaving the form leaves the event: what is being
       read is the state the list now holds, not what the form remembered. */
    const moved = must(
      within(await screen.findByRole('table', { name: 'Događaji' }))
        .getAllByRole('row')
        .find((one) => /Beogradski maraton/.test(one.textContent ?? '') && /2028/.test(one.textContent ?? '')),
      'the event that was just moved',
    )

    await user.click(within(moved).getByRole('button', { name: /^Otvori/ }))

    const after = await daysOf()

    // Every day a year on, and the two mornings still two mornings.
    expect(after).toEqual(before.map((day) => day.replace(String(was[3]), String(Number(was[3]) + 1))))
    expect(new Set(after).size).toBe(2)
  })

  it('leaves the results alone while two events answer at one address', async () => {
    /* A copy keeps the name and the day it was copied from, so until somebody
       changes the date two events answer where one did. A result names its event
       by address, so there is no telling whose is whose, and deleting them with
       either event takes the other's away. */
    const user = setupUser()
    const events = await loadResource<BtlEvent[]>('events')
    const scoredAt = await loadResource<Result[]>('results')
    const one = must(
      events.find((each) => scoredAt.some((result) => result.eventSlug === each.slug)),
      'an event that has results',
    )

    render(
      <ClockProvider>
        <I18nProvider locale="sr">
          <MemoryRouter initialEntries={['/sr/administracija/dogadjaji']}>
            <RoleProvider initialRole="superadmin" initialModerator={null}>
              <SessionProvider>
                <Removed />
                <Copy of={one} />
                <Routes>
                  <Route path="/sr/administracija/dogadjaji" element={<AdminEvents />} />
                </Routes>
              </SessionProvider>
            </RoleProvider>
          </MemoryRouter>
        </I18nProvider>
      </ClockProvider>,
    )

    /* The copy, made the way the button on the event makes it: same name, same
       day, so the same address. */
    await user.click(await screen.findByRole('button', { name: 'kopiraj' }))
    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), one.name)

    const row = must(
      (await table('Događaji'))
        .getAllByRole('row')
        .slice(1)
        .find((each) => (each.textContent ?? '').includes(formatShortDate(one.date, 'sr-Latn'))),
      'that event in the list',
    )

    await user.click(within(row).getByRole('button', { name: `Obriši: ${one.name}` }))
    await user.click(within(row).getByRole('button', { name: `Potvrdi brisanje: ${one.name}` }))

    expect(screen.getByTestId('removed-results')).toHaveTextContent('')
  })

  it('shows the address the save will leave, not the one the rule would build', async () => {
    /* Fifteen pairs of events in the history share a name inside one year, so
       their address carries the month as well, which the rule cannot build. The
       save keeps it; the form and the confirmation were showing the rule's
       answer, so an administrator copying a link before saving copied one that
       answers nowhere. */
    const user = setupUser()
    const events = await loadResource<BtlEvent[]>('events')
    const carried = must(
      events.find((one) => one.slug !== eventSlug(one.name, one.date)),
      'an event whose address carries more than the rule builds',
    )

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    await user.type(await screen.findByLabelText(/Pretraga/), carried.name)

    const row = must(
      within(await screen.findByRole('table', { name: 'Događaji' }))
        .getAllByRole('row')
        /* By the day, because the two of that name in that year are what put
           the month in the address in the first place. The list writes a date
           the way this language does. */
        .find((one) =>
          (one.textContent ?? '').includes(
            `${Number(carried.date.slice(8))}. ${Number(carried.date.slice(5, 7))}. ${carried.date.slice(0, 4)}.`,
          ),
        ),
      'the row of that event',
    )

    await user.click(within(row).getByRole('button', { name: /^Otvori/ }))

    const form = within(await screen.findByRole('form', { name: /Izmena događaja/ }))

    /* Not on the form: the row went off it on 11.08.2026, because there was
       nothing anybody could do about it there. It is still written on every
       save, and the confirmation is where it is read. */
    expect(form.queryByText(carried.slug)).toBeNull()

    await user.click(form.getByRole('button', { name: 'Sačuvaj' }))

    const said = await screen.findByRole('status', { name: 'Sačuvano' })

    expect(said).toHaveTextContent(carried.slug)
  })

  it('refuses to save a second event onto an address one already answers at', async () => {
    /* The rule itself is held in clash.test; what is held here is that the screen
       asks it, and asks it about the other events rather than about the one being
       saved. Given an empty list the check is inert and the copy goes through;
       given a list that includes the record itself, no event can ever be saved
       again. Both passed everything until this. */
    const user = setupUser()
    const events = await loadResource<BtlEvent[]>('events')
    const one = must(
      events.find((each) => each.date > '2027-01-01'),
      'an event ahead of us',
    )
    const day = `${one.date.slice(8, 10)}${one.date.slice(5, 7)}${one.date.slice(0, 4)}`

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
    await user.type(screen.getByLabelText(/^Naziv događaja/), one.name)
    await user.type(screen.getByLabelText(/^Datum/), day)
    await user.type(screen.getByLabelText(/^Mesto/), one.city)
    await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'race')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(
      await screen.findByText(/Događaj sa tim nazivom već postoji te godine/),
    ).toBeVisible()
    expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()

    /* And it goes through in another year, so the refusal is about the address
       and not about saving. Another day of the same year is the same address
       since 10.08.2026, which is the whole point: an event put off a week keeps
       everything that is joined to it. */
    const date = screen.getByLabelText(/^Datum/)

    await user.clear(date)
    await user.type(date, '15062028')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(screen.queryByText(/Događaj sa tim nazivom već postoji te godine/)).toBeNull()
    expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
  })

  it('lets an event be saved again without moving it', async () => {
    /* The other direction: an event compared against itself can never be saved,
       and every edit to any event is refused. */
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const rows = await table('Događaji')
    const first = at(rows.getAllByRole('row'), 1)
    const named = must(within(first).getAllByRole('cell')[1]?.textContent, 'the event')

    await user.click(within(first).getByRole('button', { name: `Otvori: ${named}` }))

    const city = await screen.findByLabelText(/^Mesto/)

    await user.clear(city)
    await user.type(city, 'Vranje')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
  })

  it('writes the distances and the climbs the way this language writes them', async () => {
    /* Like every other table on the portal (EventDetail, ReviewQueue, the top
       boards). Read raw, a climb of 7120 metres printed as four digits and a
       distance as 42.2, neither of which is Serbian, and nothing on the portal
       said so. */
    const user = setupUser()
    const races = await loadResource<Race[]>('races')
    const steep = must(
      races.find((race) => race.ascentM >= 1000),
      'a race with a climb over a thousand metres',
    )
    const events = await loadResource<BtlEvent[]>('events')
    const its = must(
      events.find((one) => one.id === steep.eventId),
      'the event that race is run at',
    )

    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), its.name)

    const row = must(
      (await table('Događaji'))
        .getAllByRole('row')
        .slice(1)
        .find((each) => (each.textContent ?? '').includes(formatShortDate(its.date, 'sr-Latn'))),
      'that event in the list',
    )

    await user.click(within(row).getByRole('button', { name: `Otvori: ${its.name}` }))

    const under = within(await screen.findByRole('table', { name: /^Trke na događaju/ }))
    const mine = must(
      under
        .getAllByRole('row')
        .slice(1)
        .find((each) => (each.textContent ?? '').includes(steep.name)),
      'that race under its event',
    )

    expect(within(mine).getByText(formatNumber(steep.distanceKm, 'sr-Latn', 2))).toBeVisible()
    expect(within(mine).getByText(formatNumber(steep.ascentM, 'sr-Latn'))).toBeVisible()
    /* And the raw number is not what stands there, which is what the assertions
       above would still allow for a climb under a thousand. */
    expect(within(mine).queryByText(String(steep.ascentM))).toBeNull()
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
    /* Already chosen, and left as it is: a new event is a race until somebody
       says otherwise (owner, 10.08.2026), so entering a calendar of a hundred
       races does not mean answering the same question a hundred times. */
    expect(screen.getByLabelText(/^Vrsta događaja/)).toHaveValue('race')
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

/**
 * The country an event is in, which no screen shows.
 *
 * It stopped being a field on 10.08.2026 and became the second half of the town
 * beside it (forms/types.ts). Nothing on any screen draws it, so an event
 * filed in the wrong country looks exactly like one filed in the right country,
 * and the first version of this went in carrying the word "undefined": the
 * layer that turns a form into a record walks the fields, and the country is
 * not one. Read here out of what the session was told to save, through the
 * screen and the keyboard, because a test that hands the record layer a country
 * of its own proves only that the record layer can copy a value.
 */
/**
 * The league the portal itself is.
 *
 * Every event counts towards it, its standings are the BTL tables, and there is
 * nothing anybody would ever change about it (owner, 10.08.2026: „Ona se
 * podrazumeva i ne uređuje se."). The generator stopped writing it on the same
 * day, so what is left is a guard against a league somebody makes by hand at
 * that address, and a guard nothing exercises is a line that can be deleted
 * without a test noticing. Both screens are asked, because both filter and each
 * would fail on its own.
 */
describe('Balkanska trkačka liga among the leagues', () => {
  /** The file, answered with the main league and one ordinary one. */
  function servingBoth() {
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/leagues.json')
        ? new Response(
            JSON.stringify([
              {
                id: 'league-btl-2027',
                slug: 'btl-2027',
                name: 'Balkanska trkačka liga 2027',
                season: 2027,
                groupsByCategory: true,
                rules: '',
                prizes: '',
                eventIds: [],
              },
              {
                id: 'league-druga-2027',
                slug: 'druga-2027',
                name: 'Druga liga 2027',
                season: 2027,
                groupsByCategory: false,
                rules: '',
                prizes: '',
                eventIds: [],
              },
            ]),
            { status: 200 },
          )
        : real(input)) as typeof fetch

    return () => {
      globalThis.fetch = real
    }
  }

  it('is not offered for editing, and the leagues beside it are', async () => {
    const stop = servingBoth()

    renderAt('/sr/administracija/lige', 'superadmin')

    const rows = await table('Lige')
    const words = rows.getAllByRole('row').map((one) => one.textContent ?? '')

    expect(words.some((one) => one.includes('Druga liga 2027'))).toBe(true)
    expect(words.some((one) => one.includes('Balkanska trkačka liga'))).toBe(false)

    stop()
  })

  it('is not listed to a visitor either, for the same reason', async () => {
    const stop = servingBoth()

    renderAt('/sr/lige')

    expect(await screen.findByRole('link', { name: /Druga liga 2027/ })).toBeVisible()
    expect(screen.queryByRole('link', { name: /Balkanska trkačka liga/ })).toBeNull()

    stop()
  })
})

/**
 * The form a new event is entered on (owner, 11.08.2026).
 *
 * Four changes in one breath, and each of them is a thing that used to be asked
 * for and is not any more, or the other way round.
 */
describe('what the form for a new event asks for', () => {
  async function openNew() {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))

    return user
  }

  it('does not ask for an organiser, which the portal follows nowhere', async () => {
    await openNew()

    expect(screen.queryByLabelText(/^Organizator/)).toBeNull()
  })

  it('does not show the address, which the portal makes for itself', async () => {
    /* It is still made and still saved (entityForms.ts, `addressOfEvent`); what
       went is the row on the form, which was a line nobody could act on. */
    await openNew()

    expect(screen.queryByText(/^Adresa događaja/)).toBeNull()
  })

  it('asks whether the event is featured, and opens on no', async () => {
    await openNew()

    const featured = screen.getByLabelText(/^Istaknuto/)

    expect(featured).toHaveValue('no')
    expect([...(featured as HTMLSelectElement).options].map((one) => one.textContent)).toEqual([
      'Ne',
      'Da',
    ])
  })

  it('opens on Serbia, and takes the country from a town that is in the codebook', async () => {
    /* Two halves of one answer, in one row: the town is typed and the country
       is chosen, and a town the codebook knows fills both. */
    const user = await openNew()
    const country = screen.getByLabelText(/^Država/)

    expect(country).toHaveValue('RS')

    await user.type(screen.getByLabelText(/^Mesto/), 'Zagre')
    await user.click(
      within(await screen.findByRole('listbox', { name: 'Ponuđena mesta' })).getByRole('option', {
        name: /^Zagreb/,
      }),
    )

    expect(country).toHaveValue('HR')
  })

  it('leaves the country to be chosen for a town the codebook has never heard of', async () => {
    /* A race in a hamlet of two hundred people. What must not happen is that it
       keeps the country of whatever town was chosen before it. */
    const user = await openNew()

    await user.type(screen.getByLabelText(/^Mesto/), 'Zagre')
    await user.click(
      within(await screen.findByRole('listbox', { name: 'Ponuđena mesta' })).getByRole('option', {
        name: /^Zagreb/,
      }),
    )
    await user.clear(screen.getByLabelText(/^Mesto/))
    await user.type(screen.getByLabelText(/^Mesto/), 'Divčibare')

    /* Left as it was, and on the screen: the country of a town the codebook does
       not have is chosen by hand, and what stands there is what will be saved.
       It used to be cleared here, back when it was written and never shown. */
    expect(screen.getByLabelText(/^Država/)).toHaveValue('HR')

    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')

    expect(screen.getByLabelText(/^Država/)).toHaveValue('RS')
  })

  it('opens the races of the event it has just made, without going back for it', async () => {
    /* A race is entered inside the event it belongs to, and a new event has no
       identity to hang one on until it is saved. Until this the moderator had
       to save, go back to a list of eleven hundred, and find the event they had
       made a moment ago. */
    const user = await openNew()

    await user.type(screen.getByLabelText(/^Naziv događaja/), 'Trka sa trkama')
    await user.type(screen.getByLabelText(/^Datum/), '01062027')
    await user.type(screen.getByLabelText(/^Mesto/), 'Niš')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    await screen.findByRole('status', { name: 'Sačuvano' })

    /* A heading and the way to add one, not a table: an event entered a moment
       ago has no races yet, which is the ordinary state of one entered a
       fortnight before its distances are known. */
    expect(
      await screen.findByRole('heading', { name: 'Trke na događaju Trka sa trkama' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Nova trka' })).toBeVisible()
  })

  it('takes a race with no name at all, since the length is what names it', async () => {
    const user = await openNew()

    await user.type(screen.getByLabelText(/^Naziv događaja/), 'Trka bez imena')
    await user.type(screen.getByLabelText(/^Datum/), '02062027')
    await user.type(screen.getByLabelText(/^Mesto/), 'Niš')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    await user.click(await screen.findByRole('button', { name: 'Nova trka' }))
    await user.type(await screen.findByLabelText(/^Dan trke/), '02062027')
    await user.type(screen.getByLabelText(/^Dužina/), '21.1')
    await user.type(screen.getByLabelText(/^Uspon/), '120')
    await user.type(screen.getByLabelText(/^Spust/), '120')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    /* And it saved with the name left empty, which is what the length is for
       (owner, 11.08.2026). */
    expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
  })
})

describe('the country an event is filed in', () => {
  /** One town out of the list the place field offers. Asked for by the name the
   *  list carries, because the portal has other listboxes open at once (the
   *  language menu is one) and "the listbox" is not one thing. */
  async function townOffered(named: string): Promise<HTMLElement> {
    const list = await screen.findByRole('listbox', { name: 'Ponuđena mesta' })

    return within(list).getByRole('option', { name: new RegExp(`^${named}`) })
  }

  /** The control that opens one event's record.
   *
   * Found by its date as well as its name: a race is run every year under the
   * same name, so "the row saying Fruškogorski maraton" is a dozen rows, and
   * the first one is not the one whose country was read. */
  async function openRow(event: BtlEvent, user: Pressing): Promise<HTMLElement> {
    /* Searched for first: the screen shows sixty rows of eleven hundred, and
       an event from 2010 is not among them. */
    await table('Događaji')
    await user.type(screen.getByLabelText(/^Pretraga/), event.name)

    const rows = await table('Događaji')
    const day = formatShortDate(event.date, 'sr-Latn')
    const mine = must(
      rows
        .getAllByRole('row')
        .slice(1)
        .find((row) => {
          const words = row.textContent ?? ''

          return words.includes(event.name) && words.includes(day)
        }),
      `the row for ${event.name} on ${day}`,
    )

    return within(mine).getByRole('button', { name: `Otvori: ${event.name}` })
  }

  /** What the session was told about one record, by id. */
  async function told(what: string): Promise<string> {
    const lines = within(await screen.findByRole('list', { name: 'session records' }))

    return must(
      lines.getAllByRole('listitem').find((one) => (one.textContent ?? '').includes(what)),
      `something saved for ${what}`,
    ).textContent ?? ''
  }

  it('comes with the town that was picked, on an event being entered', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin', null, undefined, null, <Saved />)

    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
    await user.type(screen.getByLabelText(/^Naziv događaja/), 'Trka sa mestom')
    await user.type(screen.getByLabelText(/^Datum/), '01062027')

    /* Picked out of the codebook rather than typed whole, because picking is
       what carries the country. */
    await user.type(screen.getByLabelText(/^Mesto/), 'Zagre')
    await user.click(await townOffered('Zagreb'))
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    expect(await told('Trka sa mestom')).toContain('country=HR')
  })

  it('changes with the town, on an event being edited', async () => {
    /* The fault this guards is written on the field itself: a race in Beograd
       edited into Zagreb would be filed in Serbia, and no screen would say so. */
    const user = setupUser()
    const events = await loadResource<BtlEvent[]>('events')
    const serbian = must(
      events.find((one) => one.country === 'RS' && one.city !== ''),
      'an event in Serbia',
    )

    renderAt('/sr/administracija/dogadjaji', 'superadmin', null, undefined, null, <Saved />)

    await user.click(await openRow(serbian, user))
    await user.clear(screen.getByLabelText(/^Mesto/))
    await user.type(screen.getByLabelText(/^Mesto/), 'Zagre')
    await user.click(await townOffered('Zagreb'))
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    expect(await told(serbian.id)).toContain('country=HR')
  })

  it('stays as it was where the town was not touched', async () => {
    /* The other half, and the one a fix for the first half breaks: saving a
       form that nobody typed a town into must not blank the country it came
       with. */
    const user = setupUser()
    const events = await loadResource<BtlEvent[]>('events')
    const serbian = must(
      events.find((one) => one.country === 'RS' && one.city !== ''),
      'an event in Serbia',
    )

    renderAt('/sr/administracija/dogadjaji', 'superadmin', null, undefined, null, <Saved />)

    await user.click(await openRow(serbian, user))
    /* Any change at all, so the save is a save: the organiser field went off
       this form on 11.08.2026 (owner), and what is under test here is the
       country beside the town rather than any particular field. */
    await user.type(screen.getByLabelText(/^Naziv događaja/), ' i prijatelji')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    expect(await told(serbian.id)).toContain('country=RS')
  })
})

describe('the address of a league', () => {
  /* A league is filed under an id nobody sees and answers at an address somebody
     chose: `runtrace-2027` is not what the rule would make of "RunTrace liga
     2027". So the form asks for it, like a written page, rather than deriving it
     from the name, which would take the address away from everyone who has it
     (PENDING, and the rule for teams and events of 03.08.2026). */
  it('is asked for on the form, and a league entered by hand answers at it', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/lige', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
    await user.type(screen.getByLabelText(/^Naziv lige/), 'Vojvođanska liga 2027')
    await user.type(screen.getByLabelText(/^Adresa/), 'vojvodjanska-2027')
    await user.type(screen.getByLabelText(/^Sezona/), '2027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const listed = within(await screen.findByRole('table', { name: 'Lige' }))

    /* The address is on the record, and it leads somewhere: a league entered by
       hand used to get an empty one and stand at /liga/, which is no league at
       all.

       What the address answers with is not read here. Nothing the administration
       creates reaches a public screen at all, because those read the file and
       not what this visit has added to it; that is older and wider than this
       form and is written down as its own job (PENDING, R7). */
    expect(listed.getByRole('link', { name: '/liga/vojvodjanska-2027' })).toHaveAttribute(
      'href',
      '/sr/liga/vojvodjanska-2027',
    )
  })

  it('is not saved without one, since a league without an address is at /liga/', async () => {
    /* The whole of what this rule is for. Without it the address saves empty,
       the list draws a link to /liga/, and the league is the one thing the
       portal cannot answer with. */
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
    await user.type(screen.getByLabelText(/^Naziv lige/), 'Liga bez adrese')
    await user.type(screen.getByLabelText(/^Sezona/), '2027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()
    expect(screen.getByLabelText(/^Adresa/)).toHaveAccessibleDescription(/obavezno/)
  })

  it('takes only what an address may be made of', async () => {
    /* Lower case, digits and dashes. A capital or a space is not refused for
       tidiness: the address is what the portal answers at, and a value that
       cannot stand in one is a league nobody reaches. */
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
    await user.type(screen.getByLabelText(/^Naziv lige/), 'Vojvođanska liga 2027')
    await user.type(screen.getByLabelText(/^Adresa/), 'BTL 2027')
    await user.type(screen.getByLabelText(/^Sezona/), '2027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()
    /* The complaint itself, and on the address. Matched against the words the
       hint under the field uses, this passed whether or not anything was wrong:
       the hint is part of what describes the field either way. */
    expect(screen.getByLabelText(/^Adresa/)).toHaveAccessibleDescription(
      /nije u očekivanom obliku/,
    )
  })

  it('is refused where another league already answers at it', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
    await user.type(screen.getByLabelText(/^Naziv lige/), 'Druga liga')
    await user.type(screen.getByLabelText(/^Adresa/), 'runtrace-2027')
    await user.type(screen.getByLabelText(/^Sezona/), '2027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByText(/već zauzeta/)).toBeVisible()
    expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()
  })

  it('lets a league be saved again without its own address getting in the way', async () => {
    /* Compared by identity rather than by address, every league refused the
       address it already answers at. */
    const user = setupUser()

    renderAt('/sr/administracija/lige', 'superadmin')

    const row = at((await table('Lige')).getAllByRole('row'), 1)

    await user.click(within(row).getByRole('button', { name: /^Otvori/ }))
    await user.click(await screen.findByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
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

/** Makes a copy of an event the way the button on its own page does: the same
 *  name and the same day, so the same address (event/EventActions.tsx). */
function Copy({ of }: { of: BtlEvent }) {
  const { create } = useSession()

  return (
    <button
      type="button"
      onClick={() =>
        create('events', `${of.id}-kopija-1`, {
          name: of.name,
          date: `${of.date.slice(8, 10)}/${of.date.slice(5, 7)}/${of.date.slice(0, 4)}`,
          city: of.city,
          country: of.country,
          organizer: of.organizer,
          kind: of.kind,
        })
      }
    >
      kopiraj
    </button>
  )
}

/** What the session has been told to remove, drawn beside the screen that tells
 *  it. The only way to see a race that is no longer anywhere: nothing on the
 *  portal draws a race outside its event, which is the whole reason the deletion
 *  has to carry them. */
function Removed() {
  const { deletions } = useSession()

  return (
    <>
      <span data-testid="removed">{(deletions.races ?? []).join(',')}</span>
      <span data-testid="removed-results">{(deletions.results ?? []).join(',')}</span>
    </>
  )
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
    const scoredAt = await loadResource<Result[]>('results')
    const one = must(
      events.find(
        (each) =>
          races.some((race) => race.eventId === each.id) &&
          scoredAt.some((result) => result.eventSlug === each.slug),
      ),
      'an event that has both races and results',
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

    /* And its results, which is what the same deletion does from the event's own
       page: left behind they go on counting in the standing and in the boards,
       each of them linking to a page that says the event does not exist. */
    const scored = scoredAt.filter((each) => each.eventSlug === one.slug).map((each) => each.id)
    const dropped = (screen.getByTestId('removed-results').textContent ?? '').split(',')

    expect(scored.length).toBeGreaterThan(0)

    for (const result of scored) {
      expect(dropped, `${result} went with its event`).toContain(result)
    }
  })
})
