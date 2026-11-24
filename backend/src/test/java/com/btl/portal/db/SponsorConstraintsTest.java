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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE TABLE OF SPONSORS (V111), every constraint on it broken once on purpose.
 *
 * <p>Owner, PDL 24.11.2026: „Glavni sponzor je najviše jedan.”, „Opis ima srpsku i englesku verziju” with „Ograničenje
 * od 80 znakova važi za obe”, and „Redosled u traci: glavni sponzor prvi, pa ručni redosled”. The route says each of
 * these before the database does ({@code SponsorWriteApi}); this is the floor under it.
 */
class SponsorConstraintsTest extends DatabaseTest {

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

	/** The one table V111 adds. */
	static final List<String> TABLES = List.of("sponsor");

	private static final String EIGHTY = "'" + "č".repeat(80) + "'";

	private static final String EIGHTY_ONE = "'" + "č".repeat(81) + "'";

	private static String row(String name, String url, String sr, String en, String main, String position) {
		return "insert into sponsor (name, url, description_sr, description_en, main, position) values (" + name + ", "
				+ url + ", " + sr + ", " + en + ", " + main + ", " + position + ")";
	}

	private static String row(String position) {
		return row("'Sponzor'", "'https://primer.rs/'", "'Opis'", "null", "false", position);
	}

	/** One sponsor at place 1, and it is the main one. */
	@BeforeEach
	void theMainSponsorAtPlaceOne() {
		db.sql(row("'Glavni'", "'https://glavni.primer.rs/'", "'Opis'", "null", "true", "1")).update();
	}

	static List<Violation> violations() {
		String ok = "'https://primer.rs/'";

		return List.of(
				Violation.of("sponsor_pk", "insert into sponsor (id, name, url, description_sr, position)"
						+ " values ((select id from sponsor), 'Drugi', " + ok + ", 'Opis', 2)"),
				Violation.of("sponsor_logo_fk", "insert into sponsor (name, url, description_sr, position, logo_id)"
						+ " values ('Drugi', " + ok + ", 'Opis', 2, -1)"),
				Violation.of("sponsor_name_shape", row("'   '", ok, "'Opis'", "null", "false", "2")),
				Violation.of("sponsor_name_shape", row(EIGHTY_ONE, ok, "'Opis'", "null", "false", "2")),
				Violation.of("sponsor_url_shape", row("'Drugi'", "'primer.rs'", "'Opis'", "null", "false", "2")),
				Violation.of("sponsor_url_shape", row("'Drugi'", "'javascript:alert(1)'", "'Opis'", "null", "false", "2")),
				Violation.of("sponsor_url_shape", row("'Drugi'", "'https://primer .rs/'", "'Opis'", "null", "false", "2")),
				Violation.of("sponsor_url_shape",
						row("'Drugi'", "'https://" + "a".repeat(1993) + "'", "'Opis'", "null", "false", "2")),
				Violation.of("sponsor_description_sr_shape", row("'Drugi'", ok, "''", "null", "false", "2")),
				Violation.of("sponsor_description_sr_shape", row("'Drugi'", ok, EIGHTY_ONE, "null", "false", "2")),
				/* An empty string is not „no English": that is NULL, and two spellings of none are two answers. */
				Violation.of("sponsor_description_en_shape", row("'Drugi'", ok, "'Opis'", "''", "false", "2")),
				Violation.of("sponsor_description_en_shape", row("'Drugi'", ok, "'Opis'", EIGHTY_ONE, "false", "2")),
				Violation.of("sponsor_position_not_negative", row("-1")),
				Violation.of("sponsor_position_unique", row("1")),
				/* „Glavni sponzor je najviše jedan.” A second main one, at a place of its own. */
				Violation.of("sponsor_main_is_one", row("'Drugi'", ok, "'Opis'", "null", "true", "2")),
				Violation.notNull("sponsor_id_not_null", "id", "insert into sponsor (id, name, url, description_sr,"
						+ " position) values (null, 'Drugi', " + ok + ", 'Opis', 2)"),
				Violation.notNull("sponsor_name_not_null", "name", row("null", ok, "'Opis'", "null", "false", "2")),
				Violation.notNull("sponsor_url_not_null", "url", row("'Drugi'", "null", "'Opis'", "null", "false", "2")),
				Violation.notNull("sponsor_description_sr_not_null", "description_sr",
						row("'Drugi'", ok, "null", "null", "false", "2")),
				Violation.notNull("sponsor_main_not_null", "main", row("'Drugi'", ok, "'Opis'", "null", "null", "2")),
				Violation.notNull("sponsor_in_rotation_not_null", "in_rotation", "insert into sponsor (name, url,"
						+ " description_sr, in_rotation, position) values ('Drugi', " + ok + ", 'Opis', null, 2)"),
				Violation.notNull("sponsor_in_strip_not_null", "in_strip", "insert into sponsor (name, url,"
						+ " description_sr, in_strip, position) values ('Drugi', " + ok + ", 'Opis', null, 2)"),
				Violation.notNull("sponsor_position_not_null", "position", row("null")));
	}

	@ParameterizedTest
	@MethodSource("violations")
	void theConstraintRejectsTheRowThatBreaksIt(Violation violation) {
		assertThatThrownBy(() -> db.sql(violation.sql()).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(violation.evidence());
	}

	/** The floor under the list above, read out of the database. */
	@Test
	void everyConstraintOnTheTableHasARowThatBreaksIt() {
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

		/* V111's trigger on `sponsor` deletes a photo row that nobody holds and never refuses, so there is no row
		   that breaks it. It is taken away by the function it runs, as `league`'s is in LeagueConstraintsTest, and
		   its floor is APhotoNobodyHoldsGoesTest, which walks `sponsor` as the sixth holder. */
		declared = withoutTheConstraintTriggersThatAct(declared);

		Set<String> covered = violations().stream().map(Violation::constraint).collect(Collectors.toSet());

		assertThat(declared).isNotEmpty();
		assertThat(covered).containsExactlyInAnyOrderElementsOf(declared);
	}

	/** And each limit is a limit: what is exactly on it is taken. */
	@Test
	void eightyLettersAreTakenWhereverEightyIsTheCeiling() {
		assertThat(db.sql(row(EIGHTY, "'https://primer.rs/'", EIGHTY, EIGHTY, "false", "2")).update()).isOne();
	}

	@ParameterizedTest
	@ValueSource(strings = {"http://primer.rs", "https://primer.rs/a?b=c#d", "https://www.primer.rs/stranica"})
	void aLinkOfEitherSchemeIsTaken(String url) {
		assertThat(db.sql(row("'Drugi'", "?", "'Opis'", "null", "false", "2")).param(url).update()).isOne();
	}

	@Test
	void noMainSponsorAtAllIsATableTheSchemaTakes() {
		db.sql("update sponsor set main = false").update();

		assertThat(db.sql(row("2")).update()).isOne();
		assertThat(db.sql("select count(*) from sponsor where main").query(Integer.class).single()).isZero();
	}

	@Test
	void theBoxesAreOffUntilTheyAreTicked() {
		db.sql(row("2")).update();

		assertThat(db.sql("select main::text || in_rotation::text || in_strip::text from sponsor where position = 2")
				.query(String.class).single()).isEqualTo("falsefalsefalse");
	}
}
