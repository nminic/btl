package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V115 DOES OVER A DATABASE THAT ALREADY HOLDS TRANSLATIONS, run against a real database (CLAUDE.md, section 11).
 *
 * <p>V115 replaces three rules of each of the two tables of V113 with rules that name six more kinds of thing, and
 * writes the English of fifteen ducats. A rule rewritten over rows that stand is exactly what a database the suite
 * filled itself never meets, so the case is made the way {@link MembershipCarriedOverTest} makes it: what V115 added
 * is taken away with {@code drop column} (which takes every rule that names the column with it), the three rules V113
 * had are put back, an event with a translation and a stamp is written as production held them, and the migration is
 * executed from the file Flyway resolved ({@link DatabaseTest#migrationSql}), inside the test's transaction, which
 * is rolled back.
 *
 * <p><b>What it must NOT do to them:</b> touch them. The translation and the stamp of the event stay exactly as they
 * were, and the only rows that appear are the ducats'.
 */
class TextTranslationOfEveryKindCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	@Test
	void theTranslationsOfEventsAlreadyThereSurviveAndTheDucatsGetTheirEnglish() {
		jdbc.execute("delete from text_translation where ducat_id is not null");
		jdbc.execute("alter table text_translation drop column league_id, drop column price_row_id,"
				+ " drop column competitor_id, drop column team_id, drop column event_comment_id,"
				+ " drop column ducat_id");
		jdbc.execute("alter table text_translation_asked drop column league_id, drop column price_row_id,"
				+ " drop column competitor_id, drop column team_id, drop column event_comment_id");
		jdbc.execute("alter table text_translation"
				+ " add constraint text_translation_of_one_thing check (num_nonnulls(event_id) = 1),"
				+ " add constraint text_translation_field_of_its_thing check (event_id is null or field = 'description'),"
				+ " add constraint text_translation_once unique nulls not distinct (event_id, field, language, origin)");
		jdbc.execute("alter table text_translation_asked"
				+ " add constraint text_translation_asked_of_one_thing check (num_nonnulls(event_id) = 1),"
				+ " add constraint text_translation_asked_field_of_its_thing check (event_id is null"
				+ " or field = 'description'),"
				+ " add constraint text_translation_asked_once unique nulls not distinct (event_id, field)");
		assertThat(db.sql("select count(*) from information_schema.columns where table_schema = current_schema()"
						+ " and table_name = 'text_translation' and column_name in ('league_id', 'ducat_id')")
				.query(Integer.class).single())
				.as("the fixture left what V115 adds in place, so the migration below would fail on the fixture")
				.isZero();

		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured, description, link)"
				+ " values ('zateceni-prevod', 'Zatečeni prevod', date '2026-10-04',"
				+ " (select id from place where rank = 1), null, null, 'race', false, 'Staza uz Savu.', '')").update();
		long event = db.sql("select id from btl_event where slug = 'zateceni-prevod'").query(Long.class).single();

		db.sql("insert into text_translation (event_id, field, language, origin, source_digest, source_language, body)"
				+ " values (?, 'description', 'en', 'machine', ?, 'sr-Latn', 'A course along the Sava.')")
				.params(event, "b".repeat(64)).update();
		db.sql("insert into text_translation_asked (event_id, field, source_digest, asked_at, thrown_away)"
				+ " values (?, 'description', ?, timestamptz '2026-11-25 10:00:00+00', true)")
				.params(event, "b".repeat(64)).update();

		jdbc.execute(migrationSql("115"));

		assertThat(db.sql("select body from text_translation where event_id = ?").param(event)
				.query(String.class).list()).containsExactly("A course along the Sava.");
		assertThat(db.sql("select thrown_away from text_translation_asked where event_id = ?").param(event)
				.query(Boolean.class).list()).containsExactly(true);
		assertThat(db.sql("select count(*) from text_translation where event_id is null and ducat_id is null")
				.query(Integer.class).single()).isZero();
		assertThat(db.sql("select count(*) from text_translation where ducat_id is not null and origin = 'manual'"
				+ " and language = 'en'").query(Integer.class).single()).isEqualTo(49);
		assertThat(db.sql("select count(*) from text_translation_asked").query(Integer.class).single()).isOne();
	}
}
