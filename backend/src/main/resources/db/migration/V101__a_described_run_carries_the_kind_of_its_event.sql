/* A RUN ON A RACE THE CALENDAR DOES NOT HOLD CARRIES THE KIND OF ITS EVENT: A SCORED OR AN UNSCORED RACE.
 *
 * Owner, PDL, 14.11.2026 („Ostale discipline kao lična evidencija”, after the detailed plan), (4): „Kad
 * član opiše događaj kojeg nema u kalendaru, u formi bira Bodovana ili Nebodovana trka (podrazumevano
 * Bodovana)”, and 15.11.2026, overturning the second half of that sentence: „Racunaj da nikad ne sme da
 * promeni”, with the outcome he chose: „moderator vrstu ne menja. Vrsta je onakva kakvu je član izabrao".
 * Until this file nothing kept that choice, so the approval made every event it made a scored race
 * (`VerificationWriteApi`, which wrote `race` as a literal) and an unscored run would have gone in as a
 * scored one.
 *
 *
 * ONE COLUMN, ON EVERY DESCRIBED RUN AND ON NOTHING ELSE
 * ------------------------------------------------------
 * The member chooses the kind where he TYPES the name of an event the calendar does not have. Where he
 * CHOSE an event of the calendar (V66 `event_id`), the kind is that event's, and the route copies it here
 * when the run is sent (`ResultWriteApi`): a chosen event the administration deletes while the run waits
 * sets `event_id` empty (V66, `on delete set null`), and the kind the member chose with it must not go with
 * it. So the column is said of the ROAD and not of how the event was named: a run the member described
 * (`race_id is null`) always carries one, and a run on a race of the calendar never does, since that race
 * has its event and a second answer here could disagree with it (V66's own reasoning for `event_id`).
 *
 * The approval writes the run onto a race of the calendar and clears the description with it
 * (`VerificationWriteApi`, the update that empties `race_name`, `event_id` and `event_name`), and it clears
 * this column in the same statement, which is what the constraint below asks of it.
 *
 *
 * WHAT IT DOES TO THE ROWS THAT ARE ALREADY THERE
 * -----------------------------------------------
 * Every described run standing today was sent while a scored race was the only race there was (V99 made
 * the unscored kind, and no route has been able to describe one), so each of them is given `race`: that is
 * the kind it was sent under, not a default chosen for it. A run on a race of the calendar is not touched.
 * `DescribedRunKindCarriedOverTest` runs this file over the shapes the table holds (a run from the calendar,
 * a described run with an event typed, one with an event chosen, one naming no event, a correction) and
 * holds that each is still there and carries what is said here.
 *
 * This file does not change once it is applied (ADL A2); a correction is the next migration.
 */
alter table result_submission
    add column event_kind text;

update result_submission set event_kind = 'race' where race_id is null;

alter table result_submission
    add constraint result_submission_event_kind_known
        check (event_kind is null or event_kind in ('race', 'unscored')),

    /* A described run carries the kind of its event, and a run on a race of the calendar does not. */
    add constraint result_submission_a_described_run_carries_its_kind
        check ((race_id is null) = (event_kind is not null));
