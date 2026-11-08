/*
 * A DUCAT AWARD REMEMBERS ITS TIER, THE DAY OF THE RACE THAT WON IT, AND THE RESULT THAT WON IT.
 *
 * First of seven steps of "Dukate dodeljuje verifikacija rezultata": the schema only. Nothing writes to
 * `ducat_award` yet (0 rows on QA and on production, measured 08.11.2026), and nothing in this file
 * changes how a row is read, deleted or kept unique.
 *
 * `tier` - the value of the ducat at the moment it was won, 1 to 5 as `ducat_tier_in_range` (V15) says of
 * the definition. A36 O13 asks for a snapshot of three things (kind, threshold, value of the ducat); V15
 * copied kind and threshold and left the third out, so this is the third. It is copied, not joined, for
 * V15's own reason: a run's tier rises part way through, and a badge won at tier 2 must go on saying 2
 * after the definition is rewritten.
 *
 * `won_on` - the day of the race whose result carried the member over the threshold. Owner, PDL: "Dukat
 * pamti dan trke kojom je prag pređen, ali se taj datum ne prikazuje nigde na portalu dok vlasnik ne
 * odluči drugačije." It serves the order of the badges and is shown nowhere. It is NOT `awarded_at`,
 * which is the moment the row was written and says nothing about the race.
 *
 * `result_id` - the result that won it, with ON DELETE SET NULL and an index. Owner, PDL: "Dukat se
 * oduzima kad se njegov rezultat obriše ili ispravi ispod uslova, osim mesečnog i sezonskog dukata
 * zamrznute sezone, jer zamrznuta tabela taj rezultat i dalje pokazuje." Why SET NULL and not the other
 * two: CASCADE would delete the badge of a frozen season along with the result, and that one has to
 * stay; RESTRICT would stop a result from being deleted, which happens in several places. WHICH badges
 * are taken away when a result goes is not decided here - the row is left standing with an empty pointer
 * and the reconciliation of step two decides - because the database cannot tell a frozen season from an
 * open one.
 *
 * ROWS ALREADY STANDING: `tier` and `won_on` are NOT NULL and a row written before this file has no true
 * value for either - the race day cannot be read off `awarded_at`, and a tier invented from today's
 * definition would be a record of a decision nobody took. No value is made up. If the table holds a row
 * the migration stops with a sentence that says so (the guard below) instead of with PostgreSQL's
 * "contains null values", so whoever meets it knows the row must be decided by a person. Both
 * databases hold none today. Measured by DucatAwardCarriedOverTest.
 */
do $$
begin
    if exists (select 1 from ducat_award) then
        raise exception 'V91: ducat_award already holds rows, which have no true tier and no race day; decide them by hand before this migration runs';
    end if;
end
$$;

alter table ducat_award
    add column tier      smallint not null,
    add column won_on    date     not null,
    add column result_id bigint;

alter table ducat_award
    add constraint ducat_award_tier_in_range check (tier between 1 and 5),
    add constraint ducat_award_result_fk foreign key (result_id) references result (id) on delete set null;

create index ducat_award_result_idx on ducat_award (result_id);
