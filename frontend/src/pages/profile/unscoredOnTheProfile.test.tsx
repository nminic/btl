import { screen, waitFor, within } from '@testing-library/react'
import { at, first, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'
import { serverThat } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { loadResource } from '../../data/client'
import { resultsOf, totalsOf } from '../../data/derive'
import type { Result } from '../../data/types'
import { formatNumber, formatShortDate } from '../../i18n/format'

/* THE RACES THE LEAGUE DOES NOT SCORE, ON A PROFILE (PDL, 14.11.2026, „Ostale discipline kao lična
   evidencija"; step 4 of the plan of the increment).

   THE AXES, and where the set-up pulls each pair of sources apart:

   - the result: scored or unscored, of the SAME member and the SAME year. 000002 holds three scored
     and two unscored results in 2026 and four scored and one unscored in 2020, so no year is made of
     one kind alone and a swap between the two lists cannot give the same table;
   - the filter: „Sve", a length, „Nebodovane trke". The two unscored races of 2026 are of the lengths
     `short` and `ultra`, so the length buttons that would show them if the lists were mixed exist;
   - the year: with an unscored result and without (2019 has none), and a year with an unscored result
     and no scored one (2024, served by a case of its own);
   - the count of unscored races, for the case of the word: one, two to four, five and more, which is
     the ring's test (`components/CategoryDonutUnscored.test.tsx`), the profile passing a count.

   The member is the one who has both, and the unscored distance is the longest he has: a counter that
   summed it would be 115 km above the one it reads. */

const MEMBER = '000002'
const ADDRESS = `/sr/takmicar/${MEMBER}`

async function bothLists(): Promise<{ scored: Result[]; unscored: Result[] }> {
  return {
    scored: resultsOf(await loadResource<Result[]>('results'), MEMBER),
    unscored: resultsOf(await loadResource<Result[]>('unscored-results'), MEMBER),
  }
}

/** The lines of the table of results, as the cells of each. */
function lines(): HTMLElement[][] {
  const table = screen.queryByRole('table', { name: 'Rezultati' })

  /* A length with nothing in it draws no table at all, only its sentence. */
  if (table === null) {
    return []
  }

  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell'))
}

const pointsOf = (cells: HTMLElement[]) => must(at(cells, 6).textContent, 'the points cell')
const raceOf = (cells: HTMLElement[]) => must(at(cells, 1).textContent, 'the race cell')

/** The row of filters, whose seventh button is the one for the races that are not scored. */
function theFilters() {
  return within(screen.getByRole('group', { name: 'Distanca' })).getAllByRole('button')
}

const UNSCORED_BUTTON = { name: 'Nebodovane trke Nebodovane' }

describe('the table of results beside the races the league does not score', () => {
  it('draws both together under „Sve", newest first, and counts both in the heading', async () => {
    renderAt(`${ADDRESS}?sezona=sve`)

    await screen.findByRole('table', { name: 'Rezultati' })
    const { scored, unscored } = await bothLists()
    /* On one day the scored one first: the sort is stable and the scored ones are put in first. */
    const expected = [
      ...scored.map((result) => ({ result, unscored: false })),
      ...unscored.map((result) => ({ result, unscored: true })),
    ]
      .sort((left, right) => right.result.date.localeCompare(left.result.date))
      .slice(0, 50)

    expect(unscored.length).toBeGreaterThan(1)
    expect(scored.length).toBeGreaterThan(unscored.length)
    expect(
      screen.getByRole('heading', { name: `Rezultati ${String(scored.length + unscored.length)}` }),
    ).toBeVisible()
    expect(lines().map((cells) => at(cells, 0).textContent)).toEqual(
      expected.map((line) => formatShortDate(line.result.date, 'sr')),
    )
    expect(lines().map(raceOf)).toEqual(expected.map((line) => line.result.raceName))
  })

  it('writes „–" under Bodovi on every unscored line and a number on every scored one', async () => {
    renderAt(`${ADDRESS}?sezona=sve`)

    await screen.findByRole('table', { name: 'Rezultati' })
    const { unscored } = await bothLists()
    const named = new Set(unscored.map((result) => result.raceName))
    const drawn = lines().filter((cells) => named.has(raceOf(cells)))

    expect(drawn).toHaveLength(unscored.length)

    for (const cells of drawn) {
      /* The dash for the eye, and the words for the one who hears a dash as silence. */
      expect(pointsOf(cells)).toBe('–Bez bodova')
    }

    for (const cells of lines().filter((one) => !named.has(raceOf(one)))) {
      expect(pointsOf(cells)).toMatch(/^\d/)
    }
  })

  it('says what an unscored line is instead of the length group it has none of', async () => {
    renderAt(`${ADDRESS}?sezona=2026`)

    const table = await screen.findByRole('table', { name: 'Rezultati' })
    const swim = must(
      within(table)
        .getAllByRole('row')
        .find((row) => within(row).queryByText('Plivanje na Adi Ciganliji') !== null),
      'the row of the swim',
    )
    const length = at(within(swim).getAllByRole('cell'), 2)

    expect(length).toHaveTextContent('nebodovana trka: 1,90')
    /* The dot is hollow and hidden from the reading; what carries the difference is the words. */
    expect(length.querySelector('.profile__dot--unscored')).toHaveAttribute('aria-hidden', 'true')
  })

  it('narrows to a length by the scored races of it alone, whatever length an unscored one was', async () => {
    const user = setupUser()
    renderAt(`${ADDRESS}?sezona=2026`)

    await screen.findByRole('table', { name: 'Rezultati' })
    const { scored, unscored } = await bothLists()
    const inYear = (list: Result[]) => list.filter((result) => result.date.startsWith('2026'))

    /* The swim is `short` and the triathlon `ultra`, and both buttons must leave them out. */
    expect(inYear(unscored).map((result) => result.category).sort()).toEqual(['short', 'ultra'])

    for (const [index, category] of [
      [1, 'short'],
      [5, 'ultra'],
    ] as const) {
      await user.click(at(theFilters(), index))

      const named = new Set(inYear(unscored).map((result) => result.raceName))
      const shown = lines().map(raceOf)
      const expected = inYear(scored)
        .filter((result) => result.category === category)
        .map((result) => result.raceName)

      expect(shown, category).toEqual(expected)
      expect(shown.filter((name) => named.has(name)), category).toEqual([])
    }
  })

  it('shows only the unscored races under „Nebodovane trke", and puts the choice in the address', async () => {
    const user = setupUser()
    const { router } = renderAt(`${ADDRESS}?sezona=sve`)

    await screen.findByRole('table', { name: 'Rezultati' })
    const { unscored } = await bothLists()

    await user.click(screen.getByRole('button', UNSCORED_BUTTON))

    expect(lines().map(raceOf).sort()).toEqual(unscored.map((result) => result.raceName).sort())
    expect(lines().map(pointsOf)).toEqual(unscored.map(() => '–Bez bodova'))
    expect(screen.getByRole('heading', { name: `Rezultati ${String(unscored.length)}` })).toBeVisible()
    expect(screen.getByRole('button', UNSCORED_BUTTON)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Sve distance Sve' })).toHaveAttribute('aria-pressed', 'false')
    expect(router.state.location.search).toContain('duzina=nebodovane')

    /* And „Sve" takes it back out of the address, as a length does. */
    await user.click(screen.getByRole('button', { name: 'Sve distance Sve' }))

    expect(router.state.location.search).not.toContain('duzina')
  })

  it('opens on the unscored races when the address says so', async () => {
    renderAt(`${ADDRESS}?sezona=sve&duzina=nebodovane`)

    await screen.findByRole('table', { name: 'Rezultati' })
    expect(screen.getByRole('button', UNSCORED_BUTTON)).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens on all of them for a word it does not know, as it does for a length it does not know', async () => {
    renderAt(`${ADDRESS}?sezona=sve&duzina=nebodovan`)

    await screen.findByRole('table', { name: 'Rezultati' })
    expect(screen.getByRole('button', { name: 'Sve distance Sve' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', UNSCORED_BUTTON)).toHaveAttribute('aria-pressed', 'false')
  })

  it('follows the year: one unscored race in 2020', async () => {
    renderAt(`${ADDRESS}?sezona=2020&duzina=nebodovane`)

    await screen.findByRole('table', { name: 'Rezultati' })
    expect(lines().map(raceOf)).toEqual(['Biciklistički maraton Fruške gore'])
    expect(screen.getByRole('heading', { name: 'Rezultati 1' })).toBeVisible()
  })

  it('has a sentence of its own for a year with none, and the filters can be cleared out of it', async () => {
    const user = setupUser()

    /* 2019 is a year this member has results in and none of them unscored. */
    renderAt(`${ADDRESS}?sezona=2019&duzina=nebodovane`)

    expect(
      await screen.findByText('Za izabranu godinu nema nijedne nebodovane trke.'),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Poništi filtere' }))
    expect(await screen.findByRole('table', { name: 'Rezultati' })).toBeVisible()
  })

  it('has a sentence of its own for no unscored race at all, which is not about a length', async () => {
    const stop = serverThat((path) =>
      path === '/api/unscored-results'
        ? new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
        : null,
    ).stop

    try {
      renderAt(`${ADDRESS}?sezona=sve&duzina=nebodovane`)

      expect(await screen.findByText('Nema nijedne nebodovane trke.')).toBeVisible()
      expect(screen.queryByText(/izabrane distance/)).not.toBeInTheDocument()
    } finally {
      stop()
    }
  })

  it('offers a year in which the member only swam, and draws that year', async () => {
    const swam = {
      id: 3699,
      memberNumber: MEMBER,
      raceId: 1799,
      raceName: 'Plivanje oko Ade',
      eventName: 'Plivanje oko Ade',
      eventSlug: 'plivanje-oko-ade-2024',
      date: '2024-08-04',
      distanceKm: 3,
      ascentM: 0,
      descentM: 0,
      seconds: 4100,
      points: 0,
      category: 'short',
      inItsSeason: false,
      inItsStanding: false,
    }
    const stop = serverThat((path) =>
      path === '/api/unscored-results'
        ? new Response(JSON.stringify([swam]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : null,
    ).stop

    try {
      renderAt(`${ADDRESS}?sezona=2024`)

      await screen.findByRole('table', { name: 'Rezultati' })
      expect(lines().map(raceOf)).toEqual(['Plivanje oko Ade'])
      expect(pointsOf(first(lines()))).toBe('–Bez bodova')
      /* The year is one of the years offered, so the address was not turned into „sve". */
      expect(screen.getByRole('combobox', { name: /sezon|godin/i })).toHaveValue('2024')
    } finally {
      stop()
    }
  }, SLOW)
})

describe('the figures beside the table, which count the races the league scores alone', () => {
  it('are the same with the unscored races served and with none served, in the year they fall in', async () => {
    /* THE SOURCE SWAP, which is the measure that says the figures do not read the unscored list: the
       kilometres of the scored races alone (the figure the page must say) and the kilometres of both
       lists (115,40 km more, the longest race 62 km) are two different numbers, and the widget must
       say the first and never the second. */
    renderAt(`${ADDRESS}?sezona=sve`)
    const { scored, unscored } = await bothLists()
    const scoredKm = `${formatNumber(totalsOf(scored).kilometers, 'sr', 2)} km`
    const bothKm = `${formatNumber(totalsOf([...scored, ...unscored]).kilometers, 'sr', 2)} km`

    expect(scoredKm).not.toBe(bothKm)

    const region = await screen.findByRole('region', { name: 'Zbirna statistika' })

    /* Every row of the widget unrolls from nought over the same moment, so the two figures are waited
       for together: the kilometres land before the climb does, and a read in between is a half-rolled
       number and not an answer. */
    await waitFor(
      () => {
        expect(region).toHaveTextContent(scoredKm)
        expect(region).toHaveTextContent(`${formatNumber(totalsOf(scored).ascent, 'sr')} m`)
      },
      { timeout: SLOW / 2 },
    )
    expect(region).not.toHaveTextContent(bothKm)
  }, SLOW)

  it('leave the points as the scored races alone make them', async () => {
    renderAt(`${ADDRESS}?sezona=2026`)

    const { scored, unscored } = await bothLists()
    const region = await screen.findByRole('region', { name: 'Zbirna statistika' })
    const inYear = scored.filter((result) => result.date.startsWith('2026'))

    expect(unscored.filter((result) => result.date.startsWith('2026'))).toHaveLength(2)
    await waitFor(() => {
      expect(region).toHaveTextContent(`${formatNumber(totalsOf(inYear).kilometers, 'sr', 2)} km`)
    }, { timeout: SLOW / 2 })
  }, SLOW)
})

describe('the ring beside the table', () => {
  it('has a slice for the unscored races, and counts them in the total it says in words', async () => {
    renderAt(`${ADDRESS}?sezona=sve`)

    await screen.findByRole('table', { name: 'Rezultati' })
    const { scored, unscored } = await bothLists()
    const reading = screen.getByRole('table', { name: 'Trke po distanci' })
    const row = must(
      within(reading).getByRole('rowheader', { name: 'Nebodovane trke' }).parentElement,
      'the row of the unscored slice',
    )
    const total = must(
      within(reading).getByRole('rowheader', { name: 'Zbirno' }).parentElement,
      'the total row',
    )

    expect(at(within(row).getAllByRole('cell'), 0)).toHaveTextContent(String(unscored.length))
    expect(total).toHaveTextContent(`${String(scored.length + unscored.length)} trka`)
  })

  it('has no such slice for a member who has none, and the profile is the one it was', async () => {
    const stop = serverThat((path) =>
      path === '/api/unscored-results'
        ? new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
        : null,
    ).stop

    try {
      renderAt(`${ADDRESS}?sezona=sve`)

      await screen.findByRole('table', { name: 'Rezultati' })
      expect(screen.queryByRole('rowheader', { name: 'Nebodovane trke' })).not.toBeInTheDocument()
    } finally {
      stop()
    }
  })
})
