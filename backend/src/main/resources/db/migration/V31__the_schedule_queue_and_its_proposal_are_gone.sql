/*
 * THE SIXTH TAB LEAVES, AND WITH IT THE TABLE V30 GAVE IT TO POINT AT.
 *
 * The owner, 22.09.2026 (PDL P10a, „Prijave promene termina nema, i termin nema stanje"):
 * „Ne postoji nepotvrđen termin. Ako ga unesem u kalendar, to je na osnovu nekih dokaza. Tako
 * hoću da radim. Samim tim nema nikakvih rokova kad će termin postati potvrđen"; and „ne javlja
 * mi putem portala nego recimo na mail ili nekim drugim sredstvom - ukratko ne mora da brine o
 * tome portal"; and, in as many words, „Red „Prijave promene termina" se uklanja iz
 * administracije u celini, zajedno sa pravom za njega. Redova je pet, ne šest."
 *
 * WHAT STAYS, so the next reader does not go looking for it. A visitor still sees exactly one
 * date on an event, the one entered, and an event still carries no state of its own - neither
 * of those was ever this table's to hold. And the road that corrects a wrong date is unchanged:
 * an administrator edits it from the event screen and its races move with it by the same number
 * of days, which V29 already built and this migration does not touch. „Ovo nikad nije bilo o
 * prijavi termina" (P10b, said of the neighbouring decision that also lives on that road) - it
 * would have been reachable from `EventWriteApi` even had `schedule_proposal` never existed.
 *
 * THE ORDER BELOW IS NOT A PREFERENCE, IT IS THE ONLY ORDER THE SCHEMA ACCEPTS. Both
 * `verification.right_code` (V9) and `account_admin_right.right_code` (V18) hold a foreign key
 * to `admin_right(code)` with `on delete restrict`, so the row `('queue', 'schedule')` cannot go
 * while a `verification` row still names it or a moderator still holds the tick. Deleting a
 * right the schema still leans on is not this migration's to attempt; the rows that lean on it
 * are cleared first, in the order that makes each delete legal when it runs.
 *
 * MEASURED, NOT ASSUMED, THAT THIS COSTS NOBODY'S DATA: the owner's decision needs no further
 * word because there is nothing standing in the row to lose. On QA, 22.09.2026: nought rows of
 * `verification` carry `queue = 'schedule'`, nought rows of `schedule_proposal` exist, and
 * nought accounts hold `queue:schedule`. The three deletes below are written for correctness on
 * a database that might disagree, not because this one does.
 */

-- 1. Any waiting or decided report clears first: it is what the right and the proposal are
--    each still pointed at from, and neither can go while it stands.
delete from verification where queue = 'schedule';

-- 2. Any moderator's tick on the right clears next: `account_admin_right_right_fk` (V18)
--    restricts the right's own deletion while a single row still names it.
delete from account_admin_right where right_code = 'queue:schedule';

-- 3. And now the right itself, the row V5 seeded as `('queue', 'schedule')`. Nothing references
--    its generated code `queue:schedule` any longer, so the restrict above allows this.
delete from admin_right where scope = 'queue' and target = 'schedule';

/*
 * AND THE COLUMN THE RIGHT'S OWN ROW NEVER TOUCHED: `verification.schedule_proposal_id`, with
 * the three things V30 hung on it. Dropped by name rather than left to a bare `drop column`, so
 * a reader of this migration sees exactly what leaves without opening V30 to check:
 *
 *   - `verification_only_the_schedule_queue_carries_a_proposal`, the check that kept this
 *     pointer off every tab but the one that is now gone;
 *   - `verification_schedule_proposal_unique`, „one reported change waits once";
 *   - `verification_schedule_proposal_fk`, the pointer at `schedule_proposal` itself.
 *
 * The index V30 created beside them, `verification_schedule_proposal_idx`, is dropped next and
 * by name for the same reason, and only then does the column it all stood on leave.
 */
alter table verification
    drop constraint verification_only_the_schedule_queue_carries_a_proposal,
    drop constraint verification_schedule_proposal_unique,
    drop constraint verification_schedule_proposal_fk;

drop index verification_schedule_proposal_idx;

alter table verification drop column schedule_proposal_id;

/*
 * AND THE TABLE ITSELF. `schedule_proposal_competitor_idx` and `schedule_proposal_event_idx` go
 * with it, the same as every constraint V30 wrote on it: a primary key, the two foreign keys
 * (`schedule_proposal_competitor_fk`, `schedule_proposal_event_fk`), and
 * `schedule_proposal_proposes_another_day`. None is named here one by one, because none of them
 * is reachable from anywhere else in the schema the way the three on `verification` were - a
 * table dropped whole takes its own constraints with it, and there is no reader who needs to be
 * told what a table it is about to lose carried.
 */
drop table schedule_proposal;
