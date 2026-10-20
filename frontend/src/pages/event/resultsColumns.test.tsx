import { screen, within } from '@testing-library/react'
import { loadResource } from '../../data/client'
import type { Result } from '../../data/types'
import { formatNumber } from '../../i18n/format'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'

/**
 * The table of results on an event, by what each of its columns is called and by what
 * it reads (owner, 16.10.2026, and 20.10.2026).
 *
 * „Neka se zove DISTANCA ovo što je opisno, pa onda može Distanca, Dužina (km), Uspon
 * (m), Spust (m)" (16.10.2026): the group a run falls in (Kraća trka ... Ultramaraton)
 * was the „Distanca", and the three figures that follow are named in full, each with its
 * unit in brackets. **On 20.10.2026 the owner took the first of them off:** „U ovoj
 * tabelici umesto distance zelim da pise naziv trke." So the second column is „Trka" and
 * says the name of the race the run was in, and the three figures after it are as they
 * were.
 *
 * Held by what is under each head, and not only by what the head says: a head that
 * says „Uspon (m)" over the fall is the worst of the faults here, and it reads as
 * correct. And the name of the race is held against two other things a column of names
 * could read: the name of the event, which the file of results carries beside it and which
 * in the sample is spelt the same as the race on nearly every event, and the name of the
 * race of ANOTHER row, which on an event of one race is the same string.
 */

/** An event whose runs climb a different distance from the one they fall, so that a
 *  column read from the wrong field is a different number and not the same one. */
const EVENT = 'stazama-branka-copica-2016'

const HEADS = ['Takmičar', 'Trka', 'Dužina (km)', 'Uspon (m)', 'Spust (m)', 'Vreme', 'Bodovi']

async function openResults(): Promise<HTMLElement> {
  renderAt(`/sr/kalendar/${EVENT}`)

  return screen.findByRole('table', { name: 'Rezultati članova' })
}

describe('the table of results on an event', () => {
  it('names its columns Trka, Dužina (km), Uspon (m) and Spust (m), in that order', async () => {
    const table = await openResults()

    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((one) => one.textContent),
    ).toEqual(HEADS)
    expect(sr.profile.columns.race).toBe('Trka')
  }, SLOW)

  it('reads each column from the field its head names, in every row', async () => {
    const table = await openResults()
    const results = (await loadResource<Result[]>('results')).filter((one) => one.eventSlug === EVENT)

    expect(results.length, 'an event nobody ran measures nothing').toBeGreaterThan(1)

    /* What a row of this event may say, whole: the race, the length, the climb and the fall
       together, so a climb written under the fall is a row nobody ran. */
    const ran = new Set(
      results.map((one) =>
        [
          one.raceName,
          formatNumber(one.distanceKm, 'sr', 2),
          formatNumber(one.ascentM, 'sr'),
          formatNumber(one.descentM, 'sr'),
        ].join('|'),
      ),
    )
    const rows = within(table).getAllByRole('row').slice(1)

    expect(rows).toHaveLength(results.length)

    for (const row of rows) {
      const cells = within(row).getAllByRole('cell')
      const said = cells.slice(1, 5).map((one) => one.textContent)

      expect(ran, `${said.join('|')} is not a run of this event`).toContain(said.join('|'))
    }

    /* And the climb is not the fall: one of the runs here climbs 15 and falls 209, so a column
       read from the other field is a different number and the case cannot pass on it. */
    const climbs = rows.map((row) => must(within(row).getAllByRole('cell')[3], 'the climb').textContent)
    const falls = rows.map((row) => must(within(row).getAllByRole('cell')[4], 'the fall').textContent)

    expect(climbs).not.toEqual(falls)
    expect(climbs).toContain('15')
    expect(falls).toContain('209')
  }, SLOW)
})
