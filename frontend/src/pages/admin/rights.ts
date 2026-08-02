import { useCallback } from 'react'
import type { Moderator } from '../../data/types'
import { useRole } from '../../roles/useRole'
import type { Rights } from '../../session/context'
import { useSession } from '../../session/useSession'
import { ENTITY_FORMS, type EntityDef } from './entityForms'
import { QUEUES, type Queue } from './queues'

/* What a moderator may do, one box at a time (PDL P21, P28a, ADL A8).
 *
 * Rights are granular by entity and by action, and never one level called
 * "moderator": the superadmin gives each of them a different set, and a single
 * level would make the six people who administer this portal into one person
 * with six passwords.
 *
 * Two groups, because they are different actions on different things. Editing an
 * entity changes a record. Deciding in a queue lets somebody else's work out, or
 * hands it back. Somebody may be trusted to judge results without being trusted
 * to rewrite the price list, and that is the ordinary case rather than the
 * exotic one.
 *
 * Both groups are read off lists that already exist, so a tenth entity or a
 * ninth queue arrives with its column rather than waiting for somebody to
 * remember this file: the entities come from ENTITY_FORMS and the queues from
 * QUEUES. Only the words are added here, and a test says so out loud when they
 * are missing.
 *
 * This is also the file that answers the question, and not only the one that
 * draws the boxes: useMay below is what every administrative screen is guarded
 * by (Guard.tsx). A matrix nothing consults is a screen that looks as though it
 * does something and does not, which is worse than no screen at all.
 */

export type RightGroupId = 'entities' | 'queues'

export type Right = {
  /**
   * The key it is written down under, and the reason for the prefix: an entity
   * and a queue can carry the same id. Leagues and teams do, both of them, so
   * "leagues" on its own would mean either editing the league or approving one
   * somebody proposed, which are not remotely the same permission.
   */
  key: string
  group: RightGroupId
  /** What stands over the column, one or two words. */
  nameKey: string
  /** What the box does, as words that stand on their own: "uređivanje događaja",
   *  "odlučivanje o uplatama". This is what makes the box's own name readable
   *  away from the row and the column it sits in, which a screen reader never
   *  reads for you. */
  actionKey: string
}

export type RightGroup = {
  id: RightGroupId
  headingKey: string
  rights: Right[]
}

/**
 * One column per entity, less the ones no moderator may ever open.
 *
 * Moderators are the only such entity today, and the exclusion is read off the
 * entity definition rather than named here (entityForms.ts, `superadminOnly`),
 * because it is a fact about the entity: the screen behind it is closed to a
 * moderator by PDL P21, and no tick anywhere could open it. A column for it was
 * a box the superadmin could set, a row that then read seventeen rights, and a
 * moderator who got the same refusal as before. A promise the specification
 * forbids anyone to keep is worse than no promise.
 */
/**
 * The right that opens one entity, and the one that opens one queue.
 *
 * Made from the thing they guard rather than looked up by a key made from it,
 * which is what the door used to do: it built "queue:teams" out of the queue in
 * its hand and went to fetch the right filed under that name, from a record
 * typed by "any string at all". So a right that was certain to be there had to
 * be treated as one that might not be, and the only thing standing between a
 * misspelt key and a screen nobody could ever open was that the two spellings
 * were written the same way twice (needs.ts). Built here, the key is spelt once
 * and the right cannot be missing, because there is nothing to look up.
 */
export function entityRight(entity: EntityDef): Right {
  return {
    key: `entity:${entity.id}`,
    group: 'entities',
    nameKey: `rights.column.entity.${entity.id}`,
    actionKey: `rights.action.entity.${entity.id}`,
  }
}

export function queueRight(queue: Queue): Right {
  return {
    key: `queue:${queue.id}`,
    group: 'queues',
    nameKey: `rights.column.queue.${queue.id}`,
    actionKey: `rights.action.queue.${queue.id}`,
  }
}

const ENTITY_RIGHTS: Right[] = ENTITY_FORMS.filter(
  (entity) => entity.superadminOnly !== true,
).map(entityRight)

const QUEUE_RIGHTS: Right[] = QUEUES.map(queueRight)

/* A group carries its heading and nothing else. It used to carry a note as well,
 * under two keys that were never written into the dictionary and never rendered;
 * the first person to draw them would have got the text of the key on screen.
 * What the two groups are and why they are two is said once, over the whole
 * table, in rights.intro. */
export const RIGHT_GROUPS: RightGroup[] = [
  { id: 'entities', headingKey: 'rights.groupEntities', rights: ENTITY_RIGHTS },
  { id: 'queues', headingKey: 'rights.groupQueues', rights: QUEUE_RIGHTS },
]

/** Every box in the matrix, in the order it is drawn. */
export const RIGHTS: Right[] = RIGHT_GROUPS.flatMap((group) => group.rights)

/**
 * The first right of every group after the first, which is where the line
 * between two groups is drawn.
 *
 * Counted from the groups rather than written into the stylesheet as the
 * ninth column. A tenth entity would move that line silently and leave it
 * drawn through the middle of the entities, which is exactly the sort of thing
 * nobody notices for a year.
 *
 * The first right of a group is taken as the first one of the few rather than
 * by its number, so a group that has none draws no line: there is no column for
 * it to be drawn before, and asking for the first of nothing is a question with
 * no answer where taking the few gives none.
 */
export const GROUP_STARTS: Set<string> = new Set(
  RIGHT_GROUPS.slice(1)
    .flatMap((group) => group.rights.slice(0, 1))
    .map((right) => right.key),
)

/**
 * Whether this moderator holds this right, read through what has been ticked
 * during this visit.
 *
 * The same overlay the rest of administration uses: the record underneath keeps
 * what it was given, and the box remembers what was done to it. Written down
 * rather than derived, so unticking a right somebody has is remembered as
 * exactly that and not as the absence of a tick.
 */
export function allowed(moderator: Moderator, key: string, rights: Rights): boolean {
  return rights[moderator.id]?.[key] ?? moderator.rights.includes(key)
}

/** How many of the boxes in a row are ticked, which is what the list shows and
 *  what makes a moderator with none of them say so rather than look unfinished. */
export function grantedCount(moderator: Moderator, rights: Rights): number {
  return RIGHTS.filter((right) => allowed(moderator, right.key, rights)).length
}

/**
 * Whether whoever is at the keyboard holds a given right. The one question every
 * administrative screen asks, asked in one place (PDL P21, ADL A8).
 *
 * Three answers rather than one lookup, and the order is the rule:
 *
 * - The superadmin holds everything, always, and is never looked up. He has no
 *   row in the matrix precisely because there is nothing to give him or take
 *   away (PDL P28a, 30.07.2026).
 * - A moderator holds what has been ticked for **him**. Which moderator that is
 *   comes off the role, not off the word "moderator": until the switch could
 *   name one, nothing connected the person signed in to a row in the table, and
 *   the matrix could not have been enforced even by a screen that tried.
 * - Everybody else holds nothing. A visitor and a competitor never reach these
 *   screens at all, and a moderator nobody has named is nobody.
 *
 * A predicate rather than a boolean per call, because a screen that filters a
 * list asks this of every row and a hook cannot be called in a loop.
 */
export function useMay(): (right: string) => boolean {
  const { role, moderator } = useRole()
  const { rights } = useSession()

  return useCallback(
    (right: string) => {
      if (role === 'superadmin') {
        return true
      }

      return moderator !== null && allowed(moderator, right, rights)
    },
    [role, moderator, rights],
  )
}
