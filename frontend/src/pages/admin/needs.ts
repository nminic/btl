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
  /** Administration, and nothing finer. The three screens that are lists of the
   *  others: the panel, the entities and the queues. */
  | { of: 'staff' }
  /** The superadmin alone, for the one entity no tick can ever open (PDL P21). */
  | { of: 'superadmin' }
  /** One box in the matrix. The right travels whole rather than as its key, so
   *  a refusal can name in words what the moderator has to ask for. */
  | { of: 'right'; right: Right }

const HUBS = ['administracija', 'administracija/entiteti', 'administracija/verifikacija']

/* Read off the same two lists the matrix is built from, so an entity or a queue
 * arrives with its guard on the day it arrives, and cannot arrive with a column
 * in the matrix and no door on the screen behind it. */
export const NEEDS: Record<string, Need> = {
  ...Object.fromEntries(HUBS.map((path) => [path, { of: 'staff' } as Need])),
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
