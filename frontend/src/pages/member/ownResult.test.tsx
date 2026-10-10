import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SLOW } from '../../test/slow'
import type { Result, SentRun } from '../../data/types'
import { fireEvent, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resultsOf } from '../../data/derive'
import { fieldDate } from '../../forms/dateField'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { useSession } from '../../session/useSession'
import { did, serverThat, type Asked } from '../../test/serverAnswers'

/**
 * What a member may do with a result of their own after sending it.
 *
 * Owner, 27.08.2026, answering six questions at once: a member may change it and
 * may delete it („član ga ili briše (ima pravo na to, iako je verifikovan) ili
 * menja i dostavlja dokaz za tu izmenu"); everything may be changed except which
 * race it is („sve osim trke"), so whoever picked the wrong race deletes it and
 * enters another.
 *
 * <p><b>Since R2 of the results flows (10.10.2026) the runs a member has sent are the
 * server's</b>, read off `GET /api/me/result-submissions`, and what he may do with one is the
 * owner's choice of that day among the outcomes offered, in the record's wording: „sada ponovno
 * slanje odbijene prijave preko postojećih ruta, a „Izmeni" i „Obriši" na prijavi koja čeka se
 * skrivaju do zasebnog posla", and „posle ponovnog slanja na spisku stoje oba reda". So a run sent
 * back has one control and a run still waiting has none. A COUNTED result keeps both of its own:
 * it is taken back with a `DELETE` and corrected with a `PUT` on the address of the result.
 *
 * <p>What crosses the wire on each of those roads is `resultToTheServer.test.tsx`'s; this file is
 * what the screens draw and what they let a member reach.
 */

const ME = '000007'
/** The counted results as the portal reads them, straight out of the file the
 *  screens are served. Read rather than written down because a result's number
 *  is the file's to choose, and a case about whose result it is has to name one
 *  that really belongs to somebody else. */
const countedResults: Result[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/results.json'), 'utf-8'),
)

const MINE = '/sr/moji-rezultati'

/**
 * A WAIT SHORTER THAN THE CASE'S OWN CLOCK, for the cases about the list of what was sent and the
 * form it opens.
 *
 * <p>Testing Library waits `SLOW` (`test/setup.ts`), so a case whose clock is `SLOW` too, or shorter,
 * dies on the clock when a screen never draws what it waits for, and the failure names nothing.
 * Measured on this file on 10.10.2026: a mutation that kept HIS runs on HER screen was reported as a
 * case that ran out of time, which is „nije mereno" and not a catch. Half the clock, the shape
 * `pages/admin/saveWhileSaving.test.tsx` keeps for the whole of its file.
 */
const SOON = { timeout: SLOW / 2 }

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

/** What the route answers, as a response. */
function served(runs: SentRun[]): Response {
  return new Response(JSON.stringify(runs), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

let server: { asked: Asked[]; stop: () => void } | null = null

afterEach(() => {
  server?.stop()
  server = null
})

/**
 * THE SERVER THESE CASES TALK TO: every write to the result routes agreed to, and the asker's own
 * runs answered as the case names them. Where a case names none (`null`), they come off the disc
 * like every other resource (`test/mock/me/result-submissions.json`).
 *
 * @param mine read on every request, so a case that changes what it returns changes what the next
 *             read gets
 */
function answering(mine: () => SentRun[] | null): void {
  server = serverThat((path, init) => {
    if (path.startsWith('/api/results') && init?.method !== undefined) {
      return did()
    }

    const runs = path.replace(/\?.*$/, '') === '/api/me/result-submissions' ? mine() : null

    return runs === null ? null : served(runs)
  })
}

/** Every write this case made to the result routes, with what it carried. */
function writes(): { path: string; method: string; body: Record<string, unknown> }[] {
  return (server?.asked ?? [])
    .filter((one) => one.path.startsWith('/api/results') && one.init?.method !== undefined)
    .map((one) => {
      const said: unknown = JSON.parse(String(one.init?.body ?? '{}'))

      return {
        path: one.path,
        method: String(one.init?.method),
        body: typeof said === 'object' && said !== null ? { ...said } : {},
      }
    })
}

/** The runs the list of what was sent draws, in the order it draws them. */
async function sentRows(): Promise<HTMLElement[]> {
  return within(await screen.findByRole('region', { name: /^Poslato na proveru/ }, SOON)).queryAllByRole(
    'listitem',
  )
}

/** The name of the race a row of that list is about. */
function nameOf(row: HTMLElement): string {
  return within(row).getAllByRole('strong')[0]?.textContent ?? ''
}

describe('a run of one’s own that is still waiting', () => {
  it('offers no control at all, until a route changes or withdraws one', async () => {
    /* The owner's choice of 10.10.2026 among the outcomes offered, in the record's wording:
       „„Izmeni" i „Obriši" na prijavi koja čeka se skrivaju do zasebnog posla". No route changes
       or withdraws a submission yet. Until R2 of the results flows both controls stood here and
       wrote into the browser alone, so a moderator went on deciding what the member thought he
       had changed or taken back.

       A run sent back stands beside it, so this is not a list that draws no control for anybody:
       that one offers its one, and the waiting one offers none. */
    answering(() => [
      aRun(41, { state: 'waiting', reason: null, raceName: 'Probna trka' }),
      aRun(40, { raceName: 'Odbijena trka' }),
    ])
    renderAt(MINE, 'competitor', ME, undefined, null)

    const [waiting, sentBack] = await sentRows()
    const row = within(must(waiting, 'the run that waits'))

    expect(row.getByText('Probna trka')).toBeVisible()
    expect(row.getByText('Čeka proveru')).toBeVisible()
    expect(row.queryByRole('link')).toBeNull()
    expect(row.queryByRole('button')).toBeNull()
    expect(
      within(must(sentBack, 'the run sent back')).getByRole('link', {
        name: 'Ispravi i pošalji ponovo: Odbijena trka',
      }),
    ).toBeVisible()
  }, SLOW)

  it('says the number is BTL points, worked out from the figures the server answers', async () => {
    /* Two different numbers wear the word „bodovi" on this portal, and this row shows the one that
       is not it: what a single result is worth is BTL points, while „bodovi" is what a member has
       in a standing. The screen read `units.points` („{value} bodova") until 05.09.2026 and
       nothing here noticed the difference (review, 05.09.2026).

       And the number is what the figures the route answers work out to: 21,1 km with 540 up and
       540 down in 1:52:10 is 23,55 by the formula in the rulebook. Whether a number belongs on
       this row at all before a moderator decides is a question still before the owner (PENDING,
       29.09.2026), so the row keeps it as it was. */
    answering(() => [aRun(41, { state: 'waiting', reason: null, raceName: 'Probna trka' })])
    renderAt(MINE, 'competitor', ME, undefined, null)

    const row = within(must((await sentRows())[0], 'the run that waits'))

    expect(row.getByText(/23,55 BTL poena$/)).toBeVisible()
    expect(row.queryByText(/bodova$/)).toBeNull()
  }, SLOW)

  it('carries the caveat about the count while it waits, and not once it has been sent back', async () => {
    /* The one screen that still announces a number before anybody has decided, and so the one that
       still carries the caveat (PDL, 30.08.2026, point 8): after verification it may be a
       different number. Until R2 of the results flows only the first half could be measured
       here, because the list held a single waiting run and „one" was the answer with the condition
       and without it (review, 31.08.2026). The server answers runs sent back too, so both halves
       are on one list: three runs, the waiting one in the middle. */
    answering(() => [
      aRun(43, { raceName: 'Prva odbijena' }),
      aRun(42, { state: 'waiting', reason: null, raceName: 'Ona koja čeka' }),
      aRun(40, { raceName: 'Druga odbijena' }),
    ])
    renderAt(MINE, 'competitor', ME, undefined, null)

    const rows = await sentRows()

    expect(screen.getAllByText(/Račun nije konačan/)).toHaveLength(1)
    expect(within(must(rows[1], 'the run that waits')).getByText(/Račun nije konačan/)).toBeVisible()
  }, SLOW)
})

/* „ASKS TWICE BEFORE IT IS GONE" AND „IS LEFT ALONE WHEN THE QUESTION IS ANSWERED NO" stood here
   until R2 of the results flows, both about taking back a run that waits. A waiting run has no
   „Obriši" since then (the owner's choice of 10.10.2026, quoted over the first case of this file),
   so there is no question to ask about it. Asking twice before something is gone is still held,
   on the counted result's own „Obriši", by `resultToTheServer.test.tsx` („a counted result the
   member takes back"). */

describe('a run a moderator sent back', () => {
  it('says why in the moderator’s own words, and offers one thing: sending it again', async () => {
    /* A refusal is not the end of a result: the member is told why, corrects it and sends the
       same race again (owner, 06.08.2026), through the routes that already exist (the owner's
       choice of 10.10.2026). Not taken back from here, which is derived on 10.10.2026 and was said
       to the owner in one sentence: a refused run stays with its state and its reason (his choice of
       06.09.2026), and a row in verification stays for good (ADL).

       The run is the SECOND the server answers and its number is nobody else's, so a link built
       out of the first run, or out of anything but this run's own number, fails here. */
    answering(() => [
      aRun(41, { state: 'waiting', reason: null, raceName: 'Ona koja čeka' }),
      aRun(40, {
        raceName: 'Trka oko Palićkog jezera',
        reason: 'Na stranici rezultata nema tvog imena.',
      }),
    ])
    renderAt(MINE, 'competitor', ME, undefined, null)

    const [waiting, sentBack] = await sentRows()
    const row = within(must(sentBack, 'the run sent back'))

    expect(row.getByText('Odbijeno')).toBeVisible()
    expect(row.getByText('Na stranici rezultata nema tvog imena.')).toBeVisible()
    expect(
      row.getByRole('link', { name: 'Ispravi i pošalji ponovo: Trka oko Palićkog jezera' }),
    ).toHaveAttribute('href', '/sr/rezultat/novi?ponovo=40')
    expect(row.queryByRole('button')).toBeNull()
    /* And the reason is that run's own and not something every row carries. */
    expect(
      within(must(waiting, 'the run that waits')).queryByText('Na stranici rezultata nema tvog imena.'),
    ).toBeNull()
  }, SLOW)

  it('opens the form on the run, its race held and its day open, where the calendar does not hold the race', async () => {
    /* „Sve osim trke" (owner, 27.08.2026): sent again, a run keeps the race it named. A race the
       calendar does not hold is the member's to describe in full, so the day and every figure stay
       his to change; the case below is the other side. Reachable and refused rather than switched
       off, which is the portal's way of locking anything (PDL: „Odbijeno, ne ugašeno"). What holds
       beneath the lock, when the box is made to say another race, is read off the request in
       `resultToTheServer.test.tsx`. */
    const user = setupUser()

    answering(() => [
      aRun(40, {
        raceName: 'Trka oko Palićkog jezera',
        raceDate: '2026-08-01',
        raceKind: 'free',
        reason: 'Na stranici rezultata nema tvog imena.',
      }),
    ])
    renderAt(MINE, 'competitor', ME, undefined, '2026-08-23')

    await user.click(
      await screen.findByRole('link', { name: 'Ispravi i pošalji ponovo: Trka oko Palićkog jezera' }, SOON),
    )

    expect(
      await screen.findByText(
        'Ispravljaš rezultat koji je odbijen. Razlog je bio: Na stranici rezultata nema tvog imena.',
        undefined,
        SOON,
      ),
    ).toBeVisible()

    const race = screen.getByLabelText(/^Naziv trke/)

    expect(race).toHaveValue('Trka oko Palićkog jezera')
    expect(race).toHaveAttribute('aria-disabled', 'true')
    expect(race).toHaveAttribute('readonly')
    expect(screen.getByLabelText(/^Datum trke/)).toHaveValue(fieldDate('2026-08-01'))

    for (const open of [/^Datum trke/, /^Dužina/, /^Uspon/, /^Spust/, /^Sati/, /^Minuta/, /^Sekundi/]) {
      expect(screen.getByLabelText(open), String(open)).not.toHaveAttribute('readonly')
    }
  }, SLOW)

  /**
   * AND EVERY FIGURE THE RACE FIXES, WHERE THE RACE IS IN THE CALENDAR, in both directions per kind.
   *
   * <p>Derived on 10.10.2026 and accepted by the coordinator before it was written, so not the
   * owner's word (`NewResult.tsx`, `heldByTheRace`): `POST /api/results` with a race takes the figures the race
   * fixes off the race and throws away what came with the request, so a box left open would take
   * a number the server then ignores while telling the member it went in. Exactly the boxes the
   * form locks when the same race is chosen from the list, and what the runner gives stays open:
   * on a race of a length the time, on a race to a limit the length and the climb.
   *
   * <p>The lock reads nothing of the race but that there is one and what kind it is, which is what
   * the route answers on the run itself, so the runs name a race of each kind rather than one picked
   * out of the file: the calendar the disc serves holds no race to a limit.
   */
  it.each([
    ['a length', 'length', 'Polumaraton iz kalendara', [/^Dužina/, /^Uspon/, /^Spust/], [/^Sati/, /^Minuta/, /^Sekundi/]],
    ['a limit', 'time', 'Šestočasovna trka iz kalendara', [/^Sati/, /^Minuta/, /^Sekundi/], [/^Dužina/, /^Uspon/, /^Spust/]],
  ] as const)(
    'holds the day and every figure a race of %s fixes, where the race is in the calendar',
    async (_what, kind, name, held, open) => {
      const user = setupUser()

      answering(() => [
        aRun(50, {
          raceId: 7001,
          raceName: name,
          raceKind: kind,
          seconds: kind === 'time' ? 6 * 3600 : 6730,
        }),
      ])
      renderAt(MINE, 'competitor', ME, undefined, '2026-08-23')

      await user.click(await screen.findByRole('link', { name: `Ispravi i pošalji ponovo: ${name}` }, SOON))
      await screen.findByText(/Ispravljaš rezultat koji je odbijen/, undefined, SOON)

      for (const locked of [/^Naziv trke/, /^Datum trke/, ...held]) {
        expect(screen.getByLabelText(locked), String(locked)).toHaveAttribute('readonly')
      }

      for (const free of open) {
        expect(screen.getByLabelText(free), String(free)).not.toHaveAttribute('readonly')
      }
    },
    SLOW,
  )

  it('stands on the list beside the run it was sent again for, once the server has it', async () => {
    /* The owner's choice of 10.10.2026, in the record's wording: „posle ponovnog slanja na spisku
       stoje oba reda". Sent again, a run is a new run on the server, and the one that was sent
       back stays with its state and its reason. Until R2 of the results flows the browser wrote
       over the run that was sent back, so one row stood where the server holds two.

       The server here answers the second row only once the run has really been sent, so the list
       shows both only if the screen asks again after the write: the list it read on the way in
       held one row. That is the joint between `resultWrites.ts`, which drops the answer it held,
       and this screen, which reads whatever is held when it is drawn. */
    const user = setupUser()
    let held: SentRun[] = [
      aRun(40, { raceName: 'Trka oko Palićkog jezera', reason: 'Na stranici rezultata nema tvog imena.' }),
    ]

    server = serverThat((path, init) => {
      if (path === '/api/results' && init?.method === 'POST') {
        held = [
          aRun(99, {
            state: 'waiting',
            reason: null,
            raceName: 'Trka oko Palićkog jezera',
            link: 'https://primer.rs/ispravno',
          }),
          ...held,
        ]

        return new Response(null, { status: 201 })
      }

      return path.replace(/\?.*$/, '') === '/api/me/result-submissions' ? served(held) : null
    })

    renderAt(MINE, 'competitor', ME, undefined, '2026-08-23')

    expect(await sentRows()).toHaveLength(1)

    await user.click(
      screen.getByRole('link', { name: 'Ispravi i pošalji ponovo: Trka oko Palićkog jezera' }),
    )
    await screen.findByText(/Ispravljaš rezultat koji je odbijen/, undefined, SOON)
    await user.clear(screen.getByLabelText(/^Link/))
    await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/ispravno')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))

    expect(await screen.findByText('Rezultat je ponovo poslat na proveru.', undefined, SOON)).toBeVisible()

    await user.click(screen.getByRole('link', { name: 'Moji rezultati' }))

    const rows = await sentRows()

    expect(rows).toHaveLength(2)
    expect(within(must(rows[0], 'the run sent again')).getByText('Čeka proveru')).toBeVisible()
    expect(within(must(rows[1], 'the run sent back')).getByText('Odbijeno')).toBeVisible()
    expect(
      within(must(rows[1], 'the run sent back')).getByText('Na stranici rezultata nema tvog imena.'),
    ).toBeVisible()
  }, SLOW)
})

describe('the order of what was sent', () => {
  it('is the order the server answers in, and the screen sorts nothing again', async () => {
    /* Newest first by the moment each was sent, which is the route's own order
       (`MyResultSubmissionsApi`, `order by v.raised_at desc`); derived on 10.10.2026 alongside the
       owner's answers, and said to him in one sentence, that „Najnovije prvo" on this list means
       that moment. Until R2 of the results flows the list was the browser's own and kept
       the order things were written into it.

       Three runs answered in an order no sort of the screen's own can produce: not by their
       numbers, up or down, not by the days the races were run, up or down, and not with the one
       that waits first. */
    answering(() => [
      aRun(50, { raceName: 'Poslata poslednja', raceDate: '2026-03-01' }),
      aRun(70, { raceName: 'Poslata druga', raceDate: '2026-06-01', state: 'waiting', reason: null }),
      aRun(60, { raceName: 'Poslata prva', raceDate: '2026-01-01' }),
    ])
    renderAt(MINE, 'competitor', ME, undefined, null)

    expect((await sentRows()).map(nameOf)).toEqual(['Poslata poslednja', 'Poslata druga', 'Poslata prva'])
  }, SLOW)
})

/* „A RESULT THAT HAS ALREADY BEEN DECIDED" (an approved run offers neither control), „A SUBMISSION
   OF ONE'S OWN THAT A MODERATOR HAS ALREADY APPROVED" (`?ponovo=` does not open one) and
   „SOMEBODY ELSE'S RESULT THAT IS ONLY WAITING" (`?ponovo=` does not open another member's) stood
   here until R2 of the results flows, each about the browser's own list of runs. The route answers
   a member his own runs and only those that wait or were sent back (`MyResultSubmissionsApi`: an
   approved run is a result, and the asker is in the statement), so an approved run or another
   member's is on no list this screen can be handed, and `SentRun.state` names only the two. What
   `?ponovo=` opens is bounded by that list, and `newResult.test.tsx` holds both of its sides
   („opens nothing that is not on his own list, however the address is typed").

   „THE SENTENCE OVER THE FORM WHILE A RESULT IS BEING CHANGED", „A RESULT SENT BACK UNCHANGED"
   (the mark „Ispravljeno") and „THE NUMBER A DELETED RESULT LEAVES BEHIND" stood here too. The
   first was about a waiting run opened for changing, which no road opens any more; the second
   about a mark the browser wrote, while the queue's mark is the server's since R1
   (`pages/admin/resultsQueue.test.tsx`); and the third about numbers this browser minted, while
   every number is the server's since R2. */

describe('the runs sent, when somebody else signs in without signing out first', () => {
  /** Whose runs the server below answers, which a real sign in changes with the cookie. */
  let whoseRuns: 'his' | 'hers' = 'his'

  /**
   * SOMEBODY ELSE SIGNING IN WITHOUT SIGNING OUT FIRST, through the portal's own live writer, the
   * shape `inboxFromTheServer.test.tsx` already uses for the inbox and for the same reason:
   * `theServerSignedMeIn` is the very call `member/SignIn.tsx` makes, `SessionProvider` sits above
   * the router so it never comes down, and the sign in screen can be walked to while somebody is
   * signed in. It moves what the server answers in the same click, so a case built on it measures
   * whether the SCREEN reacts, not whether the fake server can.
   */
  function SignInAsWithoutSigningOut({ memberNumber }: { memberNumber: string }) {
    const { theServerSignedMeIn } = useSession()

    return (
      <button
        type="button"
        onClick={() => {
          whoseRuns = 'hers'
          theServerSignedMeIn({
            account: 2,
            memberNumber,
            country: null,
            firstSeason: null,
            teamId: null,
            membershipBasis: null,
            referralCode: null,
            referredCount: null,
          })
        }}
      >
        sign in as somebody else, in place
      </button>
    )
  }

  it('are the runs of whoever is signed in now, not of whoever the screen was drawn for', async () => {
    /* The list depends on who asks (`MyResultSubmissionsApi` reads the asker), so the answer held
       is dropped the moment the asker changes (`data/useResource.ts`, `theSubmissionsNowBelongTo`),
       the way the inbox's is. „Moji rezultati" stays mounted across the switch, so without the
       drop it would ask again and be handed the answer already held: HIS runs on HER screen.
       `session/everyNameThatDependsOnTheReader.test.ts` holds that the drop is written; this is
       the case that holds that it is called. */
    const user = setupUser()

    whoseRuns = 'his'
    server = serverThat((path) =>
      path.replace(/\?.*$/, '') === '/api/me/result-submissions'
        ? served(
            whoseRuns === 'his'
              ? [aRun(40, { raceName: 'Njegova trka' })]
              : [aRun(45, { raceName: 'Njena trka' })],
          )
        : null,
    )

    renderAt(MINE, 'competitor', ME, undefined, null, <SignInAsWithoutSigningOut memberNumber="000009" />)

    expect(await screen.findByText('Njegova trka', undefined, SOON)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'sign in as somebody else, in place' }))

    expect(await screen.findByText('Njena trka', undefined, SOON)).toBeVisible()
    expect(screen.queryByText('Njegova trka')).toBeNull()
  }, SLOW)
})

describe('somebody else’s result that has been counted', () => {
  it('does not open on the `?ispravka=` road, however the address is typed', async () => {
    /* It is the one condition standing between a member and another member's standing, and it is
       worth spelling out what goes if it fails: the screen opens saying „Menjaš rezultat koji je
       već uračunat“, and Pošalji sends a correction of somebody else's result.
     *
       Measured by a review on 28.08.2026: with the owner taken out of the
       condition the whole suite stayed green at 2222 of 2222, and the screen
       really did open.
     *
       The number is read out of the file rather than written here: the ids are
       the file's business, and a member's own result would prove nothing. */
    const theirs = must(
      countedResults.find((one) => one.memberNumber !== '000001'),
      'a counted result belonging to somebody else',
    )

    renderAt(`/sr/rezultat/novi?ispravka=${theirs.id}`, 'competitor', '000001', undefined, '2026-08-23')

    await screen.findByLabelText(/^Naziv trke/)

    expect(screen.getByText(/Rezultat ulazi u rang liste tek kad/)).toBeVisible()
    expect(screen.queryByText(/Menjaš rezultat koji je već uračunat/)).toBeNull()
  })
})

describe('a result that has been counted', () => {
  /** A member with results in the file, and the one row this is about. */
  const COUNTED = '/sr/moji-rezultati'

  /**
   * What the server answers this member he has sent, where a case names it; the disc otherwise.
   *
   * <p>Taking a counted result back is `DELETE /api/results/{id}` and correcting one is `PUT`, and
   * the screen writes its own overlay only once the route has answered (`member/resultWrites.ts`),
   * so the server below is load-bearing rather than scenery: with one that refuses, the row stays
   * and the standing does not move (`resultToTheServer.test.tsx`).
   */
  let mine: SentRun[] | null = null

  beforeEach(() => {
    mine = null
    answering(() => mine)
  })

  /** The first counted result, whichever race it happens to be: this member has
   *  run some of them in more than one season, so a name does not name a row. */
  const firstCounted = async () => {
    const table = within(await screen.findByRole('table', { name: 'Uračunato' }))

    return within(must(table.getAllByRole('row')[1], 'the first counted result'))
  }

  /** Every counted row as the words in it, in the order the table draws them.
   *  Enough to tell one row from another: the same race run twice differs by its
   *  date, and two results of one race on one day would be the same result. */
  const countedRows = async () =>
    within(await screen.findByRole('table', { name: 'Uračunato' }))
      .getAllByRole('row')
      /* Without the heading, which is a row to `getAllByRole` and not a result.
         Left in, the comparison below would drop it instead of the row pressed
         and pass whatever was deleted. */
      .slice(1)
      /* The result and not the controls beside it. What a row offers changes with
         the state of the queue: since 28.08.2026 a counted result whose correction
         is waiting loses its „Izmeni" until somebody decides. That is a change to
         what may be done, not to what is counted, and these cases are about the
         standing. */
      .map((one) =>
        within(one)
          .getAllByRole('cell')
          .slice(0, -1)
          .map((cell) => cell.textContent ?? '')
          .join(' | '),
      )

  /** What that row is a result of, read off the row rather than assumed. */
  const raceOf = (row: ReturnType<typeof within>) =>
    must(row.getAllByRole('cell')[1]?.textContent, 'the race of the row')

  it('may be taken back, which it may not have been before', async () => {
    /* Owner, 27.08.2026: „član ga ili briše (ima pravo na to, iako je
       verifikovan)". That overturned the older rule, which allowed it only while
       the result was still waiting. Verification is a check of what is true, not
       a transfer of ownership.

       Read through the store the administration deletes with, so a result taken
       back leaves every screen that reads results and not only this one. */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, null)

    const before = await countedRows()
    const row = await firstCounted()

    await user.click(row.getByRole('button', { name: /^Obriši/ }))
    await user.click(screen.getByRole('button', { name: /^Potvrdi brisanje/ }))

    /* The whole table before against the whole table after, and not the count of
       either. Measured by a review on 28.08.2026: with `remove` given another
       result's number the table was still one row shorter, so a press that
       deleted somebody's third result read as success. Row by row it cannot: the
       order is by date and nothing else (`resultsOf`), so taking out the first
       leaves exactly the rest of the list, and taking out any other leaves the
       first still standing at the front. */
    expect(await countedRows()).toEqual(before.slice(1))
  }, SLOW)

  it('leads to the form with its own numbers, and the race locked', async () => {
    /* „Ili menja i dostavlja dokaz za tu izmenu (ponovo)" (owner, same day). The
       race is locked here for the same reason it is locked on a run sent back:
       „sve osim trke". */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

    const row = await firstCounted()
    const race = raceOf(row)

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))

    expect(await screen.findByText(/Menjaš rezultat koji je već uračunat/)).toBeVisible()
    expect(screen.getByLabelText(/^Naziv trke/)).toHaveAttribute('readonly')
    expect(screen.getByLabelText(/^Naziv trke/)).toHaveValue(race)
  })

  /**
   * THE DAY IS LOCKED LIKE THE RACE, AND IT IS THE COORDINATOR'S REASONING AND NOT THE OWNER'S WORD.
   *
   * <p>`PUT /api/results/{id}` takes `distanceKm`, `ascentM`, `descentM`, `seconds`, a link and a
   * comment (`ResultWriteApi.Correction`) and no day, so a day changed in this form was thrown away
   * by the server in silence while the member was told the change went in. A box the server will not
   * take must not look like one it will. What the owner decided is which six fields a correction
   * changes (PDL 04.09.2026: the three measures and the three boxes of the time), and the day is not
   * one of them; the decision that the day is locked is the coordinator's, written as such.
   *
   * <p><b>Two sources of one value, separated.</b> The day in the box is the counted result's own,
   * read off the file by the id the ADDRESS carries, and it is neither the day the portal is read as
   * (2026-08-23) nor the first of a month, so a box that held either would not pass for it.
   */
  it('leads to the form with its own day, and the day locked like the race', async () => {
    const user = setupUser()

    const { router } = renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

    const row = await firstCounted()

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji je već uračunat/)

    const id = must(
      /^\?ispravka=(\d+)$/.exec(router.state.location.search)?.[1],
      `the address does not name a result: ${router.state.location.search}`,
    )
    const was = must(
      countedResults.find((one) => String(one.id) === id),
      'the result the address names',
    )
    const day = screen.getByLabelText(/^Datum trke/)

    expect(day).toHaveValue(fieldDate(was.date))
    expect(day).toHaveAttribute('readonly')
    expect(day).toHaveAttribute('aria-disabled', 'true')
  })

  it('keeps its own day whatever the box is made to say', async () => {
    /* The half beneath the lock: the box is forced to say another day and the correction is sent,
       and what went names no day at all, because the route that takes it has none
       (`ResultWriteApi.Correction`). Typed through the lock `user.type` would refuse a read-only
       box, which is the lock doing its job and is measured above. Until R2 of the results flows
       this walked on to an approval in the browser's own session and read the counted row; the
       approval is the server's since R1, so what a correction cannot carry is read off the
       request. */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

    const row = await firstCounted()

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji je već uračunat/)

    fireEvent.change(screen.getByLabelText(/^Datum trke/), { target: { value: '01/01/2020' } })

    await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))
    await screen.findByText('Rezultat je ponovo poslat na proveru.')

    const sent = must(writes()[0], 'the correction')

    expect(writes()).toHaveLength(1)
    expect(sent.method).toBe('PUT')
    expect(Object.keys(sent.body)).not.toContain('day')
    expect(Object.keys(sent.body)).not.toContain('date')
    expect(JSON.stringify(sent.body)).not.toContain('2020')
  }, SLOW)

  it('keeps the day locked, and asks neither question, when a correction sent back is opened again', async () => {
    /* The second road to the same form. A correction a moderator sent back is sent again from the
       list of what was sent (`?ponovo=`), and it draws the same short form for the same reasons:
       the day locked as well, or a member shuts it on one road and opens it on the other; and
       neither the kind nor the place, which a correction is not asked (owner, 30.08.2026) and
       which a review measured open on this road on 30.08.2026.

       Until R2 of the results flows this road was a WAITING correction's „Izmeni"; a waiting run
       has no control since then (the owner's choice of 10.10.2026), and a correction sent back is
       the one that still reaches the form. */
    const user = setupUser()
    const corrected = must(
      resultsOf(countedResults, '000001')[1],
      'a counted result of his that is not his newest',
    )

    mine = [aRun(77, { raceName: corrected.raceName, raceDate: corrected.date, amendsResultId: corrected.id })]
    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

    await user.click(
      await screen.findByRole('link', { name: `Ispravi i pošalji ponovo: ${corrected.raceName}` }, SOON),
    )
    await screen.findByText(/Ispravljaš rezultat koji je odbijen/, undefined, SOON)

    const day = screen.getByLabelText(/^Datum trke/)

    expect(day).toHaveAttribute('readonly')
    expect(day).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByLabelText(/^Naziv trke/)).toHaveAttribute('readonly')
    expect(screen.queryByLabelText(/^Vrsta trke/)).toBeNull()
    expect(screen.queryByLabelText('Mesto')).toBeNull()
  }, SLOW)

  it('gives up its category on a phone rather than its controls', async () => {
    /* The column had to come from somewhere. Measured by a review on 28.08.2026
       at 360 by 780: with the new column the table drew 504 pixels inside a box of
       328 and both controls stood entirely past the right edge, where nothing on
       the screen said they were there.
     *
       The category is what goes, and not at random: it is worked out from the
       distance and nothing else (`categoryOf`), it is named in full on the profile
       and in every ranking, and the race beside it already says which race this
       was. The controls exist on no other screen, so they are the last thing to
       go. The moderator's queue makes the same trade with five of its columns.
     *
       jsdom draws no stylesheet, so what is measured is the ask and not the
       pixels; the pixels are in `ownResultStyle.test.ts`.

       **Both the heading and the cell**, because the fact has two homes and they
       have to agree. Measured by a review on 28.08.2026 with the ask taken off the
       heading alone: at 360px the head drew five columns and the body four, so the
       body slid one column left and the points stood under „Kat.", the controls
       under „Bodovi", and the last column empty, while the whole suite of 2224
       stayed green. */
    renderAt(COUNTED, 'competitor', '000001', undefined, null)

    const table = within(await screen.findByRole('table', { name: 'Uračunato' }))
    const headings = within(must(table.getAllByRole('row')[0], 'the heading row')).getAllByRole(
      'columnheader',
    )
    const row = await firstCounted()
    const cells = row.getAllByRole('cell')

    expect(must(headings[2], 'the category heading').className).toContain('table__hide-phone')
    expect(must(cells[2], 'the category').className).toContain('table__hide-phone')
    expect(must(headings[5], 'the heading of what a member may do').className).not.toContain(
      'table__hide-phone',
    )
    expect(must(cells[5], 'what a member may do').className).not.toContain('table__hide-phone')
  })

  it('says what is missing even when the box holds only spaces', async () => {
    /* The sentence is the whole of what this road adds to the form, and it was
       skipped for anything that is not exactly empty. Measured by a review on
       28.08.2026: three spaces in Link and the member saw only „obavezno polje",
       which does not say that a link or a picture is what this particular change
       needs. Sending was refused either way, so nothing got past; what was lost
       was the explanation. */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

    const row = await firstCounted()

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji je već uračunat/)
    await user.type(screen.getByLabelText(/^Link/), '   ')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))

    expect(
      await screen.findByText(/mora da ide link ka zvaničnim rezultatima ili slika/),
    ).toBeVisible()
  })

  it('keeps its own race whatever the box is made to say', async () => {
    /* „Sve osim trke“ (owner, 27.08.2026). Measured by a review on 28.08.2026: with
       the name read out of the box on this road, the queue took „Sasvim druga trka“
       in place of the race the member had actually run, under a member who never ran
       it. The lock is a courtesy and is measured above; what is measured here is what
       holds when something reaches the code past it.

       Read off the request since R2 of the results flows: a correction goes to the
       address of the result and names no race at all, so whatever the box says
       reaches nothing. */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

    const row = await firstCounted()

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji je već uračunat/)

    fireEvent.change(screen.getByLabelText(/^Naziv trke/), { target: { value: 'Sasvim druga trka' } })

    await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))
    await screen.findByText('Rezultat je ponovo poslat na proveru.')

    const sent = must(writes()[0], 'the correction')

    expect(writes()).toHaveLength(1)
    expect(sent.method).toBe('PUT')
    expect(Object.keys(sent.body)).not.toContain('raceName')
    expect(JSON.stringify(sent.body)).not.toContain('Sasvim druga trka')
  }, SLOW)

  it('is refused without new proof, and taken with it', async () => {
    /* The one rule this road has that the others do not. Both halves, because a
       refusal that never lifts is a screen nobody can get past. */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

    const row = await firstCounted()

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji je već uračunat/)
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))

    expect(
      await screen.findByText(/mora da ide link ka zvaničnim rezultatima ili slika/),
    ).toBeVisible()

    await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))

    expect(await screen.findByText('Rezultat je ponovo poslat na proveru.')).toBeVisible()
  })

  it('leaves the standing exactly as it was while the correction waits', async () => {
    /* Owner, 28.08.2026, choosing between four outcomes: the old result stays
       where it is while the correction waits, and changes when a moderator agrees
       with it.

       Until then this screen took the result out of the standing the moment the
       correction was sent, so a refusal lost the points for good: measured that
       day, a profile fell from 180 races and 1.752,86 points to 179 and 1.744,60
       with no way back, because an approved submission produced no result. That
       contradicted the portal's own rule that the standing is brought up to date
       **after** verification (owner, 27.08.2026).

       The cost the owner accepted is the other half of this case and is measured
       nowhere else: while the correction waits, the standing holds the numbers the
       member has themselves said are wrong. */
    const user = setupUser()

    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

    const before = await countedRows()
    const row = await firstCounted()

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji je već uračunat/)
    await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))
    await screen.findByText('Rezultat je ponovo poslat na proveru.')

    /* Walked back rather than rendered again, so the standing is the one this
       visit holds after the correction went in. */
    await user.click(screen.getByRole('link', { name: 'Moji rezultati' }))

    expect(await countedRows(), 'the standing moved before anybody decided').toEqual(before)
  }, SLOW)

  /* „CHANGES WHEN SOMEBODY AGREES WITH IT", „CARRIES THE NUMBERS OF THE LAST CORRECTION, NOT OF THE
     FIRST" and „IS LEFT EXACTLY WHERE IT WAS WHEN THE CORRECTION IS TURNED DOWN" stood here until R2
     of the results flows. All three pressed a moderator's decision into this browser's own session
     and read the counted table after it; the queue decides on the server since R1, and what an
     approval or a refusal does to the standing is the server's to hold (`VerificationWriteApiTest`).
     The second was also about correcting a correction that still waits, which no road does any
     more. „SAYS WHICH KIND OF RACE IT WAS AND WHERE" read the kind and the place a correction wrote
     into the browser's copy; a correction carries neither since R2, which
     `resultToTheServer.test.tsx` reads off the request. */

  it('offers no second correction while one waits, and goes on offering one once it is sent back', async () => {
    /* Since 28.08.2026 the result stays in the standing while a correction waits
       (owner), so the row goes on looking exactly as it did and the „Izmeni" link
       stayed live. Measured by a review the same day: one counted result then took
       as many corrections as somebody cared to send, the queue grew a row for
       each, and one press of „Odobri sve" walked them newest first, so what ended
       up counted was the oldest of them. That is the fault the portal already
       refuses for a waiting result: „two rows for one race, and the moderator
       reading the same morning twice" (owner, 06.08.2026).

       **Waiting and not sent back**, derived on 10.10.2026 from that same reason and
       accepted by the coordinator, so not the owner's word: a correction a moderator
       sent back is in nobody's queue, so it puts no second row in front of anybody,
       and the link stays.

       Both on one table: the SECOND counted row has a correction waiting, the THIRD
       has one that was sent back, and the first has none. Read off each row by the
       result its link names, so a screen that looked at the wrong number hides the
       wrong link. */
    const [first, second, third] = resultsOf(countedResults, '000001')
    const newest = must(first, 'his newest result')
    const waitsOn = must(second, 'his second result')
    const sentBackOn = must(third, 'his third result')

    mine = [
      aRun(78, { state: 'waiting', reason: null, raceName: waitsOn.raceName, amendsResultId: waitsOn.id }),
      aRun(77, { raceName: sentBackOn.raceName, amendsResultId: sentBackOn.id }),
    ]
    renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

    const table = within(await screen.findByRole('table', { name: 'Uračunato' }))
    const rows = table.getAllByRole('row').slice(1)
    const linkOf = (at: number) =>
      within(must(rows[at], `counted row ${String(at)}`)).queryByRole('link', {
        name: /^Izmeni rezultat/,
      })

    expect(linkOf(0)).toHaveAttribute('href', `/sr/rezultat/novi?ispravka=${String(newest.id)}`)
    expect(linkOf(1), 'a second correction is offered while one waits').toBeNull()
    expect(linkOf(2)).toHaveAttribute('href', `/sr/rezultat/novi?ispravka=${String(sentBackOn.id)}`)
  })

  /**
   * AND THE FORM SAYS NO AS WELL, because the list offers no way in and typing the address is the
   * only way to try. Both sides on one list: a correction of ANOTHER result waits beside it, so a
   * form that asked whether any correction waits would refuse every address, and the second row
   * says one opens.
   */
  it.each([
    ['refuses the road to a result whose correction waits, even when the address is typed', 1, false],
    ['opens it to a result whose own correction does not wait, while another one does', 0, true],
  ] as const)(
    '%s',
    async (_what, at, opens) => {
      const own = resultsOf(countedResults, '000001')
      const waitsOn = must(own[1], 'his second result')
      const asked = must(own[at], 'the result the address names')

      mine = [
        aRun(78, { state: 'waiting', reason: null, raceName: waitsOn.raceName, amendsResultId: waitsOn.id }),
      ]

      expect(waitsOn.id, 'the run and the result it corrects share a number').not.toBe(78)

      renderAt(`/sr/rezultat/novi?ispravka=${String(asked.id)}`, 'competitor', '000001', undefined, '2026-08-23')

      await screen.findByLabelText(/^Naziv trke/, undefined, SOON)

      if (opens) {
        expect(screen.getByText(/Menjaš rezultat koji je već uračunat/)).toBeVisible()
      } else {
        expect(screen.queryByText(/Menjaš rezultat koji je već uračunat/)).toBeNull()
        expect(screen.getByText(/Rezultat ulazi u rang liste tek kad/)).toBeVisible()
      }
    },
    SLOW,
  )

  it('is still sent when the race under it is gone from the calendar', async () => {
    /* A race can leave the calendar under a counted result, which the administration measures
       and warns about elsewhere (`adminEventKind.test.tsx`), and the correction still has to go.
       Until R2 of the results flows the screen read the kind and the place off that race for the
       browser's own copy, and wrote the word „undefined" where there was nothing to read (review,
       30.08.2026). A correction goes to the address of the result since then and names neither,
       so what is left to hold is that it still goes, and carries nothing made of a value that was
       not there.

       The calendar is emptied rather than a race deleted, since what is measured is the lookup
       coming back with nothing, and an empty answer is the shortest way to that. */
    const user = setupUser()
    const noCalendar = serverThat((path) =>
      path.replace(/\?.*$/, '') === '/api/races'
        ? new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
        : null,
    )

    try {
      renderAt(COUNTED, 'competitor', '000001', undefined, '2026-08-23')

      const row = await firstCounted()

      await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
      await screen.findByText(/Menjaš rezultat koji je već uračunat/)
      await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
      await user.click(screen.getByRole('button', { name: /^Pošalji/ }))

      expect(await screen.findByText('Rezultat je ponovo poslat na proveru.')).toBeVisible()

      const sent = must(writes()[0], 'the correction')

      expect(sent.method).toBe('PUT')
      expect(JSON.stringify(sent.body)).not.toContain('undefined')
    } finally {
      noCalendar.stop()
    }
  }, SLOW)
})
