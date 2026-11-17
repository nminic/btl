import { teamOf } from '../data/derive'
import { inYearlyWindow } from '../data/season'

/**
 * What the teams offer whoever is reading, about founding a team of his own: the button „Prijavi tim”,
 * the sentence that says when a team is founded, or nothing.
 *
 * **Only a signed-in member who is not in a team today** (owner, 04.09.2026: „samo na strani Timovi
 * ULOGOVANOG ČLANA KOJI TRENUTNO NEMA TIM U KOJEM SE NALAZI"). Nothing at all, a signed-in person with no
 * competitor record, is also not in a team and reads the same way. **The button inside the transfer
 * window and the sentence outside it** (owner, 05.09.2026), the window every other change of team is
 * asked in.
 *
 * **One place, because two screens ask it** (17.11.2026): the teams draw the button, and the men and the
 * women draw an invisible place of its width for the same reader, so the cards stand on the same pixel
 * on all three (owner, 17.11.2026, answer 3, chosen with my recommendation, from ADL A7: „navigacija se
 * ne sme pomerati tokom klikova, boksovi i naslovi moraju da se gađaju u piksel”). Asked in two places,
 * the place and the button could disagree, and the cards would move under the pointer.
 *
 * `members` is the list as the session holds it (`recordsOf(MEMBERS, …)`): a member who founded a team
 * this visit has it on his record there and nowhere else.
 */
export type TeamOffer = 'button' | 'sentence' | 'nothing'

export function whatTheTeamsOffer(
  memberNumber: string | null,
  members: readonly { memberNumber: string; teamId: number | null }[],
  today: string,
): TeamOffer {
  if (memberNumber === null || teamOf(members.find((one) => one.memberNumber === memberNumber)) !== null) {
    return 'nothing'
  }

  return inYearlyWindow(today) ? 'button' : 'sentence'
}
