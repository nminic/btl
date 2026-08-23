import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { THEME_STORAGE_KEY } from '../app/themeContext'
import { JUNIOR, PRICES, PROCESSING_FEE_EUR } from '../data/pricing'
import { money } from '../i18n/format'
import { I18nProvider } from '../i18n/I18nProvider'
import registration from '../forms/definitions/registracija.form.json'
import newResult from '../forms/definitions/unos-rezultata.form.json'
import fromEvent from '../forms/definitions/prijava-sa-trke.form.json'
import written from '../../public/mock/pages.json'
import sr from '../i18n/sr.json'
import { translate } from '../i18n/translate'
import { SessionProvider } from '../session/SessionProvider'
import { RESOURCE_NAMES } from '../data/client'
import { renderAt } from '../test/render'
import { must } from '../test/at'
import { sources } from '../test/sources'
import { PageSectionBody } from '../components/PageSectionBody'
import { ROW } from '../components/Markdown'
import type { BtlEvent, PageSection, Result } from '../data/types'
import { StaticPage } from './StaticPage'

const dictionary = sr

/* The written pages as the portal itself reads them. Annotated and not asserted:
   an annotation is a claim the compiler has to agree with, and this one holds
   the file to the type every screen reads it through (ADL A14). */
const WRITTEN: Record<
  string,
  { title: string; sections: { heading: string; body: string; gallery?: string }[] }
> = written

/* The mark a body carries to say where its drawing goes (PageSectionBody.tsx).
   Written out here rather than imported: a test that reads the same constant as
   the code agrees with it whatever it is changed to, and what this holds is the
   content and the code saying the same word. */
const PLACE = '[[gallery]]'

/**
 * Whether a line is a row of a table, asked in one place.
 *
 * Matched whole, the way the portal matches a row. Asked as „begins and ends with a
 * pipe", a lone `|` answered yes to both and, having no cells at all, answered yes to
 * being a line of dashes as well, so the search for the dashes stopped on a line the
 * portal draws as a paragraph.
 *
 * One question and two readers, since 23.08.2026. The table reader asked it this way
 * and the reader of prose asked „does it begin with a pipe", so a row missing its
 * closing pipe fell out of both at once: not a row here, not prose there, read by
 * nobody. A reader sees it as an ordinary paragraph, because the renderer draws it as
 * one (components/Markdown.tsx).
 */
function isTableRow(line: string): boolean {
  return ROW.test(line.trim())
}

/**
 * Everything in a block that is not a row of a table.
 *
 * The other half of `isTableRow`, and it has a name so that both halves can be
 * measured: a row missing its closing pipe used to fall out of the table reader and
 * out of this one at once, so nothing read it at all, and neither reader could be
 * asked about it from a test.
 */
function proseOf(block: string): string {
  return block
    .split(NEWLINE)
    .filter((line) => !isTableRow(line))
    .join(NEWLINE)
}

/**
 * Every table of one block of the policy, each read as a table: its header, and the
 * rows under it.
 *
 * Every, and not the first. Reading a block as one table, the second table's header and
 * its line of dashes fell in among the rows, so a field could name `Podatak` with a
 * basis of `Pravni osnov` and be declared published while the policy said nothing about
 * it. That is the very fault the version before this closed for a table with no dashes
 * at all, reopened one shape along: measured, and `main` did not have it.
 *
 * A table ends where a line that is not a row ends it, which is how the portal reads
 * one too: a blank line closes the block in `Markdown.tsx`.
 *
 * A table with no line of dashes is a fault and not a table with no header: without
 * one, its header row went into the list as a row a field may name, and an obligatory
 * personal field could then be declared published while the policy said nothing about
 * it. Measured.
 */
function tablesOf(block: string): { head: string[]; rows: string[][] }[] {
  const cellsOf = (line: string) => line.split('|').map((cell) => cell.trim())
  const dashes = (line: string) =>
    cellsOf(line)
      .slice(1, -1)
      .every((cell) => /^:?-{2,}:?$/.test(cell))
  const tables: string[][] = []
  let table: string[] = []

  for (const raw of block.split(NEWLINE)) {
    const line = raw.trim()

    if (isTableRow(line)) {
      table.push(line)

      continue
    }

    if (table.length > 0) {
      tables.push(table)
      table = []
    }
  }

  if (table.length > 0) {
    tables.push(table)
  }

  return tables.map((lines) => {
    const at = lines.findIndex(dashes)

    expect(
      at,
      `a table of the policy has no line of dashes: ${lines[0] ?? '(empty)'}`,
    ).toBeGreaterThan(0)

    return { head: cellsOf(String(lines[at - 1])), rows: lines.slice(at + 1).map(cellsOf) }
  })
}

/** A period written in words or figures, in months, or null when the sentence does not
 *  say one.
 *
 *  The numerals are the ones this document uses. A numeral it does not know returns null
 *  and the caller fails loudly, which is the safe side: a period nobody can read must stop
 *  the gate rather than pass through it as „no bound". */
const NUMERALS = new Map([
  ['jedan', 1],
  ['dva', 2],
  ['tri', 3],
  ['četiri', 4],
  ['pet', 5],
  ['šest', 6],
  ['sedam', 7],
  ['osam', 8],
  ['devet', 9],
  ['deset', 10],
  ['jedanaest', 11],
  ['dvanaest', 12],
])

function monthsIn(said: string): number | null {
  const found = /(\S+)\s+(dan|dana|mesec|meseci|godin\w*)/i.exec(said)

  if (found === null) {
    return null
  }

  const word = String(found[1]).toLowerCase()
  const many = /^\d+$/.test(word) ? Number(word) : NUMERALS.get(word)

  if (many === undefined) {
    return null
  }

  const unit = String(found[2]).toLowerCase()

  return unit.startsWith('dan') ? many / 30 : unit.startsWith('mesec') ? many : many * 12
}

/** What the policy says happens in each situation, read as a table: the column is found
 *  by its name, and the table of who the data is passed to, which sits in the same
 *  section, is left where it is. */
function howLongKept(): Map<string, string> {
  const said = new Map<string, string>()

  /* Filled by hand rather than built out of pairs, because a pair has to be told it is a
     pair and this repository does not write `as` (ADL A14). */
  for (const table of tablesOf(sectionOf('politika-privatnosti', /Nalog nikad nije aktiviran/))) {
    const what = table.head.indexOf('Šta se dešava')

    if (what === -1) {
      continue
    }

    for (const cells of table.rows) {
      said.set(String(cells[1] ?? ''), String(cells[what] ?? ''))
    }
  }

  expect(said.size, 'the policy no longer says how long anything is kept').toBeGreaterThan(0)

  return said
}

/** The one section that says what the portal collects, which both guards below read. */
const collectedRows = () => sectionOf('politika-privatnosti', /Podaci koje unosite pri učlanjenju/)

describe('the written pages', () => {
  it.each([
    ['/sr/pravilnik', 'Opšti pravilnik Balkanske trkačke lige za sezonu 2027'],
    // Contact left the written pages: it is a mail address in the footer now,
    // and the history of the league took its place (PDL P28a).
    ['/sr/politika-privatnosti', 'Politika privatnosti'],
    ['/sr/uslovi-koriscenja', 'Uslovi korišćenja'],
  ])('%s carries written text, not a placeholder', async (path, title) => {
    renderAt(path)

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(1)
    expect(screen.queryByText(/Ovaj ekran dolazi u sledećoj fazi/)).not.toBeInTheDocument()
  })

  it('says what the terms say about correcting a result', async () => {
    renderAt('/sr/uslovi-koriscenja')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('heading', { name: /Verifikacija rezultata/ })).toBeVisible()
  })

  it('says the page is not there when the slug is unknown', async () => {
    render(
      <I18nProvider locale="sr">
        <SessionProvider>
          <MemoryRouter>
            <StaticPage slug="nepostojeca" />
          </MemoryRouter>
        </SessionProvider>
      </I18nProvider>,
    )

    expect(await screen.findByRole('heading', { name: 'Ove strane nema' })).toBeVisible()
  })
})

/* The fee schedule used to exist twice in the portal: as data in pricing.ts,
 * which the screens read, and as prose in the terms, written by hand. It drifted
 * a whole price band behind the data and no build failed.
 *
 * Since 17.08.2026 there is one of it. The statute puts the amount of the fee
 * with the management board (član 24), so the rulebook names that decision and
 * draws the table under it out of pricing.ts (`gallery: 'prices'`), and the
 * terms link to the rulebook instead of carrying a copy. These tests read the
 * table where it is now drawn, so they still tie the figures to the data. */
describe('the fee schedule in the rulebook', () => {
  /* Each claim is pinned to the paragraph that has to carry it. Pinning them to
   * the section instead lets one paragraph satisfy an assertion about another:
   * the row "1. do 5. oktobra" alone was enough to hide a deleted reminder. */
  /** The price table, one string per row of cells. The rulebook draws it out of
   *  `pricing.ts` through `src/components/PriceTable.tsx` rather than writing it
   *  as Markdown, so this reads the rows a screen reader would. The header row
   *  has no cells, only column headers, so it falls out by itself. */
  async function priceTableRows() {
    const heading = await screen.findByRole('heading', { name: /^\d+\. Članarina$/ })
    const section = heading.closest('section')

    if (section === null) {
      throw new Error('the fee heading stands outside a section')
    }

    return within(within(section).getByRole('table'))
      .getAllByRole('row')
      .map((row) =>
        within(row)
          .queryAllByRole('cell')
          .map((cell) => cell.textContent ?? '')
          .join(' | '),
      )
      .filter((line) => line !== '')
  }

  /** The table itself, so a cell can be read under the column that names it. */
  async function priceTable() {
    const heading = await screen.findByRole('heading', { name: /^\d+\. Članarina$/ })
    const section = heading.closest('section')

    if (section === null) {
      throw new Error('the fee heading stands outside a section')
    }

    return within(section).getByRole('table')
  }

  /** What the band holds in the column with that header. The currency is printed
   *  once, at the top of its column, so tying an amount to it means walking the
   *  header row for the position and then the band's row for that position. */
  async function cellUnder(band: { key: string }, currency: string) {
    const table = await priceTable()
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent ?? '')
    const column = headers.indexOf(currency)

    expect(column, `no column of the table is headed "${currency}"`).toBeGreaterThan(-1)

    const name = translate(dictionary, 'sr', `pricing.rows.${band.key}`)
    const row = within(table)
      .getAllByRole('row')
      .find((one) => (one.textContent ?? '').includes(name))

    if (row === undefined) {
      throw new Error(`no row of the table is the band "${name}"`)
    }

    return within(row).getAllByRole('cell')[column]?.textContent
  }

  it('holds the price bands in the order the table prints them', () => {
    /* Looking a band up by name is what makes the test above readable, and it is
       also what stopped it noticing a reordering: before the lookup, the rows
       were compared in order, so moving `late` above `regular` failed. The order
       is a fact about the membership table on /sr/clanarina, so it is asserted
       on its own. */
    expect(PRICES.map((price) => price.key)).toEqual(['early', 'regular', 'late', 'season'])
  })

  it('quotes every price band that pricing.ts holds, by its own name', async () => {
    renderAt('/sr/pravilnik')
    const rows = await priceTableRows()

    for (const price of PRICES) {
      /* Found by the name of the band and then checked for both amounts, rather
         than found by an amount. Two of the four cost 40 EUR and 4.800 RSD, so
         looking a row up by its price returned the regular band for the season
         band as well: the terms could have dropped the fourth row entirely, or
         gone on selling a band the price list had renamed, and this test would
         have stayed green. It is named in ADL A12 as the guard against exactly
         that, and against the one thing that changed it was inert. */
      const bandName = translate(dictionary, 'sr', `pricing.rows.${price.key}`)
      const row = rows.find((line) => line.includes(bandName))

      expect(row, `no row of the table is the band "${bandName}"`).toBeDefined()
      /* Under the column that names the currency, not merely somewhere in the
         row. The table prints the currency once, in the header, so a row read on
         its own says 35 and 4.200 and nothing about which is which: the columns
         could be swapped, or the header renamed, and the figures would still be
         found. Two of the four bands cost 40 EUR, which is the very confusion
         this guard exists for. */
      expect(await cellUnder(price, 'EUR')).toBe(money(price.eur, 'sr'))
      expect(await cellUnder(price, 'RSD')).toBe(money(price.rsd, 'sr'))
    }
  })

  it('quotes the junior price', async () => {
    renderAt('/sr/pravilnik')
    const rows = await priceTableRows()
    const name = translate(dictionary, 'sr', `pricing.rows.${JUNIOR.key}`)
    const row = rows.find((line) => line.includes(name))

    expect(row, `no row of the table is the junior band`).toBeDefined()
    expect(await cellUnder(JUNIOR, 'EUR')).toBe(money(JUNIOR.eur, 'sr'))
    expect(await cellUnder(JUNIOR, 'RSD')).toBe(money(JUNIOR.rsd, 'sr'))
  })

  it('promises a junior no place in the standing the rulebook refuses them', async () => {
    /* The junior fee is a price level and not a period: whether the season is ranked
       follows the day it is paid, the same for a junior as for anybody else. This cell
       said `Da` outright, so a thirteen year old joining in June read that they would be
       ranked, two sections under the article of this same rulebook saying they would not.
       Held on the cell rather than on the constant, because the constant is what was
       wrong and a test written against it would have agreed with it. */
    renderAt('/sr/pravilnik')

    const column = translate(dictionary, 'sr', 'pricing.ranking')
    const said = await cellUnder(JUNIOR, column)

    expect(said).toBe(translate(dictionary, 'sr', 'pricing.rankingByPeriod'))
    expect(said, 'the junior band answers the ranking column with a word of its own').not.toBe(
      translate(dictionary, 'sr', 'pricing.yes'),
    )
    expect(said).not.toBe(translate(dictionary, 'sr', 'pricing.no'))
  })

  it('carries the referral programme, its amount and the moment it is credited', async () => {
    /* Owner, 12.08.2026. A member is promised money on „Moja članarina", so the
       terms have to say what that promise is: how much, in both currencies, and
       when it lands. The moment is the half that matters, since it is what keeps
       an account opened and left from being worth anything.

       No figure, and that is the point: an administrator changes the amount on
       the price list (AdminPricing), so a number written into a legal text is a
       number that goes stale the first time anybody uses that screen. The terms
       say where a member reads it instead, and the guard below is that they name
       no amount at all.

       „Moja članarina" and not the price list: the price list is a screen for
       administration and there is no public one, so the terms pointed at a page
       nobody but staff could open. The member's own screen carries the figure
       beside the link it belongs to. */
    renderAt('/sr/uslovi-koriscenja')

    /* The exact title, allowing any number in front of it: the sections are
       numbered and one inserted in the middle moves the rest, so the number is
       not the thing to hold. „Program preporuke koji ne postoji" is. */
    const heading = await screen.findByRole('heading', { name: /^\d+\. Program preporuke$/ })
    const words = heading.parentElement?.textContent ?? ''

    expect(words).toContain('Moja članarina')
    /* Any way of writing money, not only the codes: the owner writes „5 eur /
       600 din" himself, and a guard that sees only „EUR" and „RSD" would let his
       own spelling of the same stale figure straight through. */
    expect(words).not.toMatch(/\d+\s*(EUR|RSD|evr|din)/i)
    expect(words).toContain('aktivirana prvi naredni put')
    expect(words).toContain('ne u trenutku prijave')
    /* And what the balance is, which is the other thing a member is owed an
       answer to: it pays membership and is never paid out. */
    expect(words).toContain('Nikada se ne isplaćuje u novcu')
  })

  it('numbers its sections from one and points every reference at the right one', () => {
    /* A section was put into the middle of these terms on 12.08.2026 (the
       referral programme, back by the owner's decision of the same day), and
       everything after it moved down by one. „po postupku iz sekcije 6" then
       pointed at the referral programme instead of at the rules of conduct: a
       stale reference does not land on nothing, it lands on a real section and
       says the wrong thing.

       So both are held: that the numbers run from one with nothing missing, and
       that each reference lands on the section whose subject the sentence is
       about. */
    /* Annotated rather than asserted: the ban on `as` is now enforced by the
       linter (ADL A14, PR #77), and a name that carries the type takes the
       parsed JSON on its own. */
    const pages: Record<string, { sections: { heading: string; body: string }[] } | undefined> =
      written
    const sections = pages['uslovi-koriscenja']?.sections ?? []
    const numbers = sections.map((section) => Number(section.heading.split('.')[0]))

    expect(numbers.length).toBeGreaterThan(8)
    expect(numbers).toEqual(numbers.map((_, index) => index + 1))

    /* What each reference is about, taken from the sentence that makes it. One
       entry per reference the terms carry; a new one that nobody writes here
       fails the count below rather than passing unread. */
    const meant = [
      { from: 'razlog za meru', to: 'Pravila ponašanja' },
      { from: 'Mere prema članu', to: 'Pravila ponašanja' },
    ]
    /* Every case of the word and not only the genitive: written as „sekcije"
       alone, a reference put in as „u sekciji 3" was never seen, and a wrong one
       passed unread through the very test written to catch it. */
    const made = sections.flatMap((section) => [
      ...section.body.matchAll(/sekcij\w* (\d+)/g),
    ].map((found) => ({ at: Number(found[1]), around: section.body.slice(0, found.index) })))

    expect(made).toHaveLength(meant.length)

    for (const [index, reference] of made.entries()) {
      const about = meant[index]
      const heading = sections[reference.at - 1]?.heading ?? ''

      expect(reference.around, `reference ${index} is not the one written here`).toContain(
        about?.from ?? '',
      )
      expect(heading, `reference to section ${reference.at} lands on „${heading}"`).toContain(
        about?.to ?? '',
      )
    }
  })

  it('promises no reminders, because none are sent', async () => {
    /* Owner, 13.08.2026: „Ne šalje se, ostaje tako, izbaciti iz pravilnika to jer
       nema potrebe nikad da stoji." Both texts promised four reminders at the
       price boundaries and the portal sends none, in this season or any other
       (PDL P8). A promise nobody will ever keep is worse in a legal text than
       anywhere else, so the sentence is gone rather than reworded. */
    renderAt('/sr/uslovi-koriscenja')

    const page = await screen.findByRole('article')

    expect(within(page).queryByText(/[Pp]odsetnik/)).not.toBeInTheDocument()
  })

  it('says nothing about reminders in the rulebook either', async () => {
    renderAt('/sr/pravilnik')

    const page = await screen.findByRole('article')

    expect(within(page).queryByText(/[Pp]odsetnik/)).not.toBeInTheDocument()
  })
})

describe('a drawing a written section names', () => {
  const sections = Object.values(WRITTEN).flatMap((page) => page.sections)
  const LINE_BREAK = String.fromCharCode(10)

  /** Places marked: lines holding nothing but the mark, which is what the portal
   *  reads (`PageSectionBody.tsx`). */
  const placed = (body: string) =>
    body.split(LINE_BREAK).filter((line) => line.trim() === PLACE).length

  /** The mark as a piece of text, wherever it stands. */
  const written = (body: string) => body.split(PLACE).length - 1

  it('marks one place for it, and the mark is never anything but a line of its own', () => {
    /* Three claims in one comparison, because two of them used to be one and the
       one that was missing is the one that mattered.

       The first two: a section that names a drawing marks a place for it, and a
       section that names none marks nothing. A drawing whose place is not marked
       is not lost from the screen; it goes back under all of the words, which is
       the arrangement the owner moved the fee schedule out of on 21.08.2026, and
       it goes back with nothing saying so.

       The third, and it is why both counts are read: the mark is a mark only
       while it is a line of its own. `[[gallery]]` inside a sentence, in a cell,
       in a heading, or on its own line behind a zero width space, raises the
       count of the text and not the count of the places, and it does two things
       at once: the drawing falls to the foot of the section, and the reader is
       shown the characters `[[gallery]]`. Measured on ten such shapes. The one
       that matters most carries U+200B in front of the mark, which in an editor
       and in a diff looks exactly like the good line.

       Held over every section of every written page, so the third page to carry
       a drawing is held to the same rule as the two that carry one today. */
    const named = sections.filter((section) => section.gallery !== undefined)
    const count = (section: { heading: string; body: string }) =>
      `${section.heading}: ${placed(section.body)} marked, ${written(section.body)} written`

    expect(named.length).toBeGreaterThan(0)
    expect(named.map(count)).toEqual(
      named.map((section) => `${section.heading}: 1 marked, 1 written`),
    )

    const unnamed = sections.filter((section) => section.gallery === undefined)

    expect(unnamed.map(count)).toEqual(
      unnamed.map((section) => `${section.heading}: 0 marked, 0 written`),
    )
  })

  it('is drawn where the mark stood, and the mark itself never reaches the reader', async () => {
    /* Owner, 21.08.2026: the fee schedule moves out of the foot of the section
       and up under „...posebnom odlukom", the sentence that names the decision
       of the board that sets it.

       Read as the order of the whole section rather than as "the table is
       somewhere in it": at the foot of the section it was also somewhere in it,
       and that is the arrangement this replaces. The last line of it is the
       other half of what the owner asked for the same day, that nothing stand
       after the list in Član 17. */
    renderAt('/sr/pravilnik')

    const heading = await screen.findByRole('heading', { name: /^4. Članarina$/ })
    const section = must(heading.closest('section'), 'the section around that heading')
    const order = [...section.querySelectorAll('h3, table')].map((part) =>
      part.tagName === 'TABLE' ? 'the price table' : (part.textContent ?? ''),
    )

    expect(order).toEqual([
      'Član 14. Cena i rokovi',
      'the price table',
      'Član 15. Dinarska cena i oslobađanje od članarine',
      'Član 16. Povraćaj',
      'Član 17. Šta članstvo donosi',
    ])

    /* And nothing at all after the list in Član 17, which is the other half of
       what the owner asked for. Read as the last words of the section rather
       than off the order above: that order is headings and tables, so a sentence
       added under the list would not appear in it and the claim would have been
       a comment over a check that could not see it. */
    expect((section.textContent ?? '').trimEnd()).toMatch(
      /Virtuelni balans iz programa preporuke, koji se nikada ne isplaćuje u novcu.$/,
    )

    /* And the mark is not words. Read over the whole document rather than by
       asking for an element holding it: rendered as part of a longer paragraph
       it would not be an element of its own, and a search by exact text would
       walk past the fault it exists to catch. */
    expect(document.body.textContent ?? '').not.toContain(PLACE)
  })

  it('stands beside the words and never inside them', async () => {
    /* A drawing inside `.markdown` is dressed by the rules that dress prose, and
       those rules win outright: measured in the browser on 21.08.2026,
       `.markdown ul` is a class and an element against the single class of
       `.ducats`, so the grid of fifteen coins became one column of fifteen with
       a list indent, 3635 pixels tall against the 1240 it should be. Not a tie
       settled by load order, which is what stood here first: put last in the
       head, `.ducats` still lost.
       Nothing failed, because jsdom computes no styles.

       So the guard is over the shape and not over the paint: which rule could
       reach which drawing is a question with no end to it, and standing outside
       them there is nothing to enumerate. Both drawings the portal has are read,
       and a third would be added here. */
    renderAt('/sr/pravilnik')

    const fee = await screen.findByRole('heading', { name: /^4. Članarina$/ })
    const section = must(fee.closest('section'), 'the section around that heading')

    expect(within(section).getByRole('table').closest('.markdown')).toBeNull()

    /* The coins arrive on a request of their own, so the wall is waited for
       rather than looked for once. */
    const wall = await waitFor(() => must(document.querySelector('.ducats'), 'the wall of ducats'))

    expect(wall.closest('.markdown')).toBeNull()
  })
})

describe('one written section, drawn on its own', () => {
  const NL = String.fromCharCode(10)
  const CRLF = String.fromCharCode(13) + String.fromCharCode(10)

  /* Drawn away from any page, so the shapes no written page carries today can
     still be measured. Four of the five below are shapes the content happens not
     to have: without them the guards around them are executed and nothing reads
     what they did, which is how three of these lines could be deleted with the
     whole suite staying green. */
  function draw(section: PageSection) {
    return render(
      <I18nProvider locale="sr">
        <SessionProvider>
          <MemoryRouter>
            <PageSectionBody section={section} />
          </MemoryRouter>
        </SessionProvider>
      </I18nProvider>,
    )
  }

  /** What was drawn: each block of the column, in the order it stands in. */
  function shape(container: HTMLElement): string[] {
    const column = must(container.querySelector('.section-body'), 'the column of the section')

    return [...column.children].map((block) =>
      block.classList.contains('markdown') ? `words(${block.textContent ?? ''})` : 'the drawing',
    )
  }

  it('takes the mark with spaces around it, and never prints it', () => {
    /* The trimming, which nothing else reads. A mark written with a space in
       front of it is still a line holding nothing but the mark, and a portal
       that read the line as it stands would drop the drawing to the foot of the
       section and print `[[gallery]]` to the reader. */
    const { container } = draw({
      heading: 'Proba',
      body: ['Pre.', '', '   [[gallery]]  ', '', 'Posle.'].join(NL),
      gallery: 'prices',
    })

    expect(shape(container)).toEqual(['words(Pre.)', 'the drawing', 'words(Posle.)'])
    expect(container.textContent ?? '').not.toContain(PLACE)
  })

  it('reads a body written with CRLF as it reads one written with LF', () => {
    /* Where the two used to part: the body is split on the newline, so every
       line of a CRLF document keeps a carriage return, and a half that is one
       blank line is not the empty string. It drew an empty block and a second
       full gap above the drawing. The day the body comes out of a `textarea` is
       the day it arrives written with CRLF, because that is what a browser
       sends. */
    const lines = ['', '[[gallery]]', '', 'Posle.']
    const asLf = draw({ heading: 'LF', body: lines.join(NL), gallery: 'prices' })
    const asCrlf = draw({ heading: 'CRLF', body: lines.join(CRLF), gallery: 'prices' })

    expect(shape(asLf.container)).toEqual(['the drawing', 'words(Posle.)'])
    expect(shape(asCrlf.container)).toEqual(shape(asLf.container))
  })

  it('ends with the drawing when the mark is the last line', () => {
    const { container } = draw({
      heading: 'Na kraju',
      body: ['Pre.', '', '[[gallery]]'].join(NL),
      gallery: 'prices',
    })

    expect(shape(container)).toEqual(['words(Pre.)', 'the drawing'])
  })

  it('ends with the drawing when nothing but blank lines follows the mark', () => {
    /* The other half of the same question, and the half the content happens not
       to ask: written with CRLF, the lines after the mark are not empty strings
       but carriage returns, so a check for the empty string called them words
       and drew a blank block with a full gap under the drawing. */
    const { container } = draw({
      heading: 'Prazni redovi',
      body: ['Pre.', '', '[[gallery]]', '', ''].join(CRLF),
      gallery: 'prices',
    })

    expect(shape(container)).toEqual(['words(Pre.)', 'the drawing'])
  })

  it('puts the drawing under all of it when nothing marks a place, rather than dropping it', () => {
    /* Said out loud because a comment used to say the opposite. A section that
       names a drawing and marks no place for it does not lose the drawing; it
       gets it back at the foot of the section, which is the arrangement the
       owner moved the fee schedule out of. That is what the guard over the
       content is for: the failure is quiet, not visible. */
    const { container } = draw({ heading: 'Bez oznake', body: 'Samo reči.', gallery: 'prices' })

    expect(shape(container)).toEqual(['words(Samo reči.)', 'the drawing'])
  })

  it('draws the words alone when the section names no drawing', () => {
    const { container } = draw({ heading: 'Bez crteža', body: 'Samo reči.' })

    expect(shape(container)).toEqual(['words(Samo reči.)'])
  })

  it('drops a second mark rather than drawing twice or printing it', () => {
    /* The content of this repository cannot carry a second mark, because the
       test above forbids it. What a moderator types into a page is not under
       that test, and of the two ways a second mark could go wrong the printed
       one is the worse: `[[gallery]]` in front of the reader is the one thing
       the mark must never do. */
    const { container } = draw({
      heading: 'Dve oznake',
      body: ['Pre.', '', '[[gallery]]', '', 'Sredina.', '', '[[gallery]]', '', 'Posle.'].join(NL),
      gallery: 'prices',
    })

    expect(shape(container)).toEqual([
      'words(Pre.)',
      'the drawing',
      'words(Sredina.Posle.)',
    ])
    expect(container.textContent ?? '').not.toContain(PLACE)
  })

  it('says the same word to the moderator who types it', () => {
    /* The mark has three homes: the code, the content, and the sentence under
       the box a moderator writes a page in. The first two are held together by
       the test above; without this the third would go on naming a mark the
       portal had stopped reading, and what the moderator typed would be printed
       to the reader as words. */
    expect(translate(dictionary, 'sr', 'admin.hint.sectionBody')).toContain(PLACE)
  })
})

describe('the privacy policy', () => {
  it('describes the analytics the portal has, which is none', () => {
    /* Owner, 16.08.2026: „zelim da izbacim Google Analytics, traku, i Umami cak
       ako je moguce. Hocu da imam svoju internu analitiku jednog dana."
       (`ADL.md` A9). Until then this document described, in detail, a consent
       bar, Google Analytics loaded only after „Prihvati", Umami on our own
       server, and a control in the footer for withdrawing consent. None of the
       four existed in the code, which is how the whole thing was found; now
       none of them is promised either.
     *
       Held on the document rather than on the screen, because what is wrong
       with a policy that describes machinery nobody built is what it says, not
       how it renders. And held as absence, which is the only shape this claim
       has: naming a processor the portal does not use is the fault. */
    const policy = whole('politika-privatnosti')

    for (const named of ['Google', 'Analytics', 'Umami', 'Prihvati', 'Podešavanja kolačića']) {
      expect(policy, named).not.toContain(named)
    }

    /* And it says why there is no bar, rather than leaving a reader to notice
       that a paragraph went missing: consent is asked for what is not necessary,
       and the portal sets nothing of the sort. */
    expect(policy).toContain('nema ni trake za pristanak')
    expect(policy).toContain('Nema analitike')
  })

  it('promises no way to withdraw a consent it never asks for', () => {
    /* The table of rights offered „saglasnost za kolačiće menjate u podnožju
       svake strane", and there is no such control in the footer; there never
       was. It was the first half of this same fault, found on 15.08.2026 while
       the second half was still being built. */
    /* Found by what it says rather than by its heading, which is what
       `sectionOf` reads: the sections are numbered and one inserted above moves
       the rest. */
    const rights = sectionOf('politika-privatnosti', /polja profila menjate i brišete/)

    expect(rights).not.toContain('u podnožju svake strane')
    expect(rights).toContain('ne povlači jer se ne daje')
  })

  it('says the same age in the words as the rule keeps in the form', () => {
    /* Sixteen stood in three places by hand: the rule in the form, the hint under the
       field and the row of the policy. Moved in the rule alone, a seventeen year old was
       shown a field marked optional under a sentence saying only somebody younger than
       sixteen may leave it empty, and a policy saying the same. Read out of the rule and
       looked for in both texts, so the number moves in one place. */
    const ruled = registration.fields.filter((field) => field.optionalWhenYoungerThan !== undefined)

    expect(ruled.length, 'no field of the form is optional by age').toBeGreaterThan(0)

    for (const field of ruled) {
      const years = String(must(field.optionalWhenYoungerThan, `${field.name} rule`).years)
      const hint = translate(dictionary, 'sr', String(field.hintKey))
      /* As a number and not as a piece of text. `toContain` finds `6` inside `16`, so a
         rule mistyped from sixteen to six left both texts still saying sixteen while the
         portal demanded a document of every seven year old: measured. */
      const saysIt = new RegExp(`(^|\\D)${years}(\\D|$)`)

      expect(saysIt.test(hint), `the hint under ${field.name} does not say ${years}`).toBe(true)

      /* By the cell, like the guard below, so a table reflowed by hand does not read as a
         policy that lost a row. */
      const row = collectedRows()
        .split(NEWLINE)
        .find((line) => line.split('|').map((cell) => cell.trim())[1] === String(field.policyRow))

      expect(row, `the policy carries no row for ${field.name}`).toBeDefined()
      expect(
        saysIt.test(String(row)),
        `the policy does not say ${years} where the form does`,
      ).toBe(true)
    }
  })

  it('declares every field the registration form asks for, in the table of what is collected', () => {
    /* Every field, not the ones whose hint happens to use two particular words. That was
       the first shape of this guard and a review took it apart in one move: reword a hint,
       delete the row, and the portal goes on asking while the whole suite stays green. It
       also saw two of the four facts the register of members needs, because the other two
       are read out of the town and the address.
       So the field names its own row of the policy, in `registracija.form.json`, and this
       reads the form rather than the dictionary. A field added without a row fails here,
       which is the only moment anybody is thinking about that field at all. `firstSeason2027`
       was collected for weeks with no row, and nothing said so.
       The row is matched on the cell rather than on the line, so a table reflowed by hand
       does not read as a policy that lost a row. */
    const asked = registration.fields

    expect(asked.length, 'the registration form asks for nothing').toBeGreaterThan(0)

    /* Out of the one section that says what is collected, and only rows of four cells:
       what, why, on what ground, for how long. Read off the whole document instead, the
       list also held the header, the dashes, the seat of the association and the table of
       processors, so a field could name `Podatak` with a basis of `Pravni osnov`, or
       `Cloudflare` with a basis of `SAD i EU`, and the gate stayed shut about a row that
       was not there at all. Worse, a `Map` keeps the last of a repeated name, so the
       retention table shadowed the collection table for anything named in both: measured,
       and `Interne beleške administracije` was already shadowed today. */
    /* The two tables about the person, and not the two beside them in the same section.
       Read as one section, `photo` could name `Zapisi servera` from the table of what
       arises from a visit, and be declared a server log kept thirty days while the table
       of what is collected said nothing about it: measured, and it is the same shape as
       the field that was collected for weeks with no row at all. */
    const about = collectedRows()
      .split('###')
      .filter((block) => /Podaci koje unosite|Podaci koji nastaju dok ste/.test(block))

    expect(about.length, 'the policy no longer has the two tables about the member').toBe(2)

    const rows = new Map<string, string>()

    for (const table of about.flatMap(tablesOf)) {
      /* The column that names the ground, found by its name. The width came off the
         header and the position of this one was still a number written here, so a column
         inserted before it moved the ground and the guard read that as the policy
         disagreeing with the form. */
      const ground = table.head.indexOf('Pravni osnov')

      expect(ground, `a table about the member names no legal basis: ${table.head.join(' | ')}`).toBeGreaterThan(0)

      for (const cells of table.rows) {
        const name = String(cells[1] ?? '')

        expect(
          cells.length,
          `this row of the policy is not as wide as its header: ${cells.join(' | ')}`,
        ).toBe(table.head.length)
        expect(rows.has(name), `the tables about the member carry ${name} twice`).toBe(false)
        rows.set(name, String(cells[ground] ?? ''))
      }
    }

    expect(rows.size, 'the policy says nothing about what is collected').toBeGreaterThan(0)

    for (const field of asked) {
      const row = field.policyRow
      const basis = field.policyBasis

      expect(row, `${field.name} is asked for and names no row of the privacy policy`).toBeTruthy()
      expect(
        [...rows.keys()],
        `${field.name} names a row the privacy policy does not carry: ${String(row)}`,
      ).toContain(row)

      /* And on the ground it says it is on. The row existing is not enough: the ground
         can be rewritten under it, and a member told they consented to something they
         cannot withdraw is worse off than one told nothing. */
      expect(basis, `${field.name} names no legal basis`).toBeTruthy()
      expect(
        rows.get(String(row)),
        `${field.name} says it is collected on ${String(basis)} and the policy says otherwise`,
      ).toBe(basis)
    }
  })

  it('names what is public and what never is', async () => {
    renderAt('/sr/politika-privatnosti')

    const page = await screen.findByRole('article')
    expect(within(page).getByRole('heading', { name: /javno, a šta nikada nije/ })).toBeVisible()
    expect(within(page).getByRole('heading', { name: /Maloletni članovi/ })).toBeVisible()
  })

  it('keeps what the register of members needs as long as it keeps the rest of a profile', () => {
    /* It said the number of an identity document and a father's name are deleted the day
       membership ends, which was decided by a session rather than by the owner and was
       marked at the time as legally doubtful: the register of members is kept under the
       law on sport and does not stop existing on the day a membership does. Owner,
       21.08.2026: the same five years as the rest of the profile.
       Read as two rows of one document that have to agree, rather than as a number typed
       twice: what is promised for a former member is what is promised for these. */
    /* Read through the same reader as the tables above, so the column is found by its
       name rather than counted: this guard was written with the cell at index two, in a
       file that a hundred lines up says in its own words why that is wrong, and a column
       added before it turned the check into a check on the wrong cell. */
    const said = howLongKept()
    const profile = said.get('Prestanete da budete član')
    const register = said.get('Broj ličnog dokumenta i ime oca')

    expect(profile, 'the policy no longer says how long a former member is kept').toBeDefined()
    expect(register, 'the policy no longer says how long the register of members is kept').toBeDefined()

    /* The words the document itself uses for that period, up to the comma, rather than a
       number this file recognises. Written as „a figure or the word for five", the guard
       understood only the wording of the day: both rows moved to seven together, which is
       the one change that must not alarm, and it complained. */
    const howLong = /^([^,]+)/.exec(String(profile))

    expect(howLong, 'what a former member is kept for is not said as a period').not.toBeNull()

    /* And the register's cell has to *begin* with it. Asked as „contains it somewhere in
       the row", the same row could go on to say the opposite: „Pet godina od poslednje
       sezone, ali to važi samo za ime oca. Broj ličnog dokumenta brišemo čim članstvo
       prestane" passed, and that is the very sentence this decision removed. */
    expect(
      String(register).trim().startsWith(String(must(howLong, 'the period')[1]).trim()),
      'the register of members is kept for a different time than the profile it belongs to',
    ).toBe(true)

    /* And does not take it back further along. Asked only as „begins with the period", the
       sentence this very comment used to cite as the reason for the check passed it, because
       that sentence begins with the period too: „Pet godina od poslednje sezone, ali to važi
       samo za ime oca. Broj ličnog dokumenta brišemo čim članstvo prestane". Measured.
       What is forbidden is named rather than guessed at, because it is the decision itself:
       the owner removed deletion on the day membership ends, so the row may not say it. */
    expect(
      String(register),
      'the register of members is promised a period and then deleted when membership ends',
    ).not.toMatch(/čim članstvo prestane/i)

    /* And the other home of the same fact. This row was changed by the same decision, from
       „Dok traje članstvo" to a pointer at the section below, and nothing held it: measured,
       putting it back left the whole suite green while the document said two different
       things about one field. */
    const where = new Map<string, string>()

    for (const table of tablesOf(collectedRows())) {
      const long = table.head.indexOf('Koliko čuvamo')

      if (long === -1) {
        continue
      }

      for (const cells of table.rows) {
        where.set(String(cells[1] ?? ''), String(cells[long] ?? ''))
      }
    }

    for (const field of ['Broj ličnog dokumenta', 'Ime oca']) {
      expect(
        where.get(field),
        `${field} says in one table how long it is kept and in the other something else`,
      ).toBe('Sekcija 5')
    }
  })

  it('keeps an unactivated account as long as the year it was opened to buy', () => {
    /* The selling year read off `pricing.ts` rather than typed here: it opens on the day
       the first band opens and closes on the last day of the last one, today 1 October to
       30 September. This row said thirty days, so somebody opening an account on 2 October
       to pay in the December band was told it goes on 1 November, a month before the band
       they were buying.
       Bounded from above too, by the number this same document keeps for somebody who
       actually was a member: an account that never became one must not be held longer than
       one that did. Both bounds come out of things already written down, so neither is a
       number invented in a test, which the first version of this was. */
    const first = must(PRICES[0], 'the first price band').from
    const last = must(PRICES.at(-1), 'the last price band').to
    const monthOf = (dayOfYear: string): number => Number(dayOfYear.slice(0, 2))
    /* The last band closes in the year after the first one opens, which is how the list
       is written and what its own comment says, so the closing month is counted a year
       on. Taken modulo twelve instead, a season still on sale in the opening month reads
       as one month rather than thirteen: measured, and the first version of this said the
       longer year was fine. */
    const sellingYear = monthOf(last) + 12 - monthOf(first) + 1
    /* Through the table rather than through a pattern that steps over a fixed number of
       cells: a column added to that table broke this while the document was right, and
       the guard below it, written the same week, already reads the column by its name. */
    const kept = howLongKept()
    const said = /^(\d+) (dana|meseci|godine)/.exec(String(kept.get('Nalog nikad nije aktiviran')))

    expect(said, 'the policy does not say how long an unactivated account is kept').not.toBeNull()

    const amount = Number(must(said, 'what the policy says')[1])
    const unit = must(said, 'what the policy says')[2]
    const months = unit === 'dana' ? amount / 30 : unit === 'godine' ? amount * 12 : amount

    expect(
      months,
      `${amount} ${unit} is shorter than the ${sellingYear} months the account was opened to buy`,
    ).toBeGreaterThanOrEqual(sellingYear)

    /* The ceiling read out of the document, not typed here. It was `5 * 12` under a comment
       saying it is „what the bound above is measured against", and the row it claimed to be
       measured against was only checked for existing: both rows moved to three months and
       the policy then said an account that never became a membership outlives one that did,
       with the suite green. Measured. */
    const asMember = monthsIn(String(kept.get('Prestanete da budete član')))

    expect(
      asMember,
      'the policy no longer says in months how long a former member is kept',
    ).not.toBeNull()
    expect(
      months,
      'an account that never became a membership is held longer than one that did',
    ).toBeLessThanOrEqual(Number(asMember))
  })
})

/* The page that said what membership costs was deleted on 04.08.2026, together
 * with the story of the league: "O ligi i Članarina se brišu" (owner). What a
 * member is charged is on the screen of their own membership and in the terms,
 * and both are held to `pricing.ts` above and below this line.
 */

const NEWLINE = String.fromCharCode(10)

/** The words standing immediately in front of a numbered reference, with the
 *  punctuation that separates them from it taken off.
 *
 *  Held as a **suffix** and not as „somewhere in the sixty characters before": a
 *  clause inserted between the words and the number moves the reference onto
 *  something else while the words stay where they were. Measured 21.08.2026,
 *  „prednost ima podatak organizatora (Član 29)" rewritten to „prednost ima podatak
 *  organizatora, a rok je iz (Član 29)" passed, and the sentence then said the
 *  deadline comes out of „Uspon i spust".
 *
 *  The square bracket is taken off with the round one, because a reference inside a
 *  markdown link is a reference: „[Član 74 Pravilnika](/pravilnik)" left the words
 *  ending on „[" and the pin refused a sentence this guard is meant to read. */
function wordsBefore(before: string): string {
  return before.replace(/[\s([„”"'—-]+$/u, '')
}

/* The code of ethics is deliberately not on this list. It looks like another
   document and is not one: the terms say in so many words „To je etički kodeks lige
   i deo je pravilnika". Listed, „Postupak zbog kršenja etičkog kodeksa iz Člana 99"
   walked out of the check on a page where a bare number is a fault, and Član 99 does
   not exist. Measured. */
/* And the whole word, not a stem inside one. „zakonskog zastupnika" is an adjective
   about a person and „nezakonito" is not a document at all; read as substrings, both
   made a sentence that names one document look like a sentence that names two, and
   the message said so out loud. The ending is bounded rather than refused, because a
   document is written in cases: „Pravilnika", „pravilniku", „zakonom", „statuta".
   Measured 24.08.2026, both ways. */
const NAMED = /\b(pravilnik|statut|zakon)(?!sk)\w{0,3}\b/i

/** Every document named among some words, in lower case and without repeats.
 *
 *  Every, and not the nearest, which is what this looked for until 23.08.2026 and
 *  what a round measured the cost of: „po pravilniku i zakonu, Član 74" has both
 *  names on one side, and taking the nearer handed the reference to the law and
 *  never looked for Član 74 again. Nearness was a guess wherever it was applied,
 *  between the sides and inside one of them alike. */
function namedAmong(words: string[]): Set<string> {
  return new Set(
    words.flatMap((word) => {
      const found = NAMED.exec(word)

      /* The stem and not the word: „Pravilnika" and „pravilniku" are one document,
         and the whole match would make them two. The ending is matched only so that
         a word which merely begins with the stem is not read as the document
         (`NAMED` says which). */
      return found === null ? [] : [must(found[1], 'the document a word names').toLowerCase()]
    }),
  )
}

/** Which document a numbered reference says it belongs to, in lower case, or the
 *  empty string when it names none, or `AMBIGUOUS` where more than one is named and
 *  the rulebook is among them.
 *
 *  Read from the words of the reference itself, three on either side, and not from
 *  the sentence around it. A legal text names the law in passing all the time:
 *  measured over sixty characters, „Prema Članu 99 postupa se u skladu sa zakonom"
 *  handed a number nobody accounts for to another document and walked past it, and
 *  a row of the policy reading „vodi po zakonu" did the same for the number beside
 *  it. Three words is the reference; the rest of the sentence is not.
 *
 *  Both sides, because a sentence names its document on whichever side it likes:
 *  „Pravilnik lige, Član 74" in front of the number, „Član 74 opšteg pravilnika
 *  lige" after it with a Serbian letter `\w` does not reach, „član 74 pravilnika"
 *  in lower case.
 *
 *  **Every name in those six words counts, and none of them wins over another.**
 *  Three rules were tried before this one and all three were measured wrong within
 *  a day. Ahead-first let „Prema Pravilniku lige Član 99 u smislu zakona" go to the
 *  law, and Član 99 does not exist. Nearer-wins let „U skladu sa zakonom, Član 74
 *  opšteg pravilnika lige" go to the law just as quietly, because a comma is not a
 *  wall. Nearest-within-a-side, which survived the second correction by accident,
 *  did the same to „po pravilniku i zakonu, Član 74". Every one of them is a guess
 *  about which of two names the writer meant, and a wrong guess is silent.
 *
 *  So nothing this guard could be wrong about is guessed. One name is the answer;
 *  none is the empty string; and several is `AMBIGUOUS`, **but only where the
 *  rulebook is among them**. Where several are named and none is ours, one of them
 *  comes back and which one is indeed arbitrary; it changes nothing, because the
 *  reader below asks only whether the answer begins with „pravilnik". That last
 *  clause is the difference between a guard and a nuisance: „Prijem u članstvo vrši
 *  se u skladu sa Statutom i Članom 12 Zakona o sportu." names two documents and
 *  neither is ours, so there is nothing here to be wrong about and the reference is
 *  skipped, exactly as ADL A20 says a reference to another document is. Where the
 *  rulebook **is** one of the two, the sentence cannot be read either way and it
 *  fails loudly: it is a sentence to rewrite, not a rule to refine. There is none
 *  on the portal today. */
const AMBIGUOUS = 'dva dokumenta'

function documentOf(inFront: string, ahead: string): string {
  /* Emptied of blanks before the three are taken, not after. The words in front of
     a number end with the space that separates them from it, so counted with the
     blank in hand only two of them were ever read, and „(Član 74 stav 2
     Pravilnika)" failed as a reference that does not say of what. */
  const words = (text: string): string[] => text.split(/\s+/).filter(Boolean)
  const named = namedAmong([...words(inFront).slice(-3), ...words(ahead).slice(0, 3)])
  const [only] = named

  if (named.size > 1) {
    return named.has('pravilnik') ? AMBIGUOUS : (only ?? '')
  }

  return only ?? ''
}

/** An article named by number, and a section named by number.
 *
 *  „čl. 46" is read too. Written that way a reference was invisible here while
 *  looking to a reader exactly like „Član 46", which is the same lesson a lower-case
 *  „član" taught this guard once already: a guard a spelling walks past is a guard on
 *  the spelling.
 *
 *  One space and not `\s*`, which reaches across a line break. A page is read as one
 *  piece of text, and on three of the four every section heading opens with a
 *  figure, so a paragraph ending on the ordinary word „člana" borrowed the number of
 *  the heading below it and this guard reported a reference that is not written
 *  anywhere.
 *
 *  At most three figures and never a leading zero, because a member number is
 *  written `000001` and the terms describe that very shape: read as a number, „član
 *  000001" became a reference to Član 1. */
/* An age is still read as a reference, and that stays a limit rather than becoming
   a fix. „od člana 16 godina i mlađeg" is a sentence about a person and this reads
   it as Član 16; refusing every number followed by „godin" was tried on 23.08.2026
   and measured worse, because „Zapis iz Člana 74 godinu dana ostaje dostupan" is an
   ordinary reference and went invisible. A false alarm is a sentence somebody
   rewrites; a reference nobody looks at is an article that quietly stops existing.
   Measured both ways, and the loud side kept. */
const ARTICLE = /(?:[Čč]lan\w*|[Čč]l\.) *(?!0)(\d{1,3})(?!\d)/g
const SECTION = /[Ss]ekcij\w+ *(?!0)(\d{1,3})(?!\d)/g

/** Every place a text names one of those: the words in front of it, the number, and
 *  the words behind it, each taken from the sentence the number stands in.
 *
 *  The words in front are read **from the position of the number** and not matched
 *  in front of it. Matched, the sixty characters are greedy, so of two references a
 *  clause apart the pattern takes the later one and eats the earlier as part of its
 *  own words: „Prema Članu 99 to ne donosi nikakvo pravo iz Člana 17" reported one
 *  reference where a reader sees two, and Član 99 does not exist. Measured, whole
 *  suite green. */
function mentionsIn(
  text: string,
  what: RegExp,
): { before: string; number: number; after: string }[] {
  return [...text.matchAll(what)].map((found) => {
    const at = found.index ?? 0
    /* `inFront` and not `behind`, which is what this was called while holding the
       words **in front of** the number: a name that says the opposite of what it
       holds is one more thing to get wrong, and the JSDoc above says so too. */
    const inFront = text.slice(0, at)
    const ahead = text.slice(at + found[0].length)

    return {
      before: wordsBefore(/[^.\n]{0,60}$/.exec(inFront)?.[0] ?? ''),
      number: Number(found[1]),
      after: /^[^.\n]{0,60}/.exec(ahead)?.[0] ?? '',
    }
  })
}

/** Every written page as one piece of text, under its own name. A page other than
 *  the rulebook names an article of it too, and a guard that reads only the rulebook
 *  is blind to exactly those: the privacy policy held one, and it stood on a number
 *  that had stopped existing. */

const WRITTEN_PAGES: [string, string][] = Object.entries(WRITTEN).map(([slug, page]) => [
  slug,
  [page.title, ...page.sections.flatMap((one) => [one.heading, one.body])].join(NEWLINE),
])

describe('the rulebook', () => {
  /** The whole of it as one piece of text, which is how a rule that has to be in
   *  it is looked for: an article moved from one section to another is still in
   *  the rulebook. */
  const rulebook = WRITTEN['pravilnik']
    ?.sections.map((section) => section.body)
    .join(NEWLINE)

  it('has none of the sentences the owner struck on 21.08.2026, and both of the rewrites', () => {
    /* Five sentences went out on one reading. Each said something the article
       around it already says, or something the portal no longer does:

       - the age of the junior fee, said in Član 12 about the two ages that need
         a parent, where the two rules have nothing to do with each other and
         saying so invited the reader to look for a connection;
       - "whoever that may be" after the organiser of a race, in Član 13;
       - "the price list is published at the end of this section", in Član 14,
         which stopped being true the moment the table moved up under it;
       - what the portal does before payments open, in Član 14, which is a
         sentence about a date that has passed by the time anybody reads it;
       - and the clause about a member freed of the fee never having a payment,
         in Član 15.

       Held here so that a rulebook rewritten for the next season cannot quietly
       take them back. */
    expect(rulebook).not.toMatch(/juniorska članarina nemaju veze/)
    expect(rulebook).not.toMatch(/ko god to bio/)
    expect(rulebook).not.toMatch(/Važeći cenovnik objavljuje se/)
    expect(rulebook).not.toMatch(/Portal radi i pre tog datuma/)
    expect(rulebook).not.toMatch(/nikad nema uplatu/)

    /* And the one the owner had written differently rather than removed: the
       figure in numerals and the sentence shorter by one word. */
    expect(rulebook).toMatch(/Onaj ko puni 15 u toku te sezone, još plaća juniorsku/)
    expect(rulebook).not.toMatch(/puni petnaest/)
  })

  it('has the struck word out of the prose, and the name on every record that carries it', () => {
    /* Owner, 21.08.2026: „zapravo svuda treba da se zove BTL dezorijentiring".
       He had asked for a capital letter first, in one article; a day of two
       spellings later, the answer is that the word „zimski" goes and the name is
       the same everywhere.

       Nine shapes of this guard before this one, and the tenth is shorter than
       any of them, because the ninth review handed over the measurement that
       makes it possible: the prose does not contain „zimsk" **at all**. Not once
       in four written pages. So the prose does not need a rule about distance,
       or about inflection, or about what stands near what. It needs a ban.

       That ban catches the one thing every clever version missed, which is a
       sentence that names the competition **without using its name**: „spojenoj
       sa zimskim takmičenjem lige" carries no `dezorijentiring` for a rule to
       find, and it is the sentence the first shape of this guard let stand for
       half a day.

       Its false alarm, and it is a real one: prose that says „zimsk" about
       anything at all. The competition is held in winter, so a sentence about
       winter conditions would raise it. There is none today, this is one line to
       revisit, and the alarm quotes the page. */
    const WORD = 'dezorijentiring'
    const NAME = `BTL ${WORD}`
    const mock = join(__dirname, '..', '..', 'public', 'mock')
    const contents = (name: string) => readFileSync(join(mock, name), 'utf8')

    /* The prose, page by page, with the target of a link taken out. The shape is
       the portal's own (`Markdown.tsx`, LINK): a target holds no space and is
       not empty, so a looser one would swallow text the portal draws literally.

       Nothing else is normalised. A line break inside a paragraph is drawn as a
       line break (`Markdown.css`, `white-space: pre-line`), so „BTL" at the end
       of one line and the word at the start of the next is a broken name on the
       screen and has to read as one here. */
    const prose = Object.entries(WRITTEN).map(([slug, page]): [string, string] => [
      slug,
      [page.title, ...page.sections.flatMap((one) => [one.heading, one.body])]
        .join(NEWLINE)
        .replace(/\]\([^)\s]+\)/g, ']'),
    ])

    expect(
      prose.filter(([, text]) => /zimsk/i.test(text)).map(([slug]) => slug),
      'the struck word is back in the prose',
    ).toEqual([])

    /* And the name is there, whole and written the one way. The ban above says
       nothing about a sentence that drops „BTL" without saying „zimski". */
    const mentions = prose.flatMap(([slug, text]) =>
      text
        .split(new RegExp(WORD, 'i'))
        .slice(0, -1)
        .map((part) => `${slug}: ${part.slice(-30)}`),
    )

    expect(mentions.length, 'the prose has stopped naming the competition').toBeGreaterThanOrEqual(
      5,
    )
    expect(
      mentions.filter((one) => !one.endsWith('BTL ')),
      'a mention in the prose that does not carry the name',
    ).toEqual([])

    /* Counted rather than matched, because what stands in front of a mention
       says nothing about how the mention itself is written: „BTL
       Dezorijentiringom" carries „BTL " and is still a second spelling. */
    expect(
      prose
        .filter(([, text]) => text.split(new RegExp(WORD, 'i')).length !== text.split(WORD).length)
        .map(([slug]) => slug),
      'the word is written with a capital in the prose',
    ).toEqual([])

    /* The records cannot take the same ban: other organisers really do run a
       „Zimski polumaraton", and eight editions of it are in this calendar. So
       there the struck word is only kept away from ours, thirty characters
       because the longest form that has to fit is „zimskome BTL ", thirteen.

       Every record the portal serves except the one members write themselves: a
       comment saying „zimski uslovi, ali dezorijentiring je bio odličan" is not
       a portal that has forgotten the name. Derived from the list the data layer
       reads (`data/client.ts`), so a record added tomorrow is asked too. */
    const files = RESOURCE_NAMES.filter((name) => name !== 'comments').map((name) => `${name}.json`)

    expect(
      files.flatMap((name) =>
        contents(name)
          .toLowerCase()
          .split(WORD)
          .slice(0, -1)
          .map((part) => part.slice(-30))
          .filter((part) => part.includes('zimsk'))
          .map((part) => `${name}: ${part}`),
      ),
      'the struck word still stands in front of the name',
    ).toEqual([])

    /* And what carries the word is this competition, whatever it has been
       renamed to: deciding by the address let an edition named `Dezorijentiring`
       through, because the portal gives that name the address
       `dezorijentiring-2027`. The display name is what a calendar, a profile and
       a standing print, and it is written once in the event and again in every
       result. */
    const events: BtlEvent[] = JSON.parse(contents('events.json'))
    const results: Result[] = JSON.parse(contents('results.json'))

    const named = (text: string) => text.toLowerCase().includes(WORD)
    const editions = events.filter((one) => named(one.name) || named(one.slug))
    const rows = results.filter((one) => named(one.eventName) || named(one.eventSlug))

    /* Floors and not counts: the season of 2027 has no edition in the calendar
       yet, and adding it must not raise this. Four editions and the forty-two
       results under them are what stands there today. */
    expect(editions.length, 'an edition of the competition has gone missing').toBeGreaterThanOrEqual(
      4,
    )
    expect(rows.length, 'the results have stopped naming it').toBeGreaterThanOrEqual(42)
    expect(editions.map((one) => one.name)).toEqual(editions.map(() => NAME))
    expect(rows.map((one) => one.eventName)).toEqual(rows.map(() => NAME))
  })

  it('numbers its articles from one, with nothing missing in between', () => {
    /* An article was taken out of the middle of it (the terrain profile, owner
       03.08.2026), so everything after it moved up by one. A rulebook that
       skips a number is a rulebook whose cross-references cannot be trusted,
       and it is full of them. The count is deliberately not written here: it
       said eight while there were twelve, because it was copied from memory
       instead of read out of the page, and the guard below counts them itself
       every run. */
    const numbers = [...(rulebook ?? '').matchAll(/### Član (\d+)\./g)].map((found) =>
      Number(found[1]),
    )

    /* A floor and not a count, so striking an article does not fail this on its
       own: what it catches is a rulebook that has lost most of itself. It stood
       at eighty while there were eighty-seven articles; the owner has since
       struck nine, and seventy-eight remain. */
    expect(numbers.length).toBeGreaterThan(70)
    expect(numbers).toEqual(numbers.map((_, index) => index + 1))
  })

  it('points every cross-reference at the article it means, not merely at one that exists', () => {
    /* Checking that a number is in range proves nothing here: taking an article
       out of the middle moves everything after it down by one, so a stale
       reference lands on a real article and says the wrong thing. What is
       checked is what each reference is about, against the heading of the
       article it lands on.

       Pinned by the words in front of each occurrence, and not by the set of
       numbers. Read as a set, „Pravo rangiranja pod uslovima iz Člana 11"
       rewritten to 14 left the set unchanged, because some other paragraph
       names 14 anyway: the rulebook then tied the right to be ranked to „Cena
       i rokovi", and all 2023 tests stayed green. Measured 21.08.2026.

       Pinned to the page as well, and that is not a formality: the privacy
       policy carries the one reference to the rulebook written anywhere else.
       Without the page in the pin, taking it off the policy and writing the
       same words into the rulebook's own Član 74 left the policy pointing
       nobody anywhere, the rulebook pointing at itself, and the suite green. */
    const expected: [string, string, number, RegExp][] = [
      ['pravilnik', 'članski broj i pravo rangiranja pod uslovima iz', 11, /Pravo rangiranja/],
      ['pravilnik', 'steklo pravo rangiranja govori', 11, /Pravo rangiranja/],
      ['pravilnik', '- Pravo rangiranja pod uslovima iz', 11, /Pravo rangiranja/],
      ['pravilnik', 'taksa za obradu plaćanja iz', 14, /Cena i rokovi/],
      ['pravilnik', 'ne donosi nikakvo pravo iz', 17, /Šta članstvo donosi/],
      /* The article the ethics section points at for what a race has to be.
         It pointed at a section until 21.08.2026, and that section is gone:
         the owner struck the article on official timing and the one on who
         verifies, and what was left of the section is one article, which now
         closes the section on what is scored. */
      ['pravilnik', 'Prijava trke koja ne ispunjava uslove iz', 25, /Zvaničan događaj/],
      /* Where the climb comes from, pointed at by the article that says the
         values are typed rather than read out of a track file (16.08.2026). */
      ['pravilnik', 'prednost ima podatak organizatora', 29, /Uspon i spust/],
      ['pravilnik', 'izaberete trku iz ponuđenog spiska', 37, /Ko prijavljuje i šta/],
      ['pravilnik', 'Prijava rezultata posle roka iz', 38, /^Rok$/],
      /* „Top liste iz Člana 48" stood in the list of what is kept per sex until
         22.08.2026, and the owner struck it: the top boards are combined and the
         code has always built them that way, with no gender filter anywhere in
         `topByKilometers`, `topByTimeOnCourse`, `topByCategory` or the progress
         board. The article named a reference that the portal did not honour. */
      ['pravilnik', 'posebna priznanja iz', 62, /Posebna priznanja/],
      ['pravilnik', 'može pokrenuti postupak iz', 71, /Postupak/],
      /* The one exception to a rulebook that does not change inside a season,
         added by the owner on 22.08.2026: the article on sponsors' prizes, which
         is filled in as sponsorship is secured. */
      ['pravilnik', 'U toku sezone se ne menja, osim', 65, /Sponzorske nagrade/],
      /* Named from the privacy policy and not from the rulebook: the
         exception for a birthday published on purpose. It is the only
         reference to the rulebook written on another page, and reading
         only the rulebook left it on 80 until the article stopped
         existing. */
      ['politika-privatnosti', 'sa godinom ili bez nje', 74, /Šta nikada nije javno/],
    ]

    const titles = new Map(
      [...(rulebook ?? '').matchAll(/### Član (\d+)\. ([^\n]+)/g)].map((found) => [
        Number(found[1]),
        String(found[2]).trim(),
      ]),
    )
    /* The headings themselves are not references to anything, so they are taken
       out before the references are read; left in, every article would be a
       reference to itself and each would need a line below. */
    /* Read whichever way the letter is written, and this is not a nicety.
       Written „(član 31)" with a small letter, a reference was invisible to this
       guard while looking exactly like every other one to a reader, so it went
       into the rulebook on 16.08.2026 without ever being checked. A guard that a
       lower-case letter walks past is a guard on the spelling. */
    /* Read over every written page and not only over the rulebook. A written
       page names an article of the rulebook as „Član 80 Pravilnika", and the
       privacy policy did: reading only the rulebook, the guard could not see
       it, and the number stayed on 80 through two renumberings until the
       article stopped existing. Measured on 21.08.2026, with 78 articles in
       the book and a published page pointing at the eightieth. */
    const referenced = WRITTEN_PAGES.flatMap(([slug, text]) =>
      mentionsIn(text.replace(/### Član \d+\.[^\n]*/g, ''), ARTICLE).map((one) => ({
        ...one,
        slug,
      })),
    )

    /* A number alone does not say which document it belongs to, and that is the
       whole difficulty: the terms and the privacy policy quote the statute and
       the law beside the rulebook, and the rulebook itself quotes the statute.
       A reference that names another document is not ours and is left alone; a
       reference that names none is the rulebook's own inside the rulebook, and
       anywhere else it is a fault, because a bare number off the rulebook is the
       shape that gets quietly counted as ours. */
    const ours = referenced.filter((one) => {
      const document = documentOf(one.before, one.after)

      /* Two documents named around one number, and no rule that picks between them
         is anything but a guess (`documentOf` says why). It fails here rather than
         being handed to either. */
      expect(
        document,
        `${one.slug} names two documents around article ${one.number}: „${one.before} Član ${one.number}${one.after}"`,
      ).not.toBe(AMBIGUOUS)

      if (document === '') {
        expect(
          one.slug,
          `${one.slug} names an article ${one.number} and nothing beside it says ${String(NAMED)}`,
        ).toBe('pravilnik')

        return one.slug === 'pravilnik'
      }

      return document.startsWith('pravilnik')
    })

    for (const one of ours) {
      const rule = expected.find(
        (line) => line[0] === one.slug && one.before.endsWith(line[1]) && line[2] === one.number,
      )

      expect(
        rule,
        `${one.slug}: „${one.before} Član ${one.number}" is not what is written here`,
      ).toBeDefined()
      expect(
        titles.get(one.number),
        `${one.slug} sends a reader to Član ${one.number}, which is now "${titles.get(one.number)}"`,
      ).toMatch(rule?.[3] ?? /$^/)
    }

    /* And every line here stands for exactly one reference, so one of a pair
       cannot be struck out under the cover of the other. Measured: the two
       paragraphs that both point at the right to be ranked shared a line, and
       deleting one of them passed. */
    for (const [slug, before, number] of expected) {
      expect(
        ours.filter(
          (one) => one.slug === slug && one.before.endsWith(before) && one.number === number,
        ).length,
        `"${before} Član ${number}" is not written on ${slug} exactly once`,
      ).toBe(1)
    }
  })

  it('does not carry the terrain profile any more', () => {
    /* Owner, 03.08.2026: „ne pratiti uopšte profil staze nigde na portalu".
       It was a table of four bands read off the climb per kilometre. */
    expect(rulebook).not.toMatch(/[Pp]rofil staze/)
    expect(rulebook).not.toMatch(/Talasasto|Brdovito|Planinsko/)
  })

  it('rests the whole criterion on the official list of results', () => {
    /* Owner, 21.08.2026: „Ako se nađe na listi rezultata ništa me drugo ne
       zanima", confirming that striking the article on official timing was
       deliberate.

       That article said the same thing from the other side: it forbade a time
       taken with a watch or an app. What carries the rule now is the article on
       proof, and it carries it better, because it says what is required rather
       than what is forbidden: somebody who runs the course alone, a day early
       or on a watch, is not on the official list and has nothing to file.

       Held here because the criterion is what PDL P17 calls the most damaging
       hole the old league ever had, and because it now stands on two sentences
       rather than on an article of its own.

       **[22.08.2026] The picture is a proof now, and the owner decided it
       knowing what it costs.** Asked directly — the article said a picture is
       „nikad zamena za link" while Član 37 had just made it one, and the form
       already let a result through on a photograph alone — he chose that the
       picture really replaces the link. So somebody who runs the course alone on
       a watch can file a result with no official list behind it, which is the
       hole P17 named. What holds the line instead is that a picture never stands
       by itself: the comment beside it is required, and it has to say what the
       picture shows. The three documents and the form now say one thing. */
    expect(rulebook).toMatch(
      /Link ka zvaničnim rezultatima je dokaz koji tražimo i sam po sebi je dovoljan/,
    )
    expect(rulebook).toMatch(/Slika je drugi dokaz i sme da stane umesto linka, ali nikad sama/)
    expect(rulebook).toMatch(/uz nju je komentar obavezan/)
    /* And nowhere the other way round, in any of the three documents: this rule
       lived in four homes and one of them was rewritten while three went on
       saying the opposite, which is what a round of review found. */
    for (const page of ['pravilnik', 'uslovi-koriscenja'] as const) {
      expect(whole(page)).not.toMatch(/nikad zamena za link/)
    }

    /* And every sentence that refuses a picture is one of the two that may.
     *
       Written out whole rather than described. Two shapes were tried before this
       and both failed, measured: a list of the phrasings that must not appear
       let three plain restatements through („Slika se ne prihvata kao dokaz.",
       the same with „Fotografija", „Slika diplome se ne prihvata."), and a rule
       with an escape for the words „bez, osim, jedino, samo" let through „…zbog
       bezbednosti" and „…nikada kao samostalan dokaz" while failing „Slika se ne
       prihvata kao dokaz ako uz nju ne stoji komentar", which is the rule that
       stayed.
     *
       There is no grammar for „refuses on the right ground". So the sentences
       are pinned, and a new one — however it is worded — stops the gate and asks
       a person whether the picture is still proof. That is the whole point: the
       rule lived in four homes and one was rewritten while three went on saying
       the opposite. */
    const refusing = (['pravilnik', 'uslovi-koriscenja'] as const).flatMap((page) =>
      whole(page)
        .split(/[\n]|(?<=\.)\s+/)
        .map((said) => said.trim())
        .filter((said) => /ne prihvata/.test(said) && /[Ss]lik|[Ff]otografij|[Dd]iplom/.test(said)),
    )

    /* Empty, and that is the whole claim. Since 22.08.2026 no sentence of either
       document refuses a picture at all: what the terms say is the positive
       form, „prihvata se kao dokaz samo uz komentar", which does not read as a
       refusal and does not have to be excepted from one. A list rather than a
       count, so a sentence that arrives is printed in the failure and a person
       decides whether the picture is still proof. */
    expect(refusing).toEqual([])
  })

  it('says when an event counts, in three conditions and one discretion', () => {
    /* The open question PDL P17 called the most damaging hole in the old
       league, closed by the owner on 03.08.2026. Read together: all three, and
       the league may still take an event that misses one of them.

       Rewritten by the owner on 21.08.2026, and the change is in the subject:
       the conditions are about an **event** now, not a race. The sentence that
       used to explain that the third one is counted over the event rather than
       the race is gone with it, and nothing is lost, because there is no race
       left in the sentence to mistake it for. */
    expect(rulebook).toMatch(/Događaj je zvaničan ako ispunjava sva tri uslova/)
    expect(rulebook).toMatch(/najkasnije mesec dana pre dana održavanja/)
    expect(rulebook).toMatch(/Zvanični rezultati su objavljeni posle događaja/)
    expect(rulebook).toMatch(/Na događaju je učestvovalo najmanje 50 učesnika/)
    /* „neki od ova tri" od 22.08.2026, ne „jedan": diskrecija nije bila
       ograničena na tačno jedan propušten uslov, a rečenica je tako čitana. */
    expect(rulebook).toMatch(
      /zadržava diskreciono pravo da prizna i događaj koji ne ispunjava neki/,
    )
    expect(rulebook).not.toMatch(/koji ne ispunjava jedan od ova tri/)
  })

  it('knows a member freed of the fee, and says the fee from abroad is not membership', () => {
    expect(rulebook).toMatch(/oslobodi plaćanja članarine/)
    /* Membership is measured by activation, and the deadline for the right to
       be ranked is measured by the day of payment. Two questions, and they read
       as a contradiction unless each says which one it answers. */
    /* The clause that used to close this sentence, spelling out that a member
       freed of the fee never has a payment and is a full member all the same,
       was struck by the owner on 21.08.2026. The sentence before it already says
       they have the same rights as anybody else. What has to survive is that the
       two questions stay apart, so the next sentence is read along with it. */
    expect(rulebook).toMatch(/meri se aktiviranim statusom na portalu. Do kada se plaća/)
    expect(rulebook).not.toMatch(/nikad nema uplatu/)
    expect(rulebook).toMatch(/Rok se meri po danu uplate, a ne po danu kada je liga uplatu/)
    expect(rulebook).toMatch(new RegExp(`taksa za obradu plaćanja od ${PROCESSING_FEE_EUR} EUR`))
    expect(rulebook).toMatch(/nije deo članarine/)
  })

  it('keeps a first season member in one category and only one', () => {
    /* Owner, 03.08.2026: no crossing into the age band mid-year and no running
       in both at once. It closed the one question the article had left open.

       And a beginner **does** run in the general standing. The article said the
       opposite until 22.08.2026, and the code never did: `rankingFor` with no
       category asked for takes everybody of that gender who has raced, beginners
       among them. The owner: „Početnici i početnice učestvuju u generalnom
       plasmanu, ali je mala šansa da je osvoje." So the rulebook was the wrong
       one of the two, and the sentence is held here in the negative as well, so
       it cannot come back without this failing. */
    expect(rulebook).not.toMatch(/ne konkuriše u generalnom plasmanu/)
    expect(rulebook).toMatch(/Početnik ne konkuriše u uzrasnoj kategoriji/)
    expect(rulebook).toMatch(/Nastupa u dve kategorije istovremeno nema/)
    expect(rulebook).toMatch(/promena stupa na snagu od naredne sezone/)
  })

  it('awards a trophy and nothing else, and says once when a trophy is not given', () => {
    /* Owner, 04.08.2026: the plaque is gone. One trophy covers the winning team,
       the first three overall in each sex, and the first three in every
       category, and the sentence about a category too small to be a category
       moved into that row, so it no longer reads as a rule about every award in
       the table. */
    expect(rulebook).toMatch(/pobedniku u timskom plasmanu/)
    expect(rulebook).toMatch(
      /Pehari u jednoj kategoriji se ne uručuju ako u toj kategoriji te sezone ima manje od tri člana/,
    )
    expect(rulebook).not.toMatch(/[Pp]laket/)
    /* And the figure is not given for the best team or the best pair on top of
       the trophy: that is one team, or one pair, taking two awards by one
       measure.

       The pair was in the wrong half of this until 15.08.2026. The owner settled
       it on 11.08.2026 (PDL P16): the trophy is for standing, „po kategorijama,
       generalno muški i ženski, jedan timski i jedan trkačkom paru", and the
       figure is for what is not a standing. Član 62 lists the pair among the
       special recognitions, which the article then handed a figure, so the
       rulebook gave the pair a figure while the decision gave them a trophy. */
    expect(rulebook).toMatch(/najboljem trkačkom paru/)
    expect(rulebook).toMatch(/osim najboljeg tima i trkačkog para godine, koji dobijaju pehar/)
  })

  it('says nothing about the competitions the league runs alongside it', () => {
    /* Owner, 04.08.2026: the article on the RunTrace league is out, because the
       rulebook is not where a competition beside the main one is described. What
       a league is, and that the league itself runs two of its own, stays. */
    expect(rulebook).not.toMatch(/RunTrace liga|U RunTrace ligu/)
    expect(rulebook).toMatch(/### Član 57\. Liga kao pojam/)
  })

  it('cannot be changed inside a season', () => {
    /* The last of the blanks the rulebook was carrying, answered by the owner on
       04.08.2026: the article that asked the question is gone and the answer is
       one sentence in the article about writing a new one each season. */
    expect(rulebook).toMatch(
      /U toku sezone se ne menja, osim člana 65 koji objavljuje specifikaciju/,
    )
    expect(rulebook).not.toMatch(/Izmene u toku sezone/)
  })

  it('asks for the same result the forms ask for', () => {
    /* The picture and the comment, both optional, on the article that lists what
       a competitor sends in (owner, 03.08.2026). The forms are held to the same
       thing in src/forms/definitions.test.ts. */
    expect(rulebook).toMatch(/Sliku, neobavezno/)
    expect(rulebook).toMatch(/Komentar, neobavezno/)
    /* Both optional as fields, and the article says in the next breath what a
       picture does to the other two (owner, 22.08.2026). Written out here as
       well, because „neobavezno" on its own reads as the whole rule and stopped
       being it. */
    expect(rulebook).toMatch(
      /Ukoliko podignete sliku, link ka zvaničnim rezultatima postaje neobavezan, ali polje Komentar postaje obavezno/,
    )
  })
})

describe('how a written page is set', () => {
  const pages = Object.entries(WRITTEN)

  it('reads every written page there is', () => {
    /* Without this the two below pass on an empty list. Four: the rulebook, the
       terms, the privacy policy and the address of the president. */
    expect(pages.length).toBe(4)
    expect(pages.map(([slug]) => slug)).toContain('politika-privatnosti')
  })

  it('keeps bold for a sub-heading and takes it off everything else', () => {
    /* Owner, 01.08.2026. Two hundred and fifty-eight runs of bold were spread
       through the prose, a keyword at a time. A page where a fifth of the words
       are heavy has no emphasis at all: the eye stops picking anything out and
       the reader is left with the noise of somebody shouting evenly.

       What may stay is a whole paragraph that names what follows it and stops,
       "U Srbiji:" and its kind, plus the signature under the president's
       address. A whole sentence in bold is a rule somebody shouted and it goes
       back to being a sentence. */
    const shouted: string[] = []

    for (const [slug, page] of pages) {
      for (const section of page.sections) {
        for (const line of section.body.split(NEWLINE)) {
          const t = line.trim()
          const whole = t.startsWith('**') && t.endsWith('**') && t.split('**').length === 3

          if (whole && t.slice(0, -2).endsWith('.')) {
            shouted.push(`${slug}: ${t.slice(0, 60)}`)
          }

          if (!whole && t.includes('**')) {
            shouted.push(`${slug}: ${t.slice(0, 60)}`)
          }
        }
      }
    }

    expect(shouted).toEqual([])
  })

  it('writes an address as a link and never as a piece of code', () => {
    /* Owner, 01.08.2026: legible, the way the president's address on the front
       page writes it. Backticks made an e-mail address look like something to
       be typed into a terminal. */
    const code: string[] = []

    for (const [slug, page] of pages) {
      for (const section of page.sections) {
        for (const found of section.body.matchAll(/`([^`]*)`/g)) {
          const inside = found[1] ?? ''

          if (inside.includes('@') || inside.includes('balkanskatrkackaliga')) {
            code.push(`${slug}: ${inside}`)
          }
        }
      }
    }

    expect(code).toEqual([])
  })

  it('points every in-portal link at an address the router has', () => {
    /* The language is added when the link is drawn (ADL A7), so writing it here
       makes /sr/sr/pravilnik, which is no address at all and falls through to
       the front page. Two of those went out on the terms, which is a legal
       document with a dead link in it. */
    const wrong: string[] = []

    for (const [slug, page] of pages) {
      for (const section of page.sections) {
        for (const link of section.body.matchAll(/\]\((\/[^)]*)\)/g)) {
          if (/^\/(sr|en)\//.test(link[1] ?? '')) {
            wrong.push(`${slug}: ${link[1]}`)
          }
        }
      }
    }

    expect(wrong).toEqual([])
  })

  it('sends a reader to the section it names', () => {
    /* Deleting a section moves every number after it, and a sentence that names
       one does not move with it. Both of the terms' own references pointed at
       the awards clause after the first section went.

       Read against what each section is **about**, not against whether the
       number exists. A stale reference lands on a real section and says the
       wrong thing, so an existence check passes exactly when it should fail:
       measured on 21.08.2026, moving „priznanja po broju trka iz sekcije 14" to
       15, from the awards onto the code of ethics, left the whole suite green.

       In prose, pinned by the words in front of each occurrence. Pinned per
       page and number instead, two sentences on one page could swap their
       numbers and both still pass: „Detalji su u sekciji 12" and „sopstvena
       takmičenja lige iz sekcije 13" swapped sends the reader after teams to
       the accompanying competitions and the other way round, and the suite
       stayed green. Measured 21.08.2026. */
    const inProse: [string, string, number, RegExp][] = [
      ['politika-privatnosti', 'pristanak ne traži', 4, /Kolačići/],
      ['uslovi-koriscenja', 'razlog za meru iz', 7, /Pravila ponašanja i mere/],
      ['uslovi-koriscenja', 'izriču se po postupku iz', 7, /Pravila ponašanja i mere/],
      ['pravilnik', 'Detalji su u', 12, /Timovi, trkački parovi i klubovi/],
      ['pravilnik', 'sopstvena takmičenja lige iz', 13, /Prateća takmičenja i lige/],
      ['pravilnik', 'priznanja po broju trka iz', 14, /Nagrade i priznanja/],
      ['pravilnik', 'može dovesti do mera iz', 16, /Sankcije i diskvalifikacija/],
    ]

    /* A table is not prose and is not read as prose. The column of legal bases
       in the privacy policy points its rows at where each datum's retention is
       written, and they all say the same thing; pinning a row by the words in
       front of it would be pinning it by the row above. They are held as a
       group instead: a table that names a section names one section, in every
       one of its rows.

       **What this does not catch, said out loud:** a row that stops naming a
       section and writes a period of its own instead. Seven rows of these very
       tables do exactly that and are right to (`Do isporuke`, `Do odjave`, `30
       dana`), so the column legitimately carries either a pointer or a period,
       and nothing in the shape of a cell tells a wrong period from a right one.
       Demanding a pointer in every row raised a false alarm on all seven,
       measured. A rule for it would have to be a hand-written list of which
       data point at the section, and that list is the thing that goes stale.

       Both cases of the word, because the guard read only the small one and
       these rows carry a capital, which left twenty-two of twenty-nine
       references invisible to it.

       Table by table and not section by section: this one section of the policy
       holds four tables, and asked as one group a fourth table pointing at its
       own section read as a table naming two. */
    const inTables: [string, number, RegExp][] = [['politika-privatnosti', 5, /Koliko čuvamo/]]

    const seenInProse: { slug: string; before: string; number: number }[] = []
    const seenInTables = new Set<string>()

    for (const [slug, page] of pages) {
      const numbered = new Map(
        page.sections
          .map((section) => /^(\d+)\. (.*)$/.exec(section.heading))
          .filter((found): found is RegExpExecArray => found !== null)
          .map((found) => [Number(found[1]), found[2] ?? '']),
      )

      const heading = (number: number): string => {
        const title = numbered.get(number)

        expect(title, `${slug} names section ${number}, which it does not have`).toBeDefined()

        return title ?? ''
      }

      for (const section of page.sections) {
        /* Everything that is not a row of a table, asked exactly the way `tablesOf`
           asks it. Asked as „does not begin with a pipe", a row missing its closing
           pipe fell out of both paths at once: not a row to the table reader, not
           prose here, and so read by nobody. A reader sees it as an ordinary
           paragraph, because the renderer draws it as one (components/Markdown.tsx),
           so this reads it as one too. The fifth recorded limit of 22.08.2026. */
        const prose = proseOf(section.body)

        for (const { before, number } of mentionsIn(prose, SECTION)) {
          const rule = inProse.find(
            (one) => one[0] === slug && before.endsWith(one[1]) && one[2] === number,
          )

          expect(
            rule,
            `${slug}: „${before} sekcija ${number}" is not what is written here`,
          ).toBeDefined()
          expect(
            rule?.[3].test(heading(number)),
            `${slug} sends a reader to section ${number}, which is now "${heading(number)}"`,
          ).toBe(true)

          seenInProse.push({ slug, before, number })
        }

        for (const table of tablesOf(section.body)) {
          const named = table.rows.map((cells) =>
            cells.flatMap((cell) => [...cell.matchAll(SECTION)].map((found) => found[1])),
          )

          if (named.every((row) => row.length === 0)) {
            continue
          }

          const numbers = [...new Set(named.flat().map(Number))]

          expect(
            numbers.length,
            `${slug}, ${section.heading}: the rows of one table name more than one section`,
          ).toBe(1)

          for (const number of numbers) {
            const rule = inTables.find((one) => one[0] === slug && one[1] === number)

            expect(
              rule,
              `${slug} sends a table to section ${number}, which nothing here accounts for`,
            ).toBeDefined()
            expect(
              rule?.[2].test(heading(number)),
              `${slug} sends a table to section ${number}, which is now "${heading(number)}"`,
            ).toBe(true)

            seenInTables.add(`${slug} ${number}`)
          }
        }
      }
    }

    /* And every line here stands for exactly one reference, so one of a pair
       cannot be struck out under the cover of the other. */
    for (const [slug, before, number] of inProse) {
      expect(
        seenInProse.filter(
          (one) => one.slug === slug && one.before.endsWith(before) && one.number === number,
        ).length,
        `"${before} sekcija ${number}" is not written on ${slug} exactly once`,
      ).toBe(1)
    }

    expect([...seenInTables].sort()).toEqual(
      inTables.map(([slug, number]) => `${slug} ${number}`).sort(),
    )
  })


  /**
   * The stores the policy deliberately does not name, and why.
   *
   * One entry, and it is the simulated day the developer tools keep: written only
   * where those tools are switched on (`devToolsEnabled()` in
   * clock/ClockProvider.tsx), which is the QA site and never the portal a visitor
   * reaches. QA is behind a password and is not indexed, so the reader of this
   * policy is never the reader of that store. The reason is written down here
   * because it was written down once before, in a comment, and went out with the
   * code that comment sat in; a review then had to find it again.
   */
  const NOT_DISCLOSED = new Map([
    ['btl.simulated-day', 'kept only where the developer tools are on, so never on the portal'],
  ])

  it('names every store the portal actually keeps in a browser, by its own name', () => {
    /* The policy is read as a promise, and „Drugih kolačića nema" was one it did
       not keep: the portal writes the chosen theme to `localStorage`, read before
       the first paint for every visitor, member or not. Under the EDPB's
       guidelines 2/2023 and Article 147 of the electronic communications act,
       local storage is the same thing as a cookie; the theme is exempt from
       consent, because it is a display setting the reader asked for, but exempt
       from consent is not exempt from being disclosed.
     *
       **The keys are read out of the code, one by one.** Written the loose way,
       „some file writes to localStorage and the document says btl-theme
       somewhere", a review beat it three ways in a row: a second store under a
       different key passed, and so did renaming the key so that the document
       named one the portal no longer uses. What a policy owes the reader is the
       name of every store, so that is what is compared: the set of keys the code
       writes against the set of keys the document names.
     *
       `index.html` is read as well as `src`, because the theme is fetched there
       before React starts and the sweep over sources does not reach it. */
    const everywhere = [
      ...sources().map(({ code }) => code),
      readFileSync(join(process.cwd(), 'index.html'), 'utf-8'),
    ]

    /* Anything handed to `setItem` on any store, spelt out or named by a
       constant. Three ways of getting past this were measured on the earlier
       `localStorage.setItem(`: `const store = window.localStorage` walked past
       the name, `sessionStorage` is a second store the reader is owed the name of
       just the same, and a key written as `setItem(makeKey(a, b), …)` cut the
       argument at the comma inside it and threw an unreadable error about a
       regular expression instead of saying anything about a store. */
    const keys = new Set<string>()

    for (const code of everywhere) {
      /* Every call, not the first one. Written as `matchAll(/\.setItem\(([\s\S]*)/g)`
         the group was greedy and ate the file to its end, so `matchAll` answered
         with exactly one match per file and every later store in the same file was
         invisible. A review measured it: a second, undisclosed `setItem` written
         under the theme in ThemeProvider passed the whole suite. The rest of the
         call is taken from where the match ends instead. */
      for (const found of code.matchAll(/\.setItem\(/g)) {
        const handed = firstArgument(code.slice((found.index ?? 0) + found[0].length)).trim()
        const literal = /^['"`](.*)['"`]$/.exec(handed)

        if (literal !== null) {
          keys.add(literal[1] ?? '')
          continue
        }

        /* A constant: find where it is given its value, anywhere in the portal.
           The name goes into the pattern escaped, because it is read out of a
           file and this test has no say in what it looks like.
         *
           The whole name, and that is not a nicety. The clock's store is opened by
           a constant called `KEY` (clock/ClockProvider.tsx), and written without
           the boundary this pattern matched every identifier ending in those three
           letters: `THEME_STORAGE_KEY` all along, and on 23.08.2026 a new
           `REQUIRED_KEY` in forms/validate.ts, whose value is the name of an error
           message rather than of any store. The guard then asked the privacy policy
           to disclose a store the portal does not have, and would as happily have
           let the clock's own store be disclosed under somebody else's name.
         *
           A constant given a written type, `const KEY: string = '…'`, is matched by
           neither the old pattern nor this one, and that is the safe side: it fails
           loudly with „nothing in the portal gives `KEY` a value" rather than
           quietly reading nothing. Measured both ways. */
        const gives = new RegExp(
          `(?:^|[^\\w$])${escaped(handed)}\\s*=\\s*['"\`](.*?)['"\`]`,
          'g',
        )
        const named = everywhere
          .flatMap((one) => [...one.matchAll(gives)])
          .map((one) => one[1] ?? '')

        expect(
          named,
          `nothing in the portal gives \`${handed}\` a value, so the store it opens cannot be named`,
        ).not.toEqual([])
        named.forEach((value) => keys.add(value))
      }
    }

    /* The sweep has to have found something, or the whole test passes over
       nothing (app/filterParams.test.ts holds its own sweep the same way). */
    expect(keys.size, 'no store was found at all, so nothing was compared').toBeGreaterThan(0)
    /* And it has to have found the theme, which is the one every visitor gets.
       Nought keys is not the only empty answer: one key is too, if the one it
       found is the wrong one. */
    expect([...keys]).toContain(THEME_STORAGE_KEY)
    /* And every store left out on purpose has to still be there to leave out.
       Without this the map is write-only: the day the developer tools stop keeping
       a store, the entry stays behind as a licence for a name nothing writes, and
       the only thing said about it was that its reason is not the empty string. */
    for (const key of NOT_DISCLOSED.keys()) {
      expect([...keys], `nothing writes \`${key}\` any more, so the exemption is stale`).toContain(
        key,
      )
    }

    const policy = whole('politika-privatnosti')

    for (const key of keys) {
      const why = NOT_DISCLOSED.get(key)

      if (why !== undefined) {
        /* Left out on purpose, and the reason is written down beside the key. The
           list is short and adding to it is a decision somebody makes rather than
           a test quietly widening. */
        expect(why, `the reason \`${key}\` is not disclosed is empty`).not.toBe('')
        continue
      }

      /* As a whole name, not as a piece of one. Measured: read with `toContain`,
         a store called `theme` passed on a document that names `btl-theme`, and so
         would one called `btl`. What a policy owes the reader is the name of the
         store, and half a name is a different store. */
      expect(policy, `the policy does not name the store \`${key}\``).toMatch(
        new RegExp(`(^|[^\\w.-])${escaped(key)}($|[^\\w.-])`),
      )
    }

    /* And the two things the reader is owed about it: that it never reaches the
       association, and why no consent is asked for it. */
    expect(policy).toContain('lokalnom skladištu')
    expect(policy).toContain('naš server ne vidi')
    expect(policy).toMatch(/pristanak se ne traži|Za njega se pristanak ne traži/)
    /* The claim the document used to make, and must not make again while any
       store is there. */
    expect(policy).not.toContain('Drugih kolačića nema')
  })

  it('offers nothing the portal cannot receive', () => {
    /* Owner, twice: „od GPX odustajem (neće biti)". The function was never in the
       code at all, and that is what made this the purest case of a promise with
       nothing behind it: the public rulebook had a whole article inviting a member
       to attach a track in GPX, FIT or TCX and saying it would go for approval,
       and the portal had nowhere to receive it. The privacy policy carried it in
       the table of what is processed, under „Vaš pristanak", for data that never
       arrives.
     *
       The article kept its number. Removing it would have renumbered forty two
       articles, and forty seven references in these documents point at numbers
       above it with nothing guarding them; renumbering by hand is how a public
       rulebook ends up pointing at the wrong clause. It says what is true instead,
       which is that the values are typed by hand and that no track is read.
     *
       Read off the disc rather than off a screen, because what is guarded is what
       the documents say. The one permitted mention is the sentence that says the
       portal does not accept one; anything that reads as an invitation fails.
     *
       **Four ways past this were measured and are closed here.** The trigger was
       the file formats by name, so „priložite zapis staze" said the whole thing
       without them. Only the written pages were read, so the same offer made from
       the dictionary, on a screen rather than in a document, was not read at all.
       The permitted sentence was looked for anywhere in the line, so „Portal ne
       prima zapis staze, ali možete da priložite GPX" passed with the refusal
       serving as the pass for the invitation beside it. And „trag sa sata", which
       is what somebody writing about a watch reaches for before they reach for
       „GPX", was not among the triggers at all.
     *
       **What this cannot be, said out loud rather than implied.** The trigger is a
       written list of ways of naming the thing, so it is complete for the ways
       somebody has thought of and no others. It is not a proof that no offer
       exists; it is a net with a known mesh. Hence three things: it fails loudly on
       everything it does catch, the mesh is widened whenever a review gets through
       it, and `offersTrack` is measured on offers written on purpose below, because
       in `sr.json` nothing triggers it at all today and a half of a guard that
       reads nothing looks exactly like a half that finds nothing. */
    const lines: [string, string][] = [
      ...pages.flatMap(([slug, page]) =>
        page.sections.flatMap((section) =>
          section.body.split(NEWLINE).map((line): [string, string] => [slug, line]),
        ),
      ),
      /* The dictionary as well, because an offer printed on a screen is the same
         offer as one written in a document, and this guard read none of it. */
      ...JSON.stringify(sr, null, 1)
        .split('\n')
        .map((line): [string, string] => ['sr.json', line]),
    ]

    expect(offersTrack(lines)).toEqual([])
    /* And the sweep reached the one line that is allowed to mention it, so the
       trigger is live rather than merely quiet. */
    expect(lines.filter(([, line]) => OFFERED.test(line)).length).toBeGreaterThan(0)
  })

  it('carries no telephone number anywhere', () => {
    /* Owner, 01.08.2026: the association's number is on none of these pages.
       The one a member gives at registration is collected and never shown. */
    for (const [slug, page] of pages) {
      for (const section of page.sections) {
        expect(section.body, `${slug} prints a telephone number`).not.toMatch(/\+381[\d\s]/)
      }
    }
  })
})

/** The first argument of a call, cut where the argument ends rather than at the
 *  first comma: `setItem(makeKey(a, b), day)` hands over one key. */
function firstArgument(after: string): string {
  let depth = 0

  for (let index = 0; index < after.length; index += 1) {
    const letter = after[index]

    if (letter === '(') {
      depth += 1
    } else if (letter === ')' && depth === 0) {
      return after.slice(0, index)
    } else if (letter === ')') {
      depth -= 1
    } else if (letter === ',' && depth === 0) {
      return after.slice(0, index)
    }
  }

  return after
}

/** A name read out of a file, made safe to put inside a pattern. */
function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
}

/** Ways of naming a track file, and what an invitation to send one sounds like. A
 *  written list, so it is exactly as complete as the ways somebody has thought of;
 *  the test that uses it says so, and measures itself against offers written on
 *  purpose. */
const OFFERED = /GPX|TCX|\bFIT\b|zapis staze|trag sa sata|GPS trag/i
const INVITES = /priloz|priloži|prilaž|prilog|dodajte|učitaj|pošaljite|prihvata|čita/i
const REFUSAL = 'Portal ne prima zapis staze'

/**
 * Every line that offers a track file, with where it was found.
 *
 * A line may mention one only to say the portal does not take it, and only that:
 * the refusal is struck out and whatever is left must not read as an invitation, or
 * one sentence could carry both and pass on the half that is allowed.
 */
function offersTrack(lines: [string, string][]): string[] {
  return lines
    .filter(([, line]) => OFFERED.test(line))
    .filter(([, line]) => !line.includes(REFUSAL) || INVITES.test(line.replace(REFUSAL, '')))
    .map(([where, line]) => `${where}: ${line.trim()}`)
}

describe('the two pieces the store sweep is made of', () => {
  /* Neither was reachable by anything but the two calls the portal happens to make
     today, and both exist for calls it does not make yet: a key built by a function,
     and a name read out of a file going into a pattern. Reduced to doing nothing,
     both passed the whole file. */
  it('cuts the first argument where the argument ends, not at the first comma', () => {
    expect(firstArgument("'btl-theme', next)")).toBe("'btl-theme'")
    expect(firstArgument('makeKey(a, b), next)')).toBe('makeKey(a, b)')
    expect(firstArgument('deep(one(a, b), c), next)')).toBe('deep(one(a, b), c)')
    // A call with one argument ends at its own bracket, with no comma anywhere.
    expect(firstArgument('only(a))')).toBe('only(a)')
  })

  it('makes a name read out of a file safe to put in a pattern', () => {
    /* Without this, a name carrying a bracket or a dot built a pattern that either
       threw something unreadable about a regular expression or quietly matched more
       than the name. */
    expect(new RegExp(escaped('KEY.NAME')).test('KEY.NAME')).toBe(true)
    expect(new RegExp(escaped('KEY.NAME')).test('KEYxNAME')).toBe(false)
    expect(() => new RegExp(escaped('makeKey(a'))).not.toThrow()
  })
})

describe('the guard over the written pages', () => {
  /* Each of these is a way somebody got past an earlier version of the sweep, or
     could. Written as offers on purpose, because the real documents make none and a
     sweep that finds nothing looks the same as a sweep that reads nothing. */
  it.each([
    ['the format by name', 'Priložite GPX i moderator ga proverava.'],
    ['no format at all', 'Priložite zapis staze i moderator ga proverava.'],
    ['a watch instead of a format', 'Pošaljite trag sa sata uz rezultat.'],
    ['the letters GPS', 'Dodajte GPS trag, portal ga čita.'],
    [
      'a refusal and an offer in one breath',
      'Portal ne prima zapis staze u obliku GPX, ali možete da priložite zapis uz komentar.',
    ],
  ])('catches an offer written as %s', (_case, line) => {
    expect(offersTrack([['sr.json', line]])).toHaveLength(1)
  })

  it('lets the one sentence that refuses one through', () => {
    expect(
      offersTrack([
        ['pravilnik', 'Portal ne prima zapis staze u obliku GPX, FIT ili TCX i ne izvodi te vrednosti iz njega.'],
      ]),
    ).toEqual([])
  })
})

/**
 * One source file with its comments taken out.
 *
 * A rule described in prose is not a rule, and a sweep that reads prose finds the
 * very sentences that explain what it is looking for. `styles/scale.test.ts` keeps
 * the same rule over stylesheets and for the same reason.
 */
function unwritten(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
}

/** The whole of one written page, as one piece of text. */
function whole(slug: 'uslovi-koriscenja' | 'pravilnik' | 'politika-privatnosti'): string {
  /* Headings as well as bodies, and the name of the page. A section called
     "Zašto je formula tajna" would have gone past a guard that read only the
     text under it. */
  return [
    written[slug].title,
    ...written[slug].sections.flatMap((section) => [section.heading, section.body]),
  ].join(`\n`)
}

/** The one section of a page that says something, by what it says. */
function sectionOf(
  slug: 'uslovi-koriscenja' | 'pravilnik' | 'politika-privatnosti',
  says: RegExp,
): string {
  const found = written[slug].sections.find((section) => says.test(section.body))

  if (found === undefined) {
    throw new Error(`no section of ${slug} says ${String(says)}`)
  }

  return found.body
}

/**
 * The one section of a page that says something, where "one" is the claim.
 *
 * `sectionOf` above takes the first that matches, which is right for sixteen
 * questions in this file that are anchored on a phrase: „Član lige je" is a
 * definition in Član 10 and a sentence anybody may write in the code of ethics,
 * and a guard that stopped the file over an ordinary edit to the rulebook would
 * be a guard about itself.
 *
 * Here the count is the point. What is asked below is where a section **stops**,
 * and a second section that ends on the same sentence quietly moves that question
 * onto a section nobody meant: a guard reading the wrong section is worse than no
 * guard, because it is green. Measured on 23.08.2026, a new section carrying the
 * sentence „Za prenos van Evropske unije koristimo propisane mehanizme zaštite."
 * used to move the guard under it and let the deleted sentence back.
 *
 * So the strictness lives with the two callers that need it and not with the
 * sixteen that do not.
 */
function oneSectionOf(
  slug: 'uslovi-koriscenja' | 'pravilnik' | 'politika-privatnosti',
  says: RegExp,
): string {
  const found = written[slug].sections.filter((section) => says.test(section.body))

  if (found.length !== 1) {
    throw new Error(
      `${String(found.length)} sections of ${slug} say ${String(says)}, and this anchor has to be one section's own`,
    )
  }

  return must(found[0], 'the one section that says it').body
}

describe('what the written pages say the fee buys', () => {
  /* The fee stays the ticket into the league (owner, 03.08.2026, PDL P32). The
     documents already behaved that way and described it two ways, once as
     membership of an association and once as a subscription to a website. The
     terms say it plainly now, and these hold the three documents to it.
     Read off the disc, because this is about what is written rather than about
     what a screen does with it. */
  it('says the fee is not paid for the website but for membership in the league', () => {
    expect(sectionOf('uslovi-koriscenja', /Takmičarski status za sezonu/)).toMatch(
      /ne plaća za pristup sajtu nego za članstvo u ligi/,
    )
  })

  it('says in the rulebook too that membership is what a member is', () => {
    /* Said positively, over the sentence that carries the model, rather than by
       forbidding two words. Forbidding words proved nothing: neither of them was
       ever in these documents, so the assertion passed without measuring
       anything, and it would not have caught the description P32 names as the
       wrong one, a subscription to a website. */
    expect(sectionOf('pravilnik', /Član lige je/)).toMatch(
      /primljen u članstvo Udruženja i kome je aktiviran takmičarski status/,
    )
    /* And activation is what carries it, since one member in the league has
       never paid anything: one freed of the fee. Written as three conditions with
       the fee among them, the definition gave rights in one article and took
       them back in another (owner, 03.08.2026). */
    expect(sectionOf('pravilnik', /Član lige je/)).toMatch(
      /aktivira po evidentiranoj uplati članarine ili po odluci Upravnog odbora kojom je član oslobođen/,
    )
  })

  it('says what stops when the fee runs out, which is what makes it a ticket', () => {
    expect(sectionOf('uslovi-koriscenja', /Takmičarski status za sezonu/)).toMatch(
      /se rezultati ne unose, ne rangiraju i ne ulaze u tabele, a profil se ne prikazuje/,
    )
  })

  it('measures membership by activation in the terms as well, not only in the rulebook', () => {
    /* The terms are the document the rulebook itself makes authoritative for the
       fee (article 3), and they went on defining a member as somebody who has
       paid. One member freed of the fee reads both and is told in one that they are a
       member with every right and in the other that their profile is not shown
       (owner, 03.08.2026). */
    expect(sectionOf('uslovi-koriscenja', /Takmičarski status za sezonu/)).toMatch(
      /Članstvo proizvodi dejstvo po evidentiranoj uplati članarine, ako je članarina za to lice utvrđena/,
    )
    expect(sectionOf('uslovi-koriscenja', /Takmičarski status za sezonu/)).toMatch(
      /Dok takmičarski status nije aktivan/,
    )
    /* And the section that walks through registration, which described the same
       thing as a queue of steps ending in a payment. A member freed of the fee never
       walks two of those steps. */
    expect(sectionOf('uslovi-koriscenja', /Prijava za članstvo/)).toMatch(
      /Dok nije, niste vidljivi na portalu/,
    )
    expect(sectionOf('uslovi-koriscenja', /Prijava za članstvo/)).toMatch(
      /oslobodio plaćanja članarine prolazi bez koraka 4; članski broj i sva prava dobija/,
    )
  })

  it('writes the ladders of Član 49 exactly as the boards are ordered', () => {
    /* The tie-break ladders live in two homes: this table and `data/derive.ts`.
       Each home has its own guard — `derive.test.ts` measures the code by
       mutation — and until now nothing held this one, so the table could be put
       back to the order the owner replaced on 22.08.2026 while the portal went
       on ranking by the new one. A member disputing a place would read a rulebook
       that does not describe the portal. Measured: the row for the best race put
       back to its old wording left all 2035 tests green.

       Written out row by row rather than parsed into criteria: the table is
       Serbian prose and any mapping from „pa bodovi" onto a comparator is a
       third home for the same fact. What this holds is that the text does not
       move without somebody looking at the ladders beside it. */
    const rows: [string, string][] = [
      ['Generalni plasman', 'bodovi, pa kilometri, pa više trka, pa više vertikale, pa niži članski broj'],
      [
        'Najviše kilometara',
        'kilometri, pa bodovi, pa više trka, pa vertikala, pa ranije dostignuto, pa niži članski broj',
      ],
      [
        'Najduže na stazi',
        'vreme, pa bodovi, pa kilometri, pa više trka, pa vertikala, pa niži članski broj',
      ],
      [
        'Najbolja trka',
        'bodovi na toj trci, pa veća dužina trke, pa bodovi u sezoni, pa kilometri u sezoni, pa niži članski broj',
      ],
      [
        'Najbolji tim',
        'bodovi, pa više trka, pa kilometri, pa vreme na stazi, pa stalan redosled timova',
      ],
      [
        'Najbolji trkački par',
        'bodovi sa zajedničkih trka, pa više zajedničkih trka, pa zajednički kilometri, pa zajedničko vreme na stazi, pa niži zbir članskih brojeva',
      ],
      /* All seven and not six. The seventh was left out of the first version of
         this list, and it has a home in the code like the others (`BY_CATEGORY`):
         rewritten to contradict it — points dropped under the vertical, „pa
         ranije dostignuto" struck, which is the rung `-Date.parse(reachedOn)` —
         the whole of `src/pages` stayed green. */
      [
        'Po broju trka po tipu',
        'broj trka, pa bodovi iz baš tih trka, pa kilometri iz tih trka, pa vertikala iz tih trka, pa ranije dostignuto, pa niži članski broj',
      ],
    ]
    const article = sectionOf('pravilnik', /Redosled merila, dok se izjednačenje ne razreši/)

    for (const [board, ladder] of rows) {
      expect(article, `the ladder of ${board}`).toContain(`| ${board} | ${ladder} |`)
    }
  })

  it('asks the result form for what Član 37 says a picture changes', () => {
    /* Owner, 22.08.2026: „Ukoliko podignete sliku, link ka zvaničnim rezultatima
       postaje neobavezan, ali polje Komentar postaje obavezno."

       Held on the form the member actually meets and not only on a form built by
       hand in a test. Measured: the rule taken out of `unos-rezultata.form.json`
       left all 2028 tests green, and a member with a photograph of their watch
       and a comment still could not send the result while the hint under the
       field told them they could.

       The field each rule names is checked to be on the form as well, because a
       typo in it is silent: a rule pointing at nothing never fires. */
    const article = must(
      /### Član 37\.[\s\S]*?(?=### Član 38\.)/.exec(
        sectionOf('pravilnik', /Rezultat prijavljujete sami/),
      ),
      'Član 37 in its section',
    )[0]

    expect(article).toMatch(
      /Ukoliko podignete sliku, link ka zvaničnim rezultatima postaje neobavezan, ali polje Komentar postaje obavezno/,
    )

    /* And it says so of both ways in, since 23.08.2026. The article described the
       form on the event as a different thing for three weeks: „birate trku iz
       spiska", „link nije zasebno polje: ako ga imate, ide u komentar". The owner
       had that form given the same foot as the one on a profile, the rulebook was
       left as it was, and nothing here read it, because this guard knew one form.
       A member who did what Član 37 told them, and put the address into the
       comment, met „Ovo polje je obavezno." */
    expect(article).toMatch(/Vi unosite vreme, link ka zvaničnim rezultatima/)
    /* And it names what that form does **not** ask for, which the sentence before
       this one got wrong on the first try: „sve ostalo unosite isto kao sa profila"
       promised the name of the event and the date as well, and the form on the
       event asks for neither. */
    expect(article).toMatch(/naziv, datum, dužinu, uspon i spust portal uzima iz nje/)
    expect(article, 'Član 37 still sends the address into the comment').not.toMatch(
      /link nije zasebno polje|ide u komentar/,
    )

    /* Read off the forms the member meets, field by field and not through a loop
       over a shape asserted into being: a rule nobody has written yet is simply
       absent from the type the JSON import gives, and asserting past that is
       asserting past the very thing this guard is for.

       The field each rule names is checked to be on the form as well, because a
       typo in it is silent: a rule pointing at nothing never fires.

       Both forms, and by name, so a rule taken off one of them fails here rather
       than quietly making the rulebook wrong about half the portal. */
    for (const [what, form] of [
      ['the result form', newResult],
      ['the form on the event', fromEvent],
    ] as const) {
      const named = new Set(form.fields.map((field) => field.name))
      const link = must(
        form.fields.find((one) => one.name === 'link'),
        `the link field of ${what}`,
      )
      const comment = must(
        form.fields.find((one) => one.name === 'comment'),
        `the comment field of ${what}`,
      )

      expect(must(link.optionalWhenFilled, `the link of ${what} carries no rule`).field).toBe(
        'photo',
      )
      expect(
        must(comment.requiredWhenFilled, `the comment of ${what} carries no rule`).field,
      ).toBe('photo')
      expect(named.has('photo'), `the rules of ${what} name a field it does not ask`).toBe(true)
    }
  })

  it('summarises in the terms only the measures the rulebook still knows', () => {
    /* The terms send the reader to the rulebook and then say „Ukratko:", so the
       summary answers to the article. The owner struck two of the five measures
       on 22.08.2026 (Član 69: opomena, diskvalifikacija, isključenje), and the
       summary went on offering the other two: a member reading the terms would
       have seen that the league may delete their results or suspend them for
       thirty days, out of a rulebook that no longer allows either.

       Held as an absence and not only as a presence, because that is the half
       that rots: a measure struck from the article leaves the summary passing. */
    /* The summary sentence and not the section it sits in, for the same reason
       the article below is taken out of its own: section 7 also speaks of
       comments, blocking and reporting, and „Brisanje neprikladnog komentara je
       moderacija" is a true sentence that the absence below would have called a
       measure. Measured. */
    const terms = must(
      /Ukratko: mere idu[^\n]*/.exec(sectionOf('uslovi-koriscenja', /Ukratko: mere idu/)),
      'the summary of the measures in the terms',
    )[0]
    /* The article and not the section it sits in. Read whole, the section also
       holds Član 70, which begins „Brišu se svi rezultati": the absence below
       would then be an absence of the wrong thing, and a measure put back into
       Član 69 would pass under cover of the article after it. */
    const article = must(
      /### Član 69\.[\s\S]*?(?=### Član 70\.)/.exec(
        sectionOf('pravilnik', /Za kršenje pravilnika članu se može izreći/),
      ),
      'Član 69 in its section',
    )[0]

    for (const measure of [/opomen/, /diskvalifikacij/, /isključenj/]) {
      expect(terms).toMatch(measure)
      expect(article).toMatch(measure)
    }

    for (const gone of [/brisanj/i, /suspenzij/i]) {
      expect(terms).not.toMatch(gone)
      expect(article).not.toMatch(gone)
    }
  })

  it('signs all three documents the same way, with the day they last changed', () => {
    /* Owner, 22.08.2026: „Potpis sa poslednjom izmenom identično kao na strani
       Uslovi korišćenja. Isto uradi i u Pravilniku... Svi datumi poslednjih
       izmena treba da budu 15.9."

       Three documents, one sign-off, and it was three different things before:
       the rulebook had no date at all, the policy put the date above the name
       and added the address of the site beside it, and only the terms were in
       the shape he asked for. Held together rather than one by one, because
       what he asked for is that they **match**: pinned separately, the next one
       to be reworded drifts and nothing says so. */
    for (const slug of ['pravilnik', 'uslovi-koriscenja', 'politika-privatnosti'] as const) {
      const sections = must(written[slug], slug).sections
      const last = must(sections[sections.length - 1], `the last section of ${slug}`).body

      /* The shape, and then the count. The pattern below is anchored only at the
         end of the text, and that is all it can be: the sign-off is the last thing
         in the document. So the same sign-off written twice one under the other
         satisfies it — the last one closes the string, the reader sees two and the
         pattern sees one. What catches that is the counting under it, and it is
         written out rather than folded into the pattern because the two questions
         are different: is it in the right shape, and is there one of it. */
      expect(last, `${slug} does not sign off the way the other two do`).toMatch(
        new RegExp(
          ['', '---', '', 'Sportsko udruženje BTL', 'Poslednja izmena: 15.09.2026.']
            .join(NEWLINE)
            .replaceAll('.', String.fromCharCode(92) + '.') + String.fromCharCode(36),
        ),
      )
      expect(
        last.match(/Sportsko udruženje BTL/g)?.length,
        `${slug} signs off more than once`,
      ).toBe(1)
      expect(
        last.match(/Poslednja izmena/g)?.length,
        `${slug} names the day it last changed more than once`,
      ).toBe(1)
    }
  })

  it('does not offer to name a safeguard, or a way to complain, any more', () => {
    /* Owner, 22.08.2026: both out of the privacy policy. The sentence offering to
       name, on request, which safeguard covers which processor, and the paragraph
       on complaining to the Commissioner, to another country's authority, and
       going to court.

       Held as an absence, which is the half that rots: deleted and unheld, the
       two come back the first time the policy is reworded and nobody learns of
       it. Two questions are asked about them, and the pair is the point, because
       each one alone was measured and found short.

       **Where each section stops.** Both passages stood at the foot of a section,
       which is where a deleted paragraph comes back, and a section held to the
       sentence it ends on ends on it in every wording: nothing can follow it at
       all. This is what marks on the wording cannot do. Written as marks alone
       until 23.08.2026, „Povereniku za zaštitu podataka o ličnosti" walked past
       „Povereniku za informacije" and „organu te zemlje koji nadzire zaštitu
       podataka" walked past „nadzornom organu", because a paragraph can always
       be said in one more wording than a guard has marks. It also holds the
       sentence that stays, so this cannot pass on a section somebody emptied.

       **And the words of the passages themselves, over the whole document.**
       Written as the section's end alone, for one day, and a second round measured
       that too: the offer to name a safeguard came back word for word in the middle
       of section 5, at the foot of section 4, and as a section of its own between 5
       and 6, and all three passed. The end of a section says nothing about the rest
       of the page.

       **What a mark is, said plainly, because three rounds were spent trying to
       make it something better.** It is a tripwire and not a proof. Any sentence
       that reuses one of these five phrases stops this file, whether it is the
       deleted passage coming back or a lawful sentence the policy is entitled to,
       and every one of the five has such a sentence. Measured on 23.08.2026:
       „povredu prijavljujemo Povereniku za informacije od javnog značaja i zaštitu
       podataka o ličnosti" is a breach reported to the authority, which the law
       requires and which reads in the dative exactly as a complaint does;
       „obaveze pojedinog pružaoca usluge su uređene ugovorom o obradi" offers
       nobody anything; „povredu prijavljujemo nadzornom organu" is the same duty
       under the general name. Grammar does not separate them and no narrowing did:
       `Povereniku za informacije` was tried against `poverenik` and bought nothing
       but a miss, since the same name in the nominative then walked past.

       So the tripwire stays wide, and whoever it stops is meant to come here and
       say which of the two they are writing. That is the whole design: the two
       passages were deleted by a decision, and a sentence made of their words is
       either that decision being undone or a new one that ought to be recorded.

       `sudsku zaštitu` and not `sud` is the one narrowing that was kept, and for a
       different reason: `sud` is a syllable of ordinary words rather than a phrase
       of the passage. Measured, a sentence the policy could easily gain, „podatke
       dajemo samo po nalogu suda ili po drugom zahtevu zasnovanom na zakonu", fails
       on the syllable and passes on the phrase. `nadzor` is not a mark at all, for
       the same reason: section 7 says „obaveštavamo vas i nadzorni organ" today.

       **Three limits, said out loud rather than left to be discovered.**

       One: a **reworded** passage put in the middle of a section, its own included.
       The marks catch it word for word anywhere; the section end catches any
       wording after the last sentence of these two; a rewording above that sentence
       goes past both. Nothing shorter than pinning the whole document catches that.

       Two: the count under `endsOn` compares strings, so two copies of the anchor
       that differ by an invisible character are not two. Measured with a
       non-breaking space between „propisane" and „mehanizme": the reader sees the
       sentence twice and this sees it once.

       Three, and it is outside this repository: the draft both passages were cut
       from still holds them, word for word, in `btl-produkt/pravni/`. PDL says a
       name can come back onto the portal from there, and no test can see that file.
       It is written in PENDING instead. */
    const endsOn = (sentence: string, named: string) => {
      /* Found by the whole sentence it ends on, minus the full stop, which is the
         only character in either of them a regular expression would read as
         something else.

         The whole sentence and not a phrase out of it, because `oneSectionOf`
         refuses an anchor two sections share and a phrase is easy to share: „za
         obrađivače van Evropske unije primenjujemo propisane mehanizme zaštite iz
         sekcije 5", written anywhere in the policy as an ordinary cross
         reference, would have stopped this file with three words in common. The
         whole sentence is one section's own. */
      const section = oneSectionOf('politika-privatnosti', new RegExp(sentence.slice(0, -1)))

      expect(
        section.trimEnd().endsWith(sentence),
        `the policy carries on after "${sentence}", so ${named}`,
      ).toBe(true)
      /* And it is the end because it is said once. Ending on it is not the same
         claim: a paragraph written in and the sentence repeated under it ends on
         the sentence just as truly, and the whole of the deleted offer stood
         between the two. Measured on 23.08.2026, that passed. The count is the
         same shape the sign-off two tests above is held in, and for the same
         reason. */
      expect(
        section.split(sentence).length - 1,
        `the policy says "${sentence}" more than once, so what stands between them is unheld`,
      ).toBe(1)
    }

    endsOn(
      'Za prenos van Evropske unije koristimo propisane mehanizme zaštite.',
      'it may be offering to name a safeguard once more',
    )
    endsOn(
      'Prvo nam pišite, jer se većina stvari reši u jednoj poruci.',
      'it may be offering a way to complain once more',
    )

    for (const gone of [
      /pojedinog pružaoca/i,
      /poverenik/i,
      /azop/i,
      /sudsku zaštitu/i,
      /nadzornom organu/i,
    ]) {
      expect(
        whole('politika-privatnosti'),
        `the policy carries ${String(gone)} again`,
      ).not.toMatch(gone)
    }
  })

  it('says who pays the postage in both documents that promise the parcel', () => {
    /* Owner, 22.08.2026, on the fourth reading: „Poštanske troškove snosi Član."
       He put it in Član 64, and the terms carry the same promise in their own
       section on prizes; asked, he said it belongs in both.

       One fact with two homes, which is the shape that goes stale: the rulebook
       and the terms said the shirt and the medal are sent together long before
       today, and only one of the two learnt who pays for the sending. Held here
       so neither home can lose it alone. */
    const sentence = /Poštanske troškove snosi Član\./

    expect(sectionOf('pravilnik', /Pehari se preuzimaju lično/)).toMatch(sentence)
    expect(sectionOf('uslovi-koriscenja', /Pehare ne šaljemo poštom/)).toMatch(sentence)
  })

  it('quotes the processing fee as the number the portal charges, in its one home', () => {
    /* A written document carried the three euro as a typed number while every
       screen reads it from `pricing.ts`. Changing the constant would have left
       the document a member can hold us to saying the old amount.

       That home was the terms of use until 22.08.2026, in two places. The owner
       struck both — the fee is the rulebook's business, and the rulebook says it
       under the article on the price. So the guard follows the sentence to where
       it now lives, and holds that it lives in one place: two homes for one
       number is how the drift started. */
    const carrying = Object.entries(WRITTEN).filter(([, page]) =>
      page.sections.some((section) => /taksa za obradu plaćanja/.test(section.body)),
    )

    expect(carrying.map(([slug]) => slug)).toEqual(['pravilnik'])
    expect(sectionOf('pravilnik', /taksa za obradu plaćanja/)).toMatch(
      new RegExp(`taksa za obradu plaćanja od ${PROCESSING_FEE_EUR} EUR`),
    )
  })

  it('says nowhere that the formula is a secret', () => {
    /* It never was one: the calculator on the front page has computed it in the
       browser since the day it arrived (owner, 03.08.2026, PDL P11). */
    /* Every page that names the formula at all, not two of them: the terms name
       it as well ("po sopstvenoj formuli"), and P11 says nowhere.

       Matched against the formula rather than against the words on their own.
       "Ne objavljuje" is an ordinary Serbian phrase, and forbidding it outright
       would fail on a sentence about an internal note that has nothing to do
       with scoring. */
    for (const slug of ['pravilnik', 'uslovi-koriscenja'] as const) {
      expect(whole(slug)).not.toMatch(/formul\w*[^.]{0,60}(ne objavljuje|tajn)/i)
      expect(whole(slug)).not.toMatch(/(ne objavljuje|tajn)\w*[^.]{0,60}formul/i)
    }
  })

  it('describes the telephone as the optional thing the form asks for', () => {
    /* Obligatory on 01.08.2026, optional on 03.08, gone on 11.08, and back as
       something optional on 20.08. A policy that describes the handling of a
       number nobody is asked for describes somebody else's portal; so does one
       that is silent about a field the form has. The ground has to be consent,
       because a field nobody has to fill cannot be necessary for the contract. */
    /* The ground read out of the table rather than counted in columns. Written as a
       pattern that steps over exactly two cells, this was the last place holding the
       position of that column by hand, and a column inserted before it broke a test named
       after the telephone while the document was right. */
    const rows = new Map(
      collectedRows()
        .split('###')
        .flatMap(tablesOf)
        .flatMap((table) => {
          const ground = table.head.indexOf('Pravni osnov')

          return table.rows.map((cells) => [String(cells[1] ?? ''), String(cells[ground] ?? '')])
        }),
    )

    expect([...rows.keys()], 'the policy says nothing about the telephone').toContain(
      'Telefon, neobavezno',
    )
    expect(rows.get('Telefon, neobavezno')).toMatch(/[Pp]ristanak/)

    /* And nowhere else: the terms and the rulebook are about the league, not
       about the fields of one form. */
    for (const slug of ['uslovi-koriscenja', 'pravilnik'] as const) {
      expect(whole(slug)).not.toMatch(/telefon/i)
    }
  })
})

describe('which document a numbered reference belongs to', () => {
  /* The five limits recorded on 22.08.2026. Two of them are closed here, two stay
     open on purpose with the measurement that kept them open, and the fifth is the
     message under this block.

     Asked of the reader itself and not through the content, and that is a
     limitation rather than a choice: a sentence added to a page to try one of
     these is either **accepted** by the reader, and then it fails on the pinning
     of references before it proves anything, or **refused** by it, and then it
     passes in silence, which is the very fault being measured. The content cannot
     tell the two apart; the reader can. */
  it('refuses to choose wherever the rulebook is one of two names', () => {
    /* Three rules were tried before this one and all three were measured wrong
       within a day. Ahead-first sent „Prema Pravilniku lige Član 99 u smislu
       zakona" to the law, and Član 99 does not exist. Nearer-wins sent „U skladu sa
       zakonom, Član 74 opšteg pravilnika lige" to the law just as quietly.
       Nearest-within-a-side survived that correction by accident and did the same
       to „po pravilniku i zakonu, Član 74", where both names stand on one side.
       Every such rule is a guess, and a wrong guess is silent. */
    expect(documentOf('Prema Pravilniku lige', ' u smislu zakona')).toBe(AMBIGUOUS)
    expect(documentOf('U skladu sa zakonom,', ' opšteg pravilnika lige')).toBe(AMBIGUOUS)
    /* Both names on one side, in either order. */
    expect(documentOf('po pravilniku i zakonu,', ' se primenjuje')).toBe(AMBIGUOUS)
    expect(documentOf('iz', ' Zakona i Pravilnika lige')).toBe(AMBIGUOUS)
  })

  it('skips a reference of two other documents rather than stopping the file', () => {
    /* „Prijem u članstvo vrši se u skladu sa Statutom i Članom 12 Zakona o sportu."
       names two documents and neither is ours. There is nothing here for this guard
       to be wrong about, so it is skipped exactly as a reference to one other
       document is (ADL A20). Failing on it would be a guard that stops the file over
       a sentence it has no business reading.

       Held as „it names one of those two" and not as „it is not ambiguous", which is
       what this said for one day: the empty string satisfies every denial, and the
       empty string is the one answer that does **not** skip. Where a reference names
       nothing at all, a page other than the rulebook fails, which is the whole of
       ADL A20's rule about a bare number. Measured: `return '' `in place of the name
       left this test green and took the skipping away. */
    expect(['statut', 'zakon']).toContain(documentOf('u skladu sa Statutom i', ' Zakona o sportu'))
  })

  it('answers plainly where only one side names one', () => {
    expect(documentOf('iz', ' Pravilnika lige')).toBe('pravilnik')
    expect(documentOf('Prema Pravilniku lige', ' stoji ovo')).toBe('pravilnik')
    /* And the same word on both sides is one document, not two. */
    expect(documentOf('po pravilniku', ' pravilnika')).toBe('pravilnik')
  })

  it('says nothing where neither side names one', () => {
    expect(documentOf('Prema', ' postupa se dalje')).toBe('')
  })

  it('does not read an adjective as a document', () => {
    /* „Saglasnost zakonskog zastupnika iz Člana 12 Pravilnika lige" names one
       document and says so plainly. Read as substrings, „zakonskog" counted as the
       law, the sentence looked like a sentence naming two, and the file stopped with
       a message that said exactly that. „zakonski rok" already stands in the
       published privacy policy, so this is a word the portal writes. */
    expect(documentOf('Saglasnost zakonskog zastupnika iz', ' Pravilnika lige')).toBe('pravilnik')
    expect(documentOf('prema pravilniku,', ' nezakonito je')).toBe('pravilnik')
    /* And the document itself is still read in every case it is written in. */
    for (const said of [' Pravilnika', ' pravilniku', ' pravilnikom', ' Zakona', ' zakonom']) {
      expect(documentOf('iz', said), `${said} is not read as the document it names`).not.toBe('')
    }
  })

  it('still reads an enumeration as a reference that names nothing', () => {
    /* „Član 74 i Član 75 Pravilnika" names the document once, behind the last of
       them, so the first of the two sees three words that name nothing. Stepping
       over the rest of the list was tried on 23.08.2026 and taken back the same
       day: the pattern that finds a further reference also finds „članarina" and
       „članstvo", so it swallowed ordinary words and, worse, handed the first
       reference whatever document stood past them. Measured: with the step,
       „Uslovi iz Člana 67 i Člana 3 Zakona o sportu se primenjuju." left Član 67
       unchecked and the suite green.

       So the limit stays, and it fails loudly rather than quietly, which is the
       side to be on. */
    expect(documentOf('iz', ' i Član 75 Pravilnika')).toBe('')
  })
})

describe('what is read as a reference to an article', () => {
  it('is a number that follows the word, an age included', () => {
    /* „od člana 16 godina i mlađeg" is a sentence about a person and this reads it
       as Član 16, which is the fourth recorded limit. Refusing every number
       followed by „godin" was tried on 23.08.2026 and measured worse: „Zapis iz
       Člana 74 godinu dana ostaje dostupan" is an ordinary reference and went
       invisible. A false alarm is a sentence somebody rewrites; a reference nobody
       looks at is an article that quietly stops existing. */
    expect([...'od člana 16 godina i mlađeg'.matchAll(ARTICLE)].map((one) => one[1])).toEqual([
      '16',
    ])
    expect([...'Zapis iz Člana 74 godinu dana'.matchAll(ARTICLE)].map((one) => one[1])).toEqual([
      '74',
    ])
  })
})

describe('what is read as a row of a table', () => {
  /** A block with one whole table in it and one line that opens a row and never
   *  closes it, which is the shape the fifth recorded limit was about. */
  const BROKEN = [
    '| Ko | Šta |',
    '|---|---|',
    '| Hetzner | Smeštaj |',
    '',
    '| Sekcija 5 kaže ovo i nikad se ne zatvori',
  ].join(NEWLINE)

  it('is a line that closes as well as opens', () => {
    expect(isTableRow('| Dok ste član | Čuvamo dok traje članstvo |')).toBe(true)
    expect(isTableRow('| Dok ste član | Čuvamo dok traje članstvo')).toBe(false)
    expect(isTableRow('Rečenica o sekciji 5.')).toBe(false)
    /* A lone pipe is not a row either, which is what the whole match is for. */
    expect(isTableRow('|')).toBe(false)
  })

  it('is asked in one place, and nowhere else asks it for itself', () => {
    /* The two readers share a question, and sharing it is the fix rather than the
       fact: either of them can stop asking it, and a round measured exactly that on
       23.08.2026, putting the old inline filter back at the place the sections are
       read and leaving the file green.

       So a sweep, in the shape `app/filterParams.test.ts` uses for its own one hook:
       the list of files that ask it for themselves, held against an empty list. Not
       a count of matches, which is what this was for one day and what a second round
       took apart: a count is a number written by hand, and it counted a sentence of
       prose in the renderer's own comment while the import it claimed to be counting
       gave no match at all. Rewording that comment failed the file, and deleting the
       import did not.

       Comments are blanked before the question is asked, because a rule described in
       prose is not a rule (`styles/scale.test.ts` keeps the same rule over CSS).

       `Markdown.tsx` is where the pattern lives and is therefore not an offender;
       everything else, this file included, must import it. */
    const HOME = join('components', 'Markdown.tsx')
    const asks = /startsWith\('\|'\)|\/\^\\\|/
    const mine = {
      path: join('pages', 'writtenPages.test.tsx'),
      code: readFileSync(join(process.cwd(), 'src/pages/writtenPages.test.tsx'), 'utf-8'),
    }
    const everywhere = [...sources(), mine]

    /* The sweep is not empty and does reach the file the pattern lives in, so an
       empty answer below is an answer and not a search that found nothing. */
    expect(everywhere.length).toBeGreaterThan(80)
    expect(everywhere.some(({ path }) => path.endsWith(HOME))).toBe(true)

    const elsewhere = everywhere
      .filter(({ path }) => !path.endsWith(HOME))
      .filter(({ code }) => asks.test(unwritten(code)))

    expect(elsewhere.map(({ path }) => path)).toEqual([])
  })

  it('is answered the same way by both readers, so nothing falls between them', () => {
    /* The fifth recorded limit, and the whole of it: the table reader asked „does
       it begin and end with a pipe" and the reader of prose asked „does it begin
       with a pipe", so a row missing its closing pipe was not a row to one and not
       prose to the other, and no guard on this portal ever read it. A reader sees
       it as an ordinary paragraph, because the renderer draws it as one.

       Held on both readers rather than on the question they share, because sharing
       a question is the fix and not the fact: either of them can stop asking it,
       and until 23.08.2026 one of them had. */
    const tables = tablesOf(BROKEN)

    expect(tables).toHaveLength(1)
    expect(tables[0]?.rows).toHaveLength(1)

    expect(proseOf(BROKEN), 'the broken row is read by nobody').toContain('Sekcija 5 kaže ovo')
    expect(proseOf(BROKEN), 'a whole row was read as prose').not.toContain('Hetzner')
  })
})
