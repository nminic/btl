import { isStaff, type Role } from '../../roles/context'
import { ENTITY_FORMS } from './entityForms'
import { QUEUES } from './queues'
import { RIGHT, type Right } from './rights'

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

/* Read off the same two lists the matrix is built from, so an entity or a queue
 * arrives with its guard on the day it arrives, and cannot arrive with a column
 * in the matrix and no door on the screen behind it. */
export const NEEDS: Record<string, Need> = {
  ...HUB_NEEDS,
  ...Object.fromEntries(
    ENTITY_FORMS.map((entity) => [
      entity.path,
      entity.superadminOnly === true
        ? ({ of: 'superadmin' } as Need)
        : ({ of: 'right', right: RIGHT[`entity:${entity.id}`] } as Need),
    ]),
  ),
  ...Object.fromEntries(
    QUEUES.map((queue) => [queue.path, { of: 'right', right: RIGHT[`queue:${queue.id}`] } as Need]),
  ),
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
    return QUEUES.some((queue) => mayOpen(NEEDS[queue.path], role, may))
  }

  if (need.of === 'anyEntity') {
    return ENTITY_FORMS.some((entity) => mayOpen(NEEDS[entity.path], role, may))
  }

  return need.of === 'staff' || may(need.right.key)
}
