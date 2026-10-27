package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * WHICH SEASON'S BASIS THE TWO DOORS ANSWER, AND OFF WHOSE ROW.
 *
 * <p>The owner, 18.10.2026 (PDL P8, „Osnov clanstva ima jedan dom, zapis po sezoni; stara kolona po
 * coveku se brise"), and on which season, in his own words: „do 14.10. je osnova 2027, od 15.10 je
 * osnova 2028." So {@code /api/me} (to the member himself) and {@code /api/competitors} (to the
 * administration over the members) both answer the basis of the season ON SALE, which is
 * {@link SeasonClock#seasonBeingPaidFor}, with that season beside it, and no basis at all for a
 * member who holds no row for it.
 *
 * <p><b>The fixture is arranged so that every wrong reading answers a different map.</b> Five members
 * and two seasons, and each member's two seasons stand on different bases or on none:
 *
 * <ul>
 * <li>{@link #PAYS_NEXT_YEAR} was freed of 2027 and pays 2028, which is the owner's own case: a
 * season read off the running year, the year of the band or „his newest row" answers each a
 * different word on one of the three days below.</li>
 * <li>{@link #ME} is the reverse, and he is written SECOND, so „the first row" is somebody else.</li>
 * <li>{@link #ON_HIS_BALANCE} holds 2028 on his balance and no 2027 at all, so the third word is
 * asked, and „the season before" has nothing to answer.</li>
 * <li>{@link #FREED_OF_2027_ONLY} holds 2027 and nothing for 2028: inside the window he is answered
 * NO basis, which is the state the owner found on QA turned the right way round.</li>
 * <li>{@link #PAID_2027_ONLY} pays 2027 and nothing else, so two members share every 2027 word but
 * one.</li>
 * </ul>
 *
 * <p><b>Four days</b>: the two sides of 15 October 2027, a day inside the window, and 18 October
 * 2026, when the season on sale and the running season are one number (2027) and the boundary
 * cannot be seen at all.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TheBasisOfTheSeasonOnSaleTest {

	/** Inside the window: the season on sale is 2028, the running season and the band's are 2027. */
	private static final Instant IN_THE_WINDOW = Instant.parse("2027-11-22T10:00:00Z");

	/** The last day 2027 is on sale, in the league's own time. */
	private static final Instant THE_LAST_DAY_BEFORE_IT = Instant.parse("2027-11-10T12:00:00Z");

	/** And the first day 2028 is. */
	private static final Instant THE_FIRST_DAY_OF_IT = Instant.parse("2027-11-11T12:00:00Z");

	/** Before the league has a season: the calendar says 2026 and both readings answer 2027. */
	private static final Instant BEFORE_THE_LEAGUE = Instant.parse("2026-10-18T10:00:00Z");

	private static final String PAYS_NEXT_YEAR = "008001";
	private static final String ME = "008002";
	private static final String ON_HIS_BALANCE = "008003";
	private static final String FREED_OF_2027_ONLY = "008004";
	private static final String PAID_2027_ONLY = "008005";

	private static final List<String> EVERYBODY = List.of(PAYS_NEXT_YEAR, ME, ON_HIS_BALANCE,
			FREED_OF_2027_ONLY, PAID_2027_ONLY);

	private static final String THE_ADMINISTRATION = "clanovi@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	@BeforeEach
	void fiveMembersAndTwoSeasons() {
		clock.moveTo(IN_THE_WINDOW);

		member(PAYS_NEXT_YEAR, "feeExempt", "payment");
		member(ME, "payment", "feeExempt");
		member(ON_HIS_BALANCE, null, "balance");
		member(FREED_OF_2027_ONLY, "feeExempt", null);
		member(PAID_2027_ONLY, "payment", null);

		account(THE_ADMINISTRATION, "moderator", null);
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(THE_ADMINISTRATION, CompetitorApi.OVER_THE_MEMBERS).update();
	}

	@Test
	void insideTheWindowEveryDoorAnswersTheBasisOfTheSeasonOnSale() throws Exception {
		Map<String, String> expected = Map.of(
				PAYS_NEXT_YEAR, "payment 2028",
				ME, "feeExempt 2028",
				ON_HIS_BALANCE, "balance 2028",
				FREED_OF_2027_ONLY, "none",
				PAID_2027_ONLY, "none");

		assertThat(eachOnHisOwnDoor()).as("a member's own record answered a basis of a season other"
				+ " than the one on sale, or off a row that is not his").isEqualTo(expected);
		assertThat(theAdministrationsList()).as("the moderation of the members was answered a"
				+ " basis of a season other than the one on sale").isEqualTo(expected);
	}

	@Test
	void onTheLastDayOfOctoberTheFourteenthItIsStillTheRunningSeason() throws Exception {
		clock.moveTo(THE_LAST_DAY_BEFORE_IT);
		Map<String, String> expected = Map.of(
				PAYS_NEXT_YEAR, "feeExempt 2027",
				ME, "payment 2027",
				ON_HIS_BALANCE, "none",
				FREED_OF_2027_ONLY, "feeExempt 2027",
				PAID_2027_ONLY, "payment 2027");

		assertThat(eachOnHisOwnDoor()).isEqualTo(expected);
		assertThat(theAdministrationsList()).isEqualTo(expected);
	}

	@Test
	void fromTheFifteenthItIsTheNextSeason() throws Exception {
		clock.moveTo(THE_FIRST_DAY_OF_IT);
		Map<String, String> expected = Map.of(
				PAYS_NEXT_YEAR, "payment 2028",
				ME, "feeExempt 2028",
				ON_HIS_BALANCE, "balance 2028",
				FREED_OF_2027_ONLY, "none",
				PAID_2027_ONLY, "none");

		assertThat(eachOnHisOwnDoor()).isEqualTo(expected);
		assertThat(theAdministrationsList()).isEqualTo(expected);
	}

	/**
	 * BEFORE THE LEAGUE HAS A SEASON, the calendar answers 2026, which the league does not have, so
	 * the season on sale is the first one (PDL P8, „Sezona u ponudi ne moze biti pre prve"). It is
	 * also the running one, so this day cannot tell the two apart and the cases above do.
	 */
	@Test
	void beforeTheLeagueHasASeasonTheFirstOneIsOnSale() throws Exception {
		clock.moveTo(BEFORE_THE_LEAGUE);
		Map<String, String> expected = Map.of(
				PAYS_NEXT_YEAR, "feeExempt 2027",
				ME, "payment 2027",
				ON_HIS_BALANCE, "none",
				FREED_OF_2027_ONLY, "feeExempt 2027",
				PAID_2027_ONLY, "payment 2027");

		assertThat(eachOnHisOwnDoor()).isEqualTo(expected);
		assertThat(theAdministrationsList()).isEqualTo(expected);
	}

	/**
	 * AND A MEMBER IS NEVER ANSWERED A BASIS ON THE LIST, HIS OWN INCLUDED: PDL P8, 28.07.2026,
	 * „Osnov clanstva se nikad ne prikazuje javno", and the owner on 20.09.2026, „Clan vidi SVOJ
	 * osnov clanstva; tudji ne vidi niko osim administracije". His own is on {@code /api/me}.
	 */
	@Test
	void aMemberIsAnsweredNoBasisOnTheListNotEvenHisOwn() throws Exception {
		for (JsonNode one : json(http.perform(get("/api/competitors").cookie(cookieOf(ME)))
				.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8))) {
			assertThat(one.has("membershipBasis") || one.has("membershipSeason"))
					.as("a member was answered how the membership of %s is held",
							one.path("memberNumber").asString())
					.isFalse();
		}
	}

	/* ------------------------------------------------------------------- reading */

	private Map<String, String> eachOnHisOwnDoor() throws Exception {
		Map<String, String> answered = new LinkedHashMap<>();
		for (String number : EVERYBODY) {
			JsonNode record = json(http.perform(get("/api/me").cookie(cookieOf(number)))
					.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8))
					.path("member");
			assertThat(record.path("memberNumber").asString())
					.as("the record behind %s's own cookie is somebody else's", number)
					.isEqualTo(number);
			answered.put(number, basisAndSeason(record));
		}
		return answered;
	}

	private Map<String, String> theAdministrationsList() throws Exception {
		Map<String, String> answered = new LinkedHashMap<>();
		for (JsonNode one : json(http.perform(get("/api/competitors").cookie(cookieOf(THE_ADMINISTRATION)))
				.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8))) {
			answered.put(one.path("memberNumber").asString(), basisAndSeason(one));
		}
		return answered;
	}

	/** The two fields together, or {@code none} when neither is there; one without the other fails. */
	private static String basisAndSeason(JsonNode record) {
		assertThat(record.has("membershipBasis"))
				.as("the basis and its season do not travel together on %s: %s",
						record.path("memberNumber").asString(), record)
				.isEqualTo(record.has("membershipSeason"));
		return record.has("membershipBasis")
				? record.path("membershipBasis").asString() + " " + record.path("membershipSeason").asInt()
				: "none";
	}

	private static JsonNode json(String text) {
		return new ObjectMapper().readTree(text);
	}

	private Cookie cookieOf(String who) {
		return new Cookie(SessionCookie.NAME, sessions.get(who).secret());
	}

	/* ------------------------------------------------------------------- the fixture */

	/** A standing member behind his own account, with what he holds of 2027 and of 2028. */
	private void member(String number, String in2027, String in2028) {
		long id = db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, first_season_2027, active,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Clan', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, ?, '', false,"
						+ " 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.params(number, String.format("%016x", 0x8000L + ++issued))
				.query(Long.class).single();

		if (in2027 != null) {
			HeldOn.season(db, id, 2027, in2027);
		}
		if (in2028 != null) {
			HeldOn.season(db, id, 2028, in2028);
		}

		account(number, "competitor", id);
	}

	private void account(String who, String role, Long competitor) {
		String email = who.contains("@") ? who : who + "@primer.rs";
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

		sessions.put(who, session);
	}

	/** A clock the case moves, reporting UTC as a container's does: the shape {@code MeApiTest} uses. */
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
			return new AClockTheCaseMoves(IN_THE_WINDOW);
		}
	}
}
