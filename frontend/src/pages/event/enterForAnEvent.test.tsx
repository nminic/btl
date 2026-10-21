import { configure, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BtlEvent, Race } from '../../data/types'
import { formatNumericDate } from '../../i18n/format'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { expectFrontPage, moderatorWith, renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { typeATownTheCodebookKnows } from '../../test/town'

/**
 * „UNOS REZULTATA ZA DOGAĐAJ”, THE MODERATOR'S OWN SCREEN (PDL P9, owner, 19.10.2026: „Događaj, trka i
 * rezultat u jednoj formi, i za člana na „Mojim rezultatima” i za moderatora”, „Jedan ekran za sve”).
 *
 * <p><b>The calendar differs along every axis the block reads</b> (the rule of 06.09.2026):
 * <ul>
 * <li>„Gradska liga” of 2027 begun by today, with two races of two kinds and different days, neither on
 * the event's own day, so a new race's day that started from a race and not from the event is a
 * different answer;</li>
 * <li>„Gradska liga” once more in 2026, the same name in a year before the league;</li>
 * <li>„Gradski trening”, an event of 2027 that is not a race;</li>
 * <li>„Gradska zima”, a race of 2027 that has not begun yet;</li>
 * <li>and the event's town is not the town typed for any new event here.</li>
 * </ul>
 */

/* A CASE ENDS ON AN ASSERTION AND NEVER ON ITS OWN CLOCK (the precedent `saveWhileSaving.test.tsx` sets). */
vi.setConfig({ testTimeout: SLOW })
configure({ asyncUtilTimeout: SLOW / 2 })

const PATH = '/sr/administracija/unos-rezultata'
const TODAY = '2027-08-23'
const CHECKS_RESULTS = moderatorWith(['queue:results'])
const ANOTHER_RIGHT = moderatorWith(['entity:events'])

const AN_EVENT: BtlEvent = {
  id: 9501,
  slug: 'gradska-liga-2027',
  name: 'Gradska liga',
  date: '2027-03-01',
  city: 'Novi Sad',
  country: 'RS',
  kind: 'race',
  featured: false,
  description: '',
  link: '',
  copiedFrom: null,
}

const CALENDAR: BtlEvent[] = [
  AN_EVENT,
  { ...AN_EVENT, id: 9502, slug: 'gradska-liga-2026', date: '2026-03-01' },
  { ...AN_EVENT, id: 9503, slug: 'gradski-trening-2027', name: 'Gradski trening', date: '2027-04-01', kind: 'training' },
  { ...AN_EVENT, id: 9504, slug: 'gradska-zima-2027', name: 'Gradska zima', date: '2027-12-01' },
]

const aRace = (over: Partial<Race>): Race => ({
  id: 9601,
  eventId: AN_EVENT.id,
  name: 'Trka',
  renamed: true,
  date: '2027-03-07',
  kind: 'length',
  limitSeconds: 0,
  distanceKm: 10,
  ascentM: 40,
  descentM: 40,
  category: 'short',
  dots: ['short'],
  ...over,
})

const OF_A_LENGTH = aRace({ id: 9601, name: 'Gradska liga, prvo kolo', date: '2027-03-07' })
const TO_A_LIMIT = aRace({
  id: 9602,
  name: 'Gradska liga, sat',
  date: '2027-04-04',
  kind: 'time',
  limitSeconds: 3600,
  distanceKm: 0,
  ascentM: 0,
  descentM: 0,
  category: 'short',
})

const answering = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/**
 * The calendar above, the seasons open for a report as the server says them, and every write answered
 * with `write`. The seasons are the account's (`MeApi.WhoIAm.seasonsOpenForAReport`), answered here to
 * a moderator who races for nobody, which is the moderator this screen is mostly for; the first season
 * unless a case says another.
 */
function serving(
  write: (path: string) => Response = (path) =>
    answering(path.endsWith('/on-a-race-of-an-event') ? { results: [1], event: 'jezerska-trka-2027' } : { results: [1] }, 201),
  events: () => Response = () => answering(CALENDAR),
  open: number[] = [2027],
): { asked: Asked[]; stop: () => void } {
  return serverThat((path, init) => {
    const method = init?.method ?? 'GET'

    if (method === 'GET' && path === '/api/me') {
      return answering({ role: 'moderator', account: 1, mailLanguage: 'sr', seasonsOpenForAReport: open })
    }

    if (method === 'GET' && path === '/api/events') {
      return events()
    }

    if (method === 'GET' && path === '/api/races') {
      return answering([OF_A_LENGTH, TO_A_LIMIT])
    }

    return method === 'GET' ? null : write(path)
  })
}

const writes = (asked: Asked[]) =>
  asked
    .filter((one) => (one.init?.method ?? 'GET') !== 'GET')
    .map((one): { path: string; body: unknown } => ({ path: one.path, body: JSON.parse(String(one.init?.body ?? 'null')) }))

const eventBox = () => screen.getByLabelText(/^Događaj/)
const raceBox = () => screen.getByLabelText(/^Naziv trke/)
/* The list under a box of the screen, and not the navigation beside it, which is a list as well. */
const offered = (): string[] =>
  within(screen.getByRole('main'))
    .queryAllByRole('list', { name: '' })
    .flatMap((list) =>
      within(list)
        .queryAllByRole('button')
        .map((one) => one.textContent ?? ''),
    )
const eventSaid = (event: BtlEvent): string =>
  [event.name, formatNumericDate(event.date), event.city].filter((one) => one !== '').join(' – ')

async function open(user: ReturnType<typeof setupUser>): Promise<void> {
  renderAt(PATH, 'moderator', null, CHECKS_RESULTS, TODAY)
  await screen.findByRole('heading', { level: 1, name: sr.leagueResults.forAnEvent })
  void user
}

/** A member chosen in the first row by his number, and the time he ran. */
async function aRowFor(user: ReturnType<typeof setupUser>, seconds: string[] = ['1', '0', '0']): Promise<void> {
  const member = must(screen.getAllByLabelText(/^Član/)[0], 'the first row')

  await user.type(member, '000002')
  await user.click(await screen.findByRole('button', { name: /Relja/ }))

  for (const [label, value] of [
    ['Sati', seconds[0]],
    ['Minuti', seconds[1]],
    ['Sekunde', seconds[2]],
  ] as const) {
    const all = screen.queryAllByLabelText(label)
    const last = all[all.length - 1]

    if (last !== undefined) {
      await user.type(last, value ?? '0')
    }
  }
}

const save = (user: ReturnType<typeof setupUser>) => user.click(screen.getByRole('button', { name: sr.leagueResults.save }))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the door of the moderator’s own screen', () => {
  it('opens to the right that checks results, and to nobody with another right', async () => {
    const server = serving()

    try {
      renderAt(PATH, 'moderator', null, ANOTHER_RIGHT, TODAY)
      await expectFrontPage()
    } finally {
      server.stop()
    }
  })

  it('is in the navigation beside the queues for whoever checks results', async () => {
    const server = serving()

    try {
      renderAt('/sr/administracija/verifikacija/rezultati', 'moderator', null, CHECKS_RESULTS, TODAY)

      const nav = within(await screen.findByRole('navigation', { name: 'Odeljak Verifikacija' }))

      expect(nav.getByRole('link', { name: sr.leagueResults.menu })).toHaveAttribute('href', PATH)
    } finally {
      server.stop()
    }
  })
})

describe('the event and the race the screen names first', () => {
  it('offers races from 2027 to today, newest first, and nothing before the league, still to come or of another kind', async () => {
    const user = setupUser()
    const server = serving()

    try {
      await open(user)
      await user.type(eventBox(), 'Grad')

      await waitFor(() => expect(offered()).toEqual([eventSaid(AN_EVENT)]))
    } finally {
      server.stop()
    }
  })

  it('offers no event of a season not open, and an exact name of one links nothing (review of PR 585)', async () => {
    /* THE REVIEW'S PROBE: in 2028 „Gradska liga” of 2027 was linked by its exact name and the race of
       2028 went onto it. The owner, 20.10.2026: „NE NUDE SE STARIJI DOGAĐAJI VAN TEKUĆE SEZONE! ONI SE
       UNOSE IMPORTOM.” So with 2028 the one season the server says is open, neither event of 2027 is
       offered, and the name typed exactly is a new event, which asks its town. */
    const user = setupUser()
    const server = serving(undefined, undefined, [2028])

    try {
      renderAt(PATH, 'moderator', null, CHECKS_RESULTS, '2028-03-01')
      await screen.findByRole('heading', { level: 1, name: sr.leagueResults.forAnEvent })
      await user.type(eventBox(), 'Grad')

      expect(offered()).toEqual([])

      await user.clear(eventBox())
      await user.type(eventBox(), 'Gradska liga')

      expect(screen.getByLabelText(/^Mesto/)).toBeVisible()
      expect(screen.getByLabelText(/^Datum$/)).toHaveValue('')
    } finally {
      server.stop()
    }
  })

  it('offers the events of a season the server says is open, read on a day of the next year', async () => {
    /* On New Year's morning 2028 both seasons are open, and the event of 2027 is offered: the list is
       the server's seasons and never the year today is in. */
    const user = setupUser()
    const server = serving(undefined, undefined, [2027, 2028])

    try {
      renderAt(PATH, 'moderator', null, CHECKS_RESULTS, '2028-01-01')
      await screen.findByRole('heading', { level: 1, name: sr.leagueResults.forAnEvent })
      await user.type(eventBox(), 'Grad')

      /* Both events of 2027 begun by that morning, the newest first. */
      await waitFor(() =>
        expect(offered()).toEqual([
          eventSaid({ ...AN_EVENT, id: 9504, slug: 'gradska-zima-2027', name: 'Gradska zima', date: '2027-12-01' }),
          eventSaid(AN_EVENT),
        ]),
      )
    } finally {
      server.stop()
    }
  })

  it('makes a new event, its race and the rows in one save, the race taking the event’s name, and goes to its page', async () => {
    const user = setupUser()
    /* The calendar holds the event once the save has made it, under the address the answer names, so
       its page is drawn only if the screen went to that address. */
    const MADE: BtlEvent = { ...AN_EVENT, id: 9599, slug: 'jezerska-trka-2027', name: 'Jezerska trka', date: '2027-06-01' }
    let made = false
    const server = serving(
      () => {
        made = true

        return answering({ results: [1], event: MADE.slug }, 201)
      },
      () => answering(made ? [...CALENDAR, MADE] : CALENDAR),
    )

    try {
      await open(user)
      await user.type(eventBox(), 'Jezerska trka')

      expect(raceBox()).toHaveValue('Jezerska trka')

      await user.type(screen.getByLabelText(/^Datum/), '01062027')
      await user.type(screen.getByLabelText(/^Mesto/), 'Ohrid')
      await user.selectOptions(screen.getByLabelText(/^Država/), 'MK')
      await user.type(screen.getByLabelText(/^Dužina/), '10')
      await user.type(screen.getByLabelText(/^Uspon/), '20')
      await user.type(screen.getByLabelText(/^Spust/), '30')
      await aRowFor(user)
      await save(user)

      await waitFor(() => expect(writes(server.asked)).toHaveLength(1))

      expect(writes(server.asked)[0]).toEqual({
        path: '/api/results/on-a-race-of-an-event',
        body: {
          event: { name: 'Jezerska trka', date: '2027-06-01', city: 'Ohrid', country: 'MK' },
          race: {
            name: 'Jezerska trka',
            kind: 'length',
            distanceKm: 10,
            ascentM: 20,
            descentM: 30,
            limitSeconds: null,
          },
          rows: [{ memberNumber: '000002', distanceKm: null, ascentM: null, descentM: null, seconds: 3600 }],
        },
      })
      /* To the page of the event the save made, by the address the answer named. */
      expect(await screen.findByRole('heading', { level: 1, name: 'Jezerska trka' })).toBeVisible()
    } finally {
      server.stop()
    }
  })

  it('links an event typed exactly in any case, asks no town, starts a new race’s day from the event’s, and puts the race on it by its key', async () => {
    const user = setupUser()
    const server = serving()

    try {
      await open(user)
      await user.type(eventBox(), 'GRADSKA LIGA')

      expect(screen.queryByLabelText(/^Mesto/)).toBeNull()
      expect(screen.getByLabelText(/^Datum trke/)).toHaveValue('01/03/2027')

      await user.type(raceBox(), 'Noćni krug')
      await user.selectOptions(screen.getByLabelText(/^Vrsta trke/), 'time')
      await user.type(must(screen.getAllByLabelText('Sati')[0], 'the limit'), '2')
      await user.type(must(screen.getAllByLabelText('Minuti')[0], 'the limit'), '0')
      await user.type(must(screen.getAllByLabelText('Sekunde')[0], 'the limit'), '0')

      const member = must(screen.getAllByLabelText(/^Član/)[0], 'the first row')

      await user.type(member, '000002')
      await user.click(await screen.findByRole('button', { name: /Relja/ }))
      await user.type(screen.getByLabelText(/^Dužina/), '15')
      await user.type(screen.getByLabelText(/^Uspon/), '0')
      await user.type(screen.getByLabelText(/^Spust/), '0')
      await save(user)

      await waitFor(() => expect(writes(server.asked)).toHaveLength(1))

      expect(writes(server.asked)[0]?.body).toEqual({
        event: { id: AN_EVENT.id },
        race: {
          name: 'Noćni krug',
          date: '2027-03-01',
          kind: 'time',
          distanceKm: null,
          ascentM: null,
          descentM: null,
          limitSeconds: 7200,
        },
        rows: [{ memberNumber: '000002', distanceKm: 15, ascentM: 0, descentM: 0, seconds: null }],
      })
    } finally {
      server.stop()
    }
  })

  it('puts the rows on a race of the calendar chosen under its event, over the event page’s own road', async () => {
    const user = setupUser()
    const server = serving()

    try {
      await open(user)
      await user.type(eventBox(), 'Gradska')
      await user.click(await screen.findByRole('button', { name: eventSaid(AN_EVENT) }))

      expect(raceBox()).toHaveValue('')

      await user.type(raceBox(), 'Gradska liga')

      /* The event's races, and the one to a limit is not the first by its key. */
      await user.click(await screen.findByRole('button', { name: /^Gradska liga, sat – / }))

      expect(screen.queryByLabelText(/^Vrsta trke/)).toBeNull()

      const member = must(screen.getAllByLabelText(/^Član/)[0], 'the first row')

      await user.type(member, '000002')
      await user.click(await screen.findByRole('button', { name: /Relja/ }))
      await user.type(screen.getByLabelText(/^Dužina/), '12,5')
      await user.type(screen.getByLabelText(/^Uspon/), '10')
      await user.type(screen.getByLabelText(/^Spust/), '5')
      await save(user)

      await waitFor(() => expect(writes(server.asked)).toHaveLength(1))

      expect(writes(server.asked)[0]?.path).toBe(`/api/races/${String(TO_A_LIMIT.id)}/results`)
      expect(writes(server.asked)[0]?.body).toEqual({
        rows: [{ memberNumber: '000002', distanceKm: 12.5, ascentM: 10, descentM: 5, seconds: null }],
      })
    } finally {
      server.stop()
    }
  })
})

describe('what the block says before anything is sent', () => {
  it('says each box that is wrong, in the owner’s words where the route has them, and sends nothing', async () => {
    const user = setupUser()
    const server = serving()

    try {
      await open(user)
      await aRowFor(user)
      await save(user)

      const event = eventBox()

      expect(event).toHaveAttribute('aria-invalid', 'true')
      expect(event).toHaveAccessibleDescription(/Ovo polje je obavezno/)
      /* The row is whole, so it is the block alone that was refused, and the cursor is put on its first
         box all the same (`event/EnterResults.tsx`, `owed`). */
      expect(event).toHaveFocus()

      await user.type(event, 'Stara trka')
      await user.type(screen.getByLabelText(/^Datum/), '31122026')
      await save(user)

      expect(screen.getByText(sr.leagueResults.refused.theDayIsBeforeTheLeague)).toBeVisible()
      expect(screen.getByText(sr.leagueResults.refused.theTownIsMissing)).toBeVisible()
      expect(writes(server.asked)).toEqual([])
    } finally {
      server.stop()
    }
  })

  it('says the route’s refusal of an event gone from the calendar in the owner’s words', async () => {
    const user = setupUser()
    const server = serving(() => answering({ reason: 'theEventIsNotKnown' }, 409))

    try {
      await open(user)
      await user.type(eventBox(), 'Gradska liga')
      await user.type(raceBox(), 'Nova')
      await user.type(screen.getByLabelText(/^Dužina/), '10')
      await user.type(screen.getByLabelText(/^Uspon/), '0')
      await user.type(screen.getByLabelText(/^Spust/), '0')
      await aRowFor(user)
      await save(user)

      expect(await screen.findByText(sr.leagueResults.refused.theEventIsNotKnown)).toBeVisible()
    } finally {
      server.stop()
    }
  })

  it('says beside the race’s box that the races could not be read, and still takes a new race typed into it', async () => {
    const user = setupUser()
    const server = serverThat((path, init) =>
      (init?.method ?? 'GET') === 'GET' && path === '/api/races'
        ? new Response('nema', { status: 500 })
        : (init?.method ?? 'GET') === 'GET' && path === '/api/events'
          ? answering(CALENDAR)
          : path === '/api/me'
            ? answering({ role: 'moderator', account: 1, mailLanguage: 'sr', seasonsOpenForAReport: [2027] })
            : null,
    )

    try {
      await open(user)

      expect(await screen.findByText('Podaci se ne mogu učitati.')).toBeVisible()

      await user.type(raceBox(), 'Nova staza')

      expect(raceBox()).toHaveValue('Nova staza')
    } finally {
      server.stop()
    }
  })

  it('says beside the box that the calendar could not be read, and still takes a new event typed into it', async () => {
    const user = setupUser()
    const server = serving(undefined, () => new Response('nema', { status: 500 }))

    try {
      await open(user)

      expect(await screen.findByText('Podaci se ne mogu učitati.')).toBeVisible()

      await user.type(eventBox(), 'Nova trka')

      expect(raceBox()).toHaveValue('Nova trka')
    } finally {
      server.stop()
    }
  })
})

describe('the town of a new event on the moderator\'s own screen', () => {
  it('empties the country the town wrote as soon as the name stops being a town the codebook knows', async () => {
    /* Owner, 20.10.2026 (PDL, „Čim ukucano ime mesta prestane da odgovara šifarniku, država koju je
       prepoznavanje upisalo se prazni i čeka izbor"; PENDING 29216): the same field as on every other
       form, drawn here for an event typed by name that the calendar does not have. */
    const user = setupUser()
    const server = serving()

    try {
      await open(user)
      await user.type(eventBox(), 'Jezerska trka')
      await typeATownTheCodebookKnows(user, 'Kranj', 'SI')
      await user.type(screen.getByLabelText(/^Mesto/), ' pod brdom')

      expect(screen.getByLabelText(/^Mesto/)).toHaveValue('Kranj pod brdom')
      expect(screen.getByLabelText(/^Država/)).toHaveValue('')
      expect(screen.getByLabelText(/^Država/)).toBeEnabled()
    } finally {
      server.stop()
    }
  })
})
