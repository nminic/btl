import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import { first } from '../../test/at'
import { setupUser } from '../../test/user'
import { MemoryRouter } from 'react-router'
import type { Competitor, Result } from '../../data/types'
import { I18nProvider } from '../../i18n/I18nProvider'
import { News } from './News'
import { Sponsor, SponsorStrip } from './Sponsor'
import { CATEGORIES } from '../../data/derive'
import { FIRST, NEXT } from './rotation'
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
    textKey: 'home.seeCalendar',
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

  /* The board in the shape the old portal had (owner, 31.07.2026): round faces
     carrying the number of their place, and nothing else. No names under the
     circles, no points beside them, no sentence underneath. */
  it('is faces and numbers, and says nothing else', () => {
    renderWidget(
      <TopTen
        competitors={competitors}
        results={[result('000001', 30), result('000002', 20)]}
        season={2027}
        gender="M"
      />,
    )

    // The leader is a link called by their place and their name, and the name
    // is nowhere on the card as text.
    expect(screen.getByRole('link', { name: '1. Ime 000001' })).toBeVisible()
    expect(screen.queryByText('Ime 000001')).not.toBeInTheDocument()
    expect(screen.queryByText(/BTL poena/)).not.toBeInTheDocument()
    expect(screen.queryByText(/30,00/)).not.toBeInTheDocument()
  })

  /* The ten places are the height of the widget, so the two boards standing side
     by side line up in January as well as in December. Two of the four here have
     raced and the other two hold places behind them (PDL P14), which leaves six
     places drawn and empty. An empty place is out of the reading entirely, so
     the two counts are what tells them apart. */
  it('keeps its ten places, and tops them up with members who have not raced', () => {
    renderWidget(
      <TopTen
        competitors={competitors}
        results={[result('000001', 30), result('000002', 20)]}
        season={2027}
        gender="M"
      />,
    )

    const block = screen.getByRole('list')

    /* Ten places in one list, the leader among them: a board headed "Top 10"
       that reports nine to a screen reader is not the board it says it is. */
    expect(within(block).getAllByRole('listitem', { hidden: true })).toHaveLength(10)
    expect(within(block).getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getAllByRole('link', { name: /^\d+\. Ime/ })).toHaveLength(4)
  })

  it('numbers every place, from the leader to the tenth', () => {
    renderWidget(<TopTen competitors={competitors} results={[]} season={2027} gender="M" />)

    expect(screen.getAllByText(/^\d+\.$/).map((one) => one.textContent)).toEqual([
      '1.',
      '2.',
      '3.',
      '4.',
      '5.',
      '6.',
      '7.',
      '8.',
      '9.',
      '10.',
    ])
  })

  /* The circle is the face until there are photographs. Two things it has to
     do: carry that person's initials, and carry a colour that is theirs and not
     everybody's. Both survived being taken away. */
  it('gives each face its own initials and its own colour', () => {
    const { container } = renderWidget(
      <TopTen competitors={competitors} results={[]} season={2027} gender="M" />,
    )

    // Only the ones with somebody in them: an empty place carries no colour.
    const faces = [
      ...container.querySelectorAll('.portrait:not(.portrait--empty)'),
    ] as HTMLElement[]

    // "Ime" and the member number, which is what the fixture calls people.
    expect(first(faces).textContent).toBe('I0')
    expect(new Set(faces.map((one) => one.style.getPropertyValue('--face-hue'))).size).toBe(
      competitors.length,
    )
  })

  it('draws a circle and no link at all where the league has nobody', () => {
    renderWidget(<TopTen competitors={[]} results={[]} season={2027} gender="F" />)

    expect(screen.queryByRole('link', { name: /Ime/ })).not.toBeInTheDocument()
    /* Ten empty places, and every one of them out of the reading: a board of ten
       circles with nobody in them is not ten facts. */
    const block = screen.getByRole('list')

    expect(within(block).getAllByRole('listitem', { hidden: true })).toHaveLength(10)
    expect(within(block).queryAllByRole('listitem')).toHaveLength(0)
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

  it('lands on the real numbers, each carrying its own unit', () => {
    /* With the unrolling switched off. Six counters over nine hundred
       milliseconds of real time made this the one test in the suite that waited
       on a clock, and under load it failed while everything it checks was
       right. That the numbers do unroll is the hook's own test. */
    renderWidget(<Counters totals={totals} title="Sezona 2027." countMs={0} />)

    expect(screen.getByText(/1\.234,00 km/)).toBeVisible()
    // Every row carries its unit now, and time on the course is a quantity
    // rather than a clock reading (owner, 29.07.2026).
    // Each label sits in the same pill as its number, so these match on a part
    // of the line rather than the whole of it.
    expect(screen.getByText(/10 h 00' 00''/)).toBeVisible()
    // What is counted is results, not races: two members in one race are two of
    // these (owner, 31.07.2026).
    expect(screen.getByText(/3 rezultata/)).toBeVisible()
    expect(screen.getByText(/5\.678 m\+/)).toBeVisible()
    expect(screen.getByText(/5\.000 m-/)).toBeVisible()
    expect(screen.getByText(/42,00 BTL poena/)).toBeVisible()
  })

  /* The front page counts members on top of the season, and nothing else does:
     on a team and on a profile the number of people is one or is the heading
     (owner, 31.07.2026). */
  it('counts the members of the league when it is given them', async () => {
    renderWidget(<Counters totals={totals} title="Sezona 2027." members={41} />)

    expect(await screen.findByText(/41 član/, {}, { timeout: 3000 })).toBeVisible()
  })

  it('counts no members where nobody hands them in', () => {
    renderWidget(<Counters totals={totals} title="Sezona 2027." countMs={0} />)

    // The rest of the rows have landed, so the missing one is missing rather
    // than merely late.
    expect(screen.getByText(/3 rezultata/)).toBeVisible()
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

  it('leads to the same thing it is showing, not to the whole of a running life', async () => {
    /* Owner, 01.08.2026: a bar under "Najviše kraćih trka" led to somebody's
       profile with no filter, so the reader had to find the short races again by
       hand. The season is written out as well, because a profile opens on all
       seasons by default and leaving it out would widen exactly what was
       pressed.

       Two lengths and a turn, because one frame proves nothing: the chart opens
       on the short races, so a bar wired to the word "short" rather than to what
       is on screen would pass the first assertion and fail the second. */
    renderWidget(
      <TopByCategory
        competitors={[competitor('000001')]}
        results={[result('000001', 1), { ...result('000001', 2), id: 'long', category: 'long' }]}
        season={2027}
        turnMs={20}
      />,
    )

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/sr/takmicar/000001?sezona=2027&duzina=short',
    )

    await waitFor(() =>
      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        '/sr/takmicar/000001?sezona=2027&duzina=long',
      ),
    )
  })

  it('makes the face and the bar one link, which lights as a whole', () => {
    /* Owner, 01.08.2026: a pointer over the face or over the bar rings the face,
       darkens the bar and prints the name, and the whole column leads to that
       person. Two links to one place would have given the keyboard two stops for
       one destination, one of them named "SV".

       Read off disk, because jsdom applies no stylesheet and has no hover. What
       is checked here is that each of the three states is written for the
       keyboard as well: a state only a mouse can reach does not exist for
       somebody who types. */
    const css = readFileSync(join(process.cwd(), 'src/components/ColumnChart.css'), 'utf-8')

    for (const part of ['.portrait', '.colchart__bar', '.colchart__who']) {
      expect(css, `nothing lights ${part} on hover`).toContain(`.colchart__link:hover ${part}`)
      expect(css, `${part} lights for the mouse only`).toContain(
        `.colchart__link:focus-visible ${part}`,
      )
    }
  })

  it('leads from the face as well as from the bar, by one link', () => {
    renderWidget(
      <TopByCategory
        competitors={[competitor('000001')]}
        results={[result('000001', 1)]}
        season={2027}
      />,
    )

    const links = screen.getAllByRole('link')

    expect(links).toHaveLength(1)
    expect(first(links)).toContainElement(screen.getByText('I0'))
  })

  it('turns through the five in the order they are shown in', async () => {
    /* The order was put right in CATEGORIES on 01.08.2026 and the chart kept a
       map of its own, so the front page went on cycling short, long, half. The
       caption changing was all that was ever checked, and a caption changes
       whatever the order is. */
    const round: string[] = []
    let at = FIRST

    for (const _ of CATEGORIES) {
      round.push(at)
      at = NEXT[at]
    }

    expect(round).toEqual(CATEGORIES)
    expect(NEXT[at]).toBe(NEXT[FIRST])
  })

  it('turns to the next length by itself', async () => {
    renderWidget(
      <TopByCategory competitors={[]} results={[]} season={2027} turnMs={20} />,
    )

    const shown = screen.getByText(/^Najviše/).textContent

    await waitFor(() => expect(screen.getByText(/^Najviše/).textContent).not.toBe(shown))
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

      const shown = screen.getByText(/^Najviše/).textContent
      expect(screen.getByRole('button', { name: 'Nastavi smenjivanje' })).toBeVisible()

      await new Promise((wait) => setTimeout(wait, 60))
      expect(screen.getByText(/^Najviše/).textContent).toBe(shown)
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

  it('holds a place in the top ten, and it is no way to a profile', () => {
    renderWidget(
      <TopTen
        competitors={[gone, still]}
        results={[result('000099', 20), result('000001', 10)]}
        season={2027}
        gender="M"
      />,
    )

    /* Their face is on the board of the season they raced, in first place, and
       it goes nowhere: the profile is not there to go to (PDL P11). The one
       behind them is a link. */
    expect(screen.getByTitle('Ime 000099').tagName).toBe('SPAN')
    expect(screen.queryByRole('link', { name: /Ime 000099/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '2. Ime 000001' })).toBeInTheDocument()
  })
})
