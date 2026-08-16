import type { Competitor } from '../data/types'
import { slugify } from './rulebookToc'

/**
 * Where a competitor's profile lives, and how to read a number back out of it.
 *
 * Owner, 14.08.2026, asked why the address carried only a number: „Treba da bude
 * i ime i prezime. Zašto bi bila samo broj?" PDL P11 has said the same since
 * 31.07.2026 and named the shape: `/sr/takmicar/000127-nikola-minic`, one form
 * and no alias.
 *
 * Two functions rather than one, and they are the whole of the rule. Twelve
 * places in the portal linked to a profile and every one of them wrote the
 * address out by hand, which is how a rule about addresses ends up kept in some
 * of them: the same thing happened to the rule about a hidden member, kept on
 * two screens out of eight (components/CompetitorName.tsx).
 */

/**
 * The member number is what the address is answered by; the name is for the
 * person reading it.
 *
 * So the number stands in front, where it can be read off without knowing
 * anything about names, and the rest is decoration a browser will carry.
 * Somebody who types or shares the number alone lands on the same profile,
 * which is what makes this one address rather than two: nothing redirects and
 * nothing is aliased.
 */
export function profilePath(competitor: Competitor, locale: string): string {
  return `/${locale}/takmicar/${addressOf(competitor)}`
}

/**
 * The last part of that address: the number, and the name behind it.
 *
 * Used by `profilePath` and `redirectTo` above, which are what the rest of the
 * portal calls. It was reached from outside as well, by two screens that built a
 * canonical address on top of it; that machinery is gone, because it could not
 * change anything (app/useRouteChrome.ts). Exported still, because it is the
 * half of the rule the tests measure the other two against, and because a
 * caller that needs the address without the language in front is a caller this
 * module should answer rather than one that spells it out again.
 */
export function addressOf(competitor: Competitor): string {
  const name = slugify(`${competitor.firstName} ${competitor.lastName}`)

  /* A name that makes no address at all is not impossible: `slugify` answers
     with nothing for a name written entirely in punctuation, and the league is
     run across a region whose alphabets it has had to learn one at a time
     (rulebookToc.ts). The number alone is still a working address, so a member
     whose name cannot be spelt keeps a profile rather than an address ending in
     a bare dash. */
  return name === '' ? competitor.memberNumber : `${competitor.memberNumber}-${name}`
}

/**
 * The member number out of whatever the address carried.
 *
 * Everything up to the first dash, which is the number, because the number is
 * six digits and a name never begins one. Read this way rather than by
 * splitting off the name, a bookmark from before this change still opens the
 * profile it was made on, and so does an address somebody typed the number of
 * and nothing else. That is not an alias: there is one address, and this reads
 * the part of it that identifies anybody.
 *
 * A name that has been changed since the link was made leads to the same
 * profile as well, which is the reason the number is in front rather than
 * behind. Nothing on this portal has to be told when somebody marries.
 */
export function memberNumberIn(part: string | undefined): string | undefined {
  return part?.split('-')[0]
}

/**
 * Where to send a reader who arrived at some other spelling of this profile.
 *
 * PDL P11 asks for one address and no alias. The number alone still opens a
 * profile, because that is what identifies anybody and a bookmark made before
 * the name was in the address has to keep working; leaving it there would make
 * that a second address, which is the thing the decision refuses.
 *
 * So it is not a second address, it is a way in: the reader is moved to the one
 * address, in place, and what they share afterwards is the canonical one. The
 * canonical link says the same thing to a search engine, and this says it to
 * the person.
 *
 * Nothing where the address is already right, which is every ordinary visit.
 */
export function redirectTo(
  competitor: Competitor,
  part: string | undefined,
  locale: string,
  tail = '',
): string | null {
  const address = addressOf(competitor)

  return part === address ? null : `/${locale}/takmicar/${address}${tail}`
}
