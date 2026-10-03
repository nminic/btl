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
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * A MEMBER SAYING HE IS GOING, OR THAT HE IS NOT, AND WHAT THE TABLE HOLDS AFTERWARDS.
 *
 * <p>Every case reads {@code attending} itself rather than through {@code GET
 * /api/attendance}: the list filters by day and by fee, so a row this route wrongly wrote for a
 * lapsed member or a past event would never show there, and a case resting on the list would
 * be satisfied by the very fault it is about.
 *
 * <p><b>The clock is {@link AttendanceApiTest}'s</b>: half past ten at night in UTC on 14
 * September, which is already the 15th in Belgrade and still the 14th in UTC and in London. So
 * the event of the 14th is the one a write reading any zone but the league's would take.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AttendanceWriteApiTest {

	private static final Instant NOW = Instant.parse("2026-09-14T22:30:00Z");

	/** The first event written, so the lowest key there is, and long past. */
	private static final String PAST = "prosli-dogadjaj";

	/** Today by UTC and by London, already yesterday in Belgrade. */
	private static final String BELGRADE_YESTERDAY = "juce-u-beogradu";

	/** Today in Belgrade, which is still ahead. */
	private static final String BELGRADE_TODAY = "danasnji-dogadjaj";

	private static final String FUTURE_ONE = "buduci-dogadjaj-jedan";

	/** The event most cases are about. */
	private static final String FUTURE_TWO = "buduci-dogadjaj-dva";

	/** Active, and the lowest key among the members, so never the one who is asking. */
	private static final String FIRST_ACTIVE = "000005";

	/** Active, the one most cases are asked as, and he holds no membership row at all. */
	private static final String ASKER = "000010";

	/** Active, already going to {@link #FUTURE_TWO}. */
	private static final String ALSO_GOING = "000020";

	/** Lapsed, going to {@link #FUTURE_TWO} from before, and holding a membership row for 2027. */
	private static final String LAPSED = "000040";

	/** Active, and the member behind a moderator's account. */
	private static final String MODERATORS_ACTIVE = "000050";

	/** Lapsed, and the member behind another moderator's account. */
	private static final String MODERATORS_LAPSED = "000070";

	private static final String THE_ASKER = "takmicar@primer.rs";

	private static final String THE_LAPSED = "istekla-clanarina@primer.rs";

	private static final String NEVER_PAID = "nikad-placeno@primer.rs";

	private static final String NAMES_NO_MEMBER = "bez-clana@primer.rs";

	private static final String MODERATOR = "moderator@primer.rs";

	private static final String MODERATOR_WHO_RACES = "moderator-trci@primer.rs";

	private static final String MODERATOR_LAPSED = "moderator-istekla@primer.rs";

	private static final String SUPERADMIN = "superadmin@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final Map<String, SecretToken> sessions = new LinkedHashMap<>();

	private int issued;

	/**
	 * FIVE EVENTS, SEVEN PEOPLE, FIVE ANNOUNCEMENTS, AND EIGHT ACCOUNTS.
	 *
	 * <p>Each line refuses one wrong source:
	 *
	 * <ul>
	 * <li><b>The event the path names, and not another one.</b> The first event written is long
	 * past and the one most cases name is ahead, so a write that read the day off any other row
	 * than the one asked about is refused where it should go through.
	 * <li><b>The member the session names, and not another one.</b> The member with the lowest
	 * key is active and is not the one asking, so a write that took „the first active member"
	 * writes somebody else's row.
	 * <li><b>His row and nobody else's, on this event and no other.</b> {@link #FUTURE_ONE}
	 * carries the asker and the first member both, and the asker has a row on the past event as
	 * well, so a withdrawal that forgot either column takes somebody else's intention with it.
	 * <li><b>The fee, and not a row of {@code membership}.</b> The lapsed member holds a row for
	 * 2027 and the asker holds none, so reading „has a membership row" for any season answers
	 * both of them the wrong way round.
	 * <li><b>Two facts about who asks, so a grid.</b> A moderator who races for nobody, one whose
	 * member is active and one whose member has lapsed: being the administration lets none of
	 * them say anything, being an active member lets the second.
	 * </ul>
	 */
	@BeforeEach
	void fiveEventsSevenPeopleFiveAnnouncements() {
		event(PAST, "2020-01-01");
		event(BELGRADE_YESTERDAY, "2026-09-14");
		event(BELGRADE_TODAY, "2026-09-15");
		event(FUTURE_ONE, "2027-03-03");
		event(FUTURE_TWO, "2027-06-06");

		member(FIRST_ACTIVE, true);
		member(ASKER, true);
		member(ALSO_GOING, true);
		member(LAPSED, false);
		member(MODERATORS_ACTIVE, true);
		member(MODERATORS_LAPSED, false);
		long unpaid = neverPaid();

		exemptFor(LAPSED, 2027);

		attending(FUTURE_ONE, ASKER);
		attending(FUTURE_ONE, FIRST_ACTIVE);
		attending(PAST, ASKER);
		attending(FUTURE_TWO, ALSO_GOING);
		attending(FUTURE_TWO, LAPSED);

		account(THE_ASKER, "competitor");
		belongsTo(THE_ASKER, ASKER);
		account(THE_LAPSED, "competitor");
		belongsTo(THE_LAPSED, LAPSED);
		account(NEVER_PAID, "competitor");
		db.sql("update account set competitor_id = ? where email = ?").params(unpaid, NEVER_PAID)
				.update();
		account(NAMES_NO_MEMBER, "competitor");
		account(MODERATOR, "moderator");
		account(MODERATOR_WHO_RACES, "moderator");
		belongsTo(MODERATOR_WHO_RACES, MODERATORS_ACTIVE);
		account(MODERATOR_LAPSED, "moderator");
		belongsTo(MODERATOR_LAPSED, MODERATORS_LAPSED);
		account(SUPERADMIN, "superadmin");
	}

	private void event(String slug, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, date '" + day + "', (select id from place where rank = 1),"
						+ " null, null, 'race', false, '', '')")
				.params(slug, "Dogadjaj " + slug).update();
	}

	private void member(String number, boolean feeStanding) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Probic', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, ?, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, feeStanding, String.format("%016x", ++issued))
				.update();
	}

	/** Somebody who registered and has not paid: no number, and never active (V16). */
	private long neverPaid() {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (null, 'Nikad', 'Placeno', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, false, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.param(String.format("%016x", ++issued))
				.query(Long.class)
				.single();
	}

	/** A membership row for one season, given free of the fee, which needs no payment to name. */
	private void exemptFor(String memberNumber, int season) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values ((select id from competitor where member_number = ?), ?, 'feeExempt',"
						+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.params(memberNumber, season).update();
	}

	private void attending(String eventSlug, String memberNumber) {
		db.sql("insert into attending (event_id, competitor_id)"
						+ " values ((select id from btl_event where slug = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(eventSlug, memberNumber).update();
	}

	private void account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni',"
				+ " 'Probic', ?, (select id from role where code = ?))").params(email, role).update();

		SecretToken session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	private void belongsTo(String email, String memberNumber) {
		db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
				+ " where email = ?").params(memberNumber, email).update();
	}

	private long eventId(String slug) {
		return db.sql("select id from btl_event where slug = ?").param(slug)
				.query(Long.class).single();
	}

	private long competitorId(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single();
	}

	/** Who is going to this event, by member number, read off the table and nothing else. */
	private List<String> goingTo(String slug) {
		return db.sql("select c.member_number from attending a"
						+ " join competitor c on c.id = a.competitor_id"
						+ " where a.event_id = ? order by c.member_number")
				.param(eventId(slug))
				.query(String.class)
				.list();
	}

	/** Every row the table holds, as event and member keys, so nothing can move unseen. */
	private List<String> everyRow() {
		return db.sql("select event_id || ':' || competitor_id from attending"
						+ " order by event_id, competitor_id")
				.query(String.class)
				.list();
	}

	private MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder asking, String email) {
		return asking.with(csrf()).cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private MockHttpServletResponse going(String email, String slug) throws Exception {
		return http.perform(as(put("/api/attendance/" + eventId(slug)), email)).andReturn()
				.getResponse();
	}

	private MockHttpServletResponse notGoing(String email, String slug) throws Exception {
		return http.perform(as(delete("/api/attendance/" + eventId(slug)), email)).andReturn()
				.getResponse();
	}

	/**
	 * A MEMBER IN GOOD STANDING SAYS HE IS GOING, AND THE ROW IS HIS AND IS FOR THIS EVENT.
	 *
	 * <p>The row is read as keys, so „his" means his {@code competitor.id} and not the first
	 * active member's, and „this event" means the key in the path and not the first event's.
	 */
	@Test
	void aMemberInGoodStandingSaysHeIsGoingAndTheRowIsHisAndForThisEvent() throws Exception {
		assertThat(goingTo(FUTURE_TWO)).as("the asker is already going, so nothing is written")
				.doesNotContain(ASKER);

		assertThat(going(THE_ASKER, FUTURE_TWO).getStatus()).isEqualTo(204);

		assertThat(db.sql("select count(*) from attending where event_id = ? and competitor_id = ?")
				.params(eventId(FUTURE_TWO), competitorId(ASKER)).query(Integer.class).single())
				.as("no row names the asker and the event in the path")
				.isEqualTo(1);
		assertThat(goingTo(FUTURE_TWO))
				.as("the event now carries the asker beside the two who were going before, and"
						+ " nobody else")
				.containsExactly(ASKER, ALSO_GOING, LAPSED);
		assertThat(goingTo(PAST))
				.as("a row was written for another event than the one in the path")
				.containsExactly(ASKER);
	}

	/**
	 * SAID TWICE, IT IS ONE ROW AND NO FAULT: the switch is a state, and two tabs may both
	 * send it.
	 */
	@Test
	void sayingItTwiceLeavesOneRowAndNoFault() throws Exception {
		assertThat(going(THE_ASKER, FUTURE_TWO).getStatus()).isEqualTo(204);
		assertThat(going(THE_ASKER, FUTURE_TWO).getStatus())
				.as("the second time was a fault rather than the same state")
				.isEqualTo(204);

		assertThat(goingTo(FUTURE_TWO)).containsExactly(ASKER, ALSO_GOING, LAPSED);
	}

	/**
	 * TAKING IT BACK TAKES HIS NAME OFF THIS EVENT, AND NOBODY ELSE'S, AND NOTHING ELSE OF HIS.
	 *
	 * <p>Owner, 11.08.2026: „Ako ponovo kliknem na njega i isključim ga, automatski treba i da se
	 * sklonim sa liste posetioca događaja."
	 */
	@Test
	void takingItBackTakesHisNameOffThisEventAndNobodyElses() throws Exception {
		assertThat(goingTo(FUTURE_ONE)).as("the fixture does not carry two on the event")
				.containsExactly(FIRST_ACTIVE, ASKER);

		assertThat(notGoing(THE_ASKER, FUTURE_ONE).getStatus()).isEqualTo(204);

		assertThat(goingTo(FUTURE_ONE))
				.as("somebody else's row went with his")
				.containsExactly(FIRST_ACTIVE);
		assertThat(goingTo(PAST))
				.as("his row on another event went with this one")
				.containsExactly(ASKER);
	}

	/** Taking back what was never said changes nothing and is no fault. */
	@Test
	void takingBackWhatWasNeverSaidChangesNothing() throws Exception {
		List<String> before = everyRow();

		assertThat(notGoing(THE_ASKER, FUTURE_TWO).getStatus()).isEqualTo(204);
		assertThat(everyRow()).isEqualTo(before);
	}

	/** On, off and on again is one row, which is what makes it a switch rather than a log. */
	@Test
	void onOffAndOnAgainIsOneRow() throws Exception {
		assertThat(going(THE_ASKER, FUTURE_TWO).getStatus()).isEqualTo(204);
		assertThat(notGoing(THE_ASKER, FUTURE_TWO).getStatus()).isEqualTo(204);
		assertThat(goingTo(FUTURE_TWO)).doesNotContain(ASKER);
		assertThat(going(THE_ASKER, FUTURE_TWO).getStatus()).isEqualTo(204);

		assertThat(goingTo(FUTURE_TWO)).containsExactly(ASKER, ALSO_GOING, LAPSED);
	}

	/**
	 * AN EVENT RUN TODAY IN BELGRADE IS STILL AHEAD, AND ONE RUN YESTERDAY THERE IS NOT, THOUGH
	 * IT IS STILL TODAY IN UTC AND IN LONDON.
	 *
	 * <p>The day is the league's ({@link AttendanceApi#STILL_AHEAD}, read in {@code
	 * SeasonClock.ZONE}), the same day the list stops showing an event on.
	 */
	@Test
	void anEventIsAheadByTheLeaguesDayAndNotTheMachines() throws Exception {
		assertThat(going(THE_ASKER, BELGRADE_TODAY).getStatus())
				.as("an event run today in Belgrade was refused, so the boundary is `>` and not `>=`")
				.isEqualTo(204);
		assertThat(goingTo(BELGRADE_TODAY)).containsExactly(ASKER);

		MockHttpServletResponse yesterday = going(THE_ASKER, BELGRADE_YESTERDAY);

		assertThat(yesterday.getStatus())
				.as("an event of yesterday in Belgrade was taken, so the day was read in UTC or"
						+ " another zone ahead of it")
				.isEqualTo(400);
		assertThat(yesterday.getContentAsString()).isEqualTo("{\"reason\":\"theEventHasBeenRun\"}");
		assertThat(goingTo(BELGRADE_YESTERDAY)).isEmpty();
	}

	/**
	 * A PAST EVENT REFUSES BOTH VERBS, AND HIS OLD ROW ON IT STAYS WHERE IT IS.
	 *
	 * <p>One boundary for giving and taking back, confirmed before this was written; the row is
	 * never served, so leaving it changes nothing anybody reads.
	 */
	@Test
	void aPastEventRefusesBothVerbsByName() throws Exception {
		MockHttpServletResponse on = going(THE_ASKER, PAST);
		MockHttpServletResponse off = notGoing(THE_ASKER, PAST);

		assertThat(on.getStatus()).isEqualTo(400);
		assertThat(on.getContentAsString()).isEqualTo("{\"reason\":\"theEventHasBeenRun\"}");
		assertThat(off.getStatus())
				.as("taking back an announcement for a past event went through, so the two verbs"
						+ " have two boundaries")
				.isEqualTo(400);
		assertThat(off.getContentAsString()).isEqualTo("{\"reason\":\"theEventHasBeenRun\"}");
		assertThat(goingTo(PAST)).containsExactly(ASKER);
	}

	/**
	 * AN EVENT THAT IS NOT THERE IS AN ADDRESS THAT IS NOT THERE, AND SO IS A WORD WHERE ITS KEY
	 * GOES.
	 *
	 * <p>The bytes of the two are compared over a socket by {@code AWordInAKeyOverRealHttpTest},
	 * which reads this route off the dispatcher; this holds the number and the table.
	 */
	@Test
	void anEventThatIsNotThereIsAnAddressThatIsNotThere() throws Exception {
		List<String> before = everyRow();

		for (String key : List.of("9999999999", "nije-kljuc")) {
			assertThat(http.perform(as(put("/api/attendance/" + key), THE_ASKER)).andReturn()
					.getResponse().getStatus()).as("PUT for %s", key).isEqualTo(404);
			assertThat(http.perform(as(delete("/api/attendance/" + key), THE_ASKER)).andReturn()
					.getResponse().getStatus()).as("DELETE for %s", key).isEqualTo(404);
		}

		assertThat(everyRow()).isEqualTo(before);
	}

	/**
	 * A MEMBER WHOSE FEE HAS LAPSED SAYS NOTHING EITHER WAY, AND A ROW OF MEMBERSHIP DOES NOT
	 * MAKE HIM ACTIVE.
	 *
	 * <p>PDL, 03.10.2026, recording the owner's choice between offered outcomes: „Najavu dolaska
	 * daju ... aktivni članovi (važeća članarina)". Answered as an address that maps nothing
	 * (ADL A8). His announcement from before stays as it was: the list does not show it while
	 * his fee is lapsed, and he may not touch it.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedSaysNothingEitherWay() throws Exception {
		assertThat(db.sql("select count(*) from membership where competitor_id = ?")
				.param(competitorId(LAPSED)).query(Integer.class).single())
				.as("the lapsed member holds no membership row, so this case cannot tell the flag"
						+ " from the row")
				.isEqualTo(1);

		List<String> before = everyRow();

		assertThat(going(THE_LAPSED, FUTURE_ONE).getStatus()).isEqualTo(404);
		assertThat(notGoing(THE_LAPSED, FUTURE_TWO).getStatus()).isEqualTo(404);
		assertThat(everyRow()).isEqualTo(before);
	}

	/**
	 * NOBODY SIGNED IN WHO IS NOT A MEMBER IN GOOD STANDING SAYS ANYTHING: somebody who never
	 * paid, an account that races for nobody, and the administration as such.
	 *
	 * <p>The superadmin and a moderator read the list; saying you are going is a member's, and
	 * neither of them is one. A moderator whose own member has lapsed is the case that tells
	 * the two questions apart: the administration does not lend him the member's right.
	 */
	@Test
	void nobodyButAMemberInGoodStandingSaysAnything() throws Exception {
		List<String> before = everyRow();

		for (String email : List.of(NEVER_PAID, NAMES_NO_MEMBER, MODERATOR, MODERATOR_LAPSED,
				SUPERADMIN)) {
			assertThat(going(email, FUTURE_TWO).getStatus()).as("%s said he is going", email)
					.isEqualTo(404);
			assertThat(notGoing(email, FUTURE_ONE).getStatus()).as("%s took one back", email)
					.isEqualTo(404);
		}

		assertThat(everyRow()).isEqualTo(before);
	}

	/**
	 * NOBODY THIS ADDRESS IS NOT FOR LEARNS THAT AN EVENT HAS BEEN RUN, WHICHEVER VERB HE SENDS.
	 *
	 * <p>The class note puts the member before the day „so somebody this address is not for learns
	 * nothing about any event from it", and until this case nothing held the order: the two cases
	 * above ask the people it is not for only about events still ahead, where the day passes
	 * whichever question comes first and the two orders answer alike. With the event and its day
	 * asked before the member, all twelve cases of this class were green (review of PR 479, HIGH),
	 * and a member whose fee had lapsed was told {@code theEventHasBeenRun} by an address that has
	 * nothing to tell him.
	 *
	 * <p>Here the same six accounts the two cases above keep ask about the two events that have
	 * been run: the one run long ago, and the one run yesterday in Belgrade that a clock read in UTC
	 * would still call today. The answer is always the 404 of an address that maps nothing, and
	 * never the 400 that names the day. The anchor stands first, so that a 404 cannot mean „no such
	 * event": the same two events, asked by an active member, are the 400.
	 */
	@Test
	void nobodyTheAddressIsNotForLearnsThatAnEventHasBeenRun() throws Exception {
		List<String> before = everyRow();

		for (String run : List.of(PAST, BELGRADE_YESTERDAY)) {
			assertThat(going(THE_ASKER, run).getStatus())
					.as("an active member said he is going to %s, so it is not an event that has been"
							+ " run", run)
					.isEqualTo(400);
			assertThat(notGoing(THE_ASKER, run).getStatus())
					.as("an active member took one back from %s, so it is not an event that has been"
							+ " run", run)
					.isEqualTo(400);

			for (String email : List.of(THE_LAPSED, NEVER_PAID, NAMES_NO_MEMBER, MODERATOR,
					MODERATOR_LAPSED, SUPERADMIN)) {
				assertThat(going(email, run).getStatus())
						.as("%s said he is going to %s and was told about its day", email, run)
						.isEqualTo(404);
				assertThat(notGoing(email, run).getStatus())
						.as("%s took one back from %s and was told about its day", email, run)
						.isEqualTo(404);
			}
		}

		assertThat(everyRow()).isEqualTo(before);
	}

	/**
	 * A MODERATOR WHOSE MEMBER IS IN GOOD STANDING SAYS IT AS THAT MEMBER.
	 *
	 * <p>The anchor of the case above: being the administration takes nothing away either.
	 */
	@Test
	void aModeratorWhoRacesSaysItAsTheMemberHeIs() throws Exception {
		assertThat(going(MODERATOR_WHO_RACES, FUTURE_TWO).getStatus()).isEqualTo(204);
		assertThat(goingTo(FUTURE_TWO)).containsExactly(ALSO_GOING, LAPSED, MODERATORS_ACTIVE);
	}

	/**
	 * NOBODY WHO IS NOT SIGNED IN REACHES EITHER VERB: the chain asks him to sign in, because
	 * the address is not on {@link ApiSecurity#READ_BY_ANYBODY}.
	 *
	 * <p>ADL A8, 13.09.2026: every route named in {@code ANSWERS_WITHOUT_A_RIGHT} carries a case
	 * that fails if it is opened to somebody not signed in. With the token, so that what is
	 * measured is the session and not the CSRF filter.
	 */
	@Test
	void nobodyWhoIsNotSignedInReachesEitherVerb() throws Exception {
		List<String> before = everyRow();

		assertThat(http.perform(put("/api/attendance/" + eventId(FUTURE_TWO)).with(csrf()))
				.andReturn().getResponse().getStatus()).isEqualTo(401);
		assertThat(http.perform(delete("/api/attendance/" + eventId(FUTURE_ONE)).with(csrf()))
				.andReturn().getResponse().getStatus()).isEqualTo(401);
		assertThat(everyRow()).isEqualTo(before);
	}

	/** The clock {@link AttendanceApiTest} uses, for the reason given there. */
	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock aClockFixedTheNightBelgradeCrossesIntoTomorrow() {
			return Clock.fixed(NOW, ZoneOffset.UTC);
		}
	}
}
