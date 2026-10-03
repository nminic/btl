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
 *
 * **AND A THIRD KIND THAT IS NOT AN ANSWER, since 02.10.2026: `waiting`.** It says nobody has told
 * the screen who is reading yet, and it is not the third state that fell on 07.09.2026 (the page
 * that said „this member is hiding"): that one told a visitor which numbers hide, and this one
 * cannot, because **every one of the three ways to be unreadable passes through it the same way** -
 * a hidden member, a number nobody has and a member whose fee has run out all wait, and all of them
 * then end as `none`. `PDL.md`, 06.09.2026, „Preusmerenje mora da se ponaša isto i za profil koga
 * nema" (derived, not the owner's word, with the reason: otherwise a visitor reads the difference
 * off the screen). A screen that waited for the hidden member and sent the other two away at once
 * would show that difference for as long as the answer takes.
 *
 * **Why it exists at all.** At the first paint of a visit the reader is nobody
 * (`app/App.tsx` mounts `RoleProvider` with no prop, and the session holds nothing until `GET
 * /api/me` has come back), so a hidden profile turned a reader who IS signed in onto the front page
 * on a cold load: a new tab, `F5`, a bookmark. Measured in the review of PR 461 with the member
 * served as hidden: an account with no member 2 times in 4 on the profile, the same account with
 * the answer held back 1,5 s 2 times in 2, member 000012 1 time in 2. It is the decision of
 * 29.09.2026 (`PDL.md`, „Cuvar ne preusmerava dok server ne kaze ko cita", owner, chosen between
 * three offered outcomes), which was carried out in `pages/admin/Guard.tsx` and nowhere else.
 * **That the two screens that turn a reader away by who he is are the same fault is the
 * assistant's derivation and not a new word of the owner's.**
 *
 * **The order is the safety, and it is `Guard`'s.** `shown` is reached only through `reachable`,
 * never through the flag below, so waiting can DELAY a refusal and can never turn one into an
 * admission: there is no arrangement of the answer that reaches a profile through the waiting. And
 * a reader who is already known (just signed in, or the development switch) opens at once, because
 * the first line asks about him before the last one asks about the server.
 *
 * **A kind and not a flag beside the answer, so that a screen cannot forget it**: a screen that
 * handled only `none` and then read `readable.competitor` does not compile, so a fourth screen
 * written tomorrow meets the question instead of inheriting the old fault.
 */
export type Readable =
  | { kind: 'none' }
  | { kind: 'waiting' }
  | { kind: 'shown'; competitor: Competitor }

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
 * profile is unreachable to a reader who is neither an active member nor the administration, and
 * to nobody else (`PDL P23, 03.10.2026, „Skrivanje deluje prema svakome ko nije aktivan član ni
 * administracija"`). The published policy gives the reason in the same sentence as the promise: „ali
 * ne i od ostalih članova, jer bi time nestao smisao zajedničkog rangiranja."
 *
 * **THE SECOND ARGUMENT IS WHETHER THIS READER MAY READ A HIDDEN PROFILE, AND SINCE 03.10.2026 IT IS
 * NOT WHETHER ANYBODY IS SIGNED IN** (this paragraph was written for that reading on 02.10.2026, and
 * the owner chose otherwise between offered outcomes the next day). A free account and a member whose
 * fee has lapsed are signed in, and read a hidden profile exactly as a visitor does, which is to say
 * not at all; the administration reads it whether or not it races, and so does every member whose
 * fee is standing. The two questions are worked out where the reader is known, as
 * `isActiveMemberOrAdministration(role, memberNumber, served)` (`roles/activeMemberOrAdministration.ts`,
 * the screen's copy of what `ActiveMemberOrAdministration.java` decides on the server): the role names
 * the administration, whose own number and fee do not matter and who may have no number at all (PDL
 * P21), and the member number is looked up on the list the server serves, which is the members whose
 * fee is standing - the very list the screens below are drawn from, so what a screen believes about the
 * reader and what the list carries for him come from one answer.
 *
 * **A boolean, and not the member number or the session's own object.** A number cannot be handed
 * in by a call site again without the compiler saying so, which is the only thing that keeps a
 * fourth screen from asking the old question. And the session's `signedIn` is a new object whenever
 * anything in the session changes, so it cannot stand in a dependency list: `useProfileLink` is a
 * `useCallback` the boards memoise over.
 */
export function reachable(competitor: Competitor, readsHiddenProfiles: boolean): boolean {
  return !(competitor.profileHidden && !readsHiddenProfiles)
}

export function profileFor(
  competitors: Competitor[],
  /* Undefined where the address carried nothing a member number could be read out of, which
     is the same answer as a number nobody has. */
  memberNumber: string | undefined,
  /* Whether this reader may read a hidden profile, which is what `reachable` asks: an active
     member or the administration, worked out by the caller where the reader and the list are both
     at hand (`roles/activeMemberOrAdministration.ts`). */
  readsHiddenProfiles: boolean,
  /* Whether `GET /api/me` has come back, whatever it came back with (`session/context.ts`,
     `theServerHasAnswered`). Not „is anybody signed in": that is the argument above, and the
     difference between the two is the whole of why this one exists. */
  theServerHasAnswered: boolean,
): Readable {
  const competitor = competitors.find((one) => one.memberNumber === memberNumber)

  /* THE FIRST LINE ASKS ABOUT THE READER AND NEVER ABOUT THE SERVER, which is the order that makes
     waiting safe: a reader who may open it opens at once, and nothing below can turn into an
     admission. */
  if (competitor !== undefined && reachable(competitor, readsHiddenProfiles)) {
    return { kind: 'shown', competitor }
  }

  /* A number nobody has, a member who is not active, and a member hiding from a reader who may
     not read a hidden profile: one answer for all three, so the difference between them cannot be read off
     the screen (PDL P23, 06.09.2026) - and since 02.10.2026 ONE WAITING for all three, for as long
     as nobody has said who is reading, for the same reason (see `Readable`).

     **THE FIRST TWO ARE ONE LOOKUP SINCE 21.09.2026 AND NOT TWO QUESTIONS.** A member whose fee
     has run out is not in this list, so `find` answers nothing about them for the same reason it
     answers nothing about a number nobody has - which is the very thing P23 asks for, now held by
     the shape of the answer instead of by a pair of conditions that had to agree. */
  return theServerHasAnswered ? { kind: 'none' } : { kind: 'waiting' }
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
