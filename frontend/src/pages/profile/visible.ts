import type { Competitor } from '../../data/types'

/**
 * Whether this reader may see this profile, answered in one place for every screen that draws
 * one.
 *
 * **Why it is not written twice.** It was, for one commit: the check stood on the profile and
 * not on the page of awards, which draws the same head from the same record. A reader who was
 * refused the profile got the whole card, name, town, club and the birthday if the member had
 * chosen to show it, one address further along, and that address is public and bookmarked
 * (review, 06.09.2026). The portal already had the shape to copy: „is this member active" is
 * asked on both, and that is why it never drifted.
 *
 * The three answers are the three things a screen has to draw, so a screen cannot forget one.
 */
export type Readable =
  | { kind: 'none' }
  | { kind: 'hidden'; competitor: Competitor }
  | { kind: 'shown'; competitor: Competitor }

export function profileFor(
  competitors: Competitor[],
  /* Undefined where the address carried nothing a member number could be read out of, which
     is the same answer as a number nobody has. */
  memberNumber: string | undefined,
  reader: string | null,
): Readable {
  const competitor = competitors.find(
    (one) => one.memberNumber === memberNumber && one.active,
  )

  if (competitor === undefined) {
    /* A member who is not active has no visible profile at all (PDL P11), which is the same
       answer as a number nobody has. */
    return { kind: 'none' }
  }

  /* **Hidden from readers who are not signed in, and from nobody else.** The published privacy
     policy gives the reason in the same sentence it gives the promise: „ali ne i od ostalih
     članova, jer bi time nestao smisao zajedničkog rangiranja". So every signed in member sees
     everything, including a member reading somebody else's profile. */
  return competitor.profileHidden && reader === null
    ? { kind: 'hidden', competitor }
    : { kind: 'shown', competitor }
}
