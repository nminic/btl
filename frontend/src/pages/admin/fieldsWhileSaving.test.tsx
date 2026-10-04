import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadResource } from '../../data/client'
import type { BtlEvent, Race } from '../../data/types'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { refused, serverThat } from '../../test/serverAnswers'
import { whereItWrote } from '../../test/sent'
import { SLOW } from '../../test/slow'
import { setupUser, type Pressing } from '../../test/user'

/**
 * WHILE THE SAVE OF AN EVENT IS OUT, ITS FIELDS ARE HELD (owner, 04.10.2026, chosen between offered
 * outcomes; PDL, P6, „Dok čuvanje događaja traje", the last decision of the block; the wording was
 * offered to him and the choice is his).
 *
 * <p>It is the second half of what the form already does while a save is out: the way out is refused
 * (`leavingWhileSaving.test.tsx`), and now what is typed is. The cause is measured and is the whole
 * reason for it: a word typed into a row of the table or into the name of the event while the request
 * of one race is out replaces the row that press writes the identity of the race back onto, so the
 * next press deletes the race the first one had made and makes it again.
 *
 * <p>The sentence is taken here in parts, each with its own case:
 *
 * <ul>
 * <li>(a) every control of the form is held, the fields of the event and the cells of the table and
 * the two buttons that change the table, and held the way the portal holds a control that cannot
 * act: told off and not switched off, readable, dressed, and refusing in its handler as well;</li>
 * <li>(b) nothing the reader can try changes anything, whatever kind of control he tries it on;</li>
 * <li>(c) what that closes: the press that follows writes what the first left and nothing else;</li>
 * <li>(d) it is held until the LAST answer and not before, and let go of at it, whatever it is: the
 * event refused, the last race refused, everything taken, and the press that sends only races, which
 * is held again at its first write and let go of at its own last answer, taken or refused;</li>
 * <li>(e) for a new event, for one that stands and for a copy;</li>
 * <li>(f) and the forms of the other screens are not held: the scope the same block gives („Obim" in
 * PDL, P6; the record's wording, not the owner's quote) is the form of an event only, and these are
 * the three other screens that send their save to a route.</li>
 * </ul>
 *
 * <p><b>Derived from the page and not from a list.</b> The controls are what the form's own
 * `elements` answer, so a control drawn tomorrow is in every question below without anybody
 * remembering to add it, and the kinds of control are told apart by what they ARE (`kindOf`). The
 * floor is that the same controls are drawn while the save is out as before it (so a held set cannot
 * match the drawn one by the form drawing less), that some are open before the press (so a lock that
 * is always on does not pass), and that none of the table's is held before it.
 *
 * <p><b>Two things are asked of every control and they are not the same thing.</b> That it SAYS it is
 * held (`aria-disabled`, and `readOnly` for a box, and the dress) and that it REFUSES: a change that
 * ignores `readOnly` altogether, which is what `fireEvent.change` is, and a press on a button that
 * says it is told off. `aria-disabled` stops nothing by itself.
 *
 * <p><b>What this does not ask, and why.</b> The button that sends is not a control of the fields
 * and is not held: a second press is refused off the ref (`EntityEditor`). A checkbox and a radio
 * are not drawn by this form, and the way a held field is made one is the renderer's and not the
 * editor's (`forms/FormRenderer.test.tsx`, „is locked whatever kind of control it is drawn as").
 */

const THE_LIST = '/sr/administracija/dogadjaji'

/** Event 32, with two races of a length of its own, opened as a copy. */
const THE_COPY = `${THE_LIST}?kopija=32`

const COPY_EVENT = 9401
const COPY_FIRST = 9301
const COPY_SECOND = 9302

/** A write that is out: where it went, how, and the way to answer it. */
type Out = { path: string; how: string; done: (one: Response) => void }

/** The controls of a form, told apart by where they stand: in the table of races or outside it. */
type Controls = { event: HTMLElement[]; races: HTMLElement[] }

/** The controls as they were before any save was out, and which of them the browser's own attribute
 *  had switched off by then. Written down at that moment and not asked again, because the same
 *  elements asked later answer for the way they are later, which is no comparison at all. */
type Before = Controls & { off: boolean[] }

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** What a control is called, for a sentence that says which one: its name, its label or its words. */
function describing(control: HTMLElement): string {
  const said = [
    control.getAttribute('name'),
    control.getAttribute('aria-label'),
    control.id,
    control.textContent,
  ].find((one) => one !== null && one !== '')

  return `${control.tagName.toLowerCase()} ${said ?? 'with no name'}`
}

const isHeld = (control: HTMLElement): boolean => control.getAttribute('aria-disabled') === 'true'

/** Switched off by the browser's own attribute, which only the country beside a town the codebook
 *  knows is, by a rule of its own (`forms/PlaceField.tsx`): a control nobody can try. */
const isSwitchedOff = (control: HTMLElement): boolean => control.matches(':disabled')

/** Every control of the form called this, and the table's apart from the event's. */
function controlsOf(title: string): Controls {
  const named = screen.getByRole('form', { name: title })
  /* Looked at and not asserted into a shape (ADL A14). */
  const form = must(named instanceof HTMLFormElement ? named : null, `a form called ${title}`)
  const table = screen.queryByRole('region', { name: /^Trke na događaju/ })
  const every = Array.from(form.elements).filter(
    (one): one is HTMLElement => one instanceof HTMLElement,
  )

  return {
    event: every.filter(
      (one) =>
        table?.contains(one) !== true && !(one instanceof HTMLButtonElement && one.type === 'submit'),
    ),
    races: every.filter((one) => table?.contains(one) === true),
  }
}

/** Boxes somebody types into, which are the ones that have a `readOnly` to be told off with. */
const boxesOf = (controls: HTMLElement[]): (HTMLInputElement | HTMLTextAreaElement)[] =>
  controls.filter(
    (one): one is HTMLInputElement | HTMLTextAreaElement =>
      one instanceof HTMLInputElement || one instanceof HTMLTextAreaElement,
  )

/** Controls that wear the dress of a held control when they are held: the boxes and the selects. */
const dressedOf = (
  controls: HTMLElement[],
): (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[] =>
  controls.filter(
    (one): one is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
      one instanceof HTMLInputElement ||
      one instanceof HTMLSelectElement ||
      one instanceof HTMLTextAreaElement,
  )

/** What a reader could change about a control, as one line: its value and whether it is open. */
function stateOf(control: HTMLElement): string {
  const value =
    control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement ||
    control instanceof HTMLTextAreaElement
      ? control.value
      : ''

  return `${describing(control)} = ${value} | ${control.getAttribute('aria-expanded') ?? ''}`
}

/** The whole form as a reader could change it: every control, in order, so that a control added or
 *  taken away shows as well as one that was typed into. */
function snapshot(title: string): string[] {
  const { event, races } = controlsOf(title)

  return [...races, ...event].map(stateOf)
}

/** Tried the way a reader tries it, and by the roads that do not honour `readOnly`: a change handed
 *  straight to the control (which is also what a browser's autofill and a screen reader's dictation
 *  do), and a press on a button. */
function tryOne(control: HTMLElement): void {
  if (control instanceof HTMLSelectElement) {
    const other = must(
      Array.from(control.options).find((one) => one.value !== control.value),
      `another answer of ${describing(control)}`,
    )

    fireEvent.change(control, { target: { value: other.value } })
  } else if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
    fireEvent.change(control, { target: { value: 'x7' } })
  } else {
    fireEvent.click(control)
  }
}

/** A control that can be tried at all: not switched off, and not a step that is already on the day
 *  it offers (pressed again it writes what the box holds, so it could not move however it is held). */
const canBeTried = (control: HTMLElement): boolean =>
  !isSwitchedOff(control) && control.getAttribute('aria-pressed') !== 'true'

/** Every control that can be tried, tried once, and the ones that moved something by name. Nothing
 *  moves where they are held. */
function whatMovedWhenTried(title: string): string[] {
  const { event, races } = controlsOf(title)
  const moved: string[] = []

  for (const control of [...races, ...event].filter(canBeTried)) {
    const before = snapshot(title)

    tryOne(control)

    if (snapshot(title).join('\n') !== before.join('\n')) {
      moved.push(describing(control))
    }
  }

  return moved
}

/** What a control IS, and where it stands: „race button Obriši # trku". The number of a row is not a
 *  difference between two kinds of control, so it is taken out of the words. */
function kindOf(control: HTMLElement, inTheTable: boolean): string {
  const words =
    control instanceof HTMLButtonElement
      ? (control.getAttribute('aria-label') ?? control.textContent ?? '').replace(/\d+/g, '#')
      : control instanceof HTMLInputElement
        ? control.type
        : ''

  return `${inTheTable ? 'race' : 'event'} ${control.tagName.toLowerCase()} ${words}`.trim()
}

/**
 * The kinds of control, among those given, that did NOT move when one of them was tried: the other
 * half of „nothing moved", asked after the save has ended, so that what refused it was the hold and
 * not a control that never could.
 *
 * <p>The table's controls come first: changing the kind of the event takes the table off the screen,
 * and what stands after it cannot be asked about any more.
 */
function stuckKinds(title: string, among: 'the table' | 'everything'): string[] {
  const first = controlsOf(title)
  const wanted = among === 'the table' ? first.races : [...first.races, ...first.event]
  const kinds = [
    ...new Set(wanted.filter(canBeTried).map((one) => kindOf(one, first.races.includes(one)))),
  ]
  const stuck: string[] = []

  expect(kinds.length, 'the form draws no control, so nothing below measures anything').toBeGreaterThan(0)

  for (const kind of kinds) {
    const now = controlsOf(title)
    const control = must(
      [...now.races, ...now.event].find(
        (one) => canBeTried(one) && kindOf(one, now.races.includes(one)) === kind,
      ),
      `a control of the kind ${kind}`,
    )
    const before = snapshot(title)

    tryOne(control)

    if (snapshot(title).join('\n') === before.join('\n')) {
      stuck.push(kind)
    }
  }

  return stuck
}

describe('an event whose save is out holds its fields', () => {
  let watching: ReturnType<typeof serverThat>
  /** The writes of events and of their races that are out, the oldest first. Nothing else is held:
   *  the reads and the token go on to the disc as they always did. */
  let out: Out[]
  let racesMade: number

  beforeEach(() => {
    out = []
    racesMade = 0
    watching = serverThat((path, init) => {
      const how = init?.method ?? 'GET'
      const ofAnEvent =
        path === '/api/events' ||
        path.startsWith('/api/events/') ||
        path === '/api/races' ||
        path.startsWith('/api/races/')

      if (how === 'GET' || !ofAnEvent) {
        return null
      }

      return new Promise<Response>((done) => {
        out.push({ path, how, done })
      })
    })
  })

  afterEach(() => {
    watching.stop()
  })

  /** What the route says when it took a write, by the address it was sent to. */
  function took(one: Out): Response {
    if (one.path === '/api/events') {
      return json(201, { id: COPY_EVENT, slug: 'bbkt-9401' })
    }

    if (one.path.startsWith('/api/events/')) {
      return json(200, { id: Number(one.path.split('/').pop()), slug: 'bbkt-9401' })
    }

    if (one.path === '/api/races') {
      /* In the order they are made: 9301 for the first, 9302 for the second, and 9303 for the one a
         retry makes after the third was refused. */
      racesMade += 1

      return json(201, { id: 9300 + racesMade, eventDate: '', eventSlug: '' })
    }

    return new Response(null, { status: 204 })
  }

  /** Answers the oldest write that is out, and waits for what the press does next: another write
   *  (then exactly one is out again) or its end. */
  async function answer(one: Response | null, then: 'another write' | 'the end'): Promise<void> {
    const head = must(out.shift(), 'a write is out')

    await act(async () => {
      head.done(one ?? took(head))
    })

    if (then === 'another write') {
      await waitFor(() => {
        expect(out).toHaveLength(1)
      })
    }
  }

  /** Presses Save, and waits until the first write of the press is out. */
  async function press(user: Pressing): Promise<void> {
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await waitFor(() => {
      expect(out).toHaveLength(1)
    })
  }

  /** Before the press: the table holds nothing, some control of the event is open, and the form
   *  draws something. The three floors every case below stands on. */
  function expectOpen(title: string): Before {
    const open = controlsOf(title)

    expect(open.races.length, 'the table draws no control, so nothing below measures it').toBeGreaterThan(0)
    expect(
      open.races.filter(isHeld).map(describing),
      'a control of the table is held before any save is out',
    ).toEqual([])
    expect(
      open.event.filter((one) => !isHeld(one)).length,
      'every control of the event is held before any save is out, so the save is not what holds them',
    ).toBeGreaterThan(0)

    return { ...open, off: [...open.races, ...open.event].map(isSwitchedOff) }
  }

  /** Everything the sentence says is true now, asked of the controls and not of a list. */
  function expectHeld(title: string, open: Before): void {
    const now = controlsOf(title)
    const all = [...now.races, ...now.event]

    expect(
      now.event.map(describing),
      'the form draws other controls while the save is out, so the held set could match it by drawing less',
    ).toEqual(open.event.map(describing))
    expect(now.races.map(describing)).toEqual(open.races.map(describing))
    expect(
      all.filter((one) => !isHeld(one)).map(describing),
      'a control is open while the save is out',
    ).toEqual([])
    expect(
      boxesOf(all)
        .filter((one) => !one.readOnly)
        .map(describing),
      'a box that is held still takes typing',
    ).toEqual([])
    expect(
      dressedOf(all)
        .filter((one) => !one.classList.contains('field__control--held'))
        .map(describing),
      'a held control is dressed as a live one',
    ).toEqual([])
    /* Told off and not switched off: whatever the browser's own attribute had switched off before the
       press is what it has switched off now, as it was written down then. */
    expect(
      all.map(isSwitchedOff),
      'a control was switched off by the save, which takes it out of the order of focus',
    ).toEqual(open.off)
    expect(screen.getByText(sr.results.sending)).toHaveAttribute('role', 'status')
  }

  /** And the other half for a form the save has let go of: nothing of the table is held. */
  function expectTableLetGo(title: string): void {
    expect(
      controlsOf(title).races.filter(isHeld).map(describing),
      'a control of the table is still held after the save ended',
    ).toEqual([])
    expect(screen.queryByText(sr.results.sending)).toBeNull()
  }

  /** The copy of event 32 with a third row typed into the table, so that a refusal can come after the
   *  second race, and so that the second is neither the first nor the last. */
  async function theCopyWithThreeRaces(): Promise<Pressing> {
    const user = setupUser()

    renderAt(THE_COPY, 'superadmin', '000001')
    await screen.findByRole('heading', { name: /^Trke na događaju/ })
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))

    const third = screen.getByLabelText('Trka, 3. trka')

    await user.clear(third)
    await user.type(third, 'Treća trka')
    await user.type(must(screen.getAllByLabelText(/^Dužina/).at(-1), 'the length of the third'), '5')

    return user
  }

  /** The press of the copy up to the moment the SECOND of its three races is out. */
  async function untilTheSecondRaceIsOut(user: Pressing): Promise<void> {
    await press(user)
    await answer(null, 'another write')
    await answer(null, 'another write')
    expect(out.map((one) => `${one.how} ${one.path}`)).toEqual(['POST /api/races'])
  }

  describe('every control, from the press to the last answer', () => {
    /** One way a form is opened, with the number of writes its press makes. */
    type Way = {
      which: string
      title: string
      open: () => Promise<{ user: Pressing; writes: number }>
    }

    /** A served event of a race with two races or more. */
    async function aServedEventWithRaces(): Promise<{ event: BtlEvent; races: Race[] }> {
      const events = await loadResource<BtlEvent[]>('events')
      const races = await loadResource<Race[]>('races')
      const event = must(
        events
          .filter(
            (one) =>
              one.kind === 'race' && races.filter((race) => race.eventId === one.id).length >= 2,
          )
          .at(-1),
        'a served event with two races or more',
      )

      return { event, races: races.filter((race) => race.eventId === event.id) }
    }

    const WAYS: Way[] = [
      {
        which: 'a copy',
        title: sr.admin.form.copying,
        open: async () => {
          const user = setupUser()

          renderAt(THE_COPY, 'superadmin', '000001')
          await screen.findByRole('heading', { name: /^Trke na događaju/ })

          return { user, writes: 3 }
        },
      },
      {
        which: 'a new event',
        title: sr.admin.form.new.events,
        open: async () => {
          const user = setupUser()

          renderAt(THE_LIST, 'superadmin', '000001')
          await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
          await user.type(screen.getByLabelText(/^Naziv događaja/), 'BBKT zadržan')
          await user.type(screen.getByLabelText(/^Datum/), '10012027')
          await user.type(screen.getByLabelText(/^Mesto/), 'Niš')
          await user.click(screen.getByRole('button', { name: 'Nova trka' }))
          await user.type(must(screen.getAllByLabelText(/^Dužina/).at(-1), 'the length'), '10')

          return { user, writes: 2 }
        },
      },
      {
        which: 'an event that stands',
        title: sr.admin.form.edit.events,
        open: async () => {
          const { event, races } = await aServedEventWithRaces()
          const user = setupUser()

          renderAt(`${THE_LIST}?izmena=${String(event.id)}`, 'superadmin', '000001')
          await screen.findByRole('heading', { name: /^Trke na događaju/ })

          return { user, writes: races.length + 1 }
        },
      },
    ]

    it.each(WAYS)(
      'holds every control of $which at every write of its press, and takes nothing it is given',
      async ({ title, open }) => {
        const { user, writes } = await open()
        const before = expectOpen(title)

        await press(user)

        for (let written = 1; written < writes; written += 1) {
          expectHeld(title, before)

          if (written === 1) {
            /* Tried once, with the event itself out, which is the first write of every press. */
            const typed = snapshot(title)

            expect(whatMovedWhenTried(title), 'a control took what it was given').toEqual([])
            expect(snapshot(title)).toEqual(typed)
          }

          await answer(null, 'another write')
        }

        expectHeld(title, before)
        await answer(null, 'the end')
        await screen.findByRole('status', { name: 'Sačuvano' })

        expect(screen.queryByText(sr.results.sending)).toBeNull()
        expect(whereItWrote(watching.asked)).toHaveLength(writes)
      },
      SLOW,
    )
  })

  describe('what holding them closes', () => {
    /** What a reader does with the second of three races out, one way each. Every one of them changed
     *  the form on `main` before this, and the next press then wrote something other than the three
     *  requests it should: four of them, three with a `DELETE` among them, or none at all (measured). */
    const TRIES: { what: string; tried: (user: Pressing) => Promise<void> }[] = [
      {
        what: 'a word is typed into the name of the event',
        tried: (user) => user.type(screen.getByLabelText(/^Naziv događaja/), ' x'),
      },
      {
        what: 'a word is typed into the name of the second race',
        tried: (user) => user.type(screen.getByLabelText('Trka, 2. trka'), ' i još'),
      },
      {
        what: 'a digit is typed into the length of the second race',
        tried: (user) =>
          user.type(must(screen.getAllByLabelText(/^Dužina/)[1], 'the length of the second'), '9'),
      },
      {
        what: 'a digit is typed into the day of the second race',
        tried: (user) => user.type(screen.getByLabelText('Datum, 2. trka'), '1'),
      },
      {
        what: 'the kind of the second race is changed to one that asks for more',
        tried: (user) => user.selectOptions(screen.getByLabelText('Vrsta, 2. trka'), 'time'),
      },
      {
        what: 'the second race is taken off the table',
        tried: (user) => user.click(screen.getByRole('button', { name: 'Obriši 2. trku' })),
      },
      {
        what: 'a row is added to the table',
        tried: (user) => user.click(screen.getByRole('button', { name: 'Nova trka' })),
      },
    ]

    it.each(TRIES)(
      'writes the three races once more and no more when $what',
      async ({ tried }) => {
        const user = await theCopyWithThreeRaces()
        const open = expectOpen(sr.admin.form.copying)

        await untilTheSecondRaceIsOut(user)

        const typed = snapshot(sr.admin.form.copying)

        await tried(user)
        expect(snapshot(sr.admin.form.copying), 'the reader changed the form while the request was out').toEqual(typed)

        /* The second is taken and the third, which was out after it, is refused. */
        await answer(null, 'another write')
        await answer(refused('theDistanceIsNotKeptExactly'), 'the end')
        await screen.findByText(sr.admin.eventSavedRacesRefused)

        /* The press that sends only races is a press of its own, and it holds the table again. */
        const before = watching.asked.length

        await press(user)
        expectHeld(sr.admin.form.copying, open)
        await answer(null, 'another write')
        await answer(null, 'another write')
        await answer(null, 'the end')
        await screen.findByRole('status', { name: 'Sačuvano' })

        expect(whereItWrote(watching.asked.slice(before))).toEqual([
          `PUT /api/races/${String(COPY_FIRST)}`,
          `PUT /api/races/${String(COPY_SECOND)}`,
          'POST /api/races',
        ])
      },
      SLOW,
    )
  })

  describe('until the last answer, and not before, whatever it is', () => {
    it('lets go of the table and keeps the event held when the last race is refused', async () => {
      const user = await theCopyWithThreeRaces()
      const open = expectOpen(sr.admin.form.copying)

      await untilTheSecondRaceIsOut(user)
      await answer(null, 'another write')
      expectHeld(sr.admin.form.copying, open)
      await answer(refused('theDistanceIsNotKeptExactly'), 'the end')
      await screen.findByText(sr.admin.eventSavedRacesRefused)

      /* The rows are what the next press sends, so they are open; the event is held by the wait, which
         is the other reason it has to be held and is not this one (`racesWait.test.tsx`). */
      expectTableLetGo(sr.admin.form.copying)
      expect(controlsOf(sr.admin.form.copying).event.every(isHeld)).toBe(true)
      expect(stuckKinds(sr.admin.form.copying, 'the table'), 'a kind of control stayed held').toEqual([])
    }, SLOW)

    it('lets go of the table again when the press that sends only races is refused again', async () => {
      /* The press that follows a refusal is a press of its own: held again at its first write, and, when
         it ends in a refusal as well, let go of at its own last answer and not kept from the first. */
      const user = await theCopyWithThreeRaces()
      const open = expectOpen(sr.admin.form.copying)

      await untilTheSecondRaceIsOut(user)
      await answer(null, 'another write')
      await answer(refused('theDistanceIsNotKeptExactly'), 'the end')
      await screen.findByText(sr.admin.eventSavedRacesRefused)
      expectTableLetGo(sr.admin.form.copying)

      await press(user)
      expectHeld(sr.admin.form.copying, open)
      await answer(null, 'another write')
      expectHeld(sr.admin.form.copying, open)
      await answer(null, 'another write')
      expectHeld(sr.admin.form.copying, open)
      await answer(refused('theDistanceIsNotKeptExactly'), 'the end')
      await waitFor(() => {
        expect(screen.queryByText(sr.results.sending)).toBeNull()
      })

      expectTableLetGo(sr.admin.form.copying)
      expect(controlsOf(sr.admin.form.copying).event.every(isHeld)).toBe(true)
      expect(stuckKinds(sr.admin.form.copying, 'the table'), 'a kind of control stayed held').toEqual([])
    }, SLOW)

    it('lets go of everything when the event itself is refused', async () => {
      const user = await theCopyWithThreeRaces()
      const open = expectOpen(sr.admin.form.copying)

      await press(user)
      expectHeld(sr.admin.form.copying, open)
      await answer(refused('theAddressIsTaken', 409), 'the end')
      await screen.findByText(sr.admin.eventSaveRefused.theAddressIsTaken)

      expectTableLetGo(sr.admin.form.copying)
      expect(
        [...controlsOf(sr.admin.form.copying).event].filter(isHeld).map(describing),
        'a field of the event is still held after its save was refused',
      ).toEqual([])
      expect(stuckKinds(sr.admin.form.copying, 'everything'), 'a kind of control stayed held').toEqual([])
    }, SLOW)
  })
})

describe('what is not held', () => {
  /** One of the three other screens that send their save to a route: how it is opened on a form with
   *  a box in it, what its save is, and what the route answers when it took it. */
  type Other = {
    which: string
    title: string
    box: RegExp
    save: { how: string; path: string }
    took: Response
    open: (user: Pressing) => Promise<void>
  }

  const OTHERS: Other[] = [
    {
      which: 'a competition',
      title: sr.admin.form.new.leagues,
      box: /^Naziv lige/,
      save: { how: 'POST', path: '/api/leagues' },
      took: json(201, { id: 4212, slug: 'vojvodjanska-2027' }),
      open: async (user) => {
        renderAt('/sr/administracija/lige', 'superadmin')
        await user.click(await screen.findByRole('button', { name: 'Nova liga' }))
        await user.type(screen.getByLabelText(/^Naziv lige/), 'Vojvođanska liga 2027')
        await user.type(screen.getByLabelText(/^Adresa/), 'vojvodjanska-2027')
        await user.type(screen.getByLabelText(/^Sezona/), '2027')
      },
    },
    {
      which: 'a moderator',
      title: sr.admin.form.new.moderators,
      box: /^Ime/,
      save: { how: 'POST', path: '/api/moderators' },
      took: json(201, { id: 501, email: 'novi.moderator@primer.rs' }),
      open: async (user) => {
        renderAt('/sr/administracija/moderatori', 'superadmin')
        await user.click(await screen.findByRole('button', { name: 'Nov moderator' }))
        await user.type(screen.getByLabelText(/^Ime/), 'Novi')
        await user.type(screen.getByLabelText(/^Prezime/), 'Moderator')
        await user.type(
          screen.getByLabelText(/^Adresa elektronske pošte/),
          'novi.moderator@primer.rs',
        )
      },
    },
    {
      which: 'a price',
      title: sr.admin.form.edit.pricing,
      box: /Iznos u evrima/,
      save: { how: 'PUT', path: '/api/pricing/early' },
      took: json(200, { key: 'early', eur: 33, rsd: 4200 }),
      open: async (user) => {
        renderAt('/sr/administracija/cenovnik', 'superadmin')
        await screen.findByRole('table', { name: 'Cenovnik' })
        await user.click(screen.getByRole('button', { name: 'Otvori: 15. do 31. oktobra' }))

        const eur = screen.getByLabelText(/Iznos u evrima/)

        await user.clear(eur)
        await user.type(eur, '33')
      },
    },
  ]

  it.each(OTHERS)(
    'leaves the fields of $which open while its save is out: only the events hold them',
    async ({ title, box, save, took, open }) => {
      /* The scope the same block of the PDL gives (P6, „Obim": the form of an event only; the record's
         wording, not the owner's quote). What holding the fields closes is a press writing into a table
         that changed under it, and only the events have a table: these have nothing a typed word could
         take away from the press that is out. So these forms go on doing what they did, and a hold that
         reached every editor, or one screen more than the events, would fail here on every control of
         it. */
      let answer = (): void => {}
      const held = new Promise<Response>((settle) => {
        answer = () => settle(took)
      })
      const server = serverThat((path, init) =>
        path === save.path && init?.method === save.how ? held : null,
      )

      try {
        const user = setupUser()

        await open(user)
        await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
        await waitFor(() => {
          expect(whereItWrote(server.asked)).toEqual([`${save.how} ${save.path}`])
        })

        /* The request is out. Nothing is held, and the box takes what is typed into it. */
        const named = screen.getByRole('form', { name: title })
        const controls = Array.from(
          must(named instanceof HTMLFormElement ? named : null, `the form ${title}`).elements,
        ).filter((one): one is HTMLElement => one instanceof HTMLElement)

        expect(controls.length, 'the form draws no control, so nothing here measures anything').toBeGreaterThan(0)
        expect(controls.filter(isHeld).map(describing)).toEqual([])
        expect(boxesOf(controls).filter((one) => one.readOnly).map(describing)).toEqual([])

        const before = screen.getByLabelText(box)

        if (!(before instanceof HTMLInputElement)) {
          throw new Error('the box is not an input')
        }

        const was = before.value

        await user.type(before, '1')
        expect(screen.getByLabelText(box)).toHaveValue(`${was}1`)

        answer()
        await screen.findByRole('status', { name: 'Sačuvano' })
      } finally {
        /* Put back whatever happened, so a case that fails does not leave the next one without a `fetch`. */
        server.stop()
      }
    },
    SLOW,
  )
})
