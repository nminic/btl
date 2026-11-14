import { screen, within } from '@testing-library/react'
import { at, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'
import { serverThat } from '../../test/serverAnswers'
import { loadResource } from '../../data/client'
import { resultsOf } from '../../data/derive'
import type { Result } from '../../data/types'

/* „MOJI REZULTATI" BESIDE THE RACES THE LEAGUE DOES NOT SCORE (PDL, 14.11.2026, „Ostale discipline kao
   lična evidencija"; step 4 of the plan of the increment).

   THE AXES: the result (scored or unscored, of the one member and the one year, 000002 in 2026 and
   2020) and the member (one who has unscored races and one who has none, 000007). The two lists are
   asked for apart (`data/unscoredResults.ts`), so a table that drew one list twice, or the wrong
   one, cannot give the same rows. */

const MEMBER = '000002'
const WITH_NONE = '000007'

const PAGE = '/sr/moji-rezultati'

async function bothLists(): Promise<{ scored: Result[]; unscored: Result[] }> {
  return {
    scored: resultsOf(await loadResource<Result[]>('results'), MEMBER),
    unscored: resultsOf(await loadResource<Result[]>('unscored-results'), MEMBER),
  }
}

describe('the races the league does not score, in „Moji rezultati"', () => {
  it('are a section of their own, with every one of them and „–" for the points', async () => {
    renderAt(PAGE, 'competitor', MEMBER)

    const table = await screen.findByRole('table', { name: 'Nebodovane trke' }, { timeout: SLOW / 2 })
    const { unscored } = await bothLists()
    const rows = within(table).getAllByRole('row').slice(1)

    expect(unscored.length).toBeGreaterThan(1)
    expect(rows.map((row) => at(within(row).getAllByRole('cell'), 1).textContent)).toEqual(
      unscored.map((result) => result.raceName),
    )
    expect(
      rows.map((row) => at(within(row).getAllByRole('cell'), 4).textContent),
    ).toEqual(unscored.map(() => '–Bez bodova'))
    expect(screen.getByRole('heading', { name: `Nebodovane trke ${String(unscored.length)}` })).toBeVisible()
  }, SLOW)

  /* „IZMENI" AND „OBRIŠI" ON EVERY ONE OF THEM, through the routes of a counted result (the plan's step 3,
     „Unos rezultata na svim vratima: … ispravka"): the pencil opens the same form at the result's own
     address, and the x asks first, as on a counted result. */
  it('offer to change and to take back every one of them, as a counted result does', async () => {
    renderAt(PAGE, 'competitor', MEMBER)

    const table = await screen.findByRole('table', { name: 'Nebodovane trke' }, { timeout: SLOW / 2 })
    const { unscored } = await bothLists()

    expect(within(table).getAllByRole('link', { name: /^Izmeni/ }).map((one) => one.getAttribute('href'))).toEqual(
      unscored.map((result) => `/sr/rezultat/novi?ispravka=${String(result.id)}`),
    )
    expect(within(table).getAllByRole('button', { name: /^Obriši/ })).toHaveLength(unscored.length)
  }, SLOW)

  it('are not among the counted ones, whose table keeps its own rows and its own controls', async () => {
    renderAt(PAGE, 'competitor', MEMBER)

    const counted = await screen.findByRole('table', { name: 'Uračunato' }, { timeout: SLOW / 2 })
    const { scored, unscored } = await bothLists()
    const rows = within(counted).getAllByRole('row').slice(1)
    const named = new Set(unscored.map((result) => result.raceName))

    expect(rows).toHaveLength(scored.length)
    expect(rows.filter((row) => named.has(must(at(within(row).getAllByRole('cell'), 1).textContent, 'race')))).toEqual([])
    expect(within(at(rows, 0)).getAllByRole('link').length).toBeGreaterThan(0)
  }, SLOW)

  it('leave no heading behind for a member who has none', async () => {
    renderAt(PAGE, 'competitor', WITH_NONE)

    await screen.findByRole('table', { name: 'Uračunato' }, { timeout: SLOW / 2 })
    expect(screen.queryByRole('heading', { name: /Nebodovane trke/ })).not.toBeInTheDocument()
  }, SLOW)

  it('say so, with the one button that asks again, when the list of them cannot be read', async () => {
    const stop = serverThat((path) =>
      path === '/api/unscored-results' ? new Response('no', { status: 500 }) : null,
    ).stop

    try {
      renderAt(PAGE, 'competitor', MEMBER)

      /* Not drawn as though it were the whole of what there is: the screen is one read of three lists. */
      expect(await screen.findByRole('button', { name: /pokušaj ponovo/i }, { timeout: SLOW / 2 })).toBeVisible()
      expect(screen.queryByRole('table', { name: 'Uračunato' })).not.toBeInTheDocument()
    } finally {
      stop()
    }
  }, SLOW)
})
