import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import { loadResource } from '../data/client'
import { sectionsOf } from '../data/pages'
import type { StaticPage } from '../data/types'
import { renderAt } from '../test/render'
import { ADDRESS_SLUG } from './home/President'

/* The address of the president stands on the front page and on "O ligi", and it
 * is one written record maintained by the administrator rather than a text in
 * the code (PDL P28a, 30.07.2026). Both halves of that are worth holding: that
 * it is drawn in both places, and that it is stored once. */

const pagesOf = () => loadResource<Record<string, StaticPage>>('pages')

/** The opening paragraph of the address, straight out of the record. */
async function opening(): Promise<string> {
  const pages = await pagesOf()

  return pages[ADDRESS_SLUG].sections[0].body.split('\n\n')[0]
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

    // Same column as the boards, and last in it.
    expect(address.closest('article')?.parentElement?.parentElement).toBe(
      board.closest('section')?.parentElement?.parentElement,
    )
    expect(
      board.compareDocumentPosition(address) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // The figures are the other column, and they follow.
    expect(
      address.compareDocumentPosition(counters) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  /* The way to the rulebook is inside the sentence that names it, and so is the
     address of the association (owner, 31.07.2026). Both used to be plain text,
     with a "Ceo pravilnik" link under the card doing the first one's job. */
  it('carries the way to the rulebook and the address to write to, inside its own text', async () => {
    renderAt('/sr')

    const address = await screen.findByRole('heading', { level: 2, name: 'Reč predsednika' })
    const card = address.closest('article') as HTMLElement

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
       be corrected by the person whose text it is. */
    const needle = 'pod popularnim imenom Balkanska trkačka liga'
    const inCode = sourceFiles(join(process.cwd(), 'src')).filter((path) =>
      readFileSync(path, 'utf-8').includes(needle),
    )

    expect(text).toContain(needle)
    expect(inCode).toEqual([])
  })

  it('stands on "O ligi" as well, and is the same record there', async () => {
    const text = await opening()
    renderAt('/sr/o-ligi')

    const page = await screen.findByRole('article')

    expect(within(page).getByRole('heading', { level: 2, name: 'Reč predsednika' })).toBeVisible()
    expect(within(page).getByText(text)).toBeVisible()
  })

  it('is stored once, so a correction cannot land on one of the two pages', async () => {
    const pages = await pagesOf()
    const about = pages['o-ligi']

    // "O ligi" takes the record in; it does not hold a copy of the words.
    expect(about.includes).toContain(ADDRESS_SLUG)
    expect(about.sections.map((section) => section.body).join('\n')).not.toContain(
      'pod popularnim imenom',
    )
  })

  it('is maintained in administration, where it has no address of its own', async () => {
    renderAt('/sr/administracija/strane', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Statične strane' })

    expect(
      within(table).getByRole('button', { name: 'Naslov: Reč predsednika. Izmeni' }),
    ).toBeVisible()
    /* It is a page shown inside other pages, so the row says so instead of
       linking to an address that would answer "Ove strane nema". */
    expect(within(table).getAllByText('Stoji unutar drugih strana')).toHaveLength(1)
    expect(within(table).getByRole('link', { name: '/o-ligi' })).toBeVisible()
  })
})

describe('sectionsOf', () => {
  const pages: Record<string, StaticPage> = {
    prva: { title: 'Prva', sections: [{ heading: 'Svoja', body: 'x' }], includes: ['druga', 'nema'] },
    druga: { title: 'Druga', sections: [{ heading: 'Uzeta', body: 'y' }] },
  }

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
