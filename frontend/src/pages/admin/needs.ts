import { isStaff, type Role } from '../../roles/context'
import { ENTITY_FORMS, type EntityDef } from './entityForms'
import { QUEUES, type Queue } from './queues'
import { entityRight, queueRight, type Right } from './rights'

/**
 * What every administrative address asks of whoever opens it.
 *
 * Written down once, beside the addresses themselves, and applied by the route
 * table rather than by the screens (routeObjects.tsx). Fourteen screens each
 * carrying their own check is fourteen chances to write `isStaff` and be done
 * with it, which is exactly what had happened: the superadmin could untick all
 * sixteen boxes of a moderator, and that moderator could still open the price
 * list and change what a membership costs.
 *
 * A fifteenth screen therefore cannot be added without answering this question,
 * because a route under `administracija` that is not in here has no entry at all
 * and a test says so (needs.test.ts).
 */
export type Need =
  /** Administration, and nothing finer. The panel, which is a list of whatever
   *  the person may open and is empty rather than closed. */
  | { of: 'staff' }
  /**
   * The way into a section: at least one thing inside it must be open.
   *
   * The two hubs used to ask only for staff, and that is what every moderator
   * is. So a moderator holding one queue was still offered both section names in
   * the menu, and both bounced him to the front page: two links that do nothing,
   * on the one screen that is supposed to say what there is (owner, 30.07.2026).
   * Asked as a need rather than in the menu, so the door and the menu go on
   * answering out of one table.
   */
  | { of: 'anyQueue' }
  | { of: 'anyEntity' }
  /** The superadmin alone, for the one entity no tick can ever open (PDL P21). */
  | { of: 'superadmin' }
  /** One box in the matrix. The right travels whole rather than as its key, so
   *  a refusal can name in words what the moderator has to ask for. */
  | { of: 'right'; right: Right }

const HUB_NEEDS: Record<string, Need> = {
  administracija: { of: 'staff' },
  'administracija/entiteti': { of: 'anyEntity' },
  'administracija/verifikacija': { of: 'anyQueue' },
}

/**
 * What one entity's screen asks of whoever opens it, and what one queue asks.
 *
 * The right is made from the entity or the queue in hand rather than fetched out
 * of the matrix by a key made from it (rights.ts). The same fact reached two
 * ways is two facts as soon as one of them is edited, and the fetched one could
 * come back empty besides: an entity whose right was filed under a name spelt
 * differently produced a door that asked for nothing at all, which is a door
 * standing open.
 */
function needForEntity(entity: EntityDef): Need {
  return entity.superadminOnly === true
    ? { of: 'superadmin' }
    : { of: 'right', right: entityRight(entity) }
}

function needForQueue(queue: Queue): Need {
  return { of: 'right', right: queueRight(queue) }
}

/* Read off the same two lists the matrix is built from, so an entity or a queue
 * arrives with its guard on the day it arrives, and cannot arrive with a column
 * in the matrix and no door on the screen behind it. */
export const NEEDS: Record<string, Need> = {
  ...HUB_NEEDS,
  ...Object.fromEntries(ENTITY_FORMS.map((entity) => [entity.path, needForEntity(entity)])),
  ...Object.fromEntries(QUEUES.map((queue) => [queue.path, needForQueue(queue)])),
}

/** What an address asks for, or nothing where it asks for nothing: every screen
 *  outside administration. */
export function needFor(path: string): Need | undefined {
  return NEEDS[path]
}

/**
 * Whether somebody may open an address that asks for something.
 *
 * The one place the question is answered, because two places would answer it
 * differently within a release. The door asks it (Guard.tsx), and so does the
 * navigation, before naming a screen at all: a moderator is not to be aware that
 * there are actions nobody gave him (owner, 30.07.2026).
 *
 * It answers yes or no and nothing else. It used to say which of three refusals
 * it was, so the screen could name the right to go and ask for; there is no
 * refusal screen any more (Guard.tsx), and a sentence naming a right is the one
 * thing that decision was meant to stop being said.
 */
export function mayOpen(need: Need, role: Role, may: (right: string) => boolean): boolean {
  if (!isStaff(role)) {
    return false
  }

  if (need.of === 'superadmin') {
    return role === 'superadmin'
  }

  if (need.of === 'anyQueue') {
    /* Asked of the queue itself rather than of its entry in the table above.
       The queue is in hand, and its address is only the name the table files it
       under, so going out to the table by that name is a lookup that has to
       answer for an address the table has never heard of. It is the same
       question either way, put to the thing that answers it. */
    return QUEUES.some((queue) => mayOpen(needForQueue(queue), role, may))
  }

  if (need.of === 'anyEntity') {
    /* The ones the section actually holds, which is not all of them: an entity
       whose rows are fixed is not in it (entityForms.ts). Counting it here
       offered "Entiteti" to a moderator whose one entity right is the price
       list, and the section it opened was empty. */
    return ENTITY_FORMS.some(
      (entity) => entity.fixed !== true && mayOpen(needForEntity(entity), role, may),
    )
  }

  return need.of === 'staff' || may(need.right.key)
}
