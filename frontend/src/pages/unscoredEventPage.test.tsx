import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import sr from '../i18n/sr.json'
import { clearResourceCache, loadResource } from '../data/client'
import type { Race, Result } from '../data/types'
import { at } from '../test/at'
import { renderAt } from '../test/render'
import { serverThat } from '../test/serverAnswers'
import { SLOW } from '../test/slow'

/**
 * THE PAGE OF AN UNSCORED EVENT, AND WHO RAN IT (PDL, 14.11.2026, „Strana događaja nebodovane trke prikazuje
 * rezultate članova kao kod bodovane, sa „–” u koloni bodova”; 15.11.2026, „Na strani nebodovanog događaja
 * rezultati idu po trci, redom kojim trke stoje na događaju, a unutar trke od najbržeg vremena” and „Član koji
 * na događaju ima samo nebodovan rezultat sme da oceni događaj”).
 *
 * <p><b>THE AXES.</b> The list the rows come from (the unscored one, where the runs of „Palićki triatlon" are,
 * and never the scored one, which holds none of them); the order (the race in the event's order, a race of a
 * length before a free one, and the time inside it: the rows are served in neither order, so the server's order
 * and an order by points, all nought, both fail); the points („–" and never „0,00"); and whose run it is (a member
 * whose only run here is unscored may rate the event).
 *
 * <p><b>THE SAMPLE.</b> „Palićki triatlon" (event 1168, 18.07.2027) is the one unscored event of the sample, with
 * one race of a length (1613). The case gives it a free race of its own (99001) and three runs, served on
 * `/api/unscored-results` in the order 3, 1, 2 of the page.
 */

const SLUG = 'palicki-triatlon-2027'
const PAGE = `/sr/kalendar/${SLUG}`
/** A day after the event, so its results are drawn and a member who ran it may rate it. */
const TODAY = '2027-08-23'

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

/** A run of the triathlon, in the shape `/api/unscored-results` serves. */
const aRun = (id: number, raceId: number, raceName: string, memberNumber: string, seconds: number): Result => ({
  id,
  memberNumber,
  raceId,
  raceName,
  eventName: 'Palićki triatlon',
  eventSlug: SLUG,
  date: '2027-07-18',
  distanceKm: 51.5,
  ascentM: 0,
  descentM: 0,
  seconds,
  points: 0,
  category: 'ultra',
  inItsSeason: false,
  inItsStanding: false,
})

/** Served in the order 3, 1, 2 of the page: the swim first, then the two runs of the race of a length, the
 *  slower of them first. */
const RUNS: Result[] = [
  aRun(9902, 99001, 'Plivanje', '000002', 1500),
  aRun(9901, 1613, 'Palićki triatlon', '000021', 9000),
  aRun(9903, 1613, 'Palićki triatlon', '000004', 8000),
]

describe('the page of an unscored event', () => {
  let server: ReturnType<typeof serverThat>
  const real = globalThis.fetch

  beforeEach(() => {
    clearResourceCache()
    server = serverThat((path) => {
      if (path === '/api/unscored-results') {
        return json(RUNS)
      }

      if (path === '/api/races') {
        return real('/api/races')
          .then((served) => served.json())
          .then((races: Race[]) => {
            const [one] = races.filter((race) => race.id === 1613)

            return json([...races, { ...one, id: 99001, name: 'Plivanje', kind: 'free', distanceKm: 0 }])
          })
      }

      return null
    })
  })

  afterEach(() => {
    server.stop()
  })

  it('draws the runs of its races from the list of unscored results, by race and then by time, with „–"', async () => {
    renderAt(PAGE, 'visitor', undefined, undefined, TODAY)

    const table = await screen.findByRole('table', { name: sr.event.results }, { timeout: SLOW / 2 })
    const rows = within(table).getAllByRole('row').slice(1)

    expect(rows.map((row) => at(within(row).getAllByRole('cell'), 5).textContent)).toEqual([
      '2:13:20',
      '2:30:00',
      '25:00',
    ])
    expect(rows.map((row) => at(within(row).getAllByRole('cell'), 6).textContent)).toEqual(
      RUNS.map(() => `–${sr.profile.noPoints}`),
    )
  }, SLOW)

  it('offers a member whose only run here is unscored to rate the event', async () => {
    renderAt(PAGE, 'competitor', '000002', undefined, TODAY)

    expect(
      await screen.findByRole('link', { name: sr.event.addComment }, { timeout: SLOW / 2 }),
    ).toHaveAttribute('href', `/sr/kalendar/${SLUG}/ocena`)
  }, SLOW)

  it('offers nobody who did not run it to rate it', async () => {
    renderAt(PAGE, 'competitor', '000007', undefined, TODAY)

    await screen.findByRole('table', { name: sr.event.results }, { timeout: SLOW / 2 })
    expect(screen.queryByRole('link', { name: sr.event.addComment })).toBeNull()
  }, SLOW)
})

/* WHATEVER DROPS THE SCORED RESULTS DROPS THE UNSCORED ONES WITH IT (`data/client.ts`, `GO_WITH`): every place that
   takes a result away clears `results`, and the review of PR 728 found six of them that left the unscored list
   standing. Asked of the behaviour and not of a list of those places: the next read of the unscored list goes to the
   server again. */
describe('a write that drops the results', () => {
  it('drops the list of unscored results with them, and not the other way round', async () => {
    const server = serverThat(() => null)

    try {
      clearResourceCache()
      await loadResource('unscored-results')
      await loadResource('results')
      await loadResource('unscored-results')

      const asked = (path: string) => server.asked.filter((one) => one.path === path).length

      expect([asked('/api/unscored-results'), asked('/api/results')]).toEqual([1, 1])

      clearResourceCache('results')
      await loadResource('unscored-results')
      await loadResource('results')

      expect([asked('/api/unscored-results'), asked('/api/results')]).toEqual([2, 2])

      clearResourceCache('unscored-results')
      await loadResource('results')

      expect(asked('/api/results')).toBe(2)
    } finally {
      server.stop()
    }
  })
})
