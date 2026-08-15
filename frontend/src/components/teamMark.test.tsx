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
  crop: { x: 0.5, y: 0.5, size: 1 },
  bio: '',
  logo: null,
  ...over,
})

/**
 * A team as it actually arrives: parsed out of text.
 *
 * Every record on this portal is read out of JSON, which is why nothing can
 * vouch for its shape and why there is a check to read a crop through
 * (components/crop.ts). Round tripping through text here also drops a field
 * that was never set, which is the case that mattered: the missing key, not the
 * wrong value.
 */
function asRead(record: object): Team {
  return JSON.parse(JSON.stringify(record))
}
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

  it('cuts the logo where the team cut it', () => {
    /* Owner, 12.08.2026: a member arranges the square and „Korisnik treba da
       može da sačuva kropovan format". Drawn by the browser's own way of showing
       part of a picture, which needs no width and no height (`fittedTo` in
       components/crop.ts), so what is asserted is the three properties it
       produces rather than a pixel nothing in jsdom has.

       Written after a review deleted the whole style and watched 1888 tests
       pass: the one thing `Team.crop` exists for was drawn by nothing that
       checked it. */
    const { container } = renderWithI18n(
      <TeamMark team={aTeam({ logo: '/mock/logo/dunav.svg', crop: { x: 0.25, y: 1, size: 0.5 } })} />,
    )

    /* The three the component writes.  is the fourth and is
       in the stylesheet, which jsdom applies none of: it is guarded as text,
       beside the shade, in styles/circle.test.ts. */
    expect(must(container.querySelector('img'), 'the logo')).toHaveStyle({
      objectPosition: '25% 100%',
      transform: 'scale(2)',
      transformOrigin: '25% 100%',
    })
  })

  it('draws a team whose record says nothing sensible about the square', () => {
    /* A record is whatever the file, the overlay, or F5 last said it was. With
       the crop read straight off it, a team seeded without one threw on a field
       that was not there and took the whole table of teams into the error
       boundary: nought rows over one missing key. Read through the check, the
       team simply wears its logo whole.

       Both sorts of nonsense, because they fail differently: a missing field
       throws, and a size of nought divides into an infinite scale, which the
       browser drops silently and leaves the logo pinned in a corner. */
    for (const crop of [undefined, { x: 5, y: -1, size: 0 }]) {
      const { container, unmount } = renderWithI18n(
        <TeamMark team={asRead({ ...aTeam({ logo: '/mock/logo/dunav.svg' }), crop })} />,
      )

      expect(must(container.querySelector('img'), 'the logo')).toHaveStyle({
        objectPosition: '50% 50%',
        transform: 'scale(1)',
      })

      unmount()
    }
  })

  it('is decoration in both of its forms, so the name is read once', () => {
    /* The team's name is beside the circle as a link. A mark that carried the
       name as well would have a screen reader say it twice, and a mark that
       carried alternative text of its own would say something the link already
       says. Both forms are therefore hidden, and this holds both. */
    const { container: withLogo } = renderWithI18n(
      <TeamMark team={aTeam({ logo: '/mock/logo/dunav.svg' })} />,
    )

    /* On the circle rather than on the picture inside it, since the crop
       arrived: a magnified picture has to be clipped by something that is never
       scaled, so the mark is now a box with a picture in it, and hiding the box
       hides everything in it. Both are still asserted, because a picture with no
       alternative text at all is read out as its file name by some readers even
       inside a hidden subtree. */
    expect(must(withLogo.querySelector('[aria-hidden]'), 'the circle')).toContainElement(
      must(withLogo.querySelector('img'), 'the logo'),
    )
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
