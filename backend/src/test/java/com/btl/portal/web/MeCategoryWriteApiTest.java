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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.lang.reflect.RecordComponent;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * PUT /api/me/category: A MEMBER SAYS WHICH CATEGORY HE WANTS, AND CHANGES HIS MIND.
 *
 * <p><b>THREE MEMBERS, AND THE ONE WHO WRITES IS NEITHER THE FIRST BY KEY NOR THE ONLY ONE OF
 * HIS KIND.</b>
 *
 * <ul>
 * <li><b>{@link #FIRST_BY_KEY} is inserted before anybody else and WANTS the beginners'
 *     category</b>, which is the opposite of where the member who writes starts. A statement
 *     that updated „the first row", or resolved the member any way other than off the session,
 *     lands on her - and every case below asserts her wish is exactly what it was.
 * <li><b>{@link #HE_CHOOSES} starts at false and sends true</b>, so „the route wrote what was
 *     sent" and „the route wrote true into the column" are told apart by the case that sends
 *     false again.
 * <li><b>{@link #OVER_THE_LINE} has twelve points and sends true anyway.</b> He is answered 200
 *     and his wish is stored, which is the decision and not an oversight: see
 *     {@link #aWishHeHasNoRightToIsStoredAndTheCategoryIsStillHisAgeBand}.
 * </ul>
 *
 * <p><b>The clock stands inside the renewal window</b>, 15 October 2028, so the season being
 * chosen is 2029 and the deadline of 1 January 2029 at 10:00 has not passed. The two cases
 * about time move it themselves.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MeCategoryWriteApiTest {

	private static final String PATH = "/api/me/category";

	private static final String NOTHING_IS_THERE = "/api/zzzzzzzzzz";

	private static final Instant IN_OCTOBER_2028 = Instant.parse("2028-10-15T12:00:00Z");

	/** Ten o'clock in Belgrade on 1 January 2029, which is the deadline itself. */
	private static final Instant THE_DEADLINE = Instant.parse("2029-01-01T09:00:00Z");

	/** The first member by key, and she wants what the member who writes does not. */
	private static final String FIRST_BY_KEY = "000041";

	/** The member who writes in every case below. */
	private static final String HE_CHOOSES = "000042";

	/** Twelve points in an official season, so the beginners' category is shut to him. */
	private static final String OVER_THE_LINE = "000043";

	private static final String MODERATOR_WHO_DOES_NOT_RACE = "moderator@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	private final ObjectMapper mapper = new ObjectMapper();

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	/** The same shape {@code MembershipWriteApiTest} uses, and it reports UTC for the same reason. */
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
			return new AClockTheCaseMoves(IN_OCTOBER_2028);
		}
	}

	@BeforeEach
	void threeMembersAndAModeratorWhoDoesNotRace() {
		clock.moveTo(IN_OCTOBER_2028);

		competitor(FIRST_BY_KEY, "Prva", "Po Kljucu", "F", "1990-01-01", true);
		competitor(HE_CHOOSES, "Drugi", "Bira", "M", "1985-01-01", false);
		competitor(OVER_THE_LINE, "Treci", "Presao", "M", "1970-01-01", false);

		account(FIRST_BY_KEY + "@primer.rs", "competitor", FIRST_BY_KEY);
		account(HE_CHOOSES + "@primer.rs", "competitor", HE_CHOOSES);
		account(OVER_THE_LINE + "@primer.rs", "competitor", OVER_THE_LINE);
		account(MODERATOR_WHO_DOES_NOT_RACE, "moderator", null);

		aRaceThatHappened("prva-sezona", "Trka prve sezone", "2027-05-10");
		aRunBy(OVER_THE_LINE, "Trka prve sezone", "2027-05-10", "12.00");
	}

	/** A visitor is refused by the chain, and a member is not. */
	@Test
	void aVisitorWhoIsNotSignedInIsRefusedAndAMemberIsNot() throws Exception {
		assertThat(sentBy(null, PATH, wishing(true)).getStatus()).isEqualTo(401);
		assertThat(sent(HE_CHOOSES, wishing(true)).getStatus()).isEqualTo(200);
	}

	/**
	 * AN ACCOUNT WITH NO MEMBER BEHIND IT IS ANSWERED EXACTLY AS AN ADDRESS THAT IS NOT THERE.
	 *
	 * <p>The comparison is against a {@code PUT} carrying the same JSON at an address nothing
	 * maps, and both halves are asserted: that the unmapped address really answers 404, so the
	 * equality below is not two 200s agreeing, and that the two carry the same status and the
	 * same body.
	 */
	@Test
	void aModeratorWhoDoesNotRaceIsToldNothingIsHere() throws Exception {
		MockHttpServletResponse refused =
				sentBy(MODERATOR_WHO_DOES_NOT_RACE, PATH, wishing(true));
		MockHttpServletResponse nowhere =
				sentBy(MODERATOR_WHO_DOES_NOT_RACE, NOTHING_IS_THERE, wishing(true));

		assertThat(nowhere.getStatus())
				.as("an address nothing maps stopped answering 404, so the comparison below "
						+ "compares two answers that are both fine")
				.isEqualTo(404);

		assertThat(refused.getStatus()).isEqualTo(nowhere.getStatus());
		assertThat(refused.getContentAsString()).isEqualTo(nowhere.getContentAsString());
	}

	/**
	 * A FORM WITH NOTHING IN IT IS REFUSED AND TOLD WHAT IS MISSING, WHATEVER SHAPE THE NOTHING
	 * ARRIVES IN.
	 *
	 * <p>ADL A54 (owner, 19.09.2026): „`PUT` koji ne posalje neko polje odbija se sa 400, i kaze
	 * se sta fali." Four shapes of nothing and one answer, the same principle {@code POST
	 * /api/inbox} and {@code PUT /api/me} already keep: a key left out, a key sent
	 * as an explicit null, an empty object, and bytes nobody can parse. None of them carries a
	 * wish, so telling them apart would be a difference with no reader.
	 *
	 * <p><b>And the row does not move.</b> Asserted after all four, because „refused" and „wrote
	 * false and then refused" are the same status and the second is exactly what a primitive
	 * {@code boolean} in the form would have done.
	 */
	@Test
	void aFormWithNoWishInItIsRefusedAndSaysWhatIsMissing() throws Exception {
		for (String nothing : List.of("{}", "{\"firstSeason\":null}", "{\"somethingElse\":true}",
				"not json at all")) {

			MockHttpServletResponse refused = sent(HE_CHOOSES, nothing);

			assertThat(refused.getStatus())
					.as("a body of %s was not refused", nothing)
					.isEqualTo(400);
			assertThat(reasonIn(refused)).isEqualTo("theFormIsNotComplete");
			assertThat(missingIn(refused)).containsExactly("firstSeason");
		}

		assertThat(wishOf(HE_CHOOSES))
				.as("a refused form still wrote false into his column, which is what a primitive "
						+ "boolean in the form would do and what A54 was written about")
				.isFalse();
	}

	/**
	 * WHAT THE REFUSAL NAMES IS THE FORM'S OWN FIELDS, AND THIS IS THE FLOOR UNDER A LIST
	 * WRITTEN BY HAND.
	 *
	 * <p>{@link MeCategoryWriteApi#change} refuses with {@code List.of("firstSeason")}, which
	 * is a list of one written out in the route - and a list in a guard needs a floor in the
	 * same commit or it is only as complete as somebody's memory. The floor is the RECORD:
	 * {@link MeCategoryWriteApi.Wish}'s components are the names the JSON uses, so a second
	 * field arriving tomorrow fails here on the day it is added rather than being a field the
	 * refusal quietly does not mention.
	 *
	 * <p>{@code MeWriteApiTest} holds its own fields the same way, off the shape of
	 * the record its form is made of. This form has no table behind it - the column it writes
	 * is one boolean on {@code competitor} - so the record is the nearest thing the language
	 * itself says, which is what a floor has to be tied to.
	 */
	@Test
	void theRefusalNamesEveryFieldTheFormHasAndNoOther() throws Exception {
		List<String> theFormsOwnFields =
				Arrays.stream(MeCategoryWriteApi.Wish.class.getRecordComponents())
						.map(RecordComponent::getName)
						.toList();

		assertThat(theFormsOwnFields)
				.as("the form has no fields at all, so the comparison below is over nothing")
				.isNotEmpty();

		assertThat(missingIn(sent(HE_CHOOSES, "{}")))
				.as("the refusal names something other than the fields the form is made of")
				.containsExactlyInAnyOrderElementsOf(theFormsOwnFields);
	}

	/**
	 * A WRITE WITH NO {@code Content-Type} NEVER REACHES THE HANDLER.
	 *
	 * <p>{@code consumes} refuses it before anything is dispatched, so it is answered as an
	 * address that is not there rather than as a form that is wrong. The literal is the
	 * measurement and not the comparison beside it: 404 is what an unmapped address answers and
	 * 415 is what a mapping WITHOUT {@code consumes} would answer here, so a version that
	 * dropped {@code consumes} fails on the number. {@code MeWriteApiTest} keeps the same pair, and
	 * the correction this phrasing comes from was measured on the route this branch removed -
	 * written as „typeless equals nowhere" alone, a mutation pointing both sides at the real address left the case green.
	 */
	@Test
	void aWriteWithNoContentTypeIsAnsweredAsAnAddressThatIsNotThere() throws Exception {
		MockHttpServletResponse typeless = untyped(HE_CHOOSES, PATH);

		assertThat(typeless.getStatus()).isEqualTo(404);
		assertThat(typeless.getContentAsString()).isEqualTo(untyped(HE_CHOOSES, NOTHING_IS_THERE)
				.getContentAsString());
	}

	/**
	 * THE WISH IS WRITTEN, AND NOBODY ELSE'S IS.
	 *
	 * <p>{@link #FIRST_BY_KEY} starts at true and {@link #HE_CHOOSES} at false, so the pair
	 * tells „he wrote his own row" from „he wrote the first row" and from „the column was set to
	 * true everywhere". The answer is read off the route AND the column is read out of the
	 * database, because a route that answered correctly and wrote nothing would satisfy only the
	 * first.
	 */
	@Test
	void theWishIsWrittenForTheMemberWhoseSessionItIsAndForNobodyElse() throws Exception {
		MockHttpServletResponse written = sent(HE_CHOOSES, wishing(true));

		assertThat(written.getStatus()).isEqualTo(200);
		assertThat(answerIn(written).path("firstSeason").asBoolean()).isTrue();

		assertThat(wishOf(HE_CHOOSES))
				.as("the route answered that it had written and the column says otherwise")
				.isTrue();
		assertThat(wishOf(FIRST_BY_KEY))
				.as("the first row by key was changed by somebody else's request")
				.isTrue();
		assertThat(wishOf(OVER_THE_LINE))
				.as("a third member's column moved, so the update has no where clause worth the "
						+ "name")
				.isFalse();
	}

	/**
	 * HE MAY CHANGE HIS MIND AS OFTEN AS HE LIKES, AND BACK AGAIN.
	 *
	 * <p>Owner, 26.09.2026 (PDL P7 §9): „Do tog roka se izbor menja koliko god puta." So there
	 * is no „already chosen" state and no once-only rule, and the sequence below is the whole of
	 * that sentence: false to true to false to true, four answers and four columns.
	 *
	 * <p><b>The way back is the half that is easy to lose.</b> A route that wrote only
	 * {@code true} - or one that set the column and never cleared it - passes every case that
	 * only ever turns the wish on.
	 */
	@Test
	void theChoiceIsChangedAsOftenAsHeLikesAndTheWayBackIsOpen() throws Exception {
		for (boolean wish : List.of(true, false, true)) {
			MockHttpServletResponse written = sent(HE_CHOOSES, wishing(wish));

			assertThat(written.getStatus()).isEqualTo(200);
			assertThat(answerIn(written).path("firstSeason").asBoolean()).isEqualTo(wish);
			assertThat(wishOf(HE_CHOOSES))
					.as("sending %s did not reach the column", wish)
					.isEqualTo(wish);
		}
	}

	/**
	 * A WISH HE HAS NO RIGHT TO IS STORED, AND THE CATEGORY IS STILL HIS AGE BAND.
	 *
	 * <p>This is the decision of 26.09.2026 at its sharpest, and the reason the route refuses
	 * nothing here: what is kept is the WISH, the category is derived from the wish AND the
	 * right, and the journal concludes that a state „a saved choice he has no right to" cannot
	 * arise because nothing wrong can be stored. Refusing instead would put a guard on a state
	 * no reachable screen produces, since the box offers the beginners' option only to somebody
	 * it is open to.
	 *
	 * <p><b>THE ANSWER IS THE MEASUREMENT AND IT CANNOT BE AN ECHO.</b> He sends
	 * {@code firstSeason: true} and is answered {@code firstSeason: true},
	 * {@code firstSeasonAllowed: false} and a category of {@code M55+}. A route that built its
	 * answer out of the request would say {@code M R} - it has no other way to know the right -
	 * so the third field is what holds the read-back rather than a habit.
	 */
	@Test
	void aWishHeHasNoRightToIsStoredAndTheCategoryIsStillHisAgeBand() throws Exception {
		MockHttpServletResponse written = sent(OVER_THE_LINE, wishing(true));

		assertThat(written.getStatus()).isEqualTo(200);

		JsonNode answer = answerIn(written);

		assertThat(answer.path("firstSeason").asBoolean())
				.as("his wish was refused or quietly corrected, and the owner's decision is that "
						+ "it is kept as he left it")
				.isTrue();
		assertThat(answer.path("firstSeasonAllowed").asBoolean()).isFalse();
		assertThat(answer.path("category").asString())
				.as("the answer was built out of the request, which cannot know the right: he is "
						+ "59 in 2029 and runs in 55+, whatever he wishes")
				.isEqualTo("M55+");

		assertThat(wishOf(OVER_THE_LINE)).isTrue();
	}

	/**
	 * AFTER THE DEADLINE THE WRITE IS REFUSED WITH A REASON, AND THE COLUMN DOES NOT MOVE.
	 *
	 * <p>409 and not 404, because the address exists and the member is allowed to be at it: what
	 * is refused is the state of the world. ADL A8's 401 and 404 are about WHO is asking, and
	 * answering 404 would tell a member the choice never existed on a screen that offered it to
	 * him in December. The status and the reason are both asserted, and so is the column - a
	 * route that wrote and then refused would satisfy the first two.
	 *
	 * <p><b>Two moments after the deadline and not one:</b> the deadline itself, and two hours
	 * past it inside the six that belong to the moderator. The second is the stretch the owner's
	 * decision exists for and the one a version reading {@code tablesFreeze} would still let
	 * through.
	 */
	@Test
	void afterTheDeadlineTheWriteIsRefusedAndTheColumnStandsWhereItWas() throws Exception {
		for (Instant tooLate : List.of(THE_DEADLINE, THE_DEADLINE.plus(Duration.ofHours(2)))) {
			clock.moveTo(tooLate);

			MockHttpServletResponse refused = sent(HE_CHOOSES, wishing(true));

			assertThat(refused.getStatus())
					.as("the write was accepted at %s, after the member's own deadline", tooLate)
					.isEqualTo(409);
			assertThat(reasonIn(refused)).isEqualTo("theChoiceIsShut");
			assertThat(wishOf(HE_CHOOSES))
					.as("the write was refused and the column moved anyway")
					.isFalse();
		}
	}

	/**
	 * A MINUTE BEFORE THE DEADLINE THE WRITE STILL LANDS, ALTHOUGH THE CALENDAR WINDOW HAS SHUT.
	 *
	 * <p>09:59 in Belgrade on 1 January is outside the renewal window, which runs to 31 December,
	 * and inside the member's own deadline. Those ten hours are what the draft screen lost by
	 * drawing the box under {@code inYearlyWindow}, and this is the case that holds them: a
	 * version asking about the transfer window instead of the deadline refuses here.
	 */
	@Test
	void aMinuteBeforeTheDeadlineTheWriteStillLandsAlthoughTheCalendarWindowHasShut()
			throws Exception {

		clock.moveTo(THE_DEADLINE.minus(Duration.ofMinutes(1)));

		assertThat(sent(HE_CHOOSES, wishing(true)).getStatus()).isEqualTo(200);
		assertThat(wishOf(HE_CHOOSES)).isTrue();
	}

	/**
	 * WHAT THE WRITE ANSWERS IS WHAT THE NEXT READ SAYS.
	 *
	 * <p>The two verbs of one path answer one shape ({@code MeCategoryApi.Choice}), and this is
	 * the case that holds them equal rather than the sentence in the javadoc saying they are. A
	 * write that answered out of the request, or a read that derived differently, parts the two
	 * here.
	 */
	@Test
	void theWriteAnswersWhatTheNextReadWillSay() throws Exception {
		String written = sent(OVER_THE_LINE, wishing(true)).getContentAsString();

		String read = http.perform(get(PATH).cookie(new Cookie(SessionCookie.NAME,
						sessions.get(OVER_THE_LINE + "@primer.rs").secret())))
				.andReturn().getResponse().getContentAsString();

		assertThat(written).isEqualTo(read);
	}

	/* ------------------------------------------------------------------- the fixture */

	private void competitor(String number, String first, String last, String gender,
			String birthDate, boolean firstSeason) {

		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, cast(? as date),"
						+ " (select id from place where rank = 1), 2027, ?, true, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, gender, birthDate, firstSeason,
						String.format("%016x", ++issued))
				.update();
	}

	private void account(String email, String role, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', ?, (select id from role where code = ?))")
				.params(email, role).update();

		if (memberNumber != null) {
			db.sql("update account set competitor_id ="
							+ " (select id from competitor where member_number = ?) where email = ?")
					.params(memberNumber, email).update();
		}

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	private void aRaceThatHappened(String eventSlug, String raceName, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, cast(? as date), (select id from place where rank = 1),"
						+ " null, null, 'race', false, '', '')")
				.params(eventSlug, "Trka " + eventSlug, day).update();

		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false,"
						+ " cast(? as date), 'length', 0, 10.00, 0, 0)")
				.params(eventSlug, raceName, day).update();
	}

	private void aRunBy(String memberNumber, String raceName, String day, String points) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from race where name = ?), cast(? as date), 10.00, 0, 0,"
						+ " 3600, cast(? as numeric))")
				.params(memberNumber, raceName, day, points).update();
	}

	/* -------------------------------------------------------------------- the requests */

	private static String wishing(boolean firstSeason) {
		return "{\"firstSeason\":" + firstSeason + "}";
	}

	private MockHttpServletResponse sent(String memberNumber, String body) throws Exception {
		return sentBy(memberNumber + "@primer.rs", PATH, body);
	}

	/**
	 * @param email the session to send it with, or null for somebody who has none - which is not
	 *              the same request with an empty list of cookies but a request with no cookie
	 *              header at all, the way a browser that has never signed in sends one
	 */
	private MockHttpServletResponse sentBy(String email, String path, String body)
			throws Exception {

		MockHttpServletRequestBuilder asking = put(path).with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content(body);

		return http.perform(email == null ? asking
						: asking.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
				.andReturn().getResponse();
	}

	/** The same write with a body and no {@code Content-Type} header at all. */
	private MockHttpServletResponse untyped(String memberNumber, String path) throws Exception {
		return http.perform(put(path).with(csrf()).content(wishing(true))
						.cookie(new Cookie(SessionCookie.NAME,
								sessions.get(memberNumber + "@primer.rs").secret())))
				.andReturn().getResponse();
	}

	/* -------------------------------------------------------------------- the answers */

	private JsonNode answerIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString());
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("reason").asString();
	}

	private List<String> missingIn(MockHttpServletResponse answer) throws Exception {
		List<String> named = new ArrayList<>();
		mapper.readTree(answer.getContentAsString()).path("missing")
				.forEach(one -> named.add(one.asString()));
		return named;
	}

	/** What the column says, which is the only place the wish is kept. */
	private boolean wishOf(String memberNumber) {
		return db.sql("select first_season_2027 from competitor where member_number = ?")
				.param(memberNumber)
				.query(Boolean.class)
				.single();
	}
}
