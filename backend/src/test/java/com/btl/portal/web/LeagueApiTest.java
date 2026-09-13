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

import java.util.List;
import java.util.Set;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** The leagues, against a real database and against the file the portal serves. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class LeagueApiTest {


	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/**
	 * THREE LEAGUES, SIX EVENTS AND NINE RACES, and every ordering that is asserted
	 * below disagrees with every ordering that could be mistaken for it.
	 *
	 * <p><b>The leagues.</b> Written middle, oldest, newest, so the key ascending,
	 * the key descending and the season are three different lists and only one of
	 * them is the answer. Two were not enough and the mutations said so: written
	 * newest first, the key descending IS season order.
	 *
	 * <p><b>The races of the league under test.</b> Five of them count, written in
	 * an order that is none of: the order they are run, the order of their keys, or
	 * the order the rows of {@code league_race} were written. Three separate lists,
	 * so a query sorted by any of the wrong ones fails.
	 *
	 * <p><b>And the day of a race is NOT the day of its event.</b> One event may run
	 * over more than one morning (V7), so {@code srednji} is written on the second of
	 * June and runs one race that morning and another on the fourth, while
	 * {@code preklapa} is a whole event on the third. The calendar therefore runs the
	 * races in an order the events do not: sorting the races by their EVENT'S day
	 * puts {@code srednji}'s second race before {@code preklapa}'s, and that is
	 * exactly the confusion this fixture exists to refuse.
	 *
	 * <p><b>The event that counts with one of its three races</b> is {@code prvi},
	 * and it is the whole point of B40: the owner asked to be able to pick a single
	 * distance off a day, and the day must still appear on the league's list. Three
	 * races under it, one counted - and the counted one is written SECOND of the
	 * three, so "the race this league counts" and "the first race of that event"
	 * are not the same number. Written first, an answer reading the event's races
	 * and taking one would have passed.
	 *
	 * <p><b>What must not be mistaken for the answer.</b> {@code nevezan} is an event
	 * of the same season with a race that nothing counts, so an answer built from the
	 * calendar rather than from the league fails. {@code srednji} counts TWO races, so
	 * an event list built by joining rather than by asking which events are in it
	 * names it twice. {@code tudji} is a race of another league and another season, so
	 * an answer that forgets which league it is reading fails from that side too. And
	 * {@code liga-2028} counts nothing at all, which is the state the portal is in
	 * before every season and the one an inner join takes out of the answer
	 * altogether.
	 */
	@BeforeEach
	void threeLeaguesAndTheRacesTheyCount() {
		league("liga-2028", 2028);
		league("liga-2027", 2027);
		league("liga-2029", 2029);

		event("srednji", "2027-06-02");
		event("poslednji", "2027-09-03");
		event("prvi", "2027-03-01");
		event("preklapa", "2027-06-03");
		event("nevezan", "2027-07-04");
		event("tudji", "2029-05-05");

		race("srednji", "srednji-druga", "2027-06-04");
		race("poslednji", "poslednja", "2027-09-03");
		race("prvi", "prvi-prva", "2027-03-01");
		race("srednji", "srednji-prva", "2027-06-02");
		race("prvi", "prvi-druga", "2027-03-02");
		race("preklapa", "preklapa-jedina", "2027-06-03");
		race("prvi", "prvi-treca", "2027-03-03");
		race("nevezan", "nevezana", "2027-07-04");
		race("tudji", "tudja", "2029-05-05");

		counts("liga-2027", "srednji-druga");
		counts("liga-2027", "prvi-druga");
		counts("liga-2027", "poslednja");
		counts("liga-2027", "preklapa-jedina");
		counts("liga-2027", "srednji-prva");

		counts("liga-2029", "tudja");
	}

	private void league(String slug, int season) {
		db.sql("insert into league (slug, name, season, rules, prizes)"
						+ " values (?, ?, ?, 'pravila', 'nagrade')")
				.params(slug, "Liga " + season, season).update();
	}

	private void event(String slug, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
						+ " values (?, ?, date '" + day + "',"
						+ " (select id from place where rank = 1), 'race', false, '', '')")
				.params(slug, "Dogadjaj " + slug).update();
	}

	private void race(String eventSlug, String name, String day) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
						+ " ascent_m, descent_m) values ((select id from btl_event where slug = ?),"
						+ " ?, false, date '" + day + "', 'length', 0, 10.00, 0, 0)")
				.params(eventSlug, name).update();
	}

	/**
	 * The season of the row is the LEAGUE'S, which is the half of the composite key
	 * that says a league of 2027 counts a race of 2027 and nothing else.
	 */
	private void counts(String leagueSlug, String raceName) {
		db.sql("insert into league_race (league_id, season, race_id) values ("
						+ " (select id from league where slug = ?),"
						+ " (select season from league where slug = ?),"
						+ " (select id from race where name = ?))")
				.params(leagueSlug, leagueSlug, raceName).update();
	}

	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(
				http.perform(get("/api/leagues")).andReturn().getResponse().getContentAsString());
	}

	private JsonNode league(String slug) throws Exception {
		return StreamSupport.stream(answer().spliterator(), false)
				.filter(one -> slug.equals(one.path("slug").asString()))
				.findFirst().orElseThrow(() -> new AssertionError("no league " + slug + " in the answer"));
	}

	private List<Long> listed(String slug, String field) throws Exception {
		return StreamSupport.stream(league(slug).path(field).spliterator(), false)
				.map(JsonNode::asLong).toList();
	}

	private Long eventId(String slug) {
		return db.sql("select id from btl_event where slug = ?").param(slug)
				.query(Long.class).single();
	}

	private Long raceId(String name) {
		return db.sql("select id from race where name = ?").param(name)
				.query(Long.class).single();
	}

	/** Every race of one event, asked of the database rather than counted from memory. */
	private List<Long> racesUnder(String eventSlug) {
		return db.sql("select r.id from race r join btl_event e on e.id = r.event_id"
						+ " where e.slug = ?").param(eventSlug)
				.query(Long.class).list();
	}

	/**
	 * EVERY FIELD THE PORTAL READS IS ONE THE SERVER ANSWERS WITH.
	 *
	 * <p>A subset and not an equality, and the difference is the point: a name the
	 * portal reads and the server does not answer with is a screen that goes blank,
	 * while a field the server answers with and the portal ignores costs nothing.
	 * Written as an equality this would refuse to let the server ever carry
	 * anything the mock never had - and {@code raceIds} is exactly such a field, so
	 * this case is what says the move onto races did not cost the portal
	 * {@code eventIds} on the way.
	 *
	 * <p>Neither side is typed out: one comes off the answer, the other off the
	 * file. The shapes deliberately differ - the file's identifiers are text and
	 * the schema's are numbers (ADL A46, 12.09.2026) - and the names are what must
	 * not move.
	 */
	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		/* `raceIds` is named here because no screen reads it YET: the portal still counts a
		   league by its events, and the races are what replaced that in the database on
		   13.09.2026 (V20). Naming it is the price of the floor added the same day, after a
		   review measured that a name nobody reads can carry a fact nobody meant to publish. */
		Answers.everyFieldThePortalReadsIsAnswered("/api/leagues", answer(), "leagues.json",
				Set.of("raceIds"));
	}

	/** And in season order, oldest first, whatever order the rows were written in. */
	@Test
	void theLeaguesComeBackInSeasonOrder() throws Exception {
		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.map(one -> one.path("season").asInt()).toList())
				.as("the leagues came back in the order the rows were written")
				.containsExactly(2027, 2028, 2029);
	}

	/**
	 * A LEAGUE COUNTS ITS OWN RACES, IN THE ORDER THEY ARE RUN.
	 *
	 * <p>Nine races exist, four of them are not counted by this league and one of
	 * those belongs to another league of another season, so an answer built from the
	 * calendar, or from every row of {@code league_race}, cannot pass. The five that
	 * do count come back by the day the RACE is run and then by its key, which is a
	 * different list from the order they were written, from the order of their keys
	 * either way round, and from the order their EVENTS are run in.
	 */
	@Test
	void aLeagueCountsItsOwnRacesInTheOrderTheyAreRun() throws Exception {
		assertThat(listed("liga-2027", "raceIds"))
				.as("the league counted the wrong races, or counted them in the wrong order")
				.containsExactly(raceId("prvi-druga"), raceId("srednji-prva"),
						raceId("preklapa-jedina"), raceId("srednji-druga"),
						raceId("poslednja"));
	}

	/** And the other league counts its own, which is the same sentence from the other side. */
	@Test
	void anotherLeagueCountsWhatIsItsAndNotWhatIsTheFirstOnes() throws Exception {
		assertThat(listed("liga-2029", "raceIds"))
				.as("a league answered with races that are not counted towards it")
				.containsExactly(raceId("tudja"));
	}

	/**
	 * AND IT NAMES THE DIFFERENT EVENTS OF THOSE RACES, EACH ONCE.
	 *
	 * <p>The owner, 12.09.2026: the league's page carries "lista svih događaja koje
	 * spadaju pod tu ligu", and the results table's column "i dalje vidi samo datum
	 * sa mouseoverom svih DOGAĐAJA iz kojih su trke u toj ligi". So the events are
	 * the events OF THE COUNTED RACES and not a list of their own.
	 *
	 * <p>{@code srednji} counts two races, which is what says "each once" is a claim
	 * and not a coincidence, and the fixture's property is read out of the database
	 * rather than remembered. The order is the day the EVENT is on, which is the day
	 * the calendar lists it under, and it is a different list from the keys either
	 * way round.
	 */
	@Test
	void aLeagueNamesTheDifferentEventsOfItsRacesEachOnce() throws Exception {
		List<Long> counted = listed("liga-2027", "raceIds");

		assertThat(racesUnder("srednji").stream().filter(counted::contains).toList())
				.as("no event of this league counts more than one race, so naming each event"
						+ " once is not measured by anything here")
				.hasSizeGreaterThan(1);

		assertThat(listed("liga-2027", "eventIds"))
				.as("the league named the wrong events, named one twice, or named them in the"
						+ " wrong order")
				.containsExactly(eventId("prvi"), eventId("srednji"), eventId("preklapa"),
						eventId("poslednji"));
	}

	/**
	 * AN EVENT COUNTS WITH ONE OF ITS RACES AND IS STILL ON THE LIST, which is the
	 * whole of B40.
	 *
	 * <p>The owner, 12.09.2026: "selekcijom događaja, selektujem automatski i sve
	 * njegove trke, a mogu i samo da selektujem neku od trka". So a day with three
	 * distances may count one of them - the other two score towards nothing in this
	 * league - and the day itself is still what the member sees on the league's page
	 * and in the mouseover over the results column.
	 *
	 * <p>Both halves are read out of the database rather than written down here: how
	 * many races that event has, and how many of them the league counts. A fixture
	 * rewritten to give the event a single race would say so instead of passing
	 * quietly, which is what a remembered three would have done.
	 */
	@Test
	void anEventCountsWithOneOfItsRacesAndIsStillNamed() throws Exception {
		List<Long> counted = listed("liga-2027", "raceIds");
		List<Long> under = racesUnder("prvi");

		assertThat(under)
				.as("the event has one race, so counting one of its races measures nothing")
				.hasSizeGreaterThan(1);
		assertThat(under.stream().filter(counted::contains).toList())
				.as("the league counted more of that event's races than the one it was given")
				.containsExactly(raceId("prvi-druga"));

		assertThat(listed("liga-2027", "eventIds"))
				.as("the event fell off the league's list because only one of its races counts")
				.contains(eventId("prvi"));
	}

	/** And an event of the season that counts nothing is on neither list. */
	@Test
	void anEventNoneOfWhoseRacesCountIsOnNeitherList() throws Exception {
		assertThat(listed("liga-2027", "raceIds"))
				.as("a race nothing counts was counted")
				.doesNotContain(raceId("nevezana"));
		assertThat(listed("liga-2027", "eventIds"))
				.as("an event none of whose races count was named anyway")
				.doesNotContain(eventId("nevezan"));
	}

	/**
	 * AND A LEAGUE NOTHING COUNTS TOWARDS IS STILL A LEAGUE.
	 *
	 * <p>It answers with two empty lists rather than with nothing, and it is in the
	 * answer at all - which is what an inner join would have taken away. A season
	 * whose calendar has not been filled in yet is exactly the state the portal is
	 * in before every season.
	 */
	@Test
	void aLeagueWithNoRacesYetIsStillAnswered() throws Exception {
		JsonNode empty = league("liga-2028");

		assertThat(empty.path("raceIds").isArray())
				.as("a league counting nothing came back without the races rather than with an"
						+ " empty list")
				.isTrue();
		assertThat(empty.path("raceIds")).isEmpty();

		assertThat(empty.path("eventIds").isArray())
				.as("a league counting nothing came back without the events rather than with an"
						+ " empty list")
				.isTrue();
		assertThat(empty.path("eventIds")).isEmpty();
	}

	/** And a visitor reads the rules before he decides anything. */
	@Test
	void nobodyHasToSignInToReadTheRules() throws Exception {
		assertThat(http.perform(get("/api/leagues")).andReturn().getResponse().getStatus())
				.as("a visitor was asked to sign in to read what the league is")
				.isEqualTo(200);
	}
}
