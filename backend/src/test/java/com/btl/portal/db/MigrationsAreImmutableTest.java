package com.btl.portal.db;

import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A migration that has been merged is never changed again (ADL A2), and this is
 * what says so.
 *
 * <p>Not a style rule. Flyway stores a checksum of every migration it applies and
 * refuses to start against a database where a stored checksum and the file no
 * longer agree:
 *
 * <pre>Validate failed: Migrations have failed validation</pre>
 *
 * <p>Measured on 08.09.2026, both halves. A one character fix in
 * {@code frontend/src/data/countries.json} followed by a re-run of the generator
 * leaves {@code ./mvnw --batch-mode verify} at BUILD SUCCESS, here and on CI,
 * because Testcontainers hands every run an empty database and an empty database
 * has no checksum to disagree with. The same two commits stop the backend from
 * starting on QA, where V2 has been applied since the day it merged. A green
 * build was therefore evidence about nothing, and the repository documented the
 * rewrite as the way to change a codebook.
 *
 * <p>The number pinned below is the one Flyway itself computed, not one this test
 * works out: it is the number that decides whether the server starts. The floor
 * under the list is Flyway's own history table, so a migration added without a
 * line here fails, and a line here for a migration that is gone fails too.
 *
 * <p><b>When this test fails.</b> Almost never for a good reason. A codebook is
 * changed by writing the next migration,
 *
 * <pre>python backend/tools/generate_reference_migrations.py --delta</pre>
 *
 * and the generator refuses to rewrite a migration that {@code main} carries for
 * the same reason this refuses to accept the rewrite. Changing a pinned number
 * below is saying out loud, in a diff somebody reviews, that a database which has
 * already run that file is being asked to run a different one.
 *
 * <p><b>And on 27.09.2026 that last sentence was measured to have one exception,
 * which is written here because leaving it out is what would make it dangerous.</b>
 * V35 merged and then FAILED on QA, on
 * {@code check constraint "membership_free_of_the_fee_says_who" ... is violated by
 * some row}. Every statement in it is transactional DDL, so Flyway rolled the group
 * back and wrote NO history row at all: QA's history topped out at 34, and no
 * database anywhere held V35's checksum. A later migration could not repair it
 * either, because V35 fails before any later one is reached. So V35 was corrected
 * in place and its number below changed, and for that one file the sentence above
 * was FALSE - no database had already run it.
 *
 * <p>That case is now named in ADL A2 itself, addendum of 27.09.2026: "migracija
 * koja je PALA nije primenjena, pa se sme menjati u mestu", which is not a
 * loosening but the case the rule never named - the boundary is merge BECAUSE merge
 * is when QA comes to remember the checksum, and a migration that failed never got
 * that far. The condition is <b>checked</b> against Flyway's own history table - the
 * one {@link DatabaseTest#flywayTable()} names, since it is a setting and this is
 * Java - on every reachable database, and never assumed; and the changed file has to
 * carry a sentence saying why. From the day V35 succeeds on QA it is as immutable as
 * the rest, and a correction is the next migration.
 */
class MigrationsAreImmutableTest extends DatabaseTest {

	/**
	 * One migration as Flyway recorded it.
	 *
	 * @param version  the number in the file name
	 * @param script   the file name
	 * @param checksum what Flyway computed over the file, which is what it compares
	 *                 against on every start
	 */
	record Applied(String version, String script, Integer checksum) {

		@Override
		public String toString() {
			return script + " (" + checksum + ")";
		}
	}

	private static final List<Applied> PINNED = List.of(
			new Applied("1", "V1__conventions_and_extensions.sql", 1828764489),
			new Applied("2", "V2__country.sql", 1858027338),
			new Applied("3", "V3__place.sql", 614394979),
			new Applied("4", "V4__price_list.sql", -1093755363),
			new Applied("5", "V5__role_and_admin_right.sql", -574827303),
			new Applied("6", "V6__account_and_email_verification.sql", 1366519447),
			new Applied("7", "V7__competitor_event_race_result.sql", 1147204228),
			new Applied("8", "V8__registration_document_consent_photo.sql", 2127338092),
			new Applied("9", "V9__verification_queue.sql", -118383452),
			new Applied("10", "V10__result_submission.sql", -1474520025),
			new Applied("11", "V11__team_and_membership.sql", -1487104354),
			new Applied("12", "V12__joining_a_team_and_a_pair.sql", -558654437),
			new Applied("13", "V13__inbox_and_notification_settings.sql", -457962498),
			new Applied("14", "V14__league.sql", 422203957),
			new Applied("15", "V15__ducat_and_award.sql", -861292233),
			new Applied("16", "V16__payment_and_the_member_number.sql", -2078925003),
			new Applied("17", "V17__frozen_season.sql", -1225196709),
			new Applied("18", "V18__authentication.sql", -1849138827),
			new Applied("19", "V19__league_counts_races.sql", 537350301),
			new Applied("20", "V20__league_reads_races.sql", 1786309952),
			new Applied("21", "V21__crop_is_a_circle.sql", 2045503899),
			new Applied("22", "V22__membership_is_a_fact_about_a_season.sql", -1073658510),
			new Applied("23", "V23__the_account_carries_its_name_and_its_member.sql", -789812097),
			new Applied("24", "V24__static_pages.sql", 1064403721),
			new Applied("25", "V25__the_exact_distance_is_kept.sql", 1913240119),
			new Applied("26", "V26__the_policy_names_the_cookie_it_sets.sql", 1404863051),
			new Applied("27", "V27__the_coin_carries_its_own_legend.sql", -1219505638),
			new Applied("28", "V28__holding_an_item_while_it_is_read.sql", -1101042005),
			new Applied("29", "V29__the_event_begins_with_its_first_race.sql", 1719152331),
			new Applied("30", "V30__comments_and_schedule_get_something_to_point_at.sql", 1321307942),
			new Applied("31", "V31__the_schedule_queue_and_its_proposal_are_gone.sql", -35821361),
			new Applied("32", "V32__a_member_writes_his_own_result.sql", 1492171060),
			new Applied("33", "V33__a_deleted_member_takes_his_name_with_him.sql", -1251992971),
			new Applied("34", "V34__the_price_list_row_carries_its_name.sql", 1229579551),
			/* CHANGED IN PLACE on 27.09.2026, from -1373574365, and the paragraph above is why that
			   was allowed for this one file: it had merged but never applied anywhere, because it
			   failed on QA. Nothing else in this list has ever been repinned. */
			new Applied("35", "V35__freeing_a_member_of_the_fee_says_who_and_when.sql", 1372522848),
			new Applied("37", "V37__the_written_page_carries_its_translation.sql", 1461414038),
			/* RENUMBERED 36 -> 38 on 27.09.2026, and the CHECKSUM IS UNCHANGED BY THAT because Flyway
			   computes it over the CONTENT and not the name. Which is why this row still pins both:
			   the number and the script are what a renumbering moves, and renaming the file back
			   without editing this line has to fail here.

			   AND 36 IS A GAP THAT NOTHING FILLS, which is a fact about this list rather than a defect
			   in it. Three branches held a migration at once and the ones that were ready first took
			   37; nothing in this repo asks the numbers to be contiguous - Flyway asks only that what
			   it APPLIES be increasing, and this is a list of pairs rather than a sequence. Measured
			   rather than assumed: it is this very list that would have to say otherwise, and the
			   assertion below is `containsExactlyElementsOf`, which is about ORDER and never about
			   arithmetic between neighbours. */
			new Applied("38", "V38__the_balance_is_a_book.sql", 2032527406),
			new Applied("39", "V39__the_money_arrives_two_ways_and_the_slip_is_ips.sql", -1797253810),
			new Applied("40", "V40__a_price_row_is_free_in_both_currencies_or_in_neither.sql",
					-1581242756),
			/* REPINNED 28.09.2026, from 1973092509: V41 gained a third statement (politika-privatnosti
			   position 5, the "kartično" home the independent review of PR 410 found) and a fourth
			   (the shared sign-off date on positions 7/12/19). V41 had not merged to main at either
			   point - checked with `git ls-tree origin/main` and `git merge-base`, not assumed - so
			   ADL A2's protection for applied migrations does not cover it yet and this is not a
			   rewrite of a migration anyone has run. */
			new Applied("41", "V41__the_card_leaves_the_public_pages.sql", 1470407484),
			new Applied("42", "V42__the_balance_is_one_amount_in_one_currency.sql", -1505949912),
			/* REPINNED 28.09.2026, from 287136958: two comment citations pointed at PDL.md by line
			   number ("PDL.md :3213") instead of by literal text, and a merge that lands after this
			   one is written would move that number silently. Replaced with the decisive phrase
			   itself, quoted, which is what PDL.md :3213 said when read for this fix and cannot go
			   stale the same way. V43 had not merged to main at either point - the same condition
			   V41's own repin note above checks rather than assumes - so this is not a rewrite of a
			   migration anyone has run. */
			new Applied("43", "V43__the_written_pages_speak_english.sql", -1054379915),
			/* REPINNED TWICE on 28.09.2026, same session, both before merge.
			   First, from -605669233 to -1737375022: an independent review of PR 434 found the
			   header asserting a decision PDL.md had already reversed (both "photo" and "bio"
			   left WhatRegistrationAsksFor together on 28.09.2026, not one staying while the
			   other left) plus a mistranslation of the owner's own quote that propped that claim
			   up, and asked for the prose corrected - see the file's own header for what changed.
			   Second, from -1737375022 to 373307075: the owner then settled the still-open
			   question the same review had left alone, PDL.md "Pravni osnov za profilnu sliku je
			   PRISTANAK, ne izvrsenje ugovora" - the "Profilna fotografija" / "Profile picture"
			   row's ground cell moves from "Izvršenje ugovora" / "Performance of contract" to
			   "Vaš pristanak" / "Your consent" on both languages, and three more header passages
			   were corrected to match. V44 had not merged to main at any of these points - checked
			   with `git ls-tree origin/main` and `git merge-base --is-ancestor`, not assumed - so
			   neither repin is a rewrite of a migration anyone has run, the same condition V41's
			   and V43's repin notes above check. */
			new Applied("44", "V44__the_picture_leaves_what_you_enter_at_joining.sql", 373307075),
			/* V46, not V45: V44 is taken on main by the migration above, and V45 by the results
			   queue on branch b177, which renumbered onto it from V44 for the same reason. Checked
			   with `git ls-tree origin/main` and across every ref rather than taking "the first
			   free number", which is what produced the V44 collision in the first place. Pinned
			   LAST, with the file final, because a later commit correcting even one sentence of
			   its header changes the bytes and this number with them - which is exactly what
			   happened twice before this number settled, both times before merge and neither a
			   rewrite of anything anyone has run: first when Article 9 was added to this same
			   migration (owner, 29.09.2026), and then when the owner sent his final wording of
			   Article 56 and the explanatory paragraph I had opened it with came out.

			   [THE SENTENCE ABOUT V45 ABOVE STOPPED BEING TRUE ON 29.09.2026, and it is corrected
			   here rather than deleted because the reasoning it records is still why this file is
			   46.] 45 is now a number nothing uses: the results queue moved off it to 47, because
			   THIS migration reached the QA database first and Flyway does not take a lower
			   version afterwards. What has not changed is that 46 was the right number to take
			   when it was taken, and 46 is applied now, so it is the one number here that may
			   not move. */
			new Applied("46", "V46__the_rulebook_stops_claiming_a_penalty_that_is_gone.sql", 426098328),
			/* PINNED LAST, when the file was final. This migration's header quotes V25 and V32 at
			   length and both quotations were settled before this number was taken: a commit that
			   afterwards corrects one sentence of that prose changes the bytes, and the gate then
			   fails on a checksum that was right when it was written.

			   RENUMBERED TWICE, and the second time is the one that explains why this row sits
			   BELOW 46 in a list that has to stay in version order:

			   44 -> 45, on 29.09.2026, before this migration merged: main took 44 for
			   V44__the_picture_leaves_what_you_enter_at_joining.sql (PR 434) while this branch was
			   in review, and two files at one version is a refusal to start.

			   45 -> 47, on 29.09.2026, AFTER this migration had merged to main. V46 merged after
			   it and reached the QA database BEFORE it, so Flyway - which does not allow an
			   out-of-order arrival by default - refused to start with 46 recorded and 45 only
			   resolved on disk: "Detected resolved migration not applied to database: 45". The
			   backend sat in a restart loop. The condition that makes this legal is not that the
			   file had not merged, because it had; it is that the file was applied NOWHERE. That
			   was measured, not assumed: QA's history runs 43, 44, 46 with no 45, and production
			   has no backend yet. So this is not a rewrite of a migration anyone has run (ADL A2),
			   and a later migration could not have repaired it either - Flyway fails validation
			   before it runs anything, so it never reaches one.

			   Renumbering on its own moves no content, so it would have left this number alone -
			   git reports the rename as 0 changed lines and Flyway checksums what a migration
			   SAYS, not what it is called. What moved it is the paragraph recording all of the
			   above, which this commit wrote into the migration's header: 1500230178 -> the
			   number below, read from the gate afterwards rather than carried over. */
			new Applied("47", "V47__a_moderator_decides_a_result.sql", 1296295678),

			/* V48. The six social notices lose their mail, so the six switches and the table
			   holding them go with it (owner, 29.09.2026: „da funkcionise samo kao poruke u
			   inbox portala").

			   RENUMBERED 47 -> 48 on 29.09.2026, before this migration merged, and the CHECKSUM
			   IS UNCHANGED BY THAT because Flyway computes it over the CONTENT and not the name.
			   It took 47 in the first place by measurement rather than by asking for the first
			   free number: V45 stood on branch b177 and V46 on b178, both open, checked with
			   `git ls-tree` over origin/main and over every ref - which is how two branches
			   collided on one the day before. Then V45 merged AFTER V46 (02:26 against 01:55 on
			   29.09.2026, read off `git log` on main), and the results migration was moved up to
			   47 by branch b182-v45-na-v47; the note on its row says why. This one has to run
			   after it, and 48 is what says so.

			   Not a rewrite of a migration anyone has run (ADL A2: the line is the merge). The
			   commit that added this file is not an ancestor of origin/main - `git merge-base
			   --is-ancestor` exits 1, checked and not assumed - so no database that follows main
			   has recorded it under 47. Renaming the file back without editing this row has to
			   fail here, and so does editing this row without renaming the file.

			   That this entry and V46's arrived as an add/add conflict at the tail of this very
			   list was the `.properties` intersection in another costume, and it was resolved by
			   keeping both in version order rather than by either side winning. The full gate was
			   run again afterwards, because a list that merges cleanly is not a list that is
			   right. */
			new Applied("48", "V48__the_social_notices_go_only_to_the_inbox.sql", -1376320615),

			/* V49. The selling year opens on 15 October and no longer on the first (owner,
			   29.09.2026). Three price rows, their names, and five sentences in three sections of
			   the rulebook and the terms of use, in both languages.

			   Pinned LAST, when the file was final, which is the rule this list teaches: the
			   number is read off the gate after the migration has stopped changing, because a
			   commit that afterwards corrects one sentence in its header moves the bytes and
			   fails here on a checksum that was right when it was written.

			   49 and not 45, which is the free number: V45 does not exist and V46, V47 and V48 do,
			   so a migration numbered into the gap would run BEFORE the three that are already on
			   main - and this one has to run after V34, which wrote the names it rewrites, and
			   after V46, which last rewrote the article it edits. */
			new Applied("49", "V49__the_selling_year_opens_on_the_fifteenth_of_october.sql", 618253647),

			/* V50. The member number sequence is moved above the numbers already written, so the next
			   draw is a number nobody holds (seen on QA on 29.09.2026: one member holding 000001 and a
			   sequence standing at 1 | false). No schema, no row.

			   50 because it is the next free number, and that was MEASURED rather than taken: every
			   local and remote ref, every worktree and the list of open pull requests were searched on
			   01.10.2026 and none held a migration at V50 or above.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file:
			   it was worked out with a copy of Flyway's algorithm (CRC32 over the lines, with line
			   breaks and a BOM left out), which reproduces six numbers pinned above to the digit, and
			   this list is what confirms it on the gate. */
			new Applied("50", "V50__the_member_number_sequence_stands_above_the_numbers_already_written.sql",
					-955843776),

			/* V51. Towns of one country that carried one name are renamed, and each carries the nearest
			   bigger town in brackets (owner, 02.10.2026). Data only: 4094 rows, one UPDATE, the rank, the
			   country and the English name of every one of them untouched. Written by
			   `generate_reference_migrations.py --delta` out of the codebook that
			   btl-produkt/istorijski-podaci/oznaci-istoimena-mesta.py labelled, and it is the first delta
			   the generator has written that a database applies.

			   51 because it is the next free number, and that was MEASURED rather than taken: every local
			   and remote ref, every worktree and the four open pull requests were searched on 02.10.2026
			   and none held a migration at V51 or above, and origin/main stands at V50.

			   Pinned LAST, when the file was final. Regenerating it, which the generator does freely for a
			   migration main does not carry yet, moves this number, and so does a labelling that changes. */
			new Applied("51", "V51__reference_data_update.sql", 503069300),

			/* V52. The key that refuses two towns of one country under one name, deferrable initially
			   immediate like the order key beside it, and it runs after V51 and only then: over V3 alone it
			   would fail on the first pair. No data.

			   52 for the reason 51 is, and because it has to run after the delta that makes it true.

			   Pinned LAST. The number is the one Flyway computes over the file, worked out with a copy of
			   its algorithm (CRC32 over the lines, with line breaks and a BOM left out), which reproduced
			   four numbers pinned above to the digit before it was trusted for these two, and this list is
			   what confirms it on the gate. */
			new Applied("52", "V52__a_town_is_told_apart_from_its_namesakes.sql", -358289886),

			/* V53. One text of one member waits for a moderator at a time: a partial unique index on the
			   queue, under the condition MeWriteApi already asked in Java (PDL, „Nov tekst o sebi se ODBIJA
			   dok prethodni ceka odluku moderatora", 19.09.2026, struck 18.10.2026: the index is now the
			   conflict target of the overwrite, `MeWriteApi.queued`). No data.

			   53 because it is the next free number, and that was MEASURED rather than taken: every local
			   and remote ref was searched on 02.10.2026 after PR 468 merged, origin/main stands at V52, and
			   no branch but this one holds V53 or above.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file,
			   worked out with the copy of its algorithm the rows above describe (CRC32 over the lines, line
			   breaks and a BOM left out), which reproduced V9, V50 and V52 to the digit before it was
			   trusted here, and this list is what confirms it on the gate. */
			new Applied("53", "V53__one_text_of_a_member_waits_at_a_time.sql", -191224091),

			/* V54. A photo row that no holder points at is deleted by the database at the end of the
			   transaction that let go of it: four deferred constraint triggers, one on each table that
			   can hold a picture, one function that asks once, and one statement over the rows already
			   there (ADL A68, 03.10.2026). It deletes data on QA, once, which the owner approved.

			   54 because it is the number N1 was given in A68, and it is MEASURED to be free: every
			   local and remote ref and every worktree was searched on 03.10.2026 and only this branch
			   holds V54 or above, and origin/main stands at V53.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file,
			   worked out with a copy of its algorithm (CRC32 over the lines, line breaks and a BOM left
			   out), which reproduced V40, V46, V52 and V53 to the digit before it was trusted here, and
			   this list is what confirms it on the gate. */
			new Applied("54", "V54__a_photo_goes_with_its_last_holder.sql", -971747939),

			/* V55. One picture of one member waits for a moderator at a time: a partial unique index on
			   the queue, under the condition MePhotoApi already asks in Java (PDL, „Ponovno slanje
			   pregazi red koji ceka, ne pravi drugi", 27.09.2026), as the floor under the turn that
			   route makes the sends of one member take. No data.

			   55 because it is the next free number, and that was MEASURED rather than taken: every
			   local and remote branch, every one of the 306 worktrees and the three open pull
			   requests were searched on 09.10.2026 and none held a migration at V55 or above, and
			   origin/main stands at V54.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the
			   file, worked out with the copy of its algorithm the rows above describe (CRC32 over the
			   lines, line breaks and a BOM left out), which reproduced V9, V50, V52, V53 and V54 to the
			   digit before it was trusted here, and this list is what confirms it on the gate. */
			new Applied("55", "V55__one_picture_of_a_member_waits_at_a_time.sql", 16641354),

			/* V56. A membership held on a balance carries its trail whole or not at all: one check
			   constraint, scoped to the basis by name, and the three column comments V35 wrote replaced
			   because they spoke of an exemption alone (the owner's decision of 03.10.2026, chosen among
			   the options put to him: PDL P8, the entry „Trag (ko je odobrio i kada) ide uz svaku radnju
			   koja prasta novac"; ADL, the entries of 03.10.2026 and 09.10.2026). No column and no data.

			   56 because it is the number this branch was given on 09.10.2026 (ADL, the entry of that day
			   under the decision of 03.10.2026), and it is MEASURED to be free: all 1378 refs, local and
			   remote, and all 324 worktrees were searched that day and none held a migration at V56 or
			   above, and origin/main stands at V55. It is not V57 because this branch merges before the
			   one that removes competitor.active, and Flyway refuses a lower version after a higher one;
			   that branch takes the next free number when it starts.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file,
			   worked out with the copy of its algorithm the rows above describe (CRC32 over the lines,
			   line breaks and a BOM left out), which reproduced V54 and V55 to the digit before it was
			   trusted here, and this list is what confirms it on the gate. */
			new Applied("56", "V56__a_membership_on_a_balance_carries_its_trail_whole_or_not_at_all.sql",
					559365428),

			/* V57. The written pages follow what the owner decided on 10.10.2026: thirty-nine edits of the
			   three legal documents, in Serbian and in English, each of which stops the migration unless its
			   old text stands exactly once where it is written. No schema, no row; the file's own header says
			   whose words each edit carries and what was left out on purpose. The last two edits (the count
			   above the awards list, "Tri pravila" and "Three rules") were added to the file after the pull
			   request was opened, on the owner's answer of the same day. V57 had not merged, so no database
			   had run the file with thirty-seven edits, and the number below is the only one pinned for it.

			   57 because it is the next free number, and that was MEASURED rather than taken: all 1402 refs,
			   local and remote, every worktree and the eight open pull requests were searched on 10.10.2026
			   and none held a migration at V57 or above, and origin/main stands at V56.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file,
			   worked out with the copy of its algorithm the rows above describe (CRC32 over the lines, line
			   breaks and a BOM left out), which reproduced V46, V49 and V56 to the digit before it was trusted
			   here, and this list is what confirms it on the gate. */
			new Applied("57", "V57__the_written_pages_follow_the_decisions_of_the_tenth_of_october.sql",
					722394376),

			/* V58. The written pages say that moving to an older age category between two seasons reveals
			   the exact year of birth (item BR): one sentence, the owner's words of 16.10.2026 (PDL, the
			   entry "Reči za BR"), placed directly after the sentence that says the category is always
			   public, in Article 74 of the rulebook and in section 3 of the privacy policy, in Serbian and
			   in English. Four edits, each of which stops the migration unless its anchor stands exactly
			   once where it is written and the sentence is not already there; and four more that move the
			   sign-off of the policy and of the rulebook from 10.10.2026 to 16.10.2026 (PDL, the entry
			   "Datum Poslednja izmena se pomera", owner, 16.10.2026), in both languages, the terms of use
			   keeping theirs. The file was changed for the date after the pull request was opened and before
			   it merged, so no database has run the file with four edits. No schema, no row.

			   58 because it is the next free number, and that was MEASURED rather than taken: every remote
			   ref, every worktree and the open pull requests were searched on 16.10.2026 and none held a
			   migration at V58 or above, and origin/main stands at V57.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file. */
			new Applied("58", "V58__moving_to_an_older_category_between_seasons_reveals_the_year_of_birth.sql",
					951555262),

			/* V59. An account says which language its mail is written in: one column on account,
			   `mail_language`, `sr` by default and NOT NULL, with a check on the two languages the
			   portal writes in (owner, PDL P18, 03.10.2026, and the answers of 10.10.2026 on the
			   language of the mail, JM). Every account standing when it runs is given `sr` by the
			   default, which MailLanguageCarriedOverTest measures over rows written before it.

			   59 because it is the next free number, and that was MEASURED rather than taken: every
			   remote ref, every worktree and the three open pull requests were searched on 17.10.2026
			   and none held a migration at V59 or above, and origin/main stands at V58.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the
			   file, worked out with the copy of its algorithm the rows above describe (CRC32 over the
			   lines, line breaks and a BOM left out), which reproduced V58 to the digit before it was
			   trusted here, and this list is what confirms it on the gate. */
			new Applied("59", "V59__an_account_says_which_language_its_mail_is_written_in.sql",
					-1673487001),

			/* V60. The privacy policy names Zoho as a processor: one row in the table of processors of
			   section 5, directly under the row for Brevo, in Serbian and in English, the owner's words of
			   17.10.2026 (PDL, the entry "Nove reči dopune politike za Zoho (američki region)"), and the
			   policy's sign-off moved from 16.10.2026 to 18.10.2026 (the same entry), in both languages,
			   the rulebook and the terms of use keeping theirs. Four edits, each of which stops the
			   migration unless its old text stands exactly once where it is written and its new text is not
			   already there. No schema, no row.

			   60 because it is the next free number, and that was MEASURED rather than taken: every remote
			   ref, every worktree and the open pull requests were searched on 18.10.2026 and none held a
			   migration at V60 or above, and origin/main stands at V59.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file, read
			   off this very assertion when it ran before the entry existed and then confirmed by it. */
			new Applied("60", "V60__the_privacy_policy_names_zoho_as_a_processor.sql",
					-1729292466),

			/* V61. The written pages use the English quotation mark: the low Serbian opening mark U+201E
			   (and U+201C and U+201D, which no page carries) is replaced by the plain `"` in the body of
			   ten sections, six in Serbian and four in English (owner, PDL P18, the section "Navodnici",
			   18.10.2026). No word, space, line break or date moves; the sign-offs stay as V57, V58 and V60
			   left them. The migration first asks how many marks stand in each text column and stops unless
			   the answer is the ten places it was measured over. No schema.

			   61 because it is the next free number, and that was MEASURED rather than taken: every remote
			   ref, every worktree and the open pull requests were searched on 18.10.2026 and none held a
			   migration at V61 or above, and origin/main stands at V60.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file, read
			   off this very assertion when it ran before the entry existed and then confirmed by it. */
			new Applied("61", "V61__the_written_pages_use_the_english_quotation_mark.sql",
					-1802649289),

			/* V62. The basis of a membership has one home, the row of a season: the per-person column
			   `competitor.membership_basis` (V7) is dropped together with its one rule,
			   `competitor_membership_basis_known`, in the change that moves every reader to
			   `membership` for the season on sale (owner, 18.10.2026, PDL P8, „Osnov clanstva ima
			   jedan dom, zapis po sezoni; stara kolona po coveku se brise"). No row of `membership` is
			   touched, which `TheBasisHasOneHomeTest` measures over the shape a real database holds.

			   62 because it is the next free number, and that was MEASURED rather than taken: every ref
			   this clone knows was searched on 18.10.2026 after a fetch and none held a migration at V62
			   or above, there was no open pull request, and origin/main stands at V61.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file,
			   read off this very assertion when it ran before the entry existed. */
			new Applied("62", "V62__the_basis_of_a_membership_has_one_home.sql", -777830705),

			/* V63. A change on a member's row leaves a trail and the book reverses what a season held
			   (owner, 18.10.2026, PDL P8, „Osnov clanstva ima jedan dom, zapis po sezoni"): the table
			   `membership_change`, written once and without an amount, and the reason `reversal` in the
			   book, with the two rules it joins widened and one sign rule of its own. No line that stood
			   is touched, which `ReversalArrivesOverTheBookAlreadyThereTest` measures.

			   63 because it is the next free number, measured on 18.10.2026 after a fetch: origin/main
			   stands at V62 and the one open pull request (564) carries no migration.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file,
			   read off this very assertion when it ran before the entry existed. */
			new Applied("63",
					"V63__a_change_on_a_members_row_leaves_a_trail_and_the_book_reverses_what_a_season_held.sql",
					635495128),

			/* V64. A cancelled payment leaves no row, so `reversed` is not a state a payment can be in
			   (owner, 18.10.2026, PDL P8, „zapis o uplati se BRIŠE”): `payment_state_known` narrowed to
			   `awaited` and `recorded`, with the sentences of V16, V22 and V42 it overturns named in its
			   header and the current one on the rule itself. No payment that stands is touched, and one
			   reading `reversed` stops it rather than being cleared away, which
			   `TheReversedStateGoesOverThePaymentsAlreadyThereTest` measures.

			   64 because it is the next free number, measured on 18.10.2026 after a fetch: origin/main
			   stands at V63 and the one open pull request (569) carries no migration.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file,
			   read off this very assertion when it ran before the entry existed. */
			new Applied("64", "V64__a_cancelled_payment_leaves_no_row_so_reversed_is_no_state.sql",
					-1467614539),

			/* V65. A member has at most one result on one race (owner, PDL P6, 09.09.2026, „Član ima
			   najviše jedan rezultat na jednoj trci"): one unique key over (competitor_id, race_id), which
			   the approval names in `on conflict`. No row is touched, and QA was measured to hold no pair
			   (18.10.2026); `ResultOnePerRaceCarriedOverTest` runs the file over the rows a real table holds.

			   65 because 64 is taken by pull request 570, measured on 19.10.2026 after a fetch; 570 was
			   merged before this one, so V64 stands before it here too.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file,
			   read off this very assertion when it ran before the entry existed. */
			new Applied("65", "V65__a_member_has_one_result_on_one_race.sql", 847671403),

			/* V66. A run on a race the calendar does not hold names its event, chosen by its key or
			   typed (owner, PDL P9, 19.10.2026: „Prijava pamti događaj koji je član izabrao"): two empty
			   columns and four rules any row with both empty satisfies, so no waiting run is touched;
			   `ResultSubmissionEventCarriedOverTest` runs the file over the shapes the table holds.

			   66 because it is the next free number, measured on 19.10.2026 after a fetch: origin/main
			   stands at V65, and the two open pull requests (575, 576) carry no migration.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file,
			   read off this very assertion when it ran before the entry existed. */
			new Applied("66", "V66__a_described_run_names_its_event.sql", 430932300),

			/* V67. A run on an event the member chose carries no town of its own: the town lives on the
			   event (Q4 of 7a, the coordinator's derivation from ADL A31, 19.10.2026). V10's „a described
			   race names its town" goes, its other half stands as a rule of its own, and a run that
			   carried a chosen event and a town loses the town, which is the one row it changes;
			   `ARunOnAChosenEventCarriedOverTest` runs the file over every shape the table can hold.

			   67 because it is the next free number, measured on 19.10.2026 after a fetch: origin/main
			   stands at V66, and the three open pull requests (578, 579, 580) carry no migration.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file,
			   read off this very assertion when it ran before the entry existed. */
			new Applied("67", "V67__a_run_on_a_chosen_event_has_the_events_town.sql", -1056513802),

			/* V68. A payment's reference is exactly ten digits (owner, PDL P8, 20.10.2026,
			   `YYYYNNNNNN`: the server takes exactly ten, on the route and in the database, and nine or
			   eleven are refused). The rule is added `not valid`, so a reference of the old shape that a
			   database may hold is neither checked nor changed; `PaymentReferenceCarriedOverTest` runs
			   the file over rows of eight, seven and ten digits and over none, and over the new rows the
			   database must refuse.

			   68 because it is the next free number, measured on 20.10.2026 after a fetch: origin/main
			   stands at V67, and the five open pull requests (597, 599, 600, 601, 602) carry no
			   migration.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file,
			   read off this very assertion when it ran before the entry existed. */
			new Applied("68", "V68__a_payment_reference_is_exactly_ten_digits.sql", 601235041),

			/* V69. The two Stari Grads of Croatia carry the town they stand by (owner, PDL, 20.10.2026,
			   „Stari Grad (Omiš)” i „Stari Grad (Gospić)” postaju „Stari Grad (Hvar)” i „Stari Grad
			   (Pag)”, ručno, po presedanu Kočevja; PENDING 28046). An UPDATE of one column over a VALUES
			   list keyed by the GeoNames mark and guarded by the old name, so no row that points at a town
			   moves and no constraint is added; `StariGradIsRenamedCarriedOverTest` runs the file over a
			   member and an event in each town, and `SameNamedTownsAreToldApartTest` pins both names by
			   mark. The source file `frontend/src/test/mock/places.json` carries the same two names.

			   69 because it is the next free number, measured on 21.10.2026 after a fetch: origin/main
			   stands at V68.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file,
			   read off this very assertion when it ran before the entry existed. */
			new Applied("69", "V69__the_two_stari_grads_carry_the_town_they_stand_by.sql", -1305469360),

			/* V70. The row of the privacy policy that names Cloudflare also names the storage of the encrypted
			   backups of the database and photos, in Serbian and in English (the words the owner approved on
			   20.10.2026, PDL, the entry "Red o Cloudflare-u u politici privatnosti postaje"), and the policy's
			   sign-off moves from 18.10.2026 to 22.10.2026 in both languages by the entry of 16.10.2026 (the
			   documents whose text changes), the rulebook and the terms of use keeping theirs. Four edits, each of
			   which stops the migration unless its old text stands exactly once where it is written and its new
			   text is not already there. No schema, no row.

			   70 because it is the next free number, and that was MEASURED rather than taken: every remote ref,
			   every worktree and the open pull requests were searched on 21.10.2026 and none held a migration at
			   V70 or above, and origin/main stands at V69.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file, read off
			   this very assertion when it ran before the entry existed and then confirmed by it. */
			new Applied("70", "V70__the_cloudflare_row_names_the_backups_of_the_database_and_photos.sql",
					-1597104966),

			/* V71. The three legal pages say each thing in one place, in Serbian and in English (the owner approved
			   the proposal on 22.10.2026, PDL, the entry "Uprošćavanje pravnih tekstova (22.10.2026)"): the rulebook
			   loses ten articles into the ones that already said the same and is renumbered from 78 to 68, the terms
			   of use lose their section on awards and the four after it move up, the privacy policy names the session
			   cookie, and all three are signed off on 22.10.2026. Every edit stops the migration unless its old text
			   stands exactly once and its new text is not already there; the section of the terms is removed only if
			   it is word for word the one this file was written for. No schema.

			   71 because it is the next free number, MEASURED on 22.10.2026: no remote ref, no worktree and no open
			   pull request held a migration at V71 or above, and origin/main stands at V70.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file, read off
			   this very assertion when it ran before the entry existed. */
			new Applied("71", "V71__the_legal_pages_say_each_thing_in_one_place.sql", -1120675458),

			/* V73. The privacy policy says the date of birth is not shown to others, in Serbian and in English
			   (the owner, 24.10.2026, PDL, the entry "Politika privatnosti, odeljak 3": add the word "drugima"):
			   the word "drugima" in the sentence of section 3 about the date of birth, in the cell about the document
			   and in the heading over the list of what is never shown, because a member sees his own date on
			   his own card. Eight edits, each stopping the migration unless its old text stands exactly once and its
			   new text is not already there. Two of them move the sign-off of the policy, and only the policy, to 24.10.2026. No schema.

			   73 and not 72, MEASURED on 24.10.2026: the pull request that carries V72 (an unconfirmed registration
			   lasts seven days) is merged before this one, and no other remote ref held a migration at V73. This
			   list therefore has no V72 yet; it gets one when that pull request is merged, and the two entries are
			   neighbours that do not touch.

			   Pinned LAST, when the file was final. The number is the one Flyway computes over the file, read off
			   this very assertion when it ran before the entry existed. */
			new Applied("73", "V73__the_privacy_policy_says_the_date_of_birth_is_not_shown_to_others.sql",
					1071621632));

	@Test
	void noMigrationHasChangedSinceItWasWritten() {
		List<Applied> applied = Arrays.stream(flyway.info().applied())
				.filter(one -> one.getVersion() != null)
				.map(one -> new Applied(one.getVersion().getVersion(), one.getScript(), one.getChecksum()))
				.toList();

		assertThat(applied)
				.as("a changed migration stops Flyway from starting against every database that ran the old one; "
						+ "write the next migration instead (ADL A2)")
				.containsExactlyElementsOf(PINNED);
	}
}
