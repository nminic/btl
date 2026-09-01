import { SLOW } from '../test/slow'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { loadResource } from '../data/client'
import { categoriesOf, fieldFor, rankingFor, topByCategory } from '../data/derive'
import { hueFor } from './competitorFace'
import sr from '../i18n/sr.json'
import pages from '../../public/mock/pages.json'
import words from '../test/leagueWords.snapshot.json'
import screens from '../test/leagueScreens.snapshot.json'
import { formatDuration, formatNumber, formatPoints } from '../i18n/format'
import { at, first, htmlElement, last, must, selectElement } from '../test/at'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'
import type { Competitor, Result } from '../data/types'

/**
 * The figure in the last cell of a row, read the way the portal writes it: a
 * dot every three digits and a comma before the decimals.
 *
 * Every board on these screens puts the number it ranks by last, so four tests
 * were reading that cell with four copies of the same line. One reader, and it
 * says what went wrong: a cell that is empty or holds a word is a column that
 * has moved, and left to itself it would arrive as a nought or a NaN and turn
 * "sorted by points" into an assertion about a list of noughts.
 */
/**
 * Every word a screen puts in front of a reader: the text it draws, the title of
 * the tab, and every label that is read out rather than shown.
 *
 * The markup itself is deliberately not read. An `aria-label` says as much to
 * somebody reading by ear as a paragraph does and never enters `textContent`, so
 * it is collected; a class name is not something the portal says, and holding it
 * would turn every change of style into a change of words.
 */
function wordsDrawn(): { text: string; title: string; labels: string[]; head: string[] } {
  const spoken = [...document.body.querySelectorAll('[aria-label], [alt], [title]')]
    .flatMap((one) => ['aria-label', 'alt', 'title'].map((name) => one.getAttribute(name) ?? ''))
    .filter((one) => one.trim() !== '')

  /* The head is read with the body. What a search engine is told is the portal
     speaking in its own voice as much as a paragraph is, and it is drawn by an
     effect rather than by the tree, so nothing in `document.body` can see it: a
     rule written into the description of a competition passed the whole gate while
     only the body was read (review, 01.09.2026). */
  const told = [...document.head.querySelectorAll('meta')]
    .map((one) => one.getAttribute('content') ?? '')
    .filter((one) => one.trim() !== '')

  return {
    text: must(document.body.textContent, 'the words a screen draws').replace(/\s+/g, ' ').trim(),
    title: document.title,
    labels: [...new Set(spoken)].sort(),
    head: [...new Set(told)].sort(),
  }
}

function lastNumberIn(row: HTMLElement): number {
  const text = last(within(row).getAllByRole('cell')).textContent
  const figure =
    text === null || text.trim() === ''
      ? Number.NaN
      : Number(text.replace(/\./g, '').replace(',', '.'))

  if (Number.isNaN(figure)) {
    throw new Error(`the last cell of the row reads "${text}", which is not a figure`)
  }

  return figure
}

/**
 * Every result of a season, read out of the record and written the way a table
 * writes it, kept under the points that identify it.
 *
 * For the same reason `distancesOf` exists: a test about which column is which
 * cannot be satisfied by whatever number happens to stand there. Eight columns
 * of figures all look right until two of them change places, and the row that
 * leads the board of 2019 has the same ascent as descent, so a test written off
 * that row alone would not notice the swap.
 *
 * Kept under the points rather than in the order of the board, because the order
 * is the thing the test beside this one is for. All of them under the same
 * points, not the last one read: in 2019 alone eighty-six figures are shared by
 * two results or more, seventy-nine of them by results that differ in the very
 * columns this reads back, and a map keeping one of each would fail on a correct
 * board the day two of them meet in the same ten.
 */
async function racesOf(season: number, locale = 'sr'): Promise<Map<string, string[][]>> {
  const results = await loadResource<Result[]>('results')
  const rows = new Map<string, string[][]>()

  for (const one of results.filter((result) => result.date.startsWith(String(season)))) {
    const points = formatPoints(one.points, locale)

    rows.set(points, [
      ...(rows.get(points) ?? []),
      [
        /* The race, which is what the column holds since 24.08.2026. Read off the
           record so a test about which column is which cannot be satisfied by
           whatever text happens to stand there; the two names agree on nearly
           every generated result, so this alone does not measure the change and
           the test below serves a race renamed by hand. */
        one.raceName,
        formatNumber(one.distanceKm, locale, 2),
        formatNumber(one.ascentM, locale),
        formatNumber(one.descentM, locale),
        formatDuration(one.seconds),
      ],
    ])
  }

  return rows
}

/** Every distance this member has raced, newest first, written the way the table
 *  writes them. Read out of the record so a test about which column is which
 *  cannot be satisfied by whatever number happens to stand there. */
async function distancesOf(memberNumber: string): Promise<string[]> {
  const results = await loadResource<Result[]>('results')

  return results
    .filter((one) => one.memberNumber === memberNumber)
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((one) => one.distanceKm.toFixed(2).replace('.', ','))
}

/** How the time on the course is written: hours, then minutes and seconds in
 *  two digits each. Written once because two tests read it. */
const TIME_ON_COURSE = /^\d+ h \d{2}' \d{2}''$/

/**
 * The number written in a bar of a chart.
 *
 * A column reads as the initials on the face above the bar, then the number in
 * the bar, then the name it belongs to, so the initials are dropped before the
 * number is read. Left in, the number would arrive as a NaN and every assertion
 * about the order of the bars would be an assertion about a list of them.
 */
function countIn(column: HTMLElement): number {
  const written = must(column.textContent, 'stubac')
    /* The place is said first and is not the number in the bar. */
    .replace(/^\d+\. mesto/, '')
    .replace(/^\D+/, '')
  const figure = Number(written.replace(/\D[\s\S]*$/, ''))

  if (Number.isNaN(figure)) {
    throw new Error(`stubac glasi "${column.textContent}", u njemu nema broja`)
  }

  return figure
}

/**
 * The number written in the level of a bar that reads as `name`.
 *
 * The bars of the progress chart carry two of them, and each says what it is,
 * because two figures in one bar with nothing to tell them apart are not a fact
 * anybody can use. Read through those words rather than by position: that is how
 * somebody who cannot see the chart reads them, and it is the whole reason they
 * are there.
 */
function levelIn(column: HTMLElement, name: string): number {
  return Number(
    writtenIn(column, name)
      .replace(/\./g, '')
      .replace(',', '.'),
  )
}

/** The figure in that level, exactly as it is written on the screen. */
function writtenIn(column: HTMLElement, name: string): string {
  return must(levelOf(column, name).textContent, 'nivo stupca').replace(name, '').trim()
}

/** The element that draws one level of a bar, reached from the words that say
 *  what it is rather than from a class name. */
function levelOf(column: HTMLElement, name: string): HTMLElement {
  const reading = within(column).getByText(name)
  const level = reading.parentElement?.parentElement

  if (!(level instanceof HTMLElement)) {
    throw new Error(`nivo koji glasi "${name}" nema element oko sebe`)
  }

  return level
}

/**
 * How tall that level asks to be, as a share of the bar, in per cent.
 *
 * The heights of the two levels travel to the stylesheet as a custom property
 * and nowhere else, so nothing a screen test can see says whether the drawing
 * agrees with the numbers written in it. jsdom lays nothing out, but the value
 * asked for is on the element and it is the whole of the arithmetic.
 */
function shareOf(column: HTMLElement, name: string): number {
  return Number(levelOf(column, name).style.getPropertyValue('--level').replace('%', ''))
}

/* One file for the screens a visitor sees. They share a shape: read the data
 * layer, sort it, put it in a table. */

/* The standing sits at /tabela. /top-liste is the page of Top 10 boards beside
 * it (PDL P28a), and has its own block further down. */
/** A season the league barely raced in, so a category the chips offer can
 *  hold nobody. Named once, because three assertions read it. */
const SPARSE = 2022

/** The standing at a season, and at a category if one is asked for. */
const ADDRESS = (season: number, category?: string) =>
  `/sr/tabela?sezona=${String(season)}&pol=z${
    category === undefined ? '' : `&kategorija=${encodeURIComponent(category)}`
  }`

/** The Serbian dictionary, so a word the screen must never show is read from
 *  where it is written rather than typed here a second time. */
const dictionary = sr

/** Every phrase the dictionary carries under a key that names this fact, as pairs of
 *  key and words. Found by the key rather than listed, so a fourth wording added
 *  tomorrow is asked about without this file being touched. */
function everySaying(inKey: string): [string, string][] {
  const found: [string, string][] = []
  const walk = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      if (path.toLowerCase().includes(inKey)) {
        found.push([path, node])
      }

      return
    }

    if (typeof node === 'object' && node !== null) {
      for (const [key, value] of Object.entries(node)) {
        walk(value, path === '' ? key : `${path}.${key}`)
      }
    }
  }

  walk(dictionary, '')

  return found
}

describe('Rankings', () => {
  it('opens on a season that has a field, with the columns from the rulebook', async () => {
    renderAt('/sr/tabela')

    expect(await screen.findByRole('table')).toBeVisible()
    // The two vertical columns stand beside the distance, and no column below is
    // left out of the markup at any width. Δ from PDL P12 is not among them: it
    // needs the standing as it stood at the end of last month, which the
    // prototype has nothing to compute from yet.
    for (const column of ['#', 'Član', 'Kat.', 'Trke', 'd (km)', '+ (m)', '− (m)', 'Vreme', 'Bodovi']) {
      expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('row').length).toBeGreaterThan(2)
  })

  it('orders by points, and marks the podium gold', async () => {
    renderAt('/sr/tabela?sezona=2020')

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)
    const points = rows.map(lastNumberIn)

    expect([...points].sort((a, b) => b - a)).toEqual(points)
    /* Three, and the three at the top (owner, 03.08.2026). They came off on
       01.08.2026 on a misreading of his note: what he asked to be rid of was
       the yellow-edged line of prose above the table, not the places in it. */
    expect(rows.slice(0, 3).map((row) => row.className)).toEqual(['podium', 'podium', 'podium'])
    expect(rows.slice(3).filter((row) => row.className === 'podium')).toEqual([])
  })

  it('keeps men and women apart', async () => {
    const user = setupUser()
    renderAt('/sr/tabela?sezona=2020')

    const men = within(await screen.findByRole('table')).getAllByRole('row').length
    await user.click(screen.getByRole('button', { name: 'Žene' }))
    const women = within(screen.getByRole('table')).getAllByRole('row').length

    expect(women).not.toBe(men)
    expect(screen.getByRole('button', { name: 'Žene' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('goes back to the men after the women, and changes the season', async () => {
    const user = setupUser()
    renderAt('/sr/tabela?sezona=2020')

    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Žene' }))
    await user.click(screen.getByRole('button', { name: 'Muškarci' }))
    expect(screen.getByRole('button', { name: 'Muškarci' })).toHaveAttribute('aria-pressed', 'true')

    await user.selectOptions(screen.getByLabelText('Sezona'), '2019')
    expect(screen.getByLabelText('Sezona')).toHaveValue('2019')
  })

  it('narrows by category, and lets it go again', async () => {
    const user = setupUser()
    renderAt('/sr/tabela?sezona=2020')

    const all = within(await screen.findByRole('table')).getAllByRole('row').length
    const categories = within(screen.getByRole('group', { name: 'Kategorija' }))

    await user.click(categories.getByRole('button', { name: 'M40-54' }))
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeLessThan(all)

    await user.click(categories.getByRole('button', { name: 'Sve' }))
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(all)
  })

  it('drops a search out of an address that still carries one, on arrival', async () => {
    /* Somebody has this bookmarked from before the search went, and nothing on this
       screen reads `trazi` any more. Left alone it is carried into every filter
       pressed after it and every link shared from there, so the address goes on
       naming a control that is not on the screen. The table itself is drawn from
       the season and the category, so it was right either way; the address is what
       a reader copies.

       On arrival and not on the way past, which is what a round measured on
       23.08.2026: written into this screen's own `change`, pressing a category
       dropped it and changing the season did not, because the season is drawn by a
       shared control that writes the address for itself. Both controls are pressed
       below, and the address is read before either of them. */
    const user = setupUser()
    const { router } = renderAt('/sr/tabela?sezona=2020&trazi=nesto')
    const address = () => new URLSearchParams(router.state.location.search)

    await screen.findByRole('table')

    expect(address().get('trazi'), 'the address still names a control that is gone').toBeNull()
    expect(address().get('sezona'), 'the rest of the address went with it').toBe('2020')

    await user.click(
      within(screen.getByRole('group', { name: 'Kategorija' })).getAllByRole('button')[1] ??
        screen.getByRole('button', { name: 'Sve' }),
    )

    expect(address().get('trazi')).toBeNull()
    expect(address().get('kategorija')).not.toBeNull()

    await user.selectOptions(screen.getByLabelText('Sezona'), '2019')

    expect(address().get('trazi'), 'the season wrote it back').toBeNull()
    expect(address().get('sezona')).toBe('2019')
  })

  it('marks the chosen category as chosen, and not only to a screen reader', async () => {
    /* `aria-pressed` says which chip is on, and the class is what draws it: a
       filled background and an accent edge (`rankings__category--on` in
       Rankings.css). A review replaced both class expressions with the plain
       one and watched all 1846 tests pass, because everything here asked only
       after the attribute. A reader who can see the screen would have had eight
       identical chips and no way to tell which one they had pressed.
     *
       Read as a pair, since the two are separate expressions on separate
       controls: „Sve" is on when nothing is filtered, and a band is on when it
       is the one in the address. */
    const user = setupUser()
    renderAt(ADDRESS(2020))

    await screen.findByRole('table')

    const chips = within(screen.getByRole('group', { name: 'Kategorija' }))
    const all = chips.getByRole('button', { name: 'Sve' })
    const one = chips.getAllByRole('button').filter((chip) => chip !== all)

    expect(all.className).toContain('rankings__category--on')
    expect(first(one).className).not.toContain('rankings__category--on')

    await user.click(first(one))

    expect(first(one).className).toContain('rankings__category--on')
    expect(chips.getByRole('button', { name: 'Sve' }).className).not.toContain(
      'rankings__category--on',
    )
  })

  it('offers no search at all, because the standing is not searched', async () => {
    /* Owner, 31.07.2026: „Pretraga po imenu na rang listama se briše." It was
       the most expensive thing on the screen, since the whole standing was
       summed again on every letter typed, and it answered a question the list
       of competitors already answers with its own search (PDL P12).
     *
       A guard rather than a deletion left to speak for itself. The decision was
       taken on 31.07.2026 and PDL P12 has read „obrisana" ever since, while the
       box stayed on the screen for a fortnight: nothing said otherwise, because
       nothing was looking. Both the control and the words it used are asked
       after, since a label that comes back is a control that came back.
     *
       What went with it is the one case on this screen where a place and a row
       number parted: searching narrowed the view without re-ranking, so the
       seventh stood alone reading „7".
     *
       **Nothing on this screen holds that rule any more, and saying otherwise
       was wrong.** The first version of this comment sent the reader to
       data/derive.test.ts, and a review showed why that cannot be: `rankingFor`
       now hands back exactly what `withPlaces` made, and `withPlaces` numbers
       from one with nothing skipped (PDL P12), so in that model a place and a
       row cannot differ. A test over the ladder cannot guard a table that
       counts its own rows. Where the rule is still alive and still guarded is
       the awards on a profile, which lift one row out of a standing and keep
       the place it held (pages/profile/awards.ts, and the assertion on `[2, 3]`
       in pages/profile/profile.test.tsx). */
    renderAt('/sr/tabela?sezona=2020')

    /* Waited for, and that is not a formality. Written without it this test
       passed while a search box was put back on the screen: the standing is
       fetched, so nothing at all is drawn on the first tick and „there is no
       search here" is true of an empty page. An absence asserted before the
       thing exists is not an assertion. */
    await screen.findByRole('table')

    /* Asked of the row of filters and not of the document. Over the whole page
       this fails on a search box put into the shared header, which is a control
       this screen has nothing to do with: a guard that goes off at somebody
       else's work is one that gets loosened rather than heeded. */
    const filters = within(must(document.querySelector('.rankings__filters'), 'the row of filters'))

    expect(filters.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(filters.queryByLabelText('Pretraga')).not.toBeInTheDocument()
    /* Both words and not only the first. The label is what a reader hears and
       the placeholder is what the box suggests typing; leaving one behind
       leaves the next person to put the box back a sentence already written. */
    expect(Object.keys(sr.rankings)).not.toContain('search')
    expect(Object.keys(sr.rankings)).not.toContain('searchPlaceholder')
  })

  it('names the beginners by their word, on the buttons and in the table alike', async () => {
    /* The category the league keeps as `M R` is read as „Početnici" wherever a
       visitor meets it (owner, 11.08.2026: „Tako neka se zovu od sada svuda").
       The code is what the filter and the address are written with, and it never
       reaches the screen.

       Both places are held here, because they were not the same for a while: the
       table was translated and the row of buttons above it was not, so one screen
       called one category two things. */
    const user = setupUser()
    renderAt('/sr/tabela?sezona=2020')

    const categories = within(await screen.findByRole('group', { name: 'Kategorija' }))

    expect(categories.getByRole('button', { name: 'Početnici' })).toBeVisible()
    expect(categories.queryByRole('button', { name: 'M R' })).toBeNull()

    /* And pressing it filters, so the word on the button and the code behind it
       are the same category and not two. */
    await user.click(categories.getByRole('button', { name: 'Početnici' }))

    expect(categories.getByRole('button', { name: 'Početnici' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('says which category is being read, and says it in the buttons themselves', async () => {
    /* Chosen by pressing one rather than out of a list that opens (owner,
       11.08.2026). Which one is on is said by `aria-pressed` and not by colour
       alone, because a row of buttons where the chosen one is merely darker
       says nothing to anybody who cannot see it (WCAG 2.2 SC 1.4.1). */
    const user = setupUser()
    renderAt('/sr/tabela?sezona=2020')

    const categories = within(await screen.findByRole('group', { name: 'Kategorija' }))
    expect(categories.getByRole('button', { name: 'Sve' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(categories.getByRole('button', { name: 'M40-54' }))

    expect(categories.getByRole('button', { name: 'M40-54' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(categories.getByRole('button', { name: 'Sve' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('says so when a filter leaves nothing', async () => {
    /* A category chosen and then a season moved to, which is the way a reader
       actually empties this table: the category stays in the address while the
       field changes under it. The chips are drawn from every member of that
       sex rather than from the ones who raced, so a band can be offered and
       hold nobody at all in the season on screen.
     *
       Which band is asked of the data rather than written down. The first
       version named `F55+`, and a review found that female codes carry a „Z"
       and not an „F": it matched nobody of either sex in any season, so the
       test would have stayed green whatever happened to the seed, and would
       have passed just as well on a category nobody has ever heard of. `must`
       is what makes this fail rather than skip if every offered band turns out
       to hold somebody. */
    const competitors = await loadResource<Competitor[]>('competitors')
    const results = await loadResource<Result[]>('results')
    const empty = must(
      categoriesOf(competitors, 'F', SPARSE).find(
        (code) =>
          rankingFor(competitors, results, { season: SPARSE, gender: 'F', categoryCode: code })
            .length === 0,
      ),
      'a category the chips offer and nobody raced in',
    )

    renderAt(ADDRESS(SPARSE, empty))

    expect(
      await screen.findByText('U ovoj sezoni i kategoriji nema nijednog rezultata.'),
    ).toBeVisible()

    /* And the same season without that band draws a table, so what is being
       read is the filter rather than a screen that answers this to everything. */
    cleanup()
    renderAt(ADDRESS(SPARSE))

    expect(within(await screen.findByRole('table')).getAllByRole('row').length).toBeGreaterThan(1)
  })

  it('leads from a row to the profile', async () => {
    renderAt('/sr/tabela?sezona=2020')

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)
    const link = within(first(rows)).getByRole('link')

    expect(link).toHaveAttribute('href', expect.stringContaining('/sr/takmicar/'))
  })
})

/* The words on the row of filters, and the count under it (owner, 05.08.2026).
 *
 * Each of these is one string in the dictionary and each was asked for by name,
 * so each is read off the screen rather than trusted to stay: a label that goes
 * back to what it said is a change nobody would notice for a month.
 */
describe('what the filters are called', () => {
  it('keeps the gender and the season in the head, and the categories alone under it', async () => {
    /* Owner, 23.08.2026: the season goes up beside the name of the screen, in the
       shape it has on the top boards, and the two gender buttons stand in front
       of it. What is left under the heading is the categories, and they start at
       the edge of the screen rather than behind a field. The season had stood in
       front of them since 11.08.2026, and a search box stood at the end of that
       row until 31.07.2026.

       jsdom computes no layout, so what is held is the order in the markup and
       what holds what. Asked through the two groups and the field themselves
       rather than through the class of the box around them: the box is how the
       layout is built, and a screen that put the season back among the filters
       while keeping the class would have gone past a guard that only counted
       children of `.rankings__head-tool`.

       Both halves of it, because the season arriving in the head while a copy of
       it stayed among the filters reads right on the screen and is two controls
       of one purpose, which is exactly what the owner had taken apart. */
    renderAt('/sr/tabela?sezona=2020')

    await screen.findByRole('table')

    const genders = screen.getByRole('group', { name: 'BTL tabele' })
    const season = must(screen.getByLabelText('Sezona').closest('label'), 'the season field')
    const categories = screen.getByRole('group', { name: 'Kategorija' })
    const head = must(genders.parentElement, 'what holds the gender buttons')

    expect([...head.children]).toEqual([genders, season])
    expect(head.contains(categories)).toBe(false)

    const row = must(document.querySelector('.rankings__filters'), 'the row of filters')
    const named = [...row.children].map((one) => one.querySelector('span')?.textContent ?? '')

    expect(named).toEqual(['Kategorija'])
  })

  it('names the category in full, and offers all of them as Sve', async () => {
    renderAt('/sr/tabela?sezona=2019')

    const categories = within(await screen.findByRole('group', { name: 'Kategorija' }))

    /* Written out on the control and short in the table, which is the whole of
       the decision: both are on this screen at once. */
    expect(screen.getByRole('columnheader', { name: 'Kat.' })).toBeInTheDocument()
    expect(categories.getAllByRole('button').map((one) => one.textContent)[0]).toBe('Sve')
  })

  it('counts women as takmičarke, in the case the number asks for', async () => {
    /* One, a few and many are three different words in Serbian, and the portal
       has `Intl.PluralRules` for exactly this.
     *
       Driven through the season, which is a control that is still there. It used
       to be driven through the search box, on the reasoning that no season holds
       all three counts, and that reasoning was simply wrong: 2022 holds one
       woman, 2023 holds two and 2019 holds nine. The counts are read off the
       data below rather than written out here, so a change in the seed says so
       instead of passing. */
    const user = setupUser()
    const women = (await loadResource<Competitor[]>('competitors')).filter(
      (one) => one.gender === 'F',
    )
    const results = await loadResource<Result[]>('results')
    const raced = (season: number) =>
      new Set(
        results
          .filter(
            (one) =>
              one.date.startsWith(String(season)) &&
              women.some((her) => her.memberNumber === one.memberNumber),
          )
          .map((one) => one.memberNumber),
      ).size

    renderAt('/sr/tabela?sezona=2019&pol=z')

    const count = async () => must((await screen.findByText(/takmičar/)).textContent, 'the count')
    const seasons = await screen.findByLabelText('Sezona')

    expect(await count()).toBe(`${String(raced(2019))} takmičarki`)

    await user.selectOptions(seasons, '2022')
    expect(await count()).toBe(`${String(raced(2022))} takmičarka`)

    await user.selectOptions(seasons, '2023')
    expect(await count()).toBe(`${String(raced(2023))} takmičarke`)
  })

  it('counts men as takmičari, which is the other word entirely', async () => {
    renderAt('/sr/tabela?sezona=2019')

    expect(must((await screen.findByText(/takmičar/)).textContent, 'the count')).toMatch(
      /takmičara?$/,
    )
  })
})

describe('TopBoards', () => {
  /** The day these screens are read on. Handed to the render rather than left to
   *  the real clock, so what a test works out beside a screen is worked out for
   *  the same day the screen had (PDL P11: who a season's field is drawn from
   *  depends on it). */
  const TODAY = '2026-08-04'

  /** The board with the given heading, looked up the way a screen reader does:
   *  through the region the heading names. Both kinds answer to it, the ones
   *  drawn as a table and the ones drawn as a chart. */
  function board(name: string) {
    return within(screen.getByRole('region', { name }))
  }

  /* The layout the owner asked for on 04.08.2026, read top to bottom the way a
     phone reads it: two lengths, then the board that stands beside them on a
     wide screen, then the next two, and the best single races under all of it.
     Deliberately not the wide screen read strictly across each row, because a
     board on the right spans two rows on the left and belongs to neither
     (TopBoards.tsx).

     Ten, not eleven. The best team went off this page: the teams have a page of
     their own, and a standing of teams belongs there. */
  const BOARDS = [
    'Najviše ultramaratona',
    'Najviše maratona',
    'Najviše kilometara',
    'Najviše dužih trka',
    'Najviše polumaratona',
    'Najduže na stazi',
    'Najviše kraćih trka',
    'Najbolji napredak',
    'Najbolji trkački parovi',
    'Najbolji pojedinačni rezultati',
  ]

  it('carries the ten boards in the order the owner laid them out', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    expect(await screen.findByRole('heading', { level: 1, name: 'Top liste' })).toBeVisible()

    const shown = screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent)

    expect(shown).toEqual(BOARDS)
  })

  it('leaves the best team to the page the teams have of their own', async () => {
    /* Owner, 04.08.2026: "Top timove ne prezentovati uopšte, jer timovi imaju
       svoju zasebnu stranu." It is still one of the lists of Article 48 and
       still worked out; it is not drawn here. */
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('heading', { level: 1, name: 'Top liste' })

    expect(screen.queryByRole('region', { name: 'Najbolji tim' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Članova' })).not.toBeInTheDocument()
  })

  it('says which place every column stands in, since an ol cannot', async () => {
    /* The place is said in words, because a chart is not a table and has no
       column to carry it. What this holds is that every column says one, that
       it is the one the board gave, and that it stands with the right name.

       It does not hold that the chart reads the place rather than counting its
       own rows: every board here is drawn whole from the top, so on this screen
       the two agree column for column and no test could tell them apart. Where
       they part is the standing under a search, and that is where the rule is
       guarded (`keeps the real place when the search narrows the table`).

       Until 11.08.2026 they parted here too: the last two of the longer races
       of 2016 are level down to the member number, which made them a shared
       ninth place and this test read 9, 9. There is no shared place any more
       (PDL P12), so the lower member number takes the ninth and the other the
       tenth.

       The day is handed to the screen and used here as well, so both sides work
       the field out for the same one (PDL P11). On this season it changes
       nothing, because the field is only narrowed for the season that is running;
       it is written this way so that a season where it does bite is not a test
       comparing a screen with something worked out for another day. */
    const [competitors, results] = await Promise.all([
      loadResource<Competitor[]>('competitors'),
      loadResource<Result[]>('results'),
    ])
    const ranked = topByCategory(
      fieldFor(competitors, 2016, TODAY),
      results,
      2016,
      'long',
      10,
    )

    expect(ranked.map((row) => row.position).slice(-2)).toEqual([9, 10])

    renderAt('/sr/top-liste?sezona=2016', 'visitor', null, undefined, TODAY)
    await screen.findByRole('heading', { level: 1, name: 'Top liste' })

    const columns = board('Najviše dužih trka').getAllByRole('listitem')

    expect(columns).toHaveLength(ranked.length)

    columns.forEach((column, index) => {
      const row = at(ranked, index)

      expect(must(column.textContent, 'stubac')).toContain(`${row.position}. mesto`)
      expect(column).toHaveTextContent(`${row.competitor.firstName} ${row.competitor.lastName}`)
    })
  })

  it('puts the heading of a chart before the chart, and draws it under it', async () => {
    /* The gold band is drawn at the foot of a chart, where the old portal had it,
       and a heading that comes after its own content is a heading nobody can jump
       to: a reader landing on "Najviše maratona" would find the next board's
       columns under it. It is first in the markup and last on the screen, which
       is what `order` in the stylesheet is for. */
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('heading', { level: 1, name: 'Top liste' })

    const region = screen.getByRole('region', { name: 'Najviše maratona' })
    const heading = within(region).getByRole('heading', { level: 2 })
    const columns = within(region).getByRole('list')

    expect(
      heading.compareDocumentPosition(columns) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    // And the stylesheet is what puts it back at the foot.
    const css = readFileSync(join(process.cwd(), 'src/components/ColumnChart.css'), 'utf-8')
    const band = css.slice(css.indexOf('.colchart__caption {'))

    expect(band.slice(0, band.indexOf('}'))).toMatch(/order:\s*1/)
  })

  it('draws the five lengths as charts, ten columns at the most', async () => {
    /* Owner, 04.08.2026: "poslednjih 5 vidžeta uradi grafikone kao sa naslovne
       strane... bez rotiranja (jer će svaki imati svoj prikaz)". So each of the
       five stands still and keeps its own widget, and none of them is a table
       any more. */
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('heading', { level: 1, name: 'Top liste' })

    for (const name of [
      'Najviše kraćih trka',
      'Najviše dužih trka',
      'Najviše polumaratona',
      'Najviše maratona',
      'Najviše ultramaratona',
    ]) {
      const columns = board(name).getAllByRole('listitem')

      expect(columns.length).toBeGreaterThan(0)
      expect(columns.length).toBeLessThanOrEqual(10)
      expect(board(name).queryByRole('table')).not.toBeInTheDocument()
      // Nothing turns here, so there is no control to stop it either.
      expect(board(name).queryByRole('button')).not.toBeInTheDocument()
      /* And no room kept for the one it does not have. The band across the top
         of the chart is for the pause disc; on a board it was fifty empty pixels
         over the bars, which is the whole of the owner's sixth note on
         04.08.2026: "gornji deo widgeta je neiskorišćen". The room is asked for
         by the class, so the class is what says whether it was asked for: put on
         every chart, the band comes back on all six boards and nothing else on
         the portal changes. */
      expect(screen.getByRole('region', { name })).not.toHaveClass('colchart--control')
    }
  })

  it('puts the tallest column first and the number inside every bar', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('heading', { level: 1, name: 'Top liste' })

    const counts = board('Najviše kraćih trka').getAllByRole('listitem').map(countIn)

    expect(counts.length).toBeGreaterThan(1)
    expect([...counts].sort((left, right) => right - left)).toEqual(counts)
  })

  it('leads from a column of a chart to the profile behind it', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('heading', { level: 1, name: 'Top liste' })

    const columns = board('Najviše polumaratona').getAllByRole('listitem')

    expect(within(first(columns)).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/sr/takmicar/'),
    )
  })

  it('says so on a chart that the season leaves empty', async () => {
    // 2012 has two results in it, and neither of them is a marathon.
    renderAt('/sr/top-liste?sezona=2012')

    expect(await screen.findByRole('heading', { level: 2, name: 'Najviše maratona' })).toBeVisible()
    expect(
      board('Najviše maratona').getByText('U ovoj sezoni nema nijednog rezultata.'),
    ).toBeVisible()
    expect(board('Najviše maratona').queryAllByRole('listitem')).toHaveLength(0)
  })

  it('ranks the single races by the points of one result, and shows the whole of it', async () => {
    /* Owner, 04.08.2026: the board carried the event and the points, which says
       what it ranks by and nothing about the race that earned it. A reader
       looking at the ten best runs of a season wants to see what they were, so
       the whole result is here, which is also why this board takes the whole
       width of the page. */
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najbolji pojedinačni rezultati' })
    const races = board('Najbolji pojedinačni rezultati')

    expect(races.getAllByRole('columnheader').map((one) => one.textContent)).toEqual([
      '#',
      'Član',
      'Trka',
      'd (km)',
      '+ (m)',
      '− (m)',
      'Vreme',
      'Bodovi',
    ])

    const points = races.getAllByRole('row').slice(1).map(lastNumberIn)

    expect([...points].sort((left, right) => right - left)).toEqual(points)

    /* And every row says the race it is, not merely eight things that look like
       a race. Each is looked up in the record by the points it was ranked on,
       and the five columns after the name are read back off it: a column drawn
       from the wrong field, or two of them changed places, is eight cells that
       are all filled and all plausible. */
    const record = await racesOf(2019)
    const rows = races.getAllByRole('row').slice(1)

    expect(rows.length).toBeGreaterThan(1)

    for (const row of rows) {
      const cells = within(row).getAllByRole('cell')

      expect(cells).toHaveLength(8)
      const points = must(last(cells).textContent, 'the points of the row')

      /* Through `must`, so a row whose points match no result in the season says
         so: left to itself the lookup arrives as undefined and the failure reads
         "undefined is not iterable", which names neither the row nor the season. */
      expect(must(record.get(points), `the races worth ${points} points`)).toContainEqual(
        cells.map((cell) => cell.textContent).slice(2, 7),
      )
    }
  })

  it('names the race a runner ran, not the event it was run at', async () => {
    /* Owner, 23.08.2026, about the lists of results: „treba da se prikazuju nazivi
       trka na kojima je čovek učestvovao, a ne događaja", and on 24.08.2026 about
       this board, which was not in the list when that was decided: „treba da bude
       naziv trke onda". Until then it printed the event, so an event with nine
       races on one morning was nine rows of one text.

       Served rather than read, and that is the point of the round: a race opens
       under the name of its event and only a hand parts them (owner, 23.08.2026),
       so in the generated data the two agree on every one of the best results of
       every season, measured. Read off the file as it is, this test passes just as
       well with the event in the column, which is a test that cannot fail. One
       record is given a race renamed by hand, which is the case the column exists
       for. */
    const served = globalThis.fetch
    const best = 'res-01815'
    const own = 'Sri Chinmoy Šamorin, 125 km'

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const answer = await served(input, init)

      if (!String(input).endsWith('/results.json')) {
        return answer
      }

      const results: Result[] = await answer.json()

      return new Response(
        JSON.stringify(results.map((one) => (one.id === best ? { ...one, raceName: own } : one))),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })

    try {
      renderAt('/sr/top-liste?sezona=2019')

      await screen.findByRole('table', { name: 'Najbolji pojedinačni rezultati' })
      const races = board('Najbolji pojedinačni rezultati')

      expect(races.getByText(own)).toBeVisible()
      /* Exactly, so the event's own name standing alone in that cell is what
         fails here rather than the row simply being found twice. */
      expect(races.queryByText('Sri Chinmoy Šamorin')).toBeNull()
    } finally {
      vi.stubGlobal('fetch', served)
    }
  })

  it('keeps four columns on a telephone, the way the standing does', async () => {
    /* Eight columns in 360 pixels is 211 pixels of sideways scroll inside the
       card, which is the thing PDL P12 forbids in as many words: what a phone
       keeps is the place, the name, one column of its own and the measure. The
       columns are marked rather than dropped, so the head and the body cannot
       disagree about which went. */
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najbolji pojedinačni rezultati' })
    const races = board('Najbolji pojedinačni rezultati')

    const onPhone = (row: HTMLElement, role: 'columnheader' | 'cell') =>
      within(row)
        .getAllByRole(role)
        .map((one, index) => ({ index, hidden: one.className.includes('table__hide-phone') }))
        .filter((one) => !one.hidden)
        .map((one) => one.index)

    const rows = races.getAllByRole('row')
    const kept = onPhone(at(rows, 0), 'columnheader')

    expect(
      within(at(rows, 0))
        .getAllByRole('columnheader')
        .filter((_, index) => kept.includes(index))
        .map((one) => one.textContent),
    ).toEqual(['#', 'Član', 'Trka', 'Bodovi'])

    /* The same columns, not merely the same number of them. Counted, the
       distance could hide while the race stayed and the heading "Trka" would sit
       over a figure: four columns either way, and nothing would say so. */
    expect(onPhone(at(rows, 1), 'cell')).toEqual(kept)
  })

  it('writes the measure of a board the way every measure on the portal is', async () => {
    /* Bold, and gold on the row that leads. It is the last column of every board
       and it lost both when the boards learned to carry more than one column;
       the Top liste were then the one place on the portal where the number a
       table ranks by looked like any other number. */
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najviše kilometara' })

    for (const name of ['Najviše kilometara', 'Najduže na stazi', 'Najbolji pojedinačni rezultati']) {
      const rows = board(name).getAllByRole('row').slice(1)
      const cells = within(at(rows, 0)).getAllByRole('cell')

      expect(last(cells).className).toContain('table__points')
      /* And nothing before it claims to be the measure. */
      expect(cells.slice(0, -1).filter((one) => one.className.includes('table__points'))).toEqual([])
    }
  })

  it('carries the season in the address only while it is not the one it opens on', async () => {
    /* The shared control, as on the teams and on a profile (its own reasoning is
       in SeasonPicker.tsx). This screen used to write the year every time, so an
       address named the season it was already showing; the boards drew the same
       thing either way, and it is the one behaviour that changed when the copy
       of this control here was given up for the shared one. */
    const user = setupUser()
    const { router } = renderAt('/sr/top-liste', 'visitor', null, undefined, '2026-06-01')

    const season = selectElement(await screen.findByLabelText('Sezona'))
    const opens = season.value

    expect(router.state.location.search).toBe('')

    await user.selectOptions(season, '2019')
    expect(router.state.location.search).toBe('?sezona=2019')

    await user.selectOptions(season, opens)
    expect(router.state.location.search).toBe('')
    /* And the boards are of that season either way. */
    expect(selectElement(screen.getByLabelText('Sezona')).value).toBe(opens)
  })

  it('offers the seasons that have results, and never all of them at once', async () => {
    /* A board of a season is a ladder of that season, so "all of them" is not a
       thing it can show. The shared control offers it only where nothing is
       handed in as the default, and this screen hands one in. */
    renderAt('/sr/top-liste', 'visitor', null, undefined, '2026-06-01')

    const season = selectElement(await screen.findByLabelText('Sezona'))

    expect(within(season).queryByRole('option', { name: 'Sve' })).not.toBeInTheDocument()
    expect(within(season).getAllByRole('option').length).toBeGreaterThan(3)
  })

  it('tells the stylesheet how many characters the longest number in it is', async () => {
    /* The circle in a bar is as wide as that (owner, 05.08.2026: it has to be a
       circle, and a circle holding two decimals is wider than one holding a
       count of races). The width is worked out in the stylesheet from this one
       number, so without it every circle falls back to the small disc and the
       longest numbers stand half on the bare bar again.

       Both levels of a bar count, because both carry a number, and the lower one
       carries the season before. Which of the two runs longer is a fact about
       the season and not about the chart: in 2013 it is the gain, at six
       characters against five. So what this holds is that the number handed to
       the stylesheet is the longest thing actually drawn on the board; that both
       levels are counted is held on a chart written for it, in
       pages/home/widgets.test.tsx, because no season in the record has the lower
       level longer than the upper one. */
    renderAt('/sr/top-liste?sezona=2013')

    const board = must(
      (await screen.findByRole('heading', { level: 2, name: 'Najbolji napredak' })).closest(
        'section',
      ),
      'the board of best progress',
    )
    const longest = Math.max(
      ...within(board)
        .getAllByRole('listitem')
        .flatMap((column) =>
          ['Prethodna sezona', 'Prirast'].map((level) => writtenIn(column, level).length),
        ),
    )

    expect(longest).toBeGreaterThan(4)
    expect(board.style.getPropertyValue('--count-chars')).toBe(String(longest))

    /* And a board of race counts asks for far less, or every chart on the portal
       would carry the widest circle any of them needs. */
    const races = must(
      (await screen.findByRole('heading', { level: 2, name: 'Najviše maratona' })).closest(
        'section',
      ),
      'a board of race counts',
    )

    expect(Number(races.style.getPropertyValue('--count-chars'))).toBeLessThan(longest)
  })

  it('carries a surname and an initial, so a narrow card can swap one for the other', async () => {
    /* Owner, 05.08.2026: where a full name would take two lines, the surname
       gives way to an initial. Which cards those are is a question about width,
       so the choosing is done by a container query (TopBoards.css) and what is
       held here is that both halves are in the markup and that the name a reader
       hears is the whole one either way. */
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najviše kilometara' })

    for (const name of ['Najviše kilometara', 'Najduže na stazi']) {
      const rows = board(name).getAllByRole('row').slice(1)
      const link = within(at(rows, 0)).getByRole('link')
      const whole = must(link.textContent, 'the name in the row')

      /* The surname stands apart, and the initial after it is the first letter
         of that surname and a full stop. */
      const family = must(link.querySelector('.boards__family'), 'the surname').textContent
      const initial = must(link.querySelector('.boards__initial'), 'the initial')

      expect(family).not.toBe('')
      expect(initial.textContent).toBe(`${must(family, 'the surname').slice(0, 1)}.`)
      /* Read out as the whole name and not as the letter beside it: the initial
         is out of the accessible tree, the surname never is. */
      expect(initial).toHaveAttribute('aria-hidden', 'true')
      expect(link).toHaveAccessibleName(whole.replace(initial.textContent ?? '', '').trim())
    }
  })

  it('sets a figure to the right and words to the left, on every board', async () => {
    /* The shared table pushes its first three columns to the left, which is
       right for a name and wrong for a number, and on two of these boards the
       measure is the third column. Each cell therefore says which of the two it
       is, and the head says the same as the body under it: a heading over its
       column and the figures under it drifting apart is the one thing a reader
       sees before anything else.

       Held here because the alignment lives in a stylesheet jsdom does not
       apply. What is checked is that the marks are on the right cells, and
       goldBand.test.ts checks that the stylesheet still does something with
       them. */
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najbolji pojedinačni rezultati' })

    for (const [name, expected] of [
      ['Najviše kilometara', ['figure']],
      ['Najduže na stazi', ['figure']],
      ['Najbolji pojedinačni rezultati', ['words', 'figure', 'figure', 'figure', 'figure', 'figure']],
    ] as const) {
      const rows = board(name).getAllByRole('row')
      /* The place and the name are the shared table's own two columns and are
         set by it; what these marks are for is everything after them. */
      const setting = (one: Element) => {
        const words = one.className.includes('boards__detail')
        const figure = one.className.includes('boards__figure')

        if (words === figure) {
          throw new Error(`"${one.textContent}" says neither that it is words nor that it is a figure`)
        }

        return words ? 'words' : 'figure'
      }

      expect(within(at(rows, 0)).getAllByRole('columnheader').slice(2).map(setting)).toEqual(
        expected,
      )
      expect(within(at(rows, 1)).getAllByRole('cell').slice(2).map(setting)).toEqual(expected)
    }
  })

  it('marks the leader of a board and nobody else', async () => {
    /* Owner, 04.08.2026: "Nagrade se i dodeljuju samo najboljima." The standing
       still gilds three, because three is its podium; a Top lista gilds one. */
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najviše kilometara' })

    for (const name of ['Najviše kilometara', 'Najduže na stazi', 'Najbolji pojedinačni rezultati']) {
      const rows = board(name).getAllByRole('row').slice(1)
      /* Read off the place written in the row rather than counted, because a
         shared first place is two rows and both of them won: counting one would
         be a test that fails on correct data. None of these three boards has a
         tie at the top today, and none of them is promised not to. */
      const leading = (row: HTMLElement) => first(within(row).getAllByRole('cell')).textContent

      expect(rows.length).toBeGreaterThan(3)
      expect(rows.filter((row) => row.className === 'podium').map(leading)).toEqual(
        rows.filter((row) => leading(row) === '1').map(leading),
      )
      expect(first(rows).className).toBe('podium')
    }
  })

  it('shows the time on the course in the shape the owner asked for', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    const rows = (await screen.findAllByRole('row')).length

    expect(rows).toBeGreaterThan(0)
    expect(board('Najduže na stazi').getAllByText(TIME_ON_COURSE).length).toBe(10)
  })

  it('stands the pairs board empty rather than inventing one', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('heading', { level: 2, name: 'Najbolji trkački parovi' })
    const pairs = board('Najbolji trkački parovi')

    expect(pairs.getByText(/stiže zajedno sa bazom/)).toBeVisible()
    expect(pairs.queryByRole('table')).not.toBeInTheDocument()
  })

  it('draws the progress as one bar of two levels, the season before under the gain', async () => {
    /* Owner, 04.08.2026: "svaki stubac ima dva nivoa: manje istaknut niži iz
       prethodne godine, u koji je upisan skor iz prethodne sezone, i više
       istaknut gornji za tekuću godinu, u koji je upisan prirast."

       Both numbers are read, in that order, and each says what it is: two
       figures in one bar with nothing to tell them apart are not a fact anybody
       can use.

       Rounded to whole points for a day, on the same owner's word, and then to
       two decimals on his next one: "neka vrednosti BTL poena u krugovima budu
       zaokružene na dve decimale. Ovako je neprecizno." The second is what
       stands, and it is what the portal writes everywhere else. */
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('heading', { level: 2, name: 'Najbolji napredak' })

    const columns = board('Najbolji napredak').getAllByRole('listitem')

    /* Five, not ten (owner, 04.08.2026). */
    expect(columns.length).toBeGreaterThan(1)
    expect(columns.length).toBeLessThanOrEqual(5)
    expect(board('Najbolji napredak').queryByRole('table')).not.toBeInTheDocument()

    for (const column of columns) {
      const previous = levelIn(column, 'Prethodna sezona')
      const gain = levelIn(column, 'Prirast')

      /* A whole point is not what a BTL point is: two people a quarter of a
         point apart both read the same number. */
      for (const name of ['Prethodna sezona', 'Prirast']) {
        expect(writtenIn(column, name)).toMatch(/^[\d.]+,\d{2}$/)
      }

      expect(gain).toBeGreaterThan(0)
      /* The drawing agrees with the two numbers written in it. Read off the
         height each level asks for, because that is the only place the
         arithmetic goes: the levels are laid out entirely from it. The whole
         column is this season, so the two of them are the bar between them and
         the lower one is the share the season before was of it. */
      const under = shareOf(column, 'Prethodna sezona')
      const over = shareOf(column, 'Prirast')

      expect(under + over).toBeCloseTo(100, 6)
      expect(under).toBeCloseTo((previous / (previous + gain)) * 100, 0)
      expect(over).toBeGreaterThan(0)
    }
  })

  it('ranks the progress by the gain, tallest first', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('heading', { level: 2, name: 'Najbolji napredak' })

    const gains = board('Najbolji napredak')
      .getAllByRole('listitem')
      .map((column) => levelIn(column, 'Prirast'))

    expect(gains.length).toBeGreaterThan(1)
    expect(gains.some((gain) => Number.isNaN(gain))).toBe(false)
    expect([...gains].sort((left, right) => right - left)).toEqual(gains)
  })

  it('leaves out whoever did not race the season before', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('heading', { level: 2, name: 'Najbolji napredak' })

    /* Miloje Stanojlović scored the second most points of 2019 and ran nothing
       in 2018. Counting the season he was not there as a zero would make his
       whole score a gain and put him at the top of a board about improvement,
       which is the one thing a board about improvement must not do (PDL P12,
       30.07.2026). He is on the boards that measure the season itself. */
    expect(board('Najbolji napredak').queryByText('Miloje Stanojlović')).not.toBeInTheDocument()
    /* By the name the link carries rather than by the words on the screen: on
       this board a surname is drawn in a span of its own, so that a card with no
       room for it can put an initial there instead, and the whole name is the
       accessible name rather than one run of text. */
    expect(
      board('Najviše kilometara').getByRole('link', { name: 'Miloje Stanojlović' }),
    ).toBeVisible()
  })

  it('stands the progress board empty for a season nobody has a season before', async () => {
    renderAt('/sr/top-liste?sezona=2010')

    await screen.findByRole('heading', { level: 2, name: 'Najbolji napredak' })
    const progress = board('Najbolji napredak')

    /* 2010 is the first season with any results at all, so there is nothing to
       measure a gain against and the board says which rules left it empty. Both
       of them: a season in which everybody ran and nobody bettered their total
       is just as empty, and a sentence naming only the first tells that season
       that nobody ran (PDL P12, 30.07.2026). */
    expect(progress.getByText(/trčao i prethodne sezone i popravio njen zbir/)).toBeVisible()
    expect(progress.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('leads from every name to the profile behind it', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najviše kilometara' })
    // The first row of the board, which is the second row of the table.
    const top = at(board('Najviše kilometara').getAllByRole('row'), 1)

    expect(within(top).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/sr/takmicar/'),
    )
  })

  it('opens on a season of its own, and changes every board with one filter', async () => {
    const user = setupUser()
    renderAt('/sr/top-liste')

    const season = await screen.findByLabelText('Sezona')
    // No season in the address, so the page picks one that has results.
    expect(Number(selectElement(season).value)).toBeGreaterThan(2000)

    const before = board('Najviše kilometara')
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent)

    await user.selectOptions(season, '2016')

    expect(screen.getByLabelText('Sezona')).toHaveValue('2016')
    expect(
      board('Najviše kilometara')
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent),
    ).not.toEqual(before)
    // The one filter reaches the charts and the boards further down the page.
    expect(board('Najduže na stazi').getAllByRole('row').length).toBeGreaterThan(1)
    expect(board('Najviše kraćih trka').getAllByRole('listitem').length).toBeGreaterThan(0)
  })
})

describe('Competitors', () => {
  /* Cards rather than a table (PDL P28a): the league is about people, and a row
     does not show a person. */
  it('gives everyone a card with their face, their races and their points', async () => {
    renderAt('/sr/takmicari')

    const cards = within(await screen.findByRole('list')).getAllByRole('listitem')
    expect(cards.length).toBeGreaterThan(20)

    const card = within(first(cards))
    expect(card.getByRole('link')).toBeVisible()
    expect(card.getByText('Trke')).toBeVisible()
    expect(card.getByText('Bodovi')).toBeVisible()
  })

  it('searches, and says so when nothing matches', async () => {
    const user = setupUser()
    renderAt('/sr/takmicari')

    await user.type(await screen.findByLabelText('Pretraga'), '000001')
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1)

    await user.clear(screen.getByLabelText('Pretraga'))
    await user.type(screen.getByLabelText('Pretraga'), 'zzzz')
    expect(screen.getByText('Nema takmičara koji odgovara pretrazi.')).toBeVisible()
  })

  it('gives the same person the same colour every time', async () => {
    renderAt('/sr/takmicari')
    await screen.findByRole('list')

    expect(hueFor('000001')).toBe(hueFor('000001'))
    expect(hueFor('000001')).not.toBe(hueFor('000002'))
    expect(hueFor('000001')).toBeLessThan(360)
  })

  it('does not carry anybody whose fee has not been recorded', async () => {
    /* Before paying, a member has an account and is visible nowhere (PDL P8), and
       since 30.07.2026 they do not even have a member number: it is handed out at
       the moment the fee is recorded. Three of them used to sit in the member list
       as inactive members holding 000032 to 000034, and everything that reads that
       list reads all of it, so they turned up on the front page among the newest
       members. They are not members now; they wait in the queue of memberships,
       and nothing public can reach them.

       The names come out of the queue rather than being written down here. Written
       down, they were three names that competitors.json does not contain and could
       not contain, so the test could not fail whatever the generator did; asked of
       the queue, it fails the day one of the two files carries somebody the other
       one does. */
    const waiting = await loadResource<{ queue: string; who: string }[]>('verification')
    const names = waiting.filter((one) => one.queue === 'payments').map((one) => one.who)

    renderAt('/sr/takmicari')

    const list = within(await screen.findByRole('list'))
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      expect(list.queryByText(name)).not.toBeInTheDocument()
    }
  })
})

describe('CompetitorProfile', () => {
  it('opens on all of them, which is what a profile is', async () => {
    /* Owner, 31.07.2026, reversing the decision of the day before: a profile is
       somebody's whole running life, and the question it answers first is what
       they have done rather than what they have done since January. */
    renderAt('/sr/takmicar/000007')

    await screen.findByRole('heading', { level: 1 })
    const season = selectElement(screen.getByLabelText('Sezona'))
    const years = within(season)
      .getAllByRole('option')
      .map((one) => Number(one.getAttribute('value')))
      .filter((one) => !Number.isNaN(one))

    // All of them, and the years are still on offer one choice away.
    expect(season.value).toBe('sve')
    expect(years.length).toBeGreaterThan(1)
    /* The widget wears no heading any more (owner, 31.07.2026): the season is
       chosen above it and the ring beside it carries the race count. It keeps
       its name where a screen reader can still find it. */
    expect(screen.getByRole('region', { name: 'Zbirna statistika' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Zbirna statistika' })).not.toBeInTheDocument()
    /* And it counts everything except the races, which the ring beside it
       carries. The number itself is not lost: it is in the ring's own reading,
       which is what a screen reader gets instead of the drawing. */
    expect(screen.queryByText(/Odtrčanih trka/)).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('table', { name: 'Trke po dužini' })).getByRole('rowheader', {
        name: 'Zbirno',
      }).parentElement,
    ).toHaveTextContent(/\d+ trk/)
    expect(within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row').length)
      .toBeGreaterThan(1)
  })

  it('chooses the season at the top of the page, level with the name', async () => {
    /* It has been four things in three weeks: a band of its own with a sentence
       under it, then inside the control that names the part, then beside the name
       (owner, 31.07.2026), and since 23.08.2026 one of three boxes in a grid that
       holds the head, the parts and it, so it can stand beside the name on a wide
       screen and in the row with the parts on a narrow one.

       Asked here as „one of the three, and only one": which row it lands in is a
       question for a browser and jsdom lays nothing out (ADL A18), so the numbers
       live in `Profile.css` where they were measured. */
    renderAt('/sr/takmicar/000007')

    const heading = await screen.findByRole('heading', { level: 1 })
    const top = htmlElement(
      must(heading.closest('.profile__top'), 'the head, the parts and the season'),
    )

    /* And the row around the name still carries the class the whole of its spacing
       comes through. It was the profile's line in the list of screens with a shared
       row that held this, and taking the profile off that list took the last hold on
       it with it: measured, without the class the distance from the name to the
       number goes from 6px to 26,8px and the season is drawn 10,39px below the name.
       A round found that nothing failed when the class was removed. */
    expect([...must(heading.parentElement, 'the row around the name').classList]).toContain(
      'rankings--tooled',
    )

    expect(within(top).getAllByLabelText('Sezona')).toHaveLength(1)
    /* Not inside either of the other two, which is what lets one grid put it in
       either row without drawing it twice. */
    expect(
      within(must(heading.parentElement, 'a parent')).queryByLabelText('Sezona'),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation', { name: 'Delovi profila' })).queryByLabelText('Sezona'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Sezona se bira jednom/)).not.toBeInTheDocument()
  })

  it('narrows only the table by length, and leaves the widgets on the season', async () => {
    /* The season governs everything on the page; the length governs the table
       and nothing else. A donut narrowed to marathons is a chart with one
       segment, and a scoreboard quietly showing marathon kilometres under a
       heading that names a season is a number meaning whatever the reader
       guesses. */
    const user = setupUser()
    renderAt('/sr/takmicar/000007?sezona=sve')

    await screen.findByRole('heading', { level: 1 })
    /* Counted as the heading counts them, not as the table draws them: the
       table grows as it is read and stops at fifty, so the number of rows on
       screen says how far somebody has scrolled, not how many results there
       are (CompetitorProfile.tsx). */
    const all = Number(must(document.querySelector('.profile__count')?.textContent, 'the count beside the heading'))

    /* What the ring says before and after, read whole. Naming one length would
       not do any more: the ring names only the lengths this person has run, so
       an anchor row is not guaranteed to be there. Reading every row also makes
       the check stronger, because narrowing the ring to marathons would show up
       as rows disappearing, not merely as one number changing. */
    const ring = () =>
      within(screen.getByRole('table', { name: 'Trke po dužini' }))
        .getAllByRole('row')
        .map((row) => row.textContent)
    const before = ring()

    expect(before.length).toBeGreaterThan(1)

    await user.click(screen.getByRole('button', { name: 'Maraton 42,2 km' }))
    /* The rows themselves, not only the count: the count is the expression
       the table draws from, so it cannot tell the two apart. */
    const lengths = within(screen.getByRole('table', { name: 'Rezultati' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => must(at(within(row).getAllByRole('cell'), 2).textContent, 'the length cell'))
      .map((text) => text.split(':')[0])

    expect(lengths.length).toBeGreaterThan(0)
    expect([...new Set(lengths)]).toEqual(['Maraton'])

    expect(Number(must(document.querySelector('.profile__count')?.textContent, 'the count beside the heading'))).toBeLessThan(all)
    expect(ring()).toEqual(before)
  })

  it('lets a filter go again', async () => {
    const user = setupUser()
    renderAt('/sr/takmicar/000007?sezona=sve')

    await screen.findByRole('heading', { level: 1 })
    /* Counted as the heading counts them, not as the table draws them: the
       table grows as it is read and stops at fifty, so the number of rows on
       screen says how far somebody has scrolled, not how many results there
       are (CompetitorProfile.tsx). */
    const all = Number(must(document.querySelector('.profile__count')?.textContent, 'the count beside the heading'))

    await user.selectOptions(screen.getByLabelText('Sezona'), '2020')
    expect(Number(must(document.querySelector('.profile__count')?.textContent, 'the count beside the heading'))).toBeLessThan(all)

    await user.selectOptions(screen.getByLabelText('Sezona'), 'sve')
    expect(Number(must(document.querySelector('.profile__count')?.textContent, 'the count beside the heading'))).toBe(all)
  })

  it('shows a season from the address that this person has nothing in', async () => {
    /* The select is built from the seasons they raced, so a season named in the
       address matched no option and the control drew itself empty. */
    renderAt('/sr/takmicar/000007?sezona=2010')

    await screen.findByRole('heading', { level: 1 })
    expect(selectElement(screen.getByLabelText('Sezona')).value).toBe('2010')
  })

  it('names the race a result was run in, not the event it belonged to', async () => {
    /* Owner, 23.08.2026: „u listi rezultata na profilu npr. treba da se prikazuju
       nazivi trka na kojima je čovek učestvovao, a ne događaja."

       Measurable only because one race in the data carries a name of its own:
       „Mrazijada, polumaraton" under the event „Mrazijada". Every other race is
       named after its event, so a screen drawing the wrong one of the two would
       look right everywhere else, and a round measured exactly that — three
       mutations that put the event's name back went unnoticed by 2137 tests. */
    renderAt('/sr/takmicar/000002?sezona=2020')

    const results = await screen.findByRole('table', { name: /Rezultati/ })
    const inside = within(results)

    expect(
      inside.getAllByRole('columnheader').map((one) => one.textContent),
      'the heading says the column holds events',
    ).toContain('Trka')

    const named = inside
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[1]?.textContent ?? '')

    expect(named.some((one) => one.includes('Mrazijada, polumaraton')), named.join(' | ')).toBe(
      true,
    )
  })

  it('gives the heading back to the name and puts the club in the line below', async () => {
    /* Owner, 31.07.2026. The club spent a day in brackets inside the heading and
       now stands after how long this person has been in the league: "U ligi od
       2014. · U klubu Dunavski trkači od 2014." Two different facts, said the
       way anybody would say them. */
    renderAt('/sr/takmicar/000001')

    const heading = await screen.findByRole('heading', { level: 1 })

    expect(heading.textContent).not.toMatch(/[()]/)
    expect(within(heading).queryByRole('link')).not.toBeInTheDocument()

    const club = screen.getByText(/U klubu/)
    expect(club.textContent).toMatch(/U klubu .+ od \d{4}\./)
    expect(within(club).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/tim/'),
    )
    expect(screen.getByText(/U ligi od \d{4}\./)).toBeVisible()
  })

  it('says nothing about a club for somebody who is in none', async () => {
    // 000002 has no team, and empty brackets or a year with nothing to belong
    // to would both be worse than the plain fact.
    renderAt('/sr/takmicar/000002')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText('Bez tima')).toBeVisible()
    expect(screen.queryByText(/U klubu/)).not.toBeInTheDocument()
  })

  it('leads to what the competitor has won, and back', async () => {
    const user = setupUser()
    renderAt('/sr/takmicar/000001')

    await screen.findByRole('heading', { level: 1 })
    await user.click(screen.getByRole('link', { name: 'Priznanja i nagrade' }))

    expect(await screen.findByRole('heading', { name: /^Pehari \d+$/ })).toBeVisible()
    /* The season control stands on this part too, and narrows it (owner,
       31.07.2026): one choice at the top of the page governs both. */
    expect(screen.getByLabelText('Sezona')).toBeVisible()

    await user.click(screen.getByRole('link', { name: 'Pregled' }))
    expect(await screen.findByRole('region', { name: 'Zbirna statistika' })).toBeVisible()
  })

  it('shows the biography beside the widgets where there is one', async () => {
    /* Named "Svojim rečima" rather than "Biografija" (owner, 31.07.2026): the
       box holds a paragraph the member wrote about themselves, and a biography
       promises a page. */
    renderAt('/sr/takmicar/000001')

    expect(await screen.findByRole('heading', { name: 'Svojim rečima' })).toBeVisible()
  })

  it('draws the biography card for the members who have not written one too', async () => {
    /* Owner, 31.07.2026: the card stands on every profile. Everybody will have
       one, since it is written at the moment of joining, and a row of three
       that is sometimes a row of two changes shape from person to person for no
       reason the reader can see. */
    renderAt('/sr/takmicar/000002')

    expect(await screen.findByRole('heading', { name: 'Svojim rečima' })).toBeVisible()
    expect(screen.getByText(/još nije napisao ništa/)).toBeVisible()
  })

  it('hides the profile of a member who is no longer active', async () => {
    /* PDL P11: "Nigde na portalu nema vidljiv profil", "softverski je sakriven
       kao da ne postoji". Nothing read the flag, so the profile of somebody who
       had left was public; there was no such member in the data either, so the
       rule had nothing to be checked against. 000032 is one now. */
    renderAt('/sr/takmicar/000032')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovog profila nema.' }),
    ).toBeVisible()
  })

  /* Its own limit, and not the whole suite's: `ADL.md` A2 keeps `testTimeout` at the
     Vitest default because that number is a performance budget rather than a guard
     against hanging, and „test koji zaista čeka da vreme prođe nosi sopstveni rok, ne ceo
     paket". This one presses „load more" up to twenty times and redraws a table that
     grows each time, so it is slow by construction rather than by accident: 3237 ms here,
     and the machine that decides is about half again slower, which put it over five
     seconds and failed a branch that had nothing to do with it. */
  it('names on the ring only the lengths this person has run', async () => {
    /* It used to draw all five whatever the counts were, so most profiles
       carried three rows reading nought (owner, 31.07.2026). Checked against the
       table of results rather than against a fixed number, or this passes on any
       count at all. */
    const user = setupUser()
    renderAt('/sr/takmicar/000007?sezona=sve')

    const chart = await screen.findByRole('table', { name: 'Trke po dužini' })

    /* The whole table first. It grows as it is read and stops at fifty, and this
       reads the lengths out of the rows: with only the first fifty on screen a
       length that this person ran once, late, would be missing from the reading
       and not from the ring. */
    for (let guard = 0; guard < 20; guard += 1) {
      const more = screen.queryByRole('button', { name: 'Učitaj još rezultata' })

      if (more === null) {
        break
      }

      await user.click(more)
    }

    /* And it really did fill: the loop is allowed to run out, and a reading taken
       from a table still half drawn would pass while saying nothing. */
    expect(screen.queryByRole('button', { name: 'Učitaj još rezultata' })).toBeNull()

    /* And the wall says it ended without writing it on the screen (owner,
       23.08.2026: „Linija na dnu To je sve, 78 rezultata ne treba da postoji").
       Read off the class, because jsdom applies no stylesheet and `toBeVisible`
       cannot tell a hidden paragraph from a drawn one (ADL A18); the sentence
       itself stays, because the focus lands on it after the last press and it is
       what tells a reader who cannot see the wall that it ended rather than broke
       (components/LoadMore.tsx).

       The same sentence over the coins has its own guard in
       `profile/profile.test.tsx`; this is the wall the owner named, and until
       23.08.2026 it had none: taking `endShown` off it left the whole suite
       green. */
    const end = screen.getByText(/^To je sve, \d+ rezultat/)

    expect([...end.classList], 'the end of the wall is written on the screen').toEqual([
      'visually-hidden',
    ])

    // Everything the ring names, less the total, which is not a length.
    const named = within(chart)
      .getAllByRole('rowheader')
      .map((one) => one.textContent)
      .filter((one) => one !== 'Zbirno')

    /* The length has no column of its own any more: it is the colour of the dot
       beside the distance, and its name is there for a screen reader, which is
       what this reads. */
    const cells = within(screen.getByRole('table', { name: 'Rezultati' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => must(at(within(row).getAllByRole('cell'), 2).textContent, 'text'))
    const results = cells.map((one) => one.split(':')[0])

    expect(named.length).toBeGreaterThan(0)
    expect(named.length).toBeLessThan(5)
    expect([...named].sort()).toEqual([...new Set(results)].sort())

    /* And the number beside the name is the distance and not one of the two
       columns of climb it now stands next to. Read from the record rather than
       written out here, so a change in the data cannot make this pass for the
       wrong reason. */
    const shown = cells.map((one) => one.split(': ')[1])
    const distances = await distancesOf('000007')

    expect(shown).toEqual(distances)

    /* And the dot beside each distance wears that row's own length. It is the
       one thing on the row that says which of the five it is, and every row
       taking the same colour looked exactly like every row taking its own. */
    const dots = within(screen.getByRole('table', { name: 'Rezultati' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('.profile__dot')?.className.split('--')[1])
    const kinds = results.map((one) => one)

    expect(new Set(dots).size).toBe(new Set(kinds).size)
    expect(dots.every((one) => one !== undefined)).toBe(true)
  }, SLOW)

  it('says which of the four kinds of nothing it is', async () => {
    /* Never raced at all is a different fact from raced but not this season, and
       a reader told the wrong one goes looking for a fault. */
    renderAt('/sr/takmicar/000007?sezona=2010')

    expect(await screen.findByText('U sezoni 2010. nema nijednog rezultata.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Poništi filtere' })).toBeVisible()
  })

  it('says so when the competitor does not exist', async () => {
    renderAt('/sr/takmicar/M9999')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovog profila nema.' }),
    ).toBeVisible()
  })

  it('handles a competitor who has never raced', async () => {
    // 000031 is the deliberately empty profile in the generated data. Read over
    // the whole career, or the season now would be the reason the table is empty.
    renderAt('/sr/takmicar/000031?sezona=sve')

    expect(await screen.findByText('Na ovom profilu još nema nijednog rezultata.')).toBeVisible()
    // Nothing to filter, so nothing to reset.
    expect(screen.queryByRole('button', { name: 'Poništi filtere' })).not.toBeInTheDocument()
  })

  it('says plainly when somebody is in no team', async () => {
    renderAt('/sr/takmicar/000006')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText('Bez tima')).toBeInTheDocument()
  })

  it('leads to the team page', async () => {
    renderAt('/sr/takmicar/000007')

    /* Scoped to the head of the page: over the whole career the table below
       carries dozens of event names, and some of them are clubs too. */
    const head = htmlElement((await screen.findByRole('heading', { level: 1 })).closest(
      'header',
    ))

    expect(within(head).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/sr/tim/'),
    )
  })

  it('never tells a visitor who is a member freed of the fee', async () => {
    // It is a fact about money, not about running, and it is nobody's business.
    renderAt('/sr/takmicar/000007')

    await screen.findByRole('heading', { level: 1 })

    /* Every way the portal has of saying it, found by its key rather than typed here,
       and read off the whole page rather than out of one element.
       Both halves were wrong before. Asked as the exact text of a single node, this
       passed while the profile printed the fact in plain words: `profile__meta` writes
       the category, the town and „U ligi od" as bare text in one paragraph, and a fourth
       phrase among them is invisible to `queryByText`. Measured, a review put it there
       and this stayed green. And asked about one key, it watched the one key no
       component draws, while the portal says the same thing in three others. */
    /* The markup and not only the words in it: `textContent` carries no attribute, so
       the same phrase put in a `title` or an `aria-label` was shown to anybody hovering
       the member number and read aloud to every screen reader, with nothing failing.
       Measured. */
    const shown = `${document.body.textContent ?? ''} ${document.body.innerHTML}`
    const sayings = everySaying('feeexempt')

    expect(sayings.length, 'the dictionary has no way of saying the fee is waived').toBeGreaterThan(
      1,
    )

    for (const [key, said] of sayings) {
      expect(shown, `${key} stands on a public profile`).not.toContain(said)
    }
  })

  it('names itself on a profile too, in the one shape the portal has', async () => {
    /* It was a pill with its name hidden, on the reasoning that beside a name a
       labelled field reads as a second heading. The owner asked for the same
       shape on every screen on 05.08.2026, so the name is drawn here as well,
       and the first year on offer is all of them. */
    renderAt('/sr/takmicar/000007')

    const control = await screen.findByLabelText('Sezona')

    expect(within(must(control.closest('label'), 'the label around it')).getByText('Sezona')).not.toHaveClass(
      'visually-hidden',
    )
    expect(within(control).getAllByRole('option').map((one) => one.textContent)[0]).toBe('Sve')
  })
})

describe('EventDetail', () => {
  it('says so when the event does not exist', async () => {
    renderAt('/sr/kalendar/nepostojeci-dogadjaj')

    expect(await screen.findByRole('heading', { level: 1, name: 'Ovog događaja nema.' })).toBeVisible()
  })
})

/* The page that said what membership costs was deleted on 04.08.2026, with the
 * story of the league: "O ligi i Članarina se brišu" (owner). What is charged is
 * on the screen of a member's own membership and in the terms of use, and both
 * are held to `pricing.ts` in their own files. */

describe('Teams', () => {
  it('names its season control and draws it in the shape the other screens use', async () => {
    /* Owner, 04.08.2026: the one here "je ružnija nego u Top listama". It is the
       same control as the season on the Top liste now, with its name beside it
       rather than said only to a screen reader. The pill stays on a profile,
       where the name of the competitor is the heading and a labelled field
       beside it would read as a second one. */
    renderAt('/sr/timovi')

    const control = await screen.findByLabelText('Sezona')

    expect(control.tagName).toBe('SELECT')
    /* Drawn, not merely said. jsdom applies no stylesheet, so what is asked is
       which of the two the markup carries; the class is the mechanism, and
       `toBeVisible` cannot see it. */
    expect(within(must(control.closest('label'), 'labela')).getByText('Sezona')).not.toHaveClass(
      'visually-hidden',
    )
  })

  /** The first table on the screen is the standing; the drawers open inside it. */
  const standing = async () => within(await screen.findByRole('table'))

  it('ranks teams by the plain sum of their members', async () => {
    renderAt('/sr/timovi')

    const rows = (await standing()).getAllByRole('row').slice(1)

    expect(rows.length).toBeGreaterThan(1)
    expect(first(rows).className).toBe('podium')
  })

  /* The drawer is gone (owner, 31.07.2026). Who is in a team and what each of
     them brought lives on the team's own page, which is where somebody who
     wants it is going anyway, so a row here is a team and a link to it. */
  it('carries no way to open a team inside the table', async () => {
    renderAt('/sr/timovi')

    await standing()
    expect(screen.queryByRole('button', { name: /članove tima/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Ovaj tim još nema članova.')).not.toBeInTheDocument()
  })

  /* A team is a thing of one season, so the standing is of one season and all
     of them is not on offer (owner, 31.07.2026). */
  it('stands for one season, chosen beside the heading, and never for all of them', async () => {
    const user = setupUser()
    renderAt('/sr/timovi', 'visitor', null, undefined, '2026-06-01')

    await standing()
    const season = selectElement(screen.getByLabelText('Sezona'))

    expect(season.value).toBe('2026')
    expect(within(season).queryByRole('option', { name: 'Sve' })).not.toBeInTheDocument()

    /* Every team keeps its row whatever the season, so what has to change is
       what the rows say: the points are of the season being looked at. */
    const points = async () =>
      (await standing())
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell').at(-1)?.textContent)

    const before = await points()

    await user.selectOptions(season, '2019')
    expect(selectElement(screen.getByLabelText('Sezona')).value).toBe('2019')
    expect(await points()).not.toEqual(before)
  })

  it('says so plainly when there is no team at all', async () => {
    /* Every other screen says what an empty one means rather than showing an
       empty table with headings over nothing. The standing had the sentence
       written and never reached it. */
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/teams.json')
        ? new Response('[]', { headers: { 'content-type': 'application/json' } })
        : real(input))

    try {
      renderAt('/sr/timovi', 'visitor', null, undefined, '2026-06-01')

      expect(await screen.findByText('Nema timova.')).toBeVisible()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    } finally {
      globalThis.fetch = real
    }
  })

  it('ignores a season in the address that it does not offer', async () => {
    /* A shared link naming 1999 names a season the league never ran. Taking it
       left the control with no option to sit on, so it rendered blank, while
       the table below showed every team at 0,00 with nothing saying which year
       that was. The address picks from the options; it does not add to them. */
    renderAt('/sr/timovi?sezona=1999', 'visitor', null, undefined, '2026-06-01')

    await standing()

    expect(selectElement(screen.getByLabelText('Sezona')).value).toBe('2026')
    expect(
      within(screen.getByLabelText('Sezona')).queryByRole('option', { name: '1999' }),
    ).not.toBeInTheDocument()
  })
})

/* The control beside a heading, on every screen that has one (owner,
 * 05.08.2026: the same vertical position as on the teams).
 *
 * Where it lands is a matter of layout, which jsdom does not do, and the rules
 * that place it are guarded as text in styles/goldBand.test.ts. What is held
 * here is the other half of it: that each screen actually asks for that row, so
 * a page keeping its own arrangement fails rather than quietly sitting where it
 * used to.
 */
describe('the row a screen opens with', () => {
  for (const [path, screenName, role] of [
    ['/sr/tabela', 'the season table'],
    /* On an event, as somebody who administers one, which since 23.08.2026 is
       the only way this row has anything in it: the way into the form left it
       for the rows of the table, so a member who has not run this event is
       offered nothing here and the row draws nothing at all. The event's head
       became the shared row on 06.08.2026, and nothing held that it had
       (goldBand.test.ts says only that the old grid is gone, which stays true
       whatever replaces it). */
    ['/sr/kalendar/fruskogorski-maraton-2010', 'an event', 'superadmin'],
    ['/sr/takmicari', 'the competitors'],
    ['/sr/timovi', 'the teams'],
    ['/sr/top-liste', 'the top boards'],
    ['/sr/kalendar', 'the calendar'],
    /* A profile is **not** on this list since 23.08.2026, and that is the owner's
       decision rather than an oversight: its season has to stand beside the name on
       a wide screen and in the row with the parts on a narrow one, so the head, the
       parts and the season are one grid and the season is a child of that grid
       rather than of the row around the heading (`profile/ProfileHead.tsx`,
       `ProfileTop`). What it does keep is asked two blocks up, in „chooses the
       season at the top of the page". */
    ['/sr/tim/dunavski-trkaci', 'a team'],
  ] as const) {
    it(`is the shared one on ${screenName}`, async () => {
      renderAt(path, role ?? 'competitor', '000007')

      const heading = await screen.findByRole('heading', { level: 1 })
      const row = must(heading.parentElement, 'the row around the heading')

      /* The whole class and not a piece of one: `toContain` on the string was
         happy with `rankings--tooledX`, which is a class no stylesheet has. */
      expect([...row.classList]).toContain('rankings--tooled')
      /* A child of that row and not merely somewhere inside it: the row places
         its own children, so a control wrapped in one more element is a control
         that has left the row while every class it wears is still in the page. */
      expect(
        [...row.children].some((one) => [...one.classList].includes('rankings__head-tool')),
      ).toBe(true)
    })
  }
})

/* The row that belongs to whoever is reading (owner, 05.08.2026: "moj red ...
 * treba da bude istaknut").
 *
 * Four screens draw it and one class carries it, so what is checked is that
 * each of the four asks the question, and that three of them say nothing to a
 * visitor: the mark is a fact about the reader, and a portal that marks a row
 * for somebody who has not signed in is telling them something about a
 * stranger.
 */
/* An empty box is not nothing.
 *
 * The row is a grid of two tracks, so a second child with nothing in it is
 * still a track: the heading beside it loses the gap and the space that child
 * would have taken. The component says it draws no box when it has nothing to
 * put in one, and that claim is the reason the old two by two grid could be
 * deleted, so it is held here rather than believed. */
describe('the head of an event with nothing to offer', () => {
  for (const [name, role, member, address] of [
    ['a visitor', 'visitor', null, '/sr/kalendar/fruskogorski-maraton-2010'],
    /* A member on a race nobody has run: signed in, so the early return cannot
       be reached by being nobody, and nothing to report or rate. */
    ['a member before the race', 'competitor', '000007', '/sr/kalendar/sidski-novogodisnji-maraton-2027'],
  ] as const) {
    it(`draws no box for ${name}`, async () => {
      /* Read on a fixed day. On the real clock the second case says the
         opposite of itself from 16.01.2027, which is a test that breaks the
         build on a date rather than on a change. */
      renderAt(address, role, member, undefined, '2026-12-31')

      const heading = await screen.findByRole('heading', { level: 1 })
      const row = must(heading.parentElement, 'the row around the heading')

      /* The mark of the race is not a box of controls: it stands beside the
         name from 11.08.2026, it is a fact rather than something to press, and
         a race rated in an earlier edition carries one before this year's
         running (event/OverallMark.tsx). What this holds is that there is no
         second track holding nothing. */
      const boxes = [...row.children]
        .map((one) => one.className)
        .filter((one) => one !== 'comments__mark')

      expect(boxes).toEqual([heading.className])
    })
  }
})

describe('the row of whoever is signed in', () => {
  /* 000007 is in the field of 2019 on every one of these screens, and is in a
     team, which the standing of teams needs. */
  const ME = '000007'

  const marked = (rows: HTMLElement[]) => rows.filter((row) => row.classList.contains('table__mine'))

  it('is marked in the season table, and nowhere else in it', async () => {
    renderAt('/sr/tabela?sezona=2019', 'competitor', ME)

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)
    const mine = marked(rows)

    expect(mine).toHaveLength(1)
    expect(within(at(mine, 0)).getByText(ME)).toBeInTheDocument()
  })

  it('is marked on every board that is a table and has him, and on no chart', async () => {
    /* 2015 rather than 2019, because in 2015 he stands on all three boards that
       are tables. A season where he is on two of them cannot say anything about
       the third, and the third is where the mark would be missing. */
    renderAt('/sr/top-liste?sezona=2015', 'competitor', ME)

    await screen.findByRole('table', { name: 'Najviše kilometara' })

    /* His rows are the ones that lead to his profile, so a board that has him
       and does not mark him is caught rather than covered for by a board that
       does. Which boards those are is a fact about the season, so they are
       looked for rather than named. */
    const his = screen
      .getAllByRole('row')
      .filter((row) =>
        within(row)
          .queryAllByRole('link')
          /* By the member number in front of the address rather than by the whole
             of it: the address carries the name behind the number now (PDL P11),
             and this test is about whose row is marked, not about how a name is
             spelt. */
          .some((link) => link.getAttribute('href')?.startsWith(`/sr/takmicar/${ME}`) === true),
      )

    /* Three boards are tables, and he is on all three of them this season. */
    expect(his.length).toBeGreaterThanOrEqual(3)
    expect(marked(his)).toEqual(his)
    /* And nothing inside a chart is marked, which is where the owner drew the
       line: the boards by length draw bars, not rows. */
    expect(document.querySelectorAll('.colchart .table__mine')).toHaveLength(0)
  })

  it('is marked among the results of an event he ran', async () => {
    const results = await loadResource<Result[]>('results')
    const ran = must(
      results.find((one) => one.memberNumber === ME && one.date < '2027-01-01'),
      'a result of his',
    )
    /* Through the race, because the address of an event is its name and the
       year since 10.08.2026 and the id of a race is built from the id of its
       event, which carries the whole day. */
    const races = await loadResource<{ id: string; eventId: string }[]>('races')
    const events = await loadResource<{ id: string; slug: string }[]>('events')
    const race = must(
      races.find((one) => one.id === ran.raceId),
      'the race it was run at',
    )
    const event = must(
      events.find((one) => one.id === race.eventId),
      'the event it was run at',
    )

    renderAt(`/sr/kalendar/${event.slug}`, 'competitor', ME)

    /* The table of results by name, not the first table that appears: the races
       of the event are drawn before the results arrive, and a wait for any row
       at all was over as soon as they were. */
    const rows = within(await screen.findByRole('table', { name: 'Rezultati članova' }))
      .getAllByRole('row')
      .slice(1)

    expect(marked(rows)).not.toHaveLength(0)
  })

  it('is marked on the standing of teams, on the row of his own team', async () => {
    const competitors = await loadResource<Competitor[]>('competitors')
    const me = must(
      competitors.find((one) => one.memberNumber === ME),
      'the member',
    )

    expect(me.teamId, 'the member has to be in a team for this to say anything').not.toBeNull()

    renderAt('/sr/timovi', 'competitor', ME)

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)

    expect(marked(rows)).toHaveLength(1)
  })

  it('says so in words as well as in colour', async () => {
    /* The tint and the bar are for the eye. A reader who is not using one gets
       nothing from either, and the mark is a fact about the reader rather than
       decoration, so the row says it (WCAG 2.2 SC 1.4.1 is about not leaning on
       colour; this is the same thought carried to somebody who sees none of it).
       Said in the first cell of the row, which on three of these four screens is
       the one that numbers it; the results of an event have no such column, so
       there it is the cell with the name in it. */
    for (const [path, said] of [
      ['/sr/tabela?sezona=2019', 'vaš red'],
      ['/sr/top-liste?sezona=2015', 'vaš red'],
      ['/sr/kalendar/beogradski-maraton-2019', 'vaš red'],
      ['/sr/timovi', 'vaš tim'],
    ] as const) {
      cleanup()
      renderAt(path, 'competitor', ME)
      await screen.findAllByRole('row')

      const rows = screen.getAllByRole('row')
      const mine = marked(rows)

      expect(mine.length, `no row of his on ${path}`).toBeGreaterThan(0)

      /* Once in each of his rows, and in none of anybody else's. Said twice it
         is heard twice; said in the wrong dictionary block it comes out as the
         key itself, which is what happened on the teams and what no screen test
         was looking at. */
      for (const row of mine) {
        expect(within(row).getAllByText(said)).toHaveLength(1)
      }

      for (const row of rows.filter((one) => !one.classList.contains('table__mine'))) {
        expect(within(row).queryByText(said)).not.toBeInTheDocument()
      }
    }
  })

  it('says nothing to a visitor, on any of them', async () => {
    for (const path of ['/sr/tabela?sezona=2019', '/sr/top-liste?sezona=2019', '/sr/timovi']) {
      cleanup()
      renderAt(path)
      await screen.findAllByRole('row')

      expect(marked(screen.getAllByRole('row'))).toHaveLength(0)
    }
  })
})

describe('Leagues', () => {
  it('lists what runs alongside the league, and never the league itself', async () => {
    renderAt('/sr/lige')

    expect(await screen.findByRole('heading', { level: 1, name: 'Lige' })).toBeVisible()
    /* And it says nothing about how any of them groups. It said „Grupisanje samo
       po polu" or „Grupisanje po kategorijama" under each until 31.08.2026, when
       the owner settled that there is one ranking and it is by gender („nego
       globalno! Lige treba da imaju poredak samo po polu"): a line printed under
       every competition to say the one thing true of all of them is a line that
       tells a reader there is something to choose between. */
    expect(screen.queryAllByText(/^Grupisanje/)).toEqual([])
    // The league the portal exists for is implied, not listed.
    expect(screen.queryByRole('link', { name: /Balkanska trkačka liga 2027/ })).not.toBeInTheDocument()
  })

  it('says nowhere in its own voice that a competition settles its own categories', async () => {
    /* The line under each competition went in the first round of this change and
       the sentence introducing all of them did not: „Bodovanje je uvek isto, menja
       se samo koji događaji ulaze **i kako se poredak grupiše**", printed above the
       list and, in its own wording, into the description a search engine shows.
       Found in review on 31.08.2026, and worse than the comments found beside it,
       because a member reads this one.

       Asked of what the screen really draws, on the stem „grupis", which „grupiše"
       and „grupišu" share and which no other word on this screen carries.

       **It holds the verb, not the idea.** „...i kako se u njima dele takmičari" says
       the same thing and walks past (measured in review, 31.08.2026). Holding the idea
       would mean listing every way of saying it, which is a guard nobody can keep;
       what this catches is this sentence coming back, and it is the wording it has
       come back in twice.

       **And of the dictionary too, which the screen cannot answer for.** The second
       home said the same thing in its own words and went into the description a
       search engine shows rather than into the page, so a screen test looked
       straight past it: reworded there, the whole suite stayed green (measured
       31.08.2026). Both subtrees are read, so a third place to say it is caught
       before it is drawn anywhere. */
    renderAt('/sr/lige')

    expect(await screen.findByRole('heading', { level: 1, name: 'Lige' })).toBeVisible()
    expect(screen.queryAllByText(/grupi[sš]/i)).toEqual([])

    /* **Every word these four screens draw, held as it stands**
       (`test/leagueScreens.snapshot.json`).

       Six drafts of a refusal over the drawn page were each measured wrong, and each
       failed in both directions at once: „na nivou svake **pojedinačne** Lige" and
       „Kategorije zavise od toga u kojoj se ligi takmičite" walked past, while „Bodovi
       se sabiraju na nivou cele lige, bez obzira na kategoriju", which says the
       opposite of the overturned rule, was refused. A refusal has to be right about
       sentences nobody has written yet, and none of them could be.

       Nothing has ever escaped from a text held as it stands, so that is what this is:
       the words each screen draws, its title, and every label read out to somebody
       working by ear. It judges nothing, so it cannot be wrong about a sentence; it
       only notices that the words changed, which is the question worth asking. It
       holds what no other guard here reaches: a sentence written straight into a
       component, and a key from a branch no snapshot covers. Both were measured to
       pass the whole gate while this was missing (review, 01.09.2026).

       **Read on three sides, because the first draft read one.** The body is where a
       sentence is seen; the head is what a search engine is told, drawn by an effect
       no query over the body reaches; and a screen is opened once as a visitor and
       once as somebody who may change it, since everything behind `canEdit` is
       invisible to the first. A rule was put through each of the three in turn and
       each passed the whole gate while only the body of a visitor's screen was held
       (review, 01.09.2026).

       **What it costs, said plainly:** changing anything these four screens say is a
       deliberate act that comes here too, mock data included. That is the same cost
       the written pages already pay, and it is the point.

       The day is pinned, because a screen that changes with the date would otherwise
       hold today rather than what the portal says. */
    const SCREENS = [
      ['/sr/lige', 'RunTrace liga 2027', 'visitor'],
      ['/sr/liga/brdska-2019', 'Brdska liga 2019', 'visitor'],
      /* The same page under somebody who may change it. Everything drawn behind
         `canEdit` is invisible to a visitor, so a rule put beside the button that
         edits the rules of a competition is read by the one person acting on it and
         by no guard at all (review, 01.09.2026). */
      ['/sr/liga/brdska-2019', 'Brdska liga 2019', 'superadmin'],
      ['/sr/liga/brdska-2019/rezultati', 'Muškarci', 'visitor'],
      ['/sr/administracija/lige', 'RunTrace liga 2027', 'superadmin'],
    ] as const

    const drawn: Record<string, unknown> = screens

    for (const [route, ready, as] of SCREENS) {
      const seat = `${route} · ${as}`

      cleanup()
      renderAt(route, as, null, undefined, '2026-09-01')

      /* Waited for by something only this page draws once its own record has arrived.
         Two tab labels went in here first and neither waits for anything: „Rezultati"
         and „Propozicije" are both written by the shell on the change of route, before
         the record is there, so a page that drew nothing at all passed as if it had
         (measured 31.08. and 01.09.2026). */
      /* All of them, not one. The name of a competition stands both in its heading and
         in the line read out on arriving, and `findByText` throws on a second match
         (measured 01.09.2026). */
      await screen.findAllByText(new RegExp(ready))

      /* Waited on rather than read once, and on a shorter clock than the case itself.
         A screen arrives in two steps: `useRouteChrome` computes the title, the line
         read out on arriving takes it at once, and `applyHead` writes it into the tab
         one cycle later. Read between the two, the same screen answers twice, and the
         first draft of this file held one step in `text` and the other in `title` —
         two different moments of one screen, which is why it failed twice in thirteen
         runs on an untouched tree (review, 01.09.2026).

         The clock matters as much as the wait. Given the same twenty seconds as the
         case, a real change in the words never reports a difference: the case dies of
         its own timeout at the same instant, and vitest prints a bare „Test timed out"
         with no route and no diff, which reads exactly like the flake above. On a
         shorter clock the assertion loses first and says what changed (review,
         01.09.2026). */
      await waitFor(
        () => {
          expect(wordsDrawn(), seat).toEqual(drawn[seat])
        },
        { timeout: SLOW / 4 },
      )
    }

    /* The held file cannot carry a screen this loop never opens. */
    expect(Object.keys(drawn).sort()).toEqual(
      SCREENS.map(([route, , as]) => `${route} · ${as}`).sort(),
    )

    cleanup()
    renderAt('/sr/lige')
    expect(await screen.findByRole('heading', { level: 1, name: 'Lige' })).toBeVisible()

    const said = (branch: unknown): string[] => {
      if (typeof branch === 'string') {
        return [branch]
      }

      /* `leagues.parts` is an object of three names rather than a sentence, so the
         walk goes down rather than stopping at the first one it meets. Measured: a
         grouping written into `leagues.parts.rules` is caught. */
      return branch !== null && typeof branch === 'object' ? Object.values(branch).flatMap(said) : []
    }

    expect(said(sr.leagues).filter((one) => /grupi[sš]/i.test(one))).toEqual([])

    /* The **whole** of `seo`, not the one branch named after this page. Asked of
       `seo.leagues` alone it passed while `seo.adminLeagues` next to it said the
       same thing in its own words and put it into the description of the screen in
       the administration (review, 31.08.2026): the third home, one step further
       along in the object the walk was already in. Nothing else under `seo` says
       the word, so reading all of it costs nothing. */
    expect(said(sr.seo).filter((one) => /grupi[sš]/i.test(one))).toEqual([])

    /* **And the written pages, which are the fifth home and the last one found.**
       Član 57 said „Podela na kategorije zadaje se na nivou svake Lige" — the
       overturned rule itself, in the prose a member accepts on joining, standing while
       the field was gone from the model and the code. The owner had it deleted
       (31.08.2026).

       **Held as the whole section stands.** Three drafts before this one were wrong.
       Two were patterns: the first named two phrasings, so the same rule with the
       words in another order walked past; the second asked for a category and a league
       in one sentence, which refused a legitimate line about the category a
       **competitor** is in, and still let the rule back because the rulebook writes
       „lige" in lower case in thirty-five of the forty-six sentences that mention one.
       The third froze the article and stopped at its last sentence, so the same rule
       put one line further down — still under Član 57, before Član 58 — passed with
       the whole gate green (all three measured in review, 31.08.2026).

       So the unit is the section, which is what a reader meets as one piece, and there
       is no edge left inside it. This is the first passage in this repo held word for
       word; the neighbouring guards read prose with patterns, and that is exactly why
       they kept missing this. The cost is the point: changing any of these four
       articles is a deliberate act that comes here too. */
    const SECTION_13 = `### Član 57. Liga kao pojam

Pored glavnog takmičenja postoje i Lige, zasebna takmičenja sa sopstvenim spiskom događaja koji tokom godine ulaze u njih. Spisak događaja sme da se menja tokom godine.

- Svaka Liga boduje se istim BTL bodovima. Posebnog sistema bodovanja nema.
- Svi članovi su u Ligi automatski, bez prijave.
- Svaka Liga ima svoju stranu i tabelu.

Šta se u pojedinoj Ligi osvaja određuje njen organizator i to nije predmet ovog pravilnika.

### Član 58. BTL Round 'n' Around

Ultramaraton u obliku slobodne trke: prati se ukupna kilometraža i ukupno vreme. Posebnog prikaza za višestruke polumaratone i maratone nema.

Trka može trajati nekoliko minuta ili nekoliko dana, a broj BTL bodova koji se na njoj skupi nije ničim ograničen. Daje sjajnu šansu svima da izvuku iz sebe svoj realan maksimum, i pobednik možda neće biti onaj ko pretrči najviše ili bude najbrži.

Detalji će biti objavljeni na raspisu samog događaja u BTL kalendaru.

### Član 59. BTL dezorijentiring

Nije cilj stići prvi, cilj je tokom sat vremena sakupiti što više BTL bodova. Detalji će biti objavljeni na raspisu samog događaja u BTL kalendaru.

### Član 60. BTL sreda

Redovna trening okupljanja članova lige. Ne boduju se i ne ulaze ni u jednu tabelu.`

    const written = Object.entries(pages).flatMap(([slug, page]) =>
      page.sections.map((one) => ({ slug, heading: one.heading, body: one.body })),
    )
    const held = written.filter((one) => one.slug === 'pravilnik' && one.heading === "13. Prateća takmičenja i lige")

    expect(held, 'the section that carries Član 57 stands once').toHaveLength(1)
    expect(held[0]?.body).toBe(SECTION_13)

    /* **And the words the portal says about a competition, held as they stand**
       (`test/leagueWords.snapshot.json`).

       Four drafts tried to refuse the overturned rule by pattern and each was
       measured wrong. The first named two phrasings, so the words in another order
       walked past. The second asked for a category and a league in one sentence,
       which refused a legitimate line about the category a competitor is in and still
       let the rule back in lower case. The third froze the article and the rule went
       one line below it; the fourth froze the section and it went into the next
       section along. The fifth asked for a pairing and let through „na nivou svake
       **pojedinačne** Lige", „Podelu na kategorije zadaje svaka Liga", „Svaka Liga
       **definiše** svoje takmičarske kategorije", and the rule split across two
       sentences — while refusing „Bodovi se sabiraju na nivou cele lige, bez obzira
       na kategoriju", which says the opposite (all measured in review, 31.08.2026).

       Nothing has ever escaped from inside a text held as it stands. Every escape was
       outside the range. So the range is every word the dictionary says about a
       competition and every description the portal writes about itself, and the rule
       cannot be put back into any of them under any wording.

       **A sentence written straight into a component is not held here**, and does not
       need to be on these screens: the snapshot above draws them and would see it. What
       stays open is the rest of the portal, where nothing keeps Serbian prose out of a
       `.tsx` file. That is a rule about the whole portal rather than about this change,
       and it is written down in `btl-produkt/PENDING.md` instead of being invented
       here.

       The cost is the same as everywhere this is done: a deliberate change to any of
       these words is made here too. The lead sentence alone has carried this rule
       twice and been corrected twice, which is what that cost buys. */
    expect(sr.leagues).toEqual(words.leagues)

    /* **The whole of `seo`, not the four names about competitions.** Held as four, the
       rule went into `seo.rulebook.description`, which is the sentence a search engine
       shows for the rulebook and still under the hundred and sixty characters that
       description is allowed (review, 31.08.2026). Every description the portal writes
       is one place a rule can be put, so every one of them is held.

       The loop walks the **snapshot**, so an emptied snapshot would make no assertion
       at all — but the comparison of key sets below catches that on its own, and a
       floor beside it was a rule with nothing left to do (review, 31.08.2026). It is
       the key sets that keep this from being a check over nothing. */
    const seo: Record<string, unknown> = sr.seo

    for (const [key, said] of Object.entries(words.seo)) {
      expect(seo[key], `seo.${key}`).toEqual(said)
    }

    /* And no description has appeared that the snapshot does not know. */
    expect(Object.keys(seo).sort()).toEqual(Object.keys(words.seo).sort())
  }, SLOW)
})

describe('a member whose fee has run out, in the tables', () => {
  it('stands in the season they raced, with the name but no link', async () => {
    /* PDL P11 has two halves and this is both of them at once: the name stays
       in the table of the season they were a member of, and the link goes,
       because the profile it pointed at is hidden as though it did not exist.
       000032 raced in 2017 and their fee has since run out. */
    // Read on a day well after 2017, so that season is history.
    renderAt('/sr/tabela?sezona=2017', 'visitor', null, undefined, '2026-06-01')

    const table = await screen.findByRole('table')
    const gone = within(table).getByText(/Vojislav Antonijević/)

    expect(gone).toBeVisible()
    expect(
      within(table).queryByRole('link', { name: /Vojislav Antonijević/ }),
    ).not.toBeInTheDocument()
    // Everybody else still has one, or this would pass on a table with no links.
    expect(within(table).getAllByRole('link').length).toBeGreaterThan(0)
  })

  it('is not in the table of the season that is running now', async () => {
    /* The same table, the same season, read on two different days. 000032 raced
       in 2017 and their fee has since run out, so on a day in 2017 that table is
       the season now and they are not in it; on a day after it, it is history
       and they are.
     *
     * Read through the simulated clock and not through the SEASON constant. The
     * constant is 2027 for ever: on the day 2027 became history it would have
     * gone on hiding them from the one archive table the league had, and would
     * never have hidden them from 2028. */
    renderAt('/sr/tabela?sezona=2017', 'visitor', null, undefined, '2017-06-01')

    await screen.findByRole('table')
    expect(screen.queryByText(/Vojislav Antonijević/)).not.toBeInTheDocument()
  })
})

describe('the top boards, when a member on them has left the league', () => {
  it('keep the name on the board and take the link off it', async () => {
    /* PDL P11 again, on the one page that builds its links from a helper rather
       than from the shared component. Nobody in the generated data is both
       inactive and on a board, so the list is made inactive here: without it the
       branch exists and nothing ever walks it. */
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (!String(input).endsWith('/competitors.json')) {
        return real(input)
      }

      const all: { active: boolean }[] = await (await real(input)).json()

      return new Response(JSON.stringify(all.map((one) => ({ ...one, active: false }))), {
        status: 200,
      })
    })

    try {
      renderAt('/sr/top-liste?sezona=2019')

      const board = await screen.findByRole('table', { name: 'Najviše kilometara' })
      const names = within(board)
        .getAllByRole('row')
        .slice(1)
        .map((row) => first(within(row).getAllByRole('cell')).textContent)

      expect(names.length).toBeGreaterThan(0)
      expect(names.every((one) => one !== null && one.trim() !== '')).toBe(true)
      expect(within(board).queryAllByRole('link')).toHaveLength(0)
    } finally {
      globalThis.fetch = real
    }
  })
})

describe('the front page, in the season running now', () => {
  it('has nobody on it whose fee has run out', async () => {
    /* PDL P11: they are not in the season now at all, and the top ten and the
       turning chart are that season's standing in another shape. Read on a day
       inside the one season 000032 raced, so they would be there if the rule
       were not kept. */
    renderAt('/sr', 'visitor', null, undefined, '2017-06-01')

    await screen.findAllByRole('heading', { name: /Top 10/ })
    expect(screen.queryByText(/Vojislav Antonijević/)).not.toBeInTheDocument()
  })

})
