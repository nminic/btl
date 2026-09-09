package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V1: the collation the whole schema sorts names by.
 *
 * ADL A36, O21: names sort by the Serbian Latin alphabet, through an ICU
 * collation for {@code sr-Latn}.
 */
class ConventionsTest extends DatabaseTest {

	@Test
	void theCollationIsIcuAndIsTheSerbianLatinLocale() {
		/* 'i' is ICU. Not libc, whose Serbian collation depends on a locale having
		   been generated in the image, and not the built in provider, which sorts
		   by code point. */
		assertThat(one("select collprovider::text from pg_collation where collname = 'sr_latn'")).isEqualTo("i");
		assertThat(one("select colllocale from pg_collation where collname = 'sr_latn'")).isEqualTo("sr-Latn");

		/* Deterministic on purpose: a non deterministic collation cannot be used
		   with LIKE or a regular expression, and prefix search over the town
		   codebook is the one thing the field that reads it does. */
		assertThat(yes("select collisdeterministic from pg_collation where collname = 'sr_latn'")).isTrue();
	}

	/**
	 * The collation is the Serbian tailoring and not the ICU root.
	 *
	 * This is the whole of the difference, and it is not a nicety. In the Serbian
	 * Latin alphabet C and C-with-caron are two letters, so every word beginning
	 * with C comes before every word beginning with C-with-caron. Under the ICU
	 * root locale the caron is an accent, the two are one letter at the primary
	 * level, and Cvetko lands after Cacak-with-caron.
	 *
	 * Measured against a root collation created here rather than against the
	 * database default, because the default is a fact about the image: this way
	 * the test says something about the schema instead of about Debian. The probe
	 * collation is created inside the test transaction and goes with the rollback.
	 */
	@Test
	void theCollationIsTheSerbianTailoringAndNotTheIcuRoot() {
		db.sql("create collation root_icu_probe (provider = icu, locale = 'und', deterministic = true)").update();

		assertThat(yes("select ('Cvetko' collate sr_latn) < ('Čačak' collate sr_latn)")).isTrue();
		assertThat(yes("select ('Cvetko' collate root_icu_probe) < ('Čačak' collate root_icu_probe)")).isFalse();
	}

	/**
	 * And the columns actually carry it, said with data rather than with metadata.
	 *
	 * A column that was left without the collation would sort by whatever the
	 * database was created with, and asking {@code information_schema} would only
	 * prove that a name had been written next to a column. These two pairs are
	 * real rows of the two codebooks, and they come out the other way round under
	 * any untailored collation: the ICU root and libc en_US both put
	 * Cad-with-caron before Crna Gora and Cacak-with-caron before Cvetovo.
	 */
	@Test
	void nameColumnsSortByTheSerbianAlphabet() {
		List<String> countries = db
				.sql("select name from country where name in ('Crna Gora', 'Čad', 'Češka') order by name")
				.query(String.class)
				.list();

		assertThat(countries).containsExactly("Crna Gora", "Čad", "Češka");

		List<String> towns = db
				.sql("select name from place where name in ('Cvetovo', 'Čačak') order by name")
				.query(String.class)
				.list();

		assertThat(towns).containsExactly("Cvetovo", "Čačak");
	}

	/**
	 * No extension is installed, and that is what V1 decides rather than what it
	 * forgot.
	 *
	 * The measurement is written into the migration: everything the schema is
	 * likely to reach for is available in this image, PostGIS is not, and nothing
	 * this increment adds needs any of them. An extension created against a use
	 * that has not arrived is a footprint on the production database with no test
	 * over it, so this fails the day one appears without a reason beside it.
	 */
	@Test
	void noExtensionIsInstalledBeyondTheOneEveryDatabaseIsBornWith() {
		List<String> installed = db.sql("select extname from pg_extension order by extname").query(String.class).list();

		assertThat(installed).containsExactly("plpgsql");
	}

	/**
	 * The schema holds the tables these migrations create, and nothing else.
	 *
	 * The town codebook is loaded through a staging table, because the codebook
	 * names a country by its code and the table holds it by its id, and the
	 * migration drops that table when it is done. A staging table left standing is
	 * a table in the production database that nothing owns, nothing migrates and
	 * nobody notices, and no constraint anywhere would say so. This does.
	 *
	 * Read out of the catalogue rather than listed from memory, so a table
	 * arriving without a decision fails here instead of being found later. Flyway's
	 * own table is left out by {@link DatabaseTest#tablesInTheSchema()}, which asks
	 * Flyway what it is called; until 09.09.2026 this line wrote the name out by
	 * hand instead, which was the same setting written in two places two files
	 * apart.
	 */
	@Test
	void theSchemaHoldsOnlyTheTablesTheseMigrationsCreate() {
		assertThat(tablesInTheSchema()).containsExactly("account", "admin_right", "attending", "btl_event",
				"competitor", "country", "email_verification_token", "event_comment", "place", "price_row", "race",
				"result", "role");
	}

	/**
	 * And no Java source writes that name out again.
	 *
	 * The floor under the line above, and it is here because the line above is
	 * what it was measured on: setting {@code spring.flyway.table} to anything
	 * else broke exactly one test in the suite, this one, because it alone held
	 * the name rather than asking for it. Fixing the one line leaves nothing at
	 * all saying the next one may not do the same, and a test that would only fail
	 * under a setting nobody has set is not a floor.
	 *
	 * <p>What it reads and what it does not, said rather than narrowed quietly:
	 * every {@code .java} file under {@code backend/src}, found by walking the
	 * tree rather than listed, against the name Flyway itself reports. Properties
	 * files are not read, and that is the whole of the rule: a configuration file
	 * is where the setting is allowed to be written, and Java code asks.
	 */
	@Test
	void noJavaSourceWritesTheNameOfFlywaysOwnTable() throws IOException {
		Path sources = repositoryRoot().resolve("backend/src");
		String name = flywayTable();

		try (Stream<Path> tree = Files.walk(sources)) {
			List<String> guilty = tree
					.filter(path -> path.getFileName().toString().endsWith(".java"))
					.filter(path -> readable(path).contains(name))
					.map(path -> sources.relativize(path).toString())
					.sorted()
					.toList();

			assertThat(guilty)
					.as("ask flywayTable() instead: this is a setting, and a setting written down twice is a "
							+ "setting that moves in one of the two places")
					.isEmpty();
		}
	}

	private static String readable(Path path) {
		try {
			return Files.readString(path);
		}
		catch (IOException problem) {
			throw new UncheckedIOException(problem);
		}
	}

	private String one(String sql) {
		return db.sql(sql).query(String.class).single();
	}

	private Boolean yes(String sql) {
		return db.sql(sql).query(Boolean.class).single();
	}
}
