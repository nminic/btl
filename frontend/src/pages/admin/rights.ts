import type { Moderator } from '../../data/types'
import type { Rights } from '../../session/context'
import { ENTITY_FORMS } from './entityForms'
import { QUEUES } from './queues'

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
  noteKey: string
  rights: Right[]
}

const ENTITY_RIGHTS: Right[] = ENTITY_FORMS.map((entity) => ({
  key: `entity:${entity.id}`,
  group: 'entities',
  nameKey: `rights.column.entity.${entity.id}`,
  actionKey: `rights.action.entity.${entity.id}`,
}))

const QUEUE_RIGHTS: Right[] = QUEUES.map((queue) => ({
  key: `queue:${queue.id}`,
  group: 'queues',
  nameKey: `rights.column.queue.${queue.id}`,
  actionKey: `rights.action.queue.${queue.id}`,
}))

export const RIGHT_GROUPS: RightGroup[] = [
  {
    id: 'entities',
    headingKey: 'rights.groupEntities',
    noteKey: 'rights.groupEntitiesNote',
    rights: ENTITY_RIGHTS,
  },
  {
    id: 'queues',
    headingKey: 'rights.groupQueues',
    noteKey: 'rights.groupQueuesNote',
    rights: QUEUE_RIGHTS,
  },
]

/** Every box in the matrix, in the order it is drawn. */
export const RIGHTS: Right[] = RIGHT_GROUPS.flatMap((group) => group.rights)

/**
 * The first right of every group after the first, which is where the line
 * between two groups is drawn.
 *
 * Counted from the groups rather than written into the stylesheet as the
 * eleventh column. A tenth entity would move that line silently and leave it
 * drawn through the middle of the entities, which is exactly the sort of thing
 * nobody notices for a year.
 */
export const GROUP_STARTS: Set<string> = new Set(
  RIGHT_GROUPS.slice(1).map((group) => group.rights[0].key),
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
