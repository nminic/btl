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

/**
 * A MEMBER RATING AN EVENT, END TO END: what goes into the queue, who is sent away, and
 * what a race that has not run yet refuses.
 *
 * <p><b>NOBODY AND NOTHING HERE IS THE ONLY ONE OF ITS KIND</b>, on every axis an
 * assertion below reads a value along, the same discipline {@code TeamWriteApiTest}
 * holds itself to and for the identical reason - a fixture that cannot separate an axis
 * cannot measure a rule about it:
 *
 * <ul>
 * <li><b>Four competitors, and the one who writes is third, never first.</b>
 * {@link #ME} is written after {@link #FIRST_WRITTEN} and {@link #SOMEONE_ELSE}, so „the
 * member asking" and „the first member in the record" are different keys.
 * <li><b>Six events, and the one a case rates is neither first nor last by id.</b> A rule
 * that reads the first event, or the last, rather than the one the request names would
 * still pass a fixture where the right answer happens to sit at either end.
 * <li><b>Two of the six share one name.</b> {@link #run} and {@link #runOtherEdition}
 * are „Fruškogorski maraton" two years apart, so „the event this comment is about" can
 * only be answered by the id and never by the name - the same axis {@code CommentApi}'s
 * own „every comment of every event, in one answer" note reads editions along.
 * <li><b>Somebody else already has a submission waiting, on a different event and a
 * different queue row entirely</b>, so „the row this request made" is never „the only
 * row" and a count that lost its filter can be seen.
 * <li><b>A moderator who also races</b> ({@link #MODERATE_AND_RACE}) sits in the fixture
 * precisely so that „whoever is asking" and „a plausible other account" are two
 * different competitor ids a mutation could swap without a case going red by accident.
 * </ul>
 *
 * <p><b>Authorisation as a rule is not measured here.</b> This route carries no
 * {@link RightIsNeeded} and needs none - every member may rate an event - so
 * {@code RightsAtTheDoorTest} already sweeps it (named beside {@code POST /api/teams},
 * the door's own precedent for a member's write). What that sweep cannot see is measured
 * here instead: an account naming no member is sent away, and a stranger with no session
 * at all is refused before the handler runs because the mapping declares what it consumes
 * ({@link TeamWriteApi}'s own fourth branch, copied rather than rediscovered).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class CommentWriteApiTest {

	/**
	 * Well inside 2027, so every event below can be dated either well before it or well
	 * after it without crossing into a season the schema refuses.
	 */
	private static final Instant ORDINARY_MOMENT = Instant.parse("2027-06-15T10:00:00Z");

	/** Written first, never asked with, never rated about. */
	private static final String FIRST_WRITTEN = "000100";

	/** Has a submission of his own already waiting, on a different event. */
	private static final String SOMEONE_ELSE = "000200";

	/**
	 * A MODERATOR WHO ALSO RACES, so that „the caller's own id" and „a plausible other
	 * account's id" are two different numbers a mutation could swap toward without the
	 * fixture refusing the request outright - an account with no competitor at all would
	 * make that swap indistinguishable from the „account names no member" case below.
	 */
	private static final String MODERATE_AND_RACE = "000250";

	/** The member every case rates with, written third and never first. */
	private static final String ME = "000300";

	/**
	 * A MEMBER WHOSE FEE HAS LAPSED, the „clanarina istekla" half of the axis the plan
	 * names by name.
	 *
	 * <p>Not gated on here, and that absence is measured rather than assumed:
	 * {@code competitor.active} governs what a PUBLIC answer links back to
	 * ({@link CommentApi}'s own {@code case when author.active}), and no WRITE on this
	 * server reads it at all - {@link TeamWriteApi}, the literal precedent this class
	 * carries over, has no such check either. A route that refused this member would be
	 * inventing a fourth gate PDL never asked for, on the strength of a reading between
	 * lines about a screen ({@code Membership.tsx}) that is not this file's to enforce a
	 * second time.
	 */
	private static final String LAPSED = "000400";

	private static final String MODERATOR_WHO_DOES_NOT_RACE = "moderator@primer.rs";

	/** Two years apart, the same name, so „by id" and „by name" can disagree. */
	private static final String RUN_NAME = "Fruškogorski maraton";

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

	/** The six events, keyed by the id the fixture gave them, filled in
	 *  {@link #fourMembersAndSixEvents}. */
	private long filterFirst;

	private long run;

	private long runOtherEdition;

	private long today;

	private long future;

	private long filterLast;

	/** A clock the case moves, the identical shape and the identical reason
	 *  {@code TeamWriteApiTest} carries one: a boundary in time needs both of its edges
	 *  asked from one fixture, and reporting UTC as its zone is what makes a route that
	 *  reads the machine's own zone instead of {@code SeasonClock.ZONE} answer wrongly. */
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
	static class TheClockThisCaseUses {

		@Bean
		@Primary
		AClockTheCaseMoves aClockTheCaseMoves() {
			return new AClockTheCaseMoves(ORDINARY_MOMENT);
		}
	}

	@BeforeEach
	void fourMembersAndSixEvents() {
		clock.moveTo(ORDINARY_MOMENT);

		competitor(FIRST_WRITTEN, true);
		competitor(SOMEONE_ELSE, true);
		competitor(MODERATE_AND_RACE, true);
		competitor(ME, true);
		competitor(LAPSED, false);

		account("prvi@primer.rs", FIRST_WRITTEN, "competitor");
		account("neko-drugi@primer.rs", SOMEONE_ELSE, "competitor");
		account("moderator-trka@primer.rs", MODERATE_AND_RACE, "moderator");
		account("ja@primer.rs", ME, "competitor");
		account("isteklo@primer.rs", LAPSED, "competitor");
		moderatorWithNoCompetitor(MODERATOR_WHO_DOES_NOT_RACE);

		/* FIRST BY ID, ASKED BY NOBODY: a rule that read the first event rather than the
		   one the request named would still pass every case below if this were missing. */
		filterFirst = event("Prolećni kros", "2027-03-01");

		run = event(RUN_NAME, "2010-05-08");
		/* THE SAME NAME, A DIFFERENT YEAR: „by id" and „by name" can only disagree once
		   two rows answer to one name. */
		runOtherEdition = event(RUN_NAME, "2012-05-13");

		today = event("Dan same trke", ORDINARY_MOMENT.atZone(SeasonClock.ZONE)
				.toLocalDate().toString());
		future = event("Događaj koji tek dolazi", "2027-12-24");

		/* LAST BY ID, ASKED BY NOBODY: the other end of the same axis. */
		filterLast = event("Jesenji krem", "2027-11-01");

		/* SOMEBODY ELSE'S SUBMISSION, ALREADY WAITING, ON A DIFFERENT EVENT: so „the row
		   this request made" is never „the only row in the comments tab". */
		submissionWaitingFor(SOMEONE_ELSE, filterFirst, 4, 4, 4, "Već čeka");

		/* A ROW IN THE QUEUE THAT IS NOT A COMMENT'S AT ALL, the identical precedent
		   `TeamWriteApiTest` sets for its own tab, so „the comments tab" and „the whole
		   queue" are two different counts and a statement that lost its queue can be seen. */
		db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values ('teams', (select id from competitor where member_number = ?),"
						+ " 'Tim koji ceka', '')")
				.param(FIRST_WRITTEN).update();
	}

	/** @param active whether the fee is standing - false is „clanarina istekla", the
	 *  half of the axis {@link #LAPSED} carries. */
	private void competitor(String number, boolean active) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Probic', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, ?, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.params(number, active, String.format("%016x", ++issued))
				.update();
	}

	/** The same shape {@code VerificationApiTest.event} already uses: the date is a literal
	 *  built into the statement rather than a bound parameter, which is how a date column is
	 *  seeded everywhere on this suite. Safe here because every caller passes a constant this
	 *  file wrote, never anything a request carried. */
	private long event(String name, String date) {
		return db.sql("insert into btl_event (slug, name, date, place_id, kind, featured,"
						+ " description, link)"
						+ " values (?, ?, date '" + date + "',"
						+ " (select id from place where rank = 1), 'race', false, '', '') returning id")
				.params(slug(), name)
				.query(Long.class)
				.single();
	}

	/** A workable address, out of a counter rather than the name: two rows in this fixture
	 *  share a name on purpose ({@link #run}, {@link #runOtherEdition}), and this file is not
	 *  measuring the address the portal's own {@code EventAddress} would make from either. */
	private String slug() {
		return "dogadjaj-" + String.format("%016x", ++issued);
	}

	/** Somebody else's own submission, queued exactly the way this route itself queues one. */
	private void submissionWaitingFor(String memberNumber, long eventId, int organisation, int value,
			int ambience, String body) {
		long submission = db.sql("insert into comment_submission (event_id, competitor_id,"
						+ " rating_organisation, rating_value, rating_ambience, body)"
						+ " values (?, (select id from competitor where member_number = ?), ?, ?, ?, ?)"
						+ " returning id")
				.params(eventId, memberNumber, organisation, value, ambience, body)
				.query(Long.class).single();

		db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " comment_submission_id)"
						+ " select 'comments', c.id, e.name, ?, ?"
						+ " from competitor c, btl_event e"
						+ " where c.member_number = ? and e.id = ?")
				.params(body, submission, memberNumber, eventId).update();
	}

	private void account(String email, String memberNumber, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, role, memberNumber).update();

		openSession(email);
	}

	private void moderatorWithNoCompetitor(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Moderator', 'Bezimeni', ?, (select id from role where code = 'moderator'))")
				.param(email).update();

		openSession(email);
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

	private String cookieOf(String memberNumber) {
		return sessions.get(db.sql("select a.email from account a join competitor c"
						+ " on c.id = a.competitor_id where c.member_number = ?")
				.param(memberNumber).query(String.class).single()).secret();
	}

	private MockHttpServletResponse rateAs(String memberNumber, String body) throws Exception {
		return sent(body, new Cookie(SessionCookie.NAME, cookieOf(memberNumber)));
	}

	private MockHttpServletResponse sent(String body, Cookie carrying) throws Exception {
		MockHttpServletRequestBuilder asking = post("/api/comments").with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content(body);

		return http.perform(carrying == null ? asking : asking.cookie(carrying))
				.andReturn().getResponse();
	}

	private String form(long eventId, int organisation, int value, int ambience, String body) {
		return mapper.writeValueAsString(
				new CommentWriteApi.Rated(eventId, organisation, value, ambience, body));
	}

	/** The ordinary request every case starts from: all three marks given, on {@link #run}. */
	private String ordinary() {
		return form(run, 4, 5, 4, "  Staza je bila jasno obeležena.  ");
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("reason").asString();
	}

	private long howManySubmissions() {
		return db.sql("select count(*) from comment_submission").query(Long.class).single();
	}

	private long howManyWaitingInTheCommentsQueue() {
		return db.sql("select count(*) from verification where queue = 'comments'"
				+ " and state = 'waiting'").query(Long.class).single();
	}

	/**
	 * One submission and its queue row, read back together as one row of values, by the
	 * event and the member it is about - never by which was written most recently, since a
	 * case here writes {@link #ME}'s own submission twice over.
	 *
	 * <p><b>The JOIN ITSELF IS THE ASSERTION that the queue row really points at this
	 * submission</b>, {@code v.comment_submission_id = cs.id}: a write that left the pointer
	 * unset (the first mandatory mutation the plan names) matches nothing here, and
	 * {@code single()} throws rather than silently reading a wrong row - which is why
	 * {@code comment_submission_id} is not read back out and compared a second time.
	 *
	 * <p><b>{@code v.competitor_id} IS READ HERE TOO, AND WAS NOT UNTIL THIS ROUND.</b>
	 * {@link VerificationApi} draws the name and the number on a moderator's card off
	 * {@code v.competitor_id}, and {@link VerificationWriteApi#publishTheComment} draws the
	 * published comment's author off {@code cs.competitor_id} - two different columns,
	 * written by {@link CommentWriteApi#write}'s two different {@code insert}s, and nothing
	 * before this line ever read the first of them back. A write that let the two disagree -
	 * the card naming one member, the eventual comment crediting another - passed every case
	 * in this file silently, since the join above matches on {@code comment_submission_id}
	 * and neither insert's {@code competitor_id} is asked about by the {@code where} clause.
	 *
	 * <p>Read as strings past the identity, {@link TeamWriteApiTest}'s own reason: what
	 * {@code getObject} hands back for a {@code smallint} and what an {@code int} literal
	 * autoboxes to are not the same class, and {@code containsExactly} tells them apart even
	 * where {@code equals} on the numbers would not.
	 */
	private List<Object> rowFor(long eventId, String memberNumber) {
		return db.sql("select cs.id, cs.event_id, cs.competitor_id, cs.rating_organisation,"
						+ " cs.rating_value, cs.rating_ambience, cs.body, v.queue, v.competitor_id,"
						+ " v.subject, v.body, v.state"
						+ " from comment_submission cs join verification v"
						+ " on v.comment_submission_id = cs.id"
						+ " where cs.event_id = ?"
						+ " and cs.competitor_id = (select id from competitor where member_number = ?)")
				.params(eventId, memberNumber)
				.query((row, one) -> List.of(row.getObject(1), String.valueOf(row.getObject(2)),
						String.valueOf(row.getObject(3)), String.valueOf(row.getObject(4)),
						String.valueOf(row.getObject(5)), String.valueOf(row.getObject(6)),
						row.getString(7), row.getString(8), String.valueOf(row.getObject(9)),
						row.getString(10), row.getString(11), row.getString(12)))
				.single();
	}

	@Test
	void theFixtureSeparatesTheAxesItSaysItSeparates() {
		assertThat(List.of(filterFirst, run, runOtherEdition, today, future, filterLast))
				.as("six different rows, or an id shared by two of them makes several assertions"
						+ " below measure nothing")
				.doesNotHaveDuplicates();

		assertThat(run).as("the event a case rates is not the first by id").isNotEqualTo(filterFirst);
		assertThat(run).as("the event a case rates is not the last by id").isNotEqualTo(filterLast);
		assertThat(List.of(filterFirst, run, runOtherEdition, today, future, filterLast))
				.as("the ordering this file relies on for \"neither first nor last\" is the one"
						+ " Postgres actually gave the rows")
				.isSorted();

		assertThat(db.sql("select name from btl_event where id in (?, ?)").params(run, runOtherEdition)
						.query(String.class).list())
				.as("the two editions really do share a name, or \"by id and not by name\" measures"
						+ " nothing")
				.containsExactly(RUN_NAME, RUN_NAME);

		assertThat(db.sql("select date from btl_event where id = ?").param(today)
						.query((row, one) -> row.getDate(1).toLocalDate()).single())
				.as("the event standing for \"raced today\" really is dated on the day this fixture's"
						+ " clock reads")
				.isEqualTo(ORDINARY_MOMENT.atZone(SeasonClock.ZONE).toLocalDate());

		assertThat(db.sql("select role_id = (select id from role where code = 'moderator') and"
						+ " competitor_id is not null from account where email = ?")
				.param("moderator-trka@primer.rs").query(Boolean.class).single())
				.as("the moderator this file swaps toward really does hold a competitor record,"
						+ " or the mutation the plan asks for cannot be told apart from an account"
						+ " naming no member at all")
				.isTrue();

		assertThat(howManySubmissions())
				.as("the comments tab and the whole table start apart, so a count that lost its"
						+ " filter can be seen")
				.isEqualTo(1);

		assertThat(db.sql("select active from competitor where member_number = ?").param(LAPSED)
						.query(Boolean.class).single())
				.as("the member standing for a lapsed fee really has one, or the axis measures"
						+ " nothing")
				.isFalse();
	}

	/**
	 * A MEMBER WITH ALL THREE MARKS GIVEN RATES A RACE THAT HAS BEEN RUN, AND IT IS
	 * STANDING IN THE COMMENTS QUEUE.
	 *
	 * <p>Both tables are read back together, because the two halves of this write are two
	 * facts: a submission nobody queued reaches no moderator, and a queue row pointing at
	 * nothing is a card with nothing on it - the identical reasoning
	 * {@code TeamWriteApiTest} gives for reading its own two tables back together.
	 *
	 * <p><b>Not whole, and that is named rather than implied.</b> {@code rowFor} reads
	 * {@code verification.competitor_id} because {@link CommentWriteApi#write}'s two
	 * {@code insert}s could name a different member on each (see the note on
	 * {@code rowFor} itself), which is a fact this route's own write could get wrong.
	 * {@code photo_id}, {@code right_code} and {@code decided_at} stay unread: no branch of
	 * this route's write ever sets the first (that is {@code publishTheProfile}'s column,
	 * never {@code publishTheComment}'s), and the other two are V9's own defaults that
	 * nothing under test here computes.
	 */
	@Test
	void aMemberRatesARaceThatHasBeenRunAndItWaitsInTheQueue() throws Exception {
		long submissionsBefore = howManySubmissions();

		MockHttpServletResponse answer = rateAs(ME, ordinary());

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(howManySubmissions()).isEqualTo(submissionsBefore + 1);

		List<Object> row = rowFor(run, ME);

		assertThat(row)
				.as("the submission does not carry the event, the member, the three marks and the"
						+ " text as they were sent, or the queue row does not carry the tab, THE"
						+ " MEMBER off its own competitor_id (not merely off the submission's), the"
						+ " event's OWN name (never a text built here), the same words, and a state"
						+ " that is still waiting")
				.containsExactly(row.get(0), String.valueOf(run), String.valueOf(competitorId(ME)),
						"4", "5", "4", "Staza je bila jasno obeležena.", "comments",
						String.valueOf(competitorId(ME)), RUN_NAME, "Staza je bila jasno obeležena.",
						"waiting");
	}

	@Test
	void theAnswerCarriesTheIdOfTheSubmissionNowWaiting() throws Exception {
		MockHttpServletResponse answer = rateAs(ME, ordinary());

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(mapper.readTree(answer.getContentAsString()).path("id").asLong())
				.isEqualTo((Long) rowFor(run, ME).get(0));
	}

	/**
	 * THE COMMENT MAY BE LEFT EMPTY. PDL 370: „Komentar je fakultativan" - the marks are
	 * not, and the two are refused on different terms.
	 */
	@Test
	void theWordsMayBeLeftOut() throws Exception {
		MockHttpServletResponse answer = rateAs(ME, form(run, 3, 3, 3, ""));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(rowFor(run, ME).get(6)).isEqualTo("");
	}

	/**
	 * AND THE COMMENT MAY BE MISSING FROM THE REQUEST ENTIRELY, NOT ONLY EMPTY -
	 * {@link CommentWriteApi#orEmpty}'s other branch, which an empty string sent on
	 * purpose never reaches: {@code isNothing}'s reasoning elsewhere on this server is
	 * that absent and blank are one state, and this route's own {@code orEmpty} is the
	 * half of that which turns a Jackson {@code null} into the same stored value as an
	 * empty box.
	 */
	@Test
	void theWordsMayBeAbsentFromTheRequestRatherThanMerelyEmpty() throws Exception {
		MockHttpServletResponse answer = rateAs(ME, form(run, 4, 4, 4, null));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(rowFor(run, ME).get(6)).isEqualTo("");
	}

	/**
	 * AN ACCOUNT NAMING NO MEMBER IS SENT AWAY, THE SAME EMPTY 404 {@code TeamWriteApi}
	 * ANSWERS WITH.
	 */
	@Test
	void anAccountThatNamesNoMemberIsSentAway() throws Exception {
		long submissionsBefore = howManySubmissions();

		MockHttpServletResponse answer = sent(ordinary(), new Cookie(SessionCookie.NAME,
				sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret()));

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(answer.getContentAsString()).isEmpty();
		assertThat(howManySubmissions()).isEqualTo(submissionsBefore);
	}

	@Test
	void aStrangerWithNoSessionAtAllIsRefusedBeforeTheHandlerRuns() throws Exception {
		long submissionsBefore = howManySubmissions();

		MockHttpServletResponse answer = sent(ordinary(), null);

		assertThat(answer.getStatus()).isEqualTo(401);
		assertThat(howManySubmissions()).isEqualTo(submissionsBefore);
	}

	/**
	 * ALL THREE MARKS OR NONE, NEVER A SUBSET - PDL P6's OWN ARITHMETIC. Two given out of
	 * three is the axis the plan names by name, and nought given is the same state read
	 * the other way: both must be refused, and both must be refused for the same reason,
	 * because a mark left out and a mark of nought are one thing from this route's side of
	 * the wire.
	 */
	@ParameterizedTest
	@CsvSource({"0, 4, 4", "4, 0, 4", "4, 4, 0", "0, 0, 0"})
	void aRatingMissingAnyOfTheThreeMarksIsRefused(int organisation, int value, int ambience)
			throws Exception {
		long submissionsBefore = howManySubmissions();

		MockHttpServletResponse answer = rateAs(ME, form(run, organisation, value, ambience, ""));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(CommentWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(howManySubmissions()).isEqualTo(submissionsBefore);
	}

	@Test
	void aMarkOutsideTheScaleIsRefusedTheSameWayAMissingOneIs() throws Exception {
		MockHttpServletResponse answer = rateAs(ME, form(run, 6, 4, 4, ""));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(CommentWriteApi.THE_FORM_IS_NOT_COMPLETE);
	}

	@Test
	void anEventNobodyKnowsIsRefusedBeforeAnythingAboutTheDayIsAsked() throws Exception {
		long submissionsBefore = howManySubmissions();

		MockHttpServletResponse answer = rateAs(ME, form(9_999_999L, 4, 4, 4, ""));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(CommentWriteApi.THE_EVENT_IS_NOT_KNOWN);
		assertThat(howManySubmissions()).isEqualTo(submissionsBefore);
	}

	/**
	 * A RACE STILL TO COME IS REFUSED, AND THE DAY OF THE RACE ITSELF IS NOT.
	 *
	 * <p>PDL, 07.08.2026: „Dan same trke se računa kao održan." A comparison written
	 * {@code isBefore}/{@code !isBefore} instead of {@code isAfter} would answer the
	 * boundary the other way; both sides are asked so such a swap cannot pass by accident.
	 */
	@Test
	void aRaceStillToComeIsRefused() throws Exception {
		long submissionsBefore = howManySubmissions();

		MockHttpServletResponse answer = rateAs(ME, form(future, 4, 4, 4, ""));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(CommentWriteApi.THE_EVENT_HAS_NOT_BEEN_RUN);
		assertThat(howManySubmissions()).isEqualTo(submissionsBefore);
	}

	@Test
	void theDayOfTheRaceItselfIsAccepted() throws Exception {
		assertThat(rateAs(ME, form(today, 4, 4, 4, "")).getStatus()).isEqualTo(201);
	}

	/**
	 * AND THE DAY IS MEASURED IN BELGRADE, NEVER ON THE MACHINE'S OWN ZONE.
	 *
	 * <p>The event is dated 1 October 2027. At 22:30 UTC on 30 September, Belgrade
	 * (summer time, UTC+2) already reads 00:30 on 1 October - the day of the race itself,
	 * which the rule above accepts. A route reading the server's own zone would compare
	 * against 30 September and refuse the identical request.
	 */
	@Test
	void theBoundaryIsMeasuredInBelgradeAndNotOnTheMachinesOwnZone() throws Exception {
		long dayOfTheRace = event("Beogradski maraton", "2027-10-01");

		clock.moveTo(Instant.parse("2027-09-30T22:30:00Z"));

		assertThat(rateAs(ME, form(dayOfTheRace, 4, 4, 4, "")).getStatus())
				.as("00:30 on 1 October in Belgrade, the day of the race itself, read as though it"
						+ " were still 30 September")
				.isEqualTo(201);
	}

	/**
	 * THE FORM DOES NOT ASK WHETHER THIS MEMBER RAN THE EVENT, AND NEITHER DOES THIS
	 * ROUTE - PDL 371 names two places that do, the screen and the moderator, and this is
	 * not a third.
	 */
	@Test
	void aMemberWithNoResultOnTheEventIsNotRefusedByTheServer() throws Exception {
		assertThat(rateAs(FIRST_WRITTEN, form(run, 4, 4, 4, "")).getStatus()).isEqualTo(201);
	}

	/**
	 * A MEMBER WHOSE FEE HAS LAPSED IS RATED EXACTLY LIKE ANYBODY ELSE - see the note on
	 * {@link #LAPSED} for where that absence is measured rather than assumed.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedIsNotRefusedByTheServer() throws Exception {
		MockHttpServletResponse answer = rateAs(LAPSED, form(run, 4, 4, 4, "I dalje trčim."));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(rowFor(run, LAPSED).get(6)).isEqualTo("I dalje trčim.");
	}

	/**
	 * A SECOND RATING OF ONE EVENT BY ONE MEMBER IS ACCEPTED WHILE THE FIRST STILL WAITS -
	 * PDL 3206 says abuse is not expected of somebody signed in, and the moderator is the
	 * gate PDL 371 already names, not this route.
	 */
	@Test
	void aSecondRatingOfOneEventByOneMemberIsAcceptedWhileTheFirstStillWaits() throws Exception {
		assertThat(rateAs(ME, form(run, 3, 3, 3, "Prvi put")).getStatus()).isEqualTo(201);
		assertThat(rateAs(ME, form(run, 5, 5, 5, "Drugi put")).getStatus()).isEqualTo(201);

		assertThat(db.sql("select count(*) from comment_submission where event_id = ?"
						+ " and competitor_id = ?")
				.params(run, competitorId(ME)).query(Long.class).single())
				.isEqualTo(2);
		assertThat(howManyWaitingInTheCommentsQueue())
				.as("someone else's row from the fixture, plus these two")
				.isEqualTo(3);
	}

	private long competitorId(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single();
	}
}
