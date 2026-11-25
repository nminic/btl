package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE TWO TABLES OF V112, against a real database: what each constraint refuses, and that there is no constraint
 * without a row that breaks it. The shape of {@link SharedCardConstraintsTest}.
 */
class TextTranslationConstraintsTest extends DatabaseTest {

	record Violation(String constraint, String evidence, String sql) {

		static Violation of(String constraint, String sql) {
			return new Violation(constraint, constraint, sql);
		}

		static Violation notNull(String constraint, String column, String sql) {
			return new Violation(constraint, "column \"" + column + "\"", sql);
		}

		@Override
		public String toString() {
			return constraint + ": " + sql;
		}
	}

	static final List<String> TABLES = List.of("text_translation", "text_translation_asked");

	private static final String DIGEST = "'" + "a".repeat(64) + "'";

	private static final String EVENT = "(select id from btl_event where slug = 'prevod-proba')";

	/** One row of a translation, every column given, so each violation below changes exactly one of them. */
	private static String translation(String event, String field, String language, String origin, String digest,
			String heardAs, String body) {
		return "insert into text_translation (event_id, field, language, origin, source_digest, source_language, body)"
				+ " values (" + String.join(", ", event, field, language, origin, digest, heardAs, body) + ")";
	}

	private static String translation() {
		return translation(EVENT, "'description'", "'en'", "'machine'", DIGEST, "'sr-Latn'", "'Through the town'");
	}

	private static String asked(String event, String field, String digest, String at, String thrownAway) {
		return "insert into text_translation_asked (event_id, field, source_digest, asked_at, thrown_away)"
				+ " values (" + String.join(", ", event, field, digest, at, thrownAway) + ")";
	}

	@BeforeEach
	void anEventAndATranslationOfIt() {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured, description, link)"
				+ " values ('prevod-proba', 'Proba prevoda', date '2027-05-01', (select id from place where rank = 1),"
				+ " null, null, 'race', false, 'Kroz grad', '')").update();
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured, description, link)"
				+ " values ('prevod-druga', 'Druga proba', date '2027-05-02', (select id from place where rank = 1),"
				+ " null, null, 'race', false, 'Drugi opis', '')").update();
		db.sql(translation()).update();
		db.sql(asked(EVENT, "'description'", DIGEST, "now()", "false")).update();
	}

	static List<Violation> violations() {
		return List.of(
				Violation.of("text_translation_pk",
						"insert into text_translation (id, event_id, field, language, origin, source_digest,"
								+ " source_language, body) select id, event_id, field, 'sr', origin, source_digest,"
								+ " source_language, body from text_translation where field = 'description'"
								+ " and event_id = " + EVENT),
				Violation.of("text_translation_event_fk",
						translation("-1", "'description'", "'sr'", "'machine'", DIGEST, "'sr-Latn'", "'x'")),
				Violation.of("text_translation_of_one_thing",
						translation("null", "'description'", "'sr'", "'machine'", DIGEST, "'sr-Latn'", "'x'")),
				Violation.of("text_translation_field_of_its_thing",
						translation(EVENT, "'name'", "'en'", "'machine'", DIGEST, "'sr-Latn'", "'x'")),
				Violation.of("text_translation_once", translation()),
				Violation.of("text_translation_language_shape",
						translation(EVENT, "'description'", "'sr-Latn'", "'machine'", DIGEST, "'sr-Latn'", "'x'")),
				Violation.of("text_translation_origin_known",
						translation(EVENT, "'description'", "'en'", "'reviewed'", DIGEST, "'sr-Latn'", "'x'")),
				Violation.of("text_translation_digest_shape",
						translation(EVENT, "'description'", "'sr'", "'machine'", "'ABC'", "'sr-Latn'", "'x'")),
				Violation.of("text_translation_a_machine_says_what_it_read",
						translation(EVENT, "'description'", "'sr'", "'machine'", DIGEST, "null", "'x'")),
				Violation.of("text_translation_source_language_shape",
						translation(EVENT, "'description'", "'sr'", "'machine'", DIGEST, "'serbian'", "'x'")),
				Violation.of("text_translation_body_not_blank",
						translation(EVENT, "'description'", "'sr'", "'machine'", DIGEST, "'sr-Latn'", "'  '")),
				Violation.notNull("text_translation_id_not_null", "id",
						"insert into text_translation (id, event_id, field, language, origin, source_digest, body)"
								+ " values (null, " + EVENT + ", 'description', 'sr', 'manual', " + DIGEST + ", 'x')"),
				Violation.notNull("text_translation_field_not_null", "field",
						translation(EVENT, "null", "'sr'", "'machine'", DIGEST, "'sr-Latn'", "'x'")),
				Violation.notNull("text_translation_language_not_null", "language",
						translation(EVENT, "'description'", "null", "'machine'", DIGEST, "'sr-Latn'", "'x'")),
				Violation.notNull("text_translation_origin_not_null", "origin",
						translation(EVENT, "'description'", "'sr'", "null", DIGEST, "'sr-Latn'", "'x'")),
				Violation.notNull("text_translation_source_digest_not_null", "source_digest",
						translation(EVENT, "'description'", "'sr'", "'machine'", "null", "'sr-Latn'", "'x'")),
				Violation.notNull("text_translation_body_not_null", "body",
						translation(EVENT, "'description'", "'sr'", "'machine'", DIGEST, "'sr-Latn'", "null")),
				Violation.notNull("text_translation_made_at_not_null", "made_at",
						"insert into text_translation (event_id, field, language, origin, source_digest,"
								+ " source_language, body, made_at) values (" + EVENT + ", 'description', 'sr',"
								+ " 'machine', " + DIGEST + ", 'sr-Latn', 'x', null)"),

				Violation.of("text_translation_asked_pk",
						"insert into text_translation_asked (id, event_id, field, source_digest, asked_at)"
								+ " select id, (select id from btl_event where slug = 'prevod-druga'), field,"
								+ " source_digest, asked_at from text_translation_asked where event_id = " + EVENT),
				Violation.of("text_translation_asked_event_fk", asked("-1", "'description'", DIGEST, "now()", "false")),
				Violation.of("text_translation_asked_of_one_thing",
						asked("null", "'description'", DIGEST, "now()", "false")),
				Violation.of("text_translation_asked_field_of_its_thing",
						asked(EVENT, "'name'", DIGEST, "now()", "false")),
				Violation.of("text_translation_asked_once", asked(EVENT, "'description'", DIGEST, "now()", "false")),
				Violation.of("text_translation_asked_digest_shape",
						asked(EVENT, "'description'", "'x'", "now()", "false")),
				Violation.notNull("text_translation_asked_id_not_null", "id",
						"insert into text_translation_asked (id, event_id, field, source_digest, asked_at)"
								+ " values (null, " + EVENT + ", 'description', " + DIGEST + ", now())"),
				Violation.notNull("text_translation_asked_field_not_null", "field",
						asked(EVENT, "null", DIGEST, "now()", "false")),
				Violation.notNull("text_translation_asked_source_digest_not_null", "source_digest",
						asked(EVENT, "'description'", "null", "now()", "false")),
				Violation.notNull("text_translation_asked_asked_at_not_null", "asked_at",
						asked(EVENT, "'description'", DIGEST, "null", "false")),
				Violation.notNull("text_translation_asked_thrown_away_not_null", "thrown_away",
						asked(EVENT, "'description'", DIGEST, "now()", "null")));
	}

	@ParameterizedTest
	@MethodSource("violations")
	void theConstraintRejectsTheRowThatBreaksIt(Violation violation) {
		assertThatThrownBy(() -> db.sql(violation.sql()).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(violation.evidence());
	}

	@Test
	void everyConstraintOnTheTablesHasARowThatBreaksIt() {
		List<String> declared = TABLES.stream()
				.flatMap(table -> db
						.sql("select con.conname from pg_constraint con where con.conrelid = cast(? as regclass)"
								+ " union all "
								+ "select index.relname from pg_index idx join pg_class index on index.oid = idx.indexrelid"
								+ " where idx.indrelid = cast(? as regclass) and idx.indisunique"
								+ " and not exists (select 1 from pg_constraint own where own.conindid = idx.indexrelid)")
						.params(table, table)
						.query(String.class)
						.list()
						.stream())
				.toList();

		Set<String> covered = violations().stream().map(Violation::constraint).collect(Collectors.toSet());

		assertThat(declared).isNotEmpty();
		assertThat(covered).containsExactlyInAnyOrderElementsOf(declared);
	}

	/**
	 * A HAND TRANSLATION AND A MACHINE ONE STAND SIDE BY SIDE, in the same language and of the same original: origin
	 * is part of what makes a row unique, which is what keeps the machine from ever reaching a hand row (V112).
	 */
	@Test
	void aHandTranslationStandsBesideTheMachineOne() {
		assertThat(db.sql(translation(EVENT, "'description'", "'en'", "'manual'", DIGEST, "null", "'By hand'"))
				.update()).isOne();
	}

	/** A hand translation need not say what the original was read as; nothing read it. */
	@Test
	void aHandTranslationNeedNotSayWhatItRead() {
		assertThat(db.sql(translation(EVENT, "'description'", "'sr'", "'manual'", DIGEST, "null", "'Rukom'"))
				.update()).isOne();
	}

	@ParameterizedTest
	@ValueSource(strings = {"en", "sr", "sr-Latn", "sr-Cyrl", "hr", "zh-Hans", "cnr"})
	void whatTheServiceSaysItReadIsTakenAsItSaysIt(String heardAs) {
		db.sql("delete from text_translation where event_id = " + EVENT).update();

		assertThat(db.sql(translation(EVENT, "'description'", "'sr'", "'machine'", DIGEST, "?", "'x'"))
				.param(heardAs).update()).isOne();
	}

	/** A digest is lower-case hex of sixty-four characters, which is what PostgreSQL's own sha256 gives. */
	@Test
	void theDigestPostgresqlComputesIsADigestThisTableTakes() {
		db.sql("delete from text_translation where event_id = " + EVENT).update();

		assertThat(db.sql("insert into text_translation (event_id, field, language, origin, source_digest,"
				+ " source_language, body) select id, 'description', 'en', 'machine',"
				+ " encode(sha256(convert_to(description, 'UTF8')), 'hex'), 'sr-Latn', 'Through the town'"
				+ " from btl_event where slug = 'prevod-proba'").update()).isOne();
	}

	/** And both go with the event: a translation of an event that is gone is words nobody can read. */
	@Test
	void aDeletedEventTakesItsTranslationsAndItsStampWithIt() {
		long event = db.sql("select id from btl_event where slug = 'prevod-proba'").query(Long.class).single();

		db.sql("delete from btl_event where id = ?").param(event).update();

		assertThat(Stream.of("text_translation", "text_translation_asked")
				.map(table -> db.sql("select count(*) from " + table + " where event_id = ?").param(event)
						.query(Integer.class).single()))
				.containsOnly(0);
	}
}
