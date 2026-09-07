import { screen, waitFor, within } from '@testing-library/react'
import type { ResourceName } from '../data/client'
import { first, must } from '../test/at'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'

/* A screen must wait only on the data it actually shows.
 *
 * Three screens have shipped combining a resource that no row on them ever
 * read. Because an error wins over loading in combineResources, on purpose, one
 * failed file turned a whole working page into an error message. Every one of
 * the three was found by eye, twice by review, which is not a method.
 *
 * These cases are the method: break a resource the screen never displays, and
 * the screen must still render. They fail the moment somebody widens one of
 * these screens back onto data it does not use. */

/** The two resources a screen may lose without the screen itself going. */
const BOTH: [ResourceName][] = [['races'], ['events']]

/** Serves every resource off disk as usual, except the one named, which fails. */
/** The one line of facts under the name of a competition, whole. The words and the number are two
 *  nodes, so a query for either says nothing about the other. */
const facts = () =>
  must(document.querySelector('.leagues__facts'), 'the line of facts').textContent ?? ''

function breakResource(name: ResourceName) {
  const real = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input).endsWith(`/${name}.json`)
      ? new Response('greska', { status: 500 })
      : real(input))

  return () => {
    globalThis.fetch = real
  }
}

/** Serves every resource as usual, except the one named, which never arrives. */
function stallResource(name: ResourceName) {
  const real = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input).endsWith(`/${name}.json`)
      ? new Promise<Response>(() => {})
      : real(input))

  return () => {
    globalThis.fetch = real
  }
}

/* The other half of the same idea, from the other end: a screen that loads a
 * part separately must not be covered while it waits for it.
 *
 * The sheet over the page is right for a screen that is waiting as a whole
 * (owner, 31.07.2026). Three screens open a second Resource inside their own,
 * and there the sheet undid the very thing the split was for: the name of the
 * record arrives first and is useful, and a sheet hid it until the heaviest half
 * landed. Two stacked sheets on one screen also took the page
 * to about 95% opaque and said "Učitavanje" twice. */
describe('a part of a screen waits without covering the page', () => {
  let restore = () => {}

  afterEach(() => {
    restore()
  })

  it('keeps the event readable while its races are still on their way', async () => {
    restore = stallResource('races')
    renderAt('/sr/kalendar/jadovnicki-ultramaraton-2026')

    expect(await screen.findByRole('heading', { level: 1, name: /Jadovnički/ })).toBeVisible()
    // A sheet is a `.loader` that is not the inline one. There must be none.
    expect(document.querySelector('.loader:not(.loader--inline)')).toBeNull()
  })

  it('names each part it is waiting for rather than saying the same thing twice', async () => {
    restore = stallResource('results')
    renderAt('/sr/kalendar/jadovnicki-ultramaraton-2026')

    await screen.findByRole('heading', { level: 1, name: /Jadovnički/ })
    const said = screen.getAllByRole('status').map((one) => one.textContent)

    /* Two parts of this screen wait on results, and the shell announces the
       page title, so three regions speak. Every one of them has to say
       something different, which is what the name is for. */
    expect(new Set(said).size).toBe(said.length)
    expect(said).toContain('Učitavanje: Rezultati članova')
  })

  it('draws the list of competitions while the heaviest file is still on its way', async () => {
    /* **Measured by a review on 07.09.2026, and it was a high finding.** The list read only
       `leagues.json` (1,9 KB) until that day; the number of entrants the owner asked for is worked
       out of the results (1,4 MB), the races (553 KB) and the events (373 KB), and waiting on all
       four put the whole screen under a full-page loader. What was behind that loader is what the
       owner had just moved onto this screen: the names of the competitions, their seasons, their
       terms and their prizes.

       So the number waits and the screen does not. Empty while the answer is coming, because a
       nought where the file has not arrived is the table telling a lie. */
    restore = stallResource('results')
    renderAt('/sr/lige?sezona=2027')

    expect(await screen.findByRole('heading', { level: 2, name: /RunTrace liga/ })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Propozicije' })).toBeVisible()
    /* And no plate over the page: an inline wait is a wait beside the words, not instead of
       them. */
    expect(document.querySelector('.loader:not(.loader--inline)')).toBeNull()
    /* Read off the line of facts as a whole, because the words and the number are two nodes: the
       word is a key of the dictionary and the number is a component that fills in behind it. */
    expect(facts()).toContain('Učesnika:')
    expect(facts(), 'the number arrived while the file was held').not.toMatch(/Učesnika: \d/)
  }, SLOW)

  it('says so rather than counting nought when that file never arrives', async () => {
    /* The other half of the same finding. A count of none where the file failed is a lie in the
       other direction, and the word for it has to be a word. */
    restore = breakResource('results')
    renderAt('/sr/lige?sezona=2027')

    expect(await screen.findByRole('heading', { level: 2, name: /RunTrace liga/ })).toBeVisible()
    /* Waited for: the word arrives when the request gives up, which is a moment after the screen
       is drawn out of the small file it does wait on. */
    await waitFor(() => {
      expect(facts()).toContain('Učesnika: nepoznato')
    })
    /* And the screen is not replaced by an error: what failed is one number of one line. */
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  }, SLOW)

  it('keeps the front page readable while the president is still on his way', async () => {
    restore = stallResource('pages')
    renderAt('/sr')

    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible()
    expect(document.querySelector('.loader:not(.loader--inline)')).toBeNull()
  })
})

describe('a screen waits only on the data it shows', () => {
  let restore = () => {}

  afterEach(() => {
    restore()
  })

  it('draws the standing when the events cannot be loaded', async () => {
    restore = breakResource('events')
    renderAt('/sr/tabela?sezona=2020')

    expect(await screen.findByRole('table')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('draws the competitor cards when the teams cannot be loaded', async () => {
    restore = breakResource('teams')
    renderAt('/sr/takmicari')

    expect(await screen.findByRole('list')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('names a competition when the races cannot be loaded', async () => {
    /* The page of a competition is its name, the control and the standing since 07.09.2026, and
       the standing is the part that needs the races. Waited for, a races file that failed would
       replace the whole page with an error, so a reader could not so much as read which
       competition they had opened, nor choose the other half of the field.

       What used to stand here was the column counting each event's races, and the word „nepoznato"
       it printed when the file failed. That table went with the owner's sentence of 07.09.2026
       („pa ni događaji koji ulaze u ligu"), and the two cases about that word went with it: there
       is no cell left that could say it, and the key is gone from the dictionary rather than left
       for somebody to find and put back. */
    restore = breakResource('races')
    renderAt('/sr/liga/runtrace-2027')

    expect(await screen.findByRole('heading', { level: 1, name: /RunTrace liga/ })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Žene' })).toBeVisible()
  })

  it('draws the events of administration when the results cannot be loaded', async () => {
    /* The fourth screen to ship this way, and the first inside administration.
       No row here shows a result: they are read only so that deleting an event
       takes its results with it. Waited for, a results file that failed replaced
       the screen, and with it every way of editing an event or a race, since the
       races moved inside the event on 06.08.2026. */
    restore = breakResource('results')
    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const table = within(await screen.findByRole('table', { name: 'Događaji' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(table.getAllByRole('button', { name: /^Otvori/ }).length).toBeGreaterThan(0)

    /* And the deletion says the file failed rather than that it is waiting for
       it. Held back either way, because deleting an event without its results
       leaves them counting for an event that is gone; but a row that says it is
       waiting, for ever, is an administrator refused a right he holds and told
       something untrue about why. */
    expect(table.getAllByText(/rezultati se ne mogu učitati/).length).toBeGreaterThan(0)
    expect(table.queryByText('Brisanje čeka rezultate')).toBeNull()
    expect(table.queryByRole('button', { name: /^Obriši/ })).toBeNull()
  })

  it('does not offer to delete an event while its results are still on their way', async () => {
    /* The other half of reading them for what they are worth. Deleting an event
       takes its results along, and until they are here there is nothing to take:
       the deletion would leave them pointing at an event that is gone, each one
       still counting in the standing. The row says what it is waiting for
       instead of offering a button that does half the work. */
    restore = stallResource('results')
    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const table = within(await screen.findByRole('table', { name: 'Događaji' }))

    expect(table.getAllByText('Brisanje čeka rezultate').length).toBeGreaterThan(0)
    expect(table.queryByRole('button', { name: /^Obriši/ })).toBeNull()
    /* And the other control is there, so this is the deletion held back rather
       than the row being empty. */
    expect(table.getAllByRole('button', { name: /^Otvori/ }).length).toBeGreaterThan(0)
  })

  it('holds back a change of date while the races of the event are on their way', async () => {
    /* Accepting one moves the event and its races by the same number of days
       (moveEvent). Until the races are here there is nothing to move them by,
       and the event alone is the half-move the decision exists to make whole:
       an event a week later than the races it is run with. */
    restore = stallResource('races')
    renderAt('/sr/administracija/verifikacija/termini', 'superadmin')

    const cards = within(await screen.findByRole('list', { name: /Čeka proveru/ }))
    const approve = first(cards.getAllByRole('button', { name: 'Odobri' }))

    expect(approve).toHaveAttribute('aria-disabled', 'true')
    /* Said once for the queue rather than on every card. */
    expect(screen.getByText(/Odluka čeka događaj/)).toBeVisible()
    /* And the same hold on the one decision that settles the whole queue: taken
       without the races it is forty half-moves rather than one. */
    expect(screen.getByRole('button', { name: 'Odobri sve' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )

    /* Reachable and pressable, so the reason can be read; it simply does not
       decide. */
    await setupUser().click(approve)

    /* Answered yes, so what holds the sweep back is the hold and not the
       question: unanswered, jsdom's confirm is a no and the sweep would stop
       there whatever the code did. */
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      await setupUser().click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(await screen.findByRole('heading', { level: 2, name: /^Čeka proveru 3/ })).toBeVisible()
      expect(screen.queryByText(/Rešeno je/)).toBeNull()
    } finally {
      confirm.mockRestore()
    }
  })

  it('holds back a change of date while the events themselves are still coming', async () => {
    /* The other half of the same hold. Without the events the day the event is
       moved from is the day the report claims, and a second report about the
       same change then moves the races again from a day the event has already
       left: two reports of one change, and the races a week past the event they
       are run at. The queue holds both reports of the Beogradski maraton, which
       is what a reported change is made of. */
    restore = stallResource('events')

    const user = setupUser()
    renderAt('/sr/administracija/verifikacija/termini', 'superadmin')

    const cards = within(await screen.findByRole('list', { name: /Čeka proveru/ }))
    const approve = first(cards.getAllByRole('button', { name: 'Odobri' }))

    expect(approve).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(/Odluka čeka događaj/)).toBeVisible()

    await user.click(approve)

    expect(await screen.findByRole('heading', { level: 2, name: /^Čeka proveru 3/ })).toBeVisible()
  })

  it.each(BOTH)(
    'says %s failed rather than that it is waiting for it',
    async (name) => {
      /* Two different things, and `dataOr` answers the same for both: told to
         wait for a file that will never come, a moderator who holds the right is
         refused it for good and reads a sentence that is not true. */
      restore = breakResource(name)
      renderAt('/sr/administracija/verifikacija/termini', 'superadmin')

      await screen.findByRole('list', { name: /Čeka proveru/ })

      expect(screen.getByText(/se ne mogu učitati/)).toBeVisible()
      expect(screen.queryByText(/Odluka čeka/)).toBeNull()
    },
  )


  /* The other half of the same rule: a screen must still fail on data it does
   * show, so the cases above cannot be satisfied by swallowing every error. */
  it('still says so when the data a screen does show cannot be loaded', async () => {
    restore = breakResource('leagues')
    renderAt('/sr/liga/runtrace-2027')

    expect(await screen.findByRole('alert')).toHaveTextContent('Podaci se ne mogu učitati.')
  })
})
