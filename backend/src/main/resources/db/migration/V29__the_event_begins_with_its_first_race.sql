/*
 * The day an event begins on is DERIVED from its races, and from this migration on it
 * cannot drift away from them.
 *
 * PDL P35, owner, 21.09.2026: „Dogadjaj se zavodi kao PRVI od dana njegovih trka. Cak i ako
 * menjam datume trka i promenim prvu na dan kasnije, i datum dogadjaja se mora pomeriti",
 * and in the same breath what makes this file necessary rather than tidy: „To nije podatak
 * nego IZVEDENA cinjenica. Ne moze da se razidje sa trkama." The column stays, because the
 * calendar sorts by it, the season freezes on it and a ranking reads a race's season out of
 * it; what changes is that nothing may write a day the races disagree with.
 *
 * WHY THIS IS IN THE SCHEMA AND NOT IN THE SERVICE, which is the same sentence V17 wrote
 * over the first trigger this schema carried: „everything else this schema keeps, it keeps
 * whoever writes the statement." The rule was already obeyed by both writing routes before
 * this file existed - RaceWriteApi ends all three of its routes on the earliest race day,
 * and EventWriteApi.change moves the races with the event - and that is exactly the
 * position the owner has ruled against once before, on the member number: „Sprovedi to
 * ogranicenjem u bazi ili sekvencom, ne proverom u Javi"
 * (PaymentNumberConcurrencyTest). Four hands can write this fact - the race route, the
 * event route, a migration and a statement typed into psql - and only a rule in the
 * database holds for all four. Measured on the shipped calendar: three events were filed
 * on a morning no race of theirs runs on, every test was green, and nothing refused them.
 *
 * DEFERRED, AND THAT IS MEASURED RATHER THAN CAUTIOUS. EventWriteApi.change writes the
 * event's new day and THEN moves its races by the same number of days (owner, 10.08.2026:
 * „Kad se datum dogadjaja pomeri, trke se pomeraju sa njim, za isti broj dana"), so between
 * those two statements the event and its races genuinely disagree. RaceWriteApi does it the
 * other way round and disagrees in between just the same. An immediately checked rule
 * refuses both routes; the same two statements under a deferred one pass, and a transaction
 * that ends still disagreeing is refused at COMMIT. Measured 21.09.2026 against a real
 * PostgreSQL, both orders, both outcomes.
 *
 * THE EXEMPTION IS THE ABSENCE OF RACES AND NOT A KIND OF EVENT, and getting that the wrong
 * way round would leave the hole this file is for. „Dan prve trke" has no answer where there
 * is no race, so an event with none may carry any day; but the events that have none are not
 * only the gatherings. Owner, 23.08.2026: „Skup i Trening nemaju trke", and „Skupovi ostaju
 * jedini dogadjaji bez trka" - and beside those, EVERY event is one of these for a moment,
 * because EventWriteApi.add writes the row before any race exists under it, and
 * RaceWriteApi's own case aRaceUnderAnEventWithNoRaceYetSettlesTheDayOnItsOwn is that
 * moment. Reading `kind` here would refuse a race event on the day it was created. So the
 * question asked below is whether a race exists, and `kind` is never read.
 *
 * AND AN EVENT LEFT WITH NO RACE KEEPS THE DAY IT HAS, which is the same exemption seen from
 * the other end rather than a second rule. RaceWriteApi already decided it with a boundary on
 * each side: delete a race that was not the first and the day stays; delete the LAST race and
 * the day stays too, because the column is NOT NULL and today's date would file the event on
 * a morning nothing has to do with it.
 *
 * WHAT THIS MIGRATION DOES NOT DO, and it is the whole of the data. Three events shipped on
 * QA are filed on a day no race of theirs runs on, and a fourth is filed on a day its races
 * do run on but not the earliest. None of them is repaired here, and that is ADL A59 rather
 * than an omission: `btl_event` and `race` are domain tables, the whole test suite is built
 * on them starting empty, and an attempt to carry that calendar in a migration failed the
 * gate with eight failures and was reverted. A repair written here would touch zero rows in
 * every database a test ever sees, so no case could prove it. It is done the way those rows
 * arrived, by a script against the live database.
 *
 * SO THIS RULE LANDS ON A DATABASE THAT ALREADY BREAKS IT, and that is stated rather than
 * discovered. A constraint trigger, unlike a CHECK, is not validated against the rows that
 * are already there: creating it over a table holding a row that breaks it succeeds
 * (measured 21.09.2026). Those four rows therefore stand untouched - and are frozen until
 * the script repairs them, because the first write that touches one of them is refused. The
 * fifth such row can no longer appear.
 */


/*
 * The question, asked of every event this one written row could have moved.
 *
 * ONE FUNCTION FOR BOTH TABLES, because it is one question. Which rows a write could have
 * moved differs between them and that is all the branching below is; what is asked of each
 * of those rows is written once, so the two triggers cannot come to answer differently.
 *
 * `TG_NAME` rather than a written name, so each of the two triggers below says which one
 * refused, and a name changed in one place cannot go on being reported from the other.
 *
 * The SQLSTATE is 23514, which is the class PostgreSQL gives a CHECK it refuses. That is
 * what this is - a rule about rows, refused on the way in - and it is what decides whether
 * Spring hands the route a DataIntegrityViolationException or an uncategorised server fault.
 *
 * `min(date)` rather than a row ordered and limited: there is no event here to fall back on,
 * only the one number, and an event with no race at all answers NULL - which is the
 * exemption, written as the absence of a value rather than as a count.
 */
create function the_event_begins_with_its_first_race() returns trigger
    language plpgsql
as $body$
declare
    /* At most two: the event a race arrived at and the one it left. `TG_OP` decides which
       of OLD and NEW is even assigned, and reading the other one is an error rather than a
       null. */
    touched  bigint[];
    which    bigint;
    begun    date;
    earliest date;
begin
    if tg_table_name = 'btl_event' then
        touched := array[new.id];
    elsif tg_op = 'INSERT' then
        touched := array[new.event_id];
    elsif tg_op = 'DELETE' then
        touched := array[old.event_id];
    elsif old.event_id = new.event_id then
        touched := array[new.event_id];
    else
        touched := array[old.event_id, new.event_id];
    end if;

    foreach which in array touched loop
        /* The event may be gone: `race_event_fk` cascades, so deleting an event deletes its
           races and fires this for each of them. Nothing is owed by a row that is no longer
           there. */
        select e.date into begun from btl_event e where e.id = which;

        if found then
            select min(r.date) into earliest from race r where r.event_id = which;

            if earliest is not null and earliest <> begun then
                raise exception using
                    errcode = '23514',
                    message = tg_name || ': event ' || which || ' begins on ' || begun
                        || ' and the first of its races runs on ' || earliest,
                    hint = 'PDL P35: the day of an event is the first of the days of its races.';
            end if;
        end if;
    end loop;

    return null;
end;
$body$;


/*
 * A race written, moved or taken away, and the event it was under as well as the one it
 * moved to.
 *
 * BOTH events and not one. Nothing in the portal moves a race between events - RaceWriteApi
 * refuses it in as many words (owner, 11.08.2026) - but a statement can, and a rule that
 * held only for the route it was written beside would be the Java check this file exists to
 * replace. The event a race LEFT can begin too early once it is gone just as easily as the
 * one it arrived at.
 *
 * Not narrowed to UPDATE OF date, event_id. The columns that could break this are two today,
 * and naming them here would be a second list to keep in step with the first: the day
 * something is added that this rule reads, the list would go on saying the old two. What is
 * asked instead is one indexed lookup per written row.
 */
create constraint trigger race_leaves_its_event_beginning_on_its_first_race
    after insert or update or delete on race
    deferrable initially deferred
    for each row
    execute function the_event_begins_with_its_first_race();


/*
 * And the event's own day, which is the half that catches the route rather than the writer.
 *
 * AFTER UPDATE and not INSERT: a race cannot exist under an event that does not, so an event
 * on the day it is written has no races and the rule has nothing to say about it.
 */
create constraint trigger btl_event_begins_with_its_first_race
    after update on btl_event
    deferrable initially deferred
    for each row
    execute function the_event_begins_with_its_first_race();
