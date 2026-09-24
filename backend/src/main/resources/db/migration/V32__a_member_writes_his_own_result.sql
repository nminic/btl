/* THE TWO THINGS THE TABLE OF V10 IS MISSING ON THE DAY SOMETHING FINALLY WRITES TO IT.
 *
 * V10 built `result_submission` for a run that is waiting to be judged, and nothing has ever
 * inserted a row into it: every `insert into result_submission` in this repository is in
 * `src/test`. This migration comes with the route that writes the first real one, and it closes
 * exactly the two holes that route opens and no more.
 *
 *
 * ONE. THE LENGTH, WHICH V25 NAMED AS A DEBT AND AIMED AT THIS INCREMENT BY NAME
 * ------------------------------------------------------------------------------
 * V25 widened `race.distance_km` to numeric(8,4) on the owner's decision of 19.09.2026 - „Hocu da
 * mogu da unosim tacnu duzinu, ali se prikazuje zaokruzeno" - and wrote down, in as many words,
 * what it was deliberately leaving undone:
 *
 *     `result.distance_km` and `result_submission.distance_km` are `numeric(6,2)` and STAY
 *     `numeric(6,2)` here... nothing on this server can yet put a distance into either of the
 *     other two... It will not stay unreachable, and the increment that first WRITES a result
 *     has to close it in the same commit as the route.
 *
 * This is that increment for ONE of the two columns, and the difference between them is measured
 * rather than preferred:
 *
 *   - `result_submission.distance_km` IS reachable from the route this migration comes with. A
 *     member reporting a run on a race the calendar holds does not type a length at all - PDL,
 *     owner, 03.08.2026: „Duzina, uspon i spust se ne unose, nego se uzimaju sa izabrane trke" -
 *     so the server copies `race.distance_km` into this column. A race measured at 42.195 would
 *     be stored here as 42.20, and the member's own submission would say a different length from
 *     the race he picked, silently, with no constraint broken.
 *
 *   - `result.distance_km` is NOT reachable from it. Nothing inserts into `result` anywhere in
 *     `src/main`, and this increment does not either: what a member sends is a SUBMISSION, and a
 *     submission becomes a result only when a moderator approves it, which `VerificationWriteApi`
 *     refuses to this day (`CARRIED_OUT_HERE` names profiles, teams, comments and schedule, and
 *     not results). So widening it here would be half an increment: V25's other half is
 *     `com.btl.portal.domain.ranking.Totals`, which refuses a third decimal BY DESIGN and names
 *     `numeric(6,2)` as its reason, and a widened column under an unchanged `Totals` turns a
 *     profile into a 500 the first time such a row exists.
 *
 * THE BOUNDARY, WRITTEN HERE RATHER THAN LEFT TO BE FOUND: `result.distance_km` is still
 * numeric(6,2), so the increment that teaches a moderator to APPROVE a result carries both halves
 * of V25's debt - the widening AND `Totals` - and until then an approval would round the length
 * it copies. That is a round on a table nothing writes to, not a round on a member's data.
 *
 *
 * TWO. WHICH RESULT A CORRECTION IS A CORRECTION OF
 * --------------------------------------------------
 * PDL, owner, 27.08.2026 (`PDL.md`:1076 and the decision under it): „clan ga ili brise (ima pravo
 * na to, iako je verifikovan) ili menja i dostavlja dokaz za tu izmenu (ponovo)", and of the
 * change itself: „Ispravljen rezultat ide na kraj reda kao nov" and „Stavka u redu nosi oznaku da
 * je ispravljana, i nista vise od toga."
 *
 * A correction is therefore a SUBMISSION and not an edit: the member's counted result stands
 * untouched while it waits (owner, 28.08.2026, choosing between four outcomes: „Stari rezultat
 * ostaje u poretku dok ispravka ceka, i menja se tek kad je moderator odobri"). V10 gave the
 * table no way to say which result that is, so a correction and a fresh report were the same row
 * - which is the very thing PDL P22 calls „nacin da se rezultat promeni bez traga".
 *
 * One nullable column, the shape V10 already uses for `race_id` and V13 for `to_id`: there or not,
 * rather than a flag and a pointer that have to agree. Present means „this is a correction of that
 * result", and it is both halves of the owner's sentence at once - the label the queue shows, and
 * the row an approval will have to replace.
 *
 * `on delete cascade`, and it is the same sentence V10 wrote for `verification`: a correction of a
 * result that is gone is a correction of nothing. It is reachable on purpose - the member may
 * delete the very result he is correcting, which PDL lets him do at any time - and it takes the
 * `verification` row with it through `verification_result_submission_fk`, so no queue item is left
 * pointing at a run nobody can see.
 *
 * WHAT THIS COLUMN DOES NOT SAY, named rather than pretended: that the correction is about the
 * same race as the result it corrects. PDL, 27.08.2026: „Menja se sve osim trke. Ko je pogresio
 * trku, brise rezultat i unosi nov." A check cannot reach `result` to compare, so the route reads
 * the race off the result rather than off the request and never asks the member for it. The check
 * below holds the half that IS expressible: a result always has a race in the calendar
 * (`result_race_fk` is not nullable), so a correction of one can never be a described race.
 */

alter table result_submission
    alter column distance_km type numeric(8, 4);

alter table result_submission
    add column amends_result_id bigint;

alter table result_submission
    add constraint result_submission_amends_fk foreign key (amends_result_id)
        references result (id) on delete cascade,

    /* A correction inherits the race of the result it corrects, and every result has one. So a row
       that names a result and describes a race is a row claiming both at once, and there is no
       reading of it that is right. */
    add constraint result_submission_a_correction_keeps_the_race_it_corrects
        check (amends_result_id is null or race_id is not null);

create index result_submission_amends_idx on result_submission (amends_result_id);
