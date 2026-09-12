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

/** The history, against a real database and against the file the portal serves. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ResultApiTest {

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/**
	 * Two members, two days, three runs, and deliberately not in the order they
	 * were run.
	 *
	 * <p>Nothing here is the only one of its kind: two members so a result cannot
	 * be found by being the only one, two events so a name cannot come back by
	 * being the only name, and two runs on the same day so that "in date order"
	 * still has to decide between them.
	 */
	@BeforeEach
	void aHistoryOutOfOrder() {
		member("000001", "Prvi", "Clan", "M", "1990-05-05", "00112233445566aa");
		member("000002", "Druga", "Clanica", "F", "1978-11-20", "00112233445566bb");

		/* TWO EVENTS ON ONE DAY, and that is not decoration. The order asked for below
		   is by the day and then by the key; every other field of the answer has to give
		   a DIFFERENT list, or the case measures nothing. With both runs of the first day
		   at one event, sorting by the event's name reproduced the order exactly. The
		   same held for the race, for the member and for the points, each found a round
		   later than the last, which is why `noOtherFieldWouldGiveThisOrder` now asks it
		   of every field at once. */
		event("kratki-dan-2027", "Kratki dan", "2027-03-01");
		event("srednji-dan-2027", "Srednji dan", "2027-03-01");
		event("maratonski-dan-2027", "Maratonski dan", "2027-05-05");

		race("maratonski-dan-2027", "Maraton", "2027-05-05", 42.20);
		race("srednji-dan-2027", "Polumaraton", "2027-03-01", 21.10);
		race("kratki-dan-2027", "Desetka", "2027-03-01", 10.00);

		run("000002", "Maraton", "2027-05-05", 42.20, 350, 410, 12000, 123.45);
		run("000002", "Polumaraton", "2027-03-01", 21.10, 120, 60, 3000, 50.00);
		/* Faster than the run written before it, and on the same day. */
		run("000001", "Desetka", "2027-03-01", 10.00, 0, 5, 2400, 45.60);
	}

	private void member(String number, String first, String last, String gender, String born,
			String referral) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, date '" + born + "',"
						+ " (select id from place where rank = 1), null, null, 2027, false, true,"
						+ " 'payment', ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, gender, referral).update();
	}

	private void event(String slug, String name, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, date '" + day + "', null, 'Kraljevo',"
						+ " (select id from country where code = 'RS'), 'race', false, '', '')")
				.params(slug, name).update();
	}

	private void race(String eventSlug, String name, String day, double km) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false,"
						+ " date '" + day + "', 'length', 0, ?, 0, 0)")
				.params(eventSlug, name, km).update();
	}

	private void run(String member, String raceName, String day, double km, int up, int down,
			int seconds, double points) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from race where name = ?), date '" + day + "', ?, ?, ?, ?, ?)")
				.params(member, raceName, km, up, down, seconds, points).update();
	}

	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(
				http.perform(get("/api/results")).andReturn().getResponse().getContentAsString());
	}

	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/results", answer(), "results.json");
	}

	@Test
	void noFieldOfTheAnswerIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord("/api/results", answer());
	}

	/**
	 * THE HISTORY COMES BACK IN THE ORDER IT WAS RUN.
	 *
	 * <p>The rows were written last day first, so an answer in the order they were
	 * written is a different list from an answer in the order they were run. The two
	 * runs of the same day are told apart by the key, which is the only thing left
	 * once the day has decided.
	 *
	 * <p><b>And the times are deliberately not in the same order as the days.</b>
	 * The second run of the first day is the fastest of the three, so sorting by
	 * `seconds` answers a different list from sorting by the day. Written the other
	 * way round the case would pass for a query sorted by the time somebody ran,
	 * which is not what it claims to measure (found in review, 12.09.2026).
	 */
	@Test
	void theHistoryComesBackInTheOrderItWasRun() throws Exception {
		List<JsonNode> answered = StreamSupport.stream(answer().spliterator(), false).toList();

		assertThat(answered.stream().map(one -> one.path("seconds").asInt()).toList())
				.as("the history came back in some order other than the one it was run in")
				.containsExactly(3000, 2400, 12000);

		/* And the fixture can tell that order from every other one there is. Guessing
		   which axes to separate cost two rounds of review on this one case: first the
		   times rose with the days, then the points did. This asks the question of every
		   field at once instead. */
		Answers.noOtherFieldWouldGiveThisOrder("/api/results", answered, "date", "id");
	}

	/**
	 * A RACE RENAMED AFTER THE RUN COMES BACK UNDER ITS NEW NAME, and so does its
	 * event and the address of it.
	 *
	 * <p>This is the case that says the names are joined and not stored. A server
	 * keeping its own copy of them would answer with the name as it stood when the
	 * result was written, and every other case in this file would still pass: the
	 * fields would be named right and none of them would be a constant. What it
	 * guards is the drift V7 measured on the served data, two hundred and twenty
	 * three values out of seventeen thousand six hundred and forty.
	 */
	@Test
	void aRaceRenamedAfterTheRunComesBackRenamed() throws Exception {
		db.sql("update race set name = 'Maraton pod novim imenom', renamed = true"
				+ " where name = 'Maraton'").update();
		db.sql("update btl_event set name = 'Dan pod novim imenom', slug = 'novi-slug-2027'"
				+ " where slug = 'maratonski-dan-2027'").update();

		JsonNode theMarathon = StreamSupport.stream(answer().spliterator(), false)
				.filter(one -> one.path("seconds").asInt() == 12000)
				.findFirst().orElseThrow();

		assertThat(theMarathon.path("raceName").asString())
				.as("the race was renamed and the answer carried the old name")
				.isEqualTo("Maraton pod novim imenom");
		assertThat(theMarathon.path("eventName").asString())
				.as("the event was renamed and the answer carried the old name")
				.isEqualTo("Dan pod novim imenom");
		assertThat(theMarathon.path("eventSlug").asString())
				.as("the event moved and the answer carried the old address")
				.isEqualTo("novi-slug-2027");
	}

	/**
	 * AND A VISITOR READS IT WITHOUT SIGNING IN.
	 *
	 * <p>Article 73 of the rulebook lists every verified result among the things
	 * that are public, and a league whose record cannot be checked is not a league.
	 */
	@Test
	void nobodyHasToSignInToReadTheHistory() throws Exception {
		assertThat(http.perform(get("/api/results")).andReturn().getResponse().getStatus())
				.as("/api/results asked a visitor to sign in")
				.isEqualTo(200);
	}

}
