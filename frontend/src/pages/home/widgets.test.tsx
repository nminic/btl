import { render, screen, waitFor, within } from '@testing-library/react'
import { setupUser } from '../../test/user'
import { MemoryRouter } from 'react-router'
import type { Competitor, Result } from '../../data/types'
import { I18nProvider } from '../../i18n/I18nProvider'
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

const competitor = (memberNumber: string, active = true): Competitor => ({
  memberNumber,
  firstName: 'Ime',
  lastName: memberNumber,
  gender: 'M',
  city: 'Beograd',
  country: 'RS',
  birthYear: 1985,
  firstSeason2027: false,
  firstSeason: 2027,
  membershipBasis: 'payment',
  teamId: null,
  teamSince: null,
  bio: '',
  active,
})

const result = (memberNumber: string, points: number): Result => ({
  id: `${memberNumber}-${points}`,
  memberNumber,
  raceId: 'r',
  eventName: 'Trka',
  eventSlug: 'trka',
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
  // Four, so the board is short of its ten and the empty places have to be
  // exercised as well as the full ones.
  const competitors = [
    competitor('000001'),
    competitor('000002'),
    competitor('000004'),
    competitor('000005'),
  ]

  /* The board in the shape the old portal had (owner, 31.07.2026): the leader
     large beside the heading, the other nine as a three by three block. */
  it('puts the leader above the rest, with the points they lead by', () => {
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

    expect(screen.getByText('30,00')).toBeVisible()
    expect(screen.queryByText(/ovo nije poredak/)).not.toBeInTheDocument()
  })

  /* The ten places are the height of the widget, so the two boards standing side
     by side line up in January as well as in December. Only those with a result
     are ranked, so two of the four here are on the board: one leads and one of
     the nine slots under them is filled, and the other eight are drawn empty. */
  it('keeps its ten places whether or not there is anybody to put in them', () => {
    const { container } = renderWidget(
      <TopTen
        competitors={competitors}
        results={[result('000001', 30), result('000002', 20)]}
        season={2027}
        gender="M"
      />,
    )

    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(9)
    expect(container.querySelectorAll('.portrait--empty')).toHaveLength(8)
  })

  it('lists who has joined, and says so, before the first race', () => {
    renderWidget(<TopTen competitors={competitors} results={[]} season={2027} gender="M" />)

    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(9)
    expect(screen.getByText(/ovo nije poredak/)).toBeVisible()
  })

  /* Nobody of that gender at all is not the same fact as nobody scoring yet, and
     the board that says the wrong one sends a reader looking for a fault. */
  it('says so when there is nobody on this board at all', () => {
    renderWidget(<TopTen competitors={[]} results={[]} season={2027} gender="F" />)

    expect(screen.getByText(/još nema nikoga/)).toBeVisible()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
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
    renderWidget(<Counters totals={totals} title="Sezona 2027." />)

    expect(await screen.findByText(/1\.234,00 km/, {}, { timeout: 3000 })).toBeVisible()
    // Every row carries its unit now, and time on the course is a quantity
    // rather than a clock reading (owner, 29.07.2026).
    // Each label sits in the same pill as its number, so these match on a part
    // of the line rather than the whole of it.
    expect(await screen.findByText(/10 h 00' 00''/, {}, { timeout: 3000 })).toBeVisible()
    // What is counted is results, not races: two members in one race are two of
    // these (owner, 31.07.2026).
    expect(await screen.findByText(/3 rezultata/, {}, { timeout: 3000 })).toBeVisible()
    expect(await screen.findByText(/5\.678 m\+/, {}, { timeout: 3000 })).toBeVisible()
    expect(await screen.findByText(/5\.000 m-/, {}, { timeout: 3000 })).toBeVisible()
    expect(await screen.findByText(/42,00 BTL poena/, {}, { timeout: 3000 })).toBeVisible()
  })

  /* The front page counts members on top of the season, and nothing else does:
     on a team and on a profile the number of people is one or is the heading
     (owner, 31.07.2026). */
  it('counts the members of the league when it is given them', async () => {
    renderWidget(<Counters totals={totals} title="Sezona 2027." members={41} />)

    expect(await screen.findByText(/41 član/, {}, { timeout: 3000 })).toBeVisible()
  })

  it('counts no members where nobody hands them in', async () => {
    renderWidget(<Counters totals={totals} title="Sezona 2027." />)

    // Waited for, so the row is absent after the numbers have finished
    // unrolling and not merely before they started.
    expect(await screen.findByText(/3 rezultata/, {}, { timeout: 3000 })).toBeVisible()
    expect(screen.queryByText(/član/)).not.toBeInTheDocument()
  })

  it('gives the numbers straight away to anyone who asked for less motion', () => {
    const previous = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduced-motion'),
      media: query,
    })) as typeof matchMedia

    renderWidget(<Counters totals={totals} title="Sezona 2027." />)

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

    await waitFor(() => expect(screen.getByText(/^Najviše/).textContent).not.toBe(first))
  })

  it('can be stopped, and stays stopped', async () => {
    /* WCAG 2.2 SC 2.2.2, level A: anything that moves by itself for more than
       five seconds beside other content has to be stoppable. This turned every
       six seconds, forever, with nothing to press. */
    const user = setupUser()
    renderWidget(<TopByCategory competitors={[]} results={[]} season={2027} turnMs={20} />)

    expect(
      screen.getByRole('button', { name: 'Zaustavi smenjivanje' }).querySelectorAll('svg > *'),
    ).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Zaustavi smenjivanje' }))
    const stopped = screen.getByText(/^Najviše/).textContent

    // Four turns' worth of waiting, and it has not moved.
    await new Promise((wait) => setTimeout(wait, 80))

    expect(screen.getByText(/^Najviše/).textContent).toBe(stopped)
    /* The name carries the whole state and there is no `aria-pressed` beside
       it: the two together announced "Nastavi smenjivanje, pressed", which is
       heard as the opposite of what is true. */
    expect(screen.getByRole('button', { name: 'Nastavi smenjivanje' })).toBeVisible()
    /* And it wears the mark of what it will do: a triangle while it is stopped,
       two bars while it is turning (owner, 31.07.2026). Held on the drawing
       itself, because the name alone would pass on a button with no icon in it
       at all, which is what this button now is apart from the icon. */
    expect(
      screen.getByRole('button', { name: 'Nastavi smenjivanje' }).querySelectorAll('svg > *'),
    ).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Nastavi smenjivanje' })).not.toHaveAttribute(
      'aria-pressed',
    )
  })

  it('starts stopped for anyone who asked for less motion', async () => {
    const previous = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduced-motion'),
      media: query,
    })) as typeof matchMedia

    try {
      renderWidget(<TopByCategory competitors={[]} results={[]} season={2027} turnMs={10} />)

      const first = screen.getByText(/^Najviše/).textContent
      expect(screen.getByRole('button', { name: 'Nastavi smenjivanje' })).toBeVisible()

      await new Promise((wait) => setTimeout(wait, 60))
      expect(screen.getByText(/^Najviše/).textContent).toBe(first)
    } finally {
      window.matchMedia = previous
    }
  })

  it('is a named region rather than one that changes under the reader unannounced', () => {
    renderWidget(<TopByCategory competitors={[]} results={[]} season={2027} />)

    // It carried `aria-live="off"`, which is the default and does nothing, and
    // had no heading, so the region had no name at all.
    expect(screen.getByRole('region', { name: 'Najviše trka po dužini' })).toBeInTheDocument()
  })

  it('names the length underneath, and says so when nobody ran one', () => {
    renderWidget(<TopByCategory competitors={[]} results={[]} season={2027} />)

    expect(screen.getByText('Najviše kraćih trka')).toBeVisible()
    expect(screen.getByText('U ovoj sezoni još nema odtrčanih trka ove dužine.')).toBeVisible()
  })
})

describe('a member whose fee has run out, in a widget of a season they did race', () => {
  /* Two halves of PDL P11, and these widgets keep the second one.
   *
   * The first half, that they are not in the season running now at all, belongs
   * to the page: `Home` narrows the field before it hands it over, and so does
   * the page of boards. The second half, that nothing links to a profile that is
   * hidden, belongs here, because these are the same widgets that draw a season
   * already run. */
  const gone = competitor('000099', false)
  const still = competitor('000001')

  it('has a bar in the chart, and the bar is not a link', () => {
    renderWidget(
      <TopByCategory
        competitors={[gone, still]}
        results={[result('000099', 1), result('000099', 2), result('000001', 3)]}
        season={2027}
      />,
    )

    const bars = screen.getAllByRole('listitem')
    expect(bars).toHaveLength(2)
    // One of the two names is a link and the other is not.
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByTitle('Ime 000099').tagName).toBe('SPAN')
  })

  it('is named in the top ten without a link on the name', () => {
    renderWidget(
      <TopTen
        competitors={[gone, still]}
        results={[result('000099', 20), result('000001', 10)]}
        season={2027}
        gender="M"
      />,
    )

    expect(screen.getByText('Ime 000099')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Ime 000099' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ime 000001' })).toBeInTheDocument()
  })
})
