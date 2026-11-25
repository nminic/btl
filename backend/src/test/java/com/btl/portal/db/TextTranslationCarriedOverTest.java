package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V113 DOES OVER A DATABASE THAT ALREADY HOLDS EVENTS, run against a real database.
 *
 * <p><b>Why this exists.</b> CLAUDE.md, section 11: every other case starts from a database it filled itself, so
 * what a migration does to rows standing before it is invisible to all of them. On 25.11.2026 production held 1305
 * events, 60 of them with a description. V113 only creates two tables and puts no constraint on a table that
 * exists, so nothing standing can refuse it; this says so by measurement and not by reading the file.
 *
 * <p><b>How the fixture is made</b>, the shape of {@link SharedCardAskedAtCarriedOverTest}: what V113 adds is taken
 * away with one {@code drop table ... cascade}, an event with a description is written as the database held it
 * before V113, and the migration is executed from the file Flyway resolved ({@link DatabaseTest#migrationSql}),
 * inside the test's transaction, which is rolled back.
 *
 * <p><b>And what it must NOT do to them:</b> translate them. The events that were there are translated by the
 * first passes of {@code TextsAreTranslated}, which reads them like any other, so the migration leaves both tables
 * empty and every description as it was written.
 */
class TextTranslationCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	@Test
	void theEventsAlreadyThereKeepTheirWordsAndNothingIsTranslatedYet() {
		jdbc.execute("drop table text_translation_asked, text_translation cascade");
		assertThat(db.sql("select count(*) from pg_tables where schemaname = current_schema()"
						+ " and tablename in ('text_translation', 'text_translation_asked')")
				.query(Integer.class).single())
				.as("the fixture left what V113 adds in place, so the migration below would fail on the fixture")
				.isZero();

		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured, description, link)"
				+ " values ('zateceni-dogadjaj', 'Zatečeni događaj', date '2026-10-04',"
				+ " (select id from place where rank = 1), null, null, 'race', false,"
				+ " 'Staza uz Savu, ravna i brza. Prijave na [stranici](https://primer.rs/prijava).', '')").update();

		jdbc.execute(migrationSql("113"));

		assertThat(db.sql("select description from btl_event where slug = 'zateceni-dogadjaj'").query(String.class)
				.single()).isEqualTo("Staza uz Savu, ravna i brza. Prijave na [stranici](https://primer.rs/prijava).");
		assertThat(db.sql("select (select count(*) from text_translation) + (select count(*) from"
				+ " text_translation_asked)").query(Integer.class).single()).isZero();
	}
}
