import { screen, within } from '@testing-library/react'
import { at, must } from '../test/at'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

/* One question, in a file of its own: what the screen does when the results have
 * not arrived and somebody saves an event as a gathering.
 *
 * Apart from the rest because it refuses the file of results, and the portal reads
 * a file once and keeps the answer. Left among the other tests of this screen, that
 * refusal was still the answer for every test after it: forty-eight of them failed,
 * none of them over anything they were about.
 */
describe('an event saved with no races, before the results are here', () => {
  it('waits for them rather than taking the races away without them', async () => {
    /* The save deletes the races and their results together, and until the results
       are here there is nothing to take along. The row that deletes a whole event
       holds its button for the same reason and says the same words
       (`admin.waitingForResults`).

       Measured by a round before this was here: with the results refused, every race
       went and every result stayed, each of them still counting in the standing and
       pointing at a race that does not exist, while the screen said „Sačuvano". */
    const served = globalThis.fetch
    const user = setupUser()

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('results') ? new Response('', { status: 500 }) : served(input, init),
    )

    try {
      renderAt('/sr/administracija/dogadjaji', 'superadmin')

      const rows = within(await screen.findByRole('table', { name: 'Događaji' })).getAllByRole(
        'row',
      )

      await user.click(
        within(must(at(rows, 1), 'the first event')).getByRole('button', { name: /^Otvori/ }),
      )
      await screen.findByRole('heading', { name: /^Trke na događaju/ })
      await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'gathering')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()

      /* The words of a file that failed, not of one still on its way. The row that
         deletes a whole event tells those two apart on this same screen, and a round
         measured that this did not: „waiting" over a file that will never come is a
         screen asking somebody to wait forever. Refused with 500 here, so the words
         are the ones that fit a refusal. */
      expect(screen.getByText('Brisanje nije moguće: rezultati se ne mogu učitati')).toBeVisible()
    } finally {
      vi.stubGlobal('fetch', served)
    }
  })

  it('says the results are still coming while they are still coming', async () => {
    /* The other of the two states, and the reason they are two: a file on its way
       will arrive, a file that failed will not, and „waiting" over the second is a
       screen asking somebody to wait forever. The row that deletes a whole event
       tells them apart on this same screen, and a round measured that this did not.

       The file never settles here rather than failing, which is what „on its way"
       is. */
    const served = globalThis.fetch
    const user = setupUser()

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('results')
        ? new Promise<Response>(() => undefined)
        : served(input, init),
    )

    try {
      renderAt('/sr/administracija/dogadjaji', 'superadmin')

      const rows = within(await screen.findByRole('table', { name: 'Događaji' })).getAllByRole(
        'row',
      )

      await user.click(
        within(must(at(rows, 1), 'the first event')).getByRole('button', { name: /^Otvori/ }),
      )
      await screen.findByRole('heading', { name: /^Trke na događaju/ })
      await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'gathering')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()
      expect(screen.getByText('Brisanje čeka rezultate')).toBeVisible()
    } finally {
      vi.stubGlobal('fetch', served)
    }
  })

  it('lets through a gathering that has no races to take away', async () => {
    /* The refusal is about a deletion, so where there is nothing to delete there is
       nothing to wait for. Measured by a round before this was here: asked of the
       kind alone, a gathering with no races at all was refused over a deletion that
       was never going to happen, and the file it was waiting for is the largest the
       portal has. This screen is built to work without it. */
    const served = globalThis.fetch
    const user = setupUser()

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('results') ? new Response('', { status: 500 }) : served(input, init),
    )

    try {
      renderAt('/sr/administracija/dogadjaji', 'superadmin')

      await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), 'BTL sreda')

      const rows = within(await screen.findByRole('table', { name: 'Događaji' })).getAllByRole(
        'row',
      )

      await user.click(
        within(must(at(rows, 1), 'a gathering in the list')).getByRole('button', {
          name: /^Otvori/,
        }),
      )

      const form = within(await screen.findByRole('form', { name: /^Izmena događaja/ }))

      expect(form.getByLabelText(/^Vrsta događaja/)).toHaveValue('gathering')
      expect(screen.queryByRole('table', { name: /^Trke na događaju/ })).toBeNull()

      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
      expect(screen.queryByText(/^Brisanje/)).toBeNull()
    } finally {
      vi.stubGlobal('fetch', served)
    }
  })
})
