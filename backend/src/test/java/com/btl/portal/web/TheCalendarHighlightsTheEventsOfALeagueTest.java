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

import java.util.Map;
import java.util.TreeMap;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE CALENDAR HIGHLIGHTS AN EVENT BY ITS OWN CHOICE OR BY A LEAGUE THAT HIGHLIGHTS ITS EVENTS, and serves the
 * two apart (owner, PDL 24.11.2026, „Istakni događaje").
 *
 * <p>„Ukoliko je to štiklirano, svi događaji te lige automatski dobijaju istaknutost u kalendaru. Ako ih izbacim
 * iz lige, istaknutost se gubi." With the two choices he made the same day: „Ručno „Istaknuto: Da” na događaju je
 * zaseban izbor i ostaje kad se događaj izbaci iz lige" and „Polje „Istaknuto” na formi događaja se ne menja:
 * pokazuje samo ručni izbor". So {@code featured} is served as the event's own choice and {@code highlighted} as
 * what the calendar draws, and this file holds the two apart on every axis where they could be one value.
 *
 * <p><b>THE AXES, EACH WITH BOTH STATES, one event per cell</b> ({@code CLAUDE.md}, „ose se prebrajaju"):
 *
 * <ul>
 * <li><b>the league</b>: {@code istaknuta} ticks the box and {@code obicna} does not, both of 2027;
 * <li><b>the event's own choice</b>: „Da" on {@code rucno-samo} and {@code rucno-izbacen}, „Ne" on the rest;
 * <li><b>a race in the league against a race taken out of it</b>: {@code izbacen} and {@code rucno-izbacen} had
 *     their race counted by the highlighting league and taken out, which is what „Ako ih izbacim iz lige" does;
 * <li><b>two races of one event, one of them counted</b>: {@code pola-u-ligi}, counted by its SECOND race, so an
 *     answer that asked only the first race of an event fails;
 * <li><b>two leagues</b>: {@code u-obe} counted by both, {@code samo-obicna} by the plain one alone, which is the
 *     cell an answer asking „any league" instead of „a highlighting league" gets wrong;
 * <li><b>an event with no race at all</b>: {@code bez-trka}, the cell an answer that forgot which event it was
 *     asking about gets wrong.
 * </ul>
 *
 * <p>And none of the highlighted events is the first of the calendar, and the highlighting league is neither the
 * only league nor the first written, so „the first" and „this one" are never the same answer.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TheCalendarHighlightsTheEventsOfALeagueTest {

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@BeforeEach
	void twoLeaguesAndEightEvents() {
		long plain = league("obicna-2027", false);
		long highlighting = league("istaknuta-2027", true);

		event("bez-trka", "2027-02-01", false);

		long inIt = event("u-ligi", "2027-03-01", false);
		count(highlighting, race(inIt, "2027-03-01"));

		long half = event("pola-u-ligi", "2027-04-01", false);
		race(half, "2027-04-01");
		count(highlighting, race(half, "2027-04-02"));

		long both = event("u-obe", "2027-05-01", false);
		long ofBoth = race(both, "2027-05-01");
		count(plain, ofBoth);
		count(highlighting, ofBoth);

		long plainOnly = event("samo-obicna", "2027-06-01", false);
		count(plain, race(plainOnly, "2027-06-01"));

		long out = event("izbacen", "2027-07-01", false);
		long itsRace = race(out, "2027-07-01");
		count(highlighting, itsRace);
		takenOut(highlighting, itsRace);

		long byHand = event("rucno-samo", "2027-08-01", true);
		race(byHand, "2027-08-01");

		long byHandOut = event("rucno-izbacen", "2027-09-01", true);
		long byHandRace = race(byHandOut, "2027-09-01");
		count(highlighting, byHandRace);
		takenOut(highlighting, byHandRace);
	}

	/**
	 * EVERY CELL, AS {@code featured | highlighted}.
	 *
	 * <p>Read as one map rather than as eight assertions, so that the case cannot pass on the cells it happened to
	 * look at: a calendar drawing highlighted from {@code featured} alone gets {@code u-ligi}, {@code pola-u-ligi}
	 * and {@code u-obe} wrong, one asking any league gets {@code samo-obicna} wrong, one that forgot the event gets
	 * {@code bez-trka} wrong, and one that never let go of a race taken out gets {@code izbacen} wrong.
	 */
	@Test
	void anEventIsHighlightedByItsOwnChoiceOrByAHighlightingLeagueThatCountsOneOfItsRaces() throws Exception {
		assertThat(theCells()).containsExactlyEntriesOf(new TreeMap<>(Map.of(
				"bez-trka", "false | false",
				"u-ligi", "false | true",
				"pola-u-ligi", "false | true",
				"u-obe", "false | true",
				"samo-obicna", "false | false",
				"izbacen", "false | false",
				"rucno-samo", "true | true",
				"rucno-izbacen", "true | true")));
	}

	/**
	 * UNTICKING THE BOX ENDS THE HIGHLIGHT OF EVERY EVENT OF THE LEAGUE, AND LEAVES THE ONE CHOSEN BY HAND.
	 *
	 * <p>Nothing was written onto any event when the box was ticked, so nothing has to be undone when it is
	 * unticked; this is the plan's „bez prepisivanja na događaj" measured from the other side. And the event's own
	 * choice is not a copy of the league's: {@code featured} reads the same before and after.
	 */
	@Test
	void untickingTheBoxEndsTheHighlightOfTheLeaguesEventsAndLeavesTheOnesChosenByHand() throws Exception {
		db.sql("update league set highlights_events = false where slug = 'istaknuta-2027'").update();

		assertThat(theCells()).containsExactlyEntriesOf(new TreeMap<>(Map.of(
				"bez-trka", "false | false",
				"u-ligi", "false | false",
				"pola-u-ligi", "false | false",
				"u-obe", "false | false",
				"samo-obicna", "false | false",
				"izbacen", "false | false",
				"rucno-samo", "true | true",
				"rucno-izbacen", "true | true")));
	}

	/**
	 * AND DELETING THE LEAGUE ENDS IT TOO, by the cascade that takes its {@code league_race} rows: there is no
	 * highlight left behind on an event of a league that is gone.
	 */
	@Test
	void deletingTheLeagueEndsTheHighlightOfItsEvents() throws Exception {
		db.sql("delete from league where slug = 'istaknuta-2027'").update();

		assertThat(theCells()).containsEntry("u-ligi", "false | false")
				.containsEntry("pola-u-ligi", "false | false")
				.containsEntry("u-obe", "false | false")
				.containsEntry("rucno-izbacen", "true | true");
	}

	private Map<String, String> theCells() throws Exception {
		JsonNode events = new ObjectMapper().readTree(
				http.perform(get("/api/events")).andReturn().getResponse().getContentAsString());
		Map<String, String> cells = new TreeMap<>();

		StreamSupport.stream(events.spliterator(), false)
				.forEach(one -> cells.put(one.path("slug").asString(),
						one.path("featured").asBoolean() + " | " + one.path("highlighted").asBoolean()));

		return cells;
	}

	private long league(String slug, boolean highlights) {
		return db.sql("insert into league (slug, name, season, rules, prizes, highlights_events)"
						+ " values (?, ?, 2027, '', '', ?) returning id")
				.params(slug, "Liga " + slug, highlights).query(Long.class).single();
	}

	private long event(String slug, String day, boolean featured) {
		return db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link) values (?, ?, date '" + day + "',"
						+ " (select id from place where rank = 1), null, null, 'race', ?, '', '') returning id")
				.params(slug, "Dogadjaj " + slug, featured).query(Long.class).single();
	}

	private long race(long event, String day) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m) values (?, ?, false, date '" + day
						+ "', 'length', 0, 10.00, 0, 0) returning id")
				.params(event, "Trka " + day).query(Long.class).single();
	}

	private void count(long league, long race) {
		db.sql("insert into league_race (league_id, season, race_id) values (?, 2027, ?)")
				.params(league, race).update();
	}

	private void takenOut(long league, long race) {
		db.sql("delete from league_race where league_id = ? and race_id = ?").params(league, race).update();
	}
}
