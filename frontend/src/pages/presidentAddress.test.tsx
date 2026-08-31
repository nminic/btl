import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { screen, within } from '@testing-library/react'
import { loadResource } from '../data/client'
import { sectionsOf } from '../data/pages'
import type { StaticPage } from '../data/types'
import { first, htmlElement } from '../test/at'
import { renderAt } from '../test/render'
import { ADDRESS_SLUG } from './home/President'

/* The address of the president stands on the front page, and it is one written
 * record maintained by the administrator rather than a text in the code (PDL
 * P28a, 30.07.2026). It stood on "O ligi" too until that page was deleted
 * (owner, 04.08.2026); what is held here is that it is drawn from the record and
 * stored once. */

const pagesOf = () => loadResource<Record<string, StaticPage>>('pages')

/** The record kept under that address.
 *
 *  Whether a record is there at all is the thing these tests are about, so a
 *  slug that answers nothing fails here, naming the slug. Read any other way it
 *  would go on as an empty page and the assertions below would then be about
 *  nothing: `expect(within(page).getByText(''))` finds every node there is. */
async function pageAt(slug: string): Promise<StaticPage> {
  const stored = (await pagesOf())[slug]

  if (stored === undefined) {
    throw new Error(`no written page is stored under "${slug}"`)
  }

  return stored
}

/** The opening paragraph of the address, straight out of the record. */
async function opening(): Promise<string> {
  const address = await pageAt(ADDRESS_SLUG)
  const written = first(address.sections).body

  return first(written.split('\n\n'))
}

/** Every source file of the application, so that a text can be looked for in the
 *  code and not found there. Tests are not part of it: this one quotes the
 *  sentence it is looking for. */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      return sourceFiles(path)
    }

    return /\.(ts|tsx|json)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

describe('the address of the president', () => {
  /* It is the foot of the left column now, under the boards and the turning
     chart (owner, 31.07.2026), which is also where it lands on a phone: the two
     columns become one, left before right, so the address is the last thing
     before the figures rather than the first thing on the page. */
  it('stands at the foot of the left column of the front page', async () => {
    renderAt('/sr')

    const address = await screen.findByRole('heading', { level: 2, name: 'Reč predsednika' })
    const board = screen.getByRole('heading', { level: 2, name: 'Top 10 muškarci' })
    const counters = screen.getByRole('heading', { level: 2, name: /Sezona/ })

    /* Same grid as the boards, and after them: one grid holds the whole page
       now, so the two are cells of it rather than children of one column. */
    expect(address.closest('article')?.parentElement?.parentElement?.parentElement).toBe(
      board.closest('section')?.parentElement?.parentElement,
    )
    expect(
      board.compareDocumentPosition(address) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    /* The figures come before it in the markup, because on a phone somebody
       wants the standing, then the numbers behind it, and the prose after both
       (owner, 31.07.2026). On a wide screen the grid puts them side by side. */
    expect(
      counters.compareDocumentPosition(address) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  /* The way to the rulebook is inside the sentence that names it, and so is the
     address of the association (owner, 31.07.2026). Both used to be plain text,
     with a "Ceo pravilnik" link under the card doing the first one's job. */
  it('carries the way to the rulebook and the address to write to, inside its own text', async () => {
    renderAt('/sr')

    const address = await screen.findByRole('heading', { level: 2, name: 'Reč predsednika' })
    const card = htmlElement(address.closest('article'))

    expect(within(card).getByRole('link', { name: 'pravilnik' })).toHaveAttribute(
      'href',
      '/sr/pravilnik',
    )
    expect(within(card).getByRole('link', { name: /@/ })).toHaveAttribute(
      'href',
      'mailto:info@balkanskatrkackaliga.net',
    )
    // And the link that used to stand under the card is gone with it.
    expect(within(card).queryByRole('link', { name: 'Ceo pravilnik' })).not.toBeInTheDocument()
  })

  it('is read out of the data rather than written into the code', async () => {
    const text = await opening()
    renderAt('/sr')

    expect(await screen.findByText(text)).toBeVisible()

    /* And the same sentence exists nowhere in the application. A text in the
       dictionary or in a component would look identical on screen and could not
       be corrected by the person whose text it is.

       **In the application**, which is what the reason above is about: a folder called
       `test` under `src` holds fixtures and helpers, nothing there ships, and the
       portal's own sweep leaves such a folder out for the same reason
       (`test/sources.ts`). Since
       31.08.2026 one of those fixtures is a snapshot of every written page, held so
       that a sentence the owner settled cannot drift; a copy that only a test reads
       cannot reach a screen and cannot stop him correcting his own words. Measured
       both ways: the sentence written into a file that ships still falls here. */
    const needle = 'pod popularnim imenom Balkanska trkačka liga'
    const src = join(process.cwd(), 'src')
    const inCode = sourceFiles(src)
      /* Asked of the path **below** `src`, not of the whole of it: written over the
         absolute path, a checkout into any folder that happens to be called `test`
         emptied the sweep and this passed over nothing at all (review, 31.08.2026).
         The portal's own sweep learned the same thing on 28.08.2026 and its comment
         says so. */
      .filter((path) => !path.slice(src.length).split(sep).includes('test'))
      .filter((path) => readFileSync(path, 'utf-8').includes(needle))

    expect(text).toContain(needle)
    expect(inCode).toEqual([])
  })

  it('is stored once, and the front page is the only screen that draws it', async () => {
    /* It stood on "O ligi" as well until 04.08.2026, when the owner had that
       page deleted. The record itself is untouched by that: it is drawn on the
       front page, maintained on the list of pages, and copied nowhere. */
    const stored = await pageAt(ADDRESS_SLUG)
    const pages = await pagesOf()

    expect(stored.sections.map((section) => section.body).join('\n')).toContain(
      'pod popularnim imenom',
    )
    expect(Object.keys(pages)).not.toContain('o-ligi')
    expect(
      Object.entries(pages)
        .filter(([slug]) => slug !== ADDRESS_SLUG)
        .flatMap(([, page]) => page.sections.map((section) => section.body))
        .join('\n'),
    ).not.toContain('pod popularnim imenom')
  })

  it('is maintained in administration, where it has no address of its own', async () => {
    renderAt('/sr/administracija/strane', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Statične strane' })

    expect(
      within(table).getByRole('button', { name: 'Naslov: Reč predsednika. Izmeni' }),
    ).toBeVisible()
    /* And it says so instead of offering an address. Nothing takes the record in
       through `includes` any more, since "O ligi" was deleted; what says it has
       no address of its own is the screen that draws it (src/data/pages.ts), and
       without that this row would offer /rec-predsednika as a link to a page the
       portal does not serve. */
    expect(within(table).getAllByText('Stoji unutar drugih strana')).toHaveLength(1)
    expect(within(table).queryByRole('link', { name: '/rec-predsednika' })).toBeNull()
    expect(within(table).getByRole('link', { name: '/pravilnik' })).toBeVisible()
  })
})

describe('sectionsOf', () => {
  /* Written with `satisfies` rather than typed as the record it is handed to:
     the two pages of this fixture are known by name here, and `prva` is then a
     page rather than a page that might not be there. The function still takes it
     as the open record it takes on the screens. */
  const pages = {
    prva: { title: 'Prva', sections: [{ heading: 'Svoja', body: 'x' }], includes: ['druga', 'nema'] },
    druga: { title: 'Druga', sections: [{ heading: 'Uzeta', body: 'y' }] },
  } satisfies Record<string, StaticPage>

  it('puts what a page takes in above what it wrote itself', () => {
    expect(sectionsOf(pages, pages.prva).map((section) => section.heading)).toEqual([
      'Uzeta',
      'Svoja',
    ])
  })

  it('passes over a page that is not there rather than breaking the one that is', () => {
    // "nema" answers nothing, and the page still draws everything else.
    expect(sectionsOf(pages, pages.druga)).toEqual(pages.druga.sections)
  })
})
