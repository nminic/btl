import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { BtlEvent, Dot, Race } from '../../data/types'
import { I18nProvider } from '../../i18n/I18nProvider'
import { at } from '../../test/at'
import { setupUser } from '../../test/user'
import { CalendarExtract } from './CalendarExtract'

/**
 * THE FILTER BY LENGTH OF „Priprema, pozor, SAD!" (owner, 20.11.2026, PDL „Četiri dodatka naslovne iz
 * tuđeg nacrta").
 *
 * Six buttons in one row, in the order the profile has the lengths, and a click filters at once. A length
 * shows the races of that length in the number „Sve" shows: nine where there is no sponsor (what stands
 * for the desktop in jsdom, `rowsThatFit.ts`), four with one, and every one there is where there are fewer.
 * The row is the date and the name and the dots, as it was: the owner took „za N dana" away.
 *
 * **Every number in a case is different from every other**, so no answer satisfies one by being another:
 * eleven marathons ahead (more than nine and than four), two ultras (fewer than either), and no half
 * marathon at all.
 */

const TODAY = '2027-04-01'

const event = (id: number, name: string, date: string): BtlEvent => ({
  id,
  slug: `trka-${String(id)}`,
  name,
  date,
  city: 'Beograd',
  country: 'RS',
  kind: 'race',
  description: '',
  link: '',
  copiedFrom: null,
  featured: false,
  highlighted: false,
})

const race = (id: number, eventId: number, dots: Dot[]): Race => ({
  id,
  eventId,
  name: 'Trka',
  renamed: false,
  kind: 'length',
  limitSeconds: 0,
  date: '2027-04-03',
  distanceKm: 10,
  ascentM: 0,
  descentM: 0,
  category: 'short',
  dots,
})

/* Eleven runs of eleven different marathons, ids 1 to 11, one a day from the second of April. */
const MARATHONS = Array.from({ length: 11 }, (_, index) =>
  event(index + 1, `Maraton ${String(index + 1)}`, `2027-04-${String(index + 2).padStart(2, '0')}`),
)

/* Two ultras: ids 21 and 22. */
const ULTRA_ONE = event(21, 'Ultra jedan', '2027-05-10')
const ULTRA_TWO = event(22, 'Ultra dva', '2027-05-11')

/* The same name twice: the first run has no ultra and the second does, so the row says the second's date. */
const NEAR = event(31, 'Dvaput', '2027-06-01')
const FAR = event(32, 'Dvaput', '2027-09-15')

const EVENTS = [...MARATHONS, ULTRA_ONE, ULTRA_TWO, NEAR, FAR]
const RACES = [
  ...MARATHONS.map((one, index) => race(100 + index, one.id, ['marathon'])),
  race(121, ULTRA_ONE.id, ['ultra']),
  race(122, ULTRA_TWO.id, ['ultra']),
  race(131, NEAR.id, ['short']),
  race(132, FAR.id, ['ultra']),
]

function draw(fill: boolean, events: BtlEvent[] = EVENTS, races: Race[] = RACES) {
  return render(
    <I18nProvider locale="sr">
      <MemoryRouter>
        <CalendarExtract events={events} races={races} today={TODAY} fill={fill} />
      </MemoryRouter>
    </I18nProvider>,
  )
}

const group = () => screen.getByRole('group', { name: 'Distanca' })
const names = () => within(screen.getByRole('region')).queryAllByRole('listitem').map((one) => {
  const link = within(one).getByRole('link')

  return link.textContent
})

describe('the filter by length of „Priprema, pozor, SAD!"', () => {
  it('is six buttons in the order of the profile, each called as the portal calls its length', () => {
    draw(true)

    const buttons = within(group()).getAllByRole('button')

    expect(buttons).toHaveLength(6)
    expect(buttons.map((one) => one.textContent)).toEqual([
      'Sve distance',
      'Kratke, Kraća trka',
      '21,1 km, Polumaraton',
      'Duge, Duža trka',
      '42,2 km, Maraton',
      'Ultra, Ultramaraton',
    ])
    // What a reader hears begins with what is drawn on the button (WCAG 2.5.3), whichever of them is.
    expect(buttons.map((one) => one.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
      'false',
      'false',
      'false',
    ])
  })

  it('writes the unit apart from the length, so that it is the only thing that can go', () => {
    draw(true)

    const half = within(group()).getByRole('button', { name: '21,1 km, Polumaraton' })
    const unit = within(half).getByText('km')

    expect(unit).toHaveClass('seg__km')
    expect(half.textContent).toBe('21,1 km, Polumaraton')
    expect(within(group()).getByRole('button', { name: 'Kratke, Kraća trka' }).querySelector('.seg__km')).toBeNull()
  })

  it('shows every length at first, the nearest nine', async () => {
    draw(true)

    expect(names()).toHaveLength(9)
    expect(at(names(), 0)).toBe('Maraton 1')
  })

  it('shows the races of the length chosen, and only those, at once', async () => {
    const user = setupUser()

    draw(true)
    await user.click(within(group()).getByRole('button', { name: 'Ultra, Ultramaraton' }))

    expect(within(group()).getByRole('button', { name: 'Ultra, Ultramaraton' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(group()).getByRole('button', { name: 'Sve distance' })).toHaveAttribute('aria-pressed', 'false')
    expect(names()).toEqual(['Ultra jedan', 'Ultra dva', 'Dvaput'])
  })

  it('shows the same number as „Sve" when there are more of the length than that', async () => {
    const user = setupUser()

    draw(true)
    await user.click(within(group()).getByRole('button', { name: '42,2 km, Maraton' }))

    // Eleven marathons ahead, and nine is what „Sve" shows.
    expect(names()).toHaveLength(9)
    expect(at(names(), 8)).toBe('Maraton 9')
  })

  it('shows four with a sponsor, whichever length it is', async () => {
    const user = setupUser()

    draw(false)
    expect(names()).toHaveLength(4)

    await user.click(within(group()).getByRole('button', { name: '42,2 km, Maraton' }))

    expect(names()).toEqual(['Maraton 1', 'Maraton 2', 'Maraton 3', 'Maraton 4'])
  })

  it('says the nearest date that holds the length and not the nearest date of the event', async () => {
    const user = setupUser()

    /* Three events only, so the row of the name is among those drawn and not behind the nine marathons. */
    draw(true, [NEAR, FAR, ULTRA_ONE])
    // „Sve": the first run of the name, in June, which holds no ultra.
    const first = within(screen.getByRole('region'))
      .getAllByRole('listitem')
      .find((one) => within(one).queryByRole('link', { name: 'Dvaput' }) !== null)

    expect(first).toBeDefined()
    expect(first?.querySelector('time')).toHaveAttribute('datetime', '2027-06-01')

    await user.click(within(group()).getByRole('button', { name: 'Ultra, Ultramaraton' }))

    const row = within(screen.getByRole('region'))
      .getAllByRole('listitem')
      .find((one) => within(one).queryByRole('link', { name: 'Dvaput' }) !== null)

    expect(row?.querySelector('time')).toHaveAttribute('datetime', '2027-09-15')
    expect(row).toHaveTextContent(/15.0?9./)
  })

  it('says so, and keeps the buttons, when nothing ahead is of the length', async () => {
    const user = setupUser()

    draw(true)
    await user.click(within(group()).getByRole('button', { name: '21,1 km, Polumaraton' }))

    expect(screen.getByText('Nema predstojećih trka ove distance.')).toBeVisible()
    expect(names()).toEqual([])

    // And back: the list is the one that was measured, and it is full again.
    await user.click(within(group()).getByRole('button', { name: 'Sve distance' }))

    expect(screen.queryByText('Nema predstojećih trka ove distance.')).not.toBeInTheDocument()
    expect(names()).toHaveLength(9)
  })

  it('writes no „za N dana" under a name', () => {
    draw(true)

    expect(screen.queryByText(/^za \d+ dana$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/dana$/)).not.toBeInTheDocument()
  })

  it('says there is nothing ahead, as it always has, when the league has no race at all', () => {
    draw(true, [], [])

    expect(screen.getByText('U ovom mesecu nema nijednog događaja.')).toBeVisible()
    expect(names()).toEqual([])
  })
})

/**
 * **EVERY ONE OF THE SIX BUTTONS IS TIED TO ITS OWN LENGTH** (review, 21.11.2026: a „Duge" that asked for the
 * marathon and a „Kratke" that asked for something else both passed, because only four of the six were ever
 * clicked). Five events, each holding one length that no other holds, so a button that asks for another
 * length shows another name; and „Sve" shows all five.
 */
describe('each button of the filter by length', () => {
  const ONLY: [string, Dot, string][] = [
    ['Kratke, Kraća trka', 'short', 'Samo kratka'],
    ['21,1 km, Polumaraton', 'half', 'Samo polumaraton'],
    ['Duge, Duža trka', 'long', 'Samo duga'],
    ['42,2 km, Maraton', 'marathon', 'Samo maraton'],
    ['Ultra, Ultramaraton', 'ultra', 'Samo ultra'],
  ]
  const events = ONLY.map(([, , name], index) => event(40 + index, name, `2027-04-${String(index + 2).padStart(2, '0')}`))
  const races = ONLY.map(([, dot], index) => race(140 + index, 40 + index, [dot]))

  for (const [button, , name] of ONLY) {
    it(`${button} keeps ${name} and nothing else`, async () => {
      const user = setupUser()

      draw(true, events, races)
      await user.click(within(group()).getByRole('button', { name: button }))

      expect(names()).toEqual([name])
    })
  }

  it('„Sve distance" shows all five, in the order of their dates', async () => {
    const user = setupUser()

    draw(true, events, races)
    await user.click(within(group()).getByRole('button', { name: 'Ultra, Ultramaraton' }))
    await user.click(within(group()).getByRole('button', { name: 'Sve distance' }))

    expect(names()).toEqual(ONLY.map(([, , name]) => name))
  })
})
