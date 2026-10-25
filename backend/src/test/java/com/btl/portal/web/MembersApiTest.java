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

		/* A BOOK NEVER GOES BELOW NOUGHT, because a balance only ever pays what it holds, so a season
		   held on a balance stands on money that was credited first. Two different amounts, so what
		   is left on one book cannot be read off the other: 000002 keeps 12.00, 000009 nothing. */
		credited(both, "42.00");
		credited(lapsedWithARow, "30.00");

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

	/** A credit on his book: what an earlier season sent too much of (V42's `overpayment`). */
	private void credited(long competitor, String amount) {
		db.sql("insert into balance_entry (competitor_id, amount, currency, reason, season, occurred_at,"
						+ " recorded_by_name) values (?, ?::numeric, 'EUR', 'overpayment', 2027,"
						+ " timestamptz '2026-10-19 10:00:00+00', 'Blagajnik Probni')")
				.params(competitor, amount).update();
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

	/** Each member's country as „IT RSD": the code and, beside it, the money it bills him in. */
	private static Map<String, String> countryOf(JsonNode answer) {
		Map<String, String> country = new LinkedHashMap<>();

		for (JsonNode one : answer) {
			country.put(one.path("memberNumber").asString(),
					one.path("country").asString() + " " + one.path("currency").asString());
		}

		return country;
	}

	@Test
	void eachRowNamesHisCountryThroughWhicheverOfItsTwoHomesHeHas() throws Exception {
		/* THREE HOMES FOR THREE MEMBERS, so no one reading can stand in for another (owner, 22.10.2026,
		   PDL „Red na ekranu članova ima pet kolona": „Mesto, a ispod malim fontom ... Država"). V7 keeps
		   a town either from the codebook, whose country is the town's, or typed, with the country named
		   beside it, and never both. The rest of the fixture lives in Shanghai, the first town of the
		   codebook (V3, rank 1), so a reading of the typed home alone answers nothing for them; 000005
		   types his town, so a reading of the codebook's home alone answers nothing for him; and 000007
		   lives in Serbia, the one country billed in dinars, so a country taken from another member's
		   row bills him in the wrong money. */
		db.sql("update competitor set place_id = null, city = 'Trst',"
						+ " country_id = (select id from country where code = 'IT') where member_number = '000005'")
				.update();
		db.sql("update competitor set place_id = (select id from place where country_id ="
						+ " (select id from country where code = 'RS') order by rank limit 1)"
						+ " where member_number = '000007'")
				.update();

		assertThat(countryOf(members())).containsExactly(Map.entry("000002", "CN EUR"),
				Map.entry("000005", "IT EUR"), Map.entry("000007", "RS RSD"), Map.entry("000009", "CN EUR"),
				Map.entry("000011", "CN EUR"));
	}

	/** Each member's figures for the season on sale as „2028 EUR 38.00 35.00 12.00". */
	private static Map<String, String> figuresOf(JsonNode answer) {
		Map<String, String> figures = new LinkedHashMap<>();

		for (JsonNode one : answer) {
			figures.put(one.path("memberNumber").asString(), one.path("seasonOnSale").asInt() + " "
					+ one.path("currency").asString() + " "
					+ one.path("expected").decimalValue().setScale(2) + " "
					+ one.path("price").decimalValue().setScale(2) + " "
					+ one.path("balance").decimalValue().setScale(2));
		}

		return figures;
	}

	@Test
	void eachRowCarriesWhatAPaymentForTheSeasonOnSaleWouldBeInHisOwnMoney() throws Exception {
		/* A BOY BORN IN 2012 WHO LIVES IN SERBIA, which is what separates the three readings of one
		   price that could stand in for each other. He is a junior in 2027 (15) and is not in 2028
		   (16), so a price worked out for the season being run instead of the season on sale reads
		   the junior row from 15 October; he pays in dinars and the others in euro, so a currency
		   taken from anybody else's country reads the other column; and he has no book at all. */
		long junior = db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, first_season_2027, active, referral_code,"
						+ " bio, profile_hidden, birthday_shown, father_name, address, shirt_size,"
						+ " health_statement_at) values ('000013', 'Mali', 'Hadzic', 'M', date '2012-06-01',"
						+ " (select id from place where country_id = (select id from country where code = 'RS')"
						+ " order by rank limit 1), 2027, false, false, '11aa22bb33cc44d7', '', false, 'none',"
						+ " 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00') returning id")
				.query(Long.class).single();

		assertThat(junior).isPositive();

		/* 20 October 2027: 2028 on sale at „15. do 31. oktobra", 35 EUR and 4.200 RSD, and the euro
		   side carries the processing fee of 3 EUR (V4) where the dinar side carries none. */
		assertThat(figuresOf(members())).containsExactly(
				Map.entry("000002", "2028 EUR 38.00 35.00 12.00"),
				Map.entry("000005", "2028 EUR 38.00 35.00 0.00"),
				Map.entry("000007", "2028 EUR 38.00 35.00 0.00"),
				Map.entry("000009", "2028 EUR 38.00 35.00 0.00"),
				Map.entry("000011", "2028 EUR 38.00 35.00 0.00"),
				Map.entry("000013", "2028 RSD 4200.00 4200.00 0.00"));

		/* 10 October 2027: 2027 on sale at „1. januara do 14. oktobra", and he is a junior of 2027. */
		clock.moveTo(BEFORE_THE_FIFTEENTH);

		assertThat(figuresOf(members())).containsExactly(
				Map.entry("000002", "2027 EUR 43.00 40.00 12.00"),
				Map.entry("000005", "2027 EUR 43.00 40.00 0.00"),
				Map.entry("000007", "2027 EUR 43.00 40.00 0.00"),
				Map.entry("000009", "2027 EUR 43.00 40.00 0.00"),
				Map.entry("000011", "2027 EUR 43.00 40.00 0.00"),
				Map.entry("000013", "2027 RSD 2400.00 2400.00 0.00"));
	}

	@Test
	void eachRowSaysWhetherAnInvitationCanReachHimByHisPasswordAndNotByHisAddress() throws Exception {
		/* THE ENVELOPE OF THE ROW (owner, 25.10.2026): an account with no password is „due", one with a
		   password is not, and a member with no account has nobody to send to. Every account of this
		   setup is unconfirmed, so giving 000007 a password parts the password from the address: read
		   off `email_confirmed_at`, he would be „due" too. 000002 and 000009 have no account; 000005 is
		   the moderator's own row and 000011 a lapsed member, both without a password. */
		db.sql("update account set password_hash = '{bcrypt}$2a$10$notarealhash' where email = ?")
				.param(AN_ACTIVE_MEMBER).update();

		Map<String, String> invitation = new LinkedHashMap<>();

		for (JsonNode one : members()) {
			invitation.put(one.path("memberNumber").asString(), one.path("invitation").asString());
		}

		assertThat(invitation).containsExactly(
				Map.entry("000002", "noAccount"),
				Map.entry("000005", "due"),
				Map.entry("000007", "passwordSet"),
				Map.entry("000009", "noAccount"),
				Map.entry("000011", "due"));
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
