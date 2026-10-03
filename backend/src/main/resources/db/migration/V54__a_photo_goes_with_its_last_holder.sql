/*
 * A photo goes with its last holder, and it is the database that sees to it.
 *
 * ADL A68, 03.10.2026, which records the decision as „izabrao izmedju ponudjenih, uz moju
 * preporuku": „odlozeni okidaci u migraciji V54". What it closes is a `photo` row that
 * no column points at any more. Three doors left one behind - deleting a member (the picture that
 * was waiting for approval stayed), refusing a picture (the refused picture stayed) and approving a
 * new one over a portrait that stands (the old portrait stayed) - and the FILE of such a row stayed
 * on the disk for ever, because the sweep (ADL A66) deletes only files that have no row. The shape
 * A68 gives it, which is what this file is: „Na kraju svake transakcije baza brise zapis slike
 * koji vise ne drzi nijedna od cetiri kolone", and it holds for „Vazi i za svaku buducu radnju nad
 * tim kolonama". The four columns are competitor.photo_id (V8), verification.photo_id (V9),
 * team.logo_id and team_proposal.logo_id (V11), and PhotoApiTest asks the catalogue that there are
 * no more and no fewer.
 *
 *
 * WHAT IS THE OWNER'S AND WHAT IS DERIVED
 * ---------------------------------------
 * The owner's, as A68 records his choice: the rule lives in the database, it is deferred to the end
 * of the transaction, it is about those four columns and every action on them, and the row nobody
 * holds on QA is deleted by this same migration.
 *
 * DERIVED from his words, not a sentence of his: „koji vise ne drzi" says the row held something and
 * does not any more, so the rule fires when a HOLDER lets go - an UPDATE of the pointer, or a DELETE
 * of the row that held it - and never because of a row that nobody ever held. Written the other way,
 * as „no photo row may survive a commit without a holder", it would also delete a picture between
 * the statement that writes it and the one that points at it. No door does that today, because
 * MePhotoApi.send writes the picture and its holder in one transaction, but an upload that arrives
 * in two requests would.
 *
 *
 * WHY AT THE END OF THE TRANSACTION AND NOT AT THE END OF THE STATEMENT
 * ---------------------------------------------------------------------
 * An approval first lets go of the picture on the queue row (photo_id = null, which
 * verification_decided_keeps_no_photo in V9 demands of every decided row) and only THEN writes it
 * onto competitor.photo_id. A rule asked after each statement would delete the picture between the
 * two. Measured against a real PostgreSQL on 03.10.2026: an immediate trigger does exactly that,
 * and the second statement then fails the foreign key or leaves the portrait empty.
 *
 * PostgreSQL defers only CONSTRAINT triggers, which is why these are four of those and not four
 * ordinary ones, and a constraint trigger is written into pg_constraint with contype 't'. The three
 * test files that read every constraint of these tables (AxisConstraintsTest,
 * VerificationConstraintsTest, TeamConstraintsTest) ask each one for a row that REFUSES it, as V29's
 * two do. These four ACT instead of refusing, so there is no such row, and the three files were
 * taught to tell the two kinds apart by the function the trigger runs, with a floor of their own.
 *
 *
 * WHY UPDATE OF AND DELETE, AND NEVER INSERT
 * ------------------------------------------
 * An insert lets go of nothing. And deploy/pour-from-qa.sh writes with COPY and then puts the
 * constraints that are NOT VALID back with ALTER TABLE, in the same transaction: a deferred trigger
 * that also listed INSERT leaves one pending event per inserted row, and PostgreSQL then refuses the
 * ALTER with `cannot ALTER TABLE "competitor" because it has pending trigger events` (measured
 * 03.10.2026). With only UPDATE OF the one pointer and DELETE, the pour queues nothing, and the
 * TRUNCATE it starts with fires no row trigger at all.
 *
 * Narrowed to the one column, unlike V29, which says a list of columns would be a second list: here
 * the column IS the fact (one pointer per table), competitor is updated on every activation and
 * every edit of a profile, and a fifth table that points at photo is caught by the catalogue floor
 * in APhotoNobodyHoldsGoesTest rather than by a list.
 *
 *
 * WHY THE PHOTO ROW IS LOCKED BEFORE THE QUESTION IS ASKED
 * --------------------------------------------------------
 * Two transactions can meet over one picture: one lets go of it while another writes it onto a
 * holder. Asking „does anybody hold it" and then deleting is a check-then-act. The other holder is
 * not committed yet, so the answer is „nobody"; the DELETE has to wait for the foreign key's lock on
 * the photo row and goes through the moment that transaction commits; and `on delete set null`
 * empties the pointer it has just written. Measured on 03.10.2026 with two sessions: the commit
 * waited three seconds behind the other one, and then both the picture and the new holder's
 * pointer were gone. So the trigger takes the lock on the photo row FIRST - `for update` waits for
 * the other transaction - and asks in a NEW statement, which sees what that transaction committed.
 *
 * No door does this today (an approval moves a picture from one holder to another in one
 * transaction), and that is not the point: it is the case „Vazi i za svaku buducu radnju nad tim
 * kolonama" asks to be safe. V53's header names the outcome it would otherwise have: a queue row
 * that holds a picture whose photograph is deleted while it waits is a TEXT to its index.
 *
 *
 * ONE QUESTION, ONE HOME
 * ----------------------
 * a_photo_is_held spells out the four columns once. The trigger function asks it, and so does the
 * one statement at the end of this file, so the two cannot come to disagree about what „held" means.
 *
 *
 * WHAT IT DOES TO THE ROWS THAT ARE ALREADY THERE
 * -----------------------------------------------
 * The last statement deletes every photo row that nobody holds at the moment it runs. The owner
 * approved that for QA, which A68 records (ODOBRENJE, 03.10.2026) as „Zatecen zapis na QA se
 * brise": measured there on 02.10.2026, two photo rows and one that nobody holds, and he was told
 * it is a change of data on QA that cannot be undone. The file of that row is picked up by the
 * sweep afterwards.
 *
 * This is the one place a migration deletes data, and ADL A59 says historical data does not go into
 * one („Sifarnik sme, domenska tabela ne sme"). A59 is about loading rows into tables the whole
 * suite expects to start empty; the approval of 03.10.2026 is later and is about this one deletion,
 * which adds no row anywhere. What can measure it is a test that runs this file over rows that were
 * there before (APhotoNobodyHoldsCarriedOverTest), because every other test starts from an empty
 * database and a deletion that was taken out leaves the same nothing behind.
 *
 * On production it runs over an empty photo table: that database is filled by a one-time transfer
 * of QA's data after its migrations, and only into a database that is empty (PDL, 29.09.2026,
 * „Prenos podataka je JEDNOKRATAN"). The transfer refuses to run unless the schemas of the two
 * agree, so V54 is on QA first and the orphan is gone from what is transferred.
 *
 *
 * THE DOORS THAT DELETED THE ROW THEMSELVES NO LONGER DO
 * ------------------------------------------------------
 * Four doors took a picture away and deleted its row in the same breath: MePhotoApi.remove, the
 * overwrite in MePhotoApi.send, CompetitorWriteApi for a member's own portrait and
 * ATeamGoesWithItsLastMember for a team's mark. Three doors did not. A68 lists „kod u svakoj
 * radnji" as offered and not chosen - every door to come would have to remember, and „bas tako su
 * nastale ove tri rupe" - and records the accepted cost as „pravilo zivi u bazi, ne u Java kodu".
 * So the four no longer delete the row; the pointer they empty, or the row they delete, is the
 * event this file reacts to.
 *
 * They still delete the FILE at once, which a database cannot do, so a member who takes his portrait
 * down is not served it a moment longer (PDL, 24.09.2026, „Brisanje slike stupa odmah, bez
 * moderacije"). Every other door leaves the file to the sweep.
 *
 * V9 says of the picture a decided row cannot hold that the FILE leaving the disk with it is the
 * deleting code's to do. V9 cannot be edited once applied (ADL A2), so the correction is here: from
 * this file on the ROW is the database's, and the FILE is the sweep's at its next hourly pass, but
 * for the four doors above, which delete it at once.
 *
 *
 * WHAT IT DOES NOT DO, each named rather than left to be found
 * ------------------------------------------------------------
 * - A row that nobody ever held stays. That is the reading above.
 * - A statement that fires no row trigger bypasses it: TRUNCATE, `alter table ... disable trigger`
 *   and `session_replication_role = replica`. The pour does the first and neither of the others.
 * - The file does not leave with the row. The sweep runs once an hour, so a file goes up to about an
 *   hour after the decision, and one written less than ten minutes before it can wait for the pass
 *   after that. The privacy policy (V44) says of a photograph kept as evidence of a result that it
 *   is „Deleted immediately after verification". No route writes such a picture yet, and ADL A68
 *   is the later text and names the sweep.
 * - A photo that two columns hold goes only when both have let go. No door writes that state. The
 *   four doors above delete the FILE whether or not another holder is left, so in that state the row
 *   would outlive its file, and PhotoApi answers a row with no file as it answers a digest nobody
 *   wrote.
 * - The lock on the photo row is taken at the end of the transaction, after the statement that
 *   wrote the row that held the picture: holder first, photo second. The two statements of the main
 *   code that write `photo` keep that order (the insert makes a row nobody else can name yet, and
 *   the crop update in MePhotoApi.send comes after the `for update` on the queue row), and no
 *   `for update` there reads `photo` (searched 03.10.2026). A door that took a photo row first and
 *   a holder second would meet this trigger the wrong way round, and PostgreSQL ends one of the two
 *   after deadlock_timeout.
 *
 * There is no `when` clause and no „did the value change" branch. An UPDATE that names the pointer
 * without changing it still holds the picture, so the question answers for it, and a branch that no
 * mutation can reach is a branch that looks like protection (V29). A NULL pointer needs none
 * either: no row has the id NULL, so nothing is locked, a_photo_is_held answers false and the
 * DELETE matches nothing.
 *
 * This file does not change once it is applied (ADL A2); a correction is the next migration.
 */


/*
 * Does any of the four columns point at this photo.
 *
 * STABLE and plain SQL, so it is asked from the trigger function and from the statement at the end
 * of this file alike. Each of the four is an index lookup: competitor_photo_idx,
 * verification_photo_idx, team_logo_idx and team_proposal_logo_idx.
 */
create function a_photo_is_held(the_photo bigint) returns boolean
    language sql
    stable
as $body$
    select exists (select 1 from competitor where photo_id = the_photo)
        or exists (select 1 from verification where photo_id = the_photo)
        or exists (select 1 from team where logo_id = the_photo)
        or exists (select 1 from team_proposal where logo_id = the_photo)
$body$;


/*
 * The picture a row let go of, taken away if nobody holds it any more.
 *
 * Which column to read is an IF statement and not a CASE expression, on purpose: a CASE over the
 * fields of the row is resolved as a whole, and naming a field the table does not have fails even
 * in the branch that is not taken (measured 03.10.2026: `record "old" has no field "logo_id"`).
 * `old` is read on both events. After an UPDATE it is the picture the row held before, which is the
 * one that may have lost its last holder; after a DELETE it is the picture the deleted row held.
 *
 * `perform ... for update` is the lock described above, and the question after it is a new statement
 * so that it sees what the transaction it waited for committed. The function returns null because
 * the result of an AFTER trigger is ignored.
 */
create function a_photo_nobody_holds_goes() returns trigger
    language plpgsql
as $body$
declare
    let_go bigint;
begin
    if tg_table_name in ('team', 'team_proposal') then
        let_go := old.logo_id;
    else
        let_go := old.photo_id;
    end if;

    perform 1 from photo where id = let_go for update;

    if not a_photo_is_held(let_go) then
        delete from photo where id = let_go;
    end if;

    return null;
end;
$body$;


/*
 * One trigger on each table that can hold a picture, named by what the table does when it leaves
 * one behind. All four are deferrable and initially deferred, for each row, on UPDATE OF the
 * pointer and DELETE only.
 */
create constraint trigger competitor_leaves_a_photo_nobody_holds
    after update of photo_id or delete on competitor
    deferrable initially deferred
    for each row
    execute function a_photo_nobody_holds_goes();

create constraint trigger verification_leaves_a_photo_nobody_holds
    after update of photo_id or delete on verification
    deferrable initially deferred
    for each row
    execute function a_photo_nobody_holds_goes();

create constraint trigger team_leaves_a_photo_nobody_holds
    after update of logo_id or delete on team
    deferrable initially deferred
    for each row
    execute function a_photo_nobody_holds_goes();

create constraint trigger team_proposal_leaves_a_photo_nobody_holds
    after update of logo_id or delete on team_proposal
    deferrable initially deferred
    for each row
    execute function a_photo_nobody_holds_goes();


/*
 * And the rows that are already there: every photo that nobody holds goes, through the question the
 * triggers ask. Last, so that it is the same four columns that decide.
 */
delete from photo where not a_photo_is_held(id);
