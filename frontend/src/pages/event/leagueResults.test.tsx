import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import type { Race, Result } from '../../data/types'
import { must } from '../../test/at'
import { moderatorWith, renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

/**
 * THE LEAGUE ENTERS, CHANGES AND DELETES MEMBERS' RESULTS FROM THE EVENT PAGE (PDL P9, 18.10.2026),
 * on the screen: who sees the ways in, which boxes each kind of race asks for, what is sent, and how a
 * refusal is said.
 *
 * <p><b>The axes and where each state stands.</b> Who reads: a visitor, a member, a moderator with
 * another right only, a moderator with the right that checks results, the superadmin. The race: one of
 * each kind, on one event (`maraton-maratona-2015`, whose four races are re-shaped by the server below,
 * the precedent `raceOrderOnTheEventPage.test.tsx` keeps). The rows: two members, one of them chosen by
 * name and one by number, and a refusal naming the SECOND row, so a sentence drawn under the first is
 * a sentence under the wrong member. The results: an event with many rows (`mrazijada-2020`), and the
 * SECOND row is the one acted on, so a pencil or an x that reached for the first is caught.
 */

const EVENT = 'maraton-maratona-2015'
const WITH_RESULTS = 'mrazijada-2020'
const CHECKS_RESULTS = moderatorWith(['queue:results'])
const ANOTHER_RIGHT = moderatorWith(['entity:events'])

function mock<T>(name: string): T {
  const read: T = JSON.parse(readFileSync(join(process.cwd(), 'src/test/mock', `${name}.json`), 'utf-8'))

  return read
}

/** The four races of the event, in the order of their keys. */
const OWN = (() => {
  const events = mock<{ id: number; slug: string }[]>('events')
  const id = must(events.find((one) => one.slug === EVENT)?.id, 'the event these cases are written around')

  return mock<Race[]>('races').filter((one) => one.eventId === id).map((one) => one.id)
})()

const TIMED = must(OWN[0], 'a race made timed')
const FREE = must(OWN[1], 'a race made free')
const OF_A_LENGTH = must(OWN[3], 'a race of a length')

function reshaped(race: Race): Race {
  if (race.id === TIMED) {
    return { ...race, kind: 'time', limitSeconds: 6 * 3600, distanceKm: 0 }
  }

  return race.id === FREE ? { ...race, kind: 'free', limitSeconds: 0, distanceKm: 0 } : race
}

/** The results of the event with many rows, in the order the event page draws them (by points). */
const ITS_RESULTS = mock<Result[]>('results')
  .filter((one) => one.eventSlug === WITH_RESULTS)
  .sort((left, right) => right.points - left.points)

const SECOND = must(ITS_RESULTS[1], 'a second result on the event')

/**
 * A server that re-shapes the races, answers every write with `write`, and keeps what was asked.
 */
function serving(
  write: (path: string, init: RequestInit | undefined) => Response | Promise<Response> | null = () => created(),
) {
  const real = globalThis.fetch
  const server = serverThat((path, init) => {
    const method = init?.method ?? 'GET'

    if (path.endsWith('/api/races') && method === 'GET') {
      return real(path).then(async (answer) => {
        const all: Race[] = await answer.json()

        return new Response(JSON.stringify(all.map(reshaped)), { status: 200 })
      })
    }

    return method === 'GET' ? null : write(path, init)
  })

  return server
}

function created(): Response {
  return new Response(JSON.stringify({ results: [1] }), {
    status: 201,
    headers: { 'content-type': 'application/json' },
  })
}

/** The writes the screen sent, as method, address and body. */
function writes(asked: Asked[]): { method: string; path: string; body: unknown }[] {
  return asked
    .filter((one) => (one.init?.method ?? 'GET') !== 'GET')
    .map((one) => ({
      method: one.init?.method ?? 'GET',
      path: one.path,
      body: typeof one.init?.body === 'string' ? JSON.parse(one.init.body) : undefined,
    }))
}

/** The box of one figure in one row. */
const box = (label: string, row: number): HTMLElement =>
  must(screen.getAllByLabelText(label)[row], `${label} of row ${String(row + 1)}`)

/** Chooses a member in the box of one row by typing part of him and pressing his line. */
async function choose(user: ReturnType<typeof setupUser>, row: number, typed: string, line: RegExp) {
  const here = must(screen.getAllByLabelText(/^Član/)[row], `the box of row ${String(row + 1)}`)

  await user.clear(here)
  await user.type(here, typed)
  await user.click(await screen.findByRole('button', { name: line }))
}

describe('the ways in, on the page of an event', () => {
  it('lead a moderator who checks results to the entry of several members, from every race', async () => {
    renderAt(`/sr/kalendar/${EVENT}`, 'moderator', null, CHECKS_RESULTS)

    const table = await screen.findByRole('table', { name: 'Trke' })
    const ways = within(table).getAllByRole('link', { name: /^Unesi rezultat/ })

    expect(ways).toHaveLength(4)
    /* As a set: the rows stand in the owner's order of races (`data/raceOrder.ts`), which is not
       this case's question. */
    expect(ways.map((one) => one.getAttribute('href')).sort()).toEqual(
      OWN.map((race) => `/sr/kalendar/${EVENT}/rezultati?trka=${String(race)}`).sort(),
    )
  }, SLOW)

  it('draw a pencil and an x on every result for whoever checks results, named by whose run it is', async () => {
    renderAt(`/sr/kalendar/${WITH_RESULTS}`, 'moderator', null, CHECKS_RESULTS)

    const table = await screen.findByRole('table', { name: 'Rezultati članova' })

    expect(within(table).getByRole('columnheader', { name: 'Opcije' })).toBeInTheDocument()

    const rows = within(table).getAllByRole('row').slice(1)

    expect(within(must(rows[1], 'the second row')).getAllByRole('link', { name: /^Izmeni rezultat: / })).toHaveLength(1)
    expect(within(must(rows[1], 'the second row')).getAllByRole('button', { name: /^Obriši: / })).toHaveLength(1)
    expect(within(table).getAllByRole('link', { name: /^Izmeni rezultat: / })).toHaveLength(ITS_RESULTS.length)
  }, SLOW)

  it.each([
    ['a visitor', 'visitor' as const, null, undefined],
    ['a member', 'competitor' as const, '000001', undefined],
    ['a moderator with another right', 'moderator' as const, null, ANOTHER_RIGHT],
  ])('draw neither for %s', async (_, role, who, moderator) => {
    renderAt(`/sr/kalendar/${WITH_RESULTS}`, role, who, moderator)

    const table = await screen.findByRole('table', { name: 'Rezultati članova' })

    expect(within(table).queryByRole('columnheader', { name: 'Opcije' })).toBeNull()
    expect(within(table).queryAllByRole('link', { name: /^Izmeni rezultat: / })).toEqual([])
    expect(within(table).queryAllByRole('button', { name: /^Obriši: / })).toEqual([])
  }, SLOW)
})

describe('the entry of several members', () => {
  it('is no screen for a visitor or a member: both are sent to the front page', async () => {
    renderAt(`/sr/kalendar/${EVENT}/rezultati?trka=${String(OF_A_LENGTH)}`, 'competitor', '000001')

    expect(await screen.findByRole('heading', { level: 1, name: 'Balkanska trkačka liga' })).toBeVisible()
  }, SLOW)

  it.each([
    ['of a length, the time', OF_A_LENGTH, ['Sati', 'Minuti', 'Sekunde']],
    ['to a limit, the course', TIMED, ['Dužina (km)', 'Uspon (m)', 'Spust (m)']],
    ['that is free, all six', FREE, ['Dužina (km)', 'Uspon (m)', 'Spust (m)', 'Sati', 'Minuti', 'Sekunde']],
  ])('asks on a race %s', async (_, race, boxes) => {
    const server = serving()

    renderAt(`/sr/kalendar/${EVENT}/rezultati?trka=${String(race)}`, 'superadmin')

    await screen.findByRole('heading', { level: 1, name: /^Unos rezultata: / })

    const asked = ['Dužina (km)', 'Uspon (m)', 'Spust (m)', 'Sati', 'Minuti', 'Sekunde'].filter(
      (one) => screen.queryAllByLabelText(one).length > 0,
    )

    expect(asked).toEqual(boxes)
    server.stop()
  }, SLOW)

  it('offers every member with a number, the one whose fee lapsed too, by last name and by number', async () => {
    const user = setupUser()
    const server = serving()

    renderAt(`/sr/kalendar/${EVENT}/rezultati?trka=${String(OF_A_LENGTH)}`, 'superadmin')

    const box = await screen.findByLabelText(/^Član/)

    await user.type(box, 'Antonij')
    expect(await screen.findByRole('button', { name: 'Vojislav Antonijević (000032)' })).toBeVisible()

    await user.clear(box)
    await user.type(box, '00000')
    expect(await screen.findByRole('button', { name: 'Vladan Đurišić (000001)' })).toBeVisible()
    server.stop()
  }, SLOW)

  it('sends every row with the figures its race takes, in one save, and goes back to the event', async () => {
    const user = setupUser()
    const server = serving()

    renderAt(`/sr/kalendar/${EVENT}/rezultati?trka=${String(TIMED)}`, 'superadmin')

    await screen.findByRole('heading', { level: 1, name: /^Unos rezultata: / })
    await choose(user, 0, 'Momčilo', /Relja Momčilović \(000002\)/)
    await user.type(box('Dužina (km)', 0), '61,25')
    await user.type(box('Uspon (m)', 0), '420')
    await user.type(box('Spust (m)', 0), '380')
    await user.click(screen.getByRole('button', { name: /Dodaj člana/ }))
    await choose(user, 1, '000003', /Anđelija Vukotić \(000003\)/)
    await user.type(box('Dužina (km)', 1), '58')
    await user.type(box('Uspon (m)', 1), '0')
    await user.type(box('Spust (m)', 1), '12')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Maraton maratona' })).toBeVisible()
    expect(writes(server.asked)).toEqual([
      {
        method: 'POST',
        path: `/api/races/${String(TIMED)}/results`,
        body: {
          rows: [
            { memberNumber: '000002', distanceKm: 61.25, ascentM: 420, descentM: 380, seconds: null },
            { memberNumber: '000003', distanceKm: 58, ascentM: 0, descentM: 12, seconds: null },
          ],
        },
      },
    ])
    server.stop()
  }, SLOW)

  it('names each row the server refused in that row, and says that nothing was saved', async () => {
    const user = setupUser()
    const server = serving(
      () =>
        new Response(
          JSON.stringify({
            reason: 'aRowIsWrong',
            rows: [{ row: 1, reason: 'heHoldsNoMembershipOfTheRunningSeason' }],
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
    )

    renderAt(`/sr/kalendar/${EVENT}/rezultati?trka=${String(OF_A_LENGTH)}`, 'superadmin')

    await screen.findByRole('heading', { level: 1, name: /^Unos rezultata: / })
    await choose(user, 0, 'Momčilo', /Relja Momčilović \(000002\)/)
    await user.type(box('Sati', 0), '3')
    await user.click(screen.getByRole('button', { name: /Dodaj člana/ }))
    await choose(user, 1, 'Đuriš', /Vladan Đurišić \(000001\)/)
    await user.type(box('Sati', 1), '4')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ništa nije sačuvano. Ispravi redove označene ispod pa sačuvaj ponovo.',
    )

    const rows = screen.getAllByRole('group', { name: /\. red$/ })
    const said = 'Član nema članstvo za sezonu ove trke, pa mu liga ne unosi rezultat.'

    expect(within(must(rows[1], 'the second row')).getByText(said)).toBeVisible()
    expect(within(must(rows[0], 'the first row')).queryByText(said)).toBeNull()
    expect(screen.getAllByLabelText('Sati')[1]).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByLabelText('Sati')[0]).toHaveAttribute('aria-invalid', 'false')
    server.stop()
  }, SLOW)

  it.each([
    ['an event the calendar does not hold', `/sr/kalendar/nema-ovog-dogadjaja/rezultati?trka=1`, 'Ovog događaja nema.'],
    ['a race the event has not run', `/sr/kalendar/${EVENT}/rezultati?trka=1`, 'Maraton maratona'],
    [
      'a result that is not on the race',
      `/sr/kalendar/${EVENT}/rezultati?trka=${String(OF_A_LENGTH)}&rezultat=${String(SECOND.id)}`,
      'Maraton maratona',
    ],
  ])('draws no rows for %s, and says what is missing', async (_, address, heading) => {
    renderAt(address, 'superadmin')

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeVisible()
    expect(screen.queryAllByRole('group', { name: /\. red$/ })).toEqual([])
  }, SLOW)

  it('says a refusal of the whole save under the form, and a reason it does not know in the server’s word', async () => {
    const user = setupUser()
    const server = serving(
      () =>
        new Response(JSON.stringify({ reason: 'aRowIsWrong', rows: [{ row: 0, reason: 'somethingNew' }] }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    )

    renderAt(`/sr/kalendar/${EVENT}/rezultati?trka=${String(OF_A_LENGTH)}`, 'superadmin')

    await screen.findByRole('heading', { level: 1, name: /^Unos rezultata: / })
    await choose(user, 0, 'Momčilo', /Relja Momčilović \(000002\)/)
    await user.type(box('Sati', 0), '3')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    const row = must(screen.getAllByRole('group', { name: /\. red$/ })[0], 'the row')

    expect(await within(row).findByText(/somethingNew/)).toBeVisible()
    server.stop()
  }, SLOW)

  it('sends one save for two presses that arrive while the first is out', async () => {
    const user = setupUser()
    let answer: (made: Response) => void = () => {}
    const held = new Promise<Response>((resolve) => {
      answer = resolve
    })
    const server = serving(() => held)

    renderAt(`/sr/kalendar/${EVENT}/rezultati?trka=${String(OF_A_LENGTH)}`, 'superadmin')

    await screen.findByRole('heading', { level: 1, name: /^Unos rezultata: / })
    await choose(user, 0, 'Momčilo', /Relja Momčilović \(000002\)/)
    await user.type(box('Sati', 0), '3')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    expect(await screen.findByText('Čuva se')).toHaveAttribute('role', 'status')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    answer(created())

    expect(await screen.findByRole('heading', { level: 1, name: 'Maraton maratona' })).toBeVisible()
    expect(server.asked.filter((one) => one.init?.method === 'POST')).toHaveLength(1)
    server.stop()
  }, SLOW)

  it('says a refusal of the whole save that names no row, and marks no row', async () => {
    const user = setupUser()
    const server = serving(
      () =>
        new Response(JSON.stringify({ reason: 'theGroupIsTooBig', rows: [] }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    )

    renderAt(`/sr/kalendar/${EVENT}/rezultati?trka=${String(OF_A_LENGTH)}`, 'superadmin')

    await screen.findByRole('heading', { level: 1, name: /^Unos rezultata: / })
    await choose(user, 0, 'Momčilo', /Relja Momčilović \(000002\)/)
    await user.type(box('Sati', 0), '3')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Previše redova za jedno čuvanje. Podeli ih na dva čuvanja.',
    )
    expect(box('Sati', 0)).toHaveAttribute('aria-invalid', 'false')
    server.stop()
  }, SLOW)

  it('says that an event has run no race yet, on a day before all of them', async () => {
    renderAt(`/sr/kalendar/${EVENT}/rezultati?trka=${String(OF_A_LENGTH)}`, 'superadmin', null, undefined, '2000-01-01')

    expect(await screen.findByRole('heading', { level: 1, name: 'Maraton maratona' })).toBeVisible()
    expect(screen.queryAllByRole('group', { name: /\. red$/ })).toEqual([])
  }, SLOW)

  it('says an answer that is no refusal in the portal’s words for a number, and marks no row', async () => {
    const user = setupUser()
    const server = serving(() => new Response(null, { status: 500 }))

    renderAt(`/sr/kalendar/${EVENT}/rezultati?trka=${String(OF_A_LENGTH)}`, 'superadmin')

    await screen.findByRole('heading', { level: 1, name: /^Unos rezultata: / })
    await choose(user, 0, 'Momčilo', /Relja Momčilović \(000002\)/)
    await user.type(box('Sati', 0), '3')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/500/)
    expect(box('Sati', 0)).toHaveAttribute('aria-invalid', 'false')
    server.stop()
  }, SLOW)

  it('sends nothing while a row names nobody, and says so in that row', async () => {
    const user = setupUser()
    const server = serving()

    renderAt(`/sr/kalendar/${EVENT}/rezultati?trka=${String(OF_A_LENGTH)}`, 'superadmin')

    const box = await screen.findByLabelText(/^Član/)

    /* Typed and not chosen: a name typed is nobody until it is chosen. */
    await user.type(box, 'Relja Momčilović')
    await user.type(screen.getByLabelText('Sati'), '3')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByText('Izaberi člana sa spiska.')).toBeVisible()
    expect(writes(server.asked)).toEqual([])
    server.stop()
  }, SLOW)

  it('takes a row away with its x, and adds one with the button under them', async () => {
    const user = setupUser()
    const server = serving()

    renderAt(`/sr/kalendar/${EVENT}/rezultati?trka=${String(OF_A_LENGTH)}`, 'superadmin')

    await screen.findByRole('heading', { level: 1, name: /^Unos rezultata: / })
    expect(screen.queryByRole('button', { name: /^Ukloni / })).toBeNull()

    await user.click(screen.getByRole('button', { name: /Dodaj člana/ }))
    await user.click(screen.getByRole('button', { name: /Dodaj člana/ }))
    expect(screen.getAllByRole('group', { name: /\. red$/ })).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Ukloni 2. red' }))
    expect(screen.getAllByRole('group', { name: /\. red$/ })).toHaveLength(2)
    server.stop()
  }, SLOW)
})

describe('the pencil and the x', () => {
  it('opens one row with the member fixed and the figures filled, and sends the figures alone', async () => {
    const user = setupUser()
    const server = serving(() => new Response(null, { status: 204 }))

    renderAt(
      `/sr/kalendar/${WITH_RESULTS}/rezultati?trka=${String(SECOND.raceId)}&rezultat=${String(SECOND.id)}`,
      'superadmin',
    )

    expect(await screen.findByRole('heading', { level: 1, name: /^Izmena rezultata: / })).toBeVisible()
    expect(screen.getAllByRole('group', { name: /\. red$/ })).toHaveLength(1)
    expect(screen.getByLabelText(/^Član/)).toHaveAttribute('readonly')
    expect(screen.getByLabelText(/^Član/)).toHaveDisplayValue(
      must(
        mock<{ memberNumber: string; firstName: string; lastName: string }[]>('results/runners')
          .filter((one) => one.memberNumber === SECOND.memberNumber)
          .map((one) => `${one.firstName} ${one.lastName} (${one.memberNumber})`)[0],
        'the member of the second result on the list',
      ),
    )
    expect(screen.queryByRole('button', { name: /Dodaj člana/ })).toBeNull()

    const hours = screen.getByLabelText('Sati')

    expect(hours).toHaveValue(String(Math.floor(SECOND.seconds / 3600)))

    await user.clear(hours)
    await user.type(hours, '5')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    await waitFor(() => {
      expect(writes(server.asked)).toHaveLength(1)
    })
    expect(writes(server.asked)).toEqual([
      {
        method: 'PUT',
        path: `/api/races/${String(SECOND.raceId)}/results/${String(SECOND.id)}`,
        body: {
          distanceKm: null,
          ascentM: null,
          descentM: null,
          seconds: 5 * 3600 + (SECOND.seconds % 3600),
        },
      },
    ])
    server.stop()
  }, SLOW)

  it('says why the pencil was refused, and names nobody by a list that does not know him', async () => {
    /* The list answered without him (a result of somebody with no number, or a list read before
       he was given one): the row is named by the number the result carries. And the server refuses
       the change while his correction waits, which is a refusal of the one row and names no row. */
    const user = setupUser()
    const real = globalThis.fetch
    const server = serving(
      () =>
        new Response(JSON.stringify({ reason: 'hisSubmissionWaits' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
    )
    const served = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).endsWith('/api/results/runners') ? new Response('[]', { status: 200 }) : served(input, init)

    renderAt(
      `/sr/kalendar/${WITH_RESULTS}/rezultati?trka=${String(SECOND.raceId)}&rezultat=${String(SECOND.id)}`,
      'superadmin',
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: `Izmena rezultata: ${String(SECOND.memberNumber)}` }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Član već ima prijavu koja čeka za ovu trku. Prvo je odobri ili odbij u redu za proveru.',
    )
    expect(screen.getByLabelText('Sati')).toHaveAttribute('aria-invalid', 'false')
    globalThis.fetch = real
    server.stop()
  }, SLOW)

  it('names the pencil and the x of a run by somebody with no number by the word for a member', async () => {
    const real = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).endsWith('/api/results') || (init?.method ?? 'GET') !== 'GET') {
        return real(input, init)
      }

      const all: Result[] = await (await real(input)).json()

      return new Response(
        JSON.stringify(all.map((one) => (one.id === SECOND.id ? { ...one, memberNumber: null } : one))),
        { status: 200 },
      )
    }

    renderAt(`/sr/kalendar/${WITH_RESULTS}`, 'superadmin')

    const table = await screen.findByRole('table', { name: 'Rezultati članova' })

    expect(within(table).getByRole('link', { name: 'Izmeni rezultat: Član lige' })).toBeVisible()
    expect(within(table).getByRole('button', { name: 'Obriši: Član lige' })).toBeVisible()
    globalThis.fetch = real
  }, SLOW)

  it('deletes the result of its own row through the race it is on, and takes the row away at once', async () => {
    const user = setupUser()
    const server = serving(() => new Response(null, { status: 204 }))

    renderAt(`/sr/kalendar/${WITH_RESULTS}`, 'superadmin')

    const table = await screen.findByRole('table', { name: 'Rezultati članova' })
    const row = must(within(table).getAllByRole('row').slice(1)[1], 'the second row')
    const ask = within(row).getByRole('button', { name: /^Obriši: / })
    const name = must(ask.getAttribute('aria-label'), 'a name').replace('Obriši: ', '')

    expect(ask).toHaveTextContent('×')

    await user.click(ask)
    await user.click(within(row).getByRole('button', { name: `Potvrdi brisanje: ${name}` }))

    await waitFor(() => {
      expect(within(table).getAllByRole('row').slice(1)).toHaveLength(ITS_RESULTS.length - 1)
    })
    expect(writes(server.asked)).toEqual([
      {
        method: 'DELETE',
        path: `/api/races/${String(SECOND.raceId)}/results/${String(SECOND.id)}`,
        body: {},
      },
    ])
    server.stop()
  }, SLOW)

  it('says why the x was refused beside the row it was pressed on', async () => {
    const user = setupUser()
    const server = serving(
      () =>
        new Response(JSON.stringify({ reason: 'hisSubmissionWaits' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
    )

    renderAt(`/sr/kalendar/${WITH_RESULTS}`, 'superadmin')

    const table = await screen.findByRole('table', { name: 'Rezultati članova' })
    const row = must(within(table).getAllByRole('row').slice(1)[1], 'the second row')
    const ask = within(row).getByRole('button', { name: /^Obriši: / })
    const name = must(ask.getAttribute('aria-label'), 'a name').replace('Obriši: ', '')

    await user.click(ask)
    await user.click(within(row).getByRole('button', { name: `Potvrdi brisanje: ${name}` }))

    expect(
      await within(row).findByText(
        'Član već ima prijavu koja čeka za ovu trku. Prvo je odobri ili odbij u redu za proveru.',
      ),
    ).toBeVisible()
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(ITS_RESULTS.length)
    server.stop()
  }, SLOW)
})
