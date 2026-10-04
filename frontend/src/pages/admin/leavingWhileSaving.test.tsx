import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CONTACT_ADDRESS } from '../../app/routes'
import { loadResource } from '../../data/client'
import type { BtlEvent, Race } from '../../data/types'
import { RESULTS } from '../../data/useResource'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, refused, serverThat } from '../../test/serverAnswers'
import { whereItWrote } from '../../test/sent'
import { SLOW } from '../../test/slow'
import { setupUser, type Pressing } from '../../test/user'

/**
 * WHILE THE SAVE OF AN EVENT IS OUT, THE FORM CANNOT BE LEFT IN ANY WAY (owner, 04.10.2026, chosen
 * between offered outcomes; PDL, P6, „Dok čuvanje događaja traje"; the wording was offered to him and
 * the choice is his).
 *
 * <p>It came after three rounds of review of PR 483, each of which found one more road out of the
 * form while a request was on its way, and each road ended in a press writing into a form it was not
 * begun in (a second event, with the races of the first moved under it). The answer is not a guard on
 * each write but that the press cannot be outlived by its form: a way out waits for the save to end,
 * and the sentence of the decision is taken here in parts, each with its own case:
 *
 * <ul>
 * <li>(a) „Nazad na spisak" waits: told off, and refused when pressed;</li>
 * <li>(b) the links wait: every one the page draws, the language menu and any navigation made by code;</li>
 * <li>(c) the browser's Back (and Forward) wait;</li>
 * <li>(d) a visible sign that it is saving, while it is, and not after;</li>
 * <li>(e) they wait until the LAST answer: not the first, and not never, whatever the answers are.</li>
 * </ul>
 *
 * <p><b>Every case that holds the reader asks the same thing of the world after it lets go</b>: the
 * road that was refused is taken again and moves, so „did not move" above it is the refusal and not a
 * road that never could.
 *
 * <p><b>The setups keep apart what a wrong answer would share.</b> The copy of event 32 has two races,
 * so the first and the last write of a press are different writes, and every write of a press is held
 * and answered in turn: a refusal that ended with the first answer fails at the second. The events and
 * the races each have an identity of their own, so a request that went under the wrong one is told by
 * its address. A way out is tried while the event itself is out, while a race is, and while a deletion
 * is, on a new event, one that stands and a copy.
 *
 * <p><b>What is NOT held, written down and not guarded:</b> signing out (and, on QA, changing the role)
 * goes on working while a save is out (owner, 04.10.2026): whoever signs out in the middle of a save is
 * not told what was saved. The one case about it below holds that it is so, because it is a decision and
 * not an accident. Refreshing the page and closing the tab are the browser's to allow.
 */

const THE_LIST = '/sr/administracija/dogadjaji'

/** Event 32, a race with two races of a length of its own, opened as a copy. */
const THE_COPY = `${THE_LIST}?kopija=32`

const COPY_EVENT = 9401
const COPY_FIRST = 9301
const COPY_SECOND = 9302

type Router = ReturnType<typeof renderAt>['router']

/** A write that is out: where it went, how, and the way to answer it. */
type Held = { path: string; how: string; done: (one: Response) => void }

const where = (router: Router): string =>
  `${router.state.location.pathname}${router.state.location.search}`

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('an event whose save is out cannot be left', () => {
  let watching: ReturnType<typeof serverThat>
  /** The writes of events and of their races that are out, the oldest first. Nothing else is held:
   *  the reads, the token and the signing out go on to the disc as they always did. */
  let out: Held[]
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
  function took(one: Held): Response {
    if (one.path === '/api/events') {
      return json(201, { id: COPY_EVENT, slug: 'bbkt-9401' })
    }

    if (one.path.startsWith('/api/events/')) {
      return json(200, { id: Number(one.path.split('/').pop()), slug: 'bbkt-9401' })
    }

    if (one.path === '/api/races') {
      racesMade += 1

      return json(201, { id: 9300 + racesMade, eventDate: '', eventSlug: '' })
    }

    return answeredWith(204)
  }

  /** Answers the oldest write that is out, and waits for what the press does next: another write
   *  (then exactly one is out again) or its end (the case waits for what the end says). */
  async function answer(
    one: Response | null,
    then: 'another write' | 'the end',
  ): Promise<void> {
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

  /** The copy of event 32 on the screen, with the entries in the history that a road needs. */
  async function theCopyOpen(
    shape: 'alone' | 'after the list' | 'before another entry',
  ): Promise<{ user: Pressing; router: Router }> {
    const user = setupUser()
    const { router } = renderAt(
      shape === 'after the list' ? THE_LIST : THE_COPY,
      'superadmin',
      '000001',
    )

    if (shape === 'after the list') {
      await screen.findByRole('table', { name: 'Događaji' })
      await act(async () => {
        await router.navigate(THE_COPY)
      })
    }

    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    if (shape === 'before another entry') {
      await act(async () => {
        await router.navigate(THE_LIST)
      })
      await screen.findByRole('table', { name: 'Događaji' })
      await act(async () => {
        await router.navigate(-1)
      })
      await screen.findByRole('heading', { name: /^Trke na događaju/ })
    }

    /* THE ROUTER'S REFUSAL IS REGISTERED BY TWO PASSES OF EFFECTS after the form is drawn (`useBlocker`
       makes its own key in the first and gives the router its function in the second), and `findBy`
       returns as soon as the heading is in the document. A press and a way out in one tick, which is
       the case of that name, would find the router open if that were not waited for. A person cannot
       press Save in the frame the form is drawn in, so this is the fixture and not the portal. Measured
       by running that case alone: eight runs of eight failed without this wait, and eight of eight
       passed with it. */
    await act(async () => {
      await Promise.resolve()
    })

    return { user, router }
  }

  /** Presses Save, and waits until the first write of the press is out. */
  async function press(user: Pressing): Promise<void> {
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await waitFor(() => {
      expect(out).toHaveLength(1)
    })
  }

  /** The copy's three writes, answered in turn, to the confirmation. */
  async function finishTheCopy(): Promise<void> {
    await answer(json(201, { id: COPY_EVENT, slug: 'bbkt-9401' }), 'another write')
    await answer(json(201, { id: COPY_FIRST, eventDate: '', eventSlug: '' }), 'another write')
    await answer(json(201, { id: COPY_SECOND, eventDate: '', eventSlug: '' }), 'the end')
    await screen.findByRole('status', { name: 'Sačuvano' })
  }

  /** The reader is where he was: the address, the form on the screen, and no list drawn. */
  function expectOnTheForm(router: Router, title = sr.admin.form.copying, address = THE_COPY) {
    expect(where(router)).toBe(address)
    expect(screen.getByRole('form', { name: title })).toBeVisible()
    expect(screen.queryByRole('table', { name: 'Događaji' })).toBeNull()
  }

  /** Everything the sentence says is true now: the button is told off and refuses, the sign is up,
   *  a link is refused, and the reader is where he was. */
  async function expectHeld(
    user: Pressing,
    router: Router,
    title = sr.admin.form.copying,
    address = THE_COPY,
  ): Promise<void> {
    const back = screen.getByRole('button', { name: 'Nazad na spisak' })

    expect(back).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(sr.results.sending)).toHaveAttribute('role', 'status')

    await user.click(back)
    await user.click(screen.getByRole('link', { name: 'Kalendar' }))
    expectOnTheForm(router, title, address)
  }

  /** And the other half, for a form that stays after the save ends: the button is not told off, the
   *  sign is gone, and the button leaves for the list. The address is asked of the router straight
   *  after the press and not waited for, so a refusal that is never let go fails on what it says and
   *  not by running out of time for a list that will not come. */
  async function expectLetGo(user: Pressing, router: Router): Promise<void> {
    const back = screen.getByRole('button', { name: 'Nazad na spisak' })

    expect(back).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByText(sr.results.sending)).toBeNull()

    await user.click(back)
    await act(async () => {
      await Promise.resolve()
    })
    expect(where(router), 'the button did not leave the form').toBe(THE_LIST)
    expect(await screen.findByRole('table', { name: 'Događaji' })).toBeVisible()
  }

  describe('every road out, while the event itself is out', () => {
    it('refuses the button, and tells it off', async () => {
      const { user, router } = await theCopyOpen('alone')

      await press(user)

      const back = screen.getByRole('button', { name: 'Nazad na spisak' })

      expect(back).toHaveAttribute('aria-disabled', 'true')
      await user.click(back)
      expectOnTheForm(router)
    }, SLOW)

    it('refuses the link of the header that leads home', async () => {
      const { user, router } = await theCopyOpen('alone')

      await press(user)
      await user.click(screen.getByRole('link', { name: 'Naslovna strana' }))
      expectOnTheForm(router)
      await finishTheCopy()
      await user.click(screen.getByRole('link', { name: 'Naslovna strana' }))
      expect(where(router)).toBe('/sr')
    }, SLOW)

    it('refuses a link of the navigation that leads to another screen', async () => {
      const { user, router } = await theCopyOpen('alone')

      await press(user)
      await user.click(screen.getByRole('link', { name: 'Kalendar' }))
      expectOnTheForm(router)
      await finishTheCopy()
      await user.click(screen.getByRole('link', { name: 'Kalendar' }))
      expect(where(router)).toBe('/sr/kalendar')
    }, SLOW)

    it('refuses the link to this very screen, which takes the form off by the address and is the road a press once found', async () => {
      /* Same path, no query: the screen stays and the form goes, and that is why this road has a case
         of its own. A refusal that compared the paths alone would let it through. */
      const { user, router } = await theCopyOpen('alone')

      await press(user)
      await user.click(screen.getByRole('link', { name: 'Događaji' }))
      expectOnTheForm(router)
      await finishTheCopy()
      await user.click(screen.getByRole('link', { name: 'Događaji' }))
      expect(where(router)).toBe(THE_LIST)
      expect(await screen.findByRole('table', { name: 'Događaji' })).toBeVisible()
    }, SLOW)

    it('refuses the language menu', async () => {
      const { user, router } = await theCopyOpen('alone')

      await press(user)
      await user.click(screen.getByRole('button', { name: 'Jezik' }))
      await user.click(screen.getByRole('option', { name: /English/ }))
      expectOnTheForm(router)
      await finishTheCopy()
      await user.click(screen.getByRole('button', { name: 'Jezik' }))
      await user.click(screen.getByRole('option', { name: /English/ }))
      expect(where(router)).toBe(`/en/administracija/dogadjaji?kopija=32`)
    }, SLOW)

    it("refuses the browser's Back", async () => {
      const { user, router } = await theCopyOpen('after the list')

      await press(user)
      await act(async () => {
        await router.navigate(-1)
      })
      expectOnTheForm(router)
      await finishTheCopy()
      await act(async () => {
        await router.navigate(-1)
      })
      expect(where(router)).toBe(THE_LIST)
    }, SLOW)

    it("refuses the browser's Forward", async () => {
      const { user, router } = await theCopyOpen('before another entry')

      await press(user)
      await act(async () => {
        await router.navigate(1)
      })
      expectOnTheForm(router)
      await finishTheCopy()
      await act(async () => {
        await router.navigate(1)
      })
      expect(where(router)).toBe(THE_LIST)
    }, SLOW)

    it('refuses a change of the address that replaces the entry it stands on, which is how this screen writes its own', async () => {
      const { user, router } = await theCopyOpen('alone')

      await press(user)
      await act(async () => {
        await router.navigate(`${THE_LIST}?kopija=33`, { replace: true })
      })
      expectOnTheForm(router)
      await finishTheCopy()
      await act(async () => {
        await router.navigate(`${THE_LIST}?kopija=33`, { replace: true })
      })
      expect(where(router)).toBe(`${THE_LIST}?kopija=33`)
    }, SLOW)

    it('refuses a navigation made by code', async () => {
      const { user, router } = await theCopyOpen('alone')

      await press(user)
      await act(async () => {
        await router.navigate('/sr/kalendar')
      })
      expectOnTheForm(router)
      await finishTheCopy()
      await act(async () => {
        await router.navigate('/sr/kalendar')
      })
      expect(where(router)).toBe('/sr/kalendar')
    }, SLOW)

    it('refuses every link the page draws, and knows of no other kind of way out', async () => {
      /* DERIVED FROM THE PAGE AND NOT FROM A LIST: every link whose address begins with the language,
         which is every link the router carries, pressed one by one - the ones in the panels that are
         shut as well. A link drawn tomorrow is in it without anybody remembering to add it, and a link
         that is not the router's (a plain address that would leave the page) is not in it, which is
         what the second half asks: the only others are the skip link and the mail address. */
      const { user, router } = await theCopyOpen('alone')

      await press(user)

      const ofTheRouter = Array.from(document.querySelectorAll('a[href^="/sr"]'))

      expect(ofTheRouter.length, 'the page draws no link of the router').toBeGreaterThan(20)

      for (const link of ofTheRouter) {
        await act(async () => {
          fireEvent.click(link)
        })
      }

      expectOnTheForm(router)

      expect(
        Array.from(document.querySelectorAll('a[href]'))
          .map((one) => one.getAttribute('href'))
          .filter((href) => !String(href).startsWith('/sr'))
          .sort(),
      ).toEqual(['#content', `mailto:${CONTACT_ADDRESS}`].sort())

      await finishTheCopy()
      await user.click(screen.getByRole('link', { name: 'Kalendar' }))
      expect(where(router)).toBe('/sr/kalendar')
    }, SLOW)

    it('refuses a way out that comes in the very tick the press begins', async () => {
      /* A refusal read off React's state would be true only after the render the press causes. Both
         happen inside one `act`, so nothing is drawn between them. */
      const { user, router } = await theCopyOpen('alone')

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Sačuvaj' }))
        void router.navigate('/sr/kalendar')
      })
      await waitFor(() => {
        expect(out).toHaveLength(1)
      })
      expectOnTheForm(router)
      await finishTheCopy()
      await user.click(screen.getByRole('link', { name: 'Kalendar' }))
      expect(where(router)).toBe('/sr/kalendar')
    }, SLOW)
  })

  describe('the one place the portal asks the router to refuse', () => {
    /** Every source file of the portal that is not a test, found by walking the folder and not by a list. */
    function sourcesUnder(folder: string): string[] {
      return readdirSync(folder).flatMap((name) => {
        const path = join(folder, name)

        if (statSync(path).isDirectory()) {
          return sourcesUnder(path)
        }

        return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : []
      })
    }

    it('is `BlocksLeaving`, because a router keeps one blocker at a time and answers to the last it was given', () => {
      /* A second `useBlocker` anywhere would silently replace this one while a form of an event is open,
         and every case above would go on passing for the roads it did not touch. So the question is
         asked of the sources: who calls it. */
      const callers = sourcesUnder(join(process.cwd(), 'src'))
        .filter((path) => /\buseBlocker\s*\(/.test(readFileSync(path, 'utf-8')))
        .map((path) => path.split(sep).join('/').replace(/^.*\/src\//, 'src/'))

      expect(callers).toEqual(['src/pages/admin/BlocksLeaving.tsx'])
    })
  })

  describe('until the last answer, and not before', () => {
    it('is held while the event, the first race and the last race are each out in turn, and let go at the last answer', async () => {
      const { user, router } = await theCopyOpen('alone')

      await press(user)
      await expectHeld(user, router)
      await answer(json(201, { id: COPY_EVENT, slug: 'bbkt-9401' }), 'another write')
      await expectHeld(user, router)
      await answer(json(201, { id: COPY_FIRST, eventDate: '', eventSlug: '' }), 'another write')
      await expectHeld(user, router)
      await answer(json(201, { id: COPY_SECOND, eventDate: '', eventSlug: '' }), 'the end')
      await screen.findByRole('status', { name: 'Sačuvano' })

      expect(screen.queryByText(sr.results.sending)).toBeNull()
      /* What was refused changed nothing the press sent: its own three writes, and none of the
         reader's attempts. */
      expect(whereItWrote(watching.asked)).toEqual([
        'POST /api/events',
        'POST /api/races',
        'POST /api/races',
      ])

      await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))
      expect(await screen.findByRole('table', { name: 'Događaji' })).toBeVisible()
    }, SLOW)

    it('is let go when the last race is refused, and the form stays with its sentence', async () => {
      const { user, router } = await theCopyOpen('alone')

      await press(user)
      await answer(json(201, { id: COPY_EVENT, slug: 'bbkt-9401' }), 'another write')
      await answer(json(201, { id: COPY_FIRST, eventDate: '', eventSlug: '' }), 'another write')
      await expectHeld(user, router)
      await answer(refused('theDistanceIsNotKeptExactly'), 'the end')
      await screen.findByText(sr.admin.eventSavedRacesRefused)

      expectOnTheForm(router)
      await expectLetGo(user, router)
    }, SLOW)

    it('is let go when the event itself is refused, and the form stays with its sentence', async () => {
      const { user, router } = await theCopyOpen('alone')

      await press(user)
      await expectHeld(user, router)
      await answer(refused('theAddressIsTaken', 409), 'the end')
      await screen.findByText(sr.admin.eventSaveRefused.theAddressIsTaken)

      expectOnTheForm(router)
      await expectLetGo(user, router)
    }, SLOW)

    it('holds the press that sends only races, which is a press of its own, and lets go of it at its last answer', async () => {
      const { user, router } = await theCopyOpen('alone')

      await press(user)
      await answer(json(201, { id: COPY_EVENT, slug: 'bbkt-9401' }), 'another write')
      await answer(json(201, { id: COPY_FIRST, eventDate: '', eventSlug: '' }), 'another write')
      await answer(refused('theDistanceIsNotKeptExactly'), 'the end')
      await screen.findByText(sr.admin.eventSavedRacesRefused)

      /* The second press: the races only, the first written over by its identity and the other made. */
      await press(user)
      await expectHeld(user, router)
      await answer(null, 'another write')
      await expectHeld(user, router)
      await answer(null, 'the end')
      await screen.findByRole('status', { name: 'Sačuvano' })

      expect(whereItWrote(watching.asked).slice(3)).toEqual([
        `PUT /api/races/${String(COPY_FIRST)}`,
        'POST /api/races',
      ])
    }, SLOW)
  })

  describe('whichever form it is', () => {
    it('holds a new event while its event is out, and lets go of it when the event is taken', async () => {
      const user = setupUser()
      const { router } = renderAt(THE_LIST, 'superadmin', '000001')

      await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
      await user.type(screen.getByLabelText(/^Naziv događaja/), 'BBKT zadržan')
      await user.type(screen.getByLabelText(/^Datum/), '10012027')
      await user.type(screen.getByLabelText(/^Mesto/), 'Niš')
      await press(user)
      await expectHeld(user, router, sr.admin.form.new.events, THE_LIST)
      await answer(null, 'the end')
      await screen.findByRole('status', { name: 'Sačuvano' })

      expect(whereItWrote(watching.asked)).toEqual(['POST /api/events'])
      await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))
      expect(await screen.findByRole('table', { name: 'Događaji' })).toBeVisible()
    }, SLOW)

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

    it('holds an event that stands until the last of its races is taken, and then lets go', async () => {
      const { event, races } = await aServedEventWithRaces()
      const address = `${THE_LIST}?izmena=${String(event.id)}`
      const user = setupUser()
      const { router } = renderAt(address, 'superadmin', '000001')

      await screen.findByRole('heading', { name: /^Trke na događaju/ })
      await press(user)

      /* The event, then every race but the last, each answered in turn; the last is still out. */
      for (let written = 0; written < races.length; written += 1) {
        await expectHeld(user, router, sr.admin.form.edit.events, address)
        await answer(null, 'another write')
      }

      await expectHeld(user, router, sr.admin.form.edit.events, address)
      await answer(null, 'the end')
      await screen.findByRole('status', { name: 'Sačuvano' })

      expect(whereItWrote(watching.asked)).toHaveLength(races.length + 1)
    }, SLOW)

    it('holds an event saved as a gathering until the last race has been taken away', async () => {
      const { event, races } = await aServedEventWithRaces()
      const address = `${THE_LIST}?izmena=${String(event.id)}`

      /* A save that takes races away waits for the results (`alsoRefuses`), and this case is about what
         comes after that wait. */
      await loadResource(RESULTS)

      const user = setupUser()
      const { router } = renderAt(address, 'superadmin', '000001')

      await user.selectOptions(
        await screen.findByLabelText(/^Vrsta događaja/),
        sr.event.kind.gathering,
      )
      await press(user)

      for (let written = 0; written < races.length; written += 1) {
        await expectHeld(user, router, sr.admin.form.edit.events, address)
        await answer(null, 'another write')
      }

      /* The last write of this press is a deletion, and it is still out. */
      expect(out.map((one) => one.how)).toEqual(['DELETE'])
      await expectHeld(user, router, sr.admin.form.edit.events, address)
      await answer(null, 'the end')
      await screen.findByRole('status', { name: 'Sačuvano' })

      expect(whereItWrote(watching.asked).filter((one) => one.startsWith('DELETE'))).toHaveLength(
        races.length,
      )
    }, SLOW)
  })

  describe('what the owner left open', () => {
    it('lets the reader sign out while the save is out, and the screen goes with him', async () => {
      /* Owner, 04.10.2026 (PDL, P6): signing out, like the role switch on QA, goes on working while a
         save is out, and whoever does it is not told what was saved. It takes the whole screen off, so
         the answer that comes late is written into nothing. A decision and not an accident, which is
         why it has a case: a way of holding this too would have to change it. */
      const { user, router } = await theCopyOpen('alone')

      await press(user)
      await user.click(screen.getByRole('button', { name: 'Otvori nalog' }))
      await user.click(screen.getByRole('button', { name: 'Odjavi se' }))
      await waitFor(() => {
        expect(where(router)).toBe('/sr')
      })

      expect(screen.queryByRole('form', { name: sr.admin.form.copying })).toBeNull()

      /* The press goes on in the screen that is gone, and nothing it says reaches the one that is there. */
      await answer(json(201, { id: COPY_EVENT, slug: 'bbkt-9401' }), 'another write')
      await answer(json(201, { id: COPY_FIRST, eventDate: '', eventSlug: '' }), 'another write')
      await answer(json(201, { id: COPY_SECOND, eventDate: '', eventSlug: '' }), 'the end')

      expect(where(router)).toBe('/sr')
      expect(screen.queryByText(sr.admin.eventSavedRacesRefused)).toBeNull()
    }, SLOW)
  })
})
