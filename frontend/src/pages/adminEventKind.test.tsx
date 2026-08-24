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
      expect(screen.getByText('Brisanje čeka rezultate')).toBeVisible()
    } finally {
      vi.stubGlobal('fetch', served)
    }
  })
})
