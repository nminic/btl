import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { JUNIOR, PRICES, type PriceRow } from '../data/pricing'
import { I18nProvider } from '../i18n/I18nProvider'
import written from '../../public/mock/pages.json'
import sr from '../i18n/sr.json'
import { translate, type Dictionary } from '../i18n/translate'
import { SessionProvider } from '../session/SessionProvider'
import { renderAt } from '../test/render'
import { StaticPage } from './StaticPage'

const dictionary = sr as Dictionary

/** The price band under that name, out of the list the screens read.
 *
 *  By name and not by position: the prose in the terms names the cheapest band,
 *  the one after it and the one after that, and it goes on meaning those three
 *  whatever order pricing.ts happens to list them in. A name the list does not
 *  carry is a change in pricing.ts this prose has to follow, so it stops here
 *  rather than turning into "undefined EUR" inside a text the page never had. */
function band(key: string): PriceRow {
  const found = PRICES.find((price) => price.key === key)

  if (found === undefined) {
    throw new Error(`the price list carries no band called "${key}"`)
  }

  return found
}

describe('the written pages', () => {
  it.each([
    ['/sr/o-ligi', 'O ligi'],
    ['/sr/pravilnik', 'Pravilnik takmičenja BTL 2027'],
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

/* The fee schedule exists twice in the portal: as data in pricing.ts, which the
 * screens read, and as prose in the terms, which is written by hand. Nothing
 * tied the two together, so the prose drifted a whole price band behind the
 * data and no build failed. These tests are that tie. */
describe('the fee schedule in the terms', () => {
  /* Each claim is pinned to the paragraph that has to carry it. Pinning them to
   * the section instead lets one paragraph satisfy an assertion about another:
   * the row "1. do 5. oktobra" alone was enough to hide a deleted reminder. */
  async function feeParagraph(matching: RegExp) {
    const heading = await screen.findByRole('heading', { name: /Članarina/ })
    const section = heading.closest('section')

    if (section === null) {
      throw new Error('the fee heading stands outside a section')
    }

    return within(section).getByText(matching)
  }

  /** The price table, one string per row of cells. Written pages render their
   *  Markdown as a real table (src/components/Markdown.tsx), so this reads the
   *  rows a screen reader would, not the pipes the source is written in. The
   *  header row has no cells, only column headers, so it falls out by itself. */
  async function priceTableRows() {
    const heading = await screen.findByRole('heading', { name: /Članarina/ })
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

  it('holds the price bands in the order the table prints them', () => {
    /* Looking a band up by name is what makes the test above readable, and it is
       also what stopped it noticing a reordering: before the lookup, the rows
       were compared in order, so moving `late` above `regular` failed. The order
       is a fact about the membership table on /sr/clanarina, so it is asserted
       on its own. */
    expect(PRICES.map((price) => price.key)).toEqual(['early', 'regular', 'late', 'season'])
  })

  it('quotes every price band that pricing.ts holds, by its own name', async () => {
    renderAt('/sr/uslovi-koriscenja')
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
      expect(row).toContain(`${price.eur} EUR`)
      expect(row).toContain(`${price.rsd.toLocaleString('sr-Latn')} RSD`)
    }
  })

  it('quotes the junior price', async () => {
    renderAt('/sr/uslovi-koriscenja')
    const rows = await priceTableRows()
    const row = rows.find((line) => line.includes(`${JUNIOR.eur} EUR`))

    expect(row, `no row of the table quotes ${JUNIOR.eur} EUR`).toBeDefined()
    expect(row).toContain(`${JUNIOR.rsd.toLocaleString('sr-Latn')} RSD`)
  })

  it('names one reminder per price boundary', async () => {
    renderAt('/sr/uslovi-koriscenja')
    const reminders = await feeParagraph(/Podsetnike da vam ističe članarina/)
    const early = band('early')
    const regular = band('regular')
    const late = band('late')

    // Four dates, each the last day of something (PDL P8). Three of them end a
    // price band; the fourth is the last day that still buys a ranking.
    for (const date of ['30. septembra', '5. oktobra', '30. novembra', '30. decembra']) {
      expect(reminders).toHaveTextContent(date)
    }

    // The prices the reminders quote come from the same rows the table quotes.
    expect(reminders).toHaveTextContent('šaljemo četiri puta')
    expect(reminders).toHaveTextContent(`najnižoj ceni od ${early.eur} EUR`)
    expect(reminders).toHaveTextContent(
      `poslednji dan po ${early.eur} EUR, od sutra je ${regular.eur} EUR`,
    )
    expect(reminders).toHaveTextContent(
      `poslednji dan po ${regular.eur} EUR, od sutra je ${late.eur} EUR`,
    )
    expect(reminders).toHaveTextContent('poslednji dan sa pravom na rangiranje')
  })
})

describe('the privacy policy', () => {
  it('names what is public and what never is', async () => {
    renderAt('/sr/politika-privatnosti')

    const page = await screen.findByRole('article')
    expect(within(page).getByRole('heading', { name: /javno, a šta nikada nije/ })).toBeVisible()
    expect(within(page).getByRole('heading', { name: /Maloletni članovi/ })).toBeVisible()
  })
})

describe('the page that says what membership costs', () => {
  it('marks the row a reader is being asked to pay today', async () => {
    /* PDL P28a put this page second under "O ligi" because it is the one that
       leads to joining. It had five rows and five notes and left the reader to
       work out which row was theirs. */
    renderAt('/sr/clanarina', 'visitor', null, undefined, '2026-10-03')

    const table = await screen.findByRole('table')
    /* Found by what it says rather than by what it is called: the badge is the
       thing the reader sees, and a class name is not. */
    const marked = within(table)
      .getAllByRole('row')
      .filter((row) => row.textContent?.includes('važi danas'))

    expect(marked).toHaveLength(1)
    expect(marked[0]).toHaveTextContent('1. do 5. oktobra')
  })

  it('leads to joining once joining is open, and says when otherwise', async () => {
    renderAt('/sr/clanarina', 'visitor', null, undefined, '2026-10-03')

    const page = within(await screen.findByRole('main'))

    // The header carries one too, so this asks the page itself.
    expect(page.getByRole('link', { name: 'Učlani se' })).toHaveAttribute(
      'href',
      '/sr/registracija',
    )
  })

  it('says when it opens while it is still shut', async () => {
    renderAt('/sr/clanarina', 'visitor', null, undefined, '2026-09-20')

    const page = within(await screen.findByRole('main'))

    expect(page.queryByRole('link', { name: 'Učlani se' })).not.toBeInTheDocument()
    /* One sentence, not two glued together: the two of them wrote the date's
       full stop and the dictionary's one after another and announced the
       opening twice. */
    expect(page.getByText(/^Učlanjenje se otvara .*, za \d+ dana\.$/)).toBeVisible()
  })
})

const NEWLINE = String.fromCharCode(10)

describe('how a written page is set', () => {
  const pages = Object.entries(written as Record<string, { sections: { heading: string; body: string }[] }>)

  it('reads every written page there is', () => {
    /* Without this the two below pass on an empty list. */
    expect(pages.length).toBeGreaterThan(4)
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

/** The whole of one written page, as one piece of text. */
function whole(slug: 'uslovi-koriscenja' | 'pravilnik' | 'o-ligi' | 'politika-privatnosti'): string {
  return written[slug].sections.map((section) => section.body).join(`\n`)
}

/** The one section of a page that says something, by what it says. */
function sectionOf(
  slug: 'uslovi-koriscenja' | 'pravilnik' | 'o-ligi' | 'politika-privatnosti',
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
   *
     Read off the disc, because this is about what is written rather than about
     what a screen does with it. */
  it('says membership is what gives the right to compete', () => {
    expect(sectionOf('uslovi-koriscenja', /pravo takmičenja/)).toMatch(
      /ne plaća za pristup sajtu nego za članstvo u ligi/,
    )
  })

  it('never offers the league to somebody who has not paid', () => {
    /* The one thing that would make the model untrue on the page. */
    for (const slug of ['uslovi-koriscenja', 'pravilnik', 'o-ligi'] as const) {
      expect(whole(slug)).not.toMatch(/bez članarine|besplatn/i)
    }
  })

  it('says nowhere that the formula is a secret', () => {
    /* It never was one: the calculator on the front page has computed it in the
       browser since the day it arrived (owner, 03.08.2026, PDL P11). */
    for (const slug of ['pravilnik', 'o-ligi'] as const) {
      expect(whole(slug)).not.toMatch(/ne objavljuje|tajn/i)
    }
  })

  it('carries the telephone as optional, on consent', () => {
    /* Back to optional on 03.08.2026, which is what lets it stand on consent:
       consent has to be free, and it is not free if membership is impossible
       without it. */
    expect(sectionOf('politika-privatnosti', /Broj telefona/)).toMatch(
      /Broj telefona \(neobavezno\).*Vaš pristanak/,
    )
  })
})
