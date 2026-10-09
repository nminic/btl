import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useEffect } from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pointsOf } from '../../data/scoring'
import { NO_RATING, type ServedPendingItem } from '../../data/types'
import sr from '../../i18n/sr.json'
import { formatPoints, formatShortDate } from '../../i18n/format'
import { useSession } from '../../session/useSession'
import { must } from '../../test/at'
import { Decided, Inbox } from '../../test/decided'
import { renderAt } from '../../test/render'
import { refused, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser, type Pressing } from '../../test/user'
import { figuresAsked } from './amendFields'
import { QUEUE } from './queues'

/**
 * THE QUEUE OF RESULTS, READ FROM THE SERVER AND DECIDED ON IT (R1 of the results flows).
 *
 * <p><b>Why this file exists rather than the describe that stood in `pages/adminFlows.test.tsx`.</b>
 * That one handed `ReviewQueue` a double of the session and asked whether `decide`, `amend` and
 * `notify` were called, because the queue read and decided results held in the browser: a decision
 * taken in one browser was a decision nobody else ever heard of, and the standings never moved.
 * The screen reads `GET /api/verification` now and decides through
 * `POST /api/verification/{id}/decision`, so every case here stands a server in front of the
 * harness that answers the queue with runs and records what was sent (`test/serverAnswers.ts`).
 *
 * <p><b>The one thing every case about a decision holds is the ORDER</b>, the same as
 * `verificationDecision.test.tsx` holds it for the queue of cards: the route is asked, and the row
 * leaves only in the branch that ran because the answer said it did.
 *
 * <p><b>The runs differ along every axis the screen reads</b> (the rule of 06.09.2026):
 * <ul>
 * <li>three races of the calendar, one of each kind, so which figures the panel asks for has three
 * answers and not one;</li>
 * <li>a run on a race the calendar does not hold, and a row that names no run at all (V10 permits
 * one, and nothing writes one today), which are the two ways of having no race and are not the same
 * thing;</li>
 * <li>a correction beside first reports, so the mark that says so has somewhere to be wrong;</li>
 * <li>a day the run was run beside a different day it was sent, so the two columns cannot be fed
 * from one value.</li>
 * </ul>
 */

const PATH = `/sr/${QUEUE.results.path}`

/** The member the case signs in as, and the runner of the first run: a line written to him by the
 *  screen itself would land in the inbox the probe reads. */
const RUNNER = '000010'

const A_RUN = {
  queue: 'results' as const,
  who: 'Ana Anić',
  subjectId: '',
  city: '',
  country: '',
  photoId: null,
  rating: NO_RATING,
}

/** A race of a length: it fixes the distance, the climb and the drop, so the time is the runner's. */
const OF_A_LENGTH: ServedPendingItem = {
  ...A_RUN,
  id: 701,
  kind: '',
  date: '2027-03-08',
  memberNumber: RUNNER,
  subject: 'Beogradska desetka',
  body: 'Startni broj 412',
  raceId: 11,
  raceDate: '2027-03-06',
  raceKind: 'length',
  distanceKm: 10,
  ascentM: 50,
  descentM: 40,
  seconds: 3300,
  link: 'https://primer.rs/desetka',
}

/** A race to a limit: it fixes the time, so the distance, the climb and the drop are the runner's. */
const TO_A_LIMIT: ServedPendingItem = {
  ...A_RUN,
  id: 702,
  kind: '',
  date: '2027-03-09',
  memberNumber: '000020',
  who: 'Bojan Bojić',
  subject: 'Šestočasovna',
  body: '',
  raceId: 12,
  raceDate: '2027-03-06',
  raceKind: 'time',
  distanceKm: 52.4,
  ascentM: 640,
  descentM: 610,
  seconds: 21600,
  link: '',
}

/** A free race, which fixes nothing; and a correction of a result already counted. */
const FREE_AND_A_CORRECTION: ServedPendingItem = {
  ...A_RUN,
  id: 703,
  kind: 'correction',
  date: '2027-03-10',
  memberNumber: '000030',
  who: 'Vera Verić',
  subject: 'Brdska trka',
  body: '',
  raceId: 13,
  raceDate: '2027-03-07',
  raceKind: 'free',
  distanceKm: 14.35,
  ascentM: 780,
  descentM: 210,
  seconds: 7200,
  link: 'https://primer.rs/brdska',
}

/** A run on a race the calendar does not hold: it carries the day it was run and no race. */
const NOT_IN_THE_CALENDAR: ServedPendingItem = {
  ...A_RUN,
  id: 704,
  kind: '',
  date: '2027-03-11',
  memberNumber: '000040',
  who: 'Goran Gorić',
  subject: 'Trka van kalendara',
  body: '',
  raceId: null,
  raceDate: '2027-03-07',
  raceKind: 'free',
  distanceKm: 12,
  ascentM: 100,
  descentM: 90,
  seconds: 3000,
  link: 'https://primer.rs/van',
}

/** A results row naming no submission, which V10 permits: no day, no race, no figures. */
const NAMING_NO_RUN: ServedPendingItem = {
  ...A_RUN,
  id: 705,
  kind: '',
  date: '2027-03-12',
  memberNumber: '000050',
  who: 'Mira Mirić',
  subject: 'Red bez prijave',
  body: '',
  raceId: null,
  raceDate: null,
  raceKind: '',
  distanceKm: null,
  ascentM: null,
  descentM: null,
  seconds: null,
  link: '',
}

const RUNS = [OF_A_LENGTH, TO_A_LIMIT, FREE_AND_A_CORRECTION, NOT_IN_THE_CALENDAR, NAMING_NO_RUN]

/** The other four tabs as the served file holds them, so the answer is the whole answer and a
 *  screen counting one tab off it is counting what it would count for real. */
const THE_OTHER_TABS: unknown[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'verification.json'), 'utf-8'),
)

const answering = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** The route's word that it took the decision. */
const taken = (): Response => answering({ id: 1, state: 'approved' })

/**
 * A server that answers the queue with these runs and every decision with what `decided` says,
 * taking it by default. Everything else goes on to the disc reader.
 */
function serverWith(
  runs: ServedPendingItem[],
  decided: (id: string) => Response | Promise<Response> = taken,
): { asked: Asked[]; stop: () => void } {
  return serverThat((path, init) => {
    if (path === '/api/verification' && (init?.method ?? 'GET') === 'GET') {
      return answering([...runs, ...THE_OTHER_TABS])
    }

    const decision = /^\/api\/verification\/([^/]+)\/decision$/.exec(path)

    return decision !== null && init?.method === 'POST' ? decided(decision[1] ?? '') : null
  })
}

/** What was sent to decide something, in order. */
const decisionsIn = (asked: Asked[]): Asked[] => asked.filter((one) => one.path.endsWith('/decision'))

/** What one of those carried. */
const bodyOf = (one: Asked | undefined): unknown => JSON.parse(String(one?.init?.body ?? 'null'))

/** The row of the run sent by this member, which is the one value on a row nothing else repeats. */
async function rowOf(memberNumber: string) {
  const table = await screen.findByRole('table', { name: sr.review.waiting })

  return within(must(within(table).getByText(memberNumber).closest('tr'), `the row of ${memberNumber}`))
}

const decidedIn = () => within(screen.getByRole('list', { name: 'session decisions' }))

/**
 * ONE MESSAGE TO THE RUNNER THAT IS NOT A DECISION, so „the screen wrote nothing to him" is read off
 * a list that is drawn and not off one that is empty whatever happens (the reason
 * `verificationDecision.test.tsx` writes its own).
 */
function OneMessageToTheRunner() {
  const { notify } = useSession()

  useEffect(() => {
    notify({
      from: 'Balkanska trkačka liga',
      to: RUNNER,
      subject: 'Članarina je evidentirana',
      body: 'Uplata je zabeležena.',
      date: '2026-09-20',
    })
  }, [notify])

  return null
}

/**
 * THE LINE A SWEEP LEAVES, waited for whatever number it says and then read for the one it should.
 *
 * <p>Waited for by the sentence itself, a sweep that settled a different number never draws it, and
 * the case runs out its five seconds before Testing Library's own clock (`test/setup.ts`) says
 * anything: a timeout, which reads the same as a slow machine. Waited for by its beginning, the case
 * fails on what the line says.
 */
async function sweptSays(sentence: string): Promise<HTMLElement> {
  const line = await screen.findByText(/^Rešen/)

  expect(line.textContent).toBe(sentence)

  return line
}

/**
 * UNTIL WHATEVER DECISION WAS OUT HAS COME BACK, whatever it said: the buttons of the rows still
 * waiting stop saying they cannot act (`deciding`). Waited for this way rather than for the
 * sentence or the row the answer should leave, for the reason `sweptSays` gives, so a decision that
 * came back saying something else fails on what it says. Where nothing was sent at all it passes at
 * once, which is what lets a case that claims nothing was sent count AFTER anything that was sent
 * has been recorded: a request leaves a few turns after its press, and one counted at once reads as
 * one never sent.
 */
async function untilItHasAnswered(): Promise<void> {
  await waitFor(() => {
    for (const one of screen.queryAllByRole('button', { name: sr.review.approve })) {
      expect(one).toHaveAttribute('aria-disabled', 'false')
    }
  })
}

/** A decision the route holds until the case lets it answer, and then answers with `answer`, which
 *  takes it unless a case says otherwise; each request gets an answer of its own, so a second one
 *  sent by mistake is counted rather than broken. */
function heldDecision(answer: () => Response = taken): {
  decided: () => Promise<Response>
  release: () => void
} {
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  return { decided: () => gate.then(answer), release: () => release() }
}

/** The sentence that says a request is out, wherever on the page it was drawn. */
const sending = () =>
  screen.queryAllByRole('status').filter((one) => one.textContent === sr.results.sending)

function openTheQueue(probe = <Decided />) {
  return renderAt(PATH, 'superadmin', RUNNER, undefined, null, probe)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the queue of results as the server answers it', () => {
  it('draws a run with the day it was run beside the day it was sent, and the race as it is named today', async () => {
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      const table = await screen.findByRole('table', { name: sr.review.waiting })
      const row = await rowOf(RUNNER)

      expect(within(table).getAllByRole('columnheader').map((one) => one.textContent)).toEqual([
        sr.newResult.date,
        sr.competitors.columns.member,
        sr.profile.columns.race,
        sr.review.sentOn,
        sr.profile.columns.distance,
        sr.rankings.columns.ascent,
        sr.rankings.columns.descent,
        sr.profile.columns.time,
        sr.profile.columns.points,
        sr.review.decision,
      ])

      const cells = row.getAllByRole('cell').map((one) => one.textContent)

      /* Two days and never one: the day it was run (6 March) and the day it was sent (8 March),
         so a column fed from the other's value is a different row (owner, 18.09.2026). The race
         stays among the first three columns, the ones the shared table reads from the left. */
      expect(cells[0]).toBe(formatShortDate('2027-03-06', 'sr'))
      expect(cells[1]).toBe(RUNNER)
      expect(cells[3]).toBe(formatShortDate('2027-03-08', 'sr'))
      /* The race by the name the server answers, which is its name today, as an address the
         moderator can follow; and the member's own words on a line of their own. */
      expect(row.getByRole('link', { name: /Beogradska desetka/ })).toHaveAttribute(
        'href',
        'https://primer.rs/desetka',
      )
      expect(row.getByText('Startni broj 412')).toBeVisible()
      expect(cells.slice(4, 8)).toEqual(['10,00', '50', '40', '55:00'])
      /* What the approval would award, from the figures beside it. */
      expect(cells[8]).toBe(formatPoints(pointsOf(10, 50, 40, 3300), 'sr'))
    } finally {
      server.stop()
    }
  })

  it('marks a correction, and nothing else, as corrected', async () => {
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      expect((await rowOf('000030')).getByText(sr.admin.corrected)).toBeVisible()
      /* And on no other row, the first report of a run on a free race among them: the correction
         is on a free race too, so a mark read off the kind of race would land there as well. */
      for (const member of [RUNNER, '000020', '000040', '000050']) {
        expect((await rowOf(member)).queryByText(sr.admin.corrected)).toBeNull()
      }
    } finally {
      server.stop()
    }
  })

  it('marks a run on a race the calendar does not hold, and not a row that names no run', async () => {
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      const novo = await rowOf('000040')
      const none = await rowOf('000050')

      expect(novo.getByText(sr.review.newRace)).toBeVisible()
      expect(none.queryByText(sr.review.newRace)).toBeNull()
      /* And the row that names no run draws no day and no figure, rather than a nought that
         would read as a run of nought kilometres. */
      const cells = none.getAllByRole('cell').map((one) => one.textContent)

      expect(cells[0]).toBe('')
      expect(cells.slice(4, 9)).toEqual(['', '', '', '', ''])
    } finally {
      server.stop()
    }
  })

  it('offers to set the figures only on a race the calendar holds', async () => {
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      for (const member of [RUNNER, '000020', '000030']) {
        expect((await rowOf(member)).getByRole('button', { name: sr.review.amend })).toBeVisible()
      }

      for (const member of ['000040', '000050']) {
        expect((await rowOf(member)).queryByRole('button', { name: sr.review.amend })).toBeNull()
      }
    } finally {
      server.stop()
    }
  })

  it('says the list could not be read rather than passing for an empty one', async () => {
    const server = serverThat((path) =>
      path === '/api/verification' ? new Response('nema', { status: 500 }) : null,
    )

    try {
      openTheQueue()

      expect(await screen.findByText('Podaci se ne mogu učitati.')).toBeVisible()
      expect(screen.queryByText(sr.review.empty)).toBeNull()
    } finally {
      server.stop()
    }
  })

  it('counts beside Rezultati what the server answers, and drops one the moment it is decided', async () => {
    const user = setupUser()
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      const results = () =>
        within(screen.getByRole('navigation', { name: 'Odeljak Verifikacija' })).getByRole('link', {
          name: /Rezultati/,
        })

      await rowOf(RUNNER)
      expect(within(results()).getByText('5')).toBeVisible()

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.approve }))

      await untilItHasAnswered()

      expect(within(results()).getByText('4')).toBeVisible()
    } finally {
      server.stop()
    }
  })
})

describe('a decision on one run', () => {
  it('goes to the route, and the row leaves only once the route says it took it', async () => {
    const user = setupUser()
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.approve }))
      await untilItHasAnswered()

      expect(screen.queryByText(RUNNER)).toBeNull()

      const sent = decisionsIn(server.asked)

      expect(sent.map((one) => one.path)).toEqual(['/api/verification/701/decision'])
      expect(bodyOf(sent[0])).toEqual({ approved: true, reason: '' })
      expect(decidedIn().getByText(/^701 \| approved/)).toBeInTheDocument()
    } finally {
      server.stop()
    }
  })

  it('keeps the row and says the route’s own sentence when the route will not take it', async () => {
    const user = setupUser()
    const server = serverWith(RUNS, () => refused('O stavci je već odlučeno.', 409))

    try {
      openTheQueue()

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.approve }))

      await untilItHasAnswered()

      /* Once, on the row it is about, and the row is still there to be decided again. */
      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect((await rowOf(RUNNER)).getByRole('alert')).toHaveTextContent('O stavci je već odlučeno.')
      expect(decidedIn().queryByText(/^701/)).toBeNull()
    } finally {
      server.stop()
    }
  })

  it('reads the server’s sentence on a run whose race the calendar does not hold', async () => {
    const user = setupUser()
    const sentence = 'Trka nije u kalendaru, pa rezultat ne može odavde da se odobri.'
    const server = serverWith(RUNS, (id) => (id === '704' ? refused(sentence, 409) : taken()))

    try {
      openTheQueue()

      await user.click((await rowOf('000040')).getByRole('button', { name: sr.review.approve }))

      await untilItHasAnswered()

      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect((await rowOf('000040')).getByRole('alert')).toHaveTextContent(sentence)
      expect(bodyOf(decisionsIn(server.asked)[0])).toEqual({ approved: true, reason: '' })
    } finally {
      server.stop()
    }
  })

  it('sends a second press nothing while the first is out', async () => {
    const decision = heldDecision()
    const server = serverWith(RUNS, decision.decided)

    try {
      openTheQueue()

      const approve = (await rowOf(RUNNER)).getByRole('button', { name: sr.review.approve })

      /* Two presses in one go, before the render the first would cause: what stops the second
         is the ref and not the attribute. */
      fireEvent.click(approve)
      fireEvent.click(approve)

      expect(approve).toHaveAttribute('aria-disabled', 'true')

      decision.release()
      await untilItHasAnswered()

      expect(decisionsIn(server.asked)).toHaveLength(1)
    } finally {
      server.stop()
    }
  })

  it('says on every button that would send another decision that it cannot act while one is out', async () => {
    /* One decision out at a time over the whole tab. A box still opens, because opening one
       decides nothing; what it would send says it cannot act and sends nothing (`decide`), and
       the one decision for the whole queue does not even ask. Counted once the decision that
       was out has come back, because a request leaves a few turns after its press and one
       counted at once would read as one never sent. */
    const user = setupUser()
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const decision = heldDecision()
    const server = serverWith(RUNS, (id) => (id === '701' ? decision.decided() : taken()))

    try {
      openTheQueue()

      await user.click((await rowOf('000020')).getByRole('button', { name: sr.review.sendBack }))
      await user.type(screen.getByLabelText(sr.review.reason), 'Vreme se ne poklapa.')
      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.approve }))
      await waitFor(() => expect(decisionsIn(server.asked).length).toBeGreaterThan(0))

      const sweep = screen.getByRole('button', { name: 'Odobri sve' })
      const refuse = screen.getByRole('button', { name: sr.review.confirmSendBack })

      expect(sweep).toHaveAttribute('aria-disabled', 'true')
      expect(refuse).toHaveAttribute('aria-disabled', 'true')

      await user.click(sweep)
      await user.click(refuse)

      expect(ask).not.toHaveBeenCalled()

      await user.click((await rowOf('000030')).getByRole('button', { name: sr.review.amend }))

      const save = within(screen.getByRole('group', { name: sr.review.amendTitle })).getByRole('button', {
        name: sr.review.amendSave,
      })

      expect(save).toHaveAttribute('aria-disabled', 'true')

      await user.click(save)

      decision.release()
      await untilItHasAnswered()

      expect(screen.queryByText(RUNNER)).toBeNull()
      expect(decisionsIn(server.asked).map((one) => one.path)).toEqual(['/api/verification/701/decision'])
    } finally {
      server.stop()
    }
  })

  it('takes the route’s last sentence off the screen once the route takes a decision', async () => {
    /* The shape the queue of cards has (`PendingQueue.tsx`): the sentence is about the last press,
       so the next press that goes through takes it away. */
    const user = setupUser()
    const server = serverWith(RUNS, (id) => (id === '702' ? refused('O stavci je već odlučeno.', 409) : taken()))

    try {
      openTheQueue()

      await user.click((await rowOf('000020')).getByRole('button', { name: sr.review.approve }))
      await untilItHasAnswered()

      expect(screen.getByRole('alert')).toHaveTextContent('O stavci je već odlučeno.')

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.approve }))
      await untilItHasAnswered()

      expect(screen.queryByText(RUNNER)).toBeNull()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(await rowOf('000020')).toBeDefined()
    } finally {
      server.stop()
    }
  })
})

describe('refusing a run', () => {
  it('says the reason has to be written, in both ways a field says it', async () => {
    const user = setupUser()
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.sendBack }))

      const reason = screen.getByLabelText(sr.review.reason)

      expect(reason).toHaveAttribute('aria-required', 'true')
      expect(must(reason.closest('.rankings__field'), 'its field').querySelector('.field__required')).not.toBeNull()
      /* And it promises a message, because the route writes one to the member it is about. */
      expect(reason).toHaveAttribute('placeholder', sr.review.reasonPlaceholder)
    } finally {
      server.stop()
    }
  })

  it('promises no message where the run carries nobody to receive it', async () => {
    const user = setupUser()
    const server = serverWith([{ ...OF_A_LENGTH, memberNumber: null }])

    try {
      openTheQueue()

      await user.click(await screen.findByRole('button', { name: sr.review.sendBack }))

      expect(screen.getByLabelText(sr.review.reason)).toHaveAttribute(
        'placeholder',
        sr.review.reasonKeptPlaceholder,
      )
    } finally {
      server.stop()
    }
  })

  it('sends the reason trimmed, and writes nothing to the member itself', async () => {
    /* The route writes the line in his inbox (`VerificationWriteApi.tell`), so a line written
       here as well would be the same message twice. Read off an inbox that already holds one
       message to him, so an absence is read off a list that is drawn. */
    const user = setupUser()
    const server = serverWith(RUNS)

    try {
      openTheQueue(
        <>
          <OneMessageToTheRunner />
          <Decided />
          <Inbox />
        </>,
      )

      const inbox = () => within(screen.getByRole('list', { name: 'session inbox' }))

      await waitFor(() => expect(inbox().getAllByRole('listitem')).toHaveLength(1))

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.sendBack }))
      await user.type(screen.getByLabelText(sr.review.reason), '  Vreme se ne poklapa.  ')
      await user.click(screen.getByRole('button', { name: sr.review.confirmSendBack }))

      await untilItHasAnswered()

      expect(decidedIn().getByText(/^701 \| rejected \| Vreme se ne poklapa\./)).toBeInTheDocument()
      expect(bodyOf(decisionsIn(server.asked)[0])).toEqual({ approved: false, reason: 'Vreme se ne poklapa.' })
      expect(inbox().getAllByRole('listitem')).toHaveLength(1)
      /* And the box closes with its answer. */
      expect(screen.queryByLabelText(sr.review.reason)).toBeNull()
    } finally {
      server.stop()
    }
  })

  it('takes no reason made of spaces, and says why it will not go', async () => {
    const user = setupUser()
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.sendBack }))
      await user.type(screen.getByLabelText(sr.review.reason), '   ')

      const confirm = screen.getByRole('button', { name: sr.review.confirmSendBack })

      expect(confirm).toHaveAttribute('aria-disabled', 'true')
      expect(confirm).toHaveAccessibleDescription(sr.review.reasonNeeded)

      await user.click(confirm)
      await untilItHasAnswered()

      expect(decisionsIn(server.asked)).toHaveLength(0)
    } finally {
      server.stop()
    }
  })

  it('closes when the moderator gives it up, and sends nothing', async () => {
    const user = setupUser()
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.sendBack }))
      await user.type(screen.getByLabelText(sr.review.reason), 'Nešto')
      await user.click(screen.getByRole('button', { name: sr.review.cancel }))
      await untilItHasAnswered()

      expect(screen.queryByLabelText(sr.review.reason)).toBeNull()
      expect(decisionsIn(server.asked)).toHaveLength(0)
    } finally {
      server.stop()
    }
  })
})

describe('the figures the moderator sets', () => {
  const panel = () => within(screen.getByRole('group', { name: sr.review.amendTitle }))

  it('asks on each kind of race exactly what the member’s own form asks on it', () => {
    /* The pairing itself, against the member's form and not against a list written here: the
       time on a race of a length, the distance, the climb and the drop on a race to a limit, all
       four on a free race. */
    expect(figuresAsked('length').map((one) => one.name)).toEqual(['hours', 'minutes', 'seconds'])
    expect(figuresAsked('time').map((one) => one.name)).toEqual(['distanceKm', 'ascentM', 'descentM'])
    expect(figuresAsked('free').map((one) => one.name)).toEqual([
      'distanceKm',
      'ascentM',
      'descentM',
      'hours',
      'minutes',
      'seconds',
    ])
    expect(figuresAsked('free').map((one) => one.field.labelKey)).toEqual([
      'newResult.distanceKm',
      'newResult.ascentM',
      'newResult.descentM',
      'newResult.hours',
      'newResult.minutes',
      'newResult.seconds',
    ])
  })

  it('opens on the figures the row shows, and asks for nothing the race fixes', async () => {
    const user = setupUser()
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.amend }))

      expect(panel().getAllByRole('textbox').map((one) => one.getAttribute('id'))).toEqual([
        'amend-hours',
        'amend-minutes',
        'amend-seconds',
      ])
      expect(panel().getByLabelText(sr.newResult.minutes)).toHaveValue('55')
      for (const box of panel().getAllByRole('textbox')) {
        expect(box).toHaveAttribute('aria-required', 'true')
      }

      await user.click(panel().getByRole('button', { name: sr.review.amendCancel }))
      await user.click((await rowOf('000020')).getByRole('button', { name: sr.review.amend }))

      expect(panel().getAllByRole('textbox').map((one) => one.getAttribute('id'))).toEqual([
        'amend-distanceKm',
        'amend-ascentM',
        'amend-descentM',
      ])
      expect(panel().getByLabelText(sr.newResult.distanceKm)).toHaveValue('52.4')
    } finally {
      server.stop()
    }
  })

  it('approves a race of a length at his time, in one request, and sends nothing the race fixes', async () => {
    const user = setupUser()
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.amend }))
      await user.clear(panel().getByLabelText(sr.newResult.minutes))
      await user.type(panel().getByLabelText(sr.newResult.minutes), '54')
      await user.click(panel().getByRole('button', { name: sr.review.amendSave }))

      await untilItHasAnswered()

      expect(decisionsIn(server.asked)).toHaveLength(1)
      expect(bodyOf(decisionsIn(server.asked)[0])).toEqual({
        approved: true,
        reason: '',
        amended: { seconds: 3240 },
      })
      /* And the panel goes with its answer, along with the row. */
      expect(screen.queryByRole('group', { name: sr.review.amendTitle })).toBeNull()
    } finally {
      server.stop()
    }
  })

  it('approves a race to a limit at his distance, climb and drop, and never at a time', async () => {
    const user = setupUser()
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      await user.click((await rowOf('000020')).getByRole('button', { name: sr.review.amend }))
      await user.clear(panel().getByLabelText(sr.newResult.distanceKm))
      /* The comma, which is how a length is written here (owner, 02.10.2026). */
      await user.type(panel().getByLabelText(sr.newResult.distanceKm), '53,1')
      await user.click(panel().getByRole('button', { name: sr.review.amendSave }))

      await untilItHasAnswered()

      expect(decisionsIn(server.asked)).toHaveLength(1)
      expect(bodyOf(decisionsIn(server.asked)[0])).toEqual({
        approved: true,
        reason: '',
        amended: { distanceKm: 53.1, ascentM: 640, descentM: 610 },
      })
    } finally {
      server.stop()
    }
  })

  it('approves a free race at all four of his', async () => {
    const user = setupUser()
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      await user.click((await rowOf('000030')).getByRole('button', { name: sr.review.amend }))
      await user.clear(panel().getByLabelText(sr.newResult.ascentM))
      await user.type(panel().getByLabelText(sr.newResult.ascentM), '800')
      await user.clear(panel().getByLabelText(sr.newResult.seconds))
      await user.type(panel().getByLabelText(sr.newResult.seconds), '20')
      await user.click(panel().getByRole('button', { name: sr.review.amendSave }))

      await untilItHasAnswered()

      expect(decisionsIn(server.asked)).toHaveLength(1)
      expect(bodyOf(decisionsIn(server.asked)[0])).toEqual({
        approved: true,
        reason: '',
        amended: { distanceKm: 14.35, ascentM: 800, descentM: 210, seconds: 7220 },
      })
    } finally {
      server.stop()
    }
  })

  /**
   * THE RUN THE PANEL WAS OPENED ON IS THE RUN THE APPROVAL GOES TO, wherever in the queue it stands
   * (the review of this branch, 09.10.2026).
   *
   * <p><b>What the cases above could not say.</b> The panel finds its run again by the identity it was
   * opened on (`fixingRow`), and the cases above either open it on the first run in the queue or read
   * only what the request carries. A panel that asked for the FIRST waiting run instead approved the
   * first member's result at the figures typed for the member the panel was opened on, and left that
   * member's own run waiting: the body is the one the case expects, the panel goes away as it should,
   * and an approval cannot be taken back.
   *
   * <p>One case per run the panel can be opened on, so a run read from any one fixed place in the queue
   * is the wrong run on two of the three. What is asked of each is what the body cannot say: WHERE the
   * request went, that THIS run left the queue, and that every other run, the first among them, is
   * still waiting.
   */
  const AMENDABLE = [
    { name: 'first run', member: RUNNER, id: 701, amended: { seconds: 3300 } },
    {
      name: 'second run',
      member: '000020',
      id: 702,
      amended: { distanceKm: 52.4, ascentM: 640, descentM: 610 },
    },
    {
      name: 'third run',
      member: '000030',
      id: 703,
      amended: { distanceKm: 14.35, ascentM: 780, descentM: 210, seconds: 7200 },
    },
  ]

  it.each(AMENDABLE)(
    'approves the $name where the panel was opened on it, and leaves every other run waiting',
    async ({ member, id, amended }) => {
      const user = setupUser()
      const server = serverWith(RUNS)

      try {
        openTheQueue()

        await user.click((await rowOf(member)).getByRole('button', { name: sr.review.amend }))
        await user.click(panel().getByRole('button', { name: sr.review.amendSave }))
        await untilItHasAnswered()

        expect(decisionsIn(server.asked).map((one) => one.path)).toEqual([
          `/api/verification/${id}/decision`,
        ])
        expect(bodyOf(decisionsIn(server.asked)[0])).toEqual({ approved: true, reason: '', amended })
        expect(screen.queryByText(member)).toBeNull()
        expect(screen.queryByRole('group', { name: sr.review.amendTitle })).toBeNull()

        for (const other of [RUNNER, '000020', '000030', '000040', '000050'].filter((one) => one !== member)) {
          expect(screen.getByText(other)).toBeVisible()
        }

        expect(decidedIn().getAllByRole('listitem').map((one) => one.textContent?.split(' | ')[0])).toEqual([
          String(id),
        ])
      } finally {
        server.stop()
      }
    },
    SLOW,
  )

  it('refuses a box the member’s own form would refuse, says which, and sends nothing', async () => {
    const user = setupUser()
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.amend }))
      await user.clear(panel().getByLabelText(sr.newResult.minutes))
      await user.type(panel().getByLabelText(sr.newResult.minutes), '99')

      const save = panel().getByRole('button', { name: sr.review.amendSave })

      expect(panel().getByLabelText(sr.newResult.minutes)).toHaveAttribute('aria-invalid', 'true')
      expect(save).toHaveAttribute('aria-disabled', 'true')
      expect(save).toHaveAccessibleDescription(`${sr.newResult.minutes}: Najveća dozvoljena vrednost je 59.`)

      await user.click(save)
      await untilItHasAnswered()

      expect(decisionsIn(server.asked)).toHaveLength(0)
    } finally {
      server.stop()
    }
  })

  it('refuses no time at all, and a figure left out on a race that leaves it to the runner', async () => {
    const user = setupUser()
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.amend }))
      await user.clear(panel().getByLabelText(sr.newResult.minutes))
      await user.type(panel().getByLabelText(sr.newResult.minutes), '0')

      expect(panel().getByRole('button', { name: sr.review.amendSave })).toHaveAccessibleDescription(
        sr.newResult.needsTime,
      )

      await user.click(panel().getByRole('button', { name: sr.review.amendCancel }))
      await user.click((await rowOf('000020')).getByRole('button', { name: sr.review.amend }))
      await user.clear(panel().getByLabelText(sr.newResult.distanceKm))

      const save = panel().getByRole('button', { name: sr.review.amendSave })

      expect(save).toHaveAccessibleDescription(`${sr.newResult.distanceKm}: Ovo polje je obavezno.`)

      await user.click(save)
      await untilItHasAnswered()

      expect(decisionsIn(server.asked)).toHaveLength(0)
    } finally {
      server.stop()
    }
  })

  it('never stands open beside the box that refuses one', async () => {
    const user = setupUser()
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      const row = await rowOf(RUNNER)

      await user.click(row.getByRole('button', { name: sr.review.amend }))
      await user.click(row.getByRole('button', { name: sr.review.sendBack }))

      expect(screen.queryByRole('group', { name: sr.review.amendTitle })).toBeNull()
      expect(screen.getByLabelText(sr.review.reason)).toBeVisible()

      await user.click(row.getByRole('button', { name: sr.review.amend }))

      expect(screen.queryByLabelText(sr.review.reason)).toBeNull()
      expect(screen.getByRole('group', { name: sr.review.amendTitle })).toBeVisible()
    } finally {
      server.stop()
    }
  })

  it('closes with the route’s refusal too, and the sentence stays on the row', async () => {
    const user = setupUser()
    const server = serverWith(RUNS, () => refused('Trka još nije održana, pa rezultat ne može da se odobri.', 409))

    try {
      openTheQueue()

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.amend }))
      await user.click(panel().getByRole('button', { name: sr.review.amendSave }))

      await untilItHasAnswered()

      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect((await rowOf(RUNNER)).getByRole('alert')).toHaveTextContent('Trka još nije održana')
      expect(screen.queryByRole('group', { name: sr.review.amendTitle })).toBeNull()
      expect(await rowOf(RUNNER)).toBeDefined()
    } finally {
      server.stop()
    }
  })
})

/**
 * A DECISION THAT IS OUT WITH THE ROUTE, ASKED OF THE TWO BOXES THAT CAN SEND ONE (owner, 02.10.2026,
 * choosing between three outcomes he was priced; PDL, „Odluke iz ciscenja nalaza", first item: „Ne",
 * „Odustani" and Escape are onemoguceni while the request travels, with the state said in words, and the
 * question is closed by whoever asked it when the answer arrives. It holds for ALL the screens with a
 * confirmation, and „vracanje sa razlogom" is named among them in the second item, „Odbijanje zatvara
 * pitanje kao i uspeh": „na svaki odgovor servera pitanje se zatvara, a razlog odbijanja stoji uz dugme").
 *
 * <p><b>What the two boxes did until the review of 09.10.2026, measured.</b> „Odustani" put either box
 * away over a request that went on, so a refusal that arrived afterwards was read against nothing and
 * the typed reason had gone with the box; and neither said in words that a request was out. The queue of
 * cards (`verificationDecision.test.tsx`, „a refusal that is out with the route") and the box they share
 * (`SendBack.test.tsx`) have had both rules since 02.10.2026. This queue sent nothing to the server until
 * R1, so the rules had nothing to hold for here, and the rewrite onto the route carried neither.
 *
 * <p><b>Escape.</b> Neither box handles Escape, so there is no key of theirs to refuse
 * (`admin/EntityEditor.tsx`, `DeleteRecord`, says the same of itself). The case that presses it while a
 * request is out holds that a handler added to either box one day has to ask the same question.
 *
 * <p><b>The decision is HELD</b>, a promise that has not come back (`test/serverAnswers.ts` says why it
 * is the only way to measure a screen while it waits), so every case can press and inspect the box before
 * the route says anything. Every box is opened on the SECOND run of the queue, so the run a decision is
 * out for is not the first one the queue draws.
 */
type Box = {
  /** What a failure calls it. */
  name: string
  /** The box as a reader meets it, and nothing where none is open. */
  group: () => HTMLElement | null
  /** The button that sends what the box holds. */
  send: () => HTMLElement
  /** The button that puts the box away. */
  cancel: () => HTMLElement
  /** The box opened over the run of this member, with something typed in it that closing it would lose. */
  openOver: (user: Pressing, member: string) => Promise<void>
  /** Where that is typed. */
  typed: () => HTMLElement
  /** What it says. */
  said: string
  /** What the route is sent for the second run of the queue. */
  body: unknown
  /** What the session records once the route has taken the decision about the second run. */
  recorded: RegExp
}

const BOXES: Box[] = [
  {
    name: 'the reason for a refusal',
    group: () => screen.queryByRole('group', { name: sr.review.sendBack }),
    send: () => screen.getByRole('button', { name: sr.review.confirmSendBack }),
    cancel: () => screen.getByRole('button', { name: sr.review.cancel }),
    openOver: async (user, member) => {
      await user.click((await rowOf(member)).getByRole('button', { name: sr.review.sendBack }))
      await user.type(screen.getByLabelText(sr.review.reason), 'Vreme se ne poklapa.')
    },
    typed: () => screen.getByLabelText(sr.review.reason),
    said: 'Vreme se ne poklapa.',
    body: { approved: false, reason: 'Vreme se ne poklapa.' },
    recorded: /^702 \| rejected \| Vreme se ne poklapa\./,
  },
  {
    name: 'the figures of the moderator',
    group: () => screen.queryByRole('group', { name: sr.review.amendTitle }),
    send: () => screen.getByRole('button', { name: sr.review.amendSave }),
    cancel: () => screen.getByRole('button', { name: sr.review.amendCancel }),
    openOver: async (user, member) => {
      await user.click((await rowOf(member)).getByRole('button', { name: sr.review.amend }))
      await user.clear(screen.getByLabelText(sr.newResult.distanceKm))
      await user.type(screen.getByLabelText(sr.newResult.distanceKm), '53,1')
    },
    typed: () => screen.getByLabelText(sr.newResult.distanceKm),
    said: '53,1',
    body: { approved: true, reason: '', amended: { distanceKm: 53.1, ascentM: 640, descentM: 610 } },
    recorded: /^702 \| approved/,
  },
]

/** The member of the second run of the queue, which is the one every box here is opened over. */
const SECOND = '000020'

describe('a decision that is out with the route', () => {
  describe.each(BOXES)('over $name', (box) => {
    it('puts the box away on „Odustani" while nothing is out, and sends nothing', async () => {
      const user = setupUser()
      const server = serverWith(RUNS)

      try {
        openTheQueue()

        await box.openOver(user, SECOND)

        /* Told off by nothing, so what follows is the box's own state and not a leftover. */
        expect(box.cancel()).not.toHaveAttribute('aria-disabled', 'true')
        expect(sending()).toHaveLength(0)

        await user.click(box.cancel())
        await untilItHasAnswered()

        expect(box.group()).toBeNull()
        expect(decisionsIn(server.asked)).toHaveLength(0)
      } finally {
        server.stop()
      }
    }, SLOW)

    it('tells „Odustani" off while the decision is out, and keeps the box with what was typed in it', async () => {
      const user = setupUser()
      const decision = heldDecision()
      const server = serverWith(RUNS, decision.decided)

      try {
        openTheQueue()

        await box.openOver(user, SECOND)
        await user.click(box.send())

        const keep = box.cancel()

        /* TOLD OFF AND NOT SWITCHED OFF: the control that was pressed has the focus, and a native
           `disabled` would drop it to the top of the document (`SendBack.tsx` says the same). */
        expect(keep).toHaveAttribute('aria-disabled', 'true')
        expect(keep).not.toBeDisabled()

        await user.click(keep)

        /* THE BOX IS STILL THERE, with what was typed in it: put away, it took the moderator's words
           with it, and a refusal that arrived afterwards was drawn above buttons with nothing to be
           read against. */
        expect(box.group()).not.toBeNull()
        expect(box.typed()).toHaveValue(box.said)

        decision.release()

        /* AND THE ANSWER CLOSES THE BOX, which „Odustani" could not: nobody pressed anything to close
           it (the owner's „list se zatvara sam kad stigne odgovor"). */
        await waitFor(() => {
          expect(box.group()).toBeNull()
        })
        await untilItHasAnswered()

        expect(decisionsIn(server.asked).map((one) => one.path)).toEqual(['/api/verification/702/decision'])
        expect(bodyOf(decisionsIn(server.asked)[0])).toEqual(box.body)
        expect(decidedIn().getByText(box.recorded)).toBeInTheDocument()
        expect(screen.queryByText(SECOND)).toBeNull()
      } finally {
        server.stop()
      }
    }, SLOW)

    it('says that it is sending, only while it is', async () => {
      const user = setupUser()
      const decision = heldDecision()
      const server = serverWith(RUNS, decision.decided)

      try {
        openTheQueue()

        await box.openOver(user, SECOND)

        expect(sending()).toHaveLength(0)

        await user.click(box.send())

        expect(sending()).toHaveLength(1)
        /* IN THE BOX AND NOT BESIDE IT, so it is said where the buttons that cannot act are. */
        expect(within(must(box.group(), 'the box')).getByRole('status')).toHaveTextContent(sr.results.sending)

        decision.release()
        await waitFor(() => {
          expect(box.group()).toBeNull()
        })

        expect(sending()).toHaveLength(0)
      } finally {
        server.stop()
      }
    }, SLOW)

    it('is not put away by Escape while the decision is out', async () => {
      const user = setupUser()
      const decision = heldDecision()
      const server = serverWith(RUNS, decision.decided)

      try {
        openTheQueue()

        await box.openOver(user, SECOND)
        await user.click(box.send())

        /* PRESSED WHERE THE MODERATOR'S HANDS ARE: the button he just pressed has the focus, and it is
           inside the box. A press made with the focus on the page behind it would pass whatever a
           handler on the box did. */
        expect(box.send()).toHaveFocus()

        await user.keyboard('{Escape}')

        expect(box.group()).not.toBeNull()
        expect(box.typed()).toHaveValue(box.said)

        decision.release()
        await waitFor(() => {
          expect(box.group()).toBeNull()
        })
        await untilItHasAnswered()

        expect(decisionsIn(server.asked)).toHaveLength(1)
      } finally {
        server.stop()
      }
    }, SLOW)

    it('closes by itself when the route refuses, and leaves the sentence on the run’s row', async () => {
      /* THE OWNER'S RULE OF 02.10.2026 (PDL, „Odbijanje zatvara pitanje kao i uspeh"): „na svaki odgovor
         servera pitanje se zatvara, a razlog odbijanja stoji uz dugme". Nobody pressed „Odustani", so a
         box that is gone is one the ANSWER closed; the sentence is the one the route named, drawn on
         the row it is about where this screen has always drawn it. */
      const user = setupUser()
      const decision = heldDecision(() => refused('O stavci je već odlučeno.', 409))
      const server = serverWith(RUNS, decision.decided)

      try {
        openTheQueue()

        await box.openOver(user, SECOND)
        await user.click(box.send())

        decision.release()
        await waitFor(() => {
          expect(box.group()).toBeNull()
        })
        await untilItHasAnswered()

        expect(sending()).toHaveLength(0)
        expect(screen.getAllByRole('alert')).toHaveLength(1)
        expect((await rowOf(SECOND)).getByRole('alert')).toHaveTextContent('O stavci je već odlučeno.')
        /* And nothing was recorded, which is what a refusal is: the run is still waiting. */
        expect(decidedIn().queryAllByRole('listitem')).toHaveLength(0)
      } finally {
        server.stop()
      }
    }, SLOW)

    it('can be opened again after a refusal, with nothing of the first attempt left on it', async () => {
      /* WHAT THE FIRST ATTEMPT RAISED IS LET GO OF: a flag left standing after the answer would tell
         the second box off and make it say it is sending before anything was pressed, beside a button
         that looks live. */
      const user = setupUser()
      const decision = heldDecision(() => refused('O stavci je već odlučeno.', 409))
      const server = serverWith(RUNS, decision.decided)

      try {
        openTheQueue()

        await box.openOver(user, SECOND)
        await user.click(box.send())

        decision.release()
        await waitFor(() => {
          expect(box.group()).toBeNull()
        })
        await untilItHasAnswered()

        await box.openOver(user, SECOND)

        expect(box.cancel()).not.toHaveAttribute('aria-disabled', 'true')
        expect(sending()).toHaveLength(0)

        /* AND IT SENDS WHAT IT IS PRESSED FOR, which the attributes cannot say: the second asking
           reaches the route. */
        await user.click(box.send())
        await waitFor(() => {
          expect(decisionsIn(server.asked)).toHaveLength(2)
        })
        await waitFor(() => {
          expect(box.group()).toBeNull()
        })
      } finally {
        server.stop()
      }
    }, SLOW)

    it('does not tell the box off for a decision about another run, and puts it away', async () => {
      /* A SOURCE REPLACEMENT, ASKED AS A CASE: „a request is out for THIS run" against „a request is
         out". `deciding` is true for any decision on the tab, and a box opened over another run while
         one is held has nothing of its own out - its buttons that cannot act are the ones that would
         SEND (`aria-disabled={deciding}`, one decision at a time over the whole tab), and it must not
         say a request is out that is not its own (the same fault the review of 02.10.2026 measured on
         the queue of cards, `verificationDecision.test.tsx`). */
      const user = setupUser()
      const decision = heldDecision()
      const server = serverWith(RUNS, (id) => (id === '701' ? decision.decided() : taken()))

      try {
        openTheQueue()

        await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.approve }))
        await waitFor(() => {
          expect(decisionsIn(server.asked)).toHaveLength(1)
        })

        await box.openOver(user, SECOND)

        expect(box.cancel()).not.toHaveAttribute('aria-disabled', 'true')
        expect(sending()).toHaveLength(0)

        await user.click(box.cancel())

        expect(box.group()).toBeNull()

        decision.release()
        await untilItHasAnswered()

        expect(decisionsIn(server.asked).map((one) => one.path)).toEqual(['/api/verification/701/decision'])
      } finally {
        server.stop()
      }
    }, SLOW)
  })
})

describe('the one decision for the whole queue', () => {
  it('approves every run on a race the calendar holds, one request each, and steps over the rest', async () => {
    const user = setupUser()
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      await rowOf(RUNNER)
      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      /* The number the sweep will really decide, which is three and not five. */
      expect(ask).toHaveBeenCalledWith('Odobriti 3 stavke? Ovo se ne može opozvati.')

      expect(await sweptSays('Rešene su 3 stavke.')).toHaveFocus()
      expect(decisionsIn(server.asked).map((one) => one.path)).toEqual([
        '/api/verification/701/decision',
        '/api/verification/702/decision',
        '/api/verification/703/decision',
      ])
      for (const one of decisionsIn(server.asked)) {
        expect(bodyOf(one)).toEqual({ approved: true, reason: '' })
      }
      /* And what it stepped over, said where it says what it did. The row naming no run is not a
         run on a race the calendar does not hold, so it is not counted among them. */
      expect(
        screen.getByText('Ostala je 1 prijava sa trka kojih nema u kalendaru. Takva prijava se odavde ne može odobriti.'),
      ).toBeVisible()
      expect(screen.getByText('000040')).toBeVisible()
      expect(screen.getByText('000050')).toBeVisible()
    } finally {
      server.stop()
    }
  })

  it('walks on past a run the route will not take, and says the route’s sentence on that run’s row', async () => {
    /* A refusal halfway through the walk, with a run settled before it and one after it, so a walk
       that stopped at the refusal and one that stepped over it do not end the same. */
    const user = setupUser()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const server = serverWith(RUNS, (id) => (id === '702' ? refused('O stavci je već odlučeno.', 409) : taken()))

    try {
      openTheQueue()

      await rowOf(RUNNER)
      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(await sweptSays('Rešene su 2 stavke.')).toBeVisible()
      expect(decisionsIn(server.asked).map((one) => one.path)).toEqual([
        '/api/verification/701/decision',
        '/api/verification/702/decision',
        '/api/verification/703/decision',
      ])
      expect((await rowOf('000020')).getByRole('alert')).toHaveTextContent('O stavci je već odlučeno.')
      expect(screen.queryByText(RUNNER)).toBeNull()
      expect(screen.queryByText('000030')).toBeNull()
      expect(decidedIn().getAllByRole('listitem').map((one) => one.textContent?.split(' | ')[0])).toEqual([
        '701',
        '703',
      ])
    } finally {
      server.stop()
    }
  })

  it('settles nothing where the route takes none, and says the first sentence on the row it is about', async () => {
    /* The same sentence on every run, so which row carries it is the whole question: the first
       refusal and not the last, and one sentence and not three, the shape the queue of cards
       has (`PendingQueue.tsx`, „The first of them, on the card it is about"). */
    const user = setupUser()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const server = serverWith(RUNS, () => refused('O stavci je već odlučeno.', 409))

    try {
      openTheQueue()

      await rowOf(RUNNER)
      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(await sweptSays('Rešeno je 0 stavki.')).toBeVisible()
      expect(decisionsIn(server.asked)).toHaveLength(3)
      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect((await rowOf(RUNNER)).getByRole('alert')).toHaveTextContent('O stavci je već odlučeno.')
      expect(decidedIn().queryAllByRole('listitem')).toHaveLength(0)
    } finally {
      server.stop()
    }
  })

  it('sends one walk for two presses with nothing awaited between them', async () => {
    /* TWO RAW CLICKS IN ONE `act`, the precedent `verificationDecision.test.tsx` gives for the
       queue of cards: `user.click` and `fireEvent.click` each let React render after their own
       click, so the flag the button reads would already have caught up and the guard inside the
       walk would never be asked. That nothing committed between these two is what the second
       question proves: the second press got past the flag and was stopped by the ref. */
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      await rowOf(RUNNER)

      const sweep = screen.getByRole('button', { name: 'Odobri sve' })

      act(() => {
        sweep.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        sweep.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      expect(await sweptSays('Rešene su 3 stavke.')).toBeVisible()
      expect(ask).toHaveBeenCalledTimes(2)
      expect(decisionsIn(server.asked).map((one) => one.path)).toEqual([
        '/api/verification/701/decision',
        '/api/verification/702/decision',
        '/api/verification/703/decision',
      ])
    } finally {
      server.stop()
    }
  })

  it('counts what is left in the plural the number really takes', async () => {
    const user = setupUser()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const server = serverWith([OF_A_LENGTH, NOT_IN_THE_CALENDAR, { ...NOT_IN_THE_CALENDAR, id: 706, memberNumber: '000060' }])

    try {
      openTheQueue()

      await rowOf(RUNNER)
      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      await sweptSays('Rešena je 1 stavka.')

      expect(
        screen.getByText('Ostale su 2 prijave sa trka kojih nema u kalendaru. Takve prijave se odavde ne mogu odobriti.'),
      ).toBeVisible()
    } finally {
      server.stop()
    }
  })

  it('says nothing about what is left before anybody has swept, or where it left nothing', async () => {
    const user = setupUser()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const server = serverWith([OF_A_LENGTH, TO_A_LIMIT])

    try {
      openTheQueue()

      await rowOf(RUNNER)
      expect(screen.queryByText(/kojih nema u kalendaru/)).toBeNull()

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(await sweptSays('Rešene su 2 stavke.')).toBeVisible()
      expect(screen.queryByText(/kojih nema u kalendaru/)).toBeNull()
    } finally {
      server.stop()
    }
  })

  it('settles nothing when the question is answered no', async () => {
    const user = setupUser()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      await rowOf(RUNNER)
      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))
      await untilItHasAnswered()

      expect(decisionsIn(server.asked)).toHaveLength(0)
      expect(screen.queryByText(/Rešen/)).toBeNull()
    } finally {
      server.stop()
    }
  })

  it('is not offered where nothing waiting is on a race the calendar holds', async () => {
    const server = serverWith([NOT_IN_THE_CALENDAR, NAMING_NO_RUN])

    try {
      openTheQueue()

      await rowOf('000040')
      expect(screen.queryByRole('button', { name: 'Odobri sve' })).toBeNull()
    } finally {
      server.stop()
    }
  })

  it('leaves a box standing over a row it stepped over', async () => {
    const user = setupUser()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      await user.click((await rowOf('000040')).getByRole('button', { name: sr.review.sendBack }))
      await user.type(screen.getByLabelText(sr.review.reason), 'Napisano pre odobravanja')
      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))
      await sweptSays('Rešene su 3 stavke.')

      expect(screen.getByLabelText(sr.review.reason)).toHaveValue('Napisano pre odobravanja')
    } finally {
      server.stop()
    }
  })

  it('takes away a box standing over a row it settled', async () => {
    const user = setupUser()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const server = serverWith(RUNS)

    try {
      openTheQueue()

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.amend }))
      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))
      await sweptSays('Rešene su 3 stavke.')

      expect(screen.queryByRole('group', { name: sr.review.amendTitle })).toBeNull()
    } finally {
      server.stop()
    }
  })
})

describe('what a decision leaves for the screens that read after it', () => {
  /** How many times this address was read. */
  const reads = (asked: Asked[], path: string): number =>
    asked.filter((one) => one.path === path && (one.init?.method ?? 'GET') === 'GET').length

  it('makes them read the server again after what the route took, from either door, and after nothing else', async () => {
    /* A reader asks the server only as it mounts (`data/useResource.ts`), so each step leaves the
       queue for the front page, which reads the standings, and comes back, which reads the queue: a
       cache that was dropped is read again on the way, and one that was kept is not. Each count is
       read once its screen has drawn with what it read, so an absence is never read off a screen
       that had not asked yet.
     *
       Both caches, both doors, all three answers. What the route refused changed nothing on the
       server, so it drops nothing (`PendingQueue.tsx`: a screen throwing away an answer it still
       has every reason to trust); a decision the route took changes the queue; and an approval is
       the one decision that changes the standings as well. */
    const user = setupUser()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let takes = false
    const server = serverWith(RUNS, () => (takes ? taken() : refused('O stavci je već odlučeno.', 409)))

    try {
      const { router } = openTheQueue()

      const awayAndBack = async (): Promise<{ queue: number; standings: number }> => {
        await router.navigate('/sr')
        await screen.findByRole('heading', { level: 2, name: 'Reč predsednika' })
        await router.navigate(PATH)
        await screen.findByRole('table', { name: sr.review.waiting })

        return { queue: reads(server.asked, '/api/verification'), standings: reads(server.asked, '/api/results') }
      }

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.approve }))
      await untilItHasAnswered()

      expect(screen.getAllByRole('alert')).toHaveLength(1)

      expect(await awayAndBack(), 'an approval the route refused').toEqual({ queue: 1, standings: 1 })

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))
      await sweptSays('Rešeno je 0 stavki.')

      expect(await awayAndBack(), 'a sweep the route took nothing from').toEqual({ queue: 1, standings: 1 })

      takes = true
      await user.click((await rowOf('000020')).getByRole('button', { name: sr.review.sendBack }))
      await user.type(screen.getByLabelText(sr.review.reason), 'Vreme se ne poklapa.')
      await user.click(screen.getByRole('button', { name: sr.review.confirmSendBack }))
      await untilItHasAnswered()

      expect(screen.queryByText('000020')).toBeNull()

      expect(await awayAndBack(), 'a refusal the route took').toEqual({ queue: 2, standings: 1 })

      await user.click((await rowOf(RUNNER)).getByRole('button', { name: sr.review.approve }))
      await untilItHasAnswered()

      expect(screen.queryByText(RUNNER)).toBeNull()
      expect(await awayAndBack(), 'an approval the route took').toEqual({ queue: 3, standings: 2 })

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))
      await sweptSays('Rešena je 1 stavka.')

      expect(await awayAndBack(), 'a sweep the route took something from').toEqual({ queue: 4, standings: 3 })
    } finally {
      server.stop()
    }
  }, SLOW)
})
