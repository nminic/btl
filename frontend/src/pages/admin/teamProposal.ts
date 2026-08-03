import type { PendingItem, Team } from '../../data/types'
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
 * Why this proposal cannot be approved, or nothing.
 *
 * Said rather than merely done. A control that quietly does nothing teaches a
 * moderator that the screen is broken, which is the reasoning already written
 * beside the way back on this same card.
 *
 * Compared by address and not by name: the address is read off the name and is
 * what has to be unique, and `slugify` is not one-to-one. "Dunavski trkači" and
 * "Dunavski Trkaci" are two names and one address, so comparing names would let
 * the second through to collide with the first.
 */
export function refusal(made: Proposed, addresses: string[], item: PendingItem): string | null {
  if ([made.name, made.city, made.country].some((value) => value.trim() === '')) {
    return 'verification.teamIncomplete'
  }

  if (addresses.includes(addressOf(made.name))) {
    return 'verification.teamTaken'
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
