import { profilePath } from '../profileAddress'
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
 * decide whether a name is a link or plain text (`profileLinkFor`).
 *
 * **Two reasons for one answer, and the second is the new one.** A member whose fee has run out
 * has no visible profile at all (P11) and has been drawn as plain text on two screens since
 * before this; a member who has hidden their profile is the same to a reader who is not signed
 * in, and to nobody else. The published policy gives the reason in the same sentence as the
 * promise: „ali ne i od ostalih članova, jer bi time nestao smisao zajedničkog rangiranja."
 */
export function reachable(competitor: Competitor, reader: string | null): boolean {
  return competitor.active && !(competitor.profileHidden && reader === null)
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
     the screen (PDL P23, 06.09.2026). */
  return competitor === undefined || !reachable(competitor, reader)
    ? { kind: 'none' }
    : { kind: 'shown', competitor }
}

/**
 * The address a list may send a reader to, or nothing.
 *
 * **One question, asked in one place, for every screen that writes a name.** Nine screens draw a
 * competitor's name and eight of them may link it; the rule that says whether they may is the
 * same rule the profile page uses to decide whether to draw itself, so a member the page turns
 * away cannot be reached from a list either.
 *
 * Nothing is taken away from the reader when the answer is nothing: the name stays, as plain
 * text. The owner's rule, 06.09.2026: „sva njegova pojavljivanja na portalu u tabelama i rang
 * listama postaju tekst umesto link za sve posetioce koji nisu ulogovani." The data on those
 * lists is not touched either — hiding is about reaching the profile, not about what a list says.
 *
 * `profilePath` stays for the one thing that is not a link from elsewhere: the tabs inside an
 * open profile (`profile/ProfileHead.tsx`), where the reader is already looking at it.
 */
export function profileLinkFor(
  competitor: Competitor,
  reader: string | null,
  locale: string,
): string | undefined {
  return reachable(competitor, reader) ? profilePath(competitor, locale) : undefined
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
