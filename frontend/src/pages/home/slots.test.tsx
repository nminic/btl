import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { BtlEvent, Race } from '../../data/types'
import { I18nProvider } from '../../i18n/I18nProvider'
import { CalendarExtract } from './CalendarExtract'
import { seasonLabelKey } from './content'

/* The extract of the calendar, which is the widget "Priprema, pozor, SAD!".
 *
 * The widget of membership stood in this file too, until the owner had it taken
 * off the front page on 04.08.2026: "nećemo ga koristiti do daljnjeg". What it
 * showed a member is on the screen of their own membership, which has its own
 * tests. */

function renderWidget(ui: React.ReactNode) {
  return render(
    <I18nProvider locale="sr">
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nProvider>,
  )
}

describe('CalendarExtract', () => {
  const event = (id: string, name: string, date: string): BtlEvent => ({
    id,
    slug: id,
    name,
    date,
    city: 'Beograd',
    country: 'RS',
    organizer: 'x',
    kind: 'race', copiedFrom: '',
  })

  const races: Race[] = [
    {
      id: 'r1',
      eventId: 'd',
      date: '2027-04-03',
      name: 'Maraton', distanceKm: 42.2, ascentM: 0, descentM: 0, category: 'marathon',
    },
    {
      id: 'r2',
      eventId: 'd',
      date: '2027-04-03',
      name: 'Ultra', distanceKm: 100, ascentM: 0, descentM: 0, category: 'ultra',
    },
    {
      id: 'r3',
      eventId: 'd',
      date: '2027-04-03',
      name: 'Drugi maraton', distanceKm: 42.2, ascentM: 0, descentM: 0, category: 'marathon',
    },
  ]

  it('says so when there is nothing ahead', () => {
    renderWidget(<CalendarExtract events={[]} races={[]} today="2026-07-29" />)

    expect(screen.getByText('U ovom mesecu nema nijednog događaja.')).toBeVisible()
  })

  it('leads to the calendar on the month today is in', () => {
    /* Owner, 04.08.2026: "Ceo kalendar treba da vodi na mesec koji sadrži
       aktuelni današnji dan kad je kliknuto." Left to choose, the calendar opens
       on the first month that has anything in it, which in a league whose season
       starts in January is months away from whoever pressed this. */
    renderWidget(<CalendarExtract events={[]} races={[]} today="2026-07-29" />)

    expect(screen.getByRole('link', { name: 'Ceo kalendar' })).toHaveAttribute(
      'href',
      '/sr/kalendar?mesec=2026-07',
    )
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
        races={races}
        today="2026-11-01"
      />,
    )

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('i još 2 termina')
    // A one-off says nothing about repeats.
    expect(rows[1]).not.toHaveTextContent('i još')
  })

  /* One dot per length actually run there, never one per race, and the names
     travel with them because a colour on its own says nothing to anybody who
     cannot separate two of them (owner, 31.07.2026). */
  it('marks the lengths an event holds, once each', () => {
    const { container } = renderWidget(
      <CalendarExtract
        events={[event('d', 'Fruškogorski maraton', '2026-12-05')]}
        races={races}
        today="2026-11-01"
      />,
    )

    /* Three races, two lengths between them, so the row names two: the marathon
       run twice is named once. The sentence is what a screen reader is given and
       the dots are what everybody else sees, so both are counted: the sentence
       alone survived the dots disappearing altogether, which is the one thing
       moving them between stylesheets could have done. */
    expect(screen.getByText('Maraton, Ultramaraton')).toBeInTheDocument()
    expect(
      [...container.querySelectorAll('.length-dot')].map((dot) => dot.getAttribute('aria-hidden')),
    ).toEqual(['true', 'true'])
  })
})

describe('seasonLabelKey', () => {
  it('names the running season plainly and any other one as a sample', () => {
    expect(seasonLabelKey(2027, 2027)).toBe('home.season')
    expect(seasonLabelKey(2020, 2027)).toBe('home.seasonSample')
  })
})
