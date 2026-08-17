import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { JUNIOR, PRICES, PROCESSING_FEE_EUR } from '../data/pricing'
import { I18nProvider } from '../i18n/I18nProvider'
import written from '../../public/mock/pages.json'
import sr from '../i18n/sr.json'
import { translate } from '../i18n/translate'
import { SessionProvider } from '../session/SessionProvider'
import { renderAt } from '../test/render'
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
    const meant = [{ from: 'diskvalifikacijom', to: 'Pravila ponašanja' }]
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

  it('names what is public and what never is', async () => {
    renderAt('/sr/politika-privatnosti')

    const page = await screen.findByRole('article')
    expect(within(page).getByRole('heading', { name: /javno, a šta nikada nije/ })).toBeVisible()
    expect(within(page).getByRole('heading', { name: /Maloletni članovi/ })).toBeVisible()
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
    const referenced = [
      ...(rulebook ?? '').replace(/### Član \d+\.[^\n]*/g, '').matchAll(/Član[a-z]* (\d+)/g),
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

  it('knows an honorary member, and says the fee from abroad is not membership', () => {
    expect(rulebook).toMatch(/počasno članstvo, bez plaćanja članarine/)
    /* Membership is measured by activation, and the deadline for the right to
       be ranked is measured by the day of payment. Two questions, and they read
       as a contradiction unless each says which one it answers. */
    expect(rulebook).toMatch(
      /meri se aktiviranim članstvom na portalu: počasni član nikad nema uplatu/,
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
    /* Without this the two below pass on an empty list. Four since 04.08.2026,
       when "O ligi" was deleted: the rulebook, the terms, the privacy policy and
       the address of the president. */
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

    /* Anything handed to `setItem`, whether spelt out or named by a constant. A
       constant is then looked up, so a key hidden behind a name is still found. */
    const keys = new Set<string>()

    for (const code of everywhere) {
      for (const found of code.matchAll(/localStorage\.setItem\(\s*([^,]+)/g)) {
        const handed = (found[1] ?? '').trim()
        const literal = /^['"`](.*)['"`]$/.exec(handed)

        if (literal !== null) {
          keys.add(literal[1] ?? '')
          continue
        }

        /* A constant: find where it is given its value, anywhere in the portal. */
        const gives = new RegExp(`${handed}\\s*=\\s*['"\`](.*?)['"\`]`, 'g')
        const named = everywhere
          .flatMap((one) => [...one.matchAll(gives)])
          .map((one) => one[1] ?? '')

        expect(named, `nothing in the portal gives ${handed} a value`).not.toEqual([])
        named.forEach((value) => keys.add(value))
      }
    }

    /* The sweep has to have found something, or the whole test passes over
       nothing (app/filterParams.test.ts holds its own sweep the same way). */
    expect(keys.size, 'no store was found at all, so nothing was compared').toBeGreaterThan(0)

    const policy = whole('politika-privatnosti')

    for (const key of keys) {
      expect(policy, `the policy does not name the store \`${key}\``).toContain(key)
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
  it('says membership is what gives the right to compete', () => {
    expect(sectionOf('uslovi-koriscenja', /pravo takmičenja/)).toMatch(
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
      /registrovao na portalu i kome je liga aktivirala članstvo/,
    )
    /* And activation is what carries it, since one member in the league has
       never paid anything: an honorary one. Written as three conditions with
       the fee among them, the definition gave rights in one article and took
       them back in another (owner, 03.08.2026). */
    expect(sectionOf('pravilnik', /Član lige je/)).toMatch(
      /aktivira po evidentiranoj uplati članarine ili po odluci lige o počasnom članstvu/,
    )
  })

  it('says what stops when the fee runs out, which is what makes it a ticket', () => {
    expect(sectionOf('uslovi-koriscenja', /pravo takmičenja/)).toMatch(
      /se rezultati ne unose, ne rangiraju i ne ulaze u tabele, a profil se ne prikazuje/,
    )
  })

  it('measures membership by activation in the terms as well, not only in the rulebook', () => {
    /* The terms are the document the rulebook itself makes authoritative for the
       fee (article 3), and they went on defining a member as somebody who has
       paid. One honorary member reads both and is told in one that they are a
       member with every right and in the other that their profile is not shown
       (owner, 03.08.2026). */
    expect(sectionOf('uslovi-koriscenja', /pravo takmičenja/)).toMatch(
      /kome liga aktivira članstvo, po evidentiranoj uplati članarine ili po odluci o počasnom članstvu/,
    )
    expect(sectionOf('uslovi-koriscenja', /pravo takmičenja/)).toMatch(/Bez aktiviranog članstva/)
    /* And the section that walks through registration, which described the same
       thing as a queue of steps ending in a payment. An honorary member never
       walks two of those steps. */
    expect(sectionOf('uslovi-koriscenja', /Registracija se radi/)).toMatch(
      /Dok vam članstvo ne bude aktivirano niste vidljivi/,
    )
    expect(sectionOf('uslovi-koriscenja', /Registracija se radi/)).toMatch(
      /Počasnog člana aktiviramo bez koraka 4, odlukom lige; članski broj i sva prava dobija/,
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

  it('does not ask for a telephone anywhere, and says nothing about one', () => {
    /* Owner, 11.08.2026: „broj telefona brišemo i nećemo ga više tražiti na
       portalu čak ni neobavezno." A privacy policy that describes the handling
       of a number nobody is asked for is a policy that describes somebody
       else's portal, and the consent it names is a consent nothing collects.
       It was obligatory on 01.08, optional again on 03.08, and is now gone. */
    for (const slug of ['politika-privatnosti', 'uslovi-koriscenja', 'pravilnik'] as const) {
      expect(whole(slug)).not.toMatch(/telefon/i)
    }
  })
})
