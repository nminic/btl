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
 * Every constraint the league's two tables carry, with the row that breaks it.
 *
 * <p>A league is an entity and the RunTrace league is a row in it (PDL P15), so
 * what is measured here is the general thing: it has an address, a season, words
 * about what is won in it, and a list of RACES that may change during the year.
 *
 * <p><b>Races, and not events, since V20.</b> V14 tied a league to whole events
 * (`league_event`); the owner asked on 12.09.2026 to be able to take a single
 * distance off a day, V19 built `league_race` beside it and V20 dropped the older
 * table. So the second table measured here is `league_race`, and the constraint
 * that was `league_event_pk` is `league_race_pk`.
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

	/** The league itself, from V14, and the races it counts, from V19. */
	static final List<String> TABLES = List.of("league", "league_race");

	/**
	 * ONE KEY HAS NO ROW THAT BREAKS IT, and it is named rather than left out of the
	 * floor.
	 *
	 * <p>{@code league_season_unique} is over {@code (id, season)} and the id is
	 * already the primary key, so no second row can collide with a first. It exists
	 * for one reason and it is not uniqueness: it is the target the composite key in
	 * {@code league_race} needs, which is how "a league of 2027 counts a race of 2027"
	 * is said in the schema rather than remembered. V7 carries the same shape in
	 * {@code race_day_unique}, and {@code AxisConstraintsTest} names it the same way.
	 */
	private static final Set<String> KEYS_THAT_ONLY_EXIST_AS_A_TARGET = Set.of("league_season_unique");

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String A_MEMBER = "(select id from competitor where member_number = '000980')";
	private static final String A_LEAGUE = "(select id from league where slug = 'probna-liga')";
	private static final String AN_EVENT = "(select id from btl_event where slug = 'dogadjaj-u-ligi')";
	private static final String A_RACE = "(select id from race where name = 'Trka u ligi')";
	private static final String ANOTHER_RACE = "(select id from race where name = 'Druga trka u ligi')";
	private static final String A_RACE_OF_ANOTHER_YEAR = "(select id from race where name = 'Trka druge godine')";
	private static final String ANOTHER_EVENT = "(select id from btl_event where slug = 'drugi-dogadjaj')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender, birth_date,"
			+ " place_id, city, country_id, first_season, first_season_2027, active, membership_basis,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String COLUMNS = "slug, name, season, rules, prizes";

	private static String league(String values) {
		return "insert into league (" + COLUMNS + ") values (" + values + ")";
	}

	private static String counted(String values) {
		return "insert into league_race (league_id, season, race_id) values (" + values + ")";
	}

	/** A league. Nobody runs it: from 12.09.2026 a league has no administrator at all,
	 *  and is edited by the superadmin or by a moderator with the right over leagues. */
	private static final String GOOD_LEAGUE = league("'nova-liga', 'Nova liga', 2028,"
			+ " 'Boduju se sve trke iz kalendara lige.', 'Medalje za prva tri mesta.'");
	/** And one with nobody named to run it, and nothing written about it yet. */
	private static final String GOOD_LEAGUE_UNCLAIMED =
			league("'treca-liga', 'Treca liga', 2029, '', ''");
	/** A second race of the same season counted by the league that already counts one. */
	private static final String GOOD_COUNTED = counted(A_LEAGUE + ", 2027, " + ANOTHER_RACE);

	/**
	 * A member, three events, three races, one league, and one race already counted.
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

		/* A race under each event, because from V19 a league counts races and not days.
		   The second one is a year away on purpose: it is what the composite key is for. */
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
				+ " ascent_m, descent_m) values (" + AN_EVENT + ", 'Trka u ligi', false,"
				+ " date '2027-05-05', 'length', 0, 10.00, 0, 0)").update();
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
				+ " ascent_m, descent_m) values (" + ANOTHER_EVENT + ", 'Druga trka u ligi', false,"
				+ " date '2027-06-06', 'length', 0, 10.00, 0, 0)").update();
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured,"
				+ " description, link, copied_from) values ('dogadjaj-druge-godine',"
				+ " 'Dogadjaj druge godine', date '2028-05-05', " + A_TOWN
				+ ", null, null, 'race', false, '', '', null)").update();
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
				+ " ascent_m, descent_m) values ((select id from btl_event where slug ="
				+ " 'dogadjaj-druge-godine'), 'Trka druge godine', false, date '2028-05-05',"
				+ " 'length', 0, 10.00, 0, 0)").update();

		db.sql(league("'probna-liga', 'Probna liga', 2027, 'Pravila.', 'Nagrade.'")).update();
		db.sql(counted(A_LEAGUE + ", 2027, " + A_RACE)).update();
	}

	static List<Violation> violations() {
		return List.of(
				Violation.notNull("league_id_not_null", "id",
						"insert into league (id, " + COLUMNS + ") values (null, 'nova-liga', 'Nova liga',"
								+ " 2028, '', '')"),
				Violation.of("league_pk",
						"insert into league (id, " + COLUMNS + ") select id, 'nova-liga', 'Nova liga', 2028,"
								+ " '', '' from league limit 1"),

				Violation.notNull("league_slug_not_null", "slug",
						league("null, 'Nova liga', 2028, '', ''")),
				Violation.of("league_slug_unique",
						league("'probna-liga', 'Nova liga', 2028, '', ''")),
				Violation.of("league_slug_shape",
						league("'Nije Slug', 'Nova liga', 2028, '', ''")),

				Violation.notNull("league_name_not_null", "name",
						league("'nova-liga', null, 2028, '', ''")),
				Violation.of("league_name_not_blank",
						league("'nova-liga', '   ', 2028, '', ''")),

				Violation.notNull("league_season_not_null", "season",
						league("'nova-liga', 'Nova liga', null, '', ''")),
				Violation.of("league_season_not_before_the_league",
						league("'nova-liga', 'Nova liga', 2026, '', ''")),

				/* What a league is about and what is won in it: always there, and empty is a
				   legitimate value. The portal keeps the words and makes no rule out of them. */
				Violation.notNull("league_rules_not_null", "rules",
						league("'nova-liga', 'Nova liga', 2028, null, ''")),
				Violation.notNull("league_prizes_not_null", "prizes",
						league("'nova-liga', 'Nova liga', 2028, '', null")),

				/* WHICH RACES ARE COUNTED, V19. The pair is the key, so a race is counted by a
				   league once: adding it twice is not a second fact. And the season is
				   carried in the row so that both foreign keys can be composite: a row naming
				   a league of one year and a race of another satisfies neither. */
				Violation.notNull("league_race_league_id_not_null", "league_id",
						counted("null, 2027, " + A_RACE)),
				Violation.notNull("league_race_season_not_null", "season",
						counted(A_LEAGUE + ", null, " + A_RACE)),
				Violation.notNull("league_race_race_id_not_null", "race_id",
						counted(A_LEAGUE + ", 2027, null")),
				Violation.of("league_race_pk", counted(A_LEAGUE + ", 2027, " + A_RACE)),
				Violation.of("league_race_league_fk", counted("999999, 2027, " + A_RACE)),
				Violation.of("league_race_race_fk", counted(A_LEAGUE + ", 2027, 999999")));
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
		declared = new java.util.ArrayList<>(declared);

		Set<String> covered = violations().stream().map(Violation::constraint).collect(Collectors.toSet());

		assertThat(declared).isNotEmpty();
		assertThat(declared)
				.as("a key named as existing only to be a target is no longer in the schema,"
						+ " so naming it here hides nothing")
				.containsAll(KEYS_THAT_ONLY_EXIST_AS_A_TARGET);

		declared.removeAll(KEYS_THAT_ONLY_EXIST_AS_A_TARGET);
		assertThat(covered).containsExactlyInAnyOrderElementsOf(declared);
	}

	static List<String> legitimateRows() {
		return List.of(GOOD_LEAGUE, GOOD_LEAGUE_UNCLAIMED, GOOD_COUNTED);
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/**
	 * A LEAGUE OF ONE SEASON CANNOT COUNT A RACE OF ANOTHER, and the database is what
	 * says so.
	 *
	 * <p>Owner, 12.09.2026: a league of 2027 takes only events of 2027. A CHECK cannot
	 * say that, because it would have to read two other tables, so the season is carried
	 * in the row and both foreign keys are composite: `(league_id, season)` against the
	 * league and `(race_id, season)` against the race. A row naming a league of one year
	 * and a race of another satisfies neither, whichever way round it is written.
	 *
	 * <p>Both ways round are measured, because they fail through different keys: the
	 * season of the league with the race of another year, and the season of the race
	 * with the league of another year.
	 */
	@Test
	void aLeagueOfOneSeasonCannotCountARaceOfAnother() {
		assertThatThrownBy(() ->
				db.sql(counted(A_LEAGUE + ", 2027, " + A_RACE_OF_ANOTHER_YEAR)).update())
				.as("a league of 2027 counted a race of 2028")
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	/**
	 * And the other way round, which fails through the other key.
	 *
	 * <p>Its own case rather than a second assertion beside the first: a failed
	 * statement aborts the transaction, so everything after it in the same test comes
	 * back as "current transaction is aborted" instead of as the constraint that was
	 * being measured. Measured 12.09.2026, and it read like the row being accepted.
	 */
	@Test
	void namingTheRacesYearDoesNotLetTheLeagueOfAnotherYearCountIt() {
		assertThatThrownBy(() ->
				db.sql(counted(A_LEAGUE + ", 2028, " + A_RACE_OF_ANOTHER_YEAR)).update())
				.as("the row named the race's year, and the league of 2027 took it anyway")
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	/**
	 * The same race may be counted by two leagues of its season.
	 *
	 * <p>Owner, 12.09.2026, asked as its own question and answered „moze". A key over
	 * the race alone would have decided otherwise without anybody noticing.
	 */
	@Test
	void oneRaceMayBeCountedByTwoLeagues() {
		db.sql(league("'druga-liga', 'Druga liga', 2027, '', ''")).update();

		assertThat(db.sql(counted("(select id from league where slug = 'druga-liga'), 2027, "
				+ A_RACE)).update())
				.as("the second league could not count a race the first one counts")
				.isOne();
	}

	/**
	 * Taking a race out of a league leaves the race and the league standing.
	 *
	 * <p>"Spisak se sme menjati tokom godine" is the whole reason this is its own
	 * table, and the owner said the same thing again on 12.09.2026 about races:
	 * "Izbacivanje trke iz lige preuračunava tabelu... rezultat ostaje na profilu
	 * člana". This is what says removing a row from here removes only the entry.
	 *
	 * <p>Carried over from the case that said it about `league_event`, which V20
	 * dropped: the sentence is about the list changing during the year, and the list
	 * is now races.
	 */
	@Test
	void aRaceMayLeaveALeagueDuringTheYear() {
		assertThat(db.sql("delete from league_race where race_id = " + A_RACE).update()).isOne();

		/* Named rather than counted: a count over the whole table says as much about how
		   many rows the fixture happens to write as about what was deleted, and it breaks
		   the day another row is added for another reason. */
		assertThat(db.sql("select count(*) from race where name = 'Trka u ligi'")
				.query(Long.class).single())
				.as("taking the race out of the league deleted the race")
				.isOne();
		assertThat(db.sql("select count(*) from league where slug = 'probna-liga'")
				.query(Long.class).single())
				.as("taking the race out of the league deleted the league")
				.isOne();
	}

	/**
	 * Deleting the race takes it out of every league that counted it, and deleting
	 * the league takes its list with it.
	 *
	 * <p>Both directions, because they are two different foreign keys and a cascade
	 * written on one of them says nothing about the other. The second half deletes
	 * the EVENT rather than the race, which is the longer way round on purpose: a
	 * race goes with its event (V7), and what is measured is that the entry does not
	 * outlive it through that chain either.
	 */
	@Test
	void deletingEitherSideTakesTheCountedRaceAndNotTheOther() {
		db.sql("delete from race where name = 'Trka u ligi'").update();

		assertThat(db.sql("select count(*) from league_race").query(Long.class).single())
				.as("a counted race outlived the race it named")
				.isZero();
		assertThat(db.sql("select count(*) from league where slug = 'probna-liga'")
				.query(Long.class).single())
				.as("deleting a race deleted a league")
				.isOne();

		db.sql(GOOD_COUNTED).update();
		db.sql("delete from league where slug = 'probna-liga'").update();

		assertThat(db.sql("select count(*) from league_race").query(Long.class).single())
				.as("a counted race outlived the league that counted it")
				.isZero();
		assertThat(db.sql("select count(*) from race where name = 'Druga trka u ligi'")
				.query(Long.class).single())
				.as("deleting a league deleted a race")
				.isOne();
	}

	/**
	 * And deleting the EVENT takes the counted race with it, through the race.
	 *
	 * <p>Its own case rather than a third assertion above, for the same reason the
	 * two season cases are separate: a failed or cascaded statement is easier to read
	 * about when one statement is what the case is about. A day taken out of the
	 * calendar takes its distances, and the leagues counting them stop counting them
	 * (V7's `race_event_fk`, then V19's `league_race_race_fk`).
	 */
	@Test
	void deletingTheEventStopsEveryLeagueCountingItsRaces() {
		db.sql("delete from btl_event where slug = 'dogadjaj-u-ligi'").update();

		assertThat(db.sql("select count(*) from league_race").query(Long.class).single())
				.as("a counted race outlived the event its race belonged to")
				.isZero();
		assertThat(db.sql("select count(*) from league where slug = 'probna-liga'")
				.query(Long.class).single())
				.as("deleting an event deleted a league")
				.isOne();
	}

}
