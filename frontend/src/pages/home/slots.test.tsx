import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { BtlEvent } from '../../data/types'
import { I18nProvider } from '../../i18n/I18nProvider'
import { CalendarExtract } from './CalendarExtract'
import { EnrolmentSlot } from './EnrolmentSlot'
import { seasonLabelKey } from './content'

function renderWidget(ui: React.ReactNode) {
  return render(
    <I18nProvider locale="sr">
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nProvider>,
  )
}

describe('EnrolmentSlot', () => {
  it('says when it opens while it is shut', () => {
    renderWidget(<EnrolmentSlot today="2026-09-20" />)

    expect(screen.getByText('Registracija još nije otvorena')).toBeVisible()
    expect(screen.getByText(/Otvara se za 11 dana/)).toBeVisible()
  })

  it('shows the price in force and what it rises to', () => {
    renderWidget(<EnrolmentSlot today="2026-10-01" />)

    expect(screen.getByText('35 EUR')).toBeVisible()
    expect(screen.getByText('4.200 RSD')).toBeVisible()
    // Five days of the low price left, then forty.
    expect(screen.getByText(/Cena raste na 40 EUR za 5 dana/)).toBeVisible()
  })

  it('names the season on sale, which turns over on the first of October', () => {
    /* Owner, 30.07.2026. In June 2027 what can still be joined is 2027; from 1
       October it is 2028, and the slot said 2027 either way. */
    renderWidget(<EnrolmentSlot today="2027-06-01" />)
    expect(screen.getByRole('heading', { name: /2027/ })).toBeVisible()

    renderWidget(<EnrolmentSlot today="2027-10-02" />)
    expect(screen.getByRole('heading', { name: /2028/ })).toBeVisible()
  })

  it('calls a rise a rise, and says nothing of one where the next price is lower', () => {
    /* Through the nine months a season is running, the next price is the early
       one and is lower. The slot announced "cena raste na 35 EUR" for two
       hundred and seventy-three days of every year. */
    renderWidget(<EnrolmentSlot today="2027-06-01" />)

    expect(screen.getByText('40 EUR')).toBeVisible()
    expect(screen.queryByText(/Cena raste/)).not.toBeInTheDocument()
  })

  it('says instead what the in-season price does not buy', () => {
    /* The other half of that price, and the half worth knowing: it buys a
       profile and the results and no place in the standing (PDL P8). The slot
       said this nowhere. */
    renderWidget(<EnrolmentSlot today="2027-06-01" />)

    expect(screen.getByText(/ne i mesto u rang listama/)).toBeVisible()
  })

  it('still counts the days to a rise where there is one', () => {
    renderWidget(<EnrolmentSlot today="2026-12-20" />)

    expect(screen.getByText('50 EUR')).toBeVisible()
    expect(screen.queryByText(/Cena raste/)).not.toBeInTheDocument()

    renderWidget(<EnrolmentSlot today="2026-10-01" />)
    expect(screen.getByText(/Cena raste na 40 EUR za 5 dana/)).toBeVisible()
  })
})

describe('CalendarExtract', () => {
  const event = (id: string, name: string, date: string): BtlEvent => ({
    id,
    slug: id,
    name,
    date,
    city: 'Beograd',
    country: 'RS',
    organizer: 'x',
    status: 'confirmed',
    raceIds: [],
  })

  it('says so when there is nothing ahead', () => {
    renderWidget(<CalendarExtract events={[]} today="2026-07-29" />)

    expect(screen.getByText('U ovom mesecu nema nijednog događaja.')).toBeVisible()
  })

  it('takes one row for a series and says how many more times it runs', () => {
    renderWidget(
      <CalendarExtract
        events={[
          event('a', 'BTL sreda', '2026-12-02'),
          event('b', 'BTL sreda', '2026-12-09'),
          event('c', 'BTL sreda', '2026-12-16'),
          event('d', 'Fruškogorski maraton', '2026-12-05'),
        ]}
        today="2026-11-01"
      />,
    )

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('i još 2 termina')
    // A one-off says nothing about repeats.
    expect(rows[1]).not.toHaveTextContent('i još')
  })
})

describe('seasonLabelKey', () => {
  it('names the running season plainly and any other one as a sample', () => {
    expect(seasonLabelKey(2027, 2027)).toBe('home.season')
    expect(seasonLabelKey(2020, 2027)).toBe('home.seasonSample')
  })
})
