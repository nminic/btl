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
 * **Two answers and not three, since 06.09.2026.** There used to be a „hidden" state with a page
 * of its own, showing the name and two notes. The owner replaced it with something simpler and
 * harder to get wrong: „do profilnih strana tog takmičara je nemoguće doći… javni posetilac se
 * preusmerava na naslovnu stranu portala." A profile that cannot be reached and a profile that
 * does not exist are then the same answer, which is also what keeps a visitor from learning which
 * numbers belong to members who are hiding.
 */
export type Readable = { kind: 'none' } | { kind: 'shown'; competitor: Competitor }

/**
 * Whether anything may lead this reader to this profile.
 *
 * The one question behind both halves of the rule, so they cannot drift: the page asks it to
 * decide whether to draw or to send the reader away, and every list on the portal asks it to
 * decide whether a name is a link or plain text (`profile/useProfileLink.ts`, which is the one
 * place that turns this answer into an address, and does not export the turning).
 *
 * **ONE REASON SINCE 21.09.2026, AND THE OTHER MOVED RATHER THAN WENT.** This read
 * `competitor.active && !(competitor.profileHidden && reader === null)`, and the first half is
 * the one the whole switch to `/api` turned on: a member whose fee has run out is not on
 * `/api/competitors` at all (owner, 13.09.2026), so there is no record here to ask. The fee is
 * answered by `profileFor` below, which finds nobody - and that answer was already the right one,
 * because P23 requires that a profile nobody may reach and a profile that does not exist read
 * alike.
 *
 * **Left as it stood it would have hidden every profile on the portal, the owner's included.**
 * `/api/competitors` does not carry the field, so `competitor.active` is `undefined`, and
 * `undefined && anything` is false for every member there is. That is the one measured example
 * `data/client.ts` carried for two months as the reason the switch was refused.
 *
 * So what is left here is the hiding, and it is one sentence: a member who has hidden their
 * profile is unreachable to a reader who is not signed in, and to nobody else. The published
 * policy gives the reason in the same sentence as the promise: „ali ne i od ostalih članova, jer
 * bi time nestao smisao zajedničkog rangiranja."
 */
export function reachable(competitor: Competitor, reader: string | null): boolean {
  return !(competitor.profileHidden && reader === null)
}

export function profileFor(
  competitors: Competitor[],
  /* Undefined where the address carried nothing a member number could be read out of, which
     is the same answer as a number nobody has. */
  memberNumber: string | undefined,
  reader: string | null,
): Readable {
  const competitor = competitors.find((one) => one.memberNumber === memberNumber)

  /* A number nobody has, a member who is not active, and a member hiding from a reader who is
     not signed in: one answer for all three, so the difference between them cannot be read off
     the screen (PDL P23, 06.09.2026).

     **THE FIRST TWO ARE ONE LOOKUP SINCE 21.09.2026 AND NOT TWO QUESTIONS.** A member whose fee
     has run out is not in this list, so `find` answers nothing about them for the same reason it
     answers nothing about a number nobody has - which is the very thing P23 asks for, now held by
     the shape of the answer instead of by a pair of conditions that had to agree. */
  return competitor === undefined || !reachable(competitor, reader)
    ? { kind: 'none' }
    : { kind: 'shown', competitor }
}

/**
 * An address with something hung off it, or nothing.
 *
 * The one shape that appears where a link carries more than the profile: the chart on the front
 * page opens a profile already narrowed to the category the bar was about (owner, 01.08.2026).
 * Written here rather than at the call site so that „there is no address" survives the appending;
 * done the other way round it produces a query hanging off nothing, which is a link into the void
 * dressed as a link to a profile.
 */
export function appended(to: string | undefined, query: string): string | undefined {
  return to === undefined ? undefined : `${to}${query}`
}
