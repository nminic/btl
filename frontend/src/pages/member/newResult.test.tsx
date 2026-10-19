import { RACE_KINDS } from '../../data/types'
import { fireEvent, screen, within } from '@testing-library/react'
import type { BtlEvent, Race } from '../../data/types'
import { first, htmlElement, inputElement, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { racesToOffer } from './racesToOffer'
import { answeredWith, serverThat } from '../../test/serverAnswers'
import { myOwnRecordFromMe, whoIAm } from '../../test/theAnswer'
import { setupUser } from '../../test/user'
import { SLOW } from '../../test/slow'

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
/* In the first season: a run is sent only for a season open for a report, and none is before 2027
   (PDL P9, 19.10.2026). The harness answers the seasons open as [2027] (`test/theAnswer.ts`). */
const TODAY = '2027-08-23'

/**
 * A WAIT SHORTER THAN THE CASE'S OWN CLOCK, for the cases about a run sent back.
 *
 * <p>Testing Library waits `SLOW` (`test/setup.ts`) and a case is given `SLOW` too, so a screen that
 * never draws what a case waits for kills the case on its clock, and the failure names nothing.
 * Measured on this file on 10.10.2026: a mutation that opened a waiting run on `?ponovo=` was
 * reported as a case that ran out of time, which is „nije mereno" and not a catch. Half the clock,
 * the shape `pages/admin/saveWhileSaving.test.tsx` keeps for the whole of its file.
 */
const SOON = { timeout: SLOW / 2 }

/**
 * EVERYTHING THIS SCREEN SENT TO `POST /api/results`, read off the requests themselves, and the
 * asker's own runs answered as the case says where it says anything.
 *
 * <p>Since R2 of the results flows nothing about a run sent is written into the browser, so the
 * request is the one place what was sent can be read. Everything a case does not name goes on
 * to the floor (`test/setup.ts`), which answers `POST /api/results` with 201 as the route does.
 */
function recording(mine?: unknown[]): { sent: () => Record<string, unknown>[]; stop: () => void } {
  const server = serverThat((path) =>
    mine !== undefined && path === '/api/me/result-submissions'
      ? new Response(JSON.stringify(mine), { status: 200, headers: { 'content-type': 'application/json' } })
      : null,
  )

  return {
    sent: () =>
      server.asked
        .filter((one) => one.path === '/api/results' && one.init?.method === 'POST')
        .map((one) => {
          const body: unknown = JSON.parse(String(one.init?.body ?? '{}'))

          return typeof body === 'object' && body !== null ? { ...body } : {}
        }),
    stop: server.stop,
  }
}

/** The box the name of the event is typed into. */
function raceName(): HTMLElement {
  return screen.getByLabelText(/^Naziv trke/)
}

function eventName(): HTMLElement {
  return screen.getByLabelText(/^Događaj/)
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
  id: 1,
  slug: 'dogadjaj-2026',
  name: 'Događaj',
  date: '2026-09-19',
  city: 'Beograd',
  country: 'RS',
  kind: 'race',
  featured: false,
  description: '',
  link: '',
  copiedFrom: null,
}
const shaped = (over: Partial<Race>): Race => ({
  id: 2,
  eventId: 1,
  name: 'Trka',
  renamed: false,
  date: '2026-09-19',
  kind: 'length',
  limitSeconds: 0,
  distanceKm: 0,
  ascentM: 0,
  descentM: 0,
  category: 'short',
  dots: ['short'],
  ...over,
})

/* A CALENDAR OF ITS OWN FOR THE CASES ABOUT THE TWO LISTS, so each axis has a row on both sides of it:
   - „Gradska liga” of 2027 with ten rounds run by today, each named apart from the event (so a list
     that wrote the event's name is a different row), and a closing round still to come;
   - „Gradska liga” of 2026, the same name in a year before the league, whose season is not open;
   - „Gradski trening”, an event of 2027 that is not a race;
   - „Gradska jesen”, a race of 2027 that has not begun yet. */
const LEAGUE: BtlEvent = { ...held, id: 9001, slug: 'gradska-liga-2027', name: 'Gradska liga', date: '2027-01-10', city: 'Novi Sad' }
const CALENDAR: BtlEvent[] = [
  LEAGUE,
  { ...held, id: 9002, slug: 'gradska-liga-2026', name: 'Gradska liga', date: '2026-03-10' },
  { ...held, id: 9003, slug: 'gradski-trening-2027', name: 'Gradski trening', date: '2027-02-01', kind: 'training' },
  { ...held, id: 9004, slug: 'gradska-jesen-2027', name: 'Gradska jesen', date: '2027-10-10' },
]
const ROUND_DAYS = [
  '2027-01-10', '2027-02-07', '2027-03-07', '2027-04-04', '2027-05-02',
  '2027-05-30', '2027-06-27', '2027-07-11', '2027-07-25', '2027-08-08',
]
const RACES: Race[] = [
  ...ROUND_DAYS.map((date, round) =>
    shaped({ id: 9100 + round, eventId: 9001, name: `Gradska liga, kolo ${round + 1}`, renamed: true, date, distanceKm: 10.5, ascentM: 40, descentM: 40 }),
  ),
  shaped({ id: 9120, eventId: 9001, name: 'Gradska liga, završno kolo', renamed: true, date: '2027-11-07', distanceKm: 10.5 }),
  shaped({ id: 9130, eventId: 9002, name: 'Gradska liga, kolo 1', renamed: true, date: '2026-03-10', distanceKm: 10.5 }),
  shaped({ id: 9140, eventId: 9004, name: 'Gradska jesen', date: '2027-10-10', distanceKm: 10.5 }),
]

/** The calendar above in place of the generated one, for as long as a case holds it. */
function calendar(): { stop: () => void } {
  const answer = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

  return serverThat((path) =>
    path === '/api/events' ? answer(CALENDAR) : path === '/api/races' ? answer(RACES) : null,
  )
}

/** Opens the form and chooses an event out of the box „Događaj”, which is what a member does first. */
async function onTheEvent(user: ReturnType<typeof setupUser>, typed = 'gradska'): Promise<void> {
  renderAt(NEW, 'competitor', ME, undefined, TODAY)
  await user.type(await screen.findByLabelText(/^Događaj/), typed)
  await user.click(first(within(screen.getByRole('list', { name: '' })).getAllByRole('button')))
}


/* Every field a race fills in for the member was worked out here, to hold the
   sentence over the name box to naming none of them. The sentence went out on
   31.08.2026 with the other fifty four rules the owner did not keep, so the list
   had nothing left to protect and went with it; what the three kinds fill in is
   still measured where it decides something, in `member/racesToOffer.ts`. */


describe('the top of the form for a new result', () => {
  it('says nothing between the heading and the first box', async () => {
    /* Owner, 17.10.2026: the sentence at the top of the form for a result away from the calendar,
       „Rezultat ulazi u rang liste tek kad ga administrator odobri...", is deleted. Asked of every
       paragraph that stands after the heading and before the first box, and not of the one sentence
       that was there, which a rewording would walk past (the shape `event/reportResultRows.test.tsx`
       keeps for the form on the calendar). */
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const heading = await screen.findByRole('heading', { level: 1, name: 'Unos rezultata' })
    const main = screen.getByRole('main')
    const box = first(within(main).getAllByRole('textbox'))

    const between = [...main.querySelectorAll('p')].filter(
      (one) =>
        heading.compareDocumentPosition(one) & Node.DOCUMENT_POSITION_FOLLOWING &&
        !one.contains(box) &&
        one.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING,
    )

    expect(
      between.map((one) => one.textContent),
      'a sentence stands between the heading and the first box',
    ).toEqual([])
    expect(screen.queryByText(/Rezultat ulazi u rang liste tek kad/)).toBeNull()
  })
})

describe('a race chosen from the list', () => {
  it('travels with the request, so verification knows there is nothing to make', async () => {
    /* The one thing that tells a run from a run: a member who chose a race sends its id, and a
       member who typed a name the calendar does not hold sends none. Verification reads that
       absence to know it has to make the event and the race first (owner, 31.08.2026). Chosen
       through the screen, the event first and then its race (PDL P9, 19.10.2026), and read off
       the request: a race of the calendar has its event, so nothing about the event goes with it
       either, and no town (`ResultWriteApi.fromTheCalendar` refuses both as `theRaceIsNamedTwice`). */
    const user = setupUser()
    const route = recording()
    const held = calendar()

    try {
      await onTheEvent(user)
      await user.type(raceName(), 'kolo')
      await user.click(first(within(screen.getByRole('list', { name: '' })).getAllByRole('button')))

      /* The race answered for its own measures, which is what choosing one does. */
      expect(screen.getByLabelText(/^Dužina/)).not.toHaveValue('')

      await user.type(screen.getByLabelText('Sati'), '0')
      await user.type(screen.getByLabelText('Minuti'), '50')
      await user.type(screen.getByLabelText('Sekunde'), '0')
      await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/r')
      await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

      await screen.findByRole('heading', { name: 'Rezultat je poslat' }, SOON)

      const sent = must(route.sent()[0], 'what was sent')

      expect(route.sent()).toHaveLength(1)
      expect(sent.raceId).toBe(9109)
      for (const name of ['raceName', 'eventId', 'eventName', 'city', 'country']) {
        expect(Object.keys(sent), `${name} went beside a race of the calendar`).not.toContain(name)
      }
    } finally {
      held.stop()
      route.stop()
    }
  }, SLOW)

  it('is gone the moment the name is typed over, and the request carries none', async () => {
    /* The link breaks when the name is edited (owner, 23.08.2026), and the race goes with the
       measures. What the request must then carry is NO race and not an empty one (measured in
       review, 31.08.2026). The EVENT he chose stays chosen: a race named for himself on an event of
       the calendar is a new race on that event (PDL P9, 19.10.2026), so the key of the event goes
       and no town of its own (V67). */
    const user = setupUser()
    const route = recording()
    const held = calendar()

    try {
      await onTheEvent(user)
      await user.type(raceName(), 'kolo')
      await user.click(first(within(screen.getByRole('list', { name: '' })).getAllByRole('button')))
      await user.type(raceName(), ' po svome')

      expect(inputElement(screen.getByLabelText(/^Dužina/)).value).toBe('')
      expect(screen.queryByLabelText('Mesto'), 'a run on a chosen event asks for a town').toBeNull()

      await user.type(screen.getByLabelText(/Datum trke/), '08082027')
      await user.type(screen.getByLabelText(/^Dužina/), '10.5')
      await user.type(screen.getByLabelText(/Uspon/), '0')
      await user.type(screen.getByLabelText(/Spust/), '0')
      await user.type(screen.getByLabelText('Sati'), '0')
      await user.type(screen.getByLabelText('Minuti'), '52')
      await user.type(screen.getByLabelText('Sekunde'), '10')
      await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/r')
      await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

      await screen.findByRole('heading', { name: 'Rezultat je poslat' }, SOON)

      const sent = must(route.sent()[0], 'what was sent')

      expect(Object.keys(sent), 'a race went where the name was typed over').not.toContain('raceId')
      expect(sent.raceName).toBe('Gradska liga, kolo 10 po svome')
      expect(sent.eventId, 'the event he chose went with the race').toBe(9001)
      expect(Object.keys(sent)).not.toContain('city')
      expect(Object.keys(sent)).not.toContain('eventName')
    } finally {
      held.stop()
      route.stop()
    }
  }, SLOW)
})

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
    /* Owner, 23.08.2026: „posle dva slova treba da krene autocomplete". Both sides of the
       boundary, on the races of the event chosen. */
    const user = setupUser()
    const held = calendar()

    try {
      await onTheEvent(user)
      await user.type(raceName(), 'k')

      expect(offered()).toEqual([])

      await user.type(raceName(), 'o')

      expect(offered().length).toBeGreaterThan(0)
    } finally {
      held.stop()
    }
  })

  it('offers the name of the race, not the name of the event it is run at', async () => {
    /* Owner, 23.08.2026: „sad je postalo logičnije da se pretražuje zapravo naziv trke sa datumom
       i dužinom." Every round of the calendar's league is named apart from its event, so a list
       that wrote the event's name is a different row; and what the press puts INTO THE BOX is a
       second fact (`value` beside `said`, measured 23.08.2026). */
    const user = setupUser()
    const held = calendar()

    try {
      await onTheEvent(user)
      await user.type(raceName(), 'kolo 3')

      const said = offered()

      expect(said.length).toBeGreaterThan(0)
      expect(said.every((one) => one.startsWith('Gradska liga, kolo 3')), said.join(' | ')).toBe(true)

      await user.click(first(within(screen.getByRole('list', { name: '' })).getAllByRole('button')))

      expect(raceName(), 'the box took a name the row never showed').toHaveValue('Gradska liga, kolo 3')
    } finally {
      held.stop()
    }
  })

  it('writes each race as its event, its day and its length', async () => {
    /* „Beogradski maraton – 19.04.2026. – 42.2" (owner). */
    const user = setupUser()
    const held = calendar()

    try {
      await onTheEvent(user)
      await user.type(raceName(), 'kolo')

      for (const row of offered()) {
        expect(row, 'a row of the list is not written the way the owner asked').toMatch(
          /^.+ – \d{2}\.\d{2}\.\d{4}\. – \d+,\d km$/,
        )
      }

      expect(offered().length).toBeGreaterThan(0)
    } finally {
      held.stop()
    }
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
        shaped({ id: 11, kind: 'time', limitSeconds: 86_400 }),
        shaped({ id: 12, kind: 'free' }),
        shaped({ id: 13, distanceKm: 21.1 }),
      ],
      '2026-12-31',
      'sr-Latn',
    ).map((one) => one.said)

    /* In the owner's order of the races of one event (PDL P6, 18.10.2026, `data/raceOrder.ts`): the
       race of a length, then the timed one, then the free one, whatever order they were handed in. */
    expect(said).toEqual([
      'Trka – 19.09.2026. – 21,1 km',
      'Trka – 19.09.2026. – 24 h',
      'Trka – 19.09.2026.',
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
      [{ ...shaped({ id: 11, distanceKm: 21.1 }), kind: 'ludilo' }],
      '2026-12-31',
      'sr-Latn',
    )

    expect(first(filled).said).toBe('Trka – 19.09.2026. – 21,1 km')
    expect(Object.keys(first(filled).fills).sort()).toEqual([
      'ascentM',
      'date',
      'descentM',
      'distanceKm',
      'raceId',
    ])
  })

  it('promises nothing over the box about what choosing a race fills in', async () => {
    /* There was a sentence over this box until 31.08.2026 about what choosing a race fills in, and
       it was false for two kinds out of three. What stands beside it since 19.10.2026 is the
       owner's approved hint about WHICH race (PDL P9, „Reči forme člana i moderatorovog ekrana"), and
       nothing about what a race fills in. */
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const box = await screen.findByLabelText(/^Naziv trke/)
    const said = (box.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')

    expect(said).toBe('Izaberi trku ovog događaja ili upiši novu.')
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
        shaped({ id: 11, kind: 'time', limitSeconds: 23_445, ascentM: 120 }),
        shaped({ id: 12, kind: 'free', ascentM: 120 }),
        shaped({ id: 13, distanceKm: 21.1, ascentM: 120, descentM: 140 }),
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
    /* `raceId` is handed over by all three since 31.08.2026, and no box draws it:
       it rides with the rest because what it says is exactly what the link is, so
       typing over the name empties it with the measures (`racesToOffer.ts`). What
       it locks is a control, and there is none of that name. */
    /* In the owner's order of the races of one event (PDL P6, 18.10.2026): the race of a length,
       then the timed one, then the free one. */
    expect(filled.map((one) => Object.keys(one ?? {}).sort())).toEqual([
      ['ascentM', 'date', 'descentM', 'distanceKm', 'raceId'],
      ['date', 'hours', 'minutes', 'raceId', 'seconds'],
      ['date', 'raceId'],
    ])
    expect(filled.map((one) => one?.ascentM)).toEqual(['120', undefined, undefined])
    expect(filled.map((one) => one?.distanceKm)).toEqual(['21.1', undefined, undefined])
    expect(filled.map((one) => one?.descentM)).toEqual(['140', undefined, undefined])
    /* Each in its own box and each a different number, so no two of the three can be
       read for one another. */
    expect(filled.map((one) => one?.hours)).toEqual([undefined, '6', undefined])
    expect(filled.map((one) => one?.minutes)).toEqual([undefined, '30', undefined])
    expect(filled.map((one) => one?.seconds)).toEqual([undefined, '45', undefined])
    /* And the day, which is the one thing handed over on all three kinds and so the
       one the two lists above cannot reach. It is locked like the rest, so a value
       the form cannot read is a field nobody can mend: the box asks for
       „dd/mm/gggg" (`forms/dateField.ts`) and a race carries „2026-09-19", which
       `isoDate` reads back as nothing at all. A round of this measured only that the
       value is not empty, and an ISO day is not empty. */
    expect(filled.map((one) => one?.date)).toEqual(['19/09/2026', '19/09/2026', '19/09/2026'])
  })

  it('offers what has been run, newest first, and never what is still to come', async () => {
    /* Owner: „U autocomplete se navode samo događaji koji su u prošlosti ili na taj dan, ne ubuduće",
       „sortiranih po datumu od poslednje prema ranijim". The closing round of the league is still to
       come and is not offered; the day itself counts as run. */
    const user = setupUser()
    const held = calendar()

    try {
      await onTheEvent(user)
      await user.type(raceName(), 'gradska')

      const rows = offered()
      const asIso = rows.map((row) => {
        const found = must(/(\d{2})\.(\d{2})\.(\d{4})\./.exec(row), 'the day in a row')

        return `${found[3] ?? ''}-${found[2] ?? ''}-${found[1] ?? ''}`
      })

      expect(rows.length).toBeGreaterThan(1)
      expect([...asIso].sort().reverse(), 'the list is not newest first').toEqual(asIso)
      expect(asIso[0]).toBe('2027-08-08')
      expect(rows.some((row) => row.includes('završno')), 'a round still to come was offered').toBe(false)
    } finally {
      held.stop()
    }
  })

  it('offers no more than eight at once', async () => {
    /* Every row is a stop on the way through the form with a keyboard (forms/Suggesting.tsx). The
       league has ten rounds run, so this is a cap and not a coincidence. */
    const user = setupUser()
    const held = calendar()

    try {
      await onTheEvent(user)
      await user.type(raceName(), 'kolo')

      expect(offered()).toHaveLength(8)
    } finally {
      held.stop()
    }
  })

  it('says out loud that the list opened, and how long it is', async () => {
    /* For a reader who cannot see it appear under the box. */
    const user = setupUser()
    const held = calendar()

    try {
      await onTheEvent(user)
      await user.type(raceName(), 'kolo')

      expect(screen.getAllByRole('status').map((one) => one.textContent)).toContain(
        '8 trka iz kalendara odgovara',
      )
    } finally {
      held.stop()
    }
  })

  it('closes on Escape and opens again on the next letter', async () => {
    const user = setupUser()
    const held = calendar()

    try {
      await onTheEvent(user)
      await user.type(raceName(), 'ko')

      expect(offered().length).toBeGreaterThan(0)

      await user.keyboard('{Escape}')

      expect(offered()).toEqual([])

      await user.type(raceName(), 'l')

      expect(offered().length).toBeGreaterThan(0)
    } finally {
      held.stop()
    }
  })
})

describe('a race chosen out of that list', () => {
  /** Chooses the event of the generated calendar, types two letters of its race and presses the
   *  first row, which is what a member does. */
  async function choose(user: ReturnType<typeof setupUser>, said = 'beogradski maraton') {
    await onTheEvent(user, 'beogradski maraton')
    await user.type(raceName(), said)

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

    /* Read back as text, because the box is text since 02.10.2026: a number box takes
       a comma as well as a dot (owner, „Polje za broj prima i zarez i tacku"), which a
       `type="number"` box cannot, so what the control holds is a string. */
    expect(held, 'a held box took what was typed into it').toHaveValue(was)

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

    await onTheEvent(user, 'beogradski maraton')
    await user.type(raceName(), 'beogradski maraton')

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

describe('the event a result is run at, which the form asks first', () => {
  /* PDL P9, owner, 19.10.2026: „Prvo ima naziv događaja koji je autocomplete iz baze, ali mogu da
     unesem novu vrednost. Ukoliko je nova vrednost, polje trka dobija identičan taj naziv i može da se
     menja, a ako je postojeća vrednost, polje trka postaje autocomplete u koji se ukucava postojeća
     ili nova trka.” */

  it('offers only a race of a season open for a report that has begun by today', async () => {
    /* The calendar holds the same name in 2026, an event of 2027 that is not a race, and a race of
       2027 still to come, and only the one that is all three is offered (owner, 19.10.2026:
       „autocomplete ne treba da vuce dogadjaje van aktuelne sezone"; Q9 of 7a: only a race). */
    const user = setupUser()
    const held = calendar()

    try {
      renderAt(NEW, 'competitor', ME, undefined, TODAY)
      await user.type(await screen.findByLabelText(/^Događaj/), 'grad')

      expect(offered()).toEqual(['Gradska liga – 10.01.2027. – Novi Sad'])
    } finally {
      held.stop()
    }
  })

  it('offers nothing in a season that is not open, which before 2027 is every season', async () => {
    /* „NIŠTA! NE POSTOJI LIGA PRE 2027 GODINE" (owner, 19.10.2026): the server answers no season
       open, and the box offers nothing although the calendar has the event. */
    const user = setupUser()
    const held = calendar()
    const none = serverThat((path) =>
      path === '/api/me'
        ? new Response(
            JSON.stringify({ ...whoIAm, member: { ...myOwnRecordFromMe, memberNumber: ME, seasonsOpenForAReport: [] } }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        : null,
    )

    try {
      renderAt(NEW, 'competitor', ME, undefined, TODAY)
      await user.type(await screen.findByLabelText(/^Događaj/), 'grad')

      expect(offered()).toEqual([])
    } finally {
      none.stop()
      held.stop()
    }
  })

  it('says beside the box that it cannot offer the events when the seasons could not be read', async () => {
    /* The seasons are half of what the list is made of, so a read of them that cannot be believed is
       said where the list would be, with its button, and is not drawn as a calendar with nothing in
       it (decision of 03.10.2026, carried to the second list). */
    const held = calendar()
    const unreadable = serverThat((path) =>
      path === '/api/me'
        ? new Response(
            JSON.stringify({
              ...whoIAm,
              member: { ...myOwnRecordFromMe, memberNumber: ME, seasonsOpenForAReport: 'sve' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        : null,
    )

    try {
      renderAt(NEW, 'competitor', ME, undefined, TODAY)

      const field = within(htmlElement(must((await screen.findByLabelText(/^Događaj/)).closest('.field'), 'the field')))

      expect(await field.findByRole('alert', undefined, SOON)).toHaveTextContent('Podaci se ne mogu učitati')
    } finally {
      unreadable.stop()
      held.stop()
    }
  })

  it('fills the day of the race with the event\'s own day, leaves it his to change, and takes the town away', async () => {
    /* „Povuce se datum dogadjaja po default-u, a onda se prepopuni i datum trke, ali ga mogu dalje
       menjati" (owner, 19.10.2026), and the town of a run on a chosen event is the event's (V67). */
    const user = setupUser()
    const held = calendar()

    try {
      await onTheEvent(user)

      const day = screen.getByLabelText(/Datum trke/)

      expect(day).toHaveValue('10/01/2027')
      expect(day, 'the day of the race was locked to the event').not.toHaveAttribute('aria-disabled')
      expect(eventName(), 'the event chosen is not held').toHaveAttribute('aria-disabled', 'true')
      expect(screen.queryByLabelText('Mesto'), 'a run on a chosen event asks for a town').toBeNull()
      expect(raceName(), 'the race box kept a name the event did not give').toHaveValue('')

      await user.clear(day)
      await user.type(day, '07022027')

      expect(day).toHaveValue('07/02/2027')
    } finally {
      held.stop()
    }
  })

  it('gives a new event\'s name to its race until he names the race for himself', async () => {
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/^Događaj/), 'Seoska trka')

    expect(raceName()).toHaveValue('Seoska trka')
    expect(screen.getByLabelText('Mesto'), 'a new event asks for its town').toBeVisible()

    await user.type(raceName(), ' na 10 km')
    await user.type(eventName(), ' Vranje')

    expect(raceName(), 'the race he named was written over by the event').toHaveValue('Seoska trka na 10 km')
  })

  it('sends a run on a new event with the event\'s name and its town, and no key of any event or race', async () => {
    const user = setupUser()
    const route = recording()

    try {
      renderAt(NEW, 'competitor', ME, undefined, TODAY)
      await user.type(await screen.findByLabelText(/^Događaj/), 'Seoska trka')
      await user.type(screen.getByLabelText(/Datum trke/), '01082027')
      await user.type(screen.getByLabelText('Mesto'), 'Niš')
      await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
      await user.type(screen.getByLabelText(/^Dužina/), '10')
      await user.type(screen.getByLabelText(/Uspon/), '20')
      await user.type(screen.getByLabelText(/Spust/), '20')
      await user.type(screen.getByLabelText('Sati'), '0')
      await user.type(screen.getByLabelText('Minuti'), '45')
      await user.type(screen.getByLabelText('Sekunde'), '0')
      await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/seoska')
      await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

      await screen.findByRole('heading', { name: 'Rezultat je poslat' }, SOON)

      const sent = must(route.sent()[0], 'what was sent')

      expect([sent.eventName, sent.raceName, sent.city, sent.country]).toEqual(['Seoska trka', 'Seoska trka', 'Niš', 'RS'])
      expect(Object.keys(sent)).not.toContain('eventId')
      expect(Object.keys(sent)).not.toContain('raceId')
    } finally {
      route.stop()
    }
  }, SLOW)

  it('refuses a day in no season open for a report, in the owner\'s words, and sends nothing', async () => {
    const user = setupUser()
    const route = recording()

    try {
      renderAt(NEW, 'competitor', ME, undefined, TODAY)
      await user.type(await screen.findByLabelText(/^Događaj/), 'Stara trka')
      await user.type(screen.getByLabelText(/Datum trke/), '01082026')
      await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

      expect(await screen.findByText('Datum mora da bude u tekućoj sezoni.', undefined, SOON)).toBeVisible()
      expect(route.sent()).toEqual([])
    } finally {
      route.stop()
    }
  }, SLOW)

  it('says the server\'s refusal of a run outside the season in the owner\'s words', async () => {
    /* The day on the screen is held to the seasons the server said; the server holds it again when
       the run arrives, and its refusal has its own approved sentence (`theRaceIsOutsideTheSeason`). */
    const user = setupUser()
    const refusing = serverThat((path, init) =>
      path === '/api/results' && init?.method === 'POST'
        ? new Response(JSON.stringify({ reason: 'theRaceIsOutsideTheSeason' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          })
        : null,
    )

    try {
      renderAt(NEW, 'competitor', ME, undefined, TODAY)
      await user.type(await screen.findByLabelText(/^Događaj/), 'Seoska trka')
      await user.type(screen.getByLabelText(/Datum trke/), '01082027')
      await user.type(screen.getByLabelText('Mesto'), 'Niš')
      await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
      await user.type(screen.getByLabelText(/^Dužina/), '10')
      await user.type(screen.getByLabelText(/Uspon/), '20')
      await user.type(screen.getByLabelText(/Spust/), '20')
      await user.type(screen.getByLabelText('Sati'), '0')
      await user.type(screen.getByLabelText('Minuti'), '45')
      await user.type(screen.getByLabelText('Sekunde'), '0')
      await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/seoska')
      await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

      expect(
        await screen.findByText(/Rezultat nije poslat: preko portala se prijavljuju samo trke tekuće sezone/, undefined, SOON),
      ).toBeVisible()
    } finally {
      refusing.stop()
    }
  }, SLOW)
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

    await onTheEvent(user, 'beogradski maraton')

    const box = raceName()

    await user.type(box, 'Be')
    await user.tab()

    expect(document.activeElement, 'the keyboard cannot reach the list at all').toHaveClass(
      'suggests__one',
    )

    await user.keyboard('{Enter}')

    expect(document.activeElement, 'the cursor fell out of the form').toBe(box)
    /* And the press did what it was for, so this is not a guard over a button that
       does nothing. */
    expect(box).toHaveValue('Beogradski maraton')
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
 * A RUN SENT BACK, AS THE SERVER SERVES IT TO THE MEMBER IT BELONGS TO.
 *
 * <p>Since R2 of the results flows `?ponovo=` reads the asker's own runs off
 * `GET /api/me/result-submissions`, which answers his runs and nobody else's
 * (`MyResultSubmissionsApi`, the asker in the statement). So what a member can open by typing
 * an address is bounded by what the server answers HIM, and that is what these cases hand the
 * screen.
 */
const SENT_BACK = {
  id: 77,
  state: 'rejected',
  raceId: null,
  raceName: 'Trka za proveru',
  raceDate: '2026-05-10',
  raceKind: 'length',
  city: 'Niš',
  country: 'RS',
  distanceKm: 21.1,
  ascentM: 540,
  descentM: 540,
  seconds: 6730,
  link: 'https://primer.rs/rezultati',
  comment: 'Moj komentar.',
  reason: 'Link ne otvara rezultate.',
  amendsResultId: null,
}

/** And one still waiting, which `?ponovo=` does not open (the owner's choice of 10.10.2026). */
const WAITING = { ...SENT_BACK, id: 78, state: 'waiting', reason: null }

describe('a run sent back, opened again by its address', () => {
  it('opens for the member whose list the server answers it on', async () => {
    /* The half that has to work, so the other half is not a screen that refuses everybody. The
       moderator's own words about why it was sent back are what the screen shows over the
       form. */
    const route = recording([SENT_BACK])

    try {
      renderAt(`${NEW}?ponovo=77`, 'competitor', ME, undefined, TODAY)

      expect(await screen.findByText(/Link ne otvara rezultate/, undefined, SOON)).toBeVisible()
      expect(screen.getByLabelText(/^Naziv trke/)).toHaveValue('Trka za proveru')
    } finally {
      route.stop()
    }
  }, SLOW)

  it('opens nothing that is not on his own list, however the address is typed', async () => {
    /* The only rule this road has, and until 23.08.2026 nothing measured it. The list it reads
       is the server's answer to the asker, so a key that is not on it - somebody else's, or one
       that never was - opens the form for a new run and shows nothing of anybody's. */
    const route = recording([WAITING])

    try {
      renderAt(`${NEW}?ponovo=77`, 'competitor', ME, undefined, TODAY)

      expect(await screen.findByLabelText(/^Naziv trke/, undefined, SOON)).toBeVisible()
      expect(screen.queryByText(/Link ne otvara rezultate/), 'a reason was shown').toBeNull()
      expect(screen.getByLabelText(/^Naziv trke/)).toHaveValue('')
    } finally {
      route.stop()
    }
  }, SLOW)

  it('does not open a run that is still waiting, however the address is typed', async () => {
    /* The owner's choice of 10.10.2026 among the outcomes offered, in the record's wording:
       „„Izmeni" i „Obriši" na prijavi koja čeka se skrivaju do zasebnog posla". The list offers
       no way in, so typing the address is the one way to try, and it opens the form for a new
       run rather than a run nobody may change yet. */
    const route = recording([WAITING])

    try {
      renderAt(`${NEW}?ponovo=78`, 'competitor', ME, undefined, TODAY)

      expect(await screen.findByLabelText(/^Naziv trke/, undefined, SOON)).toBeVisible()
      expect(screen.getByLabelText(/^Naziv trke/)).toHaveValue('')
      expect(screen.getByLabelText(/^Naziv trke/)).not.toHaveAttribute('aria-disabled', 'true')
    } finally {
      route.stop()
    }
  }, SLOW)
})

/* WHAT THE STORE HELD WHILE THE SERVER WAS ASKED stood here until R2 of the results flows: that
   the run was written into the browser only after the server agreed. Nothing about a run sent is
   written into the browser any more, so there is no store to hold to it; that a refusal confirms
   nothing and leaves every box as it was is `resultToTheServer.test.tsx`'s. */

describe('the measures of a result entered away from the calendar', () => {
  /* Owner, 16.10.2026, chosen between the outcomes offered: the form away from the calendar
     always has BOTH lines, because here the member picks the kind himself and always enters all
     six (PDL, 30.08.2026, which stands). The lines are drawn for the form and not for the kind
     picked in the list, so choosing a kind changes what the portal does with the numbers and not
     what it asks for. */
  const THE_LENGTH = ['Dužina (km)', 'Uspon (m)', 'Spust (m)']
  const THE_TIME = ['Sati', 'Minuti', 'Sekunde']

  /** The line a box stands on, by its label. */
  function lineOf(label: string): HTMLElement | null {
    return screen.getByLabelText(label).closest<HTMLElement>('.form__row')
  }

  /** The boxes on a line, by the names a reader hears for them, in the order they stand. */
  function boxesOn(line: HTMLElement): string[] {
    return within(line)
      .getAllByRole('textbox')
      .map((one) => must(inputElement(one).labels?.[0]?.textContent, 'the label of a box'))
  }

  it.each(RACE_KINDS)('draws the length in one line and the time under it, with a %s race picked', async (picked) => {
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.selectOptions(await screen.findByLabelText(/^Vrsta trke/, undefined, SOON), picked)

    const measured = must(lineOf('Dužina (km)'), 'the line of the length')
    const timed = must(lineOf('Sati'), 'the line of the time')

    expect(boxesOn(measured)).toEqual(THE_LENGTH)
    expect(boxesOn(timed)).toEqual(THE_TIME)
    expect(lineOf('Uspon (m)')).toBe(measured)
    expect(lineOf('Spust (m)')).toBe(measured)
    expect(lineOf('Minuti')).toBe(timed)
    expect(lineOf('Sekunde')).toBe(timed)
    expect(measured).not.toBe(timed)
    expect(measured.contains(timed)).toBe(false)
    expect(measured.compareDocumentPosition(timed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0)
    /* And the boxes above and below them stand on no line, as they did before the lines. */
    for (const stands of [/^Naziv trke/, /^Datum trke/, /^Link ka zvaničnim/, /^Komentar/]) {
      expect(screen.getByLabelText(stands).closest('.form__row')).toBeNull()
    }
  })
})
