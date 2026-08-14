import { screen, within } from '@testing-library/react'
import { renderAt, renderWithI18n } from '../test/render'
import { must } from '../test/at'
import type { Team } from '../data/types'
import { TeamMark } from './TeamMark'

/* The circle before a team's name.
 *
 * Owner, 12.08.2026: a logo is added at team level and drawn in the table of
 * teams before the name, in a circle.
 *
 * Written after the fact, and that is the point of the comment: the mark went to
 * QA with no test at all, and coverage read 100 per cent because the mock data
 * happens to hold one team with a logo and three without, so both branches ran
 * while nothing asserted anything. A review proved it by taking the mark out of
 * the table of teams altogether: 1838 tests passed. A number is not a guarantee.
 */
const aTeam = (over: Partial<Team> = {}): Team => ({
  id: 'team-proba',
  slug: 'probni-tim',
  name: 'Dunavski trkači',
  city: 'Novi Sad',
  country: 'RS',
  organizerMemberNumber: '000001',
  bio: '',
  logo: null,
  ...over,
})

describe('the circle before a team name', () => {
  it('holds the initials of a team that has no logo', () => {
    renderWithI18n(<TeamMark team={aTeam()} />)

    expect(screen.getByText('DT')).toBeInTheDocument()
  })

  it('takes one letter per word, and never more than two', () => {
    /* Two words give two letters, three give two, one gives one. The one word
       case is the one the mock data has never had, so nothing walked it. */
    renderWithI18n(<TeamMark team={aTeam({ name: 'Nišavski maraton klub' })} />)

    expect(screen.getByText('NM')).toBeInTheDocument()

    renderWithI18n(<TeamMark team={aTeam({ id: 'x', name: 'Maratonci' })} />)

    expect(screen.getByText('M')).toBeInTheDocument()
  })

  it('draws the logo where there is one, and nothing else in the circle', () => {
    const { container } = renderWithI18n(
      <TeamMark team={aTeam({ logo: '/mock/logo/dunav.svg' })} />,
    )

    const drawn = must(container.querySelector('img'), 'the logo')

    expect(drawn).toHaveAttribute('src', '/mock/logo/dunav.svg')
    expect(screen.queryByText('DT')).not.toBeInTheDocument()
  })

  it('is decoration in both of its forms, so the name is read once', () => {
    /* The team's name is beside the circle as a link. A mark that carried the
       name as well would have a screen reader say it twice, and a mark that
       carried alternative text of its own would say something the link already
       says. Both forms are therefore hidden, and this holds both. */
    const { container: withLogo } = renderWithI18n(
      <TeamMark team={aTeam({ logo: '/mock/logo/dunav.svg' })} />,
    )

    expect(must(withLogo.querySelector('img'), 'the logo')).toHaveAttribute('aria-hidden', 'true')
    expect(must(withLogo.querySelector('img'), 'the logo')).toHaveAttribute('alt', '')

    const { container: withInitials } = renderWithI18n(<TeamMark team={aTeam()} />)

    expect(must(withInitials.querySelector('span'), 'the initials')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

})

describe('the table of teams', () => {
  it('draws a circle before every name', async () => {
    /* The whole of the request is that it is drawn there. Taken out of the
       table altogether, every test in the suite passed, so this is the one
       that would have said so. */
    renderAt('/sr/timovi')

    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)

    expect(rows.length).toBeGreaterThan(0)

    for (const row of rows) {
      const cell = within(row).getAllByRole('cell')[1]

      expect(must(cell, 'the name cell').querySelector('.team-mark')).not.toBeNull()
    }
  })
})
