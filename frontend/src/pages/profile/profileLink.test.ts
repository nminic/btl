import { sep } from 'node:path'
import { sources, WHOLE_PORTAL } from '../../test/sources'

/**
 * Only four modules may reach the maker of a profile's address, and only one may write one out.
 *
 * **Why this is a floor and not a preference.** Whether a name may be a link is the same question
 * the profile page asks to decide whether to draw itself at all (`profile/visible.ts`), and it now
 * has two reasons: a member whose fee has run out, and a member hiding from a reader who is not
 * signed in (P23, 06.09.2026). Nine screens draw a competitor and eight of them may link one. Ask
 * that question at each of them and it is eight places to forget it, which is what happened to the
 * first reason: `components/CompetitorName.tsx` was written on 05.09.2026 precisely because „the
 * rule was being kept on two screens out of eight and there was nothing to say which".
 *
 * So the address itself is built in one module, and everything else asks for a link and is handed
 * one or nothing (`profileLinkFor`, `ProfileLink`, `useProfileLink`).
 *
 * **Asked of the imports rather than of one function's name** (review, 07.09.2026). It used to
 * sweep for `profilePath`, which is one of two exports that build an address: `redirectTo` builds
 * the same address for the canonical redirect, and a screen reaching for that one walked past the
 * floor untouched. A name is a list of one, and this is the second time a list in a guard has been
 * shorter than the thing it guards; what the module exports is not a list, it is what the module
 * exports, and reading the import catches an export written tomorrow as well.
 *
 * What is named is the four modules that may reach it, each with the reason it may:
 *
 * - `profile/visible.ts` is the rule itself: the one place allowed to turn „may this reader reach
 *   this profile" into an address.
 * - `profile/ProfileHead.tsx` builds the tabs **inside** an open profile, which is not a link from
 *   elsewhere: a reader who is on the page has already been let in, and the tabs are the same
 *   address with a part hung off it.
 * - `pages/CompetitorProfile.tsx` and `pages/CompetitorAwards.tsx` are those two pages. They read
 *   the member number out of the address they were opened at and send the reader to the canonical
 *   spelling of it, which they do **after** the rule has said the profile may be seen at all; a
 *   redirect that ran first would answer „is there such a member" for a reader who is not allowed
 *   to ask.
 *
 * Cases are outside this altogether, because `sources()` is the production tree and nothing else:
 * a case that spells an address out is saying what it expects to find on a screen, which is the
 * opposite of a screen deciding one for itself.
 */
const MAY = [
  `profile${sep}visible.ts`,
  `profile${sep}ProfileHead.tsx`,
  `pages${sep}CompetitorProfile.tsx`,
  `pages${sep}CompetitorAwards.tsx`,
]

/** How a file names the module, whatever depth it sits at. */
const REACHES = /from '[^']*\bprofileAddress'/
/**
 * An address written out rather than asked for: the shape `/${locale}/takmicar/${…}`, which is
 * what `profilePath` and `redirectTo` produce.
 *
 * The interpolation is the whole of the question, and it is what keeps this from needing a list of
 * exceptions. `app/routes.ts` and `app/routeObjects.tsx` write `takmicar/:memberNumber`, which is
 * the address as a pattern and not as a value, and three comments spell an address out for a
 * reader; none of them puts a value into one.
 */
const WRITES = /takmicar\/\$\{/

const shortened = (path: string) => path.split(sep).slice(-2).join(sep)

describe('the address of a profile', () => {
  it('is reached from four modules, and every screen asks for a link instead', () => {
    const swept = sources()

    /* The floor of the floor: an answer of „nobody" is right and is also what a walk over
       nothing gives. */
    expect(swept.length, 'the portal is still here').toBeGreaterThan(WHOLE_PORTAL)

    const reaching = swept
      .filter(({ code }) => REACHES.test(code))
      .map(({ path }) => path)
      .filter((path) => !path.endsWith(`pages${sep}profileAddress.ts`))
      .map(shortened)
      .sort()

    expect(reaching).toEqual([...MAY].sort())
  })

  it('is written out in one module and nowhere else', () => {
    const writing = sources()
      .filter(({ code }) => WRITES.test(code))
      .map(({ path }) => path)
      .filter((path) => !path.endsWith(`pages${sep}profileAddress.ts`))
      .map(shortened)

    expect(writing).toEqual([])
  })
})
