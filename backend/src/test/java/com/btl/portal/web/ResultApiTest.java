package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
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

	/**
	 * MID OCTOBER OF THE SEASON THAT IS STILL RUNNING, and the only moment in this
	 * file where the two questions about "which season" give different numbers.
	 *
	 * <p>From 1 October the transfer window is open and {@code seasonBeingPaidFor}
	 * answers with NEXT year, while the season a result belongs to is still the
	 * calendar year it was run in. The two moments above both fall outside that
	 * window, in January and in June, where the two functions agree.
	 */
	private static final Instant INSIDE_THE_TRANSFER_WINDOW = Instant.parse("2028-10-15T12:00:00Z");

	/**
	 * THE AUTUMN OF 2026, WHEN NO SEASON IS RUNNING AT ALL.
	 *
	 * <p>The league begins in 2027 (PDL P2), so the plain calendar year on this day names a
	 * season the portal does not have. It is the one moment where {@code theSeasonRunning} (the
	 * plain year, which is what is WITHHELD, and which withholds nothing here) and the season the
	 * list answers a band for (lifted to the first season there is) are different numbers, and
	 * the one where every run of the fixture lies AHEAD of the day. The cases that need either
	 * stand here.
	 */
	private static final Instant AUTUMN_2026 = Instant.parse("2026-09-21T10:00:00Z");

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

	/** The sessions of the accounts a case opens, by address. */
	private final Map<String, SecretToken> sessions = new HashMap<>();

	/**
	 * THE RUNNER, as a case reads it: the five names the answer carries about him and nothing
	 * else, so that two of them compare as values.
	 */
	private record TheRunner(String firstName, String lastName, String gender, String ageBand,
			boolean firstSeason2027) {
	}

	/** The runner of one row of this answer. */
	private static TheRunner runnerOf(JsonNode row) {
		return fiveNamesIn(row.path("runner"));
	}

	/**
	 * THE FIVE NAMES OF ONE RECORD, wherever it comes from: the runner of a result here and a
	 * member of the list {@code /api/competitors} answers, which carries the same five under the
	 * same keys, so that the two doors can be compared as values.
	 */
	private static TheRunner fiveNamesIn(JsonNode record) {
		return new TheRunner(record.path("firstName").asString(), record.path("lastName").asString(),
				record.path("gender").asString(), record.path("ageBand").asString(),
				record.path("firstSeason2027").asBoolean());
	}

	/** The whole answer as text, which is what a name or a year is looked for in. */
	private String whole() throws Exception {
		return http.perform(get("/api/results")).andReturn().getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
	}

	private List<JsonNode> served() throws Exception {
		return StreamSupport.stream(answer().spliterator(), false).toList();
	}

	/** Every row of the answer that is about this member, in the order the answer carries them. */
	private List<JsonNode> rowsOf(String memberNumber) throws Exception {
		return served().stream()
				.filter(one -> one.path("memberNumber").asString().equals(memberNumber))
				.toList();
	}

	private static long timesIn(String text, String word) {
		return Pattern.compile(Pattern.quote(word)).matcher(text).results().count();
	}

	/**
	 * A MEMBER WHO IS NOT ONE OF THE THREE THE HISTORY IS WRITTEN FOR, written inside the case
	 * that needs him and not in the fixture, so that {@code theHistoryComesBackInTheOrderItWasRun}
	 * and the cases about the lapsed member go on standing on the rows they were written for.
	 *
	 * <p>His referral code is built from his number so that two of them cannot collide, which
	 * the schema refuses outright.
	 */
	private void aMember(String number, String first, String last, String gender, String born,
			boolean feeStanding) {
		member(number, first, last, gender, born, "0011223344" + number, feeStanding);
	}

	/** The beginners' category, which is a flag on the record and not something worked out. */
	private void heRunsAsABeginner(String number) {
		db.sql("update competitor set first_season_2027 = true where member_number = ?")
				.param(number).update();
	}

	/**
	 * SOMEBODY WHO REGISTERED AND HAS NO MEMBER NUMBER, which V16 allows and which is what an
	 * applicant is until the first payment is recorded. He is not a member (V16: a member is a row
	 * whose number is there), and the schema still lets his row own a result, since
	 * {@code result_competitor_fk} points at a competitor and not at a member. His fee does not
	 * stand, so his result is served only for a season that is not the one running.
	 */
	private void anApplicantWithNoMemberNumber(String first, String last, String gender,
			String born) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (null, ?, ?, ?, date '" + born + "',"
						+ " (select id from place where rank = 1), null, null, 2027, false, false,"
						+ " 'payment', '00112233440000ab', null, '', false, 'none', 'Otac', 'Ulica 1',"
						+ " 'M', timestamptz '2026-09-01 10:00:00+00')")
				.params(first, last, gender).update();
	}

	/** A run of the applicant above, who is the only competitor in the table with no number. */
	private void theApplicantRuns(String raceName, String day, double km, int up, int down,
			int seconds, double points) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points)"
						+ " values ((select id from competitor where member_number is null),"
						+ " (select id from race where name = ?), date '" + day + "', ?, ?, ?, ?, ?)")
				.params(raceName, km, up, down, seconds, points).update();
	}

	/**
	 * An account, signed in, whose own name is not the name of the member it belongs to.
	 *
	 * <p>The session is written at the moment the clock stands at, and not at the real one: the
	 * cases here move the clock years ahead, and a session that was only ever valid at the real
	 * moment would be a cookie some other part of the chain might decline.
	 */
	private void anAccount(String email, String role, String first, String last) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values (?, ?, ?, (select id from role where code = ?))")
				.params(first, last, email, role).update();

		SecretToken session = SecretToken.fresh();
		Instant now = clock.standingAt();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/** The link V23 wrote down: this account IS that member. */
	private void belongsTo(String email, String memberNumber) {
		db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
				+ " where email = ?").params(memberNumber, email).update();
	}

	/** @param email null for the visitor, which is the same request without the cookie */
	private String wholeFor(String email) throws Exception {
		MockHttpServletRequestBuilder asks = get("/api/results");

		return http.perform(email == null ? asks
						: asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
				.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
	}

	/**
	 * THE FLOOR UNDER EVERY CASE ABOUT THE LAPSED MEMBER: he ran on the last day of a season he
	 * was a member in and on the first day of the one that follows, so that "he is named on the
	 * old one" and "he is named on the new one" are two different rows. Read out of the database
	 * rather than remembered, so a fixture that stopped setting the case up says so instead of
	 * passing.
	 */
	private void theLapsedMemberStillRanOnBothSidesOfTheNewYear() {
		assertThat(db.sql("select to_char(r.race_date, 'YYYY-MM-DD') from result r"
						+ " join competitor c on c.id = r.competitor_id"
						+ " where c.member_number = ? and not c.active order by r.race_date")
						.param(THE_LAPSED_MEMBER).query(String.class).list())
				.as("the fixture no longer gives the member whose fee has lapsed one run in the"
						+ " season that is running and one in a season before it, so this case"
						+ " measures nothing")
				.containsExactly(NEW_YEARS_EVE, NEW_YEARS_DAY);
	}

	/**
	 * <b>{@code runner} IS THE ONE NAME THE SERVER ANSWERS WITH AND THE PORTAL DOES NOT READ
	 * YET</b>, and it is named here with its reason, as the floor asks: the served file has no
	 * such name, and the screens that will draw a lapsed member's name out of it are the next
	 * increment. Naming it is what lets this one ship first. It is checked both ways, so renaming
	 * it on the server fails here, and so does the served file starting to carry it while this
	 * line stays.
	 */
	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/results", answer(), "results.json",
				Set.of("runner"));
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
	 * AND IT STAYS WITHHELD IN THE AUTUMN, WHEN THE SEASON AFTER IT IS ALREADY THE
	 * ONE BEING PAID FOR.
	 *
	 * <p><b>Two functions answer "which season is it" and this is the only case that
	 * tells them apart.</b> {@code SeasonClock.seasonBeingPaidFor} answers the question
	 * a renewal screen asks, and from 1 October it answers with NEXT year; the season a
	 * result belongs to is the calendar year it was run in. Those two numbers differ for
	 * three months of every year and agree for the other nine, so a fixture whose clocks
	 * all stand outside the transfer window lets the wrong one of the two pass.
	 *
	 * <p><b>Measured in review on 13.09.2026 rather than argued:</b> swapping this
	 * resource's year for {@code seasonBeingPaidFor} left the whole package green, all
	 * 1540 cases of it. What it costs is that from 1 October to 31 December a member
	 * whose fee has lapsed gets the running season's runs served beside his member
	 * number, while {@code /api/competitors} goes on leaving him off the list - which is
	 * the difference between two public answers naming who has not paid, and is the
	 * leak this whole change exists to close.
	 *
	 * <p><b>The floor asks {@code SeasonClock} itself instead of remembering when the
	 * window is.</b> Moved out of it, this moment would quietly repeat the case above
	 * instead of measuring anything, and the floor says so rather than passing.
	 */
	@Test
	void andTheRunningSeasonStaysWithheldWhileTheNextOneIsAlreadyBeingPaidFor() throws Exception {
		ZonedDateTime inTheAutumn = INSIDE_THE_TRANSFER_WINDOW.atZone(SeasonClock.ZONE);

		assertThat(SeasonClock.seasonBeingPaidFor(inTheAutumn))
				.as("the season being paid for and the calendar year are the same at this moment,"
						+ " so this case measures nothing the two above it do not")
				.isNotEqualTo(inTheAutumn.getYear());

		clock.moveTo(INSIDE_THE_TRANSFER_WINDOW);

		assertThat(daysServedFor(THE_LAPSED_MEMBER))
				.as("a run from the season that is still running came back for a member whose fee"
						+ " has lapsed, because the year was taken from the season being paid for,"
						+ " which in October is already the next one, instead of from the calendar"
						+ " year the run belongs to")
				.containsExactly(NEW_YEARS_EVE);
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
	 * EVERY RESULT NAMES THE MEMBER WHOSE RUN IT IS.
	 *
	 * <p>Five members whose runners differ on EVERY axis the answer carries about them: no two share
	 * a first name or a last name, both sexes are there, three of the four bands the league has are
	 * there, and two of them are beginners. The two beginners stand on the two sides of the fee, one
	 * whose fee stands and one whose fee has lapsed, beside two members who are no beginners on
	 * either side of it, so the fee and the beginner's mark are four combinations and not two. A name
	 * answered from a constant, from the wrong member, or from the account instead of the record is a
	 * different list; so is a sex or a beginner's mark answered from a constant, and so is a mark
	 * answered from the fee (nobody whose fee has lapsed is a beginner, or only somebody whose fee
	 * has lapsed is). The values are WRITTEN OUT and not worked out by asking the server's own
	 * arithmetic: asking {@code Category} for them would compare the server with itself and pass
	 * whatever it became.
	 *
	 * <p><b>The first member has an account, and the account carries ANOTHER name.</b> V23 holds
	 * them as two facts about two things, so a version that read the name off the account passes
	 * for every member without a login and fails for this one. The other direction is already in
	 * the fixture: three members with no account at all.
	 *
	 * <p>The floor comes first, because a list of served rows that lost a member would make every
	 * comparison below a comparison of what is left.
	 */
	@Test
	void everyResultNamesTheMemberWhoseRunItIs() throws Exception {
		aMember("000004", "Cetvrta", "Pocetnica", "F", "2005-03-03", true);
		heRunsAsABeginner("000004");
		run("000004", "Maraton", "2027-05-05", 42.20, 90, 95, 15000, 99.99);
		aMember("000010", "Deseta", "Isteklica", "F", "1995-04-04", false);
		heRunsAsABeginner("000010");
		run("000010", "Maraton", "2027-05-05", 42.20, 80, 85, 15500, 90.00);

		anAccount("prvi@primer.rs", "competitor", "Tudje", "Ime");
		belongsTo("prvi@primer.rs", "000001");

		Map<String, TheRunner> theyAre = Map.of(
				"000001", new TheRunner("Prvi", "Clan", "M", "25-39", false),
				"000002", new TheRunner("Druga", "Clanica", "F", "40-54", false),
				"000003", new TheRunner("Treci", "Neclan", "M", "40-54", false),
				"000004", new TheRunner("Cetvrta", "Pocetnica", "F", "24-", true),
				"000010", new TheRunner("Deseta", "Isteklica", "F", "25-39", true));

		List<JsonNode> served = served();

		assertThat(served.stream().map(one -> one.path("memberNumber").asString()).distinct().toList())
				.as("the fixture no longer serves a run of each of the five members, so a comparison"
						+ " below would be a comparison of what is left")
				.containsExactlyInAnyOrder("000001", "000002", "000003", "000004", "000010");

		for (JsonNode row : served) {
			String number = row.path("memberNumber").asString();

			assertThat(row.path("runner").isObject())
					.as("the run of %s came back with no runner", number)
					.isTrue();
			assertThat(runnerOf(row))
					.as("the run of %s names somebody other than %s, or him with another sex, band or"
							+ " beginner's mark", number, number)
					.isEqualTo(theyAre.get(number));
		}
	}

	/**
	 * THE RUNNER IS FIVE NAMES AND NOTHING ELSE.
	 *
	 * <p>The names are the first name, the last name, the sex, the age band and whether he runs
	 * as a beginner (PDL P11, 03.10.2026, and the note on {@code ResultApi}). A sixth would be a
	 * fact about a member answered to everybody because nobody was asked: the year of birth
	 * (Article 74), whether his fee stands (PDL P34 took {@code active} off the public list for
	 * being a fact about somebody else's payment), or one of the three things a profile page
	 * carries that hiding takes away (portrait, biography, team).
	 *
	 * <p><b>Compared as a set, in every row</b>, and not a count of the names: a sixth name and a
	 * renamed one both fail it, and a first row that was the only one checked would let the
	 * second kind of member through. The answer has more than one row so the loop is a loop.
	 */
	@Test
	void theRunnerIsFiveNamesAndNothingElse() throws Exception {
		List<JsonNode> served = served();

		assertThat(served).as("the answer has one row or none, so the loop below checks nothing")
				.hasSizeGreaterThan(1);

		for (JsonNode row : served) {
			assertThat(Answers.fieldsOf(row.path("runner")))
					.as("the runner of %s carries other names than the five it is allowed",
							row.path("memberNumber").asString())
					.containsExactlyInAnyOrder("firstName", "lastName", "gender", "ageBand",
							"firstSeason2027");
		}
	}

	/**
	 * NO YEAR OF BIRTH LEAVES THE SERVER, and nobody's date of it either.
	 *
	 * <p>Article 74: „Datum rođenja se nikada ne prikazuje, ni u punom ni u skraćenom obliku." The
	 * year is read here to be turned into a band, so it passes through the one place that could
	 * let it out, and the band is the only thing that is allowed to come of it.
	 *
	 * <p><b>What this case holds is the year itself, the field and the text it could leak
	 * through, and not what can be INFERRED from the bands.</b> A band per season is the map that
	 * gives an approximate year of birth back, and that is the cost the owner chose on 10.10.2026
	 * (the notes on {@code ResultApi} and on {@code SeasonClock} give it); no case can refuse the
	 * inference without refusing the decision.
	 *
	 * <p><b>The answer is read as TEXT and the things to look for are read out of the table</b>,
	 * so the case refuses the year however it is spelt and whatever the field it leaks through is
	 * called, and so a member added tomorrow is looked for without anybody remembering this file.
	 * Each is matched on its own, with no digit before or after it, so that a run of 12000 seconds
	 * is not a birth in 2000. The applicant with no member number is in the table too, because the
	 * place a year would leak most easily is the row that has no runner to put it in.
	 */
	@Test
	void noYearOfBirthLeavesTheServer() throws Exception {
		aMember("000004", "Cetvrta", "Pocetnica", "F", "2005-03-03", true);
		run("000004", "Maraton", "2027-05-05", 42.20, 90, 95, 15000, 99.99);
		anApplicantWithNoMemberNumber("Bez", "Broja", "M", "1992-04-04");
		theApplicantRuns("Maraton", "2027-05-05", 42.20, 10, 12, 20000, 70.00);

		List<String> whatMustNotBeThere = db.sql("select birth_year::text from competitor"
						+ " union select to_char(birth_date, 'YYYY-MM-DD') from competitor")
				.query(String.class).list();

		assertThat(whatMustNotBeThere)
				.as("the table no longer holds the five birth years and the five birth dates this case"
						+ " looks for, so it measures nothing")
				.hasSize(10);

		String text = whole();

		for (String secret : whatMustNotBeThere) {
			assertThat(Pattern.compile("(?<![0-9])" + Pattern.quote(secret) + "(?![0-9])")
					.matcher(text).find())
					.as("%s is in the answer, and it is somebody's year or day of birth", secret)
					.isFalse();
		}
	}

	/**
	 * A MEMBER WHOSE FEE HAS LAPSED IS NAMED ON THE SEASONS HE WAS A MEMBER IN, AND ONLY ON THEM.
	 *
	 * <p>PDL P11, 03.10.2026: the result of a season he was a member in carries the name, as plain
	 * text; and 13.09.2026, in the owner's words, the running season of a member whose fee has
	 * lapsed „ne prikazuje ni u listi članova, niti logično u rezultatima". The first is the row
	 * that comes back with a name, the second is the row that does not come back at all, and one
	 * member has one of each, a day apart, so that neither half can be satisfied by the other.
	 *
	 * <p><b>The name is counted in the TEXT of the answer</b> and not only read off his row: it
	 * occurs exactly as often as he has rows in it. A version that answered the name on the row
	 * that is withheld, or beside the list, or anywhere else, would have it appear more often than
	 * the rows he has.
	 *
	 * <p><b>All three states of the clock</b>, which are the ones the case about the withheld
	 * season stands on: the night the season turns, a year on when both rows are history, and the
	 * autumn when the next season is already being paid for. In the third the running season is
	 * still the plain calendar year, so his run of New Year's Day stays withheld and his name goes
	 * on being answered with the other one.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedIsNamedOnTheSeasonsHeWasAMemberIn() throws Exception {
		theLapsedMemberStillRanOnBothSidesOfTheNewYear();

		TheRunner he = new TheRunner("Treci", "Neclan", "M", "40-54", false);

		List<JsonNode> his = rowsOf(THE_LAPSED_MEMBER);

		assertThat(his.stream().map(one -> one.path("date").asString()).toList())
				.as("the member whose fee has lapsed is not served exactly the run of the season he was"
						+ " a member in, so what he is named on is not what this case is about")
				.containsExactly(NEW_YEARS_EVE);
		assertThat(runnerOf(his.get(0)))
				.as("the run he was a member for came back without his name, or with somebody else's")
				.isEqualTo(he);

		String text = whole();

		assertThat(timesIn(text, "Neclan"))
				.as("his last name is in the answer more often than he has rows in it")
				.isEqualTo(his.size());
		assertThat(timesIn(text, "Treci"))
				.as("his first name is in the answer more often than he has rows in it")
				.isEqualTo(his.size());

		clock.moveTo(A_YEAR_LATER);

		assertThat(rowsOf(THE_LAPSED_MEMBER))
				.as("a year on, both his runs are history and both are named")
				.hasSize(2)
				.allSatisfy(one -> assertThat(runnerOf(one)).isEqualTo(he));
		assertThat(timesIn(whole(), "Neclan")).isEqualTo(2);

		clock.moveTo(INSIDE_THE_TRANSFER_WINDOW);

		assertThat(rowsOf(THE_LAPSED_MEMBER))
				.as("in the autumn his run of the season that is still running is withheld and the one"
						+ " before it is named")
				.hasSize(1)
				.allSatisfy(one -> assertThat(runnerOf(one)).isEqualTo(he));
		assertThat(timesIn(whole(), "Neclan")).isEqualTo(1);
	}

	/**
	 * A MEMBER WHO HIDES HIS PROFILE IS NAMED LIKE ANY OTHER.
	 *
	 * <p>PDL P23, 06.09.2026, derived from the policy and not asked: „Ime ostaje u javnim
	 * tabelama" - „skriva se profilna strana, ne mesto u poretku". Two members hide, and they are
	 * the two that matter: one whose fee stands and one whose fee has lapsed, because a condition
	 * written against hiding and one written against the fee would each pass for the other if
	 * only one of them were in the fixture. A third, who hides nothing, is the contrast.
	 */
	@Test
	void aMemberWhoHidesHisProfileIsNamedLikeAnyOther() throws Exception {
		db.sql("update competitor set profile_hidden = true where member_number in (?, ?)")
				.params("000001", THE_LAPSED_MEMBER).update();

		assertThat(db.sql("select count(*) from competitor where profile_hidden")
				.query(Long.class).single())
				.as("the fixture no longer has exactly the two members who hide, so this case"
						+ " measures nothing")
				.isEqualTo(2L);

		assertThat(rowsOf("000001")).hasSize(1)
				.allSatisfy(one -> assertThat(runnerOf(one))
						.as("a member whose fee stands and who hides his profile was not named like"
								+ " the others")
						.isEqualTo(new TheRunner("Prvi", "Clan", "M", "25-39", false)));
		assertThat(rowsOf(THE_LAPSED_MEMBER)).hasSize(1)
				.allSatisfy(one -> assertThat(runnerOf(one))
						.as("a member whose fee has lapsed and who hides his profile was not named like"
								+ " the others")
						.isEqualTo(new TheRunner("Treci", "Neclan", "M", "40-54", false)));
		assertThat(rowsOf("000002")).hasSize(3)
				.allSatisfy(one -> assertThat(runnerOf(one))
						.isEqualTo(new TheRunner("Druga", "Clanica", "F", "40-54", false)));
	}

	/**
	 * A RESULT OF SOMEBODY WITH NO MEMBER NUMBER CARRIES NO RUNNER, AND NOTHING ELSE ABOUT HIM.
	 *
	 * <p>Article 73 makes the name and the number of a MEMBER public, and an applicant is not one
	 * (V16). The owner's measure for what is not clear is PDL 13.09.2026: „Kad je sporno, polje se
	 * izostavlja i izostavljanje se imenuje sa razlogom, pa se vlasniku javi". So the key is there
	 * and the value is null, and the name is in the answer nowhere else.
	 *
	 * <p><b>Both sides, in one answer.</b> The applicant's row has no runner, and every row that
	 * HAS a number has one: a version that built the runner whatever the number is would name him,
	 * and a version that left it out for everybody would not name the rest. The key is asked for
	 * by presence as well as by value, since an absent key is a shape the next change fills in.
	 */
	@Test
	void aResultOfSomebodyWithNoMemberNumberCarriesNoRunner() throws Exception {
		anApplicantWithNoMemberNumber("Bez", "Broja", "M", "1992-04-04");
		theApplicantRuns("Maraton", "2027-05-05", 42.20, 10, 12, 20000, 70.00);

		List<JsonNode> served = served();
		List<JsonNode> his = served.stream().filter(one -> one.path("memberNumber").isNull()).toList();

		assertThat(his)
				.as("the applicant's run is not served, or he has more than one, so this case measures"
						+ " nothing")
				.hasSize(1);
		assertThat(his.get(0).has("runner"))
				.as("the key is absent for a result with no member number, which is a shape the next"
						+ " change fills in")
				.isTrue();
		assertThat(his.get(0).path("runner").isNull())
				.as("a result with no member number came back with a runner")
				.isTrue();

		assertThat(whole())
				.as("the applicant's name is in the answer, though he is not a member")
				.doesNotContain("Bez")
				.doesNotContain("Broja");

		assertThat(served.stream().filter(one -> !one.path("memberNumber").isNull()).toList())
				.as("a result with a member number came back with no runner")
				.isNotEmpty()
				.allSatisfy(one -> assertThat(one.path("runner").isObject()).isTrue());
	}

	/**
	 * A RESULT CARRIES THE BAND OF THE SEASON IT WAS RUN IN, WHATEVER THE FEE, AND ON WHATEVER DAY
	 * IT IS ASKED FOR.
	 *
	 * <p>Owner, 10.10.2026 (PDL P23), chosen between offered outcomes and against my
	 * recommendation: the band beside an old result is the one its member had in the season of
	 * that result, for a member whose fee stands and for one whose fee has lapsed alike. It
	 * reverses the case that stood here before, which held the band to the day the answer is read
	 * on and not to the day the result was run.
	 *
	 * <p><b>The two members are TWINS.</b> Born on the same day, they ran the same two races, on
	 * the last day of 2027 and the first of 2028, and the only thing that tells them apart is
	 * whether the fee stands. Born in 1988 they are thirty nine in 2027 and forty in 2028, so the
	 * band turns between the two races and the two runs of each come back in two bands. With one
	 * member, "the fee decides which season the band is taken from" is a fault no case about names
	 * can see; and with a member who does not cross a band (the lapsed 000003 of the fixture, forty
	 * two in 2027 and forty three in 2028) every season gives one answer and the case measures
	 * nothing.
	 *
	 * <p><b>The values are WRITTEN OUT</b>, one band for each of the two days, and not worked out
	 * by asking {@code Category} or {@code SeasonClock}: that would compare the server with itself
	 * and pass whatever it became. The floors ask them only whether the boundary and the days are
	 * where the case needs them to be.
	 *
	 * <p><b>Four days, because they are four different relations between the day of the question
	 * and the seasons of the two runs.</b> New Year's night: the season that is running IS the
	 * season of New Year's Day, which is where the band of today and the band of the season cannot
	 * be told apart for that run, so it is the run of 2027 that tells them apart. The autumn of
	 * 2028, when the next season is on sale: it is the season being paid for that moves, and not
	 * the band. A year on: both runs are history, and both seasons are behind the day. And the
	 * autumn of 2026, before the league has begun: the season the list would answer is lifted to
	 * the first season there is, which is the season of the first run, and the second run lies
	 * ahead of it. A version that takes the season from the clock is wrong on at least one run on
	 * at least one of the four days, whichever way it reads the clock.
	 *
	 * <p>The twin whose fee has lapsed is served on each day as the rule of the running season
	 * leaves him (the cases about that rule hold it), and the floor below says which of his runs
	 * those are, so that a comparison of what is left is not mistaken for a comparison of both.
	 */
	@Test
	void aResultCarriesTheBandOfTheSeasonItWasRunInWhateverTheFee() throws Exception {
		aMember("000005", "Peti", "Dvojnik", "M", "1988-06-01", true);
		aMember("000008", "Osmi", "Dvojnik", "M", "1988-06-01", false);
		run("000005", "Docek trka", NEW_YEARS_EVE, 25.00, 5, 5, 16000, 80.00);
		run("000005", "Novogodisnja trka", NEW_YEARS_DAY, 5.00, 5, 5, 1500, 18.00);
		run("000008", "Docek trka", NEW_YEARS_EVE, 25.00, 5, 5, 16100, 79.00);
		run("000008", "Novogodisnja trka", NEW_YEARS_DAY, 5.00, 5, 5, 1550, 17.00);

		assertThat(Category.ageBandFor(1988, 2027))
				.as("born in 1988 they are no longer on the boundary between 2027 and 2028, so the case"
						+ " measures nothing")
				.isNotEqualTo(Category.ageBandFor(1988, 2028));
		assertThat(NEW_YEARS_NIGHT.atZone(SeasonClock.ZONE).getYear())
				.as("New Year's night is no longer in 2028 in Belgrade, so New Year's Day is not the season"
						+ " that is running and the case measures less than it says")
				.isEqualTo(2028);
		assertThat(SeasonClock.seasonBeingPaidFor(INSIDE_THE_TRANSFER_WINDOW.atZone(SeasonClock.ZONE)))
				.as("the season being paid for is the one that is running at this moment, so the sale of"
						+ " the next season cannot be told from the band and the case measures nothing")
				.isNotEqualTo(INSIDE_THE_TRANSFER_WINDOW.atZone(SeasonClock.ZONE).getYear());
		assertThat(A_YEAR_LATER.atZone(SeasonClock.ZONE).getYear())
				.as("a year on is no longer after both seasons of the runs, so the case measures less"
						+ " than it says")
				.isGreaterThan(2028);
		assertThat(AUTUMN_2026.atZone(SeasonClock.ZONE).getYear())
				.as("the autumn of 2026 is no longer before the league's first season, so the case measures"
						+ " less than it says")
				.isLessThan(SeasonClock.FIRST_SEASON);

		/* THE BAND OF EACH DAY, written out: thirty nine on the last day of 2027, forty on the first of
		   2028. */
		Map<String, String> theBandOfTheDay = Map.of(NEW_YEARS_EVE, "25-39", NEW_YEARS_DAY, "40-54");

		/* WHICH RUNS OF THE TWIN WHOSE FEE HAS LAPSED ARE SERVED on each day: both, except while 2028
		   is the season that is running, when New Year's Day is withheld. The one whose fee stands has
		   both on every day. */
		Map<Instant, List<String>> servedOfTheLapsedTwin = Map.of(
				NEW_YEARS_NIGHT, List.of(NEW_YEARS_EVE),
				INSIDE_THE_TRANSFER_WINDOW, List.of(NEW_YEARS_EVE),
				A_YEAR_LATER, List.of(NEW_YEARS_EVE, NEW_YEARS_DAY),
				AUTUMN_2026, List.of(NEW_YEARS_EVE, NEW_YEARS_DAY));

		int compared = 0;

		for (Instant at : List.of(NEW_YEARS_NIGHT, INSIDE_THE_TRANSFER_WINDOW, A_YEAR_LATER, AUTUMN_2026)) {
			clock.moveTo(at);

			assertThat(daysServedFor("000005"))
					.as("at %s the twin whose fee stands is not served both of his runs, so the case"
							+ " measures less than it says", at)
					.containsExactly(NEW_YEARS_EVE, NEW_YEARS_DAY);
			assertThat(daysServedFor("000008"))
					.as("at %s the twin whose fee has lapsed is not served the runs the rule of the running"
							+ " season leaves him, so the case measures less than it says", at)
					.containsExactlyElementsOf(servedOfTheLapsedTwin.get(at));

			for (String number : List.of("000005", "000008")) {
				for (JsonNode row : rowsOf(number)) {
					String day = row.path("date").asString();

					assertThat(runnerOf(row).ageBand())
							.as("at %s the run of %s on %s came back in a band other than the one its own"
									+ " season gives: the band was taken from the day the answer is read on,"
									+ " from the season before the run's, or from the fee", at, number, day)
							.isEqualTo(theBandOfTheDay.get(day));
					compared++;
				}
			}
		}

		assertThat(compared)
				.as("fewer runs than the fixture writes were compared, so the case measures less than it"
						+ " says")
				.isEqualTo(4 * 2 + 1 + 1 + 2 + 2);
	}

	/**
	 * A BAND IS NEVER WORKED OUT FOR A SEASON THE LEAGUE DOES NOT HAVE.
	 *
	 * <p>The league begins in 2027 (PDL P2) and the history imported from before it is served with
	 * the rest, so a result can be older than any season there is. The band beside it is the band
	 * of the first season there is, which is the floor the list stands on. {@code SeasonClock}
	 * keeps the reasoning, and says that this is a derivation and not a thing the owner was asked:
	 * the year the result was run in would put every imported year of every member's history into
	 * the map the 13.09.2026 measurement found the exact year of birth in.
	 *
	 * <p>Born in 1987 they are thirty eight in 2025 and forty in 2027, one on each side of a
	 * boundary, so dropping the floor is a different band and not a different number. The two
	 * members are a pair, one whose fee stands and one whose fee has lapsed, because a floor that
	 * was applied to one of them only would be a rule nobody wrote, and every case about the fee
	 * would pass it. This is the case that stood on the autumn of 2026 before: a band no longer asks
	 * the clock, so what it stands on now is the day of the result.
	 */
	@Test
	void aBandIsNeverWorkedOutForASeasonTheLeagueDoesNotHave() throws Exception {
		event("istorija-2025", "Istorija", "2025-06-01");
		race("istorija-2025", "Stara trka", "2025-06-01", 10.00);
		aMember("000006", "Sesti", "Podni", "M", "1987-06-01", true);
		aMember("000009", "Deveti", "Podni", "M", "1987-06-01", false);
		run("000006", "Stara trka", "2025-06-01", 10.00, 5, 5, 2600, 70.00);
		run("000009", "Stara trka", "2025-06-01", 10.00, 5, 5, 2700, 69.00);

		assertThat(SeasonClock.FIRST_SEASON)
				.as("the league's first season moved, so 2025 is no longer before it and the case measures"
						+ " nothing")
				.isGreaterThan(2025);
		assertThat(Category.ageBandFor(1987, 2025))
				.as("born in 1987 they are no longer on the boundary between 2025 and the first season, so"
						+ " the case measures nothing")
				.isNotEqualTo(Category.ageBandFor(1987, SeasonClock.FIRST_SEASON));

		for (String number : List.of("000006", "000009")) {
			assertThat(rowsOf(number))
					.as("the run before the league is not served for %s, so the case measures nothing", number)
					.hasSize(1)
					.allSatisfy(one -> assertThat(runnerOf(one).ageBand())
							.as("the band of %s was worked out for 2025, a season the league does not have,"
									+ " instead of for its first", number)
							.isEqualTo("40-54"));
		}
	}

	/**
	 * AND A BAND DOES NOT MOVE WHEN THE NEXT SEASON GOES ON SALE.
	 *
	 * <p>From 15 October a payment buys NEXT year and {@code SeasonClock.seasonBeingPaidFor}
	 * answers with it; the band moves once, on 1 January (PDL P7). The two agree for nine months of
	 * the year, so a case standing on any other day passes whichever of them the band used. A
	 * result's band no longer asks the clock at all, so this holds the one way left of bringing the
	 * sale back in: a band worked out for the season being paid for. Born in 1989 he is thirty eight
	 * in 2027, the season of his run, and forty in 2029, the season on sale.
	 */
	@Test
	void aBandDoesNotMoveWhenTheNextSeasonGoesOnSale() throws Exception {
		ZonedDateTime inTheAutumn = INSIDE_THE_TRANSFER_WINDOW.atZone(SeasonClock.ZONE);

		assertThat(SeasonClock.seasonBeingPaidFor(inTheAutumn))
				.as("the season being paid for is not the next one at this moment, so the band and the"
						+ " sale cannot be told apart and the case measures nothing")
				.isEqualTo(2029);

		clock.moveTo(INSIDE_THE_TRANSFER_WINDOW);

		aMember("000007", "Sedmi", "Prodajni", "M", "1989-06-01", true);
		run("000007", "Maraton", "2027-05-05", 42.20, 5, 5, 17000, 78.00);

		assertThat(Category.ageBandFor(1989, 2027))
				.as("born in 1989 he is no longer on the boundary between the season of his run and the one"
						+ " on sale, so the case measures nothing")
				.isNotEqualTo(Category.ageBandFor(1989, 2029));

		assertThat(runnerOf(rowsOf("000007").get(0)).ageBand())
				.as("the band moved because the NEXT season went on sale, without a single birthday")
				.isEqualTo("25-39");
	}

	/**
	 * A RUNNER'S BAND IS THE BAND THE LIST GAVE HIM IN THE SEASON OF THE RESULT, and so is every
	 * other name he has.
	 *
	 * <p>This is the join between two public answers that say the same thing about the same member
	 * and are written in two classes: {@code /api/competitors} and the runner of a result. The list
	 * answers the season that is running and the runner the season of the result (owner,
	 * 10.10.2026), so the two are compared where they must agree: the list is asked while a season
	 * is being run, and every result run in that season is held to it. Three such moments: the
	 * middle of 2027, the middle of 2028, and the autumn of 2026 before the league has begun, where
	 * the list answers the first season there is and so must the runner of a result older than the
	 * league. A runner that agrees with the list on one of them and parts from it on another is the
	 * fault this exists to catch, and it is a different one from the case above, which holds the
	 * runner to the DAY of the result. Here it is held to the other reader of the same rule.
	 *
	 * <p>The member whose fee has lapsed is not on the list, by the decision of 13.09.2026 that
	 * this increment leaves alone, so he is not compared: nothing to compare him with is the very
	 * reason the runner exists. The floors ask that every moment compares what the fixture writes
	 * for it, that more than one band is compared, and that one member is compared in two seasons
	 * and in both of his bands, since a list and a runner that both answered one constant, or one
	 * band for a member whatever the season, would agree on everything.
	 */
	@Test
	void aRunnersBandIsTheBandTheListGaveHimInTheSeasonOfTheResult() throws Exception {
		event("istorija-2025", "Istorija", "2025-06-01");
		race("istorija-2025", "Stara trka", "2025-06-01", 10.00);
		aMember("000005", "Peti", "Granicni", "M", "1988-06-01", true);
		aMember("000006", "Sesti", "Podni", "F", "1987-06-01", true);
		aMember("000007", "Sedmi", "Prodajni", "F", "1989-06-01", true);
		heRunsAsABeginner("000007");
		run("000005", "Maraton", "2027-05-05", 42.20, 5, 5, 16000, 80.00);
		run("000005", "Novogodisnja trka", NEW_YEARS_DAY, 5.00, 5, 5, 1500, 18.00);
		run("000006", "Maraton", "2027-05-05", 42.20, 5, 5, 16500, 79.00);
		run("000006", "Stara trka", "2025-06-01", 10.00, 5, 5, 2600, 70.00);
		run("000007", "Maraton", "2027-05-05", 42.20, 5, 5, 17000, 78.00);

		/* THE MOMENTS ARE CHOSEN BY THE RUNS THEY HOLD. The middle of 2027 holds the runs of 2027, the
		   middle of 2028 the runs of 2028, and the autumn of 2026 holds the run older than the league,
		   which the list answers with its first season. `rows` is how many runs of members on the list
		   each one holds, written out. */
		record Moment(Instant at, int fromYear, int toYear, int rows) {
		}

		List<Moment> theMoments = List.of(
				new Moment(Instant.parse("2027-06-15T12:00:00Z"), 2027, 2027, 6),
				new Moment(Instant.parse("2028-06-15T12:00:00Z"), 2028, 2028, 2),
				new Moment(AUTUMN_2026, 0, 2026, 1));

		Map<String, Set<String>> bandsOfEachMember = new HashMap<>();
		Set<String> bandsCompared = new HashSet<>();

		for (Moment moment : theMoments) {
			clock.moveTo(moment.at());

			Map<String, TheRunner> theList = new HashMap<>();

			for (JsonNode one : new ObjectMapper().readTree(http.perform(get("/api/competitors"))
					.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8))) {
				theList.put(one.path("memberNumber").asString(), fiveNamesIn(one));
			}

			int compared = 0;

			for (JsonNode row : served()) {
				int year = Integer.parseInt(row.path("date").asString().substring(0, 4));
				String number = row.path("memberNumber").asString();
				TheRunner onTheList = theList.get(number);

				if (year < moment.fromYear() || year > moment.toYear() || onTheList == null) {
					continue;
				}

				assertThat(runnerOf(row))
						.as("at %s the runner of %s, run on %s, is not the member the list gives while that"
								+ " season is being run", moment.at(), number, row.path("date").asString())
						.isEqualTo(onTheList);
				compared++;
				bandsOfEachMember.computeIfAbsent(number, key -> new HashSet<>()).add(onTheList.ageBand());
				bandsCompared.add(onTheList.ageBand());
			}

			assertThat(compared)
					.as("at %s fewer results than the fixture writes for members on the list were compared,"
							+ " so the case measures less than it says", moment.at())
					.isEqualTo(moment.rows());
		}

		assertThat(bandsOfEachMember.get("000005"))
				.as("the member who crosses a band was not compared in both of his bands, so a runner that"
						+ " answered one band for him whatever the season would satisfy the comparison")
				.containsExactlyInAnyOrder("25-39", "40-54");
		assertThat(bandsCompared)
				.as("every member compared is in one band, so a constant would satisfy the comparison")
				.hasSizeGreaterThan(1);
	}

	/**
	 * THE ANSWER IS THE SAME TO EVERY READER, to the byte.
	 *
	 * <p>Article 73 makes the record public, and the runner is part of it; nothing in it depends on
	 * who asks. Whether a name is drawn as a link is decided on the screen, by the reader and the
	 * record ({@code frontend/src/pages/profile/visible.ts}), and not by this answer. The readers are the
	 * visitor, a member whose fee stands, the member whose fee has lapsed (who reads as a visitor
	 * does), an account that is no member at all, and the administration. None of them takes a
	 * different answer, and {@code everyNameThatDependsOnTheReader.test.ts} holds the other half:
	 * that this route never takes the caller.
	 *
	 * <p><b>The floor is that the sessions are real.</b> A cookie nobody recognised would be
	 * answered as a visitor is, and the comparison would hold for the wrong reason; each of the
	 * four accounts is shown to be signed in by the one route that refuses a visitor.
	 */
	@Test
	void theAnswerIsTheSameToEveryReader() throws Exception {
		anAccount("clan@primer.rs", "competitor", "Ime", "Clana");
		belongsTo("clan@primer.rs", "000001");
		anAccount("istekao@primer.rs", "competitor", "Ime", "Isteklog");
		belongsTo("istekao@primer.rs", THE_LAPSED_MEMBER);
		anAccount("slobodan@primer.rs", "competitor", "Ime", "Slobodnog");
		anAccount("uprava@primer.rs", "superadmin", "Ime", "Uprave");

		assertThat(http.perform(get("/api/me")).andReturn().getResponse().getStatus())
				.as("a visitor was let into the route that is for members, so it cannot show who is"
						+ " signed in")
				.isEqualTo(401);

		for (String email : sessions.keySet()) {
			assertThat(http.perform(get("/api/me")
					.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
					.andReturn().getResponse().getStatus())
					.as("%s is not signed in, so the comparison below would hold for the wrong reason", email)
					.isEqualTo(200);
		}

		String theVisitors = wholeFor(null);

		assertThat(theVisitors)
				.as("the visitor's answer does not name the member whose fee has lapsed, so the readers"
						+ " below are compared on less than the case says")
				.contains("Neclan");

		for (String email : sessions.keySet()) {
			assertThat(wholeFor(email))
					.as("%s is answered something other than a visitor is", email)
					.isEqualTo(theVisitors);
		}
	}

	/**
	 * THE CLOCK IS NOT ASKED AGAIN FOR EACH ROW OF THE ANSWER.
	 *
	 * <p>Since 10.10.2026 a band does not ask the clock at all: it is worked out for the season of
	 * the result's own day. The one question the clock is still asked on this route is which season
	 * is running, to withhold it from a member whose fee has lapsed, and it is asked once for the
	 * whole answer. A clock read per row would be a cost that grows with the answer and a second
	 * opinion about which season is running inside one answer, on the one night of the year that
	 * opinion changes. It is measured as the thing it is: the number of times the server asked what
	 * time it is, which must not grow with the number of rows.
	 *
	 * <p><b>It does not say one.</b> The count is compared between a short answer and a longer one
	 * and not with a number written down, so a second question asked once per request (the
	 * increment that makes the fee a derived fact will want the moment too) is for that increment
	 * to decide, and the one thing this refuses is a question asked per row. The floors are that
	 * the server asks at all and that the second answer really is longer.
	 */
	@Test
	void theClockIsNotAskedAgainForEachRowOfTheAnswer() throws Exception {
		clock.forgetBeingAsked();

		int fewRows = served().size();
		int askedForFew = clock.timesAsked();

		run("000001", "Polumaraton", "2027-03-01", 21.10, 1, 1, 6000, 30.00);
		run("000001", "Docek trka", NEW_YEARS_EVE, 25.00, 1, 1, 7000, 40.00);
		run("000002", "Desetka", "2027-03-01", 10.00, 1, 1, 2500, 44.00);

		clock.forgetBeingAsked();

		int manyRows = served().size();

		assertThat(askedForFew)
				.as("the server never asked what time it is, so the season is not read from the clock")
				.isGreaterThanOrEqualTo(1);
		assertThat(manyRows)
				.as("the second answer is not longer than the first, so the case measures nothing")
				.isGreaterThan(fewRows);
		assertThat(clock.timesAsked())
				.as("the server asked what time it is more often for a longer answer, which is the clock"
						+ " read once per row")
				.isEqualTo(askedForFew);
	}

	/**
	 * A CLOCK THE CASE MOVES, because the question is about a boundary in time.
	 *
	 * <p>It reports UTC as its zone on purpose: whoever asks what season it is has to
	 * re-read the instant in the league's own time, and a server that reads this zone
	 * instead answers 2027 on a night that is already 2028 in Belgrade.
	 *
	 * <p><b>It counts how often it is asked, and a clock derived from it asks it.</b>
	 * {@code clock.withZone(...)} is how the server reads the year in the league's zone, and a
	 * derived clock that was frozen at the moment of deriving would answer without this one ever
	 * being asked: a clock read per row through it would be invisible to the count, which is how
	 * {@code theClockIsNotAskedAgainForEachRowOfTheAnswer} first came to pass for the wrong reason.
	 */
	static final class AClockTheCaseMoves extends Clock {

		private Instant now;

		/** How many times the server has asked what time it is since a case last forgot. */
		private int asked;

		private AClockTheCaseMoves(Instant now) {
			this.now = now;
		}

		void moveTo(Instant when) {
			this.now = when;
		}

		/** Where the clock stands, asked by a CASE and so not counted as the server asking. */
		Instant standingAt() {
			return now;
		}

		int timesAsked() {
			return asked;
		}

		void forgetBeingAsked() {
			asked = 0;
		}

		@Override
		public Instant instant() {
			asked++;

			return now;
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			AClockTheCaseMoves theClockItCameFrom = this;

			return new Clock() {

				@Override
				public ZoneId getZone() {
					return zone;
				}

				@Override
				public Clock withZone(ZoneId another) {
					return theClockItCameFrom.withZone(another);
				}

				@Override
				public Instant instant() {
					return theClockItCameFrom.instant();
				}
			};
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
