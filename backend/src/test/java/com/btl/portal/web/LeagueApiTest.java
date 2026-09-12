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
	 * Three leagues and four days, written so that NO ordering of the keys matches
	 * the ordering that is being asserted.
	 *
	 * <p><b>Two leagues were not enough and the mutations said so.</b> Written
	 * newest first, ordering by the key descending gives exactly season order, so a
	 * query sorted by the wrong column passed. Three, written middle, oldest,
	 * newest, make the key ascending, the key descending and the season all three
	 * different lists, and only one of them is the answer.
	 *
	 * <p>The same for the days inside a league: written later-then-earlier, the key
	 * descending is date order. Three of them, written middle, last, first, and the
	 * coincidence is gone.
	 *
	 * <p>One league counts towards nothing, which is a real state before every
	 * season and the one that catches an inner join where an outer one belongs -
	 * written that way, the empty league disappears from the answer altogether. One
	 * day counts towards no league, so an answer listing every day there is cannot
	 * pass either.
	 */
	@BeforeEach
	void threeLeaguesAndFourDays() {
		league("liga-2028", 2028);
		league("liga-2027", 2027);
		league("liga-2029", 2029);

		event("srednji", "2027-06-02");
		event("poslednji", "2027-09-03");
		event("prvi", "2027-03-01");
		event("nevezan", "2027-07-04");

		counts("liga-2027", "srednji");
		counts("liga-2027", "poslednji");
		counts("liga-2027", "prvi");
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
				.params(slug, "Trka " + slug).update();
	}

	private void counts(String leagueSlug, String eventSlug) {
		db.sql("insert into league_event (league_id, event_id) values ("
						+ " (select id from league where slug = ?),"
						+ " (select id from btl_event where slug = ?))")
				.params(leagueSlug, eventSlug).update();
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

	/**
	 * EVERY FIELD THE PORTAL READS IS ONE THE SERVER ANSWERS WITH.
	 *
	 * <p>A subset and not an equality, and the difference is the point: a name the
	 * portal reads and the server does not answer with is a screen that goes blank,
	 * while a field the server answers with and the portal ignores costs nothing.
	 * Written as an equality this would refuse to let the server ever carry
	 * anything the mock never had.
	 *
	 * <p>Neither side is typed out: one comes off the answer, the other off the
	 * file. The shapes deliberately differ - the file's identifiers are text and
	 * the schema's are numbers (ADL A46, 12.09.2026) - and the names are what must
	 * not move.
	 */
	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/leagues", answer(), "leagues.json");
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
	 * A LEAGUE CARRIES ITS OWN DAYS AND NOBODY ELSE'S.
	 *
	 * <p>Four days exist and one of them counts towards nothing, so an answer
	 * listing every day there is would pass a fixture where they all counted. The
	 * three that do count are written middle, last, first and must come back in date
	 * order, which is the order the calendar runs them in and is a different list
	 * from the key either way round.
	 */
	@Test
	void aLeagueCarriesItsOwnDaysInTheOrderTheyAreRun() throws Exception {
		List<Long> counted = StreamSupport.stream(league("liga-2027").path("eventIds").spliterator(), false)
				.map(JsonNode::asLong).toList();

		assertThat(counted)
				.as("the league counted the wrong days, or counted them in the wrong order")
				.containsExactly(idOf("prvi"), idOf("srednji"), idOf("poslednji"));
	}

	private Long idOf(String eventSlug) {
		return db.sql("select id from btl_event where slug = ?").param(eventSlug)
				.query(Long.class).single();
	}

	/**
	 * AND A LEAGUE NOTHING COUNTS TOWARDS IS STILL A LEAGUE.
	 *
	 * <p>It answers with an empty list rather than with nothing, and it is in the
	 * answer at all - which is what an inner join would have taken away. A season
	 * whose calendar has not been filled in yet is exactly the state the portal is
	 * in before every season.
	 */
	@Test
	void aLeagueWithNoDaysYetIsStillAnswered() throws Exception {
		JsonNode empty = league("liga-2028");

		assertThat(empty.path("eventIds").isArray())
				.as("a league with no days came back without the list rather than with an empty one")
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
