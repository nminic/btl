import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { BtlEvent, Race, Result } from '../../data/types'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { must } from '../../test/at'
import { SLOW } from '../../test/slow'
import { did, refused, serverThat, type Asked } from '../../test/serverAnswers'

/**
 * A MEMBER'S OWN RESULT REACHING THE SERVER, WHICH BEFORE 28.09.2026 IT NEVER DID.
 *
 * <p>Measured that day on `origin/main`: `grep -rn "api/results" frontend/src` found only
 * comments and mocks, and none of the 29 callers of `askTheServer` named the route. All
 * three screens wrote the browser's own overlay and told the member it was sent.
 *
 * <p><b>What is measured here is what CROSSES THE WIRE and what the reader is told about
 * it</b>; what the browser goes on drawing afterwards is `ownResult.test.tsx`'s and
 * `memberFlows.test.tsx`'s, which walked those screens long before this.
 */

const ME = '000007'

/**
 * A CLOCK SHORTER THAN THE CASE'S OWN, so an assertion that fails says WHAT it was looking
 * for.
 *
 * <p>Testing Library's wait and Vitest's case timeout are both {@link SLOW} here
 * (`test/setup.ts`), so the two run out in the same instant and the case dies with „Test
 * timed out in 20000ms" instead of with the name of the element. Measured on this very file
 * on 28.09.2026: seven failures, not one of which said what was missing, over two fixtures
 * that were simply wrong (the road is `prijava` and the second press is „Potvrdi brisanje").
 */
const SOON = { timeout: 4_000 }

const countedResults: Result[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/results.json'), 'utf-8'),
)
const allRaces: Race[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/races.json'), 'utf-8'),
)
const allEvents: BtlEvent[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/events.json'), 'utf-8'),
)

let server: { asked: Asked[]; stop: () => void } | null = null

afterEach(() => {
  server?.stop()
  server = null
})

/** Every request this case made to the result routes, in the order they were made. */
function writes(): Asked[] {
  return (server?.asked ?? []).filter(
    (one) => one.path.startsWith('/api/results') && one.init?.method !== undefined,
  )
}

function bodyOf(one: Asked): Record<string, unknown> {
  const said: unknown = JSON.parse(String(one.init?.body))

  return typeof said === 'object' && said !== null ? { ...said } : {}
}

/**
 * A SERVER THAT ANSWERS THE RESULT ROUTES AND NOTHING ELSE, so every other read still
 * comes off the files the portal is served in a test.
 *
 * @param answering what the result routes say back. `did()` unless a case wants otherwise
 */
function listening(answering: () => Response = did) {
  server = serverThat((path, init) =>
    path.startsWith('/api/results') && init?.method !== undefined ? answering() : null,
  )
}

/** The form away from the calendar, filled in for a race the calendar does not hold. */
async function describeARace(user: ReturnType<typeof setupUser>, name = 'Trka kroz šumu') {
  await user.type(await screen.findByLabelText(/^Naziv trke/), name)
  await user.type(screen.getByLabelText(/Datum trke/), '10052026')
  await user.type(screen.getByLabelText('Mesto'), 'Niš')
  await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
  await user.type(screen.getByLabelText(/Dužina/), '21.1')
  await user.type(screen.getByLabelText(/Uspon/), '540')
  await user.type(screen.getByLabelText(/Spust/), '540')
  await user.type(screen.getByLabelText('Sati'), '1')
  await user.type(screen.getByLabelText('Minuta'), '52')
  await user.type(screen.getByLabelText('Sekundi'), '10')
  await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/rezultati')
}

/* The two forms do not share a submit label - „Pošalji na proveru" away from the calendar
   and „Pošalji rezultat" on it - so the name is the caller's to give rather than a default
   that happens to be right on three roads out of four. */
const send = async (user: ReturnType<typeof setupUser>, named = 'Pošalji na proveru') => {
  await user.click(screen.getByRole('button', { name: named }))
}

/**
 * OPENS THE CORRECTION THE WAY A MEMBER DOES, WHICH IS FROM HIS OWN LIST.
 *
 * <p><b>And not by typing the address, which is a different thing and is measured to be
 * broken already.</b> `FormRenderer` seeds itself with `initial` once, at mount
 * (`useState(() => ...)`), and `NewResult` can only work out WHICH counted result is being
 * corrected after `/api/results` has answered. Reached cold, the form therefore mounts
 * before the answer and stays empty: measured 28.09.2026, a press then complains about
 * „Naziv trke, Datum trke, Dužina, Uspon, Spust, Sati, Minuta, Sekundi", every one of which
 * the record it is correcting already holds. That is untouched by this branch - no code
 * here reads `initial`, mounts that form or changes when the resource lands - and it is
 * reported rather than fixed.
 *
 * <p>From the list the resource is already in hand, so the form mounts knowing, which is
 * the same road `ownResult.test.tsx` takes for every one of its cases about this form.
 */
const openTheCorrection = async (
  user: ReturnType<typeof setupUser>,
  router: { state: { location: { search: string } } },
) => {
  const table = within(await screen.findByRole('table', { name: 'Uračunato' }, SOON))
  const row = within(must(table.getAllByRole('row')[1], 'the first counted result'))

  await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
  await screen.findByText(/Menjaš rezultat koji je već uračunat/, undefined, SOON)

  /* WHICH result is being corrected, read off the ADDRESS the row's own link wrote rather
     than guessed from the file. That kills the „two sources of one value" this case would
     otherwise have: the table is drawn through `resultsOf`, which filters and orders, so an
     id taken from `countedResults[0]` agreed with the screen by luck - measured
     28.09.2026, it named 9 while the screen was correcting 3367 - and a race NAME does not
     name a row either, because a member may run the same race in two seasons.

     The address is what `NewResult` itself reads, so this asks the same question the screen
     asked. */
  return must(
    /^\?ispravka=(\d+)$/.exec(router.state.location.search)?.[1],
    `the address does not name a result: ${router.state.location.search}`,
  )
}

describe('a run entered away from the calendar', () => {
  it(
    'goes to the server, naming the town and never a placeId',
    async () => {
      const user = setupUser()

      listening()
      renderAt('/sr/rezultat/novi', 'competitor', ME, undefined, '2026-08-23')

      await describeARace(user)
      await send(user)

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      const sent = must(writes()[0], 'the request')

      expect(sent.path).toBe('/api/results')
      expect(sent.init?.method).toBe('POST')

      const body = bodyOf(sent)

      /* The race the member described, which is the road `ResultWriteApi.described` takes:
         the absence of `raceId` is what tells verification it has to make the event and the
         race (owner, 31.08.2026). */
      expect(body.raceName).toBe('Trka kroz šumu')
      expect(body.raceKind).toBe('length')
      /* `day` and not `date`, which is what the record on the server calls it. Sent under
         the other name it arrives null and is refused about a date the member filled in. */
      expect(body.day).toBe('2026-05-10')
      expect(Object.hasOwn(body, 'date')).toBe(false)
      /* The town by name and country. `PlaceField` has no GeoNames mark to give, and the
         route refuses a body that names the town both ways at once. */
      expect(body.city).toBe('Niš')
      expect(body.country).toBe('RS')
      expect(Object.hasOwn(body, 'placeId')).toBe(false)
      expect(Object.hasOwn(body, 'raceId')).toBe(false)
      /* What was run, and the proof beside it. */
      expect(body.distanceKm).toBe(21.1)
      expect(body.ascentM).toBe(540)
      expect(body.descentM).toBe(540)
      expect(body.seconds).toBe(6730)
      expect(body.link).toBe('https://primer.rs/rezultati')
      /* THE POINTS ARE NOT SENT AND THERE IS NO FIELD FOR THEM. PDL: „Bodovi ostaju
         izračunata vrednost", and `ResultWriteApi` computes them with `BtlScoreCalculator`.
         A screen that sent its own number would be a second opinion about the one figure
         the rulebook fixes. */
      expect(Object.hasOwn(body, 'points')).toBe(false)
      expect(Object.hasOwn(body, 'category')).toBe(false)
      expect(Object.hasOwn(body, 'memberNumber')).toBe(false)
    },
    SLOW,
  )

  it(
    'keeps every box and says why, where the server refused',
    async () => {
      const user = setupUser()

      listening(() => refused('theRaceHasNotBeenRun'))
      renderAt('/sr/rezultat/novi', 'competitor', ME, undefined, '2026-08-23')

      await describeARace(user)
      await send(user)

      /* The sentence the route's own word chooses, and not „something went wrong". */
      expect(
        await screen.findByText('Rezultat ne može da se pošalje pre dana same trke.'),
      ).toBeVisible()

      /* AND THE CONFIRMATION IS NOT DRAWN, which is the half a case about the sentence
         alone would miss: a member told his run was sent AND told why it was not is worse
         than either. */
      expect(screen.queryByRole('heading', { name: 'Rezultat je poslat' })).toBeNull()

      /* And nothing typed is lost. The refusal is usually about one field, and a form that
         emptied itself would make the member enter the whole race again to change a link. */
      expect(await screen.findByLabelText(/^Naziv trke/)).toHaveValue('Trka kroz šumu')
      expect(screen.getByLabelText(/Dužina/)).toHaveValue(21.1)
      expect(screen.getByLabelText('Minuta')).toHaveValue(52)
      expect(screen.getByLabelText(/Link/)).toHaveValue('https://primer.rs/rezultati')
    },
    SLOW,
  )

  it(
    'says the refusal in the server’s own words even when the screen does not know it',
    async () => {
      const user = setupUser()

      listening(() => refused('somethingNobodyHasNamedYet'))
      renderAt('/sr/rezultat/novi', 'competitor', ME, undefined, '2026-08-23')

      await describeARace(user)
      await send(user)

      /* A screen one release behind its server must not pick the nearest sentence it does
         have, because the nearest sentence tells the reader to fix something that is not
         wrong (`ServerSaid`). */
      expect(await screen.findByText(/somethingNobodyHasNamedYet/)).toBeVisible()
      expect(screen.queryByRole('heading', { name: 'Rezultat je poslat' })).toBeNull()
    },
    SLOW,
  )

  it(
    'sends once however many times the button is pressed before an answer comes',
    async () => {
      const user = setupUser()
      /* A request that is out and stays out, so the second and third presses arrive while
         the first is still unanswered - which is the only state this case is about. The
         executor runs at once, so `release` is really assigned before anything reads it. */
      let release: (response: Response) => void = () => undefined
      const held = new Promise<Response>((settle) => {
        release = settle
      })

      server = serverThat((path, init) =>
        path.startsWith('/api/results') && init?.method !== undefined ? held : null,
      )

      renderAt('/sr/rezultat/novi', 'competitor', ME, undefined, '2026-08-23')

      await describeARace(user)
      await send(user)
      await send(user)
      await send(user)

      /* A member may hold only one result on one race (PDL, 09.09.2026), so a second
         request is a second row for one run. The ref is what refuses it: state would be a
         redraw late. */
      expect(writes()).toHaveLength(1)

      release(did())

      expect(await screen.findByRole('heading', { name: 'Rezultat je poslat' })).toBeVisible()
    },
    SLOW,
  )
})

describe('a run reported from the event it was run at', () => {
  /** An event with a race that has been run, read off the files rather than named. */
  const reportable = () => {
    const race = must(
      allRaces.find((one) => one.date <= '2026-08-23'),
      'a race that has been run',
    )

    return {
      race,
      event: must(
        allEvents.find((one) => one.id === race.eventId),
        'the event of that race',
      ),
    }
  }

  it(
    'goes to the same address, carrying the race and not one word about it',
    async () => {
      const user = setupUser()
      const { race, event } = reportable()

      listening()
      renderAt(
        `/sr/kalendar/${event.slug}/prijava?trka=${String(race.id)}`,
        'competitor',
        ME,
        undefined,
        '2026-08-23',
      )

      await user.type(await screen.findByLabelText(/Link/), 'https://primer.rs/rezultati')

      if (race.kind !== 'time') {
        await user.type(screen.getByLabelText('Sati'), '0')
        await user.type(screen.getByLabelText('Minuta'), '44')
        await user.type(screen.getByLabelText('Sekundi'), '2')
      }

      await send(user, 'Pošalji rezultat')

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      const sent = must(writes()[0], 'the request')

      /* THE SAME ADDRESS AS THE OTHER DOOR, which is what makes them one act rather than
         two. A mutation that changes it has to fall on both. */
      expect(sent.path).toBe('/api/results')
      expect(sent.init?.method).toBe('POST')

      const body = bodyOf(sent)

      expect(body.raceId).toBe(race.id)
      /* AND NOT ONE WORD ABOUT THE RACE BESIDE ITS NUMBER.
         `ResultWriteApi.fromTheCalendar` answers `theRaceIsNamedTwice` when any of these
         five arrives with a `raceId`, and the screen's own record carries three of them on
         every road - so a body built out of that record would be refused on EVERY race
         picked out of the calendar. */
      for (const beside of ['raceName', 'raceKind', 'placeId', 'city', 'country', 'day', 'date']) {
        expect(Object.hasOwn(body, beside), `${beside} travelled beside a raceId`).toBe(false)
      }
    },
    SLOW,
  )

  it(
    'keeps the form and says why, where the server refused',
    async () => {
      const user = setupUser()
      const { race, event } = reportable()

      /* NOT a malformed link, which never reaches the server at all: the field carries
         `pattern: ^https?://[^\s]+$` on both forms, so the FORM turns that away and this
         case would have been measuring the form rather than the answer. A race the
         calendar has lost under the member is a refusal only the route can make. */
      listening(() => refused('theRaceIsNotKnown'))
      renderAt(
        `/sr/kalendar/${event.slug}/prijava?trka=${String(race.id)}`,
        'competitor',
        ME,
        undefined,
        '2026-08-23',
      )

      await user.type(await screen.findByLabelText(/Link/), 'https://primer.rs/rezultati')

      if (race.kind !== 'time') {
        await user.type(screen.getByLabelText('Sati'), '0')
        await user.type(screen.getByLabelText('Minuta'), '44')
        await user.type(screen.getByLabelText('Sekundi'), '2')
      }

      await send(user, 'Pošalji rezultat')

      expect(
        await screen.findByText(/više ne stoji u kalendaru/, undefined, SOON),
      ).toBeVisible()
      expect(screen.queryByRole('heading', { name: 'Rezultat je poslat' })).toBeNull()
      expect(screen.getByLabelText(/Link/)).toHaveValue('https://primer.rs/rezultati')
    },
    SLOW,
  )

  it(
    'sends once from this door too, however many times the button is pressed',
    async () => {
      const user = setupUser()
      const { race, event } = reportable()
      let release: (response: Response) => void = () => undefined
      const held = new Promise<Response>((settle) => {
        release = settle
      })

      server = serverThat((path, init) =>
        path.startsWith('/api/results') && init?.method !== undefined ? held : null,
      )

      renderAt(
        `/sr/kalendar/${event.slug}/prijava?trka=${String(race.id)}`,
        'competitor',
        ME,
        undefined,
        '2026-08-23',
      )

      await user.type(await screen.findByLabelText(/Link/), 'https://primer.rs/rezultati')

      if (race.kind !== 'time') {
        await user.type(screen.getByLabelText('Sati'), '0')
        await user.type(screen.getByLabelText('Minuta'), '44')
        await user.type(screen.getByLabelText('Sekundi'), '2')
      }

      await send(user, 'Pošalji rezultat')
      await send(user, 'Pošalji rezultat')

      /* THE SAME GUARD ON THE SECOND DOOR, and it is written out separately rather than
         trusted to the first: these are two screens with two copies of the same ref, and a
         mutation that removes one has to fail on one case rather than on none. A member may
         hold only one result on one race (PDL, 09.09.2026). */
      expect(writes()).toHaveLength(1)

      release(did())

      expect(
        await screen.findByRole('heading', { name: 'Rezultat je poslat' }, SOON),
      ).toBeVisible()
    },
    SLOW,
  )
})

describe('a counted result the member asks to have put right', () => {
  /** The member whose counted results the file really holds. */
  const HIS = '000001'

  it(
    'goes to the address of the RESULT, as a PUT with no race on it',
    async () => {
      const user = setupUser()

      listening()
      const { router } = renderAt(
        '/sr/moji-rezultati',
        'competitor',
        HIS,
        undefined,
        '2026-08-23',
      )

      const correcting = await openTheCorrection(user, router)

      await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/nov-dokaz')
      await send(user)

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      const sent = must(writes()[0], 'the request')

      /* `ResultWriteApi.his` reads `result` by `r.id`, so this address names a counted run
         and never the submission a member may also be holding. */
      expect(sent.path).toBe(`/api/results/${correcting}`)
      expect(sent.init?.method).toBe('PUT')

      const body = bodyOf(sent)

      /* „Menja se sve osim trke" (owner, 27.08.2026): the correction is the numbers and the
         proof, and the record on the server declares no field for a race at all. */
      for (const beside of ['raceId', 'raceName', 'raceKind', 'day', 'date', 'city', 'country']) {
        expect(Object.hasOwn(body, beside), `${beside} travelled on a correction`).toBe(false)
      }

      expect(body.link).toBe('https://primer.rs/nov-dokaz')
      /* The time the record already holds, put back into the boxes and sent again unchanged:
         a correction is the numbers as they now stand, not a blank form. */
      expect(body.seconds).toBe(
        must(
          countedResults.find((one) => String(one.id) === correcting),
          'the result being corrected',
        ).seconds,
      )
    },
    SLOW,
  )

  it(
    'leaves the result exactly where it was when the server refused',
    async () => {
      const user = setupUser()

      listening(() => refused('theFormIsNotComplete'))
      const { router } = renderAt(
        '/sr/moji-rezultati',
        'competitor',
        HIS,
        undefined,
        '2026-08-23',
      )

      await openTheCorrection(user, router)
      await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/nov-dokaz')
      await send(user)

      expect(
        await screen.findByText(/Proveri dužinu, uspon, spust i vreme/, undefined, SOON),
      ).toBeVisible()
      expect(screen.queryByRole('heading', { name: 'Rezultat je poslat' })).toBeNull()
      expect(screen.getByLabelText(/Link/)).toHaveValue('https://primer.rs/nov-dokaz')
    },
    SLOW,
  )
})

describe('a submission that is still waiting', () => {
  it(
    'is corrected in the browser alone, because no route on this server takes one',
    async () => {
      const user = setupUser()

      listening()
      renderAt('/sr/rezultat/novi', 'competitor', ME, undefined, '2026-08-23')

      await describeARace(user, 'Probna trka')
      await send(user)

      expect(await screen.findByRole('heading', { name: 'Rezultat je poslat' })).toBeVisible()
      expect(writes()).toHaveLength(1)

      await user.click(screen.getByRole('link', { name: 'Moji rezultati' }))
      await user.click(
        await screen.findByRole('link', { name: 'Izmeni rezultat: Probna trka' }, SOON),
      )

      await screen.findByText(/Menjaš rezultat koji još čeka proveru/, undefined, SOON)
      await user.clear(screen.getByLabelText('Minuta'))
      await user.type(screen.getByLabelText('Minuta'), '51')
      await send(user)

      expect(await screen.findByRole('heading', { name: 'Rezultat je poslat' })).toBeVisible()

      /* STILL ONE REQUEST, AND THAT IS THE BOUNDARY RATHER THAN A GAP.
         `?ponovo=` is about a `Submission` - a question the member asked, keyed by a string
         this browser minted - and `ResultWriteApi` writes that exclusion out as deliberate:
         „a result is njegov podatak and a submission is a question he asked. This class is
         about `result`." Nothing serves a member his own submissions either, so there is
         nothing to send it to and nothing to read it back from.

         Measured as a COUNT rather than as an absence of one address, so a correction that
         went to some other address of the result routes would fail here too. */
      expect(writes()).toHaveLength(1)
    },
    SLOW,
  )
})

describe('a counted result the member takes back', () => {
  const COUNTED = '/sr/moji-rezultati'

  /** The first row of the counted table, and the control that deletes it. */
  const firstRow = async () => {
    const table = within(await screen.findByRole('table', { name: 'Uračunato' }))

    return within(must(table.getAllByRole('row')[1], 'the first counted result'))
  }

  const howManyCounted = async () =>
    within(await screen.findByRole('table', { name: 'Uračunato' })).getAllByRole('row').length - 1

  it(
    'really goes, as a DELETE on the address of that result',
    async () => {
      const user = setupUser()

      listening()
      renderAt(COUNTED, 'competitor', '000001', undefined, null)

      const before = await howManyCounted()
      const row = await firstRow()

      await user.click(row.getByRole('button', { name: /^Obriši: / }))
      await user.click(await screen.findByRole('button', { name: /^Potvrdi brisanje/ }, SOON))

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      const sent = must(writes()[0], 'the request')

      expect(sent.init?.method).toBe('DELETE')
      expect(sent.path).toMatch(/^\/api\/results\/\d+$/)

      await waitFor(async () => {
        expect(await howManyCounted()).toBe(before - 1)
      }, SOON)
    },
    SLOW,
  )

  it(
    'stays in the standing when the server refused, and says so',
    async () => {
      const user = setupUser()

      listening(() => refused('theFormIsNotComplete'))
      renderAt(COUNTED, 'competitor', '000001', undefined, null)

      const before = await howManyCounted()
      const row = await firstRow()

      await user.click(row.getByRole('button', { name: /^Obriši: / }))
      await user.click(await screen.findByRole('button', { name: /^Potvrdi brisanje/ }, SOON))

      expect(
        await screen.findByText(/Proveri dužinu, uspon, spust i vreme/, undefined, SOON),
      ).toBeVisible()

      /* THE ROW IS STILL THERE, and that is the half that matters: the points really are
         still counted, so a screen that removed the row would be telling the member his
         result is gone while every board still holds it. */
      expect(await howManyCounted()).toBe(before)
    },
    SLOW,
  )

  it(
    'takes only one back at a time, so a second press while one is out does nothing',
    async () => {
      const user = setupUser()
      let release: (response: Response) => void = () => undefined
      const held = new Promise<Response>((settle) => {
        release = settle
      })

      server = serverThat((path, init) =>
        path.startsWith('/api/results') && init?.method !== undefined ? held : null,
      )

      renderAt(COUNTED, 'competitor', '000001', undefined, null)

      const table = within(await screen.findByRole('table', { name: 'Uračunato' }, SOON))
      const rows = table.getAllByRole('row').slice(1)

      expect(rows.length, 'one row cannot measure a second press').toBeGreaterThan(1)

      /* A SECOND ROW AND NOT THE SAME ONE TWICE, which is the state this guard is really
         for: the confirmation closes behind the first press, so nobody can press one row
         twice - what a member CAN do is start on another row while the first is still out,
         and that would take a second result off his profile on one answer. */
      for (const row of rows.slice(0, 2)) {
        await user.click(within(row).getByRole('button', { name: /^Obriši: / }))
        /* Within the row and never over the whole screen: the first row's confirmation is
           still open, because nothing closes it while its request is out, so a screen-wide
           query finds two and this case would fail over its own second press rather than
           over the thing it measures. */
        await user.click(within(row).getByRole('button', { name: /^Potvrdi brisanje/ }))
      }

      expect(writes()).toHaveLength(1)

      release(did())

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)
    },
    SLOW,
  )
})
