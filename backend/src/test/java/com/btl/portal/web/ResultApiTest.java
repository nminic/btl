package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
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

	/** The one member of the fixture whose fee has lapsed, and the two days he ran. */
	private static final String THE_LAPSED_MEMBER = "000003";
	private static final String A_MEMBER_WHOSE_FEE_IS_STANDING = "000002";
	private static final String NEW_YEARS_EVE = "2027-12-31";
	private static final String NEW_YEARS_DAY = "2028-01-01";

	/**
	 * HALF AN HOUR PAST MIDNIGHT IN BELGRADE, and half an hour BEFORE it in UTC.
	 *
	 * <p>The season running at this instant is 2028, and it is 2028 because the league
	 * is read in the league's own time. A server reading its own zone, kept in UTC as
	 * containers are, would call it 2027 and would then hide the wrong one of the two
	 * days below - so the choice of zone is measured here rather than trusted.
	 *
	 * <p>The clock the case hands the server reports {@link ZoneOffset#UTC}, which is
	 * what makes that mutation visible instead of academic.
	 */
	private static final Instant NEW_YEARS_NIGHT = Instant.parse("2027-12-31T23:30:00Z");

	/** The same fixture, a year on, when 2028 is history like every season before it. */
	private static final Instant A_YEAR_LATER = Instant.parse("2029-06-15T12:00:00Z");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	@BeforeEach
	void theClockStandsAtNewYear() {
		clock.moveTo(NEW_YEARS_NIGHT);
	}

	/**
	 * Three members, four days, six runs, and deliberately not in the order they
	 * were run.
	 *
	 * <p>Nothing here is the only one of its kind: three members so a result cannot
	 * be found by being the only one, two events on one day so a name cannot come
	 * back by being the only name, and two runs on the same day so that "in date
	 * order" still has to decide between them.
	 *
	 * <p><b>AND THE TWO SIDES OF A NEW YEAR ARE THE SAME MEMBER.</b> The one whose
	 * fee has lapsed ran on New Year's Eve and again the morning after, which is the
	 * boundary the owner's decision of 13.09.2026 is about: what he ran in a season
	 * he was a member in stays, what he ran in the season now running does not.
	 * Written with one result each for two different members, "his running season is
	 * hidden" and "he is hidden" would give the same answer and the case would
	 * measure neither.
	 *
	 * <p><b>And a member whose fee IS standing ran the same race on the same day</b>,
	 * so "the running season is hidden from everybody" and "the day is missing
	 * altogether" are separated from the rule too.
	 */
	@BeforeEach
	void aHistoryOutOfOrder() {
		member("000001", "Prvi", "Clan", "M", "1990-05-05", "00112233445566aa", true);
		member(A_MEMBER_WHOSE_FEE_IS_STANDING, "Druga", "Clanica", "F", "1978-11-20",
				"00112233445566bb", true);
		member(THE_LAPSED_MEMBER, "Treci", "Neclan", "M", "1985-07-07", "00112233445566cc", false);

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
		event("docek-2027", "Docek", NEW_YEARS_EVE);
		event("novogodisnja-2028", "Novogodisnja", NEW_YEARS_DAY);

		race("maratonski-dan-2027", "Maraton", "2027-05-05", 42.20);
		race("srednji-dan-2027", "Polumaraton", "2027-03-01", 21.10);
		race("kratki-dan-2027", "Desetka", "2027-03-01", 10.00);
		race("docek-2027", "Docek trka", NEW_YEARS_EVE, 25.00);
		race("novogodisnja-2028", "Novogodisnja trka", NEW_YEARS_DAY, 5.00);

		run(A_MEMBER_WHOSE_FEE_IS_STANDING, "Maraton", "2027-05-05", 42.20, 350, 410, 12000, 123.45);
		run(A_MEMBER_WHOSE_FEE_IS_STANDING, "Polumaraton", "2027-03-01", 21.10, 120, 60, 3000, 50.00);
		/* Faster than the run written before it, and on the same day. */
		run("000001", "Desetka", "2027-03-01", 10.00, 0, 5, 2400, 45.60);
		/* The last day of a season he was a member in, and the first day of the one he
		   is not. Same man, same fee, one day apart. */
		run(THE_LAPSED_MEMBER, "Docek trka", NEW_YEARS_EVE, 25.00, 200, 180, 4500, 60.00);
		run(THE_LAPSED_MEMBER, "Novogodisnja trka", NEW_YEARS_DAY, 5.00, 10, 12, 1800, 30.00);
		/* And somebody who has paid, on that same race of that same morning. */
		run(A_MEMBER_WHOSE_FEE_IS_STANDING, "Novogodisnja trka", NEW_YEARS_DAY, 5.00, 40, 8,
				1200, 20.00);
	}

	private void member(String number, String first, String last, String gender, String born,
			String referral, boolean feeStanding) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, date '" + born + "',"
						+ " (select id from place where rank = 1), null, null, 2027, false, ?,"
						+ " 'payment', ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, gender, feeStanding, referral).update();
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

	/** The days one member's runs come back on, in the order the answer carries them. */
	private List<String> daysServedFor(String memberNumber) throws Exception {
		return StreamSupport.stream(answer().spliterator(), false)
				.filter(one -> one.path("memberNumber").asString().equals(memberNumber))
				.map(one -> one.path("date").asString())
				.toList();
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
				.containsExactly(3000, 2400, 12000, 4500, 1200);

		/* WHAT MAKES THIS A STATEMENT AND NOT A COINCIDENCE is the fixture above, and it
		   took three rounds of review to get there: first the times rose with the days,
		   then the points did, then the member number and the race. Each was one wrong
		   `order by` that answered this very list.

		   Every field of the answer was then walked in both directions against the
		   rebuilt fixture, by hand and by the reviewer: none of the thirteen reproduces
		   this order. The derived guard that found the last two axes is deliberately NOT
		   here: three rounds running were about that guard rather than about the
		   resource, so it goes on its own branch with its own review (PENDING,
		   12.09.2026).

		   The two runs added on 13.09.2026 keep every one of those axes: 4,500 seconds
		   and 1,200 seconds neither rise nor fall with the days, and the same holds for
		   their distances, climbs, descents, points, names, addresses and keys. */
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
	 * AND A MEMBER WHOSE FEE HAS LAPSED KEEPS THE SEASONS HE WAS A MEMBER IN AND
	 * LOSES THE ONE THAT IS RUNNING.
	 *
	 * <p>Owner, 13.09.2026: „svi podaci o clanu kojem je clanarina istekla treba da
	 * ostanu vidljivi u starim / zamrznutim sezonama kad je clanarina bila aktivna, a
	 * da se u godini koja je upravo pocela ne prikazuje ni u listi clanova, niti
	 * logicno u rezultatima."
	 *
	 * <p><b>Why it is one assertion over both days rather than two.</b> Each half
	 * alone is satisfied by a wrong answer: dropping the whole condition keeps New
	 * Year's Day, and hiding him outright loses New Year's Eve, and „he is not on the
	 * day I looked at" reads the same for a member number nobody in the fixture has.
	 * The list of his days, exactly, refuses all three.
	 *
	 * <p>The floor below is read out of the database rather than remembered, so a
	 * fixture that stopped setting up the case says so instead of passing.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedKeepsTheSeasonsHeWasAMemberIn() throws Exception {
		assertThat(db.sql("select to_char(r.race_date, 'YYYY-MM-DD') from result r"
						+ " join competitor c on c.id = r.competitor_id"
						+ " where c.member_number = ? and not c.active order by r.race_date")
						.param(THE_LAPSED_MEMBER).query(String.class).list())
				.as("the fixture no longer gives the member whose fee has lapsed one run in the"
						+ " season that is running and one in a season before it, so this case"
						+ " measures nothing")
				.containsExactly(NEW_YEARS_EVE, NEW_YEARS_DAY);

		assertThat(daysServedFor(THE_LAPSED_MEMBER))
				.as("the running season's run of a member whose fee has lapsed was served, or a"
						+ " run of his from a season he WAS a member in was not; /api/competitors"
						+ " already leaves him off the list of members, so the difference between"
						+ " two public answers is the list of everybody who has not paid")
				.containsExactly(NEW_YEARS_EVE);
	}

	/**
	 * AND THE SAME RUN COMES BACK ONCE THAT SEASON IS NO LONGER THE ONE RUNNING.
	 *
	 * <p>The fee runs for exactly one calendar year, so a season a man did not pay
	 * for still becomes history the moment the next one starts, and history is what
	 * the decision above keeps: „ostanu vidljivi u starim / zamrznutim sezonama".
	 *
	 * <p><b>This is the half that says the year comes from the clock.</b> The case
	 * above and this one ask for the SAME row of the SAME fixture and want opposite
	 * answers, and the only thing that differs is the moment the server is asked at.
	 * A server working the year out from {@code current_date} answers both the same
	 * way whatever the real date is, so one of the two goes red - this year, and every
	 * year after it.
	 */
	@Test
	void andTheSameRunComesBackOnceThatSeasonIsHistoryToo() throws Exception {
		clock.moveTo(A_YEAR_LATER);

		assertThat(daysServedFor(THE_LAPSED_MEMBER))
				.as("a run of a member whose fee has lapsed was still withheld in a year that is"
						+ " no longer the one it was run in")
				.containsExactly(NEW_YEARS_EVE, NEW_YEARS_DAY);
	}

	/**
	 * AND THAT SAME MORNING COMES BACK FOR A MEMBER WHOSE FEE IS STANDING.
	 *
	 * <p>The rule is about the fee and not about the season: what a member who has
	 * paid ran this morning is served this morning, which is the whole of what the
	 * portal is for. Without this the condition could be „hide the season that is
	 * running" from everybody, and the case above would not notice.
	 *
	 * <p>It is the same race of the same day as the run that is withheld, so it is
	 * not the event, the race or the day that decides - only whose it is.
	 */
	@Test
	void andTheSameMorningComesBackForAMemberWhoseFeeIsStanding() throws Exception {
		assertThat(daysServedFor(A_MEMBER_WHOSE_FEE_IS_STANDING))
				.as("a run from the season that is running was withheld from a member whose fee"
						+ " is standing, on the very race whose other runner has not paid")
				.contains(NEW_YEARS_DAY);
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

	/**
	 * A CLOCK THE CASE MOVES, because the question is about a boundary in time.
	 *
	 * <p>It reports UTC as its zone on purpose: whoever asks what season it is has to
	 * re-read the instant in the league's own time, and a server that reads this zone
	 * instead answers 2027 on a night that is already 2028 in Belgrade.
	 */
	static final class AClockTheCaseMoves extends Clock {

		private Instant now;

		private AClockTheCaseMoves(Instant now) {
			this.now = now;
		}

		void moveTo(Instant when) {
			this.now = when;
		}

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return Clock.fixed(now, zone);
		}
	}

	/**
	 * And it stands in for the server's own clock, which is the point of that bean
	 * existing at all: the rule above is measured on a chosen night rather than once
	 * a year.
	 */
	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		AClockTheCaseMoves aClockTheCaseMoves() {
			return new AClockTheCaseMoves(NEW_YEARS_NIGHT);
		}

	}

}
