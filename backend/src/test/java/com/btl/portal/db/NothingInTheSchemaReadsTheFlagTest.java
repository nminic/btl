package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * NOTHING IN THE SCHEMA READS {@code competitor.active}: no function, no view and no index, so the statements
 * of {@code src/main} are its only possible readers, and {@code web.NothingReadsTheFlagTest} holds those.
 *
 * <p>The half of the AF-1 guard the code cannot see, in the shape {@link TheBasisHasOneHomeTest} keeps for the
 * per-person basis V62 dropped: the catalog is asked, and a function that names the word is seen
 * ({@link #aFunctionThatNamesTheFlagIsSeen}), so an empty answer is a measurement and not a blind spot. PDL,
 * „Članstvo je činjenica po sezoni" (13.09.2026): „Zastavica „aktivan" prestaje da bude podatak i postaje
 * izvedena."
 */
class NothingInTheSchemaReadsTheFlagTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_FUNCTION_NAMING_IT = "select p.proname from pg_proc p"
			+ " join pg_namespace ns on ns.oid = p.pronamespace"
			+ " where ns.nspname = current_schema() and p.prosrc ~ '\\mactive\\M' order by 1";

	@Test
	void noFunctionViewOrIndexNamesTheFlag() {
		assertThat(db.sql(A_FUNCTION_NAMING_IT).query(String.class).list())
				.as("a function in the schema names competitor.active")
				.isEmpty();
		assertThat(db.sql("select viewname from pg_views where schemaname = current_schema()"
						+ " and definition ~ '\\mactive\\M' order by 1").query(String.class).list())
				.as("a view in the schema reads competitor.active")
				.isEmpty();
		assertThat(db.sql("select indexname from pg_indexes where schemaname = current_schema()"
						+ " and tablename = 'competitor' and indexdef ~ '\\mactive\\M' order by 1")
				.query(String.class).list())
				.as("an index is written over competitor.active")
				.isEmpty();
	}

	@Test
	void aFunctionThatNamesTheFlagIsSeen() {
		jdbc.execute("create function still_reads_the_flag() returns boolean language sql"
				+ " as 'select active from competitor limit 1'");

		assertThat(db.sql(A_FUNCTION_NAMING_IT).query(String.class).list()).containsExactly("still_reads_the_flag");
	}
}
