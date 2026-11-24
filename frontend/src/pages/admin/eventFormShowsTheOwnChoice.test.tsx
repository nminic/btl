import { configure, getConfig, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { clearResourceCache, loadResource } from '../../data/client'
import type { BtlEvent } from '../../data/types'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'

/**
 * THE FORM OF AN EVENT SHOWS THE EVENT'S OWN CHOICE AND NEVER THE LEAGUE'S (owner, PDL 24.11.2026, chosen with
 * the recommendation: „Polje „Istaknuto” na formi događaja se ne menja: pokazuje samo ručni izbor, a
 * istaknutost iz lige se vidi u kalendaru").
 *
 * **The source replacement this file exists for.** `/api/events` serves two flags since that day: `featured`,
 * the event's own „Da" or „Ne", and `highlighted`, which is gold in the calendar and is true as well for an
 * event a highlighting league counts a race of. On the event counted by such a league the two disagree, and
 * that is the one place a form reading `highlighted` would open on „Da" and, saved, write the league's
 * highlight onto the event as its own choice - which would then outlive the event leaving the league, against
 * „događaj bez ručnog „Da” gubi istaknutost čim izađe iz lige".
 *
 * Both states of the own choice are opened: the event gold only through a league opens on „Ne", and the event
 * gold by its own choice opens on „Da", so a form that opened every event on „Ne" fails as well. Neither is the
 * first event served.
 */

/* EVERY WAIT IS GIVEN HALF OF WHAT A CASE HAS (CLAUDE.md, section 25), so a field that never arrives fails on
   its own query and never on the clock of the case. */
configure({ asyncUtilTimeout: SLOW / 2 })

/** The served calendar with two events changed: one gold only through a league, one gold by its own choice. */
async function theCalendar(): Promise<{ events: BtlEvent[]; byLeague: number; byHand: number }> {
  const served = await loadResource<BtlEvent[]>('events')
  const races = served.filter((one) => one.kind === 'race')
  const byLeague = must(races[10], 'an event of the served calendar').id
  const byHand = must(races[11], 'another event of the served calendar').id

  clearResourceCache()

  return {
    byLeague,
    byHand,
    events: served.map((one) => {
      if (one.id === byLeague) {
        return { ...one, featured: false, highlighted: true }
      }

      return one.id === byHand ? { ...one, featured: true, highlighted: true } : one
    }),
  }
}

let stop: () => void = () => {}

afterEach(() => {
  stop()
  clearResourceCache()
})

function serving(events: BtlEvent[]) {
  stop = serverThat((path, init) =>
    path === '/api/events' && (init?.method ?? 'GET') === 'GET'
      ? new Response(JSON.stringify(events), { status: 200, headers: { 'content-type': 'application/json' } })
      : null,
  ).stop
}

describe('the field Istaknuto on the form of an event', () => {
  it('opens on „Ne" for an event that is gold only because a league highlights it', async () => {
    const { events, byLeague } = await theCalendar()

    serving(events)
    renderAt(`/sr/administracija/dogadjaji?izmena=${String(byLeague)}`, 'superadmin')

    expect(await screen.findByLabelText(/^Istaknuto/)).toHaveValue('no')
  }, SLOW)

  it('opens on „Da" for an event chosen by hand', async () => {
    const { events, byHand } = await theCalendar()

    serving(events)
    renderAt(`/sr/administracija/dogadjaji?izmena=${String(byHand)}`, 'superadmin')

    expect(await screen.findByLabelText(/^Istaknuto/)).toHaveValue('yes')
  }, SLOW)

  it('waits less than a case has, so a miss is an assertion and never the clock', () => {
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
