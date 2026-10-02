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
			   bigger town in brackets (owner, 02.10.2026). Data only: 4090 rows, one UPDATE, the rank, the
			   country and the English name of every one of them untouched. Written by
			   `generate_reference_migrations.py --delta` out of the codebook that
			   btl-produkt/istorijski-podaci/oznaci-istoimena-mesta.py labelled, and it is the first delta
			   the generator has written that a database applies.

			   51 because it is the next free number, and that was MEASURED rather than taken: every local
			   and remote ref, every worktree and the four open pull requests were searched on 02.10.2026
			   and none held a migration at V51 or above, and origin/main stands at V50.

			   Pinned LAST, when the file was final. Regenerating it, which the generator does freely for a
			   migration main does not carry yet, moves this number, and so does a labelling that changes. */
			new Applied("51", "V51__reference_data_update.sql", -480456980),

			/* V52. The key that refuses two towns of one country under one name, deferrable initially
			   immediate like the order key beside it, and it runs after V51 and only then: over V3 alone it
			   would fail on the first pair. No data.

			   52 for the reason 51 is, and because it has to run after the delta that makes it true.

			   Pinned LAST. The number is the one Flyway computes over the file, worked out with a copy of
			   its algorithm (CRC32 over the lines, with line breaks and a BOM left out), which reproduced
			   four numbers pinned above to the digit before it was trusted for these two, and this list is
			   what confirms it on the gate. */
			new Applied("52", "V52__a_town_is_told_apart_from_its_namesakes.sql", -2044012803));

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
