package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
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

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.StringJoiner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * WHO SAID THEY ARE COMING, read by members and by nobody else.
 *
 * <p>Closed the same way {@link CommentApiTest} closes {@code /api/comments}: this
 * file measures that a visitor is refused and a signed in member is not, plus the two
 * questions that are this resource's own: only a FUTURE event answers, and only a
 * member in good standing does.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AttendanceApiTest {

	private static final String A_MEMBER = "takmicar@primer.rs";

	private static final String ACTIVE_ONE = "000010";

	private static final String ACTIVE_TWO = "000020";

	private static final String ACTIVE_THREE = "000030";

	/** The one member of the fixture whose fee has lapsed. */
	private static final String LAPSED = "000040";

	/**
	 * HALF PAST TEN AT NIGHT IN UTC ON 14 SEPTEMBER, chosen to fall where Belgrade and
	 * London disagree and not only where Belgrade and UTC do.
	 *
	 * <p><b>Half past ELEVEN, the first draft's moment, could not tell Belgrade from
	 * London and a review measured it rather than assuming it.</b> Both are ahead of
	 * UTC in September (Belgrade CEST, UTC+2; London BST, UTC+1), and 23:30 UTC plus
	 * either offset already crosses into the 15th - so a query reading
	 * {@code Europe/London} passed every case here exactly as {@code Europe/Belgrade}
	 * does, and so did the server's own default zone on a host that happens to sit at
	 * UTC+2 in September, which is most of this codebase's own machines. Moved back one
	 * hour, 22:30 UTC plus Belgrade's two hours crosses to 00:30 on the 15th while 22:30
	 * plus London's one hour only reaches 23:30 on the 14th - so only the league's own
	 * zone now answers with a different day than London or plain UTC do.
	 *
	 * <p><b>What this still cannot tell apart, and that is a floor rather than an
	 * oversight.</b> Every zone this moment shares Belgrade's exact offset with in
	 * September - {@code Europe/Paris}, {@code Europe/Berlin}, {@code Europe/Budapest},
	 * and any other member of the EU's own daylight saving calendar - answers the same
	 * day Belgrade does, because they ARE the same offset on the same dates. No fixed
	 * instant can separate two zones that never disagree; that would take reading the
	 * zone's own identifier, which is exactly the literal {@code SeasonClock.ZONE} this
	 * class already reads and every other query in this package trusts by name rather
	 * than by measuring it anew. The clock this fixture hands the server reports
	 * {@link ZoneOffset#UTC} as ITS zone, the same as {@code ResultApiTest}'s does and
	 * for the same reason: the mutation this guards against is answering from the
	 * machine's own zone instead of asking {@code SeasonClock} for the league's.
	 */
	private static final Instant NOW = Instant.parse("2026-09-14T22:30:00Z");

	/** Still today by the server's own zone, and already yesterday in Belgrade. */
	private static final String BELGRADE_YESTERDAY = "2026-09-14";

	/** Today in Belgrade, and the one date this file asks the `>=` boundary about. */
	private static final String BELGRADE_TODAY = "2026-09-15";

	private static final String CLEARLY_PAST = "2020-01-01";

	private static final String CLEARLY_FUTURE_ONE = "2027-03-03";

	private static final String CLEARLY_FUTURE_TWO = "2027-06-06";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private SecretToken session;

	/** Feeds the sixteen lowercase hexadecimal characters {@code referral_code} needs
	 *  (V7's shape check), the same generator {@code CommentApiTest} uses on
	 *  {@code b53-komentari} (PR 278). */
	private int issued;

	/**
	 * FIVE EVENTS, FOUR MEMBERS, SEVEN ANNOUNCEMENTS, AND ONLY FOUR OF THEM ANSWER.
	 *
	 * <p>Each list below says which wrong answer it refuses:
	 *
	 * <ul>
	 * <li><b>The day.</b> One event is plainly in the past (2020), one is plainly in
	 * the future (twice, so a resource answering for one event is the wrong length),
	 * one falls exactly on the `>=` boundary Belgrade is standing at, and one falls on
	 * the one day that is still "today" in UTC and already tomorrow-crossed-into
	 * yesterday in Belgrade - the fixture {@code ResultApiTest} already proved this
	 * class of boundary needs, read here for a portal reading a DATE column rather than
	 * an instant.
	 * <li><b>The membership.</b> Three members are in good standing and one has let
	 * his fee lapse; the lapsed one announces for the CLEARLY future event, on purpose,
	 * so that his absence from the answer cannot be explained by the date filter -
	 * only by the membership one.
	 * <li><b>Never the only one of its kind.</b> Two members go to the boundary event,
	 * two different members go to the two clearly-future events between them, so a
	 * case that reached for {@code answer().get(0)} instead of the record it names
	 * would be about somebody else and would fail (06.09.2026's rule).
	 * <li><b>The order the rows were written is not the order the answer comes back
	 * in.</b> Written scrambled on purpose, so a query with no {@code order by} would
	 * answer in a different order than the one the cases below check for.
	 * </ul>
	 */
	@BeforeEach
	void fiveEventsFourMembersSevenAnnouncements() {
		account(A_MEMBER);

		event("prosli-dogadjaj", CLEARLY_PAST);
		event("juce-u-beogradu", BELGRADE_YESTERDAY);
		event("danasnji-dogadjaj", BELGRADE_TODAY);
		event("buduci-dogadjaj-jedan", CLEARLY_FUTURE_ONE);
		event("buduci-dogadjaj-dva", CLEARLY_FUTURE_TWO);

		member(ACTIVE_ONE, "Nikola", "Jovic", "M", true);
		member(ACTIVE_TWO, "Sofija", "Lukic", "F", true);
		member(ACTIVE_THREE, "Vuk", "Maric", "M", true);
		member(LAPSED, "Ana", "Peric", "F", false);

		/* SCRAMBLED ON PURPOSE, so a missing `order by` answers in a different order
		   than theAnswerIsSortedByEventThenByMemberNumber checks for. */
		attending("danasnji-dogadjaj", ACTIVE_TWO);
		attending("buduci-dogadjaj-jedan", ACTIVE_TWO);
		attending("prosli-dogadjaj", ACTIVE_ONE);
		attending("buduci-dogadjaj-dva", ACTIVE_THREE);
		attending("danasnji-dogadjaj", ACTIVE_ONE);
		attending("juce-u-beogradu", ACTIVE_ONE);
		/* THE LAPSED MEMBER, FOR A CLEARLY FUTURE EVENT. Not the boundary and not
		   yesterday: if this one is missing from the answer, the date filter cannot be
		   why. */
		attending("buduci-dogadjaj-jedan", LAPSED);
	}

	private void account(String email) {
		db.sql("insert into account (email, role_id) values (?,"
				+ " (select id from role where code = 'competitor'))").param(email).update();

		session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();
	}

	private void event(String slug, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, date '" + day + "', (select id from place where rank = 1),"
						+ " null, null, 'race', false, '', '')")
				.params(slug, "Dogadjaj " + slug).update();
	}

	private long eventId(String slug) {
		return db.sql("select id from btl_event where slug = ?").param(slug)
				.query(Long.class).single();
	}

	/**
	 * @param feeStanding whether the membership is currently renewed, which is what
	 *                    {@code AttendanceApi} reads instead of the event's own date
	 */
	private void member(String number, String first, String last, String gender,
			boolean feeStanding) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, ?, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, gender, feeStanding, String.format("%016x", ++issued))
				.update();
	}

	private void attending(String eventSlug, String memberNumber) {
		db.sql("insert into attending (event_id, competitor_id)"
						+ " values ((select id from btl_event where slug = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(eventSlug, memberNumber).update();
	}

	/**
	 * WHETHER A ROW REALLY SITS IN {@code attending} FOR THIS PAIR, read from the
	 * database rather than through the endpoint under test.
	 *
	 * <p>The floor every {@code doesNotContain} below needs and did not have: such an
	 * assertion is satisfied equally by "the guard removed the row" and by "the row was
	 * never written", and this file's own fixture is the only thing that tells the two
	 * apart. Found by review on the PR: turning off any one of the three
	 * {@code attending(...)} calls those cases are about left the whole file green,
	 * because nothing had asked the database whether the row it expects to be filtering
	 * OUT was ever really there to filter.
	 */
	private boolean announced(String eventSlug, String memberNumber) {
		return db.sql("select count(*) from attending a"
						+ " join btl_event e on e.id = a.event_id"
						+ " join competitor c on c.id = a.competitor_id"
						+ " where e.slug = ? and c.member_number = ?")
				.params(eventSlug, memberNumber)
				.query(Integer.class).single() == 1;
	}

	private MockHttpServletRequestBuilder asking() {
		return get("/api/attendance").cookie(new Cookie(SessionCookie.NAME, session.secret()));
	}

	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(whole());
	}

	private String whole() throws Exception {
		return http.perform(asking()).andReturn().getResponse().getContentAsString();
	}

	private record Row(long eventId, String memberNumber) {

		@Override
		public String toString() {
			return new StringJoiner(", ", "(", ")").add("event " + eventId)
					.add(memberNumber).toString();
		}
	}

	private List<Row> rows() throws Exception {
		List<Row> out = new ArrayList<>();
		for (JsonNode one : answer()) {
			out.add(new Row(one.path("eventId").asLong(), one.path("memberNumber").asString()));
		}
		return out;
	}

	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/attendance", answer(), "attendance.json");
	}

	@Test
	void noFieldOfTheAnswerIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord("/api/attendance", answer());
	}

	/**
	 * A VISITOR WHO IS NOT SIGNED IN IS NOT SERVED THE LIST.
	 *
	 * <p>The owner, 11.08.2026: „Tu listu ko je prijavljen takođe vide samo ulogovani
	 * članovi." A visitor sees the calendar and its results; who is going to one of
	 * them he does not.
	 *
	 * <p><b>This case is why the route's absence from {@code READ_BY_ANYBODY} is
	 * measured at all</b> - nothing else would catch it moving there, the same
	 * reasoning {@code CommentApiTest} carries for {@code /api/comments} on
	 * {@code b53-komentari} (PR 278).
	 *
	 * <p><b>Both halves.</b> Without the 200, a resource refusing everybody would pass
	 * the refusal above it and say the rule held.
	 */
	@Test
	void aVisitorWhoIsNotSignedInIsNotServedTheList() throws Exception {
		assertThat(http.perform(get("/api/attendance")).andReturn().getResponse().getStatus())
				.as("a visitor was served who is going, and the owner decided on 11.08.2026 that"
						+ " the list is for signed in members only")
				.isEqualTo(401);

		assertThat(http.perform(asking()).andReturn().getResponse().getStatus())
				.as("a signed in member was refused the list, so the refusal above is not about who"
						+ " is asking")
				.isEqualTo(200);
	}

	/**
	 * ONLY A FUTURE EVENT'S ANNOUNCEMENTS COME BACK.
	 *
	 * <p>„Prijavljen član najavljuje odlazak na BUDUĆI događaj" ({@code PDL.md:288}),
	 * and {@code PDL.md:153} keeps the portal from ever turning that intention into a
	 * record of what really happened: „DNF i nedolazak se ne evidentiraju".
	 *
	 * <p><b>Read in the league's own time, not the server's nor any other zone ahead of
	 * UTC, which is the whole reason the fixture's moment is the one it is.</b> The
	 * clock this test hands the server reports UTC as ITS OWN zone, where „today" is
	 * still the 14th; in {@code Europe/London}, one hour ahead, it is also still the
	 * 14th; only in Belgrade, two hours ahead, is it already the 15th. An event dated
	 * the 14th is therefore future by the server's zone AND by London's, and past only
	 * by the league's - so this floor rules out both the earlier draft's blind spot
	 * (reading UTC) and the one a review found next (reading any zone that is merely
	 * "ahead of UTC" without being Belgrade's own).
	 */
	@Test
	void onlyAFutureEventsAnnouncementsComeBack() throws Exception {
		assertThat(db.sql("select (timestamptz '" + NOW + "' at time zone 'UTC')::date = date '"
						+ BELGRADE_YESTERDAY + "'"
						+ " and (timestamptz '" + NOW + "' at time zone 'Europe/London')::date"
						+ " = date '" + BELGRADE_YESTERDAY + "'"
						+ " and (timestamptz '" + NOW + "' at time zone 'Europe/Belgrade')::date"
						+ " = date '" + BELGRADE_TODAY + "'")
				.query(Boolean.class).single())
				.as("the clock's moment does not really separate Belgrade from both UTC and London,"
						+ " so the case below measures nothing about reading the wrong one")
				.isTrue();

		assertThat(announced("prosli-dogadjaj", ACTIVE_ONE))
				.as("the clearly past event's announcement was never written, so its absence below"
						+ " proves nothing about the filter")
				.isTrue();

		assertThat(announced("juce-u-beogradu", ACTIVE_ONE))
				.as("the Belgrade-yesterday event's announcement was never written, so its absence"
						+ " below proves nothing about the filter or the zone")
				.isTrue();

		List<Row> rows = rows();

		assertThat(rows)
				.as("the clearly past event answered, and PDL.md:153 keeps a past intention from"
						+ " becoming a record of what happened")
				.doesNotContain(new Row(eventId("prosli-dogadjaj"), ACTIVE_ONE));

		assertThat(rows)
				.as("an event that is still \"today\" by the server's own UTC zone, and by London's,"
						+ " and already YESTERDAY in Belgrade, answered - so this read a zone other"
						+ " than the league's own")
				.doesNotContain(new Row(eventId("juce-u-beogradu"), ACTIVE_ONE));

		assertThat(rows)
				.as("the event exactly on the boundary did not answer, so the comparison is `>` and"
						+ " not `>=`; a member may still say they are coming to something run today")
				.contains(new Row(eventId("danasnji-dogadjaj"), ACTIVE_ONE));
	}

	/**
	 * A MEMBER WHOSE FEE HAS LAPSED IS NOT AMONG THOSE GOING, even to a clearly future
	 * event - so the date filter above is not why he is missing.
	 *
	 * <p><b>The fourth time this exact leak has been named, after pairs, results and
	 * comments, all on 13.09.2026.</b> {@code attending} carries no name to keep beside
	 * the number the way {@code event_comment.who} does ({@code ADL.md}: „samo par
	 * (eventId, memberNumber)"), so there is no half-answer here: leaving the bare
	 * number in would say, by the DIFFERENCE between this answer and
	 * {@code /api/competitors}, exactly the thing Article 74 puts beside the date of
	 * birth.
	 *
	 * <p><b>The anchor is what makes this a measurement.</b> A member in good standing,
	 * announced for the SAME event, still answers - so this is not a resource that
	 * lost every number, and not a resource that emptied out that one event.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedIsNotAmongThoseGoing() throws Exception {
		assertThat(db.sql("select active from competitor where member_number = ?").param(LAPSED)
				.query(Boolean.class).single())
				.as("the fixture's lapsed member is not actually lapsed, so his absence below would"
						+ " not be about his membership")
				.isFalse();

		assertThat(announced("buduci-dogadjaj-jedan", LAPSED))
				.as("the lapsed member's announcement was never written, so its absence below proves"
						+ " nothing about the membership filter")
				.isTrue();

		List<Row> rows = rows();
		long future = eventId("buduci-dogadjaj-jedan");

		assertThat(rows)
				.as("a member whose fee has lapsed was announced as going, and leaving him in would"
						+ " name, by subtraction against /api/competitors, that his fee is the reason"
						+ " he is not on it")
				.doesNotContain(new Row(future, LAPSED));

		assertThat(rows)
				.as("a member in good standing, announced for the very same event, is also missing -"
						+ " so what is withheld above is the lapsed membership and not the event")
				.contains(new Row(future, ACTIVE_TWO));
	}

	/**
	 * THE WHOLE SET OF SURVIVING ANNOUNCEMENTS IS ANSWERED, EXACTLY.
	 *
	 * <p>Four rows, across three events and three members, read as a complete set
	 * rather than by position - so a query that answered with the FIRST configured
	 * announcement regardless of which was really asked for (a source swapped for
	 * {@code fromFile.getFirst()} rather than joined) would be caught here even though
	 * such a bug could still print a plausible-looking single row.
	 */
	@Test
	void theWholeSetOfSurvivingAnnouncementsIsAnsweredExactly() throws Exception {
		assertThat(rows()).containsExactlyInAnyOrder(
				new Row(eventId("danasnji-dogadjaj"), ACTIVE_ONE),
				new Row(eventId("danasnji-dogadjaj"), ACTIVE_TWO),
				new Row(eventId("buduci-dogadjaj-jedan"), ACTIVE_TWO),
				new Row(eventId("buduci-dogadjaj-dva"), ACTIVE_THREE));
	}

	/**
	 * AND THE ANSWER IS ORDERED BY EVENT AND THEN BY MEMBER NUMBER.
	 *
	 * <p>The last tie-break so the order is total, the same shape {@code PairApi}
	 * settles a season's pairs by the man's number. The fixture writes its seven
	 * announcements in an order that matches neither this one nor the order the events
	 * or members were created in, so a query with no {@code order by} answers in
	 * whatever order the rows happen to sit in rather than in this one.
	 */
	@Test
	void theAnswerIsOrderedByEventThenByMemberNumber() throws Exception {
		List<Row> rows = rows();

		assertThat(rows).as("fewer than two rows compares nothing about order")
				.hasSizeGreaterThan(1);

		List<Row> sorted = rows.stream()
				.sorted(Comparator.comparingLong(Row::eventId).thenComparing(Row::memberNumber))
				.toList();

		assertThat(rows)
				.as("the answer is not in order by event and then by member number")
				.containsExactlyElementsOf(sorted);
	}

	/**
	 * A CLOCK FIXED THE NIGHT BELGRADE CROSSES INTO TOMORROW, standing in for the
	 * server's own clock ({@code WhatTimeItIs}) the same way {@code ResultApiTest}'s
	 * does. It reports {@link ZoneOffset#UTC} on purpose: whoever asks what day it is
	 * has to re-read the instant in the league's own time, and a server that reads
	 * this zone instead calls the 14th what is already the 15th in Belgrade.
	 *
	 * <p>{@link Clock#fixed} already answers {@code withZone} correctly on its own -
	 * the same instant, reported in whichever zone is asked for - so nothing here
	 * needs the mutable wrapper {@code ResultApiTest} uses to move its clock between
	 * cases; every case in this file reads the one moment above.
	 */
	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock aClockFixedTheNightBelgradeCrossesIntoTomorrow() {
			return Clock.fixed(NOW, ZoneOffset.UTC);
		}
	}
}
