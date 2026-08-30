import { screen, within } from '@testing-library/react'
import { SLOW } from '../test/slow'
import { loadResource } from '../data/client'
import { btlPoints } from '../data/scoring'
import { formatPoints } from '../i18n/format'
import type { Race } from '../data/types'
import { first, must } from '../test/at'
import { renderAt } from '../test/render'
import { Reported } from '../test/saved'
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

const EVENT = 'jagodinski-maraton-2017'

/**
 * The address of the form for reporting a result on the first race of that event.
 *
 * Asked after the stub is in place and never before it: the portal keeps the answer
 * to a file it has already read, so a load taken first would cache the races as they
 * really are and the screen would go on drawing those while the case passed anyway.
 */
async function reportAddress() {
  const events = await loadResource<{ id: string; slug: string }[]>('events')
  const held = must(
    events.find((one) => one.slug === EVENT),
    'the event these cases are written around',
  )
  const race = first(
    (await loadResource<Race[]>('races')).filter((one) => one.eventId === held.id),
  )

  return `/sr/kalendar/${EVENT}/prijava?trka=${race.id}`
}

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
      renderAt(`/sr/kalendar/${EVENT}`, 'competitor', '000001')

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

      expect(await screen.findByText(/Svaka trka mora da ima naziv i dan/)).toBeVisible()
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

      /* Tied to the served file before anything is pressed. „It saved" on its own
         is green on a screen that never saw the stub at all, since an event of
         ordinary races saves perfectly well; the cell of a race that fixes no
         length is the one thing here that cannot be true of the real file. */
      expect(
        within(races).getAllByRole('spinbutton', { name: /^Dužina/ })[0],
        'the first length is required, so these are not the served races',
      ).toHaveAttribute('aria-required', 'false')

      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(
        screen.queryByText(/Svaka trka mora da ima naziv i dan/),
        'the event is refused over a length its races do not fix',
      ).toBeNull()
      expect(await screen.findByText('Sačuvano')).toBeVisible()
    } finally {
      globalThis.fetch = real
    }
  })

  it('does not mark the length of such a race wrong when another row is refused', async () => {
    /* Refusing a save marks every cell that is actually wrong, one by one, because
       a row that says it is fine sends a reader looking somewhere else (WCAG 2.2
       SC 3.3.1). A race that fixes no length has nothing wrong with its length, and
       marking it wrong sends the reader into a cell they have nothing to fix with:
       every value they could type would give a length to a race that has none.

       The refusal is real and comes from the empty row added just before, so this
       measures the marking rather than the absence of a refusal. */
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
      await screen.findByRole('table', { name: /^Trke/ })
      await user.click(screen.getByRole('button', { name: 'Nova trka' }))
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

      expect(
        await screen.findByText(/Svaka trka mora da ima naziv i dan/),
        'nothing was refused, so there is no marking to measure',
      ).toBeVisible()

      const lengths = screen.getAllByRole('spinbutton', { name: /^Dužina/ })

      /* Tied to the served file: with the races as they really are, the first row
         is a race of a length and this reads „true", so the case cannot pass on a
         screen the stub never reached. */
      expect(
        first(lengths),
        'the first length is required, so these are not the served races',
      ).toHaveAttribute('aria-required', 'false')
      /* And it no longer announces bounds it does not hold to. Asked beside the two
         attributes above because all of them are read off one answer, and a control
         that says „at least 0,1" over a value of nought announces a rule that was
         lifted from it.

         Both ends, and both directions. „It has no floor" alone is satisfied by a
         table that announces none anywhere, which is 1612 races of a length left
         without the one they do hold to; the row that really is bounded is asked
         for its own in the same breath. */
      expect(first(lengths), 'the length still announces a floor').not.toHaveAttribute('min')
      expect(first(lengths), 'the length still announces a ceiling').not.toHaveAttribute('max')

      const last = must(lengths[lengths.length - 1], 'the row just added')

      expect(last, 'the row that is bounded lost its floor').toHaveAttribute('min', '0.1')
      expect(last, 'the row that is bounded lost its ceiling').toHaveAttribute('max', '1000')

      const climbs = screen.getAllByRole('spinbutton', { name: /^Uspon/ })

      /* The climb is never required and always bounded, so it holds its own even on
         the race the length was lifted from: the exemption is about one field and
         not about the row. */
      expect(first(climbs), 'the climb lost its bounds with the length').toHaveAttribute(
        'min',
        '0',
      )
      expect(first(lengths), 'the length of a race that fixes none is marked wrong').toHaveAttribute(
        'aria-invalid',
        'false',
      )
      /* And the row that really is missing one still says so, so the exemption
         cannot widen to the whole column. */
      expect(must(lengths[lengths.length - 1], 'the row just added')).toHaveAttribute(
        'aria-invalid',
        'true',
      )
    } finally {
      globalThis.fetch = real
    }
  })

  it('leaves the member the fields the race cannot answer for, unlocked and empty', async () => {
    /* The owner, 29.08.2026: „Na vremenskoj trci član unosi dužinu, uspon i spust."
       A course run in laps has a climb that depends on how many laps somebody ran,
       so the race cannot know any of the three and the member has to.

       The renderer locks by the keys of what a suggestion fills in, not by the
       values (`forms/FormRenderer.tsx`, `setLed(Object.keys(one.fills))`), so
       handing over an empty string is not the same as handing over nothing: a
       round of this filled the length with „" and called the field theirs to fill,
       and it was empty and locked at once, which is a form nobody can send. ADL A32
       wrote that rule down after the same fault in another form.

       Measured by typing, which is the only half that matters to a member: an
       attribute can be right while the control still refuses the key. */
    const real = globalThis.fetch
    const user = setupUser()

    globalThis.fetch = servingRaces(real, asTimed)

    try {
      renderAt('/sr/rezultat/novi', 'competitor', '000001')

      await user.type(await screen.findByLabelText(/^Naziv trke/), 'beogradski maraton')

      /* The suggestions are buttons in the list the box owns, not options: a round
         of this asked for options, was handed the role switch in the header, chose
         a role, and went on to measure a length field nothing had ever filled in.
         The row is read before it is pressed, so the case cannot pass on a screen
         the stub never reached. */
      const suggested = within(screen.getByRole('list', { name: '' })).getAllByRole('button')

      expect(
        first(suggested).textContent,
        'the row offered is not naming a timed race, so these are not the served races',
      ).toMatch(/24 h$/)

      await user.click(first(suggested))

      const length = await screen.findByLabelText(/^Dužina/)

      expect(length).not.toHaveAttribute('readonly')
      expect(length).not.toHaveAttribute('aria-disabled', 'true')

      await user.type(length, '42.2')

      expect(length).toHaveValue(42.2)
    } finally {
      globalThis.fetch = real
    }
  })

  it('scores a timed race against the limit of the race and not against a time nobody gave', async () => {
    /* Owner, 29.08.2026, on four offered readings: the formula is unchanged and on a
       timed race `Tsec` is the race's own limit, 24 h = 86400 s, the same for
       everyone who finished. He turned down the reading where it is the time a
       runner spent, because that one rewards stopping: 60 km in 6 h would beat the
       same 60 km run out over the full 24.

       Measured through the whole way in: the form for such a race asks for no time
       at all (`reportForm.ts`), so a screen that went on reading a time off the
       values would score the member at nought points and this would say so. The
       number is worked out here from the same function the portal uses, since the
       formula is the owner's and this case is about which time goes into it, not
       about what it gives back. */
    const real = globalThis.fetch
    const user = setupUser()

    globalThis.fetch = servingRaces(real, asTimed)

    try {
      renderAt(await reportAddress(), 'competitor', '000001', undefined, null, <Reported />)

      const note = await screen.findByText(/^Prijavljuješ rezultat sa trke/)

      expect(note.textContent, 'the sentence is not the one a timed race gets').toMatch(
        /Vreme portal već zna sa same trke/,
      )
      expect(screen.queryByLabelText(/^Sati/), 'a timed race is asking for a time').toBeNull()

      /* Climb and fall differ, and neither is nought: with both the same a screen
         that read one for the other would be measured as right, and with both
         nought the formula could not tell them apart either. */
      await user.type(await screen.findByLabelText(/^Dužina/), '60')
      await user.type(screen.getByLabelText(/^Uspon/), '2000')
      await user.type(screen.getByLabelText(/^Spust/), '500')
      await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
      await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

      const earned = btlPoints(60, 2_000, 500, 86_400) ?? 0

      expect(earned, 'the formula gave nothing, so the case would pass on anything').toBeGreaterThan(
        0,
      )
      expect(await screen.findByText(new RegExp(formatPoints(earned, 'sr-Latn')))).toBeVisible()

      /* And what is sent, which is the half the screen never shows the member.
         `reportedResult` is measured on its own, but nothing said that this screen
         hands its answers on: every one of these could be replaced by a figure off
         the race and the member would still be told the right number of points,
         because that is read separately.

         All six as one string (`test/saved.tsx`), and not the moderator's row: that
         row draws five of them as cells whose text a case can only search, so „500"
         found in it is as true of the fall as of the climb, and the sixth, the
         category, it does not draw at all. */
      expect(
        must(
          within(await screen.findByRole('list', { name: 'reported figures' })).getAllByRole(
            'listitem',
          )[0],
          'the record that was just sent',
        ).textContent,
      ).toBe(`km=60 up=2000 down=500 sec=86400 pts=${earned} cat=ultra`)
    } finally {
      globalThis.fetch = real
    }
  }, SLOW)

  it('says of a free race that it fixes neither, and asks for all four', async () => {
    /* The third kind, which fixes nothing: the member gives the length, the climb,
       the fall and the time. Its sentence is its own because the sentence says what
       the portal already knows, and on a free race that is nothing at all.

       Asked on the screen and not only of the form, because the sentence and the
       fields are chosen in two different places and a case about one of them says
       nothing about the other. */
    const real = globalThis.fetch

    globalThis.fetch = servingRaces(real, (one) => ({ ...one, kind: 'free', distanceKm: 0 }))

    try {
      renderAt(await reportAddress(), 'competitor', '000001')

      const note = await screen.findByText(/^Prijavljuješ rezultat sa trke/)

      expect(note.textContent).toMatch(/ne zadaje ni dužinu ni vreme/)
      expect(await screen.findByLabelText(/^Dužina/)).toBeVisible()
      expect(screen.getByLabelText(/^Uspon/)).toBeVisible()
      expect(screen.getByLabelText(/^Spust/)).toBeVisible()
      expect(screen.getByLabelText(/^Sati/), 'a free race is not asking for a time').toBeVisible()
    } finally {
      globalThis.fetch = real
    }
  }, SLOW)

  it('names a race of a kind it does not know the same way in the cell and in the link', async () => {
    /* One word, three readers, and until 30.08.2026 two answers in one row: the cell
       read the word itself and left the length out, while the link beside it named
       the race „(21,1 km)" and the form behind that link took 21,1 km off the race.
       A reader was told in one row both that the race has no length and what its
       length is.

       Read as a race of a length everywhere, which is what every race was before the
       field existed. Both halves asked, because either alone is satisfied by a row
       that says nothing at all. */
    const real = globalThis.fetch

    /* What this can and cannot say, since the two are easy to confuse. A word the
       portal does not know is **meant** to be drawn exactly as a race of a length,
       so no screen can tell the two apart and no served word can make this case fall
       on its own: serving „length" here passes too, and that is the contract rather
       than a hole. What falls is the code: reading the word off the record instead
       of through `raceKind` empties the cell while the link beside it goes on naming
       the length, and that is measured (mutation, 30.08.2026).

       The served length is changed all the same, and it is the only thing here that
       cannot be true of the real file, so the case cannot pass on a screen the stub
       never reached. */
    globalThis.fetch = servingRaces(real, (one) => ({ ...one, kind: 'ludilo', distanceKm: 33.3 }))

    try {
      renderAt(`/sr/kalendar/${EVENT}`, 'competitor', '000001')

      const table = await screen.findByRole('table', { name: /^Trke/ })
      const heads = within(table)
        .getAllByRole('columnheader')
        .map((one) => one.textContent)
      const row = must(within(table).getAllByRole('row')[1], 'the first race of the event')
      const cells = within(row).getAllByRole('cell')
      const said = must(cells[heads.indexOf('Dužina')], 'the length of the first race').textContent

      /* The cell writes two decimals and the name writes one, so the two are not
         compared as strings; what is asked is that both of them say a length at all.
         Either alone is satisfied by the row that was drawn before this was put
         right: the cell empty and the link saying „(21,1 km)". */
      expect(said, 'the cell is not reading the served races').toBe('33,30')
      expect(
        must(
          within(row).getByRole('link', { name: /^Unesi rezultat/ }).getAttribute('aria-label'),
          'the way into the form',
        ),
        'the link names a different measure from the cell beside it',
        /* „(33,3 km)" or „(33,30 km)": with every race of the event served at one
           length the ladder climbs past the rough reading, and which rung it stops
           on is `raceLabel`'s business and has its own cases. What is asked here is
           that the link names that length at all. */
      ).toContain('(33,3')
    } finally {
      globalThis.fetch = real
    }
  }, SLOW)

  it('draws the form for a kind it does not know rather than falling over', async () => {
    /* The type says one of three and the file says whatever it says. Both of the
       things this screen chooses by the kind are written one per kind, a form and a
       sentence, and a lookup with a word that is not there gives `undefined`:
       handed to the translator or to the renderer, that takes the whole screen down
       to the error boundary. Measured on 30.08.2026 on a screen that had drawn this
       form perfectly well the day before.

       Read as a race of a length, which is what every race was before the field
       existed, so what the member meets is the form they would have met anyway. */
    const real = globalThis.fetch

    globalThis.fetch = servingRaces(real, (one) => ({ ...one, kind: 'ludilo' }))

    try {
      renderAt(await reportAddress(), 'competitor', '000001')

      const note = await screen.findByText(/^Prijavljuješ rezultat sa trke/)

      expect(note.textContent).toMatch(/Dužinu, uspon i spust portal već zna sa same trke/)
      expect(screen.getByLabelText(/^Sati/)).toBeVisible()
      expect(screen.queryByLabelText(/^Dužina/), 'it is asking for what it knows').toBeNull()
    } finally {
      globalThis.fetch = real
    }
  }, SLOW)
})
