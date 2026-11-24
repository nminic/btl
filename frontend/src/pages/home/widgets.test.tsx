import { matchingMedia } from '../../test/media'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import { at, first, htmlElement, must } from '../../test/at'
import { setupUser } from '../../test/user'
import { MemoryRouter } from 'react-router'
import type { Competitor, Result } from '../../data/types'
import { I18nProvider } from '../../i18n/I18nProvider'
import { Sponsor, SponsorStrip } from './Sponsor'
import { CATEGORIES } from '../../data/derive'
import { FIRST, NEXT } from './rotation'
import { addressOf } from '../profileAddress'
import { TopByCategory } from './TopByCategory'
import { RoleProvider } from '../../roles/RoleProvider'
import { SessionProvider } from '../../session/SessionProvider'
import { TopTen } from './TopTen'
import { Counters } from './Counters'
import { ColumnChart } from '../../components/ColumnChart'
import type { SponsorShown } from '../../data/types'

/* **Inside a session, since 06.09.2026.** Whether a name may lead to a profile now depends on
   who is reading: a member hiding from readers who may not read a hidden profile is drawn as plain
   text to them and as a link to everybody else (`profile/visible.ts`). A widget drawn outside a session
   cannot answer that, so the harness answers it: nobody signed in, which is the reading these
   cases have always been written for.

   **And inside a role, since 03.10.2026**, because the reading is asked of the role as well as of
   the number (the administration is a role, an active member is a number on the list the server
   serves): `app/App.tsx` mounts `RoleProvider` above everything, as a visitor until the server says
   who is reading, and this harness mounts it the same way. A case that renders the same widget
   again with new numbers goes through the same tree (`inAVisit`), because a tree of another shape
   would mount the widget afresh instead of giving it the numbers. */
function inAVisit(ui: React.ReactNode, memberNumber: string | null = null) {
  return (
    <I18nProvider locale="sr">
      <MemoryRouter>
        <RoleProvider>
          <SessionProvider initialMemberNumber={memberNumber}>{ui}</SessionProvider>
        </RoleProvider>
      </MemoryRouter>
    </I18nProvider>
  )
}

function renderWidget(ui: React.ReactNode, memberNumber: string | null = null) {
  return render(inAVisit(ui, memberNumber))
}

const competitor = (memberNumber: string): Competitor => ({
  memberNumber,
  firstName: 'Ime',
  lastName: memberNumber,
  gender: 'M',
  city: 'Beograd',
  country: 'RS',
  category: { season: 2027, ageBand: '40-54', beginner: false },
  categories: [{ season: 2027, ageBand: '40-54', beginner: false }],
  firstSeason: 2027,
  membershipBasis: 'payment',
  teamId: null,
  teamSince: null,
  profileHidden: false,
  birthdayShown: 'none',
  photo: null,
  smallPhoto: null,
  crop: null,
  bio: '',
})

let resultsMade = 0

const result = (memberNumber: string, points: number): Result => ({
  id: (resultsMade += 1),
  memberNumber,
  raceId: 1,
  raceName: 'Trka',
  eventName: 'Trka',
  eventSlug: 'trka',
  date: '2027-05-01',
  distanceKm: 10,
  ascentM: 0,
  descentM: 0,
  seconds: 3000,
  points,
  category: 'short',
  inItsSeason: true,
  inItsStanding: true,
})

describe('Sponsor', () => {
  /* Two of them, so that what the box draws is the first one's and could not have come from the
     other: a name, a logo, a description and an address of its own each. */
  const volt: SponsorShown = {
    id: 7,
    name: 'VOLT',
    url: 'https://volt.primer.rs/',
    logo: '/logo/volt.png',
    description: 'Energetsko piće za duge treninge i noćne trke.',
    language: 'sr',
  }
  const sofra: SponsorShown = {
    id: 3,
    name: 'Sofra',
    url: 'https://sofra.primer.rs/',
    logo: '/logo/sofra.png',
    description: 'Domaća kuhinja posle svake trke.',
    language: 'sr',
  }

  it('is one link around the logo and the name, to the sponsor, in a new window', () => {
    renderWidget(<Sponsor sponsor={volt} />)

    const box = screen.getByRole('region', { name: 'Sponzor dana' })
    /* One link, and the name is heard once: the logo is decoration inside it (draft of variant A, „Veze,
       i zašto jedna"). A logo carrying the name as its `alt` would make the name of the link „VOLT VOLT". */
    const link = within(box).getByRole('link', { name: 'VOLT (otvara se u novom prozoru)' })

    expect(within(box).getAllByRole('link')).toHaveLength(1)
    expect(link).toHaveAttribute('href', 'https://volt.primer.rs/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer noopener')
    expect(within(link).getByRole('presentation')).toHaveAttribute('src', '/logo/volt.png')
    expect(within(box).getByText('Energetsko piće za duge treninge i noćne trke.')).toBeVisible()
  })

  it('never writes the domain out', () => {
    /* „Domen sponzora se ne ispisuje." (PDL P24, 18.11.2026) */
    const { container } = renderWidget(<Sponsor sponsor={volt} />)

    expect(container.textContent).not.toContain('primer.rs')
  })

  it('draws every sponsor in the strip, in order, each a tile that leads to them', () => {
    renderWidget(<SponsorStrip sponsors={[volt, sofra]} />)

    const strip = screen.getByRole('region', { name: 'Sponzori i partneri' })
    const links = within(strip).getAllByRole('link')

    expect(links.map((one) => one.textContent)).toEqual([
      ' (otvara se u novom prozoru)',
      ' (otvara se u novom prozoru)',
    ])
    expect(links.map((one) => [one.getAttribute('href'), one.getAttribute('target')])).toEqual([
      ['https://volt.primer.rs/', '_blank'],
      ['https://sofra.primer.rs/', '_blank'],
    ])
    expect(within(strip).getAllByRole('img').map((one) => [one.getAttribute('alt'), one.getAttribute('src')])).toEqual([
      ['VOLT', '/logo/volt.png'],
      ['Sofra', '/logo/sofra.png'],
    ])
    expect(within(strip).getByRole('link', { name: 'Sofra (otvara se u novom prozoru)' })).toHaveAttribute(
      'rel',
      'noreferrer noopener',
    )
  })

  it('tells the stylesheet how many there are, which is what the rows are spaced by', () => {
    renderWidget(<SponsorStrip sponsors={[volt, sofra]} />)

    expect(within(screen.getByRole('region', { name: 'Sponzori i partneri' })).getByRole('list')).toHaveStyle({
      '--sponsors': '2',
    })
  })
})

/* **The day a board is read on, and never the date of a result** (owner, 17.10.2026: the Top 10 is
   filled with members who have not scored until 1.1.2027 and after that only with those who have).
   `result()` above is dated in May 2027, so neither of these days is the date of any result here. */
const THE_DAY_BEFORE = '2026-12-31'
const THE_FIRST_DAY = '2027-01-01'

describe('TopTen', () => {
  // Four, so the board is short of its ten and the empty places have to be
  // exercised as well as the full ones.
  const competitors = [
    competitor('000001'),
    competitor('000002'),
    competitor('000004'),
    competitor('000005'),
  ]

  /* Ten, each with points of their own, so that the podium and the list behind it are both full and
     every place is a different person. */
  const ten = Array.from({ length: 10 }, (_, index) => competitor(String(index + 1).padStart(6, '0')))
  const tenResults = ten.map((one, index) => result(one.memberNumber, 100 - index * 10))

  /** The two lists of a board, the podium and the rows behind it, whichever of their items are read. */
  function lists() {
    const found = screen.getAllByRole('list', { hidden: true })

    expect(found).toHaveLength(2)

    return { podium: at(found, 0), rows: at(found, 1) }
  }

  /* The board of 20.11.2026 (owner, PDL „Četiri dodatka naslovne iz tuđeg nacrta"): the first three on a
     podium with a name, points and a category each, and the seven behind them as a list. It stood as faces
     and numbers and nothing else from 31.07.2026, and that is overturned. */
  it('puts the first three on a podium, each with a name, points and a category', () => {
    renderWidget(
      <TopTen competitors={ten} results={tenResults} season={2027} today={THE_DAY_BEFORE} gender="M" />,
    )

    const { podium } = lists()
    const items = within(podium).getAllByRole('listitem')

    // The order of the markup is the order they are read in: the first, the second, the third.
    expect(items).toHaveLength(3)
    expect(items.map((one) => within(one).getByRole('link').getAttribute('aria-label'))).toEqual([
      '1. Ime 000001',
      '2. Ime 000002',
      '3. Ime 000003',
    ])
    expect(items.map((one) => within(one).getByText(/^\d[\d.,]*,\d\d$/).textContent)).toEqual([
      '100,00',
      '90,00',
      '80,00',
    ])
    expect(items.map((one) => within(one).getByText('M 40-54').textContent)).toEqual([
      'M 40-54',
      'M 40-54',
      'M 40-54',
    ])
    // The step has the place on it.
    expect(items.map((one) => within(one).getByText(/^\d\.$/).textContent)).toEqual(['1.', '2.', '3.'])
  })

  /* **Two lines, always, and one name to a screen reader** (owner, 20.11.2026). The first name is its own
     element and the surname is its own element, which is what keeps a long name from making its block
     taller than a short one; and the two are drawn for the eye only, since the link already says the
     name. */
  it('writes the name as two lines, the first name and the surname, and reads it once', () => {
    renderWidget(
      <TopTen competitors={ten} results={tenResults} season={2027} today={THE_DAY_BEFORE} gender="M" />,
    )

    const item = at(within(lists().podium).getAllByRole('listitem'), 0)
    const surname = within(item).getByText('000001')
    const name = must(surname.parentElement, 'the block of the name')

    expect(within(name).getByText('Ime')).not.toBe(surname)
    expect(name.children).toHaveLength(2)
    expect(name).toHaveAttribute('aria-hidden', 'true')
    // One link, called by place and name: the two lines are not a second reading of it.
    expect(within(item).getByRole('link', { name: '1. Ime 000001' })).toBeVisible()
    expect(within(item).queryByText('Ime 000001')).not.toBeInTheDocument()
  })

  /* **A place that was not won has no gold** (PDL, 18.10.2026, „Red bez trke ima redni broj, ali nikad boju
     postolja"). Nobody has raced, so the three hold their places and the ring is on none of them; and a
     member with no result at all has no history either, so the figure is 0,00 (owner, 21.11.2026). */
  it('draws no gold ring while the places are held and not won, and writes 0,00 p for a member with no result', () => {
    renderWidget(
      <TopTen competitors={competitors} results={[]} season={2027} today={THE_DAY_BEFORE} gender="M" />,
    )

    const items = within(lists().podium).getAllByRole('listitem')

    expect(items.map((one) => within(one).getByText(/^\d[\d.,]*,\d\d$/).textContent)).toEqual([
      '0,00',
      '0,00',
      '0,00',
    ])

    for (const one of items) {
      expect(one).not.toHaveClass('stand__item--won')
    }
  })

  it('draws the gold ring round the first place when it was won, and round nobody else', () => {
    renderWidget(
      <TopTen competitors={ten} results={tenResults} season={2027} today={THE_DAY_BEFORE} gender="M" />,
    )

    const items = within(lists().podium).getAllByRole('listitem')

    expect(items.map((one) => one.classList.contains('stand__item--won'))).toEqual([true, false, false])
  })

  /* One member has won a place and the others hold theirs: the first is ranked and the second is not, so
     it is the second that must have no ring, and the first, held and not won, none either. */
  it('draws no ring round a first place that only holds it', () => {
    renderWidget(
      <TopTen competitors={competitors} results={[result('000002', 20)]} season={2027} today={THE_DAY_BEFORE} gender="M" />,
    )

    const items = within(lists().podium).getAllByRole('listitem')

    // 000002 has the points and is first; the other two are held.
    expect(within(at(items, 0)).getByRole('link', { name: '1. Ime 000002' })).toBeVisible()
    expect(at(items, 0)).toHaveClass('stand__item--won')
    expect(within(at(items, 1)).getByText('0,00')).toBeVisible()
    expect(at(items, 1)).not.toHaveClass('stand__item--won')
  })

  it('lists the seven behind the podium as rows: number, name, category and points', () => {
    renderWidget(
      <TopTen competitors={ten} results={tenResults} season={2027} today={THE_DAY_BEFORE} gender="M" />,
    )

    const rows = within(lists().rows).getAllByRole('listitem')

    expect(rows).toHaveLength(7)
    expect(rows.map((one) => one.textContent)).toEqual([
      '4.I0Ime 000004M 40-5470,00',
      '5.I0Ime 000005M 40-5460,00',
      '6.I0Ime 000006M 40-5450,00',
      '7.I0Ime 000007M 40-5440,00',
      '8.I0Ime 000008M 40-5430,00',
      '9.I0Ime 000009M 40-5420,00',
      '10.I0Ime 000010M 40-5410,00',
    ])
    // The name of the row is a link to the member, and so is the circle beside it.
    expect(within(at(rows, 0)).getByRole('link', { name: 'Ime 000004' })).toHaveAttribute(
      'href',
      '/sr/takmicar/000004-ime-000004',
    )
    expect(lists().rows).toHaveAttribute('start', '4')
  })

  /* **The figure of the warm-up is the history, and it is the figure the order stands on** (owner,
     21.11.2026: „Dok je zagrevanje ... BTL bodovi ukupni kroz istoriju"; from 1.1.2027 the points of the
     season). The sums are chosen so that no other source can print them: 60,75 is three runs and is neither
     the last run (30,25) nor the best (30,25) nor the points of the season (the season has none yet); 50,20
     is two equal runs; 49,99 is one run; 7,09 is two small ones (0,07 and 7,02) and one run of nobody's
     (`memberNumber` null) and one of a member who is not on the board are in nobody's sum; and 000006 has
     no result at all. The order is 000001, 000002, 000003, 000005, 000006 and not the order of the numbers,
     and the figure is asserted beside every name so that an order and a figure that came from two sums
     would part. */
  describe('the history shown while the league warms up', () => {
    const before = (memberNumber: string | null, date: string, points: number): Result => ({
      ...result('000001', points),
      memberNumber,
      date,
      inItsSeason: false,
      inItsStanding: false,
    })
    const field = ['000006', '000005', '000003', '000002', '000001'].map(competitor)
    const history: Result[] = [
      before('000001', '2016-03-01', 30.25),
      before('000001', '2019-03-01', 20.5),
      before('000001', '2026-09-01', 10),
      before('000002', '2021-03-01', 25.1),
      before('000002', '2018-03-01', 25.1),
      before('000003', '2020-03-01', 49.99),
      before('000005', '2022-03-01', 0.07),
      before('000005', '2017-03-01', 7.02),
      before('000009', '2019-03-01', 900),
      before(null, '2019-03-01', 900),
    ]
    const shown = () => ({
      podium: within(lists().podium)
        .getAllByRole('listitem', { hidden: true })
        .map((one) => one.textContent),
      rows: within(lists().rows)
        .getAllByRole('listitem', { hidden: true })
        .slice(0, 2)
        .map((one) => one.textContent),
    })

    it('prints on the podium and in the list the sum the board is ordered by', () => {
      renderWidget(
        <TopTen competitors={field} results={history} season={2027} today={THE_DAY_BEFORE} gender="M" />,
      )

      /* The name is two elements and the figure follows it, so the text of a place reads „Ime" „000001" „60,75 p". */
      expect(shown().podium.map((one) => /Ime(\d{6})(\d[\d.]*,\d\d)/.exec(one ?? '')?.slice(1))).toEqual([
        ['000001', '60,75'],
        ['000002', '50,20'],
        ['000003', '49,99'],
      ])
      expect(shown().rows.map((one) => one?.replace(/^\d+\.I0Ime /, ''))).toEqual([
        '000005M 40-547,09',
        '000006M 40-540,00',
      ])
    })

    /* A result of 2027 read on the day before is not something production holds, but a fixture can, and the
       rule is „every member", so the member who has points of the season prints the history too: 60,75 and
       12,34 are 73,09, a figure neither of the two is. */
    /* A figure of thousands may break after the thousands separator and nowhere else (review of PR 768, WCAG
       1.4.4): the text is the same as ever, and a break is marked after every group but not inside the
       decimals, so „34.921,69" has one and „1.234.567,89" has two and „60,75" has none. */
    it('marks a place to break after each thousands separator, and does not change the text', () => {
      const big = [
        { ...before('000001', '2019-03-01', 34921.69) },
        { ...before('000002', '2019-03-01', 1234567.89) },
        { ...before('000003', '2019-03-01', 60.75) },
      ]

      renderWidget(
        <TopTen competitors={field} results={big} season={2027} today={THE_DAY_BEFORE} gender="M" />,
      )

      const figures = within(lists().podium)
        .getAllByRole('listitem', { hidden: true })
        .map((one) => must(one.querySelector('.stand__points'), 'the figure of a place'))

      expect(figures.map((one) => one.textContent)).toEqual(['1.234.567,89', '34.921,69', '60,75'])
      expect(figures.map((one) => one.querySelectorAll('wbr').length)).toEqual([2, 1, 0])
      /* The letter is worked out from the number of characters the page writes, and the unit is among them. */
      expect(figures.map((one) => one.getAttribute('style'))).toEqual(
        figures.map((one) => `--chars: ${one.textContent?.length};`),
      )
    })

    it('prints the history of a member who already has points of the season as well', () => {
      const raced = [...history, { ...result('000001', 12.34), date: '2027-03-01' }]

      renderWidget(
        <TopTen competitors={field} results={raced} season={2027} today={THE_DAY_BEFORE} gender="M" />,
      )

      expect(shown().podium.slice(0, 1).map((one) => /Ime(\d{6})(\d[\d.]*,\d\d)/.exec(one ?? '')?.slice(1))).toEqual([
        ['000001', '73,09'],
      ])
    })

    it('prints the points of the season, and not the history, from the first day of 2027', () => {
      const raced = [
        ...history,
        { ...result('000001', 12.34), date: '2027-03-01' },
        { ...result('000002', 5.55), date: '2027-03-02' },
      ]

      renderWidget(
        <TopTen competitors={field} results={raced} season={2027} today={THE_FIRST_DAY} gender="M" />,
      )

      expect(shown().podium.slice(0, 2).map((one) => /Ime(\d{6})(\d[\d.]*,\d\d)/.exec(one ?? '')?.slice(1))).toEqual([
        ['000001', '12,34'],
        ['000002', '5,55'],
      ])
    })
  })

  it('keeps the heading for a screen reader and does not draw it', () => {
    renderWidget(
      <TopTen competitors={ten} results={tenResults} season={2027} today={THE_DAY_BEFORE} gender="M" />,
    )

    expect(screen.getByRole('heading', { name: 'Top 10 muškarci' })).toHaveClass('visually-hidden')
  })

  /* „Kompletan poredak muškaraca →" and „žena →", to the same address the link „Cela tabela" went to. */
  it('ends in a link to the whole standing of its own gender', () => {
    renderWidget(
      <TopTen competitors={ten} results={tenResults} season={2027} today={THE_DAY_BEFORE} gender="M" />,
    )

    expect(screen.getByRole('link', { name: 'Kompletan poredak muškaraca' })).toHaveAttribute(
      'href',
      '/sr/tabela?pol=m',
    )
  })

  it('ends in the link of the women on a board of the women', () => {
    renderWidget(<TopTen competitors={[]} results={[]} season={2027} today={THE_DAY_BEFORE} gender="F" />)

    expect(screen.getByRole('link', { name: 'Kompletan poredak žena' })).toHaveAttribute(
      'href',
      '/sr/tabela?pol=z',
    )
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
        today={THE_DAY_BEFORE}
        gender="M"
      />,
    )

    const { podium, rows } = lists()

    /* Ten places in two lists, the podium and the seven behind it: a board headed "Top 10"
       that reports nine to a screen reader is not the board it says it is. */
    expect(within(podium).getAllByRole('listitem', { hidden: true })).toHaveLength(3)
    expect(within(rows).getAllByRole('listitem', { hidden: true })).toHaveLength(7)
    expect(within(podium).getAllByRole('listitem')).toHaveLength(3)
    expect(within(rows).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: /^\d+\. Ime/ })).toHaveLength(4)
  })

  it('numbers every place, from the leader to the tenth', () => {
    renderWidget(<TopTen competitors={competitors} results={[]} season={2027} today={THE_DAY_BEFORE} gender="M" />)

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

  /* The circle of a member who has sent no photograph, which is thirty of the
     thirty two served members. Two things it has to do: carry that person's
     initials, and carry NO colour that is theirs and not everybody's (PDL P28,
     31.07.2026, „Sve kartice takmičara su identične"; this case asked for the
     opposite until 21.10.2026, PENDING 29205). What the OTHER form of the circle
     does with an approved portrait is measured where the circle is, in
     `components/portrait.test.tsx`. */
  it('gives each face its own initials and the colour of all of them', () => {
    const { container } = renderWidget(
      <TopTen competitors={competitors} results={[]} season={2027} today={THE_DAY_BEFORE} gender="M" />,
    )

    // Only the ones with somebody in them: an empty place carries no colour.
    const faces = [...container.querySelectorAll('.portrait:not(.portrait--empty)')].map(
      htmlElement,
    )

    // "Ime" and the member number, which is what the fixture calls people.
    expect(first(faces).textContent).toBe('I0')
    expect(faces).toHaveLength(competitors.length)
    expect(faces.length).toBeGreaterThan(1)
    expect(faces.map((one) => one.style.getPropertyValue('--face-hue'))).toEqual(
      faces.map(() => ''),
    )
  })

  /* **A face with nowhere to go still says whose it is** (review, 07.09.2026).
     Everything drawn inside one of these circles is out of the reading: the circle carries
     `aria-hidden`, and so does the number beside it, because both are said by the name the link
     is called. Take the link away and the words go with it, and the item is then a place on a
     board of ten with nothing in it at all for a reader who cannot see the picture.

     **A branch inside this widget used to ask `!slot.active` and draw the plain circle itself**,
     which is the question `ProfileLink` answers for all eight screens that draw a competitor;
     hiding was added to that rule on 06.09.2026 and this widget knew nothing of it.

     **ONE REASON SINCE 21.09.2026, AND THE OTHER DOES NOT REACH THIS SCREEN AT ALL.** This read
     both halves at once, an inactive member and a hiding one, and the first half cannot be built
     any more: a member whose fee has run out is not in the list the portal is answered with
     (`/api/competitors`, owner 13.09.2026), and `boardOfTen` builds the board OUT OF that list,
     so such a member takes no place on it and there is no face of theirs to say anything about.
     What that state looks like is the second case below, an empty circle out of the reading, and
     it is measured there rather than pretended at here.

     Read against a second face that **is** a link, or „nobody is a link" would be the same
     sentence as „the board drew nothing". */
  it('says who a face is even where it leads nowhere', () => {
    const hiding = { ...competitor('000004'), profileHidden: true }

    renderWidget(
      <TopTen
        competitors={[competitor('000001'), hiding]}
        results={[result('000001', 30), result('000004', 10)]}
        season={2027}
        today={THE_DAY_BEFORE}
        gender="M"
      />,
    )

    /* The leader still has somewhere to go, which is what makes the other one mean something. */
    expect(screen.getByRole('link', { name: '1. Ime 000001' })).toBeVisible()

    for (const [place, who] of [['2', hiding]] as const) {
      const reading = `${place}. Ime ${who.memberNumber}`

      expect(screen.queryByRole('link', { name: reading })).toBeNull()
      /* The words are there **for a reader**, which is not the same as being in the markup:
         everything else in one of these circles carries `aria-hidden`, and a mutation that put
         the words behind it too was invisible to a plain `getByText`. So what is skipped here is
         the branch of the tree a screen reader skips.

         Asked of the item and not of the document, so a name written somewhere else on the card
         could not answer for this one. */
      const said = screen.getByText(reading, {
        ignore: 'script, style, [aria-hidden="true"], [aria-hidden="true"] *',
      })

      expect(must(said.closest('li'), 'the place on the board')).toBeVisible()
      /* **And out of the way of the eye**: the circle is the picture and the name beside it is drawn by
         the podium itself, so the words of the link are only for a reader. The class is the only thing
         doing that, and `.top10__face` has neither a size nor an `overflow` (`pages/Home.css`), so
         without it the words drop below the circle and stretch the cell. Held the way the portal
         already holds this elsewhere (`pages/Home.test.tsx`, `components/Resource.test.tsx`). */
      expect(said).toHaveClass('visually-hidden')
    }
  })

  describe('from 1 January 2027', () => {
    /* Owner, 17.10.2026, against the recommendation put to him: „Top 10 na naslovnoj se od
       1.1.2027 popunjava samo članovima sa bodovima." Four members have joined, and what the
       reader sees depends on the day alone. */
    it('shows no face at all when nobody has scored, although four have joined', () => {
      const { container } = renderWidget(
        <TopTen competitors={competitors} results={[]} season={2027} today={THE_FIRST_DAY} gender="M" />,
      )
      const { podium, rows } = lists()

      expect(screen.queryAllByRole('link', { name: /Ime/ })).toHaveLength(0)
      expect(container.querySelectorAll('.portrait:not(.portrait--empty)')).toHaveLength(0)
      /* The ten places are still drawn, so the two boards stay the height they are, and every
         one of them is out of the reading. */
      expect(within(podium).getAllByRole('listitem', { hidden: true })).toHaveLength(3)
      expect(within(rows).getAllByRole('listitem', { hidden: true })).toHaveLength(7)
      expect(within(podium).queryAllByRole('listitem')).toHaveLength(0)
      expect(within(rows).queryAllByRole('listitem')).toHaveLength(0)
    })

    it('shows the two who have scored and nobody behind them', () => {
      renderWidget(
        <TopTen
          competitors={competitors}
          results={[result('000001', 30), result('000004', 20)]}
          season={2027}
          today={THE_FIRST_DAY}
          gender="M"
        />,
      )
      const { podium, rows } = lists()

      expect(screen.getAllByRole('link', { name: /^\d+\. Ime/ })).toHaveLength(2)
      expect(screen.getByRole('link', { name: '1. Ime 000001' })).toBeVisible()
      expect(screen.getByRole('link', { name: '2. Ime 000004' })).toBeVisible()
      expect(within(podium).getAllByRole('listitem', { hidden: true })).toHaveLength(3)
      expect(within(rows).getAllByRole('listitem', { hidden: true })).toHaveLength(7)
      expect(within(podium).getAllByRole('listitem')).toHaveLength(2)
    })

    it('is empty on a later day as well', () => {
      renderWidget(
        <TopTen competitors={competitors} results={[]} season={2028} today="2028-06-01" gender="M" />,
      )

      expect(screen.queryAllByRole('link', { name: /Ime/ })).toHaveLength(0)
    })
  })

  it('still holds a place for each of the four on the last day of 2026, with nothing scored', () => {
    renderWidget(
      <TopTen competitors={competitors} results={[]} season={2027} today={THE_DAY_BEFORE} gender="M" />,
    )

    expect(screen.getAllByRole('link', { name: /^\d+\. Ime/ })).toHaveLength(4)
  })

  it('draws a circle and no link at all where the league has nobody', () => {
    renderWidget(<TopTen competitors={[]} results={[]} season={2027} today={THE_DAY_BEFORE} gender="F" />)

    expect(screen.queryByRole('link', { name: /Ime/ })).not.toBeInTheDocument()
    /* Ten empty places, and every one of them out of the reading: a board of ten
       circles with nobody in them is not ten facts. */
    const { podium, rows } = lists()

    expect(within(podium).getAllByRole('listitem', { hidden: true })).toHaveLength(3)
    expect(within(rows).getAllByRole('listitem', { hidden: true })).toHaveLength(7)
    expect(within(podium).queryAllByRole('listitem')).toHaveLength(0)
    expect(within(rows).queryAllByRole('listitem')).toHaveLength(0)
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

  /* The eighth tile, second after the members (owner, 20.11.2026): where they come from. */
  it('counts the cities the members come from, second after the members, when it is given them', () => {
    renderWidget(<Counters totals={totals} title="Sezona 2027." members={30} cities={11} countMs={0} />)

    const tiles = within(screen.getByRole('region', { name: 'Sezona 2027.' })).getAllByText(/:/, {
      selector: '.visually-hidden',
    })

    expect(tiles.map((one) => one.textContent)).toEqual([
      'Članova lige: ',
      'Gradova iz kojih dolaze članovi: ',
      'Prijavljenih rezultata: ',
      'Kilometara: ',
      'Uspona: ',
      'Spusta: ',
      'Na stazi: ',
      'BTL poeni: ',
    ])
    expect(screen.getByText(/^11 gradova$/)).toBeVisible()
  })

  it('declines the word for the cities by the number', () => {
    const { rerender } = renderWidget(<Counters totals={totals} title="Sezona 2027." cities={1} countMs={0} />)

    expect(screen.getByText(/^1 grad$/)).toBeVisible()

    rerender(inAVisit(<Counters totals={totals} title="Sezona 2027." cities={3} countMs={0} />))
    expect(screen.getByText(/^3 grada$/)).toBeVisible()
  })

  it('counts no cities where nobody hands them in', () => {
    renderWidget(<Counters totals={totals} title="Sezona 2027." members={30} countMs={0} />)

    expect(screen.queryByText(/grad/)).not.toBeInTheDocument()
  })

  /* A fault that was there: the figure of the results and the hours went out without the point for the
     thousands, and every other tile had it. The word is still chosen by the number. */
  it('writes every figure with the point for the thousands, and the word still goes by the number', () => {
    renderWidget(
      <Counters
        totals={{ ...totals, races: 2356, seconds: 8872 * 3600 + 5 * 60 + 28 }}
        title="Sezona 2027."
        members={1234}
        countMs={0}
      />,
    )

    expect(screen.getByText(/^2\.356 rezultata$/)).toBeVisible()
    expect(screen.getByText(/^8\.872 h 05' 28''$/)).toBeVisible()
    expect(screen.getByText(/^1\.234 člana$/)).toBeVisible()
  })

  it('writes it with the comma in English', () => {
    render(
      <I18nProvider locale="en">
        <MemoryRouter>
          <Counters
            totals={{ ...totals, races: 2356, seconds: 8872 * 3600 }}
            title="Season 2027"
            members={1234}
            cities={3000}
            countMs={0}
          />
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(screen.getByText(/^2,356 results$/)).toBeVisible()
    expect(screen.getByText(/^8,872 h 00' 00''$/)).toBeVisible()
    expect(screen.getByText(/^1,234 members$/)).toBeVisible()
    expect(screen.getByText(/^3,000 cities$/)).toBeVisible()
  })

  /* „Na velikom prikazu ovde treba da ostane BTL poena" and „da piše XX.XXX p / pts (zaokruženo bez decimala)":
     both shapes are in the markup and the stylesheet draws one of them by the width of the tile, so what is held
     here is what each says and that a screen reader is given the whole name either way. */
  it('has the points in two shapes: the whole sentence, and the rounded figure with a short unit', () => {
    renderWidget(
      <Counters totals={{ ...totals, points: 34921.69 }} title="Sezona 2027." countMs={0} />,
    )

    expect(screen.getByText('34.921,69 BTL poena')).toBeVisible()
    // Rounded, not cut: 34921,69 is 34.922.
    expect(screen.getByText('34.922 p')).toHaveAttribute('aria-hidden', 'true')
    // And what is read out of the short one is the whole name, rounded the same.
    expect(screen.getByText('34.922 BTL poena')).toHaveClass('visually-hidden')
  })

  it('writes the short unit in English as „pts"', () => {
    render(
      <I18nProvider locale="en">
        <MemoryRouter>
          <Counters totals={{ ...totals, points: 34921.69 }} title="Season 2027" countMs={0} />
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(screen.getByText('34,921.69 BTL points')).toBeVisible()
    expect(screen.getByText('34,922 pts')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('34,922 BTL points')).toHaveClass('visually-hidden')
  })

  it('gives the numbers straight away to anyone who asked for less motion', () => {
    const previous = window.matchMedia
    window.matchMedia = matchingMedia((query) => query.includes('reduced-motion'))

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
  it('draws the bar of somebody hiding, and hangs no address off it', () => {
    /* **The one way a bar leads nowhere, since 21.09.2026.** A bar carries more than a
       profile - it opens one already narrowed to the length the bar is about (owner,
       01.08.2026) - so the address and the query are put together in one place
       (`profile/visible.ts`, `appended`), and „there is no address" has to survive the
       appending or the reader gets a query hanging off nothing.

       This used to be walked by a member whose fee had run out. `/api/competitors` does
       not answer for such a member at all (owner, 13.09.2026), so they take no bar and
       there is nothing here to hang a query off. Hiding is the reason that is left, and it
       is the one that leaves the bar standing: read by somebody who may not read a hidden
       profile, it is unreachable and the name beside the bar is words (P23).

       Read against a second bar that IS a link, or „nothing is a link" would pass for
       „this one is not". */
    const hiding = { ...competitor('000002'), profileHidden: true }

    renderWidget(
      <TopByCategory
        competitors={[competitor('000001'), hiding]}
        results={[result('000001', 1), result('000002', 2), result('000002', 3)]}
        season={2027}
      />,
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByTitle('Ime 000002').tagName).toBe('SPAN')
  })

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
        results={[result('000001', 1), { ...result('000001', 2), category: 'long' as const }]}
        season={2027}
        turnMs={20}
      />,
    )

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/sr/takmicar/000001-ime-000001?sezona=2027&duzina=short',
    )

    await waitFor(() =>
      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        '/sr/takmicar/000001-ime-000001?sezona=2027&duzina=long',
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

  it('holds still while somebody has a column by the keyboard', async () => {
    /* A column is a link to one person's profile, and the turn changes which
       person each column is: the elements are kept and only what is in them is
       replaced (the test above holds that on purpose, because it is what makes
       the fade possible). A reader who tabs onto a column and reads it is
       therefore holding a link that becomes somebody else's under them, and
       pressing Enter opens a profile they never chose. WCAG 2.2 SC 3.2.5: a
       change of context nobody asked for.

       Nothing is announced and nothing moves; the turn simply waits until they
       leave, which is what a carousel does under a cursor. */
    const competitors = [competitor('000001'), competitor('000002')]
    const results = [
      { ...result('000001', 10), category: 'short' as const },
      { ...result('000002', 10), category: 'half' as const, distanceKm: 21.1 },
    ]

    renderWidget(
      <TopByCategory competitors={competitors} results={results} season={2027} turnMs={20} />,
    )

    const column = screen.getByRole('link')
    const opening = screen.getByText(/^Najviše/).textContent

    column.focus()

    expect(column).toHaveFocus()
    expect(column).toHaveAttribute('href', `/sr/takmicar/${addressOf(competitor('000001'))}?sezona=2027&duzina=short`)

    /* Five turns' worth of waiting, so „it did not turn" is not „it had not got
       round to it yet". */
    await new Promise((resolve) => {
      setTimeout(resolve, 100)
    })

    expect(screen.getByText(/^Najviše/).textContent).toBe(opening)
    expect(column).toHaveFocus()
    expect(column).toHaveAttribute('href', `/sr/takmicar/${addressOf(competitor('000001'))}?sezona=2027&duzina=short`)
  })

  it('goes on turning while the keyboard is on the button that stops it', async () => {
    /* The hold is on the bars, not on the whole widget, and this is why: the
       button means the same thing after a turn as before it, and it is the one
       control a reader presses in order to make the chart move. Held from the
       section, „Nastavi smenjivanje" would start nothing until they tabbed away
       from the very button they had just pressed. */
    const competitors = [competitor('000001'), competitor('000002')]
    const results = [
      { ...result('000001', 10), category: 'short' as const },
      { ...result('000002', 10), category: 'half' as const, distanceKm: 21.1 },
    ]

    renderWidget(
      <TopByCategory competitors={competitors} results={results} season={2027} turnMs={20} />,
    )

    const button = screen.getByRole('button')
    const opening = screen.getByText(/^Najviše/).textContent

    button.focus()

    expect(button).toHaveFocus()

    await waitFor(() => {
      expect(screen.getByText(/^Najviše/).textContent).not.toBe(opening)
    })
  })

  it('keeps holding while the keyboard moves from one column to the next', async () => {
    /* Tabbing along the bars is a blur and a focus in one breath. Read as a
       leaving, the turn would be let go of between every pair of columns and
       the chart could turn under the reader on the way. */
    const competitors = [competitor('000001'), competitor('000002')]
    const results = [
      { ...result('000001', 10), category: 'short' as const },
      { ...result('000002', 11), category: 'short' as const },
    ]

    renderWidget(
      <TopByCategory competitors={competitors} results={results} season={2027} turnMs={20} />,
    )

    const links = screen.getAllByRole('link')
    const opening = screen.getByText(/^Najviše/).textContent

    at(links, 0).focus()
    at(links, 1).focus()

    expect(at(links, 1)).toHaveFocus()

    await new Promise((resolve) => {
      setTimeout(resolve, 100)
    })

    expect(screen.getByText(/^Najviše/).textContent).toBe(opening)
  })

  it('puts back a turn that had already set off when a column is taken hold of', async () => {
    /* The turn is two steps: the words go out, and a third of a fade later what
       is counted changes. Holding only the first left the second to finish under
       a reader who arrived in between, and inside that window the link under
       their finger still became somebody else's. Measured by a review. */
    const competitors = [competitor('000001'), competitor('000002')]
    const results = [
      { ...result('000001', 10), category: 'short' as const },
      { ...result('000002', 10), category: 'half' as const, distanceKm: 21.1 },
    ]

    renderWidget(
      <TopByCategory competitors={competitors} results={results} season={2027} turnMs={300} />,
    )

    const chart = must(
      screen.getByText(/^Najviše/).closest<HTMLElement>('.colchart'),
      'the chart the band belongs to',
    )

    /* Caught in the middle of a turn, which is what the class says. */
    await waitFor(() => {
      expect(chart.className).toContain('colchart--swapping')
    })

    const column = screen.getByRole('link')
    const held = column.getAttribute('href')

    column.focus()

    /* Long enough for the swap that was already under way to have landed. */
    await new Promise((settled) => {
      setTimeout(settled, 400)
    })

    expect(column).toHaveFocus()
    expect(column).toHaveAttribute('href', held)
    expect(chart.className).not.toContain('colchart--swapping')
  })

  it('turns again after the column it was held by is taken out of the page', async () => {
    /* React sends no `focusout` for an element that is no longer there, so a
       remembered „held" would never be unremembered: the chart waited for a
       reader who had already gone, for ever, while the button went on offering
       to stop something standing still. Measured by a review, and the reason the
       hold is a question put to the page rather than a fact kept in a variable.
     *
       The same widget given new numbers, which is what happens on the front page
       by itself: `Home.tsx` works its season and its field out of `useToday()`,
       and the clock looks again every minute. */
    const competitors = [competitor('000001'), competitor('000002')]
    const two = [
      { ...result('000001', 10), category: 'short' as const },
      { ...result('000002', 10), category: 'short' as const },
    ]
    const one = [{ ...result('000001', 10), category: 'short' as const }]

    const { rerender } = renderWidget(
      <TopByCategory competitors={competitors} results={two} season={2027} turnMs={20} />,
    )

    const second = at(screen.getAllByRole('link'), 1)

    second.focus()

    expect(second).toHaveFocus()

    const opening = screen.getByText(/^Najviše/).textContent

    rerender(
      inAVisit(<TopByCategory competitors={competitors} results={one} season={2027} turnMs={20} />),
    )

    /* Gone from the page, and with it the focus: nothing announced it and
       nothing can, because the element that would have said so is the one that
       left. */
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(document.activeElement).toBe(document.body)

    await waitFor(() => {
      expect(screen.getByText(/^Najviše/).textContent).not.toBe(opening)
    })
  })

  it('turns again once the focus is somewhere else on the page, not only on the body', async () => {
    /* The hold is „is the focus inside these bars", and the weaker reading of it,
       „is the focus off the body", is the one that gets stuck: a reader whose
       focused column is taken away is often given the focus back somewhere else
       rather than dropped on the body.
     *
       This test measures that third element directly. The comment written with it
       claimed the weaker reading „passed everything", and a later review measured
       that it did not: it already failed the test about the button that stops the
       turning, because in that one the bars are never focused at all. The claim
       was wrong, the test is not; what it adds is the case where focus is inside
       the widget and outside the bars. */
    const competitors = [competitor('000001'), competitor('000002')]
    const results = [
      { ...result('000001', 10), category: 'short' as const },
      { ...result('000002', 10), category: 'half' as const, distanceKm: 21.1 },
    ]

    renderWidget(
      <>
        <TopByCategory competitors={competitors} results={results} season={2027} turnMs={20} />
        <button type="button">negde drugde</button>
      </>,
    )

    const column = screen.getByRole('link')
    const opening = screen.getByText(/^Najviše/).textContent

    column.focus()
    /* Away from the bars but not off the page, which is where a reader usually
       lands. */
    screen.getByRole('button', { name: 'negde drugde' }).focus()

    expect(document.activeElement).not.toBe(document.body)

    await waitFor(() => {
      expect(screen.getByText(/^Najviše/).textContent).not.toBe(opening)
    })
  })

  it('turns again once the keyboard has left it', async () => {
    /* The other half, and the one that says the hold is a hold and not a stop:
       a chart that never turned again would pass the test above.
     *
       Letting go and taking hold again between two columns really does happen,
       which a review measured: `onHeld` is called with the bars, then with
       nothing, then with the bars. Nothing gets through in that gap, because
       there is no turn of the loop in it for a timer to fire in. */
    const competitors = [competitor('000001'), competitor('000002')]
    const results = [
      { ...result('000001', 10), category: 'short' as const },
      { ...result('000002', 10), category: 'half' as const, distanceKm: 21.1 },
    ]

    renderWidget(
      <TopByCategory competitors={competitors} results={results} season={2027} turnMs={20} />,
    )

    const column = screen.getByRole('link')
    const opening = screen.getByText(/^Najviše/).textContent

    column.focus()
    column.blur()

    await waitFor(() => {
      expect(screen.getByText(/^Najviše/).textContent).not.toBe(opening)
    })
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
    window.matchMedia = matchingMedia((query) => query.includes('reduced-motion'))

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
    expect(screen.getByRole('region', { name: 'Najviše trka po distanci' })).toBeInTheDocument()
  })

  it('names the length underneath, and says so when nobody ran one', () => {
    renderWidget(<TopByCategory competitors={[]} results={[]} season={2027} />)

    expect(screen.getByText('Najviše kraćih trka')).toBeVisible()
    expect(screen.getByText('U ovoj sezoni još nema istrčanih trka ove distance.')).toBeVisible()
  })
})

describe('a member the portal no longer has, in a widget of a season they did race', () => {
  /* **THIS MEASURED THE OPPOSITE UNTIL 21.09.2026, AND THE CHANGE IS A COST RATHER THAN A
   * TIDY-UP.** It held the second half of PDL P11 over these widgets: a member whose fee had
   * run out kept their bar and their place on the board of a season they did race, drawn as
   * plain words rather than as a link, because „njihovo ime ostaje u tabelama sezona koje su
   * trčali". It could do that because the record was still there with a flag on it.
   *
   * `/api/competitors` does not answer for such a member at all (owner, 13.09.2026, and it is
   * what keeps anybody from reading their state out of the DIFFERENCE between two answers), and
   * every widget here is built out of that list: `boardOfTen` ranks it, and the chart draws it.
   * So there is no record left to take a name off, and their results are drawn by nobody.
   *
   * **What is measured below is therefore the new truth, not the old rule**, and it is measured
   * rather than left silent so that the day the server answers for them this case fails and
   * somebody decides which of the two the portal wants. The question is in `PENDING.md`. */
  const still = competitor('000001')

  it('draws no bar in the chart, because there is no record to name one', () => {
    renderWidget(
      <TopByCategory
        competitors={[still]}
        results={[result('000099', 1), result('000099', 2), result('000001', 3)]}
        season={2027}
      />,
    )

    /* One bar and not two, and the one is the member the answer still carries. */
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.queryByTitle('Ime 000099')).not.toBeInTheDocument()
  })

  it('takes no place in the top ten, although the results are still counted', () => {
    renderWidget(
      <TopTen
        competitors={[still]}
        results={[result('000099', 20), result('000001', 10)]}
        season={2027}
        today={THE_DAY_BEFORE}
        gender="M"
      />,
    )

    /* First place is the one member there is a record of, although twenty points were run by
       somebody there is not: the board is the list, and what is not on the list is not on the
       board in any shape, not even a nameless one. */
    expect(screen.queryByTitle('Ime 000099')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '1. Ime 000001' })).toBeInTheDocument()
  })
})
