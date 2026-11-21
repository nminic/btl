import { screen, within } from '@testing-library/react'
import { renderAt } from '../test/render'
import type { SponsorEntry } from './home/content'

/**
 * THE FRONT PAGE WITH A SPONSOR, AND WITHOUT ONE, ON ONE ANSWER (PDL P24, variant A, owner 18.11.2026).
 *
 * The portal has no sponsor yet and writes none in (`home/content.ts`), so the list is swapped here for
 * one the case holds. Two sponsors and not one, so that the box of the day is the first of them and the
 * strip is all of them, and neither could pass by drawing the other's.
 *
 * Whether there is a sponsor is answered once on the page (`Home.tsx`), and four things read it: the box,
 * the strip, how many races the calendar shows, and the shape of the grid (`home__split--sponsored`,
 * which `Home.css` lays out, `home/homeLayoutStyle.test.ts`). Each case asks all four.
 */

const held = vi.hoisted(() => ({ sponsors: new Array<SponsorEntry>() }))

vi.mock('./home/content', () => ({
  get SPONSORS() {
    return held.sponsors
  },
}))

const VOLT: SponsorEntry = {
  id: 'a',
  name: 'VOLT',
  url: 'https://volt.primer.rs/',
  logo: '/logo/volt.png',
  description: 'Energetsko piće za duge treninge i noćne trke.',
}
const SOFRA: SponsorEntry = {
  id: 'b',
  name: 'Sofra',
  url: 'https://sofra.primer.rs/',
  logo: '/logo/sofra.png',
  description: 'Domaća kuhinja posle svake trke.',
}

/**
 * The day the page is read as, one day and not the suite's: how many races lie ahead in the sample turns
 * on the day, and on the other day the suite is read as (`test/theDay.ts`, 22.11.2027) only three do, so
 * neither four nor nine could be drawn and the count would say nothing about the sponsor. On 01.11.2026
 * forty-five races of different names lie ahead, more than either number, so the list is cut by the rule
 * and never by running out.
 */
const A_DAY_WITH_RACES_AHEAD = '2026-11-01'

async function drawn() {
  renderAt('/sr', 'visitor', null, undefined, A_DAY_WITH_RACES_AHEAD)

  await screen.findByRole('heading', { level: 2, name: 'Priprema, pozor, SAD!' })
  await screen.findByRole('heading', { level: 2, name: 'Reč predsednika' })

  const calendar = screen.getByRole('region', { name: 'Priprema, pozor, SAD!' })

  return {
    headings: screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent),
    races: within(calendar).getAllByRole('listitem').length,
    grid: calendar.closest('.home__split'),
  }
}

describe('the front page of variant A', () => {
  afterEach(() => {
    held.sponsors = []
  })

  it('with a sponsor: the box between the address and the calculator, four races, the strip under both columns', async () => {
    held.sponsors = [VOLT, SOFRA]

    const { headings, races, grid } = await drawn()

    /* „Na telefonu „Sponzor dana” stoji posle obraćanja predsednika, a pre kalkulatora." The markup is the
       order it is seen in (ADL A7, owner 21.11.2026: „Kod prati ekran"), and this is the one column. */
    expect(headings).toEqual([
      'Top 10 muškarci',
      'Top 10 žene',
      expect.stringMatching(/^(Sezona \d{4}\.|Zagrevanje)$/),
      'Priprema, pozor, SAD!',
      'Reč predsednika',
      'Sponzor dana',
      'BTL kalkulator',
    ])

    const box = screen.getByRole('region', { name: 'Sponzor dana' })
    expect(within(box).getByRole('link', { name: 'VOLT (otvara se u novom prozoru)' })).toBeVisible()
    expect(within(box).getByText(VOLT.description)).toBeVisible()

    const strip = screen.getByRole('region', { name: 'Sponzori i partneri' })
    expect(within(strip).getAllByRole('img').map((one) => one.getAttribute('alt'))).toEqual(['VOLT', 'Sofra'])

    /* Under both columns and not in either: after the grid, and outside it. */
    expect(grid).not.toBeNull()
    expect(grid?.contains(strip)).toBe(false)
    expect(grid?.compareDocumentPosition(strip)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

    expect(races).toBe(4)
    expect(grid).toHaveClass('home__split--sponsored')
  })

  it('without one: neither box nor strip, the calendar to the bottom, and the grid of variant A without the box', async () => {
    const { headings, races, grid } = await drawn()

    expect(headings).not.toContain('Sponzor dana')
    expect(screen.queryByRole('region', { name: 'Sponzori i partneri' })).not.toBeInTheDocument()

    /* jsdom lays nothing out, so this is the number that stands for the desktop's (`rowsThatFit.ts`). */
    expect(races).toBe(9)
    expect(grid).toHaveClass('home__split')
    expect(grid).not.toHaveClass('home__split--sponsored')
  })
})
