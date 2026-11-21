import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { Competitor, Result } from '../../data/types'
import { I18nProvider } from '../../i18n/I18nProvider'
import { RoleProvider } from '../../roles/RoleProvider'
import { SessionProvider } from '../../session/SessionProvider'
import { CalendarExtract } from './CalendarExtract'
import { Counters } from './Counters'
import { TopTen } from './TopTen'

/**
 * WHAT THE FRONT PAGE'S MARKUP AND ITS STYLESHEETS SAY TO EACH OTHER (owner, 20.11.2026, PDL „Četiri dodatka
 * naslovne iz tuđeg nacrta").
 *
 * jsdom reads no stylesheet, so a class the page writes and a rule the sheet holds are held to each other here
 * as text, and the few rules whose whole point is a number or a query are read for it. Where a case is a
 * measurement, `geometry/frontPage.geometry.ts` makes it in Chrome.
 */

const home = readFileSync(join(process.cwd(), 'src/pages/Home.css'), 'utf-8').replaceAll('\r\n', '\n')
const counter = readFileSync(join(process.cwd(), 'src/styles/counter.css'), 'utf-8').replaceAll('\r\n', '\n')
const sheets = `${home}\n${counter}`

const person = (memberNumber: string): Competitor => ({
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

const TEN = Array.from({ length: 10 }, (_, index) => person(String(index + 1).padStart(6, '0')))
const RESULTS: Result[] = TEN.map((one, index) => ({
  id: index + 1,
  memberNumber: one.memberNumber,
  raceId: 1,
  raceName: 'Trka',
  eventName: 'Trka',
  eventSlug: 'trka',
  date: '2027-05-01',
  distanceKm: 10,
  ascentM: 0,
  descentM: 0,
  seconds: 3000,
  points: 100 - index,
  category: 'short',
  inItsSeason: true,
  inItsStanding: true,
}))

/** The body of the first rule that opens with this selector, at the top level of the sheet or inside a query. */
function body(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`)

  expect(at, `${selector} is not a rule of its own`).toBeGreaterThan(-1)

  return css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at))
}

describe('the markup of the front page and the sheets that dress it', () => {
  it('has a rule for every class the podium, the list, the filter and the figures write', () => {
    const { container } = render(
      <I18nProvider locale="sr">
        <MemoryRouter>
          <RoleProvider>
            <SessionProvider initialMemberNumber={null}>
              <TopTen competitors={TEN} results={RESULTS} season={2027} today="2026-12-31" gender="M" />
              <Counters
                totals={{ races: 1, kilometers: 1, ascent: 1, descent: 1, seconds: 1, points: 1 }}
                title="Sezona"
                members={1}
                cities={1}
                countMs={0}
              />
              <CalendarExtract events={[]} races={[]} today="2027-01-01" fill />
            </SessionProvider>
          </RoleProvider>
        </MemoryRouter>
      </I18nProvider>,
    )

    const written = new Set(
      [...container.querySelectorAll('[class]')]
        .flatMap((one) => [...one.classList])
        /* `toprow` is the name of a row and is dressed through `.toprows li`; it carries no rule of its own. */
        .filter((name) => name !== 'toprow')
        .filter((name) => /^(stand|toprow|seg|score__(full|short)|top10)/.test(name) || ['no', 'nm', 'kt', 'pt'].includes(name)),
    )

    // Not an empty parse.
    expect(written.size).toBeGreaterThan(15)

    for (const name of written) {
      expect(sheets, `.${name} is written by the page and no sheet has a rule for it`).toMatch(
        new RegExp(`\\.${name}(?![\\w-])`),
      )
    }
  })

  it('draws the whole sentence of the points by default and the short one only in a narrow tile', () => {
    expect(body(counter, '.score__short')).toContain('display: none')
    expect(counter).toMatch(/@container \(max-width: [\d.]+rem\) \{\s*\.score__full \{\s*display: none;/)
    expect(counter).toMatch(/\.score__short \{\s*display: inline;/)
    expect(counter).toMatch(/\.score \{\s*container-type: inline-size;/)
  })

  it('takes only the unit off the filter when the card is narrow, and asks the card and not the window', () => {
    expect(home).toMatch(/@container \(max-width: [\d.]+rem\) \{\s*\.seg__km \{\s*display: none;/)
    expect(home).toMatch(/\.home__next > \.card \{\s*container-type: inline-size;/)
  })

  it('steps the podium down from the first to the third, with the first circle the largest', () => {
    const step = (place: number) =>
      Number(/block-size: (\d+)px/.exec(body(home, `.stand__item--${String(place)} .stand__step`))?.[1])

    expect(step(1)).toBeGreaterThan(step(2))
    expect(step(2)).toBeGreaterThan(step(3))
    expect(step(3)).toBeGreaterThan(0)
    expect(home).toContain("grid-template-areas: 'two one three';")
    expect(body(home, '.home .top10 .stand__item--1 .portrait')).toMatch(/inline-size: 5\.25rem/)
    expect(body(home, '.home .top10 .stand__item .portrait')).toMatch(/inline-size: 4rem/)
  })

  it('sets a name in the letter that fits its column, with a floor, and never breaks it', () => {
    const line = body(home, '.stand__first,\n.stand__last')

    expect(line).toContain('white-space: nowrap')
    expect(line).toMatch(
      /clamp\(\s*0\.65rem,\s*calc\(\(100cqi - 2 \* var\(--space-6\)\) \/ 3\.15 \/ \(var\(--chars\) \* 0\.66\)\),\s*var\(--base\)\s*\)/,
    )
    expect(line).toContain('display: block')
    // The block keeps two lines of the size of the place, whatever is set in them.
    expect(body(home, '.stand__name')).toContain('min-block-size: 2.5em')
    expect(body(home, '.stand__name')).not.toMatch(/overflow-wrap/)
  })

  it('writes the number of letters of each line of the name for the stylesheet', () => {
    const { container } = render(
      <I18nProvider locale="sr">
        <MemoryRouter>
          <RoleProvider>
            <SessionProvider initialMemberNumber={null}>
              <TopTen
                competitors={[{ ...person('000001'), firstName: 'Ana', lastName: 'Stamenkovska' }]}
                results={[]}
                season={2027}
                today="2026-12-31"
                gender="M"
              />
            </SessionProvider>
          </RoleProvider>
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(container.querySelector('.stand__first')).toHaveStyle({ '--chars': '3' })
    expect(container.querySelector('.stand__last')).toHaveStyle({ '--chars': '12' })
  })

  it('puts the category under the name on every width, and asks nothing of the board for it', () => {
    /* Owner, 21.11.2026: the category stands under the name on every width. The rule of 20.11.2026 did it in a
       board narrower than about 300px, by a container query, and it is gone and not left as one nothing meets. */
    expect(body(home, '.toprows .kt')).toMatch(/grid-column: 3;\s*grid-row: 2;/)
    expect(body(home, '.toprows .nm')).toMatch(/grid-column: 3;\s*grid-row: 1;/)
    expect(body(home, '.toprows .pt')).toMatch(/grid-column: 4;\s*grid-row: 1 \/ span 2;/)
    expect(home).not.toContain('@container (max-width: 16.625rem)')
  })

  it('lays the list on one grid and every row on a subgrid of it, so the columns are shared', () => {
    expect(body(home, '.toprows li')).toContain('grid-template-columns: subgrid')
    expect(body(home, '.toprows li')).toContain('grid-column: 1 / -1')
  })

  it('never cuts a name of the list: it wraps where it does not fit, and nothing clips the ring of focus', () => {
    expect(body(home, '.toprows .nm')).toMatch(/overflow-wrap: anywhere/)
    expect(body(home, '.toprows .nm')).not.toMatch(/text-overflow|nowrap|overflow: hidden/)
    expect(body(home, '.toprows .kt')).not.toMatch(/text-overflow|nowrap|overflow: hidden/)
    expect(body(home, '.toprows li')).toContain('min-block-size: 2.75rem')
  })
})
