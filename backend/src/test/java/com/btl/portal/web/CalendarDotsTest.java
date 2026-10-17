package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE DOTS A RACE CARRIES IN THE CALENDAR, asked of {@code /api/races} against a real database.
 *
 * <p>The decision is the owner's of 16.10.2026 (PDL, „Ispravke sa ekrana 16.10.2026"): „vodi se
 * da je ultramaraton po defaultu jer nema ograničenja, ali čim počnu da pristižu rezultati, oni
 * diktiraju koje će tačke ostati u sistemu", and, chosen the same day among the outcomes
 * offered, the ultra goes away when no result is an ultra. Rule: {@code CalendarApi.DOTS}.
 *
 * <p><b>Every value a case reads could come from somewhere else, and the fixture parts the two
 * every time:</b>
 * <ul>
 * <li><b>the race or its results.</b> A timed race carries nought and its own category says
 * „short", so no result here is short: a server that read the race's category would answer
 * „short" and no case expects it. And the race over a length has a result at ANOTHER length,
 * so reading results there is seen too;</li>
 * <li><b>this race or a sibling.</b> All four timed races stand in one event, each with a
 * different answer, so results joined by the event rather than by the race give every one of
 * them the union;</li>
 * <li><b>approved or waiting.</b> Two submissions still wait, each at a length its race has
 * not got among its results, so counting them changes both answers;</li>
 * <li><b>once or twice.</b> One race has two results at one length, so a dot per result rather
 * than per length is seen.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class CalendarDotsTest {

	/** Every literal in a rule, which is what an enumerated rule is made of. */
	private static final Pattern SPELLED_OUT = Pattern.compile("'([^']*)'");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final Map<String, Long> races = new HashMap<>();

	@BeforeEach
	void aCalendarOfEveryKindOfRace() {
		event("vremenska");
		event("duzinska");

		long first = competitor("990901", "c0ffee0000000901");
		long second = competitor("990902", "c0ffee0000000902");

		/* Timed, nobody has a result yet. One submission waits, at a half marathon. */
		long nothingYet = race("nothingYet", "vremenska", "time", 86_400, "0");
		submission(first, nothingYet, "21.10");

		/* Timed, one result, and it is not an ultra. Written twice, by two members. */
		long oneShorter = race("oneShorter", "vremenska", "time", 21_600, "0");
		result(first, oneShorter, "21.10");
		result(second, oneShorter, "21.10");

		/* Timed, an ultra beside a shorter one. */
		long ultraAndShorter = race("ultraAndShorter", "vremenska", "time", 43_200, "0");
		result(first, ultraAndShorter, "100.00");
		result(second, ultraAndShorter, "42.20");

		/* Timed, every result shorter than an ultra, and an ultra still waiting. */
		long allShorter = race("allShorter", "vremenska", "time", 7_200, "0");
		result(first, allShorter, "30.00");
		result(second, allShorter, "21.10");
		submission(first, allShorter, "100.00");

		/* A race over a length, half a marathon, with a result written at another length. */
		long length = race("length", "duzinska", "length", 0, "21.10");
		result(first, length, "42.20");

		/* A free race, with a result. */
		long free = race("free", "duzinska", "free", 0, "0");
		result(first, free, "30.00");

		races.putAll(Map.of("nothingYet", nothingYet, "oneShorter", oneShorter,
				"ultraAndShorter", ultraAndShorter, "allShorter", allShorter, "length", length,
				"free", free));
	}

	@Test
	void aTimedRaceWithNoResultIsAnUltraAndAWaitingSubmissionDoesNotCount() throws Exception {
		assertThat(dotsOf("nothingYet")).containsExactly("ultra");
	}

	@Test
	void aTimedRaceWithOneShorterResultCarriesThatLengthAndNoUltra() throws Exception {
		assertThat(dotsOf("oneShorter")).containsExactly("half");
	}

	@Test
	void aTimedRaceWithAnUltraAndAShorterResultCarriesBoth() throws Exception {
		assertThat(dotsOf("ultraAndShorter")).containsExactlyInAnyOrder("marathon", "ultra");
	}

	@Test
	void aTimedRaceWhoseResultsAreAllShorterLosesTheUltra() throws Exception {
		/* The decision chosen on 16.10.2026: „tačka ultramaratona nestaje ako nijedan rezultat
		   nije ultramaratonski". The ultra that waits is not a result yet. */
		assertThat(dotsOf("allShorter")).containsExactlyInAnyOrder("half", "long");
	}

	@Test
	void aRaceOverALengthCarriesItsOwnLengthAndNotItsResults() throws Exception {
		assertThat(dotsOf("length")).containsExactly("half");
	}

	@Test
	void aFreeRaceCarriesTheDotWithoutASetLengthWhateverItsResults() throws Exception {
		assertThat(dotsOf("free")).containsExactly("unmeasured");
	}

	/**
	 * AND EVERY KIND THE SCHEMA ALLOWS GETS AT LEAST ONE DOT.
	 *
	 * <p>The rule names the three kinds one by one and has no {@code else}, so a fourth kind
	 * added to {@code race_kind_known} comes out of it as nothing. The kinds come off the rule
	 * in the schema, so that kind is either given a dot or this fails and somebody says what
	 * the calendar should draw for it.
	 */
	@Test
	void everyKindTheSchemaAllowsCarriesADot() throws Exception {
		List<String> kinds = kindsAllowedBy("race_kind_known");

		for (String kind : kinds) {
			race("ofKind-" + kind, "duzinska", kind, kind.equals("time") ? 3_600 : 0,
					kind.equals("length") ? "10.00" : "0");
		}

		for (JsonNode race : answer()) {
			assertThat(race.path("dots").isArray() && !race.path("dots").isEmpty())
					.as("the race %s of kind %s came back with no dot", race.path("name").asString(),
							race.path("kind").asString())
					.isTrue();
		}
	}

	private List<String> dotsOf(String name) throws Exception {
		long id = races.get(name);
		List<String> dots = new ArrayList<>();

		for (JsonNode race : answer()) {
			if (race.path("id").asLong() == id) {
				race.path("dots").forEach(one -> dots.add(one.asString()));
				return dots;
			}
		}

		throw new AssertionError("the race " + name + " is not in the calendar at all");
	}

	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(
				http.perform(get("/api/races")).andReturn().getResponse().getContentAsString());
	}

	private void event(String slug) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link) values (?, ?, date '2027-06-05',"
						+ " (select id from place where rank = 1), null, null, 'race', false, '', '')")
				.params(slug, "Događaj " + slug).update();
	}

	private long race(String name, String eventSlug, String kind, int limit, String km) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, true,"
						+ " date '2027-06-05', ?, ?, cast(? as numeric), 0, 0) returning id")
				.params(eventSlug, name, kind, limit, km).query(Long.class).single();
	}

	/** The statement {@code RaceWriteApiTest} writes a member with, column for column. */
	private long competitor(String number, String referral) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Trkac', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment', ?, '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.params(number, referral).query(Long.class).single();
	}

	/** An approved run, which is what a row of {@code result} is. */
	private void result(long competitor, long race, String km) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points)"
						+ " select ?, id, date, cast(? as numeric), 0, 0, 3600, 1 from race where id = ?")
				.params(competitor, km, race).update();
	}

	/** A run a member has sent and nobody has decided yet: the submission and its place in the queue. */
	private void submission(long competitor, long race, String km) {
		long sent = db.sql("insert into result_submission (competitor_id, race_id, race_date,"
						+ " distance_km, ascent_m, descent_m, seconds, link, comment)"
						+ " select ?, id, date, cast(? as numeric), 0, 0, 3600,"
						+ " 'https://primer.rs/rezultati', '' from race where id = ? returning id")
				.params(competitor, km, race).query(Long.class).single();

		db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " result_submission_id) values ('results', ?, 'Rezultat', '', ?)")
				.params(competitor, sent).update();
	}

	/** The kinds a named rule of the schema allows, in the schema's own words ({@code CalendarApiTest}). */
	private List<String> kindsAllowedBy(String constraint) {
		String rule = db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and con.conname = ?")
				.param(constraint).query(String.class).single();

		List<String> allowed = new ArrayList<>();
		Matcher spelled = SPELLED_OUT.matcher(rule);

		while (spelled.find()) {
			allowed.add(spelled.group(1));
		}

		assertThat(allowed)
				.as("%s no longer spells out what it allows (%s), so nothing here is swept",
						constraint, rule)
				.hasSizeGreaterThan(1);
		return allowed;
	}
}
