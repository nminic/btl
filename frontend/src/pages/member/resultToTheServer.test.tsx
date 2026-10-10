import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { BtlEvent, Race, Result, SentRun } from '../../data/types'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { must } from '../../test/at'
import { SLOW } from '../../test/slow'
import { answeredWith, did, refused, serverThat, type Asked } from '../../test/serverAnswers'

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
 * @param answering what the result routes say back. `did()` unless a case wants otherwise, and a
 *                  promise that rejects where the case is about an answer that never came
 */
function listening(answering: () => Response | Promise<Response> = did) {
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
 * <p><b>And not by typing the address, which is a different road with a case of its
 * own.</b> `FormRenderer` seeds itself with `initial` once, at mount, and `NewResult` can
 * only work out WHICH counted result is being corrected after `/api/results` has answered.
 * Reached cold, the form used to mount before the answer and stay empty (measured
 * 28.09.2026); since 02.10.2026 it waits for the answer, and „fills the correction from the
 * result even when the address is opened cold" below is the case for that road.
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

  /**
   * A LENGTH WRITTEN THE WAY IT IS WRITTEN HERE GOES OVER WITH A DOT.
   *
   * <p>Owner, 02.10.2026 (`btl-produkt/PDL.md`, „Odluke iz ciscenja nalaza"): „Polje za broj
   * prima i zarez i tacku, a portal salje tacku. „21,1" je oblik u kom se ovde pise duzina."
   * Until that day the box was `type="number"`, which reports „10,55" as empty, so the member
   * read „10,55" in the box and was told the field was obligatory. The number is not 21.1,
   * which the helper above types, so a body carrying the helper's number fails here.
   */
  it(
    'sends a length typed with a comma as the number it is, with a dot',
    async () => {
      const user = setupUser()

      listening()
      renderAt('/sr/rezultat/novi', 'competitor', ME, undefined, '2026-08-23')

      await describeARace(user)
      await user.clear(screen.getByLabelText(/Dužina/))
      await user.type(screen.getByLabelText(/Dužina/), '10,55')
      await send(user)

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      expect(bodyOf(must(writes()[0], 'the request')).distanceKm).toBe(10.55)
    },
    SLOW,
  )

  /**
   * AND A BOX THE SERVER KEEPS WHOLE STOPS A SEPARATOR ON THE FORM, rather than sending a
   * different number.
   *
   * <p>The coordinator's reasoning, not the owner's words: `ResultWriteApi.Ran` reads the time as
   * an `Integer` and the climb as an `Integer`, so „30,5" seconds and „1.200" metres - which is
   * twelve hundred, written with a separator for the thousands - would each have reached the
   * route as another number. Both are refused under their own box and nothing is sent.
   */
  it(
    'refuses a separator in the seconds and in the climb, and sends nothing',
    async () => {
      const user = setupUser()

      listening()
      renderAt('/sr/rezultat/novi', 'competitor', ME, undefined, '2026-08-23')

      await describeARace(user)
      await user.clear(screen.getByLabelText('Sekundi'))
      await user.type(screen.getByLabelText('Sekundi'), '30,5')
      await user.clear(screen.getByLabelText(/Uspon/))
      await user.type(screen.getByLabelText(/Uspon/), '1.200')
      await send(user)

      expect(await screen.findAllByText('Unesi ceo broj.')).toHaveLength(2)
      expect(screen.getByLabelText('Sekundi')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByLabelText(/Uspon/)).toHaveAttribute('aria-invalid', 'true')
      expect(writes()).toHaveLength(0)
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
      expect(screen.getByLabelText(/Dužina/)).toHaveValue('21.1')
      expect(screen.getByLabelText('Minuta')).toHaveValue('52')
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

  it(
    'is free to send again after a refusal, not left refusing every press after the first',
    async () => {
      const user = setupUser()

      listening(() => refused('theRaceHasNotBeenRun'))
      renderAt('/sr/rezultat/novi', 'competitor', ME, undefined, '2026-08-23')

      await describeARace(user)
      await send(user)

      await screen.findByText('Rezultat ne može da se pošalje pre dana same trke.')

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      /* THE GUARD RESETS ON A REFUSAL, NOT ONLY ON SUCCESS. `outstanding.current` is set
         back to `false` in `NewResult.tsx`'s `tellTheServer` as soon as an answer comes
         back, whichever answer it was - a version that cleared it only where the server
         agreed would leave this screen refusing every press after the first refusal, and
         silently: the button goes on looking live and nothing happens, which is worse than
         the sentence above the form telling a member to correct the one field and send
         again. */
      await send(user)

      await waitFor(() => {
        expect(writes()).toHaveLength(2)
      }, SOON)
    },
    SLOW,
  )
})

describe('a run picked from the calendar, on the form away from the event page', () => {
  it(
    'sends the raceId and not one word about the race, though the form still asks for the town',
    async () => {
      const user = setupUser()

      listening()
      renderAt('/sr/rezultat/novi', 'competitor', ME, undefined, '2026-08-23')

      await user.type(await screen.findByLabelText(/^Naziv trke/), 'Maraton maratona')

      const rows = await screen.findAllByRole('button', { name: /Maraton maratona/ })

      /* NEVER THE FIRST ROW OF THE LIST, the same discipline `reportable()` above keeps and
         for the same reason: a body built out of `races[0]` or out of the list's own first
         entry would answer this case by coincidence rather than by carrying the race that
         was really chosen. */
      expect(rows.length, 'one race cannot tell a row from the first row').toBeGreaterThan(1)

      await user.click(must(rows[1], 'the second race offered'))

      /* NOT LOCKED, AND STILL THE MEMBER'S TO FILL IN: `racesToOffer.ts` hands over only
         what the race fixes - the length, the climb and the fall for a race of a length -
         and never the town or the kind, which is exactly why this body cannot be built out
         of `said` (`NewResult.tsx`'s own comment on `tellTheServer`). */
      await user.type(screen.getByLabelText('Mesto'), 'Niš')
      await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
      await user.type(screen.getByLabelText('Sati'), '3')
      await user.type(screen.getByLabelText('Minuta'), '30')
      await user.type(screen.getByLabelText('Sekundi'), '0')
      await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/rezultati')
      await send(user)

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      const sent = must(writes()[0], 'the request')

      expect(sent.path).toBe('/api/results')
      expect(sent.init?.method).toBe('POST')

      const body = bodyOf(sent)

      expect(Object.hasOwn(body, 'raceId')).toBe(true)
      expect(typeof body.raceId).toBe('number')

      /* AND NOT ONE WORD ABOUT THE RACE BESIDE ITS NUMBER, the same rule the door from the
         event page keeps (`resultToTheServer.test.tsx`, „a run reported from the event it
         was run at"): `ResultWriteApi.fromTheCalendar` refuses `theRaceIsNamedTwice` when
         any of these five arrives beside a `raceId`, and City and Country are filled in
         above precisely because this road, unlike the door from the event page, still asks
         the member for them. */
      for (const beside of ['raceName', 'raceKind', 'placeId', 'city', 'country', 'day', 'date']) {
        expect(Object.hasOwn(body, beside), `${beside} travelled beside a raceId`).toBe(false)
      }

      expect(typeof body.distanceKm).toBe('number')
      expect(body.link).toBe('https://primer.rs/rezultati')
    },
    SLOW,
  )
})

describe('a run reported from the event it was run at', () => {
  /** An event with a race that has been run, read off the files rather than named. */
  const reportable = () => {
    /* NEVER THE FIRST RACE OF THE FILE, and that is a fault this case had until a mutation
       found it on 28.09.2026: `allRaces.find(...)` answered race 1, which is also
       `races[0]`, so swapping the one the screen sends for `races[0]` changed nothing and
       the case went on passing over a screen that filed every run against one race.

       The event has to have been run as well, because the screen refuses a form on an event
       that has not (`NotRunYet`), and that is a second thing the calendar decides rather
       than this case. */
    const race = must(
      allRaces.find(
        (one) =>
          one.id !== allRaces[0]?.id &&
          one.date <= '2026-08-23' &&
          (allEvents.find((held) => held.id === one.eventId)?.date ?? '9999') <= '2026-08-23',
      ),
      'a race that has been run and is not the first of the file',
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

  it(
    'is free to send again after a refusal, not left refusing every press after the first',
    async () => {
      const user = setupUser()
      const { race, event } = reportable()

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

      await screen.findByText(/više ne stoji u kalendaru/, undefined, SOON)

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      /* THE SAME GUARD ON THE SECOND DOOR, RESET ON A REFUSAL HERE TOO. `outstanding.current`
         is set back to `false` in `ReportResult.tsx`'s `send` as soon as an answer comes
         back, whichever answer it was, and written out as its own case for the same reason
         the in-flight guard above is its own case: two screens hold two copies of the same
         ref, and a mutation that stops clearing one of them must fail on that screen's own
         case rather than on neither. */
      await send(user, 'Pošalji rezultat')

      await waitFor(() => {
        expect(writes()).toHaveLength(2)
      }, SOON)
    },
    SLOW,
  )
})

describe('a counted result the member asks to have put right', () => {
  /** The member whose counted results the file really holds. */
  const HIS = '000001'

  /**
   * A server that holds back `GET /api/results` until the case lets it go, and takes every
   * write. The answer is the served file itself, so what arrives is what a real visit reads.
   */
  function holdingTheResults(): () => void {
    let release = () => {}
    const held = new Promise<void>((done) => {
      release = done
    })

    server = serverThat((path, init) => {
      if (path.startsWith('/api/results') && init?.method !== undefined) {
        return did()
      }

      return path.replace(/\?.*$/, '') === '/api/results'
        ? held.then(
            () =>
              new Response(JSON.stringify(countedResults), {
                status: 200,
                headers: { 'content-type': 'application/json' },
              }),
          )
        : null
    })

    return release
  }

  /**
   * OPENED BY ITS ADDRESS, THE CORRECTION WAITS FOR THE RESULT IT CORRECTS.
   *
   * <p>`FormRenderer` takes what its fields start with once, when it is mounted, and this
   * screen learns WHICH counted result it is correcting only when `/api/results` answers. From
   * the list that file is already in hand; opened by the address, the form used to mount before
   * the answer and stay empty, and a press then complained about every box the record it was
   * correcting already held (measured 28.09.2026, PENDING stavka 332). So the form is not drawn
   * until the answer is here, which is how `EditTeam.tsx` waits for its team.
   *
   * <p><b>Two sources, separated:</b> the result corrected is his LAST counted one in the file,
   * never the first, and a new form holds none of its numbers, so boxes filled from the wrong
   * record, or from nothing, fail here.
   */
  it(
    'fills the correction from the result even when the address is opened cold',
    async () => {
      const user = setupUser()
      const his = countedResults.filter((one) => one.memberNumber === HIS)
      const target = must(his.at(-1), 'a counted result of his')

      expect(his.length, 'he has more than one counted result to tell apart').toBeGreaterThan(1)

      const release = holdingTheResults()

      renderAt(`/sr/rezultat/novi?ispravka=${String(target.id)}`, 'competitor', HIS, undefined, '2026-08-23')

      /* While the answer is on its way the page says it is waiting, and there is no form: a
         form drawn now would be the form for a NEW result, with nothing of his in it. */
      expect(await screen.findByText('Učitavanje', undefined, SOON)).toBeInTheDocument()
      expect(screen.queryByLabelText(/^Naziv trke/)).toBeNull()

      release()

      expect(
        await screen.findByText(/Menjaš rezultat koji je već uračunat/, undefined, SOON),
      ).toBeVisible()
      expect(screen.getByLabelText(/^Naziv trke/)).toHaveValue(target.raceName)
      expect(screen.getByLabelText(/Dužina/)).toHaveValue(String(target.distanceKm))

      await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/nov-dokaz')
      await send(user)

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      const sent = must(writes()[0], 'the request')

      expect(sent.path).toBe(`/api/results/${String(target.id)}`)
      expect(bodyOf(sent).seconds).toBe(target.seconds)
    },
    SLOW,
  )

  /* AND ONLY THAT ROAD WAITS. A new result has nothing to be filled from, and the file of
     counted results is the largest the portal serves, so a form for a new result that waited
     for it would make every member wait for nothing. */
  it(
    'draws the form for a new result without waiting for the counted ones',
    async () => {
      holdingTheResults()

      renderAt('/sr/rezultat/novi', 'competitor', HIS, undefined, '2026-08-23')

      expect(await screen.findByLabelText(/^Naziv trke/, undefined, SOON)).toBeInTheDocument()
      expect(screen.queryByText(/Menjaš rezultat koji je već uračunat/)).toBeNull()
    },
    SLOW,
  )

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

/**
 * A RUN AS `GET /api/me/result-submissions` ANSWERS IT TO THE MEMBER IT BELONGS TO, sent back with
 * a reason unless a case says otherwise. What a case does not name is the shape the route answers
 * (`data/servedShape.test.ts` holds it against the served file).
 */
function aRun(id: number, over: Partial<SentRun> = {}): SentRun {
  return {
    id,
    state: 'rejected',
    raceId: null,
    raceName: `Trka ${String(id)}`,
    raceDate: '2026-05-10',
    raceKind: 'length',
    city: 'Niš',
    country: 'RS',
    distanceKm: 21.1,
    ascentM: 540,
    descentM: 540,
    seconds: 6730,
    link: 'https://primer.rs/rezultati',
    comment: '',
    reason: 'Link ne otvara rezultate.',
    amendsResultId: null,
    ...over,
  }
}

/**
 * THE RESULT ROUTES, AND THE ASKER'S OWN RUNS ANSWERED AS THE CASE NAMES THEM, so `?ponovo=` opens
 * what the server would answer this member and not what the disc holds for every member.
 */
function listeningWith(mine: SentRun[]) {
  server = serverThat((path, init) => {
    if (path.startsWith('/api/results') && init?.method !== undefined) {
      return did()
    }

    return path.replace(/\?.*$/, '') === '/api/me/result-submissions'
      ? new Response(JSON.stringify(mine), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      : null
  })
}

describe('a run sent back, sent again', () => {
  /* THROUGH THE ROUTES THAT ALREADY EXIST, the owner's choice of 10.10.2026 among the outcomes
     offered, in the record's wording: „sada ponovno slanje odbijene prijave preko postojećih
     ruta". So a run sent back goes again as a run, by the road its race decides, and a correction
     sent back goes again as a correction of the counted result it named.

     Until R2 of the results flows the case here said that a run still waiting was changed in the
     browser alone and that no request went out, because nothing served a member his own runs.
     The server serves them since then, a run still waiting has no control at all (the same choice:
     „„Izmeni" i „Obriši" na prijavi koja čeka se skrivaju do zasebnog posla"), and the address
     does not open one either (`newResult.test.tsx`, „does not open a run that is still
     waiting"). */

  it(
    'goes again as the race of the calendar it was run in, and not one word about the race beside it',
    async () => {
      const user = setupUser()
      /* Two races of a length that have been run, neither the first of the file, and neither
         numbered like a run below. The run opened names the first and the run beside it the
         second, so a body built out of the run's own number, out of the first run on the list or
         out of the first race of the file fails here. */
      const [race, elsewhere] = allRaces.filter(
        (one) =>
          one.id !== allRaces[0]?.id &&
          one.id !== 90 &&
          one.id !== 91 &&
          one.kind === 'length' &&
          one.date <= '2026-08-23',
      )
      const ran = must(race, 'a race of a length that has been run')
      const other = must(elsewhere, 'a second one')

      /* NEVER THE FIRST ON THE LIST: the run opened is the second the server answers. */
      listeningWith([
        aRun(91, { state: 'waiting', reason: null, raceId: other.id, raceName: other.name }),
        aRun(90, {
          raceId: ran.id,
          raceName: ran.name,
          raceDate: ran.date,
          distanceKm: ran.distanceKm,
          ascentM: ran.ascentM,
          descentM: ran.descentM,
        }),
      ])
      renderAt('/sr/rezultat/novi?ponovo=90', 'competitor', ME, undefined, '2026-08-23')

      await screen.findByText(/Ispravljaš rezultat koji je odbijen/, undefined, SOON)

      await user.clear(screen.getByLabelText('Minuta'))
      await user.type(screen.getByLabelText('Minuta'), '49')
      await user.clear(screen.getByLabelText(/Link/))
      await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/ispravno')
      await send(user)

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      const sent = must(writes()[0], 'the request')

      expect(sent.path).toBe('/api/results')
      expect(sent.init?.method).toBe('POST')

      const body = bodyOf(sent)

      expect(body.raceId).toBe(ran.id)

      /* AND NOT ONE WORD ABOUT THE RACE BESIDE ITS NUMBER, which `ResultWriteApi.fromTheCalendar`
         refuses as `theRaceIsNamedTwice`: the form for a run sent back asks the kind and the town,
         and a body built out of every box would carry both. */
      for (const beside of ['raceName', 'raceKind', 'placeId', 'city', 'country', 'day', 'date']) {
        expect(Object.hasOwn(body, beside), `${beside} travelled beside a raceId`).toBe(false)
      }

      /* What the member changed, and what he left: the hour and the ten seconds the run already
         had, and the forty nine minutes he typed. */
      expect(body.seconds).toBe(3600 + 49 * 60 + 10)
      expect(body.link).toBe('https://primer.rs/ispravno')
      expect(Object.hasOwn(body, 'points')).toBe(false)

      /* And he is told it went AGAIN, the one thing the confirmation cannot work out afterwards
         (`NewResult.tsx`, `done`). */
      expect(
        await screen.findByText('Rezultat je ponovo poslat na proveru.', undefined, SOON),
      ).toBeVisible()
    },
    SLOW,
  )

  it(
    'goes again as the race it described where the calendar does not hold one, whatever the box says',
    async () => {
      const user = setupUser()

      /* The run opened is the second on the list, and every word of the race differs from the
         run beside it and from what a fresh form starts on („Dužinska", no town, today's day), so
         a body that read any of them from the wrong place fails here. */
      listeningWith([
        aRun(81, {
          raceName: 'Neka druga trka',
          raceDate: '2026-04-04',
          city: 'Banja Luka',
          country: 'BA',
        }),
        aRun(80, {
          raceName: 'Trka oko Palićkog jezera',
          raceDate: '2026-08-01',
          raceKind: 'free',
          city: 'Subotica',
          country: 'RS',
          distanceKm: 15.5,
          ascentM: 40,
          descentM: 35,
          seconds: 4980,
          comment: 'Startni broj 7',
        }),
      ])
      renderAt('/sr/rezultat/novi?ponovo=80', 'competitor', ME, undefined, '2026-08-23')

      await screen.findByText(/Ispravljaš rezultat koji je odbijen/, undefined, SOON)

      /* THE NAME FORCED PAST ITS LOCK, which is the half beneath it: whatever reaches the form, the
         run goes as the race it was sent with (owner, 27.08.2026: „sve osim trke"). The lock is
         `ownResult.test.tsx`'s. */
      fireEvent.change(screen.getByLabelText(/^Naziv trke/), {
        target: { value: 'Sasvim druga trka' },
      })
      await user.clear(screen.getByLabelText(/Link/))
      await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/ispravno')
      await send(user)

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      const sent = must(writes()[0], 'the request')

      expect(sent.path).toBe('/api/results')
      expect(sent.init?.method).toBe('POST')
      /* The whole body, so a word about the race that is not the run's own, a `raceId`, a
         `placeId` or a number the screen worked out has nowhere to hide. */
      expect(bodyOf(sent)).toEqual({
        raceName: 'Trka oko Palićkog jezera',
        day: '2026-08-01',
        raceKind: 'free',
        city: 'Subotica',
        country: 'RS',
        distanceKm: 15.5,
        ascentM: 40,
        descentM: 35,
        seconds: 4980,
        link: 'https://primer.rs/ispravno',
        comment: 'Startni broj 7',
      })
    },
    SLOW,
  )

  it(
    'goes to the address of the result it corrected, and never to its own number',
    async () => {
      const user = setupUser()
      const HIS = '000001'
      const his = countedResults.filter((one) => one.memberNumber === HIS)
      const corrected = must(his.at(-1), 'a counted result of his that is not his first')
      const other = must(his[0], 'his first counted result')

      expect(his.length, 'he has more than one counted result to tell apart').toBeGreaterThan(1)

      /* THREE NUMBERS THAT MUST NOT BE MISTAKEN FOR ONE ANOTHER: the run sent back (77), the
         counted result it corrected, and the counted result a run beside it corrects. A PUT to
         any but the second fails here. */
      listeningWith([
        aRun(76, {
          state: 'waiting',
          reason: null,
          raceName: other.raceName,
          amendsResultId: other.id,
        }),
        aRun(77, {
          raceName: corrected.raceName,
          raceDate: corrected.date,
          seconds: corrected.seconds,
          amendsResultId: corrected.id,
        }),
      ])
      renderAt('/sr/rezultat/novi?ponovo=77', 'competitor', HIS, undefined, '2026-08-23')

      await screen.findByText(/Ispravljaš rezultat koji je odbijen/, undefined, SOON)
      await user.clear(screen.getByLabelText(/Link/))
      await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/nov-dokaz')
      await send(user)

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      const sent = must(writes()[0], 'the request')

      expect(corrected.id, 'the run and the result it corrects share a number').not.toBe(77)
      expect(sent.path).toBe(`/api/results/${String(corrected.id)}`)
      expect(sent.init?.method).toBe('PUT')

      const body = bodyOf(sent)

      /* „Menja se sve osim trke" (owner, 27.08.2026), and the record on the server declares no
         field for a race on a correction at all. */
      for (const beside of ['raceId', 'raceName', 'raceKind', 'day', 'date', 'city', 'country']) {
        expect(Object.hasOwn(body, beside), `${beside} travelled on a correction`).toBe(false)
      }

      expect(body.link).toBe('https://primer.rs/nov-dokaz')
      expect(body.seconds).toBe(corrected.seconds)
    },
    SLOW,
  )

  /**
   * AND NO SECOND CORRECTION OF A RESULT LEAVES WHILE ONE WAITS, from the address of a correction
   * sent back.
   *
   * <p>The case above is the other half, on the same shape of list: there the correction that waits
   * names ANOTHER result and the one sent back goes to its own. Here the correction that waits names
   * the same result, and the address opens the form for a NEW run, as it does for an address that
   * names no run at all, so what can leave is a run to `POST /api/results` and never a `PUT` on the
   * result. The review of PR 521 measured on 10.10.2026 the opposite: the same address sent one
   * `PUT` on the result while another correction of it waited.
   *
   * <p>The correction that waits is neither the first row nor the last, and a correction of another
   * result waits in front of it, so a reading of the first row or of „some correction waits" cannot
   * stand in for the right one.
   */
  it(
    'sends a run and never a second correction of the result, from the address of a correction sent back while one waits',
    async () => {
      const user = setupUser()
      const HIS = '000001'
      const his = countedResults.filter((one) => one.memberNumber === HIS)
      const corrected = must(his.at(-1), 'a counted result of his that is not his first')
      const other = must(his[0], 'his first counted result')

      expect(his.length, 'he has more than one counted result to tell apart').toBeGreaterThan(1)

      listeningWith([
        aRun(79, { state: 'waiting', reason: null, raceName: other.raceName, amendsResultId: other.id }),
        aRun(78, {
          state: 'waiting',
          reason: null,
          raceName: corrected.raceName,
          amendsResultId: corrected.id,
        }),
        aRun(77, {
          raceName: corrected.raceName,
          raceDate: corrected.date,
          seconds: corrected.seconds,
          amendsResultId: corrected.id,
        }),
        aRun(76),
      ])
      renderAt('/sr/rezultat/novi?ponovo=77', 'competitor', HIS, undefined, '2026-08-23')

      await screen.findByLabelText(/^Naziv trke/, undefined, SOON)

      /* The form for a new run, which is what is typed into below: the correction's would be
         locked on the race and would not take it. */
      expect(
        screen.queryByText(/Ispravljaš rezultat koji je odbijen/),
        'the form for the correction sent back is open while another correction of its result waits',
      ).toBeNull()

      await describeARace(user)
      await send(user)

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      const sent = must(writes()[0], 'the request')

      expect(sent.path).toBe('/api/results')
      expect(sent.init?.method).toBe('POST')
      expect(bodyOf(sent).raceName).toBe('Trka kroz šumu')
      expect(writes().map((one) => one.path)).not.toContain(`/api/results/${String(corrected.id)}`)
    },
    SLOW,
  )
})

describe('a counted result the member takes back', () => {
  const COUNTED = '/sr/moji-rezultati'

  /**
   * A ROW OF THE COUNTED TABLE THAT IS NEVER THE FIRST ONE.
   *
   * <p>Measured 28.09.2026: with the first row, swapping the result the screen deletes for
   * `counted[0]` changes nothing, so the case passed over a screen that would delete the
   * wrong result for every row a member pressed. The second row is the cheapest postavka in
   * which the two differ.
   */
  const secondRow = async () => {
    const table = within(await screen.findByRole('table', { name: 'Uračunato' }, SOON))
    const rows = table.getAllByRole('row').slice(1)

    expect(rows.length, 'one row cannot tell a row from the first row').toBeGreaterThan(1)

    return within(must(rows[1], 'the second counted result'))
  }

  /** Which result that row is, read off the address its own „Izmeni rezultat" link carries -
   *  the same trick the correction cases use, and for the same reason: nothing else on the
   *  row names the id, and taking it from the file would be a second source. */
  const resultOf = (row: ReturnType<typeof within>) =>
    must(
      /ispravka=(\d+)/.exec(row.getByRole('link', { name: /^Izmeni rezultat/ }).getAttribute('href') ?? '')?.[1],
      'the row does not name a result',
    )

  const howManyCounted = async () =>
    within(await screen.findByRole('table', { name: 'Uračunato' })).getAllByRole('row').length - 1

  it(
    'really goes, as a DELETE on the address of that result',
    async () => {
      const user = setupUser()

      listening()
      renderAt(COUNTED, 'competitor', '000001', undefined, null)

      const before = await howManyCounted()
      const row = await secondRow()
      /* WHICH result the press is about, read off the row itself. The address the screen
         then asks has to name THAT one and not simply some result of this member's. */
      const pressed = resultOf(row)

      await user.click(row.getByRole('button', { name: /^Obriši: / }))
      await user.click(await screen.findByRole('button', { name: /^Potvrdi brisanje/ }, SOON))

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      const sent = must(writes()[0], 'the request')

      expect(sent.init?.method).toBe('DELETE')
      expect(sent.path).toBe(`/api/results/${pressed}`)

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
      const row = await secondRow()

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

  it(
    'can be taken back again after a refusal, with the question asked afresh',
    async () => {
      /* THE SAME GUARD, FOR THE QUESTION AS IT IS AFTER 02.10.2026: a refusal closes it (PDL, „Odbijanje
         zatvara pitanje kao i uspeh"), so the member asks again - „Obriši" and then „Potvrdi
         brisanje" on the same row - and the second press must go out. `MyResults.tsx` clears
         `outstanding.current` inside `takeBack`'s `.then()` regardless of what the server said, and a
         version that cleared it only on success would leave the member with a question that can be
         asked and a button that does nothing, and nothing on screen saying why. */
      const user = setupUser()

      listening(() => refused('theFormIsNotComplete'))
      renderAt(COUNTED, 'competitor', '000001', undefined, null)

      const row = await secondRow()

      await user.click(row.getByRole('button', { name: /^Obriši: / }))
      await user.click(await screen.findByRole('button', { name: /^Potvrdi brisanje/ }, SOON))

      await screen.findByText(/Proveri dužinu, uspon, spust i vreme/, undefined, SOON)

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      await user.click(row.getByRole('button', { name: /^Obriši: / }))
      await user.click(await screen.findByRole('button', { name: /^Potvrdi brisanje/ }, SOON))

      await waitFor(() => {
        expect(writes()).toHaveLength(2)
      }, SOON)
    },
    SLOW,
  )
})

describe('a refusal that says the counted result is not there', () => {
  /* THE CLASS THE REVIEW OF T5 NAMED ON 10.10.2026, carried to R2 by the coordinator's scope of
     the same day: a list read once per visit is read AGAIN when a refusal says it is stale, and not
     only after the screen's own success. The answer that says so is an empty 404 from the address
     of a counted result (`resultWrites.ts`, `saysTheResultIsGone`): taken back in another tab or by
     another hand, and a correction of it with it. A 403, a 5xx and an answer that never came say
     nothing about the result, and move nothing.

     What is read here is what crosses the wire, which for a list read again is one more GET: the
     two screens bump the number that makes a list already drawn ask again
     (`HowToRead.revision`), and `resultWrites.test.ts` holds the caches those GETs then miss. */

  const HIS = '000001'

  /** How many times each of the two lists has been asked for so far. A read carries no `init`
   *  (`data/client.ts`, `loadResource`), which is what tells it from a write. */
  function reads(): { counted: number; sent: number } {
    const asked = (server?.asked ?? [])
      .filter((one) => one.init === undefined)
      .map((one) => one.path.replace(/\?.*$/, ''))

    return {
      counted: asked.filter((one) => one === '/api/results').length,
      sent: asked.filter((one) => one === '/api/me/result-submissions').length,
    }
  }

  /** Takes the second counted row back, as a member does, and waits for what the screen says. */
  async function takeTheSecondBack(user: ReturnType<typeof setupUser>, said: RegExp) {
    const table = within(await screen.findByRole('table', { name: 'Uračunato' }, SOON))
    const row = within(must(table.getAllByRole('row')[2], 'the second counted result'))
    const before = reads()

    await user.click(row.getByRole('button', { name: /^Obriši: / }))
    await user.click(await screen.findByRole('button', { name: /^Potvrdi brisanje/ }, SOON))

    expect(await screen.findByText(said, undefined, SOON)).toBeVisible()

    return before
  }

  /** Sends a correction of the first counted row, as a member does, and waits for what the screen
   *  says. */
  async function correctTheFirst(
    user: ReturnType<typeof setupUser>,
    router: { state: { location: { search: string } } },
    said: RegExp,
  ) {
    await openTheCorrection(user, router)

    const before = reads()

    await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/nov-dokaz')
    await send(user)

    expect(await screen.findByText(said, undefined, SOON)).toBeVisible()

    return before
  }

  it(
    'reads both lists again when taking a result back is answered that it is not there',
    async () => {
      const user = setupUser()

      listening(() => answeredWith(404))
      renderAt('/sr/moji-rezultati', 'competitor', HIS, undefined, null)

      const before = await takeTheSecondBack(user, /Server je odgovorio brojem 404/)

      /* Read the moment the sentence is there, because the sentence and the asking again are one
         answer: what the screen does after that is not this case's. The same moment is when the
         cases below find nothing asked. */
      expect(before.counted, 'the counted list was never read, so this measures nothing').toBeGreaterThan(0)
      expect(reads()).toEqual({ counted: before.counted + 1, sent: before.sent + 1 })
    },
    SLOW,
  )

  it(
    'reads both lists again when a correction is answered that its result is not there',
    async () => {
      const user = setupUser()

      listening(() => answeredWith(404))
      const { router } = renderAt('/sr/moji-rezultati', 'competitor', HIS, undefined, '2026-08-23')

      const before = await correctTheFirst(user, router, /Server je odgovorio brojem 404/)

      expect(before.sent, 'the list of what was sent was never read, so this measures nothing').toBeGreaterThan(0)
      expect(reads()).toEqual({ counted: before.counted + 1, sent: before.sent + 1 })
    },
    SLOW,
  )

  const SAYING_NOTHING_ABOUT_THE_RESULT: [string, () => Response | Promise<Response>, RegExp][] = [
    ['a 403', () => answeredWith(403), /nije uspeo da dokaže serveru/],
    ['a 500', () => answeredWith(500), /Server je odgovorio brojem 500/],
    [
      'no answer at all',
      () => Promise.reject(new TypeError('Failed to fetch')),
      /nije uspeo da dođe do servera/,
    ],
  ]

  it.each(SAYING_NOTHING_ABOUT_THE_RESULT)(
    'reads neither list again when taking a result back is answered with %s',
    async (_what, answering, said) => {
      const user = setupUser()

      listening(answering)
      renderAt('/sr/moji-rezultati', 'competitor', HIS, undefined, null)

      const before = await takeTheSecondBack(user, said)

      expect(before.counted, 'the counted list was never read, so this measures nothing').toBeGreaterThan(0)
      expect(reads()).toEqual(before)
    },
    SLOW,
  )

  it.each(SAYING_NOTHING_ABOUT_THE_RESULT)(
    'reads neither list again when a correction is answered with %s',
    async (_what, answering, said) => {
      const user = setupUser()

      listening(answering)
      const { router } = renderAt('/sr/moji-rezultati', 'competitor', HIS, undefined, '2026-08-23')

      const before = await correctTheFirst(user, router, said)

      expect(before.sent, 'the list of what was sent was never read, so this measures nothing').toBeGreaterThan(0)
      expect(reads()).toEqual(before)
    },
    SLOW,
  )

  /**
   * AND AFTER A RESULT REALLY IS TAKEN BACK, ONLY THE LIST OF WHAT WAS SENT IS READ AGAIN.
   *
   * <p>A correction of that result, waiting or sent back, went with it on the server, so the list
   * that showed it is stale. The counted list is not read again: the row is taken off by the
   * overlay the moment the route agrees (`MyResults.tsx`, `takeBack`), and the file of counted
   * results is the largest the portal serves. Two numbers on the screen and not one, and this is
   * the case that holds them apart in both directions.
   */
  it(
    'reads the list of what was sent again once a result is taken back, and not the counted one',
    async () => {
      const user = setupUser()

      listening()
      renderAt('/sr/moji-rezultati', 'competitor', HIS, undefined, null)

      const table = within(await screen.findByRole('table', { name: 'Uračunato' }, SOON))
      const row = within(must(table.getAllByRole('row')[2], 'the second counted result'))
      const before = reads()

      await user.click(row.getByRole('button', { name: /^Obriši: / }))
      await user.click(await screen.findByRole('button', { name: /^Potvrdi brisanje/ }, SOON))

      await waitFor(() => {
        expect(reads().sent).toBe(before.sent + 1)
      }, SOON)

      expect(reads().counted).toBe(before.counted)
    },
    SLOW,
  )
})
