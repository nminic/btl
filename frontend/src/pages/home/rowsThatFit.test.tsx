import { act, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { BtlEvent, Race } from '../../data/types'
import { I18nProvider } from '../../i18n/I18nProvider'
import { matchingMedia } from '../../test/media'
import { setupUser } from '../../test/user'
import { CalendarExtract } from './CalendarExtract'
import { FITS_WITHOUT_A_SPONSOR, TWO_COLUMNS, WITH_A_SPONSOR } from './rowsThatFit'

/**
 * HOW MANY RACES „Priprema, pozor, SAD!" SHOWS (PDL P24, variant A, owner 18.11.2026): four with a
 * sponsor, as many as fit to the bottom without one, and on a telephone the number the desktop
 * measures („isti broj koji izračuna desktop (oko devet)").
 *
 * **Every number in a case is different from every other**, so no answer satisfies a case by being one
 * of the others: there are twelve races ahead, four is the number with a sponsor, nine the number
 * that stands for a desktop, and the measured room holds seven rows (350 over rows of 50) or six and
 * a half (325). Twelve ahead is more than any of them, so a list that showed everything there is would
 * be caught as well.
 */

const event = (id: number): BtlEvent => ({
  id,
  slug: `trka-${String(id)}`,
  name: `Trka ${String(id)}`,
  date: `2027-04-${String(id).padStart(2, '0')}`,
  city: 'Beograd',
  country: 'RS',
  kind: 'race',
  description: '',
  link: '',
  copiedFrom: null,
  featured: false,
  highlighted: false,
})

const TWELVE = Array.from({ length: 12 }, (_, index) => event(index + 1))

function draw(events: BtlEvent[], fill: boolean) {
  return render(
    <I18nProvider locale="sr">
      <MemoryRouter>
        <CalendarExtract events={events} races={[]} today="2027-04-01" fill={fill} />
      </MemoryRouter>
    </I18nProvider>,
  )
}

const rows = () => screen.getAllByRole('listitem').length

/** What the browser would say about the room: how tall the list is and how tall a row is. */
const room = { list: 0, row: 0 }
let observed: (() => void)[] = []
const disconnected = vi.fn()

class Watching {
  private readonly told: () => void
  constructor(told: () => void) {
    this.told = told
  }
  observe() {
    observed.push(this.told)
  }
  disconnect() {
    disconnected()
  }
}

/** The window grows or shrinks: what was measured is measured again. */
function resized() {
  act(() => {
    for (const told of observed) {
      told()
    }
  })
}

describe('the races of „Priprema, pozor, SAD!"', () => {
  const previous = window.matchMedia

  afterEach(() => {
    window.matchMedia = previous
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    observed = []
    disconnected.mockClear()
  })

  /** Two columns or one, and a room of the given heights, read off the list and its rows. */
  function laidOut(columns: 1 | 2, list: number, row: number) {
    window.matchMedia = matchingMedia((query) => columns === 2 && query === TWO_COLUMNS)
    room.list = list
    room.row = row
    vi.stubGlobal('ResizeObserver', Watching)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return new DOMRect(0, 0, 100, this.tagName === 'UL' ? room.list : room.row)
    })
  }

  it('shows four with a sponsor, whatever the room', () => {
    laidOut(2, 600, 50)
    draw(TWELVE, false)

    expect(rows()).toBe(WITH_A_SPONSOR)
    expect(WITH_A_SPONSOR).toBe(4)
  })

  it('shows what there is when there is less than that', () => {
    draw(TWELVE.slice(0, 3), false)

    expect(rows()).toBe(3)
  })

  it('without a sponsor, in two columns, shows as many whole rows as stand to the bottom', () => {
    laidOut(2, 350, 50)
    draw(TWELVE, true)

    expect(rows()).toBe(7)
  })

  it('and never a row cut in half', () => {
    laidOut(2, 325, 50)
    draw(TWELVE, true)

    expect(rows()).toBe(6)
  })

  it('and counts again when the column changes height, never down to no row at all', () => {
    laidOut(2, 20, 50)
    draw(TWELVE, true)

    expect(rows()).toBe(1)

    room.list = 350
    resized()

    expect(rows()).toBe(7)
  })

  it('in one column shows the number the desktop measures, and not the rows it drew', () => {
    /* A list in one column is as tall as its own rows, so counting it answers whatever it drew. */
    laidOut(1, 600, 50)
    draw(TWELVE, true)

    expect(rows()).toBe(FITS_WITHOUT_A_SPONSOR)
    expect(FITS_WITHOUT_A_SPONSOR).toBe(9)
  })

  it('goes back to that number when the window narrows to one column', () => {
    laidOut(2, 350, 50)
    draw(TWELVE, true)
    expect(rows()).toBe(7)

    window.matchMedia = matchingMedia(() => false)
    resized()

    expect(rows()).toBe(FITS_WITHOUT_A_SPONSOR)
  })

  it('keeps the number it has while nothing is laid out', () => {
    laidOut(2, 350, 0)
    draw(TWELVE, true)

    expect(rows()).toBe(FITS_WITHOUT_A_SPONSOR)
  })

  it('shows that number where nothing can be measured at all', () => {
    draw(TWELVE, true)

    expect(rows()).toBe(FITS_WITHOUT_A_SPONSOR)
  })

  /* The length filter can leave the list with nothing in it (`lengthFilter.test.tsx`), and a list with no rows
     has no row to measure. Whatever happens to the room while it is empty is not told to anybody, because
     the list's own size does not change (it takes the column's, `contain: size`), so the count has to be
     read again when races come back. */
  it('reads the room again when races come back into a list that had none', async () => {
    const user = setupUser()
    const short = (id: number): Race => ({
      id,
      eventId: id,
      name: 'Trka',
      renamed: false,
      kind: 'length',
      limitSeconds: 0,
      date: '2027-04-03',
      distanceKm: 5,
      ascentM: 0,
      descentM: 0,
      category: 'short',
      dots: ['short'],
    })

    laidOut(2, 350, 50)
    const { unmount } = render(
      <I18nProvider locale="sr">
        <MemoryRouter>
          <CalendarExtract events={TWELVE} races={TWELVE.map((one) => short(one.id))} today="2027-04-01" fill />
        </MemoryRouter>
      </I18nProvider>,
    )
    expect(rows()).toBe(7)

    const group = screen.getByRole('group', { name: 'Distanca' })

    await user.click(within(group).getByRole('button', { name: /Ultra/ }))
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)

    // The column is shorter now, and nobody was told: the list drew nothing and so did not change size.
    room.list = 250
    await user.click(within(group).getByRole('button', { name: /^Sve/ }))

    expect(rows()).toBe(5)

    /* Gone before the next case begins, or the disconnecting it does is counted in that one. */
    unmount()
    disconnected.mockClear()
  })

  it('stops watching when it is gone', () => {
    laidOut(2, 350, 50)
    const { unmount } = draw(TWELVE, true)

    unmount()

    expect(disconnected).toHaveBeenCalledTimes(1)
  })
})
