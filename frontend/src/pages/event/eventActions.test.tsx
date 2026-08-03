import { screen, within } from '@testing-library/react'
import { first, must } from '../../test/at'
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

    for (const name of ['Kopiranje', 'Brisanje', 'Prijavi rezultat']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
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

    expect(screen.getByRole('button', { name: 'Prijavi rezultat' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Brisanje' })).toBeNull()
  })

  it('offers an administrator who is also a member all three', async () => {
    /* An administrator runs too, so the two sets do not exclude one another. */
    await openEvent('superadmin', '000007')

    expect(screen.getByRole('button', { name: 'Kopiranje' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Brisanje' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Prijavi rezultat' })).toBeVisible()
  })
})

describe('reporting a result from the event', () => {
  it('leads to the form under the event, so it does not ask which event it was', async () => {
    const user = setupUser()
    const { router } = await openEvent('competitor', '000007')

    await user.click(screen.getByRole('button', { name: 'Prijavi rezultat' }))

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

      await user.click(screen.getByRole('button', { name: 'Brisanje' }))

      expect(router.state.location.pathname).toBe('/sr/kalendar')

      /* And it is gone rather than merely left behind: the address it had
         answers as an address the portal does not have. */
      await router.navigate(EVENT)
      expect(await screen.findByRole('heading', { name: 'Ovog događaja nema.' })).toBeVisible()
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
    const { router } = await openEvent('superadmin')

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

    /* And the races came across: the administration's list of races holds as
       many for the copy as the event it was copied from had. */
    await router.navigate('/sr/administracija/trke')
    await user.type(await screen.findByPlaceholderText(/traži|Traži|pretra/i), 'Maraton maratona')

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)

    expect(rows.length).toBeGreaterThan(races)
  })
})
