import type { Competitor, PendingItem, Team } from '../../data/types'
import { teamOf } from '../../data/derive'
import { teamAdminOf } from '../../data/teamAdmin'
import type { FieldError } from '../../forms/types'
import type { Edits } from '../../session/context'
import { slugify } from '../rulebookToc'

/* Everything about turning a proposal into a team, away from the screen that
 * draws it: three of these four are decisions rather than drawings, and the one
 * that refuses has a case the screen cannot reach.
 */

/**
 * What a proposal says the team should be called, and where it is from.
 *
 * One place, because three things read it: the fields a moderator corrects, the
 * check that the name is free, and the record the approval makes.
 */
export function proposed(item: PendingItem): Proposed {
  return { name: item.subject, city: item.city, country: item.country }
}

/** What a team is made of, as three named things rather than a bag of strings:
 *  read out of a record, each of them is "string or nothing", and the whole
 *  point here is that none of the three may be nothing. */
export type Proposed = { name: string; city: string; country: string }

/** The address a team of that name answers at, which is the thing that has to
 *  be unique: `slugify` is not one to one, so two names can make one address. */
export function addressOf(name: string): string {
  return slugify(name)
}

export function addressesIn(teams: Team[]): string[] {
  return teams.map((team) => addressOf(team.name))
}

/**
 * What is wrong with a name, as far as the address it has to make is concerned.
 *
 * Two faults and one place to work them out, because three screens ask: the
 * form a member proposes on, the form an administrator enters on, and the queue
 * that approves. Each says it in its own words, so this hands back which fault
 * rather than the sentence.
 *
 * A name that makes no address at all is the second of them, and it is not a
 * curiosity: a name written in a script the address cannot carry, or made of
 * punctuation, comes out empty. Empty, the first such team answers at `/tim/`,
 * which is no team, and every one after it is refused as a name already taken
 * though the two share nothing (ADL A4d). Cyrillic is not one of those any
 * more, which leaves the case rare and still worth saying out loud.
 */
export function nameFault(name: string, addresses: string[]): 'noAddress' | 'taken' | null {
  const address = addressOf(name)

  if (address === '') {
    return 'noAddress'
  }

  return addresses.includes(address) ? 'taken' : null
}

/** The same for a form, in the shape a form wants: the fault against the field
 *  it belongs to, or nothing at all. */
export function nameError(name: string, addresses: string[]): Record<string, FieldError> {
  const fault = nameFault(name, addresses)

  if (fault === null) {
    return {}
  }

  return { name: { key: fault === 'taken' ? 'teams.proposeTaken' : 'teams.proposeNoAddress' } }
}

/**
 * Why this proposal cannot be approved, or nothing.
 *
 * Said rather than merely done. A control that quietly does nothing teaches a
 * moderator that the screen is broken, which is the reasoning already written
 * beside the way back on this same card.
 *
 * Compared by address and not by name: the address is read off the name and is
 * what has to be unique, and `slugify` is not one-to-one. "Dunavski trkači" and
 * "Dunavski Trkaci" are two names and one address, so comparing names would let
 * the second through to collide with the first. A name that makes no address at
 * all is refused here as well, and by the same function the two forms use.
 */
export function refusal(
  made: Proposed,
  addresses: string[],
  item: PendingItem,
  /** The members who are in a team already, by number. A proposal from one of them
   *  cannot be approved: a member is in one team at a time (PDL P13), and approving
   *  makes the sender the organiser of the team it makes. Read through the overlay by
   *  the caller, so a team somebody got a minute ago in this same visit counts; two
   *  proposals from one member waiting together are the case this exists for, and the
   *  first approval is what puts them on the list for the second (review, 05.09.2026). */
  withTeam: string[],
  /** Every team there is, read through the overlay by the caller. A change is filed
   *  under the team it is about, and that team can be gone by the time anybody
   *  decides: deleting it and then approving the change wrote into an identity
   *  nothing answers to, settled the item as approved, and told the member their team
   *  had been changed (review, 05.09.2026). */
  teams: Team[],
  /** The members, read through the overlay by the caller, so „who administers this
   *  team" is the same answer here as on the screens that draw the way in. */
  members: Competitor[],
): string | null {
  if ([made.name, made.city, made.country].some((value) => value.trim() === '')) {
    return 'verification.teamIncomplete'
  }

  const fault = nameFault(made.name, addresses)

  if (fault !== null) {
    return fault === 'taken' ? 'verification.teamTaken' : 'verification.teamNoAddress'
  }

  /* Nobody to tell and nobody to put on the team. An empty member number means
     the whole league as far as the inbox is concerned (session/context.ts), so
     approving would announce somebody's team to everybody and leave the team
     without an organiser. The way back is not guarded here, only on the queue
     that writes an instruction to a member (queues.ts), so this is the one
     control on this queue that has to ask. */
  if (item.memberNumber === '') {
    return 'verification.teamNoMember'
  }

  const about = teams.find((one) => one.id === item.subjectId)

  if (isChange(item) && about === undefined) {
    return 'verification.teamGone'
  }

  /* **And sent by whoever administers that team today.** A change is the
     administrator's act (PDL, 04.09.2026), and the seat can be handed to somebody
     else while the change waits: approved then, the portal writes into a team on the
     word of a member who no longer runs it, and tells them it was done. Read at the
     moment of the decision rather than at the moment it was sent, because that is
     when the writing happens (izvedeno 05.09.2026 iz odluke o administratoru; nije
     vlasnikova rečenica nego ono što iz nje sledi). */
  if (about !== undefined && isChange(item) && teamAdminOf(about, members) !== item.memberNumber) {
    return 'verification.teamNotYours'
  }

  /* And only of a **new** team. A change is sent by the team's own administrator, who
     has a team by definition — the one being changed — so this rule read over a change
     refuses every change there will ever be. Measured 05.09.2026, the moment the two
     rules first stood in one file. */
  if (!isChange(item) && withTeam.includes(item.memberNumber)) {
    return 'verification.teamMemberHasTeam'
  }

  return null
}

/** The team a proposal would make, with whatever the moderator has corrected. */
export function teamFrom(item: PendingItem, edits: Edits): Proposed {
  const said = proposed(item)

  return {
    name: String(edits[item.id]?.name ?? said.name),
    city: String(edits[item.id]?.city ?? said.city),
    country: String(edits[item.id]?.country ?? said.country),
  }
}

/**
 * Every member who already has a team, by number, read from **both** places that
 * say so.
 *
 * A member's own record says it (`teamId`, written by an approval), and so does the
 * team that approval made (`organizerMemberNumber`). Read off the record alone, the
 * two came apart the moment the record was not there to write to: a member deleted
 * from the list, or simply absent from it, left the team standing with their number
 * on it and nothing anywhere saying they had one, so a second proposal of theirs went
 * through on the next press (review, 05.09.2026). The sweep survived it only because
 * it carries its own list along the walk; „Odobri" pressed twice had no memory at all.
 *
 * The same shape the addresses beside it already have: `addressesIn` reads the teams
 * through the overlay, so a team made this visit counts. This reads the same list for
 * the same reason.
 */
export function organisers(members: { memberNumber: string; teamId: string | null }[], teams: Team[]): string[] {
  return [
    ...members.flatMap((one) => (teamOf(one) === null ? [] : [one.memberNumber])),
    ...teams.map((one) => one.organizerMemberNumber),
  ]
}

/**
 * Whether a waiting item is a change of a team that already exists.
 *
 * The mark rather than the id, because the id answers a different question: an
 * item filed under a team that has since been deleted still arrived as a change,
 * and reading `subjectId` would quietly turn it into a proposal for a new team
 * with the same name (owner, 04.09.2026, one queue and a mark on the item).
 */
export function isChange(item: PendingItem): boolean {
  return item.kind === 'teamEdit'
}

/**
 * The addresses a waiting item has to be free of, which is every address but the
 * one belonging to the team it is about.
 *
 * A change that leaves the name alone would otherwise be refused for clashing
 * with itself, and a moderator would be told the name is taken by the very team
 * on the card. A proposal is about no team yet, so nothing is taken out of the
 * list for it, and a change filed under a team nobody can find is read the same
 * way: it clashes with everything a new team would clash with.
 */
export function addressesAgainst(item: PendingItem, teams: Team[], addresses: string[]): string[] {
  const own = teams.find((one) => one.id === item.subjectId)

  return own === undefined ? addresses : addresses.filter((one) => one !== addressOf(own.name))
}
