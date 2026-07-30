import type { Role } from '../../roles/context'
import { ENTITY_FORMS, type EntityDef } from './entityForms'

/* Everything administration can create, change and remove (PDL P28a).
 *
 * Read off the entity definitions rather than written out again beside them. It
 * was a second list, and a second list of the same nine things is a list that
 * will one day hold eight: an entity missing from it is an entity nobody
 * remembers to build, which is what it exists to prevent.
 */
export const ENTITIES: EntityDef[] = ENTITY_FORMS

/**
 * The ones the given role may open, which is everything but moderators for a
 * moderator.
 *
 * Assigning rights is the one thing a moderator may not do (PDL P21), and a tile
 * that answers "this is not for you" is worse than no tile: it tells somebody
 * there is a screen they are being kept out of, on the screen that exists to say
 * what there is.
 */
export function entitiesForRole(role: Role): EntityDef[] {
  return ENTITIES.filter((entity) => entity.superadminOnly !== true || role === 'superadmin')
}
