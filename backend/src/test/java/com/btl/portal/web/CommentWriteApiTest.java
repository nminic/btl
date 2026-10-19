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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
	 * <p>Turned away since P8U, as an account naming no member is: comments are on the list
	 * PDL P8 gives of what a member who has not paid may not do (10.10.2026, „komentare"). Until
	 * then no write on this server read {@code competitor.active}, and this note said so; the case
	 * that measured that absence is the case that now measures the refusal.
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

		/* A NAME NOBODY ELSE IN THE FIXTURE HAS: every member is "Probni Probic" otherwise, and a
		   comment published under the wrong member's name could not be told from the right one. */
		db.sql("update competitor set first_name = 'Mirko', last_name = 'Mirković'"
						+ " where member_number = ?")
				.param(ME).update();
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

		/* TWO COMMENTS ALREADY PUBLISHED, ONE NEWER THAN ANYTHING A CASE WILL PUBLISH AND ONE OLDER,
		   so a comment this route publishes is neither the only one nor the first nor the last in
		   what `GET /api/comments` answers (newest first), and "the list the page reads" cannot
		   be satisfied by a list of one. The older one is about the very event the cases rate. */
		published(SOMEONE_ELSE, filterFirst, "2099-01-01T00:00:00Z", "Objavljeno kasnije");
		published(FIRST_WRITTEN, run, "2020-01-01T00:00:00Z", "Objavljeno ranije");

		/* WHO HAS A RESULT WHERE (owner, 19.10.2026: only a member with a result on the event rates
		   it). ME ran `run` and `today`. SOMEONE_ELSE ran `run` too: ANOTHER MEMBER'S result on the
		   very event, which must not open the door for a third. FIRST_WRITTEN ran only
		   `runOtherEdition`, which has the same NAME as `run`: HIS OWN result on ANOTHER event. So
		   "has a result on this event" can be told from "has a result", from "somebody has", and from
		   "has one on an event of that name". */
		ran(ME, run);
		ran(ME, today);
		ran(SOMEONE_ELSE, run);
		ran(FIRST_WRITTEN, runOtherEdition);

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
						+ " place_id, first_season, first_season_2027, active, "
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Probic', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, ?, "
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

	/** A result of this member on a race of this event, the race made for it: what the form's
	 *  {@code ran(results, races, event.id, mine)} counts. */
	private void ran(String memberNumber, long eventId) {
		long race = db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m) select id, 'Trka', false, date, 'length',"
						+ " 0, 10, 0, 0 from btl_event where id = ? returning id")
				.param(eventId).query(Long.class).single();

		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points) select c.id, ra.id, ra.date, 10, 0, 0, 3600, 100"
						+ " from competitor c, race ra where c.member_number = ? and ra.id = ?")
				.params(memberNumber, race).update();
	}

	/** A comment a moderator has already let out, written the way an approval writes it. */
	private void published(String memberNumber, long eventId, String at, String body) {
		db.sql("insert into event_comment (event_id, competitor_id, who, published_at,"
						+ " rating_organisation, rating_value, rating_ambience, body)"
						+ " select ?, c.id, c.first_name || ' ' || c.last_name, ?::timestamptz, 3, 3, 3, ?"
						+ " from competitor c where c.member_number = ?")
				.params(eventId, at, body, memberNumber).update();
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

	/** The ids of what this member has published about this event. */
	private List<Long> publishedBy(String memberNumber, long eventId) {
		return db.sql("select id from event_comment where event_id = ? and competitor_id ="
						+ " (select id from competitor where member_number = ?) order by id")
				.params(eventId, memberNumber).query(Long.class).list();
	}

	private long howManyPublished() {
		return db.sql("select count(*) from event_comment").query(Long.class).single();
	}

	/** Every row of the queue, whatever tab: what a moderator's screen is drawn from. */
	private long howManyInTheQueue() {
		return db.sql("select count(*) from verification").query(Long.class).single();
	}

	/** What the page reads, as a member who is NOT the author reads it. */
	private List<JsonNode> thePageAsSeenBy(String memberNumber) throws Exception {
		MockHttpServletResponse answer = http.perform(get("/api/comments")
				.cookie(new Cookie(SessionCookie.NAME, cookieOf(memberNumber))))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(200);

		List<JsonNode> all = new ArrayList<>();
		mapper.readTree(answer.getContentAsString()).forEach(all::add);

		return all;
	}

	private long idIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("id").asLong();
	}

	private boolean waitingIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("waiting").asBoolean();
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

		assertThat(howManyPublished())
				.as("two comments are already published, so one this route publishes is never the"
						+ " only one on the page")
				.isEqualTo(2);

		assertThat(db.sql("select first_name || ' ' || last_name from competitor where"
						+ " member_number = ?").param(ME).query(String.class).single())
				.as("the member who writes has a name no other member has")
				.isNotEqualTo(db.sql("select first_name || ' ' || last_name from competitor where"
						+ " member_number = ?").param(FIRST_WRITTEN).query(String.class).single());

		assertThat(db.sql("select count(*) from result r join race ra on ra.id = r.race_id"
						+ " where ra.event_id = ?").param(run).query(Long.class).single())
				.as("two members have a result on the event the cases rate: one of them is not the one"
						+ " who rates, and the one who rates the event he did not run has one elsewhere")
				.isEqualTo(2);
		assertThat(db.sql("select count(*) from result r join race ra on ra.id = r.race_id"
						+ " join competitor c on c.id = r.competitor_id where ra.event_id = ?"
						+ " and c.member_number = ?").params(runOtherEdition, FIRST_WRITTEN)
				.query(Long.class).single())
				.as("the member with no result on the event has one on the event of the same name")
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
		assertThat(idIn(answer)).isEqualTo((Long) rowFor(run, ME).get(0));
		assertThat(waitingIn(answer))
				.as("a comment with text waits for a moderator and the answer says so")
				.isTrue();
	}

	/**
	 * THE COMMENT MAY BE LEFT EMPTY. PDL P6, „Komentar je fakultativan" - the marks are
	 * not, and the two are refused on different terms. Since 19.10.2026 (owner: „Ako ima samo 3
	 * ocene u zvezdicama, objavljuje se odmah") it is also what decides that nothing is queued.
	 */
	@Test
	void theWordsMayBeLeftOut() throws Exception {
		long before = howManyPublished();

		MockHttpServletResponse answer = rateAs(ME, form(run, 3, 3, 3, ""));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(howManyPublished()).isEqualTo(before + 1);
	}

	/**
	 * THE OWNER'S FIRST HALF, 19.10.2026: THREE MARKS AND NO TEXT ARE PUBLISHED AT ONCE, AND NOTHING
	 * IS QUEUED.
	 *
	 * <p>Every fact the page, the moderator and the author each read is asked apart: the row
	 * itself (event, author, the name he goes out under, the three marks in the order sent, an
	 * empty body, a time that is now), the queue (no submission, no card of any tab), and the
	 * page, read by a member who is NOT the author, in which the comment stands between a newer
	 * one and an older one - never first, never last, never alone. The marks are three different
	 * numbers and the author is neither first nor last in the record, so a swap of marks or of
	 * author cannot hide.
	 */
	@Test
	void threeMarksAndNoTextArePublishedAtOnceAndAreNeverQueued() throws Exception {
		long submissionsBefore = howManySubmissions();
		long queueBefore = howManyInTheQueue();
		long publishedBefore = howManyPublished();

		MockHttpServletResponse answer = rateAs(ME, form(run, 2, 3, 5, ""));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(waitingIn(answer))
				.as("nothing waits for a moderator, and the answer says so")
				.isFalse();
		assertThat(howManySubmissions()).as("no submission is made").isEqualTo(submissionsBefore);
		assertThat(howManyInTheQueue())
				.as("no card of any tab stands in the queue for it")
				.isEqualTo(queueBefore);
		assertThat(howManyPublished()).isEqualTo(publishedBefore + 1);

		long id = idIn(answer);

		assertThat(db.sql("select event_id, competitor_id, who, rating_organisation, rating_value,"
						+ " rating_ambience, body, published_at between now() - interval '1 minute'"
						+ " and now() from event_comment where id = ?")
				.param(id)
				.query((row, one) -> List.of(String.valueOf(row.getObject(1)),
						String.valueOf(row.getObject(2)), row.getString(3),
						String.valueOf(row.getObject(4)), String.valueOf(row.getObject(5)),
						String.valueOf(row.getObject(6)), row.getString(7),
						String.valueOf(row.getBoolean(8))))
				.single())
				.as("the published row carries the event, THE AUTHOR, the name read off him, the"
						+ " three marks in the order they were sent, no words, and the moment it"
						+ " was written")
				.containsExactly(String.valueOf(run), String.valueOf(competitorId(ME)),
						"Mirko Mirković", "2", "3", "5", "", "true");

		List<JsonNode> page = thePageAsSeenBy(FIRST_WRITTEN);
		List<Long> ids = page.stream().map(one -> one.path("id").asLong()).toList();

		assertThat(ids).as("the page lists it, and it is not the only one on it").contains(id)
				.hasSize((int) publishedBefore + 1);
		assertThat(ids.indexOf(id))
				.as("neither first nor last: one comment is newer and one is older")
				.isStrictlyBetween(0, ids.size() - 1);

		JsonNode seen = page.get(ids.indexOf(id));

		assertThat(seen.path("eventId").asLong()).isEqualTo(run);
		assertThat(seen.path("who").asString()).isEqualTo("Mirko Mirković");
		assertThat(seen.path("memberNumber").asString()).isEqualTo(ME);
		assertThat(seen.path("body").asString()).isEmpty();
		assertThat(seen.path("rating").path("organisation").asInt()).isEqualTo(2);
		assertThat(seen.path("rating").path("value").asInt()).isEqualTo(3);
		assertThat(seen.path("rating").path("ambience").asInt()).isEqualTo(5);
	}

	/**
	 * THE OWNER'S SECOND HALF, 19.10.2026: A COMMENT WITH TEXT STILL GOES TO MODERATION AND IS ON NO
	 * PAGE. The same member, the same event and the same three marks as the case above, so the
	 * only thing that differs is the text.
	 */
	@Test
	void aCommentWithTextWaitsInTheQueueAndIsOnNoPage() throws Exception {
		long submissionsBefore = howManySubmissions();
		long queueBefore = howManyInTheQueue();
		long publishedBefore = howManyPublished();

		MockHttpServletResponse answer = rateAs(ME, form(run, 2, 3, 5, "Lepa staza."));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(waitingIn(answer)).isTrue();
		assertThat(idIn(answer)).isEqualTo((Long) rowFor(run, ME).get(0));
		assertThat(howManySubmissions()).isEqualTo(submissionsBefore + 1);
		assertThat(howManyInTheQueue()).isEqualTo(queueBefore + 1);
		assertThat(howManyPublished())
				.as("a comment that has not been approved is not published")
				.isEqualTo(publishedBefore);
		assertThat(thePageAsSeenBy(FIRST_WRITTEN))
				.as("and the page does not carry it, whatever the author's own view of it")
				.hasSize((int) publishedBefore);
	}

	/**
	 * WHAT IS NOT TEXT. Nothing but white space is the same state as an empty box (the strip this
	 * route has always applied before storing), so it is published and not queued. Every kind the
	 * strip knows is asked, the em space and the line break included, so a trim that only knows the
	 * ASCII space cannot pass. A code point of 0 stands for the field being there and empty.
	 */
	@ParameterizedTest
	@CsvSource({"0", "9", "10", "11", "12", "13", "32", "8195", "12288"})
	void whiteSpaceAloneIsNotTextAndIsPublishedAtOnce(int codePoint) throws Exception {
		long submissionsBefore = howManySubmissions();
		long publishedBefore = howManyPublished();
		String blanks = codePoint == 0 ? "" : new String(Character.toChars(codePoint)).repeat(3);

		MockHttpServletResponse answer = rateAs(ME, form(run, 4, 4, 4, blanks));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(waitingIn(answer)).isFalse();
		assertThat(howManySubmissions()).isEqualTo(submissionsBefore);
		assertThat(howManyPublished()).isEqualTo(publishedBefore + 1);
		assertThat(db.sql("select body from event_comment where id = ?").param(idIn(answer))
				.query(String.class).single())
				.as("what is stored is the empty string and not the white space that was sent")
				.isEmpty();
	}

	/** Text with white space around it is still text, and is queued with the white space stripped. */
	@Test
	void textBetweenWhiteSpaceIsStillTextAndWaits() throws Exception {
		long publishedBefore = howManyPublished();

		MockHttpServletResponse answer = rateAs(ME,
				form(run, 4, 4, 4, new String(Character.toChars(8195)) + " ok\n"));

		assertThat(waitingIn(answer)).isTrue();
		assertThat(howManyPublished()).isEqualTo(publishedBefore);
		assertThat(rowFor(run, ME).get(6)).isEqualTo("ok");
	}

	/**
	 * THE SAME MEMBER CHANGING HIS MIND, in both directions, on the same event. There is no route
	 * that edits a comment (the only mappings on {@code /api/comments} are this {@code POST} and the
	 * {@code GET}), so "edited from stars only to text" is a second rating, and the two are
	 * decided independently: whichever one has text waits, whichever has none is published.
	 */
	@Test
	void aStarsOnlyRatingThenOneWithTextAreDecidedEachOnItsOwn() throws Exception {
		MockHttpServletResponse first = rateAs(ME, form(run, 5, 5, 5, ""));
		MockHttpServletResponse second = rateAs(ME, form(run, 1, 1, 1, "Predomislio sam se."));

		assertThat(waitingIn(first)).isFalse();
		assertThat(waitingIn(second)).isTrue();
		assertThat(db.sql("select count(*) from event_comment where id = ? and body = ''")
				.param(idIn(first)).query(Long.class).single()).isEqualTo(1);
		assertThat(db.sql("select count(*) from comment_submission where id = ?")
				.param(idIn(second)).query(Long.class).single())
				.as("the waiting one is a submission")
				.isEqualTo(1);
		assertThat(howManyWaitingInTheCommentsQueue()).as("the fixture's own, plus the second").isEqualTo(2);
	}

	@Test
	void aRatingWithTextThenOneWithoutAreDecidedEachOnItsOwn() throws Exception {
		MockHttpServletResponse first = rateAs(ME, form(run, 1, 1, 1, "Prvo reči."));
		MockHttpServletResponse second = rateAs(ME, form(run, 5, 5, 5, ""));

		assertThat(waitingIn(first)).isTrue();
		assertThat(waitingIn(second)).isFalse();
		assertThat(howManyWaitingInTheCommentsQueue()).as("the fixture's own, plus the first").isEqualTo(2);
		assertThat(db.sql("select rating_organisation from event_comment where id = ?")
				.param(idIn(second)).query(Integer.class).single()).isEqualTo(5);
	}

	/**
	 * A MEMBER WHOSE FEE HAS LAPSED, AND AN ACCOUNT NAMING NO MEMBER, ARE TURNED AWAY ALSO WHEN
	 * THEY SEND NO TEXT: the new way in does not go round the door.
	 */
	@Test
	void aStarsOnlyRatingFromSomebodyTheDoorTurnsAwayPublishesNothing() throws Exception {
		long publishedBefore = howManyPublished();

		MockHttpServletResponse lapsed = rateAs(LAPSED, form(run, 4, 4, 4, ""));
		MockHttpServletResponse nobody = sent(form(run, 4, 4, 4, ""), new Cookie(SessionCookie.NAME,
				sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret()));

		assertThat(lapsed.getStatus()).isEqualTo(404);
		assertThat(nobody.getStatus()).isEqualTo(404);
		assertThat(howManyPublished()).isEqualTo(publishedBefore);
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
		long publishedBefore = howManyPublished();
		long submissionsBefore = howManySubmissions();

		MockHttpServletResponse answer = rateAs(ME, form(run, 4, 4, 4, null));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(waitingIn(answer)).isFalse();
		assertThat(howManyPublished()).isEqualTo(publishedBefore + 1);
		assertThat(howManySubmissions()).isEqualTo(submissionsBefore);
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

		long publishedBefore = howManyPublished();

		MockHttpServletResponse answer = rateAs(ME, form(run, organisation, value, ambience, ""));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(CommentWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(howManySubmissions()).isEqualTo(submissionsBefore);
		assertThat(howManyPublished())
				.as("a rating with no text is published at once, so a refusal has to be checked"
						+ " against the page as well as against the queue")
				.isEqualTo(publishedBefore);
	}

	@Test
	void aMarkOutsideTheScaleIsRefusedTheSameWayAMissingOneIs() throws Exception {
		long publishedBefore = howManyPublished();

		MockHttpServletResponse answer = rateAs(ME, form(run, 6, 4, 4, ""));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(CommentWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(howManyPublished()).isEqualTo(publishedBefore);
	}

	@Test
	void anEventNobodyKnowsIsRefusedBeforeAnythingAboutTheDayIsAsked() throws Exception {
		long submissionsBefore = howManySubmissions();

		long publishedBefore = howManyPublished();

		MockHttpServletResponse answer = rateAs(ME, form(9_999_999L, 4, 4, 4, ""));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(CommentWriteApi.THE_EVENT_IS_NOT_KNOWN);
		assertThat(howManySubmissions()).isEqualTo(submissionsBefore);
		assertThat(howManyPublished()).isEqualTo(publishedBefore);
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

		long publishedBefore = howManyPublished();

		MockHttpServletResponse answer = rateAs(ME, form(future, 4, 4, 4, ""));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(CommentWriteApi.THE_EVENT_HAS_NOT_BEEN_RUN);
		assertThat(howManySubmissions()).isEqualTo(submissionsBefore);
		assertThat(howManyPublished()).isEqualTo(publishedBefore);
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
		ran(ME, dayOfTheRace);

		clock.moveTo(Instant.parse("2027-09-30T22:30:00Z"));

		assertThat(rateAs(ME, form(dayOfTheRace, 4, 4, 4, "")).getStatus())
				.as("00:30 on 1 October in Belgrade, the day of the race itself, read as though it"
						+ " were still 30 September")
				.isEqualTo(201);
	}

	/**
	 * A MEMBER WITH NO RESULT ON THE EVENT CANNOT RATE IT (owner, 19.10.2026: „ako clan nema rezultat,
	 * ne moze uopste da da komentar"), with or without words, and NOTHING IS WRITTEN OR REMOVED.
	 *
	 * <p>{@link #FIRST_WRITTEN} has a result, but on {@link #runOtherEdition}, an event of the same
	 * name; {@link #SOMEONE_ELSE} has one on {@link #run}, the very event, but is somebody else. Neither
	 * opens the door. He also has a comment of his own already published on {@link #run}: a refusal
	 * that had first deleted the old rating would leave him with none, so that row is read back.
	 * The same member rating the event he DID run is the anchor, so what refuses him is the event and
	 * not the member.
	 */
	@Test
	void aMemberWithNoResultOnTheEventCannotRateItWithOrWithoutWords() throws Exception {
		long submissionsBefore = howManySubmissions();
		long queueBefore = howManyInTheQueue();
		long publishedBefore = howManyPublished();
		List<Long> hisOwnBefore = publishedBy(FIRST_WRITTEN, run);

		assertThat(hisOwnBefore).as("he has a published rating of the event already").hasSize(1);

		for (String words : new String[] {"", "Nisam bio tamo."}) {
			MockHttpServletResponse answer = rateAs(FIRST_WRITTEN, form(run, 4, 4, 4, words));

			assertThat(answer.getStatus()).isEqualTo(404);
			assertThat(answer.getContentAsString())
					.as("a refusal that says anything says that a write lives here")
					.isEmpty();
		}

		assertThat(howManySubmissions()).isEqualTo(submissionsBefore);
		assertThat(howManyInTheQueue()).isEqualTo(queueBefore);
		assertThat(howManyPublished()).isEqualTo(publishedBefore);
		assertThat(publishedBy(FIRST_WRITTEN, run))
				.as("the refusal came before the old rating was replaced")
				.isEqualTo(hisOwnBefore);

		assertThat(rateAs(FIRST_WRITTEN, form(runOtherEdition, 4, 4, 4, "")).getStatus())
				.as("the same member rating the event he did run is not refused")
				.isEqualTo(201);
	}

	/**
	 * A RUN THAT STILL WAITS FOR A MODERATOR IS NOT A RESULT: the form counts the results the portal
	 * serves, which are the approved ones (a waiting run is a {@code result_submission}), and so does
	 * this route. {@link #FIRST_WRITTEN} has one waiting on a race of {@link #run} and is refused.
	 */
	@Test
	void aRunStillWaitingForApprovalDoesNotMakeAMemberAbleToRate() throws Exception {
		db.sql("insert into result_submission (competitor_id, race_id, race_date, distance_km,"
						+ " ascent_m, descent_m, seconds, link, comment)"
						+ " select c.id, ra.id, ra.date, 10, 0, 0, 3600, 'https://primer.rs/rezultati', ''"
						+ " from competitor c, race ra where c.member_number = ? and ra.event_id = ?"
						+ " limit 1")
				.params(FIRST_WRITTEN, run).update();

		assertThat(db.sql("select count(*) from result_submission").query(Long.class).single())
				.as("the waiting run really is in the table")
				.isEqualTo(1);
		assertThat(rateAs(FIRST_WRITTEN, form(run, 4, 4, 4, "")).getStatus()).isEqualTo(404);
	}

	/**
	 * ONE RATING PER MEMBER PER EVENT, AND A NEW ONE WITH NO WORDS REPLACES THE OLD AT ONCE (owner,
	 * 19.10.2026). Four things stand around the old one and none of them may move: another member's
	 * published rating of the SAME event ({@link #FIRST_WRITTEN}'s, in the fixture), this member's
	 * published rating of ANOTHER event (the one of the same name), the count of everything else.
	 */
	@Test
	void aRatingWithNoWordsReplacesTheMembersOldPublishedOneOfThatEventAndNoOtherRow() throws Exception {
		published(ME, run, "2025-01-01T00:00:00Z", "Staro mišljenje");
		published(ME, runOtherEdition, "2025-01-01T00:00:00Z", "Mišljenje o drugom izdanju");

		List<Long> mineOnRun = publishedBy(ME, run);
		List<Long> mineElsewhere = publishedBy(ME, runOtherEdition);
		List<Long> theOtherMemberOnRun = publishedBy(FIRST_WRITTEN, run);
		long publishedBefore = howManyPublished();

		assertThat(mineOnRun).hasSize(1);
		assertThat(mineElsewhere).hasSize(1);
		assertThat(theOtherMemberOnRun).hasSize(1);

		MockHttpServletResponse answer = rateAs(ME, form(run, 5, 5, 5, ""));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(publishedBy(ME, run))
				.as("he has ONE published rating of the event and it is the new one")
				.containsExactly(idIn(answer));
		assertThat(publishedBy(ME, run)).doesNotContainAnyElementsOf(mineOnRun);
		assertThat(publishedBy(ME, runOtherEdition))
				.as("his rating of another event, of the same name, is not touched")
				.isEqualTo(mineElsewhere);
		assertThat(publishedBy(FIRST_WRITTEN, run))
				.as("another member's rating of the same event is not touched")
				.isEqualTo(theOtherMemberOnRun);
		assertThat(howManyPublished()).as("one went, one came").isEqualTo(publishedBefore);
	}

	/** A member who already has two (an approval used to be able to make a second) ends with one. */
	@Test
	void aRatingWithNoWordsLeavesAMemberWhoHadTwoWithOne() throws Exception {
		published(ME, run, "2025-01-01T00:00:00Z", "Prvo");
		published(ME, run, "2025-02-01T00:00:00Z", "Drugo");

		assertThat(publishedBy(ME, run)).hasSize(2);

		MockHttpServletResponse answer = rateAs(ME, form(run, 5, 5, 5, ""));

		assertThat(publishedBy(ME, run)).containsExactly(idIn(answer));
	}

	/**
	 * A RATING WITH WORDS REPLACES NOTHING YET: the old one stands until a moderator approves the new
	 * one (that replacement is {@code VerificationWriteApiTest}'s). What this route must not do is
	 * touch the old one or publish the new one.
	 */
	@Test
	void aRatingWithWordsLeavesTheOldPublishedOneStandingUntilItIsApproved() throws Exception {
		published(ME, run, "2025-01-01T00:00:00Z", "Staro mišljenje");

		List<Long> before = publishedBy(ME, run);
		long publishedBefore = howManyPublished();

		MockHttpServletResponse answer = rateAs(ME, form(run, 1, 1, 1, "Novo mišljenje."));

		assertThat(waitingIn(answer)).isTrue();
		assertThat(publishedBy(ME, run)).isEqualTo(before);
		assertThat(howManyPublished()).isEqualTo(publishedBefore);
	}

	/**
	 * A MEMBER WHOSE FEE HAS LAPSED IS TOLD THE ADDRESS IS NOT THERE, AND NOTHING IS WRITTEN -
	 * see the note on {@link #LAPSED}. The same form from {@link #ME}, whose fee stands, is the
	 * anchor: it goes through, so what turns the lapsed member away is his fee and not the form.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedIsToldTheAddressIsNotThere() throws Exception {
		long before = howManySubmissions();

		MockHttpServletResponse answer = rateAs(LAPSED, form(run, 4, 4, 4, "I dalje trčim."));

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(answer.getContentAsString())
				.as("a refusal that says anything says that a write lives here")
				.isEmpty();
		assertThat(howManySubmissions())
				.as("a member whose fee has lapsed was turned away and his rating was written anyway")
				.isEqualTo(before);

		assertThat(rateAs(ME, form(run, 4, 4, 4, "I dalje trčim.")).getStatus())
				.as("the same form from a member whose fee stands was turned away too, so the form and"
						+ " not the fee is what refused it")
				.isEqualTo(201);
	}

	/**
	 * A SECOND RATING OF ONE EVENT BY ONE MEMBER IS ACCEPTED WHILE THE FIRST STILL WAITS -
	 * PDL P21, „Rezultate prijavljuju samo ulogovani korisnici, pa se tu ne očekuje
	 * zloupotreba" says abuse is not expected of somebody signed in, and the moderator is
	 * the gate PDL P6, „forma je ne nudi kome ne pripada, a moderator vidi šta je stiglo"
	 * already names, not this route.
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
