/* A member has at most one result on one race.
 *
 * Owner, PDL P6, 09.09.2026: „Član ima najviše jedan rezultat na jednoj trci, ali sme imati više
 * rezultata na istom događaju." In his words: „član ne može da ima dva rezultata na istoj trci, ali
 * može dva rezultata na istom događaju." The reason he gave is that one event holds several races, so
 * a marathon and a half marathon run the same morning are two results of one member.
 *
 *
 * WHY THE SCHEMA SAYS IT, AND WHY NOW
 * -----------------------------------
 * Until this file the rule lived in one writer of three. The league's entry from the event page
 * (ResultsByTheLeagueApi, PR 566) refused a second result in code; the approval of a member's run
 * (VerificationWriteApi) wrote a second row with nothing said, and so did any writer that does not go
 * through either, the history import among them (btl-produkt/istorijski-podaci/uvoz_sql.py). Two
 * results of one member on one race are counted twice in every table that sums them.
 *
 * The approval now writes its row with `on conflict (competitor_id, race_id) do nothing` and refuses
 * the answer when nothing was written (PDL P6, 18.10.2026, the owner choosing among the outcomes
 * offered: the approval is refused and the run waits for the moderator to refuse it with a reason of
 * his own). That clause names this constraint's columns, so the code and this file are one change.
 *
 *
 * THE RACE AND NOT THE DAY
 * ------------------------
 * The pair is (competitor_id, race_id) and never (competitor_id, race_date). The owner's own reason
 * for the rule is two races on one morning, and result_competitor_race_date_idx (V7) stays what it
 * was: an index for reading one member's results by day, not a rule.
 *
 * WHAT IT DOES NOT SAY. The calendar may hold the same real race twice (ADL, owner, 11.09.2026:
 * „duplikati se ne sprečavaju"), and a member may then hold one result on each copy. This constraint
 * is about a row of `race`, which is the only identity of a race the schema has.
 *
 *
 * WHAT IT DOES TO THE ROWS THAT ARE ALREADY THERE
 * -----------------------------------------------
 * It refuses to be added over a member with two results on one race, and that is a precondition
 * rather than something this file settles: which of two results would survive is a deletion nobody
 * has approved. Measured on QA on 18.10.2026, read only and with the owner's permission (PDL P6, the
 * entry „[IZMERENO 18.10.2026, QA, uz dozvolu vlasnika]"): 276 results and no member with two on one
 * race. ResultOnePerRaceCarriedOverTest runs this file over the rows a real database holds beside the
 * rule, and over the pair that stops it.
 *
 * On production the file runs over an empty table, which is filled by the one-time transfer of QA's
 * data. The pour lifts only a constraint that is not valid, and this one is valid, so the rows it
 * copies come from a database that holds the constraint already. PouringFromQaTest and
 * PouringFromQaLeavesNothingBehindTest stay green with it.
 *
 * A plain constraint in Flyway's transaction and not `create unique index concurrently`: the table is
 * a few hundred rows, so the lock it takes lasts as long as reading them.
 *
 * THE BOUNDARY THIS LEAVES, said here rather than left to be found. The history import is a script
 * against the live database and not a migration (ADL, „Istorijski podaci NE idu u migraciju"). It
 * writes all of one member's results in ONE statement, so a race it pairs twice now fails that
 * statement whole instead of writing a second row. What it should do with such a pair is a separate
 * job and nobody has decided it.
 *
 * This file does not change once it is applied (ADL A2); a correction is the next migration.
 */
alter table result
    add constraint result_one_per_member_on_a_race unique (competitor_id, race_id);
