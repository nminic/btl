import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import { first, must } from '../../test/at'
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
import { ColumnChart } from '../../components/ColumnChart'
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
  it('counts the members of the league when it is given them', () => {
    /* With the unrolling off, like every other counter test in this file. It ran
       on the real clock with a three second rope and failed on two runs out of
       four: a test that waits for time to pass makes the gate a coin toss, and
       the number it is about is the number at the end, never a frame on the way
       there (ADL A2). */
    renderWidget(<Counters totals={totals} title="Sezona 2027." members={41} countMs={0} />)

    expect(screen.getByText(/41 član/)).toBeVisible()
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

/* How wide the circle in a bar has to be (owner, 05.08.2026).
 *
 * Both levels of a bar carry a number and the lower one is the season before,
 * which can be the longer of the two. No season in the record happens to be that
 * way round, so the chart is handed one here: read off the upper level alone the
 * count comes out at four and the circle is drawn too small for what is in it,
 * and nothing on any screen would say so.
 */
describe('the circle in a bar', () => {
  it('is asked for in the characters of the longest number, on either level', () => {
    renderWidget(
      <ColumnChart
        columns={[
          {
            competitor: competitor('000001'),
            value: 10,
            label: '1,50',
            base: { value: 8, label: '1234,56' },
          },
        ]}
        caption="Napredak"
        empty="Nema"
        label="Napredak"
      />,
    )

    const chart = must(screen.getByRole('region', { name: 'Napredak' }), 'the chart')

    expect(chart.style.getPropertyValue('--count-chars')).toBe('7')
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

  it('keeps the room its pause control needs, which a board has no use for', () => {
    /* The disc sits in the top right corner and reaches 45,6px down, so the
       columns start below it or the tenth face is under it. The boards carry the
       same chart with no control, and there that band was fifty empty pixels
       above the bars (owner, 04.08.2026), so the room is asked for by the chart
       that has something to put in it.

       jsdom lays nothing out and applies no stylesheet, so what is checked is
       that the chart says which of the two it is, and that the stylesheet keeps
       the room for exactly that one. */
    renderWidget(<TopByCategory competitors={[]} results={[]} season={2027} />)

    const chart = must(
      screen.getByRole('button', { name: /smenjivanje/ }).closest('section'),
      'grafikon oko dugmeta',
    )

    expect(chart).toHaveClass('colchart--control')

    const css = readFileSync(join(process.cwd(), 'src/components/ColumnChart.css'), 'utf-8')
    const room = css.slice(css.indexOf('.colchart--control .colchart__columns {'))

    expect(room.slice(0, room.indexOf('}'))).toMatch(/padding-block-start:\s*3\.1rem/)
    /* And the plain chart asks for none of it. Anchored to the start of a line,
       or the rule for the chart that has a control matches it: its selector ends
       in the same two words. */
    expect(css).not.toMatch(/^\.colchart__columns \{[^}]*padding-block-start/m)
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

  it('keeps its columns across a turn, so a bar has a height to travel from', async () => {
    /* The whole of the smooth turn hangs on this. A column keyed by whoever
       stands in it is a different element after every turn: the old one is taken
       out, the new one comes in at its final height, and there is nothing to
       slide. Keyed by the place, the first column stays the first column and
       only what is in it changes, which is what the bar's own transition then
       has something to work with (owner, 11.08.2026).

       Held on the element itself rather than on a class name, because the
       element being the same one is exactly the claim. */
    const competitors = [competitor('000001'), competitor('000002')]
    /* One of each length, so the chart has a column to draw whichever of the
       two it is showing and there is something to keep across the turn. */
    const results = [
      { ...result('000001', 10), category: 'short' as const },
      { ...result('000002', 10), category: 'half' as const, distanceKm: 21.1 },
    ]

    renderWidget(
      <TopByCategory competitors={competitors} results={results} season={2027} turnMs={30} />,
    )

    const first = screen.getAllByRole('listitem')[0]
    const opening = screen.getByText(/^Najviše/).textContent

    await waitFor(() => {
      expect(screen.getByText(/^Najviše/).textContent).not.toBe(opening)
    })

    expect(screen.getAllByRole('listitem')[0]).toBe(first)
  })

  it('takes the words out while it turns, and brings them back', async () => {
    /* Initials, numbers and the gold band have nothing to slide between, so they
       fade (owner, 11.08.2026: „nazivi i kružići takmičara fadeuju u nove"). The
       widget says so with a class, and the stylesheet does the fading; what is
       held here is that the class is on while the two are apart and off once the
       new words are in. */
    renderWidget(<TopByCategory competitors={[]} results={[]} season={2027} turnMs={60} />)

    const chart = must(
      screen.getByText(/^Najviše/).closest<HTMLElement>('.colchart'),
      'the chart the band belongs to',
    )

    expect(chart).not.toHaveClass('colchart--swapping')

    await waitFor(() => {
      expect(chart).toHaveClass('colchart--swapping')
    })

    await waitFor(() => {
      expect(chart).not.toHaveClass('colchart--swapping')
    })
  })

  it('slides the bars and fades the words, and does neither for anybody who asked for less motion', () => {
    /* jsdom draws nothing and computes no layout, so what is held here is the
       stylesheet as text. The behaviour above proves the widget asks for the
       change; this proves the sheet answers it. */
    const css = readFileSync(join(process.cwd(), 'src/components/ColumnChart.css'), 'utf-8')
    /* Anchored to the start of a line: the same name ends the hover and focus
       rules above it, and a plain search finds one of those first. */
    const bar = css.slice(css.indexOf('\n.colchart__bar {'))

    // The height travels, which is the whole of the sliding bar.
    expect(bar.slice(0, bar.indexOf('}'))).toMatch(/transition:[^;]*block-size var\(--turn\)/)

    // And the words go out of sight while the two are apart.
    const swapping = css.slice(css.indexOf('.colchart--swapping .portrait,'))

    expect(swapping.slice(0, swapping.indexOf('}'))).toMatch(/opacity:\s*0/)

    /* Turned off in full for anybody who asked for less motion, and turned off
       last, so it wins over the rules above it (WCAG 2.2 SC 2.3.3). */
    const quiet = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))

    expect(quiet).toMatch(/\.colchart__bar,/)
    expect(quiet).toMatch(/opacity:\s*1/)
    expect(css.lastIndexOf('@media (prefers-reduced-motion: reduce)')).toBeGreaterThan(
      css.indexOf('.colchart--swapping .portrait,'),
    )
  })

  it('lets the request for less motion win over the rule that sets the motion', () => {
    /* A media query adds no specificity of its own, so a rule that turns motion
       off has to be written at least as deep as the rule that turned it on. Both
       reduced-motion blocks lost to `.colchart .colchart__column .portrait`
       while they were written shorter, and the faces went on sliding for exactly
       the people who asked them not to.
     *
       Held on the selectors and not on the order in the file, because order only
       decides between rules of equal weight, which was the very thing that was
       not true here. */
    const css = readFileSync(join(process.cwd(), 'src/components/ColumnChart.css'), 'utf-8')
    const setting = '.colchart .colchart__column .portrait'
    const quiet = css.split('@media (prefers-reduced-motion: reduce)').slice(1)

    expect(quiet).toHaveLength(2)

    for (const block of quiet) {
      expect(block.slice(0, block.indexOf('}'))).toContain(setting)
    }

    /* And they have to come after it, because equal weight is settled by order
       and these two now weigh the same. Written without this, the rule that sets
       the motion could be moved to the foot of the file and the faces would slide
       again for exactly the people who asked them not to, with nothing red. */
    /* The first of them, not the last: asked about the last, the rule that sets
       the motion could be pushed in between the two blocks and the earlier one
       would lose again. */
    const sets = css.indexOf(`${setting} {`)

    expect(sets).toBeGreaterThan(-1)
    expect(css.indexOf('@media (prefers-reduced-motion: reduce)')).toBeGreaterThan(sets)

    /* And the rule they have to beat is the one that names all three of the
       face's changes, so the test fails if that one is split up again. */
    const face = css.slice(css.indexOf(`${setting} {`))

    expect(face.slice(0, face.indexOf('}'))).toMatch(
      /transition:[^;]*opacity[^;]*inset-block-end/s,
    )
  })

  it('gives the sliding only to the chart that turns', () => {
    /* Nought by default and a real duration on the turning chart alone. Written
       the other way round, picking a season on Top liste set six boards sliding
       for a change nobody asked to see move. */
    const css = readFileSync(join(process.cwd(), 'src/components/ColumnChart.css'), 'utf-8')
    /* Every rule that names the duration, and which rule names it. Two of them
       and no more, so a third one written anywhere else would show up here
       rather than quietly setting six boards in motion. */
    const naming = [...css.matchAll(/([^{}]+)\{[^{}]*--turn:\s*([^;]+);/g)].map(
      (rule) => `${must(rule[1], 'a selector').trim().split('\n').pop()?.trim()} = ${must(rule[2], 'a duration').trim()}`,
    )

    expect(naming).toEqual([
      '.colchart = 0s',
      '.colchart--turns = 420ms cubic-bezier(0.4, 0, 0.2, 1)',
    ])
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
