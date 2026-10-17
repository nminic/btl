import { cleanup, configure, getConfig, screen, within } from '@testing-library/react'
import { clearResourceCache, loadResource } from '../../data/client'
import type { BtlEvent, Race } from '../../data/types'
import { at, inputElement, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { serverThat } from '../../test/serverAnswers'
import sr from '../../i18n/sr.json'
import { SLOW } from '../../test/slow'

/**
 * What the form that reports a result draws, and in how many lines.
 *
 * Owner, 16.10.2026, in his words: „Ukoliko je vremenska trka, unose se u JEDNOM redu Dužina,
 * uspon, spust, sa mernim jedinicama u zagradama. Ako je dužinska, unose se u JEDNOM redu Sati,
 * Minuti, Sekunde (tako se zovu). Ako je slobodno u prvom redu ovo od vremenske, a u drugom ovo
 * od dužinske. Pa se forma nastavlja dalje kako i izgleda trenutno." And on the sentence over the
 * form: „Ceo disclaimer sa vrha strane obriši".
 *
 * <p>A file of its own, and it serves its own races, because every race in
 * `public/mock/races.json` is a race of a length and the other two kinds can be asked about
 * nowhere else. One event is dressed up so that its races are of all three kinds at once, and
 * the address names which one is being reported: so the layout can come from the race the
 * address names or from something else, and only the first of those passes every case below.
 * That is the second source of the kind, and it is the one the cases separate.
 */

/* EVERY WAIT OF THIS FILE IS GIVEN HALF OF THE TIME A CASE HAS. The global is `SLOW` for both
   (`test/setup.ts`), so a wait that never succeeds and the case that is waiting for it would have the
   same twenty seconds, and a box that is not drawn would be told by a clock and not by an assertion.
   Set here, and so for this file alone: every file has a configuration of its own. */
configure({ asyncUtilTimeout: SLOW / 2 })

const ME = '000007'

/** An event with at least three races, which the file holds: the twelve of Maraton maratona. */
const EVENT = 'maraton-maratona-2015'

/** The kind of the n-th race of an event, by its place in the event. */
const KINDS = ['length', 'time', 'free'] as const

type Kind = (typeof KINDS)[number]

/** A race dressed as the kind, the way `pages/timedRace.test.tsx` dresses them: a timed race has
 *  its limit and no length, a free one neither. */
function dressed(race: Race, kind: Kind): Race {
  if (kind === 'length') {
    return race
  }

  return { ...race, kind, limitSeconds: kind === 'time' ? 86_400 : 0, distanceKm: 0 }
}

/**
 * The races served with the first three of EVERY event being a race of a length, a timed race and
 * a free one, in that order. Reshaped inside the stub and not fetched first and handed over,
 * because the portal keeps the answer to a file it has already read.
 */
function serveThreeKinds(): () => void {
  const real = globalThis.fetch
  const server = serverThat((path, init) => {
    if (!path.endsWith('/api/races') || (init?.method ?? 'GET') !== 'GET') {
      return null
    }

    return real(path).then(async (answer) => {
      const all: Race[] = await answer.json()
      const seen = new Map<number, number>()

      return new Response(
        JSON.stringify(
          all.map((one) => {
            const place = seen.get(one.eventId) ?? 0

            seen.set(one.eventId, place + 1)

            return dressed(one, KINDS[place] ?? 'length')
          }),
        ),
        { status: 200 },
      )
    })
  })

  return server.stop
}

/** The address of the form for the race of that kind, on the event dressed above. */
async function addressOf(kind: Kind) {
  const events = await loadResource<BtlEvent[]>('events')
  const held = must(
    events.find((one) => one.slug === EVENT),
    'the event these cases are written around',
  )
  const races = (await loadResource<Race[]>('races')).filter((one) => one.eventId === held.id)
  const race = must(
    races.find((one) => one.kind === kind),
    `the ${kind} race of the event`,
  )

  expect(races.map((one) => one.kind).slice(0, 3), 'the event is not dressed as the cases assume').toEqual([
    ...KINDS,
  ])

  return `/sr/kalendar/${EVENT}/prijava?trka=${race.id}`
}

/** The line of the form a box stands on, which is the element the renderer draws round the
 *  boxes that name the same row, and nothing at all round a box that names none. */
function lineOf(label: string): HTMLElement | null {
  return screen.getByLabelText(label).closest<HTMLElement>('.form__row')
}

/** The boxes on a line, by the names a reader hears for them, in the order they stand. */
function boxesOn(line: HTMLElement): string[] {
  return within(line)
    .getAllByRole('textbox')
    .map((one) => must(inputElement(one).labels?.[0]?.textContent, 'the label of a box'))
}

const THE_LENGTH = ['Dužina (km)', 'Uspon (m)', 'Spust (m)']
const THE_TIME = ['Sati', 'Minuti', 'Sekunde']

/** How many different lines the boxes of the form stand on. A box on no line is not counted. */
function linesOfTheForm(): number {
  const main = screen.getByRole('main')
  const lines = within(main)
    .getAllByRole('textbox')
    .flatMap((one) => {
      const line = one.closest('.form__row')

      return line === null ? [] : [line]
    })

  return new Set(lines).size
}

describe('the measures of a result, in lines by the kind of the race the address names', () => {
  let stop = (): void => undefined

  beforeEach(() => {
    clearResourceCache()
    stop = serveThreeKinds()
  })

  afterEach(() => {
    stop()
    cleanup()
  })

  it('puts the time of a race of a length in ONE line, under the names the owner gave it', async () => {
    renderAt(await addressOf('length'), 'competitor', ME)

    await screen.findByLabelText('Sati')

    const line = must(lineOf('Sati'), 'the line of the hours')

    expect(boxesOn(line)).toEqual(THE_TIME)
    /* The same line for all three, which is the whole of „u jednom redu", and the only line. */
    expect(lineOf('Minuti')).toBe(line)
    expect(lineOf('Sekunde')).toBe(line)
    expect(linesOfTheForm()).toBe(1)
    /* And the other three are not asked, because the race carries them. */
    expect(screen.queryByLabelText('Dužina (km)')).toBeNull()
    expect(screen.queryByLabelText('Uspon (m)')).toBeNull()
    expect(screen.queryByLabelText('Spust (m)')).toBeNull()
  })

  it('puts the length, the climb and the fall of a timed race in ONE line, with their units', async () => {
    renderAt(await addressOf('time'), 'competitor', ME)

    await screen.findByLabelText('Dužina (km)')

    const line = must(lineOf('Dužina (km)'), 'the line')

    expect(boxesOn(line)).toEqual(THE_LENGTH)
    expect(lineOf('Uspon (m)')).toBe(line)
    expect(lineOf('Spust (m)')).toBe(line)
    expect(linesOfTheForm()).toBe(1)
    /* A timed race is the same length of time for everybody who finished it, so no time is asked. */
    expect(screen.queryByLabelText('Sati')).toBeNull()
    expect(screen.queryByLabelText('Minuti')).toBeNull()
    expect(screen.queryByLabelText('Sekunde')).toBeNull()
  })

  it('gives a free race both lines, the length first and the time under it', async () => {
    renderAt(await addressOf('free'), 'competitor', ME)

    await screen.findByLabelText('Dužina (km)')

    const measured = must(lineOf('Dužina (km)'), 'the first line')
    const timed = must(lineOf('Sati'), 'the second line')

    expect(boxesOn(measured)).toEqual(THE_LENGTH)
    expect(boxesOn(timed)).toEqual(THE_TIME)
    expect(linesOfTheForm()).toBe(2)
    /* Two lines and not one line of six, and the length ABOVE the time („u prvom redu ovo od
       vremenske, a u drugom ovo od dužinske"). Neither contains the other, so the order is the
       order of the page and not the order of a nesting. */
    expect(measured).not.toBe(timed)
    expect(measured.contains(timed)).toBe(false)
    expect(timed.contains(measured)).toBe(false)
    expect(measured.compareDocumentPosition(timed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0)
  })

  it.each(KINDS)('goes on below the lines as it did, for a %s race: the link and the comment stand on none', async (kind) => {
    renderAt(await addressOf(kind), 'competitor', ME)

    await screen.findByLabelText(kind === 'time' ? 'Dužina (km)' : 'Sati')

    for (const stands of [/^Link ka zvaničnim/, /^Komentar/]) {
      expect(screen.getByLabelText(stands).closest('.form__row')).toBeNull()
    }

    expect(screen.getByRole('button', { name: sr.report.submit })).toBeVisible()
  })

  it.each(KINDS)('says nothing between the heading and the first box of a %s race', async (kind) => {
    /* Owner, 16.10.2026: „Ceo disclaimer sa vrha strane obriši". Asked of every paragraph that
       stands after the heading and before the first box, and not of the one sentence that was
       there, which a rewording would walk past. The one sentence the renderer itself draws there
       is the note on the asterisk, and it is another screen's to remove (`forms/AskedLabel.tsx`),
       so it is left out of the count by what it says rather than by where it stands. */
    renderAt(await addressOf(kind), 'competitor', ME)

    const heading = await screen.findByRole('heading', { level: 1, name: sr.report.title })
    const main = screen.getByRole('main')
    const box = at(within(main).getAllByRole('textbox'), 0)

    const between = [...main.querySelectorAll('p')].filter(
      (one) =>
        heading.compareDocumentPosition(one) & Node.DOCUMENT_POSITION_FOLLOWING &&
        !one.contains(box) &&
        one.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING &&
        one.textContent !== sr.form.requiredNote,
    )

    expect(
      between.map((one) => one.textContent),
      'a sentence stands between the heading and the first box',
    ).toEqual([])
  })

  it('lays the form out by the race the address names and not by the first race of the event', async () => {
    /* The second source of the kind. The first race of this event is a race of a length, and a
       screen that read the kind off it would draw the time in one line for all three addresses.
       The three addresses are walked in the order that separates them from each other. */
    for (const kind of ['free', 'time', 'length'] as const) {
      cleanup()
      renderAt(await addressOf(kind), 'competitor', ME)

      await screen.findByLabelText(kind === 'time' ? 'Dužina (km)' : 'Sati')

      expect(linesOfTheForm(), `${kind}: the number of lines`).toBe(kind === 'free' ? 2 : 1)
      expect(screen.queryByLabelText('Sati') === null, `${kind}: the hours are asked`).toBe(kind === 'time')
    }
  })
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
