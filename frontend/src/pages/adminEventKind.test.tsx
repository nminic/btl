import { act, screen, within } from '@testing-library/react'
import { at, must } from '../test/at'
import { renderAt } from '../test/render'
import { THE_SAVE_ASKS, sayNoToTheSave, sayYesToTheSave, theSaveSheet } from '../test/saveSheet'
import { setupUser } from '../test/user'

/* One question, in a file of its own: what the screen does when somebody saves an event in a way that takes its
 * races away, and the results have not arrived, have failed, or are here.
 *
 * Apart from the rest because it refuses the file of results, and the portal reads a file once and keeps the
 * answer. Left among the other tests of this screen, that refusal was still the answer for every test after it:
 * forty-eight of them failed, none of them over anything they were about.
 *
 * THE DECISION OF 07.11.2026 (owner, chosen between offered outcomes, PDL „I čuvanje događaja koje briše njegove
 * trke radi isto"): such a save does not wait for the results, as it did until then (`admin.waitingForResults`,
 * `admin.resultsFailed`, both gone with it), and asks first, with the number of results that go with the races. It
 * is the sheet that asks before an event is deleted (owner, 28.09.2026), whose own cases are
 * `pages/admin/deletionSheet.test.tsx`.
 *
 * THE EVENT AND ITS NUMBERS, taken from the sample and asserted below so a change of the sample says so: Bešnjaja
 * trek, whose two races have one result and three results (races 141 and 142, the table drawing 142 first).
 */

const TWO_RACES_AND_FOUR_RESULTS = 'Ovim čuvanjem brišeš 2 trke i 4 rezultata.'
const THE_NUMBER_IS_NOT_KNOWN = 'Ovim čuvanjem brišeš 2 trke, a broj rezultata koji odlaze još nije poznat.'

/** What was sent that is not a read, as `METHOD path`, in the order it was sent. */
let written: string[] = []

/** Lets the file of results through, for the case in which it arrives while the question is on the screen. */
let letTheResultsThrough: () => void = () => undefined

/** Serves the portal as it is, with the file of results as the case says, and notes every request that writes. */
function stubFetch(results: 'refused' | 'never settles' | 'arrives late' | 'served'): () => void {
  const served = globalThis.fetch

  written = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET'

    if (method !== 'GET') {
      written.push(`${method} ${String(input)}`)
    }

    if (method === 'GET' && String(input).includes('results') && results !== 'served') {
      if (results === 'refused') {
        return new Response('', { status: 500 })
      }

      return new Promise<Response>((resolve) => {
        letTheResultsThrough = results === 'arrives late' ? () => resolve(served(input, init)) : () => undefined
      })
    }

    return served(input, init)
  })

  return () => {
    vi.stubGlobal('fetch', served)
  }
}

async function openTheEvent(search: string | null) {
  const user = setupUser()

  renderAt('/sr/administracija/dogadjaji', 'superadmin')

  if (search !== null) {
    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), search)
  }

  const rows = within(await screen.findByRole('table', { name: 'Događaji' })).getAllByRole('row')

  await user.click(
    within(must(at(rows, 1), 'the event searched for')).getByRole('button', { name: /^Otvori/ }),
  )
  await screen.findByRole('heading', { name: /^Trke na događaju/ })

  return user
}

describe('an event saved in a way that takes its races away', () => {
  it('asks at once, and says the number of results is not known, while the results have failed', async () => {
    /* The save used to be refused here, and said `admin.resultsFailed` under the form. It does not wait for a file
       that never comes any more: it asks, and says what it cannot yet say. */
    const undo = stubFetch('refused')

    try {
      const user = await openTheEvent('Bešnjaja')

      await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'gathering')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      const sheet = within(await theSaveSheet())

      expect(sheet.getByText(THE_NUMBER_IS_NOT_KNOWN)).toBeVisible()
      expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()
      expect(screen.queryByText(/^Brisanje/)).toBeNull()
      expect(written, 'nothing is sent before the answer').toEqual([])
    } finally {
      undo()
    }
  })

  it('asks at once, and says the same, while the results are still coming', async () => {
    /* A file on its way and a file that failed are one sentence on the row that deletes the event (owner,
       28.09.2026), and so they are here: to the reader about to press, both are the same fact, that the portal cannot
       tell him the number at this moment. The file never settles, which is what „on its way" is. */
    const undo = stubFetch('never settles')

    try {
      const user = await openTheEvent('Bešnjaja')

      await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'gathering')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(within(await theSaveSheet()).getByText(THE_NUMBER_IS_NOT_KNOWN)).toBeVisible()
      expect(written).toEqual([])
    } finally {
      undo()
    }
  })

  it('says the number as soon as the results arrive, while the question is on the screen', async () => {
    /* The number is read at every draw and not once at the press: a press that lands before the largest file the
       portal has is here sees the sentence say so, and the same sheet says the number when the file comes. */
    const undo = stubFetch('arrives late')

    try {
      const user = await openTheEvent('Bešnjaja')

      await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'gathering')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(within(await theSaveSheet()).getByText(THE_NUMBER_IS_NOT_KNOWN)).toBeVisible()

      await act(async () => {
        letTheResultsThrough()
      })

      expect(await within(await theSaveSheet()).findByText(TWO_RACES_AND_FOUR_RESULTS)).toBeVisible()
      expect(screen.queryByText(THE_NUMBER_IS_NOT_KNOWN)).toBeNull()
    } finally {
      undo()
    }
  })

  it('says the races and the results of the event when the kind is changed', async () => {
    const undo = stubFetch('served')

    try {
      const user = await openTheEvent('Bešnjaja')

      await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'gathering')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(within(await theSaveSheet()).getByText(TWO_RACES_AND_FOUR_RESULTS)).toBeVisible()
    } finally {
      undo()
    }
  })

  it('counts only the race taken off the table, and only its results, for an event that stays a race', async () => {
    /* The save deletes what was filed and not what is on the screen, and the number is the number of the races it
       takes: one of two, with the three results that race has (the first on the table, race 142) and not the four of
       both. Counted over the event's races it would say two races and four results, and counted over the event's
       address the same; the two sources give one answer only where the event loses all its races, which is the case
       above. */
    const undo = stubFetch('served')

    try {
      const user = await openTheEvent('Bešnjaja')

      await user.click(
        must(at(screen.queryAllByRole('button', { name: /^Obriši \d+\. trku$/ }), 0), 'the first race of the event'),
      )

      /* Still a race, and still a table. */
      expect(screen.getByLabelText(/^Vrsta događaja/)).toHaveValue('race')

      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      const sheet = within(await theSaveSheet())

      expect(sheet.getByText('Ovim čuvanjem brišeš 1 trku i 3 rezultata.')).toBeVisible()
      expect(sheet.queryByText(TWO_RACES_AND_FOUR_RESULTS)).toBeNull()
    } finally {
      undo()
    }
  })

  it('says the races taken off the table even when the rows were taken off the screen first', async () => {
    /* The save deletes what was filed, not what is on the screen, so the question has to count the same thing. Delete
       every row of the event, change the kind, press Sačuvaj: the races still go, and the number says so. */
    const undo = stubFetch('served')

    try {
      const user = await openTheEvent('Bešnjaja')

      for (const button of screen.queryAllByRole('button', { name: /^Obriši \d/ })) {
        await user.click(button)
      }

      expect(screen.queryAllByRole('group', { name: /^\d+\. trka$/ })).toHaveLength(0)

      await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'gathering')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(within(await theSaveSheet()).getByText(TWO_RACES_AND_FOUR_RESULTS)).toBeVisible()
    } finally {
      undo()
    }
  })

  it('sends the save only when the answer is yes, and then confirms it', async () => {
    const undo = stubFetch('served')

    try {
      const user = await openTheEvent('Bešnjaja')

      await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'gathering')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(written, 'the question comes first').toEqual([])

      await sayYesToTheSave(user)

      expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
      expect(written.length, 'the answer sent the save').toBeGreaterThan(0)
      expect(screen.queryByRole('dialog', { name: THE_SAVE_ASKS })).toBeNull()
    } finally {
      undo()
    }
  })

  it('sends nothing when the answer is no, and leaves the form as it was typed', async () => {
    const undo = stubFetch('served')

    try {
      const user = await openTheEvent('Bešnjaja')

      await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'gathering')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await sayNoToTheSave(user)

      expect(screen.queryByRole('dialog', { name: THE_SAVE_ASKS })).toBeNull()
      expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()
      expect(written, 'a no writes nothing').toEqual([])
      expect(screen.getByLabelText(/^Vrsta događaja/)).toHaveValue('gathering')
    } finally {
      undo()
    }
  })

  it('lets through a save whose races are all still there, with no question', async () => {
    /* The other direction of the same question: measured only for what it asks, a question can be made to ask about
       everything and no test says so. Mutation measured: with `survives` ignored, every filed race counts as taken
       away and every save of an event with races asks, over a deletion that never happens.

       Nothing is touched here on purpose: a press that changes nothing is the press that must never ask. */
    const undo = stubFetch('refused')

    try {
      const user = await openTheEvent('Bešnjaja')

      /* Still a race, and every row it was filed with is still on the table. */
      expect(screen.getByLabelText(/^Vrsta događaja/)).toHaveValue('race')
      expect(screen.getAllByRole('button', { name: /^Obriši \d+\. trku$/ })).toHaveLength(2)

      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
      expect(screen.queryByRole('dialog')).toBeNull()
    } finally {
      undo()
    }
  })

  it('lets through a gathering that has no races to take away, with no question', async () => {
    /* The question is about a deletion, so where there is nothing to delete there is nothing to ask. Measured by a
       round when the gate asked the kind alone: a gathering with no races at all was held over a deletion that was
       never going to happen. */
    const undo = stubFetch('refused')

    try {
      const user = setupUser()

      renderAt('/sr/administracija/dogadjaji', 'superadmin')
      await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), 'BTL sreda')

      const rows = within(await screen.findByRole('table', { name: 'Događaji' })).getAllByRole('row')

      await user.click(
        within(must(at(rows, 1), 'a gathering in the list')).getByRole('button', { name: /^Otvori/ }),
      )

      const form = within(await screen.findByRole('form', { name: /^Izmena događaja/ }))

      expect(form.getByLabelText(/^Vrsta događaja/)).toHaveValue('gathering')
      expect(screen.queryByRole('region', { name: /^Trke na događaju/ })).toBeNull()

      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(await screen.findByRole('status', { name: 'Sačuvano' })).toBeVisible()
      expect(screen.queryByRole('dialog')).toBeNull()
    } finally {
      undo()
    }
  })
})
