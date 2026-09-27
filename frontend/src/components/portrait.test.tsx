import { render, screen } from '@testing-library/react'
import { must } from '../test/at'
import { person } from '../test/plate'
import { WHOLE } from './crop'
import { Portrait } from './Portrait'

/**
 * The circle a member is drawn in, in both of its forms.
 *
 * Owner, 26.09.2026 (PDL P28f): „po odobravanju slike ona tog trenutka pocinje da se vidi na
 * svim avatar mestima". This is the component every one of those places draws
 * (`components/oneFace.test.ts` holds that there is only the one), so the picture is measured
 * here once rather than on each of them.
 *
 * **THE WHOLE SETTING IS BUILT SO THAT NOTHING IN IT IS THE ONLY ONE OF ITS KIND**, which is
 * the rule in `CLAUDE.md` about two sources of one value, and it is not decoration here: every
 * screen that draws this mixes members with a portrait and members without, so a component
 * reading the wrong record draws a real picture and looks right.
 *
 * - **Three members, not one**, and the subject is never the first on the list.
 * - **Two of the three carry a portrait**, so „it drew a picture" cannot be satisfied by the
 *   only picture there is.
 * - **The two portraits carry DIFFERENT squares, and the first one's is the default.** Read
 *   off the wrong record, or not read at all, the subject's picture comes out framed whole,
 *   and that is a different pair of numbers rather than the same one.
 * - **The addresses have nothing to do with the member numbers**, so an address the component
 *   built for itself could not be mistaken for one it read.
 */

/* The first on every list, and deliberately a member WITH a picture: the mistake being
   guarded against is „drew the first record's picture instead of this one's", and a first
   record with no picture at all would make that mistake look like a monogram rather than like
   a photograph. Its square is the whole picture, which is the other half of the same trap. */
const FIRST = person('000041', 'Vladan', 'Đurišić', {
  photo: '/mock/photo/vladan.svg',
  crop: WHOLE,
})

/* The subject: third by number, second by portrait, and its square is nobody else's. */
const SUBJECT = person('000073', 'Anđelija', 'Tomašević', {
  photo: '/api/photos/3c9e5f41',
  /* Three numbers that are three different numbers, and none of them 0,5 or 1: those two are
     what the whole picture is made of, so a square carrying either would be a square that
     agrees with the default in one axis. The size divides exactly into 2,5, so what is
     asserted below is the arithmetic and not the four decimal places `round` keeps. */
  crop: { x: 0.3, y: 0.15, size: 0.4 },
})

/* And a member who has sent nothing, which is thirty of the thirty two served members and is
   the state the circle has to look right in. */
const NO_PORTRAIT = person('000055', 'Bogoljub', 'Nenadić')

/**
 * A member as one actually arrives: parsed out of text.
 *
 * Every record on this portal is read out of JSON, which is why nothing can vouch for its
 * shape and why there is a check to read a crop through (`components/crop.ts`). Round tripping
 * through text here also drops a field that was never set, which is the case that mattered on
 * a team: the missing key, not the wrong value. Copied from `components/teamMark.test.tsx`,
 * which is the same measurement on the same arithmetic.
 */
function asRead(record: object): ReturnType<typeof person> {
  return JSON.parse(JSON.stringify(record))
}

/** All three in one render, in list order, which is how every screen draws them. */
function theWholeList() {
  return render(
    <>
      <Portrait competitor={FIRST} />
      <Portrait competitor={NO_PORTRAIT} />
      <Portrait competitor={SUBJECT} />
    </>,
  )
}

describe('the circle of a member who has no approved portrait', () => {
  it('holds their own initials', () => {
    /* His own and not whoever came first: all three are in the same render, so a component
       reading the wrong record draws „VĐ" or „AT" where „BN" belongs. */
    theWholeList()

    expect(screen.getByText('BN')).toBeInTheDocument()
  })

  it('is what a member who HIDES their profile looks like to a visitor, indistinguishably', () => {
    /* Owner, 26.09.2026 (PDL P28f), chosen against the recommendation he was given: the digest
       „se zadrzava od neprijavljenog", and `PhotoApi` refuses the same portrait to the same
       caller, because the digest IS the whole permission - the route asked nobody who they
       were. PDL requires „Oba slucaja dobijaju isti ishod".

       So this is not a case about hiding as such: it is the case that this component CANNOT
       tell the two apart, and must not try. A visitor's answer for a hidden member is
       `photo: null` (`data/types.ts`), exactly what a member with no picture carries, and the
       two records below differ in the flag and in nothing the circle can see.

       **Composing an address here would fail; reading `profileHidden` would NOT, and that
       was found by a surviving mutation rather than reasoned out in advance.** Both records
       already carry `photo: null`, so `competitor.photo !== null && !competitor.profileHidden`
       answers `false` exactly as `competitor.photo !== null` alone does - there is no picture
       here for the flag to hide, so a component that had started reading it would still pass
       this case. That is measured on a record that DOES carry a picture, in the case below
       ('still draws the picture when the member has hidden their profile'). */
    /* The SAME member, with the flag turned over and nothing else touched. The first draft of
       this compared two different members and failed on the colour, which is read off the
       member number: a true failure of the setting rather than of the code, and the reason the
       two records here are one record and a spread. */
    const hiding = { ...NO_PORTRAIT, profileHidden: true }

    const { container: asHiding } = render(<Portrait competitor={hiding} />)
    const { container: asBare } = render(<Portrait competitor={NO_PORTRAIT} />)

    /* **BOTH ENDS OF THE COMPARISON NAMED, because without them this case is satisfied by
       itself.** „These two renders are identical" is trivially true of one record rendered
       twice, and the mutation that proves it is exactly that: drop the spread and hand
       `NO_PORTRAIT` to both sides. So the two records are required to DIFFER in the flag
       before the renders are required to agree. */
    expect(NO_PORTRAIT.profileHidden).toBe(false)
    expect(hiding.profileHidden).toBe(true)
    expect(asHiding.innerHTML).toBe(asBare.innerHTML)
  })
})

describe('the circle of a member whose portrait was approved', () => {
  it('draws that member’s own picture, at the address the record carries', () => {
    /* **Two things at once, and the second is why the address is a nonsense string.** The
       picture is the subject's and not the first record's, which is what two portraits in one
       render buy; and the address is READ and never BUILT. `/api/photos/3c9e5f41` is the
       digest of the file's own content (`PhotoApi`, and deliberately not `photo.id`, which is
       countable), so nothing about this member could produce it. A component that assembled
       `/api/photos/` plus a member number would answer `/api/photos/000073`, and one that
       reached for the wrong record would answer `/mock/photo/vladan.svg`. */
    const { container } = theWholeList()

    const drawn = [...container.querySelectorAll('img')]

    expect(drawn).toHaveLength(2)
    expect(must(drawn[1], 'the subject’s portrait')).toHaveAttribute(
      'src',
      '/api/photos/3c9e5f41',
    )
    /* And no letters in that circle: a monogram behind a photograph is two answers to one
       question, and it shows through a picture with any transparency in it. */
    expect(screen.queryByText('AT')).not.toBeInTheDocument()
    /* The one with nothing still holds its place with letters, so this render really has both
       forms in it and the count above means what it says. */
    expect(screen.getByText('BN')).toBeInTheDocument()
  })

  it('still draws the picture when the member has hidden their profile, since the digest already decided that', () => {
    /* Owner, 27.09.2026 (PDL P28f, point 17): „Prema clanu se ne krije nista" - hiding runs one
       way only, toward a reader with no session, and this component is never told which reader
       it is drawing for. `photo` already carries the outcome of that question by the time it
       reaches here (null for a visitor a hidden profile refuses, the address for anybody else),
       so `profileHidden` has nothing left for this component to decide and must not be read.

       Written because a mutation survived: `competitor.photo !== null` narrowed to
       `competitor.photo !== null && !competitor.profileHidden` left every case in this file
       green, because the one case in the describe above that turns the flag on has no picture
       either side of its comparison, so the extra clause never had anything to hide. This is
       the record that closes it: a picture AND the flag together, which that fixture never
       puts in one record. */
    const hiding = { ...SUBJECT, profileHidden: true }

    const { container } = render(<Portrait competitor={hiding} />)

    expect(hiding.profileHidden).toBe(true)
    expect(must(container.querySelector('img'), 'the portrait')).toHaveAttribute(
      'src',
      '/api/photos/3c9e5f41',
    )
  })

  it('cuts it to the square that member chose, and not to the one above them', () => {
    /* Owner, 12.08.2026: „Korisnik treba da može da sačuva kropovan format". Drawn by the
       browser's own way of showing part of a picture, which needs no width and no height
       (`fittedTo` in components/crop.ts), so what is asserted is the three properties it
       produces rather than a pixel jsdom has not got.

       **The first record's square is the WHOLE picture on purpose.** Read off the wrong
       record, or not read at all, these three come out `50% 50%` and `scale(1)`, which is
       what the subject's own numbers must not equal - and they are 0,3 and 0,15 and 0,4
       precisely so that they do not. */
    const { container } = theWholeList()

    const drawn = [...container.querySelectorAll('img')]

    expect(must(drawn[1], 'the subject’s portrait')).toHaveStyle({
      objectPosition: '30% 15%',
      transform: 'scale(2.5)',
      transformOrigin: '30% 15%',
    })

    /* And the first one really is framed whole, so the pair above is a comparison of two
       different answers rather than of one answer with itself. */
    expect(must(drawn[0], 'the first portrait')).toHaveStyle({
      objectPosition: '50% 50%',
      transform: 'scale(1)',
    })
  })

  it('draws a member whose record says nothing sensible about the square', () => {
    /* A record is whatever the file, the overlay, or F5 last said it was. With the crop read
       straight off it, a member seeded without one throws on a field that is not there and
       takes the whole screen into the error boundary: nought rows over one missing key. Read
       through the check, the member simply wears the picture whole.

       Both sorts of nonsense, because they fail differently: a missing field throws, and a
       size of nought divides into an infinite scale, which the browser drops silently and
       leaves the picture pinned in a corner. */
    for (const crop of [undefined, { x: 5, y: -1, size: 0 }]) {
      const { container, unmount } = render(
        <Portrait competitor={asRead({ ...SUBJECT, crop })} />,
      )

      expect(must(container.querySelector('img'), 'the portrait')).toHaveStyle({
        objectPosition: '50% 50%',
        transform: 'scale(1)',
      })

      unmount()
    }
  })

  it('still carries that member’s own colour, which something outside it reads', () => {
    /* **Written because a mutation survived**: `style={own}` taken off the circle with a
       picture in it left every case here green. Behind an opaque photograph the colour shows
       nothing, so it reads as decoration - and it is not.
   *
       Two readers outside this component. The card of a competitor draws its ring in that
       colour at a third of its strength (`pages/Competitors.css`), so without it a member
       with a portrait wears a ring in the fallback hue of 214 while the member beside him
       wears his own. And a portrait sent as a PNG with transparency stands on it.
   *
       Asked of the property and not of a pixel, because jsdom applies no stylesheet: what is
       held is that the circle carries the variable the sheet reads, and that it carries THIS
       member's value rather than the one above him on the list. */
    const { container } = theWholeList()

    const circles = [...container.querySelectorAll('.portrait')]
    const hue = (at: number) =>
      must(circles[at], `circle ${String(at)}`).getAttribute('style')

    expect(hue(2), 'the subject’s circle carries no colour of its own').toContain('--face-hue')
    /* And not the first record's, which is what makes this a statement about whose colour it
       is rather than about whether there is one. */
    expect(hue(2)).not.toBe(hue(0))
  })

  it('is fetched when it comes near rather than with the page', () => {
    /* A standing is a row per member and each of these is a request nobody has asked for yet.
       The same attribute, for the same reason, as a team's mark, where a review measured that
       it could be switched off with every test still passing. */
    const { container } = render(<Portrait competitor={SUBJECT} />)

    expect(must(container.querySelector('img'), 'the portrait')).toHaveAttribute(
      'loading',
      'lazy',
    )
  })
})

describe('what the circle says out loud', () => {
  it('says nothing, in either of its forms', () => {
    /* Owner, 07.09.2026 (PDL): „Na tabli od deset, sve u krugu nosi `aria-hidden` (i slika i
       broj mesta), jer to ime izgovara sama veza" - a decision that names the picture a year
       before there was one to name. The member's name stands beside this circle as a link or
       as text on every screen that draws it, so alternative text of its own would be a third
       telling of the same name.

       **Both are asserted and the second is not redundant**: the hiding is on the circle
       rather than on the picture, because a magnified picture has to be clipped by something
       that is never scaled, and a picture with no alternative text AT ALL is read out as its
       file name by some readers even inside a hidden subtree. */
    const { container: withPicture } = render(<Portrait competitor={SUBJECT} />)

    expect(
      must(withPicture.querySelector('[aria-hidden]'), 'the circle'),
    ).toContainElement(must(withPicture.querySelector('img'), 'the portrait'))
    expect(must(withPicture.querySelector('img'), 'the portrait')).toHaveAttribute('alt', '')

    const { container: withLetters } = render(<Portrait competitor={NO_PORTRAIT} />)

    expect(must(withLetters.querySelector('span'), 'the circle')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })
})

describe('a place on a board the league has not filled', () => {
  it('is an empty circle, holding the height and saying nothing', () => {
    /* A widget of ten slots is the same height whether the league has thirty members or three.
       It is not a member with no picture and must not be drawn as one: there is no name to take
       letters from and nobody to give it a colour. */
    const { container } = render(<Portrait />)

    const drawn = must(container.querySelector('span'), 'the empty circle')

    expect(drawn.className).toContain('portrait--empty')
    expect(drawn.textContent).toBe('')
    expect(container.querySelector('img')).toBeNull()
  })
})
