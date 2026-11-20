import { screen } from '@testing-library/react'
import { matchingMedia } from '../test/media'
import { renderAt } from '../test/render'
import { TWO_COLUMNS } from './home/rowsThatFit'

/**
 * THE ORDER OF THE FRONT PAGE'S MARKUP IS THE ORDER IT IS SEEN IN, ON BOTH LAYOUTS (ADL A7, owner, 21.11.2026:
 * „Kod prati ekran").
 *
 * Under 860px one column, written as a phone shows it since 31.07.2026: the boards, the figures of the
 * season, the turning chart, what is next, the address, the sponsor of the day, the calculator. From 860px
 * two columns, written as they stand: left, from the top, the Top 10 boards, then the turning chart, then
 * the address of the president (PDL P24: „Levo, od vrha: Top 10 …, pa rotirajući grafikon, pa obraćanje
 * predsednika"); right, the figures, what is next, the sponsor, the calculator. The stylesheet moves nothing
 * (`home/homeLayoutStyle.test.ts`), and `geometry/frontPage.geometry.ts` holds in Chrome that on a phone the
 * order of the markup is the order of the eye.
 */

const BOXES = ['boards', 'figures', 'chart', 'next', 'address', 'sponsor', 'calc']

/** The boxes among the children of an element, by the name they carry, in the order they are written. */
function boxesOf(element: Element): string[] {
  return [...element.children].flatMap((one) => {
    const found = BOXES.find((name) => one.classList.contains(`home__${name}`))

    return found === undefined ? [] : [found]
  })
}

async function draw(wide: boolean) {
  const previous = window.matchMedia

  window.matchMedia = matchingMedia((query) => wide && query === TWO_COLUMNS)
  renderAt('/sr')

  await screen.findByRole('heading', { level: 2, name: 'Reč predsednika' })

  return () => {
    window.matchMedia = previous
  }
}

function split(): Element {
  const found = document.querySelector('.home__split')

  if (found === null) {
    throw new Error('the front page has no grid')
  }

  return found
}

describe('the markup of the front page', () => {
  it('is one column in the order a phone shows, under the width of two columns', async () => {
    const restore = await draw(false)

    try {
      expect(document.querySelector('.home__colL')).toBeNull()
      expect(document.querySelector('.home__colR')).toBeNull()
      expect(boxesOf(split())).toEqual(['boards', 'figures', 'chart', 'next', 'address', 'calc'])
    } finally {
      restore()
    }
  })

  it('is two columns from the width of two columns, the chart between the boards and the address', async () => {
    const restore = await draw(true)

    try {
      const left = document.querySelector('.home__colL')
      const right = document.querySelector('.home__colR')

      expect(left).not.toBeNull()
      expect(right).not.toBeNull()
      expect(boxesOf(left ?? split())).toEqual(['boards', 'chart', 'address'])
      expect(boxesOf(right ?? split())).toEqual(['figures', 'next', 'calc'])
      expect(boxesOf(split())).toEqual([])
    } finally {
      restore()
    }
  })
})
