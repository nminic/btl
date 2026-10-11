import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { raceMeasure } from '../../data/raceLabel'
import { NO_RATING, type BtlEvent, type ServedPendingItem } from '../../data/types'
import { formatNumber, formatNumericDate, formatShortDate } from '../../i18n/format'
import sr from '../../i18n/sr.json'
import { htmlElement, must } from '../../test/at'
import { Decided } from '../../test/decided'
import { renderAt } from '../../test/render'
import { refused, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { rulesInMedia, unconditionalRules } from '../../test/stylesheet'
import { setupUser } from '../../test/user'
import { QUEUE } from './queues'

/**
 * A RUN ON A RACE THE CALENDAR DOES NOT HOLD, ON THE QUEUE OF RESULTS (R3b of the results flows).
 *
 * <p>The owner's answers of 10.10.2026, in the record's wording: „red NOVO se odobrava samo kroz
 * panel u kom se upisuje ili bira trka; moderator u redu vidi mesto koje je član upisao", and for
 * the whole queue on a telephone, „pokazuje brojke (dužina, uspon, spust i „Poslato") ispod naziva
 * trke". `resultsQueue.test.tsx` holds the rest of the screen; this holds what R3b added to it.
 *
 * <p><b>The runs differ along every axis the panel reads</b> (the rule of 06.09.2026):
 * <ul>
 * <li>two runs on a race the calendar does not hold, one with a town out of the codebook and one
 * with a town typed in another country, and each sent with a kind of its own, so the kind the
 * panel opens on has two answers;</li>
 * <li>a run from the calendar, which names no town, and a row that names no run;</li>
 * <li>and the calendar the panel chooses from holds two races of ONE name on ONE day, of two
 * kinds, and a third of that name still to come, so a race found by its name or its day, or a race
 * not yet run, is a different answer from the one chosen.</li>
 * </ul>
 *
 * <p><b>And what the panel offers once an approval has made a race</b> (the review of PR 519): the
 * owner's sentence of 30.08.2026, „kad odem da verifikujem drugom članu mogu da zamenim njegov naziv
 * događaja i izbor trke autocompletom sad već postojeće trke". The calendar here GROWS: before the
 * route has taken the approval that makes a race neither file holds it, and after it both do, so the
 * race can be offered to the next panel only because the files were read again after the answer and
 * never because it was in them from the first read.
 */

/* A CASE OF THIS FILE ENDS ON AN ASSERTION AND NEVER ON ITS OWN CLOCK (review of PR 492, and the
   precedent `saveWhileSaving.test.tsx` sets): every case has `SLOW`, and every wait half of it, so a
   wait that never succeeds fails in the words of what it waited for. The case at the foot holds it. */
vi.setConfig({ testTimeout: SLOW })
configure({ asyncUtilTimeout: SLOW / 2 })

const PATH = `/sr/${QUEUE.results.path}`

/** The day the portal reads as today, after every run here was run and before the race to come. */
const TODAY = '2026-10-10'

const RUNNER = '000010'

const A_RUN = {
  queue: 'results' as const,
  who: 'Ana Anić',
  subjectId: '',
  photoId: null,
  rating: NO_RATING,
  kind: '' as const,
  body: '',
}

/** A run on a race nobody has entered, at a town out of the codebook, sent as a free race. */
const FROM_THE_BOOK: ServedPendingItem = {
  ...A_RUN,
  id: 801,
  date: '2026-09-15',
  memberNumber: '000040',
  who: 'Goran Gorić',
  subject: 'Trka uz Nišavu',
  city: 'Bela Palanka',
  country: 'RS',
  raceId: null,
  raceDate: '2026-09-12',
  raceKind: 'free',
  distanceKm: 12,
  ascentM: 100,
  descentM: 90,
  seconds: 3000,
  link: '',
}

/** Another, at a town typed in another country, sent as a race of a length. */
const TYPED: ServedPendingItem = {
  ...A_RUN,
  id: 802,
  date: '2026-09-16',
  memberNumber: '000060',
  who: 'Lena Lenić',
  subject: 'Noćna desetka',
  city: 'Struga',
  country: 'MK',
  raceId: null,
  raceDate: '2026-09-13',
  raceKind: 'length',
  distanceKm: 10.05,
  ascentM: 40,
  descentM: 35,
  seconds: 2700,
  link: '',
}

/** A run from the calendar, which names no town. */
const FROM_THE_CALENDAR: ServedPendingItem = {
  ...A_RUN,
  id: 803,
  date: '2026-09-14',
  memberNumber: RUNNER,
  subject: 'Beogradska desetka',
  city: '',
  country: '',
  raceId: 11,
  raceDate: '2026-09-06',
  raceKind: 'length',
  distanceKm: 10,
  ascentM: 50,
  descentM: 40,
  seconds: 3300,
  link: '',
}

/** A results row naming no submission, which V10 permits: no day, no race, no figures. */
const NAMING_NO_RUN: ServedPendingItem = {
  ...A_RUN,
  id: 805,
  date: '2026-09-17',
  memberNumber: '000050',
  who: 'Mira Mirić',
  subject: 'Red bez prijave',
  city: '',
  country: '',
  raceId: null,
  raceDate: null,
  raceKind: '',
  distanceKm: null,
  ascentM: null,
  descentM: null,
  seconds: null,
  link: '',
}

const RUNS = [FROM_THE_BOOK, TYPED, FROM_THE_CALENDAR, NAMING_NO_RUN]

/** An event the served file holds, under which the races of the calendar below stand. */
const THE_EVENT = 53

/** Two races of one name on one day, of two kinds, and that name once more, still to come. */
const OF_A_LENGTH = {
  id: 9101,
  eventId: THE_EVENT,
  name: 'Jesenji kros',
  renamed: true,
  date: '2026-09-12',
  kind: 'length',
  limitSeconds: 0,
  distanceKm: 8,
  ascentM: 120,
  descentM: 120,
  category: 'short',
}

const TO_A_LIMIT = {
  ...OF_A_LENGTH,
  id: 9102,
  kind: 'time',
  limitSeconds: 3600,
  distanceKm: 0,
  ascentM: 0,
  descentM: 0,
  category: 'unmeasured',
}

const TO_COME = { ...OF_A_LENGTH, id: 9103, date: '2099-09-12' }

const THE_CALENDAR = [OF_A_LENGTH, TO_A_LIMIT, TO_COME]

/** The other four tabs as the served file holds them, so the answer is the whole answer. */
const THE_OTHER_TABS: unknown[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'verification.json'), 'utf-8'),
)

/** The events as the served file holds them, so a race stands under an event that is really there. */
const THE_EVENTS: BtlEvent[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'events.json'), 'utf-8'),
)

/**
 * THE CALENDAR THE FIRST APPROVAL WRITES INTO, as the route serves it before that approval and after it.
 *
 * <p><b>Never a single event or a single race</b> (the rule of 06.09.2026, for the panel's list): before the
 * approval the races stand under three events of the served file (the calendar above, a night race of the
 * summer, and a race of another name), so the letters typed into the box hit something both before and
 * after, and what comes back is a list of pairs and not the one pair that would be offered whatever was
 * read. The race the approval makes stands under an event the approval makes, so one file read again
 * without the other leaves the pair out of the list.
 */
const A_NIGHT_BEFORE = {
  ...OF_A_LENGTH,
  id: 9104,
  eventId: 54,
  name: 'Noćna šumska trka',
  date: '2026-06-20',
  distanceKm: 6,
  ascentM: 80,
  descentM: 80,
}

/** Another race of another name under a fourth event, which the letters typed here never hit. */
const ELSEWHERE = { ...OF_A_LENGTH, id: 9105, eventId: 55, name: 'Kros kroz šumu', date: '2026-08-02' }

const BEFORE_THE_APPROVAL = [...THE_CALENDAR, A_NIGHT_BEFORE, ELSEWHERE]

/** The event the approval makes, under a key neither file holds, and the race under it, with the names the
 *  moderator settles in the panel (and not the words the member sent, which are another constant). */
const MADE_EVENT: BtlEvent = {
  ...must(
    THE_EVENTS.find((one) => one.id === THE_EVENT),
    'the event the races of the calendar stand under',
  ),
  id: 9300,
  slug: 'nocne-trke-uz-jezero-2026',
  name: 'Noćne trke uz jezero',
  date: '2026-09-13',
  city: 'Struga',
  country: 'MK',
}

const MADE_RACE = {
  ...OF_A_LENGTH,
  id: 9200,
  eventId: MADE_EVENT.id,
  name: 'Noćna desetka uz jezero',
  date: '2026-09-13',
  distanceKm: 10.05,
  ascentM: 40,
  descentM: 35,
}

const answering = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const taken = (): Response => answering({ id: 1, state: 'approved' })

/** The two files as the route answers them, before the approval that makes the race and after it. */
const racesServed = (made: boolean): Response =>
  answering(made ? [...BEFORE_THE_APPROVAL, MADE_RACE] : BEFORE_THE_APPROVAL)

const eventsServed = (made: boolean): Response => answering(made ? [...THE_EVENTS, MADE_EVENT] : THE_EVENTS)

/**
 * A server that answers the queue with what `queue` says on each read, the calendar's races with
 * `races`, its events with `events`, and every decision with what `decided` says. Everything else
 * goes on to the disc reader, the events among it unless a case says what they are.
 */
function serverWith({
  queue = () => RUNS,
  decided = taken,
  races = () => answering(THE_CALENDAR),
  events = () => null,
}: {
  queue?: (read: number) => ServedPendingItem[]
  decided?: (id: string) => Response | Promise<Response>
  races?: () => Response
  events?: () => Response | null
} = {}): { asked: Asked[]; stop: () => void } {
  let reads = 0

  return serverThat((path, init) => {
    if (path === '/api/verification' && (init?.method ?? 'GET') === 'GET') {
      reads += 1

      return answering([...queue(reads), ...THE_OTHER_TABS])
    }

    if (path === '/api/races' && (init?.method ?? 'GET') === 'GET') {
      return races()
    }

    if (path === '/api/events' && (init?.method ?? 'GET') === 'GET') {
      return events()
    }

    const decision = /^\/api\/verification\/([^/]+)\/decision$/.exec(path)

    return decision !== null && init?.method === 'POST' ? decided(decision[1] ?? '') : null
  })
}

const decisionsIn = (asked: Asked[]): Asked[] => asked.filter((one) => one.path.endsWith('/decision'))

const bodyOf = (one: Asked | undefined): unknown => JSON.parse(String(one?.init?.body ?? 'null'))

const reads = (asked: Asked[], path: string): number =>
  asked.filter((one) => one.path === path && (one.init?.method ?? 'GET') === 'GET').length

async function rowOf(memberNumber: string) {
  const table = await screen.findByRole('table', { name: sr.review.waiting })

  return within(must(within(table).getByText(memberNumber).closest('tr'), `the row of ${memberNumber}`))
}

const decidedIn = () => within(screen.getByRole('list', { name: 'session decisions' }))

const panel = () => within(screen.getByRole('group', { name: sr.review.placeTitle }))

/** Until whatever decision was out has come back: the „Odobri" of the run from the calendar stops
 *  saying it cannot act (`resultsQueue.test.tsx`, `untilItHasAnswered`, says why this way). */
async function untilItHasAnswered(): Promise<void> {
  await waitFor(() => {
    for (const one of screen.queryAllByRole('button', { name: sr.review.approve })) {
      expect(one).toHaveAttribute('aria-disabled', 'false')
    }
  })
}

function openTheQueue() {
  return renderAt(PATH, 'superadmin', RUNNER, undefined, TODAY, <Decided />)
}

async function openThePanelOver(user: ReturnType<typeof setupUser>, member: string): Promise<void> {
  await user.click((await rowOf(member)).getByRole('button', { name: sr.review.placeRace }))
}

/** What a race of the calendar is offered as under the box, built the way the list builds it. */
const offeredAs = (race: typeof OF_A_LENGTH): string =>
  [race.name, formatNumericDate(race.date), raceMeasure(race, 'sr')].filter((one) => one !== '').join(' – ')

/** What the panel offers under its box, as the buttons of the list say it, for the ones that start with `prefix`. */
const offeredStartingWith = (prefix: string): (string | null)[] =>
  panel()
    .getAllByRole('button')
    .map((one) => one.textContent)
    .filter((one) => one?.startsWith(prefix) === true)

/** What is typed into the race's box, over what stands there. */
async function typeIntoTheRaceName(user: ReturnType<typeof setupUser>, text: string): Promise<void> {
  await user.clear(panel().getByLabelText(sr.newResult.raceName))
  await user.type(panel().getByLabelText(sr.newResult.raceName), text)
}

/**
 * Until the list has come to the box. The other night race stands in the files both before the approval and
 * after it, so waiting for it is waiting for the files and never for the race a case is asking about: the
 * assertion that follows is made at once, and a race that is not offered fails it in its own words.
 */
async function untilTheListHasCome(): Promise<void> {
  await waitFor(() => expect(offeredStartingWith('Noćna')).toContain(offeredAs(A_NIGHT_BEFORE)))
}

/**
 * THE FIRST MEMBER'S RUN, APPROVED ON A RACE THE APPROVAL MAKES: the panel over the run TYPED, the names the
 * moderator settles for its event and its race, and the press. It returns when the press has been made, which
 * is when the request is out and not when it has come back.
 */
async function makeTheNightRace(user: ReturnType<typeof setupUser>): Promise<void> {
  await openThePanelOver(user, '000060')
  await user.clear(panel().getByLabelText(sr.admin.field.eventName))
  await user.type(panel().getByLabelText(sr.admin.field.eventName), MADE_EVENT.name)
  await typeIntoTheRaceName(user, MADE_RACE.name)
  await user.click(panel().getByRole('button', { name: sr.review.placeSave }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('what the queue says about a run on a race the calendar does not hold', () => {
  it('draws the town the member gave, with its country and in its own direction, and none on a run from the calendar', async () => {
    const turned = `Pirot${String.fromCodePoint(0x202e)}trap`
    const server = serverWith({ queue: () => [FROM_THE_BOOK, { ...TYPED, city: turned }, FROM_THE_CALENDAR] })

    try {
      openTheQueue()

      const book = await rowOf('000040')

      expect(book.getByText(/^Mesto: /)).toHaveTextContent('Mesto: Bela Palanka (Srbija)')

      /* A town typed by a member stands in an element of its own direction, so a letter that turns
         the direction of writing turns nothing outside it. */
      const typed = (await rowOf('000060')).getByText(/^Mesto: /)
      const isolated = must(typed.querySelector('bdi'), 'the typed town in an element of its own direction')

      expect(isolated.textContent).toBe(turned)
      expect(typed).toHaveTextContent(`Mesto: ${turned} (Severna Makedonija)`)

      expect((await rowOf(RUNNER)).queryByText(/^Mesto: /)).toBeNull()
    } finally {
      server.stop()
    }
  })

  it('puts the figures and the day it was sent under the race’s name, in the box drawn on a telephone only', async () => {
    const server = serverWith()

    try {
      openTheQueue()

      for (const [member, run] of [
        ['000040', FROM_THE_BOOK],
        [RUNNER, FROM_THE_CALENDAR],
      ] as const) {
        const row = await rowOf(member)
        const box = htmlElement(row.getAllByRole('cell')[2]?.querySelector('.table__phone-only'))

        /* The figures of THIS run and the day it was SENT, not the day it was run. */
        expect(within(box).getAllByRole('term').map((one) => one.textContent)).toEqual([
          sr.profile.columns.distance,
          sr.rankings.columns.ascent,
          sr.rankings.columns.descent,
          sr.review.sentOn,
        ])
        expect(within(box).getAllByRole('definition').map((one) => one.textContent)).toEqual([
          formatNumber(must(run.distanceKm, 'a distance'), 'sr', 2),
          formatNumber(must(run.ascentM, 'a climb'), 'sr'),
          formatNumber(must(run.descentM, 'a drop'), 'sr'),
          formatShortDate(run.date, 'sr'),
        ])
        /* And the columns the box stands in for are the ones a telephone does not draw. */
        expect(
          row
            .getAllByRole('cell')
            .slice(3, 7)
            .every((one) => one.classList.contains('table__hide-phone')),
        ).toBe(true)
      }

      /* A row that names no run has no figures to show, and still the day it was sent. */
      const none = htmlElement((await rowOf('000050')).getAllByRole('cell')[2]?.querySelector('.table__phone-only'))

      expect(within(none).getAllByRole('term').map((one) => one.textContent)).toEqual([sr.review.sentOn])
    } finally {
      server.stop()
    }
  })
})

describe('the box drawn on a telephone only', () => {
  it('is hidden everywhere and drawn under the same query, in the same unit, that takes the columns away', () => {
    /* The other half of `table__hide-phone`, held where the two meet: the sheet. The markup is held
       to the same name above (the box is found by it), so a name changed on one side only is a
       case that fails, and never a box drawn twice or not at all. */
    const css = readFileSync(join(process.cwd(), 'src', 'styles', 'table.css'), 'utf-8')
    const named = (rules: CSSStyleRule[], selector: string): string[] =>
      rules.filter((one) => one.selectorText === selector).map((one) => one.style.display)
    const onAPhone = rulesInMedia(css, '(max-width: 699.98px)', 'styles/table.css')

    expect(named(unconditionalRules(css, 'styles/table.css'), '.table__phone-only')).toEqual(['none'])
    expect(named(onAPhone, '.table__phone-only')).toEqual(['block'])
    expect(named(onAPhone, '.table__hide-phone')).toEqual(['none'])
  })

  it('lets the button that opens the panel wrap, where the buttons beside it keep to one line', () => {
    /* Held to one line it set the width of the column of decisions, and at 360 the table scrolled
       inside its box twice as far (measured in Chrome, `Verification.css` has the numbers). The rule
       and the class it reaches are held together, as the box above is. */
    const css = readFileSync(join(process.cwd(), 'src', 'pages', 'admin', 'Verification.css'), 'utf-8')
    const rules = unconditionalRules(css, 'pages/admin/Verification.css').filter(
      (one) => one.selectorText === '.review__decide .button.review__place',
    )
    const markup = readFileSync(join(process.cwd(), 'src', 'pages', 'admin', 'ReviewQueue.tsx'), 'utf-8')

    expect(rules.map((one) => one.style.whiteSpace)).toEqual(['normal'])
    expect(markup).toContain('className="button button--primary review__place"')
  })
})

describe('the panel that names the race', () => {
  it('opens on what the member sent: his name for the race and the event, his kind, and all four figures', async () => {
    const user = setupUser()
    const server = serverWith()

    try {
      openTheQueue()

      await openThePanelOver(user, '000060')

      expect(panel().getByLabelText(sr.newResult.raceName)).toHaveValue('Noćna desetka')
      expect(panel().getByLabelText(sr.admin.field.eventName)).toHaveValue('Noćna desetka')
      expect(panel().getByLabelText(sr.newResult.raceKind)).toHaveValue('length')
      expect(panel().getByLabelText(sr.newResult.distanceKm)).toHaveValue('10.05')
      expect(panel().getByLabelText(sr.newResult.ascentM)).toHaveValue('40')
      expect(panel().getByLabelText(sr.newResult.descentM)).toHaveValue('35')
      expect(panel().getByLabelText(sr.newResult.minutes)).toHaveValue('45')

      /* And the other run opens on ITS kind, the member's hint, and not on the first run's. */
      await user.click(panel().getByRole('button', { name: sr.review.cancel }))
      await openThePanelOver(user, '000040')

      expect(panel().getByLabelText(sr.newResult.raceKind)).toHaveValue('free')
      expect(panel().getByLabelText(sr.newResult.raceName)).toHaveValue('Trka uz Nišavu')
    } finally {
      server.stop()
    }
  })

  it('approves on a race the approval makes, with its event and its kind, at all four figures, in one request', async () => {
    const user = setupUser()
    const server = serverWith()

    try {
      openTheQueue()

      await openThePanelOver(user, '000060')
      await user.clear(panel().getByLabelText(sr.admin.field.eventName))
      await user.type(panel().getByLabelText(sr.admin.field.eventName), 'Strušku noć')
      await user.clear(panel().getByLabelText(sr.newResult.raceName))
      await user.type(panel().getByLabelText(sr.newResult.raceName), 'Desetka uz jezero ')
      await user.selectOptions(panel().getByLabelText(sr.newResult.raceKind), 'time')
      await user.clear(panel().getByLabelText(sr.newResult.hours))
      await user.type(panel().getByLabelText(sr.newResult.hours), '1')
      await user.clear(panel().getByLabelText(sr.newResult.minutes))
      await user.type(panel().getByLabelText(sr.newResult.minutes), '0')
      await user.click(panel().getByRole('button', { name: sr.review.placeSave }))
      await untilItHasAnswered()

      const sent = decisionsIn(server.asked)

      expect(sent.map((one) => one.path)).toEqual(['/api/verification/802/decision'])
      expect(bodyOf(sent[0])).toEqual({
        approved: true,
        reason: '',
        amended: { distanceKm: 10.05, ascentM: 40, descentM: 35, seconds: 3600 },
        newRace: { eventName: 'Strušku noć', raceName: 'Desetka uz jezero', raceKind: 'time' },
      })
      /* The run leaves with the answer that took it, the panel with it, and the others wait. */
      expect(screen.queryByText('000060')).toBeNull()
      expect(screen.queryByRole('group', { name: sr.review.placeTitle })).toBeNull()
      expect(screen.getByText('000040')).toBeVisible()
      expect(decidedIn().getAllByRole('listitem').map((one) => one.textContent?.split(' | ')[0])).toEqual(['802'])
    } finally {
      server.stop()
    }
  })

  it('says on a race by time that the time is the race’s limit, and on no other kind', async () => {
    const user = setupUser()
    const server = serverWith()

    try {
      openTheQueue()

      await openThePanelOver(user, '000060')

      expect(panel().queryByText(sr.review.limitNote)).toBeNull()

      await user.selectOptions(panel().getByLabelText(sr.newResult.raceKind), 'time')

      expect(panel().getByText(sr.review.limitNote)).toBeVisible()

      await user.selectOptions(panel().getByLabelText(sr.newResult.raceKind), 'free')

      expect(panel().queryByText(sr.review.limitNote)).toBeNull()
    } finally {
      server.stop()
    }
  })

  it('counts the run on the race chosen from the calendar, by its key, at what that race leaves to the runner', async () => {
    const user = setupUser()
    const server = serverWith()

    try {
      openTheQueue()

      await openThePanelOver(user, '000040')
      await user.clear(panel().getByLabelText(sr.newResult.raceName))
      await user.type(panel().getByLabelText(sr.newResult.raceName), 'Jesenji')

      /* Both races of that name run that day are offered, and the one still to come is not. */
      const offered = panel()
        .getAllByRole('button')
        .map((one) => one.textContent)
        .filter((one) => one?.startsWith('Jesenji kros'))

      expect(offered.sort()).toEqual([offeredAs(OF_A_LENGTH), offeredAs(TO_A_LIMIT)].sort())

      /* The one to a limit, which is not the first of the two by key. */
      await user.click(panel().getByRole('button', { name: offeredAs(TO_A_LIMIT) }))

      expect(panel().getByText(`Izabrana trka: ${offeredAs(TO_A_LIMIT)}`)).toBeVisible()
      /* A race of the calendar brings its event and its kind, so neither is asked. */
      expect(panel().queryByLabelText(sr.admin.field.eventName)).toBeNull()
      expect(panel().queryByLabelText(sr.newResult.raceKind)).toBeNull()
      /* And it fixes the time, so the time is not asked and the rest is his. */
      expect(panel().queryByLabelText(sr.newResult.hours)).toBeNull()

      await user.clear(panel().getByLabelText(sr.newResult.distanceKm))
      await user.type(panel().getByLabelText(sr.newResult.distanceKm), '12,4')
      await user.click(panel().getByRole('button', { name: sr.review.placeSave }))
      await untilItHasAnswered()

      expect(bodyOf(decisionsIn(server.asked)[0])).toEqual({
        approved: true,
        reason: '',
        amended: { distanceKm: 12.4, ascentM: 100, descentM: 90 },
        raceId: 9102,
      })
    } finally {
      server.stop()
    }
  })

  it('lets go of a chosen race when its name is typed over, and makes the race again', async () => {
    const user = setupUser()
    const server = serverWith()

    try {
      openTheQueue()

      await openThePanelOver(user, '000040')
      await user.clear(panel().getByLabelText(sr.newResult.raceName))
      await user.type(panel().getByLabelText(sr.newResult.raceName), 'Jesenji')
      await user.click(panel().getByRole('button', { name: offeredAs(OF_A_LENGTH) }))

      expect(panel().queryByLabelText(sr.admin.field.eventName)).toBeNull()

      await user.type(panel().getByLabelText(sr.newResult.raceName), ' 2')

      expect(panel().queryByText(/^Izabrana trka/)).toBeNull()
      expect(panel().getByLabelText(sr.admin.field.eventName)).toHaveValue('Trka uz Nišavu')

      await user.click(panel().getByRole('button', { name: sr.review.placeSave }))
      await untilItHasAnswered()

      expect(bodyOf(decisionsIn(server.asked)[0])).toEqual({
        approved: true,
        reason: '',
        amended: { distanceKm: 12, ascentM: 100, descentM: 90, seconds: 3000 },
        newRace: { eventName: 'Trka uz Nišavu', raceName: 'Jesenji kros 2', raceKind: 'free' },
      })
    } finally {
      server.stop()
    }
  })

  it('refuses a name left blank and a time of nought, says which, and sends nothing', async () => {
    const user = setupUser()
    const server = serverWith()

    try {
      openTheQueue()

      await openThePanelOver(user, '000060')
      await user.clear(panel().getByLabelText(sr.admin.field.eventName))

      const save = panel().getByRole('button', { name: sr.review.placeSave })

      expect(panel().getByLabelText(sr.admin.field.eventName)).toHaveAttribute('aria-invalid', 'true')
      expect(save).toHaveAttribute('aria-disabled', 'true')
      expect(save).toHaveAccessibleDescription(`${sr.admin.field.eventName}: Ovo polje je obavezno.`)

      await user.click(save)
      await user.type(panel().getByLabelText(sr.admin.field.eventName), 'Strušku noć')
      await user.clear(panel().getByLabelText(sr.newResult.minutes))
      await user.type(panel().getByLabelText(sr.newResult.minutes), '0')

      expect(save).toHaveAccessibleDescription(sr.newResult.needsTime)

      await user.click(save)
      await untilItHasAnswered()

      expect(decisionsIn(server.asked)).toHaveLength(0)
    } finally {
      server.stop()
    }
  })

  it('stands alone: opening it puts the other two boxes away, and each of them puts it away', async () => {
    const user = setupUser()
    const server = serverWith()

    try {
      openTheQueue()

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.amend }))
      await openThePanelOver(user, '000040')

      expect(screen.queryByRole('group', { name: sr.review.amendTitle })).toBeNull()

      await user.click((await rowOf('000040')).getByRole('button', { name: sr.review.sendBack }))

      expect(screen.queryByRole('group', { name: sr.review.placeTitle })).toBeNull()

      await openThePanelOver(user, '000040')

      expect(screen.queryByLabelText(sr.review.reason)).toBeNull()

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.amend }))

      expect(screen.queryByRole('group', { name: sr.review.placeTitle })).toBeNull()
    } finally {
      server.stop()
    }
  })

  it('says under the box that the races could not be read, rather than offering none', async () => {
    const user = setupUser()
    const server = serverWith({ races: () => new Response('nema', { status: 500 }) })

    try {
      openTheQueue()

      await openThePanelOver(user, '000040')

      expect(await panel().findByText('Podaci se ne mogu učitati.')).toBeVisible()
      /* And the box stays a box: a race the approval makes can still be named in it. */
      expect(panel().getByLabelText(sr.newResult.raceName)).toBeEnabled()
    } finally {
      server.stop()
    }
  })
})

describe('what the route answers to the panel', () => {
  it('closes with the route’s refusal, says it on the run’s row, and reads the queue and the races again', async () => {
    const user = setupUser()
    const sentence =
      'Događaj sa tim nazivom u toj godini već postoji. Trku u njemu dodaj kroz Administraciju, pa je izaberi ovde.'
    const server = serverWith({ decided: () => refused(sentence, 409) })

    try {
      openTheQueue()

      await openThePanelOver(user, '000040')
      await waitFor(() => expect(reads(server.asked, '/api/races')).toBe(1))
      await user.click(panel().getByRole('button', { name: sr.review.placeSave }))
      await untilItHasAnswered()

      expect(screen.queryByRole('group', { name: sr.review.placeTitle })).toBeNull()
      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect((await rowOf('000040')).getByRole('alert')).toHaveTextContent(sentence)
      expect(decidedIn().queryAllByRole('listitem')).toHaveLength(0)
      /* The list read again while the screen stood, which a refusal in the route's words asks. */
      expect(reads(server.asked, '/api/verification')).toBe(2)

      /* And the races are read afresh the next time the panel is opened, so a race the
         administration has added since is there to be chosen. */
      await openThePanelOver(user, '000040')
      expect(reads(server.asked, '/api/races')).toBe(2)
    } finally {
      server.stop()
    }
  })

  it('says a refusal about a run the queue no longer holds over the table, where the run stood is gone', async () => {
    const user = setupUser()
    const server = serverWith({
      queue: (read) => (read === 1 ? RUNS : RUNS.filter((one) => one.id !== 801)),
      decided: () => refused('O stavci je već odlučeno.', 409),
    })

    try {
      openTheQueue()

      await openThePanelOver(user, '000040')
      await user.click(panel().getByRole('button', { name: sr.review.placeSave }))

      /* Read again, the run another moderator decided is gone, and the sentence about it stands
         over the table and on no row. */
      await waitFor(() => expect(screen.queryByText('000040')).toBeNull())

      const alert = screen.getByRole('alert')

      expect(alert).toHaveTextContent('O stavci je već odlučeno.')
      expect(alert.closest('table')).toBeNull()
    } finally {
      server.stop()
    }
  })

  it('reads nothing again where the route said nothing about the list', async () => {
    const user = setupUser()
    const server = serverWith({ decided: () => new Response('kvar', { status: 500 }) })

    try {
      openTheQueue()

      await openThePanelOver(user, '000040')
      await user.click(panel().getByRole('button', { name: sr.review.placeSave }))
      await untilItHasAnswered()

      expect((await rowOf('000040')).getByRole('alert')).toBeVisible()
      expect(reads(server.asked, '/api/verification')).toBe(1)
    } finally {
      server.stop()
    }
  })

  it('reads the queue again where the route answered an empty 404', async () => {
    const user = setupUser()
    const server = serverWith({ decided: () => new Response(null, { status: 404 }) })

    try {
      openTheQueue()

      await openThePanelOver(user, '000040')
      await user.click(panel().getByRole('button', { name: sr.review.placeSave }))
      await untilItHasAnswered()

      expect(reads(server.asked, '/api/verification')).toBe(2)
    } finally {
      server.stop()
    }
  })

  it('holds nothing of its own while a decision about another run is out', async () => {
    /* A decision out for ANOTHER run is not this panel's: its „Odustani" goes on answering and it
       says nothing is being sent (`outFor` in `ReviewQueue.tsx` says why it is the run and not the
       flag every button of the tab reads). */
    const user = setupUser()
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const server = serverWith({ decided: () => gate.then(taken) })

    try {
      openTheQueue()

      await openThePanelOver(user, '000040')
      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.approve }))

      expect((await rowOf(RUNNER)).getByRole('button', { name: sr.review.approve })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
      expect(panel().getByRole('button', { name: sr.review.cancel })).not.toHaveAttribute('aria-disabled')
      expect(panel().queryAllByRole('status').filter((one) => one.textContent === sr.results.sending)).toHaveLength(0)

      release()
      await untilItHasAnswered()
    } finally {
      server.stop()
    }
  })

  it(
    'holds „Odustani" while the approval is out, says it is sending, and closes when the answer comes',
    async () => {
      const user = setupUser()
      let release: () => void = () => undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const server = serverWith({ decided: () => gate.then(taken) })

      try {
        openTheQueue()

        await openThePanelOver(user, '000040')
        await user.click(panel().getByRole('button', { name: sr.review.placeSave }))

        const cancel = panel().getByRole('button', { name: sr.review.cancel })

        expect(cancel).toHaveAttribute('aria-disabled', 'true')
        expect(panel().getAllByRole('status').filter((one) => one.textContent === sr.results.sending)).toHaveLength(1)

        await user.click(cancel)

        expect(screen.getByRole('group', { name: sr.review.placeTitle })).toBeVisible()

        release()
        await waitFor(() => expect(screen.queryByRole('group', { name: sr.review.placeTitle })).toBeNull())
        expect(decisionsIn(server.asked)).toHaveLength(1)
      } finally {
        server.stop()
      }
    },
    SLOW,
  )
})

describe('what the panel offers once an approval has made a race', () => {
  it('offers the race the first approval made to the panel opened over the next run, read again after the answer', async () => {
    /* The two files are served WITHOUT the race until the route has taken the approval that makes it and WITH
       it after, so the race can be on the list only because both files were asked for again, and never because
       it was there from the first read. The same letters in the same box offer the other night race alone
       before, and the two together after. */
    const user = setupUser()
    let made = false
    const server = serverWith({
      decided: () => {
        made = true

        return taken()
      },
      races: () => racesServed(made),
      events: () => eventsServed(made),
    })

    try {
      openTheQueue()

      await openThePanelOver(user, '000040')
      await waitFor(() => expect(reads(server.asked, '/api/races')).toBe(1))
      expect(reads(server.asked, '/api/events')).toBe(1)
      await typeIntoTheRaceName(user, 'Noćna')
      await untilTheListHasCome()

      expect(offeredStartingWith('Noćna')).toEqual([offeredAs(A_NIGHT_BEFORE)])

      await user.click(panel().getByRole('button', { name: sr.review.cancel }))
      await makeTheNightRace(user)
      await untilItHasAnswered()

      /* It was the approval that makes a race which went to the route, and the names are the moderator's. */
      expect(bodyOf(decisionsIn(server.asked)[0])).toEqual({
        approved: true,
        reason: '',
        amended: { distanceKm: 10.05, ascentM: 40, descentM: 35, seconds: 2700 },
        newRace: { eventName: MADE_EVENT.name, raceName: MADE_RACE.name, raceKind: 'length' },
      })
      expect(screen.queryByText('000060')).toBeNull()

      /* Each file once more, and not before the answer: the second member's panel is the one that asks. */
      await openThePanelOver(user, '000040')

      expect(reads(server.asked, '/api/races')).toBe(2)
      expect(reads(server.asked, '/api/events')).toBe(2)

      await typeIntoTheRaceName(user, 'Noćna')
      await untilTheListHasCome()

      expect(offeredStartingWith('Noćna')).toEqual([offeredAs(MADE_RACE), offeredAs(A_NIGHT_BEFORE)])
    } finally {
      server.stop()
    }
  })

  it('keeps the calendar it holds until the answer comes, so a panel opened while the approval is out leaves nothing old for the answer to find', async () => {
    /* The press is made and the request is out. The moderator opens the box that refuses another run, which
       puts the panel away, and then a panel over that run: it is drawn from what was read for the first one,
       because nothing is dropped yet. Dropped before the request went, the files would be read here, as they
       stood, and that read would be what the answer found in the cache: the next panel, opened after the
       answer, would offer the calendar without the race. */
    const user = setupUser()
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let made = false
    const server = serverWith({
      decided: () =>
        gate.then(() => {
          made = true

          return taken()
        }),
      races: () => racesServed(made),
      events: () => eventsServed(made),
    })

    try {
      openTheQueue()

      await makeTheNightRace(user)
      /* The request is out: the token is read first where the browser holds none (`askTheServer`), so the
         decision may leave a tick after the press. */
      await waitFor(() => expect(decisionsIn(server.asked)).toHaveLength(1))

      await user.click((await rowOf('000040')).getByRole('button', { name: sr.review.sendBack }))
      await openThePanelOver(user, '000040')

      expect(reads(server.asked, '/api/races')).toBe(1)
      expect(reads(server.asked, '/api/events')).toBe(1)

      release()
      await untilItHasAnswered()

      expect(screen.queryByText('000060')).toBeNull()

      await user.click(panel().getByRole('button', { name: sr.review.cancel }))
      await openThePanelOver(user, '000040')

      expect(reads(server.asked, '/api/races')).toBe(2)
      expect(reads(server.asked, '/api/events')).toBe(2)

      await typeIntoTheRaceName(user, 'Noćna')
      await untilTheListHasCome()

      expect(offeredStartingWith('Noćna')).toEqual([offeredAs(MADE_RACE), offeredAs(A_NIGHT_BEFORE)])
    } finally {
      server.stop()
    }
  })

  it('leaves the calendar it read as it is after every decision that wrote nothing into it', async () => {
    /* Only an approval that names a race to make writes an event and a race, and the files carry nothing that
       a result changes, so three decisions are asked in turn and none of them makes the next panel read the
       two files again: a run from the calendar approved as it stands, a refusal, and an approval on a race the
       calendar already holds, which the panel sends by its key (`raceId`) and which is the one nearest to the
       approval that makes a race. */
    const user = setupUser()
    const server = serverWith()

    try {
      openTheQueue()

      await openThePanelOver(user, '000040')
      await waitFor(() => expect(reads(server.asked, '/api/races')).toBe(1))
      expect(reads(server.asked, '/api/events')).toBe(1)
      await user.click(panel().getByRole('button', { name: sr.review.cancel }))

      const stillOnce = (after: string): void => {
        expect(reads(server.asked, '/api/races'), after).toBe(1)
        expect(reads(server.asked, '/api/events'), after).toBe(1)
      }

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.approve }))
      await untilItHasAnswered()

      expect(screen.queryByText(RUNNER)).toBeNull()

      await openThePanelOver(user, '000040')
      stillOnce('an approval of a run from the calendar')
      await user.click(panel().getByRole('button', { name: sr.review.cancel }))

      await user.click((await rowOf('000050')).getByRole('button', { name: sr.review.sendBack }))
      await user.type(screen.getByLabelText(sr.review.reason), 'Vreme se ne poklapa.')
      await user.click(screen.getByRole('button', { name: sr.review.confirmSendBack }))
      await untilItHasAnswered()

      expect(screen.queryByText('000050')).toBeNull()

      await openThePanelOver(user, '000040')
      stillOnce('a refusal')

      await typeIntoTheRaceName(user, 'Jesenji')
      await user.click(panel().getByRole('button', { name: offeredAs(OF_A_LENGTH) }))
      await user.click(panel().getByRole('button', { name: sr.review.placeSave }))
      await untilItHasAnswered()

      const sent = decisionsIn(server.asked)

      expect(bodyOf(sent[sent.length - 1])).toMatchObject({ approved: true, raceId: OF_A_LENGTH.id })
      expect(screen.queryByText('000040')).toBeNull()

      await openThePanelOver(user, '000060')
      stillOnce('an approval on a race the calendar already holds')
    } finally {
      server.stop()
    }
  })
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
