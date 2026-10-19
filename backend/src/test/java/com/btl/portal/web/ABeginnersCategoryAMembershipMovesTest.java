package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
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

import java.nio.charset.StandardCharsets;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * {@link ABeginnersCategoryAMembershipMoves}: a membership written or cancelled closes the beginners'
 * category for the season after it, or opens it again, and the member is told in his inbox, on every
 * road that writes or cancels a season.
 *
 * <p><b>THE ROADS</b> are every route that inserts or deletes a row of {@code membership}, found by
 * asking the code for every such statement and the route above it: the payments screen
 * ({@code POST /api/payments}), a payment on the member's row ({@code POST
 * /api/members/{n}/payment}), an exemption and a balance from the payments screen ({@code POST
 * /api/memberships}), the member's own activation ({@code POST /api/me/membership}) and the
 * cancellation on his row ({@code DELETE /api/members/{n}/membership}). The change of basis
 * ({@code PUT} on the same address) deletes and writes the row in one go and is held to saying
 * nothing.
 *
 * <p><b>THE SETUP SEPARATES EVERY SECOND SOURCE OF ONE VALUE:</b>
 * <ul>
 * <li><b>the season of the membership and the season of the category are two numbers</b>: the cases
 * stand in September 2027, where the membership is 2027's and the category 2028's, and in September
 * 2028, where they are 2028 and 2029, and the line is required to name each in its place;</li>
 * <li><b>above and below the threshold</b>: a member with 12,50 in 2027 and one with 11,99, written by
 * the same road;</li>
 * <li><b>the wish</b>: a member who ticked the beginners' category and one who did not, both told;</li>
 * <li><b>the recipient</b>: the member written, never a second member with the very same runs whom
 * nobody wrote, never a third with nothing, and never the whole league;</li>
 * <li><b>a run before the league</b>: fifty points in 2026, which count for nobody;</li>
 * <li><b>an earlier season that already closed it</b>: then the membership moves nothing;</li>
 * <li><b>the season on sale after 15 October</b>, which has no runs, so writing it moves nothing.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ABeginnersCategoryAMembershipMovesTest {

	/** 2027 on sale and run: the membership is 2027's and the category it can close is 2028's. */
	private static final Instant SEPTEMBER_2027 = Instant.parse("2027-09-10T09:00:00Z");

	/** The first instant the screen asks about 2028, which is what the line said closed or opened. */
	private static final Instant THE_FIFTEENTH = Instant.parse("2027-10-15T09:00:00Z");

	/** 2028 on sale while 2027 is run: a membership of a season with no runs. */
	private static final Instant AFTER_THE_FIFTEENTH = Instant.parse("2027-10-20T09:00:00Z");

	/** 2028 on sale and run, with 2027 behind it. */
	private static final Instant SEPTEMBER_2028 = Instant.parse("2028-09-10T09:00:00Z");

	private static final String THE_SUPERADMIN = "superadmin-pocetnicka@primer.rs";

	private static final String THE_LEAGUE = "Balkanska trkačka liga";

	private static final String CLOSED = "Početnička kategorija vam je zatvorena";

	private static final String REOPENED = "Početnička kategorija vam je ponovo otvorena";

	private static final String CLOSED_2027 = "Upisana vam je članarina za sezonu 2027, pa se vaši odobreni"
			+ " rezultati iz te sezone računaju u zvaničnu sezonu. Time ste prešli prag od 12 bodova, pa vam"
			+ " je početnička kategorija zatvorena za sezonu 2028.\n\nBalkanska trkačka liga";

	private static final String REOPENED_2027 = "Poništena vam je članarina za sezonu 2027, pa se vaši"
			+ " rezultati iz te sezone više ne računaju u zvaničnu sezonu. Time ste pali ispod praga od 12"
			+ " bodova, pa vam je početnička kategorija ponovo otvorena za sezonu 2028.\n\nBalkanska trkačka liga";

	private static final String A_TOWN_ABROAD = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	/** Ticked the beginners' category, 12,50 in 2027, no membership of it. */
	private static final String TICKED = "000101";

	/** The same runs, never ticked it. */
	private static final String NOT_TICKED = "000102";

	/** 11,99 in 2027, no membership of it. */
	private static final String JUST_UNDER = "000103";

	/** The very runs {@link #TICKED} has, and nobody writes his season. */
	private static final String THE_TWIN = "000104";

	/** Nothing at all. */
	private static final String A_THIRD = "000105";

	/** Holds 2027 on a payment, 12,50 in it. */
	private static final String HELD_ON_A_PAYMENT = "000106";

	/** Holds 2027 free of the fee, 12,50 in it. */
	private static final String HELD_FREE = "000107";

	/** Holds 2027 on a payment, 11,99 in it. */
	private static final String HELD_JUST_UNDER = "000108";

	/** Holds 2027 with 12,50 in it, and has 12,50 in 2028 as well: 2027 already closed it. */
	private static final String CLOSED_BEFORE = "000109";

	/** Holds 2027 with 5,00 in it, and has 12,50 in 2028. */
	private static final String CLOSED_BY_2028 = "000110";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Autowired
	private AClockTheCaseMoves clock;

	private final Map<String, String> cookies = new HashMap<>();

	private int issued;

	/** The same shape {@code MemberMembershipApiTest} uses, and it reports UTC for the same reason. */
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
			return new AClockTheCaseMoves(SEPTEMBER_2027);
		}
	}

	/** Every road that writes a season for a member, each the way its screen sends it. */
	enum Road {
		THE_PAYMENTS_SCREEN, A_PAYMENT_ON_HIS_ROW, FREE_OF_THE_FEE, FROM_HIS_BALANCE, HIS_OWN_ACTIVATION
	}

	@BeforeEach
	void membersRunsAndTheSuperadmin() {
		clock.moveTo(SEPTEMBER_2027);

		for (String number : List.of(TICKED, NOT_TICKED, JUST_UNDER, THE_TWIN, A_THIRD, HELD_ON_A_PAYMENT,
				HELD_FREE, HELD_JUST_UNDER, CLOSED_BEFORE, CLOSED_BY_2028)) {
			long id = competitor(number, !NOT_TICKED.equals(number));

			account(number + "@primer.rs", "competitor", id);

			/* ENOUGH IN HIS BOOK FOR ANY FEE, so the balance and his own activation can spend it. */
			db.sql("insert into balance_entry (competitor_id, amount, currency, reason, season, occurred_at,"
							+ " recorded_by_name) values (?, 100.00, 'EUR', 'overpayment', 2027,"
							+ " timestamptz '2027-01-10 10:00:00+00', 'Blagajnik Probni')")
					.param(id).update();
		}

		account(THE_SUPERADMIN, "superadmin", null);

		aRace("pre-lige", "2026-05-10");
		aRace("prolece-2027", "2027-05-10");
		aRace("leto-2027", "2027-06-12");
		aRace("prolece-2028", "2028-05-10");

		/* TWO RUNS AND NOT ONE, so no single run is the threshold, and fifty points before the league. */
		for (String number : List.of(TICKED, NOT_TICKED, THE_TWIN, HELD_ON_A_PAYMENT, HELD_FREE, CLOSED_BEFORE)) {
			aRun(number, "pre-lige", "50.00");
			aRun(number, "prolece-2027", "7.00");
			aRun(number, "leto-2027", "5.50");
		}

		aRun(JUST_UNDER, "prolece-2027", "11.99");
		aRun(HELD_JUST_UNDER, "prolece-2027", "11.99");
		aRun(CLOSED_BY_2028, "prolece-2027", "5.00");
		aRun(CLOSED_BEFORE, "prolece-2028", "12.50");
		aRun(CLOSED_BY_2028, "prolece-2028", "12.50");

		HeldOn.season(db, idOf(HELD_ON_A_PAYMENT), 2027, "payment");
		HeldOn.season(db, idOf(HELD_FREE), 2027, "feeExempt");
		HeldOn.season(db, idOf(HELD_JUST_UNDER), 2027, "payment");
		HeldOn.season(db, idOf(CLOSED_BEFORE), 2027, "feeExempt");
		HeldOn.season(db, idOf(CLOSED_BY_2028), 2027, "feeExempt");
	}

	/* ------------------------------------------------------------------------------------
	   A SEASON WRITTEN
	   ------------------------------------------------------------------------------------ */

	/**
	 * A MEMBERSHIP OF 2027 WRITTEN OVER 12,50 OF 2027 CLOSES 2028, AND HE IS TOLD, on every road, ticked
	 * or not; the member below the threshold, written by the same road, is told nothing, and so is the
	 * member with the very same runs whom nobody wrote, a third member, and the league.
	 */
	@ParameterizedTest
	@EnumSource(Road.class)
	void aSeasonWrittenOverTheThresholdClosesTheNextOneAndHeIsTold(Road road) throws Exception {
		for (String number : List.of(TICKED, NOT_TICKED, JUST_UNDER)) {
			assertThat(written(road, number).getStatus()).as("%s on %s", number, road).isIn(200, 201);
		}

		assertThat(linesTo(TICKED)).containsExactly(CLOSED + "|" + CLOSED_2027);
		assertThat(linesTo(NOT_TICKED)).containsExactly(CLOSED + "|" + CLOSED_2027);
		assertThat(linesTo(JUST_UNDER)).isEmpty();
		assertThat(linesTo(THE_TWIN)).isEmpty();
		assertThat(linesTo(A_THIRD)).isEmpty();
		assertThat(linesToEverybody()).isZero();
		assertThat(sendersOfTheLines()).containsOnly(THE_LEAGUE);
	}

	/**
	 * THE SEASON WRITTEN IS 2028 AND THE CATEGORY 2029, a year on: two numbers that are neither the year
	 * the first case names, and one apart, so a line about the wrong season reads differently. And the
	 * member whose 2027 already closed it is told nothing, because nothing moved.
	 */
	@Test
	void aYearOnTheLineNamesThatYearsSeasonsAndAnEarlierClosureMovesNothing() throws Exception {
		clock.moveTo(SEPTEMBER_2028);

		assertThat(written(Road.FREE_OF_THE_FEE, CLOSED_BY_2028).getStatus()).isEqualTo(201);
		assertThat(written(Road.FREE_OF_THE_FEE, CLOSED_BEFORE).getStatus()).isEqualTo(201);

		assertThat(linesTo(CLOSED_BY_2028)).containsExactly(CLOSED + "|"
				+ "Upisana vam je članarina za sezonu 2028, pa se vaši odobreni rezultati iz te sezone računaju"
				+ " u zvaničnu sezonu. Time ste prešli prag od 12 bodova, pa vam je početnička kategorija"
				+ " zatvorena za sezonu 2029.\n\nBalkanska trkačka liga");
		assertThat(linesTo(CLOSED_BEFORE)).isEmpty();
	}

	/**
	 * AFTER 15 OCTOBER THE SEASON ON SALE IS 2028, WHICH HAS NO RUNS, so writing it moves nothing and he
	 * is told nothing, though 2027 holds 12,50 of his: 2027 counts only where he holds 2027.
	 */
	@ParameterizedTest
	@EnumSource(Road.class)
	void aSeasonWithNoRunsYetMovesNothing(Road road) throws Exception {
		clock.moveTo(AFTER_THE_FIFTEENTH);

		assertThat(written(road, TICKED).getStatus()).isIn(200, 201);
		assertThat(seasonsOf(TICKED)).containsExactly(2028);
		assertThat(linesTo(TICKED)).isEmpty();
	}

	/**
	 * WHAT THE LINE SAID IS WHAT THE SCREEN SAYS FROM 15 OCTOBER, and these are the two homes of the
	 * right: this class asks it for the season after the membership's, {@code TheChoiceAsItStands} for
	 * the season on sale, and from 15 October those are one season. The member written is refused the
	 * category for 2028 and the twin nobody wrote is not.
	 */
	@Test
	void theScreenFromTheFifteenthSaysWhatTheLineSaid() throws Exception {
		assertThat(written(Road.FREE_OF_THE_FEE, TICKED).getStatus()).isEqualTo(201);
		assertThat(cancelled(HELD_ON_A_PAYMENT, "payment").getStatus()).isEqualTo(200);

		assertThat(linesTo(TICKED)).containsExactly(CLOSED + "|" + CLOSED_2027);
		assertThat(linesTo(HELD_ON_A_PAYMENT)).containsExactly(REOPENED + "|" + REOPENED_2027);

		clock.moveTo(THE_FIFTEENTH);

		JsonNode ticked = category(TICKED);
		JsonNode reopened = category(HELD_ON_A_PAYMENT);

		assertThat(ticked.get("season").asInt()).isEqualTo(2028);
		assertThat(ticked.get("firstSeasonAllowed").asBoolean()).isFalse();
		assertThat(reopened.get("firstSeasonAllowed").asBoolean()).isTrue();
		assertThat(category(THE_TWIN).get("firstSeasonAllowed").asBoolean()).isTrue();
		assertThat(category(HELD_FREE).get("firstSeasonAllowed").asBoolean()).isFalse();
	}

	/* ------------------------------------------------------------------------------------
	   A SEASON CANCELLED, AND A BASIS CHANGED
	   ------------------------------------------------------------------------------------ */

	/**
	 * A CANCELLATION OPENS IT AGAIN, on a payment (the payment goes and takes the membership with it) and
	 * free of the fee (the membership itself goes), and he is told; below the threshold it opens nothing.
	 */
	@Test
	void aSeasonCancelledOverTheThresholdOpensTheNextOneAgainAndHeIsTold() throws Exception {
		assertThat(cancelled(HELD_ON_A_PAYMENT, "payment").getStatus()).isEqualTo(200);
		assertThat(cancelled(HELD_FREE, "feeExempt").getStatus()).isEqualTo(200);
		assertThat(cancelled(HELD_JUST_UNDER, "payment").getStatus()).isEqualTo(200);

		assertThat(linesTo(HELD_ON_A_PAYMENT)).containsExactly(REOPENED + "|" + REOPENED_2027);
		assertThat(linesTo(HELD_FREE)).containsExactly(REOPENED + "|" + REOPENED_2027);
		assertThat(linesTo(HELD_JUST_UNDER)).isEmpty();
		assertThat(linesTo(THE_TWIN)).isEmpty();
		assertThat(linesToEverybody()).isZero();
		assertThat(sendersOfTheLines()).containsOnly(THE_LEAGUE);
	}

	/**
	 * A CHANGE OF BASIS SAYS NOTHING ABOUT THE CATEGORY, either way, though it deletes the season's row
	 * and writes it again on the way: the season stands before and after. This is the case that fails if
	 * the right is asked where the row is written ({@code BookingAPayment}, {@code GrantingASeason})
	 * instead of on the route.
	 */
	@Test
	void aChangeOfBasisSaysNothingAboutTheCategory() throws Exception {
		assertThat(changed(HELD_ON_A_PAYMENT, "{\"from\": \"payment\", \"to\": \"feeExempt\"}").getStatus())
				.isEqualTo(200);
		assertThat(changed(HELD_FREE,
				"{\"from\": \"feeExempt\", \"to\": \"payment\", \"received\": 38.00, \"method\": \"paypal\"}")
				.getStatus()).isEqualTo(200);

		assertThat(seasonsOf(HELD_ON_A_PAYMENT)).containsExactly(2027);
		assertThat(seasonsOf(HELD_FREE)).containsExactly(2027);
		assertThat(linesTo(HELD_ON_A_PAYMENT)).isEmpty();
		assertThat(linesTo(HELD_FREE)).isEmpty();
	}

	/* ------------------------------------------------------------------------------------
	   THE FIXTURE
	   ------------------------------------------------------------------------------------ */

	private long competitor(String number, boolean ticked) {
		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', 'Clan',"
						+ " 'M', date '1990-05-15', " + A_TOWN_ABROAD + ", null, null, 2027, ?, true, ?, null,"
						+ " '', false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.params(number, ticked, String.format("00aabbccdd%06x", ++issued))
				.query(Long.class).single();
	}

	private void account(String email, String role, Long competitor) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Probni', 'Probic', ?, (select id from role where code = ?), ?)")
				.params(email, role, competitor).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookies.put(email, session.secret());
	}

	/** One race on its own event, on its day, since a result needs both. */
	private void aRace(String slug, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link) values (?, ?, cast(? as date),"
						+ " (select id from place where rank = 1), null, null, 'race', false, '', '')")
				.params(slug, "Dogadjaj " + slug, day).update();

		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
						+ " ascent_m, descent_m) values ((select id from btl_event where slug = ?), ?, false,"
						+ " cast(? as date), 'length', 0, 10.00, 0, 0)")
				.params(slug, "Trka " + slug, day).update();
	}

	private void aRun(String number, String slug, String points) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m,"
						+ " seconds, points) select c.id, r.id, r.date, 10.00, 0, 0, 3600, cast(? as numeric)"
						+ " from competitor c, race r where c.member_number = ? and r.name = ?")
				.params(points, number, "Trka " + slug).update();
	}

	private long idOf(String number) {
		return db.sql("select id from competitor where member_number = ?").param(number)
				.query(Long.class).single();
	}

	/* ------------------------------------------------------------------------------------
	   THE ROADS
	   ------------------------------------------------------------------------------------ */

	private MockHttpServletResponse written(Road road, String number) throws Exception {
		long id = idOf(number);

		return switch (road) {
			case THE_PAYMENTS_SCREEN -> sent(post("/api/payments"), "{\"competitorId\": " + id
					+ ", \"received\": 38.00, \"useTheBalance\": false, \"method\": \"paypal\"}", THE_SUPERADMIN);
			case A_PAYMENT_ON_HIS_ROW -> sent(post("/api/members/" + number + "/payment"),
					"{\"received\": 38.00, \"method\": \"paypal\"}", THE_SUPERADMIN);
			case FREE_OF_THE_FEE -> sent(post("/api/memberships"),
					"{\"competitorId\": " + id + ", \"ground\": \"feeExempt\"}", THE_SUPERADMIN);
			case FROM_HIS_BALANCE -> sent(post("/api/memberships"),
					"{\"competitorId\": " + id + ", \"ground\": \"balance\"}", THE_SUPERADMIN);
			case HIS_OWN_ACTIVATION -> sent(post("/api/me/membership"), "{}", number + "@primer.rs");
		};
	}

	private MockHttpServletResponse cancelled(String number, String basis) throws Exception {
		return sent(delete("/api/members/" + number + "/membership"), "{\"basis\": \"" + basis + "\"}",
				THE_SUPERADMIN);
	}

	private MockHttpServletResponse changed(String number, String json) throws Exception {
		return sent(put("/api/members/" + number + "/membership"), json, THE_SUPERADMIN);
	}

	private MockHttpServletResponse sent(MockHttpServletRequestBuilder asks, String json, String email)
			throws Exception {
		return http.perform(asks.with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json)
						.cookie(new Cookie(SessionCookie.NAME, cookies.get(email))))
				.andReturn().getResponse();
	}

	private JsonNode category(String number) throws Exception {
		return mapper.readTree(http.perform(get("/api/me/category")
						.cookie(new Cookie(SessionCookie.NAME, cookies.get(number + "@primer.rs"))))
				.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
	}

	/* ------------------------------------------------------------------------------------
	   WHAT IS READ BACK
	   ------------------------------------------------------------------------------------ */

	/** Every line about the beginners' category addressed to him, subject and body. */
	private List<String> linesTo(String number) {
		return db.sql("select subject || '|' || body from message where to_id = ?"
						+ " and subject like 'Početnička kategorija%' order by id")
				.param(idOf(number)).query(String.class).list();
	}

	private long linesToEverybody() {
		return db.sql("select count(*) from message where to_id is null").query(Long.class).single();
	}

	private List<String> sendersOfTheLines() {
		return db.sql("select from_name from message where subject like 'Početnička kategorija%'")
				.query(String.class).list();
	}

	private List<Integer> seasonsOf(String number) {
		return db.sql("select season from membership where competitor_id = ? order by season")
				.param(idOf(number)).query(Integer.class).list();
	}
}
