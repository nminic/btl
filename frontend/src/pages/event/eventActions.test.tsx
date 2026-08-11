import { screen, within } from '@testing-library/react'
import { at, first, must } from '../../test/at'
import { moderatorWith, renderAt } from '../../test/render'
import { setupUser } from '../../test/user'

/* What can be done with an event, from the event's own page (owner,
 * 03.08.2026): copied and deleted by whoever administers events, and reported a
 * result on by whoever is signed in.
 */

/** An event with races on it, by the address the calendar links to. */
const EVENT = '/sr/kalendar/maraton-maratona-2015'

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
    expect(screen.queryByRole('link', { name: 'Dodaj komentar' })).toBeNull()
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
      await user.click(await screen.findByRole('button', { name: 'Brisanje' }))

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

       Counted under the copy itself, which is where a race is now seen at all
       (owner, 06.08.2026): a copied race that answers to no event is a race no
       screen on the portal draws, so the count under the copy is the whole
       proof. */
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
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    /* The copy, found by name and then by the day it was moved to: the list
       opens on what is still ahead and keeps sixty rows, and a copy made for
       March 2027 is not among the first sixty of those. */
    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), 'Maraton maratona')

    const events = within(await screen.findByRole('table', { name: 'Događaji' }))
    const copy = must(
      events
        .getAllByRole('row')
        .slice(1)
        .find((row) => (row.textContent ?? '').includes('2027')),
      'the copied event in the list',
    )

    await user.click(within(copy).getByRole('button', { name: /^Otvori:/ }))

    const under = within(await screen.findByRole('table', { name: /^Trke na događaju/ }))

    expect(under.getAllByRole('row').slice(1)).toHaveLength(races)
  })

  it('never carries being featured across to the copy', async () => {
    /* Being singled out is a choice about this running of the race and not
       something the race carries (owner, 11.08.2026): next season's calendar is
       made by copying, and a copy that arrived already featured would put five
       events on the front page of a season nobody has planned yet. Copied off a
       featured event, which is the only way to tell the rule from the default. */
    const user = setupUser()

    renderAt('/sr/kalendar/beogradski-maraton-2027', 'superadmin')
    await screen.findByRole('heading', { level: 1 })
    await user.click(screen.getByRole('button', { name: 'Kopiranje' }))
    await screen.findByLabelText(/Datum/)

    expect(screen.getByLabelText(/^Istaknuto/)).toHaveValue('no')
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

    /* The address follows the year it was moved into, rather than the year it
       was copied from: an address is the name and the year since 10.08.2026, so
       an event put off a week inside its season keeps it. */
    const saved = await screen.findByRole('status', { name: 'Sačuvano' })

    expect(saved).toHaveTextContent('maraton-maratona-2027')

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
