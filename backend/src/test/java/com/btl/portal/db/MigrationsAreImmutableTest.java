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
			new Applied("42", "V42__the_balance_is_one_amount_in_one_currency.sql", -1505949912));

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
