package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * TWO PEOPLE BECOMING A RACING PAIR, END TO END: who may ask, who may answer, what the
 * answer makes, and what it breaks.
 *
 * <p><b>A PAIR HAS TWO SIDES AND THEY ARE SYMMETRIC, WHICH MAKES THIS THE DENSEST PLACE ON
 * THE PORTAL FOR A CASE THAT MEASURES NOTHING.</b> Every axis below is separated on purpose,
 * and each line says which wrong implementation would otherwise pass:
 *
 * <ul>
 * <li><b>Thirteen members, and nobody who acts is the first by key.</b> The two written first
 * ask nothing and answer nothing in most cases, so „the member asking" and „the first member"
 * are never one number.
 * <li><b>A man asks in one accepted case and a WOMAN asks in the other.</b> With only one
 * direction, „the man" and „the one who asked" are the same person and a route that never
 * looked at a gender column writes the right row.
 * <li><b>Both halves of the accepting pair already hold a pair, with two DIFFERENT people.</b>
 * So „accepting breaks the asker's pair" and „accepting breaks both" are two different
 * databases afterwards, which is the finding of 07.09.2026 written as a fixture.
 * <li><b>A third pair belongs to neither of them and must survive</b>, so „break the old ones"
 * and „empty the season" are two different statements.
 * <li><b>And a fourth belongs to one of them for ANOTHER season and must survive too</b>,
 * which is „par iz sezone koja je prosla se nikad ne dira" and is also the only way to see
 * that the delete carries a season at all.
 * <li><b>The question that is answered was sent in a DIFFERENT YEAR from the day it is
 * answered</b> (31 December 2026, answered in March 2027), because that is the one shape in
 * which „the deadline hangs on the confirmation" and „the deadline hangs on the question"
 * give different seasons. It is the owner's own correction of 07.09.2026 as a fixture.
 * <li><b>The clock stands in MARCH</b>, where {@link SeasonClock#transfersTakeEffect} and
 * {@link SeasonClock#seasonBeingPaidFor} differ by a whole season. Inside the transfer window
 * the two agree and either would pass.
 * <li><b>Every pair in the fixture was made in a year that is neither</b>, so „the season" and
 * „the year it was made, plus one" are two numbers.
 * <li><b>A second question stands between two other people all the way through</b>, and it is
 * written FIRST, so „this question" is never „the only question" and never „the first one".
 * <li><b>Nothing is read back out of an answer that was sent in.</b> Every assertion about
 * what was written reads the row.
 * </ul>
 *
 * <p><b>Authorisation as a rule is not swept here.</b> This route carries no
 * {@link RightIsNeeded} and needs none - pairing up is what every member may do. What IS
 * measured is the one thing no sweep can see either way: that a stranger is refused before the
 * handler runs, which is {@code ApiSecurity} opening {@code /api/pairs} for reading and not
 * for writing.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class PairWriteApiTest {

	/**
	 * Noon in Belgrade on 15 March 2027, and every word of that is chosen.
	 *
	 * <p>MARCH, because {@link SeasonClock#transfersTakeEffect} answers 2028 there while
	 * {@link SeasonClock#seasonBeingPaidFor} answers 2027: inside the transfer window the two
	 * agree and a route reading the wrong one is right anyway. 2027, because the season it
	 * hands back is then 2028 and the season that is RUNNING is 2027, which is the season the
	 * pair that must survive belongs to.
	 */
	private static final Instant IN_MARCH = Instant.parse("2027-03-15T11:00:00Z");

	/** The season a pair confirmed at {@link #IN_MARCH} holds for. */
	private static final int BEING_FORMED = 2028;

	/** The season being run at {@link #IN_MARCH}, and the one a pair must not be moved out of. */
	private static final int STILL_RUNNING = 2027;

	/**
	 * The day the question that gets answered was sent.
	 *
	 * <p>The owner's own day: „Poziv poslat 31.12.2026 i prihvacen 02.01.2027 pravi par za
	 * 2028, ne za 2027" (PDL P13, 07.09.2026). Read off this day the season would be 2027.
	 */
	private static final String ASKED_ON = "2026-12-31 12:00:00+00";

	/** Written first, in nothing, and the one both „the first member" readings would hit. */
	private static final String FIRST_MAN = "000100";

	private static final String FIRST_WOMAN = "000200";

	/** The member most of the asking cases ask with, written third. */
	private static final String HE_ASKS = "000300";

	private static final String SHE_IS_ASKED = "000400";

	/** A woman who ASKED, so „the man" and „the one who asked" are two people. */
	private static final String SHE_ASKS = "000500";

	private static final String HE_IS_ASKED = "000600";

	/** Who sent the question that is answered. He holds a pair for the season being formed. */
	private static final String HE_ASKED_HER = "000700";

	/** Who answers it. She holds a pair of her own, with somebody else again. */
	private static final String SHE_ANSWERS = "000800";

	/** His partner until the answer comes: the THIRD person, who pressed nothing. */
	private static final String THE_THIRD = "000900";

	/** Hers: the FOURTH person, and the whole reason „on both sides" is a fixture and not a word. */
	private static final String THE_FOURTH = "001000";

	/** Two people whose pair has nothing to do with any of this and must be there afterwards. */
	private static final String UNTOUCHED_MAN = "001100";

	private static final String UNTOUCHED_WOMAN = "001200";

	/** The woman {@link #HE_ASKED_HER} is running the CURRENT season with, which is not touched. */
	private static final String RUNNING_WOMAN = "001300";

	private static final String MODERATOR_WHO_DOES_NOT_RACE = "moderator@primer.rs";

	/** A number nobody in the fixture carries, and the fixture says so out loud. */
	private static final String NOBODY = "999999";

	/** The year every pair in the fixture was made in, which is neither season it uses. */
	private static final String MADE_IN = "2025-05-05 12:00:00+00";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Autowired
	private AClockTheCaseMoves clock;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	/**
	 * A CLOCK THE CASE MOVES, because the season is decided on the day of the answer and both
	 * sides of a New Year have to be asked in one fixture.
	 *
	 * <p>It reports UTC as its zone on purpose, the same shape {@code ResultApiTest} uses:
	 * whoever works out a season has to re-read the instant in the league's own time, and a
	 * server that reads this zone instead answers with the wrong year on the one night that
	 * matters.
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

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		AClockTheCaseMoves aClockTheCaseMoves() {
			return new AClockTheCaseMoves(IN_MARCH);
		}
	}

	@BeforeEach
	void thirteenMembersFourPairsAndThreeQuestions() {
		clock.moveTo(IN_MARCH);

		member(FIRST_MAN, "M");
		member(FIRST_WOMAN, "F");
		member(HE_ASKS, "M");
		member(SHE_IS_ASKED, "F");
		member(SHE_ASKS, "F");
		member(HE_IS_ASKED, "M");
		member(HE_ASKED_HER, "M");
		member(SHE_ANSWERS, "F");
		member(THE_THIRD, "F");
		member(THE_FOURTH, "M");
		member(UNTOUCHED_MAN, "M");
		member(UNTOUCHED_WOMAN, "F");
		member(RUNNING_WOMAN, "F");

		moderatorWithNoCompetitor();

		/* THE TWO THAT THE ANSWER MUST BREAK, and they are two different pairs with two
		   different people. Written against a route that only breaks the asker's, the second
		   of them stays and the insert is then refused by `racing_pair_one_woman_a_season`. */
		pair(BEING_FORMED, HE_ASKED_HER, THE_THIRD);
		pair(BEING_FORMED, THE_FOURTH, SHE_ANSWERS);

		/* THE ONE THAT MUST NOT GO, of the same season and of neither of them. */
		pair(BEING_FORMED, UNTOUCHED_MAN, UNTOUCHED_WOMAN);

		/* AND THE ONE THAT MUST NOT GO EITHER, of HIS, for the season that is being RUN.
		   „Par iz sezone koja je prosla se nikad ne dira" (PDL, 07.09.2026), and it is also the
		   pair that lets a member hold two at once („Od 1. januara clan sme da drzi dva"). */
		pair(STILL_RUNNING, HE_ASKED_HER, RUNNING_WOMAN);

		/* WRITTEN FIRST AND NEVER TOUCHED, so „this question" is never „the first question". */
		question(FIRST_MAN, FIRST_WOMAN, ASKED_ON);

		/* The one that gets answered, sent in a year that is not the year of the answer. */
		question(HE_ASKED_HER, SHE_ANSWERS, ASKED_ON);

		/* And one a WOMAN sent, so the man may be the one who answers. */
		question(SHE_ASKS, HE_IS_ASKED, ASKED_ON);
	}

	private void member(String number, String gender) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', ?, ?, date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.params(number, "Probic" + number, gender, String.format("%016x", ++issued))
				.update();

		account(number + "@primer.rs", number);
	}

	private void pair(int season, String man, String woman) {
		db.sql("insert into racing_pair (season, man_id, woman_id, made_at) values (?,"
						+ " (select id from competitor where member_number = ?),"
						+ " (select id from competitor where member_number = ?),"
						+ " timestamptz '" + MADE_IN + "')")
				.params(season, man, woman).update();
	}

	private void question(String from, String to, String sentAt) {
		db.sql("insert into pair_invite (from_id, to_id, sent_at) values ("
						+ " (select id from competitor where member_number = ?),"
						+ " (select id from competitor where member_number = ?),"
						+ " timestamptz '" + sentAt + "')")
				.params(from, to).update();
	}

	private void account(String email, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, memberNumber).update();

		openSession(email);
	}

	/** An account naming no member at all, which V23 calls the ordinary case for a moderator. */
	private void moderatorWithNoCompetitor() {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Moderator', 'Bezimeni', ?, (select id from role where code = 'moderator'))")
				.param(MODERATOR_WHO_DOES_NOT_RACE).update();

		openSession(MODERATOR_WHO_DOES_NOT_RACE);
	}

	private void openSession(String email) {
		SecretToken session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	private Cookie cookieOf(String memberNumber) {
		return new Cookie(SessionCookie.NAME, sessions.get(memberNumber + "@primer.rs").secret());
	}

	private MockHttpServletResponse askAs(String memberNumber, String body) throws Exception {
		return sent(post("/api/pairs"), body, cookieOf(memberNumber));
	}

	private MockHttpServletResponse answerAs(String memberNumber, long question, String body)
			throws Exception {

		return sent(put("/api/pairs/" + question), body, cookieOf(memberNumber));
	}

	/**
	 * @param carrying the session, or null for somebody who has none - which is not the same
	 *                 request with an empty list of cookies but a request with no cookie header
	 *                 at all, the way a browser that has never signed in sends one
	 */
	private MockHttpServletResponse sent(MockHttpServletRequestBuilder where, String body,
			Cookie carrying) throws Exception {

		MockHttpServletRequestBuilder asking =
				where.with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body);

		return http.perform(carrying == null ? asking : asking.cookie(carrying))
				.andReturn().getResponse();
	}

	private String asking(String memberNumber) {
		return mapper.writeValueAsString(new PairWriteApi.Asked(memberNumber));
	}

	private String answering(Boolean accepted) {
		return mapper.writeValueAsString(new PairWriteApi.Answered(accepted));
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("reason").asString();
	}

	private long idIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("id").asLong();
	}

	private long competitorId(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single();
	}

	/** The question standing between these two in that direction, which is at most one (V12). */
	private long questionFrom(String from, String to) {
		return db.sql("select id from pair_invite where from_id = ? and to_id = ?")
				.params(competitorId(from), competitorId(to)).query(Long.class).single();
	}

	private long howManyQuestions() {
		return db.sql("select count(*) from pair_invite").query(Long.class).single();
	}

	private long howManyPairs() {
		return db.sql("select count(*) from racing_pair").query(Long.class).single();
	}

	/** Whether a question still stands between these two, in either direction. */
	private boolean questionStandsBetween(String one, String other) {
		return db.sql("select count(*) from pair_invite where (from_id = ? and to_id = ?)"
						+ " or (from_id = ? and to_id = ?)")
				.params(competitorId(one), competitorId(other), competitorId(other),
						competitorId(one))
				.query(Long.class).single() > 0;
	}

	/**
	 * The seasons this member holds a pair in, ASKED FROM BOTH COLUMNS.
	 *
	 * <p>Read off {@code man_id} alone, a pair written only on one side of the table answers
	 * the same as one written properly, and a pair is exactly the thing that has two sides.
	 */
	private List<Integer> seasonsPairedIn(String memberNumber) {
		return db.sql("select season from racing_pair where man_id = ? or woman_id = ?"
						+ " order by season")
				.params(competitorId(memberNumber), competitorId(memberNumber))
				.query(Integer.class).list();
	}

	/** One pair read back whole, by BOTH of its people and its season at once. */
	private long pairOf(String man, String woman, int season) {
		return db.sql("select id from racing_pair where man_id = ? and woman_id = ? and season = ?")
				.params(competitorId(man), competitorId(woman), season)
				.query(Long.class).single();
	}

	private long howManyPairsOf(String man, String woman, int season) {
		return db.sql("select count(*) from racing_pair where man_id = ? and woman_id = ?"
						+ " and season = ?")
				.params(competitorId(man), competitorId(woman), season)
				.query(Long.class).single();
	}

	/**
	 * THE FIXTURE SEPARATES THE AXES IT SAYS IT SEPARATES, asked of the database rather than
	 * trusted from the constants above.
	 *
	 * <p>Every assertion in this file rests on one of these, and each of them is a way the
	 * whole file could measure nothing: two seasons that are secretly one number make „the
	 * season being formed" unmeasurable, a question sent on the day it is answered makes „the
	 * deadline hangs on the confirmation" and „on the question" one answer, and a fixture where
	 * only one of the two holds a pair cannot tell „breaks his" from „breaks both".
	 */
	@Test
	void theFixtureSeparatesTheAxesItSaysItSeparates() {
		assertThat(List.of(BEING_FORMED, STILL_RUNNING,
						SeasonClock.transfersTakeEffect(IN_MARCH.atZone(SeasonClock.ZONE)),
						SeasonClock.seasonBeingPaidFor(IN_MARCH.atZone(SeasonClock.ZONE))))
				.as("the season being formed and the one being run are one number, or the two"
						+ " season questions answer alike at this moment, so a route asking the"
						+ " wrong one answers correctly anyway")
				.containsExactly(BEING_FORMED, STILL_RUNNING, BEING_FORMED, STILL_RUNNING);

		assertThat(SeasonClock.transfersTakeEffect(
				Instant.parse("2026-12-31T11:00:00Z").atZone(SeasonClock.ZONE)))
				.as("the question was sent on a day that answers with the same season as the day"
						+ " it is answered on, so reading the deadline off the question and off the"
						+ " confirmation are one answer here")
				.isNotEqualTo(BEING_FORMED);

		assertThat(db.sql("select count(*) from racing_pair"
						+ " where season = extract(year from made_at)::int + 1")
				.query(Long.class).single())
				.as("some pair in the fixture holds for the year after it was made, so the season"
						+ " column and the year it was made plus one are the same number for it")
				.isZero();

		assertThat(seasonsPairedIn(HE_ASKED_HER))
				.as("the member who asked does not hold exactly one pair for the season being"
						+ " formed and one for the season being run, which is the whole of what"
						+ " breaking both sides and never touching another season are measured"
						+ " against")
				.containsExactly(STILL_RUNNING, BEING_FORMED);
		assertThat(seasonsPairedIn(SHE_ANSWERS))
				.as("the member who answers holds no pair for the season being formed, so a route"
						+ " that only ever breaks the asker's passes every case below")
				.containsExactly(BEING_FORMED);

		assertThat(competitorId(HE_ASKED_HER))
				.as("the member who asks is the first competitor by key, so he and the first"
						+ " written member are one number")
				.isNotEqualTo(db.sql("select min(id) from competitor").query(Long.class).single());

		assertThat(questionFrom(HE_ASKED_HER, SHE_ANSWERS))
				.as("the question that gets answered is the first one by key, so this question and"
						+ " the first question are one number")
				.isNotEqualTo(db.sql("select min(id) from pair_invite").query(Long.class).single());

		assertThat(db.sql("select count(*) from competitor where member_number = ?")
				.param(NOBODY).query(Long.class).single())
				.as("the number this file calls nobody's belongs to somebody").isZero();

		assertThat(seasonsPairedIn(RUNNING_WOMAN))
				.as("the one member whose only pair is of another season does not have one, so the"
						+ " other side of the refusal over an existing pair cannot be measured")
				.containsExactly(STILL_RUNNING);

		assertThat(howManyPairs()).isEqualTo(4);
		assertThat(howManyQuestions()).isEqualTo(3);
	}

	/**
	 * A MEMBER ASKS ANOTHER, AND WHAT IS WRITTEN IS A QUESTION AND NOT A PAIR.
	 *
	 * <p>„svako sme da posalje zahtev svakome, a par nastaje kad druga strana potvrdi" (PDL
	 * P13). The count of pairs is taken afterwards because that is the half of this route that
	 * is easiest to get wrong in the direction nobody notices: a pair written here is a pair
	 * nobody agreed to.
	 *
	 * <p>The answer's id is read against the row AND against the question that was standing
	 * first, so „the question this made" is never „the only question" and never „the first".
	 */
	@Test
	void aMemberAsksAnotherAndWhatStandsIsAQuestion() throws Exception {
		long pairsBefore = howManyPairs();
		long questionsBefore = howManyQuestions();

		MockHttpServletResponse answer = askAs(HE_ASKS, asking(SHE_IS_ASKED));

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(howManyQuestions())
				.as("the question was not written")
				.isEqualTo(questionsBefore + 1);
		assertThat(howManyPairs())
				.as("a pair was made by somebody asking, and a pair is made by both of them"
						+ " confirming")
				.isEqualTo(pairsBefore);

		assertThat(idIn(answer))
				.as("the answer names some other question than the one it just wrote")
				.isEqualTo(questionFrom(HE_ASKS, SHE_IS_ASKED))
				.isNotEqualTo(questionFrom(FIRST_MAN, FIRST_WOMAN));

		assertThat(mapper.readTree(answer.getContentAsString()).path("memberNumber").asString())
				.as("the answer does not name the member the stored question really reaches")
				.isEqualTo(db.sql("select c.member_number from pair_invite i"
								+ " join competitor c on c.id = i.to_id where i.id = ?")
						.param(idIn(answer)).query(String.class).single())
				.isEqualTo(SHE_IS_ASKED);

		assertThat(db.sql("select from_id from pair_invite where id = ?").param(idIn(answer))
				.query(Long.class).single())
				.as("the question was filed as coming from somebody other than the member who"
						+ " sent it")
				.isEqualTo(competitorId(HE_ASKS));
	}

	/**
	 * ASKING SOMEBODY OF THE SAME GENDER IS REFUSED AS A SENTENCE.
	 *
	 * <p>„Trkacki par mora biti mesovit, jedan muskarac i jedna zena" (PDL P13). V12 holds the
	 * rule over the PAIR and deliberately not over the question - „a question that turns out to
	 * be impossible is answered „no", it is not a row the database refuses to store" - so
	 * nothing in the schema stops this one and the refusal has to be here. The screen does not
	 * draw the button either ({@code profile/InviteToPair.tsx}).
	 *
	 * <p>Both directions, because a condition written about one gender passes the other.
	 */
	@ParameterizedTest
	@CsvSource({FIRST_MAN + ", " + HE_ASKS, FIRST_WOMAN + ", " + SHE_IS_ASKED})
	void askingSomebodyOfTheSameGenderIsRefused(String who, String whom) throws Exception {
		long questionsBefore = howManyQuestions();

		MockHttpServletResponse answer = askAs(who, asking(whom));

		assertThat(answer.getStatus())
				.as("%s asked %s, who is of the same gender, and was not refused", who, whom)
				.isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(PairWriteApi.THE_PAIR_WOULD_NOT_BE_MIXED);
		assertThat(howManyQuestions()).isEqualTo(questionsBefore);
	}

	/**
	 * A QUESTION ALREADY STANDING BETWEEN THE TWO IS REFUSED, IN EITHER DIRECTION.
	 *
	 * <p>The second half of that is stricter than the schema and deliberately so. V12 refuses
	 * only the same direction and says why: „the screen hides the button when a question stands
	 * either way, but that is the screen deciding". This is the server making the screen's
	 * decision ({@code profile/InviteToPair.tsx} compares a SET of the two of them), so one
	 * pair cannot be two questions in two inboxes with two answers.
	 *
	 * <p>Read as the schema reads it, the second row below is written and the case is green.
	 */
	@ParameterizedTest
	@CsvSource({FIRST_MAN + ", " + FIRST_WOMAN, FIRST_WOMAN + ", " + FIRST_MAN})
	void aQuestionAlreadyStandingBetweenTheTwoIsRefusedInEitherDirection(String who, String whom)
			throws Exception {

		long questionsBefore = howManyQuestions();

		MockHttpServletResponse answer = askAs(who, asking(whom));

		assertThat(answer.getStatus())
				.as("%s asked %s while a question already stood between them, and it was written"
						+ " anyway", who, whom)
				.isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(PairWriteApi.A_QUESTION_ALREADY_STANDS);
		assertThat(howManyQuestions()).isEqualTo(questionsBefore);
	}

	/**
	 * AND SO IS ASKING WHEN EITHER OF THEM ALREADY HOLDS A PAIR FOR THE SEASON BEING FORMED.
	 *
	 * <p>PDL P13, 07.09.2026 names it among the conditions under which the button is drawn at
	 * all: „nijedno od njih dvoje nema trkacki par za sezonu koja se formira". The refusal
	 * carries a reason rather than an empty 404 because it is a state the two of them can see
	 * for themselves - each knows his own pair - unlike the two refusals above it that say
	 * nothing about anybody.
	 *
	 * <p>Both sides, because a condition written about the asker passes the one about the
	 * person asked, and the two are the same sentence read twice.
	 */
	@ParameterizedTest
	@CsvSource({HE_ASKS + ", " + UNTOUCHED_WOMAN, UNTOUCHED_MAN + ", " + SHE_IS_ASKED})
	void askingWhenEitherOfThemAlreadyHoldsAPairIsRefused(String who, String whom)
			throws Exception {

		long questionsBefore = howManyQuestions();

		MockHttpServletResponse answer = askAs(who, asking(whom));

		assertThat(answer.getStatus())
				.as("%s asked %s although one of them already holds a pair for the season being"
						+ " formed", who, whom)
				.isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(PairWriteApi.A_PAIR_ALREADY_HOLDS);
		assertThat(howManyQuestions()).isEqualTo(questionsBefore);
	}

	/**
	 * BUT A PAIR OF ANOTHER SEASON DOES NOT STAND IN THE WAY, WHICH IS THE OTHER SIDE OF THAT
	 * BOUNDARY.
	 *
	 * <p>„Od 1. januara clan sme da drzi dva: onaj u kom trci sezonu koja tece, i onaj
	 * napravljen za sledecu" (PDL P13, 07.09.2026). {@link #RUNNING_WOMAN} holds one for the
	 * season being RUN and none for the one being formed, so a condition written without a
	 * season refuses her and every case above stays green.
	 */
	@Test
	void aPairOfAnotherSeasonDoesNotStandInTheWayOfAsking() throws Exception {
		long questionsBefore = howManyQuestions();

		assertThat(askAs(FIRST_MAN, asking(RUNNING_WOMAN)).getStatus())
				.as("a member was refused over a pair that belongs to a season nobody is forming")
				.isEqualTo(201);

		assertThat(howManyQuestions()).isEqualTo(questionsBefore + 1);
	}

	/**
	 * ASKING SOMEBODY THE PORTAL DOES NOT HAVE, AND ASKING YOURSELF, ARE ONE ANSWER.
	 *
	 * <p>Neither is a form filled in wrongly: V12 refuses the second outright („Nobody invites
	 * himself") and the screen offers neither, so both are an address that is not there for
	 * him. The body is empty for the owner's reason of 05.09.2026: „adresa koju clan ne sme da
	 * otvori nije strana sa objasnjenjem nego adresa koje za njega nema."
	 */
	@ParameterizedTest
	@ValueSource(strings = {NOBODY, HE_ASKS})
	void askingNobodyAndAskingYourselfAreTheSameAnswer(String whom) throws Exception {
		long questionsBefore = howManyQuestions();

		MockHttpServletResponse answer = askAs(HE_ASKS, asking(whom));

		assertThat(answer.getStatus())
				.as("asking %s was answered as something other than an address that is not there",
						whom)
				.isEqualTo(404);
		assertThat(answer.getContentAsString())
				.as("the refusal explains itself, and the owner deleted the sentence that did")
				.isEmpty();
		assertThat(howManyQuestions()).isEqualTo(questionsBefore);
	}

	/**
	 * A FORM THAT NAMES NOBODY IS REFUSED.
	 *
	 * <p>Absent, empty and a run of spaces are one answer and not three: JSON has a null, a
	 * form has an empty box and a person has a space bar.
	 */
	@ParameterizedTest
	@CsvSource(nullValues = "NIC", value = {"NIC", "''", "'   '"})
	void aFormThatNamesNobodyIsRefused(String memberNumber) throws Exception {
		MockHttpServletResponse answer = askAs(HE_ASKS, asking(memberNumber));

		assertThat(answer.getStatus())
				.as("memberNumber=[%s] was accepted", memberNumber)
				.isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(PairWriteApi.THE_FORM_IS_NOT_COMPLETE);
	}

	/** And a number is read as the number it names, whatever whitespace came round it. */
	@Test
	void aNumberIsReadWithoutTheSpacesRoundIt() throws Exception {
		assertThat(askAs(HE_ASKS, asking("  " + SHE_IS_ASKED + "  ")).getStatus()).isEqualTo(201);

		assertThat(db.sql("select count(*) from pair_invite where from_id = ? and to_id = ?")
				.params(competitorId(HE_ASKS), competitorId(SHE_IS_ASKED))
				.query(Long.class).single())
				.as("the question did not reach the member whose number was sent")
				.isOne();
	}

	/**
	 * ACCEPTING MAKES THE PAIR AND TAKES BOTH OF THEM OUT OF WHAT THEY WERE IN.
	 *
	 * <p>This is the case the whole fixture is built for. PDL P13, 07.09.2026, on a review
	 * finding: „Prihvatanje raskida par na OBE strane, ne samo kod onoga ko je pitao...
	 * prihvatanje izvodi OBA clana iz onoga u cemu su za tu sezonu." Written to break only the
	 * asker's, the second pair stands and {@code racing_pair_one_woman_a_season} then refuses
	 * the new row - so the route would answer a server fault rather than a pair, which is a
	 * failure this case sees as a status and as two empty seasons.
	 *
	 * <p><b>And three things must NOT move</b>, each of which a statement that lost its
	 * condition would take with it: the pair of two people who have nothing to do with this,
	 * the pair {@link #HE_ASKED_HER} is running the CURRENT season in, and the question
	 * standing between two other people.
	 */
	@Test
	void acceptingMakesThePairAndBreaksWhatBothOfThemWereIn() throws Exception {
		long question = questionFrom(HE_ASKED_HER, SHE_ANSWERS);
		long untouched = pairOf(UNTOUCHED_MAN, UNTOUCHED_WOMAN, BEING_FORMED);
		long running = pairOf(HE_ASKED_HER, RUNNING_WOMAN, STILL_RUNNING);

		MockHttpServletResponse answer = answerAs(SHE_ANSWERS, question, answering(true));

		assertThat(answer.getStatus()).isEqualTo(200);

		assertThat(mapper.readTree(answer.getContentAsString()).path("season").asInt())
				.as("the pair was made for some season other than the one being formed on the day"
						+ " of the answer")
				.isEqualTo(BEING_FORMED);
		assertThat(idIn(answer))
				.as("the answer names something other than the pair that was written, read back"
						+ " by BOTH of its people and its season at once")
				.isEqualTo(pairOf(HE_ASKED_HER, SHE_ANSWERS, BEING_FORMED));

		assertThat(seasonsPairedIn(THE_THIRD))
				.as("the third member kept the pair the acceptance took from him, so the asker's"
						+ " side was not broken")
				.isEmpty();
		assertThat(seasonsPairedIn(THE_FOURTH))
				.as("the fourth member kept his, so the ANSWERING side was not broken - which is"
						+ " the exact finding of 07.09.2026")
				.isEmpty();

		assertThat(seasonsPairedIn(HE_ASKED_HER))
				.as("the member who asked does not hold exactly the pair he was running and the"
						+ " one he has just made, which is the two the owner allows")
				.containsExactly(STILL_RUNNING, BEING_FORMED);
		assertThat(seasonsPairedIn(SHE_ANSWERS))
				.as("the member who answered holds some number of pairs other than the one she"
						+ " just made")
				.containsExactly(BEING_FORMED);

		assertThat(howManyPairsOf(UNTOUCHED_MAN, UNTOUCHED_WOMAN, BEING_FORMED))
				.as("a pair of the same season belonging to neither of them was broken, so what"
						+ " ran was not breaking theirs but emptying the season")
				.isOne();
		assertThat(pairOf(UNTOUCHED_MAN, UNTOUCHED_WOMAN, BEING_FORMED)).isEqualTo(untouched);
		assertThat(pairOf(HE_ASKED_HER, RUNNING_WOMAN, STILL_RUNNING))
				.as("the pair of the season being RUN was broken, and a pair of another season is"
						+ " never touched (PDL, 07.09.2026)")
				.isEqualTo(running);

		assertThat(howManyPairs())
				.as("two pairs went and one came, so three should stand")
				.isEqualTo(3);

		assertThat(db.sql("select count(*) from pair_invite where id = ?").param(question)
				.query(Long.class).single())
				.as("the question that was answered is still standing")
				.isZero();
		assertThat(questionStandsBetween(FIRST_MAN, FIRST_WOMAN))
				.as("a question between two other people was closed by this answer")
				.isTrue();
	}

	/**
	 * AND NO DAY A PAIR WAS MADE LEAVES THROUGH THIS DOOR EITHER, IN EITHER SPELLING.
	 *
	 * <p>Owner, 13.09.2026: „Dan kad je par nastao se ne prikazuje NIKOME. Server ga ne
	 * vraca." {@code PairApiTest} holds that over the public list; this is the other door the
	 * same column could leave through, and it is the one that WRITES it, so the value is in
	 * hand here and costs nothing to hand back.
	 *
	 * <p>Asked of the whole answer as TEXT and not of a field name, for the reason
	 * {@code PairApiTest} gives: a field renamed to something no screen reads walks past a
	 * check that only reads names. Both spellings a timestamp arrives in are refused - the
	 * day, which is what a configured Jackson writes, and the seconds since the epoch, which
	 * is what an unconfigured one writes - and both are read out of the database.
	 *
	 * <p><b>And the field names are compared whole</b>, in both answers, because the other way
	 * a moment leaves is under a name nobody thought to refuse.
	 */
	@Test
	void noDayAPairWasMadeLeavesThroughThisDoor() throws Exception {
		MockHttpServletResponse asked = askAs(HE_ASKS, asking(SHE_IS_ASKED));

		assertThat(mapper.readTree(asked.getContentAsString()).propertyNames())
				.as("the answer to a question carries some field other than the two it is about")
				.containsExactlyInAnyOrder("id", "memberNumber");

		MockHttpServletResponse made = answerAs(SHE_ANSWERS,
				questionFrom(HE_ASKED_HER, SHE_ANSWERS), answering(true));

		assertThat(mapper.readTree(made.getContentAsString()).propertyNames())
				.as("the answer to an acceptance carries some field other than the pair and its"
						+ " season, and the day of forming is the one that must never be among"
						+ " them")
				.containsExactlyInAnyOrder("id", "season");

		String whole = made.getContentAsString();

		assertThat(whole).as("the answer carries nothing at all, so it says nothing about what it"
				+ " leaves out").contains(String.valueOf(BEING_FORMED));

		String day = db.sql("select to_char(made_at at time zone 'UTC', 'YYYY-MM-DD')"
						+ " from racing_pair where id = ?").param(idIn(made))
				.query(String.class).single();
		String instant = db.sql("select extract(epoch from made_at)::bigint::text"
						+ " from racing_pair where id = ?").param(idIn(made))
				.query(String.class).single();

		assertThat(whole).as("the day the pair was made (%s) left the server, and Clan 73 names a"
				+ " day only for a verified result", day).doesNotContain(day);
		assertThat(whole).as("the day the pair was made left the server as an instant (%s), which"
				+ " is what a timestamp answers with when nobody asks it for a shape", instant)
				.doesNotContain(instant);
	}

	/**
	 * AND THE MAN GOES IN THE MAN'S COLUMN WHICHEVER OF THE TWO ASKED.
	 *
	 * <p>The case above is answered by a woman whose asker was a man, so „the man" and „the one
	 * who asked" are one person in it and a route that never read a gender column writes the
	 * right row. Here a WOMAN asked and a MAN answers, so the two orders part company: read off
	 * who asked, this pair is stored with a woman in {@code man_id}, which V12's foreign key
	 * into {@code competitor (id, gender)} refuses outright.
	 *
	 * <p>Neither of these two holds a pair, so nothing is broken and this case is about the
	 * placement alone.
	 */
	@Test
	void theManGoesInTheMansColumnWhicheverOfThemAsked() throws Exception {
		long question = questionFrom(SHE_ASKS, HE_IS_ASKED);

		assertThat(answerAs(HE_IS_ASKED, question, answering(true)).getStatus()).isEqualTo(200);

		assertThat(howManyPairsOf(HE_IS_ASKED, SHE_ASKS, BEING_FORMED))
				.as("the pair a woman asked for was not stored with the man in the man's column")
				.isOne();
	}

	/**
	 * REFUSING CLOSES THE QUESTION AND MAKES NOTHING.
	 *
	 * <p>V12: „Poziv postoji dok se ne odgovori; odgovor ga uklanja i, ako je potvrdan, pravi
	 * par." Nothing is remembered about the refusal, which {@code member/PairInviteAnswer.tsx}
	 * decided for the same reason it decided it for a team: a message must never say „you
	 * refused" about a question that ended some other way.
	 *
	 * <p><b>And nothing is broken either</b>, which is the half a route that ran the breaking
	 * before it read the answer would fail: both of them keep what they were in.
	 */
	@Test
	void refusingClosesTheQuestionAndMakesNothing() throws Exception {
		long question = questionFrom(HE_ASKED_HER, SHE_ANSWERS);
		long pairsBefore = howManyPairs();

		MockHttpServletResponse answer = answerAs(SHE_ANSWERS, question, answering(false));

		assertThat(answer.getStatus()).isEqualTo(204);
		assertThat(answer.getContentAsString()).isEmpty();

		assertThat(howManyPairs())
				.as("a pair was made by somebody refusing one")
				.isEqualTo(pairsBefore);
		assertThat(seasonsPairedIn(THE_THIRD))
				.as("a third member lost his pair because somebody REFUSED a question")
				.containsExactly(BEING_FORMED);
		assertThat(seasonsPairedIn(THE_FOURTH))
				.as("a fourth member lost his pair because somebody refused a question")
				.containsExactly(BEING_FORMED);

		assertThat(howManyQuestions())
				.as("the question that was refused is still standing, or more than it went with it")
				.isEqualTo(2);
		assertThat(questionStandsBetween(FIRST_MAN, FIRST_WOMAN))
				.as("a question between two other people was closed by this refusal")
				.isTrue();
	}

	/**
	 * THE SEASON IS WORKED OUT ON THE DAY OF THE ANSWER AND NOT ON THE DAY OF THE QUESTION.
	 *
	 * <p>The owner's own two days, from the correction of 07.09.2026: „Poziv poslat 31.12.2026
	 * i prihvacen 02.01.2027 pravi par za 2028, ne za 2027, jer 2027 tada vec tece." One
	 * question, sent once, answered on either side of a New Year: read off {@code sent_at} both
	 * rows below carry 2027 and this case is half green and half red at once.
	 *
	 * <p><b>And the second instant is chosen so that the server's own zone gives the wrong
	 * answer too.</b> 22:00 UTC on 31 December is 23:00 in Belgrade and both are still 2026;
	 * 23:30 UTC on the same day is already half past midnight on 1 January in Belgrade while
	 * UTC is in 2026 yet. So a route reading the machine's zone answers the first correctly and
	 * the second one whole season short, and the two failures are one case.
	 */
	@ParameterizedTest
	@CsvSource({
			"2026-12-31T22:00:00Z, 2027, the last hour of 2026 in Belgrade",
			"2026-12-31T23:30:00Z, 2028, half past midnight on 1 January in Belgrade"})
	void theSeasonComesOffTheDayOfTheAnswerAndNotOffTheDayOfTheQuestion(String moment,
			int expected, String what) throws Exception {

		clock.moveTo(Instant.parse(moment));

		long question = questionFrom(HE_ASKED_HER, SHE_ANSWERS);

		MockHttpServletResponse answer = answerAs(SHE_ANSWERS, question, answering(true));

		assertThat(answer.getStatus()).as("%s was refused", what).isEqualTo(200);

		assertThat(db.sql("select season from racing_pair where man_id = ? and woman_id = ?")
				.params(competitorId(HE_ASKED_HER), competitorId(SHE_ANSWERS))
				.query(Integer.class).single())
				.as("%s (%s) made a pair for the wrong season", what, moment)
				.isEqualTo(expected);
	}

	/**
	 * A QUESTION THAT IS NOT HIS ANSWERS EXACTLY WHAT A QUESTION THAT IS NOT THERE ANSWERS.
	 *
	 * <p>The one thing this file must not do is report a refusal as an absence without
	 * measuring that the two are the same and that a real one is neither. So all four are here:
	 * the member who ASKED trying to answer his own question, an unrelated member trying to
	 * answer it, a key nothing holds, and the person it is really for.
	 *
	 * <p>The first of those is the interesting one: he is named on the row, so a route reading
	 * the question by key alone lets him answer for her, and a route reading it by „he is on
	 * this row" does too.
	 */
	@Test
	void aQuestionThatIsNotHisAnswersWhatAQuestionThatIsNotThereAnswers() throws Exception {
		long question = questionFrom(HE_ASKED_HER, SHE_ANSWERS);
		long nothingHoldsIt = db.sql("select max(id) + 1 from pair_invite")
				.query(Long.class).single();

		for (String who : List.of(HE_ASKED_HER, FIRST_MAN)) {
			MockHttpServletResponse answer = answerAs(who, question, answering(true));

			assertThat(answer.getStatus())
					.as("%s answered a question that was addressed to somebody else", who)
					.isEqualTo(404);
			assertThat(answer.getContentAsString()).isEmpty();
		}

		MockHttpServletResponse missing = answerAs(SHE_ANSWERS, nothingHoldsIt, answering(true));

		assertThat(missing.getStatus())
				.as("a question nobody holds answers something other than a refused one")
				.isEqualTo(404);
		assertThat(missing.getContentAsString()).isEmpty();

		assertThat(howManyPairs())
				.as("one of the three refusals made a pair anyway")
				.isEqualTo(4);
		assertThat(howManyQuestions())
				.as("one of the three refusals closed a question anyway")
				.isEqualTo(3);

		assertThat(answerAs(SHE_ANSWERS, question, answering(true)).getStatus())
				.as("the member the question is really for is refused too, so the three refusals"
						+ " above are not about whose question it is")
				.isEqualTo(200);
	}

	/**
	 * A BODY THAT NAMES NO ANSWER IS A FORM THAT WAS NOT FILLED IN, NOT A REFUSAL.
	 *
	 * <p>Read as „Odbij" it would close somebody's question for him on a request that said
	 * nothing, which is why {@link PairWriteApi.Answered} holds a boxed {@code Boolean}.
	 */
	@Test
	void aBodyThatNamesNoAnswerIsRefusedAndTheQuestionStands() throws Exception {
		long question = questionFrom(HE_ASKED_HER, SHE_ANSWERS);

		MockHttpServletResponse answer = answerAs(SHE_ANSWERS, question, answering(null));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(PairWriteApi.THE_FORM_IS_NOT_COMPLETE);

		assertThat(howManyQuestions())
				.as("a question was closed by a request that gave no answer")
				.isEqualTo(3);
	}

	/**
	 * ACCEPTING A QUESTION THAT CANNOT MAKE A MIXED PAIR IS REFUSED, AND THE QUESTION STANDS.
	 *
	 * <p>V12 stores such a question on purpose - it carries no gender key, because „the RULE is
	 * about the pair and not about the question" - so the refusal has to be asked again here
	 * and not only where the question was sent. The row is written directly rather than through
	 * the route, because the route refuses to send one: the two moments are what this case is
	 * about.
	 *
	 * <p>Left to the database it would arrive as {@code racing_pair_man_fk} and reach the
	 * member as a server fault.
	 */
	@Test
	void acceptingAQuestionThatCannotMakeAMixedPairIsRefused() throws Exception {
		question(FIRST_MAN, HE_ASKS, ASKED_ON);

		long question = questionFrom(FIRST_MAN, HE_ASKS);

		MockHttpServletResponse answer = answerAs(HE_ASKS, question, answering(true));

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(PairWriteApi.THE_PAIR_WOULD_NOT_BE_MIXED);

		assertThat(howManyPairs()).as("a pair that is not mixed was written").isEqualTo(4);
		assertThat(db.sql("select count(*) from pair_invite where id = ?").param(question)
				.query(Long.class).single())
				.as("the question was closed although nothing was decided about it")
				.isOne();
	}

	/**
	 * AN ACCOUNT THAT NAMES NO MEMBER IS SENT AWAY FROM BOTH DOORS.
	 *
	 * <p>V23 lets {@code account.competitor_id} be null for „a moderator who does not race,
	 * which is the ordinary case and not a fault", and a pair is two MEMBERS. There is nobody
	 * to file a question under and nobody to answer one.
	 */
	@Test
	void anAccountThatNamesNoMemberIsSentAwayFromBothDoors() throws Exception {
		Cookie his = new Cookie(SessionCookie.NAME,
				sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret());

		assertThat(sent(post("/api/pairs"), asking(SHE_IS_ASKED), his).getStatus()).isEqualTo(404);

		assertThat(sent(put("/api/pairs/" + questionFrom(HE_ASKED_HER, SHE_ANSWERS)),
				answering(true), his).getStatus()).isEqualTo(404);

		assertThat(howManyQuestions())
				.as("a question was filed under, or answered by, an account with no member behind"
						+ " it")
				.isEqualTo(3);
		assertThat(howManyPairs()).isEqualTo(4);
	}

	/**
	 * AND NOBODY WHO IS NOT SIGNED IN REACHES EITHER DOOR AT ALL.
	 *
	 * <p>{@code /api/pairs} is on {@code ApiSecurity.READ_BY_ANYBODY}, and since 18.09.2026
	 * that list is opened by METHOD. The number is 401 and not 404 because a browser given 404
	 * could not tell an ended session from a wrong address and nothing could offer him the way
	 * back in (ADL A8: „Neprijavljen i dalje dobija 401, i to nije nedoslednost").
	 */
	@Test
	void nobodyWhoIsNotSignedInReachesEitherDoor() throws Exception {
		assertThat(sent(post("/api/pairs"), asking(SHE_IS_ASKED), null).getStatus())
				.isEqualTo(401);
		assertThat(sent(put("/api/pairs/" + questionFrom(HE_ASKED_HER, SHE_ANSWERS)),
				answering(true), null).getStatus())
				.isEqualTo(401);

		assertThat(howManyQuestions())
				.as("a question was written or answered by somebody the portal knows nothing about")
				.isEqualTo(3);
	}

	/**
	 * AND A WRITE THAT NAMES NO TYPE IS AN ADDRESS THAT IS NOT THERE, NOT ONE THAT WANTS A
	 * DIFFERENT TYPE.
	 *
	 * <p>415 says „this address is here and takes something else", which is the same sentence
	 * as saying it is there - the leak {@code NothingIsHereRatherThanAlmost} exists against and
	 * the one branch of it that class says it cannot close, because a media type refused while
	 * a handler is already running is raised far from {@code handleNoMatch}. Declared on the
	 * mapping instead, the request never matches and the dispatcher raises it where the
	 * portal's rule turns it into „no handler".
	 *
	 * <p><b>Asked of a signed in member</b>, because a stranger is refused 401 by the chain
	 * before any of this and would pass whatever the mapping said. Both verbs, because
	 * {@code consumes} is written on two mappings and one of them could lose it.
	 */
	@Test
	void aWriteThatNamesNoTypeIsAnAddressThatIsNotThere() throws Exception {
		long question = questionFrom(HE_ASKED_HER, SHE_ANSWERS);

		int unmapped = http.perform(post("/api/zzzzzz").with(csrf()).cookie(cookieOf(HE_ASKS)))
				.andReturn().getResponse().getStatus();

		assertThat(unmapped)
				.as("an address that maps nothing no longer answers 404, so there is nothing being"
						+ " compared here")
				.isEqualTo(404);

		assertThat(http.perform(post("/api/pairs").with(csrf()).content(asking(SHE_IS_ASKED))
						.cookie(cookieOf(HE_ASKS)))
				.andReturn().getResponse().getStatus())
				.as("a POST with no content type was told which type this address wants, which is"
						+ " the same sentence as telling him the address is there")
				.isEqualTo(unmapped);

		assertThat(http.perform(put("/api/pairs/" + question).with(csrf()).content(answering(true))
						.cookie(cookieOf(SHE_ANSWERS)))
				.andReturn().getResponse().getStatus())
				.as("a PUT with no content type was told which type this address wants")
				.isEqualTo(unmapped);

		assertThat(howManyQuestions()).isEqualTo(3);
		assertThat(howManyPairs()).isEqualTo(4);
	}
}
