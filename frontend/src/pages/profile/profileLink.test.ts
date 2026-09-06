import { sep } from 'node:path'
import { sources, WHOLE_PORTAL } from '../../test/sources'

/**
 * Only two modules may build the address of a profile themselves.
 *
 * **Why this is a floor and not a preference.** Whether a name may be a link is the same question
 * the profile page asks to decide whether to draw itself at all (`profile/visible.ts`), and it now
 * has two reasons: a member whose fee has run out, and a member hiding from a reader who is not
 * signed in (P23, 06.09.2026). Nine screens draw a competitor and eight of them may link one. Ask
 * that question at each of them and it is eight places to forget it, which is what happened to the
 * first reason: `components/CompetitorName.tsx` was written on 05.09.2026 precisely because „the
 * rule was being kept on two screens out of eight and there was nothing to say which".
 *
 * So the address itself is built in one place, and everything else asks for a link and is handed
 * one or nothing (`profileLinkFor`, `ProfileLink`, `useProfileLink`).
 *
 * **Read off the imports, so there is no list of screens to keep.** A ninth screen written
 * tomorrow either goes through the rule or falls here and asks the question once. What is listed
 * is the three modules that build the address themselves, each with the reason it may:
 *
 * - `pages/profileAddress.ts` is where the address is made.
 * - `profile/visible.ts` is the rule itself: it is the one place allowed to turn „may this reader
 *   reach this profile" into an address.
 * - `profile/ProfileHead.tsx` builds the tabs **inside** an open profile, which is not a link from
 *   elsewhere: a reader who is on the page has already been let in, and the tabs are the same
 *   address with a part hung off it.
 */
const MAY = [
  `pages${sep}profileAddress.ts`,
  `profile${sep}visible.ts`,
  `profile${sep}ProfileHead.tsx`,
]

describe('the address of a profile', () => {
  it('is built in three places, and every screen asks for a link instead', () => {
    const swept = sources()

    /* The floor of the floor: an answer of „nobody" is right and is also what a walk over
       nothing gives. */
    expect(swept.length, 'the portal is still here').toBeGreaterThan(WHOLE_PORTAL)

    const builders = swept
      .filter(({ code }) => /\bprofilePath\b/.test(code))
      .map(({ path }) => path)
      .filter((path) => !MAY.some((one) => path.endsWith(one)))
      .map((path) => path.split(sep).slice(-2).join(sep))

    expect(builders).toEqual([])
  })
})
