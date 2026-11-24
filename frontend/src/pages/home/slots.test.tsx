import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { BtlEvent, Race } from '../../data/types'
import { I18nProvider } from '../../i18n/I18nProvider'
import { NAV } from '../../app/routes'
import { CalendarExtract } from './CalendarExtract'

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
  const event = (
    id: number,
    name: string,
    date: string,
    kind: BtlEvent['kind'] = 'race',
  ): BtlEvent => ({
    id,
    slug: `dogadjaj-${String(id)}`,
    name,
    date,
    city: 'Beograd',
    country: 'RS',
    kind, description: '', link: '', copiedFrom: null, featured: false, highlighted: false,
  })

  const races: Race[] = [
    {
      id: 1,
      eventId: 4,
      name: 'Trka',
      renamed: false,
      kind: 'length' as const,
      limitSeconds: 0,
      date: '2027-04-03',
      distanceKm: 42.2, ascentM: 0, descentM: 0, category: 'marathon', dots: ['marathon'],
    },
    {
      id: 2,
      eventId: 4,
      name: 'Trka',
      renamed: false,
      kind: 'length' as const,
      limitSeconds: 0,
      date: '2027-04-03',
      distanceKm: 100, ascentM: 0, descentM: 0, category: 'ultra', dots: ['ultra'],
    },
    {
      id: 3,
      eventId: 4,
      name: 'Trka',
      renamed: false,
      kind: 'length' as const,
      limitSeconds: 0,
      date: '2027-04-03',
      distanceKm: 42.2, ascentM: 0, descentM: 0, category: 'marathon', dots: ['marathon'],
    },
  ]

  it('says so when there is nothing ahead', () => {
    renderWidget(<CalendarExtract events={[]} races={[]} today="2026-07-29" fill />)

    expect(screen.getByText('U ovom mesecu nema nijednog događaja.')).toBeVisible()
  })

  it('offers races and neither gatherings nor trainings', () => {
    /* Owner, 23.08.2026: „na priprema pozor sad widgetu ne treba da postoje ni
       Skupovi ni treninzi. Samo tip događaja Trka." A gathering and a training are
       days of the league's own life rather than something anybody enters a result
       for, and this widget is the front page's answer to „what do I run next". They
       stay in the calendar, where they are found by looking. */
    renderWidget(
      <CalendarExtract
        events={[
          event(1, 'Trka koja se trči', '2027-04-03'),
          event(2, 'Sreda koja se ne trči', '2027-04-04', 'gathering'),
          event(3, 'Trening koji se ne trči', '2027-04-05', 'training'),
          /* Owner, 14.11.2026: „Naslovna, blok „Priprema, pozor, SAD", najavljuje samo bodovane trke". An
             unscored race is a race, and it is not announced. */
          event(4, 'Nebodovana koja se ne najavljuje', '2027-04-06', 'unscored'),
        ]}
        races={[]}
        today="2027-01-01"
        fill
      />,
    )

    expect(screen.getByText('Trka koja se trči')).toBeVisible()
    expect(screen.queryByText('Sreda koja se ne trči'), 'a gathering is offered').toBeNull()
    expect(screen.queryByText('Trening koji se ne trči'), 'a training is offered').toBeNull()
    expect(
      screen.queryByText('Nebodovana koja se ne najavljuje'),
      'an unscored race is announced',
    ).toBeNull()
  })

  it('leads to the calendar on the month today is in', () => {
    /* Owner, 04.08.2026: "Ceo kalendar treba da vodi na mesec koji sadrži
       aktuelni današnji dan kad je kliknuto." Left to choose, the calendar opens
       on the first month that has anything in it, which in a league whose season
       starts in January is months away from whoever pressed this. */
    renderWidget(<CalendarExtract events={[]} races={[]} today="2026-07-29" fill />)

    expect(screen.getByRole('link', { name: 'Ceo kalendar' })).toHaveAttribute(
      'href',
      '/sr/kalendar?mesec=2026-07',
    )
  })

  /* Owner, 21.11.2026 (PDL, „Filter po dužini u „Priprema, pozor, SAD!"): the way to the calendar goes
     from the bottom of the card into the row of the title, on its right, so the room it took is the
     list's. It is still a link, in the same row as the heading and before the list, never under it. */
  it('puts the link to the calendar in the row of the title and nothing under the list', () => {
    renderWidget(<CalendarExtract events={[]} races={[]} today="2026-07-29" fill />)

    const heading = screen.getByRole('heading', { level: 2, name: 'Priprema, pozor, SAD!' })
    const link = screen.getByRole('link', { name: 'Ceo kalendar' })
    const list = screen.getByRole('list')

    expect(link.parentElement, 'the link is not in the row of the title').toBe(heading.parentElement)
    expect(heading.contains(link), 'the link is inside the heading').toBe(false)
    expect(
      heading.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the link does not follow the title',
    ).toBeTruthy()
    expect(
      list.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_PRECEDING,
      'the link is under the list',
    ).toBeTruthy()
    expect(list.contains(link)).toBe(false)
    expect(screen.getAllByRole('link', { name: 'Ceo kalendar' })).toHaveLength(1)
  })

  /* Owner, 21.11.2026 (PDL, after the review of PR 770): where the word does not fit beside the title the link is
     the calendar of the header, and its name stays the word. The card decides which is drawn (jsdom lays nothing
     out, so what is held here is what both shapes are made of: the symbol is the navigation's own and says nothing,
     the word that is drawn is hidden from the reader, and the name is the word once). */
  it('draws the calendar of the header and names the link with the word, once', () => {
    renderWidget(<CalendarExtract events={[]} races={[]} today="2026-07-29" fill />)

    const link = screen.getByRole('link', { name: 'Ceo kalendar' })
    const drawing = link.querySelector('svg')
    const calendarOfTheHeader = NAV.find((section) => section.id === 'calendar')?.symbol

    expect(calendarOfTheHeader).toBe('calendar')
    expect(drawing?.getAttribute('data-symbol'), 'it is not the symbol of the header').toBe(calendarOfTheHeader)
    expect(drawing?.getAttribute('aria-hidden'), 'the drawing is read').toBe('true')
    expect(link.textContent, 'the word is not there twice, once to see and once to hear').toBe('Ceo kalendarCeo kalendar')
    expect(
      [...link.querySelectorAll('[aria-hidden="true"]')].filter((one) => one.textContent === 'Ceo kalendar'),
      'the word that is drawn is read as well',
    ).toHaveLength(1)
    expect(link.querySelector('.visually-hidden')?.textContent, 'the name is not the hidden word').toBe('Ceo kalendar')
  })

  it('calls the link "Full calendar" in English', () => {
    render(
      <I18nProvider locale="en">
        <MemoryRouter>
          <CalendarExtract events={[]} races={[]} today="2026-07-29" fill />
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(screen.getByRole('link', { name: 'Full calendar' })).toHaveAttribute(
      'href',
      '/en/kalendar?mesec=2026-07',
    )
    expect(screen.queryByText('The whole calendar')).toBeNull()
  })

  /* Owner, 08.11.2026 (PDL, „oznaka „i još N termina” se briše zauvek"): „Ne zelim da se ovde
     ispisuje ikad ista slicno, dakle ne zanima korisnika ima li jos neki datum nekad (ako je trka
     kopirana)." A name that runs more than once still takes one row, with its next date, and the
     row says nothing about the rest. The claim is on the whole text of the row, not on one word
     being absent: „+1", „još" and „again" are all as good as „termin" at saying it. */
  it('takes one row for a name that runs again, and the row is its date and its name and nothing else', () => {
    renderWidget(
      <CalendarExtract
        events={[
          event(5, 'BTL sreda', '2026-12-02'),
          event(6, 'BTL sreda', '2026-12-09'),
          event(7, 'BTL sreda', '2026-12-16'),
          event(8, 'Na tragu bizona', '2026-11-29'),
          event(9, 'Na tragu bizona', '2027-11-28'),
          event(4, 'Fruškogorski maraton', '2026-12-05'),
        ]}
        races={[]}
        today="2026-11-01"
        fill
      />,
    )

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.textContent)).toEqual([
      '29.11.Na tragu bizona',
      '02.12.BTL sreda',
      '05.12.Fruškogorski maraton',
    ])
    expect(screen.getByRole('link', { name: 'Na tragu bizona' })).toHaveAttribute(
      'href',
      '/sr/kalendar/dogadjaj-8',
    )
  })

  /* One dot per length actually run there, never one per race, and the names
     travel with them because a colour on its own says nothing to anybody who
     cannot separate two of them (owner, 31.07.2026). */
  it('marks the lengths an event holds, once each', () => {
    const { container } = renderWidget(
      <CalendarExtract
        events={[event(4, 'Fruškogorski maraton', '2026-12-05')]}
        races={races}
        today="2026-11-01"
        fill
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

