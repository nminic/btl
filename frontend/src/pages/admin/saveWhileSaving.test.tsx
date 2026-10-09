import { act, screen, waitFor } from '@testing-library/react'
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
 * WHILE THE SAVE OF AN EVENT IS OUT, THE BUTTON THAT SENDS WAITS (owner, 05.10.2026, chosen between
 * offered outcomes; PDL, P6, „Dok čuvanje događaja traje", the last decision of the block; the wording
 * was offered to him and the choice is his).
 *
 * <p>It is the last control of the form to be held (`leavingWhileSaving.test.tsx` holds the way out,
 * `fieldsWhileSaving.test.tsx` holds what is typed), and the cause is measured: a second press on a new
 * event, with the event taken and a race still on its way, sent nothing and still said „Događaj sa tim
 * nazivom već postoji te godine" and took the cursor to the date. The form asked its questions before
 * the editor refused the press, and by then the event just taken was in the screen's list under the very
 * address the form shows. Offered and not chosen: switching off only the check of the name while the
 * save lasts, and leaving it.
 *
 * <p>The sentence is taken here in parts, each with its own case:
 *
 * <ul>
 * <li>(a) a press on it does NOTHING while the save is out, by each road a press comes by (the mouse,
 * Enter in a field, Enter on the button itself), on a new event and on a copy, which are the two forms
 * whose event is in the screen's list by the time its races are on the way: nothing is sent, the false
 * sentence is not said and the cursor stays where it was;</li>
 * <li>(b) it is told off and not switched off, from the press to the last answer and not before it,
 * with the sign that says why under the form;</li>
 * <li>(c) it is let go of at the LAST answer, not the first and not never, whatever the answers are: the
 * race refused, the event refused, a race refused in the middle of the press; and the press that follows
 * is a press;</li>
 * <li>(d) for a new event, one that stands and a copy;</li>
 * <li>(e) and the other three screens that send their save to a route are NOT held: the scope the same
 * block gives is the form of an event only (the record's wording, not the owner's quote), so there a
 * second press is asked everything it always was.</li>
 * </ul>
 *
 * <p><b>The refusal is read off a ref and not off the render</b>, like the refusal of „Nazad na
 * spisak". That half is asked where the renderer is, with a ref the test sets by hand
 * (`forms/FormRenderer.test.tsx`, „the button that sends"): a press in the tick the send began in cannot
 * be told from a press after it by anything a reader sees, because the refused press sends nothing
 * either way, the editor's own guard being there.
 *
 * <p><b>What is not asked here, and why.</b> The look of the held button is a stylesheet, which jsdom
 * does not apply, and it is held where the others are (`forms/formStyle.test.ts`). The window in which
 * the ref is already let go of and the render is not yet is a tick long and nothing a reader can enter;
 * it is asked by hand beside the other.
 */

const THE_LIST = '/sr/administracija/dogadjaji'

/** Event 32, a race with two races of a length of its own, opened as a copy. */
const THE_COPY = `${THE_LIST}?kopija=32`

const COPY_EVENT = 9401
const COPY_FIRST = 9301
const COPY_SECOND = 9302

/** A write that is out: where it went, how, what it carried, and the way to answer it. */
type Out = { path: string; how: string; init: RequestInit | undefined; done: (one: Response) => void }

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** The button that sends, asked of the document each time and never held on to: the form is drawn
 *  again between one write and the next. */
const save = (): HTMLElement => screen.getByRole('button', { name: 'Sačuvaj' })

/** The name of the event, which is a field that stays on the screen through the whole press. A cell of
 *  the table of races does not: its row is drawn again under the identity its own race is given. */
const theName = (): HTMLElement => screen.getByLabelText(/^Naziv događaja/)

describe('the button that sends, while the save of an event is out', () => {
  let watching: ReturnType<typeof serverThat>
  /** The writes of events and of their races that are out, the oldest first. Nothing else is held:
   *  the reads and the token go on to the disc as they always did. */
  let out: Out[]
  /** What the harness itself answers (`test/setup.ts`), before the hold is put in front of it. A write
   *  answered with `null` below is answered by it, the way the portal's own route would. */
  let harness: typeof fetch

  beforeEach(() => {
    out = []
    harness = globalThis.fetch
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
        out.push({ path, how, init, done })
      })
    })
  })

  afterEach(() => {
    watching.stop()
  })

  /** Answers the oldest write that is out, and waits for what the press does next: another write
   *  (then exactly one is out again) or its end (the case waits for what the end says). */
  async function answer(one: Response | null, then: 'another write' | 'the end'): Promise<void> {
    const head = must(out.shift(), 'a write is out')
    const said = one ?? (await harness(head.path, head.init))

    await act(async () => {
      head.done(said)
    })

    if (then === 'another write') {
      await waitFor(() => {
        expect(out).toHaveLength(1)
      })
    }
  }

  /** Presses Save, and waits until the first write of the press is out. Given half the time a case has,
   *  so that a press that was refused, and so sent nothing, fails on what it says (that no write is out)
   *  and not by running out of time for one that will not come. */
  async function press(user: Pressing): Promise<void> {
    await user.click(save())
    await waitFor(
      () => {
        expect(out).toHaveLength(1)
      },
      { timeout: SLOW / 2 },
    )
  }

  /** Everything the sentence says is true now: the button is told off and not switched off, it is
   *  still where the focus can reach it, and the sign that says why is up. */
  function expectHeld(): void {
    const button = save()

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button.matches(':disabled'), 'the button was switched off, which takes it out of the order of focus').toBe(false)
    expect(screen.getByText(sr.results.sending)).toHaveAttribute('role', 'status')
  }

  /** And the other half, for a form that stays after the save ends: the button carries no such word at
   *  all, and the sign is gone. */
  function expectLetGo(): void {
    expect(save()).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByText(sr.results.sending)).toBeNull()
  }

  /** A new event of one race: its press makes two writes, the event and the race. */
  async function aNewEventOfOneRace(): Promise<Pressing> {
    const user = setupUser()

    renderAt(THE_LIST, 'superadmin', '000001')
    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
    await user.type(theName(), 'BBKT zadržan')
    await user.type(screen.getByLabelText(/^Datum/), '10012027')
    await user.type(screen.getByLabelText(/^Mesto/), 'Niš')
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))
    await user.type(must(screen.getAllByLabelText(/^Dužina/).at(-1), 'the length'), '10')

    return user
  }

  /** The copy of event 32, which makes three writes: the event, and a race each of its two. */
  async function theCopy(): Promise<Pressing> {
    const user = setupUser()

    renderAt(THE_COPY, 'superadmin', '000001')
    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    return user
  }

  describe('a press on it while the save is out does nothing', () => {
    /** One road a press comes by, and where the cursor is after it if it did nothing. */
    type Road = {
      which: string
      press: (user: Pressing) => Promise<void>
      cursor: () => HTMLElement
    }

    /** One kind of form in which the situation can be made, with the writes of its press that are
     *  still to be answered once the event is taken and its first race is out. An event that stands is
     *  not here: it is excluded from the addresses it is asked about, so it is never told its own is
     *  taken, and a press on it that did nothing could not be told from one the editor refused. */
    type Shape = { shape: string; open: () => Promise<Pressing>; thenAnswered: number }

    const ROADS: Road[] = [
      { which: 'a click of the mouse', press: (user) => user.click(save()), cursor: save },
      {
        which: 'Enter in a field of the form',
        press: async (user) => {
          await user.click(theName())
          await user.keyboard('{Enter}')
        },
        cursor: theName,
      },
      {
        which: 'Enter on the button itself',
        press: async (user) => {
          save().focus()
          await user.keyboard('{Enter}')
        },
        cursor: save,
      },
    ]

    const SHAPES: Shape[] = [
      { shape: 'a new event', open: aNewEventOfOneRace, thenAnswered: 0 },
      { shape: 'a copy', open: theCopy, thenAnswered: 1 },
    ]

    const EVERY_ROAD_ON_EVERY_SHAPE = SHAPES.flatMap((one) =>
      ROADS.map((road) => ({ ...road, ...one })),
    )

    it.each(EVERY_ROAD_ON_EVERY_SHAPE)(
      'is not asked anything by $which on $shape: nothing is sent, the address is not said to be taken and the cursor stays',
      async ({ press: pressedBy, cursor, open, thenAnswered }) => {
        /* THE SITUATION THE OWNER MEASURED: a new event, taken by the route, and its race still on the
           way. The event is in the list of the screen by now, under the address the form shows, so a
           press that asked whether the address is free was told it is not. A copy is a new record too
           and is in the same situation. */
        const user = await open()

        await press(user)
        await answer(null, 'another write')

        /* The event is taken and the first race is on its way, and that is the whole situation. */
        expect(whereItWrote(watching.asked)).toEqual(['POST /api/events', 'POST /api/races'])
        expect(out).toHaveLength(1)

        await pressedBy(user)

        /* What the press did comes first, and that the button says it is held comes last: when the hold
           is taken away the case must say what the owner measured, a sentence and a cursor, and not
           only that an attribute is gone. */
        expect(
          screen.queryByText(sr.admin.eventTaken),
          'the press was asked whether the address of the event it has just made is free',
        ).toBeNull()
        expect(document.querySelector('[aria-invalid="true"]'), 'a field was marked wrong').toBeNull()
        expect(document.activeElement, 'the cursor moved').toBe(cursor())
        expect(whereItWrote(watching.asked), 'the press sent something').toEqual([
          'POST /api/events',
          'POST /api/races',
        ])
        expect(out, 'the press sent something').toHaveLength(1)
        expectHeld()

        for (let answered = 0; answered < thenAnswered; answered += 1) {
          await answer(null, 'another write')
        }

        await answer(null, 'the end')
        await screen.findByRole('status', { name: 'Sačuvano' })

        expect(whereItWrote(watching.asked)).toHaveLength(2 + thenAnswered)
      },
      SLOW,
    )

    it('says it, as the same form, when the address really is taken: the sentence the cases above keep out', async () => {
      /* THE FLOOR OF THE CASES ABOVE. They ask that a sentence is NOT there, and a sentence nobody can
         ever draw would let them pass for ever. This is the same form with nothing out, and the address
         it shows is the address of an event it has just made: it says the sentence under the date and
         takes the cursor there, which is exactly what a press that waits must not do. */
      const user = await aNewEventOfOneRace()

      await press(user)
      await answer(null, 'another write')
      await answer(null, 'the end')
      await screen.findByRole('status', { name: 'Sačuvano' })
      await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))
      await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
      await user.type(theName(), 'BBKT zadržan')
      await user.type(screen.getByLabelText(/^Datum/), '10012027')
      await user.type(screen.getByLabelText(/^Mesto/), 'Niš')
      await user.click(save())

      expect(await screen.findByText(sr.admin.eventTaken)).toBeVisible()
      expect(document.activeElement).toBe(screen.getByLabelText(/^Datum/))
      expect(out, 'a press that the form refused sent something').toHaveLength(0)
    }, SLOW)
  })

  describe('it is told off from the press to the last answer, and not before', () => {
    /** One way a form is opened, with the number of writes its press makes. */
    type Way = { which: string; open: () => Promise<{ user: Pressing; writes: number }> }

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
      { which: 'a copy', open: async () => ({ user: await theCopy(), writes: 3 }) },
      { which: 'a new event', open: async () => ({ user: await aNewEventOfOneRace(), writes: 2 }) },
      {
        which: 'an event that stands',
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
      'is told off at every write of the press of $which and carries no such word before it',
      async ({ open }) => {
        const { user, writes } = await open()

        expectLetGo()
        await press(user)

        for (let written = 1; written < writes; written += 1) {
          expectHeld()
          await answer(null, 'another write')
        }

        expectHeld()
        await answer(null, 'the end')
        await screen.findByRole('status', { name: 'Sačuvano' })

        expect(screen.queryByText(sr.results.sending)).toBeNull()
        expect(whereItWrote(watching.asked)).toHaveLength(writes)
      },
      SLOW,
    )
  })

  describe('it is let go of at the last answer, whatever it is, and the press that follows is a press', () => {
    it('is let go of when the last race is refused, and the next press sends the races and nothing else', async () => {
      const user = await theCopy()

      await press(user)
      await answer(json(201, { id: COPY_EVENT, slug: 'bbkt-9401' }), 'another write')
      await answer(json(201, { id: COPY_FIRST, eventDate: '', eventSlug: '' }), 'another write')
      expectHeld()
      await answer(refused('theDistanceIsNotKeptExactly'), 'the end')
      await screen.findByText(sr.admin.eventSavedRacesRefused)

      expectLetGo()

      /* A press of its own: the first race is written over by its identity and the second is made. */
      await press(user)
      expectHeld()
      await answer(null, 'another write')
      expectHeld()
      await answer(null, 'the end')
      await screen.findByRole('status', { name: 'Sačuvano' })

      expect(whereItWrote(watching.asked).slice(3)).toEqual([
        `PUT /api/races/${String(COPY_FIRST)}`,
        'POST /api/races',
      ])
    }, SLOW)

    it('is let go of when the event itself is refused, and the next press sends it again', async () => {
      const user = await theCopy()

      await press(user)
      expectHeld()
      await answer(refused('theAddressIsTaken', 409), 'the end')
      await screen.findByText(sr.admin.eventSaveRefused.theAddressIsTaken)

      expectLetGo()

      await press(user)
      expectHeld()
      expect(whereItWrote(watching.asked)).toEqual(['POST /api/events', 'POST /api/events'])

      await answer(null, 'another write')
      await answer(null, 'another write')
      await answer(null, 'the end')
      await screen.findByRole('status', { name: 'Sačuvano' })
    }, SLOW)

    it('is not let go of by a race that is refused in the middle of the press', async () => {
      /* The first of the copy's two races is refused and the second is taken, so the last answer is a
         success and the press ends in the sentence about the races. A button let go of at the first
         refusal would be live under the second request. */
      const user = await theCopy()

      await press(user)
      await answer(json(201, { id: COPY_EVENT, slug: 'bbkt-9401' }), 'another write')
      await answer(refused('theDistanceIsNotKeptExactly'), 'another write')
      expectHeld()
      await answer(json(201, { id: COPY_SECOND, eventDate: '', eventSlug: '' }), 'the end')
      await screen.findByText(sr.admin.eventSavedRacesRefused)

      expectLetGo()
    }, SLOW)
  })
})

describe('what is not held', () => {
  /** One of the three other screens that send their save to a route: how it is opened on a form with a
   *  box in it that the form demands, what its save is, and what the route answers when it took it. */
  type Other = {
    which: string
    box: RegExp
    save: { how: string; path: string }
    took: Response
    open: (user: Pressing) => Promise<void>
  }

  const OTHERS: Other[] = [
    {
      which: 'a competition',
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
    'asks a second press on $which everything it always asked, and the button carries no such word',
    async ({ box, save: sending, took, open }) => {
      /* The scope the same block of the PDL gives (P6, „Obim": the form of an event only; the record's
         wording, not the owner's quote). What waiting closes is a press writing into a table that
         changed under it and a question about an event the press itself is making, and only the events
         have either: these have one request each and nothing to be asked about it. So their button goes
         on doing what it did, and a hold that reached every editor, or one screen more than the events,
         would fail here twice: on the word, and on the sentence a second press is told. */
      let settle = (): void => {}
      const held = new Promise<Response>((done) => {
        settle = () => done(took)
      })
      const server = serverThat((path, init) =>
        path === sending.path && init?.method === sending.how ? held : null,
      )

      try {
        const user = setupUser()

        await open(user)
        await user.click(save())
        await waitFor(() => {
          expect(whereItWrote(server.asked)).toEqual([`${sending.how} ${sending.path}`])
        })

        /* The request is out and the button is not told off. */
        expect(save()).not.toHaveAttribute('aria-disabled')

        /* A second press with the form as it was: the form asks its questions, finds nothing wrong, and
           the editor's own guard against a second send refuses it. That guard is the only thing between
           this request and a second one on these screens, and the events no longer reach it (their
           button waits above it), so this is where it is asked. */
        await user.click(save())
        expect(whereItWrote(server.asked)).toEqual([`${sending.how} ${sending.path}`])
        expect(screen.queryByText('Ovo polje je obavezno.')).toBeNull()

        /* The box is emptied and the button pressed again: the form asks what it asks, and says the box
           is demanded. A press that waited would say nothing. */
        await user.clear(screen.getByLabelText(box))
        await user.click(save())

        expect(await screen.findByText('Ovo polje je obavezno.')).toBeVisible()
        expect(screen.getByLabelText(box)).toHaveAttribute('aria-invalid', 'true')

        /* And the first request, which was never in question, is answered and confirmed. */
        await act(async () => {
          settle()
        })
        await screen.findByRole('status', { name: 'Sačuvano' })
      } finally {
        /* Put back whatever happened, so a case that fails does not leave the next one without a `fetch`. */
        server.stop()
      }
    },
    SLOW,
  )
})
