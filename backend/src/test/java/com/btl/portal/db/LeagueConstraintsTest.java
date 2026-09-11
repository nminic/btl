package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Every constraint the two tables of V14 carry, with the row that breaks it.
 *
 * <p>A league is an entity and the RunTrace league is a row in it (PDL P15), so
 * what is measured here is the general thing: it has an address, a season, an
 * administrator, words about what is won in it, and a list of events that may
 * change during the year.
 *
 * <p>Two columns somebody would expect are deliberately absent and cannot be
 * measured because there is nothing to measure: a league has no scoring of its own
 * ("svaka Liga se boduje istim BTL bodovima"), and no choice of how it groups - the
 * owner removed that on 31.08.2026 in one sentence and `groupsByCategory` left the
 * model. Nobody joins a league either, so there is no membership table: every
 * member is in every league, automatically.
 */
class LeagueConstraintsTest extends DatabaseTest {

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

	/** The two tables V14 adds. */
	static final List<String> TABLES = List.of("league", "league_event");

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String A_MEMBER = "(select id from competitor where member_number = '000980')";
	private static final String A_LEAGUE = "(select id from league where slug = 'probna-liga')";
	private static final String AN_EVENT = "(select id from btl_event where slug = 'dogadjaj-u-ligi')";
	private static final String ANOTHER_EVENT = "(select id from btl_event where slug = 'drugi-dogadjaj')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender, birth_date,"
			+ " place_id, city, country_id, first_season, first_season_2027, active, membership_basis,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String COLUMNS = "slug, name, season, rules, prizes, admin_id";

	private static String league(String values) {
		return "insert into league (" + COLUMNS + ") values (" + values + ")";
	}

	private static String entry(String values) {
		return "insert into league_event (league_id, event_id) values (" + values + ")";
	}

	/** A league with somebody running it. */
	private static final String GOOD_LEAGUE = league("'nova-liga', 'Nova liga', 2028,"
			+ " 'Boduju se sve trke iz kalendara lige.', 'Medalje za prva tri mesta.', " + A_MEMBER);
	/** And one with nobody named to run it, and nothing written about it yet. */
	private static final String GOOD_LEAGUE_UNCLAIMED =
			league("'treca-liga', 'Treca liga', 2029, '', '', null");
	/** A second event entering the league that is already there. */
	private static final String GOOD_ENTRY = entry(A_LEAGUE + ", " + ANOTHER_EVENT);

	/**
	 * A member, two events, one league, and one event already in it.
	 */
	@BeforeEach
	void probe() {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000980', 'Probni', 'Ligas', 'M',"
				+ " date '1984-04-04', " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
				+ " '00112233445566b0', null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();

		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured,"
				+ " description, link, copied_from) values ('dogadjaj-u-ligi', 'Dogadjaj u ligi',"
				+ " date '2027-05-05', " + A_TOWN + ", null, null, 'race', false, '', '', null)").update();
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured,"
				+ " description, link, copied_from) values ('drugi-dogadjaj', 'Drugi dogadjaj',"
				+ " date '2027-06-06', " + A_TOWN + ", null, null, 'race', false, '', '', null)").update();

		db.sql(league("'probna-liga', 'Probna liga', 2027, 'Pravila.', 'Nagrade.', " + A_MEMBER)).update();
		db.sql(entry(A_LEAGUE + ", " + AN_EVENT)).update();
	}

	static List<Violation> violations() {
		return List.of(
				Violation.notNull("league_id_not_null", "id",
						"insert into league (id, " + COLUMNS + ") values (null, 'nova-liga', 'Nova liga',"
								+ " 2028, '', '', null)"),
				Violation.of("league_pk",
						"insert into league (id, " + COLUMNS + ") select id, 'nova-liga', 'Nova liga', 2028,"
								+ " '', '', null from league limit 1"),

				Violation.notNull("league_slug_not_null", "slug",
						league("null, 'Nova liga', 2028, '', '', null")),
				Violation.of("league_slug_unique",
						league("'probna-liga', 'Nova liga', 2028, '', '', null")),
				Violation.of("league_slug_shape",
						league("'Nije Slug', 'Nova liga', 2028, '', '', null")),

				Violation.notNull("league_name_not_null", "name",
						league("'nova-liga', null, 2028, '', '', null")),
				Violation.of("league_name_not_blank",
						league("'nova-liga', '   ', 2028, '', '', null")),

				Violation.notNull("league_season_not_null", "season",
						league("'nova-liga', 'Nova liga', null, '', '', null")),
				Violation.of("league_season_not_before_the_league",
						league("'nova-liga', 'Nova liga', 2026, '', '', null")),

				/* What a league is about and what is won in it: always there, and empty is a
				   legitimate value. The portal keeps the words and makes no rule out of them. */
				Violation.notNull("league_rules_not_null", "rules",
						league("'nova-liga', 'Nova liga', 2028, null, '', null")),
				Violation.notNull("league_prizes_not_null", "prizes",
						league("'nova-liga', 'Nova liga', 2028, '', null, null")),

				Violation.of("league_admin_fk",
						league("'nova-liga', 'Nova liga', 2028, '', '', 999999")),

				/* WHICH EVENTS ARE IN IT. The pair is the key, so an event enters a league once:
				   adding it twice is not a second fact. */
				Violation.notNull("league_event_league_id_not_null", "league_id",
						entry("null, " + AN_EVENT)),
				Violation.notNull("league_event_event_id_not_null", "event_id",
						entry(A_LEAGUE + ", null")),
				Violation.of("league_event_pk", entry(A_LEAGUE + ", " + AN_EVENT)),
				Violation.of("league_event_league_fk", entry("999999, " + AN_EVENT)),
				Violation.of("league_event_event_fk", entry(A_LEAGUE + ", 999999")));
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
	void everyConstraintOnTheTwoTablesHasARowThatBreaksIt() {
		String tables = TABLES.stream().map(name -> "'" + name + "'").collect(Collectors.joining(", "));
		String relations = " = any (array[" + tables + "]::regclass[])";

		List<String> declared = db
				.sql("select con.conname from pg_constraint con where con.conrelid" + relations
						+ " union all "
						+ "select index.relname from pg_index idx join pg_class index on index.oid = idx.indexrelid"
						+ " where idx.indrelid" + relations + " and idx.indisunique"
						+ " and not exists (select 1 from pg_constraint own where own.conindid = idx.indexrelid)")
				.query(String.class)
				.list();

		Set<String> covered = violations().stream().map(Violation::constraint).collect(Collectors.toSet());

		assertThat(declared).isNotEmpty();
		assertThat(covered).containsExactlyInAnyOrderElementsOf(declared);
	}

	static List<String> legitimateRows() {
		return List.of(GOOD_LEAGUE, GOOD_LEAGUE_UNCLAIMED, GOOD_ENTRY);
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/**
	 * The same event may be in two leagues at once, and that is the point of the
	 * key being the pair.
	 *
	 * <p>"Sistem mora podneti vise Liga istovremeno", and nothing says a race belongs
	 * to only one of them. A key over `event_id` alone would quietly decide otherwise.
	 */
	@Test
	void oneEventMayEnterTwoLeagues() {
		db.sql(GOOD_LEAGUE).update();

		assertThat(db.sql(entry("(select id from league where slug = 'nova-liga'), " + AN_EVENT)).update())
				.as("an event could not enter a second league")
				.isOne();
	}

	/**
	 * Taking an event out of a league leaves the event and the league standing.
	 *
	 * <p>"Spisak se sme menjati tokom godine" is the whole reason this is its own
	 * table, and this is what says removing a row from it removes only the entry.
	 */
	@Test
	void anEventMayLeaveALeagueDuringTheYear() {
		assertThat(db.sql("delete from league_event where event_id = " + AN_EVENT).update()).isOne();

		assertThat(db.sql("select count(*) from btl_event").query(Long.class).single()).isEqualTo(2L);
		assertThat(db.sql("select count(*) from league").query(Long.class).single()).isOne();
	}

	/**
	 * Deleting the event takes it out of every league it was in, and deleting the
	 * league takes its list with it.
	 */
	@Test
	void deletingEitherSideTakesTheEntryAndNotTheOther() {
		db.sql("delete from btl_event where slug = 'dogadjaj-u-ligi'").update();

		assertThat(db.sql("select count(*) from league_event").query(Long.class).single())
				.as("an entry outlived the event it named")
				.isZero();
		assertThat(db.sql("select count(*) from league").query(Long.class).single())
				.as("deleting an event deleted a league")
				.isOne();

		db.sql(entry(A_LEAGUE + ", " + ANOTHER_EVENT)).update();
		db.sql("delete from league where slug = 'probna-liga'").update();

		assertThat(db.sql("select count(*) from league_event").query(Long.class).single())
				.as("an entry outlived the league it belonged to")
				.isZero();
		assertThat(db.sql("select count(*) from btl_event").query(Long.class).single())
				.as("deleting a league deleted an event")
				.isOne();
	}

	/**
	 * The administrator may have his account deleted, and the league stays without
	 * one.
	 *
	 * <p>PDL P23, and the same shape a team's administrator has in V11.
	 */
	@Test
	void theAdministratorMayGoAndTheLeagueStays() {
		assertThat(db.sql("delete from competitor where member_number = '000980'").update()).isOne();

		assertThat(db.sql("select count(*) from league where admin_id is null").query(Long.class).single())
				.as("the league went with its administrator, or kept pointing at somebody who is gone")
				.isOne();
	}
}
