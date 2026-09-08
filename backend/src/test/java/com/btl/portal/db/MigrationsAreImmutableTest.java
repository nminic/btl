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
			new Applied("6", "V6__account_and_email_verification.sql", -1209616982));

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
