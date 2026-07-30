import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { Competitor, Result } from '../../data/types'
import { I18nProvider } from '../../i18n/I18nProvider'
import { setupUser } from '../../test/user'
import { News } from './News'
import { Sponsor, SponsorStrip } from './Sponsor'
import { TopByCategory } from './TopByCategory'
import { TopTen } from './TopTen'
import { Counters } from './Counters'
import type { NewsItem, SponsorEntry } from './content'

function renderWidget(ui: React.ReactNode) {
  return render(
    <I18nProvider locale="sr">
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nProvider>,
  )
}

const competitor = (memberNumber: string): Competitor => ({
  memberNumber,
  firstName: 'Ime',
  lastName: memberNumber,
  gender: 'M',
  city: 'Beograd',
  country: 'RS',
  birthYear: 1985,
  firstSeason2027: false,
  firstSeason: 2027,
  active: true,
  membershipBasis: 'payment',
  teamId: null,
})

const result = (memberNumber: string, points: number): Result => ({
  id: `${memberNumber}-${points}`,
  memberNumber,
  raceId: 'r',
  eventName: 'Trka',
  date: '2027-05-01',
  distanceKm: 10,
  ascentM: 0,
  descentM: 0,
  seconds: 3000,
  points,
  category: 'short',
})

describe('News', () => {
  const item: NewsItem = {
    id: 'a',
    date: '2026-07-20',
    titleKey: 'home.news',
    textKey: 'home.newest',
  }

  it('shows nothing at all when nothing is fresh', () => {
    const { container } = renderWidget(<News items={[]} today="2026-07-29" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows what is fresh', () => {
    renderWidget(<News items={[item]} today="2026-07-29" />)

    expect(screen.getByRole('heading', { name: 'Vesti' })).toBeVisible()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})

describe('Sponsor', () => {
  const sponsor: SponsorEntry = { id: 'a', name: 'Neko', url: 'https://primer.rs' }

  it('shows nothing while there is no sponsor', () => {
    const { container } = renderWidget(
      <>
        <Sponsor sponsors={[]} />
        <SponsorStrip sponsors={[]} />
      </>,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('shows the sponsor of the day and the strip once there is one', () => {
    renderWidget(
      <>
        <Sponsor sponsors={[sponsor]} />
        <SponsorStrip sponsors={[sponsor]} />
      </>,
    )

    expect(screen.getByRole('heading', { name: 'Sponzor dana' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Sponzori i partneri' })).toBeVisible()
  })
})

describe('TopTen', () => {
  // Four, so that the fourth row is not on the podium and both sides of that
  // decision are exercised.
  const competitors = [
    competitor('000001'),
    competitor('000002'),
    competitor('000004'),
    competitor('000005'),
  ]

  it('shows points once the season has been run', () => {
    renderWidget(
      <TopTen
        competitors={competitors}
        results={[
          result('000001', 30),
          result('000002', 20),
          result('000004', 10),
          result('000005', 5),
        ]}
        season={2027}
        gender="M"
      />,
    )

    const list = screen.getByRole('list')
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(4)
    expect(rows.filter((row) => row.className === 'podium')).toHaveLength(3)
    expect(within(list).getByText('30,00')).toBeVisible()
    expect(screen.queryByText(/ovo nije poredak/)).not.toBeInTheDocument()
  })

  it('lists who has joined, and says so, before the first race', () => {
    renderWidget(<TopTen competitors={competitors} results={[]} season={2027} gender="M" />)

    // Everyone who joined, in the order they joined, and no points column.
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByText(/ovo nije poredak/)).toBeVisible()
  })
})

describe('Counters', () => {
  const totals = {
    races: 3,
    kilometers: 1234,
    ascent: 5678,
    descent: 5000,
    seconds: 36000,
    points: 42,
  }

  it('unrolls the numbers, and lands on the real ones', async () => {
    renderWidget(<Counters totals={totals} seasonLabel="Sezona 2027." />)

    expect(await screen.findByText(/1\.234,00 km/, {}, { timeout: 3000 })).toBeVisible()
    // Every row carries its unit now, and time on the course is a quantity
    // rather than a clock reading (owner, 29.07.2026).
    // Each label sits in the same pill as its number, so these match on a part
    // of the line rather than the whole of it.
    expect(await screen.findByText(/10 h 00' 00''/, {}, { timeout: 3000 })).toBeVisible()
    expect(await screen.findByText(/3 trke/, {}, { timeout: 3000 })).toBeVisible()
    expect(await screen.findByText(/5\.678 m\+/, {}, { timeout: 3000 })).toBeVisible()
    expect(await screen.findByText(/5\.000 m-/, {}, { timeout: 3000 })).toBeVisible()
    expect(await screen.findByText(/42,00 BTL poena/, {}, { timeout: 3000 })).toBeVisible()
  })

  it('gives the numbers straight away to anyone who asked for less motion', () => {
    const previous = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduced-motion'),
      media: query,
    })) as typeof matchMedia

    renderWidget(<Counters totals={totals} seasonLabel="Sezona 2027." />)

    expect(screen.getByText(/1\.234,00 km/)).toBeVisible()
    window.matchMedia = previous
  })
})

describe('TopByCategory', () => {
  it('ranks by how many races of one length, tallest first', () => {
    const competitors = [competitor('000001'), competitor('000002'), competitor('000004')]
    const results = [
      result('000001', 1),
      result('000001', 2),
      result('000002', 3),
    ]

    renderWidget(
      <TopByCategory competitors={competitors} results={results} season={2027} />,
    )

    const columns = screen.getAllByRole('listitem')
    expect(columns).toHaveLength(2)
    expect(columns[0]).toHaveTextContent('2')
    // Anyone who ran none of this length is left out rather than shown as zero.
    expect(screen.queryByText('000004')).not.toBeInTheDocument()
  })

  it('turns to the next length by itself', async () => {
    renderWidget(
      <TopByCategory competitors={[]} results={[]} season={2027} turnMs={20} />,
    )

    const first = screen.getByText(/^Najviše/).textContent

    // It turns on its own, with no heading above it and nothing to steer it by.
    await waitFor(() => expect(screen.getByText(/^Najviše/).textContent).not.toBe(first))
  })

  /* Content that starts moving by itself and keeps it up past five seconds has
   * to be stoppable (WCAG 2.2.2). These prove the timer really is cleared, which
   * is the only part of the rule a screen cannot show. */

  /* Nothing here waits for a change: the point is to give a change that must not
   * come the time to arrive.
   *
   * The number is chosen, not picked. Five lengths at turnMs=20 means the
   * caption comes back round to itself every 100 ms, so a widget that never
   * stopped would still read the same at 100, 200 or 300 ms and the test would
   * pass on a coincidence. 250 ms sits as far from all three as the interval
   * allows, which leaves 50 ms of slack on a loaded runner in both directions. */
  const severalTurns = () => new Promise((resolve) => setTimeout(resolve, 250))

  it('stops turning when asked, and turns again when asked again', async () => {
    const user = setupUser()
    renderWidget(
      <TopByCategory competitors={[]} results={[]} season={2027} turnMs={20} />,
    )

    await user.click(screen.getByRole('button', { name: 'Zaustavi smenjivanje dužina' }))
    const stopped = screen.getByText(/^Najviše/).textContent
    await severalTurns()

    expect(screen.getByText(/^Najviše/).textContent).toBe(stopped)

    // The control now offers the other half of itself.
    await user.click(screen.getByRole('button', { name: 'Pokreni smenjivanje dužina' }))
    await waitFor(() => expect(screen.getByText(/^Najviše/).textContent).not.toBe(stopped))
  })

  it('stands still from the start for anyone who asked for less motion', async () => {
    const previous = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduced-motion'),
      media: query,
    })) as typeof matchMedia

    try {
      renderWidget(
        <TopByCategory competitors={[]} results={[]} season={2027} turnMs={20} />,
      )

      const first = screen.getByText(/^Najviše/).textContent
      await severalTurns()

      /* The turning is a timer rather than an animation, so the reduced motion
         block in index.css never touches it. It has to be read in the component
         or the preference is silently ignored. */
      expect(screen.getByText(/^Najviše/).textContent).toBe(first)
      // Standing still is the default, not the only choice on offer.
      expect(
        screen.getByRole('button', { name: 'Pokreni smenjivanje dužina' }),
      ).toBeInTheDocument()
    } finally {
      window.matchMedia = previous
    }
  })

  it('names the length underneath, and says so when nobody ran one', () => {
    renderWidget(<TopByCategory competitors={[]} results={[]} season={2027} />)

    expect(screen.getByText('Najviše kraćih trka')).toBeVisible()
    expect(screen.getByText('U ovoj sezoni još nema odtrčanih trka ove dužine.')).toBeVisible()
  })
})
