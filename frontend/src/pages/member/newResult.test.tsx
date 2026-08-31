import { RACE_KINDS } from '../../data/types'
import { fireEvent, screen, within } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { loadResource } from '../../data/client'
import type { BtlEvent, Race } from '../../data/types'
import { first, htmlElement, inputElement, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { racesToOffer } from './racesToOffer'
import { setupUser } from '../../test/user'
import { useSession } from '../../session/useSession'

/**
 * The form a result is entered on from a profile, away from the calendar.
 *
 * What is held here is the part of it the owner asked for on 23.08.2026: the
 * list of races under the name of an event, what choosing one does to the fields
 * under it, what editing the name afterwards undoes, and the way out of a picture
 * that was attached by mistake.
 */

const ME = '000007'
const NEW = '/sr/rezultat/novi'
/** A day inside the data, so what the list offers is the same list every time
 *  this runs rather than the same list until the calendar catches up. */
const TODAY = '2026-08-23'

/** The box the name of the event is typed into. */
function raceName(): HTMLElement {
  return screen.getByLabelText(/^Naziv trke/)
}

/** What the list under it offers, in the order it offers it. */
function offered(): string[] {
  const list = screen.queryByRole('list', { name: '' })

  return list === null
    ? []
    : within(list)
        .getAllByRole('button')
        .map((one) => one.textContent ?? '')
}

/** The four the calendar fills in, by the name each is asked under. */
const FILLED = [/^Datum/, /^Dužina/, /^Uspon/, /^Spust/] as const

/* One event and a way of shaping a race under it, for the cases that ask what a
   race is offered by. Written here rather than inside one of them, because two
   cases ask the same question of the same three races: what the row says, and
   what choosing it fills in. */
const held: BtlEvent = {
  id: 'e1',
  slug: 'dogadjaj-2026',
  name: 'Događaj',
  date: '2026-09-19',
  city: 'Beograd',
  country: 'RS',
  kind: 'race',
  featured: 'no',
  description: '',
  link: '',
  copiedFrom: '',
}
const shaped = (over: Partial<Race>): Race => ({
  id: 'r',
  eventId: 'e1',
  name: 'Trka',
  renamed: 'no',
  date: '2026-09-19',
  kind: 'length',
  limitSeconds: 0,
  distanceKm: 0,
  ascentM: 0,
  descentM: 0,
  category: 'short',
  ...over,
})


/* Every field a race fills in for the member was worked out here, to hold the
   sentence over the name box to naming none of them. The sentence went out on
   31.08.2026 with the other fifty four rules the owner did not keep, so the list
   had nothing left to protect and went with it; what the three kinds fill in is
   still measured where it decides something, in `member/racesToOffer.ts`. */


describe('the kind of race the member says it was', () => {
  it('starts on „Dužinska", and offers all three', async () => {
    /* Owner, 30.08.2026, on both halves: the form opens on „Dužinska", and the
       member is offered all three, „Slobodna" included, because the
       administration settles it at verification anyway („a ja ću svakako
       promeniti njegov izbor tokom verifikacije").

       The starting value is measured because nothing else does: the field has no
       notion of one, so it is seeded where the form is drawn, and a seed moved to
       another kind is a member scored as though they had run to a time limit they
       never had. Measured on this very change: with the seed moved to „time",
       every test in the portal passed.

       The three read off `RACE_KINDS` rather than written out, so a fourth kind
       has to be answered here rather than quietly left out of the form. */
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const kind = await screen.findByLabelText(/^Vrsta trke/)

    expect(kind).toHaveValue('length')
    /* Read through the role rather than off a cast list of options: this repo
       refuses type assertions (`consistent-type-assertions`), and an option is a
       thing with a role like any other. */
    expect(within(kind).getAllByRole('option').map((one) => one.getAttribute('value'))).toEqual([
      ...RACE_KINDS,
    ])
  })
})

describe('the list of races under the name of an event', () => {
  it('says nothing until two letters have been typed', async () => {
    /* Owner, 23.08.2026: „posle dva slova treba da krene autocomplete". Both
       sides of the boundary, because a list that opens on the first letter is a
       list of everything the league has ever run. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/^Naziv trke/), 'b')

    expect(offered()).toEqual([])

    await user.type(raceName(), 'e')

    expect(offered().length).toBeGreaterThan(0)
  })

  it('offers the name of the race, not the name of the event it is run at', async () => {
    /* Owner, 23.08.2026: „sad je postalo logičnije da se pretražuje zapravo naziv
       trke sa datumom i dužinom." Measured against the one race in the data with a
       name of its own; with every other one named after its event the two are the
       same string, and a round measured that putting the event's name back walks
       through the whole package. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/^Naziv trke/), 'mrazijada')

    const said = offered()

    expect(said.length).toBeGreaterThan(0)
    expect(
      said.some((one) => one.startsWith('Mrazijada, polumaraton')),
      said.join(' | '),
    ).toBe(true)

    /* And what the press puts **into the field**, which is a second fact and not the
       same one: a suggestion carries `said` for the row and `value` for the box.
       Measured 23.08.2026 by a round: with `value` alone put back to the event's
       name, the row still read „Mrazijada, polumaraton" and the box took
       „Mrazijada", so the member sent the event's name under the race's label and
       every screen the owner named showed the wrong one. */
    const row = must(
      within(must(screen.queryByRole('list'), 'the list of races')).getAllByRole('button')[0],
      'the first race offered',
    )

    await user.click(row)

    expect(raceName(), 'the box took a name the row never showed').toHaveValue(
      'Mrazijada, polumaraton',
    )
  })

  it('writes each race as its event, its day and its length', async () => {
    /* „Beogradski maraton – 19.04.2026. – 42.2" (owner). The day is the one
       numeric date shape on the portal, and it is here because he named it
       twice; the length is written the way every other screen writes one. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/^Naziv trke/), 'beogradski maraton')

    for (const row of offered()) {
      expect(row, 'a row of the list is not written the way the owner asked').toMatch(
        /^.+ – \d{2}\.\d{2}\.\d{4}\. – \d+,\d km$/,
      )
    }

    expect(offered().length).toBeGreaterThan(0)
  })

  it('offers a race by what it is measured by, which is not always a length', () => {
    /* The third of the three things the owner named on 23.08.2026 („naziv trke sa
       datumom i dužinom") stopped being a length on 29.08.2026, when he said a
       timed race is shown by how long it lasts, and on 30.08.2026, when he chose
       that a free race is shown by nothing at all.

       Asked of the function rather than of the screen, because every race in
       `public/mock/races.json` is a race of a length, so the screen can only ever
       ask the one question. The same reason `data/raceLabel.test.ts` exists, and
       the same reason `data/raceCategory.test.ts` asks its function directly.

       `raceMeasure` is the one home for the answer (`data/raceLabel.ts`), and the
       point of the case is that this list reads it: a row built from the length
       alone would offer the twenty four hour race as „0,0 km" and the free one as
       „0,0 km" too, which is what it did until 30.08.2026. */
    const said = racesToOffer(
      [held],
      [
        shaped({ id: 'r1', kind: 'time', limitSeconds: 86_400 }),
        shaped({ id: 'r2', kind: 'free' }),
        shaped({ id: 'r3', distanceKm: 21.1 }),
      ],
      '2026-12-31',
      'sr-Latn',
    ).map((one) => one.said)

    expect(said).toEqual([
      'Trka – 19.09.2026. – 24 h',
      'Trka – 19.09.2026.',
      'Trka – 19.09.2026. – 21,1 km',
    ])
  })

  it('offers a race of a kind it does not know as a race of a length', () => {
    /* One word, and every other screen reads it through the one function that knows
       the three (`data/raceKind.ts`). Read here without it, a race carrying a word
       this portal has never heard of would be offered with the day alone filled in
       and the three measurements left empty and locked, while the event's own page,
       the name of the race and the form behind it all read the very same race as a
       race of a length and take those three off it. Two answers for one race. */
    const filled = racesToOffer(
      [held],
      [{ ...shaped({ id: 'r1', distanceKm: 21.1 }), kind: 'ludilo' }],
      '2026-12-31',
      'sr-Latn',
    )

    expect(first(filled).said).toBe('Trka – 19.09.2026. – 21,1 km')
    expect(Object.keys(first(filled).fills).sort()).toEqual([
      'ascentM',
      'date',
      'descentM',
      'distanceKm',
    ])
  })

  it('promises nothing over the box about what choosing a race fills in', async () => {
    /* There was a sentence over this box until 31.08.2026, and holding it was a
       round of work: drawn before any race is chosen it cannot know the kind, and
       the three kinds fill in different fields, so every field it named was a
       claim false for two kinds out of three (measured 30.08.2026).

       The owner read the whole list of sixty one explanations and kept seven; this
       is not one of them. What is held now is that the box promises nothing at
       all, which is the only thing that is true before a race is picked. */
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const box = await screen.findByLabelText(/^Naziv trke/)

    expect(box.getAttribute('aria-describedby')).toBeNull()

  })
  it('hands over exactly what each kind of race fixes, and locks exactly that', () => {
    /* Choosing a race fills the fields under the box. A timed race and a free one
       carry nought, and nought is not a length this form will take: the definition
       asks for at least 0,1 (`definitions/unos-rezultata.form.json`) and
       `forms/validate.ts` holds it, so a row offered with a nought in it is a row
       the member cannot send.

       Not handed over at all, rather than handed over empty, which is what the
       owner asked for on 29.08.2026: „Na vremenskoj trci član unosi dužinu, uspon
       i spust." All three, because a course run in laps has a climb that depends on
       how many laps somebody ran, so the race cannot know any of them.

       And the other half of that sentence, „Vreme ne unosi, jer je zadato trkom", is
       the same act read the other way: the renderer locks by the keys of what is
       handed over, so a timed race hands its own limit into the three time boxes and
       they are locked by that. Broken into hours, minutes and seconds because that
       is how the form asks. It is also what makes the points come out right on this
       form without it having to work out which race a typed name belongs to: the
       formula is fed the limit because the limit is what is in the boxes. */
    const filled = racesToOffer(
      [held],
      [
        /* Six hours, thirty minutes and forty five seconds, and all three numbers
           different from each other. A round twenty four hours leaves the minutes
           and the seconds both nought, and 6:30:30 leaves them equal; in either the
           two expressions that split a limit into boxes cannot be told apart, and
           both were measured passing a swap (30.08.2026). */
        shaped({ id: 'r1', kind: 'time', limitSeconds: 23_445, ascentM: 120 }),
        shaped({ id: 'r2', kind: 'free', ascentM: 120 }),
        shaped({ id: 'r3', distanceKm: 21.1, ascentM: 120, descentM: 140 }),
      ],
      '2026-12-31',
      'sr-Latn',
    ).map((one) => one.fills)

    /* Both the keys and what they carry, because the two faults are different and
       either one on its own leaves the other unguarded.

       The keys are what the renderer locks by (`forms/FormRenderer.tsx`,
       `setLed(Object.keys(one.fills))`), so a key handed over with an empty string
       is a field that is empty and locked at once, which is a form nobody can send.
       A round of this asked for the values alone and wrote that dead end down as
       though it were the answer.

       The values are what the member is then left with, and the round that
       corrected the keys asked for nothing else: with only the keys measured, a
       length race handing over „" for its climb passed the whole package, and that
       is the same dead end on all 1612 races in the file rather than on none. */
    expect(filled.map((one) => Object.keys(one ?? {}).sort())).toEqual([
      ['date', 'hours', 'minutes', 'seconds'],
      ['date'],
      ['ascentM', 'date', 'descentM', 'distanceKm'],
    ])
    expect(filled.map((one) => one?.ascentM)).toEqual([undefined, undefined, '120'])
    expect(filled.map((one) => one?.distanceKm)).toEqual([undefined, undefined, '21.1'])
    expect(filled.map((one) => one?.descentM)).toEqual([undefined, undefined, '140'])
    /* Each in its own box and each a different number, so no two of the three can be
       read for one another. */
    expect(filled.map((one) => one?.hours)).toEqual(['6', undefined, undefined])
    expect(filled.map((one) => one?.minutes)).toEqual(['30', undefined, undefined])
    expect(filled.map((one) => one?.seconds)).toEqual(['45', undefined, undefined])
    /* And the day, which is the one thing handed over on all three kinds and so the
       one the two lists above cannot reach. It is locked like the rest, so a value
       the form cannot read is a field nobody can mend: the box asks for
       „dd/mm/gggg" (`forms/dateField.ts`) and a race carries „2026-09-19", which
       `isoDate` reads back as nothing at all. A round of this measured only that the
       value is not empty, and an ISO day is not empty. */
    expect(filled.map((one) => one?.date)).toEqual(['19/09/2026', '19/09/2026', '19/09/2026'])
  })

  it('offers what has been run, newest first, and never what is still to come', async () => {
    /* Owner: „U autocomplete se navode samo događaji koji su u prošlosti ili na
       taj dan, ne ubuduće", „sortiranih po datumu od poslednje prema ranijim".

       Read against the data rather than against a written list, so the day the
       calendar changes this says what the screen says. The day itself counts as
       past, which is the boundary the whole portal keeps (PDL P9). */
    const races = await loadResource<Race[]>('races')
    const events = await loadResource<BtlEvent[]>('events')
    const named = new Map(events.map((one) => [one.id, one.name]))
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/^Naziv trke/), 'trka')

    const rows = offered()
    const days = rows.map((row) => must(/(\d{2})\.(\d{2})\.(\d{4})\./.exec(row), 'the day in a row'))
    const asIso = days.map((found) => `${found[3] ?? ''}-${found[2] ?? ''}-${found[1] ?? ''}`)

    expect(rows.length).toBeGreaterThan(1)
    expect([...asIso].sort().reverse(), 'the list is not newest first').toEqual(asIso)
    for (const day of asIso) {
      expect(day <= TODAY, `${day} has not been run yet`).toBe(true)
    }

    /* And every row is a race this league has, rather than a row built out of
       whatever was typed. */
    const matching = races.filter(
      (race) => race.date <= TODAY && (named.get(race.eventId) ?? '').toLocaleLowerCase().includes('trka'),
    )

    expect(matching.length).toBeGreaterThan(rows.length)
  })

  it('offers no more than eight at once', async () => {
    /* Every row is a stop on the way through the form with a keyboard
       (forms/Suggesting.tsx). Held with a search that matches far more than
       eight, so this is a cap and not a coincidence. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/^Naziv trke/), 'ka')

    expect(offered()).toHaveLength(8)
  })

  it('says out loud that the list opened, and how long it is', async () => {
    /* For a reader who cannot see it appear under the box. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/^Naziv trke/), 'ka')

    /* One of the live regions on the screen and not the only one: a form has its
       own and so does every list that grows. What is held is that this sentence
       is said in one of them. */
    expect(screen.getAllByRole('status').map((one) => one.textContent)).toContain(
      '8 trka iz kalendara odgovara',
    )
  })

  it('closes on Escape and opens again on the next letter', async () => {
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/^Naziv trke/), 'ka')

    expect(offered().length).toBeGreaterThan(0)

    await user.keyboard('{Escape}')

    expect(offered()).toEqual([])

    await user.type(raceName(), 'l')

    expect(offered().length).toBeGreaterThan(0)
  })
})

describe('a race chosen out of that list', () => {
  /** Types two letters and presses the first row, which is what a member does. */
  async function choose(user: ReturnType<typeof setupUser>, said = 'beogradski maraton') {
    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/^Naziv trke/), said)

    const list = screen.getByRole('list', { name: '' })
    const row = first(within(list).getAllByRole('button'))
    const words = row.textContent ?? ''

    await user.click(row)

    return words
  }

  it('writes only the name of the event, and fills the four the race carries', async () => {
    /* Owner: „u polje Naziv događaja se upisuje samo naziv (Beogradski maraton),
       a sva ostala naredna polja (Datum, Dužina, Uspon, Spust) se popune i
       naprave disabled". */
    const user = setupUser()
    const words = await choose(user)

    expect(raceName()).toHaveValue(must(words.split(' – ')[0], 'the name in the row'))

    for (const asked of FILLED) {
      const box = screen.getByLabelText(asked)

      expect(box, `${String(asked)} was not filled from the race`).not.toHaveValue('')
      /* Held and not switched off, which is three separate things and each is
         worth asking for. Written as `disabled` for one day, and a round measured
         what that costs on 23.08.2026: Tab went from „Naziv dogadjaja" straight to
         „Sati" and the four filled boxes were not on the way at all, with nothing
         said about any of them (PDL: „Odbijeno, ne ugaseno"). */
      expect(box, `${String(asked)} is not said to be held`).toHaveAttribute(
        'aria-disabled',
        'true',
      )
      expect(box, `${String(asked)} may still be typed into`).toHaveAttribute('readonly')
      expect(box, `${String(asked)} is out of the keyboard's path`).not.toBeDisabled()
    }

    /* And typing into one changes nothing, which is the half `readOnly` promises
       and `aria-disabled` only announces. */
    const held = screen.getByLabelText(FILLED[1] ?? /^Dužina/)
    const was = must(inputElement(held).value, 'what the race filled in')

    await user.type(held, '999')

    /* Read back as a number, because the box is one: `toHaveValue` compares what
       the control holds and a number box holds a number. */
    expect(held, 'a held box took what was typed into it').toHaveValue(Number(was))

    /* The time is still the member's to type: it is the one thing the calendar
       does not know. */
    expect(screen.getByLabelText(/^Sati/)).toBeEnabled()
    expect(offered(), 'the list stayed open over the fields it had just filled').toEqual([])
  })

  it('locks the calendar beside the date as well as the box itself', async () => {
    /* A date that cannot be typed and can still be pressed out of a calendar is
       a locked field with a way round it. */
    const user = setupUser()

    await choose(user)

    const field = htmlElement(
      must(screen.getByLabelText(/^Datum/).closest('.field'), 'the date field'),
    )

    const opener = within(field).getByRole('button', { name: 'Otvori kalendar' })

    /* Reachable and refused, like the box beside it: `disabled` would take it out
       of the keyboard's path and say nothing. */
    expect(opener).toHaveAttribute('aria-disabled', 'true')
    expect(opener).not.toBeDisabled()

    await user.click(opener)

    /* Asked of the sheet itself, and of what the button says about itself. It was
       asked of `role="application"` for a day, and `DatePicker.tsx` carries no
       `role` at all, so the query answered `null` whether the calendar was open or
       shut: the test was green while the button was opening a calendar over a date
       nobody could change. Measured 23.08.2026, and the sheet counted thirty-one
       days while the test said there was none. */
    expect(
      field.querySelector('.datepicker__pop'),
      'the calendar opened over a date the portal filled in',
    ).toBeNull()
    expect(opener, 'the button says it opened something').toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('never takes the cursor out of the box it is typed in', async () => {
    /* Two things hang on the pointer not moving the focus, and both were measured
       on 23.08.2026. A press anywhere in the list that is not itself a button, the
       scrollbar it used to have above all, was a blur first and a press second, so
       the list shut before the press landed. And a press on a row moves the focus
       onto a row that the same stroke removes from the page, so it falls to the
       document and a screen reader reads that as leaving the form.

       Held as the refusal itself, because that is the whole mechanism: a `mousedown`
       inside the list is cancelled, so the focus never leaves the box. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/^Naziv trke/), 'beogradski maraton')

    const list = screen.getByRole('list', { name: '' })

    expect(
      fireEvent.mouseDown(list),
      'a press inside the list is allowed to move the focus',
    ).toBe(false)

    /* And the row still answers a press, which is the half a cancelled event could
       have taken with it. */
    await user.click(first(within(list).getAllByRole('button')))

    expect(raceName()).toHaveFocus()
    expect(offered()).toEqual([])
  })

  it('hands all four back, empty, the moment the name is edited', async () => {
    /* Owner: „Naziv događaja mogu da editujem, ali onda puca konekcija sa ostalim
       poljima". Emptied and not merely unlocked, which is what he chose when
       asked: a name typed freely must not stand over somebody else's date and
       distance. */
    const user = setupUser()

    await choose(user)
    await user.type(raceName(), ' i po')

    for (const asked of FILLED) {
      const box = screen.getByLabelText(asked)

      /* Read off the box rather than through `toHaveValue`, which answers `null`
         for an empty number and `''` for an empty text box, and these four are
         both kinds. */
      expect(inputElement(box).value, `${String(asked)} kept what the race had`).toBe('')
      expect(box, `${String(asked)} is still locked`).toBeEnabled()
    }
  })
})

describe('a picture attached to a result', () => {
  /** The row the picture is asked for in. */
  function photoField(): HTMLElement {
    return htmlElement(
      must(screen.getByLabelText(/Slika kao dokaz/).closest('.field'), 'the picture field'),
    )
  }

  it('offers no way out while there is nothing to undo', async () => {
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    await screen.findByLabelText(/^Naziv trke/)

    expect(within(photoField()).queryByRole('button', { name: 'Obriši' })).toBeNull()
  })

  it('is taken back off again, from the browser as well as from the form', async () => {
    /* Owner, 23.08.2026: „jer trenutno ne mogu da odustanem od slanja slike".
       Both halves, because a file box holds its own copy of what was chosen and
       nothing but the browser may write to it: emptying our value alone leaves
       the name of the file standing beside a field that thinks it is empty. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const box = await screen.findByLabelText(/Slika kao dokaz/)

    await user.upload(box, new File(['proba'], 'dokaz.jpg', { type: 'image/jpeg' }))

    const gone = within(photoField()).getByRole('button', { name: 'Obriši' })

    expect(inputElement(box).files).toHaveLength(1)

    await user.click(gone)

    const after = screen.getByLabelText(/Slika kao dokaz/)

    expect(inputElement(after).files).toHaveLength(0)
    expect(within(photoField()).queryByRole('button', { name: 'Obriši' })).toBeNull()
  })
})

describe('where the cursor stands after a press that takes the control away', () => {
  it('puts it back in the box when a race is chosen with the keyboard', async () => {
    /* The row is taken off the page in the same stroke that presses it, so what was
       standing on it falls to the document and a screen reader reads that as leaving
       the form: the whole page to walk again (WCAG 2.2 SC 2.4.3). Measured on
       23.08.2026, before: Tab onto the first row, Enter, and `document.activeElement`
       was `<body>`.

       With the pointer it never arises, because `mousedown` on the list is cancelled
       and the cursor never leaves the box; the keyboard is the reading that has to
       say this. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const box = await screen.findByLabelText(/^Naziv trke/)

    await user.type(box, 'Be')
    await user.tab()

    expect(document.activeElement, 'the keyboard cannot reach the list at all').toHaveClass(
      'suggests__one',
    )

    await user.keyboard('{Enter}')

    expect(document.activeElement, 'the cursor fell out of the form').toBe(box)
    /* And the press did what it was for, so this is not a guard over a button that
       does nothing. */
    expect(box).toHaveValue('10K Belgrade')
  })

  it('puts it back in the box when the picture is taken away', async () => {
    /* The same fault at the other button of this batch: „Obriši" stops being drawn
       and the box beside it is remounted in the same stroke, so the cursor had
       nowhere to stand. Measured on 23.08.2026, before: `document.activeElement`
       was `<body>` after the press. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const picture = await screen.findByLabelText(/Slika kao dokaz/)

    await user.upload(picture, new File(['proba'], 'dokaz.jpg', { type: 'image/jpeg' }))
    await user.click(
      within(
        htmlElement(must(picture.closest('.field'), 'the picture field')),
      ).getByRole('button', { name: 'Obriši' }),
    )

    expect(document.activeElement, 'the cursor fell out of the form').toBe(
      screen.getByLabelText(/Slika kao dokaz/),
    )
  })
})

describe('a message about a field the form has stopped asking for', () => {
  it('goes when the picture that freed it goes, and when one arrives', async () => {
    /* Both directions of Član 37, and the „Obriši" button of this batch is what
       makes the first of them a thing a member can do in one press.

       Attach a picture and the comment becomes obligatory while the link stops
       being; take it back and both turn round again. Until 23.08.2026 only the
       field that was touched had its message cleared, so „Ovo polje je obavezno."
       stood under a field the form was no longer asking about, and the summary over
       it said the same (WCAG 2.2 SC 3.3.1). */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    await user.type(await screen.findByLabelText(/^Naziv trke/), 'Probna trka')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    /* The link is obligatory as the form is written, so it is refused. */
    const underLink = () =>
      within(htmlElement(must(screen.getByLabelText(/^Link/).closest('.field'), 'the link field')))

    expect(underLink().getByText('Ovo polje je obavezno.')).toBeVisible()

    await user.upload(
      screen.getByLabelText(/Slika kao dokaz/),
      new File(['proba'], 'dokaz.jpg', { type: 'image/jpeg' }),
    )

    expect(
      underLink().queryByText('Ovo polje je obavezno.'),
      'the link is still refused after a picture freed it',
    ).toBeNull()

    /* And the other way: the comment is what the picture makes obligatory. */
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    const underComment = () =>
      within(
        htmlElement(must(screen.getByLabelText(/Komentar/).closest('.field'), 'the comment field')),
      )

    expect(underComment().getByText('Ovo polje je obavezno.')).toBeVisible()

    await user.click(
      within(
        htmlElement(
          must(screen.getByLabelText(/Slika kao dokaz/).closest('.field'), 'the picture field'),
        ),
      ).getByRole('button', { name: 'Obriši' }),
    )

    expect(
      underComment().queryByText('Ovo polje je obavezno.'),
      'the comment is still refused after the picture went',
    ).toBeNull()
  })

  it('comes back the moment the field is asked for again, without another press', async () => {
    /* The other half of what the derivation says about itself, and it is worth
       measuring rather than believing: the message is not thrown away when a field
       is freed, it is not drawn while the field is free. So the picture that freed
       the link is taken back and the message is there again, over a field nobody
       has touched in between and without the form being sent a second time.

       Written after a round on 23.08.2026 measured the same sentence in a comment
       and found it false: while the message was also being swept out of the state
       when a picture arrived, there was nothing left to come back. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    await user.type(await screen.findByLabelText(/^Naziv trke/), 'Probna trka')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    const underLink = () =>
      within(htmlElement(must(screen.getByLabelText(/^Link/).closest('.field'), 'the link field')))
    const picture = () =>
      within(
        htmlElement(
          must(screen.getByLabelText(/Slika kao dokaz/).closest('.field'), 'the picture field'),
        ),
      )

    expect(underLink().getByText('Ovo polje je obavezno.')).toBeVisible()

    await user.upload(
      screen.getByLabelText(/Slika kao dokaz/),
      new File(['proba'], 'dokaz.jpg', { type: 'image/jpeg' }),
    )

    expect(underLink().queryByText('Ovo polje je obavezno.')).toBeNull()

    await user.click(picture().getByRole('button', { name: 'Obriši' }))

    expect(
      underLink().getByText('Ovo polje je obavezno.'),
      'the link is obligatory again and the screen says nothing about it',
    ).toBeVisible()
    /* And it is the same message the next press would write, so nothing here is
       telling the reader something the form does not think. */
    expect(screen.getByLabelText(/^Link/)).toHaveAttribute('aria-required', 'true')
  })
})

describe('an error that is not about a field being obligatory', () => {
  it('survives the picture that made the field optional', async () => {
    /* The other half of the rule above, and the one a wider fix would have taken
       with it: a badly written address is still badly written after a picture has
       made it optional. Measured on 23.08.2026 with the wider fix in place: the
       message went, the next press refused the form and wrote it again, and in
       between the screen said the shape had been put right.

       The premise is measured beside it, because without that this test passes on a
       form where the picture frees nothing at all: the link has to stop being
       obligatory for there to be anything here worth asking. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    await user.type(await screen.findByLabelText(/^Naziv trke/), 'Probna trka')
    await user.type(screen.getByLabelText(/^Link/), 'trka.rs/rezultati')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    expect(screen.getByText('Vrednost nije u očekivanom obliku.')).toBeVisible()
    expect(screen.getByLabelText(/^Link/)).toHaveAttribute('aria-required', 'true')

    await user.upload(
      screen.getByLabelText(/Slika kao dokaz/),
      new File(['proba'], 'dokaz.jpg', { type: 'image/jpeg' }),
    )

    expect(
      screen.getByLabelText(/^Link/),
      'the picture did not free the link, so this test asks nothing',
    ).not.toHaveAttribute('aria-required')
    expect(
      screen.getByText('Vrednost nije u očekivanom obliku.'),
      'the shape stopped being wrong when the field stopped being obligatory',
    ).toBeVisible()
  })
})

describe('the foot of the form', () => {
  it('asks for the link, then the picture, then the comment', async () => {
    /* Owner, 23.08.2026: „Slika kao dokaz treba da se nađe iznad komentara, a
       ispod linka ka zvaničnim rezultatima". The picture is the reason the
       comment becomes obligatory (Član 37), so it stands before it. */
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    await screen.findByLabelText(/^Naziv trke/)

    const asked = [...document.querySelectorAll('.field__label')].map(
      (one) => one.textContent ?? '',
    )
    const foot = asked.slice(-3).map((one) => one.replace(/\s*\(neobavezno\)\s*$/, '').trim())

    expect(foot).toEqual(['Link ka zvaničnim rezultatima', 'Slika kao dokaz', 'Komentar'])
  })
})

/**
 * Puts one refused result into the store before the screen is looked at, under
 * whichever member is named.
 *
 * Written straight into the session, because the walk through the form and the
 * queue is a different test's subject and this one is about who may open what.
 */
function Refused({ whose }: { whose: string }) {
  const session = useSession()
  const done = useRef(false)

  useEffect(() => {
    if (!done.current) {
      done.current = true
      session.submit({
        memberNumber: whose,
        raceName: 'Tuđa trka',
        raceKind: 'length',
        city: 'Niš',
        country: 'RS',
        date: '2026-05-10',
        distanceKm: 21.1,
        ascentM: 540,
        descentM: 540,
        photo: '',
        seconds: 6730,
        points: 12.34,
        category: 'half',
        link: 'https://primer.rs/tudje',
        comment: 'Tuđi komentar.',
      })
      session.decide('sub-1', 'rejected', 'Link ne otvara rezultate.')
    }
  }, [session, whose])

  return null
}

describe('a refused result somebody else is correcting', () => {
  /** The address the list of my results writes for a refusal of mine. */
  const AGAIN = `${NEW}?ponovo=sub-1`

  it('opens for the member it belongs to', async () => {
    /* The half that has to work, so the other half is not a screen that refuses
       everybody. */
    renderAt(AGAIN, 'competitor', ME, undefined, TODAY, <Refused whose={ME} />)

    /* The moderator's own words about why it was refused, which is what the screen
       shows and what somebody else must not see. The fields themselves are seeded
       once, when the form mounts, and here the result is written into the store
       one turn later than that, so what is read is the sentence over the form and
       not the boxes under it. */
    expect(await screen.findByText(/Link ne otvara rezultate/)).toBeVisible()
  })

  it('opens for nobody else, however the address is typed', async () => {
    /* The only rule this screen has, and until 23.08.2026 nothing measured it:
       removing the owner from the condition left all 2059 tests green. The ids
       are `sub-1`, `sub-2` and so on, so the address is guessed from the first
       try, and what stands behind it is somebody else's race and the moderator's
       own words about why it was refused. */
    renderAt(AGAIN, 'competitor', ME, undefined, TODAY, <Refused whose="000021" />)

    await screen.findByLabelText(/^Naziv trke/)

    expect(screen.queryByText(/Link ne otvara rezultate/), 'the reason was shown').toBeNull()
    expect(screen.queryByText(/Tuđa trka/), 'the race was shown').toBeNull()
  })
})
