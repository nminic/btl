package com.btl.portal.db;

import com.btl.portal.web.TranslatableRows;
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
 * THE TWO TABLES OF V113 AND WHAT V115 ADDS TO THEM, against a real database: what each constraint refuses, and that there is no constraint
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

		/* One of every other thing a translation can belong to (V115). The ducat is one of the fifteen V115 itself
		   wrote, and carries its English already: a row of its own would not be a first. */
		long member = TranslatableRows.member(db, "000951", "Biografija", false);

		TranslatableRows.league(db, "prevod-liga", 2041, "Pravila", "Nagrade");
		TranslatableRows.team(db, "prevod-tim", "Opis tima");
		TranslatableRows.comment(db, db.sql("select id from btl_event where slug = 'prevod-proba'")
				.query(Long.class).single(), member, "Komentar");
	}

	private static final String LEAGUE = "(select id from league where slug = 'prevod-liga')";
	private static final String PRICE_ROW = "(select id from price_row where key = 'early')";
	private static final String MEMBER = "(select id from competitor where member_number = '000951')";
	private static final String TEAM = "(select id from team where slug = 'prevod-tim')";
	private static final String COMMENT = "(select id from event_comment where body = 'Komentar')";
	private static final String DUCAT = "(select id from ducat where code = 'duk-sve-trke')";

	/** One row of a translation of ANY kind of thing, every column given. */
	private static String translationOf(String key, String thing, String field, String language, String origin,
			String digest, String heardAs, String body) {
		return "insert into text_translation (" + key + ", field, language, origin, source_digest, source_language,"
				+ " body) values (" + String.join(", ", thing, field, language, origin, digest, heardAs, body) + ")";
	}

	private static String askedOf(String key, String thing, String field) {
		return "insert into text_translation_asked (" + key + ", field, source_digest, asked_at, thrown_away)"
				+ " values (" + String.join(", ", thing, field, DIGEST, "now()", "false") + ")";
	}

	/** The kinds a translation belongs to, with a thing of each, the one field it has and one it has not. */
	record Kind(String key, String thing, String table, String field, String notThatField) {
	}

	static List<Kind> kinds() {
		return List.of(
				new Kind("event_id", EVENT, "btl_event", "description", "name"),
				new Kind("league_id", LEAGUE, "league", "rules", "name"),
				new Kind("price_row_id", PRICE_ROW, "price_row", "label", "key"),
				new Kind("competitor_id", MEMBER, "competitor", "bio", "first_name"),
				new Kind("team_id", TEAM, "team", "bio", "name"),
				new Kind("event_comment_id", COMMENT, "event_comment", "body", "who"),
				new Kind("ducat_id", DUCAT, "ducat", "name", "code"));
	}

	static List<Violation> ofTheKinds() {
		List<Violation> more = new java.util.ArrayList<>();

		for (Kind kind : kinds()) {
			String name = kind.key().replace("_id", "");

			more.add(Violation.of("text_translation_" + name + "_fk",
					translationOf(kind.key(), "-1", "'" + kind.field() + "'", "'sr'", "'manual'", DIGEST, "null", "'x'")));
			more.add(Violation.of("text_translation_field_of_its_thing",
					translationOf(kind.key(), kind.thing(), "'" + kind.notThatField() + "'", "'sr'", "'manual'", DIGEST,
							"null", "'x'")));
			/* A SECOND TRANSLATION OF ONE KIND, in the language and origin the first one has: unique for every kind and
			   not for the event alone, which the key in V113 was. */
			more.add(Violation.of("text_translation_once",
					translationOf(kind.key(), kind.thing(), "'" + kind.field() + "'", "'sr'", "'manual'", DIGEST, "null",
							"'first'")
							+ "; " + translationOf(kind.key(), kind.thing(), "'" + kind.field() + "'", "'sr'", "'manual'",
							DIGEST, "null", "'second'")));
			if (!kind.key().equals("ducat_id") && !kind.key().equals("event_id")) {
				more.add(Violation.of("text_translation_asked_" + name + "_fk",
						askedOf(kind.key(), "-1", "'" + kind.field() + "'")));
				more.add(Violation.of("text_translation_asked_field_of_its_thing",
						askedOf(kind.key(), kind.thing(), "'" + kind.notThatField() + "'")));
				more.add(Violation.of("text_translation_asked_once",
						askedOf(kind.key(), kind.thing(), "'" + kind.field() + "'") + "; "
								+ askedOf(kind.key(), kind.thing(), "'" + kind.field() + "'")));
			}
		}

		/* TWO THINGS IN ONE ROW. The two keys that share a field, so that only the rule that says „exactly one"
		   refuses it: any other pair also breaks the rule about which field a thing has. */
		more.add(Violation.of("text_translation_of_one_thing",
				"insert into text_translation (competitor_id, team_id, field, language, origin, source_digest, body)"
						+ " values (" + MEMBER + ", " + TEAM + ", 'bio', 'sr', 'manual', " + DIGEST + ", 'x')"));
		more.add(Violation.of("text_translation_asked_of_one_thing",
				"insert into text_translation_asked (competitor_id, team_id, field, source_digest, asked_at)"
						+ " values (" + MEMBER + ", " + TEAM + ", 'bio', " + DIGEST + ", now())"));

		return more;
	}

	static List<Violation> violations() {
		List<Violation> all = new java.util.ArrayList<>(ofTheEvent());

		all.addAll(ofTheKinds());

		return all;
	}

	private static List<Violation> ofTheEvent() {
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
	 * is part of what makes a row unique, which is what keeps the machine from ever reaching a hand row (V113).
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

	/**
	 * EVERY KIND OF THING TAKES ITS TRANSLATIONS WITH IT when it is deleted (V115): the biography of a member is the one
	 * the privacy policy promises, and the others are copies of words nobody can read any more. The price row is the
	 * exception that is the rule of a codebook: it is not deleted, so it holds its translations (RESTRICT).
	 */
	@ParameterizedTest
	@MethodSource("kinds")
	void aDeletedThingTakesItsTranslationsAndItsStampWithIt(Kind kind) {
		long thing = db.sql(kind.thing().substring(1, kind.thing().length() - 1)).query(Long.class).single();

		db.sql(translationOf(kind.key(), String.valueOf(thing), "'" + kind.field() + "'", "'zz'", "'manual'", DIGEST,
				"null", "'x'")).update();

		if (!kind.key().equals("ducat_id")) {
			db.sql("delete from text_translation_asked where " + kind.key() + " = ?").param(thing).update();
			db.sql(askedOf(kind.key(), String.valueOf(thing), "'" + kind.field() + "'")).update();
		}

		if (kind.key().equals("price_row_id")) {
			/* THE ONE KEY THAT RESTRICTS: price_row is a codebook (DeltaMigrationAppliesTest), and nothing deletes a
			   row of the price list, so the translation holds the row it translates and the deletion is refused. */
			assertThatThrownBy(() -> db.sql("delete from price_row where id = ?").param(thing).update())
					.isInstanceOf(DataIntegrityViolationException.class)
					.hasMessageContaining("text_translation_price_row_fk");

			return;
		}

		db.sql("delete from " + kind.table() + " where id = ?").param(thing).update();

		assertThat(Stream.of("text_translation", "text_translation_asked")
				.filter(table -> !(table.endsWith("asked") && kind.key().equals("ducat_id")))
				.map(table -> db.sql("select count(*) from " + table + " where " + kind.key() + " = ?").param(thing)
						.query(Integer.class).single()))
				.containsOnly(0);
	}
}
