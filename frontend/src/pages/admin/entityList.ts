import { ENTITY_FORMS, type EntityDef } from './entityForms'

/* Everything administration can create, change and remove (PDL P28a).
 *
 * Read off the entity definitions rather than written out again beside them. It
 * was a second list, and a second list of the same nine things is a list that
 * will one day hold eight: an entity missing from it is an entity nobody
 * remembers to build, which is what it exists to prevent.
 *
 * Which of them a given person may open is not answered here any more. It was
 * `entitiesForRole`, which knew only that moderators are closed to a moderator;
 * a moderator now sees only the entities he was given (owner, 30.07.2026), and
 * that is one question with one answer, asked through the same table the door
 * asks (mayOpen.ts).
 */
export const ENTITIES: EntityDef[] = ENTITY_FORMS
