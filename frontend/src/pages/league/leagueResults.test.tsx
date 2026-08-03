import { screen, within } from '@testing-library/react'
import type { Competitor, Result } from '../../data/types'
import { at, first, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { PER_PAGE } from '../../components/pageOf'

/* Fifty placed to a page (owner, 03.08.2026, PDL P24).
 *
 * The generated data holds thirty two competitors, so the grid never fills a
 * page on its own and the paging would go untested on the one screen that uses
 * it: the slice could be replaced with `slice(0, PER_PAGE)`, the address could be
 * read under the wrong name, or the pager could be deleted, and every test would
 * stay green. So the two files the grid is built from are answered with enough
 * rows to page through, the way the other tests of this screen answer them.
 */

const RUN = '/sr/liga/brdska-2019/rezultati'
/** Comfortably more than one page, and not a round multiple of it, so the last
 *  page is a remainder rather than a full page. */
const MANY = 137

/**
 * The grid, with as many competitors as asked for and a result each.
 *
 * Everything else is answered from the real files, so the competition, its
 * events and its races are the ones the screen would really draw.
 */
async function withCompetitors(count: number) {
  const real = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const name = String(input)

    if (name.endsWith('/competitors.json')) {
      const all = (await (await real(input)).json()) as Competitor[]
      const one = first(all)

      return new Response(
        JSON.stringify(
          Array.from({ length: count }, (_ignored, index) => ({
            ...one,
            memberNumber: String(index + 1).padStart(6, '0'),
            firstName: 'Takmičar',
            lastName: `Broj ${index + 1}`,
            active: true,
          })),
        ),
        { status: 200 },
      )
    }

    if (name.endsWith('/results.json')) {
      const all = (await (await real(input)).json()) as Result[]
      /* One result of that competition, copied to every competitor, so every one
         of them is placed and the grid has a row for each. */
      const model = must(
        all.find((result) => result.date.startsWith('2019')),
        'rezultat iz 2019',
      )

      return new Response(
        JSON.stringify(
          Array.from({ length: count }, (_ignored, index) => ({
            ...model,
            id: `res-${index + 1}`,
            memberNumber: String(index + 1).padStart(6, '0'),
            points: count - index,
          })),
        ),
        { status: 200 },
      )
    }

    return real(input)
  }) as typeof fetch

  return () => {
    globalThis.fetch = real
  }
}

const grid = async () => within(await screen.findByRole('table', { name: 'Poredak takmičenja' }))

describe('a competition with more placed than fit on one page', () => {
  it('draws fifty of them and no more', async () => {
    const undo = await withCompetitors(MANY)

    try {
      renderAt(RUN)

      expect((await grid()).getAllByRole('rowheader')).toHaveLength(PER_PAGE)
    } finally {
      undo()
    }
  })

  it('says which rows are on the screen and offers the way on', async () => {
    const undo = await withCompetitors(MANY)

    try {
      renderAt(RUN)
      await grid()

      expect(screen.getByText(`Prikazano 1 do 50 od ${MANY}`)).toBeVisible()
      expect(screen.getByRole('button', { name: 'Sledeća' })).toBeEnabled()
    } finally {
      undo()
    }
  })

  it('shows the next fifty on the next page, and the rest on the last', async () => {
    const undo = await withCompetitors(MANY)

    try {
      const user = setupUser()
      const { router } = renderAt(RUN)

      const before = (await grid()).getAllByRole('rowheader').map((cell) => cell.textContent)

      await user.click(screen.getByRole('button', { name: 'Sledeća' }))

      const second = (await grid()).getAllByRole('rowheader').map((cell) => cell.textContent)

      expect(router.state.location.search).toContain('strana=2')
      expect(second).toHaveLength(PER_PAGE)
      /* A different fifty, not the same fifty again: that is the whole of what
         the slice does, and a slice that ignored the page would pass everything
         above this line. */
      expect(second).not.toEqual(before)
      expect(second.filter((name) => before.includes(name))).toEqual([])

      await user.click(screen.getByRole('button', { name: 'Sledeća' }))

      expect((await grid()).getAllByRole('rowheader')).toHaveLength(MANY - 2 * PER_PAGE)
      /* Said with `aria-disabled` rather than by switching the button off, so
         the keyboard is not thrown back to the top of the document by the last
         press somebody makes (Pager.tsx). */
      expect(screen.getByRole('button', { name: 'Sledeća' })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
    } finally {
      undo()
    }
  })

  it('opens on the page the address names', async () => {
    /* A page somebody is reading is a page they can send to somebody else. */
    const undo = await withCompetitors(MANY)

    try {
      renderAt(`${RUN}?strana=3`)
      await grid()

      expect(screen.getByText(`Prikazano 101 do ${MANY} od ${MANY}`)).toBeVisible()
    } finally {
      undo()
    }
  })

  it('keeps the order across the pages, so the fiftieth is above the fifty first', async () => {
    const undo = await withCompetitors(MANY)

    try {
      const user = setupUser()
      renderAt(RUN)

      /* The first cell of a row is the total, written the Serbian way, so the
         comma has to come out before it is a number again. */
      const total = (row: HTMLElement) =>
        Number((at(within(row).getAllByRole('cell'), 0).textContent ?? '').replace(',', '.'))

      const firstPage = (await grid()).getAllByRole('row').slice(1)
      const lastOfFirst = total(at(firstPage, PER_PAGE - 1))

      await user.click(screen.getByRole('button', { name: 'Sledeća' }))

      const secondPage = (await grid()).getAllByRole('row').slice(1)
      const firstOfSecond = total(first(secondPage))

      expect(lastOfFirst).not.toBeNaN()

      expect(firstOfSecond).toBeLessThanOrEqual(lastOfFirst)
    } finally {
      undo()
    }
  })
})

describe('a competition everybody in it fits on one page', () => {
  it('is drawn whole, with no way from one page to another', async () => {
    renderAt(RUN)

    const rows = (await grid()).getAllByRole('rowheader')

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThanOrEqual(PER_PAGE)
    expect(screen.queryByRole('navigation', { name: 'Strane poretka takmičenja' })).toBeNull()
  })
})
