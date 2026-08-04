import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import { loadResource } from '../data/client'
import { fieldFor, topByCategory } from '../data/derive'
import { hueFor } from './competitorFace'
import { at, first, last, must } from '../test/at'
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

  it('narrows by category and by search, and lets both go again', async () => {
    const user = setupUser()
    renderAt('/sr/tabela?sezona=2020')

    const all = within(await screen.findByRole('table')).getAllByRole('row').length
    await user.selectOptions(screen.getByLabelText('Kat.'), 'M40-54')
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeLessThan(all)

    await user.selectOptions(screen.getByLabelText('Kat.'), '')
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(all)

    await user.type(screen.getByLabelText('Pretraga po imenu ili članskom broju'), '000007')
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2)
  })

  it('says so when a filter leaves nothing', async () => {
    renderAt('/sr/tabela?sezona=2020&trazi=nepostojeci')

    expect(
      await screen.findByText('U ovoj sezoni i kategoriji nema nijednog rezultata.'),
    ).toBeVisible()
  })

  it('leads from a row to the profile', async () => {
    renderAt('/sr/tabela?sezona=2020')

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)
    const link = within(first(rows)).getByRole('link')

    expect(link).toHaveAttribute('href', expect.stringContaining('/sr/takmicar/'))
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
    'Najbolje pojedinačne trke',
  ]

  it('carries the ten boards in the order the owner laid them out', async () => {
    renderAt('/sr/top-liste?sezona=2019')

    expect(await screen.findByRole('heading', { level: 1, name: 'Top liste' })).toBeVisible()

    const shown = screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent)

    expect(shown).toEqual(BOARDS)
  })

  it('leaves the best team to the page the teams have of their own', async () => {
    /* Owner, 04.08.2026: "Top timove ne prezentovati uopšte, jer timovi imaju
       svoju zasebnu stranu." It is still one of the lists of Article 55 and
       still worked out; it is not drawn here. */
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('heading', { level: 1, name: 'Top liste' })

    expect(screen.queryByRole('region', { name: 'Najbolji tim' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Članova' })).not.toBeInTheDocument()
  })

  it('says which place every column stands in, since an ol cannot', async () => {
    /* A list of ten numbers itself 1 to 10, and that is wrong wherever the whole
       ladder ties: a place nothing separates is shared, so a board reads 1, 1, 3
       (Član 57, PDL P12). The tables carry it in a column and the charts had
       nowhere to put it, so it is said rather than drawn.

       Read on the longer races of 2016, and that is the whole of why this test
       can fail: those ten end 9, 9. On most boards the ladder separates everybody
       and the place is the row number, so a chart that had thrown the places away
       and numbered its rows would pass; here it would say ten where the rule says
       nine.

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

    expect(ranked.map((row) => row.position).slice(-2)).toEqual([9, 9])

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

    await screen.findByRole('table', { name: 'Najbolje pojedinačne trke' })
    const races = board('Najbolje pojedinačne trke')

    expect(races.getAllByRole('columnheader').map((one) => one.textContent)).toEqual([
      '#',
      'Član',
      'Događaj',
      'd (km)',
      '+ (m)',
      '− (m)',
      'Vreme',
      'Bodovi',
    ])

    const points = races.getAllByRole('row').slice(1).map(lastNumberIn)

    expect([...points].sort((left, right) => right - left)).toEqual(points)

    /* And every cell of the first row is filled, so a column added to the head
       without a cell under it fails here rather than drawing a gap. */
    const leader = at(races.getAllByRole('row'), 1)

    expect(within(leader).getAllByRole('cell')).toHaveLength(8)
    expect(
      within(leader)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
        .filter((text) => text === null || text.trim() === ''),
    ).toEqual([])
  })

  it('marks the leader of a board and nobody else', async () => {
    /* Owner, 04.08.2026: "Nagrade se i dodeljuju samo najboljima." The standing
       still gilds three, because three is its podium; a Top lista gilds one. */
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najviše kilometara' })

    for (const name of ['Najviše kilometara', 'Najduže na stazi', 'Najbolje pojedinačne trke']) {
      const rows = board(name).getAllByRole('row').slice(1)
      const gilded = rows.filter((row) => row.className === 'podium')

      expect(rows.length).toBeGreaterThan(3)
      expect(gilded).toHaveLength(1)
      expect(gilded[0]).toBe(rows[0])
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
       istaknut gornji za tekuću godinu, u koji je upisan prirast. Upisuju se
       zaokruženi bodovi bez decimala."

       Both numbers are read, in that order, and each says what it is: two
       figures in one bar with nothing to tell them apart are not a fact anybody
       can use. Neither carries decimals, which is what "zaokruženi bodovi bez
       decimala" means and what a comma in either of them would break. */
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

      /* In BTL points, to two decimals, as the portal writes them everywhere
         else (owner, 04.08.2026). They were written as whole points for a day,
         and a whole point is not what a BTL point is: two people a quarter of a
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
    expect(board('Najviše kilometara').getByText('Miloje Stanojlović')).toBeVisible()
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
    expect(Number((season as HTMLSelectElement).value)).toBeGreaterThan(2000)

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
    const season = screen.getByLabelText('Sezona') as HTMLSelectElement
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
    /* It has been three things in two days: a band of its own with a sentence
       under it, then inside the control that names the part, and now beside the
       name (owner, 31.07.2026). It governs both parts, so it stands over both. */
    renderAt('/sr/takmicar/000007')

    const heading = await screen.findByRole('heading', { level: 1 })
    const title = must(heading.parentElement, 'a parent')

    expect(within(title).getByLabelText('Sezona')).toBeVisible()
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
    const all = within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row').length

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

    expect(within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row').length)
      .toBeLessThan(all)
    expect(ring()).toEqual(before)
  })

  it('lets a filter go again', async () => {
    const user = setupUser()
    renderAt('/sr/takmicar/000007?sezona=sve')

    await screen.findByRole('heading', { level: 1 })
    const all = within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row').length

    await user.selectOptions(screen.getByLabelText('Sezona'), '2020')
    expect(within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row').length)
      .toBeLessThan(all)

    await user.selectOptions(screen.getByLabelText('Sezona'), 'sve')
    expect(within(screen.getByRole('table', { name: 'Rezultati' })).getAllByRole('row')).toHaveLength(
      all,
    )
  })

  it('shows a season from the address that this person has nothing in', async () => {
    /* The select is built from the seasons they raced, so a season named in the
       address matched no option and the control drew itself empty. */
    renderAt('/sr/takmicar/000007?sezona=2010')

    await screen.findByRole('heading', { level: 1 })
    expect((screen.getByLabelText('Sezona') as HTMLSelectElement).value).toBe('2010')
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
      await screen.findByRole('heading', { level: 1, name: 'Ovog takmičara nema.' }),
    ).toBeVisible()
  })

  it('names on the ring only the lengths this person has run', async () => {
    /* It used to draw all five whatever the counts were, so most profiles
       carried three rows reading nought (owner, 31.07.2026). Checked against the
       table of results rather than against a fixed number, or this passes on any
       count at all. */
    renderAt('/sr/takmicar/000007?sezona=sve')

    const chart = await screen.findByRole('table', { name: 'Trke po dužini' })
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
  })

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
      await screen.findByRole('heading', { level: 1, name: 'Ovog takmičara nema.' }),
    ).toBeVisible()
  })

  it('handles a competitor who has never raced', async () => {
    // 000031 is the deliberately empty profile in the generated data. Read over
    // the whole career, or the season now would be the reason the table is empty.
    renderAt('/sr/takmicar/000031?sezona=sve')

    expect(await screen.findByText('Ovaj takmičar još nema nijedan rezultat.')).toBeVisible()
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
    const head = (await screen.findByRole('heading', { level: 1 })).closest(
      'header',
    ) as HTMLElement

    expect(within(head).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/sr/tim/'),
    )
  })

  it('never tells a visitor who is an honorary member', async () => {
    // It is a fact about money, not about running, and it is nobody's business.
    renderAt('/sr/takmicar/000007')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText('Počasno članstvo')).not.toBeInTheDocument()
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

  it('leaves the one on a profile as it was, said and not drawn', async () => {
    /* The pill stays on a profile, where the name of the competitor is the
       heading and a labelled field beside it would read as a second one. */
    renderAt('/sr/takmicar/000007')

    const control = await screen.findByLabelText('Sezona')

    expect(within(must(control.closest('label'), 'labela')).getByText('Sezona')).toHaveClass(
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
    const season = screen.getByLabelText('Sezona') as HTMLSelectElement

    expect(season.value).toBe('2026')
    expect(within(season).queryByRole('option', { name: 'Sve sezone' })).not.toBeInTheDocument()

    /* Every team keeps its row whatever the season, so what has to change is
       what the rows say: the points are of the season being looked at. */
    const points = async () =>
      (await standing())
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell').at(-1)?.textContent)

    const before = await points()

    await user.selectOptions(season, '2019')
    expect((screen.getByLabelText('Sezona') as HTMLSelectElement).value).toBe('2019')
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
        : real(input)) as typeof fetch

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

    expect((screen.getByLabelText('Sezona') as HTMLSelectElement).value).toBe('2026')
    expect(
      within(screen.getByLabelText('Sezona')).queryByRole('option', { name: '1999' }),
    ).not.toBeInTheDocument()
  })
})

describe('Leagues', () => {
  it('lists what runs alongside the league, and never the league itself', async () => {
    renderAt('/sr/lige')

    expect(await screen.findByRole('heading', { level: 1, name: 'Lige' })).toBeVisible()
    // Two of them group by gender alone now, so the list is asked for both.
    expect(screen.getAllByText('Grupisanje samo po polu').length).toBeGreaterThan(0)
    // The league the portal exists for is implied, not listed.
    expect(screen.queryByRole('link', { name: /Balkanska trkačka liga 2027/ })).not.toBeInTheDocument()
  })
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

      const all = (await (await real(input)).json()) as { active: boolean }[]

      return new Response(JSON.stringify(all.map((one) => ({ ...one, active: false }))), {
        status: 200,
      })
    }) as typeof fetch

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
