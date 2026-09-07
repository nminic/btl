import type { Competitor } from '../data/types'

/**
 * The plate as two test files need it: somebody to draw, and the classes the drawing wears.
 *
 * Two files ask the same two things of one component (07.09.2026): its own cases
 * (`components/namePlate.test.tsx`), and the guard over the stylesheets that dress it
 * (`styles/leagueLayout.test.ts`). One home rather than two copies (ADL A31).
 */

/**
 * A competitor, for the cases that need one and do not care who.
 *
 * Everything but the three arguments is a plain, unremarkable member: no hidden profile, no team,
 * no birthday shown. A case that cares about one of those sets it on the copy it makes.
 */
export function person(memberNumber: string, firstName: string, lastName: string): Competitor {
  return {
    memberNumber,
    firstName,
    lastName,
    gender: 'M',
    city: 'Beograd',
    country: 'RS',
    birthYear: 1985,
    firstSeason2027: false,
    firstSeason: 2027,
    membershipBasis: 'payment',
    referralCode: 'proba0000',
    referredBy: null,
    teamId: null,
    teamSince: null,
    profileHidden: false,
    birthdayShown: 'none',
    bio: '',
    active: true,
  }
}

/**
 * Every class a drawn plate wears, in one place because two files read it.
 *
 * **Written by hand, and with its floor beside it in the same commit** (07.09.2026, and the rule
 * is `CLAUDE.md`, „Spisak u čuvaru se piše zajedno sa svojim podom"). The floor is
 * `components/namePlate.test.tsx`, „wears these classes and no others": it draws a pair with a
 * name over two lines, which is every shape the component has, and asks the **DOM** which classes
 * came out. A class added to `NamePlate.tsx` or `Portrait.tsx` fails that case until it is written
 * here, and `styles/leagueLayout.test.ts` then sees it too.
 *
 * **Why it cannot be read off the source instead.** The outer class is written
 * `` `plate${pair ? ' plate--pair' : ''}` ``, so a sweep for `className="…"` misses both of them.
 * That is the shape three guards have already died on: the DOM answers, the text does not.
 *
 * **Why any of this is guarded at all.** Two of the owner's sentences of 07.09.2026 are about the
 * circle, and the circle is not called `plate`: it is `portrait`, out of a shared sheet. A review
 * that day added `.rankings__table .portrait { display: none }` and the main standing drew no
 * circle at any width, with the whole gate green, because the guard was keyed on the word `plate`.
 */
export const PLATE_CLASSES = [
  'face-circle',
  'plate',
  'plate--pair',
  'plate__faces',
  'plate__family',
  'plate__given',
  'plate__words',
  'portrait',
]
