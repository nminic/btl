import { screen, waitFor, within } from '@testing-library/react'
import { at, first, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'
import { serverThat, runsAtBothDoors } from '../../test/serverAnswers'
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
   - the filter: „Sve" and a length (no button for the unscored races alone since 21.11.2026). The two
     unscored races of 2026 are of the lengths `short` and `ultra`, so the length buttons that would
     show them if the lists were mixed exist;
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
  const table = screen.queryByRole('table', { name: 'Trke' })

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

/** The row of filters: „Sve" and the five lengths, the same six as on the front page. */
function theFilters() {
  return within(screen.getByRole('group', { name: 'Distanca' })).getAllByRole('button')
}

describe('the table of results beside the races the league does not score', () => {
  it('draws both together under „Sve", newest first, and counts both in the heading', async () => {
    renderAt(`${ADDRESS}?sezona=sve`)

    await screen.findByRole('table', { name: 'Trke' })
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
      screen.getByRole('heading', { name: `Trke ${String(scored.length + unscored.length)}` }),
    ).toBeVisible()
    expect(lines().map((cells) => at(cells, 0).textContent)).toEqual(
      expected.map((line) => formatShortDate(line.result.date, 'sr')),
    )
    expect(lines().map(raceOf)).toEqual(expected.map((line) => line.result.raceName))
  })

  it('writes „–" under Bodovi on every unscored line and a number on every scored one', async () => {
    renderAt(`${ADDRESS}?sezona=sve`)

    await screen.findByRole('table', { name: 'Trke' })
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

    const table = await screen.findByRole('table', { name: 'Trke' })
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

    await screen.findByRole('table', { name: 'Trke' })
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

  it('has no button for the unscored races alone: six, in the order of the front page, and the unscored ones are under „Sve" only', async () => {
    const user = setupUser()
    const { router } = renderAt(`${ADDRESS}?sezona=sve`)

    await screen.findByRole('table', { name: 'Trke' })
    const { unscored } = await bothLists()

    expect(theFilters().map((one) => one.textContent)).toEqual([
      'Sve distance',
      'Kratke, Kraća trka',
      '21,1 km, Polumaraton',
      'Duge, Duža trka',
      '42,2 km, Maraton',
      'Ultra, Ultramaraton',
    ])
    expect(screen.queryByRole('button', { name: /Nebodovane/ })).not.toBeInTheDocument()

    /* Under „Sve" every unscored race is drawn, with its dash. */
    expect(lines().map(raceOf)).toEqual(expect.arrayContaining(unscored.map((result) => result.raceName)))

    /* And under any length none of them is, and the choice is in the address. */
    for (const index of [1, 2, 3, 4, 5]) {
      await user.click(at(theFilters(), index))

      expect(lines().map(raceOf).filter((name) => unscored.some((one) => one.raceName === name))).toEqual([])
    }

    expect(router.state.location.search).toContain('duzina=ultra')

    /* „Sve" takes it back out of the address, as a length does. */
    await user.click(screen.getByRole('button', { name: 'Sve distance' }))

    expect(router.state.location.search).not.toContain('duzina')
  })

  it('opens on „Sve" for the address that used to ask for „Nebodovane trke", and not on an empty list', async () => {
    renderAt(`${ADDRESS}?sezona=sve&duzina=nebodovane`)

    await screen.findByRole('table', { name: 'Trke' })
    const { scored, unscored } = await bothLists()

    expect(screen.getByRole('button', { name: 'Sve distance' })).toHaveAttribute('aria-pressed', 'true')
    expect(lines()).toHaveLength(Math.min(50, scored.length + unscored.length))
    expect(screen.queryByText('Nema nijedne nebodovane trke.')).not.toBeInTheDocument()
  })

  it('opens on all of them for a word it does not know, as it does for a length it does not know', async () => {
    renderAt(`${ADDRESS}?sezona=sve&duzina=nebodovan`)

    await screen.findByRole('table', { name: 'Trke' })
    expect(screen.getByRole('button', { name: 'Sve distance' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('follows the year: one unscored race in 2020, drawn under „Sve" with its dash', async () => {
    renderAt(`${ADDRESS}?sezona=2020`)

    await screen.findByRole('table', { name: 'Trke' })
    const row = must(
      lines().find((cells) => raceOf(cells) === 'Biciklistički maraton Fruške gore'),
      'the unscored race of 2020',
    )

    expect(pointsOf(row)).toBe('–Bez bodova')
    expect(screen.getByRole('heading', { name: `Trke ${String(lines().length)}` })).toBeVisible()
  })

  it('draws the table, and no sentence about the unscored, for the old address in a year without any', async () => {
    /* 2019 is a year this member has results in and none of them unscored. */
    renderAt(`${ADDRESS}?sezona=2019&duzina=nebodovane`)

    expect(await screen.findByRole('table', { name: 'Trke' })).toBeVisible()
    expect(screen.queryByText('Za izabranu godinu nema nijedne nebodovane trke.')).not.toBeInTheDocument()
  })

  it('draws the scored table for the old address when no unscored race is served at all', async () => {
    const stop = serverThat((path) =>
      runsAtBothDoors(path, 'unscored-results', []),
    ).stop

    try {
      renderAt(`${ADDRESS}?sezona=sve&duzina=nebodovane`)

      expect(await screen.findByRole('table', { name: 'Trke' })).toBeVisible()
      expect(screen.queryByText('Nema nijedne nebodovane trke.')).not.toBeInTheDocument()
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
      runsAtBothDoors(path, 'unscored-results', [swam]),
    ).stop

    try {
      renderAt(`${ADDRESS}?sezona=2024`)

      await screen.findByRole('table', { name: 'Trke' })
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

    await screen.findByRole('table', { name: 'Trke' })
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

  it('follows the year: none in a year without them, though the member has them in other years', async () => {
    /* 2019 is a year of this member with scored races and no unscored one, and 2020 and 2026 are years
       with. The ring, the total in its middle and the reading for the screen reader are the year's and
       not the member's: a ring that counted every year's unscored races gave 2019 a slice of three. */
    renderAt(`${ADDRESS}?sezona=2019`)

    await screen.findByRole('table', { name: 'Trke' })
    const { scored, unscored } = await bothLists()
    const inYear = (list: Result[], year: string) =>
      list.filter((result) => result.date.startsWith(year)).length
    const reading = screen.getByRole('table', { name: 'Trke po distanci' })

    expect(unscored.length).toBeGreaterThan(0)
    expect(inYear(unscored, '2019')).toBe(0)
    expect(inYear(scored, '2019')).toBeGreaterThan(0)
    expect(within(reading).queryByRole('rowheader', { name: 'Nebodovane trke' })).not.toBeInTheDocument()
    expect(
      must(
        within(reading).getByRole('rowheader', { name: 'Zbirno' }).parentElement,
        'the total row',
      ),
    ).toHaveTextContent(`${String(inYear(scored, '2019'))} trka`)
    expect(document.querySelector('.donut__total')).toHaveTextContent(String(inYear(scored, '2019')))
    expect(document.querySelectorAll('.donut__seg').length).toBeGreaterThan(0)
  })

  it('counts the unscored races of the year chosen, and of that year alone', async () => {
    renderAt(`${ADDRESS}?sezona=2020`)

    await screen.findByRole('table', { name: 'Trke' })
    const { scored, unscored } = await bothLists()
    const scoredIn2020 = scored.filter((result) => result.date.startsWith('2020')).length
    const unscoredIn2020 = unscored.filter((result) => result.date.startsWith('2020')).length
    const reading = screen.getByRole('table', { name: 'Trke po distanci' })
    const row = must(
      within(reading).getByRole('rowheader', { name: 'Nebodovane trke' }).parentElement,
      'the row of the unscored slice',
    )

    expect(unscoredIn2020).toBe(1)
    expect(unscored.length).toBeGreaterThan(unscoredIn2020)
    expect(at(within(row).getAllByRole('cell'), 0)).toHaveTextContent(String(unscoredIn2020))
    expect(
      must(within(reading).getByRole('rowheader', { name: 'Zbirno' }).parentElement, 'the total row'),
    ).toHaveTextContent(`${String(scoredIn2020 + unscoredIn2020)} trka`)
    expect(document.querySelector('.donut__total')).toHaveTextContent(
      String(scoredIn2020 + unscoredIn2020),
    )
  })

  it('has no such slice for a member who has none, and the profile is the one it was', async () => {
    const stop = serverThat((path) =>
      runsAtBothDoors(path, 'unscored-results', []),
    ).stop

    try {
      renderAt(`${ADDRESS}?sezona=sve`)

      await screen.findByRole('table', { name: 'Trke' })
      expect(screen.queryByRole('rowheader', { name: 'Nebodovane trke' })).not.toBeInTheDocument()
    } finally {
      stop()
    }
  })
})
