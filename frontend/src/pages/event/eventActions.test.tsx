import { screen, within } from '@testing-library/react'
import { at, first, must } from '../../test/at'
import { moderatorWith, renderAt } from '../../test/render'
import { setupUser } from '../../test/user'

/* What can be done with an event, from the event's own page (owner,
 * 03.08.2026): copied and deleted by whoever administers events, and reported a
 * result on by whoever is signed in.
 */

/** An event with races on it, by the address the calendar links to. */
const EVENT = '/sr/kalendar/maraton-maratona-2015-03-14'

async function openEvent(
  role: Parameters<typeof renderAt>[1],
  member: string | null = null,
  moderator?: Parameters<typeof renderAt>[3],
) {
  const rendered = renderAt(EVENT, role, member, moderator)
  await screen.findByRole('heading', { level: 1 })

  return rendered
}

describe('who is offered what on an event', () => {
  it('offers a visitor nothing at all', async () => {
    await openEvent('visitor')

    for (const name of ['Kopiranje', 'Brisanje']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }

    expect(screen.queryByRole('link', { name: 'Prijavi rezultat' })).toBeNull()
    /* And the head stays the column it is on every other screen: laid out in two
       columns with nothing in the second, its four lines paired off into a grid
       two by two (EventActions.css). */
    expect(document.querySelector('.event__actions')).toBeNull()
  })

  it('offers the superadmin the copy and the deletion', async () => {
    await openEvent('superadmin')

    expect(screen.getByRole('button', { name: 'Kopiranje' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Brisanje' })).toBeVisible()
  })

  it('offers a moderator without the events neither of them', async () => {
    /* Rights are granular and this is the whole point of them: somebody trusted
       to judge results is not thereby trusted to delete a race weekend
       (rights.ts, PDL P21). */
    await openEvent('moderator', null, moderatorWith(['queue:results']))

    expect(screen.queryByRole('button', { name: 'Kopiranje' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Brisanje' })).toBeNull()
  })

  it('offers a signed-in member the way to report a result', async () => {
    await openEvent('competitor', '000007')

    expect(screen.getByRole('link', { name: 'Prijavi rezultat' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Brisanje' })).toBeNull()
  })

  it('offers an administrator who is also a member all three', async () => {
    /* An administrator runs too, so the two sets do not exclude one another. */
    await openEvent('superadmin', '000007')

    expect(screen.getByRole('button', { name: 'Kopiranje' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Brisanje' })).toBeVisible()
    /* A link, because it leads to another screen (EventActions.tsx). */
    expect(screen.getByRole('link', { name: 'Prijavi rezultat' })).toBeVisible()
  })
})

describe('reporting a result from the event', () => {
  it('leads to the form under the event, so it does not ask which event it was', async () => {
    const user = setupUser()
    const { router } = await openEvent('competitor', '000007')

    await user.click(screen.getByRole('link', { name: 'Prijavi rezultat' }))

    expect(router.state.location.pathname).toBe(`${EVENT}/prijava`)
    expect(await screen.findByLabelText(/^Trka/)).toBeVisible()
  })
})

describe('deleting an event', () => {
  it('asks first, and says how many races go with it', async () => {
    /* Nothing brings any of it back, and deleting an event of five races from a
       page showing one of them is easy to do by mistake. */
    const user = setupUser()
    const asked: string[] = []
    const confirm = vi.spyOn(window, 'confirm').mockImplementation((message) => {
      asked.push(String(message))

      return false
    })

    try {
      await openEvent('superadmin')
      await user.click(screen.getByRole('button', { name: 'Brisanje' }))

      expect(asked).toHaveLength(1)
      expect(first(asked)).toMatch(/Obrisati događaj/)
      expect(first(asked)).toMatch(/trk/)
      /* Answered no, so the event is still on screen. */
      expect(screen.getByRole('button', { name: 'Brisanje' })).toBeVisible()
    } finally {
      confirm.mockRestore()
    }
  })

  it('takes the races with it and leaves for the month it was in', async () => {
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      const { router } = await openEvent('superadmin')
      const races = within(await screen.findByRole('table', { name: /Trke|trke/ }))
        .getAllByRole('row')
        .slice(1).length

      expect(races).toBeGreaterThan(0)

      /* Somebody who ran it, taken off the event's own list of results, so the
         profile looked at afterwards is one that had a link to this event. */
      const who = within(await screen.findByRole('table', { name: /Rezultati/ })).getAllByRole(
        'link',
      )
      const ran = must(
        must(first(who).getAttribute('href'), 'veza ka takmičaru').split('/').pop(),
        'broj takmičara',
      )

      await user.click(screen.getByRole('button', { name: 'Brisanje' }))

      expect(router.state.location.pathname).toBe('/sr/kalendar')

      /* And it is gone rather than merely left behind: the address it had
         answers as an address the portal does not have. */
      await router.navigate(EVENT)
      expect(await screen.findByRole('heading', { name: 'Ovog događaja nema.' })).toBeVisible()

      /* And so is everything that hung off it. A result carries the address of
         its event, so without this the event left the calendar while its results
         went on counting, each of them linking to a page that now says the event
         does not exist.
       *
         Checked on a profile, which is a screen that names the event. The
         standing does not name events at all, so looking there proved nothing:
         the whole deletion of results could be taken out and it stayed green. */
      await router.navigate(`/sr/takmicar/${ran}?sezona=2015`)

      const listed = within(await screen.findByRole('table', { name: 'Rezultati' }))

      expect(listed.queryAllByRole('link', { name: 'Maraton maratona' })).toHaveLength(0)
      /* And the row is gone rather than merely unlinked. */
      expect(listed.queryByText('Maraton maratona')).toBeNull()
    } finally {
      confirm.mockRestore()
    }
  })
})

describe('copying an event', () => {
  it('opens the copy on its own form, at the date', async () => {
    /* The date is the one thing that is certainly wrong on a copy, which is what
       makes this worth a button: next season's calendar is this season's with
       the dates moved. */
    const user = setupUser()
    const { router } = await openEvent('superadmin')

    const name = must(screen.getByRole('heading', { level: 1 }).textContent, 'ime događaja')

    await user.click(screen.getByRole('button', { name: 'Kopiranje' }))

    expect(router.state.location.pathname).toBe('/sr/administracija/dogadjaji')
    expect(router.state.location.search).toMatch(/zapis=/)

    const date = await screen.findByLabelText(/Datum/)

    expect(date).toHaveFocus()
    /* Everything else came across, so the only thing to do is the date. */
    expect(screen.getByLabelText(/Naziv događaja/)).toHaveValue(name)
  })

  it('keeps the structure: every race copied, and every copy on the copied event', async () => {
    /* What copying is for (owner, 03.08.2026): the races come across and hang
       off the copy, so next season's weekend is last season's weekend with the
       date moved rather than five races typed again.

       Read on the screen of races, which is where a race says which event it
       belongs to. That screen built its list of events from the file, so a race
       made a moment ago for an event made a moment ago had nothing to point at:
       the column said "Bez događaja", the search by event could not find it, and
       opening it offered a list of events with its own missing, so saving
       detached the race from the event it had been made for. */
    const user = setupUser()
    const { router } = await openEvent('superadmin')

    const mine = within(await screen.findByRole('table', { name: 'Trke' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => must(first(within(row).getAllByRole('cell')).textContent, 'naziv trke'))

    expect(mine.length).toBeGreaterThan(1)

    await user.click(screen.getByRole('button', { name: 'Kopiranje' }))

    const date = await screen.findByLabelText(/Datum/)
    await user.clear(date)
    await user.type(date, '14032027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    await router.navigate('/sr/administracija/trke')
    await user.type(await screen.findByPlaceholderText(/Traži po nazivu/), 'Maraton maratona')

    /* The copy is found by the name of its event, which is only possible if the
       screen can see the event at all. */
    const rows = within(await screen.findByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))

    /* One row per copied race, each naming the copied event and not "Bez
       događaja". */
    for (const name of mine) {
      const copied = rows.filter(
        (cells) => at(cells, 1) === name && /2027|Maraton maratona/.test(String(at(cells, 0))),
      )

      expect(copied.length).toBeGreaterThan(0)
      expect(String(at(first(copied), 0))).not.toMatch(/Bez događaja/)
    }
  })

  it('gives a second copy an identity of its own', async () => {
    /* The suffix counted the races and not the copies, and the number of races
       does not change when a copy is made, so pressing the button twice wrote
       two records under one id. Two records under one id is the fault the
       numbering exists to prevent: the list draws them under one key, a lookup
       finds only the first, and an edit to either changes both. */
    const user = setupUser()
    const { router } = await openEvent('superadmin')

    await user.click(screen.getByRole('button', { name: 'Kopiranje' }))
    await screen.findByLabelText(/Datum/)

    const first = router.state.location.search

    await router.navigate(EVENT)
    /* The event's own heading, not merely any first-level one: the screen left
       behind has one of its own and it is there while this one is loading. */
    await screen.findByRole('button', { name: 'Kopiranje' })
    await user.click(screen.getByRole('button', { name: 'Kopiranje' }))
    await screen.findByLabelText(/Datum/)

    expect(router.state.location.search).not.toBe(first)
  })

  it('takes the races with it, and gives the copy an address of its own', async () => {
    /* Entering an event and its five races again by hand is the work this exists
       to remove, so a copy without the races is a button that saves nothing.

       The address is the other half. It was blank on anything entered by hand,
       so a record sat in the administration's list and answered nowhere; an
       event works it out from its own name and day now, and works it out again
       whenever either is changed (entityForms.ts, EntityEditor.tsx).

       What this cannot check yet is the copy on the calendar. Nothing the
       administration creates reaches a public screen at all, because those read
       the file and not what this visit has added to it; that is older and wider
       than this button and is written down as its own job. */
    const user = setupUser()
    await openEvent('superadmin')

    const races = within(await screen.findByRole('table', { name: 'Trke' }))
      .getAllByRole('row')
      .slice(1).length

    expect(races).toBeGreaterThan(1)

    await user.click(screen.getByRole('button', { name: 'Kopiranje' }))

    const date = await screen.findByLabelText(/Datum/)
    await user.clear(date)
    await user.type(date, '14032027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    /* The address follows the day it was moved to, rather than the day it was
       copied from. */
    const saved = await screen.findByRole('status', { name: 'Sačuvano' })

    expect(saved).toHaveTextContent('maraton-maratona-2027-03-14')

    /* And the races came across, counted on the copy itself. Counting rows that
       matched "Maraton maratona" on the list of races proved nothing: eight
       events answer to that name and twenty-six races with them, so four is
       fewer than twenty-six whether or not anything was copied at all. */
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))
    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), 'Maraton maratona')

    const listed = within(await screen.findByRole('table'))
    const copy = must(
      listed.getAllByRole('row').find((row) => /2027\./.test(row.textContent ?? '')),
      'red kopije u spisku događaja',
    )

    /* The fourth column is the count of races, read as a whole cell. Matched as
       a substring it passed against the date beside it, which holds a four of
       its own, so the copy could arrive with no races and nothing would say
       so. */
    expect(at(within(copy).getAllByRole('cell'), 3).textContent).toBe(String(races))
  })
})
