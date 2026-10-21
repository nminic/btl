import { act, render, screen } from '@testing-library/react'
import { loadResource } from '../data/client'
import { inYearlyWindow, seasonRunning } from '../data/season'
import type { BtlEvent } from '../data/types'
import { ageOn } from '../forms/dateField'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { ClockProvider } from './ClockProvider'
import { belgradeDay, realToday } from './context'
import { useClock, useToday, useTodayDate } from './useClock'

/* THE DAY THE PORTAL READS IS BELGRADE'S (owner, 20.10.2026, ADL A7, "Zajednički sat
 * ekrana vraća beogradski dan").
 *
 * Every instant below is chosen so that the UTC day and the Belgrade day are DIFFERENT
 * calendar days. A case where they agree measures nothing: the machine's zone, a fixed
 * offset and the zone rules would all give the same string. The zone-free pair in each
 * row is what separates the sources.
 *
 * This file is in src/clock/ on purpose: `test/setup.ts` pins `realToday` for every other
 * test (to make the suite independent of the day it is run on), and the clock's own tests
 * are the ones allowed to ask the machine itself (`test/theDay.ts`, THE_CLOCKS_OWN_TESTS).
 * The system time is moved with fake timers that fake nothing but `Date`, so the screens
 * drawn here fetch and settle on their real timers. */

/** [what it is, the instant, the Belgrade day, the UTC day it must not be]. */
const ROWS: Array<[string, string, string, string]> = [
  // Winter, CET (UTC+1): 23:30 UTC is 00:30 on the next day.
  ['00:30 in winter', '2026-01-14T23:30:00Z', '2026-01-15', '2026-01-14'],
  // Summer, CEST (UTC+2): 23:30 UTC is 01:30 on the next day. A fixed +1 h says the 14th.
  ['01:30 in summer', '2026-07-14T23:30:00Z', '2026-07-15', '2026-07-14'],
  // The edge in summer, to the minute: 22:00 UTC is midnight in Belgrade.
  ['23:59 in summer, last minute of the day', '2026-07-14T21:59:00Z', '2026-07-14', '2026-07-14'],
  ['00:00 in summer, first minute of the day', '2026-07-14T22:00:00Z', '2026-07-15', '2026-07-14'],
  // And in winter: 23:00 UTC is midnight.
  ['23:59 in winter, last minute of the day', '2026-01-14T22:59:00Z', '2026-01-14', '2026-01-14'],
  ['00:00 in winter, first minute of the day', '2026-01-14T23:00:00Z', '2026-01-15', '2026-01-14'],
  // The season boundary: 1 January begins in Belgrade at 23:00 UTC on 31 December.
  ['the new year, 00:30', '2026-12-31T23:30:00Z', '2027-01-01', '2026-12-31'],
  // Spring forward, 29.03.2026: 01:00 UTC is 02:00 CET -> 03:00 CEST.
  ['the night before the spring change, 00:30 CET', '2026-03-28T23:30:00Z', '2026-03-29', '2026-03-28'],
  ['the spring change day, 03:30 CEST', '2026-03-29T01:30:00Z', '2026-03-29', '2026-03-29'],
  ['the spring change day, 23:59 CEST', '2026-03-29T21:59:00Z', '2026-03-29', '2026-03-29'],
  ['the spring change day, midnight CEST', '2026-03-29T22:00:00Z', '2026-03-30', '2026-03-29'],
  // Fall back, 25.10.2026: 01:00 UTC is 03:00 CEST -> 02:00 CET.
  ['the night before the autumn change, midnight CEST', '2026-10-24T22:00:00Z', '2026-10-25', '2026-10-24'],
  ['the night before the autumn change, 23:59 CEST', '2026-10-24T21:59:00Z', '2026-10-24', '2026-10-24'],
  ['the autumn change day, 23:59 CET', '2026-10-25T22:59:00Z', '2026-10-25', '2026-10-25'],
  ['the autumn change day, midnight CET', '2026-10-25T23:00:00Z', '2026-10-26', '2026-10-25'],
]

describe('the day an instant falls on in Belgrade', () => {
  it.each(ROWS)('%s', (_name, instant, belgrade) => {
    expect(belgradeDay(new Date(instant))).toBe(belgrade)
  })

  it('separates the two sources on every row that is not a control', () => {
    /* The guard for the table itself: a row whose UTC day equals its Belgrade day is a
       control, and the table must still hold plenty that are not, or it separates nothing. */
    const separating = ROWS.filter(([, instant, belgrade]) => instant.slice(0, 10) !== belgrade)

    expect(separating.length).toBeGreaterThanOrEqual(8)
    for (const [, instant, belgrade] of separating) {
      expect(new Date(instant).toISOString().slice(0, 10)).not.toBe(belgrade)
    }
  })
})

/** A reader that shows everything the portal derives from the one clock. */
function Reader() {
  const { simulated, simulate } = useClock()
  const today = useToday()
  const asDate = useTodayDate()

  return (
    <>
      <span data-testid="danas">{today}</span>
      <span data-testid="simulirano">{simulated ?? 'ne'}</span>
      <span data-testid="kaoDatum">{asDate.toISOString()}</span>
      <span data-testid="sezona">{String(seasonRunning(today))}</span>
      <span data-testid="prozor">{String(inYearlyWindow(today))}</span>
      <span data-testid="sesnaest">{String(ageOn(new Date(Date.UTC(2010, 9, 25)), asDate))}</span>
      <button type="button" onClick={() => simulate(null)}>
        vrati
      </button>
    </>
  )
}

function renderClock(simulatedDay: string | null = null) {
  return render(
    <ClockProvider simulatedDay={simulatedDay}>
      <Reader />
    </ClockProvider>,
  )
}

/** Runs `body` with the system time at `instant`, faking nothing but `Date`. */
function at<T>(instant: string, body: () => T): T {
  vi.useFakeTimers({ toFake: ['Date'] })

  try {
    vi.setSystemTime(new Date(instant))

    return body()
  } finally {
    vi.useRealTimers()
  }
}

describe('the shared clock', () => {
  it.each(ROWS)('reads %s as the Belgrade day', (_name, instant, belgrade) => {
    at(instant, () => {
      expect(realToday()).toBe(belgrade)

      renderClock()

      expect(screen.getByTestId('danas')).toHaveTextContent(belgrade)
    })
  })

  it('reads the day Belgrade is on whatever zone the machine is in', () => {
    /* Three machines, one of them on Belgrade itself, which would let a formatter that is
       given no zone give the right answer by accident. Measured that the zone really moved
       (as `i18n/format.test.ts` does): without that, every row would pass on whichever zone
       the process started in. */
    const set = process.env.TZ
    const here = set ?? Intl.DateTimeFormat().resolvedOptions().timeZone

    try {
      // The zone and what o'clock noon UTC on 5 January is there (UTC+13, UTC-8, UTC).
      const zones: Array<[string, number]> = [
        ['Pacific/Auckland', 1],
        ['America/Los_Angeles', 4],
        ['UTC', 12],
      ]

      for (const [zone, hourThere] of zones) {
        process.env.TZ = zone

        expect(
          new Date('2019-01-05T12:00:00Z').getHours(),
          'the zone did not move on this machine, so this case measures nothing',
        ).toBe(hourThere)

        for (const [, instant, belgrade] of ROWS) {
          expect(belgradeDay(new Date(instant)), `${zone} at ${instant}`).toBe(belgrade)
          at(instant, () => {
            expect(realToday(), `${zone} at ${instant}`).toBe(belgrade)
          })
        }
      }
    } finally {
      process.env.TZ = here

      if (set === undefined) {
        delete process.env.TZ
      }
    }
  })

  it('reads the new year at 00:30 on 1 January in Belgrade, when UTC is still on the 31st', () => {
    at('2026-12-31T23:30:00Z', () => {
      renderClock()

      expect(screen.getByTestId('danas')).toHaveTextContent('2027-01-01')
      // The season the league runs: nothing before 2027, and 2027 from the first minute.
      expect(screen.getByTestId('sezona')).toHaveTextContent('2027')
      // And the yearly window, which shut at the end of 31 December.
      expect(screen.getByTestId('prozor')).toHaveTextContent('false')
    })
  })

  it('counts the years of somebody whose birthday began an hour ago in Belgrade', () => {
    /* Born 25.10.2010, so sixteen on 25.10.2026. At 00:30 on the 25th in Belgrade it is
       still the 24th in UTC, and the reader on the registration form (`useTodayDate`)
       must already be sixteen. */
    at('2026-10-24T22:30:00Z', () => {
      renderClock()

      expect(screen.getByTestId('danas')).toHaveTextContent('2026-10-25')
      expect(screen.getByTestId('kaoDatum')).toHaveTextContent('2026-10-25T00:00:00.000Z')
      expect(screen.getByTestId('sesnaest')).toHaveTextContent('16')
    })
  })

  it('moves to the Belgrade next day when the clock passes Belgrade midnight under an open tab', () => {
    vi.useFakeTimers()

    try {
      // 23:59:30 in Belgrade in summer, which is 21:59:30 UTC.
      vi.setSystemTime(new Date('2026-07-14T21:59:30Z'))
      renderClock()
      expect(screen.getByTestId('danas')).toHaveTextContent('2026-07-14')

      act(() => {
        // 00:00:30 in Belgrade on the 15th, still 22:00:30 UTC on the 14th.
        vi.setSystemTime(new Date('2026-07-14T22:00:30Z'))
        vi.advanceTimersByTime(60_000)
      })

      expect(screen.getByTestId('danas')).toHaveTextContent('2026-07-15')
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the simulated day of the development switch, whatever the machine says', () => {
    at('2026-07-14T23:30:00Z', () => {
      renderClock('2027-05-05')

      expect(screen.getByTestId('danas')).toHaveTextContent('2027-05-05')
      expect(screen.getByTestId('simulirano')).toHaveTextContent('2027-05-05')
    })
  })

  it('hands the clock back to the Belgrade day, not the UTC one, when the simulation is cleared', () => {
    at('2026-07-14T23:30:00Z', () => {
      renderClock('2027-05-05')

      act(() => {
        screen.getByRole('button', { name: 'vrati' }).click()
      })

      expect(screen.getByTestId('danas')).toHaveTextContent('2026-07-15')
      expect(screen.getByTestId('simulirano')).toHaveTextContent('ne')
    })
  })
})

describe('the announcement of arrival on an event page, read on the real clock', () => {
  const ME = '000007'
  const theSwitch = () => screen.queryByRole('button', { name: 'Idem na ovaj događaj' })

  /** An event on a day of the given months, so one case is a winter day and one a summer one. */
  async function eventIn(months: string[]): Promise<BtlEvent> {
    const events = await loadResource<BtlEvent[]>('events')

    return must(
      events.find((one) => months.includes(one.date.slice(5, 7)) && Number(one.date.slice(8)) > 3),
      `an event in month ${months.join('/')}`,
    )
  }

  it.each([
    ['winter', ['01', '02']],
    ['summer', ['06', '07', '08']],
  ])(
    'is not offered for yesterday\'s event at 00:30 or 01:30 Belgrade, in %s, and is the evening before',
    async (_season, months) => {
      const event = await eventIn(months)
      /* 23:30 UTC on the event's own day: still its day in UTC, already the day after it in
         Belgrade. A page reading the UTC day would still offer the switch. */
      const late = `${event.date}T23:30:00Z`
      /* And 20:00 UTC on the same day is 21:00 or 22:00 in Belgrade, the event's own day on
         both sources: the switch is offered, so the absence above is the day and not the page. */
      const evening = `${event.date}T20:00:00Z`

      vi.useFakeTimers({ toFake: ['Date'] })

      try {
        vi.setSystemTime(new Date(evening))
        const first = renderAt(`/sr/kalendar/${event.slug}`, 'competitor', ME)

        await screen.findByRole('heading', { level: 1, name: event.name })
        expect(await screen.findByRole('button', { name: 'Idem na ovaj događaj' })).toBeVisible()
        first.unmount()

        vi.setSystemTime(new Date(late))
        renderAt(`/sr/kalendar/${event.slug}`, 'competitor', ME)

        await screen.findByRole('heading', { level: 1, name: event.name })
        // Let everything the page asks for settle, so the absence is not just the page
        // not having got to it yet.
        await act(async () => {
          await loadResource('attendance')
          await loadResource('competitors')
        })
        expect(theSwitch()).toBeNull()
      } finally {
        vi.useRealTimers()
      }
    },
  )
})
