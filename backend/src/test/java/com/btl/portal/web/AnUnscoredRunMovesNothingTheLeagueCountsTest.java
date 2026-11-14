package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.season.SeasonClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * A RUN OF AN UNSCORED RACE MOVES NOTHING THE LEAGUE COUNTS, and this is the guard of that sentence over
 * every count the server makes.
 *
 * <p>PDL, 14.11.2026, „Ostale discipline kao lična evidencija", derived in the record from the decision that
 * the running leg of a triathlon is no longer scored: „Rezultat ostale discipline nema bodove i ne ulazi ni u
 * šta što liga računa (tabele, rang liste, kategorije, zbir tima i para, dukati, bedž sa brojem trka, Top
 * liste, Zagrevanje)". The technique beside it (my reasoning, in PDL): „svi brojači na serveru čitaju iz
 * jednog mesta koje pita vrstu događaja".
 *
 * <p><b>It asks behaviour and not the text of a query.</b> One member holds a scored run and an unscored
 * one in the same season; every answer the league's counting gives is taken once with the unscored run
 * standing and once with it gone, and the two must be the same. Nothing here repeats the condition the
 * server counts by (the kind of the event), so a count that forgets to ask it differs, and one written
 * tomorrow differs the same way the day it is added to {@link Everything}.
 *
 * <p><b>Two sources of one zero are kept apart.</b> A run at an unscored race is written with no points
 * ({@link PointsOfARun}), so a count of POINTS that read the whole table would still add nothing and pass.
 * The run here is written straight into the table with five hundred points, so what is measured is the
 * count leaving the run out, and the writes keeping it at zero are measured by their own cases
 * ({@code ResultsByTheLeagueApiTest}, {@code VerificationWriteApiTest},
 * {@code ARaceCorrectedRecountsItsRunsTest}).
 *
 * <p><b>And the run is big enough to move every count, which is measured too</b>: the same row with its event
 * turned into a scored race must change every one of the answers below. Otherwise a component that came out
 * equal would say nothing (a hundred and thirty kilometres in one month is over the monthly ducat, the
 * points close the beginners' category, and so on).
 *
 * <p><b>Each answer is taken inside a savepoint that is rolled back</b>, because the freeze and the ducats
 * write, and a second freeze over a season frozen already writes nothing. The keys a rolled back write took
 * from a sequence are not given back, so the frozen tables are compared without their own keys and without
 * the keys that point at them.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AnUnscoredRunMovesNothingTheLeagueCountsTest {

	private static final String ANA = "000501";

	private static final String BOJAN = "000502";

	private static final String VERA = "000503";

	/** The night of the ducats, inside 2027 and after the run. */
	private static final Instant THE_NIGHT_OF_THE_DUCATS = Instant.parse("2027-12-31T10:00:00Z");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private BestOfficialSeason best;

	@Autowired
	private CategoryOfASeason categories;

	@Autowired
	private TheTablesOfASeason tables;

	@Autowired
	private TransactionTemplate transactions;

	private long ana;

	private long theSwim;

	private long theSwimsEvent;

	@BeforeEach
	void aSeasonWithOneScoredAndOneUnscoredRunOfOneMember() {
		ana = member(ANA, "Ana", "Prva", "F", "1990-05-05");
		member(BOJAN, "Bojan", "Drugi", "M", "1985-05-05");
		member(VERA, "Vera", "Treca", "F", "1960-05-05");

		for (String number : List.of(ANA, BOJAN, VERA)) {
			db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
							+ " values ((select id from competitor where member_number = ?), 2027, 'feeExempt',"
							+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
					.param(number).update();
		}

		/* SHE WANTS THE BEGINNERS' CATEGORY IN 2028, which her eight points of 2027 leave open to her and
		   five hundred more would close. */
		db.sql("insert into category_wish (competitor_id, season, beginner) values (?, 2028, true)").param(ana)
				.update();

		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id, first_season,"
				+ " admin_id) values ('tim-a', 'Tim A', '', '', (select id from place where rank = 1), null, null,"
				+ " null, 2027, null)").update();
		for (String number : List.of(ANA, BOJAN)) {
			db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to, left_reason)"
					+ " values ((select id from competitor where member_number = ?),"
					+ " (select id from team where slug = 'tim-a'), 2027, null, null)").param(number).update();
		}
		db.sql("insert into racing_pair (season, man_id, woman_id) values (2027,"
						+ " (select id from competitor where member_number = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(BOJAN, ANA).update();

		long spring = event("prolece-2027", "Prolece", "2027-04-04", "race", "RS");
		long theLoop = race(spring, "Krug", "2027-04-04", "length", 10);

		db.sql("insert into league (slug, name, season, rules, prizes) values ('liga-2027', 'Liga', 2027, '', '')")
				.update();
		db.sql("insert into league_race (league_id, season, race_id)"
				+ " values ((select id from league where slug = 'liga-2027'), 2027, ?)").param(theLoop).update();

		run(ANA, theLoop, "10", 0, 0, 3000, "8.00");
		run(BOJAN, theLoop, "10", 0, 0, 2700, "25.00");
		run(VERA, theLoop, "10", 0, 0, 3300, "12.00");

		/* THE UNSCORED RUN: in another month and another country, long, steep and slow, with points it would
		   never be written with (see the note on this class). */
		theSwimsEvent = event("plivanje-2027", "Plivanje", "2027-06-06", "unscored", "HR");
		theSwim = race(theSwimsEvent, "Preplivavanje", "2027-06-06", "free", 0);

		run(ANA, theSwim, "130", 900, 900, 75600, "500.00");
	}

	@Test
	void everyCountTheLeagueMakesIsTheSameWithTheUnscoredRunAndWithoutIt() throws Exception {
		Everything with = inASavepoint(this::everything);
		Everything without = inASavepoint(() -> {
			db.sql("delete from result where race_id = ?").param(theSwim).update();

			return everything();
		});

		for (Answer one : Answer.values()) {
			assertThat(one.of.apply(with))
					.as("%s moved with a run of an unscored race", one)
					.isEqualTo(one.of.apply(without));
		}
	}

	@Test
	void andTheSameRunAtAScoredRaceMovesEveryOneOfThem() throws Exception {
		Everything without = inASavepoint(() -> {
			db.sql("delete from result where race_id = ?").param(theSwim).update();

			return everything();
		});
		Everything scored = inASavepoint(() -> {
			db.sql("update btl_event set kind = 'race' where id = ?").param(theSwimsEvent).update();

			return everything();
		});

		for (Answer one : Answer.values()) {
			assertThat(one.of.apply(scored))
					.as("%s did not move even when the run was scored, so the case above says nothing of it", one)
					.isNotEqualTo(one.of.apply(without));
		}
	}

	/** Every answer of the league's counting this guard compares, each named for the failure message. */
	private enum Answer {
		THE_TOTALS_OF_EVERY_SEASON_AS_THEY_STAND(Everything::live),
		THE_TOTALS_THE_CATEGORIES_ARE_READ_FROM(Everything::totals),
		THE_BEST_SEASON_BEFORE_2028_THAT_CLOSES_THE_BEGINNERS_CATEGORY(Everything::best),
		THE_CATEGORY_OF_2028(Everything::category),
		WHAT_API_RESULTS_SERVES(Everything::results),
		THE_DUCATS_RECONCILED(Everything::ducats),
		THE_CATALOGUE_OF_DUCATS_WON(Everything::catalogue),
		EVERY_TABLE_OF_THE_FROZEN_SEASON(Everything::frozen);

		private final Function<Everything, Object> of;

		Answer(Function<Everything, Object> of) {
			this.of = of;
		}
	}

	private record Everything(Map<Long, Map<Integer, BigDecimal>> live, Map<Long, Map<Integer, BigDecimal>> totals,
			BigDecimal best, CategoryOfASeason.OfASeason category, String results, List<String> ducats,
			String catalogue, List<String> frozen) {
	}

	/** Every answer, in the order the server would give them: the live ones first, the freeze last. */
	private Everything everything() throws Exception {
		Map<Long, Map<Integer, BigDecimal>> live = best.live(null);
		Map<Long, Map<Integer, BigDecimal>> totals = best.totals(null);
		BigDecimal bestBefore2028 = best.pointsFor(ana, 2028);
		CategoryOfASeason.OfASeason category = categories.everybody().in(ana, 1990, 2028);
		String results = served("/api/results");

		new AwardingDucats(db, Clock.fixed(THE_NIGHT_OF_THE_DUCATS, ZoneOffset.UTC), transactions).reconcile(ana);

		List<String> ducats = db.sql("select d.code || ' ' || a.threshold || ' ' || coalesce(a.season, 0) || ' '"
						+ " || coalesce(a.month, 0) || ' ' || a.reached || ' ' || coalesce(a.result_id, 0)"
						+ " from ducat_award a join ducat d on d.id = a.ducat_id where a.competitor_id = ? order by 1")
				.param(ana).query(String.class).list();
		String catalogue = served("/api/ducat-awards/" + ANA);

		freezeAt(2028, 1, 1, 16, 0);

		return new Everything(live, totals, bestBefore2028, category, results, ducats, catalogue, frozenTables());
	}

	/**
	 * EVERY ROW OF EVERY TABLE A FREEZE WRITES, as text: each table whose name begins with {@code season_},
	 * read off the catalogue rather than listed here, less the table's own key and every key that points at
	 * another of them (see the note on this class).
	 */
	private List<String> frozenTables() {
		List<String> rows = new ArrayList<>();

		for (String table : db.sql("select tablename from pg_tables where schemaname = current_schema()"
				+ " and tablename like 'season\\_%' order by tablename").query(String.class).list()) {
			List<String> keys = db.sql("select a.attname from pg_attribute a"
							+ " where a.attrelid = cast(? as regclass) and a.attnum > 0 and not a.attisdropped"
							+ " and (a.attname = 'id' or exists (select 1 from pg_constraint c"
							+ " where c.conrelid = a.attrelid and c.contype = 'f' and a.attnum = any (c.conkey)"
							+ " and c.confrelid::regclass::text like 'season\\_%'))")
					.param(table).query(String.class).list();

			db.sql("select (to_jsonb(t) - cast(? as text[]))::text from " + table + " t order by 1")
					.param("{" + String.join(",", keys) + "}")
					.query(String.class)
					.list()
					.forEach(row -> rows.add(table + " " + row));
		}

		assertThat(rows).as("the freeze wrote nothing, so the tables compare nothing").isNotEmpty();

		return rows;
	}

	private String served(String path) throws Exception {
		return http.perform(get(path)).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
	}

	private interface Measured<T> {
		T get() throws Exception;
	}

	private <T> T inASavepoint(Measured<T> measured) throws Exception {
		db.sql("savepoint measuring").update();

		try {
			return measured.get();
		} finally {
			db.sql("rollback to savepoint measuring").update();
		}
	}

	private void freezeAt(int year, int month, int day, int hour, int minute) {
		Instant at = LocalDateTime.of(year, month, day, hour, minute).atZone(SeasonClock.ZONE).toInstant();

		new ASeasonFreezes(db, Clock.fixed(at, ZoneOffset.UTC), transactions, best, tables, nobodyFollows()).freeze();
	}

	private static ObjectProvider<WhatFollowsTheFreeze> nobodyFollows() {
		return new ObjectProvider<>() {
			@Override
			public Stream<WhatFollowsTheFreeze> orderedStream() {
				return Stream.empty();
			}
		};
	}

	private long member(String number, String first, String last, String gender, String born) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, cast(? as date),"
						+ " (select id from place where rank = 1), null, null, 2027,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, first, last, gender, born, "0011223344" + number).query(Long.class).single();
	}

	private long event(String slug, String name, String day, String kind, String country) {
		return db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, cast(? as date), null, 'Grad', (select id from country where code = ?),"
						+ " ?, false, '', '') returning id")
				.params(slug, name, day, country, kind).query(Long.class).single();
	}

	private long race(long event, String name, String day, String kind, double kilometers) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values (?, ?, false, cast(? as date), ?, 0, ?, 0, 0) returning id")
				.params(event, name, day, kind, kilometers).query(Long.class).single();
	}

	private void run(String member, long race, String kilometers, int ascent, int descent, int seconds,
			String points) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m, seconds,"
						+ " points) select (select id from competitor where member_number = ?), id, date,"
						+ " cast(? as numeric), ?, ?, ?, cast(? as numeric) from race where id = ?")
				.params(member, kilometers, ascent, descent, seconds, points, race).update();
	}
}
