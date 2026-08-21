import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { THEME_STORAGE_KEY } from '../app/themeContext'
import { JUNIOR, PRICES, PROCESSING_FEE_EUR } from '../data/pricing'
import { money } from '../i18n/format'
import { I18nProvider } from '../i18n/I18nProvider'
import registration from '../forms/definitions/registracija.form.json'
import written from '../../public/mock/pages.json'
import sr from '../i18n/sr.json'
import { translate } from '../i18n/translate'
import { SessionProvider } from '../session/SessionProvider'
import { renderAt } from '../test/render'
import { must } from '../test/at'
import { sources } from '../test/sources'
import { StaticPage } from './StaticPage'

const dictionary = sr

/* The written pages as the portal itself reads them. Annotated and not asserted:
   an annotation is a claim the compiler has to agree with, and this one holds
   the file to the type every screen reads it through (ADL A14). */
const WRITTEN: Record<string, { title: string; sections: { heading: string; body: string }[] }> =
  written

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

  /**
   * One table of the policy, read as a table: its header, and the rows under it.
   *
   * Walking a joined text and looking upward for the nearest line of dashes answered with
   * the header of the table *above* the line whenever the line was itself a header, so a
   * column added to one of the two tables and not the other was reported as a row that is
   * too narrow while the document was right. Read one table at a time, that question
   * cannot be asked of the wrong table.
   *
   * A table with no line of dashes is a fault and not a table with no header: without
   * one, its header row went into the list as a row a field may name, and an obligatory
   * personal field could then be declared published while the policy said nothing about
   * it. Measured.
   */
  function tableOf(block: string): { head: string[]; rows: string[][] } {
    /* Both ends, the way the portal matches a row (`Markdown.tsx`, `^\|.*\|$`). Only the
       first was asked for, so a line of prose beginning with a pipe read as a broken row
       while the portal drew it as a paragraph. */
    const lines = block
      .split(NEWLINE)
      .map((one) => one.trim())
      .filter((one) => one.startsWith('|') && one.endsWith('|'))
    const cellsOf = (line: string) => line.split('|').map((cell) => cell.trim())
    const dashes = lines.findIndex((one) =>
      cellsOf(one)
        .slice(1, -1)
        .every((cell) => /^:?-{2,}:?$/.test(cell)),
    )

    expect(dashes, `a table of the policy has no line of dashes: ${lines[0] ?? '(empty)'}`).toBeGreaterThan(0)

    return {
      head: cellsOf(String(lines[dashes - 1])),
      rows: lines.slice(dashes + 1).map(cellsOf),
    }
  }

  /** The one section that says what the portal collects, which both guards below read. */
  const collectedRows = () => sectionOf('politika-privatnosti', /Podaci koje unosite pri učlanjenju/)

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

    for (const block of about) {
      const table = tableOf(block)
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
    const kept = sectionOf('politika-privatnosti', /Nalog nikad nije aktiviran/)
    const said = /Nalog nikad nije aktiviran \| (\d+) (dana|meseci|godine)/.exec(kept)

    expect(said, 'the policy does not say how long an unactivated account is kept').not.toBeNull()

    const amount = Number(must(said, 'what the policy says')[1])
    const unit = must(said, 'what the policy says')[2]
    const months = unit === 'dana' ? amount / 30 : unit === 'godine' ? amount * 12 : amount

    expect(
      months,
      `${amount} ${unit} is shorter than the ${sellingYear} months the account was opened to buy`,
    ).toBeGreaterThanOrEqual(sellingYear)

    const asMember = /Prestanete da budete član \| Pet godina/.test(kept)

    expect(asMember, 'the policy no longer says how long a former member is kept').toBe(true)
    expect(
      months,
      'an account that never became a membership is held longer than one that did',
    ).toBeLessThanOrEqual(5 * 12)
  })
})

/* The page that said what membership costs was deleted on 04.08.2026, together
 * with the story of the league: "O ligi i Članarina se brišu" (owner). What a
 * member is charged is on the screen of their own membership and in the terms,
 * and both are held to `pricing.ts` above and below this line.
 */

const NEWLINE = String.fromCharCode(10)

describe('the rulebook', () => {
  /** The whole of it as one piece of text, which is how a rule that has to be in
   *  it is looked for: an article moved from one section to another is still in
   *  the rulebook. */
  const rulebook = WRITTEN['pravilnik']
    ?.sections.map((section) => section.body)
    .join(NEWLINE)

  it('numbers its articles from one, with nothing missing in between', () => {
    /* An article was taken out of the middle of it (the terrain profile, owner
       03.08.2026), so everything after it moved up by one. A rulebook that
       skips a number is a rulebook whose cross-references cannot be trusted,
       and it carries eight of them. */
    const numbers = [...(rulebook ?? '').matchAll(/### Član (\d+)\./g)].map((found) =>
      Number(found[1]),
    )

    expect(numbers.length).toBeGreaterThan(80)
    expect(numbers).toEqual(numbers.map((_, index) => index + 1))
  })

  it('points every cross-reference at the article it means, not merely at one that exists', () => {
    /* Checking that a number is in range proves nothing here: taking an article
       out of the middle moves everything after it down by one, so a stale
       reference lands on a real article and says the wrong thing. What is
       checked is what each reference is about, against the heading of the
       article it lands on.

       The headings are the pin. A reference that has to move and does not
       arrives at an article about something else, and the pair stops matching. */
    const expected: [number, RegExp][] = [
      [11, /Pravo rangiranja/],
      [14, /Cena i rokovi/],
      [17, /Šta članstvo donosi/],
      /* Where the climb comes from, pointed at by the article that says the
         values are typed rather than read out of a track file (16.08.2026). */
      [31, /Uspon i spust/],
      [41, /Ko prijavljuje i šta/],
      [42, /^Rok$/],
      [55, /Top liste/],
      [69, /Posebna priznanja/],
      /* The section that draws the wall of ducats points at the article that
         awards them (owner, 04.08.2026): the section describes, the article
         rules, and the reader has to be able to get from one to the other. */
      [72, /Dukati/],
      [79, /Postupak/],
    ]

    const titles = new Map(
      [...(rulebook ?? '').matchAll(/### Član (\d+)\. ([^\n]+)/g)].map((found) => [
        Number(found[1]),
        String(found[2]).trim(),
      ]),
    )
    /* The headings themselves are not references to anything, so they are taken
       out before the references are read; left in, every article counted as a
       reference to itself and the count below could never fail. */
    /* Read whichever way the letter is written, and this is not a nicety.
       Written „(član 31)" with a small letter, a reference was invisible to this
       guard while looking exactly like every other one to a reader, so it went
       into the rulebook on 16.08.2026 without ever being checked. A guard that a
       lower-case letter walks past is a guard on the spelling. */
    const referenced = [
      ...(rulebook ?? '').replace(/### Član \d+\.[^\n]*/g, '').matchAll(/[Čč]lan[a-zA-Z]* (\d+)/g),
    ].map((found) => Number(found[1]))

    /* Every article referred to, each once, since two paragraphs point at the
       right to be ranked. A reference to an article nobody expected fails here
       before it reaches the headings below. */
    expect([...new Set(referenced)].sort((left, right) => left - right)).toEqual(
      expected.map(([number]) => number).sort((left, right) => left - right),
    )
    expect(referenced.length).toBeGreaterThanOrEqual(expected.length)

    for (const [number, heading] of expected) {
      expect(titles.get(number), `Član ${number} ne postoji`).toMatch(heading)
    }
  })

  it('does not carry the terrain profile any more', () => {
    /* Owner, 03.08.2026: „ne pratiti uopšte profil staze nigde na portalu".
       It was a table of four bands read off the climb per kilometre. */
    expect(rulebook).not.toMatch(/[Pp]rofil staze/)
    expect(rulebook).not.toMatch(/Talasasto|Brdovito|Planinsko/)
  })

  it('says when a race counts, in three conditions and one discretion', () => {
    /* The open question PDL P17 called the most damaging hole in the old
       league, closed by the owner on 03.08.2026. Read together: all three, and
       the league may still take a race that misses one of them. */
    expect(rulebook).toMatch(/najkasnije mesec dana pre dana održavanja/)
    expect(rulebook).toMatch(/Zvanični rezultati su objavljeni posle trke/)
    expect(rulebook).toMatch(/Na događaju je učestvovalo najmanje 50 učesnika/)
    /* Counted over the event rather than the race (owner, 04.08.2026): three
       races of twenty runners is an event of sixty, and a trail event splits
       its field across distances by definition. */
    expect(rulebook).toMatch(/meri na nivou događaja, a ne po pojedinačnoj trci/)
    expect(rulebook).toMatch(/zadržava pravo da prizna i trku koja ne ispunjava jedan/)
  })

  it('knows a member freed of the fee, and says the fee from abroad is not membership', () => {
    expect(rulebook).toMatch(/oslobodi plaćanja članarine/)
    /* Membership is measured by activation, and the deadline for the right to
       be ranked is measured by the day of payment. Two questions, and they read
       as a contradiction unless each says which one it answers. */
    expect(rulebook).toMatch(
      /meri se aktiviranim statusom na portalu: član oslobođen članarine nikad nema uplatu/,
    )
    expect(rulebook).toMatch(/Rok se meri po danu uplate, a ne po danu kada je liga uplatu/)
    expect(rulebook).toMatch(new RegExp(`taksa za obradu plaćanja od ${PROCESSING_FEE_EUR} EUR`))
    expect(rulebook).toMatch(/nije deo članarine/)
  })

  it('keeps a first season member in one category and only one', () => {
    /* Owner, 03.08.2026: no crossing into the age band mid-year and no running
       in both at once. It closed the one question the article had left open. */
    expect(rulebook).toMatch(/ne konkuriše u generalnom plasmanu i ne konkuriše u uzrasnoj kategoriji/)
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
       figure is for what is not a standing. Član 69 lists the pair among the
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
    expect(rulebook).toMatch(/### Član 64\. Liga kao pojam/)
  })

  it('cannot be changed inside a season', () => {
    /* The last of the blanks the rulebook was carrying, answered by the owner on
       04.08.2026: the article that asked the question is gone and the answer is
       one sentence in the article about writing a new one each season. */
    expect(rulebook).toMatch(/U toku sezone se ne menja\./)
    expect(rulebook).not.toMatch(/Izmene u toku sezone/)
  })

  it('asks for the same result the forms ask for', () => {
    /* The picture and the comment, both optional, on the article that lists what
       a competitor sends in (owner, 03.08.2026). The forms are held to the same
       thing in src/forms/definitions.test.ts. */
    expect(rulebook).toMatch(/Sliku, neobavezno/)
    expect(rulebook).toMatch(/Komentar, neobavezno/)
    expect(rulebook).toMatch(/Slika je neobavezna dopuna, nikad zamena za link/)
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
       the awards clause after the first section went. */
    for (const [slug, page] of pages) {
      const numbered = new Map(
        page.sections
          .map((section) => /^(\d+)\. (.*)$/.exec(section.heading))
          .filter((found): found is RegExpExecArray => found !== null)
          .map((found) => [Number(found[1]), found[2] ?? '']),
      )

      for (const section of page.sections) {
        for (const found of section.body.matchAll(/sekcij\w+ (\d+)/g)) {
          expect(
            numbered.has(Number(found[1])),
            `${slug} names section ${found[1]}, which it does not have`,
          ).toBe(true)
        }
      }
    }
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
           file and this test has no say in what it looks like. */
        const gives = new RegExp(`${escaped(handed)}\\s*=\\s*['"\`](.*?)['"\`]`, 'g')
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

  it('quotes the processing fee in the terms as the number the portal charges', () => {
    /* The terms are the binding document for the fee, and they carried the
       three euro as a typed number while every screen reads it from
       `pricing.ts`. Changing the constant would have left the one document a
       member can hold us to saying the old amount. */
    const terms = sectionOf('uslovi-koriscenja', /taksa za obradu plaćanja/)

    expect(terms).toMatch(new RegExp(`taksa za obradu plaćanja od ${PROCESSING_FEE_EUR} EUR`))
    expect(sectionOf('uslovi-koriscenja', /prema udruženju/)).toMatch(
      new RegExp(`taksu za obradu plaćanja od ${PROCESSING_FEE_EUR} EUR`),
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
    expect(whole('politika-privatnosti')).toMatch(/Telefon, neobavezno/)
    expect(whole('politika-privatnosti')).toMatch(/Telefon, neobavezno \|[^|]*\|[^|]*[Pp]ristanak/)

    /* And nowhere else: the terms and the rulebook are about the league, not
       about the fields of one form. */
    for (const slug of ['uslovi-koriscenja', 'pravilnik'] as const) {
      expect(whole(slug)).not.toMatch(/telefon/i)
    }
  })
})
