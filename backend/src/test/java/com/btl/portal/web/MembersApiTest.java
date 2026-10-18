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

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * {@link MembersApi}: who may read the moderation's list of members, who is on it, and what each
 * row says about his seasons.
 *
 * <p><b>THE SETUP SEPARATES EVERY SECOND SOURCE OF ONE VALUE</b>, which is why it is this shape:
 * <ul>
 * <li>the LAST season is not the season on sale: at {@link #AFTER_THE_FIFTEENTH} 2028 is on sale,
 * 000005 holds only 2027 and 000002 holds both;</li>
 * <li>nor the largest season of the whole table: 000005 holds 2027 while two others hold 2028;</li>
 * <li>nor the first season of the member, nor the first row written: 000002's 2028 is written
 * BEFORE his 2027, and his two seasons stand on two different bases;</li>
 * <li>nor a season of one basis only: 000007 holds only an exemption and 000009 only a balance;</li>
 * <li>active is not „holds a row": 000009 holds a row and his fee has lapsed, 000011 holds none and
 * his fee has lapsed, and the registered account that was never a member holds a row of nothing and
 * is on no list at all;</li>
 * <li>and the administration's own row is on the list (000005), neither first nor last.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MembersApiTest {

	/** 2028 is on sale (SeasonClock, from 15 October) and 2027 is still being run. */
	private static final Instant AFTER_THE_FIFTEENTH = Instant.parse("2027-10-20T10:00:00Z");

	/** 2027 is on sale and being run. */
	private static final Instant BEFORE_THE_FIFTEENTH = Instant.parse("2027-10-10T10:00:00Z");

	/** Today: the league has no season running yet, and 2027 is on sale. */
	private static final Instant BEFORE_THE_LEAGUE = Instant.parse("2026-10-18T10:00:00Z");

	private static final String THE_SUPERADMIN = "superadmin@primer.rs";

	private static final String OVER_THE_MEMBERS_RACING_FOR_NOBODY = "moderator-clanovi@primer.rs";

	private static final String OVER_THE_MEMBERS_ON_THE_LIST = "moderator-na-spisku@primer.rs";

	private static final String OVER_THE_PAYMENTS_ONLY = "moderator-uplate@primer.rs";

	private static final String AN_ACTIVE_MEMBER = "clan@primer.rs";

	private static final String A_LAPSED_MEMBER = "istekao@primer.rs";

	private static final String NEVER_A_MEMBER = "nikad-clan@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	@BeforeEach
	void membersOfEveryKind() {
		clock.moveTo(AFTER_THE_FIFTEENTH);

		long both = member("000002", "Ana", "Babic", "F", true, false, "11aa22bb33cc44d1");
		long onlyThePast = member("000005", "Bojan", "Cvetic", "M", true, false, "11aa22bb33cc44d2");
		long onlyTheNext = member("000007", "Vesna", "Dikic", "F", true, true, "11aa22bb33cc44d3");
		long lapsedWithARow = member("000009", "Goran", "Eric", "M", false, false, "11aa22bb33cc44d4");
		long lapsedWithNone = member("000011", "Dara", "Filic", "F", false, false, "11aa22bb33cc44d5");
		long neverAMember = member(null, "Zoran", "Gajic", "M", false, false, "11aa22bb33cc44d6");

		/* 2028 FIRST, so a list in the order the rows were written is the wrong order. */
		HeldOn.season(db, both, 2028, "balance");
		HeldOn.season(db, both, 2027, "payment");
		HeldOn.season(db, onlyThePast, 2027, "payment");
		HeldOn.season(db, onlyTheNext, 2028, "feeExempt");
		HeldOn.season(db, lapsedWithARow, 2027, "balance");

		account(THE_SUPERADMIN, "superadmin", null);
		account(OVER_THE_MEMBERS_RACING_FOR_NOBODY, "moderator", null);
		ticked(OVER_THE_MEMBERS_RACING_FOR_NOBODY, "entity:members");
		account(OVER_THE_MEMBERS_ON_THE_LIST, "moderator", onlyThePast);
		ticked(OVER_THE_MEMBERS_ON_THE_LIST, "entity:members");
		account(OVER_THE_PAYMENTS_ONLY, "moderator", null);
		ticked(OVER_THE_PAYMENTS_ONLY, "queue:payments");
		account(AN_ACTIVE_MEMBER, "competitor", onlyTheNext);
		account(A_LAPSED_MEMBER, "competitor", lapsedWithNone);
		account(NEVER_A_MEMBER, "competitor", neverAMember);
	}

	private long member(String number, String first, String last, String gender, boolean active,
			boolean hidden, String referralCode) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, first_season_2027, active, referral_code,"
						+ " bio, profile_hidden, birthday_shown, father_name, address, shirt_size,"
						+ " health_statement_at) values (?, ?, ?, ?, date '1980-05-05',"
						+ " (select id from place where rank = 1), 2027, false, ?, ?, '', ?, 'none',"
						+ " 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, first, last, gender, active, referralCode, hidden)
				.query(Long.class).single();
	}

	private void account(String email, String role, Long competitor) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = ?), ?)")
				.params(email, role, competitor).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/** Ticked with V5's own word rather than the constant the route asks by (see CompetitorApiTest). */
	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private MockHttpServletRequestBuilder asking(String path, String email) {
		MockHttpServletRequestBuilder asks = get(path);
		return email == null ? asks
				: asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private int statusFor(String email) throws Exception {
		return http.perform(asking("/api/members", email)).andReturn().getResponse().getStatus();
	}

	private JsonNode answerFor(String path, String email) throws Exception {
		var response = http.perform(asking(path, email)).andReturn().getResponse();

		assertThat(response.getStatus()).as("%s asked by %s", path, email).isEqualTo(200);

		return new ObjectMapper().readTree(response.getContentAsString(StandardCharsets.UTF_8));
	}

	private JsonNode members() throws Exception {
		return answerFor("/api/members", THE_SUPERADMIN);
	}

	private static List<String> numbersOf(JsonNode answer) {
		return StreamSupport.stream(answer.spliterator(), false)
				.map(one -> one.path("memberNumber").asString()).toList();
	}

	/** Each member's seasons as „2027 payment", oldest first as the answer gives them. */
	private static Map<String, List<String>> seasonsOf(JsonNode answer) {
		Map<String, List<String>> seasons = new LinkedHashMap<>();

		for (JsonNode one : answer) {
			seasons.put(one.path("memberNumber").asString(),
					StreamSupport.stream(one.path("seasons").spliterator(), false)
							.map(held -> held.path("season").asInt() + " "
									+ held.path("basis").asString())
							.toList());
		}

		return seasons;
	}

	/** Each member's basis of the season on sale as „feeExempt 2028", or „" where none is answered. */
	private static Map<String, String> basisOf(JsonNode answer) {
		Map<String, String> basis = new LinkedHashMap<>();

		for (JsonNode one : answer) {
			basis.put(one.path("memberNumber").asString(), one.has("membershipBasis")
					? one.path("membershipBasis").asString() + " " + one.path("membershipSeason").asInt()
					: "");
		}

		return basis;
	}

	@Test
	void aVisitorIsAskedToSignIn() throws Exception {
		assertThat(statusFor(null)).isEqualTo(401);
	}

	@Test
	void anybodySignedInWithoutTheRightOverTheMembersIsToldThereIsNothingHere() throws Exception {
		/* ADL A8: 404, the answer of an address that is not there. The moderator over the payments
		   holds a right, just not this one, so what refuses him is the right this route asks for. */
		for (String refused : List.of(AN_ACTIVE_MEMBER, A_LAPSED_MEMBER, NEVER_A_MEMBER,
				OVER_THE_PAYMENTS_ONLY)) {
			assertThat(statusFor(refused)).as(refused).isEqualTo(404);
		}
	}

	@Test
	void theAdministrationOverTheMembersReadsTheSameListWhoeverItIs() throws Exception {
		/* The superadmin without a tick, the moderator who races for nobody, and the moderator whose
		   own row is on the list: one answer, to the byte. */
		JsonNode bySuperadmin = members();

		assertThat(answerFor("/api/members", OVER_THE_MEMBERS_RACING_FOR_NOBODY)).isEqualTo(bySuperadmin);
		assertThat(answerFor("/api/members", OVER_THE_MEMBERS_ON_THE_LIST)).isEqualTo(bySuperadmin);
	}

	@Test
	void everybodyWhoWasEverGivenANumberIsOnItInTheOrderOfTheNumber() throws Exception {
		/* The two lapsed members and the one who hides his profile are on it; the registered account
		   that was never given a number is not (PDL, 21.09.2026). */
		assertThat(numbersOf(members())).containsExactly("000002", "000005", "000007", "000009", "000011");
	}

	@Test
	void eachRowSaysWhetherHisFeeStandsAsTheFlagEveryOtherDoorReadsSaysIt() throws Exception {
		Map<String, Boolean> active = new LinkedHashMap<>();

		for (JsonNode one : members()) {
			active.put(one.path("memberNumber").asString(), one.path("active").asBoolean());
		}

		assertThat(active).containsExactly(Map.entry("000002", true), Map.entry("000005", true),
				Map.entry("000007", true), Map.entry("000009", false), Map.entry("000011", false));
	}

	@Test
	void eachRowCarriesHisOwnSeasonsOldestFirstEachOnItsOwnBasis() throws Exception {
		assertThat(seasonsOf(members())).containsExactly(
				Map.entry("000002", List.of("2027 payment", "2028 balance")),
				Map.entry("000005", List.of("2027 payment")),
				Map.entry("000007", List.of("2028 feeExempt")),
				Map.entry("000009", List.of("2027 balance")),
				Map.entry("000011", List.of()));
	}

	@Test
	void theSeasonsDoNotMoveWithTheDayButTheBasisOfTheSeasonOnSaleDoes() throws Exception {
		Map<String, List<String>> fromTheFifteenth = seasonsOf(members());
		Map<String, String> basisFromTheFifteenth = basisOf(members());

		clock.moveTo(BEFORE_THE_FIFTEENTH);

		assertThat(seasonsOf(members())).isEqualTo(fromTheFifteenth);

		/* From 15 October the basis of the NEXT season (owner, 18.10.2026: „do 14.10. je osnova 2027,
		   od 15.10 je osnova 2028"), and nothing for a member who holds no row of it. */
		assertThat(basisFromTheFifteenth).containsExactly(Map.entry("000002", "balance 2028"),
				Map.entry("000005", ""), Map.entry("000007", "feeExempt 2028"), Map.entry("000009", ""),
				Map.entry("000011", ""));
		assertThat(basisOf(members())).containsExactly(Map.entry("000002", "payment 2027"),
				Map.entry("000005", "payment 2027"), Map.entry("000007", ""),
				Map.entry("000009", "balance 2027"), Map.entry("000011", ""));
	}

	@Test
	void beforeTheLeagueHasASeasonTheBasisIsTheFirstSeasons() throws Exception {
		clock.moveTo(BEFORE_THE_LEAGUE);

		assertThat(basisOf(members())).containsExactly(Map.entry("000002", "payment 2027"),
				Map.entry("000005", "payment 2027"), Map.entry("000007", ""),
				Map.entry("000009", "balance 2027"), Map.entry("000011", ""));
	}

	@Test
	void everyFieldTheModerationReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/members", members(), "members.json");
	}

	@Test
	void thePublicListStaysTheActiveMembersEvenToTheAdministration() throws Exception {
		/* „javni spisak ostaje samo aktivni" (PDL P8, 18.10.2026): this route is where the lapsed
		   arrive, and the public list does not gain them for the superadmin. */
		assertThat(numbersOf(answerFor("/api/competitors", THE_SUPERADMIN)))
				.containsExactly("000002", "000005", "000007");
	}

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
			return new AClockTheCaseMoves(AFTER_THE_FIFTEENTH);
		}

	}

}
