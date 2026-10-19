/* A RUN ON AN EVENT THE MEMBER CHOSE CARRIES NO TOWN OF ITS OWN: THE TOWN LIVES ON THE EVENT.
 *
 * V66 let a run on a race the calendar does not hold name its event, chosen by its key or typed. V10
 * still required every such run to name a town (`result_submission_described_race_names_its_town`),
 * so a member who chose an event of the calendar would have been asked for the town that event already
 * has, and the run would have carried a second answer to it - typed by hand, so even an event in a town
 * of the codebook would come back as a typed name.
 *
 * Decided on 19.10.2026 between the outcomes offered, on the coordinator's derivation from the rule
 * that a fact has one home (ADL A31): a run with a chosen event carries no place, and the place lives on
 * the event. Not the owner's sentence; the owner's are the ones V66 quotes.
 *
 *
 * WHAT CHANGES
 * ------------
 * V10's biconditional said two things in one check, and only one of them still holds:
 *
 *   - a run from the calendar names no town of its own, because its race's event has one. That half
 *     stands, now as a check of its own (`result_submission_a_calendar_run_names_no_town`);
 *   - a described run names its town. That half falls: a described run on a CHOSEN event names none
 *     (`result_submission_a_chosen_event_brings_its_town`), and a described run on a TYPED event still
 *     names one, which the route requires and the schema cannot.
 *
 * WHY THE SCHEMA CANNOT SAY „ITS TOWN OR ITS EVENT", and it is written down rather than left to be
 * found: `result_submission_event_fk` is `on delete set null` (V66), so deleting an event a run was
 * chosen on would turn that run into one with neither, and a check requiring one of the two would
 * refuse the delete of the EVENT. Losing the run with the event, or refusing to delete an event while a
 * run waits on it, are both decisions nobody has made. So the boundary is: after the event it was
 * chosen on is deleted, a run waits naming neither a town nor an event, and the moderator who decides
 * it names both (PDL P9, 19.10.2026: „Na moderatorovom ekranu nov događaj traži naziv, datum i mesto").
 *
 *
 * WHAT IT DOES TO THE ROWS THAT ARE ALREADY THERE
 * -----------------------------------------------
 * Every row V66 left either names no event, or names a typed one beside its town; neither is touched.
 * The one shape the new check refuses is a run with a chosen event AND a town, which the route of V66
 * required (it asked for a town on every described run). Such a row can exist only if somebody sent a
 * chosen event to the route between V66 and this file, which the portal's own form never did - but the
 * shape is a real one, so it is settled here rather than left to stop the migration: its town is
 * dropped, because the event it names already has one and that is the only home a town now has on such
 * a row. Nothing is invented and nothing the member said is lost but a copy of what the event says.
 * `ARunOnAChosenEventCarriedOverTest` runs this file over every shape the table can hold.
 *
 * This file does not change once it is applied (ADL A2); a correction is the next migration.
 */
/* V10's rule goes FIRST: the row it would refuse is exactly the one the update below leaves, a described
   run with no town of its own. Measured by `ARunOnAChosenEventCarriedOverTest` in the other order. */
alter table result_submission
    drop constraint result_submission_described_race_names_its_town;

update result_submission
   set place_id = null, city = null, country_id = null
 where race_id is null and event_id is not null;

alter table result_submission
    /* The half of V10's biconditional that stands: a run from the calendar names no town of its own. */
    add constraint result_submission_a_calendar_run_names_no_town
        check (race_name is not null or (place_id is null and city is null)),

    /* And a run on an event he chose names none either: the event's is the town. */
    add constraint result_submission_a_chosen_event_brings_its_town
        check (event_id is null or (place_id is null and city is null));
