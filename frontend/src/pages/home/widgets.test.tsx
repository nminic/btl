import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { Competitor, Result } from '../../data/types'
import { I18nProvider } from '../../i18n/I18nProvider'
import { News } from './News'
import { Sponsor, SponsorStrip } from './Sponsor'
import { CategoryChart } from './CategoryChart'
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
  gender: memberNumber.startsWith('F') ? 'F' : 'M',
  city: 'Beograd',
  country: 'RS',
  categoryCode: 'M A',
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
    competitor('M0001'),
    competitor('M0002'),
    competitor('M0003'),
    competitor('M0004'),
  ]

  it('shows points once the season has been run', () => {
    renderWidget(
      <TopTen
        competitors={competitors}
        results={[
          result('M0001', 30),
          result('M0002', 20),
          result('M0003', 10),
          result('M0004', 5),
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

    expect(await screen.findByText('1.234', {}, { timeout: 3000 })).toBeVisible()
    expect(screen.getByText('10:00:00')).toBeVisible()
  })

  it('gives the numbers straight away to anyone who asked for less motion', () => {
    const previous = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduced-motion'),
      media: query,
    })) as typeof matchMedia

    renderWidget(<Counters totals={totals} seasonLabel="Sezona 2027." />)

    expect(screen.getByText('1.234')).toBeVisible()
    window.matchMedia = previous
  })
})

describe('CategoryChart', () => {
  it('shows a category nobody ran as zero rather than leaving it out', () => {
    renderWidget(<CategoryChart results={[result('M0001', 5)]} season={2027} />)

    const rows = screen.getAllByRole('row')

    // All five lengths are always there, so the shape of the season is
    // readable: an empty category is information too.
    expect(rows).toHaveLength(5)
    expect(rows.filter((row) => row.textContent!.endsWith('0'))).toHaveLength(4)
  })

  it('survives a season in which nothing was run at all', () => {
    renderWidget(<CategoryChart results={[]} season={2027} />)

    expect(screen.getAllByRole('row')).toHaveLength(5)
  })
})
