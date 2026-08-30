import { screen, within } from '@testing-library/react'
import type { Race } from '../data/types'
import { first, must } from '../test/at'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

/**
 * What the screens do with a race that fixes no length.
 *
 * A file of its own, and it serves its own races, for two reasons. Every race in
 * `public/mock/races.json` is a race of a length, so nothing in the package can ask
 * these questions off the data as it stands. And a test that refuses or reshapes a
 * file poisons every test after it in the same file, because the portal reads a
 * file once and keeps the answer, which is the lesson `adminEventKind.test.tsx` was
 * split out over.
 *
 * The owner named the two kinds on 29.08.2026 and 30.08.2026: a timed race is
 * measured by how long it lasts and a free one by nothing at all, so on both of
 * them the length is nought and nought is not a length.
 */

/**
 * The real file, every race in it run to a limit of twenty four hours and no fixed
 * length: the shape the owner's own example has („Šri Činmoj ultramaraton 2026.
 * (24 h)"). All of them rather than one, so whichever event a screen opens holds
 * them.
 *
 * Reshaped inside the stub and not fetched first and handed over, because the
 * portal keeps the answer to a file it has already read: a round of this asked
 * `loadResource` for the races before installing the stub, and the screen went on
 * drawing the file as it really is while the case passed anyway.
 */
function servingRaces(
  real: typeof globalThis.fetch,
  said: (race: Race) => Record<string, unknown>,
): typeof globalThis.fetch {
  return async (input: RequestInfo | URL) => {
    if (!String(input).endsWith('/races.json')) {
      return real(input)
    }

    const all: Race[] = await (await real(input)).json()

    return new Response(JSON.stringify(all.map(said)), { status: 200 })
  }
}

/** Every race run to a limit of twenty four hours and no fixed length. */
const asTimed = (race: Race) => ({ ...race, kind: 'time', limitSeconds: 86_400, distanceKm: 0 })

describe('a race that fixes no length', () => {
  it('leaves the length column empty rather than saying it is nought kilometres', async () => {
    /* The grid of a competition settled this shape already (PDL, 31.07.2026): a
       race somebody did not run is an empty cell and not a nought, „jer nula tvrdi
       da je trčao i osvojio nula". A nought under „Dužina" says the same untrue
       thing about the course, that somebody measured it and it came to nothing.

       „The cell is empty" cannot pass on a screen that never saw the served file,
       because the races in the file all have lengths and this one would then read
       „21,10"; that is how a round of this was caught reading the real file while
       passing. The other two halves are asked all the same: the name in the same
       row carries „24 h", which is the whole way from the served record through
       `raceLabel` to the screen, and the first cell is not empty, so nothing here
       can pass on a table that had stopped drawing rows.

       Opened as a member, because the column that names the race is the one that
       leads into the form and a visitor is offered no way in. */
    const real = globalThis.fetch

    globalThis.fetch = servingRaces(real, asTimed)

    try {
      renderAt('/sr/kalendar/jagodinski-maraton-2017', 'competitor', '000001')

      const table = await screen.findByRole('table', { name: /^Trke/ })
      const heads = within(table)
        .getAllByRole('columnheader')
        .map((one) => one.textContent)
      const at = heads.indexOf('Dužina')

      expect(at, 'the table no longer has a column of lengths').toBeGreaterThan(-1)

      const row = must(within(table).getAllByRole('row')[1], 'the first race of the event')
      const cells = within(row).getAllByRole('cell')

      expect(
        within(row).getByRole('link', { name: /24 h/ }),
        'the row is not naming a timed race, so the page did not read the served file',
      ).toBeVisible()
      expect(must(cells[at], 'the length of the first race').textContent).toBe('')
      expect(first(cells).textContent).not.toBe('')
    } finally {
      globalThis.fetch = real
    }
  })

  it('reads a kind it does not know as a race of a length, and goes on asking for one', async () => {
    /* The one place a word this portal has never heard of can arrive: a file it did
       not write. Every race it writes itself carries one of the three
       (`admin/raceRows.ts`, `event/copiedRace.ts`) and the file it ships is held to
       them (`data/data.test.tsx`), so this is the shape of the day a backend or an
       import hands one over.

       Read as a race of a length, which is what every race was before the field
       existed, and asked for a length accordingly. Without that reading the row
       would carry „ludilo", nothing would ask it for a length, and an event whose
       races have none would save as though it were sound. */
    const real = globalThis.fetch
    const user = setupUser()

    globalThis.fetch = servingRaces(real, (race) => ({ ...race, kind: 'ludilo', distanceKm: 0 }))

    try {
      renderAt('/sr/administracija/dogadjaji', 'superadmin')

      const rows = within(await screen.findByRole('table', { name: 'Događaji' })).getAllByRole(
        'row',
      )

      await user.click(
        within(must(rows[1], 'the first event')).getByRole('button', { name: /^Otvori/ }),
      )
      await screen.findByRole('table', { name: /^Trke/ })
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(await screen.findByText(/Svaka trka mora da ima naziv, dan i dužinu/)).toBeVisible()
    } finally {
      globalThis.fetch = real
    }
  })

  it('lets the event it belongs to be saved, rather than asking for a length it has not got', async () => {
    /* The table of races refuses a length below a tenth of a kilometre, on purpose:
       a nought passes „not empty" and is not a distance, and the whole standing is
       worked out from it. A race that fixes no length carries exactly that nought,
       so until 30.08.2026 an event holding one could not be saved at all, and the
       refusal named a column that race has no answer for.

       Measured through the screen and not through the record, because the two
       halves refuse in different places: the record keeps the kind through a save
       (`admin/raceRows.test.ts`), and this is the half that decides whether the
       save happens. A sentence written the day before said the record's half in the
       screen's words, and it was wrong.

       This is also the only case that reads the kind off a stored record: without
       `racesUnder` reading it, the row comes back a race of a length, the table
       asks it for one, and the save is refused again.

       The refusal is asked for by its own words rather than by „Sačuvano" being
       absent, so a screen that saved nothing and said nothing cannot pass. */
    const real = globalThis.fetch
    const user = setupUser()

    globalThis.fetch = servingRaces(real, asTimed)

    try {
      renderAt('/sr/administracija/dogadjaji', 'superadmin')

      const rows = within(await screen.findByRole('table', { name: 'Događaji' })).getAllByRole(
        'row',
      )

      await user.click(
        within(must(rows[1], 'the first event')).getByRole('button', { name: /^Otvori/ }),
      )

      const races = await screen.findByRole('table', { name: /^Trke/ })

      expect(
        within(races).getAllByRole('row').length,
        'the event has no races, so nothing here is being refused or allowed',
      ).toBeGreaterThan(1)

      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(
        screen.queryByText(/Svaka trka mora da ima naziv, dan i dužinu/),
        'the event is refused over a length its races do not fix',
      ).toBeNull()
      expect(await screen.findByText('Sačuvano')).toBeVisible()
    } finally {
      globalThis.fetch = real
    }
  })
})
