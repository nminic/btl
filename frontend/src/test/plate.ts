import type { Competitor, Member } from '../data/types'

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
 * no birthday shown, and **no portrait**, which is the state thirty of the thirty two served
 * members are in. A case that cares about one of those passes it in `over`, which is the shape
 * `teamMark.test.tsx` already uses for the same reason: a member with a picture is not a different
 * kind of member, so it is one field on the same record rather than a second factory.
 */
export function person(
  memberNumber: string,
  firstName: string,
  lastName: string,
  over: Partial<Competitor> = {},
): Competitor {
  return {
    memberNumber,
    firstName,
    lastName,
    gender: 'M',
    city: 'Beograd',
    country: 'RS',
    ageBand: '40-54',
    firstSeason2027: false,
    firstSeason: 2027,
    unranked: false,
    membershipBasis: 'payment',
    membershipSeason: 2027,
    teamId: null,
    teamSince: null,
    profileHidden: false,
    birthdayShown: 'none',
    bio: '',
    photo: null,
    smallPhoto: null,
    crop: null,
    ...over,
  }
}

/**
 * The same competitor as the moderation of the members is answered him (`MembersApi`): active, and
 * holding exactly the one season his basis names, or none where he holds no basis. A case that cares
 * about another state passes it in `over`.
 */
export function asMember(competitor: Competitor, over: Partial<Member> = {}): Member {
  const { membershipBasis, membershipSeason } = competitor

  return {
    memberNumber: competitor.memberNumber,
    firstName: competitor.firstName,
    lastName: competitor.lastName,
    gender: competitor.gender,
    city: competitor.city,
    country: competitor.country,
    ageBand: competitor.ageBand,
    firstSeason2027: competitor.firstSeason2027,
    active: true,
    membershipBasis,
    membershipSeason,
    seasons:
      membershipBasis === undefined || membershipSeason === undefined
        ? []
        : [{ season: membershipSeason, basis: membershipBasis, ranked: true }],
    /* The figures of the season on sale as a member in Serbia with an empty book is answered them on
       a day in the renewal window: 2027, 4.800 dinars, no fee. */
    seasonOnSale: 2027,
    currency: 'RSD',
    expected: 4800,
    price: 4800,
    balance: 0,
    /* An account with a password, the state of nearly every member: a case about the envelope passes
       another. */
    invitation: 'passwordSet',
    ...over,
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
  /* Worn by a circle that holds a PHOTOGRAPH and by nothing else the plate draws, since
     26.09.2026 (PDL P28f). It is what cuts the picture to the square the member chose
     (`components/Crop.css`), so the floor below has to draw a pair in which one of the two
     carries a portrait and the other does not - otherwise „every shape this component has"
     stops being true the day the picture arrives, and stays green while stopping. */
  'crop-fitted',
  'face-circle',
  'plate',
  'plate--pair',
  'plate__faces',
  'plate__family',
  'plate__given',
  'plate__words',
  'portrait',
]
